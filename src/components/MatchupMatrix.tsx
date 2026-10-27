"use client";

import { useEffect, useMemo, useState } from "react";
import { calculateMove, getMoveDetails, getPokemonHp, getPokemonTypes, getAutoBoostedStat } from "../lib/calc";
import { FieldState, Matchup, PokemonSet, StatStages } from "../lib/types";
import { formatAbilityTooltip, formatItemTooltip } from "../lib/item-ability-descriptions";
import { getBaseSpeed, getEffectiveSpeed, getEffectiveMovePriority, getMovePriorityLabel, getMovePriorityNote } from "../lib/battle-order";
import { getItemList, getMoveList, getSpeciesAbilities } from "../lib/showdown-data";
import AutocompleteInput from "./AutocompleteInput";
import { getSpeciesLearnset } from "../lib/learnsets";
import { isEverythingFormat } from "../lib/format-normalization";
import PokemonSprite from "./PokemonSprite";
import { typeMatchupSummary } from "../lib/pokemon-visuals";
import SupportCategoryPanel from "./SupportCategoryPanel";
import CoveragePanel from "./CoveragePanel";
import DamageRangeBar from "./DamageRangeBar";

type Props = {
  left: PokemonSet[]; right: PokemonSet[]; generation: number; format: string; matchups: (Matchup | null)[][]; fieldState: FieldState;
  selected: { row: number; col: number } | null; swapped: boolean;
  rowMoves: string[]; rowStages: StatStages[]; colStages: StatStages[];
  critical: boolean; onCriticalChange: (value: boolean) => void; onToggleSwap: () => void;
  onSelect: (row: number, col: number) => void; onMoveChange: (row: number, move: string) => void;
  onRowStageChange: (row: number, stat: keyof StatStages, value: number) => void; onColStageChange: (col: number, stat: keyof StatStages, value: number) => void; onResetStages: () => void; onResetRowStages: (row: number) => void; onResetColStages: (col: number) => void;
  onRowPokemonChange: (row: number, patch: Partial<PokemonSet>) => void; onColPokemonChange: (col: number, patch: Partial<PokemonSet>) => void;
};

const STAGES = Array.from({ length: 13 }, (_, i) => i - 6);
const stageOptions = STAGES.map(stage => ({ value: String(stage), label: stage > 0 ? `+${stage}` : String(stage) }));

