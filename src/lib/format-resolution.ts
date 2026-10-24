import { findShowdownFormat } from "./format-catalog";
import { isEverythingFormat } from "./format-normalization";
import type { FormatResolution } from "./format-types";
import { inferBundledFormatMod, isBundledValidatorMod } from "./showdown-validator-mods";

export { isEverythingFormat } from "./format-normalization";

/** Resolves only formats that the bundled browser validator can potentially execute. */
export function resolveShowdownFormat(input: string): FormatResolution {
  if (isEverythingFormat(input)) {
    return {
      supported: false,
      id: null,
      label: "Everything!",
      reason: "Everything! is an unrestricted analysis mode; format-specific legality is intentionally not applied.",
    };
  }

  const selected = findShowdownFormat(input);
  if (!selected) {
    return {
      supported: false,
      id: null,
      label: input.trim() || "No format selected",
      reason: "This format is not present in the fetched or bundled Pokémon Showdown format catalog.",
    };
  }

  const mod = selected.remoteMod ?? selected.mod ?? inferBundledFormatMod(selected.id, selected.source);
  const generatedTeam = selected.remoteTeam ?? selected.team;
  if (generatedTeam) {
    return { supported: false, id: null, label: selected.label, reason: "This format uses a generated team and cannot validate an imported team." };
  }
  if (!isBundledValidatorMod(mod)) {
    return { supported: false, id: null, label: selected.label, reason: `The format “${selected.label}” uses mod “${mod || "unknown"}”, which is not included in this browser validator build.` };
  }
  if (selected.source !== "remote" && !/^gen[1-9]/.test(selected.id) && !selected.id.includes("champions")) {
    return { supported: false, id: null, label: selected.label, reason: "This browser validator build bundles official base-generation and Pokémon Champions data only; other custom mods remain unverified." };
  }

  return { supported: true, id: selected.id, label: selected.label };
}
