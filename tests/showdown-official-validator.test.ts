import { describe, expect, it } from "vitest";
import { validateWithOfficialTeamValidator } from "../src/lib/showdown-official/browser-validator";
import type { Team } from "../src/lib/types";

const charizard: Team[number] = {
  name: "Charizard",
  species: "Charizard",
  item: "Heavy-Duty Boots",
  ability: "Blaze",
  nature: "Timid",
  level: 100,
  evs: { hp: 0, atk: 0, def: 4, spa: 252, spd: 0, spe: 252 },
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
  moves: ["Flamethrower", "Air Slash", "Protect", "Focus Blast"],
};

// Champions is a six-Pokémon format and uses Stat Points (0–32 per stat,
// 66 total), not the conventional 510-EV configuration. Keep fixtures legal
// for that format rather than weakening the official validator.
const championsTeam: Team = [
  { ...charizard, item: "", nature: "Hardy", evs: { hp: 11, atk: 11, def: 11, spa: 11, spd: 11, spe: 11 } },
  { ...charizard, name: "Venusaur", species: "Venusaur", ability: "Overgrow", moves: ["Giga Drain", "Sludge Bomb", "Earth Power", "Protect"], item: "", nature: "Hardy", evs: { hp: 11, atk: 11, def: 11, spa: 11, spd: 11, spe: 11 } },
  { ...charizard, name: "Blastoise", species: "Blastoise", ability: "Torrent", moves: ["Surf", "Ice Beam", "Aura Sphere", "Protect"], item: "", nature: "Hardy", evs: { hp: 11, atk: 11, def: 11, spa: 11, spd: 11, spe: 11 } },
  { ...charizard, name: "Pikachu", species: "Pikachu", ability: "Static", moves: ["Thunderbolt", "Volt Switch", "Quick Attack", "Protect"], item: "", nature: "Hardy", evs: { hp: 11, atk: 11, def: 11, spa: 11, spd: 11, spe: 11 } },
  { ...charizard, name: "Gengar", species: "Gengar", ability: "Cursed Body", moves: ["Shadow Ball", "Sludge Bomb", "Focus Blast", "Protect"], item: "", nature: "Hardy", evs: { hp: 11, atk: 11, def: 11, spa: 11, spd: 11, spe: 11 } },
  { ...charizard, name: "Dragonite", species: "Dragonite", ability: "Inner Focus", moves: ["Dragon Claw", "Earthquake", "Extreme Speed", "Protect"], item: "", nature: "Hardy", evs: { hp: 11, atk: 11, def: 11, spa: 11, spd: 11, spe: 11 } },
];

describe("browser-adapted official Pokémon Showdown TeamValidator", () => {
  it("exposes a callable TeamValidator constructor in the production module graph", async () => {
    const module = await import("../src/lib/showdown-official/sim/team-validator");
    expect(typeof module.TeamValidator).toBe("function");
    expect(typeof module.TeamValidator.get).toBe("function");
  });

  it("accepts a legal Gen 9 OU team using bundled upstream rules", () => {
    const result = validateWithOfficialTeamValidator([charizard], "gen9ou");
    expect(result).toMatchObject({ supported: true, valid: true, issues: [] });
    expect(result.message).toMatch(/official Pokémon Showdown TeamValidator/i);
  });

  it("rejects an unobtainable move rather than treating a learnset hint as legality", () => {
    const result = validateWithOfficialTeamValidator([{ ...charizard, moves: ["V-create"] }], "gen9ou");
    expect(result.supported).toBe(true);
    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toMatch(/V-create/i);
  });

  it("rejects invalid abilities through the upstream validator", () => {
    const result = validateWithOfficialTeamValidator([{ ...charizard, ability: "Made Up Ability" }], "gen9ou");
    expect(result.supported).toBe(true);
    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toMatch(/invalid ability/i);
  });

  it("validates older base-generation formats with their official mod data", () => {
    const gen8 = validateWithOfficialTeamValidator([charizard], "gen8ou");
    expect(gen8).toMatchObject({ supported: true, valid: true, issues: [] });

    const gen1Team: Team = [{
      ...charizard,
      item: "",
      ability: "",
      nature: "",
      moves: ["Fire Blast", "Body Slam", "Earthquake", "Slash"],
      evs: { hp: 252, atk: 252, def: 252, spa: 252, spd: 252, spe: 252 },
      ivs: { hp: 30, atk: 30, def: 30, spa: 30, spd: 30, spe: 30 },
    }];
    const gen1 = validateWithOfficialTeamValidator(gen1Team, "gen1ou");
    expect(gen1).toMatchObject({ supported: true, valid: true, issues: [] });
  });

  it("validates the official Pokémon Champions OU format using Champions-specific data", () => {
    const result = validateWithOfficialTeamValidator(championsTeam, "gen9championsou");
    expect(result.supported).toBe(true);
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("supports the Champions Regulation M-B mod data", () => {
    const result = validateWithOfficialTeamValidator(championsTeam, "gen9championsbssregmb");
    expect(result.supported).toBe(true);
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("does not claim support when a format requests custom mod data that is not bundled", () => {
    // Pass the custom mod as live metadata for a known bundled format ID. This
    // exercises the real safety boundary: a custom mod must never be silently
    // validated using the base Gen 9 data just because its ID starts with gen9.
    const result = validateWithOfficialTeamValidator([charizard], "gen9ou", {
      mod: "championsnatdexdraft",
      ruleset: ["Standard", "Sleep Clause Mod", "Species Clause"],
      banlist: [],
    });
    expect(result).toMatchObject({ supported: false, valid: null, issues: [] });
    expect(result.message).toMatch(/metadata differs from the bundled validator snapshot/i);
  });

  it("fails closed when live format metadata differs from the bundled rule snapshot", () => {
    const result = validateWithOfficialTeamValidator([charizard], "gen9ou", {
      mod: "gen9",
      ruleset: ["RuleThatDoesNotExistInTheBundledSnapshot"],
      banlist: [],
    });
    expect(result).toMatchObject({ supported: false, valid: null, issues: [] });
    expect(result.message).toMatch(/metadata differs from the bundled validator snapshot/i);
  });

  it("does not mutate the caller's team", () => {
    const team = [{ ...charizard, evs: { ...charizard.evs }, ivs: { ...charizard.ivs }, moves: [...charizard.moves] }];
    const before = JSON.parse(JSON.stringify(team));
    validateWithOfficialTeamValidator(team, "gen9ou");
    expect(team).toEqual(before);
  });
});
