import { Dex, toID } from "./sim/dex";
import { TeamValidator } from "./sim/team-validator";
import type { Team } from "../types";

export const SHOWDOWN_VALIDATOR_REVISION = "showdown-team-validator-browser-port-v1";

export type LiveFormatMetadata = {
  mod?: string;
  gameType?: string;
  team?: string;
  ruleset?: string[];
  banlist?: string[];
};

export type OfficialBrowserValidation = {
  supported: boolean;
  valid: boolean | null;
  issues: string[];
  message: string;
  formatLabel: string;
};

/**
 * Runs the upstream TeamValidator against bundled official base-generation data for Gen 1–9.
 * The static-export build supports official base-generation mods Gen 1–9.
 * Other custom mods and generated-team formats fail closed.
 */
export function validateWithOfficialTeamValidator(team: Team, formatId: string, liveMetadata?: LiveFormatMetadata): OfficialBrowserValidation {
  let formatLabel = formatId;
  try {
    const format = Dex.formats.get(formatId);
    formatLabel = format.name || formatId;
    if (!format.exists) {
      return {
        supported: false, valid: null, issues: [], formatLabel,
        message: "This format is not present in the bundled official Pokémon Showdown format snapshot; legality was not checked.",
      };
    }
    if (!/^gen[1-9]$/.test(format.mod)) {
      return {
        supported: false, valid: null, issues: [], formatLabel,
        message: `This browser build bundles official base-generation data for Gen 1–9 only; format mod “${format.mod}” is not supported and no legality result was inferred.`,
      };
    }
    if (format.team) {
      return {
        supported: false, valid: null, issues: [], formatLabel,
        message: "This format uses a generated team rather than an imported team; it is not supported by the team editor validator.",
      };
    }
    if (liveMetadata) {
      const sameList = (live: string[] | undefined, bundled: string[] | undefined) => {
        const left = (live ?? []).map(toID).sort();
        const right = (bundled ?? []).map(toID).sort();
        return JSON.stringify(left) === JSON.stringify(right) &&
          !(live === undefined && (bundled?.length ?? 0) > 0);
      };
      const metadataMatches =
        (liveMetadata.mod === undefined || liveMetadata.mod === format.mod) &&
        (liveMetadata.gameType === undefined || liveMetadata.gameType === format.gameType) &&
        (liveMetadata.team === undefined || liveMetadata.team === format.team) &&
        sameList(liveMetadata.ruleset, format.ruleset) &&
        sameList(liveMetadata.banlist, format.banlist);
      if (!metadataMatches) {
        return {
          supported: false, valid: null, issues: [], formatLabel,
          message: "Live Pokémon Showdown format metadata differs from the bundled validator snapshot. Refresh the bundled validator before checking legality; no verdict was inferred.",
        };
      }
    }
    if (!Array.isArray(team)) {
      return { supported: true, valid: false, issues: ["Team data is not a valid array."], formatLabel, message: "Official TeamValidator rejected invalid team input." };
    }

    const clonedTeam = team.map(set => ({
      name: set.name || set.species,
      species: set.species,
      item: set.item || "",
      ability: set.ability || "",
      moves: Array.isArray(set.moves) ? set.moves.filter(Boolean) : [],
      nature: set.nature || "Serious",
      gender: "" as const,
      evs: { ...set.evs },
      ivs: { ...set.ivs },
      level: set.level || 100,
      teraType: set.teraType,
    }));

    const validator = new TeamValidator(format, Dex);
    const problems = validator.validateTeam(clonedTeam) || [];
    const issues = problems.filter(Boolean);
    const valid = issues.length === 0;
    return {
      supported: true,
      valid,
      issues,
      formatLabel,
      message: valid
        ? `Team passed the official Pokémon Showdown TeamValidator for ${formatLabel} using the bundled upstream data snapshot.`
        : `Official Pokémon Showdown TeamValidator found ${issues.length} issue${issues.length === 1 ? "" : "s"} for ${formatLabel}.`,
    };
  } catch (error) {
    return {
      supported: false, valid: null, issues: [], formatLabel,
      message: `Official browser validator could not complete: ${error instanceof Error ? error.message : String(error)}. No legality result was inferred.`,
    };
  }
}
