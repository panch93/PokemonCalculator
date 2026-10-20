import { calculate, Generations, Move, Pokemon, Field, TYPE_CHART } from "@smogon/calc";
import { Dex } from "@pkmn/dex";
import { DamageSummary, FieldState, MoveDetails, PokemonSet, StatStages } from "./types";

/** Read canonical English move descriptions from the bundled pkmn/ps dex data. */
function getPkmnMoveDescription(name: string): string | undefined {
  try {
    const psMove = Dex.moves.get(name) as unknown as { desc?: unknown; shortDesc?: unknown; exists?: boolean };
    if (psMove?.exists === false) return undefined;
    if (typeof psMove?.desc === "string" && psMove.desc.trim()) return psMove.desc.trim();
    if (typeof psMove?.shortDesc === "string" && psMove.shortDesc.trim()) return psMove.shortDesc.trim();
  } catch {
    // Fall back to calculator metadata for custom/unknown moves.
  }
  return undefined;
}

/** Defensive fallback for custom/unknown moves absent from the bundled dex. */
function getMoveDescription(
  name: string,
  metadata?: { type?: string; category?: string; power?: number | null; accuracy?: number | null; priority?: number },
): string {
  const type = metadata?.type && metadata.type !== "Unknown" ? `${metadata.type}-type` : "move";
  const category = metadata?.category && metadata.category !== "Unknown" ? ` ${metadata.category.toLowerCase()}` : "";
  const power = metadata?.power == null ? "variable or no direct" : `${metadata.power}-power`;
  const accuracy = metadata?.accuracy == null ? "variable" : `${metadata.accuracy}%`;
  const priority = metadata?.priority ? ` Its priority is ${metadata.priority > 0 ? "+" : ""}${metadata.priority}.` : "";
  return `${name} is a${category ? ` ${category.trim()}` : ""} ${type} move with ${power} base power and ${accuracy} accuracy.${priority} A full description is not available in the bundled Pokémon Showdown data.`;
}

const DEFAULT_GEN = 9;
const getGen = (generation: number) => {
  const generationNum = Math.max(1, Math.min(9, Math.round(generation || DEFAULT_GEN))) as Parameters<typeof Generations.get>[0];
  return Generations.get(generationNum);
};

const TYPE_NAMES = [
  "Normal", "Fighting", "Flying", "Poison", "Ground", "Rock", "Bug", "Ghost",
  "Steel", "Fire", "Water", "Grass", "Electric", "Psychic", "Ice", "Dragon",
  "Dark", "Fairy", "Stellar", "???",
] as const;

type CalcType = typeof TYPE_NAMES[number];

const isCalcType = (value: string): value is CalcType =>
  (TYPE_NAMES as readonly string[]).includes(value);

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function resolveCalcType(value?: string): CalcType | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return isCalcType(trimmed) ? trimmed : undefined;
}

function makePokemon(set: PokemonSet, generation = DEFAULT_GEN, boosts: Partial<Record<"atk" | "def" | "spa" | "spd" | "spe", number>> = {}, fieldState?: FieldState) {
  const gen = getGen(generation);
  const abilityName = normalize(set.ability);
  const proto = abilityName === "protosynthesis";
  const quark = abilityName === "quarkdrive" || abilityName === "quark drive";
  const selectedBoost = set.boostedStat;
  const boostActive = (proto && (fieldState?.weather === "Sun" || hasItem(set, "Booster Energy"))) || (quark && (fieldState?.terrain === "Electric" || hasItem(set, "Booster Energy")));
  const manualBoost = Boolean(boostActive && selectedBoost && ["atk", "def", "spa", "spd", "spe"].includes(selectedBoost));
  const pokemon = new Pokemon(gen, set.species, {
    item: set.item.trim() || undefined,
    ability: manualBoost ? undefined : (set.ability.trim() || undefined),
    status: set.status || undefined,
    nature: set.nature.trim() || undefined,
    level: set.level || 100,
    teraType: resolveCalcType(set.teraType),
    evs: set.evs,
    ivs: set.ivs,
    boosts,
  });
  // Selecting a Tera type means this set is Terastallized; blank/None leaves it normal.
  if (resolveCalcType(set.teraType)) (pokemon as unknown as { isTera: boolean }).isTera = true;
  if (typeof set.currentHp === "number" && Number.isFinite(set.currentHp)) {
    const current = Math.max(0, Math.min(pokemon.maxHP(), Math.floor(set.currentHp)));
    (pokemon as unknown as { curHP: () => number }).curHP = () => current;
  }
  if (typeof set.alliesFainted === "number") (pokemon as unknown as { alliesFainted: number }).alliesFainted = Math.max(0, Math.min(5, set.alliesFainted));
  if (manualBoost && selectedBoost) {
    const rawStats = (pokemon as unknown as { rawStats?: Record<string, number> }).rawStats;
    if (rawStats && typeof rawStats[selectedBoost] === "number") {
      rawStats[selectedBoost] = Math.floor(rawStats[selectedBoost] * (selectedBoost === "spe" ? 1.5 : 1.3));
    }
  }
  return pokemon;
}