function legalMovesForSpecies(species: string, allMoves: string[], learnsets: Record<string, Set<string> | null>) {
  const key = species.toLowerCase().replace(/[^a-z0-9]/g, "");
  const learnset = learnsets[key];
  return learnset ? allMoves.filter(move => learnset.has(move.toLowerCase().replace(/[^a-z0-9]/g, ""))) : allMoves;
}
function isMoveLegalForSpecies(species: string, move: string, learnsets: Record<string, Set<string> | null>) {
  if (!move) return true;
  const key = species.toLowerCase().replace(/[^a-z0-9]/g, "");
  const learnset = learnsets[key];
  return !learnset || learnset.has(move.toLowerCase().replace(/[^a-z0-9]/g, ""));
}
function typeClass(type: string) { return `type-badge type-${type.toLowerCase().replace(/[^a-z]/g, "")}`; }
function displayTypes(pokemon: PokemonSet) {
  return pokemon.teraType ? [pokemon.teraType] : getPokemonTypes(pokemon);
}
function abilityStatName(stat?: PokemonSet["boostedStat"]) {
  return ({ atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe" } as Record<string, string>)[stat || ""] || "Auto";
}
function hpPercent(pokemon: PokemonSet) {
  const hp = getPokemonHp(pokemon);
  return hp.max > 0 ? Math.round((hp.current / hp.max) * 100) : 100;
}
function updateHpPercent(pokemon: PokemonSet, value: string, onChange: (patch: Partial<PokemonSet>) => void) {
  if (value.trim() === "") return;
  const pct = Number(value);
  if (!Number.isFinite(pct)) return;
  const hp = getPokemonHp(pokemon);
  if (hp.max > 0) onChange({ currentHp: Math.round(hp.max * Math.max(0, Math.min(100, pct)) / 100) });
}
function defenderFieldIndicators(defender: PokemonSet, move: string, field: FieldState, generation = 9, attacker?: PokemonSet) {
  const details = getMoveDetails(move, generation);
  if (!details || !["Physical", "Special"].includes(details.category)) return [] as string[];
  const tags: string[] = [];
  const types = getPokemonTypes(defender);
  const ability = defender.ability.trim().toLowerCase();
  const item = defender.item.trim().toLowerCase();
  const effectiveTypes = defender.teraType ? [defender.teraType] : types;
  const grounded = !effectiveTypes.includes("Flying") && ability !== "levitate" && item !== "air balloon";
  if (field.terrain === "Psychic" && grounded && Math.max(details.priority, getEffectiveMovePriority(attacker || defender, move, field)) > 0) tags.push("Psychic Terrain ×0 (priority blocked)");
  if (field.weather === "Sand" && types.includes("Rock") && details.category === "Special") tags.push("Sand: Rock SpD ×1.5");
  if (field.weather === "Snow" && types.includes("Ice") && details.category === "Physical") tags.push("Snow: Ice Def ×1.5");
  if (field.terrain === "Misty" && grounded && details.type === "Dragon") tags.push("Misty Terrain ×0.5 Dragon");
  if (ability === "thick fat" && ["Fire", "Ice"].includes(details.type)) tags.push("Thick Fat ×0.5");
  if (ability === "filter" || ability === "solid rock" || ability === "prism armor") tags.push(`${defender.ability} reduces damage if super-effective`);
  if (ability === "multiscale" && (defender.currentHp === undefined || getPokemonHp(defender).current >= getPokemonHp(defender).max)) tags.push("Multiscale ×0.5 at full HP");
  if (ability === "fluffy" && details.description.toLowerCase().includes("contact")) tags.push("Fluffy: contact damage ×0.5");
  if (item === "assault vest" && details.category === "Special") tags.push("Assault Vest SpD ×1.5");
  return tags;
}

function moveFieldIndicators(pokemon: PokemonSet, move: string, field: FieldState, generation = 9) {
  const details = getMoveDetails(move, generation);
  if (!details || !["Physical", "Special"].includes(details.category)) return [] as string[];
  const tags: string[] = [];
  const type = details.type;
  const name = details.name.toLowerCase();
  const ability = pokemon.ability.trim().toLowerCase();
  const item = pokemon.item.trim().toLowerCase();
  const grounded = !getPokemonTypes(pokemon).includes("Flying") && ability !== "levitate" && item !== "air balloon";
  if (field.weather === "Sun") {
    if (type === "Fire") tags.push("Sun ×1.5 Fire");
    if (type === "Water") tags.push("Sun ×0.5 Water");
    if (name === "solar beam" || name === "solar blade") tags.push("Sun: full power");
    if (name === "weather ball") tags.push("Sun: Weather Ball Fire ×2");
  } else if (field.weather === "Rain") {
    if (type === "Water") tags.push("Rain ×1.5 Water");
    if (type === "Fire") tags.push("Rain ×0.5 Fire");
    if (name === "solar beam" || name === "solar blade") tags.push("Rain: Solar power halved");
    if (name === "weather ball") tags.push("Rain: Weather Ball Water ×2");
  } else if (field.weather === "Sand") {
    if (name === "solar beam" || name === "solar blade") tags.push("Sand: Solar power halved");
    if (name === "weather ball") tags.push("Sand: Weather Ball Rock ×2");
    if (ability === "sand force" && ["Rock", "Ground", "Steel"].includes(type)) tags.push("Sand Force ×1.3");
  } else if (field.weather === "Snow") {
    if (name === "solar beam" || name === "solar blade") tags.push("Snow: Solar power halved");
    if (name === "blizzard") tags.push("Snow: Blizzard bypasses accuracy check");
    if (name === "weather ball") tags.push("Snow: Weather Ball Ice ×2");
  }
  if (grounded && field.terrain === "Electric" && type === "Electric") tags.push("Electric Terrain ×1.3");
  if (grounded && field.terrain === "Grassy" && type === "Grass") tags.push("Grassy Terrain ×1.3");
  if (field.terrain === "Grassy" && ["earthquake", "bulldoze", "magnitude"].includes(name)) tags.push("Grassy Terrain ×0.5 vs grounded targets");
  if (grounded && field.terrain === "Psychic" && type === "Psychic") tags.push("Psychic Terrain ×1.3");
  if (ability !== "infiltrator" && field.defenderReflect && details.category === "Physical") tags.push("Reflect");
  if (ability !== "infiltrator" && field.defenderLightScreen && details.category === "Special") tags.push("Light Screen");
  if (ability !== "infiltrator" && field.defenderAuroraVeil) tags.push("Aurora Veil");
  if (ability === "protosynthesis" || ability === "quark drive") {
    const active = ability === "protosynthesis" ? field.weather === "Sun" || item === "booster energy" : field.terrain === "Electric" || item === "booster energy";
    if (active) tags.push(`${pokemon.ability}: ${abilityStatName(pokemon.boostedStat || getAutoBoostedStat(pokemon))} boost`);
  }
  if (ability === "supreme overlord" && (pokemon.alliesFainted || 0) > 0) tags.push(`Supreme Overlord ${pokemon.alliesFainted}/5`);
  if (item === "life orb") tags.push("Life Orb ×1.3");
  if ((type === "Fire" && item === "charcoal") || (type === "Water" && item === "mystic water") || (type === "Electric" && item === "magnet") || (type === "Grass" && item === "miracle seed") || (type === "Ice" && item === "never-melt ice") || (type === "Psychic" && item === "twisted spoon") || (type === "Dragon" && item === "dragon fang") || (type === "Dark" && item === "black glasses") || (type === "Fairy" && item === "pixie plate") || (type === "Steel" && item === "metal coat") || (type === "Fighting" && item === "black belt") || (type === "Ground" && item === "soft sand") || (type === "Rock" && item === "hard stone") || (type === "Bug" && item === "silver powder") || (type === "Ghost" && item === "spell tag") || (type === "Flying" && item === "sharp beak") || (type === "Poison" && item === "poison barb")) tags.push(`${pokemon.item} type boost`);
  if (ability === "technician" && details.power !== null && details.power <= 60) tags.push("Technician ×1.5");
  if (ability === "sharpness" && /slicing/i.test(details.description)) tags.push("Sharpness ×1.5");
  if (ability === "huge power" || ability === "pure power") tags.push(`${pokemon.ability} doubles Attack`);
  if (ability === "guts" && pokemon.status && details.category === "Physical") tags.push("Guts ×1.5 Attack");
  if (ability === "adaptability" && getPokemonTypes(pokemon).includes(type)) tags.push("Adaptability STAB");
  if (ability === "iron fist" && /punch/i.test(details.name)) tags.push("Iron Fist ×1.2");
  if (ability === "strong jaw" && /fang/i.test(details.name)) tags.push("Strong Jaw ×1.5");
  if (ability === "mega launcher" && /pulse|aura/i.test(details.name)) tags.push("Mega Launcher ×1.5");
  if (ability === "tough claws" && /contact/i.test(details.description)) tags.push("Tough Claws ×1.3");
  if (ability === "punk rock" && /sound/i.test(details.description)) tags.push("Punk Rock ×1.3");
  if (ability === "reckless" && /recoil|crash/i.test(details.description)) tags.push("Reckless ×1.2");
  if (details.category === "Physical" && item === "choice band") tags.push("Choice Band ×1.5 Atk");
  if (details.category === "Special" && item === "choice specs") tags.push("Choice Specs ×1.5 SpA");
  if (details.category === "Physical" && item === "muscle band") tags.push("Muscle Band ×1.1");
  if (details.category === "Special" && item === "wise glasses") tags.push("Wise Glasses ×1.1");
  if (item === "expert belt") tags.push("Expert Belt if super effective");
  if (item === "metronome") tags.push("Metronome: consecutive-use boost");
  return [...new Set(tags)];
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
function formatMoveTooltip(name: string, pokemon?: PokemonSet, field?: FieldState) {
  const d = getMoveDetails(name);
  if (!d) return name;
  const priority = pokemon && field ? getMovePriorityNote(pokemon, name, field) : `Base priority: ${d.priority}`;
  return `${d.name}
${d.type} · ${d.category}
${d.power === null ? "Variable / no direct power" : `Base power: ${d.power}`}
${d.accuracy === null ? "Accuracy: —" : `Accuracy: ${d.accuracy}%`} · ${d.pp === null ? "PP: —" : `PP: ${d.pp}`}
${priority}

${d.description}`;
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
function allItemNames() { return getItemList(); }

export default function MatchupMatrix(props: Props) {
  const [supportOpen, setSupportOpen] = useState(false);
  const [coverageOpen, setCoverageOpen] = useState(false);
  const [learnsetsBySpecies, setLearnsetsBySpecies] = useState<Record<string, Set<string> | null>>({});
  const [learnsetRevision, setLearnsetRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setLearnsetRevision(value => value + 1);
    window.addEventListener("ptl-learnsets-refreshed", refresh);
    return () => window.removeEventListener("ptl-learnsets-refreshed", refresh);
  }, []);
  useEffect(() => {
    let cancelled = false;
    const species = [...new Set([...props.left, ...props.right].filter(p => p.species).map(p => p.species))];
    Promise.all(species.map(async name => [name.toLowerCase().replace(/[^a-z0-9]/g, ""), await getSpeciesLearnset(name, props.format)] as const)).then(entries => {
      if (!cancelled) setLearnsetsBySpecies(previous => ({ ...previous, ...Object.fromEntries(entries) }));
    }).catch(() => { /* legality remains unknown until learnset data is available */ });
    return () => { cancelled = true; };
  }, [props.left, props.right, props.format, learnsetRevision]);
  const { left, right, matchups, selected, swapped, rowStages, colStages, fieldState, format } = props;
  const [speedEditor, setSpeedEditor] = useState<SpeedEditor | null>(null);
  const [moveEditor, setMoveEditor] = useState<MoveEditor | null>(null);
  const allItems = useMemo(() => allItemNames(), [learnsetRevision]);
  const [quickEditor, setQuickEditor] = useState<{ side: "left" | "right"; index: number } | null>(null);
  const [quickItem, setQuickItem] = useState("");
  const [quickAbility, setQuickAbility] = useState("");
  const [quickTera, setQuickTera] = useState("");
  const [quickBoostedStat, setQuickBoostedStat] = useState<PokemonSet["boostedStat"]>("");
  const [quickMoves, setQuickMoves] = useState<string[]>(["", "", "", ""]);
  const allMoves = useMemo(() => getMoveList(), [learnsetRevision]);
  const openQuickEditor = (side: "left" | "right", index: number) => { const p = (side === "left" ? left : right)[index]; setQuickItem(p.item || ""); setQuickAbility(p.ability || ""); setQuickTera(p.importedTeraType || ""); setQuickBoostedStat(p.boostedStat || ""); setQuickMoves([...p.moves, "", "", "", ""].slice(0,4)); setQuickEditor({ side, index }); };
  const saveQuickEditor = () => { if (!quickEditor) return; const change = quickEditor.side === "left" ? props.onRowPokemonChange : props.onColPokemonChange; change(quickEditor.index, { item: quickItem, ability: quickAbility, moves: quickMoves, importedTeraType: quickTera, teraType: (quickEditor.side === "left" ? left : right)[quickEditor.index].teraType || "", boostedStat: quickBoostedStat }); setQuickEditor(null); };
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
    const a = left[row], d = right[col], details = getMoveDetails(move, props.generation);
    const atkStat = details?.category === "Special" ? "spa" : "atk";
    const defStat = details?.category === "Special" ? "spd" : "def";
    setMoveAtkEvs(a.evs?.[atkStat] ?? 0); setMoveDefEvs(d.evs?.[defStat] ?? 0); setMoveHpEvs(d.evs?.hp ?? 0);
    setMoveAtkNature(statNatureEffect(a.nature, atkStat)); setMoveDefNature(statNatureEffect(d.nature, defStat));
    setMoveAtkItem("__keep__"); setMoveDefItem("__keep__"); setMoveEditor({ row, col, move });
  };
  const saveMoveEditor = () => {
    if (!moveEditor) return;
    const { row, col, move } = moveEditor, a = left[row], d = right[col], details = getMoveDetails(move, props.generation);
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
  const speedSorted = (team: PokemonSet[]) => team.map((pokemon, index) => ({ pokemon, index, speed: getBaseSpeed(pokemon) })).sort((a, b) => Number(Boolean(a.pokemon.dead)) - Number(Boolean(b.pokemon.dead)) || b.speed - a.speed || a.index - b.index);
  const rowEntries = speedSorted(left);
  const colEntries = speedSorted(right);
  return <><section className="panel matrix-panel">
    <div className="panel-title-row"><div><h2>6 × 6 matchup matrix</h2></div><div className="button-row"><button type="button" onClick={() => setSupportOpen(true)}>Move Support</button><button type="button" onClick={() => setCoverageOpen(true)}>Coverage</button><button className="reset-stages-button reset-all-stages-button" title="Reset all stat stages and current HP to 100%" aria-label="Reset all stat stages and current HP to 100%" onClick={props.onResetStages}><span aria-hidden="true">↺</span></button><label className={`crit-toggle ${props.critical ? "active" : ""}`}><input type="checkbox" checked={props.critical} onChange={e => props.onCriticalChange(e.target.checked)} /> Critical hits</label><button onClick={props.onToggleSwap} title="Swap attacking and defending teams">⇄ {swapped ? "Team B attacks" : "Team A attacks"}</button></div></div>
    <div className="ko-legend"><span className="ko-1">1HKO</span><span className="ko-2">2HKO</span><span className="ko-3">3HKO</span><span className="ko-4">4HKO</span><span className="ko-5">4HKO+</span><span className="turn-order attacker">←</span><small>attacker first</small><span className="turn-order defender">↑</span><small>defender first</small><span className="turn-order tie">↔</span><small>tie</small><small>* conditional priority (Gale Wings assumes full HP)</small></div>
    <div className="matrix-scroll"><table className="matrix">
      <thead><tr><th className="corner" colSpan={2}>Attacker / move ↓</th>{colEntries.map(({ pokemon: poke, index: col }) => <th key={`${poke.name}-${col}`} className={`defender-header ${poke.dead ? "fainted-cell" : ""} ${poke.teraType ? "tera-active" : ""}`}>
        <div className="defender-identity"><div className="matrix-sprite-crop defender-sprite-crop"><PokemonSprite species={poke.species || poke.name} className="matrix-sprite" fainted={Boolean(poke.dead)} /></div><div><button type="button" className="matrix-pokemon-name faint-toggle-name" title="Click to toggle fainted" onClick={() => props.onColPokemonChange(col, { dead: !poke.dead })}>{col + 1}. {poke.species}{poke.dead ? " ☠" : ""}{poke.teraType ? <><span className="tera-marker"> TERA</span><span className="base-type-indicator" title={`Original typing: ${getPokemonTypes(poke).join(" / ")}`}>{getPokemonTypes(poke).join("/")}</span></> : null}</button><span className="type-list">{displayTypes(poke).map(t => <span className={typeClass(t)} key={t} title={`Defensive type matchups for ${poke.species}:\n${typeMatchupSummary(displayTypes(poke))}`}>{t}</span>)}</span><small role="button" tabIndex={0} className="matrix-item matrix-ability clickable-matrix-set" title={`${formatAbilityTooltip(poke.ability)}\n\nClick to edit item and ability`} onClick={() => openQuickEditor("right", col)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") openQuickEditor("right", col); }}>{poke.ability || "No ability"}{poke.ability.trim().toLowerCase() === "supreme overlord" ? <span className="ability-inline-indicator" title="Fainted teammates counted for Supreme Overlord"> · {Math.min(5, right.filter((member, i) => i !== col && member.dead).length)}/5 fallen</span> : null}{["protosynthesis", "quark drive"].includes(poke.ability.trim().toLowerCase()) ? <span className="ability-inline-indicator"> · Boost <select className="ability-boost-select" aria-label={`${poke.name} boosted stat`} value={poke.boostedStat || ""} onClick={e => e.stopPropagation()} onChange={e => props.onColPokemonChange(col, { boostedStat: e.target.value as PokemonSet["boostedStat"] })}><option value="">Auto ({abilityStatName(getAutoBoostedStat(poke))})</option><option value="atk">Atk</option><option value="def">Def</option><option value="spa">SpA</option><option value="spd">SpD</option><option value="spe">Spe</option></select></span> : null}{anyScreenActive && poke.ability.trim().toLowerCase() === "infiltrator" && <span className="screen-bypass-inline" title="Bypasses Reflect, Light Screen and Aurora Veil"> · screens bypassed</span>}</small><small role="button" tabIndex={0} className="matrix-item clickable-matrix-set" title={`${formatItemTooltip(poke.item)}\n\nClick to edit item and ability`} onClick={() => openQuickEditor("right", col)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") openQuickEditor("right", col); }}>{poke.item || "No item"}</small></div></div>
        <div className="matrix-pokemon-controls"><label>Tera <select aria-label={`${poke.name} Tera type`} value={poke.teraType || ""} disabled={!poke.importedTeraType} onChange={e => props.onColPokemonChange(col, { teraType: e.target.value })}><option value="">None</option>{poke.importedTeraType && <option value={poke.importedTeraType}>{poke.importedTeraType}</option>}</select></label><label>Status <select aria-label={`${poke.name} status`} value={poke.status || ""} onChange={e => props.onColPokemonChange(col, { status: e.target.value as PokemonSet["status"] })}><option value="">None</option><option value="brn">Burn</option><option value="par">Paralysis</option><option value="psn">Poison</option><option value="tox">Toxic</option><option value="slp">Sleep</option><option value="frz">Freeze</option></select></label></div><div className="matrix-current-hp"><label>Current HP (%) <input type="text" inputMode="decimal" pattern="[0-9]*" aria-label={`${poke.name} current HP percent`} value={hpPercent(poke)} onChange={e => updateHpPercent(poke, e.target.value, patch => props.onColPokemonChange(col, patch))} /></label></div>
        <div className="stat-stage-row">{([['Def','def'],['SpD','spd'],['Spe','spe']] as const).map(([label, stat]) => <label key={stat} title={`${label} stat stage`}>{label}<select aria-label={`${poke.name} ${label} stage`} value={colStages[col]?.[stat] ?? 0} onChange={e => props.onColStageChange(col, stat, Number(e.target.value))}>{stageOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>)}<button type="button" className="reset-one-stage-button" title={`Reset ${poke.name}'s stages`} aria-label={`Reset ${poke.name}'s stages`} onClick={() => props.onResetColStages(col)}>↺</button></div>
      </th>)}</tr></thead>
      <tbody>{rowEntries.map(({ pokemon: poke, index: row }) => {
        const moves = [...poke.moves.filter(Boolean).slice(0, 4)];
        while (moves.length < 4) moves.push("");
        return moves.map((move, mi) => {
          const details = move ? getMoveDetails(move, props.generation) : null;
          const showIdentity = mi === 0;
          return <tr key={`${poke.name}-${row}-${mi}`} className={`${mi === 0 ? "pokemon-block-start" : ""} ${poke.dead ? "fainted-row" : ""} ${poke.teraType ? "tera-attacker" : ""}`}>
            {mi === 0 && <th className={`attacker-info-cell ${poke.teraType ? "tera-attacker-info" : ""} ${poke.dead ? "fainted-cell" : ""}`} rowSpan={4} title={poke.species}>
              <div className="attacker-info-inner">
              <div className="matrix-sprite-crop attacker-sprite-crop"><PokemonSprite species={poke.species || poke.name} className="matrix-sprite" fainted={Boolean(poke.dead)} /></div>
              <button type="button" className="matrix-pokemon-name faint-toggle-name" title="Click to toggle fainted" onClick={() => props.onRowPokemonChange(row, { dead: !poke.dead })}>{row + 1}. {poke.species}{poke.dead ? " ☠" : ""}{poke.teraType ? <><span className="tera-marker"> TERA</span><span className="base-type-indicator" title={`Original typing: ${getPokemonTypes(poke).join(" / ")}`}>{getPokemonTypes(poke).join("/")}</span></> : null}</button>
              
              <span className="type-list">{displayTypes(poke).map(t => <span className={typeClass(t)} key={t} title={`Defensive type matchups for ${poke.species}:\n${typeMatchupSummary(displayTypes(poke))}`}>{t}</span>)}</span>
              <small role="button" tabIndex={0} className="matrix-item matrix-ability clickable-matrix-set" title={`${formatAbilityTooltip(poke.ability)}\n\nClick to edit item and ability`} onClick={() => openQuickEditor("left", row)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") openQuickEditor("left", row); }}>{poke.ability || "No ability"}{poke.ability.trim().toLowerCase() === "supreme overlord" ? <span className="ability-inline-indicator" title="Fainted teammates counted for Supreme Overlord"> · {Math.min(5, left.filter((member, i) => i !== row && member.dead).length)}/5 fallen</span> : null}{["protosynthesis", "quark drive"].includes(poke.ability.trim().toLowerCase()) ? <span className="ability-inline-indicator"> · Boost <select className="ability-boost-select" aria-label={`${poke.name} boosted stat`} value={poke.boostedStat || ""} onClick={e => e.stopPropagation()} onChange={e => props.onRowPokemonChange(row, { boostedStat: e.target.value as PokemonSet["boostedStat"] })}><option value="">Auto ({abilityStatName(getAutoBoostedStat(poke))})</option><option value="atk">Atk</option><option value="def">Def</option><option value="spa">SpA</option><option value="spd">SpD</option><option value="spe">Spe</option></select></span> : null}{anyScreenActive && poke.ability.trim().toLowerCase() === "infiltrator" && <span className="screen-bypass-inline" title="Bypasses Reflect, Light Screen and Aurora Veil"> · screens bypassed</span>}</small>
              
              <small role="button" tabIndex={0} className="matrix-item clickable-matrix-set" title={`${formatItemTooltip(poke.item)}\n\nClick to edit item and ability`} onClick={() => openQuickEditor("left", row)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") openQuickEditor("left", row); }}>{poke.item || "No item"}</small>
              
              <div className="matrix-pokemon-controls"><label>Tera <select aria-label={`${poke.name} Tera type`} value={poke.teraType || ""} disabled={!poke.importedTeraType} onChange={e => props.onRowPokemonChange(row, { teraType: e.target.value })}><option value="">None</option>{poke.importedTeraType && <option value={poke.importedTeraType}>{poke.importedTeraType}</option>}</select></label><label>Status <select aria-label={`${poke.name} status`} value={poke.status || ""} onChange={e => props.onRowPokemonChange(row, { status: e.target.value as PokemonSet["status"] })}><option value="">None</option><option value="brn">Burn</option><option value="par">Paralysis</option><option value="psn">Poison</option><option value="tox">Toxic</option><option value="slp">Sleep</option><option value="frz">Freeze</option></select></label></div>
              <div className="matrix-current-hp"><label>Current HP (%) <input type="text" inputMode="decimal" pattern="[0-9]*" aria-label={`${poke.name} current HP percent`} value={hpPercent(poke)} onChange={e => updateHpPercent(poke, e.target.value, patch => props.onRowPokemonChange(row, patch))} /></label></div>
              <div className="stat-stage-row">{([['Atk','atk'],['SpA','spa'],['Spe','spe']] as const).map(([label, stat]) => <label key={stat} title={`${label} stat stage`}>{label}<select aria-label={`${poke.name} ${label} stage`} value={rowStages[row]?.[stat] ?? 0} onChange={e => props.onRowStageChange(row, stat, Number(e.target.value))}>{stageOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>)}<button type="button" className="reset-one-stage-button" title={`Reset ${poke.name}'s stages`} aria-label={`Reset ${poke.name}'s stages`} onClick={() => props.onResetRowStages(row)}>↺</button></div>
              </div>
            </th>}
            <th className="attacker-move-cell"><div className="move-label clickable-matrix-move" role="button" tabIndex={0} title={move ? "Click to edit all four moves" : "Click to edit all four moves"} onClick={() => openQuickEditor("left", row)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") openQuickEditor("left", row); }}><strong>{mi + 1}. {move || "—"} {move ? getMovePriorityLabel(poke, move, fieldState) : ""}{details && props.fieldState.gameType === "Doubles" && (details.target === "allAdjacent" || details.target === "allAdjacentFoes" || details.target === "allAdjacentAlly") && <span className="move-spread-indicator" title={details.target === "allAdjacent" ? "Spread move: hits adjacent enemies and allies in Doubles" : details.target === "allAdjacentFoes" ? "Spread move: hits all adjacent enemies in Doubles" : "Spread move: hits adjacent allies in Doubles"}>{details.target === "allAdjacent" ? "Spread · foes + ally" : details.target === "allAdjacentAlly" ? "Spread · allies" : "Spread · all foes"}</span>}</strong>{details && moveFieldIndicators({ ...poke, alliesFainted: left.filter((member, i) => i !== row && member.dead).length }, move, fieldState, props.generation).map(tag => <span className="move-field-indicator" title={`Active damage modifier: ${tag}`} key={tag}>{tag}</span>)}{move && !isEverythingFormat(props.format) && !isMoveLegalForSpecies(poke.species, move, learnsetsBySpecies) && <span className="move-illegal-indicator" title={`This move is not in the species learnset. See Format legality for the selected format rules.`}>Learnset?</span>}{details && <span className="row-move-meta"><span className={typeClass(details.type)}>{details.type}</span><span>{details.category === "Physical" ? "PHY" : details.category === "Special" ? "SPL" : details.category}</span></span>}</div></th>
            {colEntries.map(({ index: col }) => {
              const item = matchups[row]?.[col];
              const result = item?.moves.find(m => m.move.toLowerCase() === move.toLowerCase());
              const active = selected?.row === row && selected?.col === col;
              const attackerSpeed = getEffectiveSpeed(poke, fieldState, "attacker", rowStages[row]?.spe ?? 0);
              const defenderSpeed = getEffectiveSpeed(right[col], fieldState, "defender", colStages[col]?.spe ?? 0);
              const order = attackerSpeed === defenderSpeed ? "tie"
                : (attackerSpeed > defenderSpeed) !== fieldState.trickRoom ? "attacker" : "defender";
              const orderLabel = order === "attacker" ? `${poke.name} moves first by Speed` : order === "defender" ? `${right[col].name} moves first by Speed` : "Equal Speed";
              const title = result ? `${formatMoveTooltip(move, poke, fieldState)}
${getMovePriorityNote(poke, move, fieldState)}

Damage range: ${result.min}–${result.max} HP (${result.minPct.toFixed(1)}–${result.maxPct.toFixed(1)}%)
Possible damage rolls: ${(result.rolls || []).join(", ") || "not available for this move"}
${result.ko}
${result.description}` : move ? `${formatMoveTooltip(move, poke, fieldState)}

No direct damage result for this move.` : "No move assigned";
              return <td key={col} className={`${right[col]?.dead ? "fainted-cell" : ""} ${right[col]?.teraType ? "tera-defender-cell" : ""}`}><div className="matchup-cell-layout">{move && defenderFieldIndicators(right[col], move, fieldState, props.generation, poke).length > 0 && <div className="cell-field-indicators">{defenderFieldIndicators(right[col], move, fieldState, props.generation, poke).map(tag => <span className="move-field-indicator cell-field-indicator" key={tag} title={`Defender-side damage modifier: ${tag}`}>{tag}</span>)}</div>}<button title={title} disabled={!move} className={`matrix-cell compact-cell ${result ? koClass(result.ko) : "ko-none"} ${active ? "active" : ""} ${poke.dead || right[col]?.dead ? "fainted-cell" : ""}`} onClick={() => { props.onSelect(row, col); if (move && details && ["Physical", "Special"].includes(details.category)) openMoveEditor(row, col, move); }}>{result ? <DamageRangeBar result={result} /> : <span>—</span>}</button>{move && <button type="button" className={`turn-order speed-arrow ${order}`} title={`Edit matchup Speed. ${orderLabel}. Effective Speed: ${attackerSpeed} vs ${defenderSpeed}.`} aria-label={`Edit Speed matchup: ${poke.name} versus ${right[col].name}`} onClick={() => openSpeedEditor(row, col)}>{order === "attacker" ? "←" : order === "defender" ? "↑" : "↔"}</button>}</div></td>;
            })}
          </tr>;
        });
      })}</tbody>
    </table></div>
    {moveEditor && (() => {
      const a = left[moveEditor.row], d = right[moveEditor.col], details = getMoveDetails(moveEditor.move, props.generation);
      if (!details || !["Physical", "Special"].includes(details.category)) return null;
      const atkStat = details.category === "Special" ? "spa" : "atk", defStat = details.category === "Special" ? "spd" : "def";
      const editedA: PokemonSet = { ...a, evs: { ...a.evs, [atkStat]: clampEV(moveAtkEvs) }, nature: natureForStat(moveAtkNature, atkStat, a.nature), item: moveAtkItem === "__keep__" ? a.item : moveAtkItem };
      const editedD: PokemonSet = { ...d, evs: { ...d.evs, [defStat]: clampEV(moveDefEvs), hp: clampEV(moveHpEvs) }, nature: natureForStat(moveDefNature, defStat, d.nature), item: moveDefItem === "__keep__" ? d.item : moveDefItem };
      const damage = calculateMove({ ...editedA, alliesFainted: left.filter((member, i) => i !== moveEditor.row && member.dead).length }, { ...editedD, alliesFainted: right.filter((member, i) => i !== moveEditor.col && member.dead).length }, moveEditor.move, fieldState, rowStages[moveEditor.row], colStages[moveEditor.col], props.critical, props.generation);
      const typeItems = TYPE_ITEMS[details.type] || [];
      const attackerItems = [...new Set([...(details.category === "Special" ? SPECIAL_ATTACK_ITEMS : PHYSICAL_ATTACK_ITEMS), ...typeItems, ...allItems.filter(item => /Gem$/.test(item) && item.startsWith(details.type))])];
      const defenderCoreItems = details.category === "Special" ? SPECIAL_DEFENSE_ITEMS : PHYSICAL_DEFENSE_ITEMS;
      const berry = RESIST_BERRIES[details.type];
      const baseline = calculateMove({ ...editedA, alliesFainted: left.filter((member, i) => i !== moveEditor.row && member.dead).length, item: moveAtkItem === "__keep__" ? a.item : moveAtkItem }, { ...editedD, alliesFainted: right.filter((member, i) => i !== moveEditor.col && member.dead).length, item: "" }, moveEditor.move, fieldState, rowStages[moveEditor.row], colStages[moveEditor.col], props.critical, props.generation);
      const berryResult = berry ? calculateMove({ ...editedA, alliesFainted: left.filter((member, i) => i !== moveEditor.row && member.dead).length, item: moveAtkItem === "__keep__" ? a.item : moveAtkItem }, { ...editedD, alliesFainted: right.filter((member, i) => i !== moveEditor.col && member.dead).length, item: berry }, moveEditor.move, fieldState, rowStages[moveEditor.row], colStages[moveEditor.col], props.critical, props.generation) : null;
      const usefulBerry = !!(berryResult && baseline && (berryResult.min !== baseline.min || berryResult.max !== baseline.max));
      const defenderItems = [...new Set([...defenderCoreItems, ...(usefulBerry && berry ? [berry] : [])])];
      const attackItemOptions = [...new Set(["__keep__", "", ...attackerItems])];
      const defenseItemOptions = [...new Set(["__keep__", "", ...defenderItems])];
      return <div className="speed-editor-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setMoveEditor(null); }}><section className="speed-editor panel" role="dialog" aria-modal="true" aria-labelledby="move-editor-title"><div className="panel-title-row"><div><h3 id="move-editor-title">Move Damage Editor</h3><p>{a.name} → {d.name} · {moveEditor.move} ({details.category})</p></div><button type="button" onClick={() => setMoveEditor(null)}>Close ×</button></div><div className="speed-editor-grid"><div className="speed-editor-side"><h4>Attacker: {a.name}</h4><label>{details.category === "Special" ? "SpA EVs" : "Atk EVs"}<input type="number" min="0" max="252" step="4" value={moveAtkEvs} onChange={e => setMoveAtkEvs(clampEV(Number(e.target.value)))} /><button type="button" onClick={() => setMoveAtkEvs(252)}>Max 252</button></label><label>{details.category === "Special" ? "SpA nature effect" : "Atk nature effect"}<select value={moveAtkNature} onChange={e => setMoveAtkNature(e.target.value)}><option value="hindered">Hindered (−{details.category === "Special" ? "SpA" : "Atk"})</option><option value="unaffected">Unaffected</option><option value="boosted">Boosted (+{details.category === "Special" ? "SpA" : "Atk"})</option></select></label><label>Attacking item<AutocompleteInput ariaLabel="attacking item" value={moveAtkItem === "__keep__" ? `Keep current item (${a.item || "none"})` : moveAtkItem} options={[`Keep current item (${a.item || "none"})`, "No item", ...attackerItems]} onChange={value => setMoveAtkItem(value.startsWith("Keep current item") ? "__keep__" : value === "No item" ? "" : value)} /></label></div><div className="speed-editor-side"><h4>Defender: {d.name}</h4><label>HP EVs<input type="number" min="0" max="252" step="4" value={moveHpEvs} onChange={e => setMoveHpEvs(clampEV(Number(e.target.value)))} /><button type="button" onClick={() => setMoveHpEvs(252)}>Max 252</button></label><label>{details.category === "Special" ? "SpD EVs" : "Def EVs"}<input type="number" min="0" max="252" step="4" value={moveDefEvs} onChange={e => setMoveDefEvs(clampEV(Number(e.target.value)))} /><button type="button" onClick={() => setMoveDefEvs(252)}>Max 252</button></label><label>{details.category === "Special" ? "SpD nature effect" : "Def nature effect"}<select value={moveDefNature} onChange={e => setMoveDefNature(e.target.value)}><option value="hindered">Hindered (−{details.category === "Special" ? "SpD" : "Def"})</option><option value="unaffected">Unaffected</option><option value="boosted">Boosted (+{details.category === "Special" ? "SpD" : "Def"})</option></select></label><label>Defensive item<AutocompleteInput ariaLabel="defensive item" value={moveDefItem === "__keep__" ? `Keep current item (${d.item || "none"})` : moveDefItem} options={[`Keep current item (${d.item || "none"})`, "No item", ...defenderItems]} onChange={value => setMoveDefItem(value.startsWith("Keep current item") ? "__keep__" : value === "No item" ? "" : value)} /></label></div></div><div className="move-damage-preview"><strong>Current battlefield damage range</strong><p>{damage ? `${damage.min}–${damage.max} HP (${damage.minPct.toFixed(1)}–${damage.maxPct.toFixed(1)}%)` : "Damage range unavailable for this move."}</p><small>Includes current weather, terrain, screens, Tera state, abilities, stat stages, critical-hit setting, and other calculator-supported field effects.</small></div><div className="button-row speed-editor-actions"><button type="button" onClick={() => setMoveEditor(null)}>Cancel</button><button type="button" className="primary" onClick={saveMoveEditor}>OK · Update Teambuilder</button></div></section></div>;
    })()}
    {quickEditor && (() => { const p = (quickEditor.side === "left" ? left : right)[quickEditor.index]; return <div className="speed-editor-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setQuickEditor(null); }}><section className="speed-editor panel" role="dialog" aria-modal="true" aria-labelledby="quick-pokemon-editor-title"><div className="panel-title-row"><div><h3 id="quick-pokemon-editor-title">Edit Pokémon</h3><p>{p.name} · {quickEditor.side === "left" ? "Team A" : "Team B"}</p></div><button type="button" onClick={() => setQuickEditor(null)}>Close ×</button></div><div className="speed-editor-grid"><div className="speed-editor-side"><h4>Item and ability</h4><label>Item<AutocompleteInput ariaLabel={`${p.name} item`} value={quickItem} options={allItems} onChange={setQuickItem} /></label><label>Ability<AutocompleteInput ariaLabel={`${p.name} ability`} value={quickAbility} options={getSpeciesAbilities(p.species)} onChange={value => { setQuickAbility(value); if (!/^(protosynthesis|quark drive)$/i.test(value.trim())) setQuickBoostedStat(""); }} /></label>{/^(protosynthesis|quark drive)$/i.test(quickAbility.trim()) && <label>Boosted stat<select value={quickBoostedStat || ""} onChange={e => setQuickBoostedStat(e.target.value as PokemonSet["boostedStat"])}><option value="">Auto ({abilityStatName(getAutoBoostedStat(p))})</option><option value="atk">Attack</option><option value="def">Defense</option><option value="spa">Special Attack</option><option value="spd">Special Defense</option><option value="spe">Speed</option></select></label>}<label>Tera Type<select value={quickTera} onChange={e => setQuickTera(e.target.value)}><option value="">None</option>{["Normal","Fire","Water","Electric","Grass","Ice","Fighting","Poison","Ground","Flying","Psychic","Bug","Rock","Ghost","Dragon","Dark","Steel","Fairy","Stellar"].map(type => <option key={type} value={type}>{type}</option>)}</select></label></div><div className="speed-editor-side"><h4>Moves</h4>{[0,1,2,3].map(i => <label key={i}>Move {i + 1}<AutocompleteInput ariaLabel={`${p.name} move ${i+1}`} value={quickMoves[i] || ""} options={legalMovesForSpecies(p.species, allMoves, learnsetsBySpecies)} onChange={value => setQuickMoves(old => old.map((m,j) => j === i ? value : m))} /></label>)}</div></div><div className="button-row speed-editor-actions"><button type="button" onClick={() => setQuickEditor(null)}>Cancel</button><button type="button" className="primary" onClick={saveQuickEditor}>OK · Update Pokémon</button></div></section></div>; })()}
    {speedEditor && (() => {
      const a = left[speedEditor.row], d = right[speedEditor.col];
      const editedA = { ...a, evs: { ...a.evs, spe: Math.max(0, Math.min(252, Number(attackerEvs) || 0)) }, nature: speedNatureFor(attackerNatureEffect, a.nature), item: attackerItem === "__keep__" ? a.item : attackerItem };
      const editedD = { ...d, evs: { ...d.evs, spe: Math.max(0, Math.min(252, Number(defenderEvs) || 0)) }, nature: speedNatureFor(defenderNatureEffect, d.nature), item: defenderItem === "__keep__" ? d.item : defenderItem };
      const itemOptions = (value: string) => <><option value="__keep__">Keep current item{value && !isSpeedItem(value) ? ` (${value})` : ""}</option><option value="">No item</option>{SPEED_ITEMS.map(item => <option key={item} value={item}>{item}</option>)}</>;
      return <div className="speed-editor-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSpeedEditor(null); }}><section className="speed-editor panel" role="dialog" aria-modal="true" aria-labelledby="speed-editor-title"><div className="panel-title-row"><div><h3 id="speed-editor-title">Matchup Speed</h3><p>{a.name} vs {d.name}</p></div><button type="button" onClick={() => setSpeedEditor(null)}>Close ×</button></div><div className="speed-editor-grid">{([{key:"attacker",pokemon:a,evs:attackerEvs,setEvs:setAttackerEvs,nature:attackerNatureEffect,setNature:setAttackerNatureEffect,item:attackerItem,setItem:setAttackerItem,edited:editedA},{key:"defender",pokemon:d,evs:defenderEvs,setEvs:setDefenderEvs,nature:defenderNatureEffect,setNature:setDefenderNatureEffect,item:defenderItem,setItem:setDefenderItem,edited:editedD}] as const).map(side => <div className="speed-editor-side" key={side.key}><h4>{side.key === "attacker" ? "Attacking Pokémon" : "Defending Pokémon"}: {side.pokemon.name}</h4>{side.edited.ability.trim().toLowerCase() === "unburden" && !side.edited.item.trim() ? <p className="unburden-speed-indicator">Unburden assumed active · Speed ×2 (no item)</p> : null}<label>Speed EVs<input type="number" min="0" max="252" step="4" value={side.evs} onChange={event => side.setEvs(Math.max(0, Math.min(252, Number(event.target.value) || 0)))} /><button type="button" onClick={() => side.setEvs(252)}>Max 252</button></label><label>Speed nature effect<select value={side.nature} onChange={event => side.setNature(event.target.value)}><option value="hindered">Hindered (−Spe)</option><option value="unaffected">Unaffected</option><option value="boosted">Boosted (+Spe)</option></select></label><label>Item<select value={side.item} onChange={event => side.setItem(event.target.value)}>{itemOptions(side.pokemon.item)}</select></label><p className="speed-editor-result">Final Speed: <strong>{getEffectiveSpeed(side.edited, fieldState, side.key === "attacker" ? "attacker" : "defender", side.key === "attacker" ? rowStages[speedEditor.row]?.spe ?? 0 : colStages[speedEditor.col]?.spe ?? 0)}</strong></p></div>)}</div><div className="button-row speed-editor-actions"><button type="button" onClick={() => setSpeedEditor(null)}>Cancel</button><button type="button" className="primary" onClick={saveSpeedEditor}>OK · Update Teambuilder</button></div></section></div>;
    })()}
  </section>{supportOpen && <SupportCategoryPanel left={swapped ? props.right : props.left} right={swapped ? props.left : props.right} format={format} onClose={() => setSupportOpen(false)} />}{coverageOpen && <CoveragePanel left={swapped ? props.right : props.left} right={swapped ? props.left : props.right} format={format} generation={props.generation} onClose={() => setCoverageOpen(false)} />}</>;
}
