import { Router } from 'express';
import { getSupabaseAdmin } from '../../services/supabase/client.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { asyncHandler, notFound } from '../../utils/httpErrors.js';
import { ValidationError } from '../../errors.js';

const router = Router();

router.get(
  '/me/listen-later',
  requireAuth,
  asyncHandler(async (req, res) => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('listen_later')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ items: data || [], meta: { status: 'ok' } });
  })
);

router.post(
  '/me/listen-later',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { musicItemId, musicType } = req.body || {};
    if (!musicItemId) throw new ValidationError('musicItemId is required.');
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('listen_later')
      .upsert(
        {
          user_id: req.user.id,
          music_item_id: String(musicItemId),
          music_type: musicType || 'track',
        },
        { onConflict: 'user_id,music_item_id' }
      )
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ item: data, meta: { status: 'ok' } });
  })
);

router.delete(
  '/me/listen-later/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const admin = getSupabaseAdmin();
    await admin
      .from('listen_later')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);
    res.json({ success: true });
  })
);

router.post(
  '/lists',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { title, description, isPublic } = req.body || {};
    if (!title) throw new ValidationError('title is required.');
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('lists')
      .insert({
        user_id: req.user.id,
        title,
        description: description || null,
        is_public: isPublic !== false,
      })
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ list: data, meta: { status: 'ok' } });
  })
);

router.get(
  '/lists/search',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('lists')
      .select('*, profiles!lists_user_id_fkey(username, display_name)')
      .eq('is_public', true)
      .ilike('title', `%${q}%`)
      .limit(25);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ items: data || [], meta: { status: 'ok' } });
  })
);

router.get(
  '/lists/:id',
  asyncHandler(async (req, res) => {
    const admin = getSupabaseAdmin();
    const { data: list, error } = await admin
      .from('lists')
      .select('*, profiles!lists_user_id_fkey(username, display_name)')
      .eq('id', req.params.id)
      .single();
    if (error || !list) throw notFound('List not found.');
    const { data: items } = await admin
      .from('list_items')
      .select('*')
      .eq('list_id', req.params.id)
      .order('position', { ascending: true });
    res.json({ list, items: items || [], meta: { status: 'ok' } });
  })
);

router.post(
  '/lists/:id/items',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { musicItemId, musicType, position } = req.body || {};
    if (!musicItemId) throw new ValidationError('musicItemId is required.');
    const admin = getSupabaseAdmin();
    const { data: list } = await admin.from('lists').select('user_id').eq('id', req.params.id).single();
    if (!list || list.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not your list.' });
    }
    const { data, error } = await admin
      .from('list_items')
      .insert({
        list_id: req.params.id,
        music_item_id: String(musicItemId),
        music_type: musicType || 'track',
        position: position ?? 0,
      })
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ item: data, meta: { status: 'ok' } });
  })
);

export default router;
