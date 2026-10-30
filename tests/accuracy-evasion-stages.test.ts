import { describe, expect, it } from "vitest";
import { accuracyStageMultiplier } from "../src/lib/calc";

describe("accuracy and evasion stage multipliers", () => {
  it("uses the separate accuracy/evasion stage table", () => {
    expect(accuracyStageMultiplier(0)).toBe(1);
    expect(accuracyStageMultiplier(1)).toBeCloseTo(4 / 3);
    expect(accuracyStageMultiplier(-1)).toBe(0.75);
    expect(accuracyStageMultiplier(6)).toBe(3);
    expect(accuracyStageMultiplier(-6)).toBeCloseTo(1 / 3);
  });
  it("clamps stages outside the supported range", () => {
    expect(accuracyStageMultiplier(99)).toBe(3);
    expect(accuracyStageMultiplier(-99)).toBeCloseTo(1 / 3);
  });
});
