import { Router } from 'express';
import { routeError } from '../lib/routeError';
import { db } from '../db';
import { getShipMatrix } from '../lib/shipMatrix';
import { syncHangar } from '../lib/clanSync';

const router = Router();

async function pushHangarForGame(gameId: number | string | null | undefined): Promise<void> {
  if (!gameId) return;
  const ships = await db.all(
    'SELECT name, nickname, type, scu_capacity FROM vehicles WHERE game_id = ?',
    [gameId],
  ) as Array<{ name: string; nickname: string | null; type: string; scu_capacity: number | null }>;
  void syncHangar(ships);
}

router.get('/', async (req, res) => {
  try {
    const { gameId, type } = req.query;
    let q = 'SELECT v.*, g.name as game_name FROM vehicles v LEFT JOIN games g ON v.game_id = g.id WHERE 1=1';
    const args: unknown[] = [];
    if (gameId) { q += ' AND v.game_id = ?'; args.push(gameId); }
    if (type) { q += ' AND v.type = ?'; args.push(type); }
    q += ' ORDER BY v.name';
    res.json(await db.all(q, args));
  } catch (e: unknown) { routeError(res, e); }
});

// GET /vehicles/ship-matrix — proxies & caches the Star Citizen Wiki ship matrix
// so the client can enrich tracked vehicles with Foci/Cargo/Crew without CORS issues.
router.get('/ship-matrix', async (_req, res) => {
  try {
    res.json(await getShipMatrix());
  } catch (e: unknown) { routeError(res, e); }
});

// POST /vehicles/hangar — bulk-replace all vehicles for a game and sync to clan server
router.post('/hangar', async (req, res) => {
  const { gameId, ships } = req.body;
  if (!gameId || !Array.isArray(ships)) {
    return res.status(400).json({ error: 'gameId and ships[] required' });
  }
  try {
    await db.run('DELETE FROM vehicles WHERE game_id = ?', [gameId]);

    const inserted: Array<{ name: string; nickname?: string | null; type: string; scu_capacity?: number | null }> = [];
    for (const ship of ships) {
      const { name, type, crew_min, crew_max, scu_capacity, notes, nickname } = ship;
      if (!name || !type) continue;
      await db.run(
        'INSERT INTO vehicles (name, type, crew_min, crew_max, scu_capacity, game_id, notes, nickname) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [name, type, crew_min ?? 1, crew_max ?? 1, scu_capacity ?? 0, gameId, notes ?? null, nickname ?? null]
      );
      inserted.push({ name, nickname: nickname ?? null, type, scu_capacity: scu_capacity ?? null });
    }

    void syncHangar(inserted);

    res.status(201).json({ ok: true, count: inserted.length });
  } catch (e: unknown) { routeError(res, e); }
});

router.post('/', async (req, res) => {
  const { name, type, crew_min, crew_max, scu_capacity, gameId, notes, nickname } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'name and type required' });
  try {
    const result = await db.run(
      'INSERT INTO vehicles (name, type, crew_min, crew_max, scu_capacity, game_id, notes, nickname) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, type, crew_min ?? 1, crew_max ?? 1, scu_capacity ?? 0, gameId ?? null, notes ?? null, nickname ?? null]
    );
    res.status(201).json({ id: result.lastInsertRowid });
    void pushHangarForGame(gameId);
  } catch (e: unknown) { routeError(res, e); }
});

router.put('/:id', async (req, res) => {
  const { name, type, crew_min, crew_max, scu_capacity, gameId, notes, nickname } = req.body;
  try {
    await db.run(
      'UPDATE vehicles SET name = COALESCE(?, name), type = COALESCE(?, type), crew_min = COALESCE(?, crew_min), crew_max = COALESCE(?, crew_max), scu_capacity = COALESCE(?, scu_capacity), game_id = COALESCE(?, game_id), notes = COALESCE(?, notes), nickname = ? WHERE id = ?',
      [name ?? null, type ?? null, crew_min ?? null, crew_max ?? null, scu_capacity ?? null, gameId ?? null, notes ?? null, nickname ?? null, req.params.id]
    );
    res.json({ ok: true });
    const row = await db.get('SELECT game_id FROM vehicles WHERE id = ?', [req.params.id]) as any;
    void pushHangarForGame(row?.game_id);
  } catch (e: unknown) { routeError(res, e); }
});

// DELETE /vehicles — bulk-clear, optionally scoped to a game (used to wipe the
// hangar before a fresh import so re-imports replace rather than merge).
router.delete('/', async (req, res) => {
  try {
    const { gameId } = req.query;
    if (gameId) {
      await db.run('DELETE FROM vehicles WHERE game_id = ?', [gameId]);
    } else {
      await db.run('DELETE FROM vehicles');
    }
    res.json({ ok: true });
  } catch (e: unknown) { routeError(res, e); }
});

router.delete('/:id', async (req, res) => {
  try {
    const row = await db.get('SELECT game_id FROM vehicles WHERE id = ?', [req.params.id]) as any;
    await db.run('DELETE FROM vehicles WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
    void pushHangarForGame(row?.game_id);
  } catch (e: unknown) { routeError(res, e); }
});

export default router;
