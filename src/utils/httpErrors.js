import { UpstreamError, ValidationError } from '../errors.js';

/**
 * Express error handler wrapper for route handlers.
 * @param {(req: import('express').Request, res: import('express').Response) => Promise<void>} fn
 */
export function asyncHandler(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          error: error.message,
          code: 'VALIDATION_ERROR',
          field: error.field,
        });
      }
      if (error instanceof UpstreamError) {
        console.error(`[HTTP] Upstream ${req.method} ${req.path}:`, error.message);
        return res.status(503).json({
          error: 'Upstream service temporarily unavailable.',
          code: 'UPSTREAM_UNAVAILABLE',
          meta: { status: 'error', sources: [error.source] },
        });
      }
      if (error.code === 'SUPABASE_NOT_CONFIGURED') {
        return res.status(503).json({
          error: 'Vibes API is not configured (Supabase missing).',
          code: 'SUPABASE_NOT_CONFIGURED',
        });
      }
      if (error.statusCode === 401) {
        return res.status(401).json({ error: error.message, code: 'UNAUTHORIZED' });
      }
      if (error.statusCode === 404) {
        return res.status(404).json({ error: error.message, code: 'NOT_FOUND' });
      }
      console.error(`[HTTP] Error ${req.method} ${req.path}:`, error);
      return res.status(500).json({
        error: 'Internal server error.',
        code: 'INTERNAL_ERROR',
      });
    }
  };
}

export function notFound(message = 'Resource not found.') {
  const err = new Error(message);
  err.statusCode = 404;
  return err;
}

export function unauthorized(message = 'Unauthorized.') {
  const err = new Error(message);
  err.statusCode = 401;
  return err;
}
