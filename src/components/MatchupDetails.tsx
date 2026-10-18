"use client";

import { getMoveDetails } from "../lib/calc";
import { Matchup } from "../lib/types";

function typeClass(type: string) { return `type-badge type-${type.toLowerCase().replace(/[^a-z]/g, "")}`; }
function koClass(ko: string) {
  if (ko === "No damage") return "ko-none";
  const tier = ko.includes(" · ") ? ko.split(" · ").pop() || ko : ko;
  if (tier.includes("1HKO") || tier.includes("OHKO")) return "ko-1";
  if (tier.includes("2HKO")) return "ko-2";
  if (tier.includes("3HKO")) return "ko-3";
  if (tier.includes("4HKO")) return "ko-4";
  return "ko-5";
}

export default function MatchupDetails({ matchup }: { matchup: Matchup | null }) {
  if (!matchup) return <section className="panel details-panel empty"><h2>Select a matchup</h2><p>Click a cell in the matrix to inspect the move-by-move calculation.</p></section>;
  return <section className="panel details-panel">
    <div className="panel-title-row"><div><span className="eyebrow">{matchup.attacker.name} → {matchup.defender.name}</span><h2>Move-by-move damage</h2></div></div>
    <div className="details-list">{matchup.moves.length ? matchup.moves.map(move => {
      const details = getMoveDetails(move.move);
      return <article className={`damage-row ${koClass(move.ko)}`} key={move.move}>
        <div className="damage-head"><strong>{move.move}</strong><span>{move.ko}</span></div>
        {details && <div className="move-metadata"><span className={typeClass(details.type)}>{details.type}</span><span className="badge">{details.category}</span><span className="badge">BP {details.power ?? "Variable / —"}</span><span className="badge">Acc. {details.accuracy === null ? "—" : `${details.accuracy}%`}</span><span className="badge">PP {details.pp ?? "—"}</span></div>}
        <div className="bar"><i style={{ width: `${Math.min(move.maxPct, 100)}%` }} /></div>
        <div className="damage-values"><span>{move.min}–{move.max} HP</span><span>{move.minPct.toFixed(1)}–{move.maxPct.toFixed(1)}% of max HP</span></div>
        <small className="muted">KO estimate accounts for current HP. {move.entryHazardDamage > 0 ? `Entry hazards: -${move.entryHazardDamage} HP (${move.entryHazardPct.toFixed(1)}% of max HP).` : "No entry-hazard damage included."}</small>
        {details && <p className="move-description">{details.description}</p>}
        <code>{move.description}</code>
      </article>;
    }) : <p>No valid damaging moves were found on the current set.</p>}</div>
  </section>;
}
