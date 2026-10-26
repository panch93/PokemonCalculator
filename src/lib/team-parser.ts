import { PokemonSet, Stats, Team } from "./types";

const STAT_MAP: Record<string, keyof Stats> = {
  HP: "hp",
  Atk: "atk",
  Def: "def",
  SpA: "spa",
  SpD: "spd",
  Spe: "spe",
};

const emptyStats = (): Stats => ({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
const defaultIVs = (): Stats => ({ hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 });


/** Returns the public HTML page for a single Poképaste URL. */
export function getPokepasteHtmlUrl(input: string): string | null {
  const match = input.trim().match(/^https?:\/\/(?:www\.)?pokepast\.es\/([a-zA-Z0-9]+)\/?(?:\?.*)?$/i);
  return match ? `https://pokepast.es/${match[1]}` : null;
}

/**
 * Extract the team text embedded in a Poképaste HTML page. Poképaste's rendered
 * page exposes the copyable paste in a pre/code-style region; strip markup and
 * decode HTML entities before passing it to the regular Showdown paste parser.
 */
export function extractPokepasteHtmlText(html: string): string {
  const candidates: string[] = [];
  const blockPattern = /<(pre|code|textarea)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi;
  for (const match of html.matchAll(blockPattern)) candidates.push(match[2]);

  // Some page revisions embed copyable team text in an attribute or escaped
  // script payload instead of a single pre/code node. Include those candidates
  // and aggregate distinct team blocks so the importer does not stop at set 1.
  const attributePattern = /(?:data-clipboard-text|data-paste|content)=(["'])([\s\S]*?)\1/gi;
  for (const match of html.matchAll(attributePattern)) candidates.push(match[2]);
  const jsonTextPattern = /(?:paste|team|clipboard)[^:]{0,40}:\s*["']((?:\\.|[^"']){30,})["']/gi;
  for (const match of html.matchAll(jsonTextPattern)) candidates.push(match[1]);

  // Some page revisions place the paste in a div rather than a pre/code block.
  if (!candidates.length) candidates.push(html);
  const decode = (value: string) => {
    let decoded = value
      .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:div|p|li)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
      .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
      .trim();
    for (let i = 0; i < 2; i++) decoded = decoded
      .replace(/&amp;/gi, "&")
      .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
      .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
    return decoded;
  };
  const decoded = candidates.map(decode).filter(Boolean);
  const teamCandidates = decoded.filter(text => /(?:^|\n)\s*(?:[^\n]+\s+@\s+[^\n]+|Ability:|[-•]\s+[^\n]+)\s*(?:\n|$)/i.test(text));
  // Pick the fullest text source if the HTML includes nested duplicate regions;
  // otherwise concatenate separately rendered set blocks, preserving boundaries.
  const unique = [...new Set(teamCandidates)];
  if (!unique.length) return "";
  const longest = unique.sort((a, b) => b.length - a.length)[0];
  const longestSetCount = parseTeamPaste(longest).length;
  const aggregate = unique.join("\n\n");
  const aggregateSetCount = parseTeamPaste(aggregate).length;
  return aggregateSetCount > longestSetCount ? aggregate : longest;
}

export function parseTeamPaste(input: string): Team {
  const blocks = input.replace(/\r/g, "").split(/\n\s*\n/);
  const team: Team = [];

  for (const block of blocks) {
    const lines = block.split("\n").map(s => s.trim()).filter(Boolean);
    if (!lines.length) continue;

    const header = lines[0];
    const [left, itemPart] = header.split(/\s+@\s+/);
    const genderless = left.replace(/\s+\([MF]\)\s*$/, "");
    const nicknameMatch = genderless.match(/^(.*?)\s+\((.*?)\)$/);

    const set: PokemonSet = {
      name: nicknameMatch?.[2]?.trim() || genderless.trim(),
      species: nicknameMatch?.[2]?.trim() || genderless.trim(),
      item: itemPart?.trim() || "",
      ability: "",
      nature: "Hardy",
      level: 100,
      teraType: "",
      importedTeraType: "",
      evs: emptyStats(),
      ivs: defaultIVs(),
      moves: [],
    };

    for (const line of lines.slice(1)) {
      if (/^Ability:/i.test(line)) set.ability = line.replace(/^Ability:\s*/i, "");
      else if (/^EVs:/i.test(line)) set.evs = parseStats(line.replace(/^EVs:\s*/i, ""));
      else if (/^IVs:/i.test(line)) set.ivs = { ...defaultIVs(), ...parseStats(line.replace(/^IVs:\s*/i, "")) };
      else if (/^([A-Za-z]+) Nature$/i.test(line)) set.nature = line.replace(/\s+Nature$/i, "");
      else if (/^Level:/i.test(line)) set.level = Number(line.replace(/^Level:\s*/i, "")) || 100;
      else if (/^Tera Type:/i.test(line)) { set.teraType = line.replace(/^Tera Type:\s*/i, ""); set.importedTeraType = set.teraType; }
      else if (/^-\s*/.test(line)) set.moves.push(line.replace(/^-\s*/, ""));
    }

    while (set.moves.length < 4) set.moves.push("");
    team.push(set);
  }

  return team.slice(0, 6);
}

function parseStats(value: string): Stats {
  const stats = emptyStats();
  for (const part of value.split("/")) {
    const match = part.trim().match(/^(\d+)\s+(.+)$/);
    if (!match) continue;
    const stat = STAT_MAP[match[2].trim()];
    if (stat) stats[stat] = Math.max(0, Math.min(252, Number(match[1])));
  }
  return stats;
}

export function exportTeam(team: Team): string {
  return team.map(set => {
    const header = set.species;

    const lines = [`${header}${set.item ? ` @ ${set.item}` : ""}`];
    if (set.ability) lines.push(`Ability: ${set.ability}`);

    const evs = formatStats(set.evs);
    if (evs) lines.push(`EVs: ${evs}`);

    if (set.level !== 100) lines.push(`Level: ${set.level}`);

    const pasteTeraType = set.importedTeraType || set.teraType;
    if (pasteTeraType) lines.push(`Tera Type: ${pasteTeraType}`);

    const ivs = formatIVs(set.ivs);
    if (ivs) lines.push(`IVs: ${ivs}`);

    if (set.nature) lines.push(`${set.nature} Nature`);
    for (const move of set.moves.filter(Boolean)) lines.push(`- ${move}`);

    return lines.join("\n");
  }).join("\n\n");
}

function formatStats(stats: Stats): string {
  return (Object.entries(STAT_MAP) as [string, keyof Stats][])
    .filter(([, key]) => stats[key] > 0)
    .map(([label, key]) => `${stats[key]} ${label}`)
    .join(" / ");
}

function formatIVs(ivs: Stats): string {
  return (Object.entries(STAT_MAP) as [string, keyof Stats][])
    .filter(([, key]) => ivs[key] !== 31)
    .map(([label, key]) => `${ivs[key]} ${label}`)
    .join(" / ");
}
