export type StatId = "hp" | "atk" | "def" | "spa" | "spd" | "spe";

export type Stats = Record<StatId, number>;

export type PokemonSet = {
  name: string;
  species: string;
  item: string;
  ability: string;
  nature: string;
  level: number;
  teraType?: string;
  dead?: boolean;
  evs: Stats;
  ivs: Stats;
  moves: string[];
};

export type Team = PokemonSet[];

export type FieldState = {
  weather: "" | "Sun" | "Rain" | "Sand" | "Snow";
  terrain: "" | "Electric" | "Grassy" | "Misty" | "Psychic";
  attackerStealthRock: boolean;
  attackerSpikes: number;
  defenderStealthRock: boolean;
  defenderSpikes: number;
  defenderReflect: boolean;
  defenderLightScreen: boolean;
  defenderAuroraVeil: boolean;
  defenderLeechSeed: boolean;
  defenderSaltCure: boolean;
};

export type StatStages = { atk: number; def: number };

export type MoveDetails = {
  name: string;
  type: string;
  category: string;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  priority: number;
  description: string;
};

export type DamageSummary = {
  move: string;
  min: number;
  max: number;
  rolls?: number[];
  minPct: number;
  maxPct: number;
  rawMinPct: number;
  rawMaxPct: number;
  effectiveHp: number;
  entryHazardDamage: number;
  entryHazardPct: number;
  ko: string;
  description: string;
};

export type Matchup = {
  attacker: PokemonSet;
  defender: PokemonSet;
  moves: DamageSummary[];
  best?: DamageSummary;
};