/**
 * Build a fresh singles field for each attacker-vs-defender calculation.
 * The UI's hazards/screens always belong to the current defender, regardless
 * of which team is attacking. Never reuse a Field instance: the calc engine
 * clones and can mutate side conditions for abilities such as Infiltrator.
 */
function makeField(state: FieldState) {
  return new Field({
    gameType: "Singles",
    weather: state.weather || undefined,
    terrain: state.terrain || undefined,
    defenderSide: {
      isSR: Boolean(state.defenderStealthRock),
      spikes: Math.max(0, Math.min(3, Number(state.defenderSpikes) || 0)),
      isReflect: Boolean(state.defenderReflect),
      isLightScreen: Boolean(state.defenderLightScreen),
      isAuroraVeil: Boolean(state.defenderAuroraVeil),
    },
  });
}

function damageRange(value: unknown): { min: number; max: number } | null {
  if (typeof value === "number" && Number.isFinite(value)) return { min: value, max: value };
  if (!Array.isArray(value) || value.length === 0) return null;
  const children = value.map(damageRange).filter((item): item is { min: number; max: number } => item !== null);
  if (!children.length) return null;
  // A flat array represents the random damage rolls for one hit. Nested arrays
  // represent successive hits (or component hits), whose damage is additive.
  if (value.every(item => typeof item === "number")) {
    return { min: Math.min(...children.map(item => item.min)), max: Math.max(...children.map(item => item.max)) };
  }
  return {
    min: children.reduce((sum, item) => sum + item.min, 0),
    max: children.reduce((sum, item) => sum + item.max, 0),
  };
}

function hasItem(set: PokemonSet, item: string) {
  return normalize(set.item) === normalize(item);
}

function hasAbility(set: PokemonSet, ability: string) {
  return normalize(set.ability) === normalize(ability);
}

function isGroundedForHazards(set: PokemonSet, pokemon: Pokemon) {
  if (pokemon.types.includes("Flying")) return false;
  if (hasAbility(set, "Levitate")) return false;
  if (hasItem(set, "Air Balloon")) return false;
  return true;
}

function stealthRockMultiplier(pokemon: Pokemon) {
  return pokemon.types.reduce((multiplier, type) => {
    return multiplier * (TYPE_CHART[9].Rock?.[type] ?? 1);
  }, 1);
}

/**
 * Entry hazards are not part of the raw move damage value returned by
 * @smogon/calc. We model the switch-in HP loss separately so the UI can
 * answer questions such as "does this become a KO after Rocks?"
 *
 * This intentionally models Gen 9 singles entry hazards only:
 * - Heavy-Duty Boots prevents both hazards.
 * - Magic Guard prevents the damage.
 * - Stealth Rock uses the Rock effectiveness chart.
 * - Spikes require the target to be grounded.
 */
function getEntryHazardDamage(set: PokemonSet, pokemon: Pokemon, field: FieldState) {
  if (hasItem(set, "Heavy-Duty Boots") || hasAbility(set, "Magic Guard")) {
    return 0;
  }

  let damage = 0;
  const maxHp = pokemon.maxHP();

  if (field.defenderStealthRock) {
    const multiplier = stealthRockMultiplier(pokemon);
    damage += Math.max(1, Math.floor(maxHp * multiplier / 8));
  }

  if (field.defenderSpikes > 0 && isGroundedForHazards(set, pokemon)) {
    const fraction =
      field.defenderSpikes === 1 ? 1 / 8 :
      field.defenderSpikes === 2 ? 1 / 6 :
      1 / 4;
    damage += Math.max(1, Math.floor(maxHp * fraction));
  }

  return Math.min(damage, Math.max(0, maxHp - 1));
}

