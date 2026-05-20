# Music API

API Node.js (Express) qui agrège Deezer, MusicBrainz, Wikipédia et des paroles. Interface web incluse dans `public/`.

## Lancer en local

```bash
npm install
npm start
```

Ouvrir http://localhost:3000

## Mettre en ligne gratuitement (Render)

[Render](https://render.com) propose un hébergement web gratuit (le service s’endort après ~15 min sans trafic, puis se réveille au premier appel).

### Prérequis

- Un compte [GitHub](https://github.com)
- Un compte [Render](https://render.com) (connexion via GitHub)

### Étapes

1. **Initialiser Git et pousser sur GitHub** (depuis le dossier du projet) :

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/VOTRE_USER/music-api.git
   git push -u origin main
   ```

   Créez d’abord un dépôt vide sur GitHub, puis remplacez `VOTRE_USER/music-api` par votre URL.

2. **Créer le service sur Render**

   - Dashboard → **New** → **Blueprint** (si le dépôt contient `render.yaml`)  
     **ou** **New** → **Web Service** → connecter le dépôt GitHub.
   - **Runtime** : Node
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Plan** : Free

3. **Variables d’environnement** : aucune obligatoire (`PORT` est fourni par Render).

4. Après le déploiement, l’URL ressemble à :  
   `https://music-api-xxxx.onrender.com`

### Notes importantes

| Sujet | Détail |
|--------|--------|
| **Mise en veille** | Le plan gratuit met l’app en veille ; le premier appel après inactivité peut prendre 30–60 s. |
| **Cache SQLite** | Le fichier `cache.db` est sur disque éphémère : il est recréé à chaque redéploiement (comportement normal). |
| **Module natif** | `sqlite3` est compilé au build sur les serveurs Linux de Render. |

## Autres hébergeurs gratuits (alternatives)

- **[Fly.io](https://fly.io)** : quota gratuit, un peu plus technique (CLI + `fly.toml`).
- **[Koyeb](https://www.koyeb.com)** : instance gratuite, déploiement depuis GitHub.
- **[Oracle Cloud](https://www.oracle.com/cloud/free/)** : VM toujours gratuite (plus de configuration, mais pas de mise en veille).

Pour un usage perso ou une démo, **Render + GitHub** est en général le plus simple.

## Endpoints

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/search?q=...&type=track\|album\|artist` | Recherche |
| GET | `/api/details?trackId=...` | Détails agrégés |
| POST | `/api/cache/clear` | Vider le cache |
