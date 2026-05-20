/**
 * Catalogue machine-readable des routes (pour agents IA / outils).
 * @param {{ supabaseConfigured: boolean }} opts
 */
export function buildApiCatalog(opts = {}) {
  const { supabaseConfigured = false } = opts;

  const paginated = {
    description: 'Listes : { items, total, nextOffset, meta }',
    query: ['limit (max 50, défaut 25)', 'offset', 'country (musique, défaut FR)'],
  };

  const music = [
    { method: 'GET', path: '/api/health', summary: 'Santé + cache + Supabase', auth: false },
    { method: 'GET', path: '/api/capabilities', summary: 'Ce catalogue (découverte API)', auth: false },
    { method: 'GET', path: '/api/openapi.yaml', summary: 'Spécification OpenAPI (partielle)', auth: false },
    { method: 'GET', path: '/api/search', summary: 'Recherche Deezer agrégée', auth: false, query: ['q', 'type=track|album|artist'] },
    { method: 'GET', path: '/api/search/suggest', summary: 'Suggestions rapides multi-type', auth: false, query: ['q'] },
    { method: 'GET', path: '/api/discover/new-releases', summary: 'Nouvelles sorties', auth: false, ...paginated },
    { method: 'GET', path: '/api/discover/upcoming', summary: 'Sorties à venir (fallback FR)', auth: false, ...paginated },
    { method: 'GET', path: '/api/charts/albums', summary: 'Top albums', auth: false, ...paginated },
    { method: 'GET', path: '/api/charts/tracks', summary: 'Top titres', auth: false, ...paginated },
    { method: 'GET', path: '/api/genres', summary: 'Liste des genres', auth: false, ...paginated },
    { method: 'GET', path: '/api/genres/:id/albums', summary: 'Albums par genre', auth: false, ...paginated },
    { method: 'GET', path: '/api/editorial/:id', summary: 'Éditorial Deezer + releases', auth: false, ...paginated },
    { method: 'GET', path: '/api/track/:id', summary: 'Fiche titre (Deezer + MB/Wiki/paroles)', auth: false },
    { method: 'GET', path: '/api/details', summary: 'Alias legacy → track (query trackId)', auth: false, query: ['trackId'] },
    { method: 'GET', path: '/api/album/:id', summary: 'Fiche album + pistes', auth: false },
    { method: 'GET', path: '/api/artist/:id', summary: 'Fiche artiste + albums', auth: false },
    { method: 'GET', path: '/api/artists/:id/top-tracks', summary: 'Top titres artiste', auth: false, ...paginated },
    { method: 'GET', path: '/api/artists/:id/related', summary: 'Artistes similaires', auth: false, ...paginated },
    { method: 'GET', path: '/api/music/:id/external-links', summary: 'Liens Spotify/Apple/YouTube si ISRC/MBID', auth: false },
    { method: 'POST', path: '/api/cache/clear', summary: 'Vider le cache', auth: 'admin', headers: ['Authorization: Bearer ADMIN_TOKEN'] },
  ];

  const bearer = { auth: 'bearer', headers: ['Authorization: Bearer <access_token>'] };
  const vibes = [
    { method: 'POST', path: '/auth/register', summary: 'Inscription', auth: false, body: ['email', 'password', 'username', 'displayName?'] },
    { method: 'POST', path: '/auth/login', summary: 'Connexion → tokens + profil', auth: false, body: ['email', 'password'] },
    { method: 'POST', path: '/auth/logout', summary: 'Déconnexion (côté client)', auth: false },
    { method: 'GET', path: '/users/me', summary: 'Profil connecté + stats', ...bearer },
    { method: 'PATCH', path: '/users/me', summary: 'Modifier profil', ...bearer },
    { method: 'PATCH', path: '/users/me/taste', summary: 'Goûts (genres, artistIds)', ...bearer, body: ['tasteGenres[]', 'tasteArtistIds[]'] },
    { method: 'GET', path: '/users/search', summary: 'Chercher utilisateurs', auth: false, query: ['q'] },
    { method: 'GET', path: '/users/:username', summary: 'Profil public', auth: false },
    { method: 'GET', path: '/users/:id/ratings', summary: 'Notes d’un utilisateur', auth: false, ...paginated },
    { method: 'GET', path: '/users/:id/lists', summary: 'Listes publiques', auth: false, ...paginated },
    { method: 'POST', path: '/users/:id/follow', summary: 'Suivre', ...bearer },
    { method: 'DELETE', path: '/users/:id/follow', summary: 'Ne plus suivre', ...bearer },
    { method: 'GET', path: '/users/:id/followers', summary: 'Abonnés', auth: false, ...paginated },
    { method: 'GET', path: '/users/:id/following', summary: 'Abonnements', auth: false, ...paginated },
    { method: 'GET', path: '/users/:id/compatibility', summary: 'Score compatibilité goûts', auth: false },
    { method: 'POST', path: '/ratings', summary: 'Créer une note', ...bearer, body: ['musicItemId', 'score 1-5', 'musicType?'] },
    { method: 'PATCH', path: '/ratings/:id', summary: 'Modifier note', ...bearer },
    { method: 'DELETE', path: '/ratings/:id', summary: 'Supprimer note', ...bearer },
    { method: 'POST', path: '/reviews', summary: 'Créer avis', ...bearer, body: ['musicItemId', 'body'] },
    { method: 'PATCH', path: '/reviews/:id', summary: 'Modifier avis', ...bearer },
    { method: 'DELETE', path: '/reviews/:id', summary: 'Supprimer avis', ...bearer },
    { method: 'GET', path: '/reviews/search', summary: 'Recherche dans les avis', auth: false, query: ['q', ...paginated.query] },
    { method: 'POST', path: '/reviews/:id/like', summary: 'Like avis', ...bearer },
    { method: 'DELETE', path: '/reviews/:id/like', summary: 'Retirer like', ...bearer },
    { method: 'GET', path: '/reviews/:id/comments', summary: 'Commentaires', auth: false, ...paginated },
    { method: 'POST', path: '/reviews/:id/comments', summary: 'Ajouter commentaire', ...bearer },
    { method: 'GET', path: '/music/:musicItemId/reviews', summary: 'Avis sur une fiche', auth: false, ...paginated },
    { method: 'GET', path: '/music/:musicItemId/ratings/summary', summary: 'Moyenne + distribution notes', auth: false },
    { method: 'GET', path: '/feed/friends', summary: 'Activité des abonnements', ...bearer, ...paginated },
    { method: 'GET', path: '/feed/home', summary: 'Liens sections home', ...bearer },
    { method: 'GET', path: '/feed/trending/reviews', summary: 'Avis populaires', auth: false, ...paginated },
    { method: 'GET', path: '/feed/trending/lists', summary: 'Listes populaires', auth: false, ...paginated },
    { method: 'GET', path: '/lists/me/listen-later', summary: 'À écouter plus tard', ...bearer },
    { method: 'POST', path: '/lists/me/listen-later', summary: 'Ajouter listen-later', ...bearer },
    { method: 'DELETE', path: '/lists/me/listen-later/:id', summary: 'Retirer listen-later', ...bearer },
    { method: 'POST', path: '/lists/lists', summary: 'Créer liste', ...bearer },
    { method: 'GET', path: '/lists/lists/search', summary: 'Chercher listes publiques', auth: false, query: ['q'] },
    { method: 'GET', path: '/lists/lists/:id', summary: 'Détail liste', auth: false },
    { method: 'POST', path: '/lists/lists/:id/items', summary: 'Ajouter item liste', ...bearer },
    { method: 'GET', path: '/onboarding/suggested-artists', summary: 'Artistes suggérés (goûts)', ...bearer },
    { method: 'GET', path: '/recommendations/me', summary: 'Reco perso v1', ...bearer },
    { method: 'GET', path: '/recommendations/music/:id/similar', summary: 'Similaire (artiste)', auth: false },
    { method: 'POST', path: '/recommendations/send', summary: 'Envoyer reco à un ami', ...bearer },
    { method: 'GET', path: '/conversations', summary: 'Mes conversations', ...bearer },
    { method: 'GET', path: '/conversations/:id/messages', summary: 'Messages', ...bearer, ...paginated },
    { method: 'POST', path: '/conversations/:id/messages', summary: 'Envoyer message', ...bearer },
  ];

  return {
    name: 'Vibes Music API',
    version: '1.0.0',
    description:
      'Deux couches : proxy musique Deezer (/api) et API sociale Vibes (racine, Supabase).',
    intendedFor: ['ai-agents', 'mobile-app', 'openapi-tools'],
    documentation: {
      capabilities: '/api/capabilities',
      openapi: '/api/openapi.yaml',
      health: '/api/health',
    },
    runtime: {
      supabaseConfigured,
      vibesAvailable: supabaseConfigured,
    },
    conventions: {
      musicItemId: {
        format: 'track:{deezerId} | album:{deezerId}',
        examples: ['track:3135556', 'album:302127'],
      },
      pagination: paginated,
      auth: {
        bearer: 'JWT Supabase access_token',
        admin: 'Bearer ADMIN_TOKEN (POST /api/cache/clear only)',
      },
      errors: {
        codes: ['VALIDATION_ERROR', 'NOT_FOUND', 'UPSTREAM_UNAVAILABLE', 'SUPABASE_NOT_CONFIGURED', 'AUTH_ERROR'],
        shape: '{ error, code?, field?, meta? }',
      },
    },
    layers: [
      {
        id: 'music',
        prefix: '/api',
        description: 'Découverte, charts, genres, fiches — cache LRU, pas de compte requis',
      },
      {
        id: 'vibes',
        prefix: '/',
        description: 'Auth, social, ratings, feed — nécessite Supabase configuré',
        requiresSupabase: true,
      },
    ],
    routes: [
      ...music.map((r) => ({ ...r, layer: 'music' })),
      ...vibes.map((r) => ({ ...r, layer: 'vibes' })),
    ],
    routeCount: music.length + vibes.length,
  };
}
