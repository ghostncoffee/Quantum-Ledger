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

export const RUN_TYPES = ['mining', 'trading', 'hauling', 'crafting', 'contract', 'mixed'] as const;
export type RunType = typeof RUN_TYPES[number];

export const CONTRACT_TYPES = ['combat', 'hauling', 'refueling', 'escort', 'other'] as const;
export const EXPENSE_CATEGORIES = ['fuel', 'repairs', 'equipment', 'investment', 'other'] as const;
export const VEHICLE_TYPES = ['mining', 'trading', 'combat', 'multi', 'other'] as const;
