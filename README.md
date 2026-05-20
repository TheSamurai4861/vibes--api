# Music API + Vibes

Monolithe Express en deux couches :

- **`/api/*`** — proxy musique Deezer (découverte, charts, genres, fiches) + agrégation MusicBrainz / Wikipédia / paroles
- **Racine** — API sociale Vibes (auth, profils, ratings, reviews, feed, listes) via **Supabase**

Interface web de démo dans `public/`.

## Lancer en local

```bash
npm install
cp .env.example .env
# Éditer .env (ADMIN_TOKEN recommandé pour vider le cache)
npm start
```

Ouvrir http://localhost:3000

### Tests

```bash
npm test              # smoke tests HTTP (rapide)
npm run test:integration  # tests agrégateur + APIs externes (lent)
```

## Variables d'environnement

Voir [.env.example](.env.example).

| Variable | Description |
|----------|-------------|
| `PORT` | Port du serveur (défaut `3000`) |
| `ADMIN_TOKEN` | Token Bearer pour `POST /api/cache/clear` (obligatoire en prod) |
| `CORS_ORIGIN` | Origines autorisées, séparées par des virgules (`*` en dev) |
| `CACHE_DB_PATH` | Chemin SQLite (`/tmp/cache.db` sur Render) |
| `RATE_LIMIT_MAX` | Limite requêtes/min sur search & details (défaut `60`) |
| `RATE_LIMIT_GLOBAL_MAX` | Limite globale `/api/*` (défaut `120`) |
| `DEEZER_COUNTRY` | Pays charts / discover (défaut `FR`) |
| `SUPABASE_URL` | URL projet Supabase (API Vibes) |
| `SUPABASE_ANON_KEY` | Clé anon (login côté serveur) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service role (serveur uniquement) |

Sans Supabase configuré, les routes Vibes répondent `503` avec `code: SUPABASE_NOT_CONFIGURED`.

### Connexion Supabase (automatisée)

1. Créez un **Personal Access Token** : [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens)
2. Copiez [`.env.supabase.example`](.env.supabase.example) → `.env.supabase.local` et collez le token, **ou** :

```powershell
$env:SUPABASE_ACCESS_TOKEN = "sbp_..."
npm run supabase:setup
```

Le script `scripts/supabase-setup.ps1` :

- se connecte à votre compte Supabase ;
- crée le projet **`vibes-music-api`** (région `eu-west-1`) s’il n’existe pas ;
- applique `supabase/migrations/001_initial.sql` (`supabase db push`) ;
- écrit `SUPABASE_*` dans `.env` ;
- pousse les variables sur **Render** si `RENDER_API_KEY` est défini.

Projet existant : `npm run supabase:setup -- -UseExistingProject -ProjectRef votre-ref`

Schéma manuel : SQL Editor → contenu de `supabase/migrations/001_initial.sql`.

### Convention `musicItemId`

Identifiant musique pour ratings / reviews : `track:123` ou `album:456` (ID Deezer).

## Mettre en ligne sur Render

Dépôt : https://github.com/TheSamurai4861/vibes--api.git

### Option A — Render CLI (recommandé, Windows)

Prérequis : compte Render actif (facturation non suspendue).

```powershell
npm run render:install
.\.tools\render\render.exe login
.\.tools\render\render.exe workspace set
npm run render:setup
```

Le script `render-setup.ps1` enchaîne : validation `render.yaml` → création du service → deploy → health check → test cache admin. Le token admin est généré dans `.env.render.local` (gitignored).

Après le premier deploy, pour ajuster CORS avec l’URL finale :

```powershell
$env:RENDER_API_KEY = "rnd_..."   # Dashboard → Account Settings → API Keys
.\scripts\render-env.ps1 -ServiceId srv-XXXX -ServiceUrl https://music-api-xxxx.onrender.com
```

Commandes utiles :

| Commande | Action |
|----------|--------|
| `npm run render:validate` | Valider `render.yaml` |
| `npm run render:setup` | Déploiement complet |
| `.\.tools\render\render.exe services -o json --confirm` | Lister les services |
| `.\.tools\render\render.exe deploys create srv-XXX --wait --confirm` | Redéployer |

CI optionnel : secrets GitHub `RENDER_API_KEY` + `RENDER_SERVICE_ID` → workflow [`.github/workflows/render-deploy.yml`](.github/workflows/render-deploy.yml).

### Option B — Dashboard manuel

