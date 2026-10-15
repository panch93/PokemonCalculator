"use client";

import { useEffect, useState } from "react";
import { exportTeam, parseTeamPaste } from "../lib/team-parser";
import { Team } from "../lib/types";

type Props = { left: Team; right: Team; open: boolean; onClose: () => void; onImport: (side: "left" | "right", team: Team) => void };

export default function TeamPastePanel({ left, right, open, onClose, onImport }: Props) {
  const [textA, setTextA] = useState("");
  const [textB, setTextB] = useState("");
  useEffect(() => {
    if (open) { setTextA(exportTeam(left)); setTextB(exportTeam(right)); }
  }, [open, left, right]);

  const importNow = (side: "left" | "right") => {
    const parsed = parseTeamPaste(side === "left" ? textA : textB);
    if (parsed.length) onImport(side, parsed);
  };
  const download = (side: "left" | "right") => {
    const text = exportTeam(side === "left" ? left : right);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = side === "left" ? "team-a.txt" : "team-b.txt"; anchor.click();
    URL.revokeObjectURL(url);
  };
  if (!open) return null;
  return <div className="teams-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="teams-modal panel" role="dialog" aria-modal="true" aria-labelledby="teams-modal-title">
      <div className="panel-title-row"><div><h2 id="teams-modal-title">Teams · Import / Export</h2><p>Manage both teams side by side using Pokémon Showdown format.</p></div><button onClick={onClose} aria-label="Close teams">Close ×</button></div>
      <div className="teams-two-column">
        <section className="team-editor"><div className="team-editor-heading"><h3>Team A</h3><span>{left.length}/6 Pokémon</span></div><textarea aria-label="Team A Showdown text" value={textA} onChange={e => setTextA(e.target.value)} spellCheck={false}/><div className="button-row"><button className="primary" onClick={() => importNow("left")}>Import Team A</button><button onClick={() => download("left")}>Export Team A</button><button onClick={() => navigator.clipboard?.writeText(exportTeam(left))}>Copy current</button></div></section>
        <section className="team-editor"><div className="team-editor-heading"><h3>Team B</h3><span>{right.length}/6 Pokémon</span></div><textarea aria-label="Team B Showdown text" value={textB} onChange={e => setTextB(e.target.value)} spellCheck={false}/><div className="button-row"><button className="primary" onClick={() => importNow("right")}>Import Team B</button><button onClick={() => download("right")}>Export Team B</button><button onClick={() => navigator.clipboard?.writeText(exportTeam(right))}>Copy current</button></div></section>
      </div>
    </section>
  </div>;
}
