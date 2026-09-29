// adapters/svelte.js — theme store for Svelte (works in Svelte 4 + 5).
// Peer dep: svelte. Import dist/blueprint.css once (e.g. in +layout) and
// drive modal/tab state with Svelte `{#if}` blocks + the kit's classes.
import { writable } from "svelte/store";

const KEY = "bpk-theme";

function current() {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function readInitial() {
  if (typeof window === "undefined") return "light";
  let stored = null;
  try { stored = localStorage.getItem(KEY); } catch { /* ignore */ }
  const sysDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return stored || (sysDark ? "dark" : "light");
}

export const theme = writable("light");

export function initTheme() {
  const initial = readInitial();
  apply(initial);
}

export function apply(next) {
  theme.set(next);
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = next === "dark" ? "dark" : "";
  }
  try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
}

export function toggle() {
  apply(current() === "dark" ? "light" : "dark");
}
