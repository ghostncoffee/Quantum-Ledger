import { Router } from 'express';
import { db } from '../db';

const router = Router();

/**
 * GET /api/locations?gameId=X
 *
 * Returns every known location that currently has assets, with a full
 * breakdown of what's there:
 *   - inventory items stored at that location
 *   - active refinery jobs (status != 'done') at that location
 *   - hauling contracts awaiting pickup  (status='pending', pickup_location)
 *   - hauling contracts arriving here    (status='in_transit', delivery_location)
 *   - trading cargo sitting at buy_location (status='in_transit')
 *   - active runs tagged to that location
 */
router.get('/', async (req, res) => {
  try {
    const { gameId } = req.query;
    const gId = gameId ? Number(gameId) : null;

    // ── Inventory ────────────────────────────────────────────────────────────
    const inventory = await db.all(
      `SELECT i.*, g.name as game_name, g.currency
       FROM inventory i
       JOIN games g ON i.game_id = g.id
       WHERE i.location IS NOT NULL AND i.location != ''
         AND i.quantity > 0
         ${gId ? 'AND i.game_id = ?' : ''}
       ORDER BY i.location, i.item`,
      gId ? [gId] : []
    );

    // ── Refinery jobs (not done) ──────────────────────────────────────────────
    const refiningJobs = await db.all(
      `SELECT rj.*, me.raw_material, me.run_id, r.game_id, r.title as run_title,
              g.currency
       FROM refining_jobs rj
       JOIN mining_entries me ON rj.mining_entry_id = me.id
       JOIN runs r ON me.run_id = r.id
       JOIN games g ON r.game_id = g.id
       WHERE rj.status != 'done'
         AND rj.refinery_name IS NOT NULL AND rj.refinery_name != ''
         ${gId ? 'AND r.game_id = ?' : ''}
       ORDER BY rj.refinery_name, rj.id`,
      gId ? [gId] : []
    );

    // ── Hauling jobs (not delivered) ──────────────────────────────────────────
    const haulingJobs = await db.all(
      `SELECT hj.*, r.game_id, r.title as run_title, g.currency
       FROM hauling_jobs hj
       JOIN runs r ON hj.run_id = r.id
       JOIN games g ON r.game_id = g.id
       WHERE hj.status != 'delivered'
         ${gId ? 'AND r.game_id = ?' : ''}
       ORDER BY hj.id`,
      gId ? [gId] : []
    );

    // ── Trading entries (bought, not fully sold) ──────────────────────────────
    const tradingEntries = await db.all(
      `SELECT te.*, r.game_id, g.currency
       FROM trading_entries te
       JOIN runs r ON te.run_id = r.id
       JOIN games g ON r.game_id = g.id
       WHERE te.status = 'in_transit'
         AND te.buy_location IS NOT NULL AND te.buy_location != ''
         ${gId ? 'AND r.game_id = ?' : ''}
       ORDER BY te.buy_location, te.commodity`,
      gId ? [gId] : []
    );

    // ── Active runs at a location ─────────────────────────────────────────────
    const activeRuns = await db.all(
      `SELECT r.*, g.name as game_name, g.currency
       FROM runs r
       JOIN games g ON r.game_id = g.id
       WHERE r.status = 'active'
         AND r.location IS NOT NULL AND r.location != ''
         ${gId ? 'AND r.game_id = ?' : ''}
       ORDER BY r.location, r.created_at DESC`,
      gId ? [gId] : []
    );

    // ── Collect all distinct location names ───────────────────────────────────
    const locationSet = new Set<string>();
    (inventory as any[]).forEach((i: any) => locationSet.add(i.location));
    (refiningJobs as any[]).forEach((j: any) => locationSet.add(j.refinery_name));
    (haulingJobs as any[]).forEach((j: any) => {
      if (j.status === 'pending' && j.pickup_location) locationSet.add(j.pickup_location);
      if (j.status === 'in_transit' && j.delivery_location) locationSet.add(j.delivery_location);
    });
    (tradingEntries as any[]).forEach((t: any) => locationSet.add(t.buy_location));
    (activeRuns as any[]).forEach((r: any) => locationSet.add(r.location));

    // ── Build per-location summary ────────────────────────────────────────────
    const locations = Array.from(locationSet)
      .sort((a, b) => a.localeCompare(b))
      .map((name: string) => {
        const locInventory = (inventory as any[]).filter((i: any) => i.location === name);
        const locRefining = (refiningJobs as any[]).filter((j: any) => j.refinery_name === name);
        const locHaulingPickup = (haulingJobs as any[]).filter(
          (j: any) => j.pickup_location === name && j.status === 'pending'
        );
        const locHaulingDelivery = (haulingJobs as any[]).filter(
          (j: any) => j.delivery_location === name && j.status === 'in_transit'
        );
        const locTrading = (tradingEntries as any[]).filter((t: any) => t.buy_location === name);
        const locRuns = (activeRuns as any[]).filter((r: any) => r.location === name);

        const inventoryQty = locInventory.reduce((s: number, i: any) => s + i.quantity, 0);
        const inventoryValue = locInventory.reduce(
          (s: number, i: any) => s + i.quantity * (i.unit_cost || 0),
          0
        );
        const refiningScuIn = locRefining.reduce((s: number, j: any) => s + (j.input_quantity || 0), 0);
        const refiningScuOut = locRefining.reduce(
          (s: number, j: any) => s + (j.output_quantity || 0),
          0
        );

        return {
          name,
          inventory: locInventory,
          inventoryCount: locInventory.length,
          inventoryQty,
          inventoryValue,
          refiningJobs: locRefining,
          refiningJobsCount: locRefining.length,
          refiningScuIn,
          refiningScuOut,
          haulingPickups: locHaulingPickup,
          haulingDeliveries: locHaulingDelivery,
          tradingCargo: locTrading,
          activeRuns: locRuns,
        };
      });

    res.json(locations);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
