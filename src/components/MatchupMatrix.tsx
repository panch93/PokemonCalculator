"use client";

import { getMoveDetails, getPokemonTypes } from "../lib/calc";
import { Matchup, PokemonSet, StatStages } from "../lib/types";

type Props = {
  left: PokemonSet[]; right: PokemonSet[]; matchups: (Matchup | null)[][];
  selected: { row: number; col: number } | null; swapped: boolean;
  rowMoves: string[]; rowStages: StatStages[]; colStages: StatStages[];
  critical: boolean; onCriticalChange: (value: boolean) => void; onToggleSwap: () => void;
  onSelect: (row: number, col: number) => void; onMoveChange: (row: number, move: string) => void;
  onAttackStageChange: (row: number, value: number) => void; onDefenseStageChange: (col: number, value: number) => void;
  onRowPokemonChange: (row: number, patch: Partial<PokemonSet>) => void; onColPokemonChange: (col: number, patch: Partial<PokemonSet>) => void;
};

const STAGES = Array.from({ length: 13 }, (_, i) => i - 6);
const stageOptions = STAGES.map(stage => ({ value: String(stage), label: stage > 0 ? `+${stage}` : String(stage) }));
function typeClass(type: string) { return `type-badge type-${type.toLowerCase().replace(/[^a-z]/g, "")}`; }
function displayTypes(pokemon: PokemonSet) {
  return pokemon.teraType ? [pokemon.teraType] : getPokemonTypes(pokemon);
}
function koClass(ko: string) {
  if (ko === "No damage") return "ko-none";
  const tier = ko.includes(" · ") ? ko.split(" · ").pop() || ko : ko;
  if (tier.includes("1HKO") || tier.includes("OHKO")) return "ko-1";
  if (tier.includes("2HKO")) return "ko-2";
  if (tier.includes("3HKO")) return "ko-3";
  if (tier.includes("4HKO")) return "ko-4";
  return "ko-5";
}
function spriteUrl(pokemon: PokemonSet) {
  const id = (pokemon.species || pokemon.name).toLowerCase().replace(/[^a-z0-9]/g, "");
  return `https://play.pokemonshowdown.com/sprites/gen5/${id}.png`;
}
function formatMoveTooltip(name: string) {
  const d = getMoveDetails(name);
  if (!d) return name;
  return `${d.name}\n${d.type} · ${d.category}\n${d.power === null ? "Variable / no direct power" : `Base power: ${d.power}`}\n${d.accuracy === null ? "Accuracy: —" : `Accuracy: ${d.accuracy}%`} · ${d.pp === null ? "PP: —" : `PP: ${d.pp}`}\nPriority: ${d.priority}\n\n${d.description}`;
}
function Sprite({ pokemon }: { pokemon: PokemonSet }) {
  return <img className="matrix-sprite" src={spriteUrl(pokemon)} alt={`${pokemon.species} sprite`} loading="lazy" onError={event => { event.currentTarget.style.visibility = "hidden"; }} />;
}

