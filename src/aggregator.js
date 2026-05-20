import * as cache from './services/cache.js';
import * as deezer from './services/deezer.js';
import * as musicbrainz from './services/musicbrainz.js';
import * as wikipedia from './services/wikipedia.js';
import * as lyrics from './services/lyrics.js';
import { isArtistMatch, isTrackMatch } from './utils/matcher.js';

/**
 * Orchestrates search requests based on search type (track, album, artist).
 * Checks Cache -> Queries Deezer -> Caches & Returns.
 * Designed to resolve in <100ms when cached, and minimal overhead when fresh.
 * 
 * @param {string} query - The search query.
 * @param {string} type - The type of search (track, album, artist).
 * @returns {Promise<Array>} List of matched objects.
 */
export async function searchAggregated(query, type = 'track') {
  const normType = ['track', 'album', 'artist'].includes(type) ? type : 'track';
  const cacheKey = `search:${normType}:${query.toLowerCase().trim()}`;
  
  // 1. Try hybrid cache
  const cachedResult = await cache.get(cacheKey);
  if (cachedResult) {
    console.log(`[Aggregator] ${normType.toUpperCase()} Search CACHE HIT for: "${query}"`);
    return cachedResult;
  }

  // 2. Fetch from Deezer
  console.log(`[Aggregator] ${normType.toUpperCase()} Search CACHE MISS. Fetching from Deezer for: "${query}"`);
  let results = [];
  if (normType === 'track') {
    results = await deezer.searchTracks(query);
  } else if (normType === 'album') {
    results = await deezer.searchAlbums(query);
  } else if (normType === 'artist') {
    results = await deezer.searchArtists(query);
  }

  // 3. Cache search results for 1 hour (3600000ms)
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
 * Queries Deezer, MusicBrainz, Wikipedia, and lyrics in parallel.
 * Reconciles MB details using a fuzzy matcher and merges the responses.
 * 
 * @param {string|number} trackId - The Deezer Track ID.
 * @returns {Promise<object|null>} The combined metadata.
 */
export async function getTrackDetailsAggregated(trackId) {
  const cacheKey = `details:${trackId}`;

  // 1. Try hybrid cache
  const cachedDetails = await cache.get(cacheKey);
  if (cachedDetails) {
    console.log(`[Aggregator] Details CACHE HIT for Track ID: ${trackId}`);
    return cachedDetails;
  }

  console.log(`[Aggregator] Details CACHE MISS. Initiating details pipeline for Track ID: ${trackId}`);
  const pipelineStart = Date.now();

  // 2. Fetch basic track info from Deezer (Required first to get Artist/Track names)
  const trackInfo = await deezer.getTrackDetails(trackId);
  if (!trackInfo) {
    console.error(`[Aggregator] Track details not found on Deezer for ID: ${trackId}`);
    return null;
  }

  const artistName = trackInfo.artist.name;
  const trackTitle = trackInfo.title;

  console.log(`[Aggregator] Core track resolved: "${artistName} - ${trackTitle}". Fetching secondary sources...`);

  // 3. Query secondary aggregators in parallel (highly resilient Promise.allSettled)
  const [mbResult, wikiResult, lyricsResult] = await Promise.allSettled([
    musicbrainz.searchRecording(artistName, trackTitle),
    wikipedia.getArtistSummary(artistName),
    lyrics.getLyrics(artistName, trackTitle)
  ]);

  // Extract resolved values or log failures
  let mbData = mbResult.status === 'fulfilled' ? mbResult.value : null;
  let wikiData = wikiResult.status === 'fulfilled' ? wikiResult.value : null;
  let lyricsData = lyricsResult.status === 'fulfilled' ? lyricsResult.value : 'Lyrics unavailable.';

  // 4. Reconcile secondary data using Fuzzy Matcher
  // Verify MusicBrainz metadata
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

  // 5. Merge all sources
  const mergedDetails = {
    trackId: trackInfo.id,
    title: trackInfo.title,
    title_short: trackInfo.title_short,
    artist: {
      id: trackInfo.artist.id,
      name: trackInfo.artist.name,
      picture: trackInfo.artist.picture,
      link: trackInfo.artist.link
    },
    album: {
      id: trackInfo.album.id,
      title: trackInfo.album.title,
      cover: trackInfo.album.cover,
      release_date: trackInfo.album.release_date
    },
    duration: trackInfo.duration,
    releaseDate: mbData?.releaseDate || trackInfo.release_date || trackInfo.album.release_date || null,
    bpm: trackInfo.bpm || null,
    gain: trackInfo.gain || null,
    previewUrl: trackInfo.preview,
    deezerLink: trackInfo.link,
    
    musicbrainz: mbData ? {
      mbid: mbData.mbid,
      artistMbid: mbData.artistMbid,
      album: mbData.album,
      country: mbData.country,
      genres: mbData.genres,
      disambiguation: mbData.disambiguation
    } : null,
    
    wikipedia: wikiData ? {
      title: wikiData.title,
      description: wikiData.description,
      extract: wikiData.extract,
      thumbnail: wikiData.thumbnail,
      link: wikiData.content_urls.desktop
    } : null,
    
    lyrics: lyricsData
  };

  // 6. Cache merged details for 24 hours (86400000ms)
  await cache.set(cacheKey, mergedDetails, 1000 * 60 * 60 * 24);

  const pipelineDuration = Date.now() - pipelineStart;
  console.log(`[Aggregator] Aggregate pipeline completed in ${pipelineDuration}ms for: "${artistName} - ${trackTitle}"`);

  return mergedDetails;
}
