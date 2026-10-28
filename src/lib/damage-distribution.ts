/**
 * Probability aggregation for damage rolls. This module deliberately contains
 * no Pokémon battle formulas: @smogon/calc supplies each hit's damage rolls,
 * and this module combines them without enumerating every roll combination.
 * Multi-hit accuracy and hit-count rules are approximate, generation-aware
 * defaults and are marked as such in the returned metadata.
 */
export type DamageOutcome = { damage: number; probability: number };
export type HitCountOutcome = { hits: number; probability: number };
export type MultiHitProfile = {
  minHits: number;
  maxHits: number;
  hitCounts: HitCountOutcome[];
  accuracyPerHit: boolean;
  increasingPower?: boolean;
};
export type DamageDistribution = {
  outcomes: DamageOutcome[];
  hitCounts?: HitCountOutcome[];
  accuracy: number;
  isMultiHit: boolean;
  approximate: boolean;
  note?: string;
};

type DistributionInput = {
  damage: unknown;
  moveName: string;
  accuracy: number | null | undefined;
  item?: string;
  ability?: string;
  defenderAbility?: string;
  weather?: string;
  category?: string;
  generation?: number;
};

const id = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
function uniformRolls(values: number[]): DamageOutcome[] {
  if (!values.length) return [];
  const counts = new Map<number, number>();
  for (const value of values) {
    if (Number.isFinite(value)) counts.set(Math.max(0, Math.floor(value)), (counts.get(Math.max(0, Math.floor(value))) || 0) + 1);
  }
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  return total ? [...counts.entries()].map(([damage, count]) => ({ damage, probability: count / total })).sort((a, b) => a.damage - b.damage) : [];
}

function normalize(outcomes: DamageOutcome[]): DamageOutcome[] {
  const merged = new Map<number, number>();
  for (const outcome of outcomes) {
    if (!Number.isFinite(outcome.damage) || !Number.isFinite(outcome.probability) || outcome.probability <= 0) continue;
    const damage = Math.max(0, Math.floor(outcome.damage));
    merged.set(damage, (merged.get(damage) || 0) + outcome.probability);
  }
  const total = [...merged.values()].reduce((sum, probability) => sum + probability, 0);
  return total > 0 ? [...merged.entries()].map(([damage, probability]) => ({ damage, probability: probability / total })).sort((a, b) => a.damage - b.damage) : [];
}

/** Combine two distributions in O(distinct totals × outcomes), merging equal totals. */
export function combineDamageDistributions(left: DamageOutcome[], right: DamageOutcome[]): DamageOutcome[] {
  const combined: DamageOutcome[] = [];
  for (const a of left) for (const b of right) combined.push({ damage: a.damage + b.damage, probability: a.probability * b.probability });
  return normalize(combined);
}

function fixedHits(hits: number, accuracyPerHit = false, increasingPower = false): MultiHitProfile {
  return { minHits: hits, maxHits: hits, hitCounts: [{ hits, probability: 1 }], accuracyPerHit, increasingPower };
}

/**
 * The intentionally small first-pass ruleset covers common Gen 9 multi-hit
 * moves. Unknown moves fall back to the damage shape exposed by the calculator.
 */
export function getMultiHitProfile(moveName: string, item = "", ability = "", generation = 9): MultiHitProfile | null {
  const move = id(moveName);
  const heldItem = id(item);
  const heldAbility = id(ability);
  if (generation < 2) return null;

  if (move === "populationbomb" && generation >= 9) return fixedHits(10, true);
  if (move === "tripleaxel" && generation >= 8) return fixedHits(3, true, true);
  if (move === "triplekick") return fixedHits(3, true, true);
  if (move === "watershuriken" && generation >= 7) return fixedHits(3);
  if (["dualwingbeat", "dualchop", "doublehit", "doubleironbash", "doublekick", "geargrind", "twineedle", "twinbeam", "tachyoncutter", "dragonarrows", "dragon darts", "bonemerang", "surgingstrikes", "triple dive"].map(id).includes(move)) {
    const hits = ["surgingstrikes", "tripledive"].includes(move) ? 3 : 2;
    return fixedHits(hits, false, false);
  }

  const randomTwoToFive = new Set([
    "armthrust", "barrage", "bonerush", "bulletseed", "cometpunch", "doubleslap", "furyattack", "furyswipes", "iciclespear",
    "pinmissile", "rockblast", "scale shot", "scaleshot", "spikecannon", "tail slap", "tailslap", "water shuriken", "watershuriken",
  ]);
  if (!randomTwoToFive.has(move)) return null;
  if (heldAbility === "skilllink" && generation >= 4) return fixedHits(5);
  if (heldItem === "loadeddice" && generation >= 9) {
    return { minHits: 4, maxHits: 5, hitCounts: [{ hits: 4, probability: 0.5 }, { hits: 5, probability: 0.5 }], accuracyPerHit: false };
  }
  return {
    minHits: 2,
    maxHits: 5,
    hitCounts: [
      { hits: 2, probability: 3 / 8 },
      { hits: 3, probability: 3 / 8 },
      { hits: 4, probability: 1 / 8 },
      { hits: 5, probability: 1 / 8 },
    ],
    accuracyPerHit: false,
  };
}

