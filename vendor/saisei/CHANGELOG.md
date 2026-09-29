# Changelog

All notable changes to `@chomuiro/saisei`, newest first.
Versioning is SemVer: packaging/dist changes bump minor, fixes bump patch.
Breaking removals bump major.

## 4.6.1 — Deep export paths (dogfood fix)

- **Fix:** `./dist/*` and `./adapters/*` export maps. Dogfooding in a real
  Vite 8 app proved `@chomuiro/saisei/dist/blueprint.css` — the exact import
  our README teaches — failed under Rolldown's strict resolution.
  kit-check now asserts both mappings.

## 4.6.0 — Tilt, spotlight, draw-on, scroll rule, blueprint-blue

- **Tilt + spotlight** — `[data-tilt]` pointer-tracked 3D tilt with glare sweep
  and cursor spotlight (rAF-throttled, touch/reduced-motion safe); React
  `TiltCard`; `.spotlight` works standalone.
- **Draw-on** — `[data-draw]` SVG strokes measured and sketched on scroll into
  view with per-shape stagger; React `DrawOn` (+ `played` control).
- **Scroll rule** — fixed dimension-line progress (`.scroll-rule`, vanilla +
  React `ScrollRule`, RTL-aware origin), on all three pages.
- **Blueprint-blue theme** — white-on-blue preset finally earning the name
  (AA-checked); playground button + `dist/theme-blueprint.css`.
- React `TiltCard`/`DrawOn`/`ScrollRule` in types, example, and behavior tests.

## 4.5.0 — Docs, shields, Svelte tests, Moss/Slate themes

- **`docs.html`** — searchable catalog (24 entries, `/` shortcut, live demos,
  copy-markup per card), axe-covered incl. a search-filters interaction test.
- **Shields** — npm version, CI, MIT badges atop the README.
- **Svelte tests** — `adapters/svelte.test.js` (init/apply/toggle/persist) in
  the vitest run.
- **Moss + Slate presets** — green-gray and blue-gray themes (AA-checked
  soft inks), in `themes.json`, playground, and `dist/theme-*.css`.

## 4.4.0 — Svelte, themes, RTL/print, behavior tests, tokens, drawer, release flow

- **Renamed** package `stock-frontend-blueprint` → `saisei` → `@chomuiro/saisei`
  (`saisei` is taken on npm; bin command stays `saisei`).

- **Svelte adapter** — `adapters/svelte.js` (`theme` store, `initTheme`, `toggle`,
  Svelte 4 + 5 compatible) + `examples/svelte.svelte`; typed d.ts included.
- **Theme presets** — Warm / High-contrast / Soft in `themes.json` (source of
  truth): `dist/theme-<name>.css` built for direct inclusion, one-click buttons
  in the playground, SRI-covered, kit-check verified.
- **RTL / print / forced-colors** — logical properties throughout (mono `left`
  → `inline-start` etc.), mirrored switch/selection/drawer motion, `@media print`
  chrome-hiding, `@media (forced-colors: active)` system-color mapping. RTL axe
  run added to e2e.
- **React behavior tests** — vitest + Testing Library (`react/behavior.test.jsx`):
  modal trap/Escape/restore, tabs arrows, datatable sort/filter, palette Enter,
  dropdown arrows, toast live-region + action. `npm run test:rtl`, in `test:all`.
- **Token export** — `tokens.json` (Style Dictionary shape) with value-equality
  checks against `tokens.css` in kit-check.
- **Drawer / sizes / toast actions** — vanilla `[data-drawer]` side panel
  (trap, Esc, scroll lock, RTL-mirrored) + demo; `.modal-sm/.modal-lg`;
  `toast(msg, { label, run })` vanilla + React; React `Drawer`.
- **Release automation** — tag push `v*` runs full gate + e2e and publishes
  (`release.yml`, needs repo `NPM_TOKEN`).

## 4.3.0 — React motion pass, count-ups

- **Animated exits + indicators in React** — `Modal` stays mounted ~240ms so
  the overlay/panel CSS transitions play on close; `Tabs` gains a measured
  sliding indicator; `Accordion` measures panel height instead of a fixed cap;
  `CommandPalette` mounts with `palette-in`; `Progress` sweeps from 0 on mount.
- **New primitives** — `Reveal` (IO scroll entrance + `delay` stagger) and
  `AnimatedNumber` (eased count between values, reduced-motion safe); vanilla
  `[data-countup]` parity in `components.js` (locale-formatted, `data-decimals` /
  `data-prefix` / `data-suffix` / `data-duration`), demoed as a stats card.
- **Menu entry** — `.menu` / `.combo-list` play `menu-in` whenever unhidden;
  `.stats` / `.stat-value` / `.stat-label` styles added to the kit.
- **Fix (caught by axe `region`)** — a stray `</div>` was popping `section`,
  `main`, and the page container in the parser; removed, and added a
  `tag-balance` guard to `tests/aria-audit.js` so misnesting fails fast
  without a browser.

## 4.2.0 — Playground, menus, types, scaffolder, hardened CI

- **`playground.html`** — live token editor (surfaces, radius, font stacks)
  with component preview and changed-only `:root`/`[data-theme="dark"]`
  export + copy. Covered by the axe e2e suite.
- **Dropdown / tooltip / combobox** — vanilla (`data-menu-trigger` + `.menu`,
  CSS-only `[data-tip]`, `.combo-wrap` listbox) and React (`Dropdown`,
  `Combobox`); demoed in `index.html` and `examples/react.jsx`.
