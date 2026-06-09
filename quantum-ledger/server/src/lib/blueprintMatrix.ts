const BASE_URL = 'https://api.star-citizen.wiki/api/blueprints';
const CACHE_TTL_MS = 60 * 60 * 1000;

export interface BlueprintMatrixEntry {
  key: string;
  output_name: string;
  item_type: string;
  item_type_label: string;
  craft_time_label: string;
  is_default: boolean;
}

let cache: { entries: BlueprintMatrixEntry[]; fetchedAt: number } | null = null;

function normalize(raw: any): BlueprintMatrixEntry {
  return {
    key: String(raw?.key ?? ''),
    output_name: String(raw?.output_name ?? '').trim(),
    item_type: String(raw?.output?.type ?? 'Unknown'),
    item_type_label: String(raw?.output?.type_label ?? 'Unknown'),
    craft_time_label: String(raw?.craft_time_label ?? ''),
    is_default: raw?.is_available_by_default === true,
  };
}

async function fetchPage(page: number): Promise<{ entries: BlueprintMatrixEntry[]; lastPage: number }> {
  const res = await fetch(`${BASE_URL}?page=${page}&limit=100`);
  if (!res.ok) throw new Error(`Blueprint matrix API responded with HTTP ${res.status}`);
  const body: any = await res.json();
  return {
    entries: Array.isArray(body?.data) ? body.data.map(normalize) : [],
    lastPage: body?.meta?.last_page ?? 1,
  };
}

export async function getBlueprintMatrix(): Promise<BlueprintMatrixEntry[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.entries;
  const first = await fetchPage(1);
  const rest = await Promise.all(
    Array.from({ length: first.lastPage - 1 }, (_, i) => fetchPage(i + 2)),
  );
  const entries = [first.entries, ...rest.map(r => r.entries)].flat();
  cache = { entries, fetchedAt: Date.now() };
  return entries;
}
