import { calculate, Generations, Move, Pokemon, Field, TYPE_CHART } from "@smogon/calc";
import { getMove } from "./showdown-data";
import { Moves as OFFICIAL_SHOWDOWN_MOVES } from "./showdown-official/data/moves";
import { Moves as CHAMPIONS_MOVE_OVERRIDES } from "./showdown-official/data/mods/champions/moves";
import { getEffectiveMovePriority } from "./battle-order";
import { DamageSummary, FieldState, MoveDetails, PokemonSet, StatStages } from "./types";
import { buildDamageDistribution, medianDamageOutcome, scaleDamageOutcomes } from "./damage-distribution";
import Dex from "./showdown-official/sim/dex";

/** Read canonical English move descriptions from the live official Pokémon Showdown data. */
function getShowdownMoveDescription(name: string): string | undefined {
  try {
    const psMove = getMove(name);
    if (!psMove) return undefined;
    if (typeof psMove?.desc === "string" && psMove.desc.trim()) return psMove.desc.trim();
    if (typeof psMove?.shortDesc === "string" && psMove.shortDesc.trim()) return psMove.shortDesc.trim();
  } catch {
    // Fall back to calculator metadata for custom/unknown moves.
  }
  return undefined;
}

/** Defensive fallback for custom/unknown moves absent from the current live Showdown data. */
function getMoveDescription(
  name: string,
  metadata?: { type?: string; category?: string; power?: number | null; accuracy?: number | null; priority?: number },
): string {
  const type = metadata?.type && metadata.type !== "Unknown" ? `${metadata.type}-type` : "move";
  const category = metadata?.category && metadata.category !== "Unknown" ? ` ${metadata.category.toLowerCase()}` : "";
  const power = metadata?.power == null ? "variable or no direct" : `${metadata.power}-power`;
  const accuracy = metadata?.accuracy == null ? "variable" : `${metadata.accuracy}%`;
  const priority = metadata?.priority ? ` Its priority is ${metadata.priority > 0 ? "+" : ""}${metadata.priority}.` : "";
  return `${name} is a${category ? ` ${category.trim()}` : ""} ${type} move with ${power} base power and ${accuracy} accuracy.${priority} A full description is not available in the live Pokémon Showdown data.`;
}

const DEFAULT_GEN = 9;
const getGen = (generation: number) => {
  const generationNum = Math.max(1, Math.min(9, Math.round(generation || DEFAULT_GEN))) as Parameters<typeof Generations.get>[0];
  return Generations.get(generationNum);
};


/** Official Pokémon Showdown move metadata for the bundled Pokémon Champions mod. */
function getChampionsMoveData(moveName: string): Record<string, unknown> | null {
  try {
    const moveId = moveName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const overrides = CHAMPIONS_MOVE_OVERRIDES as unknown as Record<string, { isNonstandard?: unknown } | undefined>;
    const override = overrides[moveId];
    const move = Dex.mod("champions").moves.get(moveName) as unknown as Record<string, unknown>;
    if (!move || move.exists === false) return null;
    // An explicit nonstandard marker in the Champions mod means the move is
    // unavailable there. Do not reject an explicitly overridden move just
    // because its parent Gen 9 entry was marked Past (e.g. Anchor Shot).
    if (override?.isNonstandard) return null;
    if (!override && move.isNonstandard) return null;
    return move;
  } catch {
    return null;
  }
}

/** Adapt Champions move data to @smogon/calc's Gen 9 Move shape. */
function applyChampionsMoveData(move: Move, moveName: string): boolean {
  const data = getChampionsMoveData(moveName);
  if (!data) return false;
  const target = move as unknown as Record<string, unknown>;
  if (typeof data.basePower === "number") target.bp = data.basePower;
  if (typeof data.type === "string") target.type = data.type;
  if (typeof data.category === "string") target.category = data.category;
  if (typeof data.accuracy === "number") target.accuracy = data.accuracy;
  else if (data.accuracy === true) target.accuracy = 100;
  if (typeof data.priority === "number") target.priority = data.priority;
  if (data.flags && typeof data.flags === "object") target.flags = data.flags;
  return true;
}

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
 * Build a fresh field for each attacker-vs-defender calculation.
 * The UI's hazards/screens always belong to the current defender, regardless
 * of which team is attacking. Never reuse a Field instance: the calc engine
 * clones and can mutate side conditions for abilities such as Infiltrator.
 */
