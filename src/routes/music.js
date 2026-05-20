import { Router } from 'express';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { searchAggregated, getTrackDetailsAggregated } from '../aggregator.js';
import * as cache from '../services/cache.js';
import * as deezer from '../services/deezer.js';
import { requireAdminToken } from '../middleware/auth.js';
import { searchDetailsLimiter } from '../middleware/rateLimit.js';
import {
  validateSearchQuery,
  validateSearchType,
  validateTrackId,
} from '../validation.js';
import { parseListQuery, parsePositiveId, listResponse } from '../utils/pagination.js';
import { asyncHandler, notFound } from '../utils/httpErrors.js';
import {
  mapAlbumList,
  mapTrackList,
  mapArtistList,
  mapGenreList,
  toVibesAlbum,
  toVibesTrack,
  toVibesArtist,
} from '../mappers/deezerToVibes.js';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const upcomingData = JSON.parse(
  readFileSync(path.join(__dirname, '../data/upcoming-fr.json'), 'utf8')
);

const router = Router();

async function cachedList(key, ttlMs, fetchFn) {
  const hit = await cache.get(key);
  if (hit) return hit;
  const data = await fetchFn();
  await cache.set(key, data, ttlMs);
  return data;
}

router.get(
  '/health',
  asyncHandler(async (req, res) => {
    const cacheOk = await cache.ping();
    res.status(cacheOk ? 200 : 503).json({
      status: cacheOk ? 'ok' : 'degraded',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      cache: cacheOk ? 'connected' : 'unavailable',
      supabase: config.supabaseConfigured ? 'configured' : 'missing',
      capabilities: '/api/capabilities',
      openapi: '/api/openapi.yaml',
    });
  })
);

router.get(
  '/search',
  searchDetailsLimiter,
  asyncHandler(async (req, res) => {
    const q = validateSearchQuery(req.query.q);
    const type = validateSearchType(req.query.type);
    const startTime = Date.now();
    const results = await searchAggregated(q, type);
    const duration = Date.now() - startTime;
    res.setHeader('X-Response-Time-Ms', String(duration));
    const payload = {
      query: q,
      type,
      resultsCount: results.length,
      responseTimeMs: duration,
      meta: { status: 'ok' },
    };
    if (type === 'track') payload.tracks = results;
    else if (type === 'album') payload.albums = results;
    else payload.artists = results;
    res.json(payload);
  })
);

router.get(
  '/search/suggest',
  searchDetailsLimiter,
  asyncHandler(async (req, res) => {
    const q = validateSearchQuery(req.query.q);
    const raw = await deezer.searchSuggest(q, 5);
    res.json({
      tracks: mapTrackList(raw.filter((r) => r.type === 'track' || !r.type)),
      meta: { status: 'ok' },
    });
  })
);

router.get(
  '/discover/new-releases',
  asyncHandler(async (req, res) => {
    const { limit, offset, country } = parseListQuery(req.query);
    const key = `discover:new:${country}:${limit}:${offset}`;
    const raw = await cachedList(key, 3600000, async () => {
      let albums = await deezer.getEditorialReleases(0);
      if (!albums.length) albums = await deezer.getChartAlbums();
      return albums;
    });
    const mapped = mapAlbumList(raw);
    const { items, total, nextOffset } = listResponse(
      mapped.slice(offset, offset + limit),
      limit,
      offset,
      mapped.length
    );
    res.json({ items, total, nextOffset, meta: { status: 'ok' } });
  })
);

router.get(
  '/discover/upcoming',
  asyncHandler(async (req, res) => {
    const { limit, offset } = parseListQuery(req.query);
    const ids = upcomingData.albumIds || [];
    const albums = [];
    for (const id of ids.slice(offset, offset + limit)) {
      const a = await deezer.getAlbum(id);
      if (a) albums.push(a);
    }
    const mapped = mapAlbumList(albums);
    res.json({
      items: mapped,
      total: ids.length,
      nextOffset: offset + limit < ids.length ? offset + limit : null,
      meta: { status: 'ok', source: 'editorial' },
    });
  })
);

router.get(
  '/charts/albums',
  asyncHandler(async (req, res) => {
    const { limit, offset } = parseListQuery(req.query);
    const raw = await cachedList('charts:albums', 3600000, () => deezer.getChartAlbums());
    const mapped = mapAlbumList(raw);
    res.json({
      ...listResponse(mapped.slice(offset, offset + limit), limit, offset, mapped.length),
    });
  })
);

router.get(
  '/charts/tracks',
  asyncHandler(async (req, res) => {
    const { limit, offset } = parseListQuery(req.query);
    const raw = await cachedList('charts:tracks', 3600000, () => deezer.getChartTracks());
    const mapped = mapTrackList(raw);
    res.json({
      ...listResponse(mapped.slice(offset, offset + limit), limit, offset, mapped.length),
    });
  })
);

