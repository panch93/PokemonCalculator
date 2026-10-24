import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getAvailableShowdownFormats,
  resolveShowdownFormat,
  setRemoteShowdownFormats,
  validateTeamForFormat,
  type ShowdownFormatOption,
} from "../src/lib/format-validation";
import type { PokemonSet, Team } from "../src/lib/types";

/**
 * Contract tests for the validation facade during the browser migration.
 * These describe observable behavior that the Phase 2 replacement must retain.
 * Keep the fixtures deliberately small and avoid testing internal simulator APIs.
 */
function charizard(overrides: Partial<PokemonSet> = {}): PokemonSet {
  return {
    name: "Charizard",
    species: "Charizard",
    item: "Heavy-Duty Boots",
    ability: "Blaze",
    nature: "Timid",
    level: 100,
    evs: { hp: 0, atk: 0, def: 4, spa: 252, spd: 0, spe: 252 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    moves: ["Flamethrower", "Air Slash", "Protect", "Focus Blast"],
    ...overrides,
  };
}

function cloneTeam(team: Team): Team {
  return JSON.parse(JSON.stringify(team)) as Team;
}

beforeEach(() => setRemoteShowdownFormats([]));
afterEach(() => setRemoteShowdownFormats([]));

describe("format validation contract during browser-validator migration", () => {
  it("keeps Everything! as an explicit unrestricted mode at the top of the format list", () => {
    const formats = getAvailableShowdownFormats();
    expect(formats[0]).toMatchObject({ id: "everything", label: "Everything!" });
    expect(resolveShowdownFormat("Everything!")).toMatchObject({ supported: false, id: null, label: "Everything!" });
    expect(validateTeamForFormat([charizard()], "Everything!")).toMatchObject({
      supported: false,
      valid: null,
      issues: [],
    });
  });

  it("resolves a format by canonical ID or display label", () => {
    expect(resolveShowdownFormat("gen9ou")).toMatchObject({ supported: true, id: "gen9ou", label: "[Gen 9] OU" });
    expect(resolveShowdownFormat("Gen 9 OU")).toMatchObject({ supported: true, id: "gen9ou", label: "[Gen 9] OU" });
  });

  it.each(["gen1ou", "gen8ou", "gen9ou", "gen9championsou", "gen9championsbssregmb"])(
    "keeps bundled validator format %s supported at the facade boundary",
    formatId => {
      expect(resolveShowdownFormat(formatId).supported).toBe(true);
    },
  );

  it("does not claim an unknown or remote-only format is validated", () => {
    expect(resolveShowdownFormat("not-a-real-format")).toMatchObject({ supported: false, id: null });

    const remoteOnly: ShowdownFormatOption = {
      id: "gen9examplefutureformat",
      label: "[Gen 9] Example Future Format",
      source: "remote",
      searchShow: false,
    };
    setRemoteShowdownFormats([remoteOnly]);

    expect(getAvailableShowdownFormats().some(format => format.id === remoteOnly.id)).toBe(true);
    expect(resolveShowdownFormat(remoteOnly.id)).toMatchObject({ supported: false, id: null, label: remoteOnly.label });
    expect(validateTeamForFormat([charizard()], remoteOnly.id)).toMatchObject({ supported: false, valid: null, issues: [] });
  });

  it("keeps formats hidden from ladder search discoverable in the picker catalog", () => {
    setRemoteShowdownFormats([{
      id: "gen9hiddencontractformat",
      label: "[Gen 9] Hidden Contract Format",
      source: "remote",
      searchShow: false,
    }]);

    expect(getAvailableShowdownFormats().find(format => format.id === "gen9hiddencontractformat")).toMatchObject({
      label: "[Gen 9] Hidden Contract Format",
      searchShow: false,
    });
  });

  it("uses executable bundled upstream rules rather than treating live metadata as executable code", () => {
    setRemoteShowdownFormats([{
      id: "gen9ou",
      label: "[Gen 9] OU",
      source: "remote",
      ruleset: ["Phase2TestRuleThatDoesNotMatch"],
    }]);

    const resolution = resolveShowdownFormat("gen9ou");
    expect(resolution).toMatchObject({ supported: true, id: "gen9ou" });
    const validation = validateTeamForFormat([charizard()], "gen9ou");
    expect(validation).toMatchObject({ supported: true, valid: true, issues: [] });
    expect(validation.message).toMatch(/bundled upstream data snapshot/i);
  });

  it("uses official TeamValidator to distinguish legal and illegal teams", () => {
    const legal = validateTeamForFormat([charizard()], "gen9ou");
    expect(legal).toMatchObject({ supported: true, valid: true, issues: [] });
    expect(legal.message).toMatch(/official Pokémon Showdown TeamValidator/i);

    const illegal = validateTeamForFormat([charizard({ moves: ["V-create"] })], "gen9ou");
    expect(illegal.supported).toBe(true);
    expect(illegal.valid).toBe(false);
    expect(illegal.issues.length).toBeGreaterThan(0);
  });

  it("does not mutate the caller's team while validating", () => {
    const team = [charizard()];
    const before = cloneTeam(team);

    validateTeamForFormat(team, "gen9ou");

    expect(team).toEqual(before);
  });

  it("does not silently substitute a default format for blank input", () => {
    const result = validateTeamForFormat([charizard()], "   ");
    expect(result).toMatchObject({ supported: false, valid: null, issues: [] });
    expect(result.message).toMatch(/not present|format catalog/i);
  });
});
