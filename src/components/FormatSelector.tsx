"use client";

import { useEffect, useMemo, useState } from "react";
import { getAvailableShowdownFormats, setRemoteShowdownFormats, type ShowdownFormatOption } from "../lib/format-validation";

type Props = { value: string; onChange: (value: string) => void };

/** Parse format metadata from the upstream TypeScript source without evaluating it. */
function parseUpstreamFormatCatalog(source: string): ShowdownFormatOption[] {
  const formats: ShowdownFormatOption[] = [];
  let section = "";
  let i = source.lastIndexOf("export const Formats");
  if (i < 0) return formats;
  i = source.indexOf("=", i);
  if (i < 0) return formats;
  i = source.indexOf("[", i);
  if (i < 0) return formats;
  let depth = 0, quote = "", escaped = false, lineComment = false, blockComment = false;
  let start = -1;
  for (; i < source.length; i++) {
    const c = source[i], n = source[i + 1];
    if (lineComment) { if (c === "\n") lineComment = false; continue; }
    if (blockComment) { if (c === "*" && n === "/") { blockComment = false; i++; } continue; }
    if (quote) { if (escaped) escaped = false; else if (c === "\\") escaped = true; else if (c === quote) quote = ""; continue; }
    if (c === "/" && n === "/") { lineComment = true; i++; continue; }
    if (c === "/" && n === "*") { blockComment = true; i++; continue; }
    if (c === "\"" || c === "'" || c === "`") { quote = c; continue; }
    if (c === "{") { if (depth === 0) start = i; depth++; continue; }
    if (c === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        const block = source.slice(start, i + 1);
        const name = readStringProperty(block, "name");
        if (!name) { const nextSection = readStringProperty(block, "section"); if (nextSection) section = nextSection; }
        else {
          const id = name.toLowerCase().replace(/[^a-z0-9]/g, "");
          formats.push({ label: name, id, section, source: "remote", mod: readStringProperty(block, "mod") || undefined, gameType: readStringProperty(block, "gameType") || undefined, team: readStringProperty(block, "team") || undefined, searchShow: readBooleanProperty(block, "searchShow"), challengeShow: readBooleanProperty(block, "challengeShow"), ruleset: readStringArrayProperty(block, "ruleset"), banlist: readStringArrayProperty(block, "banlist") });
        }
        start = -1;
      }
    }
    if (c === "]" && depth === 0) break;
  }
  return formats.filter((format, index, all) => all.findIndex(other => other.id === format.id) === index);
}
function readStringProperty(block: string, property: string): string | undefined {
  const match = block.match(new RegExp("\\b" + property + "\\s*:\\s*(['\"])(.*?)\\1", "s"));
  return match?.[2]?.replace(/\\\\(['\"\\])/g, "$1");
}
function readBooleanProperty(block: string, property: string): boolean | undefined {
  const match = block.match(new RegExp("\\b" + property + "\\s*:\\s*(true|false)"));
  return match ? match[1] === "true" : undefined;
}
function readStringArrayProperty(block: string, property: string): string[] | undefined {
  const match = block.match(new RegExp("\\b" + property + "\\s*:\\s*\\[([\\s\\S]*?)\\]"));
  if (!match) return undefined;
  return [...match[1].matchAll(/['\"]((?:\\.|[^'\"\\])*)['\"]/g)].map(item => item[1].replace(/\\(['\"\\])/g, "$1"));
}

/** Searchable picker backed by the current upstream Pokémon Showdown format config. */
export default function FormatSelector({ value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [formats, setFormats] = useState<ShowdownFormatOption[]>(() => getAvailableShowdownFormats());
  const [catalogStatus, setCatalogStatus] = useState<"loading" | "live" | "fallback">("loading");

  useEffect(() => {
    let cancelled = false;
    fetch("https://raw.githubusercontent.com/smogon/pokemon-showdown/master/config/formats.ts", { cache: "no-store" })
      .then(response => { if (!response.ok) throw new Error("Could not fetch current Showdown formats"); return response.text(); })
      .then(source => {
        if (cancelled) return;
        const fetched = parseUpstreamFormatCatalog(source);
        if (!fetched.length) throw new Error("Could not parse current Showdown format catalog");
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
