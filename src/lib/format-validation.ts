import { Dex, TeamValidator } from "@pkmn/sim";
import type { PokemonSet, Team } from "./types";

/**
 * Formats deliberately mirror named Pokémon Showdown formats. Custom formats
 * (including draft leagues) need an explicit ruleset and are never guessed.
 */
export const SUPPORTED_FORMATS = [
  { label: "Gen 9 OU", id: "gen9ou" },
  { label: "Gen 9 Ubers", id: "gen9ubers" },
  { label: "Gen 9 UU", id: "gen9uu" },
  { label: "Gen 9 RU", id: "gen9ru" },
  { label: "Gen 9 NU", id: "gen9nu" },
  { label: "Gen 9 PU", id: "gen9pu" },
  { label: "Gen 9 Monotype", id: "gen9monotype" },
  { label: "Gen 9 Doubles OU", id: "gen9doublesou" },
  { label: "Gen 8 OU", id: "gen8ou" },
  { label: "Gen 7 OU", id: "gen7ou" },
  { label: "Gen 6 OU", id: "gen6ou" },
  { label: "Gen 5 OU", id: "gen5ou" },
  { label: "Gen 4 OU", id: "gen4ou" },
  { label: "Gen 3 OU", id: "gen3ou" },
  { label: "Gen 2 OU", id: "gen2ou" },
  { label: "Gen 1 OU", id: "gen1ou" },
] as const;

export type FormatResolution =
  | { supported: true; id: string; label: string }
  | { supported: false; id: null; label: string; reason: string };

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
let availableFormatsCache: (typeof SUPPORTED_FORMATS)[number][] | null = null;

/** Only expose formats actually present in the bundled Pokémon Showdown data. */
export function getAvailableShowdownFormats(): (typeof SUPPORTED_FORMATS)[number][] {
  if (availableFormatsCache) return availableFormatsCache;
  availableFormatsCache = SUPPORTED_FORMATS.filter(candidate => {
    try {
      const format = Dex.formats.get(candidate.id);
      return Boolean(format && format.effectType === "Format" && format.exists);
    } catch {
      return false;
    }
  });
  return availableFormatsCache;
}

export function resolveShowdownFormat(input: string): FormatResolution {
  const normalized = normalize(input);
  const selected = SUPPORTED_FORMATS.find(format => normalize(format.label) === normalized || normalize(format.id) === normalized);
  if (!selected) {
    return {
      supported: false,
      id: null,
      label: input.trim() || "No format selected",
      reason: "This format has no configured Pokémon Showdown ruleset in this app. Draft/custom formats must have their rules added explicitly; no fallback legality result is shown.",
    };
  }

  try {
    const format = Dex.formats.get(selected.id);
    if (!format || format.effectType !== "Format" || !format.exists) {
      return {
        supported: false,
        id: null,
        label: selected.label,
        reason: `The installed Pokémon Showdown data does not include ${selected.label}. Choose a format marked as supported or add this format's ruleset.`,
      };
    }
  } catch {
    return {
      supported: false,
      id: null,
      label: selected.label,
      reason: `The installed Pokémon Showdown data does not include ${selected.label}. Choose a format marked as supported or add this format's ruleset.`,
    };
  }
  return { supported: true, id: selected.id, label: selected.label };
}

function toShowdownSet(pokemon: PokemonSet) {
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

export type TeamFormatValidation = {
  supported: boolean;
  formatLabel: string;
  valid: boolean | null;
  issues: string[];
  message?: string;
};

export function validateTeamForFormat(team: Team, formatInput: string): TeamFormatValidation {
  const format = resolveShowdownFormat(formatInput);
  if (!format.supported) {
    return { supported: false, formatLabel: format.label, valid: null, issues: [], message: format.reason };
  }

  try {
    const validator = new TeamValidator(format.id);
    // TeamValidator normalizes sets in place, so only pass fresh copies.
    const problems = validator.validateTeam(team.map(toShowdownSet) as never) || [];
    return {
      supported: true,
      formatLabel: format.label,
      valid: problems.length === 0,
      issues: problems,
    };
  } catch (error) {
    return {
      supported: false,
      formatLabel: format.label,
      valid: null,
      issues: [],
      message: error instanceof Error ? `Could not validate this format: ${error.message}` : "Could not validate this format.",
    };
  }
}
