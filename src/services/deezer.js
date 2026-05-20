import axios from 'axios';
import { UpstreamError } from '../errors.js';

const DEEZER_BASE_URL = 'https://api.deezer.com';

async function deezerGet(path, context, params = {}) {
  try {
    const response = await axios.get(`${DEEZER_BASE_URL}${path}`, {
      params,
      timeout: 8000,
      validateStatus: (status) => status < 500,
    });
    if (response.status === 404) return null;
    if (!response.data || response.data.error) return null;
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) return null;
    throwDeezerError(error, context);
  }
}

function throwDeezerError(error, context) {
  const status = error.response?.status;
  const message =
    error.response?.data?.error?.message ||
    error.message ||
    'Deezer request failed';
  throw new UpstreamError('deezer', `${context}: ${message}`, status);
}

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
      timeout: 5000,
    });

    const duration = Date.now() - startTime;
    console.log(
      `[Deezer] Search completed in ${duration}ms. Found ${response.data?.data?.length || 0} tracks.`
    );

    if (!response.data || !response.data.data) {
      return [];
    }

    return response.data.data.map((track) => ({
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
        link: track.artist.link,
      },
      album: {
        id: track.album.id,
        title: track.album.title,
        cover: track.album.cover_medium,
        tracklist: track.album.tracklist,
      },
    }));
  } catch (error) {
    console.error(`[Deezer] Search error for query "${query}":`, error.message);
    throwDeezerError(error, 'Track search failed');
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
      timeout: 5000,
      validateStatus: (status) => status < 500,
    });

    if (response.status === 404 || !response.data || response.data.error) {
      console.warn(
        `[Deezer] Track ID ${trackId} not found or returned error:`,
        response.data?.error
      );
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
        link: track.artist.link,
      },
      album: {
        id: track.album.id,
        title: track.album.title,
        cover: track.album.cover_medium,
        release_date: track.album.release_date,
      },
    };
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    console.error(`[Deezer] Error fetching track details for ID ${trackId}:`, error.message);
    throwDeezerError(error, 'Track details fetch failed');
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
      timeout: 5000,
    });

    const duration = Date.now() - startTime;
    console.log(
      `[Deezer] Album search completed in ${duration}ms. Found ${response.data?.data?.length || 0} albums.`
    );

    if (!response.data || !response.data.data) {
      return [];
    }

    return response.data.data.map((album) => ({
      id: album.id,
      title: album.title,
      cover: album.cover_medium,
      cover_big: album.cover_big,
      link: album.link,
      tracklist: album.tracklist,
      artist: {
        id: album.artist.id,
        name: album.artist.name,
        picture: album.artist.picture_medium,
      },
    }));
  } catch (error) {
    console.error(`[Deezer] Album search error for query "${query}":`, error.message);
    throwDeezerError(error, 'Album search failed');
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
      timeout: 5000,
    });

    const duration = Date.now() - startTime;
    console.log(
      `[Deezer] Artist search completed in ${duration}ms. Found ${response.data?.data?.length || 0} artists.`
    );

    if (!response.data || !response.data.data) {
      return [];
    }

    return response.data.data.map((artist) => ({
      id: artist.id,
      name: artist.name,
      picture: artist.picture_medium,
      picture_big: artist.picture_big,
      link: artist.link,
      nb_album: artist.nb_album,
      nb_fan: artist.nb_fan,
    }));
  } catch (error) {
    console.error(`[Deezer] Artist search error for query "${query}":`, error.message);
    throwDeezerError(error, 'Artist search failed');
  }
}

export async function getChartAlbums() {
  const data = await deezerGet('/chart/0/albums', 'Chart albums');
  return data?.data || data?.albums?.data || [];
}

export async function getChartTracks() {
  const data = await deezerGet('/chart/0/tracks', 'Chart tracks');
  return data?.data || data?.tracks?.data || [];
}

export async function getGenres() {
  const data = await deezerGet('/genre', 'Genres');
  return data?.data || [];
}

export async function getGenreAlbums(genreId, index = 0, limit = 25) {
  const data = await deezerGet(`/genre/${genreId}/albums`, 'Genre albums', {
    index,
    limit,
  });
  return data?.data || [];
}

export async function getEditorialReleases(editorialId = 0) {
  const data = await deezerGet(`/editorial/${editorialId}/releases`, 'Editorial releases');
  return data?.data || data?.albums?.data || [];
}

export async function getEditorial(editorialId) {
  return deezerGet(`/editorial/${editorialId}`, 'Editorial');
}

export async function getAlbum(albumId) {
  return deezerGet(`/album/${albumId}`, 'Album');
}

export async function getAlbumTracks(albumId) {
  const data = await deezerGet(`/album/${albumId}/tracks`, 'Album tracks');
  return data?.data || [];
}

export async function getArtist(artistId) {
  return deezerGet(`/artist/${artistId}`, 'Artist');
}

export async function getArtistAlbums(artistId) {
  const data = await deezerGet(`/artist/${artistId}/albums`, 'Artist albums');
  return data?.data || [];
}

export async function getArtistTopTracks(artistId) {
  const data = await deezerGet(`/artist/${artistId}/top`, 'Artist top tracks');
  return data?.data || [];
}

export async function getArtistRelated(artistId) {
  const data = await deezerGet(`/artist/${artistId}/related`, 'Artist related');
  return data?.data || [];
}

export async function searchSuggest(query, limit = 5) {
  const data = await deezerGet('/search', 'Search suggest', { q: query, limit });
  return data?.data || [];
}
