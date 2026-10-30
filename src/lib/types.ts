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
  importedTeraType?: string;
  dead?: boolean;
  currentHp?: number;
  boostedStat?: "atk" | "def" | "spa" | "spd" | "spe" | "";
  alliesFainted?: number;
  status?: "" | "brn" | "par" | "psn" | "tox" | "slp" | "frz";
  evs: Stats;
  ivs: Stats;
  moves: string[];
};

export type Team = PokemonSet[];

export type FieldState = {
  gameType?: "Singles" | "Doubles";
  weather: "" | "Sun" | "Rain" | "Sand" | "Snow";
  terrain: "" | "Electric" | "Grassy" | "Misty" | "Psychic";
  defenderStealthRock: boolean;
  defenderSpikes: number;
  defenderReflect: boolean;
  defenderLightScreen: boolean;
  defenderAuroraVeil: boolean;
  defenderLeechSeed: boolean;
  defenderSaltCure: boolean;
  trickRoom: boolean;
  tailwindSide: "" | "attacker" | "defender";
  protectSide?: "" | "attacker" | "defender";
  nightmareSide?: "" | "attacker" | "defender";
  foresightSide?: "" | "attacker" | "defender";
  chargeSide?: "" | "attacker" | "defender";
  helpingHandSide?: "" | "attacker" | "defender";
  flowerGiftSide?: "" | "attacker" | "defender";
  powerTrickSide?: "" | "attacker" | "defender";
  steelySpiritSide?: "" | "attacker" | "defender";
  friendGuardSide?: "" | "attacker" | "defender";
  batterySide?: "" | "attacker" | "defender";
  powerSpotSide?: "" | "attacker" | "defender";
  switchingOutSide?: "" | "attacker" | "defender";
};

export type StatStages = { atk: number; spa: number; def: number; spd: number; spe: number; acc: number; eva: number };

export type MoveDetails = {
  name: string;
  type: string;
  category: string;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  priority: number;
  target?: string;
  description: string;
};

export type DamageHistogramEntry = { damage: number; probability: number };
export type DamageHitCount = { hits: number; probability: number };

export type DamageSummary = {
  move: string;
  min: number;
  max: number;
  /** Defender maximum HP, used to express histograms in total-HP percentages. */
  maxHp: number;
  /** Probability-weighted median damage across the full move distribution. */
  medianDamage?: number;
  /** First successful hit damage range for multi-hit move labels, as a percentage of maximum HP. */
  firstHitMinPct?: number;
  firstHitMaxPct?: number;
  rolls?: number[];
  /** Probability distribution for the complete move; includes a zero-damage miss outcome when relevant. */
  histogram?: DamageHistogramEntry[];
  hitCounts?: DamageHitCount[];
  accuracy?: number;
  distributionApproximate?: boolean;
  distributionNote?: string;
  minPct: number;
  maxPct: number;
  /** Critical damage range computed by @smogon/calc for the same battle state. */
  critMinPct?: number;
  critMaxPct?: number;
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
