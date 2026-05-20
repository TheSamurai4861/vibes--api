import { searchTracksAggregated, getTrackDetailsAggregated } from './src/aggregator.js';
import * as cache from './src/services/cache.js';

async function runTests() {
  console.log('======================================================');
  console.log('🧪 Starting Music API Integration & Performance Tests');
  console.log('======================================================\n');

  try {
    // Clear cache first to ensure a deterministic test run
    console.log('[Test] Clearing hybrid cache to start fresh...');
    await cache.clear();
    console.log('[Test] Cache cleared successfully.\n');

    const searchQuery = 'Daft Punk One More Time';
    
    // --- TEST 1: Uncached Search ---
    console.log(`[Test 1] Executing UNCACHED search for: "${searchQuery}"`);
    const startSearch1 = Date.now();
    const search1Results = await searchTracksAggregated(searchQuery);
    const durationSearch1 = Date.now() - startSearch1;
    
    console.log(`[Result] Found ${search1Results.length} tracks.`);
    console.log(`[Result] Uncached search took ${durationSearch1}ms.`);
    
    if (search1Results.length === 0) {
      throw new Error('Test failed: Uncached search returned 0 results.');
    }
    
    const targetTrack = search1Results[0];
    console.log(`[Result] Top match: "${targetTrack.artist.name} - ${targetTrack.title}" (Deezer ID: ${targetTrack.id})\n`);

    // --- TEST 2: Cached Search ---
    console.log(`[Test 2] Executing CACHED search for same query: "${searchQuery}"`);
    const startSearch2 = Date.now();
    const search2Results = await searchTracksAggregated(searchQuery);
    const durationSearch2 = Date.now() - startSearch2;
    
    console.log(`[Result] Found ${search2Results.length} tracks.`);
    console.log(`[Result] Cached search took ${durationSearch2}ms.`);
    
    if (durationSearch2 >= 100) {
      console.warn(`[Warning] Cached search took ${durationSearch2}ms, which is close to or above the 100ms threshold.`);
    } else {
      console.log(`[Result] Cached search is super-fast! (${durationSearch2}ms) ✅\n`);
    }

    // --- TEST 3: Uncached Details Pipeline ---
    const trackId = targetTrack.id;
    console.log(`[Test 3] Fetching UNCACHED details for track ID: ${trackId}`);
    console.log('[Test 3] This will query MusicBrainz, Wikipedia, and scrape Lyrics in parallel...');
    
    const startDetails1 = Date.now();
    const result1 = await getTrackDetailsAggregated(trackId);
    const durationDetails1 = Date.now() - startDetails1;

    if (!result1) {
      throw new Error(`Test failed: Could not fetch details for track ID ${trackId}`);
    }

    const details1 = result1.details;
    if (result1.warnings.length > 0) {
      console.log(`[Result] Pipeline warnings:`, result1.warnings);
    }

    console.log(`\n======================================================`);
    console.log(`🎵 Merged Track Metadata Output:`);
    console.log(`------------------------------------------------------`);
    console.log(`Title:         ${details1.title}`);
    console.log(`Artist:        ${details1.artist.name}`);
    console.log(`Album:         ${details1.album.title}`);
    console.log(`Duration:      ${details1.duration}s`);
    console.log(`Release Date:  ${details1.releaseDate}`);
    console.log(`BPM:           ${details1.bpm || 'N/A'}`);
    console.log(`Gain:          ${details1.gain || 'N/A'}`);
    console.log(`Deezer Link:   ${details1.deezerLink}`);
    
    console.log(`\nMusicBrainz Block:`);
    if (details1.musicbrainz) {
      console.log(` - MBID:        ${details1.musicbrainz.mbid}`);
      console.log(` - Artist MBID: ${details1.musicbrainz.artistMbid}`);
      console.log(` - Country:     ${details1.musicbrainz.country}`);
      console.log(` - Genres:      ${details1.musicbrainz.genres.join(', ') || 'None'}`);
    } else {
      console.log(` - Status:      No MusicBrainz match found or fuzzy match validation failed.`);
    }

    console.log(`\nWikipedia Block:`);
    if (details1.wikipedia) {
      console.log(` - Page:        ${details1.wikipedia.title}`);
      console.log(` - Description: ${details1.wikipedia.description}`);
      console.log(` - Extract:     ${details1.wikipedia.extract.substring(0, 150)}...`);
      console.log(` - Wiki Link:   ${details1.wikipedia.link}`);
    } else {
      console.log(` - Status:      No Wikipedia page summary found.`);
    }

    console.log(`\nLyrics Block:`);
    if (details1.lyrics) {
      console.log(` - Text Length: ${details1.lyrics.length} chars`);
      console.log(` - Snippet:\n"""\n${details1.lyrics.split('\n').slice(0, 4).join('\n')}\n..."""`);
    } else {
      console.log(` - Status:      Lyrics not found.`);
    }
    console.log(`======================================================\n`);
    console.log(`[Result] Uncached details pipeline completed in ${durationDetails1}ms.\n`);

    // --- TEST 4: Cached Details Pipeline ---
    console.log(`[Test 4] Fetching CACHED details for same track ID: ${trackId}`);
    const startDetails2 = Date.now();
    const details2 = await getTrackDetailsAggregated(trackId);
    const durationDetails2 = Date.now() - startDetails2;

    console.log(`[Result] Cached details query completed in ${durationDetails2}ms.`);
    if (durationDetails2 >= 20) {
      console.warn(`[Warning] Cached details query took ${durationDetails2}ms.`);
    } else {
      console.log(`[Result] Cached details retrieval is lightning fast! (${durationDetails2}ms) ✅\n`);
    }

    // --- TEST 5: Rate Limiter Validation ---
    console.log('[Test 5] Validating MusicBrainz 1 request/second strict rate limiter...');
    console.log('[Test 5] Triggering 3 MusicBrainz queries rapidly in sequence. Let\'s watch the delay timestamps:');
    
    // We will query 3 different tracks/artists to trigger 3 separate MusicBrainz calls
    const startRate = Date.now();
    
    // These will execute through the rate-limiting queue
    const p1 = getTrackDetailsAggregated(1109731); // Daft Punk - Around the World
    const p2 = getTrackDetailsAggregated(3135556); // Daft Punk - Harder, Better, Faster, Stronger
    
    console.log('[Test 5] Requests dispatched in parallel. Awaiting resolutions...');
    const [r1, r2] = await Promise.all([p1, p2]);
    const durationRate = Date.now() - startRate;
    
    console.log(`\n[Result] Sequenced details with rate limiting completed in ${durationRate}ms.`);
    console.log(`[Result] Since there are 2 new details fetches, it MUST take at least 1-2 seconds to respect the 1s delay.`);
    if (durationRate >= 1000) {
      console.log('[Result] Rate limiter successfully spaced out the requests! ✅\n');
    } else {
      throw new Error(`Test failed: Rate limiter was bypassed, queries completed too fast in ${durationRate}ms.`);
    }

    console.log('======================================================');
    console.log('🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('======================================================');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ TEST RUN FAILED with error:', error);
    process.exit(1);
  }
}

runTests();
