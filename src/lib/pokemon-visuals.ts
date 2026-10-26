export const POKEMON_TYPES = ["Normal", "Fire", "Water", "Electric", "Grass", "Ice", "Fighting", "Poison", "Ground", "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy"] as const;

export function speciesSpriteSlug(species: string) {
  // Showdown sprite filenames use the species ID (toID): spaces and punctuation
  // are removed, not replaced with hyphens (e.g. Iron Valiant -> ironvaliant).
  return species.trim().toLowerCase()
    .replace(/♀/g, "f").replace(/♂/g, "m")
    .replace(/[.’']/g, "").replace(/[^a-z0-9]/g, "");
}

function hyphenatedSpriteSlug(species: string) {
  return species.trim().toLowerCase()
    .replace(/♀/g, "-f").replace(/♂/g, "-m")
    .replace(/[.’']/g, "").replace(/[ _]+/g, "-")
    .replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function getSpriteCandidates(species: string) {
  const slug = speciesSpriteSlug(species);
  const hyphenated = hyphenatedSpriteSlug(species);
  return [...new Set([
    `https://play.pokemonshowdown.com/sprites/gen9/${slug}.png`,
    `https://play.pokemonshowdown.com/sprites/home/${slug}.png`,
    `https://play.pokemonshowdown.com/sprites/gen5/${slug}.png`,
    `https://play.pokemonshowdown.com/sprites/dex/${slug}.png`,
    ...(hyphenated !== slug ? [
      `https://play.pokemonshowdown.com/sprites/gen9/${hyphenated}.png`,
      `https://play.pokemonshowdown.com/sprites/home/${hyphenated}.png`,
      `https://play.pokemonshowdown.com/sprites/gen5/${hyphenated}.png`,
      `https://play.pokemonshowdown.com/sprites/dex/${hyphenated}.png`,
    ] : []),
  ])];
}

const WEAK_TO: Record<string, string[]> = {
  Normal: ["Fighting"], Fire: ["Water", "Ground", "Rock"], Water: ["Electric", "Grass"],
  Electric: ["Ground"], Grass: ["Fire", "Ice", "Poison", "Flying", "Bug"], Ice: ["Fire", "Fighting", "Rock", "Steel"],
  Fighting: ["Flying", "Psychic", "Fairy"], Poison: ["Ground", "Psychic"], Ground: ["Water", "Grass", "Ice"],
  Flying: ["Electric", "Ice", "Rock"], Psychic: ["Bug", "Ghost", "Dark"], Bug: ["Fire", "Flying", "Rock"],
  Rock: ["Water", "Grass", "Fighting", "Ground", "Steel"], Ghost: ["Ghost", "Dark"], Dragon: ["Ice", "Dragon", "Fairy"],
  Dark: ["Fighting", "Bug", "Fairy"], Steel: ["Fire", "Fighting", "Ground"], Fairy: ["Poison", "Steel"],
};
const RESISTS: Record<string, string[]> = {
  Normal: [], Fire: ["Fire", "Grass", "Ice", "Bug", "Steel", "Fairy"], Water: ["Fire", "Water", "Ice", "Steel"],
  Electric: ["Electric", "Flying", "Steel"], Grass: ["Water", "Electric", "Grass", "Ground"], Ice: ["Ice"],
  Fighting: ["Bug", "Rock", "Dark"], Poison: ["Grass", "Fighting", "Poison", "Bug", "Fairy"],
  Ground: ["Poison", "Rock"], Flying: ["Grass", "Fighting", "Bug"], Psychic: ["Fighting", "Psychic"],
  Bug: ["Grass", "Fighting", "Ground"], Rock: ["Normal", "Fire", "Poison", "Flying"], Ghost: ["Poison", "Bug"],
  Dragon: ["Fire", "Water", "Electric", "Grass"], Dark: ["Ghost", "Dark"], Steel: ["Normal", "Grass", "Ice", "Flying", "Psychic", "Bug", "Rock", "Dragon", "Steel", "Fairy"],
  Fairy: ["Fighting", "Bug", "Dark"],
};
const IMMUNE_TO: Record<string, string[]> = {
  Normal: ["Ghost"], Electric: [], Fighting: [], Poison: [], Ground: ["Electric"], Flying: ["Ground"],
  Psychic: [], Bug: [], Rock: [], Ghost: ["Normal", "Fighting"], Dragon: [], Dark: ["Psychic"], Steel: ["Poison"], Fairy: ["Dragon"],
  Fire: [], Water: [], Grass: [], Ice: [],
};

export function typeMatchupSummary(defenderTypes: string[]) {
  const results = POKEMON_TYPES.map(attackType => {
    let multiplier = 1;
    for (const defenseType of defenderTypes) {
      if ((IMMUNE_TO[defenseType] || []).includes(attackType)) multiplier = 0;
      else if ((WEAK_TO[defenseType] || []).includes(attackType)) multiplier *= 2;
      else if ((RESISTS[defenseType] || []).includes(attackType)) multiplier *= 0.5;
    }
    return { type: attackType, multiplier };
  });
  const groups = [
    { label: "4× damage", values: results.filter(x => x.multiplier === 4) },
    { label: "2× damage", values: results.filter(x => x.multiplier === 2) },
    { label: "0.5× damage", values: results.filter(x => x.multiplier === 0.5) },
    { label: "0.25× damage", values: results.filter(x => x.multiplier === 0.25) },
    { label: "No effect", values: results.filter(x => x.multiplier === 0) },
  ].filter(group => group.values.length);
  return groups.map(group => `${group.label}: ${group.values.map(x => x.type).join(", ")}`).join("\n") || "Neutral defensive typing";
}
