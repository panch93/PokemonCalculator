"use client";

import { useEffect, useMemo, useState } from "react";
import { calculateMove, getMoveDetails } from "../lib/calc";
import { getMoveLibrary } from "../lib/moves";
import { FieldState, PokemonSet, StatStages } from "../lib/types";

export default function MoveExplorer({ attacker, defender, field, attackerStages = { atk: 0, spa: 0, def: 0, spd: 0, spe: 0, acc: 0, eva: 0 }, defenderStages = { atk: 0, spa: 0, def: 0, spd: 0, spe: 0, acc: 0, eva: 0 } }: { attacker: PokemonSet; defender: PokemonSet; field: FieldState; attackerStages?: StatStages; defenderStages?: StatStages }) {
  const [query, setQuery] = useState("");
  const [move, setMove] = useState("");
  const [result, setResult] = useState<ReturnType<typeof calculateMove>>(null);
  const library = useMemo(() => getMoveLibrary(), []);

  const filtered = library.filter(name => name.toLowerCase().includes(query.toLowerCase())).slice(0, 80);

  useEffect(() => {
    if (!move) {
      setResult(null);
      return;
    }
    setResult(calculateMove(attacker, defender, move, field, attackerStages, defenderStages));
  }, [attacker, defender, move, field, attackerStages, defenderStages]);

  return (
    <section className="panel explorer-panel">
      <div className="panel-title-row">
        <div>
          <h2>Move explorer</h2>
          <p>Test moves beyond the four currently listed on the set.</p>
        </div>
        <span className="badge">{library.length} moves indexed</span>
      </div>
      <div className="explorer-grid">
        <input placeholder="Search moves..." value={query} onChange={e => setQuery(e.target.value)} />
        <select value={move} onChange={e => setMove(e.target.value)}>
          <option value="">Choose a move</option>
          {filtered.map(name => <option key={name}>{name}</option>)}
        </select>
        <button className="primary" onClick={() => setResult(move ? calculateMove(attacker, defender, move, field, attackerStages, defenderStages) : null)}>Recalculate</button>
      </div>
      {result && (() => {
        const details = getMoveDetails(result.move);
        return <div className="explorer-result">
          <strong>{result.move}</strong>
          {details && <span>{details.type} · {details.category} · BP {details.power ?? "Variable / —"} · Accuracy {details.accuracy === null ? "—" : `${details.accuracy}%`} · PP {details.pp ?? "—"} · Priority {details.priority}</span>}
          {details && <p>{details.description}</p>}
          <span>{result.min}–{result.max} HP · {result.minPct.toFixed(1)}–{result.maxPct.toFixed(1)}% after hazards · {result.ko}</span>
          <code>{result.description}</code>
        </div>;
      })()}
    </section>
  );
}
