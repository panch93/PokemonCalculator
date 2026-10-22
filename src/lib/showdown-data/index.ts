import { resolveByName, toShowdownId } from "./ids";
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
export async function getSpeciesLearnset(name: string): Promise<Set<string> | null> {
  await loadShowdownData();
  return getSpeciesLearnsetMoves(name);
}
export function getMoveNameMap(): Map<string, string> {
  return new Map(getMoveList().map(name => [toShowdownId(name), name] as const));
}
