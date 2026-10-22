/// <reference lib="webworker" />
import type { Team } from "./types";
import { SHOWDOWN_VALIDATOR_REVISION, validateWithOfficialTeamValidator, type LiveFormatMetadata } from "./showdown-official/browser-validator";

type Request = { requestId: string; team: Team; format: { id: string; label: string; liveMetadata?: LiveFormatMetadata } };
type Response = {
  requestId: string;
  status: "validated" | "unverified";
  valid: boolean | null;
  issues: string[];
  warnings: string[];
  message: string;
  validatorRevision: string;
  dataRevision: string | null;
};
const scope = self as unknown as DedicatedWorkerGlobalScope;
const DATA_REVISION = "showdown-snapshot-c5519954b9df6801cdc9e6c8152bf38c142a11ea6761bca1374592924c7ffd63";

scope.addEventListener("message", (event: MessageEvent<Request>) => {
  const request = event.data;
  const result = validateWithOfficialTeamValidator(request.team, request.format.id, request.format.liveMetadata);
  const response: Response = {
    requestId: request.requestId,
    status: result.supported ? "validated" : "unverified",
    valid: result.valid,
    issues: result.issues,
    warnings: [],
    message: result.message,
    validatorRevision: SHOWDOWN_VALIDATOR_REVISION,
    dataRevision: result.supported ? DATA_REVISION : null,
  };
  scope.postMessage(response);
});
