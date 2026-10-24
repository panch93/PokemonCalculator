/** Pokémon Showdown's ID normalization: remove all non-alphanumeric characters. */
export function toShowdownId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function unwrapTable<T>(value: unknown, wrappers: string[] = []): Record<string, T> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  let table = value as Record<string, unknown>;
  // Upstream exports have occasionally wrapped a table more than once (for
  // example data -> pokemon -> species). Follow only known wrapper keys.
  for (let depth = 0; depth < wrappers.length; depth += 1) {
    const wrapper = wrappers.find(key => table[key] && typeof table[key] === "object" && !Array.isArray(table[key]));
    if (!wrapper) break;
    table = table[wrapper] as Record<string, unknown>;
  }
  const output: Record<string, T> = {};
  for (const [key, entry] of Object.entries(table)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    output[toShowdownId(key)] = entry as T;
  }
  return output;
}

export function resolveByName<T extends { name?: string }>(table: Record<string, T>, name: string): T | undefined {
  const id = toShowdownId(name);
  if (!id) return undefined;
  const direct = table[id];
  if (direct) return direct;
  return Object.values(table).find(entry => entry.name && toShowdownId(entry.name) === id);
}
