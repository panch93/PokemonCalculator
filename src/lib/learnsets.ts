import { Dex } from "@pkmn/dex";

export type LearnsetMap = Record<string, Record<string, unknown>>;
const cleanId = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
let learnsetsPromise: Promise<LearnsetMap> | null = null;
let resolvedLearnsets: LearnsetMap | null = null;

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

/** Loads the bundled @pkmn/dex learnset data lazily (the API is asynchronous). */
export async function loadLearnsets(): Promise<LearnsetMap> {
  if (resolvedLearnsets) return resolvedLearnsets;
  if (!learnsetsPromise) {
    learnsetsPromise = (async () => {
      const dex = Dex as unknown as {
        getLearnsets?: () => Promise<unknown>;
        data?: { Learnsets?: unknown; learnsets?: unknown };
      };
      let result: unknown;
      try {
        if (typeof dex.getLearnsets === "function") result = await dex.getLearnsets();
      } catch {
        // Fall through to a populated data table if this build exposes one.
      }
      if (!result) result = dex.data?.Learnsets ?? dex.data?.learnsets;
      let table = unwrapLearnsets(result);
      if (!Object.keys(table).length && dex.data) table = unwrapLearnsets(dex.data.Learnsets ?? dex.data.learnsets);
      resolvedLearnsets = table;
      return table;
    })();
  }
  return learnsetsPromise;
}

export async function getSpeciesLearnset(species: string): Promise<Set<string> | null> {
  const table = await loadLearnsets();
  const key = cleanId(species);
  let entry = table[key];
  if (!entry) {
    try {
      const speciesEntry = Dex.species.get(species) as unknown as { name?: string; baseSpecies?: string };
      entry = table[cleanId(speciesEntry.name || "")] || table[cleanId(speciesEntry.baseSpecies || "")];
    } catch { /* unknown species */ }
  }
  return entry ? new Set(Object.keys(entry).map(cleanId)) : null;
}

export function isMoveInLearnset(learnset: Set<string> | null | undefined, move: string): boolean | null {
  if (!move) return true;
  if (!learnset) return null;
  return learnset.has(cleanId(move));
}
