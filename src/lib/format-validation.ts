import { Dex, TeamValidator } from "@pkmn/sim";
import type { PokemonSet, Team } from "./types";

/** Showdown's current format catalog is fetched at runtime; bundled formats are a fallback. */
const CURATED_FORMATS = [
  { label: "[Gen 9] OU", id: "gen9ou" }, { label: "[Gen 9] Ubers", id: "gen9ubers" },
  { label: "[Gen 9] UU", id: "gen9uu" }, { label: "[Gen 9] RU", id: "gen9ru" },
  { label: "[Gen 9] NU", id: "gen9nu" }, { label: "[Gen 9] PU", id: "gen9pu" },
  { label: "[Gen 9] Monotype", id: "gen9monotype" }, { label: "[Gen 9] Doubles OU", id: "gen9doublesou" },
  { label: "[Gen 8] OU", id: "gen8ou" }, { label: "[Gen 7] OU", id: "gen7ou" },
  { label: "[Gen 6] OU", id: "gen6ou" }, { label: "[Gen 5] OU", id: "gen5ou" },
  { label: "[Gen 4] OU", id: "gen4ou" }, { label: "[Gen 3] OU", id: "gen3ou" },
  { label: "[Gen 2] OU", id: "gen2ou" }, { label: "[Gen 1] OU", id: "gen1ou" },
] as const;
export type ShowdownFormatOption = { label: string; id: string; section?: string; source?: "remote" | "bundled"; mod?: string; gameType?: string; searchShow?: boolean; challengeShow?: boolean; team?: string; ruleset?: string[]; banlist?: string[] };
const EVERYTHING_FORMAT: ShowdownFormatOption = { label: "Everything!", id: "everything", section: "Custom", source: "remote" };
let remoteFormats: ShowdownFormatOption[] = [];
let availableFormatsCache: ShowdownFormatOption[] | null = null;
export function setRemoteShowdownFormats(formats: ShowdownFormatOption[]) {
  remoteFormats = formats.filter(format => format.id && format.label && format.id !== "everything");
  availableFormatsCache = null;
}

export type FormatResolution =
  | { supported: true; id: string; label: string }
  | { supported: false; id: null; label: string; reason: string };

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Includes formats hidden from ladder search, especially draft and test formats. */
export function getAvailableShowdownFormats(): ShowdownFormatOption[] {
  if (availableFormatsCache) return availableFormatsCache;
  const local: ShowdownFormatOption[] = [];
  try {
    const all = (Dex.formats as unknown as { all: () => Array<{ id: string; name: string; effectType?: string; exists?: boolean; challengeShow?: boolean; searchShow?: boolean; team?: string; mod?: string; gameType?: string }> }).all();
    for (const format of all) {
      if (!format.id || !format.name || format.effectType !== "Format" || format.exists === false) continue;
      local.push({ label: format.name, id: format.id, source: "bundled", mod: format.mod, gameType: format.gameType, searchShow: format.searchShow, challengeShow: format.challengeShow, team: format.team });
    }
  } catch { /* Keep the basic list if the bundled Dex cannot enumerate formats. */ }
  const byId = new Map<string, ShowdownFormatOption>();
  for (const format of [...CURATED_FORMATS, ...local, ...remoteFormats]) byId.set(format.id, format);
  availableFormatsCache = [EVERYTHING_FORMAT, ...[...byId.values()].sort((a, b) => {
    const sectionCompare = (a.section || "").localeCompare(b.section || "");
    return sectionCompare || a.label.localeCompare(b.label);
  })];
  return availableFormatsCache;
}

export function isEverythingFormat(input: string) {
  return normalize(input) === "everything";
}

export function resolveShowdownFormat(input: string): FormatResolution {
  if (isEverythingFormat(input)) return { supported: false, id: null, label: "Everything!", reason: "Everything! is an unrestricted analysis mode; format-specific legality is intentionally not applied." };
  const normalized = normalize(input);
  const selected = getAvailableShowdownFormats().find(format => normalize(format.label) === normalized || normalize(format.id) === normalized);
  if (!selected) return { supported: false, id: null, label: input.trim() || "No format selected", reason: "This format is not present in the fetched or bundled Pokémon Showdown format catalog." };
  try {
    const format = Dex.formats.get(selected.id);
    if (!format || format.effectType !== "Format" || !format.exists) {
      return { supported: false, id: null, label: selected.label, reason: `The format exists in the fetched Pokémon Showdown catalog, but the installed validator does not contain its executable rules (${selected.id}). It is not safe to guess legality.` };
    }
  } catch {
    return { supported: false, id: null, label: selected.label, reason: `The installed validator does not contain executable rules for ${selected.label}. It is not safe to guess legality.` };
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
  if (isEverythingFormat(formatInput)) return { supported: false, formatLabel: "Everything!", valid: null, issues: [], message: "Unrestricted analysis mode; format legality is not checked." };
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
