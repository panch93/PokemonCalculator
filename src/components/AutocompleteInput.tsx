"use client";
import { useMemo, useRef, useState } from "react";

type Props = { value: string; options: string[]; onChange: (value: string) => void; ariaLabel?: string; className?: string; clearOnFocus?: boolean };

/** Shared keyboard-accessible autocomplete used by the Teambuilder and matrix editors. */
export default function AutocompleteInput({ value, options, onChange, ariaLabel, className = "", clearOnFocus = false }: Props) {
  const [open, setOpen] = useState(false);
  const previousValue = useRef(value);
  const editing = useRef(false);
  const [active, setActive] = useState(-1);
  const [showAll, setShowAll] = useState(false);
  const matches = useMemo(() => {
    const query = value.trim().toLowerCase();
    return showAll || !query ? options : options.filter(option => option.toLowerCase().includes(query));
  }, [options, value, showAll]);
  const choose = (option: string) => { onChange(option); editing.current = false; setOpen(false); setActive(-1); setShowAll(false); };
  return <span className={`builder-autocomplete ${className}`.trim()}>
    <input aria-label={ariaLabel} value={value} autoComplete="off" role="combobox" aria-expanded={open && matches.length > 0} aria-controls={open ? undefined : undefined} aria-autocomplete="list"
      onFocus={() => { if (clearOnFocus && !editing.current) { previousValue.current = value; editing.current = true; onChange(""); } setOpen(true); setActive(-1); setShowAll(false); }}
      onChange={event => { onChange(event.target.value); setOpen(true); setActive(-1); setShowAll(false); }}
      onKeyDown={event => {
        if (event.key === "Escape") { if (clearOnFocus && editing.current) { onChange(previousValue.current); editing.current = false; } setOpen(false); setActive(-1); return; }
        if (event.key === "ArrowDown" && matches.length) { event.preventDefault(); setOpen(true); setActive(index => index < 0 ? 0 : (index + 1) % matches.length); }
        if (event.key === "ArrowUp" && matches.length) { event.preventDefault(); setOpen(true); setActive(index => index < 0 ? matches.length - 1 : (index - 1 + matches.length) % matches.length); }
        if (event.key === "Enter" && open && matches.length) { event.preventDefault(); choose(matches[active >= 0 ? active : 0]); }
      }} />
    <button type="button" className="item-dropdown-toggle autocomplete-dropdown-toggle" aria-label={`Show ${ariaLabel || "field"} options`} onMouseDown={event => event.preventDefault()} onClick={() => { if (clearOnFocus && !editing.current) { previousValue.current = value; editing.current = true; onChange(""); } setOpen(openNow => !openNow); setShowAll(true); setActive(-1); }}>▾</button>
    {open && matches.length > 0 && <span className="builder-autocomplete-options" role="listbox">{matches.map((option, index) => <button type="button" role="option" aria-selected={index === active} key={`${option}-${index}`} className={index === active ? "autocomplete-active" : ""} onMouseEnter={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(option)}>{option}</button>)}</span>}
  </span>;
}
