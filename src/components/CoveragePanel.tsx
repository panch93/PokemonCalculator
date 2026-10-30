"use client";
import { useEffect, useMemo, useState } from "react";
import { Team, PokemonSet } from "../lib/types";
import { getSpeciesLearnset } from "../lib/learnsets";
import { getMoveDetails } from "../lib/calc";
import PokemonSprite from "./PokemonSprite";
import { getMoveNameMap } from "../lib/showdown-data";

type Props = { left: Team; right: Team; format: string; generation: number; onClose: () => void };
const id = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const TYPES = ["Normal", "Fire", "Water", "Electric", "Grass", "Ice", "Fighting", "Poison", "Ground", "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy"];
type Entry = { species: string; move: string; side: "Team A" | "Team B"; fainted: boolean };
export default function CoveragePanel({ left, right, format, generation, onClose }: Props) {
  const [type, setType] = useState("All");
  const [teamFilter, setTeamFilter] = useState<"both" | "A" | "B">("both");
  const [includeFainted, setIncludeFainted] = useState(false);
  const [moveSearch, setMoveSearch] = useState("");
  const [learnsets, setLearnsets] = useState<Record<string, Set<string> | null>>({});
  const [revision, setRevision] = useState(0);
  const moveNames = useMemo(() => getMoveNameMap(), [revision]);
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener("ptl-learnsets-refreshed", refresh);
    return () => window.removeEventListener("ptl-learnsets-refreshed", refresh);
  }, []);
  useEffect(() => {
    let cancelled = false;
    const names = [...new Set([...left, ...right].filter(p => p.species && !/^Empty Slot/.test(p.name)).map(p => p.species))];
    Promise.all(names.map(async species => [id(species), await getSpeciesLearnset(species, format)] as const)).then(rows => {
      if (!cancelled) setLearnsets(previous => ({ ...previous, ...Object.fromEntries(rows) }));
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [left, right, format, revision]);
  const entries = useMemo(() => ([{ team: left, side: "Team A" as const, code: "A" as const }, { team: right, side: "Team B" as const, code: "B" as const }])
    .filter(group => teamFilter === "both" || group.code === teamFilter)
    .flatMap(group => group.team.flatMap((pokemon: PokemonSet) => {
      if (!pokemon.species || /^Empty Slot/.test(pokemon.name) || (!includeFainted && pokemon.dead)) return [];
      const moves = [...(learnsets[id(pokemon.species)] || new Set<string>())];
      return moves.map(moveId => moveNames.get(moveId)).filter((move): move is string => Boolean(move)).filter(move => {
        const details = getMoveDetails(move, generation);
        return Boolean(details && (type === "All" || details.type === type) && ["Physical", "Special"].includes(details.category) && move.toLowerCase().includes(moveSearch.trim().toLowerCase()));
      }).map(move => ({ species: pokemon.species, move, side: group.side, fainted: Boolean(pokemon.dead) } as Entry));
    })), [left, right, teamFilter, includeFainted, learnsets, type, generation, moveNames, moveSearch]);
  const hasCoverageQuery = type !== "All" || moveSearch.trim().length > 0;
  const visibleEntries = hasCoverageQuery ? entries : [];
  const physical = visibleEntries.filter(entry => getMoveDetails(entry.move, generation)?.category === "Physical");
  const special = visibleEntries.filter(entry => getMoveDetails(entry.move, generation)?.category === "Special");
  const renderEntries = (rows: Entry[]) => rows.length ? rows.map((entry, i) => <div className={`coverage-entry${entry.fainted ? " is-fainted" : ""}`} key={`${entry.side}-${entry.species}-${entry.move}-${i}`} title={`${entry.species} · ${entry.side}${entry.fainted ? " · Fainted" : ""}\n\n${getMoveDetails(entry.move, generation)?.description || "No move description available."}`}><PokemonSprite species={entry.species} className="coverage-sprite" /><span>{entry.move}</span><small className={entry.side === "Team A" ? "team-a" : "team-b"}>{entry.side === "Team A" ? "A" : "B"}</small></div>) : <p className="support-empty">No moves found</p>;
  return <div className="teams-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="panel teams-modal coverage-modal"><div className="panel-title-row"><div><h2>Coverage</h2><p>Search learnable damaging moves by name, type, or both.</p></div><button type="button" onClick={onClose}>Close</button></div><div className="coverage-controls"><label>Move type <select value={type} onChange={event => setType(event.target.value)}><option value="All">All types</option>{TYPES.map(value => <option key={value}>{value}</option>)}</select></label><label className="coverage-move-search">Search move <input type="search" value={moveSearch} onChange={event => setMoveSearch(event.target.value)} placeholder="e.g. Ice Beam" /></label><button type="button" onClick={() => setTeamFilter(value => value === "both" ? "A" : value === "A" ? "B" : "both")}>Teams: {teamFilter === "both" ? "Both" : teamFilter === "A" ? "Team A" : "Team B"} · Change</button><button type="button" onClick={() => setIncludeFainted(value => !value)}>Pokémon: {includeFainted ? "Include fainted" : "Living only"} · Change</button></div>{!hasCoverageQuery && <p className="support-empty coverage-search-hint">Choose a move type or enter a move name to show coverage.</p>}<div className="coverage-columns"><section><h3>Physical <span>{physical.length}</span></h3>{renderEntries(physical)}</section><section><h3>Special <span>{special.length}</span></h3>{renderEntries(special)}</section></div><p className="support-footnote">Format: {format}. Learnset-derived coverage; format bans may not be represented.</p></section></div>;
}

