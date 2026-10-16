const assert = require("node:assert/strict");
const { calculate, Generations, Move, Pokemon, Field } = require("@smogon/calc");

const gen = Generations.get(9);
function damage(ability, moveName, category, lightScreen) {
  const attacker = new Pokemon(gen, "Dragapult", {
    ability,
    nature: "Timid",
    evs: { spa: 252, atk: 252, spe: 252 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
  });
  const defender = new Pokemon(gen, "Landorus-Therian", {
    nature: "Impish",
    evs: { hp: 252, def: 252 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
  });
  const move = new Move(gen, moveName);
  assert.equal(move.category, category, `${moveName} should be ${category}`);
  const field = new Field({ gameType: "Singles", defenderSide: { isLightScreen: lightScreen } });
  const result = calculate(gen, attacker, defender, move, field);
  const rolls = Array.isArray(result.damage) ? result.damage : [result.damage];
  return { min: Math.min(...rolls), max: Math.max(...rolls) };
}

const normalOff = damage("Clear Body", "Draco Meteor", "Special", false);
const normalOn = damage("Clear Body", "Draco Meteor", "Special", true);
assert.ok(normalOn.max < normalOff.max, "Light Screen should reduce special damage to a defender without Infiltrator");

const infiltratorOff = damage("Infiltrator", "Draco Meteor", "Special", false);
const infiltratorOn = damage("Infiltrator", "Draco Meteor", "Special", true);
assert.deepEqual(infiltratorOn, infiltratorOff, "Infiltrator should bypass the defender's Light Screen");

function fieldDamage(moveName, fieldOptions) {
  const attacker = new Pokemon(gen, "Dragapult", {
    ability: "Clear Body", nature: "Timid", evs: { spa: 252, spe: 252 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
  });
  const defender = new Pokemon(gen, "Landorus-Therian", {
    nature: "Impish", evs: { hp: 252, def: 252 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
  });
  const result = calculate(gen, attacker, defender, new Move(gen, moveName), new Field({ gameType: "Singles", ...fieldOptions }));
  const values = Array.isArray(result.damage) ? result.damage.flat(Infinity) : [result.damage];
  return { min: Math.min(...values), max: Math.max(...values), description: result.desc() };
}
const clearWeather = fieldDamage("Hydro Pump", {});
const rain = fieldDamage("Hydro Pump", { weather: "Rain" });
assert.ok(rain.max > clearWeather.max, "Rain should increase Water-type move damage");
const noHazard = fieldDamage("Draco Meteor", {});
const withRocks = fieldDamage("Draco Meteor", { defenderSide: { isSR: true } });
assert.notEqual(withRocks.description, noHazard.description, "Stealth Rock should be represented in the calculator description");

console.log("Field-effect regression checks passed: screens, Infiltrator, rain, and Stealth Rock.");
