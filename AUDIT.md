# VaultID — Security & Code Audit

**Auditor:** Senior security engineer / cryptography reviewer
**Date:** 2026-09-29
**Scope:** Full source tree (working tree, uncommitted hardening included). Every source file read.
**Method:** Manual review. No code modified (Phase 6 not started).

> **Note on premises.** Several assumptions in the audit brief describe the *committed* `HEAD`, not the current working tree. The working tree already fixes: 4-digit→6-digit PIN, 100k→600k PBKDF2, client-side Groq key→server-side proxy, qrserver.com→local QR, "Claude"→"Groq" copy, and the `.gitignore` is correctly dotted. I audit the **current code** and flag each outdated premise inline.

---

## 1. Executive Summary

- **The cryptographic core is genuinely sound** — AES-256-GCM with a fresh random 12-byte IV per save, a non-extractable key, PBKDF2-SHA256 at 600k iterations (current OWASP guidance), and a server-side-only Groq key. This is better than most "encrypted" consumer apps.
- **The 6-digit PIN is the existential flaw.** 10⁶ keyspace ≈ 20 bits of entropy. An attacker who copies the localStorage blob can exhaust the entire keyspace in **minutes on a single high-end GPU** (est. ~7 min at ~2,500 guesses/s). No KDF iteration count can fix a 20-bit secret. This caps the whole system's security regardless of how correct the crypto is.
- **"Zero-knowledge" is contradicted by the AI scan feature.** Document images (Aadhaar, passport, medical records) are uploaded to Groq through the proxy. The server sees ciphertext, but a third party sees plaintext PII. The landing page's "zero-knowledge" and "your data never leaves your device" claims are overstated.
- **Multiple supply-chain and hygiene holes:** jsPDF loaded from a CDN with no SRI (code execution in the unlocked vault context), a `file:../stock` dependency pointing outside the repo, no CSP/security headers, no `vercel.json`, and a stale `dist/`.
- **The emergency QR is a real privacy leak** — unencrypted blood type, allergies, medications, and a phone number in a code readable by anyone nearby. It is now generated locally (good), but there is no opt-in warning.

### Overall security grade: **D+**

The crypto core alone would earn a **B+**; the 6-digit PIN, the third-party PII flow, the supply-chain issues, and the missing headers drag the *system* down to **D+**. Replacing the PIN with a passphrase and fixing the quick-win hygiene items would raise it to **B/B+**; the full target architecture would make it **A-grade**.

---

## 2. Findings Table

Severity: **C**ritical / **H**igh / **M**edium / **L**ow. "Confirmed" = verified in code. "Hypothesis" = needs runtime/external verification.

