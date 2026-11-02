import { resolveByName, toShowdownId } from "./ids";
import Dex, { type ModdedDex } from "../showdown-official/sim/dex";
import { getLoadedShowdownData, loadShowdownData, getSpeciesLearnsetMoves, clearShowdownDataCache } from "./client";
import { getNature as getFallbackNature, getNatureList as getFallbackNatureList, getNatureEffectsByDisplayStat as getFallbackNatureEffects } from "./natures";
import type { ShowdownDescribedEntry, ShowdownMove, ShowdownSpecies } from "./types";

export { clearShowdownDataCache, loadShowdownData, toShowdownId };
export type { ShowdownData, ShowdownDescribedEntry, ShowdownMove, ShowdownSpecies, ShowdownLearnsetEntry, ShowdownNature, StatKey } from "./types";

function current() {
  return getLoadedShowdownData();
}

export function getNature(name: string) {
  const data = current();
  return data ? data.natures[toShowdownId(name)] ?? getFallbackNature(name) : getFallbackNature(name);
}
export function getNatureList() {
  const data = current();
  return data ? Object.values(data.natures).map(nature => ({ ...nature })).sort((a, b) => a.name.localeCompare(b.name)) : getFallbackNatureList();
}
export function getNatureEffectsByDisplayStat() {
  const data = current();
  if (!data) return getFallbackNatureEffects();
  const statLabels: Record<string, string> = { atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe" };
  return Object.fromEntries(getNatureList().map(nature => [nature.name, {
    ...(nature.plus ? { plus: statLabels[nature.plus] } : {}),
    ...(nature.minus ? { minus: statLabels[nature.minus] } : {}),
  }]));
}

export function getSpecies(name: string): ShowdownSpecies | undefined {
  const data = current();
  return data ? resolveByName(data.species, name) : undefined;
}
export function getMove(name: string): ShowdownMove | undefined {
  const data = current();
  return data ? resolveByName(data.moves, name) : undefined;
}
export function getItem(name: string): ShowdownDescribedEntry | undefined {
  const data = current();
  return data ? resolveByName(data.items, name) : undefined;
}
export function getAbility(name: string): ShowdownDescribedEntry | undefined {
  const data = current();
  return data ? resolveByName(data.abilities, name) : undefined;
}
function names<T extends { name?: string }>(table: Record<string, T> | undefined): string[] {
  if (!table) return [];
  return [...new Set(Object.values(table).map(entry => entry.name?.trim()).filter((name): name is string => Boolean(name)))].sort((a, b) => a.localeCompare(b));
}
export function getSpeciesList(): string[] { return names(current()?.species); }
export function getMoveList(): string[] { return names(current()?.moves); }
export function getItemList(): string[] { return names(current()?.items); }
export function getAbilityList(): string[] { return names(current()?.abilities); }
export function getAbilityNamesForSpecies(species: ShowdownSpecies | undefined): string[] {
  return [...new Set(Object.values(species?.abilities ?? {}).filter((ability): ability is string => typeof ability === "string" && Boolean(ability.trim())))].sort((a, b) => a.localeCompare(b));
}
export function getSpeciesAbilities(name: string): string[] {
  return getAbilityNamesForSpecies(getSpecies(name));
}

/** Ability list resolved from the bundled official Pokémon Champions mod when generation 10 is selected. */
export function getSpeciesAbilitiesForGeneration(name: string, generation = 9): string[] {
  if (generation < 10) return getSpeciesAbilities(name);
  try {
    const species = Dex.mod("champions").species.get(name) as unknown as { exists?: boolean; abilities?: Record<string, string> };
    if (!species?.exists || !species.abilities) return getSpeciesAbilities(name);
    return [...new Set(Object.values(species.abilities).filter((ability): ability is string => typeof ability === "string" && Boolean(ability.trim())))];
  } catch {
    return getSpeciesAbilities(name);
  }
}

/** Cache full, inherited learnsets by species; these tables are bundled from Showdown. */
const championsLearnsetCache = new Map<string, Set<string> | null>();
const historicalLearnsetCache = new Map<string, Set<string> | null>();

function collectFullLearnset(dex: ModdedDex, name: string): Set<string> | null {
  try {
    const species = dex.species.get(name) as unknown as { exists?: boolean; id?: string };
    if (!species?.exists || !species.id) return null;
    const entries = dex.species.getFullLearnset(species.id as Parameters<typeof dex.species.getFullLearnset>[0]) as Array<{ learnset?: Record<string, unknown> }>;
    const moves = new Set<string>();
    for (const entry of entries) {
      for (const moveId of Object.keys(entry.learnset || {})) {
        const id = toShowdownId(moveId);
        if (id && id !== "inherit") moves.add(id);
      }
    }
    return moves.size ? moves : null;
  } catch {
    // A species may not exist in an older generation's Pokédex.
    return null;
  }
}

/** Learnable moves from the official bundled Pokémon Champions mod, including inherited learnsets. */
export function getChampionsSpeciesLearnset(name: string): Set<string> | null {
  const key = toShowdownId(name);
  if (championsLearnsetCache.has(key)) return championsLearnsetCache.get(key) ?? null;
  const moves = collectFullLearnset(Dex.mod("champions"), name);
  championsLearnsetCache.set(key, moves);
  return moves;
}

/**
 * Everything! is the union of each official generation's *resolved* species learnset
 * plus the Champions mod. Use Showdown's Dex inheritance resolver rather than a
 * generated union of raw tables: raw mod entries can be partial/inherited and are
 * not independently valid learnsets. In particular, this excludes moves that only
 * occur on unrelated species or stale generated snapshots.
 */
export function getHistoricalSpeciesLearnset(name: string): Set<string> | null {
  const key = toShowdownId(name);
  if (!key) return null;
  if (historicalLearnsetCache.has(key)) return historicalLearnsetCache.get(key) ?? null;

  const moves = new Set<string>();
  let found = false;
  const generationDexes = [
    "gen1", "gen1jpn", "gen1stadium",
    "gen2", "gen2stadium2",
    "gen3", "gen3colosseum", "gen3frlg", "gen3rs",
    "gen4", "gen4pt",
    "gen5", "gen5bw1",
    "gen6", "gen6xy",
    "gen7", "gen7letsgo", "gen7sm",
    "gen8", "gen8bdsp", "gen8dlc1", "gen8legends",
    "base", "gen9dlc1", "gen9legends", "gen9predlc",
    "champions",
  ];
  for (const mod of generationDexes) {
    try {
      const dex = Dex.mod(mod);
      const speciesMoves = collectFullLearnset(dex, name);
      if (!speciesMoves) continue;
      found = true;
      for (const move of speciesMoves) moves.add(move);
    } catch {
      // Ignore unavailable species/mod combinations; other generations may contain it.
    }
  }
  const result = found && moves.size ? moves : null;
  historicalLearnsetCache.set(key, result);
  return result;
}

export async function getSpeciesLearnset(name: string): Promise<Set<string> | null> {
  await loadShowdownData();
  return getSpeciesLearnsetMoves(name);
}
export function getMoveNameMap(): Map<string, string> {
  return new Map(getMoveList().map(name => [toShowdownId(name), name] as const));
}
