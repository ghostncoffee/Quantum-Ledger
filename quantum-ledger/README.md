# Quantum Ledger

> A free, offline desktop app for tracking your Star Citizen economy — hauling contracts, mining runs, trading, refining, salvage, blueprints, crew payouts and more. All data stays on your machine. No accounts, no cloud, no internet required.

---

## Features

| Module | What it tracks |
|---|---|
| **Runs** | Session containers — group all activity under a single run with start/end timing and P&L |
| **Hauling** | Multi-leg contracts with per-leg SCU × qty, pickup → drop-off, individual leg completion |
| **Mining** | Ore bags, per-ore quality lines, check-in at stations |
| **Refining** | Session queuing with timers, actual vs expected yield, auto-adds output to inventory |
| **Salvaging** | Haul tracking, commit hauls to stations |
| **Trading** | Buy by boxes × SCU, cost tracking, auto-adds to inventory until sold |
| **Crafting** | Job + input materials with blueprint selection, optional inventory deduction |
| **Contracts** | Client contracts with agreed payout and crew splits |
| **Blueprints** | Discovered blueprint catalogue — searchable, filterable by source and type |
| **Inventory** | Unified view of everything you own — auto-populated from all modules |
| **Accounting** | Full ledger, run P&L reports, expense tracking |
| **Crew** | Members, roles, payout percentages, earnings history |
| **Vehicles** | Fleet management with ship type and SCU capacity |
| **Log Import** | Scan the Star Citizen game log to import sessions automatically |

---

## Download

Head to [**Releases**](https://github.com/ghostncoffee/Quantum-Ledger/releases) and grab the latest for your platform:

| File | Platform | Notes |
|---|---|---|
| `*-Setup-x64.exe` | Windows 10/11 | Installer — adds Start Menu + Desktop shortcut |
| `*-Portable-x64.exe` | Windows 10/11 | No install needed, run from anywhere |
| `*-x64.AppImage` | Linux x64 | Universal — `chmod +x` then run |
| `*-x64.deb` | Ubuntu / Debian | `sudo dpkg -i *.deb` |
| `*-x64.dmg` | macOS Intel | Drag to Applications |
| `*-arm64.dmg` | macOS Apple Silicon | Drag to Applications |

> Your data is stored locally and never uploaded anywhere:
> - **Windows**: `%APPDATA%\quantum-ledger\data\`
> - **Linux**: `~/.config/quantum-ledger/data/`
> - **macOS**: `~/Library/Application Support/quantum-ledger/data/`

### Virus scan results (v1.0.0)

Both files have been scanned and are clean. Windows Defender and other tools may flag unsigned Electron apps as "unknown publisher" — this is expected for indie apps without a code-signing certificate and is not a virus.

| File | VirusTotal |
|---|---|
| `Quantum Ledger-1.0.0-Setup-x64.exe` | [View scan results](https://www.virustotal.com/gui/file-analysis/OTMwNDE5OWM5MDRmZTdjOTg2NWM5NDU5OTliMTIxNDk6MTc4MDE3Njc0Nw==) |
| `Quantum Ledger-1.0.0-Portable-x64.exe` | [View scan results](https://www.virustotal.com/gui/file-analysis/ZTU4OGY3NTRiMjQ3MWJlYTJiNTBhOGNlMDMyNDQxMjQ6MTc4MDE3NjcxOQ==) |

---

## Building from source

### Prerequisites

- [Node.js](https://nodejs.org/) 20+

### Install

```bash
npm install
cd client && npm install && cd ..
cd server && npm install && cd ..
```

### Run in development

```bash
# Terminal 1 — API server (Express on :3001)
npm run dev:server

# Terminal 2 — Vite dev client (on :5173)
npm run dev:client

# Terminal 3 — Electron shell (connects to Vite automatically)
cd electron && npm install && npm start
```

### Build the installer

```bash
npm run package
```

Output lands in `release/`. The pipeline:
1. Generates `electron/build-assets/icon.png` from the SVG logo
2. Compiles the TypeScript server (`server/dist/`)
3. Builds the React client with Vite (`client/dist/`)
4. Copies everything into the Electron shell
5. Runs `electron-builder` → produces `*-Setup-x64.exe` + `*-Portable-x64.exe`

---

## Clan sync (optional)

The app can optionally sync activity to a self-hosted **Clan Data Server** run by your clan leader. When configured:

- Each completed session (mining bag, haul delivery, contract, etc.) is uploaded immediately in the background.
- Your blueprint catalogue and vehicle hangar are pushed on every change.
- If the server is unreachable, the app continues working offline — uploads are not queued or retried, the local record is always authoritative.

To configure, go to **Settings → Clan Sync** in the app and enter the server URL, Server ID, and Auth Token provided by your clan leader. The auth token never leaves the desktop app — it is proxied through the local Express backend and never reaches the browser renderer.

See [`clan-data-server/README.md`](../clan-data-server/README.md) for how clan leaders can self-host the server.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, TailwindCSS, TanStack Query |
| Backend | Express, libSQL / SQLite via `@libsql/client` |
| Desktop | Electron 42 |
| Packaging | electron-builder (NSIS for Windows) |

---

## Contributing

Issues and PRs welcome. The project is a monorepo:

```
client/   React + Vite frontend
server/   Express + SQLite backend
electron/ Electron shell + build config
scripts/  Build helpers (icon generation, prepare-electron)
```

---

## License

MIT — free to use, modify, and distribute.

---

*Not affiliated with Cloud Imperium Games or the Star Citizen project.*
