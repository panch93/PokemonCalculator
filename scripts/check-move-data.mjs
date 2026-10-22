const MOVE_DATA_URL = "https://play.pokemonshowdown.com/data/moves.json";
const requiredMoves = ["Tackle", "Earthquake", "Leech Seed", "Salt Cure"];

function toId(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

const response = await fetch(`${MOVE_DATA_URL}?release_check=${Date.now()}`, { cache: "no-store" });
if (!response.ok) throw new Error(`Official Pokémon Showdown move data returned ${response.status}`);
const raw = await response.json();
const table = raw.moves ?? raw.Moves ?? raw.data ?? raw;
const byId = new Map(Object.entries(table).map(([id, move]) => [toId(id), move]));
const missing = requiredMoves.filter(name => {
  const move = byId.get(toId(name));
  return !move || !(typeof move.desc === "string" && move.desc.trim()) && !(typeof move.shortDesc === "string" && move.shortDesc.trim());
});
if (missing.length) {
  console.error(`Official Pokémon Showdown move descriptions are missing for: ${missing.join(", ")}`);
  process.exit(1);
}
console.log(`Verified live official Pokémon Showdown move descriptions: ${requiredMoves.join(", ")}`);
