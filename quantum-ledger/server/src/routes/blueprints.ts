import express from 'express';
import { db } from '../db';
import { syncBlueprintDiscovery, syncBlueprintsBatch } from '../lib/clanSync';
import { getDefaultBlueprints } from '../lib/defaultBlueprints';
import { getBlueprintMatrix } from '../lib/blueprintMatrix';

const router = express.Router();

// GET /blueprints/defaults — proxies & caches the SC Wiki list of always-available blueprints
router.get('/defaults', async (_req, res) => {
  try {
    res.json(await getDefaultBlueprints());
  } catch (e) {
    console.error('[blueprints GET /defaults]', e);
    res.status(500).json({ error: 'Failed to fetch default blueprints' });
  }
});

// GET /blueprints/matrix — proxies & caches the SC Wiki blueprint catalogue (item types, craft times)
router.get('/matrix', async (_req, res) => {
  try {
    res.json(await getBlueprintMatrix());
  } catch (e) {
    console.error('[blueprints GET /matrix]', e);
    res.status(500).json({ error: 'Failed to fetch blueprint matrix' });
  }
});

// GET /blueprints — list all discovered blueprints
router.get('/', async (req, res) => {
  try {
    const { gameId, search } = req.query;
    let sql = 'SELECT b.*, g.name as game_name FROM blueprints b JOIN games g ON b.game_id = g.id WHERE 1=1';
    const params: unknown[] = [];

    if (gameId) {
      sql += ' AND b.game_id = ?';
      params.push(gameId);
    }

    if (search) {
      sql += ' AND b.product_name LIKE ?';
      params.push(`%${search}%`);
    }

    sql += ' ORDER BY b.discovered_at DESC';
    const blueprints = await db.all(sql, params);
    res.json(blueprints);
  } catch (err) {
    console.error('[blueprints GET]', err);
    res.status(500).json({ error: 'Failed to fetch blueprints' });
  }
});

// GET /blueprints/summary — summary statistics
router.get('/summary', async (req, res) => {
  try {
    const { gameId } = req.query;

    let whereSql = '';
    const params: unknown[] = [];

    if (gameId) {
      whereSql = ' WHERE game_id = ?';
      params.push(gameId);
    }

    const total = await db.get(`SELECT COUNT(*) as count FROM blueprints${whereSql}`, params);
    const byGame = await db.all(
      `SELECT g.id, g.name, COUNT(b.id) as count FROM blueprints b JOIN games g ON b.game_id = g.id${whereSql} GROUP BY g.id ORDER BY g.name`,
      params
    );

    const recent = await db.all(
      `SELECT b.*, g.name as game_name FROM blueprints b JOIN games g ON b.game_id = g.id${whereSql} ORDER BY b.discovered_at DESC LIMIT 5`,
      params
    );

    res.json({
      total: total?.count ?? 0,
      byGame: (byGame as any[]).map(row => ({ gameId: row.id, gameName: row.name, count: row.count })),
      recent: recent,
    });
  } catch (err) {
    console.error('[blueprints GET /summary]', err);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// POST /blueprints — import one or more blueprints into the ledger
router.post('/', async (req, res) => {
  try {
    const blueprints = Array.isArray(req.body.blueprints) ? req.body.blueprints : [];
    const gameId = Number(req.body.gameId || req.body.game_id || req.query.gameId);
    if (!gameId || blueprints.length === 0) {
      return res.status(400).json({ error: 'gameId and blueprints are required' });
    }

    await db.run('BEGIN TRANSACTION');
    let inserted = 0;
    const syncQueue: Array<{ product_name: string; mission_trigger: string | null; discovered_at: string }> = [];
    for (const bp of blueprints) {
      const productName = String(bp.productName || bp.product_name || '').trim();
      if (!productName) continue;
      const missionGuid = bp.missionGuid ?? bp.mission_guid ?? null;
      const missionDebugName = bp.missionDebugName ?? bp.mission_debug_name ?? null;
      const missionTrigger = bp.missionTrigger ?? bp.mission_trigger ?? null;
      const rawTs = typeof bp.ts === 'number' && bp.ts > 0 ? bp.ts : null;
      const discoveredAt = rawTs ? new Date(rawTs * 1000).toISOString() : new Date().toISOString();
      const insert = await db.run(
        `INSERT OR IGNORE INTO blueprints (game_id, product_name, mission_guid, mission_debug_name, mission_trigger, discovered_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [gameId, productName, missionGuid, missionDebugName, missionTrigger, discoveredAt]
      );
      if (insert.rowsAffected > 0) {
        inserted += 1;
        syncQueue.push({ product_name: productName, mission_trigger: missionTrigger, discovered_at: discoveredAt });
      }
    }
    await db.run('COMMIT');
    void syncBlueprintsBatch(syncQueue);
    res.status(201).json({ success: true, inserted });
  } catch (err) {
    await db.run('ROLLBACK');
    console.error('[blueprints POST]', err);
    res.status(500).json({ error: 'Failed to import blueprints' });
  }
});

// DELETE /blueprints/:id — delete a blueprint entry
router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM blueprints WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[blueprints DELETE]', err);
    res.status(500).json({ error: 'Failed to delete blueprint' });
  }
});

export default router;
