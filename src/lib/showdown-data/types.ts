export type StatKey = "hp" | "atk" | "def" | "spa" | "spd" | "spe";

export type ShowdownSpecies = {
  name: string;
  num?: number;
  types?: string[];
  baseStats?: Partial<Record<StatKey, number>>;
  abilities?: Record<string, string>;
  baseSpecies?: string;
  changesFrom?: string;
  forme?: string;
  [key: string]: unknown;
};

export type ShowdownMove = {
  name: string;
  desc?: string;
  shortDesc?: string;
  type?: string;
  category?: string;
  priority?: number;
  flags?: Record<string, number>;
  [key: string]: unknown;
};

export type ShowdownDescribedEntry = {
  name: string;
  desc?: string;
  shortDesc?: string;
  [key: string]: unknown;
};

export type ShowdownNature = { name: string; plus?: string; minus?: string };

export type ShowdownLearnsetEntry = {
  learnset?: Record<string, unknown>;
  inherit?: boolean;
  baseSpecies?: string;
  [key: string]: unknown;
};

export type ShowdownData = {
  species: Record<string, ShowdownSpecies>;
  moves: Record<string, ShowdownMove>;
  items: Record<string, ShowdownDescribedEntry>;
  abilities: Record<string, ShowdownDescribedEntry>;
  natures: Record<string, ShowdownNature>;
  learnsets: Record<string, ShowdownLearnsetEntry>;
  loadedAt: number;
};
