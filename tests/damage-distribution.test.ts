import { describe, expect, it } from "vitest";
import { binDamageDistribution, buildDamageDistribution, combineDamageDistributions, getMultiHitProfile, medianDamageOutcome, medianSuccessfulHitCount } from "../src/lib/damage-distribution";

describe("damage probability aggregation", () => {
  it("retains roll multiplicity and includes the miss probability", () => {
    const result = buildDamageDistribution({ damage: [10, 11, 11, 12], moveName: "Tackle", accuracy: 50 });
    expect(result).not.toBeNull();
    expect(result!.outcomes).toEqual([
      { damage: 0, probability: 0.5 },
      { damage: 10, probability: 0.125 },
      { damage: 11, probability: 0.25 },
      { damage: 12, probability: 0.125 },
    ]);
    expect(result!.outcomes.reduce((sum, outcome) => sum + outcome.probability, 0)).toBeCloseTo(1);
  });

  it("convolves per-hit rolls and merges identical totals", () => {
    const result = buildDamageDistribution({ damage: [[10, 11], [20, 21]], moveName: "Double Hit", accuracy: 100 });
    expect(result).not.toBeNull();
    expect(result!.isMultiHit).toBe(true);
    expect(result!.outcomes).toEqual([
      { damage: 30, probability: 0.25 },
      { damage: 31, probability: 0.5 },
      { damage: 32, probability: 0.25 },
    ]);
  });

  it("models successive accuracy checks for Triple Axel without enumerating roll combinations", () => {
    const result = buildDamageDistribution({ damage: [[5, 6], [10, 11], [15, 16]], moveName: "Triple Axel", accuracy: 90 });
    expect(result).not.toBeNull();
    expect(result!.approximate).toBe(true);
    expect(result!.outcomes.find(outcome => outcome.damage === 0)?.probability).toBeCloseTo(0.1);
    expect(result!.outcomes.reduce((sum, outcome) => sum + outcome.probability, 0)).toBeCloseTo(1);
    expect(result!.hitCounts?.find(entry => entry.hits === 1)?.probability).toBeCloseTo(0.09);
    expect(result!.hitCounts?.find(entry => entry.hits === 2)?.probability).toBeCloseTo(0.081);
    expect(result!.hitCounts?.find(entry => entry.hits === 3)?.probability).toBeCloseTo(0.729);
    expect(result!.firstHitMin).toBe(5);
    expect(result!.firstHitMax).toBe(6);
  });

  it("models Population Bomb's ten independent accuracy checks and per-hit damage rolls", () => {
    const result = buildDamageDistribution({
      damage: Array.from({ length: 10 }, () => [10, 11]),
      moveName: "Population Bomb",
      accuracy: 90,
      generation: 9,
    });
    expect(result).not.toBeNull();
    expect(result!.hitCounts?.find(entry => entry.hits === 0)?.probability).toBeCloseTo(0.1);
    expect(result!.hitCounts?.find(entry => entry.hits === 1)?.probability).toBeCloseTo(0.09);
    expect(result!.hitCounts?.find(entry => entry.hits === 2)?.probability).toBeCloseTo(0.081);
    expect(result!.hitCounts?.find(entry => entry.hits === 10)?.probability).toBeCloseTo(Math.pow(0.9, 10));
    expect(result!.outcomes.find(outcome => outcome.damage === 0)?.probability).toBeCloseTo(0.1);
    expect(result!.outcomes.find(outcome => outcome.damage === 10)?.probability).toBeCloseTo(0.045);
    expect(result!.outcomes.find(outcome => outcome.damage === 11)?.probability).toBeCloseTo(0.045);
    expect(result!.outcomes.reduce((sum, outcome) => sum + outcome.probability, 0)).toBeCloseTo(1);
  });

  it("applies accuracy-boosting items and accuracy-bypassing abilities", () => {
    const wideLens = buildDamageDistribution({ damage: [10, 20], moveName: "Population Bomb", accuracy: 90, item: "Wide Lens" });
    const noGuard = buildDamageDistribution({ damage: [10, 20], moveName: "Tackle", accuracy: 70, ability: "No Guard" });
    expect(wideLens?.accuracy).toBeCloseTo(99);
    expect(noGuard?.accuracy).toBe(100);
  });

  it("uses the Gen 9 Loaded Dice hit-count distribution for 2–5-hit moves", () => {
    expect(getMultiHitProfile("Bullet Seed", "Loaded Dice", "", 9)?.hitCounts).toEqual([
      { hits: 4, probability: 0.5 }, { hits: 5, probability: 0.5 },
    ]);
    expect(getMultiHitProfile("Bullet Seed", "", "Skill Link", 9)?.hitCounts).toEqual([{ hits: 5, probability: 1 }]);
    expect(getMultiHitProfile("Water Shuriken", "", "", 9)?.hitCounts).toEqual([{ hits: 3, probability: 1 }]);
  });

  it("combines distributions with probabilities instead of enumerating every sequence", () => {
    const two = combineDamageDistributions(
      [{ damage: 1, probability: 0.5 }, { damage: 2, probability: 0.5 }],
      [{ damage: 1, probability: 0.5 }, { damage: 2, probability: 0.5 }],
    );
    expect(two).toEqual([
      { damage: 2, probability: 0.25 },
      { damage: 3, probability: 0.5 },
      { damage: 4, probability: 0.25 },
    ]);
  });

  it("calculates weighted median damage and successful hit count", () => {
    expect(medianDamageOutcome([
      { damage: 0, probability: 0.1 },
      { damage: 10, probability: 0.2 },
      { damage: 20, probability: 0.7 },
    ])).toBe(20);
    expect(medianSuccessfulHitCount([
      { hits: 0, probability: 0.1 },
      { hits: 1, probability: 0.09 },
      { hits: 2, probability: 0.081 },
      { hits: 3, probability: 0.729 },
    ])).toBe(3);
    expect(medianSuccessfulHitCount([{ hits: 0, probability: 1 }])).toBeNull();
  });

  it("bins a long histogram while preserving total probability", () => {
    const source = Array.from({ length: 100 }, (_, damage) => ({ damage, probability: 0.01 }));
    const binned = binDamageDistribution(source, 20);
    expect(binned.length).toBeLessThanOrEqual(20);
    expect(binned.reduce((sum, outcome) => sum + outcome.probability, 0)).toBeCloseTo(1);
  });
});
