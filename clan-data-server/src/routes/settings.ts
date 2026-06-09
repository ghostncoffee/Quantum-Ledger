import { Router } from 'express';
import { db } from '../db';
import { routeError } from '../lib/routeError';

const router = Router();

const ALLOWED_KEYS = ['clanName'] as const;
const DEFAULTS: Record<string, string> = { clanName: 'Clan Server' };

router.get('/', async (_req, res) => {
  try {
    const rows = await db.all('SELECT key, value FROM server_settings');
    const map: Record<string, string> = { ...DEFAULTS };
    for (const r of rows as any[]) map[r.key] = r.value;
    res.json(map);
  } catch (e: unknown) { routeError(res, e); }
});

router.patch('/', async (req, res) => {
  try {
    for (const key of ALLOWED_KEYS) {
      if (req.body[key] !== undefined) {
        await db.run(
          `INSERT INTO server_settings (key, value, updated_at)
           VALUES (?, ?, datetime('now'))
           ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
          [key, String(req.body[key]).trim()],
        );
      }
    }
    res.json({ ok: true });
  } catch (e: unknown) { routeError(res, e); }
});

export default router;
