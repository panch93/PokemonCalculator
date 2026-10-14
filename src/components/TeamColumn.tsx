"use client";

import { getPokemonTypes } from "../lib/calc";
import { Team } from "../lib/types";

type Props = { title: string; team: Team; selected: number; onSelect: (index: number) => void };
function typeClass(type: string) { return `type-badge type-${type.toLowerCase().replace(/[^a-z]/g, "")}`; }

export default function TeamColumn({ title, team, selected, onSelect }: Props) {
  return <section className="team-column">
    <div className="team-column-header"><div><span className="eyebrow">{title}</span><h2>{team.length}/6 loaded</h2></div></div>
    <div className="team-list">{team.map((poke, index) => (
      <button key={`${poke.name}-${index}`} className={`pokemon-card ${selected === index ? "selected" : ""}`} onClick={() => onSelect(index)}>
        <span className="slot">{index + 1}</span>
        <span className="poke-main"><strong>{poke.name || poke.species}</strong><small>{poke.species}</small><span className="type-list">{getPokemonTypes(poke).map(type => <span className={typeClass(type)} key={type}>{type}</span>)}</span></span>
        <span className="poke-meta">{poke.item || "No item"}</span>
      </button>
    ))}</div>
  </section>;
}