1. Render → **New** → **Blueprint** → repo `vibes--api`.
2. **Build** : `npm install` — **Start** : `npm start` — **Plan** : Free.
3. Variables :
   - `ADMIN_TOKEN` : secret long
   - `CORS_ORIGIN` : `https://votre-app.onrender.com`
   - `CACHE_DB_PATH` : `/tmp/cache.db` (déjà dans `render.yaml`)
4. Health check : `/api/health`.

### Limites du plan gratuit Render

- Mise en veille après ~15 min sans trafic ; premier appel lent (30–60 s).
- Disque éphémère : le cache SQLite est recréé à chaque déploiement.
- Si `render blueprints validate` renvoie `billing_suspended`, réglez la facturation sur [dashboard.render.com/billing](https://dashboard.render.com/billing) avant de créer un service.

### Vider le cache en production

```bash
curl -X POST https://votre-app.onrender.com/api/cache/clear \
  -H "Authorization: Bearer VOTRE_ADMIN_TOKEN"
```

Depuis l'interface : **Cache Manager** → saisir le token admin (stocké en session navigateur uniquement).

## Endpoints

### Découverte pour agents IA

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/capabilities` | **Catalogue JSON** : toutes les routes, auth, conventions (`musicItemId`, pagination) |
| GET | `/api/openapi.yaml` | Spécification OpenAPI (partielle, discover) |
| GET | `/api/health` | Santé ; inclut les liens `capabilities` et `openapi` |

Exemple : `curl https://music-api-ut8s.onrender.com/api/capabilities`

### Musique (`/api`)

Listes paginées : `{ items, total, nextOffset, meta }` — query `limit` (max 50), `offset`, `country` (défaut `FR`).

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/health` | Santé (probe Render) |
| GET | `/api/search` | Recherche Deezer (`q`, `type`) |
| GET | `/api/search/suggest` | Suggestions rapides |
| GET | `/api/discover/new-releases` | Nouvelles sorties |
| GET | `/api/discover/upcoming` | À venir (fallback JSON FR) |
| GET | `/api/charts/albums` | Top albums |
| GET | `/api/charts/tracks` | Top titres |
| GET | `/api/genres` | Genres |
| GET | `/api/genres/:id/albums` | Albums par genre |
| GET | `/api/track/:id` | Fiche titre agrégée |
| GET | `/api/details?trackId=` | Alias legacy → track |
| GET | `/api/album/:id` | Fiche album + pistes |
| GET | `/api/artist/:id` | Fiche artiste |
| GET | `/api/artists/:id/top-tracks` | Top titres artiste |
| GET | `/api/artists/:id/related` | Artistes similaires |
| GET | `/api/music/:id/external-links` | Liens externes (ISRC/MBID si dispo) |
| POST | `/api/cache/clear` | Vider le cache (Bearer `ADMIN_TOKEN`) |

OpenAPI minimal (discover) : [openapi.yaml](openapi.yaml).

### Vibes (racine, JWT Supabase)

Header : `Authorization: Bearer <access_token>` pour les routes protégées.

| Domaine | Routes principales |
|---------|-------------------|
| Auth | `POST /auth/register`, `/auth/login`, `/auth/logout` |
| Profils | `GET/PATCH /users/me`, `GET /users/:username`, `GET /users/search` |
| Ratings | `POST/PATCH/DELETE /ratings`, `GET /users/:id/ratings` |
| Reviews | `POST/PATCH/DELETE /reviews`, likes & comments, `GET /reviews/search` |
| Fiches | `GET /music/:musicItemId/reviews`, `.../ratings/summary` |
| Feed | `GET /feed/friends`, `/feed/home`, `/feed/trending/reviews`, `/feed/trending/lists` |
| Social | `POST/DELETE /users/:id/follow`, followers/following, compatibility |
| Listes | CRUD `/lists`, items, `GET /lists/search`, `/me/listen-later` |
| Onboarding | `PATCH /users/me/taste`, `GET /onboarding/suggested-artists` |
| Reco | `GET /recommendations/me`, similar, `POST /recommendations/send` |
| Chat | `GET /conversations`, `GET/POST /conversations/:id/messages` |

### Réponses enrichies (`meta`)

Les réponses incluent un bloc optionnel `meta` sans casser les champs existants :

- Recherche OK : `meta.status: "ok"`
- Service indisponible : HTTP `503`, `code: "UPSTREAM_UNAVAILABLE"`
- Détails partiels : `meta.status: "degraded"`, `meta.warnings[]`
- Validation : HTTP `400`, `code: "VALIDATION_ERROR"`
