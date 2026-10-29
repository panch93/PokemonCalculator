import { describe, expect, it } from "vitest";
import { championsStatPointsToCalcEvs } from "../src/lib/draft-matchup-analysis";

describe("draft matchup stat configuration", () => {
  it("maps Champions Stat Points to the equivalent calculator EV term", () => {
    expect(championsStatPointsToCalcEvs(0)).toBe(0);
    expect(championsStatPointsToCalcEvs(1)).toBe(4);
    expect(championsStatPointsToCalcEvs(2)).toBe(12);
    expect(championsStatPointsToCalcEvs(32)).toBe(252);
  });

  it("clamps Champions Stat Points to 0–32", () => {
    expect(championsStatPointsToCalcEvs(-10)).toBe(0);
    expect(championsStatPointsToCalcEvs(100)).toBe(252);
  });
});
