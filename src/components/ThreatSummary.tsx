"use client";

import { Matchup } from "../lib/types";

export default function ThreatSummary({ left, right, matchups }: { left: { name: string }[]; right: { name: string }[]; matchups: (Matchup | null)[][] }) {
  const threats = right.map((defender, col) => {
    let answers = 0;
    let best = 0;
    for (let row = 0; row < left.length; row++) {
      const item = matchups[row]?.[col];
      const pct = item?.best?.maxPct || 0;
      if (pct >= 100) answers++;
      best = Math.max(best, pct);
    }
    return { name: defender.name, answers, best };
  }).sort((a, b) => b.best - a.best);

  return (
    <section className="panel threat-panel">
      <div className="panel-title-row">
        <div><h2>Threat snapshot</h2><p>Using each Team A member’s selected matrix move, how many have a potential OHKO against each Team B member.</p></div>
      </div>
      <div className="threat-grid">
        {threats.map(t => (
          <div className="threat-card" key={t.name}>
            <strong>{t.name}</strong>
            <span>{t.answers}/6 potential OHKO answers</span>
            <small>Best simulated max: {t.best.toFixed(0)}%</small>
          </div>
        ))}
      </div>
    </section>
  );
}
