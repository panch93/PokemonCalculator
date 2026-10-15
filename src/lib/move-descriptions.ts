import { Dex } from "@pkmn/dex";

/**
 * Compatibility helper for older call sites. Move descriptions come from the
 * bundled Pokémon Showdown data supplied by @pkmn/dex; keep this file free of
 * hand-maintained duplicate-key maps so strict TypeScript builds stay clean.
 */
export function getMoveDescription(name: string): string | undefined {
  try {
    const move = Dex.moves.get(name);
    if (move.exists === false) return undefined;
    if (typeof move.desc === "string" && move.desc.trim()) return move.desc.trim();
    if (typeof move.shortDesc === "string" && move.shortDesc.trim()) return move.shortDesc.trim();
  } catch {
    // Unknown/custom move names can fall back to the calculator's metadata.
  }
  return undefined;
}
