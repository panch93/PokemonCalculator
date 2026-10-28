"use client";

import { binDamageDistribution } from "../lib/damage-distribution";
import type { DamageSummary } from "../lib/types";

type Props = { move: string; result: DamageSummary; description?: string };

const percent = (damage: number, maxHp: number) => maxHp > 0 ? (damage / maxHp) * 100 : 0;

export default function DamageHistogramTooltip({ move, result, description }: Props) {
  const outcomes = result.histogram || [];
  if (!outcomes.length) return <div className="damage-histogram-tooltip"><strong>{move}</strong><p>Damage distribution is unavailable for this move.</p>{description ? <details className="damage-histogram-details" open><summary>Move and battle details</summary><pre>{description}</pre></details> : null}</div>;
  const maxHp = result.maxHp || (result.maxPct > 0 ? result.max / (result.maxPct / 100) : result.effectiveHp);
  const percentOutcomes = outcomes.map(outcome => ({ damage: percent(outcome.damage, maxHp), probability: outcome.probability }));
  const bins = binDamageDistribution(percentOutcomes, 24);
  const isBinned = outcomes.length > bins.length;
  const peak = Math.max(...bins.map(outcome => outcome.probability), 0.0001);
  const koChance = outcomes.reduce((sum, outcome) => sum + (outcome.damage >= result.effectiveHp ? outcome.probability : 0), 0) * 100;
  const missChance = (outcomes.find(outcome => outcome.damage === 0)?.probability || 0) * 100;
  const successfulHitCounts = result.hitCounts?.filter(entry => entry.hits > 0) || [];
  return <div className="damage-histogram-tooltip" role="tooltip">
    <div className="damage-histogram-heading"><strong>{move}</strong><span>{percent(result.min, maxHp).toFixed(1)}–{percent(result.max, maxHp).toFixed(1)}% HP</span></div>
    <div className="damage-histogram-stats"><span>KO chance: <b>{koChance.toFixed(1)}%</b></span><span>Miss/no damage: <b>{missChance.toFixed(1)}%</b></span><span>Accuracy: <b>{result.accuracy == null ? "—" : `${result.accuracy.toFixed(1)}%`}</b></span></div>
    {successfulHitCounts.length ? <div className="damage-histogram-hitcounts"><b>Hit count:</b> {successfulHitCounts.map(entry => `${entry.hits} ${entry.hits === 1 ? "hit" : "hits"} ${(entry.probability * 100).toFixed(1)}%`).join(" · ")}</div> : null}
    <div className="damage-histogram-chart" aria-label={`Damage probability histogram for ${move}`}>
      {bins.map((outcome, index) => <div className="damage-histogram-bar-wrap" key={`${outcome.damage}-${index}`} title={`${isBinned ? "Approx. " : ""}${outcome.damage.toFixed(1)}% HP${isBinned ? " (bin center)" : ""} · ${(outcome.probability * 100).toFixed(2)}%`}>
        <div className="damage-histogram-bar" style={{ height: `${Math.max(2, (outcome.probability / peak) * 100)}%` }} />
      </div>)}
    </div>
    <div className="damage-histogram-axis"><span>{percent(outcomes[0].damage, maxHp).toFixed(1)}%</span><span>{percent(outcomes[outcomes.length - 1].damage, maxHp).toFixed(1)}%</span></div>
    <p className="damage-histogram-note">Bars combine adjacent outcomes for display. {result.distributionNote || "Damage probabilities are based on the calculator's available rolls."}</p>
    {description ? <details className="damage-histogram-details" open><summary>Move and battle details</summary><pre>{description}</pre></details> : null}
  </div>;
}
