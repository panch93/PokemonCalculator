"use client";

import { useEffect, useMemo, useState } from "react";
import { sampleTeamA, sampleTeamB } from "../lib/sample-data";
import { calculateMove } from "../lib/calc";
import { FieldState, Matchup, StatStages, Team } from "../lib/types";
import TeamPastePanel from "./TeamPastePanel";
import MatchupMatrix from "./MatchupMatrix";
import FieldPanel from "./FieldPanel";
import { getLearnsetModeLabel, loadFormatLearnsets } from "../lib/learnsets";
import FormatLegalityPanel from "./FormatLegalityPanel";
import { getAvailableShowdownFormats } from "../lib/format-validation";

const DEFAULT_FIELD: FieldState = {
  weather: "", terrain: "", defenderStealthRock: false, defenderSpikes: 0, defenderReflect: false,
  defenderLightScreen: false, defenderAuroraVeil: false, defenderLeechSeed: false, defenderSaltCure: false,
  trickRoom: false, tailwindSide: "",
};
const ZERO_STAGES = (): StatStages[] => Array.from({ length: 6 }, () => ({ atk: 0, spa: 0, def: 0, spd: 0, spe: 0 }));
const initialMoves = (team: Team) => team.map(p => p.moves.find(Boolean) || "");
const STORAGE_KEY = "pokemon-team-lab-v0.3.0";

type SavedState = { schemaVersion?: number; generation?: number; field?: FieldState; teamA?: Team; teamB?: Team; movesA?: string[]; movesB?: string[]; stagesA?: StatStages[]; stagesB?: StatStages[]; swapped?: boolean; critical?: boolean };

