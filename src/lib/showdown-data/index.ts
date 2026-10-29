import { resolveByName, toShowdownId } from "./ids";
import historicalLearnsets from "./historical-learnsets.json";
import Dex from "../showdown-official/sim/dex";
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

/** Learnable moves from the official bundled Pokémon Champions mod, including inherited learnsets. */
export function getChampionsSpeciesLearnset(name: string): Set<string> | null {
  try {
    const dex = Dex.mod("champions");
    const species = dex.species.get(name) as unknown as { exists?: boolean; id?: string };
    if (!species?.exists || !species.id) return null;
    const entries = dex.species.getFullLearnset(species.id as Parameters<typeof dex.species.getFullLearnset>[0]) as Array<{ learnset?: Record<string, unknown> }>;
    const moves = new Set<string>();
    for (const entry of entries) for (const moveId of Object.keys(entry.learnset || {})) moves.add(moveId);
    return moves.size ? moves : null;
  } catch {
    return null;
  }
}
/**
 * Historical Everything! move pool assembled from official Showdown learnset tables
 * across supported generations and the Champions mod. Includes a species' forms
 * and named base/change-from species when Showdown records those relationships.
 */
export function getHistoricalSpeciesLearnset(name: string): Set<string> | null {
  const data = current();
  const species = data ? resolveByName(data.species, name) : undefined;
  const candidates = new Set<string>([toShowdownId(name)]);
  if (species) {
    for (const related of [species.name, species.baseSpecies, species.changesFrom]) {
      if (typeof related === "string" && related.trim()) candidates.add(toShowdownId(related));
    }
  }
  const moves = new Set<string>();
  let found = false;
  for (const candidate of candidates) {
    const table = (historicalLearnsets as Record<string, string[]>)[candidate];
    if (!table) continue;
    found = true;
    for (const move of table) moves.add(move);
  }
  // Keep the current upstream table as a supplement, so newly published moves
  // can be present even before the generated historical bundle is refreshed.
  const currentMoves = getSpeciesLearnsetMoves(name);
  if (currentMoves) {
    found = true;
    for (const move of currentMoves) moves.add(move);
  }
  return found ? moves : null;
}

export async function getSpeciesLearnset(name: string): Promise<Set<string> | null> {
  await loadShowdownData();
  return getSpeciesLearnsetMoves(name);
}
export function getMoveNameMap(): Map<string, string> {
  return new Map(getMoveList().map(name => [toShowdownId(name), name] as const));
}
