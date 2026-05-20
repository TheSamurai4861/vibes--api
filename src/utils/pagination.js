import { ValidationError } from '../errors.js';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;

/**
 * @param {Record<string, unknown>} query
 * @returns {{ limit: number, offset: number, country: string }}
 */
export function parseListQuery(query) {
  let limit = parseInt(String(query.limit ?? DEFAULT_LIMIT), 10);
  let offset = parseInt(String(query.offset ?? 0), 10);

  if (Number.isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (Number.isNaN(offset) || offset < 0) offset = 0;

  const country = String(query.country || 'FR').toUpperCase().slice(0, 2);

  return { limit, offset, country };
}

/**
 * @param {Array<unknown>} allItems
 * @param {number} limit
 * @param {number} offset
 * @returns {{ items: unknown[], total: number, nextOffset: number|null }}
 */
export function paginateArray(allItems, limit, offset) {
  const total = allItems.length;
  const items = allItems.slice(offset, offset + limit);
  const nextOffset = offset + limit < total ? offset + limit : null;
  return { items, total, nextOffset };
}

/**
 * @param {unknown[]} items
 * @param {number} limit
 * @param {number} offset
 * @param {number|null} [upstreamTotal]
 */
export function listResponse(items, limit, offset, upstreamTotal = null) {
  const total = upstreamTotal ?? items.length;
  const nextOffset = items.length >= limit ? offset + limit : null;
  return {
    items,
    total,
    nextOffset,
    meta: { status: 'ok' },
  };
}

/**
 * @param {string} id
 * @returns {number}
 */
export function parsePositiveId(id, field = 'id') {
  const num = parseInt(String(id), 10);
  if (Number.isNaN(num) || num < 1 || num >= 1_000_000_000) {
    throw new ValidationError(`Invalid ${field}.`, field);
  }
  return num;
}

/**
 * @param {string} musicItemId - track:123 or album:456 or raw number (track)
 * @returns {{ type: 'track'|'album', id: number }}
 */
export function parseMusicItemId(musicItemId) {
  const raw = String(musicItemId);
  const match = raw.match(/^(track|album):(\d+)$/i);
  if (match) {
    return { type: match[1].toLowerCase(), id: parseInt(match[2], 10) };
  }
  const num = parseInt(raw, 10);
  if (!Number.isNaN(num) && num > 0) {
    return { type: 'track', id: num };
  }
  throw new ValidationError('Invalid musicItemId format. Use track:ID or album:ID.', 'musicItemId');
}
