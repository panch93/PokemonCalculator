"use client";

import { getMoveDetails, getPokemonTypes } from "../lib/calc";
import { Matchup, PokemonSet, StatStages } from "../lib/types";

type Props = {
  left: PokemonSet[];
  right: PokemonSet[];
  matchups: (Matchup | null)[][];
  selected: { row: number; col: number } | null;
  swapped: boolean;
  rowMoves: string[];
  rowStages: StatStages[];
  colStages: StatStages[];
  onToggleSwap: () => void;
  onSelect: (row: number, col: number) => void;
  onMoveChange: (row: number, move: string) => void;
  onAttackStageChange: (row: number, value: number) => void;
  onDefenseStageChange: (col: number, value: number) => void;
};

const STAGES = Array.from({ length: 13 }, (_, i) => i - 6);
const stageOptions = STAGES.map(stage => ({ value: String(stage), label: stage > 0 ? `+${stage}` : String(stage) }));
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
function formatMoveTooltip(name: string) {
  const detail = getMoveDetails(name);
  if (!detail) return name;
  const power = detail.power === null ? "Variable / no direct power" : `Base power: ${detail.power}`;
  const accuracy = detail.accuracy === null ? "Accuracy: —" : `Accuracy: ${detail.accuracy}%`;
  const pp = detail.pp === null ? "PP: —" : `PP: ${detail.pp}`;
  return `${detail.name}\n${detail.type} · ${detail.category}\n${power}\n${accuracy} · ${pp}\nPriority: ${detail.priority}\n\n${detail.description}`;
}

export default function MatchupMatrix(props: Props) {
  const { left, right, matchups, selected, swapped, rowMoves, rowStages, colStages } = props;
  return (
    <section className="panel matrix-panel">
      <div className="panel-title-row">
        <div><h2>6 × 6 matchup matrix</h2><p>Choose one move per attacking row. Stage changes affect the calculator's stat stages.</p></div>
        <button onClick={props.onToggleSwap} title="Swap the attacking and defending teams">⇄ {swapped ? "Team B attacks" : "Team A attacks"}</button>
      </div>
      <div className="ko-legend" aria-label="KO colour legend">
        <span className="ko-1">1HKO</span><span className="ko-2">2HKO</span><span className="ko-3">3HKO</span><span className="ko-4">4HKO</span><span className="ko-5">4HKO+</span>
      </div>
      <div className="matrix-scroll">
        <table className="matrix">
          <thead><tr>
            <th className="corner">Attacker ↓ / Defender →</th>
            {right.map((poke, col) => {
              const types = getPokemonTypes(poke);
              return <th key={`${poke.name}-${col}`}>
                <span className="matrix-pokemon-name">{col + 1}. {poke.name}</span>
                <span className="type-list">{types.map(type => <span className={typeClass(type)} key={type}>{type}</span>)}</span>
                <span className="stage-control"><small>Def stage</small><select aria-label={`${poke.name} defence stage`} value={colStages[col]?.def ?? 0} onChange={e => props.onDefenseStageChange(col, Number(e.target.value))}>{stageOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></span>
              </th>;
            })}
          </tr></thead>
          <tbody>{left.map((poke, row) => {
            const types = getPokemonTypes(poke);
            const availableMoves = poke.moves.filter(Boolean).slice(0, 4);
            const selectedMove = rowMoves[row] || availableMoves[0] || "";
            const details = selectedMove ? getMoveDetails(selectedMove) : null;
            return <tr key={`${poke.name}-${row}`}>
              <th className="row-header">
                <span className="matrix-pokemon-name">{row + 1}. {poke.name}</span>
                <span className="type-list">{types.map(type => <span className={typeClass(type)} key={type}>{type}</span>)}</span>
                <span className="stage-control"><small>Atk stage</small><select aria-label={`${poke.name} attack stage`} value={rowStages[row]?.atk ?? 0} onChange={e => props.onAttackStageChange(row, Number(e.target.value))}>{stageOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></span>
                <select className="row-move-select" aria-label={`${poke.name} selected move`} value={selectedMove} title={selectedMove ? formatMoveTooltip(selectedMove) : "No moves imported"} onChange={e => props.onMoveChange(row, e.target.value)}>
                  {!availableMoves.length && <option value="">No moves</option>}
                  {availableMoves.map(move => <option key={move} value={move} title={formatMoveTooltip(move)}>{move}</option>)}
                </select>
                {details && <span className="row-move-meta" title={formatMoveTooltip(selectedMove)}><span className={typeClass(details.type)}>{details.type}</span><span>{details.category === "Physical" ? "PHY" : details.category === "Special" ? "SPL" : details.category}</span></span>}
              </th>
              {right.map((_, col) => {
                const item = matchups[row]?.[col];
                const result = item?.moves.find(move => move.move === selectedMove) || (item?.best?.move === selectedMove ? item.best : undefined);
                const active = selected?.row === row && selected?.col === col;
                const tier = result ? koClass(result.ko) : "ko-none";
                const title = result ? `${selectedMove}\n${result.min}–${result.max} HP · ${result.minPct.toFixed(1)}–${result.maxPct.toFixed(1)}%\n${result.ko}\n${formatMoveTooltip(selectedMove)}` : "No valid result for this move";
                return <td key={col}><button title={title} className={`matrix-cell ${tier} ${active ? "active" : ""}`} onClick={() => props.onSelect(row, col)}>
                  {result ? <><strong>{result.maxPct.toFixed(0)}%</strong><small>{selectedMove}</small><em>{result.ko}</em></> : <span>—</span>}
                </button></td>;
              })}
            </tr>;
          })}</tbody>
        </table>
      </div>
    </section>
  );
}
