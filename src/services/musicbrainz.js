import axios from 'axios';

const MUSICBRAINZ_BASE = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'MusicAPI/1.0.0 (contact: admin@musicapi.com)';

// Queue-based rate limiter to ensure max 1 request/second
let queue = Promise.resolve();
let lastRequestTime = 0;

/**
 * Enqueues a function to run with strict 1 request per second spacing.
 * 
 * @param {Function} apiCallFn - Function that performs the API call and returns a promise.
 * @returns {Promise<any>} Resolves with the result of the API call.
 */
function executeRateLimited(apiCallFn) {
  const nextInQueue = queue.then(async () => {
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    const waitTime = Math.max(0, 1000 - elapsed);
    
    if (waitTime > 0) {
      console.log(`[MusicBrainz] Rate-limiter: Waiting ${waitTime}ms to respect the 1 request/sec limit.`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    // Update timestamp just before initiating request
    lastRequestTime = Date.now();
    return apiCallFn();
  }).catch((err) => {
    // If request fails, update the timestamp so the queue isn't clogged
    lastRequestTime = Date.now();
    throw err;
  });

  // Enqueue this request's completion (handling success or error) for the next call
  queue = nextInQueue.catch(() => {});

  return nextInQueue;
}

/**
 * Searches for a recording on MusicBrainz.
 * 
 * @param {string} artist - Artist name.
 * @param {string} track - Track/recording title.
 * @returns {Promise<object|null>} The parsed MusicBrainz details or null.
 */
export async function searchRecording(artist, track) {
  const searchCall = async () => {
    try {
      console.log(`[MusicBrainz] Querying for artist: "${artist}", track: "${track}"`);
      
      // Clean query and build lucene query
      // Escape double quotes and special characters
      const escapedArtist = artist.replace(/["\\]/g, '\\$&');
      const escapedTrack = track.replace(/["\\]/g, '\\$&');
      
      const queryStr = `recording:"${escapedTrack}" AND artist:"${escapedArtist}"`;

      const response = await axios.get(`${MUSICBRAINZ_BASE}/recording`, {
        params: {
          query: queryStr,
          fmt: 'json'
        },
        headers: {
          'User-Agent': USER_AGENT
        },
        timeout: 8000
      });

      const recordings = response.data?.recordings;
      if (!recordings || recordings.length === 0) {
        console.warn(`[MusicBrainz] No recordings found for: "${artist} - ${track}"`);
        return null;
      }

      // Find the best match or take the first one
      const record = recordings[0];
      
      // Extract release date and album details
      let earliestReleaseDate = null;
      let albumTitle = null;
      let country = null;
      
      if (record.releases && record.releases.length > 0) {
        // Sort by date to find the earliest
        const validReleases = record.releases
          .filter(r => r.date)
          .sort((a, b) => new Date(a.date) - new Date(b.date));
          
        if (validReleases.length > 0) {
          earliestReleaseDate = validReleases[0].date;
          country = validReleases[0].country || null;
        }
        albumTitle = record.releases[0].title || null;
      }

      // Collect tags as genres
      const genres = [];
      if (record.tags && record.tags.length > 0) {
        // Sort tags by count descending
        const sortedTags = [...record.tags].sort((a, b) => b.count - a.count);
        genres.push(...sortedTags.slice(0, 5).map(t => t.name));
      }

      const artistInfo = record['artist-credit']?.[0]?.artist;

      const result = {
        mbid: record.id,
        title: record.title,
        artist: artistInfo?.name || artist,
        artistMbid: artistInfo?.id || null,
        album: albumTitle,
        releaseDate: earliestReleaseDate,
        country: country,
        genres: genres,
        disambiguation: record.disambiguation || null
      };

      console.log(`[MusicBrainz] Successfully matched recording: MBID ${result.mbid}`);
      return result;
    } catch (error) {
      console.error(`[MusicBrainz] API request failed for "${artist} - ${track}":`, error.message);
      return null;
    }
  };

  return executeRateLimited(searchCall);
}
