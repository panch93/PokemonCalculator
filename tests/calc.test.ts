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

  it("shows Psychic Terrain blocking priority moves against grounded defenders", () => {
    const terrain = { ...field, terrain: "Psychic" };
    const attacker = makeSet("Chien-Pao", "Sword of Ruin", ["Sucker Punch"]);
    const groundedDefender = makeSet("Bulbasaur", "Overgrow", ["Tackle"]);
    const result = calculateMove(attacker, groundedDefender, "Sucker Punch", terrain, undefined, undefined, false, 9);
    expect(result).toMatchObject({ min: 0, max: 0, minPct: 0, maxPct: 0, ko: "No damage" });
    expect(result?.description).toContain("blocked by Psychic Terrain");
  });

  it("does not block priority moves against airborne defenders in Psychic Terrain", () => {
    const terrain = { ...field, terrain: "Psychic" };
    const attacker = makeSet("Chien-Pao", "Sword of Ruin", ["Sucker Punch"]);
    const airborneDefender = makeSet("Tornadus-Therian", "Regenerator", ["Hurricane"]);
    const result = calculateMove(attacker, airborneDefender, "Sucker Punch", terrain, undefined, undefined, false, 9);
    expect(result).not.toBeNull();
    expect(result!.max).toBeGreaterThan(0);
    expect(result!.description).not.toContain("blocked by Psychic Terrain");
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
