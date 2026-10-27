"use client";

import Link from "next/link";

import { useEffect, useMemo, useState } from "react";
import { getAbility, getSpecies, getSpeciesAbilities, getSpeciesList } from "../lib/showdown-data";
import { POKEMON_TYPES } from "../lib/pokemon-visuals";
import { TypeChart } from "../lib/showdown-official/data/typechart";
import AutocompleteInput from "./AutocompleteInput";
import SupportCategoryPanel from "./SupportCategoryPanel";
import FormatSelector from "./FormatSelector";
import type { Team } from "../lib/types";

type Preset = { label: string; teamA: string[]; teamB: string[] };
const PRESETS: Preset[] = [
  { label: "OU Balance vs Bulky Offense", teamA: "Dragapult,Great Tusk,Gholdengo,Slowking,Kingambit,Rillaboom,Gliscor,Clefable,Heatran,Zamazenta,Ogerpon-Wellspring,Iron Valiant".split(","), teamB: "Landorus-Therian,Garganacl,Volcarona,Corviknight,Kyurem,Primarina,Ting-Lu,Roaring Moon,Hatterene,Samurott-Hisui,Skeledirge,Meowscarada".split(",") },
  { label: "Sun vs Rain", teamA: "Torkoal,Koraidon,Walking Wake,Gouging Fire,Great Tusk,Venusaur,Roaring Moon,Iron Moth,Charizard,Brute Bonnet,Slither Wing,Flutter Mane".split(","), teamB: "Pelipper,Archaludon,Barraskewda,Floatzel,Kingdra,Swampert,Zapdos,Thundurus-Therian,Iron Treads,Meowscarada,Dragonite,Urshifu-Rapid-Strike".split(",") },
  { label: "Trick Room vs Hyper Offense", teamA: "Hatterene,Ursaluna-Bloodmoon,Iron Hands,Cresselia,Slowking-Galar,Conkeldurr,Indeedee-F,Armarouge,Reuniclus,Kingambit,Azumarill,Marowak-Alola".split(","), teamB: "Dragapult,Iron Valiant,Roaring Moon,Deoxys-Speed,Meowscarada,Weavile,Iron Moth,Great Tusk,Dragonite,Scizor,Serperior,Volcarona".split(",") },
  { label: "Stall vs Balance", teamA: "Blissey,Alomomola,Clodsire,Dondozo,Skarmory,Gliscor,Corviknight,Quagsire,Chansey,Amoonguss,Toxapex,Clodsire".split(","), teamB: "Gholdengo,Great Tusk,Dragapult,Clefable,Heatran,Kingambit,Slowking,Dragonite,Meowscarada,Iron Valiant,Landorus-Therian,Primarina".split(",") },
  { label: "Sand vs Sun", teamA: "Tyranitar,Excadrill,Dracozolt,Garchomp,Corviknight,Rotom-Wash,Iron Treads,Gliscor,Scizor,Reuniclus,Hydreigon,Skarmory".split(","), teamB: "Torkoal,Venusaur,Walking Wake,Great Tusk,Roaring Moon,Iron Moth,Charizard,Flutter Mane,Gouging Fire,Brute Bonnet,Slither Wing,Heatran".split(",") },
  { label: "Electric Terrain vs Grassy Terrain", teamA: "Pincurchin,Iron Valiant,Iron Hands,Iron Moth,Raichu-Alola,Iron Treads,Tapu Koko,Rotom-Wash,Thundurus-Therian,Regieleki,Raikou,Ampharos".split(","), teamB: "Rillaboom,Ogerpon-Wellspring,Tapu Bulu,Heatran,Gliscor,Kingambit,Meowscarada,Serperior,Amoonguss,Great Tusk,Dragonite,Slowking".split(",") },
  { label: "Fairy-Steel Core vs Dragon Offense", teamA: "Clefable,Iron Crown,Kingambit,Corviknight,Primarina,Heatran,Azumarill,Scizor,Gholdengo,Tinkaton,Skarmory,Enamorus".split(","), teamB: "Dragapult,Dragonite,Garchomp,Roaring Moon,Hydreigon,Kyurem,Kommo-o,Salamence,Walking Wake,Gouging Fire,Latios,Goodra".split(",") },
  { label: "Hazard Stack vs Removal", teamA: "Samurott-Hisui,Glimmora,Ting-Lu,Skarmory,Meowscarada,Gholdengo,Gliscor,Great Tusk,Kingambit,Iron Moth,Dragapult,Heatran".split(","), teamB: "Great Tusk,Corviknight,Iron Treads,Excadrill,Tsareena,Donphan,Tornadus-Therian,Rotom-Wash,Landorus-Therian,Dragonite,Volcarona,Weavile".split(",") },
  { label: "Psychic Terrain vs Priority Offense", teamA: "Indeedee-F,Armarouge,Iron Valiant,Alakazam,Tapu Lele,Hatterene,Slowking-Galar,Deoxys-Speed,Espeon,Metagross,Latios,Reuniclus".split(","), teamB: "Kingambit,Dragonite,Scizor,Azumarill,Weavile,Grimmsnarl,Urshifu-Rapid-Strike,Rillaboom,Meowscarada,Bisharp,Lucario,Crawdaunt".split(",") },
  { label: "Mixed Draft Board", teamA: "Garchomp,Rotom-Wash,Corviknight,Volcarona,Azumarill,Excadrill,Slowking,Scizor,Hydreigon,Conkeldurr,Espeon,Chandelure".split(","), teamB: "Togekiss,Infernape,Milotic,Metagross,Mamoswine,Gliscor,Weavile,Empoleon,Salamence,Electivire,Snorlax,Heracross".split(",") },
];

