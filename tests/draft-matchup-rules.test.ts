import { describe, expect, it } from "vitest";
import { DRAFT_STRONG_HIT_THRESHOLD, DRAFT_WALL_THRESHOLD, isEligibleDraftMove, passesDraftMoveFilters } from "../src/lib/draft-matchup-rules";
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
    const filter = { minAccuracy: 70, minPriority: 0, whitelist: [], blacklist: [] };
    expect(passesDraftMoveFilters(move({ accuracy: 70 }), filter)).toBe(true);
    expect(passesDraftMoveFilters(move({ accuracy: 69 }), filter)).toBe(false);
    expect(passesDraftMoveFilters(move({ accuracy: null }), filter)).toBe(true);
  });
  it("keeps variable/fixed-damage candidates but rejects status and negative-priority moves", () => {
    expect(isEligibleDraftMove(move({ category: "Status", power: 0 }))).toBe(false);
    expect(isEligibleDraftMove(move({ power: null }))).toBe(true);
    expect(isEligibleDraftMove(move({ power: 0 }))).toBe(true);
    expect(isEligibleDraftMove(move({ priority: -1 }))).toBe(true);
    const defaults = { minAccuracy: 75, minPriority: 0, whitelist: [], blacklist: [] };
    expect(passesDraftMoveFilters(move({ priority: -1 }), defaults)).toBe(false);
    expect(passesDraftMoveFilters(move({ priority: 1 }), defaults)).toBe(true);
  });
  it("lets whitelist override accuracy and priority, but not blacklist", () => {
    const filter = { minAccuracy: 75, minPriority: 0, whitelist: ["Thunder"], blacklist: [] };
    expect(passesDraftMoveFilters(move({ name: "Thunder", accuracy: 50, priority: -1 }), filter)).toBe(true);
    expect(passesDraftMoveFilters(move({ name: "Thunder", accuracy: 50, priority: -1 }), { ...filter, blacklist: ["thunder"] })).toBe(false);
  });
});
