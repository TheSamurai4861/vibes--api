import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './src/config.js';
import { apiGlobalLimiter } from './src/middleware/rateLimit.js';
import capabilitiesRouter from './src/routes/capabilities.js';
import musicRouter from './src/routes/music.js';
import vibesRouter from './src/routes/vibes/index.js';
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

app.use('/api', apiGlobalLimiter, capabilitiesRouter);
app.use('/api', apiGlobalLimiter, musicRouter);
app.use(apiGlobalLimiter, vibesRouter);

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
    console.log(`Vibes Music API at http://localhost:${config.port}`);
    console.log(`Music:  /api/*  |  Vibes: /auth, /users, /feed, ...`);
    console.log(`Health: http://localhost:${config.port}/api/health`);
    console.log(`Catalog (IA): http://localhost:${config.port}/api/capabilities`);
    console.log(`Supabase: ${config.supabaseConfigured ? 'configured' : 'NOT configured'}`);
    console.log(`======================================================\n`);
  });

  process.on('SIGINT', () => shutdown('SIGINT', server));
  process.on('SIGTERM', () => shutdown('SIGTERM', server));
}
