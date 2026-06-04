import { Router } from 'express';
import { routeError } from '../lib/routeError';
import { db } from '../db';
import { inventoryIn, inventoryOut } from '../lib/inventory';

const router = Router();

// ─── Per-run pipeline ─────────────────────────────────────────────────────────
router.get('/run/:runId', async (req, res) => {
  try {
    const hauls = await db.all(
      'SELECT * FROM salvage_hauls WHERE run_id = ? ORDER BY id',
      [req.params.runId],
    );
    const result = await Promise.all((hauls as any[]).map(async (h: any) => ({
      ...h,
      lines: await db.all('SELECT * FROM salvage_lines WHERE haul_id = ? ORDER BY id', [h.id]),
    })));
    res.json(result);
  } catch (e: unknown) { routeError(res, e); }
});

// ─── All hauls (standalone Salvaging page) ────────────────────────────────────
router.get('/hauls', async (req, res) => {
  try {
    const { gameId } = req.query;
    const gId = gameId ? Number(gameId) : null;
    const hauls = await db.all(`
      SELECT sh.*, r.game_id, r.title AS run_title, g.name AS game_name, g.currency
      FROM   salvage_hauls sh
      JOIN   runs r  ON sh.run_id  = r.id
      JOIN   games g ON r.game_id  = g.id
      ${gId ? 'WHERE r.game_id = ?' : ''}
      ORDER  BY sh.committed ASC, sh.id DESC
    `, gId ? [gId] : []);
    const result = await Promise.all((hauls as any[]).map(async (h: any) => ({
      ...h,
      lines: await db.all('SELECT * FROM salvage_lines WHERE haul_id = ? ORDER BY id', [h.id]),
    })));
    res.json(result);
  } catch (e: unknown) { routeError(res, e); }
});

// ─── Hauls CRUD ───────────────────────────────────────────────────────────────
router.post('/hauls', async (req, res) => {
  const { runId, label, notes } = req.body;
  if (!runId || !label) return res.status(400).json({ error: 'runId and label required' });
  try {
    const r = await db.run(
      'INSERT INTO salvage_hauls (run_id, label, notes) VALUES (?, ?, ?)',
      [runId, label, notes ?? null],
    );
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (e: unknown) { routeError(res, e); }
});

router.put('/hauls/:id', async (req, res) => {
  const { label, notes } = req.body;
  try {
    await db.run(
      'UPDATE salvage_hauls SET label = COALESCE(?, label), notes = COALESCE(?, notes) WHERE id = ?',
      [label ?? null, notes ?? null, req.params.id],
    );
    res.json({ ok: true });
  } catch (e: unknown) { routeError(res, e); }
});

router.delete('/hauls/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM salvage_hauls WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e: unknown) { routeError(res, e); }
});

// ─── Commit: check-in haul → auto-stock inventory ─────────────────────────────
router.post('/hauls/:id/commit', async (req, res) => {
  const { location } = req.body;
  try {
    const haul = await db.get(
      `SELECT sh.*, r.game_id FROM salvage_hauls sh
       JOIN runs r ON sh.run_id = r.id WHERE sh.id = ?`,
      [req.params.id],
    );
    if (!haul) return res.status(404).json({ error: 'Haul not found' });

    // Idempotent: if already committed, only update the location — never re-stock.
    // (Re-stocking on every commit was double/triple-counting inventory.)
    if (haul.committed) {
      await db.run(
        'UPDATE salvage_hauls SET committed_location = ?, committed_at = ? WHERE id = ?',
        [location ?? null, new Date().toISOString(), req.params.id],
      );
      return res.json({ ok: true });
    }

    const lines = await db.all(
      'SELECT * FROM salvage_lines WHERE haul_id = ?',
      [req.params.id],
    );
    for (const line of lines as any[]) {
      if ((line.quantity_scu ?? 0) > 0) {
        await inventoryIn(
          haul.game_id,
          line.material,
          line.quantity_scu,
          haul.run_id,
          null,
          `Salvaged: ${line.material}`,
        );
      }
    }

    await db.run(
      `UPDATE salvage_hauls
         SET committed = 1, committed_location = ?, committed_at = ?
       WHERE id = ?`,
      [location ?? null, new Date().toISOString(), req.params.id],
    );
    res.json({ ok: true });
  } catch (e: unknown) { routeError(res, e); }
});

