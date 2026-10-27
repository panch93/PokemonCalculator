"use client";
import { useEffect, useState } from "react";
import { getSpriteCandidates } from "../lib/pokemon-visuals";
import { getSpecies } from "../lib/showdown-data";

export default function PokemonSprite({ species, className, alt }: { species: string; className: string; alt?: string }) {
  const dexNumber = getSpecies(species)?.num;
  const sources = [
    ...getSpriteCandidates(species),
    ...(typeof dexNumber === "number" && dexNumber > 0 ? [
      `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${dexNumber}.png`,
      `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexNumber}.png`,
    ] : []),
  ];
  const [sourceIndex, setSourceIndex] = useState(0);
  useEffect(() => setSourceIndex(0), [species]);
  if (sourceIndex >= sources.length) return <span className={`${className} sprite-fallback`} title={species} aria-label={`${species} sprite unavailable`}>{species.slice(0, 2).toUpperCase()}</span>;
  return <img className={className} src={sources[sourceIndex]} alt={alt || `${species} sprite`} title={species} loading="eager" decoding="async" onError={() => setSourceIndex(index => index + 1)} />;
}
