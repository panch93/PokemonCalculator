import { Dex } from "@pkmn/dex";

export type LearnsetMap = Record<string, Record<string, unknown>>;
const cleanId = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const LEARNSETS_URL = "https://play.pokemonshowdown.com/data/learnsets.json";
let learnsetsPromise: Promise<LearnsetMap> | null = null;
let resolvedLearnsets: LearnsetMap | null = null;
const formatLearnsetCache = new Map<string, LearnsetMap>();
const formatKey = (format: string) => cleanId(format || "championsnatdexdraft") || "championsnatdexdraft";

function unwrapLearnsets(value: unknown): LearnsetMap {
  if (!value || typeof value !== "object") return {};
  const root = value as Record<string, unknown>;
  const nested = (root.learnsets ?? root.Learnsets ?? root.data ?? root) as Record<string, unknown>;
  const output: LearnsetMap = {};
  for (const [key, raw] of Object.entries(nested || {})) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;
    const learnset = (entry.learnset ?? entry.Learnset ?? entry) as Record<string, unknown>;
    if (learnset && typeof learnset === "object") output[cleanId(key)] = learnset;
  }
  return output;
}

async function fallbackDexLearnsets(): Promise<LearnsetMap> {
  const dex = Dex as unknown as {
    getLearnsets?: () => Promise<unknown>;
    data?: { Learnsets?: unknown; learnsets?: unknown };
  };
  if (typeof dex.getLearnsets === "function") {
    try {
      const loaded = unwrapLearnsets(await dex.getLearnsets());
      if (Object.keys(loaded).length) return loaded;
    } catch { /* Try any eagerly bundled data below. */ }
  }
  return unwrapLearnsets(dex.data?.Learnsets ?? dex.data?.learnsets);
}

/** Load the complete official Pokémon Showdown learnset table once on startup. */
export async function loadLearnsets(forceRefresh = false): Promise<LearnsetMap> {
  if (forceRefresh) {
    resolvedLearnsets = null;
    learnsetsPromise = null;
    formatLearnsetCache.clear();
  }
  if (resolvedLearnsets) return resolvedLearnsets;
  if (!learnsetsPromise) {
    learnsetsPromise = (async () => {
      let table: LearnsetMap = {};
      if (typeof fetch === "function") {
        try {
          const url = forceRefresh ? `${LEARNSETS_URL}?refresh=${Date.now()}` : LEARNSETS_URL;
          const response = await fetch(url, { cache: forceRefresh ? "no-store" : "force-cache" });
          if (!response.ok) throw new Error(`Learnset request failed (${response.status})`);
          table = unwrapLearnsets(await response.json());
          if (!Object.keys(table).length) throw new Error("Learnset response had no species entries");
        } catch (error) {
          table = await fallbackDexLearnsets();
          if (!Object.keys(table).length) throw error;
        }
      } else {
        table = await fallbackDexLearnsets();
      }
      if (!Object.keys(table).length) throw new Error("No learnset data is available");
      resolvedLearnsets = table;
      return table;
    })().catch(error => {
      learnsetsPromise = null;
      throw error;
    });
  }
  return learnsetsPromise;
}

/**
 * Format-scoped cache. Pokémon Showdown publishes the global species learnset as
 * a public data file, but does not expose a generic public REST endpoint that
 * resolves arbitrary custom format rules into per-species legal moves. Until a
 * format's rules are available to validate, keep the full learnset as the safe
 * fallback and cache it separately by selected format. This avoids re-fetching
 * on team edits while allowing format changes to invalidate format-specific UI.
 */
export async function loadFormatLearnsets(format: string, forceRefresh = false): Promise<LearnsetMap> {
  const key = formatKey(format);
  if (forceRefresh) formatLearnsetCache.delete(key);
  const cached = formatLearnsetCache.get(key);
  if (cached && !forceRefresh) return cached;
  const table = await loadLearnsets(forceRefresh);
  formatLearnsetCache.set(key, table);
  return table;
}

export function getLearnsetModeLabel(_format: string): string {
  return "Full species learnset (format-specific bans unavailable)";
}

export async function getSpeciesLearnset(species: string, format = "championsnatdexdraft"): Promise<Set<string> | null> {
  const table = await loadFormatLearnsets(format);
  const key = cleanId(species);
  let entry = table[key];
  if (!entry) {
    try {
      const speciesEntry = Dex.species.get(species) as unknown as { name?: string; baseSpecies?: string; forme?: string };
      entry = table[cleanId(speciesEntry.name || "")] || table[cleanId(speciesEntry.baseSpecies || "")];
    } catch { /* unknown species */ }
  }
  if (!entry) return null;
  return new Set(Object.keys(entry).map(cleanId));
}

export function isMoveInLearnset(learnset: Set<string> | null | undefined, move: string): boolean | null {
  if (!move) return true;
  if (!learnset) return null;
  return learnset.has(cleanId(move));
}
