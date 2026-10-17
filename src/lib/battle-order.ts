import { Dex } from "@pkmn/dex";
import { FieldState, PokemonSet } from "./types";

type DexEntry = {
  exists?: boolean; name?: string; baseStats?: Record<string, number>;
  plus?: string; minus?: string; priority?: number; type?: string;
  category?: string; flags?: Record<string, number>; boosts?: Record<string, number>;
};
const clean = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
const ability = (p: PokemonSet, name: string) => clean(p.ability) === clean(name);
const item = (p: PokemonSet, name: string) => clean(p.item) === clean(name);

/** Gen 9 estimated effective Speed using bundled Pokémon Showdown dex data. */
export function getEffectiveSpeed(p: PokemonSet, field: FieldState, side: "attacker" | "defender" = "attacker", speedStage = 0): number {
  const species = Dex.species.get(p.species || p.name) as unknown as DexEntry;
  const base = Number(species?.baseStats?.spe);
  if (!Number.isFinite(base)) return 0;
  const level = Math.max(1, Math.min(100, p.level || 100));
  const iv = Math.max(0, Math.min(31, p.ivs?.spe ?? 31));
  const ev = Math.max(0, Math.min(252, p.evs?.spe ?? 0));
  let speed = Math.floor((Math.floor((2 * base + iv + Math.floor(ev / 4)) * level / 100) + 5));
  const nature = Dex.natures.get(p.nature || "Serious") as unknown as DexEntry;
  if (nature?.plus === "spe") speed = Math.floor(speed * 1.1);
  if (nature?.minus === "spe") speed = Math.floor(speed * 0.9);

  const stage = Math.max(-6, Math.min(6, Math.round(speedStage)));
  if (stage > 0) speed = Math.floor(speed * (2 + stage) / 2);
  else if (stage < 0) speed = Math.floor(speed * 2 / (2 - stage));

  // Other speed-changing battle state
  // (paralysis, Tailwind, Trick Room, weather abilities activated by other sources) is not represented.
  if (p.status === "par" && !ability(p, "Quick Feet")) speed = Math.floor(speed * 0.5);
  if (ability(p, "Quick Feet") && p.status) speed = Math.floor(speed * 1.5);
  if (item(p, "Choice Scarf")) speed = Math.floor(speed * 1.5);
  if (item(p, "Iron Ball") || item(p, "Macho Brace") || ["Power Anklet", "Power Band", "Power Belt", "Power Bracer", "Power Lens", "Power Weight"].some(x => item(p, x))) speed = Math.floor(speed * 0.5);
  if (ability(p, "Swift Swim") && field.weather === "Rain") speed *= 2;
  if (ability(p, "Chlorophyll") && field.weather === "Sun") speed *= 2;
  if (ability(p, "Sand Rush") && field.weather === "Sand") speed *= 2;
  if (ability(p, "Slush Rush") && field.weather === "Snow") speed *= 2;
  if (ability(p, "Surge Surfer") && field.terrain === "Electric") speed *= 2;
  if (field.tailwindSide === side) speed *= 2;
  return Math.max(1, Math.floor(speed));
}

/** Speed stat from level, IVs, EVs and nature only; excludes battle stages, status, items, weather abilities and field effects. */
export function getBaseSpeed(p: PokemonSet): number {
  const species = Dex.species.get(p.species || p.name) as unknown as DexEntry;
  const base = Number(species?.baseStats?.spe);
  if (!Number.isFinite(base)) return 0;
  const level = Math.max(1, Math.min(100, p.level || 100));
  const iv = Math.max(0, Math.min(31, p.ivs?.spe ?? 31));
  const ev = Math.max(0, Math.min(252, p.evs?.spe ?? 0));
  let speed = Math.floor(Math.floor((2 * base + iv + Math.floor(ev / 4)) * level / 100) + 5);
  const nature = Dex.natures.get(p.nature || "Serious") as unknown as DexEntry;
  if (nature?.plus === "spe") speed = Math.floor(speed * 1.1);
  if (nature?.minus === "spe") speed = Math.floor(speed * 0.9);
  return Math.max(1, speed);
}

/** Move priority after common Gen 9 ability/terrain modifiers. */
export function getEffectiveMovePriority(p: PokemonSet, moveName: string, field: FieldState): number {
  const move = Dex.moves.get(moveName) as unknown as DexEntry;
  if (move?.exists === false) return 0;
  let priority = Number(move?.priority ?? 0);
  const category = String(move?.category ?? "");
  const type = String(move?.type ?? "");
  const flags = move?.flags ?? {};
  if (ability(p, "Prankster") && category === "Status") priority += 1;
  // Gale Wings requires full HP; current HP is not tracked, so display the conditional value.
  if (ability(p, "Gale Wings") && type === "Flying") priority += 1;
  if (ability(p, "Triage") && flags.heal) priority += 3;
  if (moveName.trim().toLowerCase() === "grassy glide" && field.terrain === "Grassy") priority += 1;
  return priority;
}

export function getMovePriorityLabel(p: PokemonSet, moveName: string, field: FieldState): string {
  const priority = getEffectiveMovePriority(p, moveName, field);
  const move = Dex.moves.get(moveName) as unknown as DexEntry;
  const galeWingsConditional = ability(p, "Gale Wings") && String(move?.type ?? "") === "Flying";
  return `[${priority > 0 ? "+" : ""}${priority}${galeWingsConditional ? "*" : ""}]`;
}

export function getMovePriorityNote(p: PokemonSet, moveName: string, field: FieldState): string {
  const move = Dex.moves.get(moveName) as unknown as DexEntry;
  const base = Number(move?.priority ?? 0);
  const actual = getEffectiveMovePriority(p, moveName, field);
  const conditional = ability(p, "Gale Wings") && String(move?.type ?? "") === "Flying";
  const suffix = conditional ? " (Gale Wings assumes full HP)" : "";
  return `Priority ${actual > 0 ? "+" : ""}${actual}${actual !== base ? ` (base ${base > 0 ? "+" : ""}${base})` : ""}${suffix}`;
}

/** Ratio of effective battle Speed to the Pokémon's unmodified calculated Speed. */
export function getSpeedMultiplier(p: PokemonSet, field: FieldState, side: "attacker" | "defender" = "attacker", speedStage = 0): number {
  const species = Dex.species.get(p.species || p.name) as unknown as DexEntry;
  const base = Number(species?.baseStats?.spe);
  if (!Number.isFinite(base)) return 1;
  const level = Math.max(1, Math.min(100, p.level || 100));
  const iv = Math.max(0, Math.min(31, p.ivs?.spe ?? 31));
  const ev = Math.max(0, Math.min(252, p.evs?.spe ?? 0));
  let raw = Math.floor((Math.floor((2 * base + iv + Math.floor(ev / 4)) * level / 100) + 5));
  const nature = Dex.natures.get(p.nature || "Serious") as unknown as DexEntry;
  if (nature?.plus === "spe") raw = Math.floor(raw * 1.1);
  if (nature?.minus === "spe") raw = Math.floor(raw * 0.9);
  return raw > 0 ? getEffectiveSpeed(p, field, side, speedStage) / raw : 1;
}
