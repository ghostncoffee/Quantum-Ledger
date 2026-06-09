import cron from 'node-cron';
import { db } from '../db';
import { config } from '../config/env';
import { logger } from '../lib/logger';

async function cleanup(): Promise<void> {
  try {
    const sessions = await db.run(
      `DELETE FROM uploaded_sessions WHERE uploaded_at < datetime('now', ?)`,
      [`-${config.dataRetentionDays} days`],
    );
    const activity = await db.run(
      `DELETE FROM activity_log WHERE created_at < datetime('now', '-30 days')`,
    );
    if (sessions.rowsAffected > 0 || activity.rowsAffected > 0) {
      logger.info(
        `[cleanup] Removed ${sessions.rowsAffected} sessions older than ${config.dataRetentionDays} days, ${activity.rowsAffected} activity entries older than 30 days`,
      );
    }
  } catch (err) {
    logger.error('[cleanup] Failed', err);
  }
}

export function startCleanupJob(): void {
  cron.schedule('0 2 * * *', () => {
    cleanup().catch(err => logger.error('[cleanup] Scheduled run failed', err));
  });
  logger.info('[cleanup] Job scheduled (daily at 02:00)');
}
