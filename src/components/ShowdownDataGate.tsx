"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { loadShowdownData } from "../lib/showdown-data";
import { getLoadedShowdownData } from "../lib/showdown-data/client";

type LoadingStatus = { kind: "loading"; percent: number; label: string; detail: string };
type Status = LoadingStatus | { kind: "ready" } | { kind: "error"; message: string };

/** Ensures synchronous analysis helpers only run after the bundled data index is ready. */
export default function ShowdownDataGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(() => getLoadedShowdownData()
    ? { kind: "ready" }
    : { kind: "loading", percent: 0, label: "Preparing local data", detail: "Loading the bundled Pokémon Showdown snapshot." });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (getLoadedShowdownData()) {
      setStatus({ kind: "ready" });
      return () => { cancelled = true; };
    }
    setStatus({ kind: "loading", percent: 3, label: "Starting up", detail: "Using data bundled with Pokémon Team Lab; no Showdown website request is needed." });
    loadShowdownData(attempt > 0, (percent, label, detail) => {
      if (!cancelled) setStatus({ kind: "loading", percent, label, detail });
    }).then(() => {
      if (!cancelled) setStatus({ kind: "ready" });
    }).catch(error => {
      if (!cancelled) setStatus({ kind: "error", message: error instanceof Error ? error.message : "The bundled Pokémon Showdown data could not be initialized." });
    });
    return () => { cancelled = true; };
  }, [attempt]);

  if (status.kind === "ready") return children;
  if (status.kind === "error") {
    return <main className="app-shell data-loader-shell"><section className="panel data-loader-card" role="alert">
      <div className="data-loader-mark" aria-hidden="true">PTL</div>
      <p className="data-loader-eyebrow">LOCAL GAME DATA</p>
      <h1>Couldn’t prepare Pokémon data</h1>
      <p>The bundled Pokémon Showdown data could not be initialized. This does not depend on your connection.</p>
      <p className="support-footnote">{status.message}</p>
      <button className="primary" type="button" onClick={() => setAttempt(value => value + 1)}>Retry initialization</button>
    </section></main>;
  }
  return <main className="app-shell data-loader-shell"><section className="panel data-loader-card" aria-live="polite" aria-busy="true">
    <div className="data-loader-mark" aria-hidden="true"><span>PTL</span></div>
    <p className="data-loader-eyebrow">POKÉMON TEAM LAB</p>
    <h1>Preparing battle data</h1>
    <p className="data-loader-intro">Building the local index for team analysis. No requests are made to the Pokémon Showdown website.</p>
    <div className="data-loader-progress-meta"><strong>{status.label}</strong><span>{status.percent}%</span></div>
    <div className="data-loader-track" role="progressbar" aria-label="Loading bundled Pokémon Showdown data" aria-valuemin={0} aria-valuemax={100} aria-valuenow={status.percent}>
      <span style={{ width: `${status.percent}%` }} />
    </div>
    <p className="data-loader-detail">{status.detail}</p>
    <ol className="data-loader-steps">
      <li className={status.percent >= 28 ? "complete" : status.percent >= 8 ? "active" : ""}>Pokémon and forms</li>
      <li className={status.percent >= 72 ? "complete" : status.percent >= 48 ? "active" : ""}>Moves, items and abilities</li>
      <li className={status.percent >= 92 ? "complete" : status.percent >= 72 ? "active" : ""}>Learnsets and natures</li>
      <li className={status.percent >= 100 ? "complete" : status.percent >= 92 ? "active" : ""}>Integrity checks</li>
    </ol>
    <p className="data-loader-footnote">Official source: <code>smogon/pokemon-showdown</code> · bundled snapshot</p>
  </section></main>;
}
