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
  const [draftMatchupName, setDraftMatchupName] = useState(PRESETS[0].label);
  const [typeTeam, setTypeTeam] = useState<"A" | "B" | null>(null);
  const [supportOpen, setSupportOpen] = useState(false);
  const [speedEdit, setSpeedEdit] = useState<{ side: "A" | "B"; name: string } | null>(null);
  type SpeedConfig = { ev: number; nature: "boost" | "neutral" | "hinder"; stage: number };
  const [speedConfigs, setSpeedConfigs] = useState<Record<string, SpeedConfig>>({});
  const [format, setFormat] = useState("Everything!");
  const [teamA, setTeamA] = useState<string[]>(() => normalizeTeam(PRESETS[0].teamA));
  const [teamB, setTeamB] = useState<string[]>(() => normalizeTeam(PRESETS[0].teamB));
  const [hydrated, setHydrated] = useState(false);
  const storageKey = "pokemon-team-lab-draft-matchups-v2";
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as { currentIndex?: number; matchups?: Record<string, { matchupName?: string; teamA?: string[]; teamB?: string[]; format?: string; speedConfigs?: Record<string, SpeedConfig> }> };
        const index = Number.isInteger(saved.currentIndex) && saved.currentIndex! >= 0 && saved.currentIndex! < PRESETS.length ? saved.currentIndex! : 0;
        setPresetIndex(index);
        const active = saved.matchups?.[String(index)];
        if (active) {
          if (typeof active.matchupName === "string") { setMatchupName(active.matchupName); setDraftMatchupName(active.matchupName); }
          if (Array.isArray(active.teamA)) setTeamA(normalizeTeam(active.teamA));
          if (Array.isArray(active.teamB)) setTeamB(normalizeTeam(active.teamB));
          if (typeof active.format === "string") setFormat(active.format);
          if (active.speedConfigs && typeof active.speedConfigs === "object") setSpeedConfigs(active.speedConfigs);
        } else {
          setTeamA(normalizeTeam(PRESETS[index].teamA)); setTeamB(normalizeTeam(PRESETS[index].teamB));
          setMatchupName(PRESETS[index].label); setDraftMatchupName(PRESETS[index].label);
        }
      } else {
        // Migrate the previous single-matchup save into its corresponding preset slot.
        const legacyRaw = localStorage.getItem("pokemon-team-lab-draft-matchup-v1");
        if (legacyRaw) {
          const legacy = JSON.parse(legacyRaw);
          const index = Number.isInteger(legacy.presetIndex) && legacy.presetIndex >= 0 && legacy.presetIndex < PRESETS.length ? legacy.presetIndex : 0;
          setPresetIndex(index);
          if (typeof legacy.matchupName === "string") { setMatchupName(legacy.matchupName); setDraftMatchupName(legacy.matchupName); }
          if (Array.isArray(legacy.teamA)) setTeamA(normalizeTeam(legacy.teamA));
          if (Array.isArray(legacy.teamB)) setTeamB(normalizeTeam(legacy.teamB));
          if (typeof legacy.format === "string") setFormat(legacy.format); else if (typeof legacy.formatA === "string") setFormat(legacy.formatA); else if (typeof legacy.formatB === "string") setFormat(legacy.formatB);
          if (legacy.speedConfigs && typeof legacy.speedConfigs === "object") setSpeedConfigs(legacy.speedConfigs);
        }
      }
    } catch {} finally { setHydrated(true); }
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try {
      const raw = localStorage.getItem(storageKey);
      const saved = raw ? JSON.parse(raw) : {};
      const matchups = saved.matchups && typeof saved.matchups === "object" ? saved.matchups : {};
      matchups[String(presetIndex)] = { matchupName, teamA, teamB, format, speedConfigs };
      localStorage.setItem(storageKey, JSON.stringify({ currentIndex: presetIndex, matchups }));
    } catch {}
  }, [hydrated, matchupName, teamA, teamB, format, presetIndex, speedConfigs]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draftA, setDraftA] = useState<string[]>(teamA);
  const [draftB, setDraftB] = useState<string[]>(teamB);

  const setPreset = (index: number) => {
    // Persist the outgoing matchup synchronously before changing the active slot.
    try {
      const raw = localStorage.getItem(storageKey);
      const saved = raw ? JSON.parse(raw) : {};
      const matchups = saved.matchups && typeof saved.matchups === "object" ? saved.matchups : {};
      matchups[String(presetIndex)] = { matchupName, teamA, teamB, format, speedConfigs };
      const next = matchups[String(index)];
      localStorage.setItem(storageKey, JSON.stringify({ currentIndex: index, matchups }));
      setPresetIndex(index);
      if (next) {
        setMatchupName(typeof next.matchupName === "string" ? next.matchupName : PRESETS[index].label);
        setDraftMatchupName(typeof next.matchupName === "string" ? next.matchupName : PRESETS[index].label);
        setTeamA(normalizeTeam(Array.isArray(next.teamA) ? next.teamA : PRESETS[index].teamA));
        setTeamB(normalizeTeam(Array.isArray(next.teamB) ? next.teamB : PRESETS[index].teamB));
        setFormat(typeof next.format === "string" ? next.format : "Everything!");
        setSpeedConfigs(next.speedConfigs && typeof next.speedConfigs === "object" ? next.speedConfigs : {});
      } else {
        setMatchupName(PRESETS[index].label); setDraftMatchupName(PRESETS[index].label);
        setTeamA(normalizeTeam(PRESETS[index].teamA)); setTeamB(normalizeTeam(PRESETS[index].teamB));
        setFormat("Everything!"); setSpeedConfigs({});
      }
    } catch {
      setPresetIndex(index); setMatchupName(PRESETS[index].label); setDraftMatchupName(PRESETS[index].label);
      setTeamA(normalizeTeam(PRESETS[index].teamA)); setTeamB(normalizeTeam(PRESETS[index].teamB));
    }
  };
  const openEditor = () => {
    setDraftA([...teamA]);
    setDraftB([...teamB]);
    setDraftMatchupName(matchupName);
    setEditorOpen(true);
  };
  const closeEditor = () => {
    const name = draftMatchupName.trim() || PRESETS[presetIndex].label;
    setMatchupName(name);
    setDraftMatchupName(name);
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
    const setTeam = side === "A" ? setTeamA : setTeamB;
    update(current => current.map((name, i) => i === index ? value : name));
    setTeam(current => normalizeTeam(current.map((name, i) => i === index ? value : name)));
  };
  const configFor = (side: "A" | "B", name: string): SpeedConfig => speedConfigs[`${side}:${name}`] || { ev: 252, nature: "boost", stage: 0 };
  const stageMultiplier = (stage: number) => stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
  const speedStat = (name: string, ev: number, nature: SpeedConfig["nature"], stage: number) => {
    const base = baseSpeed(name); if (base == null) return null;
    const raw = Math.floor((2 * base + 31 + Math.floor(ev / 4)) * 100 / 100) + 5;
    const natureValue = nature === "boost" ? 1.1 : nature === "hinder" ? 0.9 : 1;
    return Math.floor(Math.floor(raw * natureValue) * stageMultiplier(stage));
  };
  const speedTip = (name: string, side: "A" | "B", opponents: string[]) => {
    const own = configFor(side, name);
    const checks = opponents.filter(opponent => Boolean(opponent)).map(opponent => {
      const targetConfig = configFor(side === "A" ? "B" : "A", opponent);
      const target = speedStat(opponent, targetConfig.ev, targetConfig.nature, targetConfig.stage); if (target == null) return null;
      const find = (nature: SpeedConfig["nature"]) => { for (let ev = 0; ev <= 252; ev += 4) if ((speedStat(name, ev, nature, own.stage) ?? 0) > target) return ev; return null; };
      return { opponent, target, neutral: find("neutral"), boosted: find("boost") };
    }).filter((x): x is {opponent:string;target:number;neutral:number|null;boosted:number|null} => !!x && x.neutral !== 0 && (x.neutral !== null || x.boosted !== null)).sort((a, b) => b.target - a.target);
    if (!checks.length) return "No opposing Pokémon has a reachable Speed benchmark requiring additional EVs.";
    return checks.map(x => `${x.opponent} (${x.target} effective Speed): ${[x.neutral !== null ? `neutral ${x.neutral} EVs` : null, x.boosted !== null ? `+Speed ${x.boosted} EVs` : null].filter(Boolean).join("; ")}`).join("\n");
  };
  const updateSpeedConfig = (side: "A" | "B", name: string, patch: Partial<SpeedConfig>) => setSpeedConfigs(current => ({ ...current, [`${side}:${name}`]: { ...configFor(side, name), ...patch } }));


  return <main className="draft-page">
    <header className="hero draft-hero">
      <div><span className="eyebrow">Pokemon Team Lab</span><h1>Draft Matchups</h1><p>Compare up to 12 Pokémon on each side, base Speed, abilities, and defensive type matchups.</p></div>
      <div className="hero-actions"><Link className="nav-link" href="/">Back to Team Lab</Link></div>
    </header>

    <section className="panel draft-controls">
      <div className="draft-preset-control"><label htmlFor="draft-preset">Matchup preset</label><select id="draft-preset" value={presetIndex} onChange={event => setPreset(Number(event.target.value))}>{PRESETS.map((preset, index) => <option key={preset.label} value={index}>{index + 1}. {index === presetIndex ? matchupName : preset.label}</option>)}</select></div>
      <button type="button" className="primary" onClick={() => setSupportOpen(true)}>Support moves</button>
      <div className="draft-team-counts"><span>Team A: <strong>{activeA.length}/12</strong></span><span>Team B: <strong>{activeB.length}/12</strong></span></div>
      <button className="primary" type="button" onClick={openEditor}>Edit matchup</button>
    </section>

    <section className="panel">
      <div className="panel-title-row"><div><h2>{matchupName}</h2><p>Hover over a Speed value for EV benchmarks against opposing Pokémon at 252 EVs and a boosting nature.</p></div><div className="draft-team-formats"><label>Matchup format<FormatSelector value={format} onChange={setFormat} /></label></div></div>
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
            <td className="draft-speed">{a ? <><strong>{baseSpeed(a) ?? "—"}</strong><button type="button" className="draft-speed-config" title={speedTip(a, "A", activeB)} onClick={() => setSpeedEdit({ side: "A", name: a })}>{configFor("A", a).ev}{configFor("A", a).nature === "boost" ? "+" : configFor("A", a).nature === "hinder" ? "−" : ""} EV · {configFor("A", a).stage > 0 ? `+${configFor("A", a).stage}` : configFor("A", a).stage}</button></> : "—"}</td>
            <td className="draft-speed">{b ? <><strong>{baseSpeed(b) ?? "—"}</strong><button type="button" className="draft-speed-config" title={speedTip(b, "B", activeA)} onClick={() => setSpeedEdit({ side: "B", name: b })}>{configFor("B", b).ev}{configFor("B", b).nature === "boost" ? "+" : configFor("B", b).nature === "hinder" ? "−" : ""} EV · {configFor("B", b).stage > 0 ? `+${configFor("B", b).stage}` : configFor("B", b).stage}</button></> : "—"}</td>
            <td className="draft-pokemon-name">{b || <span className="muted">—</span>}</td>
            <td><div className="draft-abilities">{abilitiesB.map(ability => <span key={ability} className="draft-ability" title={getAbility(ability)?.desc || getAbility(ability)?.shortDesc || "No ability description available."}>{ability}</span>)}</div></td>
            <td><div className="draft-type-pills">{b && speciesTypes(b).map(type => <span key={type} className={typeClass(type)}>{type}</span>)}</div></td>
          </tr>;
        })}</tbody>
      </table></div>
      {lastRow < 0 && <p className="muted">Choose Pokémon with “Edit matchup” to populate the table.</p>}
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

    {supportOpen && <SupportCategoryPanel left={asTeam(activeA)} right={asTeam(activeB)} format={format} onClose={() => setSupportOpen(false)} draftMode />}

    {speedEdit && <div className="draft-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSpeedEdit(null); }}><section className="draft-modal draft-speed-modal" role="dialog" aria-modal="true" aria-label={`${speedEdit.name} Speed settings`}><div className="panel-title-row"><div><h2>{speedEdit.name} Speed settings</h2><p>Used for speed EV benchmarks; table order remains based on base Speed.</p></div><button type="button" onClick={() => setSpeedEdit(null)}>Close ×</button></div>{(() => { const cfg = configFor(speedEdit.side, speedEdit.name); return <div className="draft-speed-fields"><label>Speed EVs <input type="number" min="0" max="252" step="4" value={cfg.ev} onChange={e => updateSpeedConfig(speedEdit.side, speedEdit.name, { ev: Math.max(0, Math.min(252, Number(e.target.value) || 0)) })} /></label><label>Nature<select value={cfg.nature} onChange={e => updateSpeedConfig(speedEdit.side, speedEdit.name, { nature: e.target.value as SpeedConfig["nature"] })}><option value="boost">Boosting (+Speed)</option><option value="neutral">Neutral</option><option value="hinder">Hindering (−Speed)</option></select></label><label>Speed stage<select value={cfg.stage} onChange={e => updateSpeedConfig(speedEdit.side, speedEdit.name, { stage: Number(e.target.value) })}>{Array.from({length: 13}, (_, i) => i - 6).map(stage => <option key={stage} value={stage}>{stage > 0 ? `+${stage}` : stage}</option>)}</select></label></div>; })()}</section></div>}

    {editorOpen && <div className="draft-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeEditor(); }}>
      <section className="draft-modal" role="dialog" aria-modal="true" aria-labelledby="draft-editor-title">
        <div className="panel-title-row"><div><h2 id="draft-editor-title">Edit matchup Pokémon</h2><p>Use an empty slot to reduce either roster below 12 Pokémon.</p></div><button type="button" onClick={closeEditor} aria-label="Close editor">×</button></div>
        <label className="draft-matchup-name">Matchup name<input value={draftMatchupName} onChange={event => setDraftMatchupName(event.target.value)} onBlur={() => { /* committed when the editor closes */ }} /></label><label className="draft-format-label">Matchup format<FormatSelector value={format} onChange={setFormat} /></label><div className="draft-editor-teams">
          {[{ label: "Team A", side: "A" as const, roster: draftA }, { label: "Team B", side: "B" as const, roster: draftB }].map(({ label, side, roster }) => <div className="draft-editor-team" key={side}>
            <h3>{label}</h3>
            {roster.map((pokemon, index) => <label className="draft-editor-slot" key={`${side}-${index}`}><span>Slot {index + 1}</span><AutocompleteInput ariaLabel={`${label} slot ${index + 1} Pokémon`} value={pokemon} options={["", ...species]} onChange={value => updateDraft(side, index, value)} /></label>)}
          </div>)}
        </div>
        <div className="button-row draft-editor-actions"><button type="button" onClick={() => { const empty = Array.from({ length: 12 }, () => ""); setDraftA(empty); setDraftB(empty); setTeamA(empty); setTeamB(empty); }}>Clear both teams</button><button type="button" onClick={closeEditor}>Close</button></div>
      </section>
    </div>}
  </main>;
}
