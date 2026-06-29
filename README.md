# VaultID

Military-grade encrypted document vault built with React + Vite.

## Stack

| Layer | Tech |
|---|---|
| Framework | React 18 + Vite 5 |
| Encryption | AES-256-GCM · PBKDF2 100k iterations · Web Crypto API |
| Storage | localStorage (encrypted blob only), optional Supabase sync |
| Auth | Google OAuth via Supabase Auth (optional) |
| AI Scanning | Groq vision model, proxied server-side via `api/scan.js` |
| 3D Effects | Three.js WebGL (SideRays shader) |
| Nav animation | GSAP (CardNav) |
| Icons | Lucide React |

## Architecture

```
┌─────────────────────────────────────┐      ┌──────────────────┐
│          Browser (client)            │      │  api/scan.js      │
│                                     │      │  (serverless)      │
│  PIN ──► PBKDF2 ──► AES-256 key    │      │                    │
│                          │          │      │  GROQ_API_KEY      │
│  Documents ──► encrypt ──► localStorage     │  lives here only  │
│                          │          │      └─────────┬──────────┘
│  image ──────────────────┼──────────┼────────────────┘
│  (key lives only in session memory) │     forwards to Groq,
└──────────────┬──────────────────────┘     returns parsed fields
               │ (signed in only)
               ▼
      encrypted blob {iv, salt, ciphertext}
               │
               ▼
        Supabase Postgres (RLS: owner-only)
```

Zero-knowledge: the server never receives plaintext documents or your PIN — only AES-256-GCM ciphertext (for sync) and the raw image for AI scanning (which the proxy forwards to Groq but never persists).

## Quick start

```bash
git clone ...
cd vaultid
npm install
cp .env.example .env        # add GROQ_API_KEY (server-side) and, optionally, Supabase config
npm run dev                 # for full local testing of /api/scan.js, use `vercel dev` instead
```

## Project structure

```
src/
├── main.jsx                # React entry
├── App.jsx                 # Page router (landing ↔ vault)
├── index.css               # Global styles, CSS vars, animations
├── crypto.js               # AES-256-GCM, PBKDF2, localStorage vault, remote-unlock helpers
├── sync.js                 # Google auth + encrypted vault push/pull (Supabase)
├── supabaseClient.js       # Supabase client singleton (no-ops if unconfigured)
├── data.js                 # Constants, demo docs, emergency info
├── utils.jsx               # Badge, TiltCard, DocForm components
├── components/
│   ├── BorderGlow.jsx/.css # Mouse-tracking edge glow cards
│   ├── CardNav.jsx/.css    # GSAP-animated hamburger nav
│   └── SideRays.jsx/.css   # Three.js WebGL god-ray effect
└── pages/
    ├── LandingPage.jsx     # Marketing site
    └── VaultApp.jsx        # Full encrypted vault application

api/
└── scan.js                 # Serverless proxy — holds GROQ_API_KEY server-side,
                             # client never sees the key or calls Groq directly

supabase_schema.sql          # Table + RLS policies for encrypted vault sync
```

## Security notes

- PIN is **never stored** anywhere. It drives PBKDF2 to derive the AES key, which lives only in React state.
- Wrong PIN → wrong key → AES-GCM auth tag fails → graceful error.
- Document images are stored as base64 inside the encrypted blob.
- The Groq API key is **server-side only** (`GROQ_API_KEY`, no `VITE_` prefix) — see `api/scan.js`. It is never bundled into client JS.
- Google sign-in (via Supabase Auth) only ever establishes identity for Row-Level-Security purposes — it never participates in encryption. Supabase only ever stores `{iv, salt, ciphertext}`.

## PWA

Add a `public/manifest.json` and register a service worker in `main.jsx` to enable "Add to Home Screen" and offline support.
