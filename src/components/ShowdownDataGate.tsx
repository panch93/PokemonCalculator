"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { loadShowdownData } from "../lib/showdown-data";

type Status = { kind: "loading" } | { kind: "ready" } | { kind: "error"; message: string };

/** Ensures synchronous analysis helpers only run after live upstream data is ready. */
export default function ShowdownDataGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus({ kind: "loading" });
    loadShowdownData(attempt > 0).then(() => {
      if (!cancelled) setStatus({ kind: "ready" });
    }).catch(error => {
      if (!cancelled) setStatus({ kind: "error", message: error instanceof Error ? error.message : "Could not load live Pokémon Showdown data." });
    });
    return () => { cancelled = true; };
  }, [attempt]);

  if (status.kind === "ready") return children;
  if (status.kind === "error") {
    return <main className="app-shell"><section className="panel"><h1>Pokémon Showdown data unavailable</h1><p>The app needs the current official data from play.pokemonshowdown.com to calculate team details. Check your connection and try again.</p><p className="support-footnote">{status.message}</p><button className="primary" type="button" onClick={() => setAttempt(value => value + 1)}>Retry data load</button></section></main>;
  }
  return <main className="app-shell"><section className="panel"><h1>Loading live Pokémon Showdown data…</h1><p>Fetching the current species, moves, items, abilities, natures, and learnsets.</p></section></main>;
}
