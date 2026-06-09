import { createClient } from '@libsql/client';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'clan-data-server.db');

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
    SELECT m.username, m.first_seen, m.last_seen,
           COUNT(s.id) AS session_count,
           COUNT(DISTINCT sh.id) AS ship_count
    FROM members m
    LEFT JOIN uploaded_sessions s ON s.member_id = m.id
    LEFT JOIN member_ships sh ON sh.member_id = m.id
    GROUP BY m.id
    ORDER BY m.username
  `);
  if (res.rows.length === 0) {
    console.log('No members found.');
    return;
  }
  console.log(`\n${pad('Username', 28)}${pad('First seen', 22)}${pad('Last seen', 22)}${pad('Sessions', 10)}Ships`);
  console.log('─'.repeat(92));
  for (const r of res.rows as any[]) {
    console.log(`${pad(r.username, 28)}${pad(r.first_seen, 22)}${pad(r.last_seen, 22)}${pad(r.session_count, 10)}${r.ship_count}`);
  }
  console.log(`\nTotal members: ${res.rows.length}`);
}

async function listShips() {
  const res = await client.execute(`
    SELECT m.username, sh.name, sh.nickname, sh.type, sh.scu_capacity, sh.updated_at
    FROM member_ships sh
    JOIN members m ON sh.member_id = m.id
    ORDER BY m.username, sh.name
  `);
  if (res.rows.length === 0) {
    console.log('No ships found. Make sure members have synced their hangar from the ledger app.');
    return;
  }
  console.log(`\n${pad('Member', 24)}${pad('Ship', 28)}${pad('Nickname', 22)}${pad('Type', 14)}${pad('SCU', 8)}Updated`);
  console.log('─'.repeat(108));
  for (const r of res.rows as any[]) {
    console.log(`${pad(r.username, 24)}${pad(r.name, 28)}${pad(r.nickname || '—', 22)}${pad(r.type, 14)}${pad(r.scu_capacity ?? '—', 8)}${r.updated_at}`);
  }
  console.log(`\nTotal ships: ${res.rows.length}`);
}

async function listBlueprints() {
  const nameFilter = process.argv[3];
  let sql = `
    SELECT mb.product_name, mb.mission_trigger, mb.discovered_at, GROUP_CONCAT(m.username, ', ') AS members, COUNT(m.id) AS member_count
    FROM member_blueprints mb
    JOIN members m ON mb.member_id = m.id
  `;
  const args: string[] = [];
  if (nameFilter) {
    sql += ' WHERE mb.product_name LIKE ?';
    args.push(`%${nameFilter}%`);
  }
  sql += ' GROUP BY mb.product_name ORDER BY mb.product_name';

  const res = await client.execute({ sql, args });
  if (res.rows.length === 0) {
    console.log(nameFilter ? `No blueprints matching "${nameFilter}".` : 'No blueprints found.');
    return;
  }
  console.log(`\n${pad('Blueprint', 36)}${pad('Trigger', 12)}${pad('Owners', 6)}Members`);
  console.log('─'.repeat(100));
  for (const r of res.rows as any[]) {
    console.log(`${pad(r.product_name, 36)}${pad(r.mission_trigger || '—', 12)}${pad(r.member_count, 6)}${r.members}`);
  }
  console.log(`\nTotal unique blueprints: ${res.rows.length}`);
}

async function main() {
  switch (command) {
    case 'list-users':
      await listUsers();
      break;
    case 'list-ships':
      await listShips();
      break;
    case 'list-blueprints':
      await listBlueprints();
      break;
    default:
      console.log('Usage: npm run <command>');
      console.log('');
      console.log('Commands:');
      console.log('  list-users         List all members and their session/ship counts');
      console.log('  list-ships         List all ships synced from member hangars');
      console.log('  list-blueprints    List all blueprints across the clan (optional: -- <name filter>)');
      process.exitCode = 1;
  }
  await client.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
