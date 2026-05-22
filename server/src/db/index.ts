import { createClient, type Client } from '@libsql/client';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.env.DATA_DIR || path.join(__dirname, '../../data'));
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'game-ledger.db');

const client: Client = createClient({
  url: `file:${DB_PATH}`,
});

// Thin wrapper matching the better-sqlite3 API style but async
export const db = {
  all: async (sql: string, args: unknown[] = []): Promise<any[]> => {
    const r = await client.execute({ sql, args: args as any });
    return r.rows as any[];
  },
  get: async (sql: string, args: unknown[] = []): Promise<any | null> => {
    const r = await client.execute({ sql, args: args as any });
    return (r.rows[0] as any) ?? null;
  },
  run: async (sql: string, args: unknown[] = []): Promise<{ lastInsertRowid: number }> => {
    const r = await client.execute({ sql, args: args as any });
    return { lastInsertRowid: Number(r.lastInsertRowid ?? 0) };
  },
  exec: async (sql: string): Promise<void> => {
    // Execute multiple statements by splitting on semicolons
    const stmts = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of stmts) {
      await client.execute(stmt);
    }
  },
  batch: async (stmts: Array<{ sql: string; args?: unknown[] }>): Promise<void> => {
    await client.batch(stmts.map(s => ({ sql: s.sql, args: (s.args ?? []) as any })));
  },
};

const CREATE_TABLES = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'UEC',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS crew_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  game_handle TEXT,
  game_id INTEGER REFERENCES games(id),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  game_id INTEGER REFERENCES games(id),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL REFERENCES games(id),
  vehicle_id INTEGER REFERENCES vehicles(id),
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  title TEXT,
  location TEXT,
  started_at TEXT,
  ended_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS run_crew (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  crew_member_id INTEGER NOT NULL REFERENCES crew_members(id),
  role TEXT,
  payout_type TEXT NOT NULL DEFAULT 'percentage',
  payout_value REAL NOT NULL DEFAULT 0,
  payout_settled INTEGER NOT NULL DEFAULT 0,
  actual_payout REAL
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER REFERENCES runs(id) ON DELETE SET NULL,
  game_id INTEGER REFERENCES games(id),
  category TEXT NOT NULL,
  item_name TEXT,
  amount REAL NOT NULL,
  notes TEXT,
  date TEXT NOT NULL DEFAULT (date('now'))
);

CREATE TABLE IF NOT EXISTS mining_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  raw_material TEXT NOT NULL,
  quantity_raw REAL NOT NULL,
  location TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS refining_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mining_entry_id INTEGER NOT NULL REFERENCES mining_entries(id) ON DELETE CASCADE,
  refinery_name TEXT,
  refinery_method TEXT,
  input_quantity REAL NOT NULL,
  output_material TEXT NOT NULL,
  output_quantity REAL,
  efficiency REAL,
  cost_to_refine REAL DEFAULT 0,
  started_at TEXT,
  completed_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER REFERENCES runs(id),
  refining_job_id INTEGER REFERENCES refining_jobs(id),
  trading_entry_id INTEGER,
  contract_id INTEGER,
  commodity TEXT NOT NULL,
  quantity_sold REAL NOT NULL,
  price_per_unit REAL NOT NULL,
  total_revenue REAL NOT NULL,
  location TEXT,
  sold_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS trading_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  commodity TEXT NOT NULL,
  quantity_bought REAL NOT NULL,
  buy_price_per_unit REAL NOT NULL,
  total_cost REAL NOT NULL,
  buy_location TEXT,
  sell_location TEXT,
  status TEXT NOT NULL DEFAULT 'in_transit'
);

CREATE TABLE IF NOT EXISTS crafting_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  output_item TEXT NOT NULL,
  output_quantity REAL NOT NULL,
  estimated_value REAL,
  status TEXT NOT NULL DEFAULT 'in_progress',
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS crafting_inputs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  crafting_job_id INTEGER NOT NULL REFERENCES crafting_jobs(id) ON DELETE CASCADE,
  material TEXT NOT NULL,
  quantity_required REAL NOT NULL,
  quantity_used REAL,
  cost_per_unit REAL,
  total_cost REAL
);

CREATE TABLE IF NOT EXISTS contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  client_name TEXT,
  description TEXT,
  agreed_payout REAL NOT NULL,
  bonus_payout REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS hauling_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  cargo_type TEXT,
  scu_amount REAL,
  pickup_location TEXT,
  delivery_location TEXT,
  agreed_payout REAL NOT NULL,
  bonus_payout REAL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL REFERENCES games(id),
  item TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 0,
  unit_cost REAL,
  location TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inventory_id INTEGER NOT NULL REFERENCES inventory(id),
  run_id INTEGER REFERENCES runs(id),
  type TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_cost REAL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL REFERENCES games(id),
  run_id INTEGER REFERENCES runs(id),
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT NOT NULL,
  date TEXT NOT NULL DEFAULT (date('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)
`;

export async function initDb() {
  await db.exec(CREATE_TABLES);

  // Schema migrations — safe to run multiple times (silently ignored if column already exists)
  const migrations = [
    'ALTER TABLE contracts ADD COLUMN cargo_type TEXT',
    'ALTER TABLE contracts ADD COLUMN scu_amount REAL',
    'ALTER TABLE contracts ADD COLUMN pickup_location TEXT',
    'ALTER TABLE contracts ADD COLUMN delivery_location TEXT',
  ];
  for (const sql of migrations) {
    try { await db.run(sql); } catch { /* column already exists */ }
  }

  // Seed default games if empty
  const count = await db.get('SELECT COUNT(*) as c FROM games');
  if ((count?.c ?? 0) === 0) {
    await db.run("INSERT INTO games (name, currency) VALUES ('Star Citizen', 'UEC')");
    await db.run("INSERT INTO games (name, currency) VALUES ('EVE Online', 'ISK')");
    await db.run("INSERT INTO games (name, currency) VALUES ('Elite Dangerous', 'Credits')");
  }
}
