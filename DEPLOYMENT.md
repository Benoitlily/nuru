# Nuru Communications Group — Platform Deployment Guide

## What's inside
```
nuru-app/
├── server.js          ← Node.js/Express API + SQLite database
├── package.json       ← Dependencies
├── public/
│   └── index.html     ← Full web app (served by the server)
└── nuru.db            ← Created automatically on first run
```

---

## Option 1 — Run locally (test on your computer)

### Requirements
- Node.js 18+ → https://nodejs.org

### Steps
```bash
# 1. Open a terminal in this folder
cd nuru-app

# 2. Install dependencies (one time only)
npm install

# 3. Start the server
npm start

# 4. Open your browser
# http://localhost:3000
```

Everyone on the same WiFi network can access it at:
`http://YOUR_COMPUTER_IP:3000`

---

## Option 2 — Deploy FREE on Railway (recommended, 5 minutes)

Railway gives you a public URL your whole team can use.

### Steps
1. Create a free account at https://railway.app
2. Click **"New Project"** → **"Deploy from GitHub repo"**
   - Or use **"Deploy from local"** and upload this folder
3. Railway auto-detects Node.js and runs `npm start`
4. Click **"Generate Domain"** to get your public URL
5. Share the URL with your team — done! ✅

**Database:** Railway persists the `nuru.db` file automatically.
For extra safety, set `DB_PATH=/data/nuru.db` in Railway's environment variables.

---

## Option 3 — Deploy FREE on Render

1. Push this folder to a GitHub repository
2. Go to https://render.com → New → Web Service
3. Connect your repo
4. Settings:
   - **Build command:** `npm install`
   - **Start command:** `node server.js`
5. Click Deploy → get your public URL

---

## Option 4 — Deploy on any VPS (DigitalOcean, Hetzner, etc.)

```bash
# On your server
git clone YOUR_REPO
cd nuru-app
npm install
npm install -g pm2        # process manager

pm2 start server.js --name nuru
pm2 save
pm2 startup
```

Then point your domain to the server IP and use Nginx as a reverse proxy.

---

## Live updates
The platform polls the server every 8 seconds. When any team member
adds a project, task, or member, everyone else's browser refreshes
automatically within 8 seconds — no page reload needed.

---

## Environment variables (optional)
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT`   | `3000`  | Server port |
| `DB_PATH`| `./nuru.db` | Path to SQLite database file |

---

## Sharing with your team
Once deployed, just send your team the URL. Everyone uses the same
shared database — all changes are live and visible to everyone instantly.
