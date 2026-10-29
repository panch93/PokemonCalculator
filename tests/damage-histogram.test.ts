import { describe, expect, it } from "vitest";
import { prepareDamageHistogram, trimDistributionTails } from "../src/lib/damage-histogram";

describe("damage histogram preparation", () => {
  it("trims only cumulative tails below the requested threshold on either side", () => {
    const outcomes = [
      { damage: 0, probability: 0.004 },
      { damage: 10, probability: 0.004 },
      { damage: 20, probability: 0.492 },
      { damage: 30, probability: 0.492 },
      { damage: 40, probability: 0.004 },
      { damage: 50, probability: 0.004 },
    ];
    expect(trimDistributionTails(outcomes, 0.01)).toEqual(outcomes.slice(2, 4));
  });

  it("does not leave a sub-3% cumulative tail visible at either edge", () => {
    const outcomes = [
      { damage: 0, probability: 0.02 },
      { damage: 10, probability: 0.02 },
      { damage: 20, probability: 0.20 },
      { damage: 30, probability: 0.52 },
      { damage: 40, probability: 0.20 },
      { damage: 50, probability: 0.02 },
      { damage: 60, probability: 0.02 },
    ];
    const trimmed = trimDistributionTails(outcomes, 0.03);
    expect(trimmed[0]?.damage).toBe(20);
    expect(trimmed[trimmed.length - 1]?.damage).toBe(40);
    expect(outcomes.slice(0, outcomes.indexOf(trimmed[0])).reduce((sum, item) => sum + item.probability, 0)).toBeGreaterThanOrEqual(0.03);
    expect(outcomes.slice(outcomes.indexOf(trimmed[trimmed.length - 1]) + 1).reduce((sum, item) => sum + item.probability, 0)).toBeGreaterThanOrEqual(0.03);
  });

  it("plots successful-hit damage conditionally and retains rare histogram edges", () => {
    const outcomes = [
      { damage: 0, probability: 0.1 },
      ...Array.from({ length: 20 }, (_, index) => ({ damage: index + 1, probability: 0.045 })),
    ];
    const histogram = prepareDamageHistogram(outcomes, 20, 0.03);
    expect(histogram.length).toBe(20);
    expect(histogram[0]?.damage).toBe(1);
    expect(histogram[histogram.length - 1]?.damage).toBe(20);
    expect(histogram.every(outcome => outcome.damage > 0)).toBe(true);
  });

  it("keeps the fine-bin histogram bounded while preserving the probability mass of plotted bins", () => {
    const outcomes = Array.from({ length: 200 }, (_, damage) => ({ damage, probability: 1 / 200 }));
    const histogram = prepareDamageHistogram(outcomes, 32);
    expect(histogram.length).toBeLessThanOrEqual(32);
    expect(histogram.reduce((sum, outcome) => sum + outcome.probability, 0)).toBeCloseTo(1, 10);
  });
});
