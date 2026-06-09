import { db } from '../db';

/** Auto stock-in: upsert an item into the game's inventory, linked to a run.
 *  Silently catches errors so it never blocks the main operation. */
export async function inventoryIn(
  gameId: number,
  item: string,
  quantity: number,
  runId: number | null,
  unitCost?: number | null,
  reason?: string,
): Promise<void> {
  try {
    const existing = await db.get(
      'SELECT id, quantity, unit_cost FROM inventory WHERE game_id = ? AND item = ?',
      [gameId, item],
    );
    let invId: number;
    if (existing) {
      // Weighted-average cost basis
      let avgCost: number | null = existing.unit_cost ?? null;
      if (unitCost != null && unitCost > 0) {
        const prevQty = existing.quantity ?? 0;
        const totalQty = prevQty + quantity;
        avgCost = totalQty > 0
          ? (prevQty * (existing.unit_cost ?? 0) + quantity * unitCost) / totalQty
          : unitCost;
      }
      await db.run(
        "UPDATE inventory SET quantity = quantity + ?, unit_cost = COALESCE(?, unit_cost), updated_at = datetime('now') WHERE id = ?",
        [quantity, avgCost, existing.id],
      );
      invId = existing.id;
    } else {
      const r = await db.run(
        'INSERT INTO inventory (game_id, item, quantity, unit_cost) VALUES (?, ?, ?, ?)',
        [gameId, item, quantity, unitCost ?? null],
      );
      invId = r.lastInsertRowid;
    }
    await db.run(
      'INSERT INTO inventory_transactions (inventory_id, run_id, type, quantity, unit_cost, reason) VALUES (?, ?, ?, ?, ?, ?)',
      [invId, runId, 'in', quantity, unitCost ?? null, reason ?? 'Auto-tracked from run'],
    );
  } catch {
    // Best-effort — never block the caller
  }
}

/** Auto stock-out: reduce an item's quantity in inventory.
 *  Silently no-ops if the item is not found. */
export async function inventoryOut(
  gameId: number,
  item: string,
  quantity: number,
  runId: number | null,
  reason?: string,
): Promise<void> {
  try {
    const existing = await db.get(
      'SELECT id, quantity FROM inventory WHERE game_id = ? AND item = ?',
      [gameId, item],
    );
    if (!existing) return;
    const newQty = Math.max(0, (existing.quantity ?? 0) - quantity);
    await db.run(
      "UPDATE inventory SET quantity = ?, updated_at = datetime('now') WHERE id = ?",
      [newQty, existing.id],
    );
    await db.run(
      'INSERT INTO inventory_transactions (inventory_id, run_id, type, quantity, reason) VALUES (?, ?, ?, ?, ?)',
      [existing.id, runId, 'out', quantity, reason ?? 'Auto-tracked from run'],
    );
  } catch {
    // Best-effort
  }
}
