import { useEffect, useState } from "react";

const KEY = "bpk-theme";

/* ThemeToggle — blueprint dark/light switch with localStorage + OS fallback. */
export default function ThemeToggle({ className = "" }) {
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    let stored = null;
    try { stored = localStorage.getItem(KEY); } catch { /* ignore */ }
    const sysDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = stored || (sysDark ? "dark" : "light");
    document.documentElement.dataset.theme = initial === "dark" ? "dark" : "";
    setTheme(initial === "dark" ? "dark" : "light");
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next === "dark" ? "dark" : "";
    try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
    setTheme(next);
  };

  return (
    <button className={`btn btn-secondary btn-sm mono ${className}`} onClick={toggle}>
      ⇄ {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}
