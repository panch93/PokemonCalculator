"use client";

import { prepareDamageCurve } from "../lib/damage-curve";
import type { DamageHistogramEntry, DamageSummary } from "../lib/types";

type Props = { move: string; result: DamageSummary; description?: string };

type PlotPoint = { x: number; y: number; damage: number; probability: number };
const percent = (damage: number, maxHp: number) => maxHp > 0 ? (damage / maxHp) * 100 : 0;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export default function DamageHistogramTooltip({ move, result, description }: Props) {
  const outcomes = result.histogram || [];
  const isMultiHit = Boolean(result.hitCounts?.some(entry => entry.hits > 1));
  const maxHp = result.maxHp || (result.maxPct > 0 ? result.max / (result.maxPct / 100) : result.effectiveHp);
  const percentOutcomes = outcomes.map(outcome => ({ damage: percent(outcome.damage, maxHp), probability: outcome.probability }));
  const curve = isMultiHit ? prepareDamageCurve(percentOutcomes, 64) : [];
  const peak = Math.max(...curve.map(outcome => outcome.probability), 0.0001);
  const chartWidth = 340;
  const chartHeight = 126;
  const plotLeft = 28;
  const plotRight = 332;
  const plotTop = 10;
  const plotBottom = 88;
  const xMin = curve[0]?.damage ?? 0;
  const xMax = curve[curve.length - 1]?.damage ?? 100;
  const xSpan = Math.max(0.1, xMax - xMin);
  const points: PlotPoint[] = curve.map(outcome => ({
    x: plotLeft + ((outcome.damage - xMin) / xSpan) * (plotRight - plotLeft),
    y: plotBottom - (outcome.probability / peak) * (plotBottom - plotTop),
    damage: outcome.damage,
    probability: outcome.probability,
  }));
  const curvePath = (() => {
    if (!points.length) return "";
    let path = `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
    for (let index = 0; index < points.length - 1; index++) {
      const previous = points[Math.max(0, index - 1)];
      const current = points[index];
      const next = points[index + 1];
      const after = points[Math.min(points.length - 1, index + 2)];
      const c1x = current.x + (next.x - previous.x) / 6;
      const c1y = current.y + (next.y - previous.y) / 6;
      const c2x = next.x - (after.x - current.x) / 6;
      const c2y = next.y - (after.y - current.y) / 6;
      path += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${next.x.toFixed(2)},${next.y.toFixed(2)}`;
    }
    return path;
  })();
  const areaPath = points.length ? `${curvePath} L${points[points.length - 1].x.toFixed(2)},${plotBottom} L${points[0].x.toFixed(2)},${plotBottom} Z` : "";
  const medianDamage = result.medianDamage ?? (result.min + result.max) / 2;
  const medianPct = percent(medianDamage, maxHp);
  const medianOutcome = outcomes.reduce<DamageHistogramEntry | undefined>((best, outcome) => {
    if (!best) return outcome;
    return Math.abs(outcome.damage - medianDamage) < Math.abs(best.damage - medianDamage) ? outcome : best;
  }, undefined);
  const medianX = clamp(plotLeft + ((medianPct - xMin) / xSpan) * (plotRight - plotLeft), plotLeft, plotRight);
  const medianPlotPoint = points.reduce<PlotPoint | undefined>((best, point) => {
    if (!best) return point;
    return Math.abs(point.damage - medianPct) < Math.abs(best.damage - medianPct) ? point : best;
  }, undefined);
  // When the curve is binned, show the probability mass of the nearest plotted
  // bin so the numeric label corresponds to the marker's height. Otherwise this
  // is the exact probability of the nearest damage roll.
  const medianProbability = medianPlotPoint?.probability ?? medianOutcome?.probability ?? 0;
  const medianY = medianPlotPoint?.y ?? plotBottom;
  const ticks = Array.from({ length: 5 }, (_, index) => ({ x: plotLeft + ((plotRight - plotLeft) * index) / 4, value: xMin + (xSpan * index) / 4 }));
  const koChance = outcomes.reduce((sum, outcome) => sum + (outcome.damage >= result.effectiveHp ? outcome.probability : 0), 0) * 100;
  const missChance = (outcomes.find(outcome => outcome.damage === 0)?.probability || 0) * 100;
  const successfulHitCounts = isMultiHit ? result.hitCounts?.filter(entry => entry.hits > 0) || [] : [];

  return <div className="damage-histogram-tooltip" role="tooltip">
    <div className="damage-histogram-heading"><strong>{move}</strong><span>{percent(result.min, maxHp).toFixed(1)}–{percent(result.max, maxHp).toFixed(1)}% HP</span></div>
    <div className="damage-histogram-stats"><span>KO chance: <b>{koChance.toFixed(1)}%</b></span><span>Miss/no damage: <b>{missChance.toFixed(1)}%</b></span><span>Accuracy: <b>{result.accuracy == null ? "—" : `${result.accuracy.toFixed(1)}%`}</b></span></div>
    {successfulHitCounts.length ? <div className="damage-histogram-hitcounts"><b>Hit count:</b> {successfulHitCounts.map(entry => `${entry.hits} ${entry.hits === 1 ? "hit" : "hits"} ${(entry.probability * 100).toFixed(1)}%`).join(" · ")}</div> : null}
    {isMultiHit && curve.length > 1 ? <>
      <div className="damage-histogram-median">Median: <b>{medianPct.toFixed(1)}% HP</b> · <b>{(medianProbability * 100).toFixed(2)}% at the marked point</b></div>
      <svg className="damage-histogram-curve" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label={`Filled damage probability curve for ${move}; dotted line marks median damage`}>
        {[0.25, 0.5, 0.75].map(fraction => <line key={fraction} x1={plotLeft} x2={plotRight} y1={plotBottom - fraction * (plotBottom - plotTop)} y2={plotBottom - fraction * (plotBottom - plotTop)} className="damage-curve-gridline" />)}
        <path d={areaPath} className="damage-curve-area" />
        <path d={curvePath} className="damage-curve-line" />
        <line x1={medianX} x2={medianX} y1={plotTop} y2={plotBottom} className="damage-curve-median-line" />
        <circle cx={medianX} cy={medianY} r="3.5" className="damage-curve-median-point"><title>Median {medianPct.toFixed(1)}% HP · {(medianProbability * 100).toFixed(2)}% probability at the nearest outcome</title></circle>
        <line x1={plotLeft} x2={plotRight} y1={plotBottom} y2={plotBottom} className="damage-curve-axis-line" />
        {ticks.map((tick, index) => <g key={index}><line x1={tick.x} x2={tick.x} y1={plotBottom} y2={plotBottom + 3} className="damage-curve-axis-line" /><text x={tick.x} y={plotBottom + 14} textAnchor={index === 0 ? "start" : index === 4 ? "end" : "middle"} className="damage-curve-axis-label">{tick.value.toFixed(1)}%</text></g>)}
      </svg>
      <p className="damage-histogram-note">Filled curve shows the approximate probability distribution. The x-axis is defender maximum HP%; tails below 1% cumulative probability at either end are omitted. {result.distributionNote || "Damage probabilities are based on the calculator's available rolls."}</p>
    </> : null}
    {description ? <details className="damage-histogram-details" open><summary>Move and battle details</summary><pre>{description}</pre></details> : null}
  </div>;
}
