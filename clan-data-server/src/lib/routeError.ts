import { Response } from 'express';
import { logger } from './logger';

/**
 * Logs the real error server-side and returns a generic 500 to the client.
 * Prevents internal DB details (table names, column names) leaking to callers.
 */
export function routeError(res: Response, e: unknown): void {
  logger.error('[route error]', e);
  res.status(500).json({ error: 'Internal server error' });
}
