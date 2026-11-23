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

export function loadSmogonPresetItemUsage(): Promise<Array<{ item: string; count: number }>> {
  if (itemUsagePromise) return itemUsagePromise;
  itemUsagePromise = Promise.all(SMOGON_PRESET_FORMATS.map(async ([format]) => {
    try {
      const response = await fetch(`https://pkmn.github.io/smogon/data/sets/${format}.json`);
      if (!response.ok) return null;
      return await response.json() as SetDatabase;
    } catch { return null; }
  })).then(databases => {
    const counts = new Map<string, number>();
    for (const database of databases) {
      if (!database) continue;
      for (const sets of Object.values(database)) {
        for (const preset of Object.values(sets || {})) {
          const item = asString(preset.Item ?? preset.item);
          if (item) counts.set(item, (counts.get(item) || 0) + 1);
        }
      }
    }
    const usage = [...counts].map(([item, count]) => ({ item, count })).sort((a, b) => b.count - a.count || a.item.localeCompare(b.item));
    if (!usage.length) itemUsagePromise = null;
    return usage;
  }).catch(error => {
    itemUsagePromise = null;
    throw error;
  });
  return itemUsagePromise;
}


let presetDatabasesPromise: Promise<SetDatabase[]> | null = null;
const presetItemsBySpecies = new Map<string, Promise<string[]>>();

function loadPresetDatabases(): Promise<SetDatabase[]> {
  if (!presetDatabasesPromise) {
    presetDatabasesPromise = Promise.all(SMOGON_PRESET_FORMATS.map(async ([format]) => {
      try {
        const response = await fetch(`https://pkmn.github.io/smogon/data/sets/${format}.json`);
        return response.ok ? await response.json() as SetDatabase : null;
      } catch { return null; }
    })).then(results => results.filter((value): value is SetDatabase => Boolean(value)));
  }
  return presetDatabasesPromise;
}

/** Item candidates are ranked from this species' own Smogon sample-set presets. */
export async function getSmogonPresetItemCandidatesForSpecies(species: string, limit = 8): Promise<string[]> {
  const key = species.toLowerCase().replace(/[^a-z0-9]/g, "");
  let pending = presetItemsBySpecies.get(key);
  if (!pending) {
    pending = loadPresetDatabases().then(databases => {
      const counts = new Map<string, number>();
      for (const database of databases) {
        for (const preset of Object.values(database[key] || {})) {
          const item = asString(preset.Item ?? preset.item);
          if (item) counts.set(item, (counts.get(item) || 0) + 1);
        }
      }
      const usage = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      const selected = usage.slice(0, limit).map(([item]) => item);
      const normalized = new Set(selected.map(item => item.toLowerCase().replace(/[^a-z0-9]/g, "")));
      for (const strategicItem of ["Choice Scarf", "Booster Energy", "White Herb"]) {
        const found = usage.find(([item]) => item.toLowerCase().replace(/[^a-z0-9]/g, "") === strategicItem.toLowerCase().replace(/[^a-z0-9]/g, ""))?.[0];
        if (found && !normalized.has(found.toLowerCase().replace(/[^a-z0-9]/g, ""))) selected.push(found);
      }
      return selected;
    });
    presetItemsBySpecies.set(key, pending);
  }
  return pending;
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
