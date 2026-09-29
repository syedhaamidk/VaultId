import { useEffect, useMemo, useRef, useState } from "react";

/* CommandPalette — controlled fuzzy action search. items: [{ label, hint, run }].
   Open with <CommandPalette.Trigger /> anywhere, or Ctrl/⌘+K. Esc closes. */
export default function CommandPalette({ items, open, onOpenChange, label = "Command palette" }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const prevFocus = useRef(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((it) => !q || it.label.toLowerCase().includes(q) || (it.hint || "").includes(q))
      .slice(0, 9);
  }, [items, query]);

  useEffect(() => {
    if (!open) return;
    prevFocus.current = document.activeElement;
    setQuery("");
    setActive(0);
    document.body.style.overflow = "hidden";
    if (inputRef.current) inputRef.current.focus();
    return () => {
      document.body.style.overflow = "";
      if (prevFocus.current && prevFocus.current.focus) prevFocus.current.focus();
    };
  }, [open ]);

  useEffect(() => { setActive(0); }, [query]);

  if (!open) return null;
  const close = () => onOpenChange(false);
  const run = (it) => { close(); it.run(); };

  return (
    <div className="palette-overlay is-open" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="palette palette-mount" role="dialog" aria-modal="true" aria-label={label}>
        <input
          ref={inputRef}
          className="palette-input"
          type="text"
          placeholder="Type a command…"
          aria-label="Command search"
          role="combobox"
          aria-expanded="true"
          aria-controls="bpk-palette-list"
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck="false"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              if (shown.length) setActive((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (shown[active]) run(shown[active]);
            } else if (e.key === "Escape") {
              e.preventDefault();
              close();
            }
          }}
        />
        <ul className="palette-list" id="bpk-palette-list" role="listbox" aria-label="Commands">
          {shown.length ? (
            shown.map((it, i) => (
              <li
                key={`${it.label}-${i}`}
                role="option"
                id={`bpk-palette-opt-${i}`}
                aria-selected={i === active}
                onClick={() => run(it)}
                onMouseEnter={() => setActive(i)}
              >
                <strong>{it.label}</strong> <span className="mono">{it.hint}</span>
              </li>
            ))
          ) : (
            <li className="palette-empty">// No match</li>
          )}
        </ul>
      </div>
    </div>
  );
}
