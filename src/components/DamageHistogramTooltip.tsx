"use client";

import { prepareDamageHistogram } from "../lib/damage-histogram";
import type { DamageHistogramEntry, DamageSummary } from "../lib/types";

type Props = { move: string; result: DamageSummary; description?: string };

const percent = (damage: number, maxHp: number) => maxHp > 0 ? (damage / maxHp) * 100 : 0;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export default function DamageHistogramTooltip({ move, result, description }: Props) {
  const outcomes = result.histogram || [];
  const isMultiHit = Boolean(result.hitCounts?.some(entry => entry.hits > 1));
  const maxHp = result.maxHp || (result.maxPct > 0 ? result.max / (result.maxPct / 100) : result.effectiveHp);
  const percentOutcomes = outcomes.map(outcome => ({ damage: percent(outcome.damage, maxHp), probability: outcome.probability }));
  const successfulPercentOutcomes = percentOutcomes.filter(outcome => outcome.damage > 0 && outcome.probability > 0);
  const bars = isMultiHit ? prepareDamageHistogram(percentOutcomes, 180) : [];
  const peak = Math.max(...bars.map(outcome => outcome.probability), 0.0001);
  const chartWidth = 340;
  const chartHeight = 126;
  const plotLeft = 28;
  const plotRight = 332;
  const plotTop = 10;
  const plotBottom = 88;
  // Keep the full successful-damage domain on the x-axis. The removed tails
  // therefore appear as blank margins instead of being stretched back to the
  // chart edges, which previously made the cutoff visually impossible to see.
  const xMin = successfulPercentOutcomes.length ? Math.min(...successfulPercentOutcomes.map(outcome => outcome.damage)) : 0;
  const xMax = successfulPercentOutcomes.length ? Math.max(...successfulPercentOutcomes.map(outcome => outcome.damage)) : 100;
  const xSpan = Math.max(0.1, xMax - xMin);
  const gaps = bars.map((outcome, index) => index > 0 ? outcome.damage - bars[index - 1].damage : Infinity).filter(gap => gap > 0 && Number.isFinite(gap));
  const minimumBinStep = gaps.length ? Math.min(...gaps) : xSpan;
  const barWidth = bars.length ? Math.max(0.7, ((plotRight - plotLeft) * minimumBinStep) / xSpan) : 0;
  const barRects = bars.map((outcome, index) => {
    const x = plotLeft + ((outcome.damage - xMin) / xSpan) * (plotRight - plotLeft);
    const height = (outcome.probability / peak) * (plotBottom - plotTop);
    return { x: x - barWidth / 2, y: plotBottom - height, width: barWidth, height, damage: outcome.damage, probability: outcome.probability, index };
  });
  // Summary statistics all use the same distribution as the plotted bars:
  // successful damage only, renormalized conditional on doing damage.
  const successfulTotal = successfulPercentOutcomes.reduce((sum, outcome) => sum + outcome.probability, 0);
  const meanPct = successfulTotal > 0
    ? successfulPercentOutcomes.reduce((sum, outcome) => sum + outcome.damage * outcome.probability, 0) / successfulTotal
    : 0;
  const medianDamage = result.medianDamage ?? (result.min + result.max) / 2;
  const medianPct = percent(medianDamage, maxHp);
  const medianX = clamp(plotLeft + ((medianPct - xMin) / xSpan) * (plotRight - plotLeft), plotLeft, plotRight);
  const medianPlotPoint = bars.reduce<DamageHistogramEntry | undefined>((best, point) => {
    if (!best) return point;
    return Math.abs(point.damage - medianPct) < Math.abs(best.damage - medianPct) ? point : best;
  }, undefined);
  const medianY = medianPlotPoint ? plotBottom - (medianPlotPoint.probability / peak) * (plotBottom - plotTop) : plotBottom;
  const modePoint = bars.reduce<DamageHistogramEntry | undefined>((best, point) => !best || point.probability > best.probability ? point : best, undefined);
  const modePct = modePoint?.damage ?? 0;
  const meanX = clamp(plotLeft + ((meanPct - xMin) / xSpan) * (plotRight - plotLeft), plotLeft, plotRight);
  const modeX = clamp(plotLeft + ((modePct - xMin) / xSpan) * (plotRight - plotLeft), plotLeft, plotRight);
  const meanPoint = bars.reduce<DamageHistogramEntry | undefined>((best, point) => !best || Math.abs(point.damage - meanPct) < Math.abs(best.damage - meanPct) ? point : best, undefined);
  const meanY = meanPoint ? plotBottom - (meanPoint.probability / peak) * (plotBottom - plotTop) : plotBottom;
  const modeY = modePoint ? plotBottom - (modePoint.probability / peak) * (plotBottom - plotTop) : plotBottom;
  const ticks = Array.from({ length: 5 }, (_, index) => ({ x: plotLeft + ((plotRight - plotLeft) * index) / 4, value: xMin + (xSpan * index) / 4 }));
  const koChance = outcomes.reduce((sum, outcome) => sum + (outcome.damage >= result.effectiveHp ? outcome.probability : 0), 0) * 100;
  const missChance = (outcomes.find(outcome => outcome.damage === 0)?.probability || 0) * 100;
  const successfulHitCounts = isMultiHit ? result.hitCounts?.filter(entry => entry.hits > 0) || [] : [];

  return <div className="damage-histogram-tooltip" role="tooltip">
    <div className="damage-histogram-heading"><strong>{move}</strong><span>{percent(result.min, maxHp).toFixed(1)}–{percent(result.max, maxHp).toFixed(1)}% HP</span></div>
    <div className="damage-histogram-stats"><span>KO chance: <b>{koChance.toFixed(1)}%</b></span><span>Miss/no damage: <b>{missChance.toFixed(1)}%</b></span><span>Accuracy: <b>{result.accuracy == null ? "—" : `${result.accuracy.toFixed(1)}%`}</b></span></div>
    {successfulHitCounts.length ? <div className="damage-histogram-hitcounts"><b>Hit count:</b> {successfulHitCounts.map(entry => `${entry.hits} ${entry.hits === 1 ? "hit" : "hits"} ${(entry.probability * 100).toFixed(1)}%`).join(" · ")}</div> : null}
    {isMultiHit && bars.length > 1 ? <>
      <div className="damage-histogram-median damage-histogram-summary">
        <span>Mean: <b>{meanPct.toFixed(1)}% HP</b></span>
        <span>Median: <b>{medianPct.toFixed(1)}% HP</b></span>
        <span>Mode: <b>{modePct.toFixed(1)}% HP</b></span>
        <small>Statistics are conditional on dealing damage.</small>
      </div>
      <svg className="damage-histogram-bars" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label={`Fine-bin damage probability histogram for ${move}; dotted line marks median damage`}>
        {[0.25, 0.5, 0.75].map(fraction => <line key={fraction} x1={plotLeft} x2={plotRight} y1={plotBottom - fraction * (plotBottom - plotTop)} y2={plotBottom - fraction * (plotBottom - plotTop)} className="damage-curve-gridline" />)}
        {barRects.map(bar => <rect key={bar.index} x={bar.x} y={bar.y} width={Math.max(0.5, bar.width - 0.25)} height={Math.max(0, bar.height)} className="damage-histogram-bar"><title>{bar.damage.toFixed(1)}% HP · {(bar.probability * 100).toFixed(3)}% probability</title></rect>)}
        <line x1={meanX} x2={meanX} y1={plotTop} y2={plotBottom} className="damage-histogram-mean-line" />
        <circle cx={meanX} cy={meanY} r="3" className="damage-histogram-mean-point"><title>Mean {meanPct.toFixed(1)}% HP</title></circle>
        <line x1={medianX} x2={medianX} y1={plotTop} y2={plotBottom} className="damage-curve-median-line" />
        <circle cx={medianX} cy={medianY} r="3.5" className="damage-curve-median-point"><title>Median {medianPct.toFixed(1)}% HP</title></circle>
        <line x1={modeX} x2={modeX} y1={plotTop} y2={plotBottom} className="damage-histogram-mode-line" />
        <circle cx={modeX} cy={modeY} r="3" className="damage-histogram-mode-point"><title>Mode {modePct.toFixed(1)}% HP</title></circle>
        <line x1={plotLeft} x2={plotRight} y1={plotBottom} y2={plotBottom} className="damage-curve-axis-line" />
        {ticks.map((tick, index) => <g key={index}><line x1={tick.x} x2={tick.x} y1={plotBottom} y2={plotBottom + 3} className="damage-curve-axis-line" /><text x={tick.x} y={plotBottom + 14} textAnchor={index === 0 ? "start" : index === 4 ? "end" : "middle"} className="damage-curve-axis-label">{tick.value.toFixed(1)}%</text></g>)}
      </svg>
    </> : null}
    {description ? <details className="damage-histogram-details" open><summary>Move and battle details</summary><pre>{description}</pre></details> : null}
  </div>;
}
