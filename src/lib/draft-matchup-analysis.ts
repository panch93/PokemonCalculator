import { calculateMove, getMoveDetails, getPokemonHp } from "./calc";
import { getHistoricalSpeciesLearnset, getSpecies } from "./showdown-data";
import type { DamageSummary, FieldState, MoveDetails, PokemonSet, StatId, Stats } from "./types";
import { DRAFT_STRONG_HIT_THRESHOLD, DRAFT_WALL_THRESHOLD, isEligibleDraftMove } from "./draft-matchup-rules";

export { DRAFT_STRONG_HIT_THRESHOLD, DRAFT_WALL_THRESHOLD } from "./draft-matchup-rules";
const MAX_MOVES_PER_TYPE_CATEGORY = 3;
const CHUNK_SIZE = 16;

export type DraftPokemonProfile = {
  species: string;
  ability?: string;
  /** Include Stellar when the captain selected Stellar; it affects offensive STAB but not defensive typing. */
  teraType?: string;
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
const zeroStats = (): Stats => ({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
const fullIvs = (): Stats => ({ hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 });
const statId = (category: string): StatId => category === "Special" ? "spa" : "atk";
const defenseId = (category: string): StatId => category === "Special" ? "spd" : "def";
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const candidatePowerScore = (move: MoveDetails) => move.power != null && move.power > 0 ? move.power : 60;

/** Keep the strongest few options per type/category to bound hover latency. */
export function selectDraftCandidateMoves(moveNames: Iterable<string>, generation = 9): MoveDetails[] {
  const groups = new Map<string, MoveDetails[]>();
  for (const name of moveNames) {
    const details = getMoveDetails(name, generation);
    if (!isEligibleDraftMove(details)) continue;
    const key = `${details.type}|${details.category}`;
    const group = groups.get(key) || [];
    group.push(details);
    groups.set(key, group);
  }
  return [...groups.values()]
    .flatMap(group => group.sort((a, b) => (candidatePowerScore(b) * (b.accuracy ?? 100)) - (candidatePowerScore(a) * (a.accuracy ?? 100))).slice(0, MAX_MOVES_PER_TYPE_CATEGORY))
    .sort((a, b) => candidatePowerScore(b) - candidatePowerScore(a));
}

const moveCache = new Map<string, MoveDetails[]>();
const analysisCache = new Map<string, DraftMatchupAnalysis>();
function candidateMoves(species: string, generation: number): MoveDetails[] {
  const key = `${generation}:${normalize(species)}`;
  const cached = moveCache.get(key);
  if (cached) return cached;
  const learnset = getHistoricalSpeciesLearnset(species);
  const moves = selectDraftCandidateMoves(learnset || [], generation);
  moveCache.set(key, moves);
  return moves;
}

function makeDraftSet(profile: DraftPokemonProfile, move: MoveDetails, role: "attacker" | "defender"): PokemonSet {
  const evs = zeroStats();
  if (role === "attacker") evs[statId(move.category)] = 252;
  else {
    evs.hp = 252;
    evs[defenseId(move.category)] = 252;
  }
  evs.spe = 4;
  return {
    name: profile.species,
    species: profile.species,
    item: "",
    ability: profile.ability || "",
    nature: "Hardy",
    level: 100,
    teraType: profile.teraType || "",
    evs,
    ivs: fullIvs(),
    moves: [],
  };
}

function summarizeMove(move: MoveDetails, result: DamageSummary, attacker: DraftPokemonProfile, defender: PokemonSet): DraftMoveThreat {
  const maxHp = getPokemonHp(defender).max || 1;
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
): Promise<{ best?: DraftMoveThreat; bestStab?: DraftMoveThreat }> {
  const moves = candidateMoves(attackerProfile.species, generation);
  let best: DraftMoveThreat | undefined;
  let bestStab: DraftMoveThreat | undefined;
  for (let index = 0; index < moves.length; index++) {
    if (isCancelled()) return {};
    const move = moves[index];
    const attacker = makeDraftSet(attackerProfile, move, "attacker");
    const defender = makeDraftSet(defenderProfile, move, "defender");
    const result = calculateMove(attacker, defender, move.name, blankField, undefined, undefined, false, generation, false);
    counters.evaluated++;
    if (result) {
      const candidate = summarizeMove(move, result, attackerProfile, defender);
      if (isBetterMove(candidate, best)) best = candidate;
      if (candidate.stab && isBetterMove(candidate, bestStab)) bestStab = candidate;
    }
    if ((index + 1) % CHUNK_SIZE === 0) await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  return { best, bestStab };
}

/**
 * Analyze one hovered draft Pokémon against the opposing roster. Damage uses a
 * neutral, unboosted, no-item baseline with 252 EVs in the relevant attacking
 * stat and 252 HP / 252 relevant defense EVs. Results are potential matchups,
 * not guaranteed set-based battle predictions.
 */
export async function analyzeDraftPokemon(
  attacker: DraftPokemonProfile,
  opponents: DraftPokemonProfile[],
  generation = 9,
  isCancelled: () => boolean = () => false,
): Promise<DraftMatchupAnalysis> {
  const cacheKey = JSON.stringify([generation, attacker, opponents]);
  const cached = analysisCache.get(cacheKey);
  if (cached) return cached;
  const counters = { evaluated: 0 };
  const results: DraftOpponentResult[] = [];
  for (const opponent of opponents) {
    if (isCancelled()) break;
    const [outgoing, reply] = await Promise.all([
      bestAttack(attacker, opponent, generation, counters, isCancelled),
      bestAttack(opponent, attacker, generation, counters, isCancelled),
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
    note: "Potential matchups only: top three eligible moves per type/category, neutral nature, no items or field effects, and 252 EVs in the relevant attacking/defending stats. Damage and multi-hit probabilities inherit the calculator's supported mechanics; this is not a guaranteed set or battle prediction.",
  };
  if (!isCancelled()) {
    analysisCache.set(cacheKey, analysis);
    if (analysisCache.size > 64) analysisCache.delete(analysisCache.keys().next().value || "");
  }
  return analysis;
}
