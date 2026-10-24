import type { Team } from "./types";

/**
 * Stable message contract for the future browser-only Showdown validator.
 * The protocol deliberately separates "invalid" from "not verified" so a
 * missing worker, stale data bundle, or unsupported format cannot imply legal.
 */
export interface ShowdownValidatorRequest {
  requestId: string;
  formatId: string;
  team: Team;
  expectedRevision: string;
}

export interface ShowdownValidatorIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  pokemonIndex?: number;
  moveIndex?: number;
}

export type ShowdownValidatorStatus = "validated" | "unverified";

export interface ShowdownValidatorResponse {
  requestId: string;
  formatId: string;
  validatorRevision: string | null;
  dataRevision: string | null;
  status: ShowdownValidatorStatus;
  /** null means no authoritative legality result was produced. */
  valid: boolean | null;
  issues: ShowdownValidatorIssue[];
  message?: string;
}
