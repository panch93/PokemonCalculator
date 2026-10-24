"use client";

import { useEffect, useState } from "react";
import type { Team } from "../lib/types";
import type { TeamFormatValidation } from "../lib/format-types";
import { validateTeamForFormatInBrowser } from "../lib/browser-showdown-validator";

const initialResult = (format: string): TeamFormatValidation => ({
  supported: false,
  formatLabel: format,
  valid: null,
  issues: [],
  warnings: [],
  message: "Waiting for browser diagnostics…",
});

export default function FormatLegalityPanel({ teamA, teamB, format }: { teamA: Team; teamB: Team; format: string }) {
  const [expanded, setExpanded] = useState(true);
  const [validationA, setValidationA] = useState<TeamFormatValidation>(() => initialResult(format));
  const [validationB, setValidationB] = useState<TeamFormatValidation>(() => initialResult(format));

  useEffect(() => {
    let cancelled = false;
    setValidationA(initialResult(format));
    setValidationB(initialResult(format));
    Promise.all([
      validateTeamForFormatInBrowser(teamA, format),
      validateTeamForFormatInBrowser(teamB, format),
    ]).then(([resultA, resultB]) => {
      if (cancelled) return;
      setValidationA(resultA);
      setValidationB(resultB);
    });
    return () => { cancelled = true; };
  }, [teamA, teamB, format]);

  const validations = [{ label: "Team A", result: validationA }, { label: "Team B", result: validationB }];
  return <section className="format-validation panel" aria-labelledby="format-validation-title">
    <div className="panel-title-row">
      <div><h2 id="format-validation-title">Format legality</h2><p>Live format metadata · {format}</p></div>
      <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>{expanded ? "Hide details" : "Show details"}</button>
    </div>
    <div className="format-validation-summary">
      {validations.map(({ label, result }) => <div key={label} className="format-validation-team">
        <strong>{label}</strong>
        {result.valid === false ? <span className="legality-invalid">{result.issues.length} potential issue{result.issues.length === 1 ? "" : "s"}</span>
          : result.valid === true ? <span className="legality-valid">Validated</span>
          : <span className="legality-unknown">Not fully validated</span>}
      </div>)}
    </div>
    {expanded && <div className="format-validation-details">
      {validations.map(({ label, result }) => <div key={label} className="format-validation-result">
        <h3>{label}</h3>
        {result.issues.length > 0 && <ul>{result.issues.map((issue, index) => <li key={`issue-${index}-${issue}`}>{issue}</li>)}</ul>}
        {(result.warnings?.length ?? 0) > 0 && <><h4>Needs official verification</h4><ul>{result.warnings?.map((warning, index) => <li key={`warning-${index}-${warning}`}>{warning}</li>)}</ul></>}
        <p className="legality-unknown">{result.message || "This format is not configured for validation."}</p>
      </div>)}
    </div>}
  </section>;
}
