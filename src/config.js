import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function parseIntEnv(name, defaultValue) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  const value = parseInt(raw, 10);
  return Number.isNaN(value) ? defaultValue : value;
}

function parseOrigins(raw) {
  if (!raw || raw.trim() === '') {
    return ['*'];
  }
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
}

const cacheDbRaw = process.env.CACHE_DB_PATH || 'cache.db';
const cacheDbPath =
  cacheDbRaw === ':memory:' || path.isAbsolute(cacheDbRaw)
    ? cacheDbRaw
    : path.resolve(projectRoot, cacheDbRaw);

function parseBoolEnv(name) {
  const raw = (process.env[name] || '').toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

export const config = {
  port: parseIntEnv('PORT', 3000),
  adminToken: process.env.ADMIN_TOKEN || '',
  corsOrigins: parseOrigins(process.env.CORS_ORIGIN),
  rateLimitWindowMs: parseIntEnv('RATE_LIMIT_WINDOW_MS', 60_000),
  rateLimitMax: parseIntEnv('RATE_LIMIT_MAX', 60),
  rateLimitGlobalMax: parseIntEnv('RATE_LIMIT_GLOBAL_MAX', 120),
  cacheDbPath,
  cacheMemoryOnly: parseBoolEnv('CACHE_MEMORY_ONLY'),
  projectRoot,
};
