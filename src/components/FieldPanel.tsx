"use client";

import { FieldState } from "../lib/types";

type Props = { value: FieldState; onChange: (next: FieldState) => void };
type ToggleProps = { label: string; checked: boolean; onChange: (checked: boolean) => void };

function CycleControl({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const index = Math.max(0, options.findIndex(option => option.value === value));
  const current = options[index];
  const next = options[(index + 1) % options.length];
  return <button
    type="button"
    className={`field-cycle ${value ? "active" : ""}`}
    onClick={() => onChange(next.value)}
    title={`${label}: ${current.label}. Click to cycle to ${next.label}.`}
    aria-label={`${label}: ${current.label}. Click to cycle options.`}
  >
    <span>{label}</span><strong>{current.label}</strong>
  </button>;
}
function Toggle({ label, checked, onChange }: ToggleProps) {
  return <button type="button" className={`field-toggle ${checked ? "active" : ""}`} aria-pressed={checked} onClick={() => onChange(!checked)}>
    <span>{label}</span><span className="field-toggle-state">{checked ? "ON" : "OFF"}</span>
  </button>;
}

export default function FieldPanel({ value, onChange }: Props) {
  const set = <K extends keyof FieldState>(key: K, next: FieldState[K]) => onChange({ ...value, [key]: next });
  return <section className="panel field-panel">
    <div className="panel-title-row"><div><h2>Battle field</h2><p>Choose Singles or Doubles for spread-move damage. Weather and terrain affect the field; screens and hazards apply to the defender. Trick Room reverses Speed order; Tailwind doubles Speed for the selected side.</p></div></div>
    <div className="field-top-row">
      <label className="field-select">Battle format<select aria-label="Battle format" value={value.gameType || "Singles"} onChange={e => set("gameType", e.target.value as FieldState["gameType"])}><option value="Singles">Singles</option><option value="Doubles">Doubles</option></select></label>
      <label className="field-select">Weather<select value={value.weather} onChange={e => set("weather", e.target.value as FieldState["weather"])}>
        <option value="">None</option><option>Sun</option><option>Rain</option><option>Sand</option><option>Snow</option>
      </select></label>
      <label className="field-select">Terrain<select value={value.terrain} onChange={e => set("terrain", e.target.value as FieldState["terrain"])}>
        <option value="">None</option><option>Electric</option><option>Grassy</option><option>Misty</option><option>Psychic</option>
      </select></label>
    </div>
    <div className="field-toggle-grid">
      <Toggle label="Reflect" checked={value.defenderReflect} onChange={v => set("defenderReflect", v)} />
      <Toggle label="Light Screen" checked={value.defenderLightScreen} onChange={v => set("defenderLightScreen", v)} />
      <Toggle label="Aurora Veil" checked={value.defenderAuroraVeil} onChange={v => set("defenderAuroraVeil", v)} />
      <Toggle label="Stealth Rock" checked={value.defenderStealthRock} onChange={v => set("defenderStealthRock", v)} />
      <CycleControl label="Spikes" value={String(value.defenderSpikes)} options={[
        { value: "0", label: "0 layers" }, { value: "1", label: "1 layer" },
        { value: "2", label: "2 layers" }, { value: "3", label: "3 layers" },
      ]} onChange={v => set("defenderSpikes", Number(v))} />
      <Toggle label="Leech Seed" checked={value.defenderLeechSeed} onChange={v => set("defenderLeechSeed", v)} />
      <Toggle label="Salt Cure" checked={value.defenderSaltCure} onChange={v => set("defenderSaltCure", v)} />
      <Toggle label="Trick Room" checked={value.trickRoom} onChange={v => set("trickRoom", v)} />
      <CycleControl label="Tailwind" value={value.tailwindSide} options={[
        { value: "", label: "None" }, { value: "attacker", label: "Attacker" }, { value: "defender", label: "Defender" },
      ]} onChange={v => set("tailwindSide", v as FieldState["tailwindSide"])} />
    </div>
  </section>;
}
