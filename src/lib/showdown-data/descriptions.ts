import { toShowdownId } from "./ids";
import type { ShowdownDescribedEntry } from "./types";

/**
 * Parse only the top-level description fields from Pokémon Showdown's official
 * data/text/*.ts tables. Those files are data-only TypeScript object literals;
 * this deliberately extracts a small allowlist instead of evaluating source.
 */
export function parseDescriptionTable(source: string): Record<string, ShowdownDescribedEntry> {
  const starts = [...source.matchAll(/^\t(?:"([^"\n]+)"|([A-Za-z0-9]+)):\s*\{\s*$/gm)];
  const table: Record<string, ShowdownDescribedEntry> = {};
  for (let i = 0; i < starts.length; i += 1) {
    const match = starts[i];
    const id = toShowdownId(match[1] ?? match[2] ?? "");
    if (!id) continue;
    const start = (match.index ?? 0) + match[0].length;
    const end = i + 1 < starts.length ? (starts[i + 1].index ?? source.length) : source.length;
    const body = source.slice(start, end);
    const entry: ShowdownDescribedEntry = { name: id };
    for (const field of ["name", "desc", "shortDesc"] as const) {
      const fieldMatch = body.match(new RegExp(`^\\t\\t${field}:\\s*(null|"(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*')\\s*,?\\s*(?:\\/\\/.*)?$`, "m"));
      if (!fieldMatch || fieldMatch[1] === "null") continue;
      let value: string;
      if (fieldMatch[1].startsWith('"')) {
        try { value = JSON.parse(fieldMatch[1]) as string; } catch { continue; }
      } else {
        value = fieldMatch[1].slice(1, -1).replace(/\\\\'/g, "'").replace(/\\\\\\\\/g, "\\");
      }
      if (value.trim()) entry[field] = value;
    }
    if (entry.desc || entry.shortDesc) table[id] = entry;
  }
  return table;
}

/** Merge upstream text descriptions onto mechanics records by canonical Showdown ID. */
export function mergeDescriptions<T extends ShowdownDescribedEntry>(
  mechanics: Record<string, T>,
  descriptions: Record<string, ShowdownDescribedEntry>,
): Record<string, T & ShowdownDescribedEntry> {
  const merged: Record<string, T & ShowdownDescribedEntry> = { ...mechanics };
  for (const [rawId, description] of Object.entries(descriptions)) {
    const id = toShowdownId(rawId);
    const existing = merged[id];
    const name = description.name && description.name !== id ? description.name : existing?.name ?? id;
    merged[id] = {
      ...(existing ?? { name } as T),
      name: existing?.name || name,
      ...(description.desc ? { desc: description.desc } : {}),
      ...(description.shortDesc ? { shortDesc: description.shortDesc } : {}),
    } as T & ShowdownDescribedEntry;
  }
  return merged;
}
