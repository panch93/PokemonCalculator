import { describe, expect, it } from "vitest";
import { getAvailableShowdownFormats, resolveShowdownFormat, setRemoteShowdownFormats, validateTeamForFormat } from "../src/lib/format-validation";
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
  it("exposes bundled formats as a fallback", () => {
    expect(getAvailableShowdownFormats().some(format => format.id === "gen9ou")).toBe(true);
  });

  it("resolves display names and canonical IDs", () => {
    expect(resolveShowdownFormat("Gen 9 OU")).toMatchObject({ supported: true, id: "gen9ou" });
    expect(resolveShowdownFormat("gen9ou")).toMatchObject({ supported: true, id: "gen9ou" });
  });

  it("provides an explicit Everything! analysis mode without claiming legality", () => {
    expect(resolveShowdownFormat("Everything!")).toMatchObject({ supported: false, label: "Everything!" });
    expect(validateTeamForFormat([set()], "everything")).toMatchObject({ supported: false, valid: null, issues: [] });
  });

  it("does not silently validate formats missing from the installed simulator", () => {
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


describe("live formats versus executable validator rules", () => {
  it("keeps remote-only formats searchable without pretending the installed simulator can validate them", () => {
    setRemoteShowdownFormats([{ label: "Example Community Draft", id: "gen9examplecommunitydraft", section: "Draft", source: "remote" }]);
    expect(getAvailableShowdownFormats().some(format => format.id === "gen9examplecommunitydraft")).toBe(true);
    expect(resolveShowdownFormat("gen9examplecommunitydraft")).toMatchObject({ supported: false, id: null });
  });
});
