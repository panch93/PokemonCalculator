import { Team } from "./types";

const blankEvs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
const maxIVs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };

export const sampleTeamA: Team = [
  { name: "Dragapult", species: "Dragapult", item: "Heavy-Duty Boots", ability: "Infiltrator", nature: "Timid", level: 100, teraType: "Ghost", importedTeraType: "Ghost", evs: { ...blankEvs, spa: 252, spe: 252 }, ivs: { ...maxIVs }, moves: ["Draco Meteor", "Shadow Ball", "Flamethrower", "U-turn"] },
  { name: "Great Tusk", species: "Great Tusk", item: "Leftovers", ability: "Protosynthesis", nature: "Jolly", level: 100, teraType: "Water", importedTeraType: "Water", evs: { ...blankEvs, hp: 252, atk: 252, spe: 4 }, ivs: { ...maxIVs }, moves: ["Headlong Rush", "Close Combat", "Rapid Spin", "Stealth Rock"] },
  { name: "Gholdengo", species: "Gholdengo", item: "Air Balloon", ability: "Good as Gold", nature: "Timid", level: 100, teraType: "Flying", importedTeraType: "Flying", evs: { ...blankEvs, spa: 252, spe: 252 }, ivs: { ...maxIVs }, moves: ["Make It Rain", "Shadow Ball", "Focus Blast", "Nasty Plot"] },
  { name: "Slowking", species: "Slowking", item: "Heavy-Duty Boots", ability: "Regenerator", nature: "Calm", level: 100, teraType: "Water", importedTeraType: "Water", evs: { ...blankEvs, hp: 252, spd: 252 }, ivs: { ...maxIVs }, moves: ["Future Sight", "Chilly Reception", "Slack Off", "Scald"] },
  { name: "Kingambit", species: "Kingambit", item: "Black Glasses", ability: "Supreme Overlord", nature: "Adamant", level: 100, teraType: "Dark", importedTeraType: "Dark", evs: { ...blankEvs, hp: 252, atk: 252 }, ivs: { ...maxIVs }, moves: ["Kowtow Cleave", "Sucker Punch", "Iron Head", "Swords Dance"] },
  { name: "Rillaboom", species: "Rillaboom", item: "Choice Band", ability: "Grassy Surge", nature: "Adamant", level: 100, teraType: "Grass", importedTeraType: "Grass", evs: { ...blankEvs, atk: 252, spe: 252 }, ivs: { ...maxIVs }, moves: ["Grassy Glide", "Wood Hammer", "Knock Off", "U-turn"] },
];

export const sampleTeamB: Team = [
  { name: "Landorus-Therian", species: "Landorus-Therian", item: "Rocky Helmet", ability: "Intimidate", nature: "Impish", level: 100, teraType: "Water", importedTeraType: "Water", evs: { ...blankEvs, hp: 252, def: 252 }, ivs: { ...maxIVs }, moves: ["Earthquake", "U-turn", "Stealth Rock", "Toxic"] },
  { name: "Garganacl", species: "Garganacl", item: "Leftovers", ability: "Purifying Salt", nature: "Careful", level: 100, teraType: "Water", importedTeraType: "Water", evs: { ...blankEvs, hp: 252, spd: 252 }, ivs: { ...maxIVs }, moves: ["Salt Cure", "Recover", "Protect", "Iron Defense"] },
  { name: "Volcarona", species: "Volcarona", item: "Heavy-Duty Boots", ability: "Flame Body", nature: "Timid", level: 100, teraType: "Grass", importedTeraType: "Grass", evs: { ...blankEvs, spa: 252, spe: 252 }, ivs: { ...maxIVs }, moves: ["Quiver Dance", "Fiery Dance", "Bug Buzz", "Giga Drain"] },
  { name: "Ogerpon-Wellspring", species: "Ogerpon-Wellspring", item: "Wellspring Mask", ability: "Water Absorb", nature: "Jolly", level: 100, teraType: "Water", importedTeraType: "Water", evs: { ...blankEvs, atk: 252, spe: 252 }, ivs: { ...maxIVs }, moves: ["Ivy Cudgel", "Horn Leech", "Knock Off", "Swords Dance"] },
  { name: "Iron Valiant", species: "Iron Valiant", item: "Booster Energy", ability: "Quark Drive", nature: "Timid", level: 100, teraType: "Fairy", importedTeraType: "Fairy", evs: { ...blankEvs, spa: 252, spe: 252 }, ivs: { ...maxIVs }, moves: ["Moonblast", "Close Combat", "Thunderbolt", "Encore"] },
  { name: "Corviknight", species: "Corviknight", item: "Leftovers", ability: "Pressure", nature: "Impish", level: 100, teraType: "Dragon", importedTeraType: "Dragon", evs: { ...blankEvs, hp: 252, def: 252 }, ivs: { ...maxIVs }, moves: ["Roost", "Defog", "Body Press", "U-turn"] },
];

export const EMPTY_SET = (): Team[0] => ({
  name: "New Pokemon",
  species: "Pikachu",
  item: "",
  ability: "",
  nature: "Hardy",
  level: 100,
  teraType: "",
  importedTeraType: "",
  evs: { ...blankEvs },
  ivs: { ...maxIVs },
  moves: ["Thunderbolt"],
});
