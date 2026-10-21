"use client";

import { useEffect, useMemo, useState } from "react";
import { Dex } from "@pkmn/dex";
import { Team, PokemonSet } from "../lib/types";
import categoriesData from "../data/support-categories.json";
import { getSpeciesLearnset } from "../lib/learnsets";
import { getMoveDescription } from "../lib/move-descriptions";
import { getAbilityDescription } from "../lib/item-ability-descriptions";
import PokemonSprite from "./PokemonSprite";
import CycleToggleButton from "./CycleToggleButton";

type Category = { id: string; label: string; moves: string[]; abilities: string[]; note?: string; doubles?: boolean };
type Entry = { key: string; species: string; move?: string; ability?: string; side: "Team A" | "Team B"; fainted: boolean };
const CATEGORIES = categoriesData as Category[];
const id = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export default function SupportCategoryPanel({ left, right, format, doubles, onClose }: { left: Team; right: Team; format: string; doubles: boolean; onClose: () => void }) {
  const [teamFilter, setTeamFilter] = useState<"both" | "A" | "B">("both");
  const [pokemonFilter, setPokemonFilter] = useState<"living" | "all">("living");
  const [learnsets, setLearnsets] = useState<Record<string, Set<string> | null>>({});
  const [learnsetRevision, setLearnsetRevision] = useState(0);

  useEffect(() => {
    const refresh = () => setLearnsetRevision(value => value + 1);
    window.addEventListener("ptl-learnsets-refreshed", refresh);
    return () => window.removeEventListener("ptl-learnsets-refreshed", refresh);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const species = [...new Set([...left, ...right].filter(p => !/^Empty Slot/.test(p.name) && p.species).map(p => p.species))];
    Promise.all(species.map(async name => [id(name), await getSpeciesLearnset(name, format)] as const)).then(entries => {
      if (!cancelled) setLearnsets(previous => ({ ...previous, ...Object.fromEntries(entries) }));
    }).catch(() => { /* keep unknown learnsets unmarked rather than claiming illegality */ });
    return () => { cancelled = true; };
  }, [left, right, format, learnsetRevision]);

  const categoryEntries = useMemo(() => CATEGORIES.filter(category => !category.doubles || doubles).map(category => {
    const entries: Entry[] = ([{ label: "Team A" as const, team: left, code: "A" as const }, { label: "Team B" as const, team: right, code: "B" as const }])
      .filter(side => teamFilter === "both" || side.code === teamFilter)
      .flatMap(side => side.team.flatMap((pokemon: PokemonSet) => {
        if (/^Empty Slot/.test(pokemon.name) || !pokemon.species) return [];
        if (pokemonFilter === "living" && pokemon.dead) return [];
        const learnset = learnsets[id(pokemon.species)];
        const moves = category.moves.filter(move => learnset ? learnset.has(id(move)) : false);
        const result: Entry[] = moves.map(move => ({ key: `${category.id}-${side.code}-${pokemon.species}-${move}`, species: pokemon.species, move, side: side.label, fainted: Boolean(pokemon.dead) }));
        let availableAbilities: string[] = [];
        try {
          const speciesData = (Dex.species as unknown as { get: (name: string) => { abilities?: Record<string, string> } }).get(pokemon.species);
          availableAbilities = Object.values(speciesData.abilities || {}).filter(Boolean);
        } catch { /* unknown species has no ability list */ }
        for (const ability of category.abilities.filter(candidate => availableAbilities.some(available => id(available) === id(candidate)))) {
          result.push({ key: `${category.id}-${side.code}-${pokemon.species}-ability-${ability}`, species: pokemon.species, ability, side: side.label, fainted: Boolean(pokemon.dead) });
        }
        return result;
      }));
    return { category, entries };
  }), [left, right, teamFilter, pokemonFilter, learnsets, doubles]);

  return <div className="teams-modal-backdrop support-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="panel support-panel teams-modal support-modal">
    <div className="panel-title-row"><div><h2>Move Support</h2><p>Learnable category moves and selected abilities for the selected teams.</p></div><button type="button" onClick={onClose}>Close</button></div>
    <div className="support-filters" aria-label="Team Support filters">
      <div className="support-toggle-group" role="group" aria-label="Teams to show">
        <CycleToggleButton className="active" label="Teams" value={teamFilter === "both" ? "Both" : teamFilter === "A" ? "Team A" : "Team B"} onClick={() => setTeamFilter(current => current === "both" ? "A" : current === "A" ? "B" : "both")} />
      </div>
      <div className="support-toggle-group" role="group" aria-label="Pokémon status filter">
        <CycleToggleButton className="active" label="Pokémon" value={pokemonFilter === "living" ? "Living only" : "All, including fainted"} onClick={() => setPokemonFilter(current => current === "living" ? "all" : "living")} />
      </div>
    </div>
    <div className="support-category-columns">
      {categoryEntries.map(({ category, entries }) => <section className="support-category-column" key={category.id}>
        <header className="support-category-heading"><h3>{category.label}</h3><span>{entries.length}</span></header>
        {entries.length === 0 ? <p className="support-empty">No available options</p> : <div className="support-category-entries">{entries.map(entry => <div className={`support-entry support-entry-line${entry.fainted ? " is-fainted" : ""}`} key={entry.key} title={`${entry.species} · ${entry.side}${entry.fainted ? " · Fainted" : ""}`}>
          <PokemonSprite species={entry.species} className="support-pokemon-sprite" />
          <span className="support-entry-option" title={entry.move ? `${entry.move} — ${getMoveDescription(entry.move) || "No move description available."}` : `${entry.ability} — ${getAbilityDescription(entry.ability || "")}`}>{entry.move || entry.ability}</span>
          {entry.ability && <span className="support-ability-marker" title={id(entry.ability) === id(([...left, ...right].find(p => p.species === entry.species)?.ability || "")) ? "Active ability" : "Other ability available to this species"}>{id(entry.ability) === id(([...left, ...right].find(p => p.species === entry.species)?.ability || "")) ? "A" : "P"}</span>}
          <span className={`support-side-marker ${entry.side === "Team A" ? "team-a" : "team-b"}`} title={entry.side}>{entry.side === "Team A" ? "A" : "B"}</span>
        </div>)}</div>}
      </section>)}
    </div>
    <p className="support-footnote">Moves are shown from the full species learnset; format bans and team rules are checked separately by Pokémon Showdown validation. A marks the active ability; P marks another ability available to that species. Doubles-only categories appear only while Doubles mechanics is enabled. The Living Pokémon filter excludes fainted Pokémon; All Pokémon includes them.</p>
  </section></div>;
}
