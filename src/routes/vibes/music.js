import { Router } from 'express';
import { getSupabaseAdmin } from '../../services/supabase/client.js';
import { asyncHandler } from '../../utils/httpErrors.js';
import { parseListQuery } from '../../utils/pagination.js';

const router = Router();

router.get(
  '/:musicItemId/reviews',
  asyncHandler(async (req, res) => {
    const { limit, offset } = parseListQuery(req.query);
    const admin = getSupabaseAdmin();
    const { data, error, count } = await admin
      .from('reviews')
      .select('*, profiles!reviews_user_id_fkey(username, display_name, avatar_url)', { count: 'exact' })
      .eq('music_item_id', req.params.musicItemId)
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
  '/:musicItemId/ratings/summary',
  asyncHandler(async (req, res) => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('ratings')
      .select('score')
      .eq('music_item_id', req.params.musicItemId);
    if (error) return res.status(400).json({ error: error.message });
    const scores = data || [];
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    for (const r of scores) {
      sum += r.score;
      distribution[r.score] = (distribution[r.score] || 0) + 1;
    }
    const count = scores.length;
    res.json({
      average: count ? Math.round((sum / count) * 10) / 10 : null,
      count,
      distribution,
      meta: { status: 'ok' },
    });
  })
);

export default router;
