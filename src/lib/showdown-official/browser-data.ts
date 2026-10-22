// Browser-only static imports for the pinned Pokémon Showdown data snapshot.
// This replaces Node's runtime require()/filesystem discovery in the upstream Dex.
// @ts-nocheck
import * as Abilities from "./data/abilities";
import * as Aliases from "./data/aliases";
import * as Conditions from "./data/conditions";
import * as FormatsData from "./data/formats-data";
import * as Items from "./data/items";
import * as Learnsets from "./data/learnsets";
import * as Moves from "./data/moves";
import * as Natures from "./data/natures";
import * as Pokedex from "./data/pokedex";
import * as PokemonGoData from "./data/pokemongo";
import * as Rulesets from "./data/rulesets";
import * as Scripts from "./data/scripts";
import * as TypeChart from "./data/typechart";
import * as TextNames from "./data/text/names";
import * as TextAbilities from "./data/text/abilities";
import * as TextItems from "./data/text/items";
import * as TextMoves from "./data/text/moves";
import * as TextPokedex from "./data/text/pokedex";
import * as TextTags from "./data/text/tags";
import * as TextDefault from "./data/text/default";
import * as FormatsConfig from "./config/formats";

import * as Gen1Conditions from "./data/mods/gen1/conditions";
import * as Gen1FormatsData from "./data/mods/gen1/formats-data";
import * as Gen1Moves from "./data/mods/gen1/moves";
import * as Gen1Pokedex from "./data/mods/gen1/pokedex";
import * as Gen1Rulesets from "./data/mods/gen1/rulesets";
import * as Gen1Scripts from "./data/mods/gen1/scripts";
import * as Gen1TypeChart from "./data/mods/gen1/typechart";
import * as Gen2Conditions from "./data/mods/gen2/conditions";
import * as Gen2FormatsData from "./data/mods/gen2/formats-data";
import * as Gen2Items from "./data/mods/gen2/items";
import * as Gen2Learnsets from "./data/mods/gen2/learnsets";
import * as Gen2Moves from "./data/mods/gen2/moves";
import * as Gen2Pokedex from "./data/mods/gen2/pokedex";
import * as Gen2Rulesets from "./data/mods/gen2/rulesets";
import * as Gen2Scripts from "./data/mods/gen2/scripts";
import * as Gen2TypeChart from "./data/mods/gen2/typechart";
import * as Gen3Abilities from "./data/mods/gen3/abilities";
import * as Gen3Conditions from "./data/mods/gen3/conditions";
import * as Gen3FormatsData from "./data/mods/gen3/formats-data";
import * as Gen3Items from "./data/mods/gen3/items";
import * as Gen3Moves from "./data/mods/gen3/moves";
import * as Gen3Rulesets from "./data/mods/gen3/rulesets";
import * as Gen3Scripts from "./data/mods/gen3/scripts";
import * as Gen4Abilities from "./data/mods/gen4/abilities";
import * as Gen4Conditions from "./data/mods/gen4/conditions";
import * as Gen4FormatsData from "./data/mods/gen4/formats-data";
import * as Gen4Items from "./data/mods/gen4/items";
import * as Gen4Moves from "./data/mods/gen4/moves";
import * as Gen4Pokedex from "./data/mods/gen4/pokedex";
import * as Gen4Rulesets from "./data/mods/gen4/rulesets";
import * as Gen4Scripts from "./data/mods/gen4/scripts";
import * as Gen5Abilities from "./data/mods/gen5/abilities";
import * as Gen5Conditions from "./data/mods/gen5/conditions";
import * as Gen5FormatsData from "./data/mods/gen5/formats-data";
import * as Gen5Items from "./data/mods/gen5/items";
import * as Gen5Moves from "./data/mods/gen5/moves";
import * as Gen5Pokedex from "./data/mods/gen5/pokedex";
import * as Gen5Rulesets from "./data/mods/gen5/rulesets";
import * as Gen5Scripts from "./data/mods/gen5/scripts";
import * as Gen5TypeChart from "./data/mods/gen5/typechart";
import * as Gen6Abilities from "./data/mods/gen6/abilities";
import * as Gen6Conditions from "./data/mods/gen6/conditions";
import * as Gen6FormatsData from "./data/mods/gen6/formats-data";
import * as Gen6Items from "./data/mods/gen6/items";
import * as Gen6Learnsets from "./data/mods/gen6/learnsets";
import * as Gen6Moves from "./data/mods/gen6/moves";
import * as Gen6Pokedex from "./data/mods/gen6/pokedex";
import * as Gen6Scripts from "./data/mods/gen6/scripts";
import * as Gen6TypeChart from "./data/mods/gen6/typechart";
import * as Gen7Abilities from "./data/mods/gen7/abilities";
import * as Gen7FormatsData from "./data/mods/gen7/formats-data";
import * as Gen7Items from "./data/mods/gen7/items";
import * as Gen7Moves from "./data/mods/gen7/moves";
import * as Gen7Pokedex from "./data/mods/gen7/pokedex";
import * as Gen7Rulesets from "./data/mods/gen7/rulesets";
import * as Gen7Scripts from "./data/mods/gen7/scripts";
import * as Gen8Abilities from "./data/mods/gen8/abilities";
import * as Gen8FormatsData from "./data/mods/gen8/formats-data";
import * as Gen8Items from "./data/mods/gen8/items";
import * as Gen8Learnsets from "./data/mods/gen8/learnsets";
import * as Gen8Moves from "./data/mods/gen8/moves";
import * as Gen8Pokedex from "./data/mods/gen8/pokedex";
import * as Gen8Rulesets from "./data/mods/gen8/rulesets";
import * as Gen8Scripts from "./data/mods/gen8/scripts";
import * as Gen8TypeChart from "./data/mods/gen8/typechart";

