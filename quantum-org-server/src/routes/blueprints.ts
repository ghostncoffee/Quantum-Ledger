import { Router } from 'express';
import { db } from '../db';
import { routeError } from '../lib/routeError';

const router = Router();

// GET /api/blueprints — all clan-known blueprints, each with which members have it
router.get('/', async (_req, res) => {
  try {
    const rows = await db.all(`
      SELECT mb.product_name, GROUP_CONCAT(m.username, ',') AS members
      FROM member_blueprints mb
      JOIN members m ON mb.member_id = m.id
      WHERE m.status = 'approved'
      GROUP BY mb.product_name
      ORDER BY mb.product_name
    `);
    res.json((rows as any[]).map((r: any) => ({
      product_name: r.product_name,
      members: r.members ? String(r.members).split(',') : [],
    })));
  } catch (e: unknown) { routeError(res, e); }
});

export default router;
