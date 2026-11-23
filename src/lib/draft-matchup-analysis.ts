import { calculateMove, getMoveDetails, getPokemonHp } from "./calc";
import supportCategories from "../data/support-categories.json";
import { getEffectiveMovePriority, getEffectiveSpeed } from "./battle-order";
import { getChampionsSpeciesLearnset, getHistoricalSpeciesLearnset, getMove, getSpecies, loadShowdownData } from "./showdown-data";
import { getMaxIVs, type DamageSummary, type FieldState, type MoveDetails, type PokemonSet, type StatId, type Stats } from "./types";
import { DRAFT_STRONG_HIT_THRESHOLD, DRAFT_WALL_THRESHOLD, isEligibleDraftMove, passesDraftMoveFilters } from "./draft-matchup-rules";

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
  canSetUpInFront?: boolean;
  stoppedSweepTarget?: boolean;
  hpAfterSetupPct?: number;
  stopReason?: string;
  setupMoveDamagePct?: number;
  setupMoveMaxDamagePct?: number;
};
export type DraftSetupSweep = {
  move: string;
  itemAssumption?: string;
  boosts: Partial<Record<StatId, number>>;
  setupCostPct: number;
  targets: DraftSetupSweepTarget[];
  plausibleTargets: number;
  setupHost?: string;
  canSetUpInFront?: string[];
  swept?: string[];
  stoppedBy?: string[];
  boostChance?: number;
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
  return {
    move: move.name,
    type: move.type,
    category: move.category,
    minPct: result.minPct,
    maxPct: result.maxPct,
    chance70,
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
  const cacheKey = JSON.stringify(["loaded-data-v3", generation, attackerProfile, defenderProfile, filter, fieldState, moves.map(move => normalize(move.name))]);
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

function setupMoveCandidates(species: string, generation: number, filter: DraftMoveFilter, knownMoves: string[] = []): Array<{ name: string; boosts: Partial<Record<StatId, number>>; priority: number; costPct: number; damaging: boolean; boostChance: number }> {
  const setupCategory = (supportCategories as Array<{ id: string; moves?: string[] }>).find(category => category.id === "setup");
  const unifiedNames = new Set((setupCategory?.moves || []).map(moveId));
  const learnset = generation >= 10
    ? (getChampionsSpeciesLearnset(species) || getHistoricalSpeciesLearnset(species))
    : getHistoricalSpeciesLearnset(species);
  const knownIds = new Set(knownMoves.filter(Boolean).map(moveId));
  const completeMoveset = knownMoves.filter(Boolean).length >= 4;
  const candidates = completeMoveset ? knownMoves.filter(Boolean) : [...new Set([...(learnset || []), ...knownMoves.filter(Boolean)])];
  const result: Array<{ name: string; boosts: Partial<Record<StatId, number>>; priority: number; costPct: number; damaging: boolean; boostChance: number }> = [];
  for (const name of candidates) {
    const metadata = getMove(name) as (Record<string, any> & { boosts?: Record<string, number> }) | undefined;
    const id = moveId(name);
    if (id === "swagger") continue;
    const selfBoosts = metadata?.selfBoost?.boosts || metadata?.secondary?.self?.boosts;
    const boosts = metadata?.boosts || (id === "bellydrum" ? { atk: 6 } : undefined) || selfBoosts;
    if (!boosts) continue;
    const damaging = metadata?.category === "Physical" || metadata?.category === "Special";
    if (!unifiedNames.has(id)) continue;
    if ((metadata?.flags as Record<string, unknown> | undefined)?.charge) continue;
    if (!damaging && metadata?.category !== "Status") continue;
    if (!Object.entries(boosts).some(([stat, value]) => ["atk", "spa", "spe"].includes(stat) && Number(value) > 0)) continue;
    if (id === "curse" && (getSpecies(species)?.types || []).includes("Ghost")) continue;
    const details = getMoveDetails(name, generation);
    if (!details) continue;
    if (!knownIds.has(id) && (filter.blacklist.some(value => moveId(value) === id) || !passesDraftMoveFilters(details, filter))) continue;
    const mapped: Partial<Record<StatId, number>> = {};
    for (const [stat, value] of Object.entries(boosts)) if (["atk", "def", "spa", "spd", "spe"].includes(stat) && typeof value === "number") mapped[stat as StatId] = Math.max(-6, Math.min(6, value));
    const costPct = id === "bellydrum" || id === "filletaway" ? 50 : id === "clangoroussoul" ? 33 : 0;
    if (Object.keys(mapped).length) result.push({ name: details.name, boosts: mapped, priority: details.priority, costPct, damaging, boostChance: Number(metadata?.secondary?.chance ?? 100) });
  }
  const unique = new Map<string, typeof result[number]>();
  for (const entry of result) { const signature = `${JSON.stringify(entry.boosts)}:${entry.priority}:${entry.costPct}:${entry.damaging}:${entry.boostChance}`; if (!unique.has(signature)) unique.set(signature, entry); }
  const score = (entry: typeof result[number]) => Object.entries(entry.boosts).reduce((sum, [stat, value]) => sum + Math.max(0, Number(value) || 0) + (stat === "spe" ? 0.5 * Math.max(0, Number(value) || 0) : 0), 0);
  return [...unique.values()].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
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

function postSetupMoveDamage(primary: DraftMoveThreat | undefined, fallback: DraftMoveThreat | undefined, defenderSet: PokemonSet, setupPriority: number, defenderSpeed: number, attackerSpeed: number, field: FieldState): number {
  const move = primary || fallback;
  if (!move) return 0;
  const priority = move.effectivePriority ?? getEffectiveMovePriority(defenderSet, move.move, field);
  const defenderActs = priority > setupPriority || (priority === setupPriority && (field.trickRoom ? defenderSpeed < attackerSpeed : defenderSpeed > attackerSpeed));
  return defenderActs ? move.maxPct : 0;
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
  const cacheKey = JSON.stringify(["loaded-data-v3", generation, attacker, opponents, filter, fieldState, includeSetupAnalysis]);
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
      const itemVariants: Array<{ profile: DraftPokemonProfile; label: string }> = [{ profile: attacker, label: attacker.item?.trim() || "Item unknown" }];
      if (hasUnknownItem && hasNegativeBoost) itemVariants.push({ profile: { ...attacker, item: "White Herb" }, label: "White Herb assumption" });
      for (const itemVariant of itemVariants) {
        if (isCancelled()) break;
        const setupProfile = itemVariant.profile;
        const boostedProfile = withSetupBoosts(setupProfile, setup.boosts);
        const setupSpeedSet = speedSetFor(setupProfile);
        const boostedSpeedSet = speedSetFor(boostedProfile);
        const setupPriority = getEffectiveMovePriority(setupSpeedSet, setup.name, fieldState);
        const setupHosts: Array<{ opponent: DraftPokemonProfile; hpAfterSetup: number; incomingMove?: DraftMoveThreat; incomingDamage: number; setupDamagePct: number; setupMoveMaxDamagePct: number; setupMoveKOs: boolean }> = [];
        const opponentStats = new Map<DraftPokemonProfile, { profile: DraftPokemonProfile; reply: Awaited<ReturnType<typeof bestAttack>>; boostedReply: Awaited<ReturnType<typeof bestAttack>>; boostedAttack: Awaited<ReturnType<typeof bestAttack>>; setupDamage: Awaited<ReturnType<typeof bestAttack>> }>();
        for (const opponent of opponents) {
          if (isCancelled()) break;
          const [reply, boostedReply, boostedAttack, setupDamage] = await Promise.all([
            bestAttack(opponent, setupProfile, generation, counters, isCancelled, filter, fieldState),
            bestAttack(opponent, boostedProfile, generation, counters, isCancelled, filter, fieldState),
            bestAttack(boostedProfile, opponent, generation, counters, isCancelled, filter, fieldState),
            setup.damaging ? bestAttack({ ...setupProfile, moves: [setup.name, "", "", ""] }, opponent, generation, counters, isCancelled, filter, fieldState) : Promise.resolve({} as Awaited<ReturnType<typeof bestAttack>>),
          ]);
          opponentStats.set(opponent, { profile: opponent, reply, boostedReply, boostedAttack, setupDamage });
          const defenderSpeedSet = speedSetFor(opponent);
          const attackerSpeed = getEffectiveSpeed(setupSpeedSet, fieldState, "attacker", configFor(setupProfile, "spe").stage);
          const defenderSpeed = getEffectiveSpeed(defenderSpeedSet, fieldState, "defender", configFor(opponent, "spe").stage);
          const defenderFirstMoves = (reply.byPriority || []).filter(move => {
            const priority = move.effectivePriority ?? getEffectiveMovePriority(defenderSpeedSet, move.move, fieldState);
            return priority > setupPriority || (priority === setupPriority && (fieldState.trickRoom ? defenderSpeed < attackerSpeed : defenderSpeed > attackerSpeed));
          });
          const incomingMove = defenderFirstMoves.reduce<DraftMoveThreat | undefined>((best, move) => isBetterMove(move, best) ? move : best, undefined);
          const attackerFirst = !incomingMove;
          const setupMoveThreat = setupDamage.best;
          const setupMoveKOs = Boolean(setup.damaging && attackerFirst && setupMoveThreat && setupMoveThreat.minPct >= 100);
          const damageBeforeSetup = incomingMove?.maxPct || 0;
          const hpAfterSetup = 100 - damageBeforeSetup - setup.costPct;
          if (hpAfterSetup > 0) {
            // If the setup attack KOs first, the target never gets its reply.
            // Otherwise, the user must survive the target's first available hit.
            let postSetupDamage = 0;
            if (!setupMoveKOs) {
              const attackerPostSpeed = getEffectiveSpeed(boostedSpeedSet, fieldState, "attacker", configFor(boostedProfile, "spe").stage);
              const defenderPostFirst = (boostedReply.byPriority || []).filter(move => {
                const priority = move.effectivePriority ?? getEffectiveMovePriority(defenderSpeedSet, move.move, fieldState);
                return priority > setupPriority || (priority === setupPriority && (fieldState.trickRoom ? defenderSpeed < attackerPostSpeed : defenderSpeed > attackerPostSpeed));
              }).reduce<DraftMoveThreat | undefined>((best, move) => isBetterMove(move, best) ? move : best, undefined);
              postSetupDamage = postSetupMoveDamage(defenderPostFirst, boostedReply.best, defenderSpeedSet, setupPriority, defenderSpeed, attackerPostSpeed, fieldState);
            }
            if (setupMoveKOs || hpAfterSetup - postSetupDamage > 0) setupHosts.push({ opponent, hpAfterSetup: Math.max(0, hpAfterSetup - postSetupDamage), incomingMove, incomingDamage: damageBeforeSetup + postSetupDamage, setupDamagePct: setupMoveThreat?.minPct || 0, setupMoveMaxDamagePct: setupMoveThreat?.maxPct || 0, setupMoveKOs });
          }
        }
        if (!setupHosts.length) {
          setupSweeps.push({ move: setup.name, itemAssumption: itemVariant.label, boosts: setup.boosts, setupCostPct: setup.costPct, targets: opponents.map(opponent => ({ species: opponent.species, bestMove: undefined, bestMoveMaxPct: 0, incomingMove: undefined, incomingMaxPct: 0, afterSetupIncomingMaxPct: 0, setupTurnSpeed: 0, attackerSpeed: 0, opponentSpeed: 0, opponentActsBeforeSetup: false, canSetUp: false, canContinueAfterSetup: false, plausibleSweepTarget: false })), plausibleTargets: 0, canSetUpInFront: [], swept: [], stoppedBy: [], boostChance: setup.boostChance });
          continue;
        }
        // Each species may have several opponent-set assumptions in Team Lab.
        // A species is a valid setup opportunity only when every assumed set survives.
        const opponentCounts = new Map<string, number>();
        for (const opponent of opponents) opponentCounts.set(opponent.species, (opponentCounts.get(opponent.species) || 0) + 1);
        const hostGroups = new Map<string, typeof setupHosts>();
        for (const entry of setupHosts) hostGroups.set(entry.opponent.species, [...(hostGroups.get(entry.opponent.species) || []), entry]);
        const validHostGroups = [...hostGroups.entries()]
          .filter(([species, entries]) => entries.length === (opponentCounts.get(species) || 0))
          .map(([species, entries]) => ({ species, worst: [...entries].sort((a, b) => a.hpAfterSetup - b.hpAfterSetup)[0] }))
          .sort((a, b) => b.worst.hpAfterSetup - a.worst.hpAfterSetup);
        if (!validHostGroups.length) {
          setupSweeps.push({ move: setup.name, itemAssumption: itemVariant.label, boosts: setup.boosts, setupCostPct: setup.costPct, targets: opponents.map(opponent => ({ species: opponent.species, bestMove: undefined, bestMoveMaxPct: 0, incomingMove: undefined, incomingMaxPct: 0, afterSetupIncomingMaxPct: 0, setupTurnSpeed: 0, attackerSpeed: 0, opponentSpeed: 0, opponentActsBeforeSetup: false, canSetUp: false, canContinueAfterSetup: false, plausibleSweepTarget: false })), plausibleTargets: 0, canSetUpInFront: [], swept: [], stoppedBy: [], boostChance: setup.boostChance });
          continue;
        }
        // Setup is paid exactly once. Choose the safest valid host, then assess
        // every remaining species against the HP left after that one setup turn.
        const host = validHostGroups[0].worst;
        const validHostSpecies = validHostGroups.map(entry => entry.species);
        const hostName = host.opponent.species;
        let currentHp = host.hpAfterSetup;
        const sweptNames: string[] = [];
        const stoppedNames: string[] = [];
        const targets: DraftSetupSweepTarget[] = [];
        for (const opponent of opponents) {
          const row = opponentStats.get(opponent);
          if (!row) continue;
          const defenderSpeedSet = speedSetFor(opponent);
          const attackerSpeed = getEffectiveSpeed(boostedSpeedSet, fieldState, "attacker", configFor(boostedProfile, "spe").stage);
          const defenderSpeed = getEffectiveSpeed(defenderSpeedSet, fieldState, "defender", configFor(opponent, "spe").stage);
          const bestMove = row.boostedAttack.best;
          const attackerOptions = row.boostedAttack.byPriority || [];
          const defenderOptions = row.boostedReply.byPriority || [];
          const canActBefore = (first: DraftMoveThreat | undefined, second: DraftMoveThreat | undefined, firstSpeed: number, secondSpeed: number) => {
            if (!first) return false;
            const p1 = first.effectivePriority ?? getEffectiveMovePriority(boostedSpeedSet, first.move, fieldState);
            const p2 = second ? (second.effectivePriority ?? getEffectiveMovePriority(defenderSpeedSet, second.move, fieldState)) : -7;
            return p1 > p2 || (p1 === p2 && (fieldState.trickRoom ? firstSpeed < secondSpeed : firstSpeed > secondSpeed));
          };
          const earliest = (moves: DraftMoveThreat[], user: DraftPokemonProfile) => [...moves].sort((a, b) => (b.effectivePriority ?? getEffectiveMovePriority(speedSetFor(user), b.move, fieldState)) - (a.effectivePriority ?? getEffectiveMovePriority(speedSetFor(user), a.move, fieldState)) || b.maxPct - a.maxPct)[0];
          const firstDefenderMove = earliest(defenderOptions, opponent);
          const attackerBeforeOptions = attackerOptions.filter(move => !firstDefenderMove || canActBefore(move, firstDefenderMove, attackerSpeed, defenderSpeed));
          const chosenFirstAttack = attackerBeforeOptions.reduce<DraftMoveThreat | undefined>((best, move) => isBetterMove(move, best) ? move : best, undefined);
          const attackerFirst = Boolean(chosenFirstAttack);
          const hostRow = opponent.species === hostName;
          const hostSetupMoveKOs = Boolean(hostRow && host.setupMoveKOs);
          const attackKOs = hostSetupMoveKOs || Boolean(chosenFirstAttack && (chosenFirstAttack.minPct + (hostRow ? host.setupDamagePct : 0)) >= 100);
          const defenderRelevantOptions = defenderOptions.filter(move => attackerFirst
            ? !canActBefore(move, chosenFirstAttack, defenderSpeed, attackerSpeed)
            : !chosenFirstAttack || canActBefore(move, chosenFirstAttack, defenderSpeed, attackerSpeed));
          const defenderMove = defenderRelevantOptions.reduce<DraftMoveThreat | undefined>((best, move) => isBetterMove(move, best) ? move : best, undefined) || firstDefenderMove;
          const defenderDamage = defenderMove?.maxPct || 0;
          let stopped = false;
          let stopReason = "";
          if (!attackerFirst && defenderDamage >= currentHp) { stopped = true; stopReason = `${defenderMove?.move || "Opponent move"} acts first and KOs from ${currentHp.toFixed(1)}% HP`; }
          else if (attackKOs && (attackerFirst || defenderDamage < currentHp)) { sweptNames.push(opponent.species); }
          else if (defenderDamage >= currentHp) { stopped = true; stopReason = `${defenderMove?.move || "Opponent move"} KOs ${attackerFirst ? `after ${bestMove?.move || "the attack"}` : "before the attack"} (${currentHp.toFixed(1)}% HP remaining)`; }
          if (stopped) stoppedNames.push(opponent.species);
          const displayedMove = hostSetupMoveKOs ? undefined : (chosenFirstAttack || bestMove);
          targets.push({ species: opponent.species, bestMove: displayedMove, bestMoveMaxPct: hostSetupMoveKOs ? 100 : Math.min(100, (displayedMove?.maxPct || 0) + (hostRow ? host.setupMoveMaxDamagePct : 0)), setupMoveDamagePct: hostRow ? host.setupDamagePct : 0, setupMoveMaxDamagePct: hostRow ? host.setupMoveMaxDamagePct : 0, incomingMove: hostRow ? host.incomingMove?.move : defenderMove?.move, incomingMaxPct: hostRow ? host.incomingDamage : defenderDamage, afterSetupIncomingMaxPct: defenderDamage, setupTurnSpeed: getEffectiveSpeed(setupSpeedSet, fieldState, "attacker", configFor(setupProfile, "spe").stage), attackerSpeed, opponentSpeed: defenderSpeed, opponentActsBeforeSetup: hostRow ? Boolean(host.incomingMove) : !attackerFirst, canSetUp: hostRow, canSetUpInFront: hostRow, canContinueAfterSetup: !stopped, plausibleSweepTarget: sweptNames.includes(opponent.species), stoppedSweepTarget: stopped, hpAfterSetupPct: currentHp, stopReason });
        }
        const groupedTargets = new Map<string, DraftSetupSweepTarget[]>();
        for (const target of targets) groupedTargets.set(target.species, [...(groupedTargets.get(target.species) || []), target]);
        const uniqueTargets = [...groupedTargets.entries()].map(([species, assumptions]) => {
          const worstDamage = [...assumptions].sort((a, b) => a.bestMoveMaxPct - b.bestMoveMaxPct)[0];
          const stopper = assumptions.find(target => target.stoppedSweepTarget);
          const sweptAcrossAssumptions = assumptions.length === (opponentCounts.get(species) || 0) && assumptions.every(target => target.plausibleSweepTarget);
          return { ...worstDamage, species, plausibleSweepTarget: sweptAcrossAssumptions, stoppedSweepTarget: Boolean(stopper), stopReason: stopper?.stopReason || worstDamage.stopReason, hpAfterSetupPct: Math.min(...assumptions.map(target => target.hpAfterSetupPct ?? 100)), incomingMaxPct: Math.max(...assumptions.map(target => target.incomingMaxPct)) };
        });
        const sweptSpecies = uniqueTargets.filter(target => target.plausibleSweepTarget).map(target => target.species);
        const stoppedSpecies = uniqueTargets.filter(target => target.stoppedSweepTarget).map(target => target.species);
        setupSweeps.push({ move: setup.name, itemAssumption: itemVariant.label, boosts: setup.boosts, setupCostPct: setup.costPct, targets: uniqueTargets, plausibleTargets: sweptSpecies.length, setupHost: hostName, canSetUpInFront: validHostSpecies, swept: sweptSpecies, stoppedBy: stoppedSpecies, boostChance: setup.boostChance });
      }
    }
  }
  const analysis: DraftMatchupAnalysis = {
    attacker: attacker.species,
    opponents: results,
    setupSweeps,
    movesEvaluated: counters.evaluated,
    approximate: true,
    note: `Potential matchups only: top three eligible hypothetical learnset moves per type/category after ${filter.minAccuracy}% accuracy and whitelist/blacklist filters; explicitly entered moves are always included regardless of filters. Configured items, abilities, EVs/Stat Points, natures, and stat stages on both sides; selected weather and terrain are applied.${includeSetupAnalysis ? " Learnable setup moves are separately assessed using boosted damage, turn order, priority, and whether the user can survive the setup turn and the following hit." : ""} Damage and multi-hit probabilities inherit the calculator's supported mechanics; this is not a guaranteed set or battle prediction.`,
  };
  if (!isCancelled()) {
    analysisCache.set(cacheKey, analysis);
    if (analysisCache.size > 64) analysisCache.delete(analysisCache.keys().next().value || "");
  }
  return analysis;
}
