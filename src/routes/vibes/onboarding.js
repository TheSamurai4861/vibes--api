import { Router } from 'express';
import { getSupabaseAdmin } from '../../services/supabase/client.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { asyncHandler } from '../../utils/httpErrors.js';
import * as deezer from '../../services/deezer.js';
import { mapArtistList } from '../../mappers/deezerToVibes.js';

const router = Router();

router.get(
  '/suggested-artists',
  requireAuth,
  asyncHandler(async (req, res) => {
    const admin = getSupabaseAdmin();
    const { data: profile } = await admin
      .from('profiles')
      .select('taste_genres')
      .eq('id', req.user.id)
      .single();

    const genreIds = (profile?.taste_genres || []).slice(0, 3);
    const artists = [];

    for (const genreId of genreIds) {
      const genreAlbums = await deezer.getGenreAlbums(Number(genreId) || 0, 0, 5);
      for (const album of genreAlbums) {
        if (album.artist && !artists.find((a) => a.id === album.artist.id)) {
          artists.push(album.artist);
        }
      }
    }

    if (artists.length < 10) {
      const chart = await deezer.getChartTracks();
      for (const t of chart.slice(0, 15)) {
        if (t.artist && !artists.find((a) => a.id === t.artist.id)) {
          artists.push(t.artist);
        }
      }
    }

    res.json({
      items: mapArtistList(artists).slice(0, 20),
      total: artists.length,
      nextOffset: null,
      meta: { status: 'ok' },
    });
  })
);

export default router;
