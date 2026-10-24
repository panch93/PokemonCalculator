import { describe, expect, it } from "vitest";
import { exportTeam, getPokepasteTextUrl, parseTeamPaste } from "../src/lib/team-parser";

describe("team paste parser and exporter", () => {
  it("parses species, item, ability, EVs, nature, Tera type, and moves", () => {
    const team = parseTeamPaste(`Charizard @ Heavy-Duty Boots\nAbility: Blaze\nEVs: 4 Def / 252 SpA / 252 Spe\nTimid Nature\nTera Type: Grass\n- Flamethrower\n- Air Slash`);
    expect(team).toHaveLength(1);
    expect(team[0].species).toBe("Charizard");
    expect(team[0].item).toBe("Heavy-Duty Boots");
    expect(team[0].ability).toBe("Blaze");
    expect(team[0].evs).toMatchObject({ def: 4, spa: 252, spe: 252 });
    expect(team[0].nature).toBe("Timid");
    expect(team[0].teraType).toBe("Grass");
    expect(team[0].moves.slice(0, 2)).toEqual(["Flamethrower", "Air Slash"]);
  });

  it("round-trips the common Showdown export fields", () => {
    const source = `Pikachu @ Light Ball\nAbility: Static\nEVs: 252 Atk / 4 SpD / 252 Spe\nJolly Nature\n- Volt Tackle\n- Fake Out`;
    const normalized = exportTeam(parseTeamPaste(source));
    expect(normalized).toContain("Pikachu @ Light Ball");
    expect(normalized).toContain("Ability: Static");
    expect(normalized).toContain("Jolly Nature");
    expect(normalized).toContain("- Volt Tackle");
    expect(normalized).toContain("- Fake Out");
  });

  it("ignores Showdown nicknames and exports species names only", () => {
    const team = parseTeamPaste(`Sparky (Pikachu) @ Light Ball\nAbility: Static\n- Thunderbolt`);
    expect(team[0].species).toBe("Pikachu");
    expect(team[0].name).toBe("Pikachu");
    expect(exportTeam(team)).toContain("Pikachu @ Light Ball");
    expect(exportTeam(team)).not.toContain("Sparky");
  });

  it("recognizes only a single Poképaste link and builds its text endpoint", () => {
    expect(getPokepasteTextUrl("https://pokepast.es/abc123")).toBe("https://pokepast.es/abc123.txt");
    expect(getPokepasteTextUrl("  https://www.pokepast.es/abc123/  ")).toBe("https://pokepast.es/abc123.txt");
    expect(getPokepasteTextUrl("https://example.com/abc123")).toBeNull();
    expect(getPokepasteTextUrl("team text\nhttps://pokepast.es/abc123")).toBeNull();
  });

  it("caps imported teams at six Pokémon", () => {
    const source = Array.from({ length: 8 }, (_, i) => `Pikachu${i + 1}\n- Thunderbolt`).join("\n\n");
    expect(parseTeamPaste(source)).toHaveLength(6);
  });
});
