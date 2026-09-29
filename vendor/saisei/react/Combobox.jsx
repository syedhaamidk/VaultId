import { useId, useRef, useState } from "react";

/* Combobox — filterable input + listbox. options: string[] or [{ value, label }]. */
export default function Combobox({ label, options, placeholder = "Pick…", onPick }) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const closeTimer = useRef(null);

  const norm = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const q = value.trim().toLowerCase();
  const shown = norm.filter((o) => !q || o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));

  const pick = (o) => {
    setValue(o.value);
    setOpen(false);
    if (onPick) onPick(o.value);
  };

  return (
    <div className="field">
      <label className="label" htmlFor={`${listId}-input`}>{label}</label>
      <div className="combo-wrap">
        <input
          className="input"
          id={`${listId}-input`}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onChange={(e) => { setValue(e.target.value); setOpen(true); setActive(0); }}
          onFocus={() => setOpen(true)}
          onBlur={() => { closeTimer.current = setTimeout(() => setOpen(false), 120); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              if (shown.length) setActive((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length);
            } else if (e.key === "Enter") {
              if (shown[active]) { e.preventDefault(); clearTimeout(closeTimer.current); pick(shown[active]); }
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {open && (
          <ul className="combo-list" id={listId} role="listbox" aria-label={label}>
            {shown.map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); pick(o); }}
                onMouseEnter={() => setActive(i)}
              >
                {o.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
