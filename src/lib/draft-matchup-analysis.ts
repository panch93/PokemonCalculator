import { calculateMove, getMoveDetails, getPokemonHp } from "./calc";
import { getEffectiveMovePriority, getEffectiveSpeed } from "./battle-order";
import { getChampionsSpeciesLearnset, getHistoricalSpeciesLearnset, getMove, getSpecies, loadShowdownData } from "./showdown-data";
import { getMaxIVs, type DamageSummary, type FieldState, type MoveDetails, type PokemonSet, type StatId, type Stats } from "./types";
import { DRAFT_STRONG_HIT_THRESHOLD, DRAFT_WALL_THRESHOLD, isEligibleDraftMove, passesDraftMoveFilters } from "./draft-matchup-rules";
import supportCategories from "../data/support-categories.json";

export { DRAFT_STRONG_HIT_THRESHOLD, DRAFT_WALL_THRESHOLD } from "./draft-matchup-rules";
const MAX_MOVES_PER_TYPE_CATEGORY = 3;
export type DraftMoveFilter = { minAccuracy: number; minPriority: number; whitelist: string[]; blacklist: string[] };
export const DEFAULT_DRAFT_MOVE_FILTER: DraftMoveFilter = {
  minAccuracy: 75,
  minPriority: 0,
  whitelist: [],
  // These are commonly conditional, lock-in, charge, or opponent-boosting
  // moves. They remain available when explicitly entered in a known moveset.
  blacklist: [
    "Swagger", "Outrage", "Thrash", "Petal Dance", "Uproar",
    "Rollout", "Ice Ball", "Rage", "Fury Cutter", "Echoed Voice",
    "Solar Beam", "Solar Blade", "Skull Bash", "Sky Attack", "Razor Wind",
    "Fly", "Dig", "Dive", "Bounce", "Phantom Force", "Shadow Force",
    "Meteor Beam", "Electro Shot", "Geomancy", "Hyper Beam", "Giga Impact",
  ],
};
const moveId = (value: string) => normalize(value);
const CHUNK_SIZE = 16;

export type DraftStatConfig = { ev: number; nature: "boost" | "neutral" | "hinder"; stage: number };
export type DraftPokemonProfile = {
  species: string;
  ability?: string;
  item?: string;
  moves?: string[];
  /** Include Stellar when the captain selected Stellar; it affects offensive STAB but not defensive typing. */
  teraType?: string;
  /** Configured EVs (or Champions Stat Points), natures, and stages from the draft editor. */
  stats?: Partial<Record<StatId, DraftStatConfig>>;
  championsMode?: boolean;
  level?: number;
  alliesFainted?: number;
};
export type DraftMoveThreat = {
  move: string;
  type: string;
  category: string;
  minPct: number;
  maxPct: number;
  chance70: number;
  chanceKo?: number;
  accuracy: number;
  stab: boolean;
  approximate: boolean;
  /** Raw move priority (used by move filters). */
  priority: number;
  /** Effective priority after ability and selected-field modifiers. */
  effectivePriority?: number;
};
export type DraftOpponentResult = {
  species: string;
  bestAttack?: DraftMoveThreat;
  bestStabAttack?: DraftMoveThreat;
  bestReply?: DraftMoveThreat;
  bestStabReply?: DraftMoveThreat;
  selectedAttacks?: DraftMoveThreat[];
  selectedReplies?: DraftMoveThreat[];
  /** Best damage option at each effective priority bracket, used for turn-order checks. */
  priorityAttacks?: DraftMoveThreat[];
  priorityReplies?: DraftMoveThreat[];
  threat: boolean;
  reliablyThreatens: boolean;
  wallsAttacker: boolean;
  attackerWalls: boolean;
  checkedByAttacker: boolean;
};

export type DraftSetupSweepTarget = {
  species: string;
  bestMove?: DraftMoveThreat;
  bestMoveMaxPct: number;
  incomingMove?: string;
  incomingMaxPct: number;
  afterSetupIncomingMaxPct: number;
  setupTurnSpeed: number;
  attackerSpeed: number;
  opponentSpeed: number;
  opponentActsBeforeSetup: boolean;
  canSetUp: boolean;
  canContinueAfterSetup: boolean;
  plausibleSweepTarget: boolean;
  afterSetupIncomingMove?: string;
  afterSetupTurnOrderReason?: string;
  setupMoveName?: string;
  setupMoveDamagePct?: number;
  startingOpponentHpPct?: number;
  removedBySetup?: boolean;
  setupMoveKoChance?: number;
  setupMoveKoGuaranteed?: boolean;
  attackerActsFirstAfterSetup?: boolean;
  estimatedTurnsToKo?: number;
  estimatedIncomingHits?: number;
  sweepOrder?: number;
  remainingHpPct?: number;
  wearDown?: boolean;
  stoppedReason?: string;
};
export type DraftSetupSweep = {
  move: string;
  itemAssumption?: string;
  boosts: Partial<Record<StatId, number>>;
  setupCostPct: number;
  boostChance?: number;
  setupOpportunitySpecies?: string;
  setupRemainingHpPct?: number;
  stoppedBySpecies?: string;
  stoppedByReason?: string;
  targets: DraftSetupSweepTarget[];
  plausibleTargets: number;
};

export type DraftMatchupAnalysis = {
  attacker: string;
  opponents: DraftOpponentResult[];
  setupSweeps: DraftSetupSweep[];
  movesEvaluated: number;
  approximate: true;
  note: string;
};

