import { Dex } from "@pkmn/dex";

const requiredMoves = ["Tackle", "Earthquake", "Leech Seed", "Salt Cure"];
const missing = [];
for (const name of requiredMoves) {
  const move = Dex.moves.get(name);
  if (!move || move.exists === false || !(typeof move.desc === "string" && move.desc.trim()) && !(typeof move.shortDesc === "string" && move.shortDesc.trim())) {
    missing.push(name);
  }
}
if (missing.length) {
  console.error(`Bundled pkmn/ps move descriptions are missing for: ${missing.join(", ")}`);
  process.exit(1);
}
console.log(`Verified bundled pkmn/ps move descriptions: ${requiredMoves.join(", ")}`);