function cacheKey(
  attacker: PokemonSet,
  defender: PokemonSet,
  moveName: string,
  fieldState: FieldState,
  attackerStages: StatStages,
  defenderStages: StatStages,
  critical: boolean,
) {
  return JSON.stringify([attacker, defender, moveName, fieldState, attackerStages, defenderStages, critical]);
}

const CACHE_LIMIT = 1500;
const calculationCache = new Map<string, DamageSummary | null>();

function getCached(key: string) {
  const cached = calculationCache.get(key);
  if (cached !== undefined) {
    calculationCache.delete(key);
    calculationCache.set(key, cached);
  }
  return cached;
}

function setCached(key: string, value: DamageSummary | null) {
  calculationCache.set(key, value);
  if (calculationCache.size > CACHE_LIMIT) {
    const oldest = calculationCache.keys().next().value;
    if (oldest) calculationCache.delete(oldest);
  }
  return value;
}

export function calculateMove(
  attacker: PokemonSet,
  defender: PokemonSet,
  moveName: string,
  fieldState: FieldState,
  attackerStages: StatStages = { atk: 0, spa: 0, def: 0, spd: 0, spe: 0 },
  defenderStages: StatStages = { atk: 0, spa: 0, def: 0, spd: 0, spe: 0 },
  critical = false,
  generation = DEFAULT_GEN,
): DamageSummary | null {
  if (!moveName.trim()) return null;

  const key = `${generation}|${cacheKey(attacker, defender, moveName, fieldState, attackerStages, defenderStages, critical)}`;
  const cached = getCached(key);
  if (cached !== undefined) return cached;

  try {
    const gen = getGen(generation);
    const attackerPokemon = makePokemon(attacker, generation, { atk: attackerStages.atk, spa: attackerStages.spa }, fieldState);
    const defenderPokemon = makePokemon(defender, generation, { def: defenderStages.def, spd: defenderStages.spd }, fieldState);
    const move = new Move(gen, moveName);
    if (critical) (move as unknown as { isCrit: boolean }).isCrit = true;
    const field = makeField(fieldState);
    const result = calculate(gen, attackerPokemon, defenderPokemon, move, field);

    const range = damageRange((result as unknown as { damage?: unknown }).damage);
    if (!range) {
      return setCached(key, {
        move: moveName,
        min: 0,
        max: 0,
        minPct: 0,
        maxPct: 0,
        rawMinPct: 0,
        rawMaxPct: 0,
        effectiveHp: defenderPokemon.maxHP(),
        entryHazardDamage: 0,
        entryHazardPct: 0,
        ko: "No damage",
        description: `${moveName} has no damaging result in this state.`,
      });
    }

    const min = range.min;
    const max = range.max;
    const rawDamage = (result as unknown as { damage?: unknown }).damage;
    const rolls = Array.isArray(rawDamage) && rawDamage.every(value => typeof value === "number")
      ? [...new Set(rawDamage as number[])].sort((a, b) => a - b)
      : undefined;
    const maxHp = defenderPokemon.maxHP();
    const entryHazardDamage = defender.currentHp === undefined ? getEntryHazardDamage(defender, defenderPokemon, fieldState) : 0;
    const currentHp = Math.max(1, Math.min(maxHp, Math.floor(defender.currentHp ?? maxHp)));
    const effectiveHp = Math.max(1, currentHp - entryHazardDamage);

    const rawMinPct = (min / maxHp) * 100;
    const rawMaxPct = (max / maxHp) * 100;
    // Damage percentages are always relative to total maximum HP, as in the Smogon calculator.
    // Current HP affects HP-sensitive mechanics and KO estimates, not the displayed damage percentage.
    const minPct = rawMinPct;
    const maxPct = rawMaxPct;
    const entryHazardPct = (entryHazardDamage / maxHp) * 100;

    const hazardText = entryHazardDamage > 0
      ? `Entry hazards remove ${entryHazardDamage} HP (${entryHazardPct.toFixed(1)}%) before this attack.`
      : "No entry-hazard damage is applied before this attack.";

    const activeScreensForMove =
      (fieldState.defenderReflect && move.category === "Physical") ||
      (fieldState.defenderLightScreen && move.category === "Special") ||
      fieldState.defenderAuroraVeil;
    const screenBypassNote = !critical && hasAbility(attacker, "Infiltrator") && activeScreensForMove
      ? "Infiltrator bypasses the defender's active Reflect, Light Screen, and Aurora Veil; those screens therefore do not reduce this damage."
      : "";
    // Toxic is progressive (1/16, 2/16, ... max HP each turn). Since the
    // team editor does not track the toxic counter, show the first-turn tick
    // explicitly and use it for the conditional post-residual KO note.
    const toxicDamage = defender.status === "tox" && !hasAbility(defender, "Magic Guard") && !hasAbility(defender, "Poison Heal")
      ? Math.max(1, Math.floor(maxHp / 16))
      : 0;
    const damageRolls = rolls?.length ? rolls : null;
    const toxicKoNote = (() => {
      if (!toxicDamage) return "";
      const directGuaranteed = min + entryHazardDamage >= maxHp;
      const directPossible = max + entryHazardDamage >= maxHp;
      const toxicGuaranteed = min + entryHazardDamage + toxicDamage >= maxHp;
      const toxicPossible = max + entryHazardDamage + toxicDamage >= maxHp;
      if (toxicGuaranteed && !directGuaranteed) return " (guaranteed OHKO after toxic damage)";
      if (!directPossible && toxicPossible && !damageRolls) return " (possible OHKO after toxic damage; exact roll chance unavailable)";
      if (damageRolls && !directGuaranteed) {
        const directChance = damageRolls.filter(roll => roll + entryHazardDamage >= maxHp).length / damageRolls.length;
        const afterChance = damageRolls.filter(roll => roll + entryHazardDamage + toxicDamage >= maxHp).length / damageRolls.length;
        if (afterChance > directChance) return ` (${(afterChance * 100).toFixed(1)}% chance to OHKO after toxic damage)`;
      }
      return "";
    })();
    const baseDescription = safeDescription(result, moveName);
    const residualNotes = [
      fieldState.defenderLeechSeed && !baseDescription.toLowerCase().includes("leech seed") ? "Leech Seed's end-of-turn drain is not included in the direct move damage; its residual damage may further affect the KO." : "",
      fieldState.defenderSaltCure && !baseDescription.toLowerCase().includes("salt cure") ? "Salt Cure's end-of-turn damage is not included in the direct move damage; its residual damage may further affect the KO." : "",
      toxicDamage > 0 && !baseDescription.toLowerCase().includes("toxic damage")
        ? `Toxic removes ${toxicDamage} HP (${(toxicDamage / maxHp * 100).toFixed(1)}% of max HP) on the first toxic turn; the toxic counter is not tracked.${toxicKoNote}`
        : "",
      screenBypassNote,
    ].filter(Boolean).join(" ");
    const nativeHazardDescription = /after (stealth rock|spikes|entry hazards)/i.test(baseDescription);
    const appendedHazardText = entryHazardDamage > 0 && !nativeHazardDescription ? ` ${hazardText}` : "";

    return setCached(key, {
      move: moveName,
      min,
      max,
      rolls,
      minPct,
      maxPct,
      rawMinPct,
      rawMaxPct,
      effectiveHp,
      entryHazardDamage,
      entryHazardPct,
      // KO estimates use the Pokémon's current HP, while the displayed damage percentages above remain max-HP based.
      ko: koLabel((min / effectiveHp) * 100, (max / effectiveHp) * 100),
      description: `${baseDescription}${appendedHazardText}${residualNotes ? ` ${residualNotes}` : ""}`,
    });
  } catch {
    return setCached(key, null);
  }
}

