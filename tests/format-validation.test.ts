import { afterEach, describe, expect, it } from "vitest";
import { getAvailableShowdownFormats, resolveShowdownFormat, setRemoteShowdownFormats, validateTeamForFormat } from "../src/lib/format-validation";
import { createFormatValidationFacade } from "../src/lib/format-validation-facade";
import type { TeamValidationProvider } from "../src/lib/team-validation-provider";
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

afterEach(() => setRemoteShowdownFormats([]));

describe("Pokémon Showdown format resolution", () => {
  it("exposes Gen 9 OU in the fallback format list", () => {
    expect(getAvailableShowdownFormats().some(format => format.id === "gen9ou")).toBe(true);
  });

  it.each([
    ["Gen 9 OU", "gen9ou"], ["gen9ou", "gen9ou"],
    ["Gen 8 OU", "gen8ou"], ["gen1ou", "gen1ou"],
    ["gen9championsou", "gen9championsou"], ["gen9championsbssregmb", "gen9championsbssregmb"],
  ])("resolves bundled format %s to canonical ID %s", (input, id) => {
    expect(resolveShowdownFormat(input)).toMatchObject({ supported: true, id });
  });

  it("does not infer a missing mod for remote metadata", () => {
    setRemoteShowdownFormats([{
      id: "gen9futureformat", label: "Future Format", source: "remote",
    }]);
    expect(resolveShowdownFormat("gen9futureformat")).toMatchObject({ supported: false, id: null });
  });

  it("does not silently treat custom draft formats as standard formats", () => {
    const result = resolveShowdownFormat("Champions NatDex Draft");
    expect(result.supported).toBe(false);
    expect(validateTeamForFormat([set()], "Champions NatDex Draft")).toMatchObject({ supported: false, valid: null, issues: [] });
  });

  it("does not infer legality while the official browser validator is unavailable", () => {
    const unavailableProvider: TeamValidationProvider = {
      validateTeam: (_team, format) => ({
        supported: false,
        formatLabel: format.label,
        valid: null,
        issues: [],
        message: "Official browser validator unavailable.",
      }),
    };
    const facade = createFormatValidationFacade(unavailableProvider);
    const legal = facade.validateTeamForFormat([set()], "Gen 9 OU");
    expect(legal).toMatchObject({ supported: false, valid: null, issues: [] });
    const illegal = facade.validateTeamForFormat([set({ moves: ["V-create"] })], "Gen 9 OU");
    expect(illegal).toMatchObject({ supported: false, valid: null, issues: [] });
  });
});
