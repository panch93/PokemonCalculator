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

  it("passes Doubles game type to the calculator for spread-move damage", () => {
    const attacker = makeSet("Garchomp", "Rough Skin", ["Earthquake"]);
    const defender = makeSet("Bulbasaur", "Overgrow", ["Tackle"]);
    const singles = calculateMove(attacker, defender, "Earthquake", field, undefined, undefined, false, 9, false);
    const doubles = calculateMove(attacker, defender, "Earthquake", field, undefined, undefined, false, 9, true);
    expect(singles).not.toBeNull();
    expect(doubles).not.toBeNull();
    expect(doubles!.max).toBeLessThan(singles!.max);
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
