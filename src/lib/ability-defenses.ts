/**
 * Simple ability effects for draft defensive type matchup previews.
 * Keep this table data-driven so generation-specific ability changes are easy to update.
 * Values multiply the normal type effectiveness; 0 means immunity.
 */
export type AbilityDefenseEffect = { immuneTo?: string[]; multipliers?: Record<string, number>; superEffectiveMultiplier?: number; blocksNonSuperEffective?: boolean };

const entries: Record<string, AbilityDefenseEffect> = {
  "water absorb": { immuneTo: ["Water"] },
  "dry skin": { immuneTo: ["Water"], multipliers: { Fire: 1.25 } },
  "storm drain": { immuneTo: ["Water"] },
  "volt absorb": { immuneTo: ["Electric"] },
  "lightning rod": { immuneTo: ["Electric"] },
  "motor drive": { immuneTo: ["Electric"] },
  "levitate": { immuneTo: ["Ground"] },
  "earth eater": { immuneTo: ["Ground"] },
  "flash fire": { immuneTo: ["Fire"] },
  "well-baked body": { immuneTo: ["Fire"] },
  "sap sipper": { immuneTo: ["Grass"] },
  "thick fat": { multipliers: { Fire: 0.5, Ice: 0.5 } },
  "heatproof": { multipliers: { Fire: 0.5 } },
  "water bubble": { multipliers: { Fire: 0.5 } },
  "purifying salt": { multipliers: { Ghost: 0.5 } },
  "fluffy": { multipliers: { Fire: 2 } },
  "filter": { superEffectiveMultiplier: 0.75 },
  "solid rock": { superEffectiveMultiplier: 0.75 },
  "prism armor": { superEffectiveMultiplier: 0.75 },
  "wonder guard": { blocksNonSuperEffective: true },
};

export function getAbilityDefenseEffect(ability: string): AbilityDefenseEffect | undefined {
  return entries[ability.trim().toLowerCase()];
}

export function abilityDefenseMultiplier(ability: string, attackType: string, typeEffectiveness = 1): number | null {
  const effect = getAbilityDefenseEffect(ability);
  if (!effect) return null;
  if (effect.immuneTo?.some(type => type.toLowerCase() === attackType.toLowerCase())) return 0;
  if (effect.blocksNonSuperEffective && typeEffectiveness <= 1) return 0;
  const multiplier = Object.entries(effect.multipliers || {}).find(([type]) => type.toLowerCase() === attackType.toLowerCase())?.[1];
  if (multiplier !== undefined) return multiplier;
  if (typeEffectiveness > 1 && effect.superEffectiveMultiplier !== undefined) return effect.superEffectiveMultiplier;
  return null;
}

export function abilityDefenseDescription(ability: string): string {
  const effect = getAbilityDefenseEffect(ability);
  if (!effect) return "No type-chart defensive effect configured.";
  const parts: string[] = [];
  if (effect.immuneTo?.length) parts.push(`Immune to ${effect.immuneTo.join(", ")}`);
  for (const [type, multiplier] of Object.entries(effect.multipliers || {})) {
    parts.push(`${multiplier < 1 ? "Resists" : "Takes increased damage from"} ${type} (${multiplier}×)`);
  }
  if (effect.superEffectiveMultiplier !== undefined) parts.push(`Super-effective damage ×${effect.superEffectiveMultiplier}`);
  if (effect.blocksNonSuperEffective) parts.push("Blocks damaging moves that are not super effective");
  return parts.join("; ");
}