function makeField(state: FieldState) {
  return new Field({
    gameType: state.gameType || "Singles",
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
  includeCriticalRange = true,
): DamageSummary | null {
  if (!moveName.trim()) return null;

  const key = `${generation}|${includeCriticalRange ? "crit-range" : "no-crit-range"}|${cacheKey(attacker, defender, moveName, fieldState, attackerStages, defenderStages, critical)}`;
  const cached = getCached(key);
  if (cached !== undefined) return cached;

  try {
    // Gen 10 is the bundled Pokémon Champions ruleset. Do not silently calculate
    // a move that the official Champions mod marks as unavailable.
    if (generation >= 10 && !getChampionsMoveData(moveName)) return setCached(key, null);
    const gen = getGen(generation);
    const attackerPokemon = makePokemon(attacker, generation, { atk: attackerStages.atk, spa: attackerStages.spa, def: attackerStages.def, spd: attackerStages.spd, spe: attackerStages.spe }, fieldState);
    const defenderPokemon = makePokemon(defender, generation, { atk: defenderStages.atk, spa: defenderStages.spa, def: defenderStages.def, spd: defenderStages.spd, spe: defenderStages.spe }, fieldState);
    let move: Move;
    try {
      move = new Move(gen, moveName);
    } catch (error) {
      const championsData = generation >= 10 ? getChampionsMoveData(moveName) : null;
      if (!championsData) throw error;
      // Some Champions moves are absent from the Gen 9 calculator's move table.
      // Use a neutral move shell, then replace its move metadata below.
      move = new Move(gen, "Tackle");
      const shell = move as unknown as Record<string, unknown>;
      shell.name = typeof championsData.name === "string" ? championsData.name : moveName;
      shell.id = moveName.toLowerCase().replace(/[^a-z0-9]/g, "");
    }
    if (generation >= 10) applyChampionsMoveData(move, moveName);
    if (critical) (move as unknown as { isCrit: boolean }).isCrit = true;
    const field = makeField(fieldState);

    // Conditions represented by the field UI but not natively exposed by the
    // calculator are applied here, scoped to the selected attacker/defender.
    const moveType = String((move as unknown as { type?: string }).type || "");
    const moveCategory = String((move as unknown as { category?: string }).category || "");
    if (fieldState.protectSide === "defender" && !/feint|hyperspace|phantom force|shadow force|mighty cleave|breaking swipe/i.test(moveName)) {
      const maxHp = defenderPokemon.maxHP();
      const blocked: DamageSummary = { move: moveName, min: 0, max: 0, maxHp, medianDamage: 0, minPct: 0, maxPct: 0, rawMinPct: 0, rawMaxPct: 0, effectiveHp: maxHp, entryHazardDamage: 0, entryHazardPct: 0, ko: "No damage", description: `${moveName} is blocked by Protect.` };
      return setCached(key, blocked);
    }
    if (fieldState.powerTrickSide) {
      const target = fieldState.powerTrickSide === "attacker" ? attackerPokemon : defenderPokemon;
      const raw = (target as unknown as { rawStats?: Record<string, number> }).rawStats;
      if (raw && typeof raw.atk === "number" && typeof raw.def === "number") [raw.atk, raw.def] = [raw.def, raw.atk];
    }
    if (fieldState.foresightSide === "defender" && ["Normal", "Fighting"].includes(moveType) && defenderPokemon.types.includes("Ghost")) {
      (defenderPokemon.types as string[]).splice(defenderPokemon.types.indexOf("Ghost"), 1);
    }

    // Psychic Terrain blocks opposing positive-priority moves against grounded
    // targets. Airborne targets (e.g. Tornadus-Therian) remain hittable.
    const movePriority = Math.max(Number(move.priority ?? 0), getEffectiveMovePriority(attacker, moveName, fieldState));
    if (generation >= 7 && fieldState.terrain === "Psychic" && movePriority > 0 && isGroundedForHazards(defender, defenderPokemon)) {
      const maxHp = defenderPokemon.maxHP();
      const blocked: DamageSummary = {
        move: moveName,
        min: 0,
        max: 0,
        maxHp: maxHp,
        medianDamage: 0,
        minPct: 0,
        maxPct: 0,
        rawMinPct: 0,
        rawMaxPct: 0,
        effectiveHp: maxHp,
        entryHazardDamage: 0,
        entryHazardPct: 0,
        ko: "No damage",
        description: `${moveName} is blocked by Psychic Terrain because it has positive priority and the target is grounded.`,
      };
      return setCached(key, blocked);
    }

    const result = calculate(gen, attackerPokemon, defenderPokemon, move, field);

    const rawDamage = (result as unknown as { damage?: unknown }).damage;
    const distribution = buildDamageDistribution({ damage: rawDamage, moveName, accuracy: getMoveDetails(moveName, generation)?.accuracy ?? null, item: attacker.item, ability: attacker.ability, category: move.category, defenderAbility: defender.ability, weather: fieldState.weather, generation });
    if (critical && distribution?.note) distribution.note = distribution.note.replace(/Critical hits are excluded\.?/i, "The histogram is conditional on critical damage and does not include critical-hit probability.");
    let distributionOutcomes = distribution?.outcomes || [];
    const successfulOutcomes = distributionOutcomes.filter(outcome => outcome.damage > 0);
    const distributionRange = successfulOutcomes.length ? { min: Math.min(...successfulOutcomes.map(outcome => outcome.damage)), max: Math.max(...successfulOutcomes.map(outcome => outcome.damage)) } : null;
    const range = distributionRange || damageRange(rawDamage);
    if (!range) {
      return setCached(key, {
        move: moveName,
        min: 0,
        max: 0,
        maxHp: defenderPokemon.maxHP(),
        medianDamage: 0,
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

    const isMultiHitDistribution = Boolean(distribution?.isMultiHit);
    const rolls = Array.isArray(rawDamage) && rawDamage.every(value => typeof value === "number")
      ? [...new Set(rawDamage as number[])].sort((a, b) => a - b)
      : undefined;
    const maxHp = defenderPokemon.maxHP();

    // Critical damage is a second, explicit @smogon/calc run using the same
    // battle state. Do not derive it from the ordinary result with a multiplier:
    // critical hits can ignore stat stages and screens, and other mechanics may
    // alter the result. When the main calculation is already critical, its range
    // is the critical range, so no duplicate run is needed.
    let criticalRange: { min: number; max: number } | null = null;
    if (!critical && includeCriticalRange) {
      let criticalMove: Move;
      try {
        criticalMove = new Move(gen, moveName);
      } catch (error) {
        const championsData = generation >= 10 ? getChampionsMoveData(moveName) : null;
        if (!championsData) throw error;
        criticalMove = new Move(gen, "Tackle");
        const shell = criticalMove as unknown as Record<string, unknown>;
        shell.name = typeof championsData.name === "string" ? championsData.name : moveName;
        shell.id = moveName.toLowerCase().replace(/[^a-z0-9]/g, "");
      }
      if (generation >= 10) applyChampionsMoveData(criticalMove, moveName);
      (criticalMove as unknown as { isCrit: boolean }).isCrit = true;
      const criticalResult = calculate(
        gen,
        makePokemon(attacker, generation, { atk: attackerStages.atk, spa: attackerStages.spa, def: attackerStages.def, spd: attackerStages.spd, spe: attackerStages.spe }, fieldState),
        makePokemon(defender, generation, { atk: defenderStages.atk, spa: defenderStages.spa, def: defenderStages.def, spd: defenderStages.spd, spe: defenderStages.spe }, fieldState),
        criticalMove,
        makeField(fieldState),
      );
      criticalRange = damageRange((criticalResult as unknown as { damage?: unknown }).damage);
    }

    let conditionMultiplier = 1;
    if (fieldState.chargeSide === "attacker" && moveType === "Electric") conditionMultiplier *= 2;
    if (fieldState.helpingHandSide === "attacker") conditionMultiplier *= 1.5;
    if (fieldState.flowerGiftSide === "attacker" && fieldState.weather === "Sun" && moveCategory === "Physical") conditionMultiplier *= 1.5;
    if (fieldState.steelySpiritSide === "attacker" && moveType === "Steel") conditionMultiplier *= 1.5;
    if (fieldState.batterySide === "attacker" && moveCategory === "Special") conditionMultiplier *= 1.3;
    if (fieldState.powerSpotSide === "attacker") conditionMultiplier *= 1.3;
    if (fieldState.friendGuardSide === "defender") conditionMultiplier *= 0.75;
    const applyModifier = (damage: number) => Math.max(0, Math.floor(damage * conditionMultiplier + 0.5));
    if (conditionMultiplier !== 1) {
      if (distribution) {
        distribution.outcomes = scaleDamageOutcomes(distribution.outcomes, applyModifier);
        distributionOutcomes = distribution.outcomes;
        if (distribution.firstHitMin !== undefined) distribution.firstHitMin = applyModifier(distribution.firstHitMin);
        if (distribution.firstHitMax !== undefined) distribution.firstHitMax = applyModifier(distribution.firstHitMax);
      }
      range.min = applyModifier(range.min);
      range.max = applyModifier(range.max);
      if (rolls) for (let i = 0; i < rolls.length; i++) rolls[i] = applyModifier(rolls[i]);
      if (criticalRange) { criticalRange.min = applyModifier(criticalRange.min); criticalRange.max = applyModifier(criticalRange.max); }
    }

    // Derive displayed ranges and the median only after all deterministic field
    // modifiers have been applied to the range and probability distribution.
    const min = range.min;
    const max = range.max;
    const medianOutcomes = isMultiHitDistribution ? (distribution?.outcomes || []).filter(outcome => outcome.damage > 0) : distribution?.outcomes || [];
    const medianDamage = medianOutcomes.length ? medianDamageOutcome(medianOutcomes) : Math.floor((min + max) / 2);

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
    const toxicKoNote = (() => {
      if (!toxicDamage) return "";
      const directPossible = max + entryHazardDamage >= maxHp;
      const toxicPossible = max + entryHazardDamage + toxicDamage >= maxHp;
      if (!distributionOutcomes.length) {
        const directGuaranteed = min + entryHazardDamage >= maxHp;
        const toxicGuaranteed = min + entryHazardDamage + toxicDamage >= maxHp;
        if (toxicGuaranteed && !directGuaranteed) return " (guaranteed OHKO after toxic damage)";
        if (!directPossible && toxicPossible) return " (possible OHKO after toxic damage; exact roll chance unavailable)";
        return "";
      }
      const directChance = distributionOutcomes.reduce((sum, outcome) => sum + (outcome.damage + entryHazardDamage >= maxHp ? outcome.probability : 0), 0);
      const afterChance = distributionOutcomes.reduce((sum, outcome) => sum + (outcome.damage + entryHazardDamage + toxicDamage >= maxHp ? outcome.probability : 0), 0);
      if (afterChance >= 0.999999 && directChance < 0.999999) return " (guaranteed OHKO after toxic damage)";
      if (afterChance > directChance) return ` (${(afterChance * 100).toFixed(1)}% chance to OHKO after toxic damage)`;
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
      fieldState.nightmareSide === "defender" && defender.status === "slp" ? "Nightmare is active on the sleeping defender; its residual damage is not included in direct move damage." : "",
      fieldState.switchingOutSide === "defender" ? "The defender is marked as switching out; switch-dependent move effects may differ." : "",
      fieldState.helpingHandSide === "attacker" ? "Helping Hand damage boost applied." : "",
      fieldState.chargeSide === "attacker" && moveType === "Electric" ? "Charge doubles the next Electric move's damage." : "",
      fieldState.flowerGiftSide === "attacker" && fieldState.weather === "Sun" && moveCategory === "Physical" ? "Flower Gift Attack boost applied in sun." : "",
      fieldState.steelySpiritSide === "attacker" && moveType === "Steel" ? "Steely Spirit damage boost applied." : "",
      fieldState.batterySide === "attacker" && moveCategory === "Special" ? "Battery Special move boost applied." : "",
      fieldState.powerSpotSide === "attacker" ? "Power Spot damage boost applied." : "",
      fieldState.friendGuardSide === "defender" ? "Friend Guard damage reduction applied." : "",
    ].filter(Boolean).join(" ");
    const nativeHazardDescription = /after (stealth rock|spikes|entry hazards)/i.test(baseDescription);
    const appendedHazardText = entryHazardDamage > 0 && !nativeHazardDescription ? ` ${hazardText}` : "";

    return setCached(key, {
      move: moveName,
      min,
      max,
      maxHp,
      medianDamage,
      rolls,
      ...(distribution ? { histogram: distribution.outcomes, hitCounts: distribution.hitCounts, accuracy: distribution.accuracy, distributionApproximate: distribution.approximate, distributionNote: distribution.note, ...(distribution.firstHitMin !== undefined && maxHp > 0 ? { firstHitMinPct: distribution.firstHitMin / maxHp * 100 } : {}), ...(distribution.firstHitMax !== undefined && maxHp > 0 ? { firstHitMaxPct: distribution.firstHitMax / maxHp * 100 } : {}) } : {}),
      minPct,
      maxPct,
      ...(criticalRange ? {
        critMinPct: (criticalRange.min / maxHp) * 100,
        critMaxPct: (criticalRange.max / maxHp) * 100,
      } : {}),
      rawMinPct,
      rawMaxPct,
      effectiveHp,
      entryHazardDamage,
      entryHazardPct,
      // KO estimates use the Pokémon's current HP, while the displayed damage percentages above remain max-HP based.
      ko: isMultiHitDistribution
        ? (() => { const medianKo = koLabel((medianDamage / effectiveHp) * 100, (medianDamage / effectiveHp) * 100); return medianKo === "No damage" ? medianKo : `Median ${medianKo}`; })()
        : koLabel((min / effectiveHp) * 100, (max / effectiveHp) * 100),
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
    const championsData = generation >= 10 ? getChampionsMoveData(moveName) : null;
    if (generation >= 10 && !championsData) return null;
    const gen = getGen(generation);
    let move: Record<string, unknown>;
    try {
      move = new Move(gen, moveName) as unknown as Record<string, unknown>;
    } catch (error) {
      if (!championsData) throw error;
      move = new Move(gen, "Tackle") as unknown as Record<string, unknown>;
      move.name = typeof championsData.name === "string" ? championsData.name : moveName;
    }
    const moveTable = (gen as unknown as { moves?: { get?: (name: string) => unknown } }).moves;
    const raw = (moveTable?.get?.(moveName) || {}) as Record<string, unknown>;
    const text = (value: unknown) => typeof value === "string" ? value : "";
    const numeric = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
    // Showdown uses `accuracy: true` for moves that do not make a normal
    // accuracy check. Represent that as 100 in this UI-facing numeric field;
    // special accuracy rules (e.g. weather or abilities) are handled elsewhere.
    const accuracyValue = (value: unknown) => value === true ? 100 : numeric(value);
    // @smogon/calc can expose a default accuracy (often 100) for a Move even
    // when the move's real accuracy is lower. Prefer the bundled canonical
    // Showdown table for the current generation. For older generations, use
    // the generation-specific calculator move table first so changed historical
    // values are not overwritten by modern data. The `unknown` bridge is
    // intentional: Showdown's MoveDataTable uses branded ID keys rather than
    // a plain string index signature, while this normalized ID is a runtime key.
    const moveId = moveName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const officialMoves = OFFICIAL_SHOWDOWN_MOVES as unknown as Record<string, { accuracy?: unknown }>;
    const officialMove = officialMoves[moveId];
    const loadedMove = getMove(moveName);
    const accuracy = generation >= 10
      ? accuracyValue(championsData?.accuracy) ?? accuracyValue(officialMove?.accuracy) ?? accuracyValue(loadedMove?.accuracy) ?? accuracyValue(raw.accuracy) ?? accuracyValue(move.accuracy) ?? (moveId === "anchorshot" ? 100 : null)
      : generation >= 9
        ? accuracyValue(officialMove?.accuracy) ?? accuracyValue(loadedMove?.accuracy) ?? accuracyValue(raw.accuracy) ?? accuracyValue(move.accuracy)
        : accuracyValue(raw.accuracy) ?? accuracyValue(move.accuracy) ?? accuracyValue(loadedMove?.accuracy) ?? accuracyValue(officialMove?.accuracy);
    const resolvedName = text(championsData?.name) || text(move.name) || moveName;
    const resolvedType = text(championsData?.type) || text(move.type) || text(raw.type) || "Unknown";
    const resolvedCategory = text(championsData?.category) || text(move.category) || text(raw.category) || "Unknown";
    const resolvedPower = numeric(championsData?.basePower) ?? numeric(move.bp) ?? numeric(raw.basePower) ?? numeric(raw.bp);
    const resolvedPriority = typeof championsData?.priority === "number" ? championsData.priority : typeof move.priority === "number" ? move.priority : (typeof raw.priority === "number" ? raw.priority : 0);
    return {
      name: resolvedName,
      type: resolvedType,
      category: resolvedCategory,
      power: resolvedPower,
      accuracy,
      pp: numeric(championsData?.pp) ?? numeric(move.pp) ?? numeric(raw.pp),
      priority: resolvedPriority,
      target: text(championsData?.target) || text(raw.target) || text((move as unknown as Record<string, unknown>).target),
      description: text(championsData?.desc) || text(championsData?.shortDesc) || getShowdownMoveDescription(moveName) || text(raw.desc) || text(raw.shortDesc) || text(move.desc) || getMoveDescription(moveName, { type: resolvedType, category: resolvedCategory, power: resolvedPower, accuracy, priority: resolvedPriority }),
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
