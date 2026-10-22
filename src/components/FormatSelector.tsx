"use client";

import { useEffect, useMemo, useState } from "react";
import { getAvailableShowdownFormats, setRemoteShowdownFormats, type ShowdownFormatOption } from "../lib/format-validation";
import { fetchLiveShowdownFormats } from "../lib/showdown-format-config";

type Props = { value: string; onChange: (value: string) => void };

/** Searchable picker backed by the current upstream Pokémon Showdown format config. */
export default function FormatSelector({ value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [formats, setFormats] = useState<ShowdownFormatOption[]>(() => getAvailableShowdownFormats());
  const [catalogStatus, setCatalogStatus] = useState<"loading" | "live" | "fallback">("loading");

  useEffect(() => {
    let cancelled = false;
    fetchLiveShowdownFormats()
      .then(fetched => {
        if (cancelled) return;
        setRemoteShowdownFormats(fetched);
        setFormats(getAvailableShowdownFormats());
        setCatalogStatus("live");
      })
      .catch(() => { if (!cancelled) { setFormats(getAvailableShowdownFormats()); setCatalogStatus("fallback"); } });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matching = q ? formats.filter(format => format.label.toLowerCase().includes(q) || format.id.toLowerCase().includes(q) || (format.section || "").toLowerCase().includes(q)) : formats;
    return matching.slice(0, 250);
  }, [formats, query]);
  const selectedLabel = formats.find(format => format.label === value || format.id === value)?.label || value;
  const choose = (format: ShowdownFormatOption) => { onChange(format.id); setQuery(""); setOpen(false); };

  return <div className="format-selector">
    <input aria-label="Battle format" role="combobox" aria-expanded={open} aria-autocomplete="list" aria-controls="format-selector-options" placeholder="Search all formats…" value={open ? query : selectedLabel}
      onFocus={() => { setQuery(""); setOpen(true); }}
      onChange={event => { setQuery(event.target.value); setOpen(true); }}
      onKeyDown={event => {
        if (event.key === "Escape") { setOpen(false); setQuery(""); }
        if (event.key === "Enter" && open && filtered.length) { event.preventDefault(); choose(filtered[0]); }
        if (event.key === "ArrowDown") setOpen(true);
      }} />
    <button type="button" aria-label="Show format options" className="format-selector-toggle" onMouseDown={event => event.preventDefault()} onClick={() => { setQuery(""); setOpen(state => !state); }}>▾</button>
    {open && <div id="format-selector-options" className="format-selector-options" role="listbox">
      {filtered.map(format => <button type="button" role="option" aria-selected={format.id === value || format.label === value} key={format.id} onMouseDown={event => event.preventDefault()} onClick={() => choose(format)}>
        <span>{format.label}</span>{format.searchShow === false && <small>Hidden from ladder search</small>}
      </button>)}
      {!filtered.length && <p>No matching formats</p>}
      <p className="format-catalog-status">{catalogStatus === "live" ? "Live Pokémon Showdown config" : catalogStatus === "loading" ? "Loading current formats…" : "Using bundled format list · live config unavailable"}</p>
    </div>}
  </div>;
}
