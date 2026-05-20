import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { searchAggregated, searchTracksAggregated, getTrackDetailsAggregated } from './src/aggregator.js';
import * as cache from './src/services/cache.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`[HTTP] ${req.method} ${req.originalUrl} - Status: ${res.statusCode} (${duration}ms)`);
  });
  next();
});

/**
 * GET /api/search?q={query}&type={track|album|artist}
 * Queries Deezer and returns results rapidly.
 */
app.get('/api/search', async (req, res) => {
  try {
    const { q, type = 'track' } = req.query;
    if (!q || !q.trim()) {
      return res.status(400).json({ error: 'Search query parameter "q" is required.' });
    }

    const startTime = Date.now();
    const results = await searchAggregated(q, type);
    const duration = Date.now() - startTime;

    // Optional header to show search speed in response
    res.setHeader('X-Response-Time-Ms', duration.toString());
    
    // Build backward compatible response keys
    const responsePayload = {
      query: q,
      type,
      resultsCount: results.length,
      responseTimeMs: duration
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
    console.error('[HTTP] Error handling /api/search:', error);
    return res.status(500).json({ error: 'Internal server error while searching.' });
  }
});

/**
 * GET /api/details?trackId={trackId}
 * Aggregates information from multiple sources.
 */
app.get('/api/details', async (req, res) => {
  try {
    const { trackId } = req.query;
    if (!trackId) {
      return res.status(400).json({ error: 'Query parameter "trackId" is required.' });
    }

    const trackIdNum = parseInt(trackId, 10);
    if (isNaN(trackIdNum)) {
      return res.status(400).json({ error: 'Query parameter "trackId" must be a valid number.' });
    }

    const startTime = Date.now();
    const details = await getTrackDetailsAggregated(trackIdNum);
    const duration = Date.now() - startTime;

    if (!details) {
      return res.status(404).json({ error: `Track details not found for ID: ${trackId}` });
    }

    res.setHeader('X-Response-Time-Ms', duration.toString());
    return res.json({
      responseTimeMs: duration,
      details
    });
  } catch (error) {
    console.error('[HTTP] Error handling /api/details:', error);
    return res.status(500).json({ error: 'Internal server error while retrieving details.' });
  }
});

/**
 * POST /api/cache/clear
 * Admin endpoint to clear cache.
 */
app.post('/api/cache/clear', async (req, res) => {
  try {
    await cache.clear();
    return res.json({ success: true, message: 'Cache cleared successfully.' });
  } catch (error) {
    console.error('[HTTP] Error clearing cache:', error);
    return res.status(500).json({ error: 'Failed to clear cache.' });
  }
});

// 404 handler for API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API route not found.' });
});

// Start Express server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🎵 Music API Server running at http://localhost:${PORT}`);
  console.log(`🚀 WAL-enabled Cache and API integrations ready!`);
  console.log(`======================================================\n`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('[Server] Shutting down gracefully...');
  server.close(() => {
    console.log('[Server] HTTP server closed.');
    process.exit(0);
  });
});
