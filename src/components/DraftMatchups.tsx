"use client";

import Link from "next/link";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { getAbility, getHistoricalSpeciesLearnset, getMove, getSpecies, getSpeciesAbilities, getSpeciesAbilitiesForGeneration, getSpeciesList, getMoveList } from "../lib/showdown-data";
import { POKEMON_TYPES } from "../lib/pokemon-visuals";
import { TypeChart } from "../lib/showdown-official/data/typechart";
import AutocompleteInput from "./AutocompleteInput";
import SupportCategoryPanel from "./SupportCategoryPanel";
import FormatSelector from "./FormatSelector";
import PokemonSprite from "./PokemonSprite";
import { abilityDefenseDescription, abilityDefenseMultiplier, getAbilityDefenseEffect } from "../lib/ability-defenses";
import { analyzeDraftPokemon, DEFAULT_DRAFT_MOVE_FILTER, type DraftMoveFilter, type DraftMatchupAnalysis, type DraftPokemonProfile, type DraftOpponentResult } from "../lib/draft-matchup-analysis";
import type { Team } from "../lib/types";
import { getWeatherSpeedAbilityMultiplier } from "../lib/battle-order";
import abilityStatBoosts from "../data/ability-stat-boosts.json";

type Preset = { label: string; teamA: string[]; teamB: string[] };
const blankDraftField = { weather: "" as const, terrain: "" as const, defenderStealthRock: false, defenderSpikes: 0, defenderReflect: false, defenderLightScreen: false, defenderAuroraVeil: false, defenderLeechSeed: false, defenderSaltCure: false, trickRoom: false, tailwindSide: "" as const };
type StatKey = "hp" | "atk" | "def" | "spa" | "spd" | "spe" | "bst";
type SpeedBenchmark = { opponent: string; target: number; hindering: number | null; neutral: number | null; boosted: number | null };
const STAT_LABELS: Record<StatKey, string> = { hp: "HP", atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Speed", bst: "BST" };
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
const TERA_TYPES = ["None", ...POKEMON_TYPES, "Stellar"] as const;
const isChampionsFormat = (format: string) => /champions/i.test(format);
const maxStatValue = (format: string) => isChampionsFormat(format) ? 32 : 252;
const statValueLabel = (format: string) => isChampionsFormat(format) ? "Stat points" : "EVs";
const clampDraftStat = (value: number, format: string) => Math.max(0, Math.min(maxStatValue(format), Math.round(Number(value) || 0)));

function speciesTypes(name: string): string[] {
  const types = getSpecies(name)?.types;
  return Array.isArray(types) ? types.filter((type): type is string => typeof type === "string") : [];
}
function baseStats(name: string): { hp: number; atk: number; def: number; spa: number; spd: number; spe: number; bst: number } | null {
  const stats = getSpecies(name)?.baseStats;
  if (!stats) return null;
  const hp = stats.hp || 0, atk = stats.atk || 0, def = stats.def || 0, spa = stats.spa || 0, spd = stats.spd || 0, spe = stats.spe || 0;
  return { hp, atk, def, spa, spd, spe, bst: hp + atk + def + spa + spd + spe };
}
function baseSpeed(name: string): number | null { return baseStats(name)?.spe ?? null; }
function multiplier(defender: string, attackType: string, teraType?: string): number {
  const types = teraType ? [teraType] : speciesTypes(defender);
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
function defensiveMultiplier(defender: string, attackType: string, ability: string, teraType?: string): number {
  const base = multiplier(defender, attackType, teraType);
  const effect = abilityDefenseMultiplier(ability, attackType, base);
  return effect === null ? base : base * effect;
}
function multiplierLabel(value: number) {
  return value === 0 ? "×0" : `×${Number.isInteger(value) ? value : value.toFixed(2).replace(/0$/, "")}`;
}
function typeClass(type: string) { return `type-badge type-${type.toLowerCase().replace(/[^a-z]/g, "")}`; }
function shortAbilityName(ability: string) { return ability; }
const learnableMoveTypesCache = new Map<string, Set<string>>();
function learnableMoveTypes(name: string): Set<string> {
  const cached = learnableMoveTypesCache.get(name);
  if (cached) return cached;
  const types = new Set<string>();
  const learnset = getHistoricalSpeciesLearnset(name);
  if (learnset) {
    for (const moveName of learnset) {
      const moveType = getMove(moveName)?.type;
      if (typeof moveType === "string") types.add(moveType);
    }
    learnableMoveTypesCache.set(name, types);
  }
  return types;
}
/** True when a Pokémon has at least one known learnable move of this type that receives STAB. */
function hasStabMoveOfType(name: string, attackType: string, teraType?: string): boolean {
  const receivesStab = speciesTypes(name).includes(attackType) || teraType === attackType;
  return receivesStab && learnableMoveTypes(name).has(attackType);
}

export default function DraftMatchups() {
  const species = useMemo(() => getSpeciesList(), []);
  const [presetIndex, setPresetIndex] = useState(0);
  const [matchupName, setMatchupName] = useState(PRESETS[0].label);
  const [draftMatchupName, setDraftMatchupName] = useState(PRESETS[0].label);
  const [savedMatchupNames, setSavedMatchupNames] = useState<Record<string, string>>({});
  const [typeTeam, setTypeTeam] = useState<"A" | "B" | null>(null);
  const [supportOpen, setSupportOpen] = useState(false);
  const [speedEdit, setSpeedEdit] = useState<{ side: "A" | "B"; name: string; stat: Exclude<StatKey, "bst"> } | null>(null);
  const [speedHover, setSpeedHover] = useState<{ side: "A" | "B"; name: string; x: number; y: number } | null>(null);
  type MatchupHoverKind = "hits" | "walls" | "hitBy" | "walledBy";
  const [matchupHover, setMatchupHover] = useState<{ side: "A" | "B"; name: string; kind: MatchupHoverKind; x: number; y: number } | null>(null);
  const [matchupAnalyses, setMatchupAnalyses] = useState<Record<string, DraftMatchupAnalysis>>({});
  const [matchupAnalysisLoading, setMatchupAnalysisLoading] = useState(false);
  const [bestFourOpen, setBestFourOpen] = useState(false);
  const [moveFilterOpen, setMoveFilterOpen] = useState(false);
  const [moveFilter, setMoveFilter] = useState<DraftMoveFilter>(DEFAULT_DRAFT_MOVE_FILTER);
  const [moveFilterDraft, setMoveFilterDraft] = useState<DraftMoveFilter>(DEFAULT_DRAFT_MOVE_FILTER);
  const [movePicker, setMovePicker] = useState("");
  const moveNames = useMemo(() => getMoveList(), []);
  const matchupHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  type SpeedConfig = { ev: number; nature: "boost" | "neutral" | "hinder"; stage: number };
  type StatConfig = { ev: number; nature: "boost" | "neutral" | "hinder"; stage: number };
  const [speedConfigs, setSpeedConfigs] = useState<Record<string, SpeedConfig>>({});
  const [statConfigs, setStatConfigs] = useState<Record<string, StatConfig>>({});
  const [abilityOverrides, setAbilityOverrides] = useState<Record<string, string>>({});
  const [supremeFainted, setSupremeFainted] = useState<Record<string, number>>({});
  const [pokemonPoints, setPokemonPoints] = useState<Record<string, number>>({});
  const [teraCaptains, setTeraCaptains] = useState<Record<string, boolean>>({});
  const [teraTypes, setTeraTypes] = useState<Record<string, string>>({});
  const [format, setFormat] = useState("Everything!");
  const [mechanicsGeneration, setMechanicsGeneration] = useState(9);
  const [draftWeather, setDraftWeather] = useState<"" | "Sun" | "Rain" | "Sand" | "Snow">("");
  const [draftTerrain, setDraftTerrain] = useState<"" | "Electric" | "Grassy" | "Misty" | "Psychic">("");
  // Sorting is intentionally session-only: it resets to Speed after a refresh.
  const [sortStat, setSortStat] = useState<StatKey>("spe");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [teamA, setTeamA] = useState<string[]>(() => normalizeTeam(PRESETS[0].teamA));
  const [teamB, setTeamB] = useState<string[]>(() => normalizeTeam(PRESETS[0].teamB));
  const [hydrated, setHydrated] = useState(false);
  const profileFor = (side: "A" | "B", name: string): DraftPokemonProfile => {
    const key = `${side}:${name}`;
    const selectedTera = teraCaptains[key] ? teraTypes[key] : undefined;
    const championsMode = isChampionsFormat(format);
    const configuredStat = (stat: "hp" | "atk" | "def" | "spa" | "spd" | "spe") => {
      const raw = stat === "spe"
        ? speedConfigs[key] || { ev: 252, nature: "boost" as const, stage: 0 }
        : statConfigs[`${side}:${name}:${stat}`] || { ev: 0, nature: "neutral" as const, stage: 0 };
      return { ...raw, ev: clampDraftStat(raw.ev, format) };
    };
    const stats: NonNullable<DraftPokemonProfile["stats"]> = {
      hp: configuredStat("hp"), atk: configuredStat("atk"), def: configuredStat("def"),
      spa: configuredStat("spa"), spd: configuredStat("spd"), spe: configuredStat("spe"),
    };
    const abilities = getSpeciesAbilitiesForGeneration(name, mechanicsGeneration);
    const selectedAbility = Object.prototype.hasOwnProperty.call(abilityOverrides, key)
      ? (abilityOverrides[key] || "")
      : abilities.length === 1 ? abilities[0] : "";
    return {
      species: name,
      ability: abilities.includes(selectedAbility) ? selectedAbility : "",
      alliesFainted: supremeFainted[key] ?? 0,
      teraType: selectedTera && selectedTera !== "None" ? selectedTera : undefined,
      stats,
      championsMode,
      level: championsMode ? 50 : 100,
    };
  };

  // Precompute every Pokémon's view of the opposing roster. The analysis module
  // caches each directed attacker/defender calculation, so the reverse view
  // reuses the same move results rather than repeating the damage work.
  useEffect(() => {
    let cancelled = false;
    const namesA: string[] = [...new Set(teamA.filter((name): name is string => Boolean(name)))];
    const namesB: string[] = [...new Set(teamB.filter((name): name is string => Boolean(name)))];
    setMatchupAnalyses({});
    setMatchupAnalysisLoading(true);
    const run = async () => {
      const next: Record<string, DraftMatchupAnalysis> = {};
      const queue: Array<{ side: "A" | "B"; name: string; opponents: string[] }> = [
        ...namesA.map(name => ({ side: "A" as const, name, opponents: namesB })),
        ...namesB.map(name => ({ side: "B" as const, name, opponents: namesA })),
      ];
      for (const entry of queue) {
        if (cancelled) return;
        const result = await analyzeDraftPokemon(
          profileFor(entry.side, entry.name),
          entry.opponents.map(name => profileFor(entry.side === "A" ? "B" : "A", name)),
          mechanicsGeneration,
          () => cancelled,
          moveFilter,
          { ...blankDraftField, weather: draftWeather, terrain: draftTerrain },
        );
        if (cancelled) return;
        next[`${entry.side}:${entry.name}`] = result;
        setMatchupAnalyses({ ...next });
      }
      if (!cancelled) setMatchupAnalysisLoading(false);
    };
    run().catch(() => { if (!cancelled) setMatchupAnalysisLoading(false); });
    return () => { cancelled = true; };
  }, [teamA, teamB, abilityOverrides, supremeFainted, teraCaptains, teraTypes, speedConfigs, statConfigs, format, mechanicsGeneration, moveFilter, draftWeather, draftTerrain]);
  useEffect(() => () => { if (matchupHoverTimer.current) clearTimeout(matchupHoverTimer.current); }, []);

  const storageKey = "pokemon-team-lab-draft-matchups-v2";
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as { currentIndex?: number; matchups?: Record<string, { matchupName?: string; teamA?: string[]; teamB?: string[]; format?: string; mechanicsGeneration?: number; draftWeather?: "" | "Sun" | "Rain" | "Sand" | "Snow"; draftTerrain?: "" | "Electric" | "Grassy" | "Misty" | "Psychic"; speedConfigs?: Record<string, SpeedConfig>; statConfigs?: Record<string, StatConfig>; abilityOverrides?: Record<string, string>; supremeFainted?: Record<string, number>; pokemonPoints?: Record<string, number>; teraCaptains?: Record<string, boolean>; teraTypes?: Record<string, string>; moveFilter?: DraftMoveFilter }> };
        if (saved.matchups && typeof saved.matchups === "object") setSavedMatchupNames(Object.fromEntries(Object.entries(saved.matchups).map(([key, value]) => [key, value?.matchupName || PRESETS[Number(key)]?.label || ""])));
        const index = Number.isInteger(saved.currentIndex) && saved.currentIndex! >= 0 && saved.currentIndex! < PRESETS.length ? saved.currentIndex! : 0;
        setPresetIndex(index);
        const active = saved.matchups?.[String(index)];
        if (active) {
          if (typeof active.matchupName === "string") { setMatchupName(active.matchupName); setDraftMatchupName(active.matchupName); }
          if (Array.isArray(active.teamA)) setTeamA(normalizeTeam(active.teamA));
          if (Array.isArray(active.teamB)) setTeamB(normalizeTeam(active.teamB));
          if (typeof active.format === "string") setFormat(active.format);
          if (typeof active.mechanicsGeneration === "number" && active.mechanicsGeneration >= 1 && active.mechanicsGeneration <= 10) setMechanicsGeneration(active.mechanicsGeneration);
          setDraftWeather(active.draftWeather || ""); setDraftTerrain(active.draftTerrain || "");
          if (active.speedConfigs && typeof active.speedConfigs === "object") setSpeedConfigs(active.speedConfigs);
          if (active.statConfigs && typeof active.statConfigs === "object") setStatConfigs(active.statConfigs);
          if (active.abilityOverrides && typeof active.abilityOverrides === "object") setAbilityOverrides(active.abilityOverrides);
          if (active.supremeFainted && typeof active.supremeFainted === "object") setSupremeFainted(active.supremeFainted);
          if (active.pokemonPoints && typeof active.pokemonPoints === "object") setPokemonPoints(active.pokemonPoints);
          if (active.teraCaptains && typeof active.teraCaptains === "object") setTeraCaptains(active.teraCaptains);
          if (active.teraTypes && typeof active.teraTypes === "object") setTeraTypes(active.teraTypes);
          if (active.moveFilter && typeof active.moveFilter === "object") setMoveFilter({ ...DEFAULT_DRAFT_MOVE_FILTER, ...active.moveFilter });
        } else {
          setTeamA(normalizeTeam(PRESETS[index].teamA)); setTeamB(normalizeTeam(PRESETS[index].teamB));
          setMoveFilter(DEFAULT_DRAFT_MOVE_FILTER); setMatchupName(PRESETS[index].label); setDraftMatchupName(PRESETS[index].label); setFormat("Everything!"); setMechanicsGeneration(9); setDraftWeather(""); setDraftTerrain(""); setMoveFilter(DEFAULT_DRAFT_MOVE_FILTER); setSpeedConfigs({}); setStatConfigs({}); setAbilityOverrides({}); setSupremeFainted({}); setPokemonPoints({}); setTeraCaptains({}); setTeraTypes({}); setMoveFilter(DEFAULT_DRAFT_MOVE_FILTER);
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
          if (typeof legacy.mechanicsGeneration === "number" && legacy.mechanicsGeneration >= 1 && legacy.mechanicsGeneration <= 10) setMechanicsGeneration(legacy.mechanicsGeneration);
          setDraftWeather(legacy.draftWeather || ""); setDraftTerrain(legacy.draftTerrain || "");
          if (legacy.speedConfigs && typeof legacy.speedConfigs === "object") setSpeedConfigs(legacy.speedConfigs);
          if (legacy.statConfigs && typeof legacy.statConfigs === "object") setStatConfigs(legacy.statConfigs);
          if (legacy.abilityOverrides && typeof legacy.abilityOverrides === "object") setAbilityOverrides(legacy.abilityOverrides);
          if (legacy.supremeFainted && typeof legacy.supremeFainted === "object") setSupremeFainted(legacy.supremeFainted);
          if (legacy.pokemonPoints && typeof legacy.pokemonPoints === "object") setPokemonPoints(legacy.pokemonPoints);
          if (legacy.teraCaptains && typeof legacy.teraCaptains === "object") setTeraCaptains(legacy.teraCaptains);
          if (legacy.teraTypes && typeof legacy.teraTypes === "object") setTeraTypes(legacy.teraTypes);
          if (legacy.moveFilter && typeof legacy.moveFilter === "object") setMoveFilter({ ...DEFAULT_DRAFT_MOVE_FILTER, ...legacy.moveFilter });
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
      matchups[String(presetIndex)] = { matchupName, teamA, teamB, format, mechanicsGeneration, draftWeather, draftTerrain, speedConfigs, statConfigs, abilityOverrides, supremeFainted, pokemonPoints, teraCaptains, teraTypes, moveFilter };
      setSavedMatchupNames(current => ({ ...current, [String(presetIndex)]: matchupName }));
      localStorage.setItem(storageKey, JSON.stringify({ currentIndex: presetIndex, matchups }));
    } catch {}
  }, [hydrated, matchupName, teamA, teamB, format, mechanicsGeneration, draftWeather, draftTerrain, presetIndex, speedConfigs, statConfigs, abilityOverrides, supremeFainted, pokemonPoints, teraCaptains, teraTypes, moveFilter]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draftA, setDraftA] = useState<string[]>(teamA);
  const [draftB, setDraftB] = useState<string[]>(teamB);
  const [bulkA, setBulkA] = useState("");
  const [bulkB, setBulkB] = useState("");
  const [bulkError, setBulkError] = useState("");

  const setPreset = (index: number) => {
    // Persist the outgoing matchup synchronously before changing the active slot.
    try {
      const raw = localStorage.getItem(storageKey);
      const saved = raw ? JSON.parse(raw) : {};
      const matchups = saved.matchups && typeof saved.matchups === "object" ? saved.matchups : {};
      matchups[String(presetIndex)] = { matchupName, teamA, teamB, format, mechanicsGeneration, draftWeather, draftTerrain, speedConfigs, statConfigs, abilityOverrides, supremeFainted, pokemonPoints, teraCaptains, teraTypes, moveFilter };
      setSavedMatchupNames(current => ({ ...current, [String(presetIndex)]: matchupName }));
      const next = matchups[String(index)];
      localStorage.setItem(storageKey, JSON.stringify({ currentIndex: index, matchups }));
      setPresetIndex(index);
      if (next) {
        setMatchupName(typeof next.matchupName === "string" ? next.matchupName : PRESETS[index].label);
        setDraftMatchupName(typeof next.matchupName === "string" ? next.matchupName : PRESETS[index].label);
        setTeamA(normalizeTeam(Array.isArray(next.teamA) ? next.teamA : PRESETS[index].teamA));
        setTeamB(normalizeTeam(Array.isArray(next.teamB) ? next.teamB : PRESETS[index].teamB));
        setFormat(typeof next.format === "string" ? next.format : "Everything!");
        setMechanicsGeneration(typeof next.mechanicsGeneration === "number" && next.mechanicsGeneration >= 1 && next.mechanicsGeneration <= 10 ? next.mechanicsGeneration : 9);
        setDraftWeather(next.draftWeather || ""); setDraftTerrain(next.draftTerrain || "");
        setSpeedConfigs(next.speedConfigs && typeof next.speedConfigs === "object" ? next.speedConfigs : {});
        setStatConfigs(next.statConfigs && typeof next.statConfigs === "object" ? next.statConfigs : {});
        setAbilityOverrides(next.abilityOverrides && typeof next.abilityOverrides === "object" ? next.abilityOverrides : {});
        setSupremeFainted(next.supremeFainted && typeof next.supremeFainted === "object" ? next.supremeFainted : {});
        setPokemonPoints(next.pokemonPoints && typeof next.pokemonPoints === "object" ? next.pokemonPoints : {});
        setTeraCaptains(next.teraCaptains && typeof next.teraCaptains === "object" ? next.teraCaptains : {});
        setTeraTypes(next.teraTypes && typeof next.teraTypes === "object" ? next.teraTypes : {});
        setMoveFilter(next.moveFilter && typeof next.moveFilter === "object" ? { ...DEFAULT_DRAFT_MOVE_FILTER, ...next.moveFilter } : DEFAULT_DRAFT_MOVE_FILTER);
      } else {
        setMoveFilter(DEFAULT_DRAFT_MOVE_FILTER); setMatchupName(PRESETS[index].label); setDraftMatchupName(PRESETS[index].label);
        setTeamA(normalizeTeam(PRESETS[index].teamA)); setTeamB(normalizeTeam(PRESETS[index].teamB));
        setFormat("Everything!"); setMechanicsGeneration(9); setDraftWeather(""); setDraftTerrain(""); setMoveFilter(DEFAULT_DRAFT_MOVE_FILTER); setSpeedConfigs({}); setStatConfigs({}); setAbilityOverrides({}); setSupremeFainted({}); setPokemonPoints({}); setTeraCaptains({}); setTeraTypes({}); setMoveFilter(DEFAULT_DRAFT_MOVE_FILTER);
      }
    } catch {
      setPresetIndex(index); setMatchupName(PRESETS[index].label); setDraftMatchupName(PRESETS[index].label); setMechanicsGeneration(9); setDraftWeather(""); setDraftTerrain("");
      setTeamA(normalizeTeam(PRESETS[index].teamA)); setTeamB(normalizeTeam(PRESETS[index].teamB)); setSpeedConfigs({}); setStatConfigs({}); setAbilityOverrides({}); setSupremeFainted({}); setPokemonPoints({}); setTeraCaptains({}); setTeraTypes({}); setMoveFilter(DEFAULT_DRAFT_MOVE_FILTER);
    }
  };
  const openEditor = () => {
    setDraftA([...teamA]);
    setDraftB([...teamB]);
    setDraftMatchupName(matchupName);
    setBulkA(teamA.filter(Boolean).join("\n"));
    setBulkB(teamB.filter(Boolean).join("\n"));
    setBulkError("");
    setEditorOpen(true);
  };
  const parseBulkRoster = (text: string) => text.split(/[\r\n,]+/).map(value => value.trim()).filter(Boolean).map(value => species.find(name => name.toLowerCase() === value.toLowerCase()) || species.find(name => name.toLowerCase().includes(value.toLowerCase())) || value).slice(0, 12);
  const applyBulkRoster = (side: "A" | "B") => {
    const parsed = parseBulkRoster(side === "A" ? bulkA : bulkB);
    const unknown = parsed.filter(name => !species.some(option => option.toLowerCase() === name.toLowerCase()));
    if (unknown.length) { setBulkError(`Unrecognised Pokémon: ${unknown.join(", ")}`); return; }
    const padded = normalizeTeam(parsed);
    if (side === "A") setDraftA(padded); else setDraftB(padded);
    setBulkError("");
  };
  const copyRoster = async (side: "A" | "B") => {
    const text = (side === "A" ? draftA : draftB).filter(Boolean).join("\n");
    try { await navigator.clipboard.writeText(text); } catch { setBulkError("Clipboard access was blocked by the browser."); }
  };
  const closeEditor = () => {
    const name = draftMatchupName.trim() || PRESETS[presetIndex].label;
    setMatchupName(name);
    setDraftMatchupName(name);
    setEditorOpen(false);
  };
  const activeA = teamA.filter(Boolean);
  const activeB = teamB.filter(Boolean);
  const statValue = (name: string, key: StatKey) => baseStats(name)?.[key] ?? -1;
  const sortRoster = (roster: string[]) => [...roster].filter(Boolean).sort((a, b) => {
    const delta = statValue(a, sortStat) - statValue(b, sortStat);
    if (delta !== 0) return sortDirection === "asc" ? delta : -delta;
    return (baseSpeed(b) ?? -1) - (baseSpeed(a) ?? -1);
  });
  const chooseSort = (key: StatKey) => {
    if (sortStat === key) setSortDirection(current => current === "asc" ? "desc" : "asc");
    else { setSortStat(key); setSortDirection("asc"); }
  };
  const sortedA = sortRoster(activeA);
  const sortedB = sortRoster(activeB);
  const statColor = (value: number, key: StatKey) => {
    const values = [...activeA, ...activeB].map(name => baseStats(name)?.[key]).filter((v): v is number => typeof v === "number");
    if (!values.length) return undefined;
    const min = Math.min(...values), max = Math.max(...values);
    const ratio = max === min ? 0.5 : (value - min) / (max - min);
    const hue = Math.round(ratio * 180);
    const lightness = ratio < 0.15 ? 54 : ratio > 0.85 ? 48 : 50;
    return { color: `hsl(${hue} 100% ${lightness}%)` };
  };
  const renderStatCell = (name: string, side: "A" | "B", key: StatKey) => {
    const stats = name ? baseStats(name) : null;
    const value = stats ? stats[key] : null;
    if (key === "bst") return <td key={`${side}-${key}`} className="draft-base-stat draft-stat-bst"><span style={value === null ? undefined : statColor(value, key)}>{value ?? "—"}</span><small className="draft-stat-config-placeholder" aria-hidden="true">&nbsp;</small></td>;
    const cfg = name ? configForStat(side, name, key) : null;
    const natureLabel = key === "hp" ? "" : cfg?.nature === "boost" ? "+" : cfg?.nature === "hinder" ? "−" : "";
    const stageLabel = key === "hp" ? "" : cfg ? (cfg.stage > 0 ? `+${cfg.stage}` : String(cfg.stage)) : "";
    const open = () => name && setSpeedEdit({ side, name, stat: key });
    return <td key={`${side}-${key}`} className={`draft-base-stat draft-stat-${key} ${key === "spe" ? "draft-speed" : ""}`} onClick={open} onMouseEnter={key === "spe" && name ? event => showSpeedHover(event, name, side) : undefined} onMouseLeave={key === "spe" ? () => setSpeedHover(null) : undefined}>
      <strong className="draft-stat-value" style={value === null ? undefined : statColor(value, key)}>{value ?? "—"}</strong>
      <button type="button" className="draft-stat-adjuster" aria-label={name ? `Adjust ${STAT_LABELS[key]} ${statValueLabel(format)} and nature for ${name}` : "Adjust stat"} onClick={event => { event.stopPropagation(); open(); }} disabled={!name}>
        <span className={`draft-ev-line ${cfg?.nature === "boost" ? "nature-boost" : cfg?.nature === "hinder" ? "nature-hinder" : ""}`}>{cfg ? `${cfg.ev}${key !== "hp" ? natureLabel : ""} ${statValueLabel(format)}` : " "}</span>
        {key !== "hp" && cfg ? <span className={`draft-stage-line ${cfg.stage > 0 ? "stage-positive" : cfg.stage < 0 ? "stage-negative" : ""}`}>{stageLabel || "0"}</span> : <span className="draft-stage-line" aria-hidden="true"> </span>}
      </button>
    </td>;
  };
  const statHeading = (key: StatKey, side: "A" | "B") => <th key={`${side}-${key}`} className={`draft-stat-heading draft-stat-${key}`}><button type="button" onClick={() => chooseSort(key)} aria-label={`Sort by ${STAT_LABELS[key]}${sortStat === key ? ` ${sortDirection === "asc" ? "descending" : "ascending"} next` : ""}`} title={`Sort both teams by ${STAT_LABELS[key]}`}>{(key === "spe" ? "Spe" : STAT_LABELS[key])}{sortStat === key ? <span className={`draft-sort-indicator ${sortDirection === "desc" ? "sort-descending" : "sort-ascending"}`}>{sortDirection === "desc" ? " ↓" : " ↑"}</span> : null}</button></th>;
  const lastRow = Math.max(sortedA.length, sortedB.length) - 1;
  const asTeam = (names: string[]): Team => names.map(species => ({ name: species, species, item: "", ability: getSpeciesAbilities(species)[0] || "", nature: "Hardy", level: 100, evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, moves: [] }));
  const updateDraft = (side: "A" | "B", index: number, value: string) => {
    const update = side === "A" ? setDraftA : setDraftB;
    const setTeam = side === "A" ? setTeamA : setTeamB;
    const roster = side === "A" ? draftA : draftB;
    const nextRoster = roster.map((name, i) => i === index ? value : name);
    update(nextRoster);
    (side === "A" ? setBulkA : setBulkB)(nextRoster.filter(Boolean).join("\n"));
    setTeam(current => normalizeTeam(current.map((name, i) => i === index ? value : name)));
  };
  const configFor = (side: "A" | "B", name: string): SpeedConfig => { const value = speedConfigs[`${side}:${name}`] || { ev: 252, nature: "boost" as const, stage: 0 }; return { ...value, ev: clampDraftStat(value.ev, format) }; };
  const configForStat = (side: "A" | "B", name: string, stat: Exclude<StatKey, "bst">): StatConfig => { const value = stat === "spe" ? configFor(side, name) : statConfigs[`${side}:${name}:${stat}`] || { ev: 0, nature: "neutral" as const, stage: 0 }; return { ...value, ev: clampDraftStat(value.ev, format) }; };
  const abilitiesFor = (name: string) => getSpeciesAbilitiesForGeneration(name, mechanicsGeneration);
  const automaticBoostLabel = (side: "A" | "B", name: string, ability: string) => {
    const id = ability.toLowerCase();
    const definition = (abilityStatBoosts as Record<string, { stat: string; multiplier: string; weather?: string; terrain?: string; condition: string }>)[id];
    const labels: string[] = [];
    if (definition) {
      const active = (!definition.weather || draftWeather === definition.weather) && (!definition.terrain || draftTerrain === definition.terrain);
      if (active && definition.condition !== "Status" && definition.condition !== "At or below 50% HP" && definition.condition !== "First 5 turns") labels.push(`${definition.stat} ${definition.multiplier}`);
    }
    if ((id === "protosynthesis" && draftWeather === "Sun") || (id === "quark drive" && draftTerrain === "Electric")) {
      const stats = baseStats(name);
      if (stats) {
        const values = (["atk", "def", "spa", "spd", "spe"] as const).map(stat => { const cfg = configForStat(side, name, stat); const raw = stats[stat] * 2 + cfg.ev / 4; const nature = cfg.nature === "boost" ? 1.1 : cfg.nature === "hinder" ? .9 : 1; return { stat, value: raw * nature }; });
        const highest = [...values].sort((a, b) => b.value - a.value)[0]?.stat;
        if (highest) labels.push(`${highest === "atk" ? "Atk" : highest === "def" ? "Def" : highest === "spa" ? "SpA" : highest === "spd" ? "SpD" : "Spe"} boosted`);
      }
    }
    return labels.length ? ` · ${labels.join(" · ")}` : "";
  };
  const enabledAbility = (side: "A" | "B", name: string) => {
    const key = `${side}:${name}`;
    const abilities = abilitiesFor(name);
    if (Object.prototype.hasOwnProperty.call(abilityOverrides, key)) {
      const selected = abilityOverrides[key] || "";
      return abilities.includes(selected) ? selected : "";
    }
    return abilities.length === 1 ? abilities[0] : "";
  };
  const matchupKey = (side: "A" | "B", name: string) => `${side}:${name}`;
  const isTeraCaptain = (side: "A" | "B", name: string) => Boolean(teraCaptains[matchupKey(side, name)]);
  const teraTypeValue = (side: "A" | "B", name: string) => teraTypes[matchupKey(side, name)] || "None";
  const selectedTeraType = (side: "A" | "B", name: string) => isTeraCaptain(side, name) && !["None", "Stellar"].includes(teraTypeValue(side, name)) ? teraTypeValue(side, name) : undefined;
  const pointsFor = (side: "A" | "B", name: string) => pokemonPoints[matchupKey(side, name)] ?? 0;
  const setPointsFor = (side: "A" | "B", name: string, value: number) => setPokemonPoints(current => ({ ...current, [matchupKey(side, name)]: Math.max(0, Math.min(999, value || 0)) }));
  const setTeraCaptain = (side: "A" | "B", name: string, enabled: boolean) => setTeraCaptains(current => ({ ...current, [matchupKey(side, name)]: enabled }));
  const setTeraTypeFor = (side: "A" | "B", name: string, value: string) => setTeraTypes(current => ({ ...current, [matchupKey(side, name)]: value }));
  const totalPoints = (side: "A" | "B", roster: string[]) => roster.reduce((sum, name) => sum + pointsFor(side, name), 0);
  const toggleAbility = (side: "A" | "B", name: string, ability: string) => setAbilityOverrides(current => {
    const key = `${side}:${name}`;
    const selected = Object.prototype.hasOwnProperty.call(current, key)
      ? (current[key] || "")
      : (() => { const available = getSpeciesAbilitiesForGeneration(name, mechanicsGeneration); return available.length === 1 ? available[0] : ""; })();
    return { ...current, [key]: selected === ability ? "" : ability };
  });
  const defensiveSummary = (name: string, side: "A" | "B") => {
    const ability = enabledAbility(side, name);
    const groups: Record<string, string[]> = { Weak: [], Resist: [], Immune: [] };
    for (const attackType of POKEMON_TYPES) {
      const value = defensiveMultiplier(name, attackType, ability, selectedTeraType(side, name));
      if (value === 0) groups.Immune.push(attackType);
      else if (value < 1) groups.Resist.push(`${attackType} ${multiplierLabel(value)}`);
      else if (value > 1) groups.Weak.push(`${attackType} ${multiplierLabel(value)}`);
    }
    const lines = [groups.Weak.length ? `Weak: ${groups.Weak.join(", ")}` : "Weak: none", groups.Resist.length ? `Resist: ${groups.Resist.join(", ")}` : "Resist: none", groups.Immune.length ? `Immune: ${groups.Immune.join(", ")}` : "Immune: none"];
    if (ability) lines.push(`Enabled ability: ${ability} — ${abilityDefenseDescription(ability)}`);
    return lines.join("\n");
  };
  const updateStatConfig = (side: "A" | "B", name: string, stat: Exclude<StatKey, "bst">, patch: Partial<StatConfig>) => {
    if (stat === "spe") { setSpeedConfigs(current => ({ ...current, [`${side}:${name}`]: { ...configFor(side, name), ...patch, ev: clampDraftStat(patch.ev ?? configFor(side, name).ev, format) } })); return; }
    setStatConfigs(current => ({ ...current, [`${side}:${name}:${stat}`]: { ...configForStat(side, name, stat), ...patch, ev: clampDraftStat(patch.ev ?? configForStat(side, name, stat).ev, format) } }));
  };
  const stageMultiplier = (stage: number) => stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
  const speedStat = (side: "A" | "B", name: string, ev: number, nature: SpeedConfig["nature"], stage: number) => {
    const base = baseSpeed(name); if (base == null) return null;
    const champions = isChampionsFormat(format);
    const level = champions ? 50 : 100;
    const statTerm = champions ? Math.max(2 * Math.max(0, Math.min(32, ev)) - 1, 0) : Math.floor(Math.max(0, Math.min(252, ev)) / 4);
    const raw = champions
      ? Math.floor((2 * base + 31 + statTerm) * level / 100) + 5
      : Math.floor((2 * base + 31 + statTerm) * level / 100) + 5;
    const natureValue = nature === "boost" ? 1.1 : nature === "hinder" ? 0.9 : 1;
    let value = Math.floor(Math.floor(raw * natureValue) * stageMultiplier(stage));
    value = Math.floor(value * getWeatherSpeedAbilityMultiplier(enabledAbility(side, name), { weather: draftWeather, terrain: draftTerrain }));
    return value;
  };
  const effectiveSpeedFor = (side: "A" | "B", name: string) => {
    const config = configFor(side, name);
    return speedStat(side, name, config.ev, config.nature, config.stage);
  };
  const compareDraftSpeeds = (opponent: string) => {
    if (!matchupHover) return { label: "Speed unknown", tone: "unknown", title: "Effective Speed is unavailable" };
    const ownSide = matchupHover.side;
    const opponentSide = ownSide === "A" ? "B" : "A";
    const ownSpeed = effectiveSpeedFor(ownSide, matchupHover.name);
    const opponentSpeed = effectiveSpeedFor(opponentSide, opponent);
    if (ownSpeed === null || opponentSpeed === null) return { label: "Speed unknown", tone: "unknown", title: "Effective Speed is unavailable for this species" };
    if (opponentSpeed > ownSpeed) return { label: `Faster (${opponentSpeed} vs ${ownSpeed} Spe)`, tone: "faster", title: `Effective Speed: ${opponent} ${opponentSpeed} vs ${matchupHover.name} ${ownSpeed}` };
    if (opponentSpeed < ownSpeed) return { label: `Slower (${opponentSpeed} vs ${ownSpeed} Spe)`, tone: "slower", title: `Effective Speed: ${opponent} ${opponentSpeed} vs ${matchupHover.name} ${ownSpeed}` };
    return { label: `Speed tie (${ownSpeed} Spe)`, tone: "tie", title: `Effective Speed tie: ${opponent} and ${matchupHover.name} both have ${ownSpeed}` };
  };
  const speedTip = (name: string, side: "A" | "B", opponents: string[]): SpeedBenchmark[] => {
    const own = configFor(side, name);
    return opponents.filter(Boolean).map(opponent => {
      const targetConfig = configFor(side === "A" ? "B" : "A", opponent);
      const target = speedStat(side === "A" ? "B" : "A", opponent, targetConfig.ev, targetConfig.nature, targetConfig.stage);
      if (target == null) return null;
      const find = (nature: SpeedConfig["nature"]) => {
        for (let ev = 0; ev <= maxStatValue(format); ev += (isChampionsFormat(format) ? 1 : 4)) if ((speedStat(side, name, ev, nature, own.stage) ?? 0) > target) return ev;
        return null;
      };
      return { opponent, target, hindering: find("hinder"), neutral: find("neutral"), boosted: find("boost") };
    }).filter((row): row is SpeedBenchmark => row !== null && row.neutral !== 0 && (row.hindering !== null || row.neutral !== null || row.boosted !== null))
      .sort((a, b) => b.target - a.target || a.opponent.localeCompare(b.opponent));
  };
  const showSpeedHover = (event: MouseEvent<HTMLTableCellElement>, name: string, side: "A" | "B") => {
    const width = Math.min(370, window.innerWidth - 16);
    const height = Math.min(320, window.innerHeight - 16);
    const x = event.clientX + 12 + width > window.innerWidth - 8 ? event.clientX - width - 12 : event.clientX + 12;
    setSpeedHover({ side, name, x: Math.max(8, Math.min(x, window.innerWidth - width - 8)), y: Math.max(8, Math.min(event.clientY + 12, window.innerHeight - height - 8)) });
  };
  const cancelMatchupHoverHide = () => {
    if (matchupHoverTimer.current) clearTimeout(matchupHoverTimer.current);
    matchupHoverTimer.current = null;
  };
  const hideMatchupHover = () => {
    cancelMatchupHoverHide();
    matchupHoverTimer.current = setTimeout(() => setMatchupHover(null), 140);
  };
  const showMatchupHover = (event: MouseEvent<HTMLElement>, name: string, side: "A" | "B", kind: MatchupHoverKind) => {
    cancelMatchupHoverHide();
    const width = Math.min(460, window.innerWidth - 16);
    const height = Math.min(520, window.innerHeight - 16);
    const x = event.clientX + 14 + width > window.innerWidth - 8 ? event.clientX - width - 14 : event.clientX + 14;
    const belowY = event.clientY + 14;
    const y = belowY + height <= window.innerHeight - 8 ? belowY : Math.max(8, event.clientY - height - 14);
    setMatchupHover({ side, name, kind, x: Math.max(8, Math.min(x, window.innerWidth - width - 8)), y: Math.max(8, Math.min(y, window.innerHeight - height - 8)) });
  };
  const analysisFor = (side: "A" | "B", name: string) => matchupAnalyses[`${side}:${name}`];
  const matchupRowsFor = (side: "A" | "B", name: string, kind: MatchupHoverKind): DraftOpponentResult[] => {
    const rows = analysisFor(side, name)?.opponents || [];
    const filtered = kind === "hits" ? rows.filter(row => row.threat)
      : kind === "walls" ? rows.filter(row => row.attackerWalls)
      : kind === "hitBy" ? rows.filter(row => (row.bestReply?.maxPct || 0) >= 70)
      : rows.filter(row => row.wallsAttacker);
    return filtered.sort((a, b) => {
      const damage = (row: DraftOpponentResult) => kind === "walls" || kind === "hitBy" ? (row.bestReply?.maxPct || 0) : (row.bestAttack?.maxPct || 0);
      return kind === "walls" || kind === "walledBy" ? damage(a) - damage(b) : damage(b) - damage(a);
    });
  };
  const matchupCount = (side: "A" | "B", name: string, kind: MatchupHoverKind) => {
    const analysis = analysisFor(side, name);
    if (!analysis) return null;
    return matchupRowsFor(side, name, kind).length;
  };
  const matchupKindLabel: Record<MatchupHoverKind, string> = { hits: "Hits", walls: "Walls", hitBy: "Hit by", walledBy: "Walled by" };


  return <main className="draft-page">
    <header className="hero draft-hero">
      <div><span className="eyebrow">Pokemon Team Lab</span><h1>Draft Matchups</h1><p>Compare up to 12 Pokémon on each side, base Speed, abilities, and defensive type matchups.</p></div>
      <div className="hero-actions"><Link className="nav-link" href="/">Back to Team Lab</Link></div>
    </header>

    <section className="panel draft-controls">
      <div className="draft-preset-control"><label htmlFor="draft-preset">Matchup preset</label><select id="draft-preset" value={presetIndex} onChange={event => setPreset(Number(event.target.value))}>{PRESETS.map((preset, index) => <option key={preset.label} value={index}>{index + 1}. {savedMatchupNames[String(index)] || (index === presetIndex ? matchupName : preset.label)}</option>)}</select></div>
      <button type="button" className="primary" onClick={() => setSupportOpen(true)}>Support moves</button>
      <div className="draft-team-counts"><span>Team A: <strong>{activeA.length}/12</strong> · <strong>{totalPoints("A", activeA)} pts</strong></span><span>Team B: <strong>{activeB.length}/12</strong> · <strong>{totalPoints("B", activeB)} pts</strong></span></div>
      <button className="primary" type="button" onClick={openEditor}>Edit matchup</button>
    </section>

    <section className="panel">
      <div className="panel-title-row"><div><h2>{matchupName}</h2><p>Hover over a Speed value for EV / Stat Point calculations.</p></div><div className="draft-team-formats"><label>Weather <select value={draftWeather} onChange={event => setDraftWeather(event.target.value as typeof draftWeather)}><option value="">None</option><option value="Sun">Sun</option><option value="Rain">Rain</option><option value="Sand">Sand</option><option value="Snow">Snow</option></select></label><label>Terrain <select value={draftTerrain} onChange={event => setDraftTerrain(event.target.value as typeof draftTerrain)}><option value="">None</option><option value="Electric">Electric</option><option value="Grassy">Grassy</option><option value="Misty">Misty</option><option value="Psychic">Psychic</option></select></label><label>Mechanics Gen <select aria-label="Draft matchup battle mechanics generation" value={mechanicsGeneration} onChange={event => setMechanicsGeneration(Number(event.target.value))}>{Array.from({ length: 9 }, (_, i) => i + 1).map(gen => <option key={gen} value={gen}>Gen {gen}{gen === 1 ? " · RBY" : gen === 2 ? " · GSC" : gen === 3 ? " · ADV" : gen === 4 ? " · DPP" : gen === 5 ? " · BW" : gen === 6 ? " · XY" : gen === 7 ? " · SM" : gen === 8 ? " · SS" : " · SV"}</option>)}<option value={10}>Pokémon Champions</option></select></label><label className="draft-matchup-format-control">Matchup format<span><FormatSelector value={format} onChange={setFormat} /><button type="button" className="draft-filter-icon" aria-label="Move filters" title={`Current move filters: minimum accuracy ${moveFilter.minAccuracy}%; minimum priority ${moveFilter.minPriority}; whitelist ${moveFilter.whitelist.length ? moveFilter.whitelist.join(", ") : "none"}; blacklist ${moveFilter.blacklist.length ? moveFilter.blacklist.join(", ") : "none"}.`} onClick={() => { setMoveFilterDraft({ ...moveFilter }); setMovePicker(""); setMoveFilterOpen(true); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10m-7 6h4" /></svg></button></span></label></div></div>
      <div className="matrix-scroll draft-table-scroll"><table className="draft-matchup-table draft-matchup-table-symmetric">
        <thead><tr><th className="draft-sprite-heading" aria-label="Team A portrait"></th><th><button type="button" className="draft-heading-button" onClick={() => setTypeTeam("A")}>Team A</button></th>{(["bst", "spd", "spa", "def", "atk", "hp", "spe"] as StatKey[]).map(key => statHeading(key, "A"))}{(["spe", "hp", "atk", "def", "spa", "spd", "bst"] as StatKey[]).map(key => statHeading(key, "B"))}<th><button type="button" className="draft-heading-button" onClick={() => setTypeTeam("B")}>Team B</button></th><th className="draft-sprite-heading" aria-label="Team B portrait"></th></tr></thead>
        <tbody>{Array.from({ length: Math.max(0, lastRow + 1) }, (_, index) => {
          const a = sortedA[index] || "";
          const b = sortedB[index] || "";
          const abilitiesA = a ? abilitiesFor(a) : [];
          const abilitiesB = b ? abilitiesFor(b) : [];
          return <tr key={index}>
            <td className={`draft-mon-sprite-cell ${a && isTeraCaptain("A", a) ? "is-tera-captain" : ""}`}><PokemonSprite species={a} className="draft-mon-sprite" /></td>
            <td className={`draft-mon-entry ${a && isTeraCaptain("A", a) ? "is-tera-captain" : ""}`}><div className="draft-mon-details"><div className="draft-name-line" onMouseLeave={hideMatchupHover}><strong className="draft-pokemon-name">{a ? <>{a}{isTeraCaptain("A", a) ? <span className="draft-tera-name-marker" title={`Tera Captain · ${selectedTeraType("A", a) || "no Tera type"}`}> (T)</span> : null}</> : <span className="muted">—</span>}</strong>{a ? <span className="draft-matchup-counts">{(["hits", "walls", "hitBy", "walledBy"] as MatchupHoverKind[]).map(kind => <button type="button" key={kind} className={`draft-matchup-count ${matchupHover?.side === "A" && matchupHover.name === a && matchupHover.kind === kind ? "active" : ""}`} onMouseEnter={event => showMatchupHover(event, a, "A", kind)} onFocus={event => { const rect = event.currentTarget.getBoundingClientRect(); showMatchupHover({ clientX: rect.left, clientY: rect.top } as MouseEvent<HTMLElement>, a, "A", kind); }} onBlur={hideMatchupHover} title={`${matchupKindLabel[kind]}: matching opposing Pokémon`}>{matchupKindLabel[kind]} <b>{matchupCount("A", a, kind) ?? "…"}</b></button>)}</span> : null}{a && isTeraCaptain("A", a) ? <select className="draft-inline-tera-select" aria-label={`${a} Tera type`} title="Tera captain type" value={teraTypeValue("A", a)} onChange={event => setTeraTypeFor("A", a, event.target.value)}>{TERA_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select> : null}</div><div className="draft-type-pills">{a && speciesTypes(a).map(type => <span key={type} className={typeClass(type)} title={`Defensive type matchups for ${a}:\n${defensiveSummary(a, "A")}`}>{type}</span>)}</div><div className="draft-abilities">{abilitiesA.map(ability => { const defensiveEffect = Boolean(getAbilityDefenseEffect(ability)); const selected = enabledAbility("A", a) === ability; const title = `${ability}: ${getAbility(ability)?.desc || getAbility(ability)?.shortDesc || "No ability description available."}${defensiveEffect ? `\n${abilityDefenseDescription(ability)}` : "\nThis ability is used in damage calculations when enabled; it does not change the type-chart multipliers unless a defensive effect is listed."}`; return <span key={ability} className="draft-ability-entry"><button type="button" className={`draft-ability draft-ability-toggle ${selected ? "is-enabled" : ""}`} title={title} aria-pressed={selected} onClick={() => toggleAbility("A", a, ability)}>{shortAbilityName(ability)}{selected ? automaticBoostLabel("A", a, ability) : ""}</button>{selected && /supreme overlord/i.test(ability) ? <label className="draft-ability-extra">Fainted allies <select value={supremeFainted[`A:${a}`] ?? 0} onChange={event => setSupremeFainted(current => ({ ...current, [`A:${a}`]: Number(event.target.value) }))}>{[0,1,2,3,4,5].map(count => <option key={count} value={count}>{count}</option>)}</select></label> : null}</span>; })}</div></div></td>
            {(["bst", "spd", "spa", "def", "atk", "hp", "spe"] as StatKey[]).map(key => renderStatCell(a, "A", key))}
            {(["spe", "hp", "atk", "def", "spa", "spd", "bst"] as StatKey[]).map(key => renderStatCell(b, "B", key))}
            <td className={`draft-mon-entry ${b && isTeraCaptain("B", b) ? "is-tera-captain" : ""}`}><div className="draft-mon-details"><div className="draft-name-line" onMouseLeave={hideMatchupHover}><strong className="draft-pokemon-name">{b ? <>{b}{isTeraCaptain("B", b) ? <span className="draft-tera-name-marker" title={`Tera Captain · ${selectedTeraType("B", b) || "no Tera type"}`}> (T)</span> : null}</> : <span className="muted">—</span>}</strong>{b ? <span className="draft-matchup-counts">{(["hits", "walls", "hitBy", "walledBy"] as MatchupHoverKind[]).map(kind => <button type="button" key={kind} className={`draft-matchup-count ${matchupHover?.side === "B" && matchupHover.name === b && matchupHover.kind === kind ? "active" : ""}`} onMouseEnter={event => showMatchupHover(event, b, "B", kind)} onFocus={event => { const rect = event.currentTarget.getBoundingClientRect(); showMatchupHover({ clientX: rect.left, clientY: rect.top } as MouseEvent<HTMLElement>, b, "B", kind); }} onBlur={hideMatchupHover} title={`${matchupKindLabel[kind]}: matching opposing Pokémon`}>{matchupKindLabel[kind]} <b>{matchupCount("B", b, kind) ?? "…"}</b></button>)}</span> : null}{b && isTeraCaptain("B", b) ? <select className="draft-inline-tera-select" aria-label={`${b} Tera type`} title="Tera captain type" value={teraTypeValue("B", b)} onChange={event => setTeraTypeFor("B", b, event.target.value)}>{TERA_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select> : null}</div><div className="draft-type-pills">{b && speciesTypes(b).map(type => <span key={type} className={typeClass(type)} title={`Defensive type matchups for ${b}:\n${defensiveSummary(b, "B")}`}>{type}</span>)}</div><div className="draft-abilities">{abilitiesB.map(ability => { const defensiveEffect = Boolean(getAbilityDefenseEffect(ability)); const selected = enabledAbility("B", b) === ability; const title = `${ability}: ${getAbility(ability)?.desc || getAbility(ability)?.shortDesc || "No ability description available."}${defensiveEffect ? `\n${abilityDefenseDescription(ability)}` : "\nThis ability is used in damage calculations when enabled; it does not change the type-chart multipliers unless a defensive effect is listed."}`; return <span key={ability} className="draft-ability-entry"><button type="button" className={`draft-ability draft-ability-toggle ${selected ? "is-enabled" : ""}`} title={title} aria-pressed={selected} onClick={() => toggleAbility("B", b, ability)}>{shortAbilityName(ability)}{selected ? automaticBoostLabel("B", b, ability) : ""}</button>{selected && /supreme overlord/i.test(ability) ? <label className="draft-ability-extra">Fainted allies <select value={supremeFainted[`B:${b}`] ?? 0} onChange={event => setSupremeFainted(current => ({ ...current, [`B:${b}`]: Number(event.target.value) }))}>{[0,1,2,3,4,5].map(count => <option key={count} value={count}>{count}</option>)}</select></label> : null}</span>; })}</div></div></td>
            <td className={`draft-mon-sprite-cell ${b && isTeraCaptain("B", b) ? "is-tera-captain" : ""}`}><PokemonSprite species={b} className="draft-mon-sprite" /></td>
          </tr>;
        })}</tbody>
      </table></div>
      {lastRow < 0 && <p className="muted">Choose Pokémon with “Edit matchup” to populate the table.</p>}
    </section>

    {speedHover && (() => {
      const opponents = speedHover.side === "A" ? activeB : activeA;
      const rows = speedTip(speedHover.name, speedHover.side, opponents);
      return <div className="draft-speed-tooltip" role="tooltip" style={{ left: speedHover.x, top: speedHover.y }}>
        <strong>{speedHover.name} · Speed benchmarks</strong>
        {rows.length ? <table><thead><tr><th>Pokémon</th><th>Eff. speed</th><th>Hindering</th><th>Neutral</th><th>Boosting</th></tr></thead><tbody>{rows.map(row => <tr key={row.opponent}><th>{row.opponent}</th><td>{row.target}</td><td>{row.hindering === null ? "—" : `${row.hindering} ${statValueLabel(format)}`}</td><td>{row.neutral === null ? "—" : `${row.neutral} ${statValueLabel(format)}`}</td><td>{row.boosted === null ? "—" : `${row.boosted} ${statValueLabel(format)}`}</td></tr>)}</tbody></table> : <p>No additional reachable Speed benchmarks.</p>}
      </div>;
    })()}

    {matchupHover && <div className="draft-matchup-analysis-tooltip" role="tooltip" style={{ left: matchupHover.x, top: matchupHover.y }} onMouseEnter={cancelMatchupHoverHide} onMouseLeave={hideMatchupHover}>
      <strong className="draft-matchup-analysis-title">{matchupHover.name} · {matchupKindLabel[matchupHover.kind]} ({analysisFor(matchupHover.side, matchupHover.name) ? matchupRowsFor(matchupHover.side, matchupHover.name, matchupHover.kind).length : "…"})</strong>
      {matchupAnalysisLoading && !analysisFor(matchupHover.side, matchupHover.name) && <p className="muted">Precomputing matchup results…</p>}
      {(() => {
        const analysis = analysisFor(matchupHover.side, matchupHover.name);
        if (!analysis) return null;
        const kind = matchupHover.kind;
        const rows = matchupRowsFor(matchupHover.side, matchupHover.name, kind);
        const moveKey: "bestAttack" | "bestReply" = kind === "walls" || kind === "hitBy" ? "bestReply" : "bestAttack";
        const moveLine = (row: DraftOpponentResult) => {
          const result = row[moveKey];
          return result ? `${result.move} (${result.category.toLowerCase()} · ${result.stab ? "STAB" : "coverage"} · ${result.type}) · ${result.minPct.toFixed(0)}–${result.maxPct.toFixed(0)}%` : "No eligible move found";
        };
        const description = kind === "hits" ? "Opposing Pokémon this Pokémon can threaten (best move reaches at least 70% of the target’s HP. This damage threshold is fixed and is not changed by the move-accuracy filter. The Damages section below lists targets taking 35–70%."
          : kind === "walls" ? "Opposing Pokémon whose best eligible reply deals 35% damage or less to this Pokémon."
          : kind === "hitBy" ? "Opposing Pokémon whose best eligible move can deal at least 70% of this Pokémon’s HP. This damage threshold is fixed and is not changed by the move-accuracy filter."
          : "Opposing Pokémon this Pokémon struggles to threaten (its best eligible move tops out at 35% damage or less).";
        return <>
          <p className="draft-matchup-analysis-description">{description}</p>
          {rows.length ? <ul>{rows.map(row => {
            const speed = compareDraftSpeeds(row.species);
            return <li key={row.species}><b>{row.species}</b> <small className={`draft-speed-relation ${speed.tone}`} title={speed.title}>{speed.label}</small> — {moveLine(row)}{moveKey === "bestAttack" && row.bestAttack && row.bestAttack.chance70 > 0 ? <small> · ≥70% chance: {row.bestAttack.chance70.toFixed(1)}%</small> : null}</li>;
          })}</ul> : <p className="muted">No opposing Pokémon match this category.</p>}
          {kind === "hits" && <>
            <section className="draft-matchup-analysis-section"><strong>Damages ({analysis.opponents.filter(row => (row.bestAttack?.maxPct || 0) > 35 && (row.bestAttack?.maxPct || 0) < 70).length})</strong><p>Targets taking more than 35% and less than 70% from the best eligible move; not counted as Hits.</p>
              {analysis.opponents.some(row => (row.bestAttack?.maxPct || 0) > 35 && (row.bestAttack?.maxPct || 0) < 70) ? <ul>{analysis.opponents.filter(row => (row.bestAttack?.maxPct || 0) > 35 && (row.bestAttack?.maxPct || 0) < 70).sort((a,b)=>(b.bestAttack?.maxPct || 0)-(a.bestAttack?.maxPct || 0)).map(row => <li key={row.species}><b>{row.species}</b> — {row.bestAttack ? `${row.bestAttack.move} (${row.bestAttack.category.toLowerCase()}) · ${row.bestAttack.minPct.toFixed(0)}–${row.bestAttack.maxPct.toFixed(0)}%` : "—"}</li>)}</ul> : <p className="muted">No targets in this damage range.</p>}
            </section>
            <section className="draft-matchup-analysis-section draft-best-four" onMouseEnter={() => setBestFourOpen(true)} onMouseLeave={() => setBestFourOpen(false)}><button type="button" onFocus={() => setBestFourOpen(true)} onBlur={() => setBestFourOpen(false)}>Find best 4 moves</button>
              {bestFourOpen && <div className="draft-best-four-panel"><strong>Best move coverage (based on each target’s top move)</strong>{(() => { const counts = new Map<string, { move: string; category: string; type: string; hits: number; damage: number; targets: string[] }>(); for (const row of analysis.opponents) { const move = row.bestAttack; if (!move) continue; const entry = counts.get(move.move) || { move: move.move, category: move.category, type: move.type, hits: 0, damage: 0, targets: [] }; entry.damage += move.maxPct; if (move.maxPct >= 70) entry.hits++; entry.targets.push(`${row.species} ${move.maxPct.toFixed(0)}%`); counts.set(move.move, entry); } const selected = [...counts.values()].sort((a,b)=>b.hits-a.hits || b.damage-a.damage).slice(0,4); const chosen = new Set(selected.map(item=>item.move)); const chosenRows = analysis.opponents.filter(row=>row.bestAttack && chosen.has(row.bestAttack.move)); return <><ol>{selected.map(item=><li key={item.move}><b>{item.move}</b> <small>({item.category.toLowerCase()} · {item.type}) — {item.hits} hits, {item.damage.toFixed(0)} summed max-damage %</small></li>)}</ol><strong>Hits using these moves ({chosenRows.filter(row=>(row.bestAttack?.maxPct || 0)>=70).length})</strong><ul>{chosenRows.filter(row=>(row.bestAttack?.maxPct || 0)>=70).map(row=><li key={row.species}>{row.species} — {row.bestAttack?.move} {row.bestAttack?.maxPct.toFixed(0)}%</li>)}</ul><strong>Damages using these moves</strong><ul>{chosenRows.filter(row=>(row.bestAttack?.maxPct || 0)>35 && (row.bestAttack?.maxPct || 0)<70).map(row=><li key={row.species}>{row.species} — {row.bestAttack?.move} {row.bestAttack?.maxPct.toFixed(0)}%</li>)}</ul></>; })()}</div>}
            </section>
          </>}
          {kind === "hitBy" && <section className="draft-matchup-analysis-section"><strong>Damaged by ({analysis.opponents.filter(row => (row.bestReply?.maxPct || 0) > 35 && (row.bestReply?.maxPct || 0) < 70).length})</strong><p>Opponents whose best reply deals more than 35% and less than 70% to this Pokémon.</p><ul>{analysis.opponents.filter(row => (row.bestReply?.maxPct || 0) > 35 && (row.bestReply?.maxPct || 0) < 70).sort((a,b)=>(b.bestReply?.maxPct || 0)-(a.bestReply?.maxPct || 0)).map(row=><li key={row.species}><b>{row.species}</b> — {row.bestReply ? `${row.bestReply.move} (${row.bestReply.category.toLowerCase()}) · ${row.bestReply.minPct.toFixed(0)}–${row.bestReply.maxPct.toFixed(0)}%` : "—"}</li>)}</ul></section>}
          <small>Damage calculations are shared and cached across the matchup lists.</small>
        </>;
      })()}
    </div>}

    {typeTeam && <div className="draft-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setTypeTeam(null); }}>
      <section className="draft-modal draft-type-modal" role="dialog" aria-modal="true" aria-labelledby="draft-type-title">
        <div className="panel-title-row"><div><h2 id="draft-type-title">Team {typeTeam} defensive matchups</h2><p>Green indicates resistance or immunity; red indicates weakness.</p></div><button type="button" onClick={() => setTypeTeam(null)}>Close ×</button></div>
        <div className="matrix-scroll"><table className="draft-typechart-table draft-typechart-transposed">
          <thead><tr><th>Pokémon</th>{POKEMON_TYPES.map(type => { const roster = typeTeam === "A" ? sortedA : sortedB; const vals = roster.map(p => defensiveMultiplier(p, type, enabledAbility(typeTeam, p), selectedTeraType(typeTeam, p))); const good = vals.filter(v => v < 1).length; const bad = vals.filter(v => v > 1).length; return <th key={type} className={good > bad ? "type-head-good" : bad > good ? "type-head-bad" : ""}><span className={typeClass(type)}>{type}</span><small>{good}R · {bad}W</small></th>; })}</tr></thead>
          <tbody>
            <tr className="draft-stab-summary-row">
              <th>STAB</th>
              {POKEMON_TYPES.map(attackType => {
                const roster = typeTeam === "A" ? sortedA : sortedB;
                const opponents = typeTeam === "A" ? sortedB : sortedA;
                const stabMons = roster.filter(pokemon => hasStabMoveOfType(pokemon, attackType, selectedTeraType(typeTeam, pokemon)));
                const weakMons = opponents.filter(pokemon => defensiveMultiplier(pokemon, attackType, enabledAbility(typeTeam === "A" ? "B" : "A", pokemon), selectedTeraType(typeTeam === "A" ? "B" : "A", pokemon)) > 1);
                const resistMons = opponents.filter(pokemon => { const m = defensiveMultiplier(pokemon, attackType, enabledAbility(typeTeam === "A" ? "B" : "A", pokemon), selectedTeraType(typeTeam === "A" ? "B" : "A", pokemon)); return m > 0 && m < 1; });
                const count = stabMons.length;
                const alpha = count === 0 ? 0 : Math.min(0.62, 0.12 + 0.5 * count / Math.max(1, roster.length));
                const title = [`${attackType} STAB (${count}): ${stabMons.join(", ") || "none"}`, `Opponents weak: ${weakMons.join(", ") || "none"}`, `Opponents resist: ${resistMons.join(", ") || "none"}`, `Opponent weaknesses ${weakMons.length} · resistances ${resistMons.length}`].join("\n");
                const hasNetWeakness = count > 1 && weakMons.length > resistMons.length;
                return <td key={attackType} title={title} style={{ backgroundColor: `rgba(220, 55, 65, ${alpha})` }}><span>{count}</span>{hasNetWeakness ? <span className="draft-stab-weakness-indicator" aria-label="More opposing weaknesses than resistances" title={`Net weakness advantage: ${weakMons.length} weak, ${resistMons.length} resist`}> ▲</span> : null}</td>;
              })}
            </tr>
            {(typeTeam === "A" ? sortedA : sortedB).map(pokemon => { const tera = selectedTeraType(typeTeam, pokemon); const captain = isTeraCaptain(typeTeam, pokemon); return <tr key={pokemon} className={captain ? "draft-type-tera-captain" : ""}><th>{pokemon}{captain ? <span className="draft-tera-name-marker" title={`Tera Captain${tera ? ` · ${tera} Tera` : ""}`}> (T){tera ? <small> · {tera}</small> : null}</span> : null}</th>{POKEMON_TYPES.map(attackType => { const value = defensiveMultiplier(pokemon, attackType, enabledAbility(typeTeam, pokemon), tera); return <td key={attackType} className={`type-multiplier ${value === 0 ? "immune" : value < 1 ? "resist" : value > 1 ? "weak" : "neutral"}`}>{multiplierLabel(value)}</td>; })}</tr>; })}
          </tbody>
        </table></div>
      </section>
    </div>}

    {supportOpen && <SupportCategoryPanel left={asTeam(activeA)} right={asTeam(activeB)} format={format} onClose={() => setSupportOpen(false)} draftMode />}

    {speedEdit && <div className="draft-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSpeedEdit(null); }}><section className="draft-modal draft-speed-modal" role="dialog" aria-modal="true" aria-label={`${speedEdit.name} ${STAT_LABELS[speedEdit.stat]} settings`}><div className="panel-title-row"><div><h2>{speedEdit.name} · {STAT_LABELS[speedEdit.stat]} settings</h2><p>Base stats remain displayed in the table; these settings are saved for matchup planning and stat calculations. {isChampionsFormat(format) ? "Champions uses Stat Points (0–32 per stat)." : "Standard formats use EVs (0–252 per stat)."}</p></div><div className="draft-stat-modal-actions"><button type="button" title="Reset this stat's EVs or Stat Points, nature, and stage." onClick={() => updateStatConfig(speedEdit.side, speedEdit.name, speedEdit.stat, { ev: 0, nature: "neutral", stage: 0 })}>Reset this stat</button><button type="button" onClick={() => setSpeedEdit(null)}>Close ×</button></div></div>{(() => { const cfg = configForStat(speedEdit.side, speedEdit.name, speedEdit.stat); const isHp = speedEdit.stat === "hp"; return <div className="draft-speed-fields"><label>{STAT_LABELS[speedEdit.stat]} {statValueLabel(format)} <span className="draft-ev-input-with-max"><input type="number" min="0" max={maxStatValue(format)} step={isChampionsFormat(format) ? 1 : 4} value={cfg.ev} onChange={e => updateStatConfig(speedEdit.side, speedEdit.name, speedEdit.stat, { ev: clampDraftStat(Number(e.target.value), format) })} /><button type="button" onClick={() => updateStatConfig(speedEdit.side, speedEdit.name, speedEdit.stat, { ev: maxStatValue(format) })}>Max {maxStatValue(format)}</button></span></label>{!isHp && <label>Nature<select value={cfg.nature} onChange={e => updateStatConfig(speedEdit.side, speedEdit.name, speedEdit.stat, { nature: e.target.value as StatConfig["nature"] })}><option value="boost">Boosting (+{STAT_LABELS[speedEdit.stat]})</option><option value="neutral">Neutral</option><option value="hinder">Hindering (−{STAT_LABELS[speedEdit.stat]})</option></select></label>}{!isHp && <label>{STAT_LABELS[speedEdit.stat]} stage<select value={cfg.stage} onChange={e => updateStatConfig(speedEdit.side, speedEdit.name, speedEdit.stat, { stage: Number(e.target.value) })}>{Array.from({length: 13}, (_, i) => i - 6).map(stage => <option key={stage} value={stage}>{stage > 0 ? `+${stage}` : stage}</option>)}</select></label>}</div>; })()}</section></div>}

    {moveFilterOpen && <div className="draft-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setMoveFilterOpen(false); }}><section className="draft-modal draft-move-filter-modal" role="dialog" aria-modal="true" aria-labelledby="draft-move-filter-title"><div className="panel-title-row"><div><h2 id="draft-move-filter-title">Move filters · {matchupName}</h2><p>Filters apply to both attacking directions. Whitelisted moves bypass accuracy and priority thresholds, but blacklist entries always win. Settings are saved separately for each matchup.</p></div><button type="button" onClick={() => setMoveFilterOpen(false)}>Close ×</button></div><label>Minimum move accuracy: <strong>{moveFilterDraft.minAccuracy}%</strong><input type="range" min="0" max="100" step="5" value={moveFilterDraft.minAccuracy} onChange={event => setMoveFilterDraft(current => ({ ...current, minAccuracy: Number(event.target.value) }))} /><small>Moves with accuracy below this value are excluded. Moves with unspecified accuracy count as 100%.</small></label><label>Minimum move priority: <strong>{moveFilterDraft.minPriority}</strong><input type="range" min="-7" max="5" step="1" value={moveFilterDraft.minPriority} onChange={event => setMoveFilterDraft(current => ({ ...current, minPriority: Number(event.target.value) }))} /><small>Moves below this priority are excluded unless explicitly whitelisted. Default: 0.</small></label><datalist id="draft-move-options">{moveNames.map(move => <option key={move} value={move} />)}</datalist><div className="draft-move-filter-picker"><label htmlFor="draft-move-picker">Add a move</label><input id="draft-move-picker" list="draft-move-options" value={movePicker} onChange={event => setMovePicker(event.target.value)} placeholder="Search moves…" /><button type="button" onClick={() => { const found = moveNames.find(name => name.toLowerCase() === movePicker.trim().toLowerCase()); if (!found) return; setMoveFilterDraft(current => ({ ...current, whitelist: current.whitelist.includes(found) ? current.whitelist : [...current.whitelist, found] })); setMovePicker(""); }}>Add to whitelist</button><button type="button" onClick={() => { const found = moveNames.find(name => name.toLowerCase() === movePicker.trim().toLowerCase()); if (!found) return; setMoveFilterDraft(current => ({ ...current, blacklist: current.blacklist.includes(found) ? current.blacklist : [...current.blacklist, found] })); setMovePicker(""); }}>Add to blacklist</button></div><div className="draft-move-filter-lists"><label>Whitelist · always include these moves (unless blacklisted)<textarea rows={Math.max(3, Math.min(12, moveFilterDraft.whitelist.length || 3))} value={moveFilterDraft.whitelist.join("\n")} onChange={event => setMoveFilterDraft(current => ({ ...current, whitelist: event.target.value.split(/[\n,]+/).map(value => value.trim()).filter(Boolean) }))} placeholder="Leave empty to allow all moves" /></label><label>Blacklist · always excluded<textarea rows={Math.max(3, Math.min(12, moveFilterDraft.blacklist.length || 3))} value={moveFilterDraft.blacklist.join("\n")} onChange={event => setMoveFilterDraft(current => ({ ...current, blacklist: event.target.value.split(/[\n,]+/).map(value => value.trim()).filter(Boolean) }))} placeholder="No excluded moves" /></label></div><div className="button-row draft-editor-actions"><button type="button" onClick={() => setMoveFilterDraft(DEFAULT_DRAFT_MOVE_FILTER)}>Reset defaults</button><button type="button" onClick={() => { setMoveFilter(moveFilterDraft); setMoveFilterOpen(false); }}>Apply filters</button></div></section></div>}

    {editorOpen && <div className="draft-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeEditor(); }}>
      <section className="draft-modal" role="dialog" aria-modal="true" aria-labelledby="draft-editor-title">
        <div className="panel-title-row"><div><h2 id="draft-editor-title">Edit matchup Pokémon</h2><p>Use an empty slot to reduce either roster below 12 Pokémon.</p></div><button type="button" onClick={closeEditor} aria-label="Close editor">×</button></div>
        <label className="draft-matchup-name">Matchup name<input value={draftMatchupName} onChange={event => setDraftMatchupName(event.target.value)} onBlur={() => { /* committed when the editor closes */ }} /></label><label className="draft-format-label">Matchup format<FormatSelector value={format} onChange={setFormat} /></label><div className="draft-editor-teams">
          {[{ label: "Team A", side: "A" as const, roster: draftA }, { label: "Team B", side: "B" as const, roster: draftB }].map(({ label, side, roster }) => <div className="draft-editor-team" key={side}>
            <h3>{label} · {totalPoints(side, roster.filter(Boolean))} points</h3>
            {roster.map((pokemon, index) => <div className="draft-editor-slot" key={`${side}-${index}`}>
              <span className="draft-editor-slot-label">Slot {index + 1}</span>
              <AutocompleteInput ariaLabel={`${label} slot ${index + 1} Pokémon`} value={pokemon} options={["", ...species]} onChange={value => updateDraft(side, index, value)} />
              {pokemon ? <label className="draft-points-field">Pts <input type="text" inputMode="numeric" value={String(pointsFor(side, pokemon))} onChange={event => setPointsFor(side, pokemon, Number(event.target.value.replace(/[^0-9]/g, "")) || 0)} /></label> : <span className="draft-editor-empty-control" />}
              {pokemon ? <label className="draft-tera-captain-field"><input type="checkbox" checked={isTeraCaptain(side, pokemon)} onChange={event => setTeraCaptain(side, pokemon, event.target.checked)} /> Captain</label> : <span className="draft-editor-empty-control" />}
            </div>)}
          </div>)}
        </div>
        <div className="draft-bulk-rosters">
          {[{ label: "Team A", side: "A" as const, value: bulkA, setValue: setBulkA }, { label: "Team B", side: "B" as const, value: bulkB, setValue: setBulkB }].map(team => <section key={team.side}><label>{team.label} · one Pokémon per line<textarea rows={Math.max(3, Math.min(12, team.value.split(/\r?\n/).length))} value={team.value} onChange={event => team.setValue(event.target.value)} placeholder={"Garchomp\nRotom-Wash\nCorviknight"} /></label><div className="button-row"><button type="button" onClick={() => applyBulkRoster(team.side)}>Apply list</button><button type="button" onClick={() => copyRoster(team.side)}>Copy team</button></div></section>)}
        <div className="button-row draft-copy-both"><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(`Team A\n${draftA.filter(Boolean).join("\n")}\n\nTeam B\n${draftB.filter(Boolean).join("\n")}`); } catch { setBulkError("Clipboard access was blocked by the browser."); } }}>Copy both teams</button></div></div>{bulkError && <p role="alert" className="draft-bulk-error">{bulkError}</p>}
        
        <div className="button-row draft-editor-actions"><button type="button" onClick={() => { const empty = Array.from({ length: 12 }, () => ""); setDraftA(empty); setDraftB(empty); setTeamA(empty); setTeamB(empty); }}>Clear both teams</button><button type="button" onClick={closeEditor}>Close</button></div>
      </section>
    </div>}
  </main>;
}
