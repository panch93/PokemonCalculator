"use client";
import { useEffect, useState } from "react";
import { getSpriteUrl, type PortraitEmotion } from "../lib/pokemon-visuals";
import { getSpecies } from "../lib/showdown-data";
import type { PokemonSet, StatStages } from "../lib/types";

function portraitEmotion(status?: PokemonSet["status"], dead = false, stages?: StatStages): PortraitEmotion {
  // Ailments take precedence over stat-stage expressions; fainted remains the strongest state.
  if (dead) return "Dizzy";
  if (status === "par") return "Stunned";
  if (status === "psn" || status === "tox") return "Pain";
  if (status === "frz") return "Pain";
  if (status === "brn") return "Sad";
  if (stages && Object.values(stages).some(value => value < 0)) return "Worried";
  if (stages && Object.values(stages).some(value => value > 0)) return "Determined";
  return "Normal";
}

export default function PokemonSprite({ species, className, alt, fainted = false, status, stages }: { species: string; className: string; alt?: string; fainted?: boolean; status?: PokemonSet["status"]; stages?: StatStages }) {
  const dexNumber = getSpecies(species)?.num;
  const emotion = portraitEmotion(status, fainted, stages);
  const preferredSource = getSpriteUrl(dexNumber, emotion);
  const normalSource = getSpriteUrl(dexNumber, "Normal");
  const sources = [...new Set([preferredSource, normalSource].filter((source): source is string => Boolean(source)))];
  const [sourceIndex, setSourceIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const source = sources[sourceIndex];
  useEffect(() => { setSourceIndex(0); setFailed(false); }, [species, emotion, preferredSource, normalSource]);
  if (!source || failed) return <span className={`${className} sprite-fallback`} title={species} aria-label={`${species} portrait unavailable`}>{species.slice(0, 2).toUpperCase()}</span>;
  return <img className={className} src={source} alt={alt || `${species} ${emotion.toLowerCase()} portrait`} title={`${species} · ${emotion} · PMDCollab SpriteCollab`} loading="lazy" decoding="async" onError={() => { if (sourceIndex + 1 < sources.length) setSourceIndex(index => index + 1); else setFailed(true); }} />;
}
