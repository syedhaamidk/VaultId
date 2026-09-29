# WCAG 2.1 AA Accessibility Audit

**Date:** 2026-09-29
**Scope:** VaultID app (landing page + vault)

## What's already good

- **Keyboard PIN entry** — physical digits + Backspace work on the lock screen.
- **Modal focus trap** — modals trap focus, Escape closes them, focus is restored on close.
- **ARIA labels** — PIN keypad buttons, icon buttons, and form inputs have labels.
- **aria-live** — error messages and strength meter updates are announced.
- **role="alert"** — error messages use the alert role.
- **role="dialog" + aria-modal** — modals are properly marked up.
- **Labeled inputs** — all form inputs have associated labels (htmlFor/id).
- **Reduced motion** — `prefers-reduced-motion` disables CSS animations and the WebGL loop.
- **Show/hide toggle** — password visibility toggle with `aria-pressed`.

## Gaps and recommendations

### 1. PIN dots are not announced (Medium)
The PIN entry dots (●●●○○○) are visual only. A screen-reader user can't tell how many digits they've entered.
**Fix:** Add `aria-label` to the dots container: `aria-label={`${pin.length} of ${PIN_LEN} digits entered`}`.

### 2. Lock screen unlock success not announced (Medium)
The "Unlocked ✓" message is visual only.
**Fix:** Add `role="status"` or `aria-live="polite"` to the unlock success message.

### 3. Document grid cards are not keyboard-focusable (Medium)
The `TiltCard` component has `role="button"` and `tabIndex={0}`, but the inner content (document number, copy button) may not be reachable by keyboard.
**Fix:** Ensure all interactive elements inside cards are keyboard-focusable and have visible focus indicators.

### 4. Focus indicators may be insufficient (Low)
The app uses custom styles that may override the default focus ring.
**Fix:** Add a visible focus indicator: `:focus-visible { outline: 2px solid var(--ac1); outline-offset: 2px; }`.

### 5. Color contrast (Low)
Some text uses `var(--tx4)` (muted) on dark backgrounds, which may not meet 4.5:1 contrast.
**Fix:** Audit all `var(--tx4)` usage and ensure contrast ≥ 4.5:1 for body text, 3:1 for large text.

### 6. Reduced motion for GSAP (Low)
The CardNav GSAP animations are not disabled for reduced-motion users.
**Fix:** Check `prefers-reduced-motion` in CardNav and skip GSAP animations.

### 7. Skip link (Low)
There's no "skip to main content" link for keyboard users.
**Fix:** Add a skip link as the first focusable element.

### 8. Document number copy feedback (Low)
The "Copied" feedback is visual only.
**Fix:** Add `aria-live="polite"` to the copy feedback.

## Priority

1. **PIN dots announcement** (Medium) — small fix, high impact for screen-reader users.
2. **Unlock success announcement** (Medium) — small fix.
3. **Focus indicators** (Low) — CSS-only fix.
4. **Color contrast** (Low) — audit and adjust.
5. **GSAP reduced motion** (Low) — small JS check.
6. **Skip link** (Low) — small HTML addition.

## WCAG level

The app is **partially conformant** with WCAG 2.1 AA. The gaps are mostly Medium/Low and can be addressed with small fixes. The most impactful are the PIN dots announcement and the unlock success announcement, which affect the core unlock flow.
