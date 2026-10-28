import { binDamageDistribution, type DamageOutcome } from "./damage-distribution";

/** Trim cumulative probability tails from the low and high ends of a sorted distribution. */
export function trimDistributionTails(outcomes: DamageOutcome[], tailProbability = 0.03): DamageOutcome[] {
  const sorted = outcomes
    .filter(outcome => Number.isFinite(outcome.damage) && Number.isFinite(outcome.probability) && outcome.probability > 0)
    .sort((a, b) => a.damage - b.damage);
  if (sorted.length <= 2) return sorted;
  const threshold = Math.max(0, Math.min(0.49, tailProbability));
  let left = 0;
  let right = sorted.length - 1;
  let lowTail = 0;
  let highTail = 0;
  while (left < right && lowTail + sorted[left].probability < threshold) {
    lowTail += sorted[left].probability;
    left++;
  }
  while (right > left && highTail + sorted[right].probability < threshold) {
    highTail += sorted[right].probability;
    right--;
  }
  return sorted.slice(left, right + 1);
}

/** Return a fine-bin histogram distribution after trimming approximately 3% tails. */
export function prepareDamageCurve(outcomes: DamageOutcome[], maxPoints = 180): DamageOutcome[] {
  return binDamageDistribution(trimDistributionTails(outcomes, 0.03), maxPoints);
}
