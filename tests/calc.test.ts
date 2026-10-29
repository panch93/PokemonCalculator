import { describe, expect, it } from "vitest";
import { calculateMove, getMoveDetails, koLabel } from "../src/lib/calc";
import type { FieldState, PokemonSet } from "../src/lib/types";

const field: FieldState = {
  weather: "", terrain: "", defenderStealthRock: false, defenderSpikes: 0, defenderReflect: false,
  defenderLightScreen: false, defenderAuroraVeil: false, defenderLeechSeed: false, defenderSaltCure: false,
  trickRoom: false, tailwindSide: "",
};
const makeSet = (species: string, ability: string, moves: string[]): PokemonSet => ({
  name: species, species, item: "", ability, nature: "Modest", level: 100,
  evs: { hp: 0, atk: 0, def: 0, spa: 252, spd: 4, spe: 252 },
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, moves,
});

describe("damage calculator wrappers", () => {
  it("returns a finite damage range for a known move matchup", () => {
    const result = calculateMove(makeSet("Charizard", "Blaze", ["Flamethrower"]), makeSet("Bulbasaur", "Overgrow", ["Tackle"]), "Flamethrower", field, undefined, undefined, false, 9);
    expect(result).not.toBeNull();
    expect(Number.isFinite(result!.min)).toBe(true);
    expect(Number.isFinite(result!.max)).toBe(true);
    expect(result!.max).toBeGreaterThanOrEqual(result!.min);
  });

  it("exposes a probability histogram for ordinary damage rolls", () => {
    const attacker = makeSet("Charizard", "Blaze", ["Flamethrower"]);
    const defender = makeSet("Bulbasaur", "Overgrow", ["Tackle"]);
    const result = calculateMove(attacker, defender, "Flamethrower", field, undefined, undefined, false, 9);
    expect(result?.histogram?.length).toBeGreaterThan(0);
    expect(result!.histogram!.reduce((sum, outcome) => sum + outcome.probability, 0)).toBeCloseTo(1);
    expect(result?.distributionApproximate).toBe(false);
  });

  it("includes possible early stops in multi-hit damage distributions", () => {
    const attacker = makeSet("Weavile", "Pressure", ["Triple Axel"]);
    const defender = makeSet("Bulbasaur", "Overgrow", ["Tackle"]);
    const result = calculateMove(attacker, defender, "Triple Axel", field, undefined, undefined, false, 9, false);
    expect(result?.histogram?.length).toBeGreaterThan(0);
    // Triple Axel's 90% accuracy must come from the bundled move data, not
    // the @smogon/calc Move class's narrower TypeScript surface.
    expect(result?.accuracy).toBe(90);
    expect(result?.maxHp).toBeGreaterThan(0);
    expect(result?.medianDamage).toBeGreaterThan(0);
    expect(result?.firstHitMinPct).toBeGreaterThan(0);
    expect(result?.firstHitMaxPct).toBeGreaterThanOrEqual(result!.firstHitMinPct!);
    expect(result?.firstHitMaxPct).toBeLessThan(result!.maxPct);
    expect(result?.ko).toContain("Median");
    expect(result?.hitCounts?.some(outcome => outcome.hits === 1)).toBe(true);
    expect(result?.hitCounts?.some(outcome => outcome.hits === 3)).toBe(true);
    expect(result!.histogram!.reduce((sum, outcome) => sum + outcome.probability, 0)).toBeCloseTo(1);
  });

  it("applies configured offensive and defensive stat stages to damage", () => {
    const attacker = makeSet("Charizard", "Blaze", ["Flamethrower"]);
    const defender = makeSet("Bulbasaur", "Overgrow", ["Tackle"]);
    const neutralStages = { atk: 0, spa: 0, def: 0, spd: 0, spe: 0 };
    const boostedAttack = calculateMove(attacker, defender, "Flamethrower", field, { ...neutralStages, spa: 2 }, neutralStages, false, 9, false);
    const boostedDefense = calculateMove(attacker, defender, "Flamethrower", field, neutralStages, { ...neutralStages, spd: 2 }, false, 9, false);
    const neutral = calculateMove(attacker, defender, "Flamethrower", field, neutralStages, neutralStages, false, 9, false);
    expect(boostedAttack?.max).toBeGreaterThan(neutral!.max);
    expect(boostedDefense?.max).toBeLessThan(neutral!.max);
  });

  it("shows Psychic Terrain blocking priority moves against grounded defenders", () => {
    const terrain: FieldState = { ...field, terrain: "Psychic" };
    const attacker = makeSet("Chien-Pao", "Sword of Ruin", ["Sucker Punch"]);
    const groundedDefender = makeSet("Bulbasaur", "Overgrow", ["Tackle"]);
    const result = calculateMove(attacker, groundedDefender, "Sucker Punch", terrain, undefined, undefined, false, 9);
    expect(result).toMatchObject({ min: 0, max: 0, minPct: 0, maxPct: 0, ko: "No damage" });
    expect(result?.description).toContain("blocked by Psychic Terrain");
  });

  it("does not block priority moves against airborne defenders in Psychic Terrain", () => {
    const terrain: FieldState = { ...field, terrain: "Psychic" };
    const attacker = makeSet("Chien-Pao", "Sword of Ruin", ["Sucker Punch"]);
    const airborneDefender = makeSet("Tornadus-Therian", "Regenerator", ["Hurricane"]);
    const result = calculateMove(attacker, airborneDefender, "Sucker Punch", terrain, undefined, undefined, false, 9);
    expect(result).not.toBeNull();
    expect(result!.max).toBeGreaterThan(0);
    expect(result!.description).not.toContain("blocked by Psychic Terrain");
  });


  it("uses the Doubles spread modifier for moves that hit multiple adjacent targets", () => {
    const attacker = makeSet("Garchomp", "Rough Skin", ["Earthquake"]);
    const defender = makeSet("Bulbasaur", "Overgrow", ["Flamethrower"]);
    const singles = calculateMove(attacker, defender, "Earthquake", { ...field, gameType: "Singles" }, undefined, undefined, false, 9);
    const doubles = calculateMove(attacker, defender, "Earthquake", { ...field, gameType: "Doubles" }, undefined, undefined, false, 9);
    expect(singles).not.toBeNull();
    expect(doubles).not.toBeNull();
    expect(doubles!.max).toBeLessThan(singles!.max);
  });

  it("uses canonical accuracy metadata across common move types", () => {
    // These cover ordinary 100%-accuracy moves, common imperfect-accuracy
    // moves, and multi-hit moves. The values must come from move data rather
    // than @smogon/calc's normalized Move object's default accuracy.
    expect(getMoveDetails("Flamethrower", 9)?.accuracy).toBe(100);
    expect(getMoveDetails("Hydro Pump", 9)?.accuracy).toBe(80);
    expect(getMoveDetails("Thunder", 9)?.accuracy).toBe(70);
    expect(getMoveDetails("Hurricane", 9)?.accuracy).toBe(70);
    expect(getMoveDetails("Population Bomb", 9)?.accuracy).toBe(90);
    expect(getMoveDetails("Triple Axel", 9)?.accuracy).toBe(90);
  });

  it("uses native Champions mechanics and official move metadata when generation 10 is selected", () => {
    expect(getMoveDetails("Anchor Shot", 9)?.power).toBe(80);
    expect(getMoveDetails("Anchor Shot", 10)?.power).toBe(90);
    expect(getMoveDetails("Anchor Shot", 10)?.accuracy).toBe(100);
    const result = calculateMove(
      makeSet("Pikachu", "Static", ["Anchor Shot"]),
      makeSet("Snorlax", "Immunity", ["Tackle"]),
      "Anchor Shot",
      field,
      undefined,
      undefined,
      false,
      10,
      false,
    );
    expect(result).not.toBeNull();
    // Gen 10's calc generation is a mechanics adapter (num 0), not a usable
    // species-stat generation. Ensure Pokémon stats are built from the supported
    // baseline while the actual damage call still dispatches to Champions.
    expect(result?.maxHp).toBeGreaterThan(0);
    expect(result?.max).toBeGreaterThan(0);
    expect(result?.min).toBeGreaterThan(0);
    expect(result?.max).toBeGreaterThanOrEqual(result?.min ?? Infinity);
  });

  it("exposes spread target metadata for matrix indicators", () => {
    expect(getMoveDetails("Earthquake", 9)?.target).toBe("allAdjacent");
    expect(getMoveDetails("Surf", 9)?.target).toBe("allAdjacent");
  });

  it("calculates critical marker range with a separate @smogon/calc run", () => {
    const attacker = makeSet("Charizard", "Blaze", ["Flamethrower"]);
    const defender = makeSet("Bulbasaur", "Overgrow", ["Tackle"]);
    const fieldWithScreen = { ...field, defenderLightScreen: true };
    const attackerStages = { atk: -2, spa: -2, def: 0, spd: 0, spe: 0 };
    const defenderStages = { atk: 0, spa: 0, def: 2, spd: 0, spe: 0 };

    const ordinary = calculateMove(attacker, defender, "Flamethrower", fieldWithScreen, attackerStages, defenderStages, false, 9);
    const explicitlyCritical = calculateMove(attacker, defender, "Flamethrower", fieldWithScreen, attackerStages, defenderStages, true, 9);

    expect(ordinary).not.toBeNull();
    expect(explicitlyCritical).not.toBeNull();
    expect(ordinary!.critMinPct).toBeCloseTo(explicitlyCritical!.minPct, 8);
    expect(ordinary!.critMaxPct).toBeCloseTo(explicitlyCritical!.maxPct, 8);
  });

  it("returns move metadata and a description for common moves", () => {
    expect(getMoveDetails("Earthquake", 9)).toMatchObject({ name: "Earthquake", type: "Ground", category: "Physical", power: 100 });
  });

  it("labels damage and KO ranges consistently", () => {
    expect(koLabel(0, 0)).toBe("No damage");
    expect(koLabel(100, 100)).toBe("1HKO");
    expect(koLabel(20, 30)).toBe("Possible 4HKO · 4HKO+");
  });
});
