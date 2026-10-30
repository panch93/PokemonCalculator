import type { MoveDetails } from "./types";

export const DRAFT_STRONG_HIT_THRESHOLD = 70;
export const DRAFT_WALL_THRESHOLD = 35;
export type DraftMoveRuleFilter = { minAccuracy: number; minPriority: number; whitelist: string[]; blacklist: string[] };
const moveId = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Structural eligibility: draft analysis evaluates damaging moves only. */
export function isEligibleDraftMove(move: MoveDetails | null | undefined): move is MoveDetails {
  return Boolean(move && ["Physical", "Special"].includes(move.category) && (move.power == null || move.power >= 0));
}

/** User filters; whitelist bypasses accuracy/priority thresholds, while blacklist always wins. */
export function passesDraftMoveFilters(move: MoveDetails, filter: DraftMoveRuleFilter): boolean {
  const id = moveId(move.name);
  if (filter.blacklist.some(name => moveId(name) === id)) return false;
  if (filter.whitelist.some(name => moveId(name) === id)) return true;
  return (move.accuracy ?? 100) >= filter.minAccuracy && move.priority >= filter.minPriority;
}
