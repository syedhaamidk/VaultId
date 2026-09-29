/*! @chomuiro/saisei v4.6.1 — Blueprint kit. MIT. See README "Reuse in any website". */
/* ============================================================
   COMPONENTS.JS — no dependencies. Auto-wires any markup that
   follows the data-attribute contracts below. Drop this file in
   and it works; you don't need to call anything manually.
   ============================================================ */

(function () {
  "use strict";

  const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

  /* ---- Modal ---- */
  // Trigger:  <button data-modal-open="my-modal">
  // Overlay:  <div class="modal-overlay" id="my-modal" data-modal role="presentation">
  //   Panel:  <div class="modal" role="dialog" aria-modal="true"> (direct child of overlay)
  // Close:    <button data-modal-close> (inside the overlay)
  let lastFocused = null;

  function initModals() {
    document.querySelectorAll("[data-modal-open]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = document.getElementById(btn.dataset.modalOpen);
        if (target) openModal(target);
      });
    });
    document.querySelectorAll("[data-modal]").forEach((overlay) => {
      // Hidden overlays must not be focusable or announced.
      if (!overlay.classList.contains("is-open")) {
        overlay.setAttribute("aria-hidden", "true");
        if ("inert" in overlay) overlay.inert = true;
      }
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal(overlay);
      });
      overlay.querySelectorAll("[data-modal-close]").forEach((btn) => {
        btn.addEventListener("click", () => closeModal(overlay));
      });
    });
    document.addEventListener("keydown", (e) => {
      const open = document.querySelector(".modal-overlay.is-open");
      if (!open) return;
      if (e.key === "Escape") { closeModal(open); return; }
      if (e.key === "Tab") trapFocus(open, e);
    });
  }

  function visibleFocusable(panel) {
    // offsetParent is null for fixed-position elements and in some browsers
    // for open dialogs — use rects + computed style instead (Safari/FF safe).
    return Array.from(panel.querySelectorAll(FOCUSABLE)).filter((el) => {
      if (el.disabled) return false;
      if (el.getAttribute("aria-hidden") === "true") return false;
      const r = el.getClientRects();
      if (!r || r.length === 0) return false;
      const cs = window.getComputedStyle ? window.getComputedStyle(el) : null;
      if (cs && (cs.visibility === "hidden" || cs.display === "none")) return false;
      return true;
    });
  }

  function trapFocus(overlay, e) {
    const panel = overlay.querySelector(".modal, .drawer");
    if (!panel) return;
    const focusables = visibleFocusable(panel);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function setPageHidden(hidden) {
    // Screen-reader fallback for browsers without `inert`: hide page behind modal.
    const main = document.getElementById("main-content");
    if (main) {
      if (hidden) main.setAttribute("aria-hidden", "true");
      else main.removeAttribute("aria-hidden");
    }
  }

  function openModal(overlay) {
    lastFocused = document.activeElement;
    overlay.classList.add("is-open");
    overlay.removeAttribute("aria-hidden");
    if ("inert" in overlay) overlay.inert = false;
    setPageHidden(true);
    document.body.style.overflow = "hidden"; // scroll lock while open
    const panel = overlay.querySelector(".modal");
    const focusable = panel && visibleFocusable(panel)[0];
    if (focusable) focusable.focus();
  }

  function closeModal(overlay) {
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    if ("inert" in overlay) overlay.inert = true;
    // Only unhide page when no other modal is open (demo + confirm coexist).
    if (!document.querySelector(".modal-overlay.is-open")) setPageHidden(false);
    document.body.style.overflow = "";
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  }

  /* ---- Tabs ---- */
  // Wrapper: <div class="tabs" role="tablist" data-tabs>
  //   <button class="tab" role="tab" data-tab-target="panel-1">
  // Panels wrapped in: <div class="tab-panels">
  //   <div class="tab-panel" id="panel-1" role="tabpanel">
  // Supports Left/Right/Home/End per the ARIA tablist pattern, plus a
  // sliding indicator element (auto-created) that tracks the active tab.
  function initTabs() {
    document.querySelectorAll("[data-tabs]").forEach((tabList) => {
      const tabs = Array.from(tabList.querySelectorAll(".tab"));
      if (tabs.length === 0) return;

      const indicator = document.createElement("div");
      indicator.className = "tab-indicator";
      tabList.appendChild(indicator);

      const moveIndicator = (tab) => {
        indicator.style.transform = `translateX(${tab.offsetLeft}px)`;
        indicator.style.width = `${tab.offsetWidth}px`;
      };

      const activate = (tab, focusToo) => {
        tabs.forEach((t) => { t.setAttribute("aria-selected", "false"); t.tabIndex = -1; });
        tab.setAttribute("aria-selected", "true");
        tab.tabIndex = 0;
        moveIndicator(tab);
        tabs.forEach((t) => {
          const panel = document.getElementById(t.dataset.tabTarget);
          if (!panel) return;
          const isActive = t === tab;
          panel.setAttribute("aria-hidden", String(!isActive));
          if ("inert" in panel) panel.inert = !isActive;
        });
        if (focusToo) tab.focus();
      };

      tabs.forEach((tab, i) => {
        tab.setAttribute("role", "tab");
        tab.tabIndex = tab.getAttribute("aria-selected") === "true" ? 0 : -1;
        tab.addEventListener("click", () => activate(tab, false));
        tab.addEventListener("keydown", (e) => {
          const last = tabs.length - 1;
          let nextIndex = null;
          if (e.key === "ArrowRight") nextIndex = i === last ? 0 : i + 1;
          else if (e.key === "ArrowLeft") nextIndex = i === 0 ? last : i - 1;
          else if (e.key === "Home") nextIndex = 0;
          else if (e.key === "End") nextIndex = last;
          if (nextIndex !== null) {
            e.preventDefault();
            activate(tabs[nextIndex], true);
          }
        });
      });

      const initial = tabs.find((t) => t.getAttribute("aria-selected") === "true") || tabs[0];
      // Hidden panels must not receive focus on load either.
      tabs.forEach((t) => {
        const panel = document.getElementById(t.dataset.tabTarget);
        if (!panel) return;
        const isActive = t === initial;
        panel.setAttribute("aria-hidden", String(!isActive));
        if ("inert" in panel) panel.inert = !isActive;
      });
      requestAnimationFrame(() => moveIndicator(initial));
      window.addEventListener("resize", () => {
        const current = tabs.find((t) => t.getAttribute("aria-selected") === "true");
        if (current) moveIndicator(current);
      });
    });
  }

  /* ---- Accordion ---- */
  // <div class="accordion-item">
  //   <button class="accordion-trigger" aria-expanded="false" data-accordion-trigger>
  //     Label <span class="chev">+</span>
  //   </button>
  //   <div class="accordion-panel"><div class="accordion-panel-inner">Content</div></div>
  // </div>
  function initAccordions() {
    document.querySelectorAll("[data-accordion-trigger]").forEach((trigger, idx) => {
      const panel = trigger.parentElement.querySelector(".accordion-panel");
      if (panel) {
        if (!panel.id) panel.id = "acc-panel-" + (idx + 1);
        // Unique accessible name per panel: unnamed duplicate regions
        // trip axe landmark-unique, so label each by its trigger.
        if (!trigger.id) trigger.id = "acc-trigger-" + (idx + 1);
        trigger.setAttribute("aria-controls", panel.id);
        panel.setAttribute("role", "region");
        panel.setAttribute("aria-labelledby", trigger.id);
      }
      trigger.addEventListener("click", () => {
        const expanded = trigger.getAttribute("aria-expanded") === "true";
        trigger.setAttribute("aria-expanded", String(!expanded));
        if (panel) panel.style.maxHeight = expanded ? "0px" : panel.scrollHeight + "px";
      });
      // Safari recalc: fonts/zoom/resize change scrollHeight — keep open panels fitted.
      window.addEventListener("resize", () => {
        if (trigger.getAttribute("aria-expanded") === "true" && panel) panel.style.maxHeight = panel.scrollHeight + "px";
      });
    });
  }

  /* ---- Toasts ---- */
  // Call window.toast("Message")
  function ensureToastRegion() {
    let region = document.querySelector(".toast-region");
    if (!region) {
      region = document.createElement("div");
      region.className = "toast-region";
      region.setAttribute("role", "status");
      region.setAttribute("aria-live", "polite");
      document.body.appendChild(region);
    }
    return region;
  }

  function makeToast() {
    // toast(message) or toast(message, { label, run }) for an action button.
    return function (message, action) {
    const region = ensureToastRegion();
    const el = document.createElement("div");
    el.className = "toast";
    const span = document.createElement("span");
    span.textContent = message;
    el.appendChild(span);
    if (action && action.label) {
      const btn = document.createElement("button");
      btn.className = "toast-action";
      btn.textContent = action.label;
      btn.addEventListener("click", () => {
        if (typeof action.run === "function") action.run();
        el.remove();
      });
      el.appendChild(btn);
    }
    region.appendChild(el);
    setTimeout(() => {
      el.classList.add("is-leaving");
      setTimeout(() => el.remove(), 240); // matches --duration-base
    }, 2800);
    };
  }
  // SSR-safe: no window/document at import time (Next.js, Remix, node tests).
  if (typeof window !== "undefined") window.toast = makeToast();

  /* ---- Theme toggle (light <-> dark, monochrome) ---- */
  // Button: <button id="theme-toggle"> — label and data-theme both update themselves.
  // Persists via localStorage; falls back to the OS-level prefers-color-scheme
  // on first visit. The cross-fade animation itself comes from the universal
  // transition rule in components.css, not from JS — this just flips the attribute.
  const THEME_KEY = "bpk-theme";

  function readStoredTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }
  function writeStoredTheme(value) {
    try { localStorage.setItem(THEME_KEY, value); } catch (e) { /* storage unavailable — theme just won't persist */ }
  }

  function initThemeToggle() {
    const btn = document.getElementById("theme-toggle");
    const html = document.documentElement;

    const stored = readStoredTheme();
    const systemPrefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = stored || (systemPrefersDark ? "dark" : "light");
    html.dataset.theme = initial === "dark" ? "dark" : "";

    if (!btn) return;
    const label = () => (html.dataset.theme === "dark" ? "⇄ Light" : "⇄ Dark");
    btn.textContent = label();
    btn.addEventListener("click", () => {
      const next = html.dataset.theme === "dark" ? "" : "dark";
      html.dataset.theme = next;
      writeStoredTheme(next === "dark" ? "dark" : "light");
      btn.textContent = label();
    });
  }

  /* ---- Scroll reveals ---- */
  // Elements with .reveal-on-scroll (and .dim-divider lines) get .in-view
  // when scrolled into view. .js-reveals on <html> arms the hidden
  // pre-state in CSS, so no-JS users see everything.
  function initReveals() {
    const targets = document.querySelectorAll(".reveal-on-scroll, .dim-divider");
    if (!targets.length) return;
    document.documentElement.classList.add("js-reveals");
    if (!("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("in-view"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("in-view"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    targets.forEach((el) => io.observe(el));
  }

  /* ---- DataTable ---- */
  // Generic sortable/filterable/paged table. Markup:
  // <div data-datatable data-page-size="6">
  //   <input data-table-filter placeholder="Filter…">
  //   <div class="table-wrap"><table class="table">
  //     <thead><tr><th data-sort="name" scope="col">Name</th>…
  //     <tbody>… (rows sorted/filtered/paged in place; only page in DOM)
  //   </table></div>
  //   <div class="pager"><button data-table-prev>← Prev</button>
  //     <span data-table-info></span><button data-table-next>Next →</button></div>
  // </div>
  // Sorting is numeric-aware; filtering matches whole-row text.
  function initDataTables() {
    document.querySelectorAll("[data-datatable]").forEach((root) => {
      const table = root.querySelector("table");
      const tbody = table && table.querySelector("tbody");
      if (!tbody) return;
      const filterInput = root.querySelector("[data-table-filter]");
      const prevBtn = root.querySelector("[data-table-prev]");
      const nextBtn = root.querySelector("[data-table-next]");
      const info = root.querySelector("[data-table-info]");
      const pageSize = parseInt(root.dataset.pageSize || "6", 10) || 6;
      const allRows = Array.from(tbody.rows);
      const st = { key: null, dir: 1, filter: "", page: 1 };

      const cellVal = (row, idx) => (row.cells[idx] ? row.cells[idx].textContent.trim() : "");
      const cmpVal = (v) => {
        const num = parseFloat(v.replace(/[$,%\s]/g, "").replace(/,/g, ""));
        return isNaN(num) || v.trim() === "" ? v.toLowerCase() : num;
      };

      function render() {
        const heads = Array.from(table.querySelectorAll("th[data-sort]"));
        heads.forEach((th) => {
          const active = th.dataset.sort === st.key;
          th.setAttribute("aria-sort", active ? (st.dir === 1 ? "ascending" : "descending") : "none");
          const arrow = th.querySelector(".sort-arrow");
          if (arrow) arrow.textContent = active ? (st.dir === 1 ? "▲" : "▼") : "△";
        });
        let rows = allRows.slice();
        const f = st.filter.trim().toLowerCase();
        if (f) rows = rows.filter((r) => r.textContent.toLowerCase().includes(f));
        if (st.key) {
          const idx = heads.findIndex((th) => th.dataset.sort === st.key);
          if (idx >= 0) {
            rows.sort((a, b) => {
              const av = cmpVal(cellVal(a, idx)), bv = cmpVal(cellVal(b, idx));
              if (typeof av === "string") return av.localeCompare(bv) * st.dir;
              return ((av > bv) ? 1 : (av < bv) ? -1 : 0) * st.dir;
            });
          }
        }
        const pages = Math.max(1, Math.ceil(rows.length / pageSize));
        st.page = Math.min(Math.max(1, st.page), pages);
        const slice = rows.slice((st.page - 1) * pageSize, st.page * pageSize);
        tbody.replaceChildren(...slice);
        if (info) info.textContent = `Page ${st.page} / ${pages} · ${rows.length} rows`;
        if (prevBtn) prevBtn.disabled = st.page <= 1;
        if (nextBtn) nextBtn.disabled = st.page >= pages;
      }

      table.querySelectorAll("th[data-sort]").forEach((th) => {
        if (!th.querySelector(".sort-arrow")) {
          const s = document.createElement("span");
          s.className = "sort-arrow"; s.textContent = "△"; s.setAttribute("aria-hidden", "true");
          th.appendChild(s);
        }
        th.setAttribute("tabindex", "0");
        if (!th.getAttribute("aria-sort")) th.setAttribute("aria-sort", "none");
        const go = () => {
          const k = th.dataset.sort;
          if (st.key === k) st.dir *= -1;
          else { st.key = k; st.dir = 1; }
          render();
        };
        th.addEventListener("click", go);
        th.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
        });
      });
      if (filterInput) filterInput.addEventListener("input", () => { st.filter = filterInput.value; st.page = 1; render(); });
      if (prevBtn) prevBtn.addEventListener("click", () => { st.page--; render(); });
      if (nextBtn) nextBtn.addEventListener("click", () => { st.page++; render(); });
      render();
    });
  }

  /* ---- Command palette ---- */
  // Ctrl/⌘+K or [data-palette-open]. Sources: nav anchor links + [data-command].
  // ↑↓ move, Enter runs, Esc closes. Listbox pattern with aria-activedescendant.
  function initPalette() {
    const overlay = document.getElementById("palette");
    if (!overlay) return;
    const input = overlay.querySelector(".palette-input");
    const list = overlay.querySelector(".palette-list");
    let items = [], active = -1, lastFocused = null;

    function collect() {
      items = [];
      document.querySelectorAll('nav a[href^="#"]').forEach((a) => {
        items.push({ label: a.textContent.trim(), hint: "go", run: () => { location.hash = a.getAttribute("href"); } });
      });
      document.querySelectorAll("[data-command]").forEach((el) => {
        items.push({
          label: el.dataset.command,
          hint: el.tagName.toLowerCase() === "button" ? "run" : "go",
          run: () => { el.focus(); el.click(); }
        });
      });
      return items;
    }

    function render() {
      const q = input.value.trim().toLowerCase();
      const shown = items.filter((it) => !q || it.label.toLowerCase().includes(q) || it.hint.includes(q)).slice(0, 9);
      active = shown.length ? 0 : -1;
      paint(shown);
      return shown;
    }

    function paint(shown) {
      list.innerHTML = "";
      if (!shown.length) {
        const li = document.createElement("li");
        li.className = "palette-empty"; li.textContent = "// No match";
        list.appendChild(li);
        input.setAttribute("aria-activedescendant", "");
        return;
      }
      shown.forEach((it, i) => {
        const li = document.createElement("li");
        li.setAttribute("role", "option");
        li.id = "palette-opt-" + i;
        li.setAttribute("aria-selected", String(i === active));
        const b = document.createElement("strong"); b.textContent = it.label;
        const h = document.createElement("span"); h.className = "mono"; h.textContent = it.hint;
        li.append(b, h);
        li.addEventListener("click", () => { close(); it.run(); });
        list.appendChild(li);
      });
      input.setAttribute("aria-activedescendant", active >= 0 ? "palette-opt-" + active : "");
      list.querySelectorAll('[role="option"]')[active]?.scrollIntoView({ block: "nearest" });
    }

    function open() {
      lastFocused = document.activeElement;
      collect(); input.value = "";
      render();
      overlay.classList.add("is-open");
      overlay.removeAttribute("aria-hidden");
      if ("inert" in overlay) overlay.inert = false;
      document.body.style.overflow = "hidden";
      input.focus();
    }
    function close() {
      overlay.classList.remove("is-open");
      overlay.setAttribute("aria-hidden", "true");
      if ("inert" in overlay) overlay.inert = true;
      if (!document.querySelector(".modal-overlay.is-open")) document.body.style.overflow = "";
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }
    window.togglePalette = function () {
      overlay.classList.contains("is-open") ? close() : open();
    };

    let shown = [];
    input.addEventListener("input", () => { shown = render(); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!shown.length) return;
        active = (active + (e.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length;
        paint(shown);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (shown[active]) { const it = shown[active]; close(); it.run(); }
      } else if (e.key === "Escape") { e.preventDefault(); close(); }
    });
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    document.querySelectorAll("[data-palette-open]").forEach((b) => b.addEventListener("click", open));
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); open(); }
    });
    overlay.setAttribute("aria-hidden", "true");
    if ("inert" in overlay) overlay.inert = true;
  }

  /* ---- Dropdown menus ---- */
  // Trigger: <button data-menu-trigger aria-expanded="false" aria-controls="menu-id">
  // Panel:   <ul class="menu" id="menu-id" role="menu" hidden>
  // Items:   <li role="none"><button class="menu-item" role="menuitem">…</button></li>
  // Click toggles + focuses first item; arrows cycle; Esc closes + refocuses;
  // click-outside and Tab close.
  function initMenus() {
    document.querySelectorAll("[data-menu-trigger]").forEach((trigger) => {
      const menu = document.getElementById(trigger.getAttribute("aria-controls"));
      if (!menu) return;
      const items = () => Array.from(menu.querySelectorAll(".menu-item")).filter(
        (el) => !el.disabled && el.getClientRects().length > 0
      );
      const isOpen = () => !menu.hasAttribute("hidden");
      function open(focusFirst) {
        document.querySelectorAll(".menu:not([hidden])").forEach((m) => {
          if (m !== menu) {
            m.setAttribute("hidden", "");
            const t = document.querySelector(`[data-menu-trigger][aria-controls="${m.id}"]`);
            if (t) t.setAttribute("aria-expanded", "false");
          }
        });
        menu.removeAttribute("hidden");
        trigger.setAttribute("aria-expanded", "true");
        if (focusFirst && items()[0]) items()[0].focus();
      }
      function close(refocus) {
        menu.setAttribute("hidden", "");
        trigger.setAttribute("aria-expanded", "false");
        if (refocus) trigger.focus();
      }
      trigger.addEventListener("click", () => (isOpen() ? close(false) : open(true)));
      trigger.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown" || (e.key === "Enter" && !isOpen())) { e.preventDefault(); open(true); }
      });
      menu.addEventListener("keydown", (e) => {
        const list = items();
        const i = list.indexOf(document.activeElement);
        if (e.key === "Escape") { e.preventDefault(); close(true); }
        else if (e.key === "ArrowDown") { e.preventDefault(); (list[i + 1] || list[0]).focus(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); (list[i - 1] || list[list.length - 1]).focus(); }
        else if (e.key === "Tab") close(false);
      });
      document.addEventListener("click", (e) => {
        if (isOpen() && !menu.contains(e.target) && e.target !== trigger && !trigger.contains(e.target)) close(false);
      });
    });
  }

  /* ---- Combobox ---- */
  // <div class="combo-wrap">
  //   <input role="combobox" aria-expanded aria-controls="combo-list" aria-autocomplete="list">
  //   <ul class="combo-list" id="combo-list" role="listbox" hidden>
  //     <li role="option" data-value="Apple">Apple</li> …
  // Substring filter; ↑↓/Enter/Esc; picks set the input value.
  function initComboboxes() {
    document.querySelectorAll(".combo-wrap").forEach((wrap) => {
      const input = wrap.querySelector('[role="combobox"]');
      const list = wrap.querySelector('[role="listbox"]');
      if (!input || !list) return;
      const options = Array.from(list.querySelectorAll('[role="option"]'));
      let active = -1;

      function shown() { return options.filter((o) => !o.hasAttribute("hidden")); }
      function paint() {
        shown().forEach((o, i) => o.setAttribute("aria-selected", String(i === active)));
        input.setAttribute("aria-activedescendant", active >= 0 && shown()[active] ? shown()[active].id || "" : "");
      }
      function filter() {
        const q = input.value.trim().toLowerCase();
        options.forEach((o) => {
          const hit = !q || (o.dataset.value || o.textContent).toLowerCase().includes(q);
          hit ? o.removeAttribute("hidden") : o.setAttribute("hidden", "");
        });
        active = shown().length ? 0 : -1;
        list.removeAttribute("hidden");
        input.setAttribute("aria-expanded", "true");
        paint();
      }
      function pick(o) {
        input.value = o.dataset.value || o.textContent.trim();
        list.setAttribute("hidden", "");
        input.setAttribute("aria-expanded", "false");
        input.focus();
      }
      options.forEach((o, i) => {
        if (!o.id) o.id = (list.id || "combo") + "-opt-" + i;
        o.setAttribute("aria-selected", "false");
        o.addEventListener("click", () => pick(o));
      });
      input.setAttribute("aria-expanded", "false");
      input.addEventListener("input", filter);
      input.addEventListener("focus", () => { if (!input.value) filter(); });
      input.addEventListener("blur", () => setTimeout(() => {
        list.setAttribute("hidden", ""); input.setAttribute("aria-expanded", "false");
      }, 120));
      input.addEventListener("keydown", (e) => {
        const vis = shown();
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          if (!vis.length) return;
          active = (active + (e.key === "ArrowDown" ? 1 : -1) + vis.length) % vis.length;
          paint();
          vis[active].scrollIntoView({ block: "nearest" });
        } else if (e.key === "Enter") {
          if (active >= 0 && vis[active]) { e.preventDefault(); pick(vis[active]); }
        } else if (e.key === "Escape") {
          list.setAttribute("hidden", ""); input.setAttribute("aria-expanded", "false");
        }
      });
    });
  }

  /* ---- Tilt + spotlight + draw-on + scroll rule ---- */
  function motionOK() {
    return !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  // [data-tilt] [data-tilt-max="8"]: pointer-tracked 3D tilt + --mx/--my
  // for .tilt-glare / .spotlight children. rAF-throttled, resets on leave.
  function initTilt() {
    if (!motionOK()) return;
    document.querySelectorAll("[data-tilt]").forEach((el) => {
      const inner = el.querySelector(".tilt-inner") || el;
      const max = parseFloat(el.dataset.tiltMax) || 8;
      let raf = 0;
      el.addEventListener("pointermove", (e) => {
        if (e.pointerType === "touch") return;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const r = el.getBoundingClientRect();
          const px = (e.clientX - r.left) / Math.max(1, r.width);
          const py = (e.clientY - r.top) / Math.max(1, r.height);
          inner.style.setProperty("--ry", ((px - 0.5) * max * 2).toFixed(2) + "deg");
          inner.style.setProperty("--rx", ((0.5 - py) * max * 2).toFixed(2) + "deg");
          el.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
          el.style.setProperty("--my", (py * 100).toFixed(1) + "%");
        });
      });
      el.addEventListener("pointerleave", () => {
        cancelAnimationFrame(raf);
        inner.style.setProperty("--rx", "0deg");
        inner.style.setProperty("--ry", "0deg");
      });
    });
  }

  // .spotlight (without tilt): cursor-tracked radial highlight only.
  function initSpotlight() {
    if (!motionOK()) return;
    document.querySelectorAll(".spotlight").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        if (e.pointerType === "touch") return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", (e.clientX - r.left).toFixed(0) + "px");
        el.style.setProperty("--my", (e.clientY - r.top).toFixed(0) + "px");
      });
    });
  }

  // [data-draw]: SVG strokes sketch themselves on scroll into view.
  // Measures each path/circle/line, then flips .drawn with per-shape stagger.
  function initDraw() {
    const scopes = document.querySelectorAll("[data-draw]");
    if (!scopes.length) return;
    const prep = (scope) => {
      const shapes = scope.querySelectorAll("path, circle, line");
      shapes.forEach((s, i) => {
        try {
          const len = s.getTotalLength();
          s.style.strokeDasharray = String(len);
          s.style.strokeDashoffset = String(len);
          s.style.setProperty("--draw-delay", (i * 120) + "ms");
        } catch (e) { /* non-geometry shape — leave static */ }
      });
    };
    const play = (scope) => scope.classList.add("drawn");
    if (!motionOK() || !("IntersectionObserver" in window)) {
      scopes.forEach((s) => { if (motionOK()) { prep(s); play(s); } });
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { prep(e.target); requestAnimationFrame(() => play(e.target)); io.unobserve(e.target); }
      });
    }, { threshold: 0.4 });
    scopes.forEach((s) => io.observe(s));
  }

  // .scroll-rule: fixed top progress bar driven by scroll (rAF-throttled).
  function initScrollRule() {
    const bar = document.querySelector(".scroll-rule");
    if (!bar) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
    };
    window.addEventListener("scroll", () => {
      if (!raf) raf = requestAnimationFrame(update);
    }, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  /* ---- Count-up ---- */
  // <span data-countup="1234" data-decimals="0" data-duration="1200" data-prefix="$">0</span>
  // Animates from 0 to the target with ease-out when scrolled into view.
  // Reduced-motion users get the final value instantly. Locale-formatted.
  function initCountUp() {
    const els = document.querySelectorAll("[data-countup]");
    if (!els.length) return;
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fmt = (v, d) => v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
    function play(el) {
      const target = parseFloat(el.dataset.countup);
      if (isNaN(target)) return;
      const decimals = parseInt(el.dataset.decimals || "0", 10) || 0;
      const dur = parseInt(el.dataset.duration || "1200", 10) || 1200;
      const prefix = el.dataset.prefix || "", suffix = el.dataset.suffix || "";
      if (reduced || dur <= 0) { el.textContent = prefix + fmt(target, decimals) + suffix; return; }
      const t0 = performance.now();
      function frame(t) {
        const p = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = prefix + fmt(target * eased, decimals) + suffix;
        if (p < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }
    if (!("IntersectionObserver" in window)) { els.forEach(play); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { play(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.4 });
    els.forEach((el) => io.observe(el));
  }

  /* ---- Drawers ---- */
  // Side panels reusing the overlay contract. Markup mirrors modals:
  // Trigger: <button data-drawer-open="my-drawer">
  // Overlay: <div class="drawer-overlay" id="my-drawer" data-drawer role="presentation">
  //   Panel: <div class="drawer" role="dialog" aria-modal="true" aria-label="…">
  // Close:   <button data-drawer-close> (inside the overlay)
  function initDrawers() {
    document.querySelectorAll("[data-drawer-open]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = document.getElementById(btn.dataset.drawerOpen);
        if (target) openDrawer(target);
      });
    });
    document.querySelectorAll("[data-drawer]").forEach((overlay) => {
      if (!overlay.classList.contains("is-open")) {
        overlay.setAttribute("aria-hidden", "true");
        if ("inert" in overlay) overlay.inert = true;
      }
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeDrawer(overlay);
      });
      overlay.querySelectorAll("[data-drawer-close]").forEach((btn) => {
        btn.addEventListener("click", () => closeDrawer(overlay));
      });
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" && e.key !== "Tab") return;
      const open = document.querySelector(".drawer-overlay.is-open");
      if (!open) return;
      if (e.key === "Escape" && !document.querySelector(".modal-overlay.is-open")) { closeDrawer(open); return; }
      if (e.key === "Tab") trapFocus(open, e);
    });
  }

  function openDrawer(overlay) {
    overlay._returnTo = document.activeElement;
    overlay.classList.add("is-open");
    overlay.removeAttribute("aria-hidden");
    if ("inert" in overlay) overlay.inert = false;
    setPageHidden(true);
    document.body.style.overflow = "hidden";
    const panel = overlay.querySelector(".drawer");
    const focusable = panel && visibleFocusable(panel)[0];
    if (focusable) focusable.focus();
  }

  function closeDrawer(overlay) {
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    if ("inert" in overlay) overlay.inert = true;
    if (!document.querySelector(".modal-overlay.is-open")) {
      setPageHidden(false);
      document.body.style.overflow = "";
    }
    if (overlay._returnTo && typeof overlay._returnTo.focus === "function") overlay._returnTo.focus();
  }

  /* ---- Init ---- */
  // Theme runs first and outside DOMContentLoaded where possible (see the
  // inline snippet in index.html's <head>) to avoid a flash of the wrong
  // theme; this call just wires the button and keeps state in sync.
  // Guarded for SSR/Node: importing this file must never throw without a DOM.
  if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    initThemeToggle();
    initModals();
    initTabs();
    initAccordions();
    initReveals();
    initDataTables();
    initPalette();
    initMenus();
    initComboboxes();
    initCountUp();
    initTilt();
    initSpotlight();
    initDraw();
    initScrollRule();
    initDrawers();
  });
  }
})();
