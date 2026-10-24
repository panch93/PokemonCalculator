/** Shared types for the format picker and validation boundary. */
export type ShowdownFormatOption = {
  label: string;
  id: string;
  section?: string;
  source?: "remote" | "bundled";
  mod?: string;
  gameType?: string;
  searchShow?: boolean;
  challengeShow?: boolean;
  team?: string;
  ruleset?: string[];
  banlist?: string[];
  remoteRuleset?: string[];
  remoteBanlist?: string[];
  remoteMod?: string;
  remoteGameType?: string;
  remoteTeam?: string;
};

export type FormatResolution =
  | { supported: true; id: string; label: string }
  | { supported: false; id: null; label: string; reason: string };

export type TeamFormatValidation = {
  supported: boolean;
  formatLabel: string;
  valid: boolean | null;
  issues: string[];
  warnings?: string[];
  message?: string;
};

export const EVERYTHING_FORMAT: ShowdownFormatOption = {
  label: "Everything!",
  id: "everything",
  section: "Custom",
  source: "remote",
};
