"use client";

import Link from "next/link";

import { useEffect, useMemo, useRef, useState } from "react";
import { sampleTeamA, sampleTeamB } from "../lib/sample-data";
import { calculateMove } from "../lib/calc";
import { FieldState, getMaxIVs, Matchup, StatStages, Team, type StatId } from "../lib/types";
import TeamPastePanel from "./TeamPastePanel";
import MatchupMatrix from "./MatchupMatrix";
import FieldPanel from "./FieldPanel";
import { getLearnsetModeLabel, loadFormatLearnsets } from "../lib/learnsets";
import FormatLegalityPanel from "./FormatLegalityPanel";
import FormatSelector from "./FormatSelector";
import { getNature, getSpecies, getSpeciesAbilities, getMoveList } from "../lib/showdown-data";
import { analyzeDraftPokemon, getDraftProfileEffectiveSpeed, DEFAULT_DRAFT_MOVE_FILTER, type DraftMatchupAnalysis, type DraftPokemonProfile, type DraftMoveFilter } from "../lib/draft-matchup-analysis";
import DraftMoveFilterModal from "./DraftMoveFilterModal";
import PokemonSprite from "./PokemonSprite";
import ItemSprite from "./ItemSprite";
import { getSmogonPresetItemCandidatesForSpecies } from "../lib/smogon-presets";

const DEFAULT_FIELD: FieldState = {
  gameType: "Singles", weather: "", terrain: "", defenderStealthRock: false, defenderSpikes: 0, defenderReflect: false,
  defenderLightScreen: false, defenderAuroraVeil: false, defenderLeechSeed: false, defenderSaltCure: false,
  trickRoom: false, tailwindSide: "", protectSide: "", nightmareSide: "", foresightSide: "", chargeSide: "", helpingHandSide: "", flowerGiftSide: "", powerTrickSide: "", steelySpiritSide: "", friendGuardSide: "", batterySide: "", powerSpotSide: "", switchingOutSide: "",
};
const ZERO_STAGES = (): StatStages[] => Array.from({ length: 6 }, () => ({ atk: 0, spa: 0, def: 0, spd: 0, spe: 0, acc: 0, eva: 0 }));
const initialMoves = (team: Team) => team.map(p => p.moves.find(Boolean) || "");
const STORAGE_KEY = "pokemon-team-lab-v0.3.0";

type SavedState = { schemaVersion?: number; generation?: number; overallNotes?: string; field?: FieldState; teamA?: Team; teamB?: Team; movesA?: string[]; movesB?: string[]; stagesA?: StatStages[]; stagesB?: StatStages[]; swapped?: boolean; critical?: boolean };
type TeamAnalysisRun = { side: "left" | "right"; species: string; scenario: string; profile: DraftPokemonProfile; analysis: DraftMatchupAnalysis; opponentScenarios: Array<{ species: string; scenario: string }>; opponentProfiles: DraftPokemonProfile[] };
const setupRequiredDeaths = (setup: DraftMatchupAnalysis["setupSweeps"][number]) => setup.targets.filter(target => !target.plausibleSweepTarget && !target.wouldSweepIfReached && !target.removedBySetup);
const showableSetup = (setup: DraftMatchupAnalysis["setupSweeps"][number]) => setupRequiredDeaths(setup).length <= 1;
const winningSetupWithOneRemoval = (setup: DraftMatchupAnalysis["setupSweeps"][number]) => {
  const requiredDeaths = setupRequiredDeaths(setup);
  return requiredDeaths.length <= 1 && setup.targets.length > 0 && setup.targets.every(target => requiredDeaths.includes(target) || target.plausibleSweepTarget || target.wouldSweepIfReached || target.removedBySetup);
};

