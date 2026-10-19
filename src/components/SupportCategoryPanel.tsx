"use client";

import { useMemo } from "react";
import { Dex } from "@pkmn/dex";
import { Team } from "../lib/types";
import categoriesData from "../data/support-categories.json";

type Category = { id: string; label: string; moves: string[]; abilities: string[]; note?: string };
type Entry = { key: string; side: string; pokemon: string; species: string; moves: string[]; ability: string };
const CATEGORIES = categoriesData as Category[];
const id = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
function moveLegalForSpecies(species: string, move: string): boolean | null {
  try {
    const dex = Dex as unknown as { learnsets?: { get: (name: string) => { learnset?: Record<string, unknown> } | undefined } };
    const learnset = dex.learnsets?.get(species)?.learnset;
    if (!learnset) return null;
    return Boolean(learnset[id(move)]);
  } catch { return null; }
}

export default function SupportCategoryPanel({ left, right, format }: { left: Team; right: Team; format: string }) {
  const categoryEntries = useMemo(() => CATEGORIES.map(category => {
    const entries: Entry[] = ([{ label: "Team A", team: left }, { label: "Team B", team: right }]).flatMap(side => side.team.flatMap((pokemon, index) => {
      if (pokemon.dead || /^Empty Slot/.test(pokemon.name) || !pokemon.species) return [];
      const moves = pokemon.moves.filter(Boolean).filter(move => category.moves.some(candidate => id(candidate) === id(move)))
        .filter(move => moveLegalForSpecies(pokemon.species, move) !== false);
      const ability = category.abilities.some(candidate => id(candidate) === id(pokemon.ability)) ? pokemon.ability : "";
      if (!moves.length && !ability) return [];
      return [{ key: `${category.id}-${side.label}-${index}-${pokemon.species}`, side: side.label, pokemon: pokemon.name || pokemon.species, species: pokemon.species, moves, ability }];
    }));
    return { category, entries };
  }), [left, right]);

  return <section className="support-panel">
    <div className="panel-title-row"><div><h2>Team Support</h2><p>Options available from living Pokémon only. Categories may overlap; only currently known, learnset-valid moves and selected abilities are listed.</p></div></div>
    <div className="support-category-columns">
      {categoryEntries.map(({ category, entries }) => <section className="support-category-column" key={category.id}>
        <header className="support-category-heading"><h3>{category.label}</h3><span>{entries.length}</span></header>
        {category.note && <p className="support-note">{category.note}</p>}
        {entries.length === 0 ? <p className="support-empty">No available options</p> : <div className="support-category-entries">{entries.map(entry => <article className="support-entry" key={entry.key}>
          <div className="support-entry-title"><strong>{entry.pokemon}</strong><span>{entry.side}</span></div>
          <small>{entry.species}</small>
          <div className="support-tags">{entry.moves.map(move => <span className="support-tag" key={move}>{move}</span>)}{entry.ability && <span className="support-tag ability">Ability: {entry.ability}</span>}</div>
        </article>)}</div>}
      </section>)}
    </div>
    <p className="support-footnote">Format: {format}. Species learnsets are checked where available; custom format bans and draft-specific rules are not yet fully validated. Abilities are listed only when selected on the Pokémon. Fainted Pokémon and empty slots are excluded.</p>
  </section>;
}