| ID | Sev | Category | File:Line | Issue | Impact | Fix |
|----|-----|----------|-----------|-------|--------|-----|
| VID-001 | **C** | Crypto / entropy | `VaultApp.jsx:451` (`PIN_LEN = 6`), `data.js:8` (`DEMO_PIN='123456'`) | 6-digit PIN → 10⁶ keyspace (~20 bits). Offline brute-force of the localStorage blob is trivial. | Full vault compromise from a copied blob in minutes (GPU) to hours (CPU). | Passphrase (≥12 chars / diceware) or full keyboard. KDF cannot fix a 20-bit secret. |
| VID-002 | **H** | Crypto / architecture | `crypto.js:25-40, 84-92` | No key wrapping: the PIN-derived key *is* the DEK. Single plaintext salt in localStorage. No KEK/DEK separation. | No multi-factor unlock (e.g. WebAuthn+PIN), no per-key rotation, full re-encrypt on PIN change. | Random DEK wrapped by a passphrase-derived KEK; store wrapped DEK + versioned header. |
| VID-003 | **H** | Privacy / third-party | `VaultApp.jsx:21-47`, `api/scan.js:180-200` | Document images sent to Groq (third party). Contradicts "zero-knowledge" marketing. | PII (Aadhaar, passport, medical) leaves the device; Groq retention/policy dependency. | On-device OCR (Tesseract.js) option; explicit per-scan consent dialog; disclose in privacy policy. |
| VID-004 | **H** | Privacy / emergency QR | `VaultApp.jsx:277-291, 1459-1468` | QR encodes unencrypted blood type, allergies, medications, conditions, contact name+phone. Readable by anyone. | Medical/financial privacy loss from a photo of the screen or the card. | Opt-in warning; consider a public "emergency" subset + encrypted full record behind a tap-through. |
| VID-005 | **H** | Supply chain | `VaultApp.jsx:694` | jsPDF loaded from `cdn.jsdelivr.net` via dynamic `import()` with **no SRI / integrity check**. | Compromised CDN or MITM → arbitrary code execution while the vault is unlocked. | Vendor jsPDF as a npm dependency; if CDN is kept, add `integrity` + `crossorigin`. |
| VID-006 | **H** | Supply chain / hygiene | `package.json:15` | `"@chomuiro/saisei": "file:../stock"` — dependency points **outside the repo**. | Fresh clone + `npm install` fails without `../stock`; opaque, unversioned supply chain. | Publish to npm or vendor into the repo; commit a lockfile that resolves. |
| VID-007 | **H** | Headers / CSP | `index.html:1-14`, `vite.config.js:1-8` | No CSP, no security headers (X-Frame-Options, Referrer-Policy, etc.), no `vercel.json`. | XSS would be far more damaging; clickjacking; MIME-sniffing. | Add CSP meta + `vercel.json` headers (see §4). |
| VID-008 | **M** | Brute-force | `VaultApp.jsx:80-82, 482-500` | Attempt counter (`failCount`) lives only in React state; 30s lockout is in-memory. | Copying localStorage to another machine bypasses all throttling; the GCM tag is the only real gate. | Persist a tamper-evident counter; exponential backoff; optional wipe-after-N (with consent). |
| VID-009 | **M** | Session | `VaultApp.jsx:365-390` | Idle auto-lock exists (4 min warn / 5 min lock) but **no `visibilitychange` handler**. | User who switches tabs and returns within 5 min still sees an open vault. | Lock (or warn) on `visibilitychange` → hidden. |
| VID-010 | **M** | Session / clipboard | `VaultApp.jsx:557-568` | `copyNum` writes document numbers to the clipboard and **never clears them**. | Aadhaar/PAN persists in the clipboard indefinitely. | Clear clipboard after ~30-60 s; warn on copy. |
| VID-011 | **M** | Crypto / integrity | `crypto.js:43-51, 131-151` | Whole-vault re-encryption every save; **no AAD**; no version counter. | Rollback attack: an attacker with localStorage write access can restore an older ciphertext and it will decrypt fine. | Bind a version/AAD into GCM; store a monotonic counter. |
| VID-012 | **M** | Storage / perf | `VaultApp.jsx:50, 734` | Images stored as base64 data URLs up to 2.5 MB each, **no client-side compression**; no aggregate quota guard. | localStorage (5-10 MB) exhausted after 2-3 images → `STORAGE_WRITE_FAILED`, silent-ish data loss. | Compress/resize before encrypting; enforce an aggregate budget; surface quota errors clearly. |
| VID-013 | **M** | Perf / bundle | `App.jsx:2-3` | `VaultApp` is **statically imported**; no route-based code splitting. | Every landing-page visitor downloads the entire vault app (~300 KB main chunk). | `React.lazy` + `Suspense` for `VaultApp`. |
| VID-014 | **M** | Perf / bundle | `LandingPage.jsx:6`, `SideRays.jsx` (465 KB chunk) | Three.js god-ray is lazy-loaded but the landing page is the entry, so it loads immediately. | Heavy first paint on low-end/mobile devices. | Consider a static/CSS fallback for low-end; preload only on capable devices. |
| VID-015 | **M** | Accessibility | `index.css` (no `prefers-reduced-motion` anywhere) | No reduced-motion path for WebGL/GSAP/CSS animations. | Vestibular disorders; motion-sensitive users. | Wrap animations in `@media (prefers-reduced-motion: reduce)`; pause GSAP/Three.js. |
| VID-016 | **M** | UX / setup | `crypto.js:107-118` | First run: **any** PIN creates a vault (no confirm step). | A fat-fingered first PIN becomes the permanent password; user locked out of their own (empty) vault. | Confirm-PIN step on first run; allow "start over" before any data is added. |
| VID-017 | **M** | Backup / recovery | `crypto.js:172-184` | `exportLocalBlob()` exists but there is **no export/import UI**. | No encrypted backup; a lost/broken device = total data loss. | Encrypted export/import flow (see §4). |
| VID-018 | **M** | Recovery | (design) | Zero-knowledge means a forgotten PIN = permanent data loss, and this is **not surfaced at setup**. | Users discover the tradeoff only after losing data. | Setup-time warning + optional recovery kit (encrypted backup / recovery code). |
| VID-019 | **M** | API / abuse | `api/scan.js:32-46, 58-81` | `/api/scan` has **no authentication**; rate limit is per-instance in-memory (bypassed on serverless); missing `Origin` is allowed. | Anyone can burn the Groq quota; non-browser clients can call it directly. | Add auth (e.g. Supabase session); per-user rate limits; consider rejecting missing-Origin. |
| VID-020 | **M** | Validation | `data.js:21-33`, `utils.jsx:136-199` | No Aadhaar (Verhoeff) or PAN (regex) validation; demo docs preloaded in demo mode. | Invalid/fraudulent document numbers stored; demo data mistaken for real. | Add format validation; gate demo data behind an explicit dev flag. |
| VID-021 | **M** | Marketing | `LandingPage.jsx:70`, `data.js:89,113-114` | "Military-grade" (overstated in context); "Zero-Knowledge" (contradicted by scan); "Your data never leaves your device" (false for scan). | Misleading security claims; regulatory/trust risk. | Reword to match reality (see §6). |
| VID-022 | **L** | Docs | `README.md:9` vs `package.json:26` | README says "Vite 5"; `package.json` has `vite ^8.3.0`. | Confusing; stale docs. | Update README to Vite 8. |
| VID-023 | **M** | Defaults | `.env.example:7` | Ships with `VITE_DEMO_MODE=true`. | A deploy from this example shows the demo PIN hint on the lock screen. | Default to `false`; add a hard fail in production builds. |
| VID-024 | **L** | Process | (repo) | No tests, no ESLint, no CI. | Regressions ship silently. | Add Vitest + ESLint + a CI workflow. |
| VID-025 | **L** | Dead code | `BorderGlow.jsx` | Defined but never imported anywhere. | Confusion; bundle bloat if ever wired up. | Remove or use. |
| VID-026 | **L** | Build hygiene | `dist/` | `dist/` is stale (built from an intermediate state where `pushEncryptedBlob` was a no-op). Not git-tracked. | A deploy from this `dist` would silently fail sync. | Rebuild from current source; add `dist/` to `.gitignore` (already present). |
| VID-027 | **L** | Config | `api/scan.js:11` | `GROQ_VISION_MODEL` defaults to `qwen/qwen3.8-27b` — **unverified**; may not exist. | Scan calls fail at runtime. | Verify against Groq's model list; pin a known vision model. |
| VID-028 | **L** | PWA | `README.md:90-92` | README says "Add a manifest.json and service worker" — not implemented. | No offline / add-to-home-screen. | Implement PWA (see §4). |
| VID-029 | **L** | Product | (design) | No multi-vault, document versioning, audit log, or secure sharing with expiry. | Feature gap vs Bitwarden/1Password/Proton. | Roadmap (§5). |
| VID-030 | **L** | Privacy | `VaultApp.jsx:830-882` | `shareEmergencyCard` shares medical data with no sensitivity warning. | Users may share medical data unwittingly. | Confirm dialog before sharing. |

