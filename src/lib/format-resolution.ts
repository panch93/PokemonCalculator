import { findShowdownFormat } from "./format-catalog";
import { isEverythingFormat } from "./format-normalization";
import type { FormatResolution } from "./format-types";

export { isEverythingFormat } from "./format-normalization";

/** Resolves a format from the live or fallback display catalog. */
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
  if (selected.source === "remote") {
    return { supported: false, id: null, label: selected.label, reason: `The format “${selected.label}” is listed in live upstream metadata, but its legality cannot be checked until a compatible browser validator is available.` };
  }

  return { supported: true, id: selected.id, label: selected.label };
}
