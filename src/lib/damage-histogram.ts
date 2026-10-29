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
  // Remove edge bins until each tail reaches the target. A single unusually
  // large edge mass (>2x the requested tail) is retained rather than discarded
  // wholesale; ordinary fine bins just over 3% are removed so the cutoff is
  // visible instead of leaving a sub-threshold tail on screen.
  while (left < right && lowTail < threshold) {
    const next = sorted[left].probability;
    if (next > threshold * 2) break;
    lowTail += next;
    left++;
  }
  while (right > left && highTail < threshold) {
    const next = sorted[right].probability;
    if (next > threshold * 2) break;
    highTail += next;
    right--;
  }
  return sorted.slice(left, right + 1);
}

/**
 * Prepare the plotted distribution conditional on doing damage. Keep the full
 * damage range, including rare low- and high-damage outcomes. Miss/no-damage
 * probability is displayed separately by the tooltip.
 */
export function prepareDamageHistogram(
  outcomes: DamageOutcome[],
  maxBins = 180,
  _tailProbability = 0,
): DamageOutcome[] {
  const successful = outcomes.filter(outcome => outcome.damage > 0 && outcome.probability > 0);
  const total = successful.reduce((sum, outcome) => sum + outcome.probability, 0);
  if (!total) return [];
  const conditional = successful.map(outcome => ({ ...outcome, probability: outcome.probability / total }));
  return binDamageDistribution(conditional, maxBins);
}