---

## 3. Top 10 Prioritized Improvements

Ranked by (risk reduced × effort⁻¹). Effort: **S** (<1 day) / **M** (1-3 days) / **L** (1-2 weeks).

| # | Improvement | Risk | Effort | Rationale |
|---|-------------|------|--------|-----------|
| 1 | **Replace 6-digit PIN with a passphrase** (keep PIN as a convenience unlock that wraps the same DEK) | Critical | M | Root-cause fix. 10⁶ → ~2⁷⁸ keyspace. Everything else is secondary. |
| 2 | **CSP + security headers** via `vercel.json` + meta | High | S | Trivial effort, blocks entire XSS/clickjacking classes. |
| 3 | **Vendor jsPDF** (remove CDN, no SRI) | High | S | Removes a code-execution path in the unlocked vault. |
| 4 | **Fix `file:../stock`** dependency | High | S | Un-breaks fresh clones; removes an opaque supply-chain path. |
| 5 | **Lock on `visibilitychange` + clipboard auto-clear** | Medium | S | Closes two trivial session-leak paths. |
| 6 | **`.env.example` → `VITE_DEMO_MODE=false`** | Medium | S | Prevents a demo-PIN-hint deploy. |
| 7 | **DEK/KEK separation + versioned vault format** (v1 unlock preserved) | High | L | Enables WebAuthn, per-doc encryption, key rotation. The real architecture fix. |
| 8 | **Encrypted export/import UI** | Medium | M | Stops total data loss on device loss. |
| 9 | **Persistent attempt limiting + exponential backoff** | Medium | M | Makes online brute-force costly even with a copied blob. |
| 10 | **Per-document encryption** | Medium | L | Enables partial updates, sharing, and per-doc access control. |

