import { unwrapTable, toShowdownId } from "./ids";
import { collectSpeciesLearnsetMoves } from "./learnsets";
import { mergeDescriptions } from "./descriptions";
import type { ShowdownData, ShowdownDescribedEntry, ShowdownLearnsetEntry, ShowdownMove, ShowdownSpecies, ShowdownNature } from "./types";

// Data is bundled from the MIT-licensed smogon/pokemon-showdown repository.
// The app deliberately does not fetch live data from play.pokemonshowdown.com
// or raw.githubusercontent.com at runtime.
import { Pokedex as OfficialPokedex } from "../showdown-official/data/pokedex";
import { Moves as OfficialMoves } from "../showdown-official/data/moves";
import { Learnsets as OfficialLearnsets } from "../showdown-official/data/learnsets";
import { Items as OfficialItems } from "../showdown-official/data/items";
import { Abilities as OfficialAbilities } from "../showdown-official/data/abilities";
import { Natures as OfficialNatures } from "../showdown-official/data/natures";
import { MovesText } from "../showdown-official/data/text/moves";
import { ItemsText } from "../showdown-official/data/text/items";
import { AbilitiesText } from "../showdown-official/data/text/abilities";
import { PokedexText } from "../showdown-official/data/text/pokedex";

type Progress = (percent: number, label: string, detail: string) => void;
let resolved: ShowdownData | null = null;
let pending: Promise<ShowdownData> | null = null;
const progressListeners = new Set<Progress>();

function normalizeNames<T extends { name?: string }>(table: Record<string, T>): Record<string, T> {
  const output: Record<string, T> = {};
  for (const [rawId, entry] of Object.entries(table)) {
    const id = toShowdownId(rawId);
    if (!id || !entry || typeof entry !== "object") continue;
    output[id] = { ...entry, name: entry.name || id };
  }
  return output;
}

function normalizeLearnsets(table: Record<string, unknown>): Record<string, ShowdownLearnsetEntry> {
  const output: Record<string, ShowdownLearnsetEntry> = {};
  for (const [rawId, entry] of Object.entries(table)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const raw = entry as ShowdownLearnsetEntry & Record<string, unknown>;
    const nested = raw.learnset && typeof raw.learnset === "object" ? raw.learnset : undefined;
    output[toShowdownId(rawId)] = { ...raw, ...(nested ? { learnset: nested as Record<string, unknown> } : {}) };
  }
  return output;
}

function natureTable(): Record<string, ShowdownNature> {
  return Object.fromEntries(Object.entries(OfficialNatures as Record<string, ShowdownNature>).map(([id, nature]) => [toShowdownId(id), { ...nature }]));
}

export function clearShowdownDataCache(): void {
  resolved = null;
  pending = null;
  progressListeners.clear();
}

/** Initialize the bundled upstream Showdown data snapshot without network requests. */
export async function loadShowdownData(forceRefresh = false, onProgress?: Progress): Promise<ShowdownData> {
  if (forceRefresh) clearShowdownDataCache();
  if (resolved) {
    onProgress?.(100, "Data ready", "Using the locally bundled Pokémon Showdown snapshot.");
    return resolved;
  }
  if (pending) {
    if (onProgress) progressListeners.add(onProgress);
    return pending;
  }
  if (onProgress) progressListeners.add(onProgress);
  const report = (percent: number, label: string, detail: string) => {
    for (const listener of progressListeners) listener(percent, label, detail);
  };
  pending = (async () => {
    report(8, "Opening bundled data", "No connection to the Pokémon Showdown website is required.");
    await new Promise<void>(resolve => setTimeout(resolve, 0));

    report(28, "Indexing Pokémon", "Preparing species, forms, base stats, types, and abilities.");
    const species = normalizeNames(unwrapTable<ShowdownSpecies>(OfficialPokedex, ["pokedex", "Pokedex", "species", "data"]));
    // Supplement species display names from the official English text table.
    for (const [id, text] of Object.entries(PokedexText as Record<string, { name?: string }>)) {
      if (species[id] && text.name) species[id].name = text.name;
    }
    await new Promise<void>(resolve => setTimeout(resolve, 0));

    report(48, "Indexing moves and items", "Preparing move mechanics and item/ability descriptions.");
    let moves = normalizeNames(unwrapTable<ShowdownMove>(OfficialMoves, ["moves", "Moves", "data"]));
    moves = mergeDescriptions(moves, normalizeNames(MovesText as Record<string, ShowdownDescribedEntry>));
    const items = mergeDescriptions(
      normalizeNames(unwrapTable<ShowdownDescribedEntry>(OfficialItems, ["items", "Items", "data"])),
      normalizeNames(ItemsText as Record<string, ShowdownDescribedEntry>),
    );
    const abilities = mergeDescriptions(
      normalizeNames(unwrapTable<ShowdownDescribedEntry>(OfficialAbilities, ["abilities", "Abilities", "data"])),
      normalizeNames(AbilitiesText as Record<string, ShowdownDescribedEntry>),
    );
    await new Promise<void>(resolve => setTimeout(resolve, 0));

    report(72, "Indexing learnsets", "Preparing the bundled species-to-move tables.");
    const learnsets = normalizeLearnsets(unwrapTable<ShowdownLearnsetEntry>(OfficialLearnsets, ["learnsets", "Learnsets", "data"]));
    const natures = natureTable();
    if (Object.keys(species).length < 1000 || Object.keys(moves).length < 500 || Object.keys(learnsets).length < 500 || Object.keys(items).length < 100 || Object.keys(abilities).length < 100 || Object.keys(natures).length !== 25) {
      throw new Error("The bundled Pokémon Showdown data snapshot failed completeness checks.");
    }
    report(92, "Checking data", "Verifying that species, moves, learnsets, items, abilities, and natures are available.");
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    const data: ShowdownData = { species, moves, items, abilities, natures, learnsets, loadedAt: Date.now() };
    resolved = data;
    report(100, "Ready", "Bundled Pokémon Showdown data is ready.");
    progressListeners.clear();
    return data;
  })().catch(error => {
    pending = null;
    progressListeners.clear();
    throw error;
  });
  return pending;
}

export function getLoadedShowdownData(): ShowdownData | null {
  return resolved;
}

export function getSpeciesLearnsetMoves(speciesName: string): Set<string> | null {
  if (!resolved) return null;
  return collectSpeciesLearnsetMoves(resolved.learnsets, resolved.species, speciesName);
}