function safeDescription(result: unknown, fallback: string) {
  const candidate = result as { desc?: () => string };
  try {
    return typeof candidate.desc === "function" ? candidate.desc() : fallback;
  } catch {
    return fallback;
  }
}

export function koLabel(minPct: number, maxPct: number) {
  if (maxPct <= 0) return "No damage";
  let guaranteed = 5;
  let possible = 5;
  for (let hits = 1; hits <= 4; hits++) {
    if (minPct * hits >= 100 && guaranteed === 5) guaranteed = hits;
    if (maxPct * hits >= 100 && possible === 5) possible = hits;
  }
  if (possible < guaranteed) return `Possible ${possible}HKO · ${guaranteed <= 4 ? `${guaranteed}HKO` : "4HKO+"}`;
  return guaranteed <= 4 ? `${guaranteed}HKO` : "4HKO+";
}

/** Return generation-specific move metadata from the same data bundled with @smogon/calc. */
export function getMoveDetails(moveName: string, generation = DEFAULT_GEN): MoveDetails | null {
  try {
    const gen = getGen(generation);
    const move = new Move(gen, moveName) as unknown as Record<string, unknown>;
    const moveTable = (gen as unknown as { moves?: { get?: (name: string) => unknown } }).moves;
    const raw = (moveTable?.get?.(moveName) || {}) as Record<string, unknown>;
    const text = (value: unknown) => typeof value === "string" ? value : "";
    const numeric = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
    return {
      name: text(move.name) || moveName,
      type: text(move.type) || text(raw.type) || "Unknown",
      category: text(move.category) || text(raw.category) || "Unknown",
      power: numeric(move.bp) ?? numeric(raw.basePower) ?? numeric(raw.bp),
      accuracy: numeric(move.accuracy) ?? numeric(raw.accuracy),
      pp: numeric(move.pp) ?? numeric(raw.pp),
      priority: typeof move.priority === "number" ? move.priority : (typeof raw.priority === "number" ? raw.priority : 0),
      description: getPkmnMoveDescription(moveName) || text(raw.desc) || text(raw.shortDesc) || text(move.desc) || getMoveDescription(moveName, { type: text(move.type) || text(raw.type), category: text(move.category) || text(raw.category), power: numeric(move.bp) ?? numeric(raw.basePower) ?? numeric(raw.bp), accuracy: numeric(move.accuracy) ?? numeric(raw.accuracy), priority: typeof move.priority === "number" ? move.priority : (typeof raw.priority === "number" ? raw.priority : 0) }),
    };
  } catch {
    return null;
  }
}


