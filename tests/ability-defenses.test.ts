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

  it("only exposes configured defensive abilities as toggles", () => {
    expect(getAbilityDefenseEffect("Sap Sipper")).toBeDefined();
    expect(getAbilityDefenseEffect("Intimidate")).toBeUndefined();
    expect(abilityDefenseDescription("Water Absorb")).toContain("Immune to Water");
  });
});
