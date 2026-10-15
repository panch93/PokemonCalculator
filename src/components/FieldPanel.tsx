"use client";

import { FieldState } from "../lib/types";

type Props = { value: FieldState; onChange: (next: FieldState) => void };

type ToggleProps = { label: string; checked: boolean; onChange: (checked: boolean) => void };
function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      className={`field-toggle ${checked ? "active" : ""}`}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
    >
      <span>{label}</span><span className="field-toggle-state">{checked ? "ON" : "OFF"}</span>
    </button>
  );
}

export default function FieldPanel({ value, onChange }: Props) {
  const set = <K extends keyof FieldState>(key: K, next: FieldState[K]) =>
    onChange({ ...value, [key]: next });

  return (
    <section className="panel field-panel">
      <div className="panel-title-row">
        <div>
          <h2>Battle field</h2>
          <p>Toggle conditions to update damage calculations. Hazards apply to the selected side.</p>
        </div>
      </div>
      <div className="field-top-row">
        <label className="field-select">Weather
          <select value={value.weather} onChange={e => set("weather", e.target.value as FieldState["weather"])}>
            <option value="">None</option><option>Sun</option><option>Rain</option><option>Sand</option><option>Snow</option>
          </select>
        </label>
        <label className="field-select">Terrain
          <select value={value.terrain} onChange={e => set("terrain", e.target.value as FieldState["terrain"])}>
            <option value="">None</option><option>Electric</option><option>Grassy</option><option>Misty</option><option>Psychic</option>
          </select>
        </label>
      </div>
      <div className="field-groups">
        <div className="field-group"><h3>Defender conditions</h3><div className="field-toggle-grid">
          <Toggle label="Leech Seed" checked={value.defenderLeechSeed} onChange={v => set("defenderLeechSeed", v)} />
          <Toggle label="Salt Cure" checked={value.defenderSaltCure} onChange={v => set("defenderSaltCure", v)} />
          <Toggle label="Reflect" checked={value.defenderReflect} onChange={v => set("defenderReflect", v)} />
          <Toggle label="Light Screen" checked={value.defenderLightScreen} onChange={v => set("defenderLightScreen", v)} />
          <Toggle label="Aurora Veil" checked={value.defenderAuroraVeil} onChange={v => set("defenderAuroraVeil", v)} />
          <Toggle label="Stealth Rock" checked={value.defenderStealthRock} onChange={v => set("defenderStealthRock", v)} />
          <label className="field-count">Spikes
            <select value={value.defenderSpikes} onChange={e => set("defenderSpikes", Number(e.target.value))}>
              <option value={0}>0 layers</option><option value={1}>1 layer</option><option value={2}>2 layers</option><option value={3}>3 layers</option>
            </select>
          </label>
        </div></div>
        <div className="field-group"><h3>Attacker conditions</h3><div className="field-toggle-grid field-attacker-grid">
          <Toggle label="Stealth Rock" checked={value.attackerStealthRock} onChange={v => set("attackerStealthRock", v)} />
          <label className="field-count">Spikes
            <select value={value.attackerSpikes} onChange={e => set("attackerSpikes", Number(e.target.value))}>
              <option value={0}>0 layers</option><option value={1}>1 layer</option><option value={2}>2 layers</option><option value={3}>3 layers</option>
            </select>
          </label>
        </div></div>
      </div>
    </section>
  );
}
