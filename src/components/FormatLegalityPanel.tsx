"use client";

import { useMemo, useState } from "react";
import type { Team } from "../lib/types";
import { isEverythingFormat, validateTeamForFormat } from "../lib/format-validation";

export default function FormatLegalityPanel({ teamA, teamB, format }: { teamA: Team; teamB: Team; format: string }) {
  const [expanded, setExpanded] = useState(true);
  if (isEverythingFormat(format)) return null;
  const validationA = useMemo(() => validateTeamForFormat(teamA, format), [teamA, format]);
  const validationB = useMemo(() => validateTeamForFormat(teamB, format), [teamB, format]);
  const validations = [{ label: "Team A", result: validationA }, { label: "Team B", result: validationB }];

  const hasErrors = validations.some(({ result }) => !result.supported || result.issues.length > 0);
  if (!hasErrors) return null;

  return <section className="format-validation panel" aria-labelledby="format-validation-title">
    <div className="panel-title-row">
      <div><h2 id="format-validation-title">Format legality</h2><p>Showdown rules · {format}</p></div>
      <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>{expanded ? "Hide details" : "Show details"}</button>
    </div>
    <div className="format-validation-summary">
      {validations.map(({ label, result }) => <div key={label} className="format-validation-team">
        <strong>{label}</strong>
        {result.supported ? <span className={result.valid ? "legality-valid" : "legality-invalid"}>{result.valid ? "No legality issues found" : `${result.issues.length} issue${result.issues.length === 1 ? "" : "s"}`}</span> : <span className="legality-unknown">Not validated</span>}
      </div>)}
    </div>
    {expanded && <div className="format-validation-details">
      {validations.map(({ label, result }) => <div key={label} className="format-validation-result">
        <h3>{label}</h3>
        {!result.supported ? <p className="legality-unknown">{result.message || "This format is not configured for validation."}</p>
          : result.issues.length ? <ul>{result.issues.map((issue, index) => <li key={`${index}-${issue}`}>{issue}</li>)}</ul>
          : <p className="legality-valid">This team passes the bundled Pokémon Showdown validator for {result.formatLabel}.</p>}
      </div>)}
    </div>}
  </section>;
}
