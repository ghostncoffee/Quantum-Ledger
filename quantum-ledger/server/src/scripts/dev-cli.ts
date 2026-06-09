import { createClient } from '@libsql/client';
import path from 'path';
import fs from 'fs';

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../../data');
const DB_PATH = path.join(DATA_DIR, 'game-ledger.db');

if (!fs.existsSync(DB_PATH)) {
  console.error(`Database not found: ${DB_PATH}`);
  console.error('Start the server at least once to initialise the database, then retry.');
  process.exit(1);
}

const client = createClient({ url: `file:${DB_PATH}` });

const command = process.argv[2];

function pad(s: unknown, n: number) {
  return String(s ?? '').slice(0, n).padEnd(n);
}

async function listUsers() {
  const res = await client.execute(`
    SELECT cm.id, cm.name, cm.game_handle, g.name AS game_name, cm.notes, cm.created_at
    FROM crew_members cm
    LEFT JOIN games g ON cm.game_id = g.id
    ORDER BY g.name, cm.name
  `);
  if (res.rows.length === 0) {
    console.log('No crew members found.');
    return;
  }
  console.log(`\n${pad('ID', 5)}${pad('Name', 24)}${pad('Handle', 24)}${pad('Game', 20)}Notes`);
  console.log('─'.repeat(85));
  for (const r of res.rows as any[]) {
    console.log(`${pad(r.id, 5)}${pad(r.name, 24)}${pad(r.game_handle || '—', 24)}${pad(r.game_name || '—', 20)}${r.notes || ''}`);
  }
  console.log(`\nTotal: ${res.rows.length}`);
}

async function listShips() {
  const res = await client.execute(`
    SELECT v.id, v.name, v.nickname, v.type, v.crew_min, v.crew_max, v.scu_capacity, g.name AS game_name
    FROM vehicles v
    LEFT JOIN games g ON v.game_id = g.id
    ORDER BY g.name, v.name
  `);
  if (res.rows.length === 0) {
    console.log('No ships found.');
    return;
  }
  console.log(`\n${pad('ID', 5)}${pad('Name', 28)}${pad('Nickname', 22)}${pad('Type', 14)}${pad('Crew', 8)}${pad('SCU', 8)}Game`);
  console.log('─'.repeat(100));
  for (const r of res.rows as any[]) {
    const crew = `${r.crew_min ?? 1}–${r.crew_max ?? 1}`;
    console.log(`${pad(r.id, 5)}${pad(r.name, 28)}${pad(r.nickname || '—', 22)}${pad(r.type, 14)}${pad(crew, 8)}${pad(r.scu_capacity || 0, 8)}${r.game_name || '—'}`);
  }
  console.log(`\nTotal: ${res.rows.length}`);
}

async function main() {
  switch (command) {
    case 'list-users':
      await listUsers();
      break;
    case 'list-ships':
      await listShips();
      break;
    default:
      console.log('Usage: npm run <command>');
      console.log('');
      console.log('Commands:');
      console.log('  list-users    List all crew members in the database');
      console.log('  list-ships    List all ships/vehicles in the database');
      process.exitCode = 1;
  }
  await client.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
