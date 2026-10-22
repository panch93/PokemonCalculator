import vm from "node:vm";

const MOVE_SCRIPT_URL = "https://play.pokemonshowdown.com/data/moves.js";
const requiredMoves = ["Tackle", "Earthquake", "Leech Seed", "Salt Cure"];
const toId = value => String(value).toLowerCase().replace(/[^a-z0-9]/g, "");

const response = await fetch(`${MOVE_SCRIPT_URL}?release_check=${Date.now()}`, { cache: "no-store" });
if (!response.ok) throw new Error(`Official Pokémon Showdown move data returned ${response.status}`);
const source = await response.text();
const exports = {};
vm.runInNewContext(source, { exports }, { timeout: 5000 });
const table = exports.BattleMovedex;
if (!table || typeof table !== "object") throw new Error("Official Pokémon Showdown moves.js did not export BattleMovedex");
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
