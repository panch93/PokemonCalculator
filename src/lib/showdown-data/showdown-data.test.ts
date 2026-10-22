import { describe, expect, it } from "vitest";
import { resolveByName, toShowdownId, unwrapTable } from "./ids";
import { mergeDescriptions, parseDescriptionTable } from "./descriptions";
import { getAbilityNamesForSpecies } from "./index";
import { collectSpeciesLearnsetMoves } from "./learnsets";
import { getNature, getNatureEffectsByDisplayStat, getNatureList, parseOfficialNatureSource } from "./natures";
import type { ShowdownLearnsetEntry, ShowdownSpecies } from "./types";

describe("Showdown ID and table adapter", () => {
  it("normalizes names like Pokémon Showdown IDs", () => {
    expect(toShowdownId("Mr. Mime")).toBe("mrmime");
    expect(toShowdownId("Farfetch’d")).toBe("farfetchd");
    expect(toShowdownId("Urshifu-Rapid-Strike")).toBe("urshifurapidstrike");
  });

  it("unwraps a named data table and normalizes its keys", () => {
    const table = unwrapTable<{ name: string }>({ data: { pokemon: { "Mr. Mime": { name: "Mr. Mime" } } } }, ["data", "pokemon"]);
    expect(table.mrmime.name).toBe("Mr. Mime");
  });

  it("resolves names when the requested key differs from the canonical key", () => {
    const table = { urshifurapidstrike: { name: "Urshifu-Rapid-Strike" } };
    expect(resolveByName(table, "Urshifu Rapid Strike")?.name).toBe("Urshifu-Rapid-Strike");
    expect(resolveByName(table, "Definitely Not A Pokémon")).toBeUndefined();
  });
});

describe("Showdown learnset adapter", () => {
  const species: Record<string, ShowdownSpecies> = {
    venusaur: { name: "Venusaur" },
    venusaurmega: { name: "Venusaur-Mega", baseSpecies: "Venusaur", forme: "Mega" },
  };
  const learnsets: Record<string, ShowdownLearnsetEntry> = {
    venusaur: { learnset: { gigadrain: ["9M"], synthesis: ["9L1"] } },
    venusaurmega: { inherit: true, learnset: { frenzyplant: ["9T"], inherit: true } },
  };

  it("merges base and form learnsets while ignoring metadata keys", () => {
    expect([...collectSpeciesLearnsetMoves(learnsets, species, "Venusaur-Mega")!].sort())
      .toEqual(["frenzyplant", "gigadrain", "synthesis"]);
  });

  it("returns null for an unknown species rather than an empty legal set", () => {
    expect(collectSpeciesLearnsetMoves(learnsets, species, "Unknownmon")).toBeNull();
  });

  it("normalizes learnset move IDs", () => {
    const table = { pikachu: { learnset: { "Double Team": ["9M"], "Volt Tackle": ["9E"] } } };
    expect([...collectSpeciesLearnsetMoves(table, { pikachu: { name: "Pikachu" } }, "Pikachu")!].sort())
      .toEqual(["doubleteam", "volttackle"]);
  });
});

describe("nature data", () => {
  it("contains all 25 official nature names", () => {
    expect(getNatureList()).toHaveLength(25);
    expect(getNature("Serious")).toEqual({ name: "Serious" });
  });

  it("uses canonical lowercase stat keys and preserves neutral natures", () => {
    expect(getNature("Jolly")).toEqual({ name: "Jolly", plus: "spe", minus: "spa" });
    expect(getNature("Hardy")).toEqual({ name: "Hardy" });
    expect(getNatureEffectsByDisplayStat().Adamant).toEqual({ plus: "Atk", minus: "SpA" });
  });

  it("parses the 25-entry upstream TypeScript nature table", () => {
    const source = getNatureList().map(nature => {
      const fields = [`name: "${nature.name}"`];
      if (nature.plus) fields.push(`plus: '${nature.plus}'`);
      if (nature.minus) fields.push(`minus: '${nature.minus}'`);
      return `${toShowdownId(nature.name)}: { ${fields.join(", ")} },`;
    }).join("\n");
    const parsed = parseOfficialNatureSource(source);
    expect(Object.keys(parsed)).toHaveLength(25);
    expect(parsed.jolly).toEqual({ name: "Jolly", plus: "spe", minus: "spa" });
  });
});

describe("official upstream description tables", () => {
  it("extracts only canonical top-level description fields", () => {
    const source = [
      "export const MovesText = {",
      "\ttackle: {",
      '\t\tname: "Tackle",',
      '\t\tdesc: "A basic attack.",',
      '\t\tshortDesc: "A basic move.",',
      "\t\tgen1: {",
      '\t\t\tdesc: "Older generation text.",',
      "\t\t},",
      "\t},",
      "\tearthquake: {",
      '\t\tname: "Earthquake",',
      '\t\tshortDesc: "Hits adjacent Pokémon.",',
      "\t},",
      "};",
    ].join("\n");
    const parsed = parseDescriptionTable(source);
    expect(parsed.tackle).toEqual({ name: "Tackle", desc: "A basic attack.", shortDesc: "A basic move." });
    expect(parsed.earthquake).toEqual({ name: "Earthquake", shortDesc: "Hits adjacent Pokémon." });
    expect(parsed.tackle.desc).not.toBe("Older generation text.");
  });

  it("merges text descriptions onto mechanics by normalized ID", () => {
    const merged = mergeDescriptions(
      { leftovers: { name: "Leftovers", flingPower: 10 } },
      { leftovers: { name: "Leftovers", shortDesc: "Restores a little HP every turn." } },
    );
    expect(merged.leftovers.flingPower).toBe(10);
    expect(merged.leftovers.shortDesc).toBe("Restores a little HP every turn.");
  });
});


describe("species ability options", () => {
  it("returns only the abilities assigned to the selected species", () => {
    expect(getAbilityNamesForSpecies({
      name: "Pikachu",
      abilities: { "0": "Static", H: "Lightning Rod" },
    })).toEqual(["Lightning Rod", "Static"]);
  });

  it("does not leak the global ability list when species data is absent", () => {
    expect(getAbilityNamesForSpecies(undefined)).toEqual([]);
  });
});
