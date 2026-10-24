import { resolveByName, toShowdownId } from "./ids";
import type { ShowdownLearnsetEntry, ShowdownSpecies } from "./types";

const LEARNSET_METADATA = new Set(["inherit", "eventdata", "encounters", "exists", "species", "name", "id", "learnset", "basespecies", "forme"]);

/**
 * Collect moves for a species and its canonical base/form source. Some Showdown
 * form entries only carry `inherit: true` or a partial learnset.
 */
export function collectSpeciesLearnsetMoves(
  learnsets: Record<string, ShowdownLearnsetEntry>,
  speciesTable: Record<string, ShowdownSpecies>,
  speciesName: string,
): Set<string> | null {
  const candidates = new Set<string>([toShowdownId(speciesName)]);
  const species = resolveByName(speciesTable, speciesName);
  if (species) {
    for (const value of [species.name, species.baseSpecies, species.changesFrom]) {
      if (typeof value === "string" && value) candidates.add(toShowdownId(value));
    }
  }
  const moves = new Set<string>();
  let found = false;
  for (const candidate of candidates) {
    const entry = learnsets[candidate];
    if (!entry) continue;
    found = true;
    const learnset = entry.learnset ?? entry as Record<string, unknown>;
    for (const move of Object.keys(learnset)) {
      const moveId = toShowdownId(move);
      if (moveId && !LEARNSET_METADATA.has(moveId)) moves.add(moveId);
    }
  }
  return found ? moves : null;
}
