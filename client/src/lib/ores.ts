/**
 * Canonical Star Citizen ore / mineral names.
 * Used for <datalist> autocomplete on material inputs to prevent
 * casing typos like "Corundum (raw)" vs "Corundum (Raw)".
 */
export const SC_ORES: readonly string[] = [
  // Refined / processed outputs
  'Agricium',
  'Aluminum',
  'Beryl',
  'Bexalite',
  'Borase',
  'Carterite',
  'Corundum',
  'Diamond',
  'Gold',
  'Hephaestanite',
  'Ice',
  'Inertite',
  'Iron',
  'Janalite',
  'Laranite',
  'Quantainium',
  'Quartz',
  'Regalite',
  'Taranite',
  'Titanium',
  'Titanite',
  'Torite',
  'Tungsten',
  'Uzonite',
  // Common raw-ore naming variants
  'Aluminum (ore)',
  'Corundum (Raw)',
  'Hephaestanite (ore)',
  'Iron (ore)',
  'Titanite (ore)',
];

/**
 * Merge SC_ORES with names already present in the user's data,
 * deduplicating case-insensitively (canonical / earlier entry wins).
 */
export function mergeOreNames(existing: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of [...SC_ORES, ...existing]) {
    const key = name.trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      result.push(name.trim());
    }
  }
  return result;
}
