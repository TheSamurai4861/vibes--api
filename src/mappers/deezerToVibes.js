/**
 * Maps Deezer payloads to Vibes DTO shapes for the mobile app.
 */

export function toVibesArtist(artist) {
  if (!artist) return null;
  return {
    id: artist.id,
    name: artist.name,
    picture: artist.picture_medium || artist.picture || artist.picture_big || null,
    link: artist.link || null,
    nbAlbum: artist.nb_album ?? null,
    nbFan: artist.nb_fan ?? null,
  };
}

export function toVibesAlbum(album) {
  if (!album) return null;
  return {
    id: album.id,
    title: album.title,
    cover: album.cover_medium || album.cover || album.cover_big || null,
    link: album.link || null,
    releaseDate: album.release_date || null,
    artist: album.artist ? toVibesArtist(album.artist) : null,
    trackCount: album.nb_tracks ?? album.tracks?.length ?? null,
  };
}

export function toVibesTrack(track) {
  if (!track) return null;
  return {
    id: track.id,
    title: track.title,
    titleShort: track.title_short || track.title,
    duration: track.duration,
    preview: track.preview || null,
    link: track.link || null,
    artist: track.artist ? toVibesArtist(track.artist) : null,
    album: track.album ? toVibesAlbum(track.album) : null,
  };
}

export function toVibesGenre(genre) {
  return {
    id: genre.id,
    name: genre.name,
    picture: genre.picture || genre.picture_medium || null,
  };
}

export function mapAlbumList(data) {
  return (data || []).map((a) => toVibesAlbum(a)).filter(Boolean);
}

export function mapTrackList(data) {
  return (data || []).map((t) => toVibesTrack(t)).filter(Boolean);
}

export function mapArtistList(data) {
  return (data || []).map((a) => toVibesArtist(a)).filter(Boolean);
}

export function mapGenreList(data) {
  return (data || []).map((g) => toVibesGenre(g)).filter(Boolean);
}
