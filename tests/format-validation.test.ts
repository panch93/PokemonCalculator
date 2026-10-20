import { describe, expect, it } from "vitest";
import { getAvailableShowdownFormats, resolveShowdownFormat, validateTeamForFormat } from "../src/lib/format-validation";
import type { PokemonSet } from "../src/lib/types";

function set(overrides: Partial<PokemonSet> = {}): PokemonSet {
  return {
    name: "Charizard", species: "Charizard", item: "Heavy-Duty Boots", ability: "Blaze", nature: "Timid", level: 100,
    evs: { hp: 0, atk: 0, def: 4, spa: 252, spd: 0, spe: 252 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    moves: ["Flamethrower", "Air Slash", "Roost", "Focus Blast"],
    ...overrides,
  };
}

describe("Pokémon Showdown format resolution", () => {
  it("exposes Gen 9 OU when it exists in the bundled Showdown data", () => {
    expect(getAvailableShowdownFormats().some(format => format.id === "gen9ou")).toBe(true);
  });

  it("resolves display names and canonical IDs", () => {
    expect(resolveShowdownFormat("Gen 9 OU")).toMatchObject({ supported: true, id: "gen9ou" });
    expect(resolveShowdownFormat("gen9ou")).toMatchObject({ supported: true, id: "gen9ou" });
  });

  it("does not silently treat custom draft formats as standard formats", () => {
    const result = resolveShowdownFormat("Champions NatDex Draft");
    expect(result.supported).toBe(false);
    expect(validateTeamForFormat([set()], "Champions NatDex Draft")).toMatchObject({ supported: false, valid: null, issues: [] });
  });

  it("uses the selected Showdown validator for team legality", () => {
    const legal = validateTeamForFormat([set()], "Gen 9 OU");
    expect(legal.supported).toBe(true);
    expect(legal.valid).toBe(true);
    const illegal = validateTeamForFormat([set({ moves: ["V-create"] })], "Gen 9 OU");
    expect(illegal.supported).toBe(true);
    expect(illegal.valid).toBe(false);
    expect(illegal.issues.length).toBeGreaterThan(0);
  });
});
