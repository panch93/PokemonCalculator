"use client";
import { useEffect, useState } from "react";
import { getSpriteCandidates } from "../lib/pokemon-visuals";

export default function PokemonSprite({ species, className, alt }: { species: string; className: string; alt?: string }) {
  const sources = getSpriteCandidates(species);
  const [sourceIndex, setSourceIndex] = useState(0);
  useEffect(() => setSourceIndex(0), [species]);
  if (sourceIndex >= sources.length) return <span className={`${className} sprite-fallback`} title={species} aria-label={`${species} sprite unavailable`}>{species.slice(0, 2).toUpperCase()}</span>;
  return <img className={className} src={sources[sourceIndex]} alt={alt || `${species} sprite`} title={species} loading="lazy" onError={() => setSourceIndex(index => index + 1)} />;
}
