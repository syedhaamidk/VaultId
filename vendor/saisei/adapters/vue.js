// adapters/vue.js — copy this composable into your Vue app. Peer dep: vue.
// Import dist/blueprint.css once (main.js) + dist/blueprint.js for data-* auto-wiring,
// or drive modal/tab state via refs below and keep only the CSS classes.
import { onMounted, ref } from "vue";

const KEY = "bpk-theme";

export function useBlueprintTheme() {
  const theme = ref("light");
  const apply = (next) => {
    theme.value = next;
    document.documentElement.dataset.theme = next === "dark" ? "dark" : "";
    try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
  };
  onMounted(() => {
    let stored = null;
    try { stored = localStorage.getItem(KEY); } catch { /* ignore */ }
    const sysDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    apply(stored || (sysDark ? "dark" : "light"));
  });
  return { theme, toggle: () => apply(theme.value === "dark" ? "light" : "dark") };
}
