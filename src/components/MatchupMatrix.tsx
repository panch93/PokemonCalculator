"use client";

import { useState } from "react";
import { getMoveDetails, getPokemonTypes } from "../lib/calc";
import { FieldState, Matchup, PokemonSet, StatStages } from "../lib/types";
import { formatAbilityTooltip, formatItemTooltip } from "../lib/item-ability-descriptions";
import { getEffectiveSpeed, getMovePriorityLabel, getMovePriorityNote } from "../lib/battle-order";

type Props = {
  left: PokemonSet[]; right: PokemonSet[]; matchups: (Matchup | null)[][]; fieldState: FieldState;
  selected: { row: number; col: number } | null; swapped: boolean;
  rowMoves: string[]; rowStages: StatStages[]; colStages: StatStages[];
  critical: boolean; onCriticalChange: (value: boolean) => void; onToggleSwap: () => void;
  onSelect: (row: number, col: number) => void; onMoveChange: (row: number, move: string) => void;
  onRowStageChange: (row: number, stat: keyof StatStages, value: number) => void; onColStageChange: (col: number, stat: keyof StatStages, value: number) => void; onResetStages: () => void; onResetRowStages: (row: number) => void; onResetColStages: (col: number) => void;
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
function formatMoveTooltip(name: string, pokemon?: PokemonSet, field?: FieldState) {
  const d = getMoveDetails(name);
  if (!d) return name;
  const priority = pokemon && field ? getMovePriorityNote(pokemon, name, field) : `Base priority: ${d.priority}`;
  return `${d.name}\n${d.type} · ${d.category}\n${d.power === null ? "Variable / no direct power" : `Base power: ${d.power}`}\n${d.accuracy === null ? "Accuracy: —" : `Accuracy: ${d.accuracy}%`} · ${d.pp === null ? "PP: —" : `PP: ${d.pp}`}\n${priority}\n\n${d.description}`;
}
function Sprite({ pokemon }: { pokemon: PokemonSet }) {
  return <img className="matrix-sprite" src={spriteUrl(pokemon)} alt={`${pokemon.species} sprite`} loading="lazy" onError={event => { event.currentTarget.style.visibility = "hidden"; }} />;
}

type SpeedEditor = { row: number; col: number };
const SPEED_ITEMS = ["Choice Scarf", "Iron Ball", "Macho Brace", "Power Anklet", "Power Band", "Power Belt", "Power Bracer", "Power Lens", "Power Weight"];
function natureSpeedEffect(nature: string) {
  if (["Jolly", "Timid", "Hasty", "Naive"].includes(nature)) return "boosted";
  if (["Brave", "Relaxed", "Quiet", "Sassy"].includes(nature)) return "hindered";
  return "unaffected";
}
function speedNatureFor(effect: string, current: string) {
  const boostsSpeed = ["Jolly", "Timid", "Hasty", "Naive"];
  const hindersSpeed = ["Brave", "Relaxed", "Quiet", "Sassy"];
  const neutralSpeed = ["Hardy", "Docile", "Serious", "Bashful", "Quirky"];
  if (effect === "boosted") return boostsSpeed.includes(current) ? current : "Jolly";
  if (effect === "hindered") return hindersSpeed.includes(current) ? current : "Brave";
  return neutralSpeed.includes(current) ? current : "Hardy";
}
function isSpeedItem(item: string) { return SPEED_ITEMS.some(name => name.toLowerCase() === item.trim().toLowerCase()); }

export default function MatchupMatrix(props: Props) {
  const { left, right, matchups, selected, swapped, rowStages, colStages, fieldState } = props;
  const [speedEditor, setSpeedEditor] = useState<SpeedEditor | null>(null);
  const [attackerEvs, setAttackerEvs] = useState(0);
  const [defenderEvs, setDefenderEvs] = useState(0);
  const [attackerNatureEffect, setAttackerNatureEffect] = useState("unaffected");
  const [defenderNatureEffect, setDefenderNatureEffect] = useState("unaffected");
  const [attackerItem, setAttackerItem] = useState("__keep__");
  const [defenderItem, setDefenderItem] = useState("__keep__");
  const openSpeedEditor = (row: number, col: number) => {
    const a = left[row], d = right[col];
    setAttackerEvs(a.evs?.spe ?? 0); setDefenderEvs(d.evs?.spe ?? 0);
    setAttackerNatureEffect(a.nature === "Jolly" || a.nature === "Timid" || a.nature === "Hasty" || a.nature === "Naive" ? "boosted" : ["Brave", "Relaxed", "Quiet", "Sassy"].includes(a.nature) ? "hindered" : "unaffected");
    setDefenderNatureEffect(d.nature === "Jolly" || d.nature === "Timid" || d.nature === "Hasty" || d.nature === "Naive" ? "boosted" : ["Brave", "Relaxed", "Quiet", "Sassy"].includes(d.nature) ? "hindered" : "unaffected");
    setAttackerItem(isSpeedItem(a.item) ? a.item : "__keep__"); setDefenderItem(isSpeedItem(d.item) ? d.item : "__keep__");
    setSpeedEditor({ row, col });
  };
  const saveSpeedEditor = () => {
    if (!speedEditor) return;
    const { row, col } = speedEditor; const a = left[row], d = right[col];
    const itemA = attackerItem === "__keep__" ? a.item : attackerItem;
    const itemD = defenderItem === "__keep__" ? d.item : defenderItem;
    props.onRowPokemonChange(row, { evs: { ...a.evs, spe: Math.max(0, Math.min(252, Math.round(Number(attackerEvs) || 0))) }, nature: attackerNatureEffect === natureSpeedEffect(a.nature) ? a.nature : speedNatureFor(attackerNatureEffect, a.nature), item: itemA });
    props.onColPokemonChange(col, { evs: { ...d.evs, spe: Math.max(0, Math.min(252, Math.round(Number(defenderEvs) || 0))) }, nature: defenderNatureEffect === natureSpeedEffect(d.nature) ? d.nature : speedNatureFor(defenderNatureEffect, d.nature), item: itemD });
    setSpeedEditor(null);
  };
  const anyScreenActive = fieldState.defenderReflect || fieldState.defenderLightScreen || fieldState.defenderAuroraVeil;
  return <section className="panel matrix-panel">
    <div className="panel-title-row"><div><h2>6 × 6 matchup matrix</h2></div><div className="button-row"><button className="reset-stages-button reset-all-stages-button" title="Reset all Pokémon stat stages to zero" aria-label="Reset all Pokémon stat stages to zero" onClick={props.onResetStages}><span aria-hidden="true">↺</span></button><label className={`crit-toggle ${props.critical ? "active" : ""}`}><input type="checkbox" checked={props.critical} onChange={e => props.onCriticalChange(e.target.checked)} /> Critical hits</label><button onClick={props.onToggleSwap} title="Swap attacking and defending teams">⇄ {swapped ? "Team B attacks" : "Team A attacks"}</button></div></div>
    <div className="ko-legend"><span className="ko-1">1HKO</span><span className="ko-2">2HKO</span><span className="ko-3">3HKO</span><span className="ko-4">4HKO</span><span className="ko-5">4HKO+</span><span className="turn-order attacker">←</span><small>attacker first</small><span className="turn-order defender">↑</span><small>defender first</small><span className="turn-order tie">↔</span><small>tie</small><small>* conditional priority (Gale Wings assumes full HP)</small></div>
    <div className="matrix-scroll"><table className="matrix">
      <thead><tr><th className="corner" colSpan={2}>Attacker / move ↓</th>{right.map((poke, col) => <th key={`${poke.name}-${col}`} className={`defender-header ${poke.dead ? "fainted-cell" : ""} ${poke.teraType ? "tera-active" : ""}`}>
        <div className="defender-identity"><Sprite pokemon={poke} /><div><button type="button" className="matrix-pokemon-name faint-toggle-name" title="Click to toggle fainted" onClick={() => props.onColPokemonChange(col, { dead: !poke.dead })}>{col + 1}. {poke.name}{poke.dead ? " ☠" : ""}{poke.teraType ? <span className="tera-marker"> TERA</span> : null}</button><span className="type-list">{displayTypes(poke).map(t => <span className={typeClass(t)} key={t}>{t}</span>)}</span><small className="matrix-item matrix-ability" title={formatAbilityTooltip(poke.ability)}>{poke.ability || "No ability"}{anyScreenActive && poke.ability.trim().toLowerCase() === "infiltrator" && <span className="screen-bypass-inline" title="Bypasses Reflect, Light Screen and Aurora Veil"> · screens bypassed</span>}</small><small className="matrix-item" title={formatItemTooltip(poke.item)}>{poke.item || "No item"}</small></div></div>
        <div className="matrix-pokemon-controls"><label>Tera <select aria-label={`${poke.name} Tera type`} value={poke.teraType || ""} disabled={!poke.importedTeraType} onChange={e => props.onColPokemonChange(col, { teraType: e.target.value })}><option value="">None</option>{poke.importedTeraType && <option value={poke.importedTeraType}>{poke.importedTeraType}</option>}</select></label><label>Status <select aria-label={`${poke.name} status`} value={poke.status || ""} onChange={e => props.onColPokemonChange(col, { status: e.target.value as PokemonSet["status"] })}><option value="">None</option><option value="brn">Burn</option><option value="par">Paralysis</option><option value="psn">Poison</option><option value="tox">Toxic</option><option value="slp">Sleep</option><option value="frz">Freeze</option></select></label></div>
        <div className="stat-stage-row">{([['Def','def'],['SpD','spd'],['Spe','spe']] as const).map(([label, stat]) => <label key={stat} title={`${label} stat stage`}>{label}<select aria-label={`${poke.name} ${label} stage`} value={colStages[col]?.[stat] ?? 0} onChange={e => props.onColStageChange(col, stat, Number(e.target.value))}>{stageOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>)}<button type="button" className="reset-one-stage-button" title={`Reset ${poke.name}'s stages`} aria-label={`Reset ${poke.name}'s stages`} onClick={() => props.onResetColStages(col)}>↺</button></div>
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
              <button type="button" className="matrix-pokemon-name faint-toggle-name" title="Click to toggle fainted" onClick={() => props.onRowPokemonChange(row, { dead: !poke.dead })}>{row + 1}. {poke.name}{poke.dead ? " ☠" : ""}{poke.teraType ? <span className="tera-marker"> TERA</span> : null}</button>
              
              <span className="type-list">{displayTypes(poke).map(t => <span className={typeClass(t)} key={t}>{t}</span>)}</span>
              <small className="matrix-item matrix-ability" title={formatAbilityTooltip(poke.ability)}>{poke.ability || "No ability"}{anyScreenActive && poke.ability.trim().toLowerCase() === "infiltrator" && <span className="screen-bypass-inline" title="Bypasses Reflect, Light Screen and Aurora Veil"> · screens bypassed</span>}</small>
              <small className="matrix-item" title={formatItemTooltip(poke.item)}>{poke.item || "No item"}</small>
              <div className="matrix-pokemon-controls"><label>Tera <select aria-label={`${poke.name} Tera type`} value={poke.teraType || ""} disabled={!poke.importedTeraType} onChange={e => props.onRowPokemonChange(row, { teraType: e.target.value })}><option value="">None</option>{poke.importedTeraType && <option value={poke.importedTeraType}>{poke.importedTeraType}</option>}</select></label><label>Status <select aria-label={`${poke.name} status`} value={poke.status || ""} onChange={e => props.onRowPokemonChange(row, { status: e.target.value as PokemonSet["status"] })}><option value="">None</option><option value="brn">Burn</option><option value="par">Paralysis</option><option value="psn">Poison</option><option value="tox">Toxic</option><option value="slp">Sleep</option><option value="frz">Freeze</option></select></label></div>
              <div className="stat-stage-row">{([['Atk','atk'],['SpA','spa'],['Spe','spe']] as const).map(([label, stat]) => <label key={stat} title={`${label} stat stage`}>{label}<select aria-label={`${poke.name} ${label} stage`} value={rowStages[row]?.[stat] ?? 0} onChange={e => props.onRowStageChange(row, stat, Number(e.target.value))}>{stageOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>)}<button type="button" className="reset-one-stage-button" title={`Reset ${poke.name}'s stages`} aria-label={`Reset ${poke.name}'s stages`} onClick={() => props.onResetRowStages(row)}>↺</button></div>
            </th>}
            <th className="attacker-move-cell"><div className="move-label" title={move ? formatMoveTooltip(move, poke, fieldState) : "No move assigned"}><strong>{mi + 1}. {move || "—"} {move ? getMovePriorityLabel(poke, move, fieldState) : ""}</strong>{details && <span className="row-move-meta"><span className={typeClass(details.type)}>{details.type}</span><span>{details.category === "Physical" ? "PHY" : details.category === "Special" ? "SPL" : details.category}</span></span>}</div></th>
            {right.map((_, col) => {
              const item = matchups[row]?.[col];
              const result = item?.moves.find(m => m.move.toLowerCase() === move.toLowerCase());
              const active = selected?.row === row && selected?.col === col;
              const attackerSpeed = getEffectiveSpeed(poke, fieldState, "attacker", rowStages[row]?.spe ?? 0);
              const defenderSpeed = getEffectiveSpeed(right[col], fieldState, "defender", colStages[col]?.spe ?? 0);
              const order = attackerSpeed === defenderSpeed ? "tie"
                : (attackerSpeed > defenderSpeed) !== fieldState.trickRoom ? "attacker" : "defender";
              const orderLabel = order === "attacker" ? `${poke.name} moves first by Speed` : order === "defender" ? `${right[col].name} moves first by Speed` : "Equal Speed";
              const title = result ? `${formatMoveTooltip(move, poke, fieldState)}\n${getMovePriorityNote(poke, move, fieldState)}\n\nDamage range: ${result.min}–${result.max} HP (${result.minPct.toFixed(1)}–${result.maxPct.toFixed(1)}%)\nPossible damage rolls: ${(result.rolls || []).join(", ") || "not available for this move"}\n${result.ko}\n${result.description}` : move ? `${formatMoveTooltip(move, poke, fieldState)}\n\nNo direct damage result for this move.` : "No move assigned";
              return <td key={col} className={`${right[col]?.dead ? "fainted-cell" : ""} ${right[col]?.teraType ? "tera-defender-cell" : ""}`}><div className="matchup-cell-layout"><button title={title} disabled={!move} className={`matrix-cell compact-cell ${result ? koClass(result.ko) : "ko-none"} ${active ? "active" : ""} ${poke.dead || right[col]?.dead ? "fainted-cell" : ""}`} onClick={() => props.onSelect(row, col)}>{result ? <span className="damage-inline"><strong>{result.minPct.toFixed(0)}–{result.maxPct.toFixed(0)}%</strong><em>{result.ko}</em></span> : <span>—</span>}</button>{move && <button type="button" className={`turn-order speed-arrow ${order}`} title={`Edit matchup Speed. ${orderLabel}. Effective Speed: ${attackerSpeed} vs ${defenderSpeed}.`} aria-label={`Edit Speed matchup: ${poke.name} versus ${right[col].name}`} onClick={() => openSpeedEditor(row, col)}>{order === "attacker" ? "←" : order === "defender" ? "↑" : "↔"}</button>}</div></td>;
            })}
          </tr>;
        });
      })}</tbody>
    </table></div>
    {speedEditor && (() => {
      const a = left[speedEditor.row], d = right[speedEditor.col];
      const editedA = { ...a, evs: { ...a.evs, spe: Math.max(0, Math.min(252, Number(attackerEvs) || 0)) }, nature: speedNatureFor(attackerNatureEffect, a.nature), item: attackerItem === "__keep__" ? a.item : attackerItem };
      const editedD = { ...d, evs: { ...d.evs, spe: Math.max(0, Math.min(252, Number(defenderEvs) || 0)) }, nature: speedNatureFor(defenderNatureEffect, d.nature), item: defenderItem === "__keep__" ? d.item : defenderItem };
      const itemOptions = (value: string) => <><option value="__keep__">Keep current item{value && !isSpeedItem(value) ? ` (${value})` : ""}</option><option value="">No item</option>{SPEED_ITEMS.map(item => <option key={item} value={item}>{item}</option>)}</>;
      return <div className="speed-editor-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSpeedEditor(null); }}><section className="speed-editor panel" role="dialog" aria-modal="true" aria-labelledby="speed-editor-title"><div className="panel-title-row"><div><h3 id="speed-editor-title">Matchup Speed</h3><p>{a.name} vs {d.name}</p></div><button type="button" onClick={() => setSpeedEditor(null)}>Close ×</button></div><div className="speed-editor-grid">{([{key:"attacker",pokemon:a,evs:attackerEvs,setEvs:setAttackerEvs,nature:attackerNatureEffect,setNature:setAttackerNatureEffect,item:attackerItem,setItem:setAttackerItem,edited:editedA},{key:"defender",pokemon:d,evs:defenderEvs,setEvs:setDefenderEvs,nature:defenderNatureEffect,setNature:setDefenderNatureEffect,item:defenderItem,setItem:setDefenderItem,edited:editedD}] as const).map(side => <div className="speed-editor-side" key={side.key}><h4>{side.key === "attacker" ? "Attacking Pokémon" : "Defending Pokémon"}: {side.pokemon.name}</h4><label>Speed EVs<input type="number" min="0" max="252" step="4" value={side.evs} onChange={event => side.setEvs(Math.max(0, Math.min(252, Number(event.target.value) || 0)))} /></label><label>Speed nature effect<select value={side.nature} onChange={event => side.setNature(event.target.value)}><option value="hindered">Hindered (−Spe)</option><option value="unaffected">Unaffected</option><option value="boosted">Boosted (+Spe)</option></select></label><label>Item<select value={side.item} onChange={event => side.setItem(event.target.value)}>{itemOptions(side.pokemon.item)}</select></label><p className="speed-editor-result">Final Speed: <strong>{getEffectiveSpeed(side.edited, fieldState, side.key === "attacker" ? "attacker" : "defender", side.key === "attacker" ? rowStages[speedEditor.row]?.spe ?? 0 : colStages[speedEditor.col]?.spe ?? 0)}</strong></p></div>)}</div><div className="button-row speed-editor-actions"><button type="button" onClick={() => setSpeedEditor(null)}>Cancel</button><button type="button" className="primary" onClick={saveSpeedEditor}>OK · Update Teambuilder</button></div></section></div>;
    })()}
  </section>;
}
