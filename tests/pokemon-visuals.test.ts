import { describe, expect, it } from "vitest";
import { getSpriteUrl, typeMatchupSummary } from "../src/lib/pokemon-visuals";

describe("Pokémon visual helpers", () => {
  it("uses one square Normal portrait from the SpriteCollab repository", () => {
    expect(getSpriteUrl(1)).toBe("https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/0001/Normal.png");
    expect(getSpriteUrl(683)).toBe("https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/0683/Normal.png");
    expect(getSpriteUrl(undefined)).toBeNull();
    expect(getSpriteUrl(0)).toBeNull();
  });

  it("reports expected type weaknesses and immunities", () => {
    const fire = typeMatchupSummary(["Fire"]);
    expect(fire).toContain("2× damage: Water, Ground, Rock");
    const ghost = typeMatchupSummary(["Ghost"]);
    expect(ghost).toContain("No effect: Normal, Fighting");
  });
});
