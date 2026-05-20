import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './src/config.js';
import { UpstreamError, ValidationError } from './src/errors.js';
import { requireAdminToken } from './src/middleware/auth.js';
import { apiGlobalLimiter, searchDetailsLimiter } from './src/middleware/rateLimit.js';
import {
  validateSearchQuery,
  validateSearchType,
  validateTrackId,
} from './src/validation.js';
import {
  searchAggregated,
  getTrackDetailsAggregated,
} from './src/aggregator.js';
import * as cache from './src/services/cache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes('*')) {
        return callback(null, true);
      }
      if (config.corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
  })
);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(
      `[HTTP] ${req.method} ${req.originalUrl} - Status: ${res.statusCode} (${duration}ms)`
    );
  });
  next();
});

app.use('/api', apiGlobalLimiter);

/**
 * GET /api/health
 */
app.get('/api/health', async (req, res) => {
  const cacheOk = await cache.ping();
  const status = cacheOk ? 'ok' : 'degraded';
  res.status(cacheOk ? 200 : 503).json({
    status,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    cache: cacheOk ? 'connected' : 'unavailable',
  });
});

/**
 * GET /api/search?q={query}&type={track|album|artist}
 */
app.get('/api/search', searchDetailsLimiter, async (req, res) => {
  try {
    const q = validateSearchQuery(req.query.q);
    const type = validateSearchType(req.query.type);

    const startTime = Date.now();
    const results = await searchAggregated(q, type);
    const duration = Date.now() - startTime;

    res.setHeader('X-Response-Time-Ms', duration.toString());

    const responsePayload = {
      query: q,
      type,
      resultsCount: results.length,
      responseTimeMs: duration,
      meta: { status: 'ok' },
    };

    if (type === 'track') {
      responsePayload.tracks = results;
    } else if (type === 'album') {
      responsePayload.albums = results;
    } else if (type === 'artist') {
      responsePayload.artists = results;
    }

    return res.json(responsePayload);
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        error: error.message,
        code: 'VALIDATION_ERROR',
        field: error.field,
      });
    }
    if (error instanceof UpstreamError) {
      console.error('[HTTP] Upstream error on /api/search:', error.message);
      return res.status(503).json({
        error: 'Music search service is temporarily unavailable.',
        code: 'UPSTREAM_UNAVAILABLE',
        meta: { status: 'error', sources: [error.source] },
      });
    }
    console.error('[HTTP] Error handling /api/search:', error);
    return res.status(500).json({
      error: 'Internal server error while searching.',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * GET /api/details?trackId={trackId}
 */
app.get('/api/details', searchDetailsLimiter, async (req, res) => {
  try {
    const trackIdNum = validateTrackId(req.query.trackId);

    const startTime = Date.now();
    const result = await getTrackDetailsAggregated(trackIdNum);
    const duration = Date.now() - startTime;

    if (!result) {
      return res.status(404).json({
        error: `Track details not found for ID: ${req.query.trackId}`,
        code: 'NOT_FOUND',
      });
    }

    const { details, warnings } = result;
    const meta = {
      status: warnings.length > 0 ? 'degraded' : 'ok',
      ...(warnings.length > 0 && { warnings }),
    };

    res.setHeader('X-Response-Time-Ms', duration.toString());
    return res.json({
      responseTimeMs: duration,
      details,
      meta,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        error: error.message,
        code: 'VALIDATION_ERROR',
        field: error.field,
      });
    }
    if (error instanceof UpstreamError) {
      console.error('[HTTP] Upstream error on /api/details:', error.message);
      return res.status(503).json({
        error: 'Track details service is temporarily unavailable.',
        code: 'UPSTREAM_UNAVAILABLE',
        meta: { status: 'error', sources: [error.source] },
      });
    }
    console.error('[HTTP] Error handling /api/details:', error);
    return res.status(500).json({
      error: 'Internal server error while retrieving details.',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /api/cache/clear
 */
app.post('/api/cache/clear', requireAdminToken, async (req, res) => {
  try {
    await cache.clear();
    return res.json({ success: true, message: 'Cache cleared successfully.' });
  } catch (error) {
    console.error('[HTTP] Error clearing cache:', error);
    return res.status(500).json({
      error: 'Failed to clear cache.',
      code: 'INTERNAL_ERROR',
    });
  }
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API route not found.', code: 'NOT_FOUND' });
});

function shutdown(signal, server) {
  console.log(`[Server] Received ${signal}, shutting down gracefully...`);
  server.close(async () => {
    console.log('[Server] HTTP server closed.');
    try {
      await cache.close();
    } catch (err) {
      console.error('[Server] Error closing cache:', err);
    }
    process.exit(0);
  });
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`Music API Server running at http://localhost:${config.port}`);
    console.log(`Health: http://localhost:${config.port}/api/health`);
    console.log(`Cache DB: ${config.cacheDbPath}`);
    console.log(`Admin cache clear: ${config.adminToken ? 'enabled' : 'disabled'}`);
    console.log(`======================================================\n`);
  });

  process.on('SIGINT', () => shutdown('SIGINT', server));
  process.on('SIGTERM', () => shutdown('SIGTERM', server));
}
