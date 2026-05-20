import * as cache from './services/cache.js';
import * as deezer from './services/deezer.js';
import * as musicbrainz from './services/musicbrainz.js';
import * as wikipedia from './services/wikipedia.js';
import * as lyrics from './services/lyrics.js';
import { isArtistMatch, isTrackMatch } from './utils/matcher.js';

/**
 * @param {PromiseSettledResult<unknown>} result
 * @param {string} source
 * @returns {{ source: string, message: string } | null}
 */
function warningFromSettled(result, source) {
  if (result.status === 'rejected') {
    const message =
      result.reason instanceof Error ? result.reason.message : String(result.reason);
    return { source, message };
  }
  return null;
}

/**
 * Orchestrates search requests based on search type (track, album, artist).
 *
 * @param {string} query - The search query.
 * @param {string} type - The type of search (track, album, artist).
 * @returns {Promise<Array>} List of matched objects.
 */
export async function searchAggregated(query, type = 'track') {
  const normType = ['track', 'album', 'artist'].includes(type) ? type : 'track';
  const cacheKey = `search:${normType}:${query.toLowerCase().trim()}`;

  const cachedResult = await cache.get(cacheKey);
  if (cachedResult) {
    console.log(`[Aggregator] ${normType.toUpperCase()} Search CACHE HIT for: "${query}"`);
    return cachedResult;
  }

  console.log(
    `[Aggregator] ${normType.toUpperCase()} Search CACHE MISS. Fetching from Deezer for: "${query}"`
  );

  let results = [];
  if (normType === 'track') {
    results = await deezer.searchTracks(query);
  } else if (normType === 'album') {
    results = await deezer.searchAlbums(query);
  } else if (normType === 'artist') {
    results = await deezer.searchArtists(query);
  }

  await cache.set(cacheKey, results, 1000 * 60 * 60);

  return results;
}

/**
 * Backward compatibility wrapper for searchTracksAggregated
 */
export async function searchTracksAggregated(query) {
  return searchAggregated(query, 'track');
}

/**
 * Orchestrates track details aggregation.
 *
 * @param {string|number} trackId - The Deezer Track ID.
 * @returns {Promise<{ details: object, warnings: Array<{ source: string, message: string }> }|null>}
 */
export async function getTrackDetailsAggregated(trackId) {
  const cacheKey = `details:${trackId}`;

  const cachedDetails = await cache.get(cacheKey);
  if (cachedDetails) {
    console.log(`[Aggregator] Details CACHE HIT for Track ID: ${trackId}`);
    return { details: cachedDetails, warnings: [] };
  }

  console.log(
    `[Aggregator] Details CACHE MISS. Initiating details pipeline for Track ID: ${trackId}`
  );
  const pipelineStart = Date.now();

  const trackInfo = await deezer.getTrackDetails(trackId);
  if (!trackInfo) {
    console.error(`[Aggregator] Track details not found on Deezer for ID: ${trackId}`);
    return null;
  }

  const artistName = trackInfo.artist.name;
  const trackTitle = trackInfo.title;

  console.log(
    `[Aggregator] Core track resolved: "${artistName} - ${trackTitle}". Fetching secondary sources...`
  );

  const [mbResult, wikiResult, lyricsResult] = await Promise.allSettled([
    musicbrainz.searchRecording(artistName, trackTitle),
    wikipedia.getArtistSummary(artistName),
    lyrics.getLyrics(artistName, trackTitle),
  ]);

  const warnings = [
    warningFromSettled(mbResult, 'musicbrainz'),
    warningFromSettled(wikiResult, 'wikipedia'),
    warningFromSettled(lyricsResult, 'lyrics'),
  ].filter(Boolean);

  let mbData = mbResult.status === 'fulfilled' ? mbResult.value : null;
  const wikiData = wikiResult.status === 'fulfilled' ? wikiResult.value : null;
  let lyricsData =
    lyricsResult.status === 'fulfilled' ? lyricsResult.value : 'Lyrics unavailable.';

  if (mbData) {
    const artistOk = isArtistMatch(artistName, mbData.artist);
    const trackOk = isTrackMatch(trackTitle, mbData.title);

    if (!artistOk || !trackOk) {
      console.warn(`[Aggregator] MusicBrainz validation FAILED:
        Expected: "${artistName}" - "${trackTitle}"
        Found: "${mbData.artist}" - "${mbData.title}"
        Discarding MusicBrainz result to prevent mismatches.`);
      mbData = null;
    } else {
      console.log(`[Aggregator] MusicBrainz validation PASSED.`);
    }
  }

  const mergedDetails = {
    trackId: trackInfo.id,
    title: trackInfo.title,
    title_short: trackInfo.title_short,
    artist: {
      id: trackInfo.artist.id,
      name: trackInfo.artist.name,
      picture: trackInfo.artist.picture,
      link: trackInfo.artist.link,
    },
    album: {
      id: trackInfo.album.id,
      title: trackInfo.album.title,
      cover: trackInfo.album.cover,
      release_date: trackInfo.album.release_date,
    },
    duration: trackInfo.duration,
    releaseDate:
      mbData?.releaseDate || trackInfo.release_date || trackInfo.album.release_date || null,
    bpm: trackInfo.bpm || null,
    gain: trackInfo.gain || null,
    previewUrl: trackInfo.preview,
    deezerLink: trackInfo.link,

    musicbrainz: mbData
      ? {
          mbid: mbData.mbid,
          artistMbid: mbData.artistMbid,
          album: mbData.album,
          country: mbData.country,
          genres: mbData.genres,
          disambiguation: mbData.disambiguation,
        }
      : null,

    wikipedia: wikiData
      ? {
          title: wikiData.title,
          description: wikiData.description,
          extract: wikiData.extract,
          thumbnail: wikiData.thumbnail,
          link: wikiData.content_urls.desktop,
        }
      : null,

    lyrics: lyricsData,
  };

  await cache.set(cacheKey, mergedDetails, 1000 * 60 * 60 * 24);

  const pipelineDuration = Date.now() - pipelineStart;
  console.log(
    `[Aggregator] Aggregate pipeline completed in ${pipelineDuration}ms for: "${artistName} - ${trackTitle}"`
  );

  return { details: mergedDetails, warnings };
}
