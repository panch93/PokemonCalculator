import { describe, expect, it } from "vitest";
import { toShowdownSet } from "../src/lib/team-validation-provider";
import type { PokemonSet } from "../src/lib/types";

const pokemon: PokemonSet = {
  name: "Pikachu", species: "Pikachu", item: "", ability: "Static", nature: "Hardy", level: 100,
  evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  ivs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, moves: ["Thunderbolt"],
};

describe("team validation IV defaults", () => {
  it("always validates with 31 IVs in every stat", () => {
    expect(toShowdownSet(pokemon).ivs).toEqual({ hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 });
  });
});
