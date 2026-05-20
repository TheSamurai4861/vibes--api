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

1. Render → **New** → **Blueprint** ou **Web Service** → connecter le dépôt.
2. **Build** : `npm install` — **Start** : `npm start` — **Plan** : Free.
3. Variables à définir dans le dashboard :
   - `ADMIN_TOKEN` : chaîne aléatoire longue
   - `CORS_ORIGIN` : `https://votre-app.onrender.com` (et `http://localhost:3000` si besoin)
   - `CACHE_DB_PATH` : `/tmp/cache.db` (déjà dans `render.yaml`)
4. Health check : `/api/health` (configuré dans `render.yaml`).

### Limites du plan gratuit Render

- Mise en veille après ~15 min sans trafic ; premier appel lent (30–60 s).
- Disque éphémère : le cache SQLite est recréé à chaque déploiement.

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