function effectiveAccuracy(input: DistributionInput): number {
  let accuracy = input.accuracy == null ? 100 : input.accuracy;
  const item = id(input.item || "");
  const ability = id(input.ability || "");
  const defenderAbility = id(input.defenderAbility || "");
  const move = id(input.moveName);
  const generation = input.generation ?? 9;
  if (generation >= 4 && (ability === "noguard" || defenderAbility === "noguard")) return 100;
  if (generation >= 4 && move === "blizzard" && id(input.weather || "") === "snow") return 100;
  if (["thunder", "hurricane"].includes(move)) {
    if (id(input.weather || "") === "rain") return 100;
    if (id(input.weather || "") === "sun" || id(input.weather || "") === "sunnyday") accuracy *= 0.5;
  }
  if (generation >= 4 && item === "widelens") accuracy *= 1.1;
  // Zoom Lens is conditional on moving after the target; without a full turn
  // order in this API we include it as an explicitly approximate modifier.
  if (generation >= 4 && item === "zoomlens") accuracy *= 1.2;
  if (generation >= 3 && ability === "compoundeyes") accuracy *= 1.3;
  if (generation >= 5 && ability === "victorystar") accuracy *= 1.1;
  if (generation >= 3 && ability === "hustle" && id(input.category || "") === "physical") accuracy *= 0.8;
  return Math.max(0, Math.min(100, accuracy));
}

function asPerHitRolls(damage: unknown): number[][] | null {
  if (!Array.isArray(damage) || !damage.length) return null;
  if (damage.every(value => typeof value === "number" && Number.isFinite(value))) return [damage as number[]];
  const perHit = damage.map(value => {
    if (typeof value === "number" && Number.isFinite(value)) return [value];
    if (Array.isArray(value)) return value.filter((roll): roll is number => typeof roll === "number" && Number.isFinite(roll));
    return [];
  });
  return perHit.every(rolls => rolls.length > 0) ? perHit : null;
}

/** Build a compact exact-roll histogram for one hit and an efficient approximate distribution for multi-hit moves. */
export function buildDamageDistribution(input: DistributionInput): DamageDistribution | null {
  const perHitRolls = asPerHitRolls(input.damage);
  if (!perHitRolls) return null;
  const profile = getMultiHitProfile(input.moveName, input.item, input.ability, input.generation);
  const nested = Array.isArray(input.damage) && input.damage.some(value => Array.isArray(value));
  const inferredProfile = profile || (nested && perHitRolls.length > 1 ? fixedHits(perHitRolls.length) : null);
  const isMultiHit = Boolean(inferredProfile && inferredProfile.maxHits > 1);
  const accuracy = effectiveAccuracy(input) / 100;
  const singleHitRolls = uniformRolls(perHitRolls[0]);

  if (!isMultiHit) {
    const outcomes = singleHitRolls.map(outcome => ({ damage: outcome.damage, probability: outcome.probability * accuracy }));
    if (accuracy < 1) outcomes.push({ damage: 0, probability: 1 - accuracy });
    const zoomLensApproximation = (input.generation ?? 9) >= 4 && id(input.item || "") === "zoomlens";
    const note = [accuracy < 1 ? "Miss probability included." : "", zoomLensApproximation ? "Zoom Lens assumes its accuracy condition is met." : "", "Critical hits are excluded."].filter(Boolean).join(" ");
    return { outcomes: normalize(outcomes), accuracy: accuracy * 100, isMultiHit: false, approximate: zoomLensApproximation, note };
  }

  const hitProfiles = inferredProfile!;
  const hitDistributions = perHitRolls.map(uniformRolls);
  const maxHitsAvailable = Math.max(1, hitProfiles.maxHits);
  const hitCountProbabilities: HitCountOutcome[] = [];

  if (hitProfiles.accuracyPerHit) {
    // Each hit requires another successful accuracy check. The first failed
    // check stops the sequence; zero-hit outcomes are included in the histogram.
    for (let hits = 0; hits < maxHitsAvailable; hits++) {
      const probability = hits === 0 ? 1 - accuracy : Math.pow(accuracy, hits) * (1 - accuracy);
      if (probability > 0) hitCountProbabilities.push({ hits, probability });
    }
    hitCountProbabilities.push({ hits: maxHitsAvailable, probability: Math.pow(accuracy, maxHitsAvailable) });
  } else {
    for (const option of hitProfiles.hitCounts) {
      const hits = Math.min(option.hits, maxHitsAvailable);
      hitCountProbabilities.push({ hits, probability: option.probability * accuracy });
    }
    if (accuracy < 1) hitCountProbabilities.push({ hits: 0, probability: 1 - accuracy });
  }

  // Build each cumulative hit distribution once. Every possible hit count can
  // then reuse the already-combined totals instead of repeating the same work.
  const cumulativeByHits: DamageOutcome[][] = [[{ damage: 0, probability: 1 }]];
  for (let hits = 1; hits <= maxHitsAvailable; hits++) {
    const rollDistribution = hitDistributions[Math.min(hits - 1, hitDistributions.length - 1)] || singleHitRolls;
    cumulativeByHits[hits] = combineDamageDistributions(cumulativeByHits[hits - 1], rollDistribution);
  }

  const accumulated: DamageOutcome[] = [];
  for (const hitOption of hitCountProbabilities) {
    const sequence = cumulativeByHits[Math.min(hitOption.hits, maxHitsAvailable)] || cumulativeByHits[0];
    for (const outcome of sequence) accumulated.push({ damage: outcome.damage, probability: outcome.probability * hitOption.probability });
  }

  const normalized = normalize(accumulated);
  const counts = hitCountProbabilities.reduce((map, entry) => {
    map.set(entry.hits, (map.get(entry.hits) || 0) + entry.probability);
    return map;
  }, new Map<number, number>());
  const hitCounts = [...counts.entries()].filter(([, probability]) => probability > 0).map(([hits, probability]) => ({ hits, probability })).sort((a, b) => a.hits - b.hits);
  const approximations: string[] = [];
  if (perHitRolls.length < hitProfiles.maxHits) approximations.push("The calculator did not expose separate damage rolls for every hit; the last available per-hit distribution is reused for missing hits.");
  if (!nested && hitProfiles.increasingPower) approximations.push("This move's increasing per-hit power is approximated using the first hit's damage distribution.");
  if ((input.generation ?? 9) >= 4 && input.item && id(input.item) === "zoomlens") approximations.push("Zoom Lens assumes its accuracy condition is met.");
  approximations.push("Multi-hit count and accuracy probabilities use the supported ruleset approximation; critical hits are excluded.");
  return { outcomes: normalized, hitCounts, accuracy: accuracy * 100, isMultiHit: true, approximate: true, note: approximations.join(" ") };
}


