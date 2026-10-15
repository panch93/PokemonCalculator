"use client";

import { getPokemonTypes } from "../lib/calc";
import { Team } from "../lib/types";

const TYPES = ["", "Normal", "Fire", "Water", "Electric", "Grass", "Ice", "Fighting", "Poison", "Ground", "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy", "Stellar"];
type Props = { title: string; team: Team; selected: number; onSelect: (index: number) => void; onUpdate: (index: number, patch: Partial<Team[number]>) => void };
function typeClass(type: string) { return `type-badge type-${type.toLowerCase().replace(/[^a-z]/g, "")}`; }

export default function TeamColumn({ title, team, selected, onSelect, onUpdate }: Props) {
  return <section className="team-column">
    <div className="team-column-header"><div><span className="eyebrow">{title}</span><h2>{team.length}/6 loaded</h2></div></div>
    <div className="team-list">{team.map((poke, index) => (
      <div key={`${poke.name}-${index}`} className={`pokemon-card-wrap ${poke.dead ? "pokemon-dead" : ""}`}>
        <button className={`pokemon-card ${selected === index ? "selected" : ""}`} onClick={() => onSelect(index)}>
          <span className="slot">{index + 1}</span>
          <span className="poke-main"><strong>{poke.name || poke.species}</strong><small>{poke.species}</small><span className="type-list">{getPokemonTypes(poke).map(type => <span className={typeClass(type)} key={type}>{type}</span>)}</span></span>
          <span className="poke-meta">{poke.item || "No item"}</span>
        </button>
        <div className="pokemon-card-options"><label>Tera <select aria-label={`${poke.name} Tera type`} value={poke.teraType || ""} disabled={!poke.importedTeraType} onChange={e => onUpdate(index, { teraType: e.target.value })}><option value="">None</option>{poke.importedTeraType && <option value={poke.importedTeraType}>{poke.importedTeraType}</option>}</select></label><label className="dead-toggle"><input type="checkbox" checked={Boolean(poke.dead)} onChange={e => onUpdate(index, { dead: e.target.checked })}/> Fainted</label></div>
      </div>
    ))}</div>
  </section>;
}
