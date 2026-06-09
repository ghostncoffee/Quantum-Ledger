import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';

const BEARER_PREFIX = 'Bearer ';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith(BEARER_PREFIX)) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }

  const token = header.slice(BEARER_PREFIX.length).trim();
  if (token !== config.authToken) {
    res.status(401).json({ error: 'Invalid auth token' });
    return;
  }

  next();
}
