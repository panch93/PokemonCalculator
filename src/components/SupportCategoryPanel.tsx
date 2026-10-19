"use client";

import { useEffect, useMemo, useState } from "react";
import { Dex } from "@pkmn/dex";
import { Team, PokemonSet } from "../lib/types";
import categoriesData from "../data/support-categories.json";
import { getSpeciesLearnset } from "../lib/learnsets";
import { getMoveDescription } from "../lib/move-descriptions";
import { getAbilityDescription } from "../lib/item-ability-descriptions";

type Category = { id: string; label: string; moves: string[]; abilities: string[]; note?: string };
type Entry = { key: string; species: string; move?: string; ability?: string; side: "Team A" | "Team B"; fainted: boolean };
const CATEGORIES = categoriesData as Category[];
const id = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
function spriteUrl(species: string) {
  const slug = species.toLowerCase().replace(/♀/g, "-f").replace(/♂/g, "-m").replace(/[.’']/g, "").replace(/[^a-z0-9-]/g, "").replace(/-/g, "");
  return `https://play.pokemonshowdown.com/sprites/gen5/${slug}.png`;
}
function PokemonSprite({ species }: { species: string }) {
  return <img className="support-pokemon-sprite" src={spriteUrl(species)} alt={species} title={species} loading="lazy" onError={event => { event.currentTarget.style.visibility = "hidden"; }} />;
}

export default function SupportCategoryPanel({ left, right, format }: { left: Team; right: Team; format: string }) {
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

  const categoryEntries = useMemo(() => CATEGORIES.map(category => {
    const entries: Entry[] = ([{ label: "Team A" as const, team: left, code: "A" as const }, { label: "Team B" as const, team: right, code: "B" as const }])
      .filter(side => teamFilter === "both" || side.code === teamFilter)
      .flatMap(side => side.team.flatMap((pokemon: PokemonSet) => {
        if (/^Empty Slot/.test(pokemon.name) || !pokemon.species) return [];
        if (pokemonFilter === "living" && pokemon.dead) return [];
        const learnset = learnsets[id(pokemon.species)];
        const moves = category.moves.filter(move => learnset ? learnset.has(id(move)) : false);
        const ability = category.abilities.some(candidate => id(candidate) === id(pokemon.ability)) ? pokemon.ability : "";
        const result: Entry[] = moves.map(move => ({ key: `${category.id}-${side.code}-${pokemon.species}-${move}`, species: pokemon.species, move, side: side.label, fainted: Boolean(pokemon.dead) }));
        if (ability) result.push({ key: `${category.id}-${side.code}-${pokemon.species}-ability-${ability}`, species: pokemon.species, ability, side: side.label, fainted: Boolean(pokemon.dead) });
        return result;
      }));
    return { category, entries };
  }), [left, right, teamFilter, pokemonFilter, learnsets]);

  return <section className="support-panel">
    <div className="panel-title-row"><div><h2>Team Support</h2><p>Lists category moves from each Pokémon’s learnset, not just its currently equipped moves. Abilities use the Pokémon’s selected ability.</p></div></div>
    <div className="support-filters" aria-label="Team Support filters">
      <div className="support-toggle-group" role="group" aria-label="Teams to show">
        <button type="button" className="active" aria-pressed="true" onClick={() => setTeamFilter(current => current === "both" ? "A" : current === "A" ? "B" : "both")}>Teams: {teamFilter === "both" ? "Both" : teamFilter === "A" ? "Team A" : "Team B"} · Change</button>
      </div>
      <div className="support-toggle-group" role="group" aria-label="Pokémon status filter">
        <button type="button" className="active" aria-pressed="true" onClick={() => setPokemonFilter(current => current === "living" ? "all" : "living")}>Pokémon: {pokemonFilter === "living" ? "Living only" : "All, including fainted"} · Change</button>
      </div>
    </div>
    <div className="support-category-columns">
      {categoryEntries.map(({ category, entries }) => <section className="support-category-column" key={category.id}>
        <header className="support-category-heading"><h3>{category.label}</h3><span>{entries.length}</span></header>
        {entries.length === 0 ? <p className="support-empty">No available options</p> : <div className="support-category-entries">{entries.map(entry => <div className={`support-entry support-entry-line${entry.fainted ? " is-fainted" : ""}`} key={entry.key} title={`${entry.species} · ${entry.side}${entry.fainted ? " · Fainted" : ""}`}>
          <PokemonSprite species={entry.species} />
          <span className="support-entry-option" title={entry.move ? `${entry.move} — ${getMoveDescription(entry.move) || "No move description available."}` : `${entry.ability} — ${getAbilityDescription(entry.ability || "")}`}>{entry.move || entry.ability}</span>
          {entry.ability && <span className="support-ability-marker" title="Selected ability">A</span>}
          <span className={`support-side-marker ${entry.side === "Team A" ? "team-a" : "team-b"}`} title={entry.side}>{entry.side === "Team A" ? "A" : "B"}</span>
        </div>)}</div>}
      </section>)}
    </div>
    <p className="support-footnote">Format: {format}. Moves are listed when present in the species learnset available in the local Pokédex data; format bans and draft-specific restrictions are not yet fully validated. The Living Pokémon filter excludes fainted Pokémon; All Pokémon includes them.</p>
  </section>;
}
