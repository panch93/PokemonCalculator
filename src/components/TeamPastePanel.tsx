"use client";

import { useEffect, useMemo, useState } from "react";
import { exportTeam, extractPokepasteHtmlText, getPokepasteHtmlUrl, parseTeamPaste } from "../lib/team-parser";
import { PokemonSet, Stats, Team } from "../lib/types";
import AutocompleteInput from "./AutocompleteInput";
import { getSpeciesLearnset } from "../lib/learnsets";
import { getItemList, getMoveList, getSpecies, getSpeciesAbilities, getSpeciesList } from "../lib/showdown-data";
import { getNatureEffectsByDisplayStat } from "../lib/showdown-data";
import { isEverythingFormat } from "../lib/format-normalization";

type Side = "left" | "right";
type Props = {
  left: Team; right: Team; format: string; open: boolean; onClose: () => void;
  onImport: (side: Side, team: Team) => void;
  onEditTeam: (side: Side, team: Team) => void;
};
type RawSet = Record<string, unknown>;
type SetDatabase = Record<string, Record<string, RawSet>>;
const FORMATS = [
  { value: "gen9ou", label: "Gen 9 OU" }, { value: "gen9uu", label: "Gen 9 UU" },
  { value: "gen9ubers", label: "Gen 9 Ubers" }, { value: "gen9ru", label: "Gen 9 RU" },
  { value: "gen9nu", label: "Gen 9 NU" }, { value: "gen9pu", label: "Gen 9 PU" },
  { value: "gen9monotype", label: "Gen 9 Monotype" }, { value: "gen9doublesou", label: "Gen 9 Doubles OU" },
];
const DEFAULT_STATS: Stats = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
const STAT_KEYS: Record<string, keyof Stats> = { hp: "hp", atk: "atk", def: "def", spa: "spa", spd: "spd", spe: "spe" };
const cleanId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const firstValue = (value: unknown): string => {
  if (Array.isArray(value)) return value.length ? firstValue(value[0]) : "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "";
};
function parsePresetStats(value: unknown, defaults: Stats): Stats {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...defaults };
  const output = { ...defaults };
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const stat = STAT_KEYS[key.toLowerCase()];
    if (stat && Number.isFinite(Number(raw))) output[stat] = Math.max(0, Math.min(252, Number(raw)));
  }
  return output;
}
function blankTeamSlot(index: number): PokemonSet {
  return { name: "Pikachu", species: "Pikachu", item: "", ability: "", nature: "Hardy", level: 100, teraType: "", importedTeraType: "", evs: { ...DEFAULT_STATS }, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, moves: ["", "", "", ""] };
}
function paddedTeam(team: Team): Team {
  const output = team.slice(0, 6).map(p => ({ ...p, evs: { ...DEFAULT_STATS, ...p.evs }, ivs: { ...p.ivs, hp: p.ivs?.hp ?? 31, atk: p.ivs?.atk ?? 31, def: p.ivs?.def ?? 31, spa: p.ivs?.spa ?? 31, spd: p.ivs?.spd ?? 31, spe: p.ivs?.spe ?? 31 }, moves: [...p.moves, "", "", "", ""].slice(0, 4) }));
  while (output.length < 6) output.push(blankTeamSlot(output.length));
  return output;
}
function applyPreset(pokemon: PokemonSet, preset: RawSet): PokemonSet {
  const movesValue = preset.Moves ?? preset.moves;
  const moves = (Array.isArray(movesValue) ? movesValue : movesValue ? [movesValue] : [])
    .map(firstValue).filter(Boolean).slice(0, 4);
  while (moves.length < 4) moves.push("");
  const tera = firstValue(preset["Tera Type"] ?? preset.teraType ?? preset.tera);
  return {
    ...pokemon,
    item: firstValue(preset.Item ?? preset.item) || pokemon.item,
    ability: firstValue(preset.Ability ?? preset.ability) || pokemon.ability,
    nature: firstValue(preset.Nature ?? preset.nature) || pokemon.nature,
    level: Number(preset.Level ?? preset.level) || pokemon.level || 100,
    evs: parsePresetStats(preset.EVs ?? preset.evs, DEFAULT_STATS),
    ivs: parsePresetStats(preset.IVs ?? preset.ivs, { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }),
    moves,
    ...(tera ? { importedTeraType: tera, teraType: "" } : {}),
  };
}