const blankField: FieldState = {
  weather: "", terrain: "", defenderStealthRock: false, defenderSpikes: 0,
  defenderReflect: false, defenderLightScreen: false, defenderAuroraVeil: false,
  defenderLeechSeed: false, defenderSaltCure: false, trickRoom: false, tailwindSide: "",
};
const fullIvs = (): Stats => getMaxIVs();
const statId = (category: string): StatId => category === "Special" ? "spa" : "atk";
const defenseId = (category: string): StatId => category === "Special" ? "spd" : "def";
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const candidatePowerScore = (move: MoveDetails) => move.power != null && move.power > 0 ? move.power : 60;

/** Keep the strongest few options per type/category to bound hover latency. */
export function selectDraftCandidateMoves(moveNames: Iterable<string>, generation = 9, filter: DraftMoveFilter = DEFAULT_DRAFT_MOVE_FILTER): MoveDetails[] {
  const groups = new Map<string, MoveDetails[]>();
  for (const name of moveNames) {
    const details = getMoveDetails(name, generation);
    if (!isEligibleDraftMove(details)) continue;
    if (!passesDraftMoveFilters(details, filter)) continue;
    const key = `${details.type}|${details.category}`;
    const group = groups.get(key) || [];
    group.push(details);
    groups.set(key, group);
  }
  return [...groups.values()]
    .flatMap(group => {
      const ordered = group.sort((a, b) => (candidatePowerScore(b) * (b.accuracy ?? 100)) - (candidatePowerScore(a) * (a.accuracy ?? 100)));
      const forced = ordered.filter(move => filter.whitelist.some(name => moveId(name) === moveId(move.name)));
      const ordinary = ordered.filter(move => !forced.includes(move)).slice(0, MAX_MOVES_PER_TYPE_CATEGORY);
      return [...forced, ...ordinary];
    })
    .sort((a, b) => candidatePowerScore(b) - candidatePowerScore(a));
}

const moveCache = new Map<string, MoveDetails[]>();
const analysisCache = new Map<string, DraftMatchupAnalysis>();
const bestAttackCache = new Map<string, { best?: DraftMoveThreat; bestStab?: DraftMoveThreat; selected?: DraftMoveThreat[]; byPriority?: DraftMoveThreat[] }>();
function candidateMoves(species: string, generation: number, filter: DraftMoveFilter): MoveDetails[] {
  const key = `${generation}:${normalize(species)}:${JSON.stringify(filter)}`;
  const cached = moveCache.get(key);
  if (cached) return cached;
  const learnset = generation >= 10
    ? (getChampionsSpeciesLearnset(species) || getHistoricalSpeciesLearnset(species))
    : getHistoricalSpeciesLearnset(species);
  const moves = selectDraftCandidateMoves(learnset || [], generation, filter);
  // An empty learnset can mean the bundled Showdown tables have not finished
  // loading yet. Never memoize that transient state as a genuine no-moves result.
  if (moves.length > 0) moveCache.set(key, moves);
  return moves;
}

const STAT_IDS: StatId[] = ["hp", "atk", "def", "spa", "spd", "spe"];
const defaultStatConfig: DraftStatConfig = { ev: 0, nature: "neutral", stage: 0 };

/** Champions stat points map to the EV term used by the compatible Gen 9 calculator. */
export function championsStatPointsToCalcEvs(value: number): number {
  const points = Math.max(0, Math.min(32, Math.round(Number(value) || 0)));
  return points === 0 ? 0 : (2 * points - 1) * 4;
}

function configFor(profile: DraftPokemonProfile, stat: StatId): DraftStatConfig {
  const config = profile.stats?.[stat] || defaultStatConfig;
  const maximum = profile.championsMode ? 32 : 252;
  return {
    ev: Math.max(0, Math.min(maximum, Math.round(Number(config.ev) || 0))),
    nature: config.nature || "neutral",
    stage: Math.max(-6, Math.min(6, Math.round(Number(config.stage) || 0))),
  };
}

function calcEvs(profile: DraftPokemonProfile, stat: StatId): number {
  const value = configFor(profile, stat).ev;
  return profile.championsMode ? championsStatPointsToCalcEvs(value) : value;
}

function natureForStat(stat: StatId, effect: DraftStatConfig["nature"]): string {
  if (effect === "neutral" || stat === "hp") return "Hardy";
  const natures: Record<string, { boost: string; hinder: string }> = {
    atk: { boost: "Adamant", hinder: "Modest" }, spa: { boost: "Modest", hinder: "Adamant" },
    def: { boost: "Bold", hinder: "Lonely" }, spd: { boost: "Calm", hinder: "Naughty" },
    spe: { boost: "Timid", hinder: "Brave" },
  };
  return natures[stat]?.[effect] || "Hardy";
}

function stagesFor(profile: DraftPokemonProfile) {
  return {
    atk: configFor(profile, "atk").stage,
    def: configFor(profile, "def").stage,
    spa: configFor(profile, "spa").stage,
    spd: configFor(profile, "spd").stage,
    spe: configFor(profile, "spe").stage,
    acc: 0, eva: 0,
  };
}

function makeDraftSet(profile: DraftPokemonProfile, move: MoveDetails, role: "attacker" | "defender"): PokemonSet {
  const relevantStat = role === "attacker" ? statId(move.category) : defenseId(move.category);
  const relevantConfig = configFor(profile, relevantStat);
  const evs = Object.fromEntries(STAT_IDS.map(stat => [stat, calcEvs(profile, stat)])) as Stats;
  return {
    name: profile.species,
    species: profile.species,
    item: profile.item || "",
    ability: profile.ability || "",
    alliesFainted: Math.max(0, Math.min(5, profile.alliesFainted || 0)),
    nature: natureForStat(relevantStat, relevantConfig.nature),
    level: profile.level || (profile.championsMode ? 50 : 100),
    teraType: profile.teraType || "",
    evs,
    ivs: fullIvs(),
    moves: [],
  };
}

