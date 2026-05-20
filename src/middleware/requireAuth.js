import { getSupabaseAsUser } from '../services/supabase/client.js';
import { unauthorized } from '../utils/httpErrors.js';

/**
 * Requires Bearer JWT (Supabase access token).
 */
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    const token = match?.[1]?.trim();
    if (!token) {
      return res.status(401).json({ error: 'Missing Bearer token.', code: 'UNAUTHORIZED' });
    }

    const supabase = getSupabaseAsUser(token);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid or expired token.', code: 'UNAUTHORIZED' });
    }

    req.user = data.user;
    req.supabase = supabase;
    req.accessToken = token;
    next();
  } catch (err) {
    if (err.code === 'SUPABASE_NOT_CONFIGURED') {
      return res.status(503).json({
        error: 'Vibes API not configured.',
        code: 'SUPABASE_NOT_CONFIGURED',
      });
    }
    next(err);
  }
}

export function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return next();
  return requireAuth(req, res, next);
}
