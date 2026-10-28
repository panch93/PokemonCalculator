import type { MoveDetails } from "./types";

export const DRAFT_STRONG_HIT_THRESHOLD = 70;
export const DRAFT_WALL_THRESHOLD = 35;

/** Move eligibility rules shared by the draft analysis and its unit tests. */
export function isEligibleDraftMove(move: MoveDetails | null | undefined): move is MoveDetails {
  return Boolean(
    move &&
    ["Physical", "Special"].includes(move.category) &&
    (move.power == null || move.power >= 0) &&
    move.priority >= 0 &&
    (move.accuracy == null || move.accuracy >= 70),
  );
}
