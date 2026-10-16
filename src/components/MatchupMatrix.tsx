"use client";

import { useMemo, useState } from "react";
import { Dex } from "@pkmn/dex";
import { calculateMove, getMoveDetails, getPokemonTypes } from "../lib/calc";
import { FieldState, Matchup, PokemonSet, StatStages } from "../lib/types";
import { formatAbilityTooltip, formatItemTooltip } from "../lib/item-ability-descriptions";
import { getEffectiveSpeed, getMovePriorityLabel, getMovePriorityNote } from "../lib/battle-order";
import AutocompleteInput from "./AutocompleteInput";

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
type MoveEditor = { row: number; col: number; move: string };
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

const clampEV = (value: number) => Math.max(0, Math.min(252, Math.round(Number(value) || 0)));
function statNatureEffect(nature: string, stat: string) {
  const natures: Record<string, [string, string]> = { Adamant:["atk","spa"], Brave:["atk","spe"], Lonely:["atk","def"], Naughty:["atk","spd"], Modest:["spa","atk"], Quiet:["spa","spe"], Mild:["spa","def"], Rash:["spa","spd"], Bold:["def","atk"], Relaxed:["def","spe"], Impish:["def","spa"], Lax:["def","spd"], Calm:["spd","atk"], Sassy:["spd","spe"], Careful:["spd","spa"], Gentle:["spd","def"], Timid:["spe","atk"], Hasty:["spe","def"], Jolly:["spe","spa"], Naive:["spe","spd"] };
  const effect = natures[nature]; return effect?.[0] === stat ? "boosted" : effect?.[1] === stat ? "hindered" : "unaffected";
}
function natureForStat(effect: string, stat: string, current: string) {
  const list: Record<string, {boosted:string; hindered:string; neutral:string}> = {
    atk:{boosted:"Adamant",hindered:"Modest",neutral:"Hardy"}, spa:{boosted:"Modest",hindered:"Adamant",neutral:"Hardy"},
    def:{boosted:"Bold",hindered:"Lonely",neutral:"Hardy"}, spd:{boosted:"Calm",hindered:"Naughty",neutral:"Hardy"}, spe:{boosted:"Timid",hindered:"Brave",neutral:"Hardy"}
  };
  if (statNatureEffect(current, stat) === effect) return current;
  return list[stat]?.[effect as "boosted" | "hindered" | "neutral"] || "Hardy";
}
const TYPE_ITEMS: Record<string, string[]> = {
  Normal: ["Silk Scarf", "Normal Gem"], Fighting: ["Black Belt", "Fighting Gem"], Flying: ["Sharp Beak", "Flying Gem"], Poison: ["Poison Barb", "Poison Gem"],
  Ground: ["Soft Sand", "Ground Gem"], Rock: ["Hard Stone", "Rock Gem"], Bug: ["Silver Powder", "Bug Gem"], Ghost: ["Spell Tag", "Ghost Gem"],
  Steel: ["Metal Coat", "Steel Gem"], Fire: ["Charcoal", "Fire Gem"], Water: ["Mystic Water", "Water Gem"], Grass: ["Miracle Seed", "Grass Gem"],
  Electric: ["Magnet", "Electric Gem"], Psychic: ["Twisted Spoon", "Psychic Gem"], Ice: ["Never-Melt Ice", "Ice Gem"], Dragon: ["Dragon Fang", "Dragon Gem"],
  Dark: ["Black Glasses", "Dark Gem"], Fairy: ["Pixie Plate", "Fairy Gem"],
};
const RESIST_BERRIES: Record<string, string> = { Normal: "Chilan Berry", Fire: "Occa Berry", Water: "Passho Berry", Electric: "Wacan Berry", Grass: "Rindo Berry", Ice: "Yache Berry", Fighting: "Chople Berry", Poison: "Kebia Berry", Ground: "Shuca Berry", Flying: "Coba Berry", Psychic: "Payapa Berry", Bug: "Tanga Berry", Rock: "Charti Berry", Ghost: "Kasib Berry", Dragon: "Haban Berry", Dark: "Colbur Berry", Steel: "Babiri Berry", Fairy: "Roseli Berry" };
const PHYSICAL_ATTACK_ITEMS = ["Choice Band", "Life Orb", "Muscle Band", "Expert Belt"];
const SPECIAL_ATTACK_ITEMS = ["Choice Specs", "Life Orb", "Wise Glasses", "Expert Belt", "Throat Spray"];
const PHYSICAL_DEFENSE_ITEMS = ["Eviolite", "Assault Vest"];
const SPECIAL_DEFENSE_ITEMS = ["Eviolite", "Assault Vest"];
function allItemNames() {
  try { return (Dex.items as unknown as { all: () => Array<{ name: string; exists?: boolean }> }).all().filter(item => item.exists !== false).map(item => item.name).sort((a, b) => a.localeCompare(b)); }
  catch { return []; }
}