export default function TeamLab() {
  const [left, setLeft] = useState<Team>(sampleTeamA);
  const [right, setRight] = useState<Team>(sampleTeamB);
  const [field, setField] = useState<FieldState>(DEFAULT_FIELD);
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const [swapped, setSwapped] = useState(false);
  const [critical, setCritical] = useState(false);
  const [overallNotes, setOverallNotes] = useState("");
  const [movesA, setMovesA] = useState<string[]>(() => initialMoves(sampleTeamA));
  const [movesB, setMovesB] = useState<string[]>(() => initialMoves(sampleTeamB));
  const [stagesA, setStagesA] = useState<StatStages[]>(ZERO_STAGES);
  const [stagesB, setStagesB] = useState<StatStages[]>(ZERO_STAGES);
  const [storageReady, setStorageReady] = useState(false);
  const [teamsOpen, setTeamsOpen] = useState(false);
  const [draftPickerOpen, setDraftPickerOpen] = useState(false);
  const [draftOptions, setDraftOptions] = useState<Array<{ id: string; name: string; teamA: string[]; teamB: string[]; draftSets?: Record<string, { item?: string; ability?: string; moves?: string[] }>; abilityOverrides?: Record<string, string>; speedConfigs?: Record<string, { ev: number; nature: "boost" | "neutral" | "hinder" }>; statConfigs?: Record<string, { ev: number; nature: "boost" | "neutral" | "hinder" }> }>>([]);
  const [draftChoice, setDraftChoice] = useState("0");
  const [draftSelectedA, setDraftSelectedA] = useState<string[]>([]);
  const [draftSelectedB, setDraftSelectedB] = useState<string[]>([]);
  const [format, setFormat] = useState("Everything!");
  const [mechanics, setMechanics] = useState({ tera: true });
  const [generation, setGeneration] = useState(9);
  const [learnsetStatus, setLearnsetStatus] = useState<"loading" | "ready" | "error">("loading");
  const [teamAnalysisOpen, setTeamAnalysisOpen] = useState(false);
  const [teamAnalysisLoading, setTeamAnalysisLoading] = useState(false);
  const [teamAnalysisRuns, setTeamAnalysisRuns] = useState<TeamAnalysisRun[]>([]);
  const [teamAnalysisError, setTeamAnalysisError] = useState("");
  const [teamAnalysisProgress, setTeamAnalysisProgress] = useState("");
  const [teamAnalysisCurrentPokemon, setTeamAnalysisCurrentPokemon] = useState("");
  const [teamAnalysisFilterOpen, setTeamAnalysisFilterOpen] = useState(false);
  const [teamAnalysisFilter, setTeamAnalysisFilter] = useState<DraftMoveFilter>(DEFAULT_DRAFT_MOVE_FILTER);
  const [teamAnalysisMoveNames, setTeamAnalysisMoveNames] = useState<string[]>([]);
  const [selectedAnalysisPokemon, setSelectedAnalysisPokemon] = useState<{ side: "left" | "right"; species: string } | null>(null);
  const [selectedAnalysisItem, setSelectedAnalysisItem] = useState<string>("");
  const teamAnalysisToken = useRef(0);

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
        const resetLegacyTera = saved.schemaVersion !== 2 && saved.schemaVersion !== 3 && saved.schemaVersion !== 4 && saved.schemaVersion !== 5;
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
        if (typeof saved.overallNotes === "string") setOverallNotes(saved.overallNotes);
      }
    } catch { /* Ignore unavailable or invalid browser storage. */ }
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 5, generation, teamA: left, teamB: right, field, movesA, movesB, stagesA, stagesB, swapped, critical, overallNotes }));
    } catch { /* The app still works if storage is disabled or full. */ }
  }, [left, right, field, movesA, movesB, stagesA, stagesB, swapped, critical, overallNotes, generation, storageReady]);

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
    const normalized = team.map(p => ({ ...p, ivs: getMaxIVs(), teraType: "", importedTeraType: p.importedTeraType ?? p.teraType ?? "" }));
    while (normalized.length < 6) normalized.push({
      name: `Empty Slot ${normalized.length + 1}`, species: "Pikachu", item: "", ability: "", nature: "Hardy", level: 100,
      teraType: "", importedTeraType: "", evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      ivs: getMaxIVs(), moves: ["Thunderbolt", "", "", ""],
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

  const runTeamAnalysis = async (filterOverride?: DraftMoveFilter) => {
    const activeMoveFilter = filterOverride || teamAnalysisFilter;
    const token = ++teamAnalysisToken.current;
    setTeamAnalysisOpen(true);
    setTeamAnalysisLoading(true);
    setTeamAnalysisError("");
    setTeamAnalysisRuns([]);
    setTeamAnalysisProgress("Loading Pokémon, learnsets and Smogon preset item data…");
    const isCancelled = () => teamAnalysisToken.current !== token;
    const active = (team: Team) => team.filter(p => Boolean(p.species) && !p.dead && !/^empty slot/i.test(p.name || ""));
    const firstAliveA = active(left)[0];
    const firstAliveB = active(right)[0];
    const currentSelection = selectedAnalysisPokemon;
    const selectionStillAlive = currentSelection && (currentSelection.side === "left" ? active(left) : active(right)).some(pokemon => pokemon.species === currentSelection.species);
    setSelectedAnalysisPokemon(selectionStillAlive ? currentSelection : firstAliveA ? { side: "left", species: firstAliveA.species } : firstAliveB ? { side: "right", species: firstAliveB.species } : null);
    const championsMode = generation >= 10 || /champions/i.test(format);
    const budget = championsMode ? 66 : 510;
    const perStatMax = championsMode ? 32 : 252;
    const presetItemsBySpecies = new Map<string, string[]>();
    const makeProfiles = (pokemon: Team[number], team: Team): Array<{ profile: DraftPokemonProfile; scenario: string }> => {
      const baseEvs = { ...pokemon.evs };
      const used = Object.values(baseEvs).reduce((sum, value) => sum + (Number(value) || 0), 0);
      const remaining = Math.max(0, budget - used);
      const speciesData = getSpecies(pokemon.species);
      const baseStats = speciesData?.baseStats || {};
      const nature = getNature(pokemon.nature || "Hardy");
      const natureFor = (stat: StatId): "boost" | "neutral" | "hinder" => nature?.plus === stat ? "boost" : nature?.minus === stat ? "hinder" : "neutral";
      const ability = pokemon.ability || "";
      const teraType = mechanics.tera && generation === 9 ? (pokemon.teraType || "") : "";
      const alliesFainted = team.filter(other => other !== pokemon && other.dead).length;
      const build = (evs: typeof baseEvs, item: string): DraftPokemonProfile => ({
        species: pokemon.species, ability, item, moves: pokemon.moves.filter(Boolean), teraType,
        championsMode, level: pokemon.level || (championsMode ? 50 : 100), alliesFainted,
        stats: Object.fromEntries((['hp','atk','def','spa','spd','spe'] as StatId[]).map(stat => [stat, { ev: evs[stat] || 0, nature: natureFor(stat), stage: 0 }])) as DraftPokemonProfile['stats'],
      });
      const addTo = (evs: typeof baseEvs, priorities: StatId[]) => {
        let points = remaining;
        const unit = championsMode ? 1 : 4;
        points = Math.floor(points / unit) * unit;
        for (const stat of priorities) {
          if (points <= 0) break;
          const capacity = Math.max(0, perStatMax - (evs[stat] || 0));
          const amount = Math.min(capacity, points);
          evs[stat] = (evs[stat] || 0) + amount;
          points -= amount;
        }
        return evs;
      };
      const attackStat: StatId = (baseStats.atk || 0) >= (baseStats.spa || 0) ? "atk" : "spa";
      const knownItem = pokemon.item?.trim() || "";
      const scenarios: Array<{ profile: DraftPokemonProfile; scenario: string }> = [{ profile: build(baseEvs, knownItem), scenario: knownItem ? `Configured set · ${knownItem}` : "Configured EVs · item unknown" }];
      const offensive = remaining > 0 ? addTo({ ...baseEvs }, [attackStat, "spe", "hp", attackStat === "atk" ? "spa" : "atk"]) : { ...baseEvs };
      const bulky = remaining > 0 ? addTo({ ...baseEvs }, ["hp", "def", "spd", "spe"]) : { ...baseEvs };
      if (knownItem) {
        if (remaining > 0) {
          scenarios.push({ profile: build(offensive, knownItem), scenario: `Remaining EVs · offense + Speed · ${knownItem}` });
          scenarios.push({ profile: build(bulky, knownItem), scenario: `Remaining EVs · HP / defenses · ${knownItem}` });
        }
      } else {
        const candidates = presetItemsBySpecies.get(pokemon.species) || [];
        const defensiveItems = new Set(["assaultvest", "leftovers", "rockyhelmet", "heavydutyboots", "eviolite", "sitrusberry", "focussash"]);
        for (const item of candidates) {
          const defensive = defensiveItems.has(item.toLowerCase().replace(/[^a-z0-9]/g, ""));
          const evs = defensive ? bulky : offensive;
          scenarios.push({ profile: build(evs, item), scenario: `Smogon preset item · ${item}${remaining > 0 ? defensive ? " · remaining EVs to bulk" : " · remaining EVs to offense / Speed" : " · configured EVs"}` });
        }
      }
      return scenarios;
    };
    try {
      // Do not start damage calculations against an unloaded move table. This
      // also protects against a click during the initial learnset-loading pass.
      await loadFormatLearnsets(format);
      setTeamAnalysisMoveNames(getMoveList());
      const allActive = [...active(left), ...active(right)];
      if (allActive.length === 0) {
        setTeamAnalysisError("There are no living Pokémon to analyse. Add Pokémon to the teams or mark at least one Pokémon on each relevant side as alive.");
        return;
      }
      if (!firstAliveA || !firstAliveB) {
        setTeamAnalysisError("Team analysis needs at least one living Pokémon on both Team A and Team B.");
        return;
      }
      if (firstAliveA) setTeamAnalysisCurrentPokemon(`left:${firstAliveA.species}`);
      else if (firstAliveB) setTeamAnalysisCurrentPokemon(`right:${firstAliveB.species}`);
      await Promise.all(allActive.map(async pokemon => { presetItemsBySpecies.set(pokemon.species, await getSmogonPresetItemCandidatesForSpecies(pokemon.species, 8).catch(() => [])); }));
      if (isCancelled()) return;
      const runs: TeamAnalysisRun[] = [];
      const sides = [{ side: "left" as const, own: active(left), opposing: active(right), ownTeam: left, opposingTeam: right }, { side: "right" as const, own: active(right), opposing: active(left), ownTeam: right, opposingTeam: left }];
      for (const side of sides) {
        for (const pokemon of side.own) {
          if (isCancelled()) return;
          setTeamAnalysisCurrentPokemon(`${side.side}:${pokemon.species}`);
          const attackerScenarios = makeProfiles(pokemon, side.ownTeam);
          const defenderScenarios = side.opposing.flatMap(opponent => {
            const options = makeProfiles(opponent, side.opposingTeam);
            // Test the entered target set and one plausible defensive allocation/item,
            // rather than multiplying every attack scenario by every target scenario.
            const base = options[0];
            const scarf = options.find(entry => (entry.profile.item || "").toLowerCase() === "choice scarf");
            const defensive = options.find(entry => ["assault vest", "leftovers", "rocky helmet", "eviolite"].includes((entry.profile.item || "").toLowerCase()));
            const chosen = [base, scarf, defensive].filter((entry, index, all): entry is NonNullable<typeof entry> => Boolean(entry) && all.findIndex(value => value?.profile.item === entry?.profile.item && value?.scenario === entry?.scenario) === index);
            return chosen.map(entry => ({ species: opponent.species, scenario: entry.scenario, profile: entry.profile }));
          });
          for (const attackerScenario of attackerScenarios) {
            if (isCancelled()) return;
            setTeamAnalysisProgress(`${side.side === "left" ? "Team A" : "Team B"}: ${pokemon.species} · ${attackerScenario.scenario}`);
            const analysis = await analyzeDraftPokemon(
              attackerScenario.profile,
              defenderScenarios.map(entry => entry.profile),
              generation,
              isCancelled,
              activeMoveFilter,
              field,
              true,
            );
            if (isCancelled()) return;
            runs.push({ side: side.side, species: pokemon.species, scenario: attackerScenario.scenario, profile: attackerScenario.profile, analysis, opponentScenarios: defenderScenarios.map(({ species, scenario }) => ({ species, scenario })), opponentProfiles: defenderScenarios.map(({ profile }) => profile) });
            setTeamAnalysisRuns([...runs]);
          }
        }
      }
    } catch (error) {
      if (!isCancelled()) setTeamAnalysisError(error instanceof Error ? error.message : "Team analysis failed.");
    } finally {
      if (!isCancelled()) {
        setTeamAnalysisLoading(false);
        setTeamAnalysisProgress("");
        setTeamAnalysisCurrentPokemon("");
      }
    }
  };

  const closeTeamAnalysis = () => {
    teamAnalysisToken.current += 1;
    setTeamAnalysisLoading(false);
    setTeamAnalysisOpen(false);
  };

  return (
    <main>
      <header className="hero">
        <div><h1>Pokemon Team Lab</h1><p>6v6 matchup analysis powered by the Smogon damage calculator.</p>
          <div className="top-rule-controls"><label>Mechanics Gen <select aria-label="Battle mechanics generation" value={generation} onChange={e => { const next = Number(e.target.value); setGeneration(next); if (next !== 9) setMechanics({ tera: false }); }}>{Array.from({ length: 9 }, (_, i) => i + 1).map(g => <option key={g} value={g}>Gen {g}{g === 1 ? " · RBY" : g === 2 ? " · GSC" : g === 3 ? " · ADV" : g === 4 ? " · DPP" : g === 5 ? " · BW" : g === 6 ? " · XY" : g === 7 ? " · SM" : g === 8 ? " · SS" : " · SV"}</option>)}<option value={10}>Pokémon Champions</option></select></label><label>Format <FormatSelector value={format} onChange={setFormat} /></label>
          <details className="mechanics-menu"><summary>Battle mechanics</summary><div className="mechanics-options"><label><input type="checkbox" checked={mechanics.tera && generation === 9} disabled={generation !== 9} onChange={e => setMechanics({ tera: e.target.checked })} />Terastallization</label><small>Generations 1–9 use their corresponding Smogon Calc generation. Pokémon Champions uses bundled official Champions move metadata with the shared Gen 9-compatible damage formula adapter; scripted effects that the damage engine cannot represent directly may remain approximate. Terastallization is available only in Gen 9.</small></div></details></div>
        </div>
        <div className="hero-actions"><Link className="nav-link" href="/draft">Draft Matchups</Link><button type="button" onClick={refreshTeamLearnsets} disabled={learnsetStatus === "loading"}>{learnsetStatus === "loading" ? "Loading learnsets…" : "Refresh team learnsets"}</button><span className={`learnset-status ${learnsetStatus}`} role="status">{learnsetStatus === "loading" ? "Learnsets loading" : learnsetStatus === "ready" ? getLearnsetModeLabel(format) : "Learnsets unavailable"}</span><button onClick={() => setTeamsOpen(true)}>Teams · Import / Export</button></div>
      </header>
      {!format.trim().toLowerCase().replace(/[^a-z0-9]/g, "").includes("everything") && <FormatLegalityPanel teamA={left} teamB={right} format={format} />}
      <div className="workspace workspace-full">
        <FieldPanel value={field} onChange={setField} />
        <MatchupMatrix
          left={rowTeam} right={colTeam} generation={generation} matchups={visibleMatchups} fieldState={field} format={format} selected={selected} swapped={swapped}
          rowMoves={rowMoves} rowStages={rowStages} colStages={colStages} critical={critical} onCriticalChange={setCritical}
          onToggleSwap={() => { setSwapped(value => !value); setSelected(value => value ? ({ row: value.col, col: value.row }) : null); }}
          overallNotes={overallNotes}
          onOverallNotesChange={setOverallNotes}
          onTeamAnalysisClick={() => { void runTeamAnalysis(); }}
          onSelect={(row, col) => setSelected({ row, col })}
          onMoveChange={updateRowMove}
          onRowStageChange={(index, stat, value) => updateStage(index, stat, value, swapped ? "right" : "left")}
          onColStageChange={(index, stat, value) => updateStage(index, stat, value, swapped ? "left" : "right")}
          onResetStages={() => { setStagesA(ZERO_STAGES()); setStagesB(ZERO_STAGES()); setLeft(previous => previous.map(p => ({ ...p, currentHp: undefined, notes: "" }))); setRight(previous => previous.map(p => ({ ...p, currentHp: undefined, notes: "" }))); setOverallNotes(""); }}
          onResetRowStages={index => (swapped ? setStagesB : setStagesA)(prev => prev.map((stage, i) => i === index ? { atk: 0, spa: 0, def: 0, spd: 0, spe: 0, acc: 0, eva: 0 } : stage))}
          onResetColStages={index => (swapped ? setStagesA : setStagesB)(prev => prev.map((stage, i) => i === index ? { atk: 0, spa: 0, def: 0, spd: 0, spe: 0, acc: 0, eva: 0 } : stage))}
          onRowPokemonChange={(index, patch) => updatePokemon(swapped ? "right" : "left", index, patch)}
          onColPokemonChange={(index, patch) => updatePokemon(swapped ? "left" : "right", index, patch)}
        />
      </div>
      {draftPickerOpen && <div className="teams-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setDraftPickerOpen(false); }}><section className="panel teams-modal draft-team-import-modal" role="dialog" aria-modal="true" aria-labelledby="draft-team-import-title"><div className="panel-title-row"><div><h2 id="draft-team-import-title">Select Pokémon from Draft Matchup</h2><p>Select up to six Pokémon from each side. A side with no selections will remain unchanged.</p></div><button type="button" onClick={() => setDraftPickerOpen(false)}>Close ×</button></div>{draftOptions.length ? <><label>Draft matchup <select value={draftChoice} onChange={event => { setDraftChoice(event.target.value); setDraftSelectedA([]); setDraftSelectedB([]); }}><option value="">Choose matchup…</option>{draftOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>{(() => { const option = draftOptions.find(item => item.id === draftChoice); if (!option) return <p>Select a saved draft matchup.</p>; const pickList = (side: "A" | "B", names: string[], selected: string[], setter: (next: string[]) => void) => <div className="draft-import-side"><h3>Team {side} <small>{selected.length}/6 selected</small></h3><ul className="draft-import-options">{names.map((name, index) => <li key={`${side}-${index}-${name}`}><label className="draft-import-option"><input type="checkbox" checked={selected.includes(name)} disabled={!selected.includes(name) && selected.length >= 6} onChange={event => setter(event.target.checked ? [...selected, name] : selected.filter(value => value !== name))} /><span className="draft-import-pokemon-name" title={name}>{name}</span></label></li>)}</ul></div>; return <><div className="draft-import-grid">{pickList("A", option.teamA, draftSelectedA, setDraftSelectedA)}{pickList("B", option.teamB, draftSelectedB, setDraftSelectedB)}</div><div className="button-row"><button type="button" disabled={!draftSelectedA.length && !draftSelectedB.length} onClick={() => { if (draftSelectedA.length) importTeam("left", draftSelectedA.map(name => makeDraftImportPokemon(name, option, "A"))); if (draftSelectedB.length) importTeam("right", draftSelectedB.map(name => makeDraftImportPokemon(name, option, "B"))); setDraftPickerOpen(false); }}>Import selected Pokémon</button></div></>; })()}</> : <p>No saved draft matchups found. Save a matchup in Draft Matchups first.</p>}</section></div>}
      {teamAnalysisOpen && <div className="teams-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeTeamAnalysis(); }}><section className="panel teams-modal team-analysis-modal" role="dialog" aria-modal="true" aria-labelledby="team-analysis-title"><div className="panel-title-row"><div><h2 id="team-analysis-title">6v6 Team Analysis</h2><p>Alive Pokémon only · learnset-based moves · configured information plus clearly labelled item / EV assumptions.</p></div><div className="team-analysis-header-actions"><button type="button" onClick={() => setTeamAnalysisFilterOpen(true)} title="Configure move filters used by this analysis">Move filters</button><button type="button" onClick={() => void runTeamAnalysis()} disabled={teamAnalysisLoading}>Recalculate</button><button type="button" onClick={closeTeamAnalysis}>Close ×</button></div></div>
        <div className="team-analysis-explainer">Use Move filters above to apply accuracy, priority, whitelist and blacklist rules to candidate attacks and setup moves. Known items and EVs are respected. If an item is blank, the analysis also tests Life Orb and Assault Vest assumptions (plus Heavy-Duty Boots when hazards are enabled). Unused EV budget is explored in offensive + Speed and bulky allocations. A complete known four-move set is evaluated as entered; with unknown slots, learnset candidates fill the gaps and weaker same-type STAB alternatives are skipped when a stronger known STAB move is present. These are possible gameplans, not claims about an opponent’s actual set.</div>
        {teamAnalysisLoading && <p className="team-analysis-progress">Calculating: {teamAnalysisProgress || "Preparing alive Pokémon…"}</p>}
        {teamAnalysisError && <p className="team-analysis-error">{teamAnalysisError}</p>}
        {!teamAnalysisLoading && !teamAnalysisRuns.length && !teamAnalysisError && <p className="muted">No analysis scenarios were produced. Check that both teams contain living Pokémon and that the selected format's learnset data has loaded.</p>}
        <div className="team-analysis-rosters">{([{ side: "left" as const, label: "Team A", team: left }, { side: "right" as const, label: "Team B", team: right }]).map(group => { const species: string[] = [...new Set<string>(group.team.filter(pokemon => pokemon.species && !pokemon.dead && !/^empty slot/i.test(pokemon.name || "")).map(pokemon => pokemon.species))]; return <section className="team-analysis-roster" key={group.side}><h3>{group.label}</h3><div className="team-analysis-roster-pokemon">{species.map(name => { const selected = selectedAnalysisPokemon?.side === group.side && selectedAnalysisPokemon.species === name; const runs = teamAnalysisRuns.filter(run => run.side === group.side && run.species === name); const roleThresholdFor = (count: number) => count ? Math.min(count, Math.max(1, Math.ceil(count / 2))) : Number.POSITIVE_INFINITY; const hasSweeperRole = runs.some(run => { const allTargets = new Set(run.analysis.opponents.map(opponent => opponent.species)); const strongTargets = new Set(run.analysis.opponents.filter((opponent, index) => { const target = run.opponentProfiles[index]; if (!target || (opponent.bestAttack?.maxPct || 0) < 70) return false; const attackerSpeed = getDraftProfileEffectiveSpeed(run.profile, field, "attacker"); const targetSpeed = getDraftProfileEffectiveSpeed(target, field, "defender"); return attackerSpeed >= targetSpeed || Boolean(opponent.bestReply && opponent.bestReply.maxPct < 100); }).map(opponent => opponent.species)); return strongTargets.size >= roleThresholdFor(allTargets.size); }); const hasWallingRole = runs.some(run => { const allTargets = new Set(run.analysis.opponents.map(opponent => opponent.species)); const walledTargets = new Set(run.analysis.opponents.filter(opponent => opponent.bestReply && opponent.bestReply.maxPct <= 35).map(opponent => opponent.species)); return walledTargets.size >= roleThresholdFor(allTargets.size); }); const winningSetups = runs.flatMap(run => run.analysis.setupSweeps.filter(winningSetupWithOneRemoval)); const bestWinningHp = winningSetups.reduce((best, setup) => { const lastTarget = [...setup.targets].sort((a, b) => (b.sweepOrder || 0) - (a.sweepOrder || 0))[0]; return Math.max(best, lastTarget?.remainingHpPct ?? setup.setupRemainingHpPct ?? 0); }, 0); return <button type="button" key={name} className={`team-analysis-roster-mon ${selected ? "selected" : ""}`} onClick={() => { setSelectedAnalysisPokemon({ side: group.side, species: name }); setSelectedAnalysisItem(""); }}><span className="team-analysis-roster-sprite-wrap"><PokemonSprite species={name} className="team-analysis-roster-sprite" />{teamAnalysisLoading && teamAnalysisCurrentPokemon === `${group.side}:${name}` ? <i className="analysis-loading-spinner" role="status" aria-label="Calculating" /> : null}</span><span>{name}</span><span className="team-analysis-tags">{runs.some(run => run.analysis.setupSweeps.some(setup => setup.plausibleTargets > 0)) ? <i className="analysis-tag setup">Setup</i> : null}{hasSweeperRole ? <i className="analysis-tag sweeper">Sweeper</i> : null}{hasWallingRole ? <i className="analysis-tag walling">Walling</i> : null}</span><small>{runs.length ? `Winning scenarios: ${winningSetups.length}${winningSetups.length ? ` · best finish ${bestWinningHp.toFixed(1)}% HP` : ""}` : teamAnalysisLoading ? "Calculating…" : "No result"}</small></button>; })}</div></section>; })}</div>
        {selectedAnalysisPokemon && (() => { const selectedRuns = teamAnalysisRuns.filter(run => run.side === selectedAnalysisPokemon.side && run.species === selectedAnalysisPokemon.species); const itemOptions = [...new Set(selectedRuns.map(run => run.profile.item?.trim() || "Item unknown"))]; const visibleRuns = selectedAnalysisItem ? selectedRuns.filter(run => (run.profile.item?.trim() || "Item unknown") === selectedAnalysisItem) : selectedRuns; return <section className="team-analysis-selected"><h3>{selectedAnalysisPokemon.side === "left" ? "Team A" : "Team B"} · {selectedAnalysisPokemon.species}</h3>{itemOptions.length > 0 && <div className="team-analysis-item-picker"><span>Item strategies</span><div className="team-analysis-item-sprites"><button type="button" className={`team-analysis-item-choice ${!selectedAnalysisItem ? "selected" : ""}`} onClick={() => setSelectedAnalysisItem("")} title="Show strategies for all items">All</button>{itemOptions.map(item => <button type="button" key={item} className={`team-analysis-item-choice ${selectedAnalysisItem === item ? "selected" : ""}`} onClick={() => setSelectedAnalysisItem(current => current === item ? "" : item)} title={`Show strategies using ${item}`} aria-label={`Show strategies using ${item}`}><ItemSprite item={item === "Item unknown" ? "" : item} size={30} /><small>{item}</small></button>)}</div></div>}{visibleRuns.length ? visibleRuns.map((run, runIndex) => { const rows = run.analysis.opponents.map((opponent, index) => ({ opponent, scenario: run.opponentScenarios[index]?.scenario || "Opponent set" })); const hits = rows.filter(row => (row.opponent.bestAttack?.maxPct || 0) >= 70).sort((a,b) => (b.opponent.bestAttack?.maxPct || 0) - (a.opponent.bestAttack?.maxPct || 0)); const damages = rows.filter(row => (row.opponent.bestAttack?.maxPct || 0) > 35 && (row.opponent.bestAttack?.maxPct || 0) < 70).sort((a,b) => (b.opponent.bestAttack?.maxPct || 0) - (a.opponent.bestAttack?.maxPct || 0)); const switchIns = rows.filter(row => row.opponent.bestReply && row.opponent.bestReply.maxPct <= 35).sort((a,b) => (a.opponent.bestReply?.maxPct || 0) - (b.opponent.bestReply?.maxPct || 0)); const koRows = rows.filter(row => row.opponent.bestAttack && row.opponent.bestAttack.maxPct > 0).sort((a,b) => (b.opponent.bestAttack?.maxPct || 0) - (a.opponent.bestAttack?.maxPct || 0)).slice(0,5); const allocation = (["hp","atk","def","spa","spd","spe"] as StatId[]).map(stat => `${stat.toUpperCase()} ${run.profile.stats?.[stat]?.ev ?? 0}`).join(" · "); return <details className="team-analysis-run" key={`${run.scenario}:${runIndex}`} open={runIndex === 0}><summary><strong>{run.scenario}</strong><small>{allocation} · {hits.length} strong-hit targets · {switchIns.length} potential switch-ins</small></summary><div className="team-analysis-columns"><section><h3>Win conditions</h3><p>Opponents taking at least 70% from a learnable move in this scenario.</p>{hits.length ? <ul>{hits.slice(0,8).map((row,index)=><li key={`${row.opponent.species}:${index}`}><b>{row.opponent.species}</b> — {row.opponent.bestAttack?.move} · {row.opponent.bestAttack?.minPct.toFixed(1)}–{row.opponent.bestAttack?.maxPct.toFixed(1)}% <small>({row.opponent.bestAttack?.accuracy}% accuracy · {row.scenario})</small></li>)}</ul> : <p className="muted">No strong-hit targets found.</p>}{damages.length > 0 && <details className="team-analysis-subdetails"><summary>Other damage targets ({damages.length})</summary><ul>{damages.slice(0,8).map((row,index)=><li key={`${row.opponent.species}:${index}`}><b>{row.opponent.species}</b> — {row.opponent.bestAttack?.move} · {row.opponent.bestAttack?.minPct.toFixed(1)}–{row.opponent.bestAttack?.maxPct.toFixed(1)}%</li>)}</ul></details>}</section><section><h3>Defensive switching</h3><p>Potential switch-ins into the opponent’s best learnable attack (35% maximum or less).</p>{switchIns.length ? <ul>{switchIns.slice(0,8).map((row,index)=><li key={`${row.opponent.species}:${index}`}><b>{row.opponent.species}</b> — {row.opponent.bestReply?.move} · {row.opponent.bestReply?.minPct.toFixed(1)}–{row.opponent.bestReply?.maxPct.toFixed(1)}% <small>({row.scenario})</small></li>)}</ul> : <p className="muted">No reliable low-damage switch-ins in this scenario.</p>}</section><section><h3>KO thresholds</h3><p>Estimated extra chip needed to move a target into the damage range. Percentages are relative to full HP.</p>{koRows.length ? <ul>{koRows.map((row,index)=>{ const move=row.opponent.bestAttack!; const guaranteed=Math.max(0,100-move.minPct); const possible=Math.max(0,100-move.maxPct); return <li key={`${row.opponent.species}:${index}`}><b>{row.opponent.species}</b> — {move.move} ({move.minPct.toFixed(1)}–{move.maxPct.toFixed(1)}%); <small>{guaranteed <= 0 ? `Damage-roll KO from full HP if it hits (${move.accuracy}% accuracy)` : `~${guaranteed.toFixed(1)}% chip for a damage-roll-guaranteed KO on a hit`}; {possible <= 0 ? `KO possible without chip (${move.accuracy}% accuracy)` : `~${possible.toFixed(1)}% chip for a possible KO`}; {row.scenario}</small></li>;})}</ul> : <p className="muted">No damaging learnset moves found.</p>}</section></div><section className="team-analysis-setup"><h3>Setup strategies considered</h3>{run.analysis.setupSweeps.filter(showableSetup).length ? <div className="team-analysis-setup-list">{run.analysis.setupSweeps.filter(showableSetup).map((setup, setupIndex) => { const requiredDeaths = setupRequiredDeaths(setup); const swept = setup.targets.filter(target => target.plausibleSweepTarget); const failed = setup.targets.filter(target => !target.plausibleSweepTarget && !target.wouldSweepIfReached && target.species !== setup.stoppedBySpecies); const otherMatchups = setup.targets.filter(target => setup.stoppedBySpecies && target.species !== setup.stoppedBySpecies && !target.plausibleSweepTarget && !target.removedBySetup); return <details key={`${setup.move}:${setup.itemAssumption || "configured"}:${setupIndex}`}><summary><strong>{setup.move}</strong><small>{swept.length} swept · {failed.length} failed · {setup.itemAssumption || "configured item"}</small></summary><p className="muted">Boosts: {Object.entries(setup.boosts).map(([stat, value]) => `${stat.toUpperCase()} ${Number(value) > 0 ? "+" : ""}${value}`).join(" · ") || "—"}{setup.setupCostPct ? ` · HP cost ${setup.setupCostPct}%` : ""}{setup.boostChance != null && setup.boostChance < 100 ? ` · boost proc ${setup.boostChance}%` : ""}</p><p className="team-analysis-setup-opportunity">{setup.setupOpportunitySpecies ? <>Can set up in front of <b>{setup.setupOpportunitySpecies}</b> · {setup.setupRemainingHpPct?.toFixed(1)}% HP remaining after setup</> : "No survivable setup opportunity found."}{requiredDeaths.length === 1 ? <> · Requires <b>{requiredDeaths[0].species}</b> to be KO’d first</> : null}</p>{swept.length > 0 && <><b>Swept targets</b><ul>{swept.map(target => <li key={target.species}><b>{target.species}</b>{target.removedBySetup ? ` — KO'd during setup by ${target.setupMoveName} (${target.setupMoveDamagePct?.toFixed(1)}% max, ${target.setupMoveKoGuaranteed ? "guaranteed" : "possible"})` : `${target.sweepOrder ? ` (#${target.sweepOrder})` : ""} — ${target.bestMove?.move || "No damaging move"} · ${target.bestMove?.minPct.toFixed(1) || "0.0"}–${target.bestMoveMaxPct.toFixed(1)}% damage · ${target.estimatedTurnsToKo ?? "?"} hit(s) · ${target.remainingHpPct?.toFixed(1) ?? "—"}% HP left`}</li>)}</ul></>}{setup.stoppedBySpecies && <div className="team-analysis-stopped-by"><b>Stopped by: {setup.stoppedBySpecies}</b>{setup.stoppedByReason ? ` — ${setup.stoppedByReason}` : ""}</div>}{otherMatchups.length > 0 && <><b>Other matchups (if reached)</b><ul>{otherMatchups.map(target => <li key={target.species}><b>{target.species}</b> — {target.bestMove?.move || "No damaging move"} · {target.bestMove?.minPct.toFixed(1) || "0.0"}–{target.bestMoveMaxPct.toFixed(1)}% per hit · takes {target.afterSetupIncomingMove || "no damaging reply"} ({target.afterSetupIncomingMaxPct.toFixed(1)}%) in return · {target.wouldSweepIfReached ? "individually winnable from setup HP" : target.stoppedReason || "not swept in the independent matchup"}</li>)}</ul></>}{failed.length > 0 && <><b>Not swept in the estimated route</b><ul>{failed.map(target => <li key={target.species}><b>{target.species}</b> — {target.stoppedReason || (setup.stoppedBySpecies ? `not reached after ${setup.stoppedBySpecies} stopped the sweep` : target.wearDown ? "can be worn down, but not within the 20-turn estimate" : "not KO'd by the selected boosted attack")}; best hit: {target.bestMove?.move || "none"} ({target.bestMoveMaxPct.toFixed(1)}% per hit){target.setupMoveDamagePct ? ` · setup hit ${target.setupMoveName} ${target.setupMoveDamagePct.toFixed(1)}%` : ""}{target.estimatedTurnsToKo ? ` · about ${target.estimatedTurnsToKo} hit(s)` : ""}; estimated HP remaining: {target.remainingHpPct?.toFixed(1) ?? "—"}%</li>)}</ul></>}</details>; })}</div> : <p className="muted">No eligible setup moves were found for this scenario.</p>}</section></details>; }) : <p className="muted">{selectedAnalysisItem ? `No analysis scenario uses ${selectedAnalysisItem}.` : teamAnalysisLoading ? "Waiting for this Pokémon’s analysis…" : "No analysis result for this Pokémon."}</p>}</section>; })()}
      </section></div>}
      <DraftMoveFilterModal open={teamAnalysisFilterOpen} title="Team analysis · move filters" value={teamAnalysisFilter} moveNames={teamAnalysisMoveNames} onSave={next => { setTeamAnalysisFilter(next); if (teamAnalysisOpen) void runTeamAnalysis(next); }} onClose={() => setTeamAnalysisFilterOpen(false)} />
      <TeamPastePanel left={left} right={right} format={format} onSelectDraft={() => { setTeamsOpen(false); try { const saved = JSON.parse(localStorage.getItem("pokemon-team-lab-draft-matchups-v2") || "{}"); const entries = Object.entries(saved.matchups || {}).map(([id, value]: [string, any]) => ({ id, name: value.matchupName || `Matchup ${Number(id) + 1}`, teamA: Array.isArray(value.teamA) ? value.teamA.filter(Boolean) : [], teamB: Array.isArray(value.teamB) ? value.teamB.filter(Boolean) : [], draftSets: value.draftSets, abilityOverrides: value.abilityOverrides, speedConfigs: value.speedConfigs, statConfigs: value.statConfigs })); setDraftOptions(entries); setDraftChoice(String(saved.currentIndex ?? entries[0]?.id ?? "0")); setDraftSelectedA([]); setDraftSelectedB([]); setDraftPickerOpen(true); } catch { setDraftOptions([]); setDraftPickerOpen(true); } }} open={teamsOpen} onClose={() => setTeamsOpen(false)} onImport={importTeam} onEditTeam={(side, team) => { if (side === "left") { setLeft(team); setMovesA(previous => reconcileMoves(team, previous)); } else { setRight(team); setMovesB(previous => reconcileMoves(team, previous)); } }} />
    </main>
  );
}

function makeDraftImportPokemon(species: string, option?: { draftSets?: Record<string, { item?: string; ability?: string; moves?: string[] }>; abilityOverrides?: Record<string, string>; speedConfigs?: Record<string, { ev: number; nature: "boost" | "neutral" | "hinder" }>; statConfigs?: Record<string, { ev: number; nature: "boost" | "neutral" | "hinder" }> }, side: "A" | "B" = "A"): Team[number] {
  const key = `${side}:${species}`; const custom = option?.draftSets?.[key];
  // Draft Matchups defaults Speed to 252 EVs with a boosting nature even when
  // the user has not opened the Speed editor; preserve that same effective set
  // when importing into Team Builder instead of silently converting it to 0.
  const stats = (stat: string) => stat === "spe"
    ? option?.speedConfigs?.[key] || { ev: 252, nature: "boost" as const }
    : option?.statConfigs?.[`${key}:${stat}`];
  const evs = Object.fromEntries((['hp','atk','def','spa','spd','spe'] as const).map(stat => [stat, stats(stat)?.ev ?? 0])) as Team[number]['evs'];
  const natures: Record<string, { boost: string; hinder: string }> = { atk: { boost: 'Adamant', hinder: 'Modest' }, def: { boost: 'Bold', hinder: 'Lonely' }, spa: { boost: 'Modest', hinder: 'Adamant' }, spd: { boost: 'Calm', hinder: 'Naughty' }, spe: { boost: 'Timid', hinder: 'Brave' } };
  const natureStat = (['atk','def','spa','spd','spe'] as const).find(stat => stats(stat)?.nature === 'boost' || stats(stat)?.nature === 'hinder');
  const nature = natureStat ? natures[natureStat][stats(natureStat)!.nature as 'boost' | 'hinder'] : 'Hardy';
  return { name: species, species, item: custom?.item || "", ability: custom?.ability || option?.abilityOverrides?.[key] || getSpeciesAbilities(species)[0] || "", nature, level: 100, teraType: "", importedTeraType: "", evs, ivs: getMaxIVs(), moves: [0,1,2,3].map(i => custom?.moves?.[i] || "") };
}

function normalizeTeam(value: unknown, resetTera = false): Team | null {
  if (!Array.isArray(value) || value.length !== 6) return null;
  if (!value.every(p => p && typeof p.species === "string" && Array.isArray(p.moves))) return null;
  return value.map(p => ({ ...p, ivs: getMaxIVs(), teraType: resetTera ? "" : (p.teraType || ""), importedTeraType: p.importedTeraType ?? p.teraType ?? "", dead: Boolean(p.dead), status: p.status || "" })) as Team;
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
    atk: clampStage(stages[i]?.atk ?? 0), spa: clampStage(stages[i]?.spa ?? 0), def: clampStage(stages[i]?.def ?? 0), spd: clampStage(stages[i]?.spd ?? 0), spe: clampStage(stages[i]?.spe ?? 0), acc: clampStage(stages[i]?.acc ?? 0), eva: clampStage(stages[i]?.eva ?? 0),
  }));
}
function clampStage(value: number) { return Math.max(-6, Math.min(6, Math.round(Number(value) || 0))); }
