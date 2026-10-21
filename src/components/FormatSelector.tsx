"use client";

import { useMemo, useState } from "react";
import { getAvailableShowdownFormats } from "../lib/format-validation";

type Props = { value: string; onChange: (value: string) => void };

/** Searchable format picker inspired by Pokémon Showdown's teambuilder selector. */
export default function FormatSelector({ value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const formats = useMemo(() => getAvailableShowdownFormats(), []);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (q ? formats.filter(format => format.label.toLowerCase().includes(q) || format.id.toLowerCase().includes(q)) : formats).slice(0, 100);
  }, [formats, query]);
  const selectedLabel = formats.find(format => format.label === value || format.id === value)?.label || value;

  return <div className="format-selector">
    <input aria-label="Battle format" role="combobox" aria-expanded={open} aria-autocomplete="list" placeholder="Search formats…" value={open ? query : selectedLabel}
      onFocus={() => { setQuery(""); setOpen(true); }}
      onChange={event => { setQuery(event.target.value); setOpen(true); }}
      onKeyDown={event => {
        if (event.key === "Escape") { setOpen(false); setQuery(""); }
        if (event.key === "Enter" && open && filtered.length) { event.preventDefault(); onChange(filtered[0].label); setQuery(""); setOpen(false); }
        if (event.key === "ArrowDown") setOpen(true);
      }} />
    <button type="button" aria-label="Show format options" className="format-selector-toggle" onMouseDown={event => event.preventDefault()} onClick={() => { setQuery(""); setOpen(state => !state); }}>▾</button>
    {open && <div className="format-selector-options" role="listbox">{filtered.map(format => <button type="button" role="option" aria-selected={format.label === selectedLabel} key={format.id} onMouseDown={event => event.preventDefault()} onClick={() => { onChange(format.label); setQuery(""); setOpen(false); }}>{format.label}</button>)}{!filtered.length && <p>No matching formats</p>}</div>}
  </div>;
}
