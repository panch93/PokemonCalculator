/** Public compatibility facade. Existing components can keep importing from this module. */
import { createFormatValidationFacade } from "./format-validation-facade";
import { pkmnSimValidationProvider } from "./pkmn-sim-validation-provider";

export { getAvailableShowdownFormats, setRemoteShowdownFormats } from "./format-catalog";
export { resolveShowdownFormat } from "./format-resolution";
export { isEverythingFormat } from "./format-normalization";
export type { ShowdownFormatOption, FormatResolution, TeamFormatValidation } from "./format-types";

const facade = createFormatValidationFacade(pkmnSimValidationProvider);
export const validateTeamForFormat = facade.validateTeamForFormat;