/** Weighted median outcome; equal-probability damage rolls retain their weight. */
export function medianDamageOutcome(outcomes: DamageOutcome[]): number {
  if (!outcomes.length) return 0;
  const sorted = [...outcomes].filter(outcome => outcome.probability > 0).sort((a, b) => a.damage - b.damage);
  const total = sorted.reduce((sum, outcome) => sum + outcome.probability, 0);
  if (!total) return 0;
  let cumulative = 0;
  for (const outcome of sorted) {
    cumulative += outcome.probability;
    if (cumulative >= total / 2) return outcome.damage;
  }
  return sorted[sorted.length - 1]?.damage ?? 0;
}

/** Weighted median hit count conditional on the move connecting at least once. */
export function medianSuccessfulHitCount(hitCounts: HitCountOutcome[]): number | null {
  const successful = hitCounts.filter(entry => entry.hits > 0 && entry.probability > 0).sort((a, b) => a.hits - b.hits);
  const total = successful.reduce((sum, entry) => sum + entry.probability, 0);
  if (!total) return null;
  let cumulative = 0;
  for (const entry of successful) {
    cumulative += entry.probability;
    if (cumulative >= total / 2) return entry.hits;
  }
  return successful[successful.length - 1]?.hits ?? null;
}

/** Group a large outcome distribution into display bins without losing total probability. */
export function binDamageDistribution(outcomes: DamageOutcome[], maxBins = 24): DamageOutcome[] {
  if (outcomes.length <= maxBins) return outcomes;
  const min = outcomes[0]?.damage ?? 0;
  const max = outcomes[outcomes.length - 1]?.damage ?? min;
  if (max <= min) return [{ damage: min, probability: outcomes.reduce((sum, outcome) => sum + outcome.probability, 0) }];
  const width = (max - min + 1) / maxBins;
  const bins = new Map<number, number>();
  for (const outcome of outcomes) {
    const bin = Math.min(maxBins - 1, Math.floor((outcome.damage - min) / width));
    bins.set(bin, (bins.get(bin) || 0) + outcome.probability);
  }
  return [...bins.entries()].sort((a, b) => a[0] - b[0]).map(([bin, probability]) => ({ damage: Math.round((min + (bin + 0.5) * width) * 10) / 10, probability }));
}

/** Apply a deterministic post-calculation modifier and merge any newly identical outcomes. */
export function scaleDamageOutcomes(outcomes: DamageOutcome[], modifier: (damage: number) => number): DamageOutcome[] {
  return normalize(outcomes.map(outcome => ({ damage: modifier(outcome.damage), probability: outcome.probability })));
}
