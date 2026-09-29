import { useEffect, useRef, useState } from "react";

const EXIT_MS = 240; // matches --duration-base

/* Drawer — side panel with the same contract as Modal (animated exit,
   Escape, focus trap, scroll lock, focus restore). Slides from the
   inline-end side, so it mirrors automatically in RTL. */
export default function Drawer({ open, onClose, labelledBy, label, children }) {
  const panelRef = useRef(null);
  const prevFocus = useRef(null);
  const [rendered, setRendered] = useState(open);
  const [leaving, setLeaving] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    if (open) {
      clearTimeout(timer.current);
      setLeaving(false);
      setRendered(true);
    } else if (rendered) {
      setLeaving(true);
      timer.current = setTimeout(() => {
        setRendered(false);
        setLeaving(false);
      }, EXIT_MS);
    }
    return () => clearTimeout(timer.current);
  }, [open, rendered]);

  useEffect(() => {
    if (!rendered || leaving) return;
    prevFocus.current = document.activeElement;
    const main = document.getElementById("main-content");
    if (main) main.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "hidden";
    const panel = panelRef.current;
    const first = panel && panel.querySelector("button, [href], input, select, textarea");
    if (first) first.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose && onClose();
      if (e.key === "Tab" && panel) {
        const items = [...panel.querySelectorAll("button, [href], input, select, textarea")].filter(
          (el) => !el.disabled && el.getClientRects().length > 0
        );
        if (!items.length) return;
        const firstEl = items[0], lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      if (main) main.removeAttribute("aria-hidden");
      if (prevFocus.current && prevFocus.current.focus) prevFocus.current.focus();
    };
  }, [rendered, leaving, onClose]);

  if (!rendered) return null;
  return (
    <div className={`drawer-overlay${open && !leaving ? " is-open" : ""}`} onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div
        ref={panelRef}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={!labelledBy ? label : undefined}
      >
        {children}
      </div>
    </div>
  );
}
