import { Dex } from "@pkmn/sim";
import { sameFormatRuleList } from "./format-normalization";
import type { ShowdownFormatOption } from "./format-types";

/** Returns null only when the selected format's local executable rules are usable. */
export function getFormatCompatibilityIssue(selected: ShowdownFormatOption): string | null {
  try {
    const format = Dex.formats.get(selected.id) as unknown as {
      id?: string; name?: string; effectType?: string; exists?: boolean;
      mod?: string; gameType?: string; team?: string; ruleset?: string[]; banlist?: string[];
    };
    if (!format || format.effectType !== "Format" || !format.exists) {
      return `This format is in the live catalog, but the installed Pokémon Showdown simulator does not include its executable rules (${selected.id}). The format remains searchable, but legality cannot be safely inferred.`;
    }
    if (selected.source === "remote") {
      return `This format is newer than or absent from the installed simulator (${selected.id}). The live catalog is informational; validation requires a matching Pokémon Showdown simulator build.`;
    }

    const metadataDiffers =
      Boolean(selected.remoteMod && format.mod && selected.remoteMod !== format.mod) ||
      Boolean(selected.remoteGameType && format.gameType && selected.remoteGameType !== format.gameType) ||
      Boolean(selected.remoteTeam && format.team && selected.remoteTeam !== format.team) ||
      !sameFormatRuleList(selected.remoteRuleset, format.ruleset) ||
      !sameFormatRuleList(selected.remoteBanlist, format.banlist);

    if (metadataDiffers) {
      return `The live Pokémon Showdown definition for ${selected.label} differs from the installed simulator's rules. Validation is disabled to avoid false legality results; update the simulator data to validate this format.`;
    }
    return null;
  } catch {
    return `The installed validator does not contain executable rules for ${selected.label}. It is not safe to guess legality.`;
  }
}
