import { Router } from 'express';
import { db } from '../db';

const router = Router();

router.get('/run/:runId', async (req, res) => {
  try {
    res.json(await db.all('SELECT * FROM contracts WHERE run_id = ? ORDER BY id', [req.params.runId]));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/', async (req, res) => {
  try {
    const { gameId, status, type } = req.query;
    let q = `
      SELECT c.*, r.title as run_title, r.game_id, g.name as game_name, g.currency
      FROM contracts c
      JOIN runs r ON c.run_id = r.id
      JOIN games g ON r.game_id = g.id
      WHERE 1=1
    `;
    const args: unknown[] = [];
    if (gameId) { q += ' AND r.game_id = ?'; args.push(gameId); }
    if (status) { q += ' AND c.status = ?'; args.push(status); }
    if (type) { q += ' AND c.type = ?'; args.push(type); }
    q += ' ORDER BY c.id DESC';
    res.json(await db.all(q, args));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { runId, type, clientName, description, agreedPayout, bonusPayout,
          cargoType, scuAmount, pickupLocation, deliveryLocation } = req.body;
  if (!runId || !type || agreedPayout == null) {
    return res.status(400).json({ error: 'runId, type, agreedPayout required' });
  }
  try {
    const result = await db.run(
      `INSERT INTO contracts
         (run_id, type, client_name, description, agreed_payout, bonus_payout,
          cargo_type, scu_amount, pickup_location, delivery_location)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [runId, type, clientName ?? null, description ?? null, agreedPayout, bonusPayout ?? 0,
       cargoType ?? null, scuAmount ?? null, pickupLocation ?? null, deliveryLocation ?? null]
    );
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  const { type, clientName, description, agreedPayout, bonusPayout, status, completedAt,
          cargoType, scuAmount, pickupLocation, deliveryLocation } = req.body;
  try {
    await db.run(`
      UPDATE contracts SET
        type              = COALESCE(?, type),
        client_name       = COALESCE(?, client_name),
        description       = COALESCE(?, description),
        agreed_payout     = COALESCE(?, agreed_payout),
        bonus_payout      = COALESCE(?, bonus_payout),
        status            = COALESCE(?, status),
        completed_at      = COALESCE(?, completed_at),
        cargo_type        = COALESCE(?, cargo_type),
        scu_amount        = COALESCE(?, scu_amount),
        pickup_location   = COALESCE(?, pickup_location),
        delivery_location = COALESCE(?, delivery_location)
      WHERE id = ?
    `, [type ?? null, clientName ?? null, description ?? null, agreedPayout ?? null,
        bonusPayout ?? null, status ?? null, completedAt ?? null,
        cargoType ?? null, scuAmount ?? null, pickupLocation ?? null, deliveryLocation ?? null,
        req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/complete', async (req, res) => {
  const { bonusPayout } = req.body;
  try {
    await db.run(
      "UPDATE contracts SET status = 'complete', completed_at = datetime('now'), bonus_payout = COALESCE(?, bonus_payout) WHERE id = ?",
      [bonusPayout ?? null, req.params.id]
    );
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM contracts WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
