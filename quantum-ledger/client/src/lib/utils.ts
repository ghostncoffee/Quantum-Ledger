import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmt(n: number | null | undefined, decimals = 0): string {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: decimals });
}

export function fmtCurrency(n: number | null | undefined, currency = 'UEC'): string {
  if (n == null) return '—';
  return `${fmt(n)} ${currency}`;
}

export function fmtDuration(hours: number | null | undefined): string {
  if (hours == null) return '—';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function fmtDatetime(dt: string | null | undefined): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
}

export function profitColor(n: number): string {
  if (n > 0) return 'text-emerald-400';
  if (n < 0) return 'text-red-400';
  return 'text-slate-400';
}

export function findStarCitizenGame(games: any[]) {
  return games.find(g => typeof g.name === 'string' && /star citizen/i.test(g.name)) || games[0];
}

export const RUN_TYPES = ['mining', 'salvage', 'trading', 'hauling', 'crafting', 'contract', 'mixed'] as const;
export type RunType = typeof RUN_TYPES[number];

export const CONTRACT_TYPES = ['combat', 'hauling', 'refueling', 'escort', 'other'] as const;
export const EXPENSE_CATEGORIES = ['fuel', 'repairs', 'equipment', 'investment', 'other'] as const;
export const VEHICLE_TYPES = ['mining', 'trading', 'combat', 'multi', 'other'] as const;
export type VehicleType = typeof VEHICLE_TYPES[number];

export interface ShipMeta {
  type: VehicleType;
  crewMin: number;
  crewMax: number;
  scuCapacity: number;
}

const SHIP_META_BY_CODE: Record<string, ShipMeta> = {
  RSI_Aurora_Mk_II: { type: 'combat', crewMin: 1, crewMax: 1, scuCapacity: 16 },
  ANVL_Carrack: { type: 'multi', crewMin: 4, crewMax: 4, scuCapacity: 90 },
  TMBL_Cyclone: { type: 'other', crewMin: 1, crewMax: 1, scuCapacity: 4 },
  DRAK_Dragonfly_Star_Kitten_Edition: { type: 'other', crewMin: 1, crewMax: 1, scuCapacity: 4 },
  DRAK_Dragonfly_Yellow: { type: 'other', crewMin: 1, crewMax: 1, scuCapacity: 4 },
  ANVL_F7A_Hornet_Mk_II: { type: 'combat', crewMin: 1, crewMax: 1, scuCapacity: 10 },
  MRAI_Fury: { type: 'combat', crewMin: 1, crewMax: 1, scuCapacity: 10 },
  ORIG_G12: { type: 'multi', crewMin: 1, crewMax: 1, scuCapacity: 18 },
  RSI_Galaxy: { type: 'multi', crewMin: 4, crewMax: 4, scuCapacity: 100 },
  KRIG_L_22_Alpha_Wolf: { type: 'combat', crewMin: 1, crewMax: 1, scuCapacity: 12 },
  BANU_Merchantman: { type: 'multi', crewMin: 4, crewMax: 4, scuCapacity: 190 },
  XIAN_Nox_Kue: { type: 'other', crewMin: 1, crewMax: 1, scuCapacity: 2 },
  GRIN_PTV: { type: 'other', crewMin: 1, crewMax: 1, scuCapacity: 8 },
  ANVL_Paladin: { type: 'combat', crewMin: 1, crewMax: 1, scuCapacity: 8 },
  MISC_Prospector: { type: 'mining', crewMin: 1, crewMax: 1, scuCapacity: 12 },
  MRAI_Pulse: { type: 'combat', crewMin: 1, crewMax: 1, scuCapacity: 10 },
  MRAI_Pulse_LX: { type: 'combat', crewMin: 1, crewMax: 1, scuCapacity: 10 },
  GAMA_Railen: { type: 'multi', crewMin: 2, crewMax: 2, scuCapacity: 20 },
  TMBL_Ranger_CV: { type: 'other', crewMin: 1, crewMax: 1, scuCapacity: 4 },
  RSI_Salvation: { type: 'multi', crewMin: 4, crewMax: 4, scuCapacity: 110 },
  GRIN_UTV: { type: 'other', crewMin: 1, crewMax: 2, scuCapacity: 24 },
  RSI_Zeus_Mk_II_ES: { type: 'combat', crewMin: 1, crewMax: 1, scuCapacity: 10 },
};

export function getShipMetaByCode(shipCode: string, shipName?: string): ShipMeta {
  const normalized = shipCode?.trim();
  if (normalized && SHIP_META_BY_CODE[normalized]) {
    return SHIP_META_BY_CODE[normalized];
  }

  const name = shipName?.toLowerCase() ?? '';
  if (/prospector/.test(name)) return { type: 'mining', crewMin: 1, crewMax: 1, scuCapacity: 12 };
  if (/(carrack|galaxy|merchantman|salvation|rail(en)?|reclaimer|constellation|endeavour|g12)/.test(name)) return { type: 'multi', crewMin: 2, crewMax: 4, scuCapacity: 60 };
  if (/(hornet|paladin|fury|zeus|pulse|mcd|tempest|sabre|gladius|vanguard)/.test(name)) return { type: 'combat', crewMin: 1, crewMax: 1, scuCapacity: 10 };
  if (/(mule|utv|dragonfly|cyclone|nox|ptv|ranger)/.test(name)) return { type: 'other', crewMin: 1, crewMax: 2, scuCapacity: 8 };

  return { type: 'other', crewMin: 1, crewMax: 1, scuCapacity: 8 };
}
