import { describe, expect, it } from "vitest";
import { abilityDefenseDescription, abilityDefenseMultiplier, getAbilityDefenseEffect } from "../src/lib/ability-defenses";

describe("draft defensive ability effects", () => {
  it("recognizes immunities case-insensitively", () => {
    expect(abilityDefenseMultiplier("Water Absorb", "Water")).toBe(0);
    expect(abilityDefenseMultiplier("LEVITATE", "Ground")).toBe(0);
  });

  it("recognizes defensive multipliers", () => {
    expect(abilityDefenseMultiplier("Thick Fat", "Fire")).toBe(0.5);
    expect(abilityDefenseMultiplier("Thick Fat", "Ice")).toBe(0.5);
    expect(abilityDefenseMultiplier("Thick Fat", "Water")).toBeNull();
  });

  it("supports super-effective damage reduction and Wonder Guard in defensive matchups", () => {
    expect(abilityDefenseMultiplier("Filter", "Fire", 2)).toBe(0.75);
    expect(abilityDefenseMultiplier("Solid Rock", "Fighting", 4)).toBe(0.75);
    expect(abilityDefenseMultiplier("Wonder Guard", "Normal", 1)).toBe(0);
    expect(abilityDefenseMultiplier("Wonder Guard", "Fire", 2)).toBeNull();
  });

  it("identifies configured defensive ability effects for the type chart", () => {
    expect(getAbilityDefenseEffect("Sap Sipper")).toBeDefined();
    expect(getAbilityDefenseEffect("Intimidate")).toBeUndefined();
    expect(abilityDefenseDescription("Water Absorb")).toContain("Immune to Water");
  });
});