**Quick wins (items 2-6) should ship immediately** regardless of ranking — they are sub-day efforts with outsized value.

---

## 4. Recommended Target Architecture

```
Passphrase ──► Argon2id (WASM) or PBKDF2 ≥ 600k ──► KEK
                     │
                     ▼
              unwrap DEK (random 256-bit, generated at vault creation)
                     │
                     ▼
        Per-document AES-256-GCM (unique IV per doc, AAD = doc id + version)
                     │
                     ▼
   Versioned vault file:  MAGIC | version | kdf_params | salt | wrapped_DEK | docs[]
```

1. **Passphrase, not a PIN.** ≥12 chars or diceware (≥60 bits). Keep the 6-digit PIN as a *convenience* unlock that wraps the same DEK — so biometrics/PIN/passphrase all coexist.
2. **KDF:** Argon2id (WASM, e.g. `hash-wasm`/`argon2-browser`) with OWASP params (m≈19-47 MiB, t=2, p=1-4), PBKDF2 ≥ 600k as a fallback. *(Verify current OWASP numbers before pinning — I could not reach the live cheat sheet in this session.)*
3. **DEK/KEK separation.** A random DEK encrypts data; a passphrase-derived KEK wraps the DEK. Store `wrapped_DEK` in a **versioned plaintext header** so the format can evolve and v1 blobs remain unlockable.
4. **Per-document encryption.** Each doc gets its own IV and AAD (doc id + version). Enables partial updates, secure sharing, and per-doc deletion without re-encrypting the whole vault.
5. **Versioned format + AAD.** A magic bytes + version header, with the version bound into GCM's AAD, defeats rollback and format-confusion attacks.
6. **Encrypted export/import.** The whole vault (or per-doc) exportable as an encrypted file; import re-wraps the DEK under the local KEK.
7. **Session hardening.** Idle auto-lock (exists) **+ `visibilitychange` lock** + clipboard auto-clear + a persistent, tamper-evident attempt counter with exponential backoff and an opt-in wipe-after-N.
8. **Self-hosted QR** (already done via the `qrcode` package) + an opt-in warning that the QR is readable by anyone.
9. **Backend proxy for AI calls** (already done via `api/scan.js`) — add auth, per-user rate limits, and offer an **on-device OCR** (Tesseract.js) option so sensitive docs never leave the device.
10. **Strict CSP + headers** (via `vercel.json`):
    ```
    Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none';
      base-uri 'self'; frame-ancestors 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'
    X-Content-Type-Options: nosniff
    X-Frame-Options: DENY
    Referrer-Policy: no-referrer
    Permissions-Policy: camera=(), microphone=(), geolocation=()
    ```
