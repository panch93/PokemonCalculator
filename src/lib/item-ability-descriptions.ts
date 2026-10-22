import { getAbility, getItem } from "./showdown-data";

function getDescription(kind: "ability" | "item", name: string): string | undefined {
  if (!name.trim()) return undefined;
  const entry = kind === "ability" ? getAbility(name) : getItem(name);
  const description = entry?.shortDesc || entry?.desc;
  return typeof description === "string" && description.trim() ? description.trim() : undefined;
}

export function getAbilityDescription(name: string): string {
  return getDescription("ability", name) ?? (name.trim() ? "No ability description is available from the live Pokémon Showdown data." : "No ability assigned.");
}

export function getItemDescription(name: string): string {
  return getDescription("item", name) ?? (name.trim() ? "No item description is available from the live Pokémon Showdown data." : "No item assigned.");
}

export function formatAbilityTooltip(name: string): string {
  const label = name.trim() || "No ability";
  return `Ability: ${label}\n\n${getAbilityDescription(name)}`;
}

export function formatItemTooltip(name: string): string {
  const label = name.trim() || "No item";
  return `Item: ${label}\n\n${getItemDescription(name)}`;
}