- **Empty / progress / crumbs** — `.empty`, `.progress[role="progressbar"]`
  (`--value`), `ol.crumbs`; React `Empty`, `Progress`, `Crumbs`.
- **Types** — hand-written `react/index.d.ts` (+ adapter d.ts), verified by
  `npm run test:types` (`tsc --noEmit` over `tests/type-test.tsx`).
- **Scaffolder** — `npx stock-frontend-blueprint init [dir]` (`bin/blueprint-init`,
  zero deps, never overwrites); end-to-end checked in `tests/kit-check.js`.
- **Production files** — esbuild-minified `dist/blueprint.min.css/js` with
  recomputed SRI hashes in `dist/integrity.json` (verified in kit-check).
- **Real axe in CI** — Playwright Chromium + `@axe-core/playwright` across
  light/dark/modal/palette/playground; caught and fixed two real issues
  (accordion landmarks, `--ink-soft` contrast → `#5F5F5F`).
- **SSR-safe** — `components.js` imports cleanly with no DOM
  (`tests/ssr-check.js`); React components already effect-scoped.

## 4.1.0 — DataTable, scroll reveals, command palette

- **DataTable** — generic sortable/filterable/paged table: `th[data-sort]`
  (click/Enter, numeric-aware, `aria-sort`), `[data-table-filter]` input,
  prev/next pager, only the current page in the DOM. Vanilla auto-wiring via
  `[data-datatable]` in `components.js`; `<DataTable columns rows />` in
  `react/`. Demo table in `index.html` uses it live.
- **Scroll reveals** — `.reveal-on-scroll` elements (and `.dim-divider` lines)
  gain `.in-view` from an `IntersectionObserver` in `components.js`; `.js-reveals`
  arming keeps no-JS pages fully visible. Kit demo sections use it.
- **Command palette** — Ctrl/⌘+K fuzzy search over nav links + `[data-command]`
  elements (↑↓/Enter/Esc, listbox pattern). Vanilla `#palette` markup in
  `index.html`; `<CommandPalette items open onOpenChange />` in `react/`.

## 4.0.0 — Market desk removed, kit-only

- **Breaking:** deleted the market desk — `market.js`, `market.css`,
  `lib/market-core.js`, `data/symbols.json`, `sw.js`, the M1–M6 demo sections,
  ticker-tape markup, and confirm modal in `index.html`. The `./market*`
  package exports are gone.
- `dist/` is now just `blueprint.css` + `blueprint.js` + `manifest.json`.
- Tests trimmed to the kit: a11y contract, ARIA audit, React compile check
  (`tests/market-core.test.js` and `tests/outage-drill.js` removed).
- What stays: tokens, components, motion pack, `react/` library (incl.
  generic `TickerTape`), adapters, examples, `index.html` component catalog.

## 3.2.0 — Motion pack + React library

- Motion pack in `components.css` / `market.css`: `.ticker-tape` infinite strip
  (pauses on hover/focus, hydrated live by `market.js`), `.draw-in` sketch-on
  registration corners, `.btn-primary` hover sheen, `.card-enter` entrance,
  `.tick-up` / `.tick-down` quote flash, `.pulsing` loader. All token
  durations, monochrome, `prefers-reduced-motion` safe.
- New `react/` library (`stock-frontend-blueprint/react`, peer `react`):
  `Button`, `Card` / `Badge` / `Alert` / `Skeleton`, controlled `Modal`
  (Escape, focus trap, scroll lock), `Tabs` (arrow-key ARIA pattern),
  `Accordion`, `ToastProvider` + `useToast()`, `TickerTape`, `ThemeToggle`.
  All 8 JSX files compile-checked with esbuild.
- `examples/react.jsx` rewritten around the library.
- Fix: hidden `#import-file` input now labelled (caught by new audit).
- New `tests/aria-audit.js` (15 checks: landmarks, heading order, labels,
  button names, dialog roles, table scope) — wired into `test:all`.

## 3.1.0 — Reusable packaging

- `npm run build` generates `dist/`: `blueprint.css` + `blueprint.js`
  (the whole kit in 2 files), plus `market.css`, `market-core.js`,
  `market.js`, `symbols.json`, `manifest.json`.
- Publishable `package.json`: MIT license, `exports` (`./css`, `./js`,
  `./market*`, `./react`), `unpkg` fields, `prepublishOnly` build.
- `adapters/react.js` (`useBlueprintTheme`), `adapters/vue.js`,
  `examples/plain-html.html`, `examples/react.jsx`, `examples/vue.vue`.
- `README.md` "Reuse in any website": copy / npm / CDN paths.

## 3.0.0 — Market desk v3

- Live Stooq quotes + OHLC history with deterministic demo fallback,
  quote cache (`bpk-quote-cache`, 5-min TTL) + `STALE` stamp,
  `AbortController` + exponential-backoff retry.
- Chart: line or OHLC candles + volume, mouse/touch crosshair, keyboard
  inspect, `#chart-data-table` text fallback, error + retry states.
- Portfolio: splits, per-share dividends, JSON/CSV export, JSON import,
  delete behind `#confirm-modal`.
- `sw.js` offline shell cache (Stooq network-only), client error log.
- `lib/market-core.js` pure UMD core with `node:test` suite (14 cases).
- `tests/a11y-check.js` contract, `tests/outage-drill.js` (22 checks),
  `.github/workflows/ci.yml`.
- Production a11y fixes: modal/tab `inert` + `visibility`, form error
  associations, scrollable labelled table regions, mobile modal heights.
