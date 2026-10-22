import { findShowdownFormat } from "./format-catalog";
import { isEverythingFormat } from "./format-normalization";
import { getFormatCompatibilityIssue } from "./format-rule-compatibility";
import type { FormatResolution } from "./format-types";

export { isEverythingFormat } from "./format-normalization";

/** Resolves a picker value only when the installed simulator can safely enforce its rules. */
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

  const issue = getFormatCompatibilityIssue(selected);
  if (issue) return { supported: false, id: null, label: selected.label, reason: issue };
  return { supported: true, id: selected.id, label: selected.label };
}