11. **WebAuthn/PRF** for biometric unlock (wraps the DEK with a WebAuthn-derived key).
12. **PWA** (manifest + service worker) for offline access.

**Backward compatibility:** the v1 format (`{iv, ct}` with `kdfIterations` inside the ciphertext) must remain unlockable. The `decryptWithKdfFallback` pattern already established in `crypto.js:62-74` is the right model — extend it to try the new format, then v1, and migrate to the current format on the next save.

---

## 5. 30 / 60 / 90-Day Roadmap

### Days 1-30 — Stop the bleeding
- Passphrase support + versioned format with v1 backward-compatible unlock (migrate on unlock).
- CSP + security headers via `vercel.json`.
- Vendor jsPDF; remove the CDN dynamic import.
- Replace `file:../stock` with a published/vendored dependency.
- `visibilitychange` lock + clipboard auto-clear.
- `.env.example` → `VITE_DEMO_MODE=false`.
- Unit tests for `crypto.js` (round-trip, wrong key, tamper detection, v1→v2 migration).

### Days 31-60 — Fix the architecture
- DEK/KEK separation with key wrapping.
- Per-document encryption.
- Encrypted export/import UI.
- Persistent attempt limiting + exponential backoff.
- `prefers-reduced-motion` support.
- Route-based code splitting (`React.lazy` for `VaultApp`).
- Image compression before storage + aggregate quota guard.
- Aadhaar (Verhoeff) / PAN (regex) validation.
- Emergency QR opt-in warning.

### Days 61-90 — Harden and differentiate
- WebAuthn biometric unlock.
- PWA / offline support.
- On-device OCR (Tesseract.js) as a privacy-preserving alternative to Groq.
- Document versioning + audit log.
- Secure sharing with expiry.
- DigiLocker integration assessment (India-specific).
- Accessibility audit (WCAG 2.1 AA).
- Independent security review / bug-bounty pilot.

---

## 6. Marketing Claims Audit

| Claim | Where | Verdict | Why |
|-------|-------|---------|-----|
| "AES-256-GCM" | `LandingPage.jsx:61,90`, `data.js:88` | **Accurate** | Matches `crypto.js`. |
| "PBKDF2 · 600k iterations" | `LandingPage.jsx:91` | **Accurate** | Matches `KDF_ITERATIONS = 600_000` (`crypto.js:22`). |
| "Military-grade encryption" | `LandingPage.jsx:70`, `index.html:7` | **Overstated** | AES-256 is military-grade, but a 6-digit PIN makes the *system* not. The claim is about the algorithm, not the system. |
| "Zero-Knowledge" | `data.js:113-114`, `LandingPage.jsx:61,92` | **Overstated** | Sync is zero-knowledge, but the AI scan sends plaintext document images to Groq. |
| "Your PIN is the only key — never transmitted" | `data.js:89` | **Accurate** | PIN never leaves the device. |
| "The server only ever stores AES ciphertext" | `data.js:109` | **Accurate** (for sync) | Supabase stores `{iv, salt, ciphertext}` only. |
| "Your data never leaves your device without your permission" | `LandingPage.jsx:195` | **False** (for scan) | The scan uploads the raw image to Groq. |
| "Cross-Device Sync — zero-knowledge Supabase sync" | `data.js:108-110` | **Accurate** | Implemented in `sync.js` + `supabase_schema.sql` with RLS. |
| "AI Document Scan — Groq extracts…" | `data.js:93-94` | **Accurate** | Matches `api/scan.js`. |
| "Emergency Card + QR" | `data.js:98-99` | **Accurate** | Implemented; QR is local. |
| "Smart Expiry Alerts" | `data.js:103-104` | **Accurate** | `daysLeft` + `Badge` in `utils.jsx`. |
| README "Vite 5" | `README.md:9` | **False** | `package.json` has `vite ^8.3.0`. |
| README structure (`src/`, `api/`) | `README.md:55-78` | **Accurate** | Matches the actual layout. |

