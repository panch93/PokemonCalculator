import type { ShowdownFormatOption } from "./format-types";

/** Catalog-source contract; sources must return display metadata, not claim legality. */
export interface FormatCatalogSource {
  getFormats(): ShowdownFormatOption[];
}
