import { normalizeFormatIdentifier } from "./format-normalization";
import type { ShowdownFormatOption } from "./format-types";

type StringField = "name" | "section" | "mod" | "gameType" | "team";

function readQuoted(source: string, start: number): { value: string; end: number } | null {
  const quote = source[start];
  if (quote !== "'" && quote !== '"' && quote !== "`") return null;
  let value = "";
  for (let i = start + 1; i < source.length; i++) {
    const char = source[i];
    if (char === "\\") {
      const next = source[i + 1];
      if (next === undefined) return null;
      value += next === "n" ? "\n" : next === "t" ? "\t" : next;
      i++;
    } else if (char === quote) {
      return { value, end: i + 1 };
    } else {
      value += char;
    }
  }
  return null;
}

function skipTrivia(source: string, start: number): number {
  let i = start;
  while (i < source.length) {
    if (/\s/.test(source[i])) { i++; continue; }
    if (source.startsWith("//", i)) {
      const newline = source.indexOf("\n", i + 2);
      i = newline < 0 ? source.length : newline + 1;
      continue;
    }
    if (source.startsWith("/*", i)) {
      const end = source.indexOf("*/", i + 2);
      i = end < 0 ? source.length : end + 2;
      continue;
    }
    break;
  }
  return i;
}

function extractTopLevelObjects(source: string): string[] {
  const declarationPattern = /^export\s+const\s+Formats\s*:/gm;
  let declaration: RegExpExecArray | null;
  let formatsStart = -1;
  while ((declaration = declarationPattern.exec(source)) !== null) formatsStart = declaration.index;
  const arrayStart = source.indexOf("[", formatsStart < 0 ? 0 : formatsStart);
  if (arrayStart < 0) throw new Error("Could not find the Formats array in official Showdown config");
  const objects: string[] = [];
  let i = arrayStart + 1;
  while (i < source.length) {
    i = skipTrivia(source, i);
    if (source[i] === "]") break;
    if (source[i] !== "{") { i++; continue; }
    const objectStart = i;
    let depth = 0;
    while (i < source.length) {
      const char = source[i];
      if (char === "'" || char === '"' || char === "`") {
        const quoted = readQuoted(source, i);
        if (!quoted) throw new Error("Unterminated string in official Showdown format config");
        i = quoted.end;
        continue;
      }
      if (source.startsWith("//", i)) {
        const newline = source.indexOf("\n", i + 2);
        i = newline < 0 ? source.length : newline + 1;
        continue;
      }
      if (source.startsWith("/*", i)) {
        const end = source.indexOf("*/", i + 2);
        i = end < 0 ? source.length : end + 2;
        continue;
      }
      if (char === "{") depth++;
      if (char === "}" && --depth === 0) { i++; break; }
      i++;
    }
    objects.push(source.slice(objectStart, i));
  }
  return objects;
}

function stringProperty(object: string, key: StringField): string | undefined {
  const match = new RegExp(`\\b${key}\\s*:\\s*(['"\x60])`).exec(object);
  if (!match) return undefined;
  const quoteIndex = match.index + match[0].lastIndexOf(match[1]);
  const parsed = readQuoted(object, quoteIndex);
  return parsed?.value;
}

function booleanProperty(object: string, key: string): boolean | undefined {
  const match = new RegExp(`\\b${key}\\s*:\\s*(true|false)\\b`).exec(object);
  return match ? match[1] === "true" : undefined;
}

function stringArrayProperty(object: string, key: "ruleset" | "banlist"): string[] | undefined {
  const property = new RegExp(`\\b${key}\\s*:`).exec(object);
  if (!property) return undefined;
  const arrayStart = object.indexOf("[", property.index + property[0].length);
  if (arrayStart < 0) return undefined;
  const values: string[] = [];
  let depth = 0;
  for (let i = arrayStart; i < object.length;) {
    const char = object[i];
    if (char === "'" || char === '\"' || char === "`") {
      const parsed = readQuoted(object, i);
      if (!parsed) return undefined;
      if (depth === 1) values.push(parsed.value);
      i = parsed.end;
      continue;
    }
    if (object.startsWith("//", i)) {
      const newline = object.indexOf("\n", i + 2);
      i = newline < 0 ? object.length : newline + 1;
      continue;
    }
    if (object.startsWith("/*", i)) {
      const commentEnd = object.indexOf("*/", i + 2);
      i = commentEnd < 0 ? object.length : commentEnd + 2;
      continue;
    }
    if (char === "[") depth++;
    if (char === "]" && --depth === 0) return values;
    i++;
  }
  return undefined;
}

/** Parse display metadata from the official upstream TypeScript format list; this is not a legality engine. */
export function parseShowdownFormatConfig(source: string): ShowdownFormatOption[] {
  const formats: ShowdownFormatOption[] = [];
  let section = "Other";
  for (const object of extractTopLevelObjects(source)) {
    const name = stringProperty(object, "name");
    if (!name) {
      const nextSection = stringProperty(object, "section");
      if (nextSection) section = nextSection;
      continue;
    }
    const id = normalizeFormatIdentifier(name);
    if (!id) continue;
    formats.push({
      id,
      label: name,
      section,
      source: "remote",
      mod: stringProperty(object, "mod"),
      gameType: stringProperty(object, "gameType"),
      team: stringProperty(object, "team"),
      searchShow: booleanProperty(object, "searchShow"),
      challengeShow: booleanProperty(object, "challengeShow"),
      ruleset: stringArrayProperty(object, "ruleset"),
      banlist: stringArrayProperty(object, "banlist"),
    });
  }
  if (formats.length < 20) throw new Error(`Official Showdown format config looked incomplete (${formats.length} formats parsed)`);
  return formats;
}

export async function fetchLiveShowdownFormats(): Promise<ShowdownFormatOption[]> {
  const response = await fetch("https://raw.githubusercontent.com/smogon/pokemon-showdown/master/config/formats.ts", { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not fetch official Pokémon Showdown format config (${response.status})`);
  return parseShowdownFormatConfig(await response.text());
}
