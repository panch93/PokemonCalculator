import type { PokemonSet, Team } from "./types";
import type { FormatResolution, TeamFormatValidation } from "./format-types";

export type SupportedFormatResolution = Extract<FormatResolution, { supported: true }>;

/** Stable boundary between the app's validation facade and its executable rules engine. */
export interface TeamValidationProvider {
  validateTeam(team: Team, format: SupportedFormatResolution): TeamFormatValidation;
}

/** Convert app sets to the input shape expected by the current Showdown validator. */
export function toShowdownSet(pokemon: PokemonSet) {
  return {
    name: pokemon.name || pokemon.species,
    species: pokemon.species,
    item: pokemon.item || "",
    ability: pokemon.ability || "",
    moves: pokemon.moves.filter(Boolean),
    nature: pokemon.nature || "Hardy",
    evs: { ...pokemon.evs },
    ivs: { ...pokemon.ivs },
    level: pokemon.level || 100,
    teraType: pokemon.teraType || undefined,
  };
}
