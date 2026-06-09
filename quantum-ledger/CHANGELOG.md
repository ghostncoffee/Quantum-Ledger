# Changelog

All notable changes to Quantum Ledger will be documented here.

## [0.1.0] — 2026-05-22

### Added
- Mining pipeline: raw ore → refinery job → refined output → sale with full cost tracking
- Trading runs: buy/sell entries with commodity, quantity, margin, and status tracking
- Crafting jobs: output item, material inputs, cost basis, estimated value
- Contracts: combat, hauling, escort, refueling missions with payout and bonus tracking
- Multi-crew: per-run crew list with fixed-fee or percentage payout allocation and settlement tracking
- Vehicle/ship tracking per run
- Run timing: start/end timestamps with profit-per-hour calculation
- Expenses: itemised investments and costs (fuel, repairs, equipment, etc.) tied to runs or standalone
- Inventory: stock levels with average cost basis and in/out transaction history
- Full accounting ledger: income, expenses, crew payouts, net profit per game
- Dashboard: profit summaries, recent runs, run-type breakdown
- Multi-game support with separate currencies (Star Citizen/UEC, EVE Online/ISK, Elite Dangerous/Credits)
- Settings page: manage games and currency labels
- 100% offline — all data stored in a local SQLite file at `%APPDATA%\Quantum Ledger\data\`
- Windows installer (NSIS) and portable executable via electron-builder
