import { calculateMove, getMoveDetails, getPokemonHp } from "./calc";
import { getChampionsSpeciesLearnset, getHistoricalSpeciesLearnset, getSpecies } from "./showdown-data";
import type { DamageSummary, FieldState, MoveDetails, PokemonSet, StatId, Stats } from "./types";
import { DRAFT_STRONG_HIT_THRESHOLD, DRAFT_WALL_THRESHOLD, isEligibleDraftMove, passesDraftMoveFilters } from "./draft-matchup-rules";

export { DRAFT_STRONG_HIT_THRESHOLD, DRAFT_WALL_THRESHOLD } from "./draft-matchup-rules";
const MAX_MOVES_PER_TYPE_CATEGORY = 3;
export type DraftMoveFilter = { minAccuracy: number; minPriority: number; whitelist: string[]; blacklist: string[] };
export const DEFAULT_DRAFT_MOVE_FILTER: DraftMoveFilter = { minAccuracy: 75, minPriority: 0, whitelist: [], blacklist: [] };
const moveId = (value: string) => normalize(value);
const CHUNK_SIZE = 16;

export type DraftStatConfig = { ev: number; nature: "boost" | "neutral" | "hinder"; stage: number };
export type DraftPokemonProfile = {
  species: string;
  ability?: string;
  /** Include Stellar when the captain selected Stellar; it affects offensive STAB but not defensive typing. */
  teraType?: string;
  /** Configured EVs (or Champions Stat Points), natures, and stages from the draft editor. */
  stats?: Partial<Record<StatId, DraftStatConfig>>;
  championsMode?: boolean;
  level?: number;
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
};
export type DraftOpponentResult = {
  species: string;
  bestAttack?: DraftMoveThreat;
  bestStabAttack?: DraftMoveThreat;
  bestReply?: DraftMoveThreat;
  bestStabReply?: DraftMoveThreat;
  threat: boolean;
  reliablyThreatens: boolean;
  wallsAttacker: boolean;
  attackerWalls: boolean;
  checkedByAttacker: boolean;
};
export type DraftMatchupAnalysis = {
  attacker: string;
  opponents: DraftOpponentResult[];
  movesEvaluated: number;
  approximate: true;
  note: string;
};

const blankField: FieldState = {
  weather: "", terrain: "", defenderStealthRock: false, defenderSpikes: 0,
  defenderReflect: false, defenderLightScreen: false, defenderAuroraVeil: false,
  defenderLeechSeed: false, defenderSaltCure: false, trickRoom: false, tailwindSide: "",
};
const fullIvs = (): Stats => ({ hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 });
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
const bestAttackCache = new Map<string, { best?: DraftMoveThreat; bestStab?: DraftMoveThreat }>();
function candidateMoves(species: string, generation: number, filter: DraftMoveFilter): MoveDetails[] {
  const key = `${generation}:${normalize(species)}:${JSON.stringify(filter)}`;
  const cached = moveCache.get(key);
  if (cached) return cached;
  const learnset = generation >= 10
    ? (getChampionsSpeciesLearnset(species) || getHistoricalSpeciesLearnset(species))
    : getHistoricalSpeciesLearnset(species);
  const moves = selectDraftCandidateMoves(learnset || [], generation, filter);
  moveCache.set(key, moves);
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
  };
}

function makeDraftSet(profile: DraftPokemonProfile, move: MoveDetails, role: "attacker" | "defender"): PokemonSet {
  const relevantStat = role === "attacker" ? statId(move.category) : defenseId(move.category);
  const relevantConfig = configFor(profile, relevantStat);
  const evs = Object.fromEntries(STAT_IDS.map(stat => [stat, calcEvs(profile, stat)])) as Stats;
  return {
    name: profile.species,
    species: profile.species,
    item: "",
    ability: profile.ability || "",
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
): Promise<{ best?: DraftMoveThreat; bestStab?: DraftMoveThreat }> {
  const cacheKey = JSON.stringify([generation, attackerProfile, defenderProfile, filter]);
  const cached = bestAttackCache.get(cacheKey);
  if (cached) return cached;
  const moves = candidateMoves(attackerProfile.species, generation, filter);
  let best: DraftMoveThreat | undefined;
  let bestStab: DraftMoveThreat | undefined;
  for (let index = 0; index < moves.length; index++) {
    if (isCancelled()) return {};
    const move = moves[index];
    const attacker = makeDraftSet(attackerProfile, move, "attacker");
    const defender = makeDraftSet(defenderProfile, move, "defender");
    const result = calculateMove(attacker, defender, move.name, blankField, stagesFor(attackerProfile), stagesFor(defenderProfile), false, generation, false);
    counters.evaluated++;
    if (result) {
      const candidate = summarizeMove(move, result, attackerProfile, defender, generation);
      if (isBetterMove(candidate, best)) best = candidate;
      if (candidate.stab && isBetterMove(candidate, bestStab)) bestStab = candidate;
    }
    if ((index + 1) % CHUNK_SIZE === 0) await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  const result = { best, bestStab };
  bestAttackCache.set(cacheKey, result);
  if (bestAttackCache.size > 4096) bestAttackCache.delete(bestAttackCache.keys().next().value || "");
  return result;
}

/**
 * Analyze one hovered draft Pokémon against the opposing roster using the
 * configured EVs/Champions Stat Points, natures, and stat stages on both sides.
 * Items and field effects remain neutral; results are potential move-pool matchups.
 */
export async function analyzeDraftPokemon(
  attacker: DraftPokemonProfile,
  opponents: DraftPokemonProfile[],
  generation = 9,
  isCancelled: () => boolean = () => false,
  filter: DraftMoveFilter = DEFAULT_DRAFT_MOVE_FILTER,
): Promise<DraftMatchupAnalysis> {
  const cacheKey = JSON.stringify([generation, attacker, opponents, filter]);
  const cached = analysisCache.get(cacheKey);
  if (cached) return cached;
  const counters = { evaluated: 0 };
  const results: DraftOpponentResult[] = [];
  for (const opponent of opponents) {
    if (isCancelled()) break;
    const [outgoing, reply] = await Promise.all([
      bestAttack(attacker, opponent, generation, counters, isCancelled, filter),
      bestAttack(opponent, attacker, generation, counters, isCancelled, filter),
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
  const analysis: DraftMatchupAnalysis = {
    attacker: attacker.species,
    opponents: results,
    movesEvaluated: counters.evaluated,
    approximate: true,
    note: `Potential matchups only: top three eligible moves per type/category after ${filter.minAccuracy}% accuracy and whitelist/blacklist filters, configured EVs/Stat Points, natures, and stat stages on both sides; no items or field effects. Damage and multi-hit probabilities inherit the calculator's supported mechanics; this is not a guaranteed set or battle prediction.`,
  };
  if (!isCancelled()) {
    analysisCache.set(cacheKey, analysis);
    if (analysisCache.size > 64) analysisCache.delete(analysisCache.keys().next().value || "");
  }
  return analysis;
}