export default function TeamLab() {
  const [left, setLeft] = useState<Team>(sampleTeamA);
  const [right, setRight] = useState<Team>(sampleTeamB);
  const [field, setField] = useState<FieldState>(DEFAULT_FIELD);
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const [swapped, setSwapped] = useState(false);
  const [critical, setCritical] = useState(false);
  const [movesA, setMovesA] = useState<string[]>(() => initialMoves(sampleTeamA));
  const [movesB, setMovesB] = useState<string[]>(() => initialMoves(sampleTeamB));
  const [stagesA, setStagesA] = useState<StatStages[]>(ZERO_STAGES);
  const [stagesB, setStagesB] = useState<StatStages[]>(ZERO_STAGES);
  const [storageReady, setStorageReady] = useState(false);
  const [teamsOpen, setTeamsOpen] = useState(false);
  const [format, setFormat] = useState("Everything!");
  const [mechanics, setMechanics] = useState({ tera: true });
  const [generation, setGeneration] = useState(9);
  const [learnsetStatus, setLearnsetStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setLearnsetStatus("loading");
    loadFormatLearnsets(format).then(() => {
      if (cancelled) return;
      setLearnsetStatus("ready");
      window.dispatchEvent(new Event("ptl-learnsets-refreshed"));
    }).catch(() => { if (!cancelled) setLearnsetStatus("error"); });
    return () => { cancelled = true; };
  }, [format]);

  const refreshTeamLearnsets = async () => {
    setLearnsetStatus("loading");
    try {
      await loadFormatLearnsets(format, true);
      window.dispatchEvent(new Event("ptl-learnsets-refreshed"));
      setLearnsetStatus("ready");
    } catch {
      setLearnsetStatus("error");
    }
  };

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null") as SavedState | null;
      if (saved) {
        // Older releases stored the imported Tera type as already active by default.
        // Migrate those saves so Terastallization starts disabled, while preserving
        // deliberate Tera selections in saves written by this version.
        const resetLegacyTera = saved.schemaVersion !== 2 && saved.schemaVersion !== 3;
        const savedA = normalizeTeam(saved.teamA, resetLegacyTera) || sampleTeamA;
        const savedB = normalizeTeam(saved.teamB, resetLegacyTera) || sampleTeamB;
        setLeft(savedA); setRight(savedB);
        if (typeof saved.generation === "number" && saved.generation >= 1 && saved.generation <= 10) setGeneration(saved.generation);
        if (saved.field) setField({ ...DEFAULT_FIELD, ...saved.field, tailwindSide: saved.field.tailwindSide || "", trickRoom: Boolean(saved.field.trickRoom) });
        if (saved.movesA) setMovesA(reconcileMoves(savedA, saved.movesA));
        else setMovesA(initialMoves(savedA));
        if (saved.movesB) setMovesB(reconcileMoves(savedB, saved.movesB));
        else setMovesB(initialMoves(savedB));
        if (saved.stagesA) setStagesA(normalizeStages(saved.stagesA));
        if (saved.stagesB) setStagesB(normalizeStages(saved.stagesB));
        if (typeof saved.swapped === "boolean") setSwapped(saved.swapped);
        if (typeof saved.critical === "boolean") setCritical(saved.critical);
      }
    } catch { /* Ignore unavailable or invalid browser storage. */ }
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 4, generation, teamA: left, teamB: right, field, movesA, movesB, stagesA, stagesB, swapped, critical }));
    } catch { /* The app still works if storage is disabled or full. */ }
  }, [left, right, field, movesA, movesB, stagesA, stagesB, swapped, critical, generation, storageReady]);

  const matchupsA = useMemo<(Matchup | null)[][]>(() => left.map((attacker, row) => right.map((defender, col) => {
    const moves = attacker.moves.filter(Boolean).slice(0, 4)
      .map(move => calculateMove({ ...(mechanics.tera && generation === 9 ? attacker : { ...attacker, teraType: "" }), alliesFainted: left.filter((p, i) => i !== row && p.dead).length }, { ...(mechanics.tera && generation === 9 ? defender : { ...defender, teraType: "" }), alliesFainted: right.filter((p, i) => i !== col && p.dead).length }, move, field, stagesA[row], stagesB[col], critical, generation))
      .filter((value): value is NonNullable<typeof value> => Boolean(value));
    const selectedMove = movesA[row];
    return { attacker, defender, moves, best: moves.find(m => m.move === selectedMove) || moves[0] };
  })), [left, right, field, stagesA, stagesB, movesA, critical, generation, mechanics.tera]);

  const matchupsB = useMemo<(Matchup | null)[][]>(() => right.map((attacker, row) => left.map((defender, col) => {
    const moves = attacker.moves.filter(Boolean).slice(0, 4)
      .map(move => calculateMove({ ...(mechanics.tera && generation === 9 ? attacker : { ...attacker, teraType: "" }), alliesFainted: right.filter((p, i) => i !== row && p.dead).length }, { ...(mechanics.tera && generation === 9 ? defender : { ...defender, teraType: "" }), alliesFainted: left.filter((p, i) => i !== col && p.dead).length }, move, field, stagesB[row], stagesA[col], critical, generation))
      .filter((value): value is NonNullable<typeof value> => Boolean(value));
    const selectedMove = movesB[row];
    return { attacker, defender, moves, best: moves.find(m => m.move === selectedMove) || moves[0] };
  })), [left, right, field, stagesA, stagesB, movesB, critical, generation, mechanics.tera]);

  const visibleMatchups = swapped ? matchupsB : matchupsA;
  const rowTeam = swapped ? right : left;
  const colTeam = swapped ? left : right;
  const rowMoves = swapped ? movesB : movesA;
  const rowStages = swapped ? stagesB : stagesA;
  const colStages = swapped ? stagesA : stagesB;

  const updatePokemon = (side: "left" | "right", index: number, patch: Partial<Team[number]>) => {
    const update = (previous: Team) => previous.map((pokemon, i) => i === index ? { ...pokemon, ...patch } : pokemon);
    if (side === "left") setLeft(update); else setRight(update);
  };

  const importTeam = (side: "left" | "right", team: Team) => {
    const normalized = team.map(p => ({ ...p, teraType: "", importedTeraType: p.importedTeraType ?? p.teraType ?? "" }));
    while (normalized.length < 6) normalized.push({
      name: `Empty Slot ${normalized.length + 1}`, species: "Pikachu", item: "", ability: "", nature: "Hardy", level: 100,
      teraType: "", importedTeraType: "", evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, moves: ["Thunderbolt", "", "", ""],
    });
    const nextTeam = normalized.slice(0, 6);
    if (side === "left") {
      setLeft(nextTeam); setMovesA(previous => reconcileMoves(nextTeam, previous)); setStagesA(ZERO_STAGES());
    } else {
      setRight(nextTeam); setMovesB(previous => reconcileMoves(nextTeam, previous)); setStagesB(ZERO_STAGES());
    }
  };



  const updateRowMove = (index: number, move: string) => {
    if (swapped) setMovesB(prev => prev.map((value, i) => i === index ? move : value));
    else setMovesA(prev => prev.map((value, i) => i === index ? move : value));
  };
  const updateStage = (index: number, stat: keyof StatStages, value: number, teamSide: "left" | "right") => {
    const updater = (previous: StatStages[]) => previous.map((stage, i) => i === index ? { ...stage, [stat]: value } : stage);
    if (teamSide === "left") setStagesA(updater); else setStagesB(updater);
  };

  // Render the deterministic sample state immediately. Saved browser state is restored
  // after mount; gating the whole app on storageReady could leave the UI stuck on loading
  // if a browser extension or storage implementation interferes with the effect.

  return (
    <main>
      <header className="hero">
        <div><h1>Pokemon Team Lab</h1><p>6v6 matchup analysis powered by the Smogon damage calculator.</p>
          <div className="top-rule-controls"><label>Mechanics Gen <select aria-label="Battle mechanics generation" value={generation} onChange={e => { const next = Number(e.target.value); setGeneration(next); if (next !== 9) setMechanics({ tera: false }); }}>{Array.from({ length: 9 }, (_, i) => i + 1).map(g => <option key={g} value={g}>Gen {g}{g === 1 ? " · RBY" : g === 2 ? " · GSC" : g === 3 ? " · ADV" : g === 4 ? " · DPP" : g === 5 ? " · BW" : g === 6 ? " · XY" : g === 7 ? " · SM" : g === 8 ? " · SS" : " · SV"}</option>)}<option value={10}>Pokémon Champions</option></select></label><label>Format <input list="team-lab-formats" value={format} onChange={e => setFormat(e.target.value)} aria-label="Battle format" /><datalist id="team-lab-formats">{getAvailableShowdownFormats().map(x => <option key={x.id} value={x.label} />)}<option value="Champions NatDex Draft" /></datalist></label>
          <details className="mechanics-menu"><summary>Battle mechanics</summary><div className="mechanics-options"><label><input type="checkbox" checked={mechanics.tera && generation === 9} disabled={generation !== 9} onChange={e => setMechanics({ tera: e.target.checked })} />Terastallization</label><small>Generations 1–9 use their Smogon Calc generation. Champions is listed as a selectable mode, but the installed @smogon/calc 0.12.0 does not include its dedicated engine, so damage currently falls back to Gen 9 mechanics. Terastallization is available only in Gen 9.</small></div></details></div>
        </div>
        <div className="hero-actions"><button type="button" onClick={refreshTeamLearnsets} disabled={learnsetStatus === "loading"}>{learnsetStatus === "loading" ? "Loading learnsets…" : "Refresh team learnsets"}</button><span className={`learnset-status ${learnsetStatus}`} role="status">{learnsetStatus === "loading" ? "Learnsets loading" : learnsetStatus === "ready" ? getLearnsetModeLabel(format) : "Learnsets unavailable"}</span><button onClick={() => setTeamsOpen(true)}>Teams · Import / Export</button></div>
      </header>
      {!format.trim().toLowerCase().replace(/[^a-z0-9]/g, "").includes("everything") && <FormatLegalityPanel teamA={left} teamB={right} format={format} />}
      <div className="workspace workspace-full">
        <FieldPanel value={field} onChange={setField} />
        <MatchupMatrix
          left={rowTeam} right={colTeam} generation={generation} matchups={visibleMatchups} fieldState={field} format={format} selected={selected} swapped={swapped}
          rowMoves={rowMoves} rowStages={rowStages} colStages={colStages} critical={critical} onCriticalChange={setCritical}
          onToggleSwap={() => { setSwapped(value => !value); setSelected(value => value ? ({ row: value.col, col: value.row }) : null); }}
          onSelect={(row, col) => setSelected({ row, col })}
          onMoveChange={updateRowMove}
          onRowStageChange={(index, stat, value) => updateStage(index, stat, value, swapped ? "right" : "left")}
          onColStageChange={(index, stat, value) => updateStage(index, stat, value, swapped ? "left" : "right")}
          onResetStages={() => { setStagesA(ZERO_STAGES()); setStagesB(ZERO_STAGES()); setLeft(previous => previous.map(p => ({ ...p, currentHp: undefined }))); setRight(previous => previous.map(p => ({ ...p, currentHp: undefined }))); }}
          onResetRowStages={index => (swapped ? setStagesB : setStagesA)(prev => prev.map((stage, i) => i === index ? { atk: 0, spa: 0, def: 0, spd: 0, spe: 0 } : stage))}
          onResetColStages={index => (swapped ? setStagesA : setStagesB)(prev => prev.map((stage, i) => i === index ? { atk: 0, spa: 0, def: 0, spd: 0, spe: 0 } : stage))}
          onRowPokemonChange={(index, patch) => updatePokemon(swapped ? "right" : "left", index, patch)}
          onColPokemonChange={(index, patch) => updatePokemon(swapped ? "left" : "right", index, patch)}
        />
      </div>
      <TeamPastePanel left={left} right={right} format={format} open={teamsOpen} onClose={() => setTeamsOpen(false)} onImport={importTeam} onEditTeam={(side, team) => { if (side === "left") { setLeft(team); setMovesA(previous => reconcileMoves(team, previous)); } else { setRight(team); setMovesB(previous => reconcileMoves(team, previous)); } }} />
    </main>
  );
}