/** Resolve the stat automatically selected by Protosynthesis / Quark Drive from the Pokémon's unboosted battle stats. */
export function getAutoBoostedStat(set: PokemonSet, generation = DEFAULT_GEN): NonNullable<PokemonSet["boostedStat"]> {
  try {
    const gen = getGen(generation);
    const pokemon = new Pokemon(gen, set.species, {
      item: set.item.trim() || undefined,
      nature: set.nature.trim() || undefined,
      level: set.level || 100,
      evs: set.evs,
      ivs: set.ivs,
    });
    const stats = (pokemon as unknown as { stats?: Record<string, number> }).stats || {};
    // Pokémon Showdown's tie priority for these abilities: Speed, Special Attack, Attack, Special Defense, Defense.
    const priority = ["spe", "spa", "atk", "spd", "def"] as const;
    return priority.reduce((best, stat) => (Number(stats[stat] || 0) > Number(stats[best] || 0) ? stat : best), priority[0]);
  } catch {
    return "spe";
  }
}

export function getPokemonHp(set: PokemonSet, generation = DEFAULT_GEN): { current: number; max: number } {
  try {
    const gen = getGen(generation);
    const pokemon = new Pokemon(gen, set.species, { level: set.level || 100, evs: set.evs, ivs: set.ivs, nature: set.nature || undefined });
    const max = pokemon.maxHP();
    return { max, current: Math.max(0, Math.min(max, Math.floor(set.currentHp ?? max))) };
  } catch { return { current: Math.max(0, Math.floor(set.currentHp ?? 0)), max: 0 }; }
}

export function getPokemonTypes(set: PokemonSet, generation = DEFAULT_GEN): string[] {
  try {
    const gen = getGen(generation);
    return [...new Pokemon(gen, set.species, {
      item: set.item.trim() || undefined,
      ability: set.ability.trim() || undefined,
      nature: set.nature.trim() || undefined,
      level: set.level || 100,
      teraType: resolveCalcType(set.teraType),
      evs: set.evs,
      ivs: set.ivs,
    }).types];
  } catch {
    return [];
  }
}
