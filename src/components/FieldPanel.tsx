"use client";

import { FieldState } from "../lib/types";

type Props = { value: FieldState; onChange: (next: FieldState) => void };
type ToggleProps = { label: string; checked: boolean; onChange: (checked: boolean) => void; description: string };

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
function SideControl({ label, value, onChange }: { label: string; value: string; onChange: (value: "" | "attacker" | "defender") => void }) {
  const options = ["", "attacker", "defender"] as const;
  const next = options[(options.indexOf((value || "") as typeof options[number]) + 1) % options.length];
  const shown = value === "attacker" ? "ATK" : value === "defender" ? "DEF" : "OFF";
  return <button type="button" className={`field-toggle field-side-control ${value ? "active" : ""}`} onClick={() => onChange(next)} title={`${label}: ${value || "off"}. Click to cycle Off → Attacker → Defender.`} aria-label={`${label}: ${value || "off"}; click to cycle side`}><span>{label}</span><span className="field-toggle-state">{shown}</span></button>;
}
function Toggle({ label, checked, onChange, description }: ToggleProps) {
  return <button type="button" className={`field-toggle ${checked ? "active" : ""}`} aria-pressed={checked} title={description} aria-label={`${label}. ${description}`} onClick={() => onChange(!checked)}>
    <span>{label}</span><span className="field-toggle-state">{checked ? "ON" : "OFF"}</span>
  </button>;
}

export default function FieldPanel({ value, onChange }: Props) {
  const set = <K extends keyof FieldState>(key: K, next: FieldState[K]) => onChange({ ...value, [key]: next });
  return <section className="panel field-panel">
    <div className="panel-title-row"><div><h2>Battle field</h2><p>Choose Singles or Doubles for spread-move damage. Click side-based conditions to cycle Off, Attacker, and Defender. Doubles-only support effects appear in Doubles mode.</p></div></div>
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
      <Toggle description="Reduces physical damage dealt to the affected side for five turns (eight with Light Clay). In Doubles, the reduction is smaller." label="Reflect" checked={value.defenderReflect} onChange={v => set("defenderReflect", v)} />
      <Toggle description="Reduces special damage dealt to the affected side for five turns (eight with Light Clay). In Doubles, the reduction is smaller." label="Light Screen" checked={value.defenderLightScreen} onChange={v => set("defenderLightScreen", v)} />
      <Toggle description="Reduces physical and special damage to the affected side while hail/snow conditions permit; the reduction is smaller in Doubles." label="Aurora Veil" checked={value.defenderAuroraVeil} onChange={v => set("defenderAuroraVeil", v)} />
      <Toggle description="Entry hazard that damages a Pokémon switching in based on its Rock-type effectiveness." label="Stealth Rock" checked={value.defenderStealthRock} onChange={v => set("defenderStealthRock", v)} />
      <CycleControl label="Spikes" value={String(value.defenderSpikes)} options={[
        { value: "0", label: "0 layers" }, { value: "1", label: "1 layer" },
        { value: "2", label: "2 layers" }, { value: "3", label: "3 layers" },
      ]} onChange={v => set("defenderSpikes", Number(v))} />
      <Toggle description="Drains HP from the seeded Pokémon at the end of each turn and heals the opposing side." label="Leech Seed" checked={value.defenderLeechSeed} onChange={v => set("defenderLeechSeed", v)} />
      <Toggle description="Damages the affected Pokémon at the end of each turn; Water- and Steel-types take extra damage." label="Salt Cure" checked={value.defenderSaltCure} onChange={v => set("defenderSaltCure", v)} />
      <Toggle description="For five turns, slower Pokémon move before faster Pokémon within the same priority bracket." label="Trick Room" checked={value.trickRoom} onChange={v => set("trickRoom", v)} />
      <CycleControl label="Tailwind" value={value.tailwindSide} options={[
        { value: "", label: "None" }, { value: "attacker", label: "Attacker" }, { value: "defender", label: "Defender" },
      ]} onChange={v => set("tailwindSide", v as FieldState["tailwindSide"])} />
      <SideControl label="Protect" value={value.protectSide || ""} onChange={v => set("protectSide", v)} />
      <SideControl label="Nightmare" value={value.nightmareSide || ""} onChange={v => set("nightmareSide", v)} />
      <SideControl label="Foresight" value={value.foresightSide || ""} onChange={v => set("foresightSide", v)} />
      <SideControl label="Charge" value={value.chargeSide || ""} onChange={v => set("chargeSide", v)} />
      {value.gameType === "Doubles" && <SideControl label="Helping Hand" value={value.helpingHandSide || ""} onChange={v => set("helpingHandSide", v)} />}
      {value.gameType === "Doubles" && <SideControl label="Flower Gift" value={value.flowerGiftSide || ""} onChange={v => set("flowerGiftSide", v)} />}
      <SideControl label="Power Trick" value={value.powerTrickSide || ""} onChange={v => set("powerTrickSide", v)} />
      {value.gameType === "Doubles" && <SideControl label="Steely Spirit" value={value.steelySpiritSide || ""} onChange={v => set("steelySpiritSide", v)} />}
      {value.gameType === "Doubles" && <SideControl label="Friend Guard" value={value.friendGuardSide || ""} onChange={v => set("friendGuardSide", v)} />}
      {value.gameType === "Doubles" && <SideControl label="Battery" value={value.batterySide || ""} onChange={v => set("batterySide", v)} />}
      {value.gameType === "Doubles" && <SideControl label="Power Spot" value={value.powerSpotSide || ""} onChange={v => set("powerSpotSide", v)} />}
      <SideControl label="Switching Out" value={value.switchingOutSide || ""} onChange={v => set("switchingOutSide", v)} />
    </div>
  </section>;
}
