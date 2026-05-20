import axios from 'axios';
import * as cheerio from 'cheerio';

const GENIUS_SEARCH_URL = 'https://genius.com/api/search/multi';
const LRCLIB_SEARCH_URL = 'https://lrclib.net/api/search';

/**
 * Searches Genius for a track's lyrics URL.
 * 
 * @param {string} artist - Artist name.
 * @param {string} track - Track title.
 * @returns {Promise<string|null>} The URL of the lyrics page, or null.
 */
async function searchGeniusUrl(artist, track) {
  try {
    const query = `${artist} ${track}`;
    console.log(`[Lyrics] Searching Genius for: "${query}"`);
    
    const response = await axios.get(GENIUS_SEARCH_URL, {
      params: { q: query },
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const sections = response.data?.response?.sections || [];
    const hits = [];
    
    for (const section of sections) {
      if (section.hits) {
        hits.push(...section.hits);
      }
    }

    // Filter hits for 'song' type
    const songHits = hits.filter(hit => hit.type === 'song' || hit.index === 'song');
    if (songHits.length === 0) {
      console.warn(`[Lyrics] Genius search: No song hits found for "${query}"`);
      return null;
    }

    // Take the best hit
    const bestHit = songHits[0].result;
    console.log(`[Lyrics] Genius found match: "${bestHit.full_title}" -> URL: ${bestHit.url}`);
    return bestHit.url;
  } catch (error) {
    console.error(`[Lyrics] Genius search error:`, error.message);
    return null;
  }
}

/**
 * Scrapes a Genius page for lyrics using Cheerio.
 * 
 * @param {string} url - Genius page URL.
 * @returns {Promise<string|null>} The scraped lyrics, or null.
 */
async function scrapeGeniusLyrics(url) {
  try {
    console.log(`[Lyrics] Scraping lyrics from Genius: ${url}`);
    const response = await axios.get(url, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    let lyrics = '';

    // Modern Genius lyrics layout container
    $('div[class*="Lyrics__Container"]').each((i, el) => {
      // Create a copy of the element to modify without affecting original DOM tree
      const container = $(el);
      // Replace <br> tags with actual newlines
      container.find('br').replaceWith('\n');
      
      // Also insert newlines before and after divs/sections if needed,
      // but text() is usually sufficient after replacing <br>
      lyrics += container.text() + '\n';
    });

    // Older Genius layouts fallback
    if (!lyrics.trim()) {
      $('.lyrics').each((i, el) => {
        const container = $(el);
        container.find('br').replaceWith('\n');
        lyrics += container.text() + '\n';
      });
    }

    // Secondary fallback for other dynamic layouts
    if (!lyrics.trim()) {
      $('#lyrics-root').each((i, el) => {
        const container = $(el);
        container.find('br').replaceWith('\n');
        lyrics += container.text() + '\n';
      });
    }

    lyrics = lyrics.trim();
    if (!lyrics) {
      console.warn(`[Lyrics] Genius scraping: Page was retrieved but no lyrics were extracted.`);
      return null;
    }

    console.log(`[Lyrics] Genius scraping success: Extracted ${lyrics.length} chars of lyrics.`);
    return lyrics;
  } catch (error) {
    console.error(`[Lyrics] Genius scraping failed:`, error.message);
    return null;
  }
}

/**
 * Fetches lyrics from LrcLib as a fallback.
 * 
 * @param {string} artist - Artist name.
 * @param {string} track - Track title.
 * @returns {Promise<string|null>} Plain lyrics, or null.
 */
export async function getLrcLibLyrics(artist, track) {
  try {
    const query = `${artist} ${track}`;
    console.log(`[Lyrics] Fallback - Querying LrcLib for: "${query}"`);
    
    const response = await axios.get(LRCLIB_SEARCH_URL, {
      params: { q: query },
      timeout: 5000
    });

    const results = response.data;
    if (!results || !Array.isArray(results) || results.length === 0) {
      console.warn(`[Lyrics] LrcLib: No search results found for "${query}"`);
      return null;
    }

    // Try to find first result that has plainLyrics
    const match = results.find(item => item.plainLyrics);
    if (match) {
      console.log(`[Lyrics] LrcLib success: Found lyrics for "${match.artistName} - ${match.name}"`);
      return match.plainLyrics;
    }

    // Fallback to synced lyrics if plain is not present
    const syncedMatch = results.find(item => item.syncedLyrics);
    if (syncedMatch) {
      console.log(`[Lyrics] LrcLib success: Found synced lyrics for "${syncedMatch.artistName} - ${syncedMatch.name}"`);
      // Strip timestamps from synced lyrics if we want plain text
      const cleanSynced = syncedMatch.syncedLyrics
        .replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '')
        .trim();
      return cleanSynced;
    }

    console.warn(`[Lyrics] LrcLib: Results found, but none contained plain or synced lyrics.`);
    return null;
  } catch (error) {
    console.error(`[Lyrics] LrcLib API error:`, error.message);
    return null;
  }
}

/**
 * Orchestrator function to retrieve lyrics with Genius -> LrcLib fallback chain.
 * 
 * @param {string} artist - Artist name.
 * @param {string} track - Track title.
 * @returns {Promise<string>} The lyrics, or a fallback message if all failed.
 */
export async function getLyrics(artist, track) {
  // Step 1: Try Genius (Search + Scrape)
  const geniusUrl = await searchGeniusUrl(artist, track);
  if (geniusUrl) {
    const geniusLyrics = await scrapeGeniusLyrics(geniusUrl);
    if (geniusLyrics) {
      return geniusLyrics;
    }
  }

  // Step 2: Fallback to LrcLib
  console.log(`[Lyrics] Genius failed or blocked. Trying LrcLib fallback for "${artist} - ${track}"...`);
  const lrcLyrics = await getLrcLibLyrics(artist, track);
  if (lrcLyrics) {
    return lrcLyrics;
  }

  console.error(`[Lyrics] All lyrics providers failed for "${artist} - ${track}"`);
  return 'Lyrics not found.';
}
