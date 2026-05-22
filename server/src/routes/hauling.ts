import { Router } from 'express';
import { db } from '../db';

const router = Router();

router.get('/run/:runId', async (req, res) => {
  try {
    res.json(await db.all(
      'SELECT * FROM hauling_jobs WHERE run_id = ? ORDER BY id',
      [req.params.runId]
    ));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { runId, cargoType, scuAmount, pickupLocation, deliveryLocation, agreedPayout, bonusPayout, notes } = req.body;
  if (!runId || agreedPayout == null) {
    return res.status(400).json({ error: 'runId and agreedPayout required' });
  }
  try {
    const result = await db.run(
      `INSERT INTO hauling_jobs
         (run_id, cargo_type, scu_amount, pickup_location, delivery_location, agreed_payout, bonus_payout, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [runId, cargoType ?? null, scuAmount ?? null, pickupLocation ?? null,
       deliveryLocation ?? null, agreedPayout, bonusPayout ?? 0, notes ?? null]
    );
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  const { cargoType, scuAmount, pickupLocation, deliveryLocation, agreedPayout, bonusPayout, notes, status } = req.body;
  try {
    // Auto-set completed_at when delivered
    const completedAt = status === 'delivered' ? new Date().toISOString() : null;
    await db.run(`
      UPDATE hauling_jobs SET
        cargo_type        = COALESCE(?, cargo_type),
        scu_amount        = COALESCE(?, scu_amount),
        pickup_location   = COALESCE(?, pickup_location),
        delivery_location = COALESCE(?, delivery_location),
        agreed_payout     = COALESCE(?, agreed_payout),
        bonus_payout      = COALESCE(?, bonus_payout),
        notes             = COALESCE(?, notes),
        status            = COALESCE(?, status),
        completed_at      = COALESCE(completed_at, ?)
      WHERE id = ?
    `, [cargoType ?? null, scuAmount ?? null, pickupLocation ?? null, deliveryLocation ?? null,
        agreedPayout ?? null, bonusPayout ?? null, notes ?? null, status ?? null,
        completedAt, req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM hauling_jobs WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
