import { Router } from 'express';
import { getSupabaseAdmin } from '../../services/supabase/client.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { asyncHandler, notFound } from '../../utils/httpErrors.js';
import { parseListQuery } from '../../utils/pagination.js';
import { ValidationError } from '../../errors.js';

const router = Router();

async function profileStats(userId) {
  const admin = getSupabaseAdmin();
  const [ratings, reviews] = await Promise.all([
    admin.from('ratings').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    admin.from('reviews').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);
  return {
    ratingsCount: ratings.count ?? 0,
    reviewsCount: reviews.count ?? 0,
  };
}

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const admin = getSupabaseAdmin();
    const { data: profile, error } = await admin
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();
    if (error || !profile) throw notFound('Profile not found.');
    const stats = await profileStats(req.user.id);
    res.json({ profile, stats, meta: { status: 'ok' } });
  })
);

router.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { displayName, avatarUrl, bio } = req.body || {};
    const admin = getSupabaseAdmin();
    const updates = { updated_at: new Date().toISOString() };
    if (displayName !== undefined) updates.display_name = displayName;
    if (avatarUrl !== undefined) updates.avatar_url = avatarUrl;
    if (bio !== undefined) updates.bio = bio;

    const { data, error } = await admin
      .from('profiles')
      .update(updates)
      .eq('id', req.user.id)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ profile: data, meta: { status: 'ok' } });
  })
);

router.patch(
  '/me/taste',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { genres, artistIds } = req.body || {};
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('profiles')
      .update({
        taste_genres: genres || [],
        taste_artist_ids: artistIds || [],
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.user.id)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ profile: data, meta: { status: 'ok' } });
  })
);

router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) throw new ValidationError('Query parameter q is required.', 'q');
    const { limit, offset } = parseListQuery(req.query);
    const admin = getSupabaseAdmin();
    const { data, error, count } = await admin
      .from('profiles')
      .select('*', { count: 'exact' })
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .range(offset, offset + limit - 1);
    if (error) return res.status(400).json({ error: error.message });
    res.json({
      items: data || [],
      total: count ?? 0,
      nextOffset: (data?.length || 0) >= limit ? offset + limit : null,
      meta: { status: 'ok' },
    });
  })
);

router.get(
  '/:username',
  asyncHandler(async (req, res) => {
    const admin = getSupabaseAdmin();
    const { data: profile, error } = await admin
      .from('profiles')
      .select('*')
      .eq('username', req.params.username.toLowerCase())
      .single();
    if (error || !profile) throw notFound('User not found.');
    const stats = await profileStats(profile.id);
    res.json({ profile, stats, meta: { status: 'ok' } });
  })
);

router.post(
  '/:id/follow',
  requireAuth,
  asyncHandler(async (req, res) => {
    const followingId = req.params.id;
    if (followingId === req.user.id) {
      return res.status(400).json({ error: 'Cannot follow yourself.' });
    }
    const admin = getSupabaseAdmin();
    const { error } = await admin.from('follows').upsert({
      follower_id: req.user.id,
      following_id: followingId,
    });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true, meta: { status: 'ok' } });
  })
);

router.delete(
  '/:id/follow',
  requireAuth,
  asyncHandler(async (req, res) => {
    const admin = getSupabaseAdmin();
    await admin
      .from('follows')
      .delete()
      .eq('follower_id', req.user.id)
      .eq('following_id', req.params.id);
    res.json({ success: true });
  })
);

router.get(
  '/:id/followers',
  asyncHandler(async (req, res) => {
    const { limit, offset } = parseListQuery(req.query);
    const admin = getSupabaseAdmin();
    const { data: rows, error, count } = await admin
      .from('follows')
      .select('follower_id', { count: 'exact' })
      .eq('following_id', req.params.id)
      .range(offset, offset + limit - 1);
    if (error) return res.status(400).json({ error: error.message });
    const ids = (rows || []).map((r) => r.follower_id);
    const { data: profiles } = ids.length
      ? await admin.from('profiles').select('*').in('id', ids)
      : { data: [] };
    res.json({
      items: profiles || [],
      total: count ?? 0,
      nextOffset: offset + limit < (count ?? 0) ? offset + limit : null,
      meta: { status: 'ok' },
    });
  })
);

router.get(
  '/:id/following',
  asyncHandler(async (req, res) => {
    const { limit, offset } = parseListQuery(req.query);
    const admin = getSupabaseAdmin();
    const { data: rows, error, count } = await admin
      .from('follows')
      .select('following_id', { count: 'exact' })
      .eq('follower_id', req.params.id)
      .range(offset, offset + limit - 1);
    if (error) return res.status(400).json({ error: error.message });
    const ids = (rows || []).map((r) => r.following_id);
    const { data: profiles } = ids.length
      ? await admin.from('profiles').select('*').in('id', ids)
      : { data: [] };
    res.json({
      items: profiles || [],
      total: count ?? 0,
      nextOffset: offset + limit < (count ?? 0) ? offset + limit : null,
      meta: { status: 'ok' },
    });
  })
);

router.get(
  '/:id/compatibility',
  requireAuth,
  asyncHandler(async (req, res) => {
    const admin = getSupabaseAdmin();
    const [me, other] = await Promise.all([
      admin.from('profiles').select('taste_genres, taste_artist_ids').eq('id', req.user.id).single(),
      admin.from('profiles').select('taste_genres, taste_artist_ids').eq('id', req.params.id).single(),
    ]);
    if (!other.data) throw notFound('User not found.');
    const myGenres = new Set(me.data?.taste_genres || []);
    const theirGenres = new Set(other.data?.taste_genres || []);
    const myArtists = new Set((me.data?.taste_artist_ids || []).map(String));
    const theirArtists = new Set((other.data?.taste_artist_ids || []).map(String));
    let overlap = 0;
    let union = 0;
    for (const g of myGenres) {
      union++;
      if (theirGenres.has(g)) overlap++;
    }
    for (const g of theirGenres) if (!myGenres.has(g)) union++;
    for (const a of myArtists) {
      union++;
      if (theirArtists.has(a)) overlap++;
    }
    for (const a of theirArtists) if (!myArtists.has(a)) union++;
    const score = union === 0 ? 0 : Math.round((overlap / union) * 100);
    res.json({ score, overlap, union, meta: { status: 'ok' } });
  })
);

router.get(
  '/:id/ratings',
  asyncHandler(async (req, res) => {
    const { limit, offset } = parseListQuery(req.query);
    const admin = getSupabaseAdmin();
    const { data: profile } = await admin
      .from('profiles')
      .select('id')
      .eq('username', req.params.username)
      .maybeSingle();
    const userId = profile?.id || req.params.id;
    const { data, error, count } = await admin
      .from('ratings')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
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
  '/:id/lists',
  asyncHandler(async (req, res) => {
    const { limit, offset } = parseListQuery(req.query);
    const admin = getSupabaseAdmin();
    const { data, error, count } = await admin
      .from('lists')
      .select('*', { count: 'exact' })
      .eq('user_id', req.params.id)
      .eq('is_public', true)
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
