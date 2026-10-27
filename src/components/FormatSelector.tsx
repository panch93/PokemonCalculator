"use client";

import { useEffect } from "react";
import { getAvailableShowdownFormats, setRemoteShowdownFormats } from "../lib/format-validation";
import { getBundledShowdownFormats } from "../lib/showdown-format-config";

type Props = { value: string; onChange: (value: string) => void };

/** Uses the same native text + datalist format picker as Team Lab. */
export default function FormatSelector({ value, onChange }: Props) {
  useEffect(() => {
    try { setRemoteShowdownFormats(getBundledShowdownFormats()); } catch { /* curated fallback remains available */ }
  }, []);
  const formats = getAvailableShowdownFormats();
  const displayValue = formats.find(format => format.id === value || format.label === value)?.label || value;
  return <><input list="team-lab-formats" value={displayValue} onChange={event => onChange(event.target.value)} aria-label="Battle format" /><datalist id="team-lab-formats">{formats.map(format => <option key={format.id} value={format.label} />)}<option value="Champions NatDex Draft" /></datalist></>;
}
