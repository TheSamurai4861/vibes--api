import { Router } from 'express';
import { getSupabaseAdmin } from '../../services/supabase/client.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { asyncHandler } from '../../utils/httpErrors.js';
import { parseMusicItemId } from '../../utils/pagination.js';
import { ValidationError } from '../../errors.js';

const router = Router();

function formatMusicItemId(type, id) {
  return `${type}:${id}`;
}

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { musicItemId, score, musicType } = req.body || {};
    if (!musicItemId || score === undefined) {
      throw new ValidationError('musicItemId and score are required.');
    }
    const parsed = parseMusicItemId(musicItemId);
    const itemId = formatMusicItemId(musicType || parsed.type, parsed.id);
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('ratings')
      .upsert(
        {
          user_id: req.user.id,
          music_item_id: itemId,
          music_type: musicType || parsed.type,
          score: Number(score),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,music_item_id' }
      )
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ rating: data, meta: { status: 'ok' } });
  })
);

router.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { score } = req.body || {};
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('ratings')
      .update({ score: Number(score), updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ rating: data, meta: { status: 'ok' } });
  })
);

router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const admin = getSupabaseAdmin();
    await admin.from('ratings').delete().eq('id', req.params.id).eq('user_id', req.user.id);
    res.json({ success: true });
  })
);

export default router;
