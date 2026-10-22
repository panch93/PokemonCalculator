import { unwrapTable } from "./ids";
import { collectSpeciesLearnsetMoves } from "./learnsets";
import { parseOfficialNatureSource } from "./natures";
import { mergeDescriptions, parseDescriptionTable } from "./descriptions";
import type { ShowdownData, ShowdownDescribedEntry, ShowdownLearnsetEntry, ShowdownMove, ShowdownSpecies } from "./types";

const DATA_ROOT = "https://play.pokemonshowdown.com/data";
type ExportWindow = Window & { exports?: Record<string, unknown> };
let resolved: ShowdownData | null = null;
let pending: Promise<ShowdownData> | null = null;

async function fetchFreshJson(url: string): Promise<unknown> {
  const response = await fetch(`${url}?ptl_refresh=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Pokémon Showdown data request failed (${response.status}): ${url}`);
  return response.json() as Promise<unknown>;
}

async function fetchFreshText(url: string): Promise<string> {
  const response = await fetch(`${url}?ptl_refresh=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Pokémon Showdown source request failed (${response.status}): ${url}`);
  return response.text();
}

/** Load an official Showdown browser data file and read its exported table. */
function loadPublishedScriptTable(exportName: "BattleItems" | "BattleAbilities" | "BattleMovedex"): Promise<Record<string, ShowdownDescribedEntry>> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("Pokémon Showdown browser data can only be loaded in a browser"));
  }
  return new Promise((resolve, reject) => {
    const target = window as ExportWindow;
    const previousExports = target.exports;
    const isolatedExports: Record<string, unknown> = {};
    const script = document.createElement("script");
    let settled = false;
    const restore = () => {
      if (target.exports === isolatedExports) {
        if (previousExports === undefined) delete target.exports;
        else target.exports = previousExports;
      }
      script.remove();
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      restore();
      reject(error);
    };
    target.exports = isolatedExports;
    script.async = true;
    const filename = exportName === "BattleItems" ? "items" : exportName === "BattleAbilities" ? "abilities" : "moves";
    script.src = `${DATA_ROOT}/${filename}.js?ptl_refresh=${Date.now()}`;
    script.onload = () => {
      if (settled) return;
      settled = true;
      const raw = isolatedExports[exportName];
      restore();
      const table = unwrapTable<ShowdownDescribedEntry>(raw);
      if (!Object.keys(table).length) {
        reject(new Error(`Official Pokémon Showdown file did not export ${exportName}`));
        return;
      }
      resolve(table);
    };
    script.onerror = () => fail(new Error(`Unable to load official Pokémon Showdown ${exportName} data`));
    document.head.appendChild(script);
  });
}

function unwrapLearnsets(value: unknown): Record<string, ShowdownLearnsetEntry> {
  const table = unwrapTable<ShowdownLearnsetEntry>(value, ["learnsets", "Learnsets", "data", "pokemon", "species"]);
  const output: Record<string, ShowdownLearnsetEntry> = {};
  for (const [key, entry] of Object.entries(table)) {
    const raw = entry as ShowdownLearnsetEntry & Record<string, unknown>;
    const nested = raw.learnset && typeof raw.learnset === "object" ? raw.learnset : undefined;
    output[key] = { ...raw, ...(nested ? { learnset: nested as Record<string, unknown> } : {}) };
  }
  return output;
}

export function clearShowdownDataCache(): void {
  resolved = null;
  pending = null;
}

/** Fetch current published Pokémon Showdown data on app startup; never use a bundled Dex fallback. */
export async function loadShowdownData(forceRefresh = false): Promise<ShowdownData> {
  if (forceRefresh) clearShowdownDataCache();
  if (resolved) return resolved;
  if (pending) return pending;
  pending = (async () => {
    const [speciesRaw, movesRaw, learnsetsRaw, naturesSource, movesTextSource, itemsTextSource, abilitiesTextSource] = await Promise.all([
      fetchFreshJson(`${DATA_ROOT}/pokedex.json`),
      fetchFreshJson(`${DATA_ROOT}/moves.json`),
      fetchFreshJson(`${DATA_ROOT}/learnsets.json`),
      fetchFreshText("https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/natures.ts"),
      fetchFreshText("https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/text/moves.ts"),
      fetchFreshText("https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/text/items.ts"),
      fetchFreshText("https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/text/abilities.ts"),
    ]);
    // These legacy browser data scripts export through window.exports, so load
    // them serially to avoid one script observing the other's temporary export.
    const moveDescriptions = await loadPublishedScriptTable("BattleMovedex");
    const species = unwrapTable<ShowdownSpecies>(speciesRaw, ["pokedex", "Pokedex", "species", "data"]);
    let moves = unwrapTable<ShowdownMove>(movesRaw, ["moves", "Moves", "data"]);
    const itemMechanics = await loadPublishedScriptTable("BattleItems");
    const abilityMechanics = await loadPublishedScriptTable("BattleAbilities");
    // Battle data and text descriptions are maintained separately upstream.
    // Use the official text tables as the authoritative description source;
    // the client data scripts supplement any entries they contain.
    moves = mergeDescriptions(moves, parseDescriptionTable(movesTextSource));
    moves = mergeDescriptions(moves, moveDescriptions);
    const itemDescriptions = parseDescriptionTable(itemsTextSource);
    const abilityDescriptions = parseDescriptionTable(abilitiesTextSource);
    const items = mergeDescriptions(itemMechanics, itemDescriptions);
    const abilities = mergeDescriptions(abilityMechanics, abilityDescriptions);
    if (Object.keys(parseDescriptionTable(movesTextSource)).length < 500 || Object.keys(itemDescriptions).length < 100 || Object.keys(abilityDescriptions).length < 100) {
      throw new Error("Official Pokémon Showdown description tables were incomplete; refusing to load without move, item, and ability descriptions");
    }
    const learnsets = unwrapLearnsets(learnsetsRaw);
    const natures = parseOfficialNatureSource(naturesSource);
    if (!Object.keys(species).length || !Object.keys(moves).length || !Object.keys(learnsets).length) {
      throw new Error("Official Pokémon Showdown data was incomplete; refusing to use partial tables");
    }
    // Normalize keys and ensure a usable display name even if an upstream build changes wrappers.
    for (const [id, entry] of Object.entries(species)) if (!entry.name) entry.name = id;
    for (const [id, entry] of Object.entries(moves)) if (!entry.name) entry.name = id;
    const data: ShowdownData = { species, moves, items, abilities, natures, learnsets, loadedAt: Date.now() };
    resolved = data;
    return data;
  })().catch(error => {
    pending = null;
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
