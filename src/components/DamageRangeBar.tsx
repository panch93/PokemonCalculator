import type { DamageSummary } from "../lib/types";
import { medianSuccessfulHitCount } from "../lib/damage-distribution";

type Props = { result: DamageSummary };

export function getKoClass(ko: string) {
  if (ko === "No damage") return "ko-none";
  const tier = ko.includes(" · ") ? ko.split(" · ").pop() || ko : ko;
  if (tier.includes("1HKO") || tier.includes("OHKO")) return "ko-1";
  if (tier.includes("2HKO")) return "ko-2";
  if (tier.includes("3HKO")) return "ko-3";
  if (tier.includes("4HKO")) return "ko-4";
  return "ko-5";
}

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

/** Consistent matrix damage display: minimum fill, translucent maximum extension, and calculator critical marker. */
export default function DamageRangeBar({ result }: Props) {
  const isMultiHit = Boolean(result.hitCounts?.some(entry => entry.hits > 1));
  const medianPct = result.maxHp > 0 ? (result.medianDamage ?? (result.min + result.max) / 2) / result.maxHp * 100 : (result.minPct + result.maxPct) / 2;
  const minimum = clampPercent(isMultiHit ? medianPct : result.minPct);
  const maximum = clampPercent(result.maxPct);
  const colorClass = getKoClass(result.ko);
  const successfulCounts = result.hitCounts?.filter(entry => entry.hits > 0) || [];
  const minHits = successfulCounts.length ? Math.min(...successfulCounts.map(entry => entry.hits)) : 1;
  const maxHits = successfulCounts.length ? Math.max(...successfulCounts.map(entry => entry.hits)) : 1;
  const medianHits = result.hitCounts ? medianSuccessfulHitCount(result.hitCounts) : null;
  const criticalMaximum = result.critMaxPct === undefined ? undefined : clampPercent(result.critMaxPct);

  return (
    <span className="damage-inline">
      <span
        className="damage-bar-track"
        aria-label={`${isMultiHit ? `Median damage ${medianPct.toFixed(1)} percent; ` : ""}Damage ${result.minPct.toFixed(1)} to ${result.maxPct.toFixed(1)} percent${result.critMaxPct !== undefined ? `; critical range ${result.critMinPct?.toFixed(1)} to ${result.critMaxPct.toFixed(1)} percent` : ""}`}
      >
        <span className={`damage-bar-range ${colorClass}`} style={{ width: `${maximum}%` }} />
        <span className={`damage-bar-minimum ${colorClass}`} style={{ width: `${minimum}%` }} />
        {criticalMaximum !== undefined && (
          <span
            className="damage-bar-crit"
            title={`Calculator critical range: ${result.critMinPct?.toFixed(1)}–${result.critMaxPct?.toFixed(1)}%`}
            style={{ left: `${criticalMaximum}%` }}
          />
        )}
      </span>
      <strong className={isMultiHit ? "damage-multihit-label" : undefined}>{isMultiHit && medianHits !== null ? `${minHits === maxHits ? `${maxHits} hits` : `${minHits}–${maxHits} hits (${medianHits} hits)`} × ${result.minPct.toFixed(1)}–${result.maxPct.toFixed(1)}% damage` : `${result.minPct.toFixed(1)}–${result.maxPct.toFixed(1)}%`}</strong>
      <em>{result.ko}</em>
    </span>
  );
}
