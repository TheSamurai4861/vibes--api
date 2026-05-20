import axios from 'axios';

const DEEZER_BASE_URL = 'https://api.deezer.com';

/**
 * Searches tracks on Deezer.
 * 
 * @param {string} query - The search query.
 * @returns {Promise<Array>} List of matching tracks.
 */
export async function searchTracks(query) {
  try {
    console.log(`[Deezer] Searching for: "${query}"`);
    const startTime = Date.now();
    const response = await axios.get(`${DEEZER_BASE_URL}/search`, {
      params: { q: query },
      timeout: 5000 // 5 seconds timeout for rapid response
    });
    
    const duration = Date.now() - startTime;
    console.log(`[Deezer] Search completed in ${duration}ms. Found ${response.data?.data?.length || 0} tracks.`);

    if (!response.data || !response.data.data) {
      return [];
    }

    // Map to a clean structure
    return response.data.data.map(track => ({
      id: track.id,
      title: track.title,
      title_short: track.title_short,
      duration: track.duration,
      preview: track.preview,
      link: track.link,
      artist: {
        id: track.artist.id,
        name: track.artist.name,
        picture: track.artist.picture_medium,
        link: track.artist.link
      },
      album: {
        id: track.album.id,
        title: track.album.title,
        cover: track.album.cover_medium,
        tracklist: track.album.tracklist
      }
    }));
  } catch (error) {
    console.error(`[Deezer] Search error for query "${query}":`, error.message);
    return [];
  }
}

/**
 * Fetches detailed track information from Deezer.
 * 
 * @param {string|number} trackId - The Deezer track ID.
 * @returns {Promise<object|null>} The track details or null if not found.
 */
export async function getTrackDetails(trackId) {
  try {
    console.log(`[Deezer] Fetching track details for ID: ${trackId}`);
    const response = await axios.get(`${DEEZER_BASE_URL}/track/${trackId}`, {
      timeout: 5000
    });

    if (!response.data || response.data.error) {
      console.warn(`[Deezer] Track ID ${trackId} not found or returned error:`, response.data?.error);
      return null;
    }

    const track = response.data;
    return {
      id: track.id,
      title: track.title,
      title_short: track.title_short,
      duration: track.duration,
      release_date: track.release_date,
      preview: track.preview,
      link: track.link,
      bpm: track.bpm,
      gain: track.gain,
      artist: {
        id: track.artist.id,
        name: track.artist.name,
        picture: track.artist.picture_medium,
        link: track.artist.link
      },
      album: {
        id: track.album.id,
        title: track.album.title,
        cover: track.album.cover_medium,
        release_date: track.album.release_date
      }
    };
  } catch (error) {
    console.error(`[Deezer] Error fetching track details for ID ${trackId}:`, error.message);
    return null;
  }
}

/**
 * Searches albums on Deezer.
 * 
 * @param {string} query - The search query.
 * @returns {Promise<Array>} List of matching albums.
 */
export async function searchAlbums(query) {
  try {
    console.log(`[Deezer] Searching albums for: "${query}"`);
    const startTime = Date.now();
    const response = await axios.get(`${DEEZER_BASE_URL}/search/album`, {
      params: { q: query },
      timeout: 5000
    });
    
    const duration = Date.now() - startTime;
    console.log(`[Deezer] Album search completed in ${duration}ms. Found ${response.data?.data?.length || 0} albums.`);

    if (!response.data || !response.data.data) {
      return [];
    }

    return response.data.data.map(album => ({
      id: album.id,
      title: album.title,
      cover: album.cover_medium,
      cover_big: album.cover_big,
      link: album.link,
      tracklist: album.tracklist,
      artist: {
        id: album.artist.id,
        name: album.artist.name,
        picture: album.artist.picture_medium
      }
    }));
  } catch (error) {
    console.error(`[Deezer] Album search error for query "${query}":`, error.message);
    return [];
  }
}

/**
 * Searches artists on Deezer.
 * 
 * @param {string} query - The search query.
 * @returns {Promise<Array>} List of matching artists.
 */
export async function searchArtists(query) {
  try {
    console.log(`[Deezer] Searching artists for: "${query}"`);
    const startTime = Date.now();
    const response = await axios.get(`${DEEZER_BASE_URL}/search/artist`, {
      params: { q: query },
      timeout: 5000
    });
    
    const duration = Date.now() - startTime;
    console.log(`[Deezer] Artist search completed in ${duration}ms. Found ${response.data?.data?.length || 0} artists.`);

    if (!response.data || !response.data.data) {
      return [];
    }

    return response.data.data.map(artist => ({
      id: artist.id,
      name: artist.name,
      picture: artist.picture_medium,
      picture_big: artist.picture_big,
      link: artist.link,
      nb_album: artist.nb_album,
      nb_fan: artist.nb_fan
    }));
  } catch (error) {
    console.error(`[Deezer] Artist search error for query "${query}":`, error.message);
    return [];
  }
}