export default function TeamPastePanel({ left, right, format, open, onClose, onImport, onEditTeam }: Props) {
  const [mode, setMode] = useState<"builder" | "paste">("builder");
  const [textA, setTextA] = useState("");
  const [textB, setTextB] = useState("");
  const [builderA, setBuilderA] = useState<Team>(() => paddedTeam(left));
  const [builderB, setBuilderB] = useState<Team>(() => paddedTeam(right));
  const [setDatabase, setSetDatabase] = useState<SetDatabase | null>(null);
  const [setStatus, setSetStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [selectedPresets, setSelectedPresets] = useState<Record<string, string>>({});
  const [learnsetsBySpecies, setLearnsetsBySpecies] = useState<Record<string, Set<string> | null>>({});
  const [learnsetRevision, setLearnsetRevision] = useState(0);
  const NATURE_EFFECTS = getNatureEffectsByDisplayStat();
  const isChampionsFormat = /champions/i.test(format);
  const NATURES = Object.keys(NATURE_EFFECTS);

  useEffect(() => {
    const refresh = () => setLearnsetRevision(value => value + 1);
    window.addEventListener("ptl-learnsets-refreshed", refresh);
    return () => window.removeEventListener("ptl-learnsets-refreshed", refresh);
  }, []);

  useEffect(() => {
    if (open) {
      setTextA(exportTeam(left)); setTextB(exportTeam(right));
      setBuilderA(paddedTeam(left)); setBuilderB(paddedTeam(right));
    }
    // Load the current teams only when the modal opens, not after each field edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || mode !== "builder") return;
    const controller = new AbortController();
    setSetStatus("loading"); setSetDatabase(null);
    Promise.all(FORMATS.map(async format => {
      const response = await fetch(`https://pkmn.github.io/smogon/data/sets/${format.value}.json`, { signal: controller.signal });
      if (!response.ok) throw new Error(`Preset data returned ${response.status}`);
      return { format, data: await response.json() as SetDatabase };
    })).then(results => {
      if (controller.signal.aborted) return;
      const merged: SetDatabase = {};
      for (const { format, data } of results) for (const [species, sets] of Object.entries(data)) {
        merged[species] ||= {};
        for (const [setName, set] of Object.entries(sets || {})) merged[species][`${format.label} · ${setName}`] = set;
      }
      setSetDatabase(merged); setSetStatus("ready");
    }).catch(() => { if (!controller.signal.aborted) { setSetStatus("error"); setSetDatabase(null); } });
    return () => controller.abort();
  }, [open, mode]);

  useEffect(() => {
    if (!open || mode !== "builder") return;
    let cancelled = false;
    const species = [...new Set([...builderA, ...builderB].filter(p => !/^Empty Slot/.test(p.name) && p.species).map(p => p.species))];
    Promise.all(species.map(async name => [cleanId(name), await getSpeciesLearnset(name, format)] as const)).then(entries => {
      if (!cancelled) setLearnsetsBySpecies(previous => ({ ...previous, ...Object.fromEntries(entries) }));
    }).catch(() => { /* keep autocomplete usable if learnset data cannot load */ });
    return () => { cancelled = true; };
  }, [open, mode, builderA, builderB, format, learnsetRevision]);

  const dexOptions = useMemo(() => {
    const species = getSpeciesList();
    return {
      species: species.length ? species : [...new Set([...left, ...right].map(p => p.species).filter(Boolean))].sort(),
      moves: getMoveList(),
      items: getItemList(),
    };
  }, [left, right, learnsetRevision]);
  const speciesOptions = dexOptions.species;
  const legalMovesFor = (species: string) => {
    const learnset = learnsetsBySpecies[cleanId(species)];
    if (!learnset) return dexOptions.moves;
    return dexOptions.moves.filter(move => learnset.has(cleanId(move)));
  };
  const moveIsLegal = (species: string, move: string) => {
    if (!move) return true;
    const learnset = learnsetsBySpecies[cleanId(species)];
    return !learnset || learnset.has(cleanId(move));
  };
  const abilitiesForSpecies = (species: string): string[] => getSpeciesAbilities(species);

  const getPresets = (pokemon: PokemonSet): [string, RawSet][] => {
    if (!setDatabase) return [];
    const speciesEntry = Object.entries(setDatabase).find(([name]) => cleanId(name) === cleanId(pokemon.species) || cleanId(name) === cleanId(pokemon.name));
    if (!speciesEntry || !speciesEntry[1] || typeof speciesEntry[1] !== "object") return [];
    return Object.entries(speciesEntry[1]).filter((entry): entry is [string, RawSet] => Boolean(entry[1]) && typeof entry[1] === "object");
  };

  const updateBuilderPokemon = (side: Side, index: number, patch: Partial<PokemonSet>) => {
    const current = side === "left" ? builderA : builderB;
    const next = current.map((pokemon, i) => i === index ? { ...pokemon, ...patch } : pokemon);
    if (side === "left") setBuilderA(next); else setBuilderB(next);
    onEditTeam(side, next);
  };
  const changeSpecies = (side: Side, index: number, species: string) => {
    const current = side === "left" ? builderA : builderB;
    const old = current[index];
    const nextName = species.trim() || old.species;
    setSelectedPresets(previous => { const next = { ...previous }; delete next[`${side}-${index}`]; return next; });
    updateBuilderPokemon(side, index, { species: nextName, name: nextName, ability: "", item: "", moves: ["", "", "", ""], nature: "Hardy", evs: { ...DEFAULT_STATS }, teraType: "", importedTeraType: "" });
  };
  const updateStat = (side: Side, index: number, stat: keyof Stats, value: string, kind: "evs" | "ivs") => {
    const team = side === "left" ? builderA : builderB;
    const pokemon = team[index];
    const max = kind === "evs" ? (isChampionsFormat ? 32 : 252) : 31;
    updateBuilderPokemon(side, index, { [kind]: { ...pokemon[kind], [stat]: Math.max(0, Math.min(max, Number(value) || 0)) } } as Partial<PokemonSet>);
  };
  const download = (side: Side) => {
    const text = exportTeam(side === "left" ? left : right);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = side === "left" ? "team-a.txt" : "team-b.txt"; anchor.click(); URL.revokeObjectURL(url);
  };
  const [pasteError, setPasteError] = useState("");
  const [pasteLoading, setPasteLoading] = useState(false);
  const importNow = async (side: Side) => {
    const current = (side === "left" ? textA : textB).trim();
    setPasteError("");
    let text = current;
    const pasteUrl = getPokepasteHtmlUrl(current);
    if (pasteUrl) {
      setPasteLoading(true);
      try {
        // Fetch the actual Poképaste HTML page through public CORS relays, then
        // extract the embedded copyable team. Direct cross-origin fetches often
        // fail in static-hosted browser apps due to Poképaste's CORS policy.
        const endpoints = [
          `https://api.allorigins.win/raw?url=${encodeURIComponent(pasteUrl)}`,
          `https://corsproxy.io/?url=${encodeURIComponent(pasteUrl)}`,
          `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(pasteUrl)}`,
        ];
        const failures: string[] = [];
        let loadedText = "";
        for (const endpoint of endpoints) {
          try {
            const response = await fetch(endpoint);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const html = await response.text();
            const extracted = extractPokepasteHtmlText(html);
            if (!extracted || !parseTeamPaste(extracted).length) {
              throw new Error("HTML response did not contain a readable Pokémon team");
            }
            loadedText = extracted;
            break;
          } catch (error) {
            failures.push(error instanceof Error ? error.message : String(error));
          }
        }
        if (!loadedText) {
          throw new Error(`Could not read the paste page HTML (${failures.join("; ")}). CORS relays may be blocked or unavailable; paste the Showdown text directly instead.`);
        }
        text = loadedText;
        if (side === "left") setTextA(text); else setTextB(text);
      } catch (error) {
        setPasteError(`Could not load Poképaste: ${error instanceof Error ? error.message : String(error)}`);
        setPasteLoading(false);
        return;
      }
      setPasteLoading(false);
    }
    const parsed = parseTeamPaste(text);
    if (parsed.length) onImport(side, parsed);
    else setPasteError("No Pokémon were found in that paste.");
  };
  if (!open) return null;

  const renderBuilderTeam = (side: Side, team: Team) => <section className="team-editor builder-team">
    <div className="team-editor-heading"><h3>{side === "left" ? "Team A" : "Team B"}</h3><div className="builder-team-actions"><button onClick={() => download(side)}>Export team</button><button onClick={() => navigator.clipboard?.writeText(exportTeam(side === "left" ? builderA : builderB))}>Copy Showdown paste</button></div></div>
    {team.map((pokemon, index) => {
      const presets = getPresets(pokemon);
      const presetKey = `${side}-${index}`;
      return <article className="builder-pokemon" key={`${side}-${index}`}>
        <div className="builder-pokemon-heading"><strong>{index + 1}. {pokemon.species}</strong><select aria-label={`${pokemon.species} meta set`} value={selectedPresets[presetKey] || ""} disabled={!presets.length} onChange={event => {
          const key = event.target.value; setSelectedPresets(previous => ({ ...previous, [presetKey]: key }));
          const chosen = presets.find(([name]) => name === key)?.[1]; if (chosen) updateBuilderPokemon(side, index, applyPreset(pokemon, chosen));
        }}><option value="">{setStatus === "loading" ? "Loading meta sets…" : presets.length ? "Choose meta set…" : "No preset available"}</option>{presets.map(([name]) => <option key={name} value={name}>{name}</option>)}</select></div>
        <div className="builder-fields">
          <label>Species<AutocompleteInput ariaLabel={`${pokemon.name} species`} options={speciesOptions} value={pokemon.species} onChange={value => changeSpecies(side, index, value)} /></label>
          <label>Item<AutocompleteInput ariaLabel={`${pokemon.species} item`} options={dexOptions.items} value={pokemon.item} onChange={value => updateBuilderPokemon(side, index, { item: value })} /></label>
          <label>Ability<AutocompleteInput ariaLabel={`${pokemon.species} ability`} options={abilitiesForSpecies(pokemon.species)} value={pokemon.ability} onChange={value => updateBuilderPokemon(side, index, { ability: value })} /></label>
          <label>Nature<select value={pokemon.nature} onChange={event => updateBuilderPokemon(side, index, { nature: event.target.value })}>{NATURES.map(n => { const effect = NATURE_EFFECTS[n]; return <option key={n} value={n}>{n}{effect.plus && effect.minus ? ` (+${effect.plus}, −${effect.minus})` : " (neutral)"}</option>; })}</select></label>
          <label>Level<input type="number" min="1" max="100" value={pokemon.level} onChange={event => updateBuilderPokemon(side, index, { level: Math.max(1, Math.min(100, Number(event.target.value) || 100)) })} /></label>
          <label>Tera Type<select aria-label={`${pokemon.species} Tera type`} value={pokemon.importedTeraType || ""} onChange={event => updateBuilderPokemon(side, index, { importedTeraType: event.target.value, teraType: "" })}><option value="">None</option>{["Normal","Fire","Water","Electric","Grass","Ice","Fighting","Poison","Ground","Flying","Psychic","Bug","Rock","Ghost","Dragon","Dark","Steel","Fairy","Stellar"].map(type => <option key={type} value={type}>{type}</option>)}</select></label>
        </div>
        <div className="builder-moves">{[0,1,2,3].map(moveIndex => <label key={moveIndex}>Move {moveIndex + 1}<AutocompleteInput ariaLabel={`${pokemon.species} move ${moveIndex + 1}`} options={legalMovesFor(pokemon.species)} value={pokemon.moves[moveIndex] || ""} onChange={value => { const moves = [...pokemon.moves]; moves[moveIndex] = value; updateBuilderPokemon(side, index, { moves }); }} />{pokemon.moves[moveIndex] && !isEverythingFormat(format) && !moveIsLegal(pokemon.species, pokemon.moves[moveIndex]) && <span className="move-illegal-indicator" title={`Move is not in ${pokemon.species} species learnset; check the Format legality report for format rules`}>Learnset?</span>}</label>)}</div>
        <div className="builder-evs-heading"><strong>{isChampionsFormat ? "Stat Points" : "EVs"}</strong>{(() => { const limit = isChampionsFormat ? 66 : 510; const remaining = limit - Object.values(pokemon.evs).reduce((sum, value) => sum + value, 0); return <span className={remaining < 0 ? "evs-remaining-over" : ""}>Remaining: {remaining}</span>; })()}</div>
        <div className="builder-evs">{([ ["HP","hp"],["Atk","atk"],["Def","def"],["SpA","spa"],["SpD","spd"],["Spe","spe"] ] as const).map(([label, stat]) => <label key={stat} className={NATURE_EFFECTS[pokemon.nature]?.plus === label ? "nature-boost-label" : NATURE_EFFECTS[pokemon.nature]?.minus === label ? "nature-hinder-label" : ""}>{label}<input aria-label={`${pokemon.species} ${label} ${isChampionsFormat ? "Stat Points" : "EVs"}`} type="number" min="0" max={isChampionsFormat ? 32 : 252} step={isChampionsFormat ? 1 : 4} value={pokemon.evs[stat]} onChange={event => updateStat(side, index, stat, event.target.value, "evs")} /></label>)}</div>
        <div className="builder-final-stats"><strong>Final stats</strong>{(() => { const entry = getSpecies(pokemon.species); const base = entry?.baseStats || {}; const nature = NATURE_EFFECTS[pokemon.nature] || {}; const labels: Record<string, string> = { hp: "HP", atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe" }; return (["hp","atk","def","spa","spd","spe"] as const).map(stat => { const b = Number(base[stat] || 1), iv = Number(pokemon.ivs?.[stat] ?? 31), ev = Number(pokemon.evs[stat] || 0); const core = isChampionsFormat ? Math.floor((2*b + 31 + Math.max(2*ev - 1, 0))*pokemon.level/100) : Math.floor((2*b + iv + Math.floor(ev/4))*pokemon.level/100); const value = isChampionsFormat ? (stat === "hp" ? (cleanId(pokemon.species) === "shedinja" ? 1 : core + pokemon.level + 10) : Math.floor((core + 5) * (nature.plus === labels[stat] ? 1.1 : nature.minus === labels[stat] ? 0.9 : 1))) : (stat === "hp" ? (cleanId(pokemon.species) === "shedinja" ? 1 : core + pokemon.level + 10) : Math.floor((core + 5) * (nature.plus === labels[stat] ? 1.1 : nature.minus === labels[stat] ? 0.9 : 1))); return <span key={stat} className={nature.plus === labels[stat] ? "nature-boost-label" : nature.minus === labels[stat] ? "nature-hinder-label" : ""}>{labels[stat]} <b>{value}</b></span>; }); })()}</div>
      </article>;
    })}
  </section>;

  return <div className="teams-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="teams-modal panel" role="dialog" aria-modal="true" aria-labelledby="teams-modal-title">
      <div className="panel-title-row"><div><h2 id="teams-modal-title">Teams · Teambuilder / Paste</h2><p>Format: {format}. Moves are checked against the species learnset; custom-format bans may require additional rules data.</p></div><button onClick={onClose} aria-label="Close teams">Close ×</button></div>
      <div className="builder-toolbar"><div className="mode-toggle" role="group" aria-label="Team editing mode"><button className={mode === "builder" ? "active" : ""} onClick={() => setMode("builder")}>Teambuilder</button><button className={mode === "paste" ? "active" : ""} onClick={() => setMode("paste")}>Paste</button></div><small className="preset-status">{mode === "builder" ? setStatus === "loading" ? "Loading Smogon sets…" : setStatus === "error" ? "Smogon set data unavailable; manual editing still works." : "Presets from Smogon usage sets" : "Standard Showdown team paste format"}</small></div>
      {pasteError && <p role="alert" className="paste-error">{pasteError}</p>}
      {mode === "builder" ? <><div className="teams-two-column">{renderBuilderTeam("left", builderA)}{renderBuilderTeam("right", builderB)}</div></> : <div className="teams-two-column">
        <section className="team-editor"><div className="team-editor-heading"><h3>Team A</h3><span>{left.length}/6 Pokémon</span></div><textarea aria-label="Team A Showdown text" value={textA} onChange={e => setTextA(e.target.value)} spellCheck={false}/><div className="button-row"><button className="primary" disabled={pasteLoading} onClick={() => void importNow("left")}>{pasteLoading ? "Loading paste…" : "Import Team A"}</button><button onClick={() => download("left")}>Export Team A</button><button onClick={() => navigator.clipboard?.writeText(exportTeam(left))}>Copy current</button></div></section>
        <section className="team-editor"><div className="team-editor-heading"><h3>Team B</h3><span>{right.length}/6 Pokémon</span></div><textarea aria-label="Team B Showdown text" value={textB} onChange={e => setTextB(e.target.value)} spellCheck={false}/><div className="button-row"><button className="primary" disabled={pasteLoading} onClick={() => void importNow("right")}>{pasteLoading ? "Loading paste…" : "Import Team B"}</button><button onClick={() => download("right")}>Export Team B</button><button onClick={() => navigator.clipboard?.writeText(exportTeam(right))}>Copy current</button></div></section>
      </div>}
    </section>
  </div>;
}
