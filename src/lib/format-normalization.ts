/** Normalizes display labels and IDs the same way for lookup and comparison. */
export function normalizeFormatIdentifier(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isEverythingFormat(input: string): boolean {
  return normalizeFormatIdentifier(input) === "everything";
}

export function sameFormatRuleList(upstream: string[] | undefined, local: string[] | undefined): boolean {
  // Empty remote lists are not authoritative: some rules are added by callbacks.
  if (!upstream?.length) return true;
  const normalizeList = (values: string[]) => values.map(normalizeFormatIdentifier).sort();
  return JSON.stringify(normalizeList(upstream)) === JSON.stringify(normalizeList(local || []));
}
