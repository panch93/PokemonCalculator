import { describe, expect, it } from "vitest";
import { getEffectiveMovePriority, getEffectiveSpeed } from "../src/lib/battle-order";
import type { FieldState, PokemonSet } from "../src/lib/types";

const field: FieldState = {
  weather: "", terrain: "", defenderStealthRock: false, defenderSpikes: 0, defenderReflect: false,
  defenderLightScreen: false, defenderAuroraVeil: false, defenderLeechSeed: false, defenderSaltCure: false,
  trickRoom: false, tailwindSide: "",
};
const base: PokemonSet = {
  name: "Pikachu", species: "Pikachu", item: "", ability: "Static", nature: "Jolly", level: 100,
  evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 252 },
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, moves: ["Thunderbolt"],
};

describe("battle order helpers", () => {
  it("applies Tailwind to the selected side", () => {
    const normal = getEffectiveSpeed(base, field, "attacker");
    const tailwind = getEffectiveSpeed(base, { ...field, tailwindSide: "attacker" }, "attacker");
    expect(tailwind).toBe(normal * 2);
  });

  it("applies Grassy Glide's terrain priority boost", () => {
    expect(getEffectiveMovePriority(base, "Grassy Glide", field)).toBe(0);
    expect(getEffectiveMovePriority(base, "Grassy Glide", { ...field, terrain: "Grassy" })).toBe(1);
  });
});
