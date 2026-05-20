import { ValidationError } from './errors.js';

const SEARCH_TYPES = new Set(['track', 'album', 'artist']);
const MAX_QUERY_LENGTH = 200;
const MAX_TRACK_ID = 1_000_000_000;

/**
 * @param {string} q
 * @returns {string}
 */
export function validateSearchQuery(q) {
  if (q === undefined || q === null || typeof q !== 'string') {
    throw new ValidationError('Search query parameter "q" is required.', 'q');
  }
  const trimmed = q.trim();
  if (!trimmed) {
    throw new ValidationError('Search query parameter "q" is required.', 'q');
  }
  if (trimmed.length > MAX_QUERY_LENGTH) {
    throw new ValidationError(`Query must be at most ${MAX_QUERY_LENGTH} characters.`, 'q');
  }
  return trimmed;
}

/**
 * @param {string} type
 * @returns {'track'|'album'|'artist'}
 */
export function validateSearchType(type) {
  const norm = (type || 'track').toLowerCase();
  if (!SEARCH_TYPES.has(norm)) {
    throw new ValidationError(
      'Query parameter "type" must be one of: track, album, artist.',
      'type'
    );
  }
  return norm;
}

/**
 * @param {string} trackId
 * @returns {number}
 */
export function validateTrackId(trackId) {
  if (trackId === undefined || trackId === null || trackId === '') {
    throw new ValidationError('Query parameter "trackId" is required.', 'trackId');
  }
  const trackIdNum = parseInt(String(trackId), 10);
  if (Number.isNaN(trackIdNum) || trackIdNum < 1 || trackIdNum >= MAX_TRACK_ID) {
    throw new ValidationError(
      'Query parameter "trackId" must be a positive integer.',
      'trackId'
    );
  }
  return trackIdNum;
}
