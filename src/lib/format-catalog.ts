import { EVERYTHING_FORMAT, type ShowdownFormatOption } from "./format-types";
import { normalizeFormatIdentifier } from "./format-normalization";

/** Small offline fallback if the installed simulator cannot enumerate formats. */
const CURATED_FORMATS = [
  { label: "[Gen 9] OU", id: "gen9ou" }, { label: "[Gen 9] Ubers", id: "gen9ubers" },
  { label: "[Gen 9] UU", id: "gen9uu" }, { label: "[Gen 9] RU", id: "gen9ru" },
  { label: "[Gen 9] NU", id: "gen9nu" }, { label: "[Gen 9] PU", id: "gen9pu" },
  { label: "[Gen 9] Monotype", id: "gen9monotype" }, { label: "[Gen 9] Doubles OU", id: "gen9doublesou" },
  // Champions formats are explicit bundled entries because the offline picker
  // cannot rely on the live format endpoint being reachable.
  { label: "[Gen 9] Pokémon Champions OU", id: "gen9championsou", section: "Pokémon Champions" },
  { label: "[Gen 9] Pokémon Champions BSS Reg M-B", id: "gen9championsbssregmb", section: "Pokémon Champions" },
  { label: "[Gen 8] OU", id: "gen8ou" }, { label: "[Gen 7] OU", id: "gen7ou" },
  { label: "[Gen 6] OU", id: "gen6ou" }, { label: "[Gen 5] OU", id: "gen5ou" },
  { label: "[Gen 4] OU", id: "gen4ou" }, { label: "[Gen 3] OU", id: "gen3ou" },
  { label: "[Gen 2] OU", id: "gen2ou" }, { label: "[Gen 1] OU", id: "gen1ou" },
] as const;

let remoteFormats: ShowdownFormatOption[] = [];
let availableFormatsCache: ShowdownFormatOption[] | null = null;

export function setRemoteShowdownFormats(formats: ShowdownFormatOption[]): void {
  remoteFormats = formats.filter(format => format.id && format.label && format.id !== "everything");
  availableFormatsCache = null;
}


/** Combines a small fallback with the bundled upstream format catalog. */
export function getAvailableShowdownFormats(): ShowdownFormatOption[] {
  if (availableFormatsCache) return availableFormatsCache;

  const byId = new Map<string, ShowdownFormatOption>();
  for (const format of CURATED_FORMATS) byId.set(format.id, { ...format, source: "bundled" });
  for (const format of remoteFormats) {
    const bundled = byId.get(format.id);
    if (format.source === "bundled") {
      byId.set(format.id, { ...format, source: "bundled" });
      continue;
    }
    byId.set(format.id, bundled ? {
      ...bundled,
      label: format.label || bundled.label,
      section: format.section || bundled.section,
      searchShow: format.searchShow,
      challengeShow: format.challengeShow,
      remoteRuleset: format.remoteRuleset ?? format.ruleset,
      remoteBanlist: format.remoteBanlist ?? format.banlist,
      remoteMod: format.mod,
      remoteGameType: format.gameType,
      remoteTeam: format.team,
    } : { ...format, source: "remote" });
  }

  availableFormatsCache = [EVERYTHING_FORMAT, ...[...byId.values()].sort((a, b) => {
    const sectionCompare = (a.section || "").localeCompare(b.section || "");
    return sectionCompare || a.label.localeCompare(b.label);
  })];
  return availableFormatsCache;
}

export function findShowdownFormat(input: string): ShowdownFormatOption | undefined {
  const normalized = normalizeFormatIdentifier(input);
  return getAvailableShowdownFormats().find(format =>
    normalizeFormatIdentifier(format.label) === normalized || normalizeFormatIdentifier(format.id) === normalized
  );
}
