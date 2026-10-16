import { Dex } from "@pkmn/dex";

type DescribedEntry = { exists?: boolean; desc?: unknown; shortDesc?: unknown };

function getDescription(kind: "ability" | "item", name: string): string | undefined {
  const cleanName = name.trim();
  if (!cleanName) return undefined;

  try {
    const entry = (kind === "ability" ? Dex.abilities.get(cleanName) : Dex.items.get(cleanName)) as unknown as DescribedEntry;
    if (entry?.exists === false) return undefined;
    if (typeof entry?.shortDesc === "string" && entry.shortDesc.trim()) return entry.shortDesc.trim();
    if (typeof entry?.desc === "string" && entry.desc.trim()) return entry.desc.trim();
  } catch {
    // Custom or unrecognized names may not exist in the bundled Pokédex.
  }
  return undefined;
}

export function getAbilityDescription(name: string): string {
  return getDescription("ability", name) ?? (name.trim() ? "No ability description is available in the bundled Pokémon Showdown data." : "No ability assigned.");
}

export function getItemDescription(name: string): string {
  return getDescription("item", name) ?? (name.trim() ? "No item description is available in the bundled Pokémon Showdown data." : "No item assigned.");
}

export function formatAbilityTooltip(name: string): string {
  const label = name.trim() || "No ability";
  return `Ability: ${label}\n\n${getAbilityDescription(name)}`;
}

export function formatItemTooltip(name: string): string {
  const label = name.trim() || "No item";
  return `Item: ${label}\n\n${getItemDescription(name)}`;
}
