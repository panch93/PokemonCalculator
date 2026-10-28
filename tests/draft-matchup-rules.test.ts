import { describe, expect, it } from "vitest";
import { DRAFT_STRONG_HIT_THRESHOLD, DRAFT_WALL_THRESHOLD, isEligibleDraftMove } from "../src/lib/draft-matchup-rules";
import type { MoveDetails } from "../src/lib/types";

const move = (overrides: Partial<MoveDetails> = {}): MoveDetails => ({
  name: "Test Move", type: "Normal", category: "Physical", power: 80, accuracy: 100, pp: 15, priority: 0, description: "test", ...overrides,
});

describe("draft matchup move rules", () => {
  it("uses the requested initial thresholds", () => {
    expect(DRAFT_STRONG_HIT_THRESHOLD).toBe(70);
    expect(DRAFT_WALL_THRESHOLD).toBe(35);
  });
  it("accepts damaging moves at the 70% accuracy boundary", () => {
    expect(isEligibleDraftMove(move({ accuracy: 70 }))).toBe(true);
    expect(isEligibleDraftMove(move({ accuracy: 69 }))).toBe(false);
    expect(isEligibleDraftMove(move({ accuracy: null }))).toBe(true);
  });
  it("keeps variable/fixed-damage candidates but rejects status and negative-priority moves", () => {
    expect(isEligibleDraftMove(move({ category: "Status", power: 0 }))).toBe(false);
    expect(isEligibleDraftMove(move({ power: null }))).toBe(true);
    expect(isEligibleDraftMove(move({ power: 0 }))).toBe(true);
    expect(isEligibleDraftMove(move({ priority: -1 }))).toBe(false);
  });
});
