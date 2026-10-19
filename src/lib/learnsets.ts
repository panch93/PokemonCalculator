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
  // Some public data builds wrap the species table one level deeper.
  const speciesTable = ((nested as Record<string, unknown>).pokemon ?? (nested as Record<string, unknown>).species ?? nested) as Record<string, unknown>;
  for (const [key, raw] of Object.entries(speciesTable || {})) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;
    // Formes can be marked `inherit: true` and contain no own moves. Preserve
    // them as empty entries; getSpeciesLearnset will merge their base learnset.
    const learnsetValue = entry.learnset ?? entry.Learnset;
    const learnset = (learnsetValue && typeof learnsetValue === "object")
      ? learnsetValue as Record<string, unknown>
      : entry.inherit === true ? {} : entry;
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
  const candidates = new Set<string>([cleanId(species)]);
  try {
    const speciesEntry = Dex.species.get(species) as unknown as {
      id?: string; name?: string; baseSpecies?: string; forme?: string; changesFrom?: string;
    };
    for (const value of [speciesEntry.id, speciesEntry.name, speciesEntry.baseSpecies, speciesEntry.changesFrom]) {
      if (value) candidates.add(cleanId(value));
    }
  } catch { /* aliases may still resolve directly by their normalized ID */ }

  // Form-specific entries sometimes contain only `inherit: true`, or have a
  // partial learnset. Merge the canonical forme and base species so these
  // Pokémon don't get every move incorrectly marked illegal.
  const moves = new Set<string>();
  let found = false;
  const metadataKeys = new Set(["inherit", "eventdata", "encounters", "exists", "species", "name", "id", "learnset", "basespecies", "forme"]);
  for (const candidate of candidates) {
    const entry = table[candidate];
    if (!entry) continue;
    found = true;
    for (const move of Object.keys(entry)) {
      const moveId = cleanId(move);
      if (moveId && !metadataKeys.has(moveId)) moves.add(moveId);
    }
  }
  return found ? moves : null;
}

export function isMoveInLearnset(learnset: Set<string> | null | undefined, move: string): boolean | null {
  if (!move) return true;
  if (!learnset) return null;
  return learnset.has(cleanId(move));
}