const normalizeTeam = (team: string[]) => Array.from({ length: 12 }, (_, i) => team[i] || "");
const typeChart = TypeChart as unknown as Record<string, { damageTaken?: Record<string, number> }>;

function speciesTypes(name: string): string[] {
  const types = getSpecies(name)?.types;
  return Array.isArray(types) ? types.filter((type): type is string => typeof type === "string") : [];
}
function baseSpeed(name: string): number | null {
  const value = getSpecies(name)?.baseStats?.spe;
  return typeof value === "number" ? value : null;
}
function multiplier(defender: string, attackType: string): number {
  const types = speciesTypes(defender);
  if (!types.length) return 1;
  let value = 1;
  for (const type of types) {
    const code = typeChart[type.toLowerCase()]?.damageTaken?.[attackType];
    if (code === 3) return 0;
    if (code === 1) value *= 2;
    else if (code === 2) value *= 0.5;
  }
  return value;
}
function multiplierLabel(value: number) {
  return value === 0 ? "×0" : `×${Number.isInteger(value) ? value : value.toFixed(2).replace(/0$/, "")}`;
}
function typeClass(type: string) { return `type-badge type-${type.toLowerCase().replace(/[^a-z]/g, "")}`; }

export default function DraftMatchups() {
  const species = useMemo(() => getSpeciesList(), []);
  const [presetIndex, setPresetIndex] = useState(0);
  const [matchupName, setMatchupName] = useState(PRESETS[0].label);
  const [typeTeam, setTypeTeam] = useState<"A" | "B" | null>(null);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportSide, setSupportSide] = useState<"A" | "B">("A");
  const [formatA, setFormatA] = useState("Everything!");
  const [formatB, setFormatB] = useState("Everything!");
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try { const raw = localStorage.getItem("pokemon-team-lab-draft-matchup-v1"); if (raw) { const saved = JSON.parse(raw); if (typeof saved.matchupName === "string") setMatchupName(saved.matchupName); if (Array.isArray(saved.teamA)) setTeamA(normalizeTeam(saved.teamA)); if (Array.isArray(saved.teamB)) setTeamB(normalizeTeam(saved.teamB)); if (typeof saved.formatA === "string") setFormatA(saved.formatA); if (typeof saved.formatB === "string") setFormatB(saved.formatB); if (Number.isInteger(saved.presetIndex) && saved.presetIndex >= 0 && saved.presetIndex < PRESETS.length) setPresetIndex(saved.presetIndex); } } catch {} finally { setHydrated(true); }
  }, []);
  useEffect(() => { if (!hydrated) return; try { localStorage.setItem("pokemon-team-lab-draft-matchup-v1", JSON.stringify({ matchupName, teamA, teamB, formatA, formatB, presetIndex })); } catch {} }, [hydrated, matchupName, teamA, teamB, formatA, formatB, presetIndex]);
  const [teamA, setTeamA] = useState<string[]>(() => normalizeTeam(PRESETS[0].teamA));
  const [teamB, setTeamB] = useState<string[]>(() => normalizeTeam(PRESETS[0].teamB));
  const [editorOpen, setEditorOpen] = useState(false);
  const [draftA, setDraftA] = useState<string[]>(teamA);
  const [draftB, setDraftB] = useState<string[]>(teamB);

  const setPreset = (index: number) => {
    const selected = PRESETS[index];
    setPresetIndex(index);
    setMatchupName(selected.label);
    setTeamA(normalizeTeam(selected.teamA));
    setTeamB(normalizeTeam(selected.teamB));
  };
  const openEditor = () => {
    setDraftA([...teamA]);
    setDraftB([...teamB]);
    setEditorOpen(true);
  };
  const saveEditor = () => {
    setTeamA(normalizeTeam(draftA));
    setTeamB(normalizeTeam(draftB));
    setEditorOpen(false);
  };
  const activeA = teamA.filter(Boolean);
  const activeB = teamB.filter(Boolean);
  const sortedA = [...activeA].sort((a, b) => (baseSpeed(b) ?? -1) - (baseSpeed(a) ?? -1));
  const sortedB = [...activeB].sort((a, b) => (baseSpeed(b) ?? -1) - (baseSpeed(a) ?? -1));
  const lastRow = Math.max(sortedA.length, sortedB.length) - 1;
  const asTeam = (names: string[]): Team => names.map(species => ({ name: species, species, item: "", ability: getSpeciesAbilities(species)[0] || "", nature: "Hardy", level: 100, evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, moves: [] }));
  const updateDraft = (side: "A" | "B", index: number, value: string) => {
    const update = side === "A" ? setDraftA : setDraftB;
    update(current => current.map((name, i) => i === index ? value : name));
  };
  const speedStat = (name: string, ev: number, boosted: boolean) => { const base = baseSpeed(name); if (base == null) return null; const raw = Math.floor((2 * base + 31 + Math.floor(ev / 4)) * 100 / 100) + 5; return Math.floor(raw * (boosted ? 1.1 : 1)); };
  const speedTip = (name: string, opponents: string[]) => {
    const checks = opponents.filter(opponent => opponent && opponent !== name).map(opponent => {
      const targetBase = baseSpeed(opponent); if (targetBase == null) return null;
      const target = speedStat(opponent, 252, true); if (target == null) return null;
      const find = (boosted: boolean) => { for (let ev = 0; ev <= 252; ev += 4) if ((speedStat(name, ev, boosted) ?? 0) > target) return ev; return null; };
      return { opponent, target, neutral: find(false), boosted: find(true) };
    }).filter((x): x is {opponent:string;target:number;neutral:number|null;boosted:number|null} => !!x && x.neutral !== 0 && (x.neutral != null || x.boosted != null));
    if (!checks.length) return "No opposing Pokémon requires Speed EVs to outspeed (252+ Speed nature).";
    return checks.map(x => `${x.opponent} (${x.target} Speed): ${x.neutral == null ? "cannot with neutral nature" : `neutral ${x.neutral} EVs`}; ${x.boosted == null ? "cannot with +Speed nature" : `+Speed ${x.boosted} EVs`}`).join("\n");
  };

  return <main className="draft-page">
    <header className="hero draft-hero">
      <div><span className="eyebrow">Pokemon Team Lab</span><h1>Draft Matchups</h1><p>Compare up to 12 Pokémon on each side, base Speed, abilities, and defensive type matchups.</p></div>
      <div className="hero-actions"><Link className="nav-link" href="/">Back to Team Lab</Link></div>
    </header>

    <section className="panel draft-controls">
      <div className="draft-preset-control"><label htmlFor="draft-preset">Matchup preset</label><select id="draft-preset" value={presetIndex} onChange={event => setPreset(Number(event.target.value))}>{PRESETS.map((preset, index) => <option key={preset.label} value={index}>{index + 1}. {preset.label}</option>)}</select></div>
      <div className="draft-team-counts"><span>Team A: <strong>{activeA.length}/12</strong></span><span>Team B: <strong>{activeB.length}/12</strong></span></div>
      <button className="primary" type="button" onClick={openEditor}>Edit matchup</button>
    </section>

    <section className="panel">
      <div className="panel-title-row"><div><h2>{matchupName}</h2><p>Hover over a Speed value for EV benchmarks against opposing Pokémon at 252 EVs and a boosting nature.</p></div><div className="draft-team-formats"><label>Team A format<FormatSelector value={formatA} onChange={setFormatA} /></label><label>Team B format<FormatSelector value={formatB} onChange={setFormatB} /></label></div></div>
      <div className="matrix-scroll draft-table-scroll"><table className="draft-matchup-table">
        <thead><tr><th>Types A</th><th>Abilities A</th><th><button type="button" className="draft-heading-button" onClick={() => setTypeTeam("A")}>Pokémon Team A · defensive types</button></th><th>Speed A</th><th>Speed B</th><th><button type="button" className="draft-heading-button" onClick={() => setTypeTeam("B")}>Pokémon Team B · defensive types</button></th><th>Abilities B</th><th>Types B</th></tr></thead>
        <tbody>{Array.from({ length: Math.max(0, lastRow + 1) }, (_, index) => {
          const a = sortedA[index] || "";
          const b = sortedB[index] || "";
          const abilitiesA = a ? getSpeciesAbilities(a) : [];
          const abilitiesB = b ? getSpeciesAbilities(b) : [];
          return <tr key={index}>
            <td>{a && <div className="draft-type-pills">{speciesTypes(a).map(type => <span key={type} className={typeClass(type)}>{type}</span>)}</div>}</td>
            <td><div className="draft-abilities">{abilitiesA.map(ability => <span key={ability} className="draft-ability" title={getAbility(ability)?.desc || getAbility(ability)?.shortDesc || "No ability description available."}>{ability}</span>)}</div></td>
            <td className="draft-pokemon-name">{a || <span className="muted">—</span>}</td>
            <td className="draft-speed" title={a ? speedTip(a, activeB) : undefined}>{a ? <span title={speedTip(a, activeB)}>{baseSpeed(a) ?? "—"}</span> : "—"}</td>
            <td className="draft-speed" title={b ? speedTip(b, activeA) : undefined}>{b ? <span title={speedTip(b, activeA)}>{baseSpeed(b) ?? "—"}</span> : "—"}</td>
            <td className="draft-pokemon-name">{b || <span className="muted">—</span>}</td>
            <td><div className="draft-abilities">{abilitiesB.map(ability => <span key={ability} className="draft-ability" title={getAbility(ability)?.desc || getAbility(ability)?.shortDesc || "No ability description available."}>{ability}</span>)}</div></td>
            <td><div className="draft-type-pills">{b && speciesTypes(b).map(type => <span key={type} className={typeClass(type)}>{type}</span>)}</div></td>
          </tr>;
        })}</tbody>
      </table></div>
      {lastRow < 0 && <p className="muted">Choose Pokémon with “Edit matchup” to populate the table.</p>}
    </section>

    <section className="panel draft-tools-row">
      <div><h2>Team tools</h2><p>Defensive type charts are available from each team heading.</p></div>
      <button type="button" onClick={() => setSupportOpen(true)}>Support moves</button>
    </section>

    {typeTeam && <div className="draft-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setTypeTeam(null); }}>
      <section className="draft-modal draft-type-modal" role="dialog" aria-modal="true" aria-labelledby="draft-type-title">
        <div className="panel-title-row"><div><h2 id="draft-type-title">Team {typeTeam} defensive matchups</h2><p>Green indicates resistance or immunity; red indicates weakness.</p></div><button type="button" onClick={() => setTypeTeam(null)}>Close ×</button></div>
        <div className="matrix-scroll"><table className="draft-typechart-table draft-typechart-transposed">
          <thead><tr><th>Pokémon</th>{POKEMON_TYPES.map(type => { const roster = typeTeam === "A" ? sortedA : sortedB; const vals = roster.map(p => multiplier(p, type)); const good = vals.filter(v => v < 1).length; const bad = vals.filter(v => v > 1).length; return <th key={type} className={good > bad ? "type-head-good" : bad > good ? "type-head-bad" : ""}><span className={typeClass(type)}>{type}</span><small>{good}R · {bad}W</small></th>; })}</tr></thead>
          <tbody>{(typeTeam === "A" ? sortedA : sortedB).map(pokemon => <tr key={pokemon}><th>{pokemon}</th>{POKEMON_TYPES.map(attackType => { const value = multiplier(pokemon, attackType); return <td key={attackType} className={`type-multiplier ${value < 1 ? "resist" : value > 1 ? "weak" : value === 0 ? "immune" : "neutral"}`}>{multiplierLabel(value)}</td>; })}</tr>)}</tbody>
        </table></div>
      </section>
    </div>}

    {supportOpen && <div className="draft-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSupportOpen(false); }}><section className="draft-modal" role="dialog" aria-modal="true" aria-label="Draft support moves"><div className="panel-title-row"><h2>Support moves · Team {supportSide}</h2><button type="button" onClick={() => setSupportOpen(false)}>Close ×</button></div><div className="button-row"><button type="button" aria-pressed={supportSide === "A"} onClick={() => setSupportSide("A")}>Team A · {formatA}</button><button type="button" aria-pressed={supportSide === "B"} onClick={() => setSupportSide("B")}>Team B · {formatB}</button></div><SupportCategoryPanel left={asTeam(supportSide === "A" ? activeA : activeB)} right={[]} format={supportSide === "A" ? formatA : formatB} onClose={() => setSupportOpen(false)} /></section></div>}

    {editorOpen && <div className="draft-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setEditorOpen(false); }}>
      <section className="draft-modal" role="dialog" aria-modal="true" aria-labelledby="draft-editor-title">
        <div className="panel-title-row"><div><h2 id="draft-editor-title">Edit matchup Pokémon</h2><p>Use an empty slot to reduce either roster below 12 Pokémon.</p></div><button type="button" onClick={() => setEditorOpen(false)} aria-label="Close editor">×</button></div>
        <label className="draft-matchup-name">Matchup name<input value={matchupName} onChange={event => setMatchupName(event.target.value)} /></label><div className="draft-editor-teams">
          {[{ label: "Team A", side: "A" as const, roster: draftA }, { label: "Team B", side: "B" as const, roster: draftB }].map(({ label, side, roster }) => <div className="draft-editor-team" key={side}>
            <h3>{label}</h3><label className="draft-format-label">Format<FormatSelector value={side === "A" ? formatA : formatB} onChange={side === "A" ? setFormatA : setFormatB} /></label>
            {roster.map((pokemon, index) => <label className="draft-editor-slot" key={`${side}-${index}`}><span>Slot {index + 1}</span><AutocompleteInput ariaLabel={`${label} slot ${index + 1} Pokémon`} value={pokemon} options={["", ...species]} onChange={value => updateDraft(side, index, value)} /></label>)}
          </div>)}
        </div>
        <div className="button-row draft-editor-actions"><button type="button" onClick={() => { setDraftA(Array.from({ length: 12 }, () => "")); setDraftB(Array.from({ length: 12 }, () => "")); }}>Clear both teams</button><button type="button" onClick={() => setEditorOpen(false)}>Cancel</button><button className="primary" type="button" onClick={saveEditor}>Save matchup</button></div>
      </section>
    </div>}
  </main>;
}