export default function MatchupMatrix(props: Props) {
  const { left, right, matchups, selected, swapped, rowStages, colStages, fieldState } = props;
  const [speedEditor, setSpeedEditor] = useState<SpeedEditor | null>(null);
  const [moveEditor, setMoveEditor] = useState<MoveEditor | null>(null);
  const allItems = useMemo(() => allItemNames(), []);
  const [quickEditor, setQuickEditor] = useState<{ side: "left" | "right"; index: number } | null>(null);
  const [quickItem, setQuickItem] = useState("");
  const [quickAbility, setQuickAbility] = useState("");
  const [quickMoves, setQuickMoves] = useState<string[]>(["", "", "", ""]);
  const allAbilities = useMemo(() => { try { return (Dex.abilities as unknown as { all: () => Array<{name:string; exists?:boolean}> }).all().filter(x => x.exists !== false).map(x => x.name).sort((a,b)=>a.localeCompare(b)); } catch { return []; } }, []);
  const allMoves = useMemo(() => { try { return (Dex.moves as unknown as { all: () => Array<{name:string; exists?:boolean}> }).all().filter(x => x.exists !== false).map(x => x.name).sort((a,b)=>a.localeCompare(b)); } catch { return []; } }, []);
  const openQuickEditor = (side: "left" | "right", index: number) => { const p = (side === "left" ? left : right)[index]; setQuickItem(p.item || ""); setQuickAbility(p.ability || ""); setQuickMoves([...p.moves, "", "", "", ""].slice(0,4)); setQuickEditor({ side, index }); };
  const saveQuickEditor = () => { if (!quickEditor) return; const change = quickEditor.side === "left" ? props.onRowPokemonChange : props.onColPokemonChange; change(quickEditor.index, { item: quickItem, ability: quickAbility, moves: quickMoves }); setQuickEditor(null); };
  const [moveAtkEvs, setMoveAtkEvs] = useState(0);
  const [moveDefEvs, setMoveDefEvs] = useState(0);
  const [moveHpEvs, setMoveHpEvs] = useState(0);
  const [moveAtkNature, setMoveAtkNature] = useState("unaffected");
  const [moveDefNature, setMoveDefNature] = useState("unaffected");
  const [moveAtkItem, setMoveAtkItem] = useState("__keep__");
  const [moveDefItem, setMoveDefItem] = useState("__keep__");
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
  const openMoveEditor = (row: number, col: number, move: string) => {
    const a = left[row], d = right[col], details = getMoveDetails(move);
    const atkStat = details?.category === "Special" ? "spa" : "atk";
    const defStat = details?.category === "Special" ? "spd" : "def";
    setMoveAtkEvs(a.evs?.[atkStat] ?? 0); setMoveDefEvs(d.evs?.[defStat] ?? 0); setMoveHpEvs(d.evs?.hp ?? 0);
    setMoveAtkNature(statNatureEffect(a.nature, atkStat)); setMoveDefNature(statNatureEffect(d.nature, defStat));
    setMoveAtkItem("__keep__"); setMoveDefItem("__keep__"); setMoveEditor({ row, col, move });
  };
  const saveMoveEditor = () => {
    if (!moveEditor) return;
    const { row, col, move } = moveEditor, a = left[row], d = right[col], details = getMoveDetails(move);
    const atkStat = details?.category === "Special" ? "spa" : "atk";
    const defStat = details?.category === "Special" ? "spd" : "def";
    props.onRowPokemonChange(row, { evs: { ...a.evs, [atkStat]: clampEV(moveAtkEvs) }, nature: natureForStat(moveAtkNature, atkStat, a.nature), item: moveAtkItem === "__keep__" ? a.item : moveAtkItem });
    props.onColPokemonChange(col, { evs: { ...d.evs, [defStat]: clampEV(moveDefEvs), hp: clampEV(moveHpEvs) }, nature: natureForStat(moveDefNature, defStat, d.nature), item: moveDefItem === "__keep__" ? d.item : moveDefItem });
    setMoveEditor(null);
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
  const speedSorted = (team: PokemonSet[], side: "attacker" | "defender", stages: StatStages[]) => team.map((pokemon, index) => ({ pokemon, index, speed: getEffectiveSpeed(pokemon, fieldState, side, stages[index]?.spe ?? 0) })).sort((a, b) => Number(Boolean(a.pokemon.dead)) - Number(Boolean(b.pokemon.dead)) || b.speed - a.speed || a.index - b.index);
  const rowEntries = speedSorted(left, "attacker", rowStages);
  const colEntries = speedSorted(right, "defender", colStages);
  return <section className="panel matrix-panel">
    <div className="panel-title-row"><div><h2>6 × 6 matchup matrix</h2></div><div className="button-row"><button className="reset-stages-button reset-all-stages-button" title="Reset all Pokémon stat stages to zero" aria-label="Reset all Pokémon stat stages to zero" onClick={props.onResetStages}><span aria-hidden="true">↺</span></button><label className={`crit-toggle ${props.critical ? "active" : ""}`}><input type="checkbox" checked={props.critical} onChange={e => props.onCriticalChange(e.target.checked)} /> Critical hits</label><button onClick={props.onToggleSwap} title="Swap attacking and defending teams">⇄ {swapped ? "Team B attacks" : "Team A attacks"}</button></div></div>
    <div className="ko-legend"><span className="ko-1">1HKO</span><span className="ko-2">2HKO</span><span className="ko-3">3HKO</span><span className="ko-4">4HKO</span><span className="ko-5">4HKO+</span><span className="turn-order attacker">←</span><small>attacker first</small><span className="turn-order defender">↑</span><small>defender first</small><span className="turn-order tie">↔</span><small>tie</small><small>* conditional priority (Gale Wings assumes full HP)</small></div>
    <div className="matrix-scroll"><table className="matrix">
      <thead><tr><th className="corner" colSpan={2}>Attacker / move ↓</th>{colEntries.map(({ pokemon: poke, index: col }) => <th key={`${poke.name}-${col}`} className={`defender-header ${poke.dead ? "fainted-cell" : ""} ${poke.teraType ? "tera-active" : ""}`}>
        <div className="defender-identity"><Sprite pokemon={poke} /><div><button type="button" className="matrix-pokemon-name faint-toggle-name" title="Click to toggle fainted" onClick={() => props.onColPokemonChange(col, { dead: !poke.dead })}>{col + 1}. {poke.name}{poke.dead ? " ☠" : ""}{poke.teraType ? <span className="tera-marker"> TERA</span> : null}</button><span className="type-list">{displayTypes(poke).map(t => <span className={typeClass(t)} key={t}>{t}</span>)}</span><small role="button" tabIndex={0} className="matrix-item matrix-ability clickable-matrix-set" title="Click to edit item and ability" onClick={() => openQuickEditor("right", col)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") openQuickEditor("right", col); }}>{poke.ability || "No ability"}{anyScreenActive && poke.ability.trim().toLowerCase() === "infiltrator" && <span className="screen-bypass-inline" title="Bypasses Reflect, Light Screen and Aurora Veil"> · screens bypassed</span>}</small><small role="button" tabIndex={0} className="matrix-item clickable-matrix-set" title="Click to edit item and ability" onClick={() => openQuickEditor("right", col)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") openQuickEditor("right", col); }}>{poke.item || "No item"}</small></div></div>
        <div className="matrix-pokemon-controls"><label>Tera <select aria-label={`${poke.name} Tera type`} value={poke.teraType || ""} disabled={!poke.importedTeraType} onChange={e => props.onColPokemonChange(col, { teraType: e.target.value })}><option value="">None</option>{poke.importedTeraType && <option value={poke.importedTeraType}>{poke.importedTeraType}</option>}</select></label><label>Status <select aria-label={`${poke.name} status`} value={poke.status || ""} onChange={e => props.onColPokemonChange(col, { status: e.target.value as PokemonSet["status"] })}><option value="">None</option><option value="brn">Burn</option><option value="par">Paralysis</option><option value="psn">Poison</option><option value="tox">Toxic</option><option value="slp">Sleep</option><option value="frz">Freeze</option></select></label></div>
        <div className="stat-stage-row">{([['Def','def'],['SpD','spd'],['Spe','spe']] as const).map(([label, stat]) => <label key={stat} title={`${label} stat stage`}>{label}<select aria-label={`${poke.name} ${label} stage`} value={colStages[col]?.[stat] ?? 0} onChange={e => props.onColStageChange(col, stat, Number(e.target.value))}>{stageOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>)}<button type="button" className="reset-one-stage-button" title={`Reset ${poke.name}'s stages`} aria-label={`Reset ${poke.name}'s stages`} onClick={() => props.onResetColStages(col)}>↺</button></div>
      </th>)}</tr></thead>
      <tbody>{rowEntries.map(({ pokemon: poke, index: row }) => {
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
              <small role="button" tabIndex={0} className="matrix-item matrix-ability clickable-matrix-set" title="Click to edit item and ability" onClick={() => openQuickEditor("left", row)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") openQuickEditor("left", row); }}>{poke.ability || "No ability"}{anyScreenActive && poke.ability.trim().toLowerCase() === "infiltrator" && <span className="screen-bypass-inline" title="Bypasses Reflect, Light Screen and Aurora Veil"> · screens bypassed</span>}</small>
              <small role="button" tabIndex={0} className="matrix-item clickable-matrix-set" title="Click to edit item and ability" onClick={() => openQuickEditor("left", row)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") openQuickEditor("left", row); }}>{poke.item || "No item"}</small>
              <div className="matrix-pokemon-controls"><label>Tera <select aria-label={`${poke.name} Tera type`} value={poke.teraType || ""} disabled={!poke.importedTeraType} onChange={e => props.onRowPokemonChange(row, { teraType: e.target.value })}><option value="">None</option>{poke.importedTeraType && <option value={poke.importedTeraType}>{poke.importedTeraType}</option>}</select></label><label>Status <select aria-label={`${poke.name} status`} value={poke.status || ""} onChange={e => props.onRowPokemonChange(row, { status: e.target.value as PokemonSet["status"] })}><option value="">None</option><option value="brn">Burn</option><option value="par">Paralysis</option><option value="psn">Poison</option><option value="tox">Toxic</option><option value="slp">Sleep</option><option value="frz">Freeze</option></select></label></div>
              <div className="stat-stage-row">{([['Atk','atk'],['SpA','spa'],['Spe','spe']] as const).map(([label, stat]) => <label key={stat} title={`${label} stat stage`}>{label}<select aria-label={`${poke.name} ${label} stage`} value={rowStages[row]?.[stat] ?? 0} onChange={e => props.onRowStageChange(row, stat, Number(e.target.value))}>{stageOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>)}<button type="button" className="reset-one-stage-button" title={`Reset ${poke.name}'s stages`} aria-label={`Reset ${poke.name}'s stages`} onClick={() => props.onResetRowStages(row)}>↺</button></div>
            </th>}
            <th className="attacker-move-cell"><div className="move-label clickable-matrix-move" role="button" tabIndex={0} title={move ? "Click to edit all four moves" : "Click to edit all four moves"} onClick={() => openQuickEditor("left", row)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") openQuickEditor("left", row); }}><strong>{mi + 1}. {move || "—"} {move ? getMovePriorityLabel(poke, move, fieldState) : ""}</strong>{details && <span className="row-move-meta"><span className={typeClass(details.type)}>{details.type}</span><span>{details.category === "Physical" ? "PHY" : details.category === "Special" ? "SPL" : details.category}</span></span>}</div></th>
            {colEntries.map(({ index: col }) => {
              const item = matchups[row]?.[col];
              const result = item?.moves.find(m => m.move.toLowerCase() === move.toLowerCase());
              const active = selected?.row === row && selected?.col === col;
              const attackerSpeed = getEffectiveSpeed(poke, fieldState, "attacker", rowStages[row]?.spe ?? 0);
              const defenderSpeed = getEffectiveSpeed(right[col], fieldState, "defender", colStages[col]?.spe ?? 0);
              const order = attackerSpeed === defenderSpeed ? "tie"
                : (attackerSpeed > defenderSpeed) !== fieldState.trickRoom ? "attacker" : "defender";
              const orderLabel = order === "attacker" ? `${poke.name} moves first by Speed` : order === "defender" ? `${right[col].name} moves first by Speed` : "Equal Speed";
              const title = result ? `${formatMoveTooltip(move, poke, fieldState)}\n${getMovePriorityNote(poke, move, fieldState)}\n\nDamage range: ${result.min}–${result.max} HP (${result.minPct.toFixed(1)}–${result.maxPct.toFixed(1)}%)\nPossible damage rolls: ${(result.rolls || []).join(", ") || "not available for this move"}\n${result.ko}\n${result.description}` : move ? `${formatMoveTooltip(move, poke, fieldState)}\n\nNo direct damage result for this move.` : "No move assigned";
              return <td key={col} className={`${right[col]?.dead ? "fainted-cell" : ""} ${right[col]?.teraType ? "tera-defender-cell" : ""}`}><div className="matchup-cell-layout"><button title={title} disabled={!move} className={`matrix-cell compact-cell ${result ? koClass(result.ko) : "ko-none"} ${active ? "active" : ""} ${poke.dead || right[col]?.dead ? "fainted-cell" : ""}`} onClick={() => { props.onSelect(row, col); if (move && details && ["Physical", "Special"].includes(details.category)) openMoveEditor(row, col, move); }}>{result ? <span className="damage-inline"><strong>{result.minPct.toFixed(0)}–{result.maxPct.toFixed(0)}%</strong><em>{result.ko}</em></span> : <span>—</span>}</button>{move && <button type="button" className={`turn-order speed-arrow ${order}`} title={`Edit matchup Speed. ${orderLabel}. Effective Speed: ${attackerSpeed} vs ${defenderSpeed}.`} aria-label={`Edit Speed matchup: ${poke.name} versus ${right[col].name}`} onClick={() => openSpeedEditor(row, col)}>{order === "attacker" ? "←" : order === "defender" ? "↑" : "↔"}</button>}</div></td>;
            })}
          </tr>;
        });
      })}</tbody>
    </table></div>
    {moveEditor && (() => {
      const a = left[moveEditor.row], d = right[moveEditor.col], details = getMoveDetails(moveEditor.move);
      if (!details || !["Physical", "Special"].includes(details.category)) return null;
      const atkStat = details.category === "Special" ? "spa" : "atk", defStat = details.category === "Special" ? "spd" : "def";
      const editedA: PokemonSet = { ...a, evs: { ...a.evs, [atkStat]: clampEV(moveAtkEvs) }, nature: natureForStat(moveAtkNature, atkStat, a.nature), item: moveAtkItem === "__keep__" ? a.item : moveAtkItem };
      const editedD: PokemonSet = { ...d, evs: { ...d.evs, [defStat]: clampEV(moveDefEvs), hp: clampEV(moveHpEvs) }, nature: natureForStat(moveDefNature, defStat, d.nature), item: moveDefItem === "__keep__" ? d.item : moveDefItem };
      const damage = calculateMove(editedA, editedD, moveEditor.move, fieldState, rowStages[moveEditor.row], colStages[moveEditor.col], props.critical);
      const typeItems = TYPE_ITEMS[details.type] || [];
      const attackerItems = [...new Set([...(details.category === "Special" ? SPECIAL_ATTACK_ITEMS : PHYSICAL_ATTACK_ITEMS), ...typeItems, ...allItems.filter(item => /Gem$/.test(item) && item.startsWith(details.type))])];
      const defenderCoreItems = details.category === "Special" ? SPECIAL_DEFENSE_ITEMS : PHYSICAL_DEFENSE_ITEMS;
      const berry = RESIST_BERRIES[details.type];
      const baseline = calculateMove({ ...editedA, item: moveAtkItem === "__keep__" ? a.item : moveAtkItem }, { ...editedD, item: "" }, moveEditor.move, fieldState, rowStages[moveEditor.row], colStages[moveEditor.col], props.critical);
      const berryResult = berry ? calculateMove({ ...editedA, item: moveAtkItem === "__keep__" ? a.item : moveAtkItem }, { ...editedD, item: berry }, moveEditor.move, fieldState, rowStages[moveEditor.row], colStages[moveEditor.col], props.critical) : null;
      const usefulBerry = !!(berryResult && baseline && (berryResult.min !== baseline.min || berryResult.max !== baseline.max));
      const defenderItems = [...new Set([...defenderCoreItems, ...(usefulBerry && berry ? [berry] : [])])];
      const attackItemOptions = [...new Set(["__keep__", "", ...attackerItems])];
      const defenseItemOptions = [...new Set(["__keep__", "", ...defenderItems])];
      return <div className="speed-editor-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setMoveEditor(null); }}><section className="speed-editor panel" role="dialog" aria-modal="true" aria-labelledby="move-editor-title"><div className="panel-title-row"><div><h3 id="move-editor-title">Move Damage Editor</h3><p>{a.name} → {d.name} · {moveEditor.move} ({details.category})</p></div><button type="button" onClick={() => setMoveEditor(null)}>Close ×</button></div><div className="speed-editor-grid"><div className="speed-editor-side"><h4>Attacker: {a.name}</h4><label>{details.category === "Special" ? "SpA EVs" : "Atk EVs"}<input type="number" min="0" max="252" step="4" value={moveAtkEvs} onChange={e => setMoveAtkEvs(clampEV(Number(e.target.value)))} /></label><label>{details.category === "Special" ? "SpA nature effect" : "Atk nature effect"}<select value={moveAtkNature} onChange={e => setMoveAtkNature(e.target.value)}><option value="hindered">Hindered (−{details.category === "Special" ? "SpA" : "Atk"})</option><option value="unaffected">Unaffected</option><option value="boosted">Boosted (+{details.category === "Special" ? "SpA" : "Atk"})</option></select></label><label>Attacking item<AutocompleteInput ariaLabel="attacking item" value={moveAtkItem === "__keep__" ? `Keep current item (${a.item || "none"})` : moveAtkItem} options={[`Keep current item (${a.item || "none"})`, "No item", ...attackerItems]} onChange={value => setMoveAtkItem(value.startsWith("Keep current item") ? "__keep__" : value === "No item" ? "" : value)} /></label></div><div className="speed-editor-side"><h4>Defender: {d.name}</h4><label>HP EVs<input type="number" min="0" max="252" step="4" value={moveHpEvs} onChange={e => setMoveHpEvs(clampEV(Number(e.target.value)))} /></label><label>{details.category === "Special" ? "SpD EVs" : "Def EVs"}<input type="number" min="0" max="252" step="4" value={moveDefEvs} onChange={e => setMoveDefEvs(clampEV(Number(e.target.value)))} /></label><label>{details.category === "Special" ? "SpD nature effect" : "Def nature effect"}<select value={moveDefNature} onChange={e => setMoveDefNature(e.target.value)}><option value="hindered">Hindered (−{details.category === "Special" ? "SpD" : "Def"})</option><option value="unaffected">Unaffected</option><option value="boosted">Boosted (+{details.category === "Special" ? "SpD" : "Def"})</option></select></label><label>Defensive item<AutocompleteInput ariaLabel="defensive item" value={moveDefItem === "__keep__" ? `Keep current item (${d.item || "none"})` : moveDefItem} options={[`Keep current item (${d.item || "none"})`, "No item", ...defenderItems]} onChange={value => setMoveDefItem(value.startsWith("Keep current item") ? "__keep__" : value === "No item" ? "" : value)} /></label></div></div><div className="move-damage-preview"><strong>Current battlefield damage range</strong><p>{damage ? `${damage.min}–${damage.max} HP (${damage.minPct.toFixed(1)}–${damage.maxPct.toFixed(1)}%)` : "Damage range unavailable for this move."}</p><small>Includes current weather, terrain, screens, Tera state, abilities, stat stages, critical-hit setting, and other calculator-supported field effects.</small></div><div className="button-row speed-editor-actions"><button type="button" onClick={() => setMoveEditor(null)}>Cancel</button><button type="button" className="primary" onClick={saveMoveEditor}>OK · Update Teambuilder</button></div></section></div>;
    })()}
    {quickEditor && (() => { const p = (quickEditor.side === "left" ? left : right)[quickEditor.index]; return <div className="speed-editor-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setQuickEditor(null); }}><section className="speed-editor panel" role="dialog" aria-modal="true" aria-labelledby="quick-pokemon-editor-title"><div className="panel-title-row"><div><h3 id="quick-pokemon-editor-title">Edit Pokémon</h3><p>{p.name} · {quickEditor.side === "left" ? "Team A" : "Team B"}</p></div><button type="button" onClick={() => setQuickEditor(null)}>Close ×</button></div><div className="speed-editor-grid"><div className="speed-editor-side"><h4>Item and ability</h4><label>Item<AutocompleteInput ariaLabel={`${p.name} item`} value={quickItem} options={allItems} onChange={setQuickItem} /></label><label>Ability<AutocompleteInput ariaLabel={`${p.name} ability`} value={quickAbility} options={allAbilities} onChange={setQuickAbility} /></label></div><div className="speed-editor-side"><h4>Moves</h4>{[0,1,2,3].map(i => <label key={i}>Move {i + 1}<AutocompleteInput ariaLabel={`${p.name} move ${i+1}`} value={quickMoves[i] || ""} options={allMoves} onChange={value => setQuickMoves(old => old.map((m,j) => j === i ? value : m))} /></label>)}</div></div><div className="button-row speed-editor-actions"><button type="button" onClick={() => setQuickEditor(null)}>Cancel</button><button type="button" className="primary" onClick={saveQuickEditor}>OK · Update Pokémon</button></div></section></div>; })()}
    {speedEditor && (() => {
      const a = left[speedEditor.row], d = right[speedEditor.col];
      const editedA = { ...a, evs: { ...a.evs, spe: Math.max(0, Math.min(252, Number(attackerEvs) || 0)) }, nature: speedNatureFor(attackerNatureEffect, a.nature), item: attackerItem === "__keep__" ? a.item : attackerItem };
      const editedD = { ...d, evs: { ...d.evs, spe: Math.max(0, Math.min(252, Number(defenderEvs) || 0)) }, nature: speedNatureFor(defenderNatureEffect, d.nature), item: defenderItem === "__keep__" ? d.item : defenderItem };
      const itemOptions = (value: string) => <><option value="__keep__">Keep current item{value && !isSpeedItem(value) ? ` (${value})` : ""}</option><option value="">No item</option>{SPEED_ITEMS.map(item => <option key={item} value={item}>{item}</option>)}</>;
      return <div className="speed-editor-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSpeedEditor(null); }}><section className="speed-editor panel" role="dialog" aria-modal="true" aria-labelledby="speed-editor-title"><div className="panel-title-row"><div><h3 id="speed-editor-title">Matchup Speed</h3><p>{a.name} vs {d.name}</p></div><button type="button" onClick={() => setSpeedEditor(null)}>Close ×</button></div><div className="speed-editor-grid">{([{key:"attacker",pokemon:a,evs:attackerEvs,setEvs:setAttackerEvs,nature:attackerNatureEffect,setNature:setAttackerNatureEffect,item:attackerItem,setItem:setAttackerItem,edited:editedA},{key:"defender",pokemon:d,evs:defenderEvs,setEvs:setDefenderEvs,nature:defenderNatureEffect,setNature:setDefenderNatureEffect,item:defenderItem,setItem:setDefenderItem,edited:editedD}] as const).map(side => <div className="speed-editor-side" key={side.key}><h4>{side.key === "attacker" ? "Attacking Pokémon" : "Defending Pokémon"}: {side.pokemon.name}</h4><label>Speed EVs<input type="number" min="0" max="252" step="4" value={side.evs} onChange={event => side.setEvs(Math.max(0, Math.min(252, Number(event.target.value) || 0)))} /></label><label>Speed nature effect<select value={side.nature} onChange={event => side.setNature(event.target.value)}><option value="hindered">Hindered (−Spe)</option><option value="unaffected">Unaffected</option><option value="boosted">Boosted (+Spe)</option></select></label><label>Item<select value={side.item} onChange={event => side.setItem(event.target.value)}>{itemOptions(side.pokemon.item)}</select></label><p className="speed-editor-result">Final Speed: <strong>{getEffectiveSpeed(side.edited, fieldState, side.key === "attacker" ? "attacker" : "defender", side.key === "attacker" ? rowStages[speedEditor.row]?.spe ?? 0 : colStages[speedEditor.col]?.spe ?? 0)}</strong></p></div>)}</div><div className="button-row speed-editor-actions"><button type="button" onClick={() => setSpeedEditor(null)}>Cancel</button><button type="button" className="primary" onClick={saveSpeedEditor}>OK · Update Teambuilder</button></div></section></div>;
    })()}
  </section>;
}
