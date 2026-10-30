import { describe, expect, it, vi } from "vitest";

// battle-order helpers are synchronous; tests provide a deterministic Showdown
// data fixture instead of depending on the app startup network loader.
vi.mock("../src/lib/showdown-data", () => ({
  getSpecies: (name: string) => name === "Pikachu" ? { name: "Pikachu", baseStats: { spe: 90 } } : undefined,
  getNature: (name: string) => name === "Jolly" ? { name: "Jolly", plus: "spe", minus: "spa" } : { name },
  getMove: (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "") === "grassyglide"
    ? { name: "Grassy Glide", priority: 0, category: "Physical", type: "Grass", flags: {} }
    : undefined,
}));
import { getEffectiveMovePriority, getEffectiveSpeed, getWeatherSpeedAbilityMultiplier } from "../src/lib/battle-order";
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

  it("applies Chlorophyll and other weather/terrain speed abilities", () => {
    expect(getWeatherSpeedAbilityMultiplier("Chlorophyll", { weather: "Sun", terrain: "" })).toBe(2);
    expect(getWeatherSpeedAbilityMultiplier("Chlorophyll", { weather: "Rain", terrain: "" })).toBe(1);
    expect(getWeatherSpeedAbilityMultiplier("Swift Swim", { weather: "Rain", terrain: "" })).toBe(2);
    expect(getWeatherSpeedAbilityMultiplier("Surge Surfer", { weather: "", terrain: "Electric" })).toBe(2);
  });

  it("applies Grassy Glide's terrain priority boost", () => {
    expect(getEffectiveMovePriority(base, "Grassy Glide", field)).toBe(0);
    expect(getEffectiveMovePriority(base, "Grassy Glide", { ...field, terrain: "Grassy" })).toBe(1);
  });
});
