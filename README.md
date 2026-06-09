# Quantum Ledger

This repository contains two independent projects:

- **[`quantum-ledger/`](quantum-ledger/)** — the offline desktop app for tracking your Star Citizen economy. Mining runs, hauling contracts, trading, refining, salvage, blueprints, crew payouts, vehicle fleets, and more. All data stays on your machine. See [its README](quantum-ledger/README.md) for full features and download links.
- **[`quantum-org-server/`](quantum-org-server/)** — an optional, self-hosted server that org leaders can run so the desktop app can sync member activity in real time. Provides a web admin dashboard, blueprint and hangar tracking, leaderboards, and a member approval system. Available as a Docker image (Linux/VPS) or a standalone Windows `.exe`. See [its README](quantum-org-server/README.md) for setup instructions.

Each project has its own `package.json`, dependencies, and build/run scripts — they are developed and deployed independently.

## Quick start

### Desktop app (development)

```bash
cd quantum-ledger
npm install
cd client && npm install && cd ..
cd server && npm install && cd ..
npm run dev:server   # terminal 1 — Express API on :3001
npm run dev:client   # terminal 2 — Vite dev server on :5173
```

### Org server (development)

```bash
cd quantum-org-server
npm install
npm run dev
# On first run, SERVER_ID and AUTH_TOKEN are printed to the console and saved to .env
# Open http://localhost:3100/ and enter the AUTH_TOKEN to access the admin dashboard
```

### Org server (Docker / VPS)

```bash
cd quantum-org-server
docker compose up -d
```