// Uncommit — reverses the inventory that was stocked at commit time, so a
// commit → edit → re-commit cycle nets to zero instead of accumulating.
router.delete('/hauls/:id/commit', async (req, res) => {
  try {
    const haul = await db.get(
      `SELECT sh.committed, sh.run_id, r.game_id FROM salvage_hauls sh
       JOIN runs r ON sh.run_id = r.id WHERE sh.id = ?`,
      [req.params.id],
    );
    if (haul && haul.committed) {
      const lines = await db.all('SELECT * FROM salvage_lines WHERE haul_id = ?', [req.params.id]);
      for (const line of lines as any[]) {
        if ((line.quantity_scu ?? 0) > 0) {
          await inventoryOut(
            haul.game_id,
            line.material,
            line.quantity_scu,
            haul.run_id,
            `Salvage uncommitted: ${line.material}`,
          );
        }
      }
    }
    await db.run(
      `UPDATE salvage_hauls
         SET committed = 0, committed_location = NULL, committed_at = NULL
       WHERE id = ?`,
      [req.params.id],
    );
    res.json({ ok: true });
  } catch (e: unknown) { routeError(res, e); }
});

// ─── Salvage lines ────────────────────────────────────────────────────────────
// Helper: fetch a line's parent haul commit state + game/run for inventory sync
async function lineContext(lineId: string | number) {
  return db.get(
    `SELECT sl.material, sl.quantity_scu, sh.committed, sh.run_id, r.game_id
       FROM salvage_lines sl
       JOIN salvage_hauls sh ON sl.haul_id = sh.id
       JOIN runs r ON sh.run_id = r.id
      WHERE sl.id = ?`,
    [lineId],
  );
}

router.post('/hauls/:haulId/lines', async (req, res) => {
  const { runId, material, quantityScu } = req.body;
  if (!runId || !material || quantityScu == null) {
    return res.status(400).json({ error: 'runId, material, quantityScu required' });
  }
  try {
    const r = await db.run(
      'INSERT INTO salvage_lines (haul_id, run_id, material, quantity_scu) VALUES (?, ?, ?, ?)',
      [req.params.haulId, runId, material, quantityScu],
    );
    // If the haul is already committed, stock this new line immediately
    const haul = await db.get(
      `SELECT sh.committed, r.game_id FROM salvage_hauls sh
       JOIN runs r ON sh.run_id = r.id WHERE sh.id = ?`,
      [req.params.haulId],
    );
    if (haul && haul.committed && Number(quantityScu) > 0) {
      await inventoryIn(haul.game_id, material, Number(quantityScu), runId, null, `Salvaged: ${material}`);
    }
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (e: unknown) { routeError(res, e); }
});

router.put('/lines/:id', async (req, res) => {
  const { material, quantityScu } = req.body;
  try {
    // If the parent haul is committed, reconcile inventory: back out the old
    // (material, qty) and apply the new one, so edits don't accumulate stock.
    const before = await lineContext(req.params.id);
    if (before && before.committed && (before.quantity_scu ?? 0) > 0) {
      await inventoryOut(before.game_id, before.material, before.quantity_scu, before.run_id,
        `Salvage line edited: ${before.material}`);
    }

    await db.run(
      `UPDATE salvage_lines SET
         material     = COALESCE(?, material),
         quantity_scu = COALESCE(?, quantity_scu)
       WHERE id = ?`,
      [material ?? null, quantityScu ?? null, req.params.id],
    );

    const after = await lineContext(req.params.id);
    if (after && after.committed && (after.quantity_scu ?? 0) > 0) {
      await inventoryIn(after.game_id, after.material, after.quantity_scu, after.run_id, null,
        `Salvaged: ${after.material}`);
    }
    res.json({ ok: true });
  } catch (e: unknown) { routeError(res, e); }
});

router.delete('/lines/:id', async (req, res) => {
  try {
    // Back the line out of inventory if its haul was committed
    const ctx = await lineContext(req.params.id);
    if (ctx && ctx.committed && (ctx.quantity_scu ?? 0) > 0) {
      await inventoryOut(ctx.game_id, ctx.material, ctx.quantity_scu, ctx.run_id,
        `Salvage line removed: ${ctx.material}`);
    }
    await db.run('DELETE FROM salvage_lines WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e: unknown) { routeError(res, e); }
});

export default router;
