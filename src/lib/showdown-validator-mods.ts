/**
 * Mods whose official Showdown data is included in the browser validator bundle.
 * This is the single capability registry shared by format resolution and execution.
 */
export const BUNDLED_VALIDATOR_MODS = [
  "gen1", "gen2", "gen3", "gen4", "gen5", "gen6", "gen7", "gen8", "gen9",
  "champions", "championsregmb",
] as const;

const bundledModSet: ReadonlySet<string> = new Set(BUNDLED_VALIDATOR_MODS);

export function isBundledValidatorMod(mod: string | undefined): boolean {
  return !!mod && bundledModSet.has(mod);
}

/** Curated fallback IDs omit metadata; infer a generation mod only for those records. */
export function inferBundledFormatMod(formatId: string, source: string | undefined): string | undefined {
  if (source !== "bundled") return undefined;
  return formatId.match(/^(gen[1-9])/i)?.[1]?.toLowerCase();
}