function summarizeMove(move: MoveDetails, result: DamageSummary, attacker: DraftPokemonProfile, defender: PokemonSet, generation: number): DraftMoveThreat {
  const maxHp = getPokemonHp(defender, generation).max || 1;
  const originalTypes = getSpecies(attacker.species)?.types || [];
  const stab = originalTypes.includes(move.type) || attacker.teraType === move.type;
  const thresholdHp = maxHp * (DRAFT_STRONG_HIT_THRESHOLD / 100);
  const chance70 = (result.histogram || []).reduce((sum, outcome) => sum + (outcome.damage >= thresholdHp ? outcome.probability : 0), 0) * 100;
  const chanceKo = (result.histogram || []).reduce((sum, outcome) => sum + (outcome.damage >= maxHp ? outcome.probability : 0), 0) * 100;
  return {
    move: move.name,
    type: move.type,
    category: move.category,
    minPct: result.minPct,
    maxPct: result.maxPct,
    chance70,
    chanceKo,
    accuracy: result.accuracy ?? move.accuracy ?? 100,
    stab,
    approximate: Boolean(result.distributionApproximate),
    priority: move.priority,
  };
}

function isBetterMove(candidate: DraftMoveThreat, current?: DraftMoveThreat): boolean {
  if (!current) return true;
  if (candidate.maxPct !== current.maxPct) return candidate.maxPct > current.maxPct;
  if (candidate.chance70 !== current.chance70) return candidate.chance70 > current.chance70;
  return candidate.minPct > current.minPct;
}

function isGroundedProfile(profile: DraftPokemonProfile): boolean {
  const types = profile.teraType ? [profile.teraType] : getSpecies(profile.species)?.types || [];
  const ability = normalize(profile.ability || "");
  const item = normalize(profile.item || "");
  return !types.includes("Flying") && ability !== "levitate" && item !== "airballoon";
}

function priorityMoveIsBlocked(attacker: DraftPokemonProfile, defender: DraftPokemonProfile, move: string, fieldState: FieldState, generation: number): boolean {
  if (getEffectiveMovePriority(speedSetFor(attacker), move, fieldState) <= 0) return false;
  const defenderAbility = normalize(defender.ability || "");
  const attackerAbility = normalize(attacker.ability || "");
  const bypassesAbilities = ["moldbreaker", "teravolt", "turboblaze"].includes(attackerAbility);
  if (!bypassesAbilities && ["dazzling", "queenlymajesty", "armortail"].includes(defenderAbility)) return true;
  return generation >= 7 && fieldState.terrain === "Psychic" && isGroundedProfile(defender);
}

