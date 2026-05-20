import { Router } from 'express';
import { getSupabaseAdmin } from '../../services/supabase/client.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { asyncHandler } from '../../utils/httpErrors.js';
import * as deezer from '../../services/deezer.js';
import { mapAlbumList, mapTrackList, mapArtistList } from '../../mappers/deezerToVibes.js';
import { ValidationError } from '../../errors.js';

const router = Router();

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const admin = getSupabaseAdmin();
    const { data: profile } = await admin
      .from('profiles')
      .select('taste_genres, taste_artist_ids')
      .eq('id', req.user.id)
      .single();

    const albums = await deezer.getChartAlbums();
    const tracks = await deezer.getChartTracks();

    res.json({
      albums: mapAlbumList(albums).slice(0, 10),
      tracks: mapTrackList(tracks).slice(0, 10),
      basedOn: {
        genres: profile?.taste_genres || [],
        artistIds: profile?.taste_artist_ids || [],
      },
      meta: { status: 'ok' },
    });
  })
);

router.get(
  '/music/:id/similar',
  asyncHandler(async (req, res) => {
    const artistId = parseInt(req.params.id, 10);
    const related = await deezer.getArtistRelated(artistId);
    const top = await deezer.getArtistTopTracks(artistId);
    res.json({
      artists: mapArtistList(related).slice(0, 10),
      topTracks: mapTrackList(top).slice(0, 10),
      meta: { status: 'ok' },
    });
  })
);

router.post(
  '/send',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { recipientId, musicItemId, musicType, message } = req.body || {};
    if (!recipientId || !musicItemId) {
      throw new ValidationError('recipientId and musicItemId are required.');
    }
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('recommendations')
      .insert({
        sender_id: req.user.id,
        recipient_id: recipientId,
        music_item_id: String(musicItemId),
        music_type: musicType || 'track',
        message: message || null,
      })
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ recommendation: data, meta: { status: 'ok' } });
  })
);

export default router;
