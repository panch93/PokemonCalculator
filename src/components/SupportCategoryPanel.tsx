"use client";

import { useMemo, useState } from "react";
import { Dex } from "@pkmn/dex";
import { Team } from "../lib/types";

type Category = { id: string; label: string; moves: string[]; abilities: string[]; note?: string };
const CATEGORIES: Category[] = [
  { id: "hazard-setting", label: "Hazard Setting", moves: ["Stealth Rock","Spikes","Toxic Spikes","Sticky Web","Ceaseless Edge","Stone Axe"], abilities: ["Toxic Debris"] },
  { id: "hazard-removal", label: "Hazard Removal", moves: ["Rapid Spin","Mortal Spin","Defog","Tidy Up","Court Change"], abilities: ["Magic Bounce"], note: "Magic Bounce prevents or reflects some hazard-setting moves; it does not clear hazards already on the field." },
  { id: "healing", label: "Healing", moves: ["Recover","Roost","Soft-Boiled","Slack Off","Shore Up","Synthesis","Moonlight","Morning Sun","Rest","Wish","Healing Wish","Lunar Dance","Life Dew","Pollen Puff","Floral Healing","Heal Order","Milk Drink","Strength Sap","Drain Punch","Giga Drain","Draining Kiss","Leech Life","Oblivion Wing","Bitter Blade","Parabolic Charge","Horn Leech","Absorb","Mega Drain","Matcha Gotcha","Jungle Healing","Aqua Ring","Ingrain","Pain Split","Heal Pulse","Lunar Blessing","Revival Blessing","Purify","Heal Bell","Aromatherapy"], abilities: ["Regenerator","Natural Cure","Poison Heal","Rain Dish","Ice Body","Dry Skin","Healer","Shed Skin","Cheek Pouch"] },
  { id: "momentum", label: "Momentum / Pivoting", moves: ["U-turn","Volt Switch","Flip Turn","Parting Shot","Baton Pass","Teleport","Chilly Reception","Shed Tail"], abilities: ["Wimp Out","Emergency Exit"] },
  { id: "item-removal", label: "Item Removal / Theft", moves: ["Knock Off","Thief","Covet","Trick","Switcheroo","Corrosive Gas","Bestow"], abilities: ["Magician","Pickpocket"] },
  { id: "status", label: "Status / Debilitating Effects", moves: ["Will-O-Wisp","Scald","Lava Plume","Sacred Fire","Thunder Wave","Glare","Nuzzle","Stun Spore","Body Slam","Discharge","Force Palm","Zap Cannon","Toxic","Poison Powder","Poison Gas","Sludge Bomb","Sludge Wave","Poison Jab","Cross Poison","Toxic Thread","Dire Claw","Gunk Shot","Barb Barrage","Spore","Sleep Powder","Hypnosis","Lovely Kiss","Sing","Grass Whistle","Dark Void","Yawn","Confuse Ray","Supersonic","Swagger","Flatter","Dynamic Punch","Hurricane","Water Pulse","Signal Beam","Fake Out","Air Slash","Iron Head","Rock Slide","Icicle Crash","Dark Pulse","Bite","Stomp","Zing Zap","Dragon Rush","Leech Seed","Curse","Salt Cure","Infestation","Whirlpool","Fire Spin","Sand Tomb","Magma Storm","Thunder Cage","Bind","Wrap","Clamp","Octolock","Taunt","Encore","Disable","Torment","Heal Block","Nightmare","Soak","Forest's Curse","Trick-or-Treat"], abilities: ["Static","Flame Body","Poison Point","Effect Spore","Synchronize","Toxic Chain","Cute Charm","Cursed Body","Perish Body","Tangling Hair","Gooey","Stench","Poison Touch","Bad Dreams","Gulp Missile","Lingering Aroma"] },
  { id: "priority", label: "Priority", moves: ["Quick Attack","Extreme Speed","Mach Punch","Bullet Punch","Ice Shard","Aqua Jet","Shadow Sneak","Sucker Punch","Vacuum Wave","Accelerock","Jet Punch","First Impression","Grassy Glide","Thunderclap","Fake Out","Feint","Quick Guard","Protect","Detect","King's Shield","Spiky Shield","Baneful Bunker","Burning Bulwark","Endure","Follow Me","Rage Powder","Helping Hand","Ally Switch","Wide Guard","Crafty Shield","Baby-Doll Eyes"], abilities: ["Prankster","Gale Wings","Triage","Quick Draw"] },
  { id: "disruption", label: "Disruption", moves: ["Roar","Whirlwind","Dragon Tail","Circle Throw","Perish Song","Taunt","Haze","Clear Smog","Encore","Disable","Torment","Imprison","Quash","Psych Up","Topsy-Turvy","Spectral Thief","Heart Swap","Strength Sap","Charm","Feather Dance","Parting Shot","Memento","Fake Tears","Screech","Metal Sound","Eerie Impulse","Breaking Swipe","Chilling Water","Snarl","Icy Wind","Electroweb","Spite","Grudge","Gastro Acid","Skill Swap","Worry Seed","Simple Beam","Entrainment"], abilities: ["Unaware","Mold Breaker","Teravolt","Turboblaze","Neutralizing Gas","Mycelium Might","Intimidate","Contrary","Mirror Armor","Clear Body","White Smoke","Full Metal Body","Oblivious","Aroma Veil","Queenly Majesty","Dazzling","Armor Tail","Cursed Body","Pressure","Shadow Tag","Arena Trap","Magnet Pull","Prankster","Wandering Spirit","Mummy","Lingering Aroma","Simple"] },
  { id: "speed-control", label: "Speed Control", moves: ["Tailwind","Trick Room","Electroweb","Icy Wind","Rock Tomb","Bulldoze","String Shot","Scary Face","Thunder Wave","Glare","Nuzzle","Sticky Web","Agility","Rock Polish","Shift Gear","Dragon Dance","Quiver Dance","Flame Charge","Trailblaze","Rapid Spin","Autotomize","After You","Quash"], abilities: ["Swift Swim","Chlorophyll","Sand Rush","Slush Rush","Surge Surfer","Quick Feet","Unburden","Speed Boost","Protosynthesis","Quark Drive","Slow Start","Tangling Hair","Gooey","Cotton Down"] },
  { id: "screens", label: "Screens Support", moves: ["Reflect","Light Screen","Aurora Veil","Brick Break","Psychic Fangs","Raging Bull","Defog","Court Change"], abilities: ["Screen Cleaner","Infiltrator"] },
  { id: "weather-terrain", label: "Weather / Terrain", moves: ["Sunny Day","Rain Dance","Sandstorm","Snowscape","Hail","Electric Terrain","Grassy Terrain","Misty Terrain","Psychic Terrain","Ice Spinner","Steel Roller"], abilities: ["Drizzle","Drought","Sand Stream","Snow Warning","Primordial Sea","Desolate Land","Delta Stream","Orichalcum Pulse","Sand Spit","Electric Surge","Grassy Surge","Misty Surge","Psychic Surge","Hadron Engine","Cloud Nine","Air Lock"] },
];
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
  const [categoryId, setCategoryId] = useState("");
  const category = CATEGORIES.find(item => item.id === categoryId);
  const entries = useMemo(() => {
    if (!category) return [];
    return ([{ label: "Team A", team: left }, { label: "Team B", team: right }]).flatMap(side => side.team.flatMap((pokemon, index) => {
      if (pokemon.dead || /^Empty Slot/.test(pokemon.name) || !pokemon.species) return [];
      const moves = pokemon.moves.filter(Boolean).filter(move => category.moves.some(candidate => id(candidate) === id(move)))
        .map(move => ({ name: move, legal: moveLegalForSpecies(pokemon.species, move) })).filter(move => move.legal !== false);
      const ability = category.abilities.some(candidate => id(candidate) === id(pokemon.ability)) ? pokemon.ability : "";
      if (!moves.length && !ability) return [];
      return [{ key: `${side.label}-${index}-${pokemon.species}`, side: side.label, pokemon: pokemon.name || pokemon.species, species: pokemon.species, moves, ability }];
    }));
  }, [category, left, right]);

  return <section className="support-panel">
    <div className="panel-title-row"><div><h2>Team Support</h2><p>Choose one category to see options from living Pokémon only.</p></div></div>
    <label className="support-category-select">Category
      <select value={categoryId} onChange={event => setCategoryId(event.target.value)}>
        <option value="">Choose a category…</option>
        {CATEGORIES.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}
      </select>
    </label>
    {!category ? <p className="support-empty">Select a category to list the moves and abilities available on your remaining team.</p> : <>
      <div className="support-results-heading"><strong>{category.label}</strong><span>{entries.length} living Pokémon with options</span></div>
      {category.note && <p className="support-note">{category.note}</p>}
      {entries.length === 0 ? <p className="support-empty">No matching moves or selected abilities found on living Pokémon in either team.</p> : <div className="support-results">{entries.map(entry => <article className="support-entry" key={entry.key}>
        <div className="support-entry-title"><strong>{entry.pokemon}</strong><span>{entry.side}</span></div>
        <small>{entry.species}</small>
        <div className="support-tags">{entry.moves.map(move => <span className="support-tag" key={move.name}>{move.name}{move.legal === false && <em title="Not in this species' learnset"> · Illegal</em>}</span>)}{entry.ability && <span className="support-tag ability">Ability: {entry.ability}</span>}</div>
      </article>)}</div>}
      <p className="support-footnote">Format: {format}. Only moves currently on each set and the selected ability are shown. Known illegal learnset moves are excluded. Custom format bans and draft-specific rules are not fully validated.</p>
    </>}
  </section>;
}