async function bestAttack(
  attackerProfile: DraftPokemonProfile,
  defenderProfile: DraftPokemonProfile,
  generation: number,
  counters: { evaluated: number },
  isCancelled: () => boolean,
  filter: DraftMoveFilter,
  fieldState: FieldState,
): Promise<{ best?: DraftMoveThreat; bestStab?: DraftMoveThreat; selected?: DraftMoveThreat[]; byPriority?: DraftMoveThreat[] }> {
  // Resolve move data before consulting caches. Analysis can be requested while
  // the UI is still loading bundled Showdown tables; caching an empty pre-load
  // result made the analysis appear permanently blank for that page session.
  await loadShowdownData();
  // A complete four-move set is authoritative: do not spend time exploring
  // hypothetical alternatives when all move slots are already known.
  const manualMoves = (attackerProfile.moves || [])
    .filter(Boolean)
    .map(name => getMoveDetails(name, generation))
    // Explicitly entered moves are authoritative: analysis filters only trim
    // hypothetical learnset candidates, never a move in the Pokémon's set.
    .filter((move): move is MoveDetails => Boolean(move && isEligibleDraftMove(move)));
  const hasCompleteMoveset = (attackerProfile.moves || []).filter(Boolean).length >= 4;
  const manualStabByType = new Map<string, number>();
  const speciesTypes = getSpecies(attackerProfile.species)?.types || [];
  for (const move of manualMoves) {
    if (speciesTypes.includes(move.type) || attackerProfile.teraType === move.type) {
      const score = candidatePowerScore(move);
      manualStabByType.set(move.type, Math.max(manualStabByType.get(move.type) ?? -1, score));
    }
  }
  const discoveredMoves = hasCompleteMoveset ? [] : candidateMoves(attackerProfile.species, generation, filter).filter(move => {
    // Avoid filling unknown slots with weaker same-type STAB options when a
    // known move already covers that type. Stronger learnable upgrades remain
    // eligible, as do non-STAB coverage moves and other move categories.
    const knownStabScore = manualStabByType.get(move.type);
    if (knownStabScore === undefined) return true;
    const isStab = speciesTypes.includes(move.type) || attackerProfile.teraType === move.type;
    return !isStab || candidatePowerScore(move) > knownStabScore;
  });
  const seenMoves = new Set<string>();
  const moves = [...manualMoves, ...discoveredMoves].filter(move => {
    const id = normalize(move.name);
    if (seenMoves.has(id)) return false;
    seenMoves.add(id);
    return true;
  });
  const cacheKey = JSON.stringify(["loaded-data-v5", generation, attackerProfile, defenderProfile, filter, fieldState, moves.map(move => normalize(move.name))]);
  const cached = bestAttackCache.get(cacheKey);
  if (cached) return cached;
  let best: DraftMoveThreat | undefined;
  let bestStab: DraftMoveThreat | undefined;
  const selected: DraftMoveThreat[] = [];
  const byPriority = new Map<number, DraftMoveThreat>();
  const manualIds = new Set(manualMoves.map(move => normalize(move.name)));
  for (let index = 0; index < moves.length; index++) {
    if (isCancelled()) return {};
    const move = moves[index];
    if (priorityMoveIsBlocked(attackerProfile, defenderProfile, move.name, fieldState, generation)) continue;
    const attacker = makeDraftSet(attackerProfile, move, "attacker");
    const defender = makeDraftSet(defenderProfile, move, "defender");
    const result = calculateMove(attacker, defender, move.name, fieldState, stagesFor(attackerProfile), stagesFor(defenderProfile), false, generation, false);
    counters.evaluated++;
    if (result) {
      const effectivePriority = getEffectiveMovePriority(attacker, move.name, fieldState);
      const candidate = { ...summarizeMove(move, result, attackerProfile, defender, generation), effectivePriority };
      if (manualIds.has(normalize(move.name))) selected.push(candidate);
      if (isBetterMove(candidate, best)) best = candidate;
      if (candidate.stab && isBetterMove(candidate, bestStab)) bestStab = candidate;
      if (isBetterMove(candidate, byPriority.get(effectivePriority))) byPriority.set(effectivePriority, candidate);
    }
    if ((index + 1) % CHUNK_SIZE === 0) await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  const result = { best, bestStab, selected, byPriority: [...byPriority.values()] };
  bestAttackCache.set(cacheKey, result);
  if (bestAttackCache.size > 4096) bestAttackCache.delete(bestAttackCache.keys().next().value || "");
  return result;
}

function speedSetFor(profile: DraftPokemonProfile): PokemonSet {
  const evs = Object.fromEntries(STAT_IDS.map(stat => [stat, calcEvs(profile, stat)])) as Stats;
  return {
    name: profile.species, species: profile.species, item: profile.item || "", ability: profile.ability || "",
    nature: natureForStat("spe", configFor(profile, "spe").nature), level: profile.level || (profile.championsMode ? 50 : 100),
    evs, ivs: fullIvs(), moves: [],
  };
}

/** Effective Speed used by the draft analysis for the configured EVs, nature, item, ability and field. */
export function getDraftProfileEffectiveSpeed(profile: DraftPokemonProfile, fieldState: FieldState, side: "attacker" | "defender" = "attacker"): number {
  const set = speedSetFor(profile);
  return getEffectiveSpeed(set, fieldState, side, configFor(profile, "spe").stage);
}

function setupMoveCandidates(species: string, generation: number, filter: DraftMoveFilter, knownMoves: string[] = []): Array<{ name: string; boosts: Partial<Record<StatId, number>>; priority: number; costPct: number; boostChance: number }> {
  const completeMoveset = knownMoves.filter(Boolean).length >= 4;
  const learnset = generation >= 10
    ? (getChampionsSpeciesLearnset(species) || getHistoricalSpeciesLearnset(species))
    : getHistoricalSpeciesLearnset(species);
  const knownIds = new Set(knownMoves.filter(Boolean).map(moveId));
  const sharedSetupMoves = (supportCategories.find(category => category.id === "setup")?.moves || []) as string[];
  const sharedSetupIds = new Set(sharedSetupMoves.map(moveId));
  const candidates = completeMoveset ? knownMoves.filter(Boolean) : [...new Set([...(learnset || []), ...knownMoves.filter(Boolean)])];
  const result: Array<{ name: string; boosts: Partial<Record<StatId, number>>; priority: number; costPct: number; boostChance: number }> = [];
  for (const name of candidates) {
    const metadata = getMove(name) as (Record<string, unknown> & {
      boosts?: Record<string, number>;
      secondary?: { chance?: number; self?: { boosts?: Record<string, number> } };
      self?: { boosts?: Record<string, number> };
      selfBoost?: { boosts?: Record<string, number> };
    }) | undefined;
    const id = moveId(name);
    if (!sharedSetupIds.has(id) || id === "swagger" || id === "decorate") continue;
    const selfBoosts = metadata?.self?.boosts || metadata?.selfBoost?.boosts || metadata?.secondary?.self?.boosts;
    const boosts = metadata?.boosts || selfBoosts || (id === "bellydrum" ? { atk: 6 } : id === "stockpile" ? { def: 1, spd: 1 } : undefined);
    if (!boosts) continue;
    if (id === "curse" && (getSpecies(species)?.types || []).includes("Ghost")) continue;
    // Two-turn charge moves need a separate charge-turn / Power Herb model.
    if ((metadata?.flags as Record<string, unknown> | undefined)?.charge) continue;
    const positive = Object.entries(boosts).filter(([, value]) => typeof value === "number" && value > 0);
    // Defensive-only setup (Iron Defense, Amnesia, Stockpile, etc.) is also
    // relevant: it can let a bulky Pokémon survive repeated exchanges and win
    // through accumulated damage even without an offensive stat boost.
    if (!positive.length) continue;
    const details = getMoveDetails(name, generation);
    if (!details) continue;
    if (!knownIds.has(id) && (filter.blacklist.some(value => moveId(value) === id) || !passesDraftMoveFilters(details, filter))) continue;
    const mapped: Partial<Record<StatId, number>> = {};
    for (const [stat, value] of Object.entries(boosts)) {
      if (["atk", "def", "spa", "spd", "spe"].includes(stat) && typeof value === "number") mapped[stat as StatId] = Math.max(-6, Math.min(6, value));
    }
    const costPct = id === "bellydrum" || id === "filletaway" ? 50 : id === "clangoroussoul" ? 33 : 0;
    const boostChance = typeof metadata?.secondary?.chance === "number" && metadata.secondary.self?.boosts ? metadata.secondary.chance : 100;
    if (Object.keys(mapped).length) result.push({ name: details.name, boosts: mapped, priority: details.priority, costPct, boostChance });
  }
  const score = (entry: { boosts: Partial<Record<StatId, number>> }) =>
    Object.entries(entry.boosts).reduce((sum, [stat, value]) => sum + Math.max(0, Number(value) || 0) + (stat === "spe" ? 0.5 * Math.max(0, Number(value) || 0) : 0), 0);
  return result.sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name)).slice(0, 16);
}