export const BrowserDataModules: Record<string, Record<string, unknown>> = {
  Abilities, Aliases, Conditions, FormatsData, Items, Learnsets, Moves, Natures,
  Pokedex, PokemonGoData, Rulesets, Scripts, TypeChart,
};
export const BrowserModDataModules: Record<string, Record<string, Record<string, unknown>>> = {
  gen1: {
    Conditions: Gen1Conditions,
    FormatsData: Gen1FormatsData,
    Moves: Gen1Moves,
    Pokedex: Gen1Pokedex,
    Rulesets: Gen1Rulesets,
    Scripts: Gen1Scripts,
    TypeChart: Gen1TypeChart
  },
  gen2: {
    Conditions: Gen2Conditions,
    FormatsData: Gen2FormatsData,
    Items: Gen2Items,
    Learnsets: Gen2Learnsets,
    Moves: Gen2Moves,
    Pokedex: Gen2Pokedex,
    Rulesets: Gen2Rulesets,
    Scripts: Gen2Scripts,
    TypeChart: Gen2TypeChart
  },
  gen3: {
    Abilities: Gen3Abilities,
    Conditions: Gen3Conditions,
    FormatsData: Gen3FormatsData,
    Items: Gen3Items,
    Moves: Gen3Moves,
    Rulesets: Gen3Rulesets,
    Scripts: Gen3Scripts
  },
  gen4: {
    Abilities: Gen4Abilities,
    Conditions: Gen4Conditions,
    FormatsData: Gen4FormatsData,
    Items: Gen4Items,
    Moves: Gen4Moves,
    Pokedex: Gen4Pokedex,
    Rulesets: Gen4Rulesets,
    Scripts: Gen4Scripts
  },
  gen5: {
    Abilities: Gen5Abilities,
    Conditions: Gen5Conditions,
    FormatsData: Gen5FormatsData,
    Items: Gen5Items,
    Moves: Gen5Moves,
    Pokedex: Gen5Pokedex,
    Rulesets: Gen5Rulesets,
    Scripts: Gen5Scripts,
    TypeChart: Gen5TypeChart
  },
  gen6: {
    Abilities: Gen6Abilities,
    Conditions: Gen6Conditions,
    FormatsData: Gen6FormatsData,
    Items: Gen6Items,
    Learnsets: Gen6Learnsets,
    Moves: Gen6Moves,
    Pokedex: Gen6Pokedex,
    Scripts: Gen6Scripts,
    TypeChart: Gen6TypeChart
  },
  gen7: {
    Abilities: Gen7Abilities,
    FormatsData: Gen7FormatsData,
    Items: Gen7Items,
    Moves: Gen7Moves,
    Pokedex: Gen7Pokedex,
    Rulesets: Gen7Rulesets,
    Scripts: Gen7Scripts
  },
  gen8: {
    Abilities: Gen8Abilities,
    FormatsData: Gen8FormatsData,
    Items: Gen8Items,
    Learnsets: Gen8Learnsets,
    Moves: Gen8Moves,
    Pokedex: Gen8Pokedex,
    Rulesets: Gen8Rulesets,
    Scripts: Gen8Scripts,
    TypeChart: Gen8TypeChart
  }
};

export const BrowserTextModules: Record<string, Record<string, unknown>> = {
  names: TextNames, abilities: TextAbilities, items: TextItems, moves: TextMoves,
  pokedex: TextPokedex, tags: TextTags, default: TextDefault,
};
export const BrowserFormats = FormatsConfig.Formats;
export const BrowserModNames = [
  'afd',
  'biomechmons',
  'champions',
  'championsregmb',
  'chatbats',
  'fullpotential',
  'gen1',
  'gen1jpn',
  'gen1stadium',
  'gen2',
  'gen2stadium2',
  'gen3',
  'gen3colosseum',
  'gen3frlg',
  'gen3rs',
  'gen4',
  'gen4pt',
  'gen5',
  'gen5bw1',
  'gen6',
  'gen6xy',
  'gen7',
  'gen7letsgo',
  'gen7sm',
  'gen8',
  'gen8bdsp',
  'gen8dlc1',
  'gen8legends',
  'gen9dlc1',
  'gen9legends',
  'gen9mnmlimitedsupply',
  'gen9predlc',
  'gen9randomtandem',
  'gen9ssb',
  'linked',
  'mixandmega',
  'monkeyspaw',
  'partnersincrime',
  'passiveaggressive',
  'pokebilities',
  'pokemoves',
  'randomroulette',
  'sharedpower',
  'sharingiscaring',
  'teraoverride',
  'thecardgame',
  'trademarked'
];
