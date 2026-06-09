const SHIP_MATRIX_URL = 'https://api.star-citizen.wiki/api/shipmatrix/vehicles';
const CACHE_TTL_MS = 60 * 60 * 1000;

export interface ShipMatrixEntry {
  name: string;
  slug: string;
  foci: string[];
  cargo: number;
  crewMin: number | null;
  crewMax: number | null;
}

let cache: { entries: ShipMatrixEntry[]; fetchedAt: number } | null = null;

function normalizeShip(raw: any): ShipMatrixEntry {
  return {
    name: String(raw?.name ?? '').trim(),
    slug: String(raw?.slug ?? ''),
    foci: Array.isArray(raw?.foci)
      ? raw.foci.map((f: any) => f?.en_EN).filter((v: unknown): v is string => Boolean(v))
      : [],
    cargo: Number(raw?.cargo_capacity ?? 0),
    crewMin: raw?.crew?.min ?? null,
    crewMax: raw?.crew?.max ?? null,
  };
}

async function fetchPage(page: number): Promise<{ entries: ShipMatrixEntry[]; lastPage: number }> {
  const res = await fetch(`${SHIP_MATRIX_URL}?page[number]=${page}`);
  if (!res.ok) throw new Error(`Ship matrix API responded with HTTP ${res.status}`);
  const body: any = await res.json();
  const entries = Array.isArray(body?.data) ? body.data.map(normalizeShip) : [];
  return { entries, lastPage: Number(body?.meta?.last_page ?? 1) };
}

/** Fetches every page from the upstream ship matrix API and caches the merged result for an hour. */
export async function getShipMatrix(): Promise<ShipMatrixEntry[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.entries;
  }

  const first = await fetchPage(1);
  const rest = await Promise.all(
    Array.from({ length: first.lastPage - 1 }, (_, i) => fetchPage(i + 2)),
  );
  const entries = [first.entries, ...rest.map(r => r.entries)].flat();

  cache = { entries, fetchedAt: Date.now() };
  return entries;
}
