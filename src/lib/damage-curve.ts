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
  // Remove whole outcomes until the cumulative tail reaches the target, but
  // avoid deleting a large central probability mass just to cross the cutoff.
  // When the next discrete outcome crosses the target, keep it only if removing
  // it is at least as close to 3% as stopping with a sub-threshold tail.
  while (left < right && lowTail < threshold) {
    const next = sorted[left].probability;
    if (lowTail + next >= threshold && Math.abs(threshold - (lowTail + next)) > Math.abs(threshold - lowTail) + 1e-12) break;
    lowTail += next;
    left++;
  }
  while (right > left && highTail < threshold) {
    const next = sorted[right].probability;
    if (highTail + next >= threshold && Math.abs(threshold - (highTail + next)) > Math.abs(threshold - highTail) + 1e-12) break;
    highTail += next;
    right--;
  }
  return sorted.slice(left, right + 1);
}

/** Return a fine-bin histogram while preserving the full damage range. */
export function prepareDamageCurve(outcomes: DamageOutcome[], maxPoints = 180): DamageOutcome[] {
  return binDamageDistribution(outcomes, maxPoints);
}
