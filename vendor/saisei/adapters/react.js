/* adapters/react.js — copy this hook into your React app. Peer dep: react.
   The kit itself stays vanilla: you only re-implement open/close STATE in React,
   the CSS classes and markup contracts in index.html stay the source of truth. */
import { useCallback, useEffect, useState } from "react";

const KEY = "bpk-theme";

export function useBlueprintTheme() {
  const [theme, setTheme] = useState(() =>
    typeof document !== "undefined" && document.documentElement.dataset.theme === "dark" ? "dark" : "light"
  );
  useEffect(() => {
    let stored = null;
    try { stored = localStorage.getItem(KEY); } catch { /* ignore */ }
    const sysDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = stored || (sysDark ? "dark" : "light");
    document.documentElement.dataset.theme = initial === "dark" ? "dark" : "";
    setTheme(initial === "dark" ? "dark" : "light");
  }, []);
  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next === "dark" ? "dark" : "";
      try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
      return next;
    });
  }, []);
  return [theme, toggle];
}

/* Modal state example (replace data-modal-open wiring for full React control):
   const [open, setOpen] = useState(false);
   {open && <div className="modal-overlay is-open"><div className="modal" role="dialog" aria-modal="true">…</div></div>} */
