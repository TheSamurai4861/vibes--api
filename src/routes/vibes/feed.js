import { Router } from 'express';
import { getSupabaseAdmin } from '../../services/supabase/client.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { asyncHandler } from '../../utils/httpErrors.js';
import { parseListQuery } from '../../utils/pagination.js';

const router = Router();

router.get(
  '/friends',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { limit, offset } = parseListQuery(req.query);
    const admin = getSupabaseAdmin();
    const { data: following } = await admin
      .from('follows')
      .select('following_id')
      .eq('follower_id', req.user.id);
    const ids = (following || []).map((f) => f.following_id);
    if (!ids.length) {
      return res.json({ items: [], total: 0, nextOffset: null, meta: { status: 'ok' } });
    }

    const [ratings, reviews] = await Promise.all([
      admin
        .from('ratings')
        .select('*, profiles!ratings_user_id_fkey(username, display_name, avatar_url)')
        .in('user_id', ids)
        .order('created_at', { ascending: false })
        .limit(limit),
      admin
        .from('reviews')
        .select('*, profiles!reviews_user_id_fkey(username, display_name, avatar_url)')
        .in('user_id', ids)
        .order('created_at', { ascending: false })
        .limit(limit),
    ]);

    const items = [
      ...(ratings.data || []).map((r) => ({ type: 'rating', ...r })),
      ...(reviews.data || []).map((r) => ({ type: 'review', ...r })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({
      items: items.slice(0, limit),
      total: items.length,
      nextOffset: items.length > limit ? offset + limit : null,
      meta: { status: 'ok' },
    });
  })
);

router.get(
  '/home',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({
      sections: {
        friendsActivity: '/feed/friends',
        discover: '/api/discover/new-releases',
      },
      meta: { status: 'ok' },
    });
  })
);

router.get(
  '/trending/reviews',
  asyncHandler(async (req, res) => {
    const { limit, offset } = parseListQuery(req.query);
    const admin = getSupabaseAdmin();
    const { data, error, count } = await admin
      .from('reviews')
      .select('*, profiles!reviews_user_id_fkey(username, display_name, avatar_url)', { count: 'exact' })
      .order('likes_count', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) return res.status(400).json({ error: error.message });
    res.json({
      items: data || [],
      total: count ?? 0,
      nextOffset: offset + limit < (count ?? 0) ? offset + limit : null,
      meta: { status: 'ok' },
    });
  })
);

router.get(
  '/trending/lists',
  asyncHandler(async (req, res) => {
    const { limit, offset } = parseListQuery(req.query);
    const admin = getSupabaseAdmin();
    const { data, error, count } = await admin
      .from('lists')
      .select('*, profiles!lists_user_id_fkey(username, display_name)', { count: 'exact' })
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) return res.status(400).json({ error: error.message });
    res.json({
      items: data || [],
      total: count ?? 0,
      nextOffset: offset + limit < (count ?? 0) ? offset + limit : null,
      meta: { status: 'ok' },
    });
  })
);

export default router;
