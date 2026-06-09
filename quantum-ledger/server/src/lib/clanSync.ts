import { db } from '../db';

export interface ClanSyncConfig {
  handle: string;
  serverUrl: string;
  serverId: string;
  authToken: string;
}

export interface BlueprintDiscovery {
  productName: string;
  missionGuid: string | null;
  missionDebugName: string | null;
  missionTrigger: string | null;
  discoveredAt: string;
}

export interface BlueprintSyncEntry {
  product_name: string;
  mission_trigger: string | null;
  discovered_at: string | null;
}

export interface SessionUpload {
  session_type: string;
  occurred_at: string;
  data: Record<string, unknown>;
}

export interface HangarShip {
  name: string;
  nickname?: string | null;
  type: string;
  scu_capacity?: number | null;
}

const CLAN_SYNC_KEYS = ['clanSyncEnabled', 'clanHandle', 'clanServerUrl', 'clanServerId', 'clanAuthToken'] as const;

async function loadClanSyncConfig(): Promise<ClanSyncConfig | null> {
  const rows = await db.all(
    `SELECT key, value FROM settings WHERE key IN (${CLAN_SYNC_KEYS.map(() => '?').join(',')})`,
    [...CLAN_SYNC_KEYS]
  );
  const map: Record<string, string> = {};
  for (const row of rows as any[]) map[row.key] = row.value;

  if (map.clanSyncEnabled !== 'true') return null;

  const handle = (map.clanHandle ?? '').trim();
  const serverUrl = (map.clanServerUrl ?? '').trim();
  const serverId = (map.clanServerId ?? '').trim();
  const authToken = (map.clanAuthToken ?? '').trim();
  if (!handle || !serverUrl || !serverId || !authToken) return null;

  return { handle, serverUrl, serverId, authToken };
}

/**
 * Verifies a clan-data-server is reachable at serverUrl, that it identifies
 * itself with the expected serverId, and that authToken is accepted — before
 * we persist credentials and start sending data to it.
 */
export async function testClanConnection(
  serverUrl: string,
  serverId: string,
  authToken: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  let health: any;
  try {
    const res = await fetch(`${serverUrl}/api/health`);
    if (!res.ok) return { ok: false, error: `Server responded with HTTP ${res.status} — check the Server URL` };
    health = await res.json();
  } catch {
    return { ok: false, error: 'Could not reach the server — check the Server URL' };
  }

  if (!health?.ok || health?.serverId !== serverId) {
    return { ok: false, error: 'That server reported a different Server ID — double check the URL and ID match' };
  }

  try {
    const res = await fetch(`${serverUrl}/api/members?limit=1`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.status === 401) return { ok: false, error: 'The server rejected the Auth Token' };
    if (!res.ok) return { ok: false, error: `Server responded with HTTP ${res.status} while checking the Auth Token` };
  } catch {
    return { ok: false, error: 'Could not reach the server while checking the Auth Token' };
  }

  return { ok: true };
}

/**
 * Pushes one or more blueprints to the clan server's structured blueprint index.
 * No-ops silently when clan sync isn't enabled/configured.
 */
export async function syncBlueprintsBatch(blueprints: BlueprintSyncEntry[]): Promise<void> {
  const config = await loadClanSyncConfig();
  if (!config || blueprints.length === 0) return;

  try {
    const res = await fetch(`${config.serverUrl}/api/upload/blueprints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.authToken}`,
      },
      body: JSON.stringify({ username: config.handle, blueprints }),
    });

    if (!res.ok) {
      console.error(`[clan-sync] blueprint sync rejected (HTTP ${res.status})`);
    }
  } catch (err) {
    console.error('[clan-sync] blueprint sync failed', err);
  }
}

const PROXY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — matches client staleTime
interface ProxyCache<T> { data: T; fetchedAt: number }
let membersCache: ProxyCache<any[]> | null = null;
let blueprintsCache: ProxyCache<any[]> | null = null;

/**
 * Fetches all blueprints known to the clan server, with which members have each one.
 * Returns null when clan sync is not configured. Results are cached for 5 minutes
 * so burst requests from the client don't hammer the clan server.
 */
export async function fetchClanBlueprints(): Promise<any[] | null> {
  const config = await loadClanSyncConfig();
  if (!config) return null;

  if (blueprintsCache && Date.now() - blueprintsCache.fetchedAt < PROXY_CACHE_TTL_MS) {
    return blueprintsCache.data;
  }

  const res = await fetch(`${config.serverUrl}/api/blueprints`, {
    headers: { Authorization: `Bearer ${config.authToken}` },
  });
  if (!res.ok) throw new Error(`Clan server responded with HTTP ${res.status}`);
  const body: any = await res.json();
  const data = Array.isArray(body) ? body : [];
  blueprintsCache = { data, fetchedAt: Date.now() };
  return data;
}

/**
 * Fetches the member list from the clan server. Returns null when clan sync
 * is not configured, throws on network/auth errors. Results are cached for 5
 * minutes so burst requests from the client don't hammer the clan server.
 */
export async function fetchClanMembers(): Promise<any[] | null> {
  const config = await loadClanSyncConfig();
  if (!config) return null;

  if (membersCache && Date.now() - membersCache.fetchedAt < PROXY_CACHE_TTL_MS) {
    return membersCache.data;
  }

  const res = await fetch(`${config.serverUrl}/api/members?limit=200`, {
    headers: { Authorization: `Bearer ${config.authToken}` },
  });
  if (!res.ok) throw new Error(`Clan server responded with HTTP ${res.status}`);
  const body: any = await res.json();
  const data = Array.isArray(body) ? body : [];
  membersCache = { data, fetchedAt: Date.now() };
  return data;
}

/**
 * Uploads a completed activity session to the clan server.
 * Fire-and-forget — never throws. No-ops when clan sync isn't configured.
 */
export async function syncSession(session: SessionUpload): Promise<void> {
  const config = await loadClanSyncConfig();
  if (!config) return;

  try {
    const res = await fetch(`${config.serverUrl}/api/upload/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.authToken}`,
      },
      body: JSON.stringify({
        username: config.handle,
        session_type: session.session_type,
        occurred_at: session.occurred_at,
        data: session.data,
      }),
    });

    if (!res.ok) {
      console.error(`[clan-sync] session upload rejected (HTTP ${res.status})`);
    }
  } catch (err) {
    console.error('[clan-sync] session upload failed', err);
  }
}

/** Single-discovery convenience wrapper used by the log monitor. */
export async function syncBlueprintDiscovery(blueprint: BlueprintDiscovery): Promise<void> {
  await syncBlueprintsBatch([{
    product_name: blueprint.productName,
    mission_trigger: blueprint.missionTrigger,
    discovered_at: blueprint.discoveredAt,
  }]);
}

/**
 * Pushes the full ship list to the clan server so it can show each member's
 * hangar. Replaces whatever was previously stored for this handle.
 */
export async function syncHangar(ships: HangarShip[]): Promise<void> {
  const config = await loadClanSyncConfig();
  if (!config) return;

  try {
    const res = await fetch(`${config.serverUrl}/api/upload/hangar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.authToken}`,
      },
      body: JSON.stringify({
        username: config.handle,
        ships: ships.map(s => ({
          name: s.name,
          nickname: s.nickname ?? null,
          type: s.type,
          scu_capacity: s.scu_capacity ?? null,
        })),
      }),
    });

    if (!res.ok) {
      console.error(`[clan-sync] hangar sync rejected (HTTP ${res.status})`);
    }
  } catch (err) {
    console.error('[clan-sync] hangar sync failed', err);
  }
}
