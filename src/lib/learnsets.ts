import { getSpeciesLearnset as getLiveSpeciesLearnset, loadShowdownData } from "./showdown-data";

export type LearnsetMap = Record<string, Record<string, unknown>>;

/** Load the live, published Showdown learnset table (shared with the main data adapter). */
export async function loadLearnsets(forceRefresh = false): Promise<LearnsetMap> {
  const data = await loadShowdownData(forceRefresh);
  return Object.fromEntries(Object.entries(data.learnsets).map(([id, entry]) => [
    id,
    entry.learnset ?? entry as Record<string, unknown>,
  ]));
}

/** Format legality is separate from the species-wide learnset source. */
export async function loadFormatLearnsets(_format: string, forceRefresh = false): Promise<LearnsetMap> {
  return loadLearnsets(forceRefresh);
}

export function getLearnsetModeLabel(_format: string): string {
  return "Live species learnset loaded · format legality checked separately";
}

export async function getSpeciesLearnset(species: string, _format = "gen9ou"): Promise<Set<string> | null> {
  return getLiveSpeciesLearnset(species);
}

export function isMoveInLearnset(learnset: Set<string> | null | undefined, move: string): boolean | null {
  if (!move) return true;
  if (!learnset) return null;
  return learnset.has(move.toLowerCase().replace(/[^a-z0-9]/g, ""));
}
