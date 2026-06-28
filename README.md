# VaultID

Military-grade encrypted document vault built with React + Vite.

## Stack

| Layer | Tech |
|---|---|
| Framework | React 18 + Vite 5 |
| Encryption | AES-256-GCM · PBKDF2 100k iterations · Web Crypto API |
| Storage | localStorage (encrypted blob only) |
| AI Scanning | Anthropic Claude (claude-sonnet-4-6) |
| 3D Effects | Three.js WebGL (SideRays shader) |
| Nav animation | GSAP (CardNav) |
| Icons | Lucide React |

## Architecture

```
┌─────────────────────────────────────┐
│          Browser (client only)       │
│                                     │
│  PIN ──► PBKDF2 ──► AES-256 key    │
│                          │          │
│  Documents ──► encrypt ──► localStorage
│                                     │
│  Key lives only in session memory   │
└─────────────────────────────────────┘
```

Zero-knowledge: the server never receives plaintext documents or your PIN.

## Quick start

```bash
git clone ...
cd vaultid
npm install
cp .env.example .env        # add your Anthropic API key
npm run dev
```

## Project structure

```
src/
├── main.jsx                # React entry
├── App.jsx                 # Page router (landing ↔ vault)
├── index.css               # Global styles, CSS vars, animations
├── crypto.js               # AES-256-GCM, PBKDF2, localStorage vault
├── data.js                 # Constants, demo docs, emergency info
├── utils.jsx               # Badge, TiltCard, DocForm components
├── components/
│   ├── BorderGlow.jsx/.css # Mouse-tracking edge glow cards
│   ├── CardNav.jsx/.css    # GSAP-animated hamburger nav
│   └── SideRays.jsx/.css   # Three.js WebGL god-ray effect
└── pages/
    ├── LandingPage.jsx     # Marketing site
    └── VaultApp.jsx        # Full encrypted vault application
```

## Security notes

- PIN is **never stored** anywhere. It drives PBKDF2 to derive the AES key, which lives only in React state.
- Wrong PIN → wrong key → AES-GCM auth tag fails → graceful error.
- Document images are stored as base64 inside the encrypted blob.
- For production, route Anthropic API calls through a backend endpoint.

## Adding Supabase sync

1. Create a `vault_blobs` table with columns `(user_id, encrypted_blob, updated_at)`.
2. After every `saveVault()` call, upsert the encrypted string to Supabase.
3. On first unlock, check Supabase for an existing blob before creating a new vault.
4. The server only ever sees `{ iv, ct }` — never plaintext.

## PWA

Add a `public/manifest.json` and register a service worker in `main.jsx` to enable "Add to Home Screen" and offline support.
