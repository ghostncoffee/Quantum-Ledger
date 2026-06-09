import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { routeError } from '../lib/routeError';
import { logger } from '../lib/logger';

const blueprintsSchema = z.object({
  username: z.string().trim().min(1).max(64),
  blueprints: z.array(z.object({
    product_name: z.string().trim().min(1).max(256),
    mission_trigger: z.string().nullable().optional(),
    discovered_at: z.string().nullable().optional(),
  })).max(2000),
});

const hangarSchema = z.object({
  username: z.string().trim().min(1).max(64),
  ships: z.array(z.object({
    name: z.string().trim().min(1).max(128),
    nickname: z.string().trim().max(128).nullable().optional(),
    type: z.string().trim().min(1).max(64),
    scu_capacity: z.number().nullable().optional(),
  })).max(500),
});

const router = Router();

const uploadSchema = z.object({
  username: z.string().trim().min(1).max(64),
  session_type: z.string().trim().min(1).max(64),
  occurred_at: z.string().min(1),
  data: z.record(z.unknown()),
});

function dedupeHash(sessionType: string, occurredAt: string, data: unknown): string {
  const canonical = JSON.stringify({ session_type: sessionType, occurred_at: occurredAt, data });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

function extractAmount(sessionType: string, data: Record<string, unknown>): number | null {
  switch (sessionType) {
    case 'hauling':
    case 'contract': {
      const payout = Number(data.agreed_payout ?? 0) + Number(data.bonus_payout ?? 0);
      return payout > 0 ? payout : null;
    }
    case 'mining':
      return data.total_value_estimate != null ? Number(data.total_value_estimate) : null;
    default:
      return null;
  }
}

function buildDescription(sessionType: string, username: string, data: Record<string, unknown>): string {
  switch (sessionType) {
    case 'mining':
      return data.committed_location
        ? `${username} committed mining bag at ${data.committed_location}`
        : `${username} committed a mining bag`;
    case 'hauling':
      return data.dropoff_location
        ? `${username} delivered haul to ${data.dropoff_location}`
        : `${username} delivered a haul`;
    case 'contract':
      return `${username} completed a ${data.type ?? 'contract'}`;
    case 'salvage':
      return data.location
        ? `${username} committed salvage at ${data.location}`
        : `${username} committed salvage`;
    case 'refining':
      return `${username} completed refining at ${data.station ?? 'a station'}`;
    default:
      return `${username} logged a ${sessionType} session`;
  }
}

router.post('/session', async (req, res) => {
  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    return;
  }
  const { username, session_type, occurred_at, data } = parsed.data;

  try {
    let member = await db.get('SELECT id FROM members WHERE username = ?', [username]);
    if (!member) {
      const memberId = crypto.randomUUID();
      await db.run(
        "INSERT INTO members (id, username, status) VALUES (?, ?, 'pending')",
        [memberId, username],
      );
      member = { id: memberId };
      logger.info(`New member pending approval: ${username}`);
    } else {
      await db.run("UPDATE members SET last_seen = datetime('now') WHERE id = ?", [member.id]);
    }

    const sessionId = crypto.randomUUID();
    const hash = dedupeHash(session_type, occurred_at, data);
    const insertResult = await db.run(
      `INSERT INTO uploaded_sessions (id, member_id, session_type, session_data, occurred_at, dedupe_hash)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (member_id, dedupe_hash) DO NOTHING`,
      [sessionId, member.id, session_type, JSON.stringify(data), occurred_at, hash]
    );

    if (insertResult.rowsAffected === 0) {
      const existing = await db.get(
        'SELECT id FROM uploaded_sessions WHERE member_id = ? AND dedupe_hash = ?',
        [member.id, hash]
      );
      res.status(200).json({ ok: true, duplicate: true, sessionId: existing?.id ?? null });
      return;
    }

    const amount = extractAmount(session_type, data);
    const description = buildDescription(session_type, username, data);
    await db.run(
      `INSERT INTO activity_log (id, member_id, activity_type, description, amount, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), member.id, session_type, description, amount, occurred_at],
    );

    res.status(201).json({ ok: true, duplicate: false, sessionId });
  } catch (e: unknown) { routeError(res, e); }
});

// POST /blueprints — merge a member's discovered blueprints into the clan index
router.post('/blueprints', async (req, res) => {
  const parsed = blueprintsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    return;
  }
  const { username, blueprints } = parsed.data;

  try {
    let member = await db.get('SELECT id FROM members WHERE username = ?', [username]);
    if (!member) {
      const memberId = crypto.randomUUID();
      await db.run(
        "INSERT INTO members (id, username, status) VALUES (?, ?, 'pending')",
        [memberId, username],
      );
      member = { id: memberId };
      logger.info(`New member pending approval (blueprint sync): ${username}`);
    } else {
      await db.run("UPDATE members SET last_seen = datetime('now') WHERE id = ?", [member.id]);
    }

    let inserted = 0;
    for (const bp of blueprints) {
      const result = await db.run(
        `INSERT INTO member_blueprints (member_id, product_name, mission_trigger, discovered_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (member_id, product_name) DO NOTHING`,
        [member.id, bp.product_name, bp.mission_trigger ?? null, bp.discovered_at ?? null]
      );
      if (result.rowsAffected > 0) {
        inserted++;
        await db.run(
          `INSERT INTO activity_log (id, member_id, activity_type, description, occurred_at)
           VALUES (?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            member.id,
            'blueprint',
            `${username} discovered blueprint: ${bp.product_name}`,
            bp.discovered_at ?? new Date().toISOString(),
          ]
        );
      }
    }

    logger.info(`Blueprints synced for ${username}: ${inserted} new / ${blueprints.length} total`);
    res.status(200).json({ ok: true, inserted, total: blueprints.length });
  } catch (e: unknown) { routeError(res, e); }
});

// POST /hangar — replace a member's ship list wholesale
router.post('/hangar', async (req, res) => {
  const parsed = hangarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    return;
  }
  const { username, ships } = parsed.data;

  try {
    let member = await db.get('SELECT id FROM members WHERE username = ?', [username]);
    if (!member) {
      const memberId = crypto.randomUUID();
      await db.run(
        "INSERT INTO members (id, username, status) VALUES (?, ?, 'pending')",
        [memberId, username],
      );
      member = { id: memberId };
      logger.info(`New member pending approval (hangar sync): ${username}`);
    } else {
      await db.run("UPDATE members SET last_seen = datetime('now') WHERE id = ?", [member.id]);
    }

    await db.run('DELETE FROM member_ships WHERE member_id = ?', [member.id]);
    for (const ship of ships) {
      await db.run(
        `INSERT INTO member_ships (member_id, name, nickname, type, scu_capacity)
         VALUES (?, ?, ?, ?, ?)`,
        [member.id, ship.name, ship.nickname ?? null, ship.type, ship.scu_capacity ?? null]
      );
    }

    logger.info(`Hangar synced for ${username}: ${ships.length} ship(s)`);
    res.status(200).json({ ok: true, count: ships.length });
  } catch (e: unknown) { routeError(res, e); }
});

export default router;
