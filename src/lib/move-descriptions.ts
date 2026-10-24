import { getMove } from "./showdown-data";

/** Canonical English move descriptions from the current published Showdown data. */
export function getMoveDescription(name: string): string | undefined {
  const move = getMove(name);
  const description = move?.desc || move?.shortDesc;
  return typeof description === "string" && description.trim() ? description.trim() : undefined;
}