function withSetupBoosts(profile: DraftPokemonProfile, boosts: Partial<Record<StatId, number>>): DraftPokemonProfile {
  const stats = { ...profile.stats };
  for (const [stat, amount] of Object.entries(boosts) as Array<[StatId, number]>) {
    const current = stats[stat] || defaultStatConfig;
    const whiteHerbPreventsDrop = moveId(profile.item || "") === "whiteherb" && amount < 0;
    stats[stat] = { ...current, stage: Math.max(-6, Math.min(6, current.stage + (whiteHerbPreventsDrop ? 0 : amount))) };
  }
  return { ...profile, stats };
}

/**
 * Analyze one hovered draft Pokémon against the opposing roster using the
 * configured EVs/Champions Stat Points, natures, and stat stages on both sides.
 * Configured items, abilities, and supported field effects are included; results remain matchup estimates based on the selected or learnable move pool.
 */
export async function analyzeDraftPokemon(
  attacker: DraftPokemonProfile,
  opponents: DraftPokemonProfile[],
  generation = 9,
  isCancelled: () => boolean = () => false,
  filter: DraftMoveFilter = DEFAULT_DRAFT_MOVE_FILTER,
  fieldState: FieldState = blankField,
  includeSetupAnalysis = false,
): Promise<DraftMatchupAnalysis> {
  // The calculator's move/species metadata and the learnset resolver share the
  // bundled data loader. Await it before any cache lookup or calculation.
  await loadShowdownData();
  const cacheKey = JSON.stringify(["loaded-data-v5", generation, attacker, opponents, filter, fieldState, includeSetupAnalysis]);
  const cached = analysisCache.get(cacheKey);
  if (cached) return cached;
  const counters = { evaluated: 0 };
  const results: DraftOpponentResult[] = [];
  for (const opponent of opponents) {
    if (isCancelled()) break;
    const [outgoing, reply] = await Promise.all([
      bestAttack(attacker, opponent, generation, counters, isCancelled, filter, fieldState),
      bestAttack(opponent, attacker, generation, counters, isCancelled, filter, fieldState),
    ]);
    if (isCancelled()) break;
    const bestDamage = outgoing.best?.maxPct ?? 0;
    const replyDamage = reply.best?.maxPct ?? 0;
    results.push({
      species: opponent.species,
      bestAttack: outgoing.best,
      bestStabAttack: outgoing.bestStab,
      bestReply: reply.best,
      bestStabReply: reply.bestStab,
      selectedAttacks: outgoing.selected || [],
      selectedReplies: reply.selected || [],
      priorityAttacks: outgoing.byPriority || [],
      priorityReplies: reply.byPriority || [],
      threat: bestDamage >= DRAFT_STRONG_HIT_THRESHOLD,
      reliablyThreatens: Boolean(outgoing.best && outgoing.best.minPct >= DRAFT_STRONG_HIT_THRESHOLD && outgoing.best.accuracy >= 100),
      wallsAttacker: Boolean(outgoing.best && bestDamage <= DRAFT_WALL_THRESHOLD),
      attackerWalls: Boolean(reply.best && replyDamage <= DRAFT_WALL_THRESHOLD),
      checkedByAttacker: Boolean(outgoing.best && bestDamage < 50),
    });
    // Yield once per opponent pair as well as within long move loops, keeping
    // pointer movement and other UI interactions responsive on large rosters.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  const setupSweeps: DraftSetupSweep[] = [];
  const itemId = moveId(attacker.item || "");
  const itemPreventsSetup = itemId === "assaultvest" || ["choiceband", "choicespecs", "choicescarf"].includes(itemId);
  const setupMoves = includeSetupAnalysis && !itemPreventsSetup ? setupMoveCandidates(attacker.species, generation, filter, attacker.moves || []) : [];
  if (setupMoves.length && opponents.length) {
    const hasUnknownItem = !attacker.item?.trim();
    for (const setup of setupMoves) {
      if (isCancelled()) break;
      const hasNegativeBoost = Object.values(setup.boosts).some(value => Number(value) < 0);
      const itemVariants: Array<{ profile: DraftPokemonProfile; label: string }> = [
        { profile: attacker, label: attacker.item?.trim() || "Item unknown" },
      ];
      if (hasUnknownItem && hasNegativeBoost) itemVariants.push({ profile: { ...attacker, item: "White Herb" }, label: "White Herb assumption" });
      for (const itemVariant of itemVariants) {
      if (isCancelled()) break;
      const setupProfile = itemVariant.profile;
      const attackerSpeedSet = speedSetFor(setupProfile);
      const boostedProfile = withSetupBoosts(setupProfile, setup.boosts);
      const boostedSpeedSet = speedSetFor(boostedProfile);
      const targets: DraftSetupSweepTarget[] = [];
      for (const opponent of opponents) {
        if (isCancelled()) break;
        const opponentSpeedSet = speedSetFor(opponent);
        const setupTurnSpeed = getEffectiveSpeed(attackerSpeedSet, fieldState, "attacker", configFor(attacker, "spe").stage);
        const attackerSpeed = getEffectiveSpeed(boostedSpeedSet, fieldState, "attacker", configFor(boostedProfile, "spe").stage);
        const opponentSpeed = getEffectiveSpeed(opponentSpeedSet, fieldState, "defender", configFor(opponent, "spe").stage);
        const setupPriority = getEffectiveMovePriority(attackerSpeedSet, setup.name, fieldState);
        const opponentAttack = await bestAttack(opponent, attacker, generation, counters, isCancelled, filter, fieldState);
        const afterSetupIncoming = await bestAttack(opponent, boostedProfile, generation, counters, isCancelled, filter, fieldState);
        const boostedAttack = await bestAttack(boostedProfile, opponent, generation, counters, isCancelled, filter, fieldState);
        const actsBefore = (move: DraftMoveThreat, userSpeed: number, userPriority: number) => {
          const priority = getEffectiveMovePriority(opponentSpeedSet, move.move, fieldState);
          return priority > userPriority || (priority === userPriority && (fieldState.trickRoom ? opponentSpeed <= userSpeed : opponentSpeed >= userSpeed));
        };
        const beforeSetupCandidates = (opponentAttack.byPriority || []).filter(move => actsBefore(move, setupTurnSpeed, setupPriority));
        const firstIncomingMove = beforeSetupCandidates.reduce<DraftMoveThreat | undefined>((best, move) => isBetterMove(move, best) ? move : best, undefined);
        const opponentActsBeforeSetup = Boolean(firstIncomingMove);
        const setupDetails = getMoveDetails(setup.name, generation);
        let setupMoveThreat: DraftMoveThreat | undefined;
        if (setupDetails && setupDetails.power != null && setupDetails.power > 0) {
          const setupAttackerSet = makeDraftSet(setupProfile, setupDetails, "attacker");
          const setupDefenderSet = makeDraftSet(opponent, setupDetails, "defender");
          const setupDamage = calculateMove(setupAttackerSet, setupDefenderSet, setupDetails.name, fieldState, stagesFor(setupProfile), stagesFor(opponent), false, generation, false);
          if (setupDamage) setupMoveThreat = { ...summarizeMove(setupDetails, setupDamage, setupProfile, setupDefenderSet, generation), effectivePriority: getEffectiveMovePriority(setupAttackerSet, setupDetails.name, fieldState) };
        }
        const setupMoveActsFirst = !opponentActsBeforeSetup;
        const setupMoveKOs = Boolean(setupMoveThreat && setupMoveThreat.maxPct >= 100);
        // A damaging setup move can KO on either action order: if the opponent
        // moves first, the user must survive that hit before using the move.
        // If the user moves first and KOs, the opponent gets no setup-turn hit.
        const strongestSetupReply = firstIncomingMove && firstIncomingMove.maxPct > (opponentAttack.best?.maxPct ?? 0)
          ? firstIncomingMove : opponentAttack.best;
        const incomingMove = setupMoveKOs
          ? (setupMoveActsFirst ? undefined : firstIncomingMove)
          : strongestSetupReply;
        const damageBeforeSetup = incomingMove?.maxPct ?? 0;
        const setupCanOccur = damageBeforeSetup + setup.costPct < 100;
        const setupMoveDamagePct = setupMoveThreat?.maxPct ?? 0;
        const startingOpponentHpPct = setupMoveKOs ? 0 : Math.max(0, 100 - setupMoveDamagePct);
        const attackerFirstOptions = (boostedAttack.byPriority || []).filter(move => {
          const priority = getEffectiveMovePriority(boostedSpeedSet, move.move, fieldState);
          const opponentCanActBefore = (afterSetupIncoming.byPriority || []).some(reply => {
            const replyPriority = getEffectiveMovePriority(opponentSpeedSet, reply.move, fieldState);
            return replyPriority > priority || (replyPriority === priority &&
              (fieldState.trickRoom ? opponentSpeed <= attackerSpeed : opponentSpeed >= attackerSpeed));
          });
          return !opponentCanActBefore;
        });
        const strongestFirstMove = attackerFirstOptions.reduce<DraftMoveThreat | undefined>((best, move) => isBetterMove(move, best) ? move : best, undefined);
        // If any move can act before every opposing reply, use the strongest
        // such move even when it is a weaker hit. This preserves same-priority
        // Speed wins against priority attacks that would otherwise KO first.
        const boostedMove = strongestFirstMove || boostedAttack.best;
        const boostedMovePriority = boostedMove ? getEffectiveMovePriority(boostedSpeedSet, boostedMove.move, fieldState) : -7;
        const afterSetupCandidates = (afterSetupIncoming.byPriority || []).filter(move => actsBefore(move, attackerSpeed, boostedMovePriority));
        const afterSetupMove = afterSetupCandidates.reduce<DraftMoveThreat | undefined>((best, move) => isBetterMove(move, best) ? move : best, undefined);
        const attackerActsFirstAfterSetup = !afterSetupMove;
        const replyForOrder = afterSetupMove || afterSetupIncoming.best;
        const replyPriority = replyForOrder ? getEffectiveMovePriority(opponentSpeedSet, replyForOrder.move, fieldState) : -7;
        const speedOrderReason = opponentSpeed === attackerSpeed
          ? "wins a Speed tie (treated as opponent-first)"
          : fieldState.trickRoom
            ? `moves first under Trick Room (lower Speed ${opponentSpeed} vs ${attackerSpeed})`
            : `moves first on Speed (${opponentSpeed} vs ${attackerSpeed})`;
        const afterSetupTurnOrderReason = afterSetupMove
          ? replyPriority > boostedMovePriority
            ? `higher priority (${replyPriority >= 0 ? "+" : ""}${replyPriority} vs ${boostedMovePriority >= 0 ? "+" : ""}${boostedMovePriority})`
            : speedOrderReason
          : `your move acts first (priority ${boostedMovePriority >= 0 ? "+" : ""}${boostedMovePriority}, Speed ${attackerSpeed} vs ${opponentSpeed})`;
        const afterDamage = afterSetupMove?.maxPct ?? afterSetupIncoming.best?.maxPct ?? 0;
        const canContinueAfterSetup = setupCanOccur && (
          damageBeforeSetup + setup.costPct + afterDamage < 100 ||
          Boolean(attackerActsFirstAfterSetup && boostedMove && boostedMove.minPct >= 100)
        );
        const bestMove = boostedMove;
        const bestMoveMaxPct = bestMove?.maxPct ?? 0;
        targets.push({
          species: opponent.species,
          bestMove,
          bestMoveMaxPct,
          incomingMove: incomingMove?.move,
          incomingMaxPct: incomingMove?.maxPct ?? 0,
          afterSetupIncomingMaxPct: afterDamage,
          setupTurnSpeed,
          attackerSpeed,
          opponentSpeed,
          opponentActsBeforeSetup,
          canSetUp: setupCanOccur,
          canContinueAfterSetup,
          plausibleSweepTarget: setupCanOccur && canContinueAfterSetup && bestMoveMaxPct >= DRAFT_STRONG_HIT_THRESHOLD,
          afterSetupIncomingMove: afterSetupMove?.move || afterSetupIncoming.best?.move,
          afterSetupTurnOrderReason,
          setupMoveName: setupMoveThreat?.move,
          setupMoveDamagePct,
          startingOpponentHpPct,
          removedBySetup: setupMoveKOs,
          setupMoveKoChance: setupMoveThreat?.chanceKo,
          setupMoveKoGuaranteed: Boolean(setupMoveKOs && setupMoveThreat && setupMoveThreat.minPct >= 100),
          attackerActsFirstAfterSetup,
        });
      }
      // Opponent profiles can contain multiple item / EV assumptions for the
      // same species. Collapse those alternatives first; they are not extra
      // Pokémon on the opposing roster.
      const targetsBySpecies = new Map<string, DraftSetupSweepTarget>();
      for (const target of targets) {
        const previous = targetsBySpecies.get(target.species);
        if (!previous) { targetsBySpecies.set(target.species, target); continue; }
        const weakestDamage = target.bestMoveMaxPct < previous.bestMoveMaxPct ? target : previous;
        const highestSetupHit = target.incomingMaxPct > previous.incomingMaxPct ? target : previous;
        const highestFollowUp = target.afterSetupIncomingMaxPct > previous.afterSetupIncomingMaxPct ? target : previous;
        targetsBySpecies.set(target.species, {
          ...previous,
          bestMove: weakestDamage.bestMove,
          bestMoveMaxPct: Math.min(previous.bestMoveMaxPct, target.bestMoveMaxPct),
          incomingMove: highestSetupHit.incomingMove,
          incomingMaxPct: Math.max(previous.incomingMaxPct, target.incomingMaxPct),
          afterSetupIncomingMove: highestFollowUp.afterSetupIncomingMove,
          afterSetupTurnOrderReason: highestFollowUp.afterSetupTurnOrderReason,
          setupMoveName: weakestDamage.setupMoveName,
          setupMoveDamagePct: Math.min(previous.setupMoveDamagePct ?? 0, target.setupMoveDamagePct ?? 0),
          startingOpponentHpPct: Math.max(previous.startingOpponentHpPct ?? 100, target.startingOpponentHpPct ?? 100),
          removedBySetup: Boolean(previous.removedBySetup && target.removedBySetup),
          setupMoveKoChance: Math.min(previous.setupMoveKoChance ?? 0, target.setupMoveKoChance ?? 0),
          setupMoveKoGuaranteed: Boolean(previous.setupMoveKoGuaranteed && target.setupMoveKoGuaranteed),
          afterSetupIncomingMaxPct: Math.max(previous.afterSetupIncomingMaxPct, target.afterSetupIncomingMaxPct),
          opponentSpeed: fieldState.trickRoom ? Math.min(previous.opponentSpeed, target.opponentSpeed) : Math.max(previous.opponentSpeed, target.opponentSpeed),
          opponentActsBeforeSetup: previous.opponentActsBeforeSetup || target.opponentActsBeforeSetup,
          canSetUp: previous.canSetUp && target.canSetUp,
          attackerActsFirstAfterSetup: Boolean(previous.attackerActsFirstAfterSetup && target.attackerActsFirstAfterSetup),
        });
      }
      const uniqueTargets = [...targetsBySpecies.values()];
      // A setup turn is needed only once. Find one opponent that permits it,
      // then simulate a best-estimate route through the rest of the roster.
      const setupOpportunity = uniqueTargets
        .filter(target => target.canSetUp)
        .sort((a, b) => Number(Boolean(b.removedBySetup)) - Number(Boolean(a.removedBySetup)) || a.incomingMaxPct - b.incomingMaxPct)[0];
      const setupRemainingHp = setupOpportunity
        ? Math.max(0, 100 - setupOpportunity.incomingMaxPct - setup.costPct)
        : 0;
      let stoppedBySpecies: string | undefined;
      let stoppedByReason: string | undefined;
      if (setupOpportunity) {
        // Only the Pokémon actually facing the setup move takes its damage or
        // can be KO'd by it; the rest of the opposing roster remains untouched.
        for (const target of uniqueTargets) {
          if (target.species !== setupOpportunity.species) {
            target.removedBySetup = false;
            target.setupMoveDamagePct = 0;
            target.startingOpponentHpPct = 100;
          }
        }
        let remainingHp = setupRemainingHp;
        const estimateTurns = (target: DraftSetupSweepTarget) => target.bestMoveMaxPct > 0
          ? Math.max(1, Math.ceil((target.startingOpponentHpPct ?? 100) / target.bestMoveMaxPct)) : Number.POSITIVE_INFINITY;
        // Prefer targets that can be removed quickly while taking the least
        // cumulative retaliation. This is an estimated route, not a battle AI.
        for (const target of uniqueTargets.filter(row => row.removedBySetup)) {
          target.canSetUp = true;
          target.canContinueAfterSetup = true;
          target.plausibleSweepTarget = true;
          target.sweepOrder = 0;
          target.remainingHpPct = setupRemainingHp;
        }
        const orderedTargets = uniqueTargets.filter(target => !target.removedBySetup).sort((a, b) => {
          const turnsA = estimateTurns(a), turnsB = estimateTurns(b);
          const hitsA = a.attackerActsFirstAfterSetup ? Math.max(0, turnsA - 1) : turnsA;
          const hitsB = b.attackerActsFirstAfterSetup ? Math.max(0, turnsB - 1) : turnsB;
          return hitsA * a.afterSetupIncomingMaxPct - hitsB * b.afterSetupIncomingMaxPct || b.bestMoveMaxPct - a.bestMoveMaxPct;
        });
        let stopped = false;
        for (const [orderIndex, target] of orderedTargets.entries()) {
          target.sweepOrder = orderIndex + 1;
          if (stopped) {
            target.canSetUp = true;
            target.canContinueAfterSetup = false;
            target.plausibleSweepTarget = false;
            target.remainingHpPct = Math.max(0, remainingHp);
            continue;
          }
          const turnsToKo = estimateTurns(target);
          const maxTurns = Math.min(20, Number.isFinite(turnsToKo) ? turnsToKo : 20);
          const targetHp = { value: target.startingOpponentHpPct ?? 100 };
          let incomingHits = 0;
          let defeated = false;
          let stopReason = "";
          const incomingDamage = Math.max(0, target.afterSetupIncomingMaxPct);
          for (let turn = 0; turn < maxTurns; turn++) {
            if (!target.attackerActsFirstAfterSetup && incomingDamage > 0) {
              incomingHits++;
              remainingHp -= incomingDamage;
              if (remainingHp <= 0) {
                stopReason = `${target.afterSetupIncomingMove || "Opponent's attack"} acts first (${target.afterSetupTurnOrderReason || "turn order"}) and deals ${incomingDamage.toFixed(1)}% per turn; only ${Math.max(0, remainingHp + incomingDamage).toFixed(1)}% HP remained`;
                break;
              }
            }
            targetHp.value -= target.bestMoveMaxPct;
            if (targetHp.value <= 0) { defeated = true; break; }
            if (target.attackerActsFirstAfterSetup && incomingDamage > 0) {
              incomingHits++;
              remainingHp -= incomingDamage;
              if (remainingHp <= 0) {
                stopReason = `${target.afterSetupIncomingMove || "Opponent's attack"} retaliates after your move (${target.afterSetupTurnOrderReason || "turn order"}) for ${incomingDamage.toFixed(1)}%; the remaining HP is insufficient`;
                break;
              }
            }
          }
          const wearDown = !defeated && !stopReason && target.bestMoveMaxPct > 0;
          if (!defeated && !stopReason) {
            stopReason = wearDown
              ? `the best move deals only ${target.bestMoveMaxPct.toFixed(1)}% per hit; the estimate reaches its 20-turn limit before a KO`
              : "no damaging move in the evaluated move pool can KO this target";
          }
          target.canSetUp = true;
          target.canContinueAfterSetup = !stopReason;
          target.plausibleSweepTarget = defeated && !stopReason;
          target.estimatedTurnsToKo = Number.isFinite(turnsToKo) ? turnsToKo : undefined;
          target.estimatedIncomingHits = incomingHits;
          target.remainingHpPct = Math.max(0, remainingHp);
          target.wearDown = wearDown;
          if (stopReason) {
            target.stoppedReason = stopReason;
            target.canContinueAfterSetup = false;
            target.plausibleSweepTarget = false;
            stoppedBySpecies = target.species;
            stoppedByReason = stopReason;
            stopped = true;
          }
        }
      } else {
        for (const target of uniqueTargets) {
          target.canSetUp = false;
          target.canContinueAfterSetup = false;
          target.plausibleSweepTarget = false;
          target.stoppedReason = "No opposing Pokémon provides a survivable setup turn";
          target.remainingHpPct = 0;
        }
      }
      setupSweeps.push({ move: setup.name, itemAssumption: itemVariant.label, boosts: setup.boosts, setupCostPct: setup.costPct, boostChance: setup.boostChance, setupOpportunitySpecies: setupOpportunity?.species, setupRemainingHpPct: setupOpportunity ? setupRemainingHp : undefined, stoppedBySpecies, stoppedByReason, targets: uniqueTargets, plausibleTargets: uniqueTargets.filter(target => target.plausibleSweepTarget).length });
      }
    }
  }
  const analysis: DraftMatchupAnalysis = {
    attacker: attacker.species,
    opponents: results,
    setupSweeps,
    movesEvaluated: counters.evaluated,
    approximate: true,
    note: `Potential matchups only: top three eligible hypothetical learnset moves per type/category after ${filter.minAccuracy}% accuracy and whitelist/blacklist filters; explicitly entered moves are always included regardless of filters. Configured items, abilities, EVs/Stat Points, natures, and stat stages on both sides; selected weather and terrain are applied.${includeSetupAnalysis ? " Learnable setup moves are separately assessed using boosted damage, turn order, priority, and whether there is at least one survivable setup opportunity, then a best-estimate post-setup route that carries remaining HP across opponents and accounts for priority, Speed, and repeated damage exchanges." : ""} Damage and multi-hit probabilities inherit the calculator's supported mechanics; this is not a guaranteed set or battle prediction.`,
  };
  if (!isCancelled()) {
    analysisCache.set(cacheKey, analysis);
    if (analysisCache.size > 64) analysisCache.delete(analysisCache.keys().next().value || "");
  }
  return analysis;
}
