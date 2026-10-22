/** Public validation API retained while the browser validator migration is in progress. */
import { createFormatValidationFacade } from "./format-validation-facade";
import { browserValidationProvider } from "./browser-validation-provider";

export { getAvailableShowdownFormats, setRemoteShowdownFormats } from "./format-catalog";
export { resolveShowdownFormat } from "./format-resolution";
export { isEverythingFormat } from "./format-normalization";
export type { ShowdownFormatOption, FormatResolution, TeamFormatValidation } from "./format-types";

const facade = createFormatValidationFacade(browserValidationProvider);
export const validateTeamForFormat = facade.validateTeamForFormat;
