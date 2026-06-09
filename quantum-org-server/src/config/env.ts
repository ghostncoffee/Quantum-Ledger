import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// When running as a pkg-packaged executable, __dirname points into the
// read-only virtual snapshot baked into the binary — config, the database and
// logs must instead live next to the real .exe so they're writable and persist.
const baseDir = 'pkg' in process
  ? path.dirname(process.execPath)
  : path.join(__dirname, '../..');

const ENV_PATH = path.join(baseDir, '.env');
dotenv.config({ path: ENV_PATH });

// Generates a value on first run and persists it to .env so it survives restarts.
function ensurePersisted(key: string, generate: () => string): string {
  const existing = process.env[key];
  if (existing) return existing;

  const value = generate();
  process.env[key] = value;

  const line = `${key}=${value}\n`;
  fs.appendFileSync(ENV_PATH, line);
  console.log(`[config] Generated ${key} and saved it to .env`);
  return value;
}

export const config = {
  port: Number(process.env.SERVER_PORT ?? process.env.PORT ?? 3100),
  dataDir: path.resolve(process.env.DATA_DIR || path.join(baseDir, 'data')),
  serverId: ensurePersisted('SERVER_ID', () => crypto.randomUUID()),
  authToken: ensurePersisted('AUTH_TOKEN', () => crypto.randomBytes(32).toString('hex')),
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || null,
  dataRetentionDays: Number(process.env.DATA_RETENTION_DAYS ?? 90),
};