router.get(
  '/genres',
  asyncHandler(async (req, res) => {
    const raw = await cachedList('genres:all', 86400000, () => deezer.getGenres());
    res.json({
      items: mapGenreList(raw),
      total: raw.length,
      nextOffset: null,
      meta: { status: 'ok' },
    });
  })
);

router.get(
  '/genres/:id/albums',
  asyncHandler(async (req, res) => {
    const genreId = parsePositiveId(req.params.id, 'id');
    const { limit, offset } = parseListQuery(req.query);
    const raw = await deezer.getGenreAlbums(genreId, offset, limit);
    const mapped = mapAlbumList(raw);
    res.json(listResponse(mapped, limit, offset, mapped.length + offset));
  })
);

router.get(
  '/editorial/:id',
  asyncHandler(async (req, res) => {
    const id = parsePositiveId(req.params.id, 'id');
    const data = await deezer.getEditorial(id);
    if (!data) throw notFound('Editorial not found.');
    res.json({ editorial: data, meta: { status: 'ok' } });
  })
);

router.get(
  '/track/:id',
  searchDetailsLimiter,
  asyncHandler(async (req, res) => {
    const trackId = parsePositiveId(req.params.id, 'id');
    const startTime = Date.now();
    const result = await getTrackDetailsAggregated(trackId);
    if (!result) throw notFound(`Track not found: ${trackId}`);
    const duration = Date.now() - startTime;
    res.setHeader('X-Response-Time-Ms', String(duration));
    res.json({
      responseTimeMs: duration,
      details: result.details,
      meta: {
        status: result.warnings.length ? 'degraded' : 'ok',
        ...(result.warnings.length && { warnings: result.warnings }),
      },
    });
  })
);

router.get(
  '/details',
  searchDetailsLimiter,
  asyncHandler(async (req, res) => {
    const trackId = validateTrackId(req.query.trackId);
    const startTime = Date.now();
    const result = await getTrackDetailsAggregated(trackId);
    if (!result) throw notFound(`Track details not found for ID: ${trackId}`);
    const duration = Date.now() - startTime;
    res.setHeader('X-Response-Time-Ms', String(duration));
    res.json({
      responseTimeMs: duration,
      details: result.details,
      meta: {
        status: result.warnings.length ? 'degraded' : 'ok',
        ...(result.warnings.length && { warnings: result.warnings }),
      },
    });
  })
);

router.get(
  '/album/:id',
  asyncHandler(async (req, res) => {
    const albumId = parsePositiveId(req.params.id, 'id');
    const album = await deezer.getAlbum(albumId);
    if (!album) throw notFound('Album not found.');
    const tracks = await deezer.getAlbumTracks(albumId);
    res.json({
      album: toVibesAlbum(album),
      tracks: mapTrackList(tracks),
      meta: { status: 'ok' },
    });
  })
);

router.get(
  '/artist/:id',
  asyncHandler(async (req, res) => {
    const artistId = parsePositiveId(req.params.id, 'id');
    const artist = await deezer.getArtist(artistId);
    if (!artist) throw notFound('Artist not found.');
    const albums = await deezer.getArtistAlbums(artistId);
    res.json({
      artist: toVibesArtist(artist),
      albums: mapAlbumList(albums),
      meta: { status: 'ok' },
    });
  })
);

router.get(
  '/artists/:id/top-tracks',
  asyncHandler(async (req, res) => {
    const artistId = parsePositiveId(req.params.id, 'id');
    const { limit } = parseListQuery(req.query);
    const raw = await deezer.getArtistTopTracks(artistId);
    const mapped = mapTrackList(raw).slice(0, limit);
    res.json(listResponse(mapped, limit, 0, mapped.length));
  })
);

router.get(
  '/artists/:id/related',
  asyncHandler(async (req, res) => {
    const artistId = parsePositiveId(req.params.id, 'id');
    const { limit } = parseListQuery(req.query);
    const raw = await deezer.getArtistRelated(artistId);
    const mapped = mapArtistList(raw).slice(0, limit);
    res.json(listResponse(mapped, limit, 0, mapped.length));
  })
);

router.get(
  '/music/:id/external-links',
  asyncHandler(async (req, res) => {
    const trackId = parsePositiveId(req.params.id, 'id');
    const track = await deezer.getTrackDetails(trackId);
    if (!track) throw notFound('Track not found.');
    res.json({
      deezer: track.link,
      spotify: null,
      appleMusic: null,
      youtube: null,
      meta: { status: 'ok' },
    });
  })
);

router.post(
  '/cache/clear',
  requireAdminToken,
  asyncHandler(async (req, res) => {
    await cache.clear();
    res.json({ success: true, message: 'Cache cleared successfully.' });
  })
);

export default router;
