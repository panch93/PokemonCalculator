"use client";

import { useMemo, useState } from "react";
import { getAbility, getSpecies, getSpeciesAbilities, getSpeciesList } from "../lib/showdown-data";
import { POKEMON_TYPES } from "../lib/pokemon-visuals";
import { TypeChart } from "../lib/showdown-official/data/typechart";

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
  const [teamA, setTeamA] = useState<string[]>(() => normalizeTeam(PRESETS[0].teamA));
  const [teamB, setTeamB] = useState<string[]>(() => normalizeTeam(PRESETS[0].teamB));
  const [editorOpen, setEditorOpen] = useState(false);
  const [draftA, setDraftA] = useState<string[]>(teamA);
  const [draftB, setDraftB] = useState<string[]>(teamB);

  const setPreset = (index: number) => {
    const selected = PRESETS[index];
    setPresetIndex(index);
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
  const lastRow = Math.max(teamA.reduce((last, value, index) => value ? index : last, -1), teamB.reduce((last, value, index) => value ? index : last, -1));
  const updateDraft = (side: "A" | "B", index: number, value: string) => {
    const update = side === "A" ? setDraftA : setDraftB;
    update(current => current.map((name, i) => i === index ? value : name));
  };

  return <main className="draft-page">
    <header className="hero draft-hero">
      <div><span className="eyebrow">Pokemon Team Lab</span><h1>Draft Matchups</h1><p>Compare up to 12 Pokémon on each side, base Speed, abilities, and defensive type matchups.</p></div>
      <div className="hero-actions"><a className="nav-link" href="/">Back to Team Lab</a></div>
    </header>

    <section className="panel draft-controls">
      <div className="draft-preset-control"><label htmlFor="draft-preset">Matchup preset</label><select id="draft-preset" value={presetIndex} onChange={event => setPreset(Number(event.target.value))}>{PRESETS.map((preset, index) => <option key={preset.label} value={index}>{index + 1}. {preset.label}</option>)}</select></div>
      <div className="draft-team-counts"><span>Team A: <strong>{activeA.length}/12</strong></span><span>Team B: <strong>{activeB.length}/12</strong></span></div>
      <button className="primary" type="button" onClick={openEditor}>Edit matchup</button>
    </section>

    <section className="panel">
      <div className="panel-title-row"><div><h2>{PRESETS[presetIndex].label}</h2><p>Base Speed uses each Pokémon's base stat, not its trained in-battle Speed.</p></div></div>
      <div className="matrix-scroll draft-table-scroll"><table className="draft-matchup-table">
        <thead><tr><th>Types A</th><th>Abilities A</th><th>Pokémon Team A</th><th>Speed A</th><th>Speed B</th><th>Pokémon Team B</th><th>Abilities B</th><th>Types B</th></tr></thead>
        <tbody>{Array.from({ length: Math.max(0, lastRow + 1) }, (_, index) => {
          const a = teamA[index] || "";
          const b = teamB[index] || "";
          const abilitiesA = a ? getSpeciesAbilities(a) : [];
          const abilitiesB = b ? getSpeciesAbilities(b) : [];
          return <tr key={index}>
            <td>{a && <div className="draft-type-pills">{speciesTypes(a).map(type => <span key={type} className={typeClass(type)}>{type}</span>)}</div>}</td>
            <td><div className="draft-abilities">{abilitiesA.map(ability => <span key={ability} className="draft-ability" title={getAbility(ability)?.desc || getAbility(ability)?.shortDesc || "No ability description available."}>{ability}</span>)}</div></td>
            <td className="draft-pokemon-name">{a || <span className="muted">—</span>}</td>
            <td className="draft-speed">{a ? baseSpeed(a) ?? "—" : "—"}</td>
            <td className="draft-speed">{b ? baseSpeed(b) ?? "—" : "—"}</td>
            <td className="draft-pokemon-name">{b || <span className="muted">—</span>}</td>
            <td><div className="draft-abilities">{abilitiesB.map(ability => <span key={ability} className="draft-ability" title={getAbility(ability)?.desc || getAbility(ability)?.shortDesc || "No ability description available."}>{ability}</span>)}</div></td>
            <td><div className="draft-type-pills">{b && speciesTypes(b).map(type => <span key={type} className={typeClass(type)}>{type}</span>)}</div></td>
          </tr>;
        })}</tbody>
      </table></div>
      {lastRow < 0 && <p className="muted">Choose Pokémon with “Edit matchup” to populate the table.</p>}
    </section>

    <section className="panel">
      <div className="panel-title-row"><div><h2>Defensive type effectiveness</h2><p>Each cell shows the multiplier for an attacking type against that Pokémon's current defensive typing.</p></div></div>
      <div className="draft-typecharts">
        {([{ name: "Team A", roster: teamA }, { name: "Team B", roster: teamB }] as const).map(({ name, roster }) => {
          const occupied = roster.map((pokemon, index) => ({ pokemon, index })).filter(item => item.pokemon);
          return <div className="draft-typechart" key={name}>
            <h3>{name}</h3>
            <div className="matrix-scroll"><table className="draft-typechart-table">
              <thead><tr><th>Attack type</th>{occupied.map(({ pokemon, index }) => <th key={`${index}-${pokemon}`} title={`Slot ${index + 1}: ${pokemon}`}>{index + 1}. {pokemon}</th>)}</tr></thead>
              <tbody>{POKEMON_TYPES.map(attackType => <tr key={attackType}><th><span className={typeClass(attackType)}>{attackType}</span></th>{occupied.map(({ pokemon, index }) => {
                const value = multiplier(pokemon, attackType);
                return <td key={`${index}-${pokemon}`} className={`type-multiplier ${value < 1 ? "resist" : value > 1 ? "weak" : value === 0 ? "immune" : "neutral"}`}>{multiplierLabel(value)}</td>;
              })}</tr>)}</tbody>
            </table></div>
          </div>;
        })}
      </div>
      <p className="muted">×0.5 and ×0.25 indicate resistances; ×2 and ×4 indicate weaknesses; ×0 indicates immunity.</p>
    </section>

    {editorOpen && <div className="draft-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setEditorOpen(false); }}>
      <section className="draft-modal" role="dialog" aria-modal="true" aria-labelledby="draft-editor-title">
        <div className="panel-title-row"><div><h2 id="draft-editor-title">Edit matchup Pokémon</h2><p>Use an empty slot to reduce either roster below 12 Pokémon.</p></div><button type="button" onClick={() => setEditorOpen(false)} aria-label="Close editor">×</button></div>
        <div className="draft-editor-teams">
          {[{ label: "Team A", side: "A" as const, roster: draftA }, { label: "Team B", side: "B" as const, roster: draftB }].map(({ label, side, roster }) => <div className="draft-editor-team" key={side}>
            <h3>{label}</h3>
            {roster.map((pokemon, index) => <label className="draft-editor-slot" key={`${side}-${index}`}><span>Slot {index + 1}</span><select value={pokemon} onChange={event => updateDraft(side, index, event.target.value)}><option value="">— Empty slot —</option>{species.map(name => <option key={name} value={name}>{name}</option>)}</select></label>)}
          </div>)}
        </div>
        <div className="button-row draft-editor-actions"><button type="button" onClick={() => { setDraftA(Array.from({ length: 12 }, () => "")); setDraftB(Array.from({ length: 12 }, () => "")); }}>Clear both teams</button><button type="button" onClick={() => setEditorOpen(false)}>Cancel</button><button className="primary" type="button" onClick={saveEditor}>Save matchup</button></div>
      </section>
    </div>}
  </main>;
}
