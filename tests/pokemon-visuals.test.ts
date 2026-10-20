import { describe, expect, it } from "vitest";
import { getSpriteCandidates, speciesSpriteSlug, typeMatchupSummary } from "../src/lib/pokemon-visuals";

describe("Pokémon visual helpers", () => {
  it("normalizes gendered and punctuation-bearing species names", () => {
    expect(speciesSpriteSlug("Nidoran♀")).toBe("nidoran-f");
    expect(speciesSpriteSlug("Mr. Mime")).toBe("mr-mime");
    expect(speciesSpriteSlug("Farfetch’d")).toBe("farfetchd");
  });

  it("provides ordered sprite fallbacks", () => {
    const candidates = getSpriteCandidates("Pikachu");
    expect(candidates).toHaveLength(4);
    expect(candidates[0]).toContain("/sprites/gen9/pikachu.png");
    expect(candidates[3]).toContain("/sprites/dex/pikachu.png");
  });

  it("reports expected type weaknesses and immunities", () => {
    const fire = typeMatchupSummary(["Fire"]);
    expect(fire).toContain("2× damage: Water, Ground, Rock");
    const ghost = typeMatchupSummary(["Ghost"]);
    expect(ghost).toContain("No effect: Normal, Fighting");
  });
});
