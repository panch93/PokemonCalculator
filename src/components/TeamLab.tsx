"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { sampleTeamA, sampleTeamB } from "../lib/sample-data";
import { calculateMove } from "../lib/calc";
import { exportTeam } from "../lib/team-parser";
import { FieldState, Matchup, StatStages, Team } from "../lib/types";
import TeamPastePanel from "./TeamPastePanel";
import TeamColumn from "./TeamColumn";
import MatchupMatrix from "./MatchupMatrix";
import FieldPanel from "./FieldPanel";

const DEFAULT_FIELD: FieldState = {
  weather: "", terrain: "", attackerStealthRock: false, attackerSpikes: 0,
  defenderStealthRock: false, defenderSpikes: 0, defenderReflect: false,
  defenderLightScreen: false, defenderAuroraVeil: false, defenderLeechSeed: false, defenderSaltCure: false,
};
const ZERO_STAGES = (): StatStages[] => Array.from({ length: 6 }, () => ({ atk: 0, def: 0 }));
const initialMoves = (team: Team) => team.map(p => p.moves.find(Boolean) || "");
const STORAGE_KEY = "pokemon-team-lab-v0.3.0";

type SavedState = { teamA?: Team; teamB?: Team; movesA?: string[]; movesB?: string[]; stagesA?: StatStages[]; stagesB?: StatStages[]; swapped?: boolean; critical?: boolean };

