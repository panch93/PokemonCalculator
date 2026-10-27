"use client";
import { useEffect, useState } from "react";
import { getSpriteUrl } from "../lib/pokemon-visuals";
import { getSpecies } from "../lib/showdown-data";

export default function PokemonSprite({ species, className, alt, fainted = false }: { species: string; className: string; alt?: string; fainted?: boolean }) {
  const dexNumber = getSpecies(species)?.num;
  const normalSource = getSpriteUrl(dexNumber, "Normal");
  const dizzySource = fainted ? getSpriteUrl(dexNumber, "Dizzy") : null;
  const sources = fainted ? [dizzySource, normalSource].filter((source): source is string => Boolean(source)) : [normalSource].filter((source): source is string => Boolean(source));
  const [sourceIndex, setSourceIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const source = sources[sourceIndex];
  useEffect(() => { setSourceIndex(0); setFailed(false); }, [species, fainted, normalSource, dizzySource]);
  if (!source || failed) return <span className={`${className} sprite-fallback`} title={species} aria-label={`${species} portrait unavailable`}>{species.slice(0, 2).toUpperCase()}</span>;
  return <img className={className} src={source} alt={alt || `${species}${fainted ? " fainted" : ""} portrait`} title={`${species}${fainted ? " · fainted" : ""} · PMDCollab SpriteCollab`} loading="lazy" decoding="async" onError={() => { if (sourceIndex + 1 < sources.length) setSourceIndex(index => index + 1); else setFailed(true); }} />;
}
