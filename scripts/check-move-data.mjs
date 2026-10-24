const TEXT_URL = "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/text/moves.ts";
const requiredMoves = ["Tackle", "Earthquake", "Leech Seed", "Salt Cure"];
const toId = value => String(value).toLowerCase().replace(/[^a-z0-9]/g, "");

const response = await fetch(`${TEXT_URL}?release_check=${Date.now()}`, { cache: "no-store" });
if (!response.ok) throw new Error(`Official Pokémon Showdown move text returned ${response.status}`);
const source = await response.text();

function hasDescription(id) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const entry = new RegExp(`^\\t(?:"${escaped}"|${escaped}):\\s*\\{([\\s\\S]*?)(?=^\\t(?:"[^"\\n]+"|[A-Za-z0-9]+):\\s*\\{|^};)`, "m").exec(source)?.[1];
  return !!entry && /^\t\t(?:desc|shortDesc):\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/m.test(entry);
}

const missing = requiredMoves.filter(name => !hasDescription(toId(name)));
if (missing.length) {
  console.error(`Official Pokémon Showdown text table is missing descriptions for: ${missing.join(", ")}`);
  process.exit(1);
}
console.log(`Verified official upstream move descriptions: ${requiredMoves.join(", ")}`);
