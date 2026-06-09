import { Router } from 'express';
import { db } from '../db';
import { config } from '../config/env';
import { routeError } from '../lib/routeError';

const router = Router();

const startedAt = Date.now();

router.get('/', async (_req, res) => {
  try {
    const [memberCount, clanNameRow] = await Promise.all([
      db.get("SELECT COUNT(*) as count FROM members WHERE status = 'approved'"),
      db.get("SELECT value FROM server_settings WHERE key = 'clanName'"),
    ]);
    res.json({
      ok: true,
      serverId: config.serverId,
      clanName: clanNameRow?.value ?? 'Clan Server',
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      memberCount: memberCount?.count ?? 0,
    });
  } catch (e: unknown) { routeError(res, e); }
});

export default router;
