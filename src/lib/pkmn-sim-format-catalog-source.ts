import { Dex } from "@pkmn/sim";
import type { FormatCatalogSource } from "./format-catalog-source";
import type { ShowdownFormatOption } from "./format-types";

/** Reads format metadata from the installed simulator; isolated for later replacement. */
export const pkmnSimFormatCatalogSource: FormatCatalogSource = {
  getFormats(): ShowdownFormatOption[] {
    try {
      const all = (Dex.formats as unknown as {
        all: () => Array<{
          id: string; name: string; effectType?: string; exists?: boolean;
          challengeShow?: boolean; searchShow?: boolean; team?: string; mod?: string; gameType?: string;
        }>;
      }).all();
      return all
        .filter(format => format.id && format.name && format.effectType === "Format" && format.exists !== false)
        .map(format => ({
          label: format.name,
          id: format.id,
          source: "bundled" as const,
          mod: format.mod,
          gameType: format.gameType,
          searchShow: format.searchShow,
          challengeShow: format.challengeShow,
          team: format.team,
        }));
    } catch {
      // The catalog layer has its own curated fallback.
      return [];
    }
  },
};
