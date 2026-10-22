import { TeamValidator } from "@pkmn/sim";
import type { Team } from "./types";
import type { TeamFormatValidation } from "./format-types";
import type { SupportedFormatResolution, TeamValidationProvider } from "./team-validation-provider";
import { toShowdownSet } from "./team-validation-provider";

/** Existing @pkmn/sim-backed implementation, isolated behind the provider contract. */
export const pkmnSimValidationProvider: TeamValidationProvider = {
  validateTeam(team: Team, format: SupportedFormatResolution): TeamFormatValidation {
    try {
      // TeamValidator normalizes sets in place, so it only receives fresh copies.
      const problems = new TeamValidator(format.id).validateTeam(team.map(toShowdownSet) as never) || [];
      return {
        supported: true,
        formatLabel: format.label,
        valid: problems.length === 0,
        issues: problems,
      };
    } catch (error) {
      return {
        supported: false,
        formatLabel: format.label,
        valid: null,
        issues: [],
        message: error instanceof Error ? `Could not validate this format: ${error.message}` : "Could not validate this format.",
      };
    }
  },
};
