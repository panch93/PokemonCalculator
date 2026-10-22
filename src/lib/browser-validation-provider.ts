import type { Team } from "./types";
import type { SupportedFormatResolution, TeamValidationProvider } from "./team-validation-provider";
import { validateWithOfficialTeamValidator } from "./showdown-official/browser-validator";

/** Synchronous compatibility adapter. The app UI uses the same engine in a Web Worker. */
export const browserValidationProvider: TeamValidationProvider = {
  validateTeam(team: Team, format: SupportedFormatResolution) {
    const result = validateWithOfficialTeamValidator(team, format.id);
    return {
      supported: result.supported,
      formatLabel: result.formatLabel || format.label,
      valid: result.valid,
      issues: result.issues,
      message: result.message,
    };
  },
};