export default function MatchupMatrix(props: Props) {
  const { left, right, matchups, selected, swapped, rowStages, colStages } = props;
  return <section className="panel matrix-panel">
    <div className="panel-title-row"><div><h2>6 × 6 matchup matrix</h2><p>All four moves are shown for each attacker. Hover over a move or damage value for move details and damage rolls.</p></div><div className="button-row"><label className={`crit-toggle ${props.critical ? "active" : ""}`}><input type="checkbox" checked={props.critical} onChange={e => props.onCriticalChange(e.target.checked)} /> Critical hits</label><button onClick={props.onToggleSwap} title="Swap attacking and defending teams">⇄ {swapped ? "Team B attacks" : "Team A attacks"}</button></div></div>
    <div className="ko-legend"><span className="ko-1">1HKO</span><span className="ko-2">2HKO</span><span className="ko-3">3HKO</span><span className="ko-4">4HKO</span><span className="ko-5">4HKO+</span></div>
    <div className="matrix-scroll"><table className="matrix">
      <thead><tr><th className="corner" colSpan={2}>Attacker / move ↓</th>{right.map((poke, col) => <th key={`${poke.name}-${col}`} className={`defender-header ${poke.dead ? "fainted-cell" : ""} ${poke.teraType ? "tera-active" : ""}`}>
        <div className="defender-identity"><Sprite pokemon={poke} /><div><span className="matrix-pokemon-name">{col + 1}. {poke.name}{poke.dead ? " (Fainted)" : ""}{poke.teraType ? <span className="tera-marker"> TERA</span> : null}</span><span className="type-list">{displayTypes(poke).map(t => <span className={typeClass(t)} key={t}>{t}</span>)}</span><small className="matrix-item">{poke.item || "No item"}</small></div></div>
        <div className="matrix-pokemon-controls"><label>Tera <select aria-label={`${poke.name} Tera type`} value={poke.teraType || ""} disabled={!poke.importedTeraType} onChange={e => props.onColPokemonChange(col, { teraType: e.target.value })}><option value="">None</option>{poke.importedTeraType && <option value={poke.importedTeraType}>{poke.importedTeraType}</option>}</select></label><label className="matrix-dead-control"><input type="checkbox" checked={Boolean(poke.dead)} onChange={e => props.onColPokemonChange(col, { dead: e.target.checked })}/> Fainted</label></div>
        <span className="stage-control"><small>Def stage</small><select value={colStages[col]?.def ?? 0} onChange={e => props.onDefenseStageChange(col, Number(e.target.value))}>{stageOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></span>
      </th>)}</tr></thead>
      <tbody>{left.map((poke, row) => {
        const moves = [...poke.moves.filter(Boolean).slice(0, 4)];
        while (moves.length < 4) moves.push("");
        return moves.map((move, mi) => {
          const details = move ? getMoveDetails(move) : null;
          const showIdentity = mi === 0;
          return <tr key={`${poke.name}-${row}-${mi}`} className={`${mi === 0 ? "pokemon-block-start" : ""} ${poke.dead ? "fainted-row" : ""} ${poke.teraType ? "tera-attacker" : ""}`}>
            {mi === 0 && <th className={`attacker-info-cell ${poke.teraType ? "tera-attacker-info" : ""} ${poke.dead ? "fainted-cell" : ""}`} rowSpan={4} title={poke.species}>
              <Sprite pokemon={poke} />
              <span className="matrix-pokemon-name">{row + 1}. {poke.name}{poke.dead ? " (Fainted)" : ""}{poke.teraType ? <span className="tera-marker"> TERA</span> : null}</span>
              <span className="type-list">{displayTypes(poke).map(t => <span className={typeClass(t)} key={t}>{t}</span>)}</span>
              <small className="matrix-item">{poke.item || "No item"}</small>
              <div className="matrix-pokemon-controls"><label>Tera <select aria-label={`${poke.name} Tera type`} value={poke.teraType || ""} disabled={!poke.importedTeraType} onChange={e => props.onRowPokemonChange(row, { teraType: e.target.value })}><option value="">None</option>{poke.importedTeraType && <option value={poke.importedTeraType}>{poke.importedTeraType}</option>}</select></label><label className="matrix-dead-control"><input type="checkbox" checked={Boolean(poke.dead)} onChange={e => props.onRowPokemonChange(row, { dead: e.target.checked })}/> Fainted</label></div>
              <span className="stage-control"><small>Atk stage</small><select value={rowStages[row]?.atk ?? 0} onChange={e => props.onAttackStageChange(row, Number(e.target.value))}>{stageOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></span>
            </th>}
            <th className="attacker-move-cell"><div className="move-label" title={move ? formatMoveTooltip(move) : "No move assigned"}><strong>{mi + 1}. {move || "—"}</strong>{details && <span className="row-move-meta"><span className={typeClass(details.type)}>{details.type}</span><span>{details.category === "Physical" ? "PHY" : details.category === "Special" ? "SPL" : details.category}</span></span>}</div></th>
            {right.map((_, col) => {
              const item = matchups[row]?.[col];
              const result = item?.moves.find(m => m.move.toLowerCase() === move.toLowerCase());
              const active = selected?.row === row && selected?.col === col;
              const title = result ? `${formatMoveTooltip(move)}\n\nDamage range: ${result.min}–${result.max} HP (${result.minPct.toFixed(1)}–${result.maxPct.toFixed(1)}%)\nPossible damage rolls: ${(result.rolls || []).join(", ") || "not available for this move"}\n${result.ko}\n${result.description}` : move ? `${formatMoveTooltip(move)}\n\nNo direct damage result for this move.` : "No move assigned";
              return <td key={col} className={`${right[col]?.dead ? "fainted-cell" : ""} ${right[col]?.teraType ? "tera-defender-cell" : ""}`}><button title={title} disabled={!move} className={`matrix-cell compact-cell ${result ? koClass(result.ko) : "ko-none"} ${active ? "active" : ""} ${poke.dead || right[col]?.dead ? "fainted-cell" : ""} ${poke.teraType || right[col]?.teraType ? "tera-matchup-cell" : ""}`} onClick={() => props.onSelect(row, col)}>{result ? <span className="damage-inline"><strong>{result.minPct.toFixed(0)}–{result.maxPct.toFixed(0)}%</strong><em>{result.ko}</em></span> : <span>—</span>}</button></td>;
            })}
          </tr>;
        });
      })}</tbody>
    </table></div>
  </section>;
}
