/**
 * Item usage is derived from the same public Smogon preset JSON used by the
 * Draft Matchups set importer. Each set contributes one occurrence of its
 * held item. Unsupported/retired formats are skipped without failing analysis.
 */
export const SMOGON_PRESET_FORMATS = [
  ...Array.from({ length: 9 }, (_, index) => [`gen${index + 1}ou`, `Gen ${index + 1} OU`] as const),
  ...([2, 3, 4, 5, 6, 7, 8, 9] as const).flatMap(generation =>
    (["ubers", "uu", "ru", "nu", "pu", "monotype", "doublesou", "lc"] as const).map(tier =>
      [`gen${generation}${tier}`, `Gen ${generation} ${tier.toUpperCase()}`] as const)),
] as const;

type RawSet = Record<string, unknown>;
type SetDatabase = Record<string, Record<string, RawSet>>;
const asString = (value: unknown): string => Array.isArray(value) ? asString(value[0]) : typeof value === "string" ? value.trim() : "";
let itemUsagePromise: Promise<Array<{ item: string; count: number }>> | null = null;
let presetDatabasesPromise: Promise<SetDatabase[]> | null = null;
function loadPresetDatabases(): Promise<SetDatabase[]> {
  if (!presetDatabasesPromise) {
    presetDatabasesPromise = Promise.all(SMOGON_PRESET_FORMATS.map(async ([format]) => {
      try { const response = await fetch(`https://pkmn.github.io/smogon/data/sets/${format}.json`); return response.ok ? await response.json() as SetDatabase : null; }
      catch { return null; }
    })).then(values => values.filter((value): value is SetDatabase => Boolean(value)));
  }
  return presetDatabasesPromise;
}

export function loadSmogonPresetItemUsage(): Promise<Array<{ item: string; count: number }>> {
  if (itemUsagePromise) return itemUsagePromise;
  itemUsagePromise = loadPresetDatabases().then(databases => {
    const counts = new Map<string, number>();
    for (const database of databases) for (const sets of Object.values(database)) for (const preset of Object.values(sets || {})) {
      const item = asString(preset.Item ?? preset.item); if (item) counts.set(item, (counts.get(item) || 0) + 1);
    }
    const usage = [...counts].map(([item, count]) => ({ item, count })).sort((a, b) => b.count - a.count || a.item.localeCompare(b.item));
    if (!usage.length) itemUsagePromise = null;
    return usage;
  }).catch(error => { itemUsagePromise = null; throw error; });
  return itemUsagePromise;
}

/** Common preset items plus speed-specific items even when their global count is lower. */
export async function getSmogonPresetItemCandidates(limit = 8): Promise<string[]> {
  const usage = await loadSmogonPresetItemUsage();
  const byName = new Map(usage.map(entry => [entry.item.toLowerCase().replace(/[^a-z0-9]/g, ""), entry.item]));
  const selected = usage.slice(0, limit).map(entry => entry.item);
  for (const strategicItem of ["Choice Scarf", "Booster Energy", "White Herb"]) {
    const found = byName.get(strategicItem.toLowerCase().replace(/[^a-z0-9]/g, ""));
    if (found && !selected.some(item => item.toLowerCase() === found.toLowerCase())) selected.push(found);
  }
  return selected;
}

/** Item candidates drawn only from this species' own Smogon preset sets. */
export async function getSmogonPresetItemCandidatesForSpecies(species: string, limit = 8): Promise<string[]> {
  const wanted = species.toLowerCase().replace(/[^a-z0-9]/g, "");
  const counts = new Map<string, number>();
  const databases = await loadPresetDatabases();
  for (const database of databases) for (const [speciesName, sets] of Object.entries(database)) {
    if (speciesName.toLowerCase().replace(/[^a-z0-9]/g, "") !== wanted) continue;
    for (const preset of Object.values(sets || {})) { const item = asString(preset.Item ?? preset.item); if (item) counts.set(item, (counts.get(item) || 0) + 1); }
  }
  const byName = new Map([...counts.keys()].map(item => [item.toLowerCase().replace(/[^a-z0-9]/g, ""), item]));
  const selected = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([item]) => item);
  for (const strategic of ["Choice Scarf", "Booster Energy", "White Herb"]) { const found = byName.get(strategic.toLowerCase().replace(/[^a-z0-9]/g, "")); if (found && !selected.some(item => item.toLowerCase() === found.toLowerCase())) selected.push(found); }
  return selected;
}
