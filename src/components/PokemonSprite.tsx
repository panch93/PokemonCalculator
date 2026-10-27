"use client";
import { useEffect, useState } from "react";
import { getSpriteUrl } from "../lib/pokemon-visuals";
import { getSpecies } from "../lib/showdown-data";

export default function PokemonSprite({ species, className, alt }: { species: string; className: string; alt?: string }) {
  const dexNumber = getSpecies(species)?.num;
  const source = getSpriteUrl(dexNumber);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [species, source]);
  if (!source || failed) return <span className={`${className} sprite-fallback`} title={species} aria-label={`${species} portrait unavailable`}>{species.slice(0, 2).toUpperCase()}</span>;
  return <img className={className} src={source} alt={alt || `${species} portrait`} title={`${species} · PMDCollab SpriteCollab`} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}
