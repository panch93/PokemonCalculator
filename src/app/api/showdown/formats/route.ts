import { NextResponse } from "next/server";

export const revalidate = 3600;
export const runtime = "nodejs";

const SOURCE_URL = "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/config/formats.ts";
const RULESETS_URL = "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/rulesets.ts";
type FormatEntry = { id: string; label: string; section: string; mod?: string; gameType?: string; searchShow?: boolean; challengeShow?: boolean; team?: string; ruleset: string[]; banlist: string[]; source: "remote" };
const toID = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

function property(block: string, key: string): string | undefined {
  const match = block.match(new RegExp(`^\\t\\t${key}:\\s*(['\"])(.*?)\\1`, "m"));
  return match?.[2];
}
function stringArray(block: string, key: string): string[] {
  const match = block.match(new RegExp(`^\\t\\t${key}:\\s*\\[([^\\]]*)\\]`, "m"));
  if (!match) return [];
  return [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map(item => item[1]);
}
function parseFormats(source: string): FormatEntry[] {
  const output: FormatEntry[] = [];
  let section = "Other";
  const blocks = source.match(/^\t\{[\s\S]*?^\t\},?/gm) || [];
  for (const block of blocks) {
    const sectionName = property(block, "section");
    if (sectionName) { section = sectionName; continue; }
    const label = property(block, "name");
    if (!label) continue;
    const boolProperty = (key: string) => {
      const value = block.match(new RegExp(`^\\t\\t${key}:\\s*(true|false)`, "m"))?.[1];
      return value === undefined ? undefined : value === "true";
    };
    output.push({
      id: property(block, "id") || toID(label), label, section,
      mod: property(block, "mod"), gameType: property(block, "gameType"),
      searchShow: boolProperty("searchShow"), challengeShow: boolProperty("challengeShow"), team: property(block, "team"),
      ruleset: stringArray(block, "ruleset"), banlist: stringArray(block, "banlist"), source: "remote",
    });
  }
  const unique = new Map<string, FormatEntry>();
  for (const format of output) unique.set(format.id, format);
  return [...unique.values()];
}

export async function GET() {
  try {
    const [formatsResponse, rulesResponse] = await Promise.all([
      fetch(SOURCE_URL),
      fetch(RULESETS_URL),
    ]);
    if (!formatsResponse.ok) throw new Error(`Showdown formats fetch failed: ${formatsResponse.status}`);
    if (!rulesResponse.ok) throw new Error(`Showdown rulesets fetch failed: ${rulesResponse.status}`);
    const [source, rulesetsSource] = await Promise.all([formatsResponse.text(), rulesResponse.text()]);
    const formats = parseFormats(source);
    if (formats.length < 100) throw new Error("Fetched Pokémon Showdown format config did not parse correctly");
    // Include rule definitions as fetched source metadata. The simulator still
    // validates only formats implemented by its installed @pkmn/sim version.
    return NextResponse.json({ formats, rulesetsSource, source: SOURCE_URL, fetchedAt: new Date().toISOString() }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to fetch Pokémon Showdown config" }, { status: 502 });
  }
}
