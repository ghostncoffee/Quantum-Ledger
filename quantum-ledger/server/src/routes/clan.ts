import { Router } from 'express';
import { routeError } from '../lib/routeError';
import { fetchClanMembers, fetchClanBlueprints } from '../lib/clanSync';

const router = Router();

// GET /clan/members — proxies the clan server member list so the client never
// touches the auth token directly.  Returns [] when clan sync is unconfigured.
router.get('/members', async (_req, res) => {
  try {
    const members = await fetchClanMembers();
    res.json(members ?? []);
  } catch (e: unknown) { routeError(res, e); }
});

// GET /clan/blueprints — proxies the clan server's blueprint index (who has what)
router.get('/blueprints', async (_req, res) => {
  try {
    const blueprints = await fetchClanBlueprints();
    res.json(blueprints ?? []);
  } catch (e: unknown) { routeError(res, e); }
});

export default router;
