import type { Team } from "./types";
import type { TeamFormatValidation } from "./format-types";
import type { SupportedFormatResolution, TeamValidationProvider } from "./team-validation-provider";

/**
 * Deliberately conservative migration placeholder. A live rules catalogue is
 * metadata, not a substitute for Showdown's executable TeamValidator. Never
 * claim a team is legal until the browser port and differential tests exist.
 */
export const browserValidationProvider: TeamValidationProvider = {
  validateTeam(_team: Team, format: SupportedFormatResolution): TeamFormatValidation {
    return {
      supported: false,
      formatLabel: format.label,
      valid: null,
      issues: [],
      message: "The live format list is available, but legality validation is temporarily unavailable while the official Pokémon Showdown validator is being adapted for browser execution. No legality result is being inferred.",
    };
  },
};
