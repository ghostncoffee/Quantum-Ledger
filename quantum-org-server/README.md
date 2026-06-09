# Quantum Org Server

A small, self-hostable Express + SQLite server that org leaders run so members of the Quantum Ledger desktop app can optionally sync their activity to a shared, central place.

---

## Features

- **Activity feed** — real-time log of every uploaded session (mining, hauling, salvage, contract, refining)
- **Blueprint index** — org-wide catalogue of who has discovered which blueprints
- **Hangar overview** — aggregated fleet view showing every ship type across all approved members
- **Leaderboards** — ranked by sessions, payout, or activity within a configurable time window
- **Org statistics** — active members, session counts, and earnings summaries by week/month/all-time
- **Member approval system** — new members start as `pending`; an admin must approve them before their data appears in stats
- **Admin dashboard** — browser-based panel (served at `/`) for managing members, reviewing ships and blueprints, and changing settings
- **Org name** — configurable display name shown in the dashboard header and browser title

---

## Deployment

### Option A — Docker (recommended for VPS / Linux)

Pre-built images are published to the GitHub Container Registry on every push to `main`.

**Quick start with Docker Compose:**

```bash
# 1. Download the compose file
curl -O https://raw.githubusercontent.com/ghostncoffee/quantum-ledger/main/quantum-org-server/docker-compose.yml

# 2. Create your .env (values are auto-generated on first run if absent)
touch .env

# 3. Start
docker compose up -d
```

The server is now running on port `3100`. Visit `http://<your-server>:3100/` to open the admin dashboard.

**Data persistence:** the SQLite database is stored in `./data/` on the host, mounted into the container. It survives container restarts and image updates.

**Updating to the latest image:**

```bash
docker compose pull && docker compose up -d
```

> For production, put the server behind a reverse proxy (nginx, Caddy) to terminate TLS. Never expose port 3100 directly to the internet without TLS.

---

### Option B — Windows .exe (no Docker / no Node.js required)

Download `quantum-org-server.exe` from the [latest release](https://github.com/ghostncoffee/quantum-ledger/releases/tag/latest) and run it. On first launch it auto-generates `.env` and `data/` beside the executable — no runtime install needed.

```
quantum-org-server.exe
.env            ← auto-generated on first run (SERVER_ID / AUTH_TOKEN)
data/
  quantum-org-server.db
```

---

### Option C — Development / manual Node.js

```bash
npm install
npm run dev
```

On first run the server auto-generates `SERVER_ID` (a UUID) and `AUTH_TOKEN` (a 32-byte hex string) and writes them to `.env`. Share the server URL, Server ID, and Auth Token with org members so they can configure the desktop app to sync.

To compile and run in production mode:

```bash
npm run build
npm start
```

---

## Admin dashboard

Visit the server's root URL in a browser (e.g. `http://localhost:3100/`) to open the dashboard. Paste the `AUTH_TOKEN` printed on startup; it is then stored in `localStorage` so you only need to enter it once.

### Tabs

| Tab | Contents |
|---|---|
| **Overview** | Org stats (last 7 days) + top-sessions leaderboard |
| **Activity** | Incoming activity feed (last 50 entries) |
| **Members** | Pending approvals section (if any) + approved member list |
| **Ships** | Aggregated org hangar — one row per unique ship model with occurrence count |
| **Blueprints** | Blueprint catalogue with owner count and member list |
| **Settings** | Org name configuration |

### Member approval

When a member connects the desktop app for the first time their account is created with status `pending`. Their sessions and data are stored but excluded from stats, leaderboards, and the org blueprint/hangar views until an admin approves them. The **Members** tab shows a **Pending Approvals** section (with a badge count on the tab) whenever unapproved members exist. Approve or reject with the buttons in that section.

### Polling cadence

The dashboard uses two independent polling intervals to keep API traffic low:

| Tier | Interval | What it refreshes |
|---|---|---|
| Fast | 60 s | Health, org stats, activity feed |
| Slow | 5 min | Members, ships, blueprints, leaderboard |

---

## Configuration

Copy `.env.example` to `.env` and edit as needed. Most values are auto-generated on first run and do not need to be changed manually.

```bash
SERVER_PORT=3100          # Port to listen on (default 3100)
DATA_DIR=./data           # Directory for the SQLite database
SERVER_ID=                # Auto-generated UUID — identifies this server instance
AUTH_TOKEN=               # Auto-generated hex token — required for all API calls
DISCORD_WEBHOOK_URL=      # Optional: post activity summaries to a Discord channel
DATA_RETENTION_DAYS=90    # How long to keep uploaded sessions (days)
```

---

## API overview

All routes except `GET /api/health` require `Authorization: Bearer <AUTH_TOKEN>`.

### Upload endpoints (`POST`)

| Route | Body | Description |
|---|---|---|
| `/api/upload/session` | `{ username, session_type, occurred_at, data }` | Upload a completed activity session |
| `/api/upload/blueprints` | `{ username, blueprints: [...] }` | Sync a member's discovered blueprints |
| `/api/upload/hangar` | `{ username, ships: [...] }` | Replace a member's ship list wholesale |

### Read endpoints (`GET`)

| Route | Query params | Description |
|---|---|---|
| `/api/health` | — | Server liveness + uptime + member count |
| `/api/members` | `status=approved\|pending\|all`, `limit`, `offset` | Member list with session and ship counts |
| `/api/members/ships` | — | Aggregated fleet — one row per ship model with count |
| `/api/members/:username` | — | Individual member detail |
| `/api/stats/clan` | `period=today\|week\|month\|all_time` | Org-wide activity summary |
| `/api/stats/activity/recent` | `limit` | Recent activity log entries |
| `/api/blueprints` | — | Blueprint catalogue with per-blueprint member list |
| `/api/leaderboard/sessions` | `period`, `limit` | Top members by session count |
| `/api/leaderboard/activity` | `period`, `limit` | Top members by activity events |
| `/api/leaderboard/payout` | `period`, `limit` | Top members by payout value |
| `/api/settings` | — | Current server settings (e.g. `orgName`) |

### Settings (`PATCH /api/settings`)

```json
{ "clanName": "My Org" }
```

### Member status (`PATCH /api/members/:id/status`)

```json
{ "status": "approved" }
```

Valid values: `approved`, `rejected`, `pending`.

---

## Security model

- `AUTH_TOKEN` is generated using `crypto.randomBytes(32)` — 256 bits of entropy.
- All API routes except `GET /api/health` require the token as a Bearer header.
- The token never reaches the browser — the desktop app proxies org API calls through its local Express backend, injecting the token server-side.
- For production deployments, put the server behind a reverse proxy (nginx, Caddy) to terminate TLS.
- Never commit `.env` or the `data/` directory — both are in `.gitignore`.

---

## Background jobs

Two `node-cron` jobs run automatically in the background:

| Job | Schedule | What it does |
|---|---|---|
| `aggregateStats` | Every 15 min | Processes unprocessed sessions and updates org stats |
| `cleanupOldData` | Daily at 02:00 | Deletes sessions and activity log entries older than `DATA_RETENTION_DAYS` |

---

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22 |
| Language | TypeScript |
| Framework | Express |
| Database | SQLite via `@libsql/client` |
| Validation | Zod |
| Jobs | node-cron |
| Packaging | Docker (Linux/VPS) · `@yao-pkg/pkg` (Windows exe) |
| Dashboard | Vanilla HTML + CSS + JS (no build step) |
