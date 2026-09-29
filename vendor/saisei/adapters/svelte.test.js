/* Svelte adapter tests — theme store logic under jsdom. Run via vitest. */
import { describe, expect, it, beforeEach } from "vitest";
import { get } from "svelte/store";
import { theme, initTheme, apply, toggle } from "./svelte.js";

function reset() {
  document.documentElement.removeAttribute("data-theme");
  window.localStorage.clear();
}

describe("svelte theme adapter", () => {
  beforeEach(reset);

  it("initializes from OS preference when nothing is stored", () => {
    initTheme();
    expect(["light", "dark"]).toContain(get(theme));
    expect(document.documentElement.dataset.theme === "dark").toBe(get(theme) === "dark");
  });

  it("apply() flips the attribute and persists", () => {
    apply("dark");
    expect(get(theme)).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem("bpk-theme")).toBe("dark");
    apply("light");
    expect(document.documentElement.dataset.theme).toBe("");
  });

  it("toggle() round-trips", () => {
    apply("light");
    toggle();
    expect(get(theme)).toBe("dark");
    toggle();
    expect(get(theme)).toBe("light");
  });

  it("initTheme() honors a stored preference", () => {
    window.localStorage.setItem("bpk-theme", "dark");
    initTheme();
    expect(get(theme)).toBe("dark");
  });
});
