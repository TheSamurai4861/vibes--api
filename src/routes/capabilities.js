import { Router } from 'express';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
import { buildApiCatalog } from '../data/api-catalog.js';
import { asyncHandler } from '../utils/httpErrors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '../..');
const openapiPath = path.join(projectRoot, 'openapi.yaml');

const router = Router();

function sendCatalog(req, res) {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const catalog = buildApiCatalog({ supabaseConfigured: config.supabaseConfigured });
  res.json({
    ...catalog,
    baseUrl,
    meta: { status: 'ok' },
  });
}

router.get('/capabilities', sendCatalog);
router.get('/', (req, res, next) => {
  if (req.originalUrl === '/api' || req.originalUrl === '/api/') {
    return sendCatalog(req, res);
  }
  return next();
});

router.get(
  '/openapi.yaml',
  asyncHandler(async (_req, res) => {
    const yaml = readFileSync(openapiPath, 'utf8');
    res.type('text/yaml').send(yaml);
  })
);

export default router;
