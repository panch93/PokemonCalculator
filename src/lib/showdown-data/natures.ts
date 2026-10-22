import { toShowdownId } from "./ids";
import type { ShowdownNature } from "./types";
export type { ShowdownNature } from "./types";

// Fallback for tests/offline utility calls. At runtime the adapter fetches the
// authoritative table from smogon/pokemon-showdown/data/natures.ts on startup.
const NATURE_ROWS: ShowdownNature[] = [
  { name: "Adamant", plus: "atk", minus: "spa" }, { name: "Bashful" },
  { name: "Bold", plus: "def", minus: "atk" }, { name: "Brave", plus: "atk", minus: "spe" },
  { name: "Calm", plus: "spd", minus: "atk" }, { name: "Careful", plus: "spd", minus: "spa" },
  { name: "Docile" }, { name: "Gentle", plus: "spd", minus: "def" },
  { name: "Hardy" }, { name: "Hasty", plus: "spe", minus: "def" },
  { name: "Impish", plus: "def", minus: "spa" }, { name: "Jolly", plus: "spe", minus: "spa" },
  { name: "Lax", plus: "def", minus: "spd" }, { name: "Lonely", plus: "atk", minus: "def" },
  { name: "Mild", plus: "spa", minus: "def" }, { name: "Modest", plus: "spa", minus: "atk" },
  { name: "Naive", plus: "spe", minus: "spd" }, { name: "Naughty", plus: "atk", minus: "spd" },
  { name: "Quiet", plus: "spa", minus: "spe" }, { name: "Quirky" },
  { name: "Rash", plus: "spa", minus: "spd" }, { name: "Relaxed", plus: "def", minus: "spe" },
  { name: "Sassy", plus: "spd", minus: "spe" }, { name: "Serious" },
  { name: "Timid", plus: "spe", minus: "atk" },
];
const FALLBACK_NATURES = Object.fromEntries(NATURE_ROWS.map(nature => [toShowdownId(nature.name), nature]));

/** Parse the intentionally simple object rows in the official data/natures.ts. */
export function parseOfficialNatureSource(source: string): Record<string, ShowdownNature> {
  const output: Record<string, ShowdownNature> = {};
  const entryPattern = /^\s*([a-z0-9]+):\s*\{([^{}]*)\},?\s*$/gm;
  for (const match of source.matchAll(entryPattern)) {
    const body = match[2];
    const name = body.match(/\bname\s*:\s*[\"']([^\"']+)[\"']/)?.[1];
    if (!name) continue;
    const plus = body.match(/\bplus\s*:\s*[\"'](hp|atk|def|spa|spd|spe)[\"']/)?.[1];
    const minus = body.match(/\bminus\s*:\s*[\"'](hp|atk|def|spa|spd|spe)[\"']/)?.[1];
    output[toShowdownId(match[1])] = { name, ...(plus ? { plus } : {}), ...(minus ? { minus } : {}) };
  }
  if (Object.keys(output).length !== 25) {
    throw new Error(`Expected 25 official Pokémon Showdown natures, parsed ${Object.keys(output).length}`);
  }
  return output;
}

export function getNature(name: string, table: Record<string, ShowdownNature> = FALLBACK_NATURES): ShowdownNature | undefined {
  return table[toShowdownId(name)];
}

export function getNatureList(table: Record<string, ShowdownNature> = FALLBACK_NATURES): ShowdownNature[] {
  return Object.values(table).map(nature => ({ ...nature })).sort((a, b) => a.name.localeCompare(b.name));
}

export function getNatureEffectsByDisplayStat(table: Record<string, ShowdownNature> = FALLBACK_NATURES): Record<string, { plus?: string; minus?: string }> {
  const statLabels: Record<string, string> = { atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe" };
  return Object.fromEntries(getNatureList(table).map(nature => [nature.name, {
    ...(nature.plus ? { plus: statLabels[nature.plus] } : {}),
    ...(nature.minus ? { minus: statLabels[nature.minus] } : {}),
  }]));
}
