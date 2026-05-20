import { config } from '../config.js';

/**
 * Requires a valid Bearer token matching ADMIN_TOKEN.
 * Returns 503 if admin is not configured on the server.
 */
export function requireAdminToken(req, res, next) {
  if (!config.adminToken) {
    return res.status(503).json({
      error: 'Cache admin not configured on server.',
      code: 'ADMIN_NOT_CONFIGURED',
    });
  }

  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();

  if (!token || token !== config.adminToken) {
    return res.status(401).json({
      error: 'Invalid or missing admin token.',
      code: 'UNAUTHORIZED',
    });
  }

  next();
}
