import { beforeEach, describe, expect, it, vi } from "vitest";
import { setRemoteShowdownFormats } from "../src/lib/format-catalog";
import { createFormatValidationFacade } from "../src/lib/format-validation-facade";
import type { SupportedFormatResolution, TeamValidationProvider } from "../src/lib/team-validation-provider";
import type { Team } from "../src/lib/types";

const team: Team = [{
  name: "Charizard",
  species: "Charizard",
  item: "Heavy-Duty Boots",
  ability: "Blaze",
  nature: "Timid",
  level: 100,
  evs: { hp: 0, atk: 0, def: 4, spa: 252, spd: 0, spe: 252 },
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
  moves: ["Flamethrower", "Air Slash", "Roost", "Focus Blast"],
}];

beforeEach(() => setRemoteShowdownFormats([]));

describe("format validation provider boundary", () => {
  it("preserves the public validation result contract", () => {
    const provider: TeamValidationProvider = {
      validateTeam: vi.fn((_team: Team, format: SupportedFormatResolution) => ({
        supported: true,
        formatLabel: format.label,
        valid: true,
        issues: [],
      })),
    };
    const facade = createFormatValidationFacade(provider);

    expect(facade.validateTeamForFormat(team, "gen9ou")).toEqual({
      supported: true,
      formatLabel: "[Gen 9] OU",
      valid: true,
      issues: [],
    });
    expect(provider.validateTeam).toHaveBeenCalledWith(team, {
      supported: true,
      id: "gen9ou",
      label: "[Gen 9] OU",
    });
  });

  it("does not call the provider for Everything!", () => {
    const provider: TeamValidationProvider = { validateTeam: vi.fn() };
    const facade = createFormatValidationFacade(provider);

    expect(facade.validateTeamForFormat(team, "Everything!")).toMatchObject({
      supported: false,
      formatLabel: "Everything!",
      valid: null,
      issues: [],
    });
    expect(provider.validateTeam).not.toHaveBeenCalled();
  });

  it("does not call the provider for unknown or unsupported formats", () => {
    const provider: TeamValidationProvider = { validateTeam: vi.fn() };
    const facade = createFormatValidationFacade(provider);

    expect(facade.validateTeamForFormat(team, "not-a-real-format")).toMatchObject({
      supported: false,
      valid: null,
      issues: [],
    });
    expect(provider.validateTeam).not.toHaveBeenCalled();
  });

  it("keeps the provider replaceable without changing the facade API", () => {
    const provider: TeamValidationProvider = {
      validateTeam: (_team, format) => ({
        supported: false,
        formatLabel: format.label,
        valid: null,
        issues: [],
        message: "Validation service unavailable.",
      }),
    };
    const facade = createFormatValidationFacade(provider);

    expect(facade.validateTeamForFormat(team, "gen9ou")).toMatchObject({
      supported: false,
      formatLabel: "[Gen 9] OU",
      valid: null,
      issues: [],
      message: "Validation service unavailable.",
    });
  });
});
