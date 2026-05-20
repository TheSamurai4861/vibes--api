import { Router } from 'express';
import { getSupabaseAdmin } from '../../services/supabase/client.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { asyncHandler, notFound } from '../../utils/httpErrors.js';
import { parseListQuery } from '../../utils/pagination.js';
import { ValidationError } from '../../errors.js';

const router = Router();

router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) throw new ValidationError('q is required.', 'q');
    const { limit, offset } = parseListQuery(req.query);
    const admin = getSupabaseAdmin();
    const { data, error, count } = await admin
      .from('reviews')
      .select('*, profiles!reviews_user_id_fkey(username, display_name, avatar_url)', { count: 'exact' })
      .ilike('body', `%${q}%`)
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

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { musicItemId, body } = req.body || {};
    if (!musicItemId || !body) {
      throw new ValidationError('musicItemId and body are required.');
    }
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('reviews')
      .insert({
        user_id: req.user.id,
        music_item_id: String(musicItemId),
        body: String(body),
      })
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ review: data, meta: { status: 'ok' } });
  })
);

router.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('reviews')
      .update({ body: req.body.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ review: data, meta: { status: 'ok' } });
  })
);

router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const admin = getSupabaseAdmin();
    await admin.from('reviews').delete().eq('id', req.params.id).eq('user_id', req.user.id);
    res.json({ success: true });
  })
);

router.post(
  '/:id/like',
  requireAuth,
  asyncHandler(async (req, res) => {
    const admin = getSupabaseAdmin();
    await admin.from('review_likes').upsert({
      review_id: req.params.id,
      user_id: req.user.id,
    });
    const { count } = await admin
      .from('review_likes')
      .select('*', { count: 'exact', head: true })
      .eq('review_id', req.params.id);
    await admin.from('reviews').update({ likes_count: count ?? 0 }).eq('id', req.params.id);
    res.json({ success: true, likesCount: count ?? 0 });
  })
);

router.delete(
  '/:id/like',
  requireAuth,
  asyncHandler(async (req, res) => {
    const admin = getSupabaseAdmin();
    await admin
      .from('review_likes')
      .delete()
      .eq('review_id', req.params.id)
      .eq('user_id', req.user.id);
    const { count } = await admin
      .from('review_likes')
      .select('*', { count: 'exact', head: true })
      .eq('review_id', req.params.id);
    await admin.from('reviews').update({ likes_count: count ?? 0 }).eq('id', req.params.id);
    res.json({ success: true, likesCount: count ?? 0 });
  })
);

router.get(
  '/:id/comments',
  asyncHandler(async (req, res) => {
    const { limit, offset } = parseListQuery(req.query);
    const admin = getSupabaseAdmin();
    const { data, error, count } = await admin
      .from('review_comments')
      .select('*, profiles!review_comments_user_id_fkey(username, display_name, avatar_url)', { count: 'exact' })
      .eq('review_id', req.params.id)
      .order('created_at', { ascending: true })
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

router.post(
  '/:id/comments',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { body } = req.body || {};
    if (!body) throw new ValidationError('body is required.');
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('review_comments')
      .insert({
        review_id: req.params.id,
        user_id: req.user.id,
        body: String(body),
      })
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ comment: data, meta: { status: 'ok' } });
  })
);

export default router;
