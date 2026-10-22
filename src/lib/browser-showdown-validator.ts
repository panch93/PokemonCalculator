import type { Team } from "./types";
import type { TeamFormatValidation } from "./format-types";
import { findShowdownFormat, setRemoteShowdownFormats } from "./format-catalog";
import { fetchLiveShowdownFormats } from "./showdown-format-config";
import { resolveShowdownFormat } from "./format-resolution";

type WorkerReply = {
  requestId: string;
  status: "validated" | "unverified";
  valid: boolean | null;
  issues: string[];
  warnings: string[];
  message: string;
  validatorRevision: string;
  dataRevision: string | null;
};
type Pending = { resolve: (value: TeamFormatValidation) => void; formatLabel: string };
let worker: Worker | null = null;
let nextRequestId = 1;
let formatCatalogPromise: Promise<void> | null = null;
const pending = new Map<string, Pending>();

function unverified(label: string, message: string): TeamFormatValidation {
  return { supported: false, formatLabel: label, valid: null, issues: [], warnings: [], message };
}

function getWorker(): Worker {
  if (typeof window === "undefined") throw new Error("Browser worker is only available in a browser");
  if (!worker) {
    worker = new Worker(new URL("./showdown-team-validator.worker.ts", import.meta.url), { type: "module", name: "pokemon-showdown-team-validator" });
    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      const reply = event.data;
      const request = pending.get(reply.requestId);
      if (!request) return;
      pending.delete(reply.requestId);
      request.resolve({
        supported: reply.status === "validated",
        formatLabel: request.formatLabel,
        valid: reply.valid,
        issues: reply.issues,
        warnings: reply.warnings,
        message: reply.message,
      });
    };
    worker.onerror = () => {
      for (const [id, request] of pending) {
        request.resolve(unverified(request.formatLabel, "The browser validator worker failed. No legality result was inferred."));
        pending.delete(id);
      }
      worker?.terminate();
      worker = null;
    };
  }
  return worker;
}

/** Runs the bundled official TeamValidator in a browser Web Worker. */
export async function validateTeamForFormatInBrowser(team: Team, formatInput: string): Promise<TeamFormatValidation> {
  if (!formatCatalogPromise) {
    formatCatalogPromise = fetchLiveShowdownFormats().then(formats => { setRemoteShowdownFormats(formats); }).catch(() => { formatCatalogPromise = null; });
  }
  await formatCatalogPromise;
  const resolution = resolveShowdownFormat(formatInput);
  if (resolution.supported === false) return unverified(resolution.label, resolution.reason);
  const option = findShowdownFormat(formatInput);
  if (!option) return unverified(resolution.label, "The selected format is not available in the current format catalog.");
  let activeWorker: Worker;
  try { activeWorker = getWorker(); }
  catch { return unverified(resolution.label, "Browser validation is unavailable outside the browser. No legality result was inferred."); }
  const requestId = `team-validation-${nextRequestId++}`;
  return new Promise(resolve => {
    pending.set(requestId, { resolve, formatLabel: resolution.label });
    activeWorker.postMessage({
      requestId,
      team,
      format: {
        id: resolution.id,
        label: resolution.label,
        liveMetadata: option.source === "remote" || option.remoteRuleset !== undefined || option.remoteBanlist !== undefined || option.remoteMod !== undefined
          ? {
              mod: option.remoteMod ?? option.mod,
              gameType: option.remoteGameType ?? option.gameType,
              team: option.remoteTeam ?? option.team,
              ruleset: option.remoteRuleset ?? option.ruleset,
              banlist: option.remoteBanlist ?? option.banlist,
            }
          : undefined,
      },
    });
  });
}
