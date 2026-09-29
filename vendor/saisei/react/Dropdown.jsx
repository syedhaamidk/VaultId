import { useEffect, useRef, useState } from "react";

/* Dropdown — items: [{ label, hint, onSelect, href? }]. Click toggles,
   arrows cycle, Esc closes + refocuses, click-outside closes. */
export default function Dropdown({ label, items, align = "left" }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [open ]);

  useEffect(() => {
    if (open) {
      const first = wrapRef.current && wrapRef.current.querySelector(".menu-item");
      if (first) first.focus();
    }
  }, [open ]);

  const onMenuKey = (e) => {
    const list = [...(wrapRef.current?.querySelectorAll(".menu-item") || [])];
    const i = list.indexOf(document.activeElement);
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); btnRef.current?.focus(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); (list[i + 1] || list[0])?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); (list[i - 1] || list[list.length - 1])?.focus(); }
  };

  return (
    <span className="menu-wrap" ref={wrapRef}>
      <button
        ref={btnRef}
        className="btn btn-secondary btn-sm"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); } }}
      >
        {label} ▾
      </button>
      {open && (
        <ul className="menu" role="menu" style={align === "right" ? { left: "auto", right: 0 } : undefined} onKeyDown={onMenuKey}>
          {items.map((it, i) =>
            it.sep ? (
              <li key={`sep-${i}`} className="menu-sep" role="separator" />
            ) : (
              <li key={it.label} role="none">
                <button
                  className="menu-item"
                  role="menuitem"
                  onClick={() => { setOpen(false); btnRef.current?.focus(); it.onSelect && it.onSelect(); }}
                >
                  {it.label} {it.hint && <span className="mono">{it.hint}</span>}
                </button>
              </li>
            )
          )}
        </ul>
      )}
    </span>
  );
}
