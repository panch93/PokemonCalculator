import type { Team } from "./types";
import { isEverythingFormat } from "./format-normalization";
import { resolveShowdownFormat } from "./format-resolution";
import type { TeamFormatValidation } from "./format-types";
import type { TeamValidationProvider } from "./team-validation-provider";

/** Creates the stable app-facing API; provider replacement can be tested independently. */
export function createFormatValidationFacade(provider: TeamValidationProvider) {
  function validateTeamForFormat(team: Team, formatInput: string): TeamFormatValidation {
    if (isEverythingFormat(formatInput)) {
      return {
        supported: false,
        formatLabel: "Everything!",
        valid: null,
        issues: [],
        message: "Unrestricted analysis mode; format legality is not checked.",
      };
    }

    const format = resolveShowdownFormat(formatInput);
    if (!format.supported) {
      return { supported: false, formatLabel: format.label, valid: null, issues: [], message: format.reason };
    }

    return provider.validateTeam(team, format);
  }

  return { validateTeamForFormat };
}