export default function TeamLab() {
  const [left, setLeft] = useState<Team>(sampleTeamA);
  const [right, setRight] = useState<Team>(sampleTeamB);
  const [leftSelected, setLeftSelected] = useState(0);
  const [rightSelected, setRightSelected] = useState(0);
  const [field, setField] = useState<FieldState>(DEFAULT_FIELD);
  const [selected, setSelected] = useState({ row: 0, col: 0 });
  const [swapped, setSwapped] = useState(false);
  const [critical, setCritical] = useState(false);
  const [movesA, setMovesA] = useState<string[]>(() => initialMoves(sampleTeamA));
  const [movesB, setMovesB] = useState<string[]>(() => initialMoves(sampleTeamB));
  const [stagesA, setStagesA] = useState<StatStages[]>(ZERO_STAGES);
  const [stagesB, setStagesB] = useState<StatStages[]>(ZERO_STAGES);
  const [storageReady, setStorageReady] = useState(false);
  const deferredField = useDeferredValue(field);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null") as SavedState | null;
      if (saved) {
        const savedA = normalizeTeam(saved.teamA) || sampleTeamA;
        const savedB = normalizeTeam(saved.teamB) || sampleTeamB;
        setLeft(savedA); setRight(savedB);
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
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ teamA: left, teamB: right, movesA, movesB, stagesA, stagesB, swapped, critical }));
    } catch { /* The app still works if storage is disabled or full. */ }
  }, [left, right, movesA, movesB, stagesA, stagesB, swapped, critical, storageReady]);

  const matchupsA = useMemo<(Matchup | null)[][]>(() => left.map((attacker, row) => right.map((defender, col) => {
    const moves = attacker.moves.filter(Boolean).slice(0, 4)
      .map(move => calculateMove(attacker, defender, move, deferredField, stagesA[row], stagesB[col], critical))
      .filter((value): value is NonNullable<typeof value> => Boolean(value));
    const selectedMove = movesA[row];
    return { attacker, defender, moves, best: moves.find(m => m.move === selectedMove) || moves[0] };
  })), [left, right, deferredField, stagesA, stagesB, movesA, critical]);

  const matchupsB = useMemo<(Matchup | null)[][]>(() => right.map((attacker, row) => left.map((defender, col) => {
    const moves = attacker.moves.filter(Boolean).slice(0, 4)
      .map(move => calculateMove(attacker, defender, move, deferredField, stagesB[row], stagesA[col], critical))
      .filter((value): value is NonNullable<typeof value> => Boolean(value));
    const selectedMove = movesB[row];
    return { attacker, defender, moves, best: moves.find(m => m.move === selectedMove) || moves[0] };
  })), [left, right, deferredField, stagesA, stagesB, movesB, critical]);

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
    const normalized = team.map(p => ({ ...p, importedTeraType: p.importedTeraType ?? p.teraType ?? "" }));
    while (normalized.length < 6) normalized.push({
      name: `Empty Slot ${normalized.length + 1}`, species: "Pikachu", item: "", ability: "", nature: "Hardy", level: 100,
      teraType: "", evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, moves: ["Thunderbolt", "", "", ""],
    });
    const nextTeam = normalized.slice(0, 6);
    if (side === "left") {
      setLeft(nextTeam); setMovesA(previous => reconcileMoves(nextTeam, previous)); setStagesA(ZERO_STAGES());
    } else {
      setRight(nextTeam); setMovesB(previous => reconcileMoves(nextTeam, previous)); setStagesB(ZERO_STAGES());
    }
  };

  const downloadTeam = (team: Team, filename: string) => {
    const blob = new Blob([exportTeam(team)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  };

  const updateRowMove = (index: number, move: string) => {
    if (swapped) setMovesB(prev => prev.map((value, i) => i === index ? move : value));
    else setMovesA(prev => prev.map((value, i) => i === index ? move : value));
  };
  const updateStage = (index: number, stat: "atk" | "def", value: number, teamSide: "left" | "right") => {
    const updater = (previous: StatStages[]) => previous.map((stage, i) => i === index ? { ...stage, [stat]: value } : stage);
    if (teamSide === "left") setStagesA(updater); else setStagesB(updater);
  };

  // Render the deterministic sample state immediately. Saved browser state is restored
  // after mount; gating the whole app on storageReady could leave the UI stuck on loading
  // if a browser extension or storage implementation interferes with the effect.

  return (
    <main>
      <header className="hero">
        <div><span className="eyebrow">BATTLE LAB / GEN 9</span><h1>Pokemon Team Lab</h1><p>6v6 matchup analysis powered by the Smogon damage calculator.</p></div>
        <div className="hero-actions"><button onClick={() => downloadTeam(left, "team-a.txt")}>Export A</button><button onClick={() => downloadTeam(right, "team-b.txt")}>Export B</button></div>
      </header>
      <div className="page-grid">
        <aside className="sidebar">
          <TeamColumn title="TEAM A" team={left} selected={leftSelected} onUpdate={(i, patch) => updatePokemon("left", i, patch)} onSelect={i => { setLeftSelected(i); setSelected(swapped ? { row: rightSelected, col: i } : { row: i, col: rightSelected }); }} />
          <TeamColumn title="TEAM B" team={right} selected={rightSelected} onUpdate={(i, patch) => updatePokemon("right", i, patch)} onSelect={i => { setRightSelected(i); setSelected(swapped ? { row: i, col: leftSelected } : { row: leftSelected, col: i }); }} />
        </aside>
        <section className="workspace">
          <TeamPastePanel left={left} right={right} onImport={importTeam} />
          <FieldPanel value={field} onChange={setField} />
          <MatchupMatrix
            left={rowTeam} right={colTeam} matchups={visibleMatchups} selected={selected} swapped={swapped}
            rowMoves={rowMoves} rowStages={rowStages} colStages={colStages} critical={critical} onCriticalChange={setCritical}
            onToggleSwap={() => { setSwapped(value => !value); setSelected(value => ({ row: value.col, col: value.row })); }}
            onSelect={(row, col) => { setSelected({ row, col }); if (swapped) { setRightSelected(row); setLeftSelected(col); } else { setLeftSelected(row); setRightSelected(col); } }}
            onMoveChange={updateRowMove}
            onAttackStageChange={(index, value) => updateStage(index, "atk", value, swapped ? "right" : "left")}
            onDefenseStageChange={(index, value) => updateStage(index, "def", value, swapped ? "left" : "right")}
          />

        </section>
      </div>
    </main>
  );
}

function normalizeTeam(value: unknown): Team | null {
  if (!Array.isArray(value) || value.length !== 6) return null;
  if (!value.every(p => p && typeof p.species === "string" && Array.isArray(p.moves))) return null;
  return value.map(p => ({ ...p, teraType: p.teraType || "", importedTeraType: p.importedTeraType ?? p.teraType ?? "", dead: Boolean(p.dead) })) as Team;
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
    atk: clampStage(stages[i]?.atk ?? 0), def: clampStage(stages[i]?.def ?? 0),
  }));
}
function clampStage(value: number) { return Math.max(-6, Math.min(6, Math.round(Number(value) || 0))); }
