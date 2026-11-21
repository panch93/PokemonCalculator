"use client";

import { useEffect, useId, useState } from "react";
import { DEFAULT_DRAFT_MOVE_FILTER, type DraftMoveFilter } from "../lib/draft-matchup-analysis";

type Props = {
  open: boolean;
  title?: string;
  description?: string;
  value: DraftMoveFilter;
  moveNames: string[];
  onSave: (value: DraftMoveFilter) => void;
  onClose: () => void;
};

export default function DraftMoveFilterModal({ open, title = "Move filters", description = "Filters apply to both attacking directions. Whitelisted moves bypass accuracy and priority thresholds, but blacklist entries always win.", value, moveNames, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<DraftMoveFilter>(value);
  const [picker, setPicker] = useState("");
  useEffect(() => { if (open) { setDraft({ ...value, whitelist: [...value.whitelist], blacklist: [...value.blacklist] }); setPicker(""); } }, [open, value]);
  const id = useId();
  if (!open) return null;
  const closeAndSave = () => { onSave({ ...draft, whitelist: [...new Set(draft.whitelist)], blacklist: [...new Set(draft.blacklist)] }); onClose(); };
  const add = (list: "whitelist" | "blacklist") => {
    const found = moveNames.find(name => name.toLowerCase() === picker.trim().toLowerCase());
    if (!found) return;
    setDraft(current => ({ ...current, [list]: current[list].includes(found) ? current[list] : [...current[list], found] }));
    setPicker("");
  };
  return <div className="draft-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeAndSave(); }}>
    <section className="draft-modal draft-move-filter-modal" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
      <div className="panel-title-row"><div><h2 id={`${id}-title`}>{title}</h2><p>{description} Closing this window saves the filters.</p></div><button type="button" onClick={closeAndSave}>Close ×</button></div>
      <label>Minimum move accuracy: <strong>{draft.minAccuracy}%</strong><input type="range" min="0" max="100" step="5" value={draft.minAccuracy} onChange={event => setDraft(current => ({ ...current, minAccuracy: Number(event.target.value) }))} /><small>Moves with accuracy below this value are excluded. Moves with unspecified accuracy count as 100%.</small></label>
      <label>Minimum move priority: <strong>{draft.minPriority}</strong><input type="range" min="-7" max="5" step="1" value={draft.minPriority} onChange={event => setDraft(current => ({ ...current, minPriority: Number(event.target.value) }))} /><small>Moves below this priority are excluded unless explicitly whitelisted. Default: 0.</small></label>
      <datalist id={`${id}-moves`}>{moveNames.map(move => <option key={move} value={move} />)}</datalist>
      <div className="draft-move-filter-picker"><label htmlFor={`${id}-picker`}>Add a move</label><input id={`${id}-picker`} list={`${id}-moves`} value={picker} onChange={event => setPicker(event.target.value)} placeholder="Search moves…" /><button type="button" onClick={() => add("whitelist")}>Add to whitelist</button><button type="button" onClick={() => add("blacklist")}>Add to blacklist</button></div>
      <div className="draft-move-filter-lists"><label>Whitelist · always include these moves (unless blacklisted)<textarea rows={Math.max(3, Math.min(12, draft.whitelist.length || 3))} value={draft.whitelist.join("\n")} onChange={event => setDraft(current => ({ ...current, whitelist: event.target.value.split(/[\n,]+/).map(value => value.trim()).filter(Boolean) }))} placeholder="Leave empty to allow all moves" /></label><label>Blacklist · always excluded<textarea rows={Math.max(3, Math.min(12, draft.blacklist.length || 3))} value={draft.blacklist.join("\n")} onChange={event => setDraft(current => ({ ...current, blacklist: event.target.value.split(/[\n,]+/).map(value => value.trim()).filter(Boolean) }))} placeholder="No excluded moves" /></label></div>
      <div className="button-row draft-editor-actions"><button type="button" onClick={() => setDraft({ ...DEFAULT_DRAFT_MOVE_FILTER, whitelist: [], blacklist: [] })}>Reset defaults</button></div>
    </section>
  </div>;
}
