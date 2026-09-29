import { useLayoutEffect, useRef, useState } from "react";

/* Tabs — ARIA tablist pattern with a sliding active indicator that tracks
   the selected tab (measured, so it survives re-skinning and zoom). */
export default function Tabs({ tabs, activeId, defaultId, onChange, label = "Sections" }) {
  const [inner, setInner] = useState(defaultId || tabs[0].id);
  const current = activeId !== undefined ? activeId : inner;
  const refs = useRef([]);
  const [bar, setBar] = useState({ left: 0, width: 0 });

  const select = (id, focus) => {
    if (activeId === undefined) setInner(id);
    if (onChange) onChange(id);
    if (focus) {
      const i = tabs.findIndex((t) => t.id === id);
      if (refs.current[i]) refs.current[i].focus();
    }
  };

  const onKey = (e, i) => {
    const last = tabs.length - 1;
    let next = null;
    if (e.key === "ArrowRight") next = i === last ? 0 : i + 1;
    else if (e.key === "ArrowLeft") next = i === 0 ? last : i - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    if (next !== null) { e.preventDefault(); select(tabs[next].id, true); }
  };

  const active = tabs.find((t) => t.id === current) || tabs[0];
  const activeIndex = tabs.findIndex((t) => t.id === active.id);

  useLayoutEffect(() => {
    const measure = () => {
      const el = refs.current[activeIndex];
      if (el) setBar({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeIndex, tabs.length]);

  return (
    <div>
      <div className="tabs" role="tablist" aria-label={label}>
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => { refs.current[i] = el; }}
            className="tab"
            role="tab"
            aria-selected={t.id === active.id}
            tabIndex={t.id === active.id ? 0 : -1}
            onClick={() => select(t.id, false)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {t.label}
          </button>
        ))}
        <div
          className="tab-indicator"
          aria-hidden="true"
          style={{ transform: `translateX(${bar.left}px)`, width: bar.width }}
        />
      </div>
      <div className="tab-panels">
        <div className="tab-panel" role="tabpanel" aria-hidden="false" key={active.id}>
          {active.content}
        </div>
      </div>
    </div>
  );
}