function normalizeTeam(value: unknown, resetTera = false): Team | null {
  if (!Array.isArray(value) || value.length !== 6) return null;
  if (!value.every(p => p && typeof p.species === "string" && Array.isArray(p.moves))) return null;
  return value.map(p => ({ ...p, teraType: resetTera ? "" : (p.teraType || ""), importedTeraType: p.importedTeraType ?? p.teraType ?? "", dead: Boolean(p.dead), status: p.status || "" })) as Team;
}

function reconcileMoves(team: Team, previous: string[]) {
  return team.map((pokemon, index) => {
    const available = pokemon.moves.filter(Boolean).slice(0, 4);
    const old = previous[index];
    return old && available.includes(old) ? old : (available[0] || "");
  });
}

function normalizeStages(stages: StatStages[]): StatStages[] {
  return Array.from({ length: 6 }, (_, i) => ({
    atk: clampStage(stages[i]?.atk ?? 0), spa: clampStage(stages[i]?.spa ?? 0), def: clampStage(stages[i]?.def ?? 0), spd: clampStage(stages[i]?.spd ?? 0), spe: clampStage(stages[i]?.spe ?? 0),
  }));
}
function clampStage(value: number) { return Math.max(-6, Math.min(6, Math.round(Number(value) || 0))); }
