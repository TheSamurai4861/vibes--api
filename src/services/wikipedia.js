import axios from 'axios';
import { isArtistMatch } from '../utils/matcher.js';

const WIKI_REST_BASE = 'https://en.wikipedia.org/api/rest_v1/page/summary';
const WIKI_SEARCH_BASE = 'https://en.wikipedia.org/w/api.php';

/**
 * Resolves a search query to the most relevant Wikipedia page title.
 * Uses Wikipedia's search API.
 * 
 * @param {string} query - The artist or track to search for.
 * @returns {Promise<string|null>} The page title or null.
 */
export async function resolveWikiTitle(query) {
  try {
    console.log(`[Wikipedia] Resolving page title for query: "${query}"`);
    const response = await axios.get(WIKI_SEARCH_BASE, {
      params: {
        action: 'query',
        list: 'search',
        srsearch: query,
        format: 'json',
        origin: '*'
      },
      timeout: 5000
    });

    const searchResults = response.data?.query?.search;
    if (!searchResults || searchResults.length === 0) {
      console.warn(`[Wikipedia] No search results found for query: "${query}"`);
      return null;
    }

    // Try to find the first result that is reasonably similar
    const bestResult = searchResults[0];
    console.log(`[Wikipedia] Resolved "${query}" to page title: "${bestResult.title}"`);
    return bestResult.title;
  } catch (error) {
    console.error(`[Wikipedia] Error resolving title for "${query}":`, error.message);
    return null;
  }
}

/**
 * Fetches the summary of a Wikipedia page.
 * 
 * @param {string} title - The Wikipedia page title.
 * @returns {Promise<object|null>} The page summary or null.
 */
export async function getPageSummary(title) {
  if (!title) return null;
  
  try {
    // Standard URL format: https://en.wikipedia.org/api/rest_v1/page/summary/{title}
    const encodedTitle = encodeURIComponent(title.replace(/\s+/g, '_'));
    console.log(`[Wikipedia] Fetching summary for page: "${title}"`);
    
    const response = await axios.get(`${WIKI_REST_BASE}/${encodedTitle}`, {
      timeout: 5000,
      headers: {
        'User-Agent': 'MusicAPI/1.0.0 (contact: admin@musicapi.com)'
      }
    });

    const data = response.data;
    return {
      title: data.title,
      displaytitle: data.displaytitle,
      extract: data.extract,
      extract_html: data.extract_html,
      thumbnail: data.thumbnail?.source || null,
      originalimage: data.originalimage?.source || null,
      description: data.description || null,
      content_urls: {
        desktop: data.content_urls?.desktop?.page || null,
        mobile: data.content_urls?.mobile?.page || null
      }
    };
  } catch (error) {
    // 404 is a common case when the exact title does not exist
    if (error.response?.status === 404) {
      console.warn(`[Wikipedia] Page summary not found (404) for: "${title}"`);
    } else {
      console.error(`[Wikipedia] Error fetching summary for "${title}":`, error.message);
    }
    return null;
  }
}

/**
 * Gets a bio or summary for an artist.
 * Uses search resolution first for maximum resilience.
 * 
 * @param {string} artistName - The name of the artist.
 * @returns {Promise<object|null>} Bio data.
 */
export async function getArtistSummary(artistName) {
  // 1. Try resolving search title first (e.g. Daft Punk -> Daft Punk, Cher -> Cher (singer))
  let title = await resolveWikiTitle(artistName);
  
  // 2. If search title resolution fails, fallback to direct title query
  if (!title) {
    title = artistName;
  }

  const summary = await getPageSummary(title);
  
  if (summary) {
    // Verify if it's actually about the artist (optional fuzzy double-check or just trust search)
    // We'll trust search, but log it
    console.log(`[Wikipedia] Successfully retrieved summary for artist: "${artistName}"`);
    return summary;
  }
  
  return null;
}