---

## 7. What's Already Good

Credit where due — several decisions are genuinely correct:

- **Web Crypto API throughout** (`crypto.js`) — no hand-rolled crypto, no `Math.random()` for keys/IVs.
- **Non-extractable key** (`crypto.js:37` — `extractable: false`) — the key can't be dumped via `crypto.subtle.exportKey`.
- **Fresh random 12-byte IV per encryption** (`crypto.js:44`) — no nonce reuse across saves.
- **AES-256-GCM** — authenticated encryption; tampering is detected.
- **PBKDF2 at 600k iterations** (`crypto.js:22`) — matches current OWASP guidance for PBKDF2-HMAC-SHA256. *(Verify live; I couldn't reach the cheat sheet this session.)*
- **Server-side-only Groq key** (`api/scan.js:149`, no `VITE_` prefix) — confirmed the key is **not** in the client bundle (the one `GROQ_API_KEY` string in `dist/` is user-facing error text, not key material).
- **Local QR generation** (`VaultApp.jsx:274` — dynamic `import('qrcode')`) — no third-party QR service; no medical data sent to `api.qrserver.com`.
- **`changePin` with re-salting** (`crypto.js:235-276`) — fresh salt + current KDF cost on every PIN change, with rollback on storage failure.
- **Idle auto-lock** (`VaultApp.jsx:365-390`) — 4 min warn / 5 min lock, reset on activity.
- **Serialized writes** (`VaultApp.jsx:551-553` — `persistQueueRef`) — prevents out-of-order saves.
- **Storage-failure handling** (`crypto.js:112-114, 135-137`) — `LS.set` failures propagate as `STORAGE_WRITE_FAILED` instead of being swallowed.
- **Server-side input sanitization** (`api/scan.js:110-122`) — allowlisted category, truncated strings, strict date regex.
- **No `dangerouslySetInnerHTML` anywhere** — all AI output renders as React text nodes (auto-escaped). Prompt injection can populate fields but cannot execute script.
- **Modal focus trap + Escape-to-close** (`VaultApp.jsx:215-264`) — real accessibility engineering.
- **Physical keyboard PIN entry** (`VaultApp.jsx:304-317`) — digits + Backspace, with `aria-label`s on the keypad.
- **RLS on the sync table** (`supabase_schema.sql:19-33`) — owner-only access, all four operations.
- **No sourcemaps in `dist/`** — one less artifact to leak structure.
- **`package-lock.json` committed** — reproducible installs.

---

## 8. Hypotheses to Verify (not confirmed)

- **VID-027 (Groq model name):** `qwen/qwen3.8-27b` may not be a real Groq model. Verify against https://console.groq.com/docs/models. The `.env.example` itself says "check the Groq model list."
- **Brute-force timing (VID-001):** my ~7-min GPU estimate is from prior hashcat benchmark knowledge, not a live run. Verify with a local hashcat benchmark against a real blob.
- **OWASP iteration counts:** I could not reach the live OWASP Password Storage Cheat Sheet in this session (web search unavailable). The 600k figure is from my training data (2023 update). Confirm before pinning.
- **Groq data retention:** I did not verify Groq's current retention/policy terms. If they retain API inputs, VID-003 is worse than stated.
- **`@chomuiro/saisei` contents:** I did not audit `../stock` (outside the repo). It could contain anything — treat as untrusted until reviewed.

---

## 9. Methodology & Caveats

- **Confirmed** findings are verified by reading the cited code. **Hypotheses** are labeled as such above.
- The working tree has ~1,000 lines of uncommitted changes vs. `HEAD`. I audited the **working tree** (the current state). The committed `HEAD` is weaker (100k iterations, no emergency data, no storage-failure handling, no `changePin`).
- I did not run the app, perform a live penetration test, or audit `node_modules` or `../stock`.
- Web search was unavailable in this session, so current standards (OWASP, Groq models, hashcat benchmarks) are cited from training data and flagged for live verification.
