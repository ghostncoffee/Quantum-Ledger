const DEFAULT_BLUEPRINTS_URL =
  'https://api.star-citizen.wiki/api/blueprints?filter%5Bdefault%5D=true';
const CACHE_TTL_MS = 60 * 60 * 1000;

export interface DefaultBlueprint {
  key: string;
  output_name: string;
  craft_time_label: string;
  game_version: string;
}

let cache: { entries: DefaultBlueprint[]; fetchedAt: number } | null = null;

function normalize(raw: any): DefaultBlueprint {
  return {
    key: String(raw?.key ?? ''),
    output_name: String(raw?.output_name ?? '').trim(),
    craft_time_label: String(raw?.craft_time_label ?? ''),
    game_version: String(raw?.game_version ?? ''),
  };
}

/** Fetches blueprints that are available by default in-game and caches them for an hour. */
export async function getDefaultBlueprints(): Promise<DefaultBlueprint[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.entries;
  }

  const res = await fetch(DEFAULT_BLUEPRINTS_URL);
  if (!res.ok) throw new Error(`Default blueprints API responded with HTTP ${res.status}`);
  const body: any = await res.json();
  const entries = Array.isArray(body?.data) ? body.data.map(normalize) : [];

  cache = { entries, fetchedAt: Date.now() };
  return entries;
}
