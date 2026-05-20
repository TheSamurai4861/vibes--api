# Music API

API Node.js (Express) qui agrège Deezer, MusicBrainz, Wikipédia et des paroles. Interface web incluse dans `public/`.

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

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/health` | Santé du service (probe Render) |
| GET | `/api/search?q=...&type=track\|album\|artist` | Recherche Deezer |
| GET | `/api/details?trackId=...` | Détails agrégés |
| POST | `/api/cache/clear` | Vider le cache (Bearer `ADMIN_TOKEN`) |

### Réponses enrichies (`meta`)

Les réponses incluent un bloc optionnel `meta` sans casser les champs existants :

- Recherche OK : `meta.status: "ok"`
- Service indisponible : HTTP `503`, `code: "UPSTREAM_UNAVAILABLE"`
- Détails partiels : `meta.status: "degraded"`, `meta.warnings[]`
- Validation : HTTP `400`, `code: "VALIDATION_ERROR"`
