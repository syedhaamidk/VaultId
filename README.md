<div align="center">

# 🔐 VaultID

**Zero-Knowledge Encrypted Document Vault**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![Web Crypto](https://img.shields.io/badge/Web_Crypto-AES--256--GCM-7B6FE8)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
[![PWA](https://img.shields.io/badge/PWA-Offline%20Ready-34D399)](https://web.dev/progressive-web-apps)

**Your documents. Your device. Your keys.**

[Live Demo](https://vault-id-pearl.vercel.app) · [Report Bug](https://github.com/syedhaamidk/VaultId/issues) · [Request Feature](https://github.com/syedhaamidk/VaultId/issues)

</div>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔐 **AES-256-GCM** | Military-grade encryption, keys derived locally with PBKDF2 (600k iterations) |
| 🧠 **AI Document Scan** | On-device OCR (Tesseract.js) or Groq AI — your choice, your privacy |
| 🔑 **Zero-Knowledge** | Your documents are encrypted on your device. We never see your plaintext. |
| 📱 **PWA** | Installable, offline-ready, works like a native app |
| 🔄 **Cloud Sync** | Optional Supabase sync — only encrypted bytes leave your device |
| 📋 **Document Versioning** | Every edit is versioned. Restore any previous version. |
| 🚨 **Emergency Card** | Medical ID with QR code, generated locally — no third-party QR service |
| 📊 **Audit Log** | Track every unlock, edit, and delete — stored inside your encrypted vault |
| 🔗 **Secure Sharing** | Encrypted, expiring share links for documents |
| 🇮🇳 **India-Ready** | Aadhaar (Verhoeff checksum) and PAN validation built in |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Your Device                            │
│                                                             │
│  ┌─────────────┐    PBKDF2     ┌──────────────┐            │
│  │  PIN /      │──────────────►│  KEK         │            │
│  │  Passphrase │               │  (wraps DEK) │            │
│  └─────────────┘               └──────┬───────┘            │
│                                       │                    │
│                              ┌────────▼────────┐           │
│                              │  DEK (AES-256)  │           │
│                              │  unwraps non-   │           │
│                              │  extractable    │           │
│                              └────────┬────────┘           │
│                                       │                    │
│  ┌─────────────┐    AES-256-GCM    ┌──▼──────────────┐    │
│  │  Documents  │◄──────────────────│  Encrypted      │    │
│  │  Images     │                   │  Vault Blob     │    │
│  │  Emergency  │                   │  {v,rev,slots,  │    │
│  └─────────────┘                   │   data}         │    │
│                                    └────────┬────────┘    │
│                                             │              │
│  ┌─────────────┐                           │              │
│  │ localStorage│◄──────────────────────────┘              │
│  │ (encrypted) │                                          │
│  └─────────────┘                                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ (optional sync — encrypted blob only)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase (optional)                       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  vaults table: { user_id, salt, iv, ciphertext }    │   │
│  │  RLS: owner-only                                    │   │
│  │  Server sees ONLY encrypted bytes — never plaintext  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔒 Security Model

| Layer | What | Where |
|-------|------|-------|
| **Encryption** | AES-256-GCM | Client-side (Web Crypto API) |
| **Key Derivation** | PBKDF2-SHA256, 600k iterations | Client-side |
| **Key Storage** | Non-extractable CryptoKey | Session memory only |
| **Data Storage** | Encrypted blob in localStorage | Your device |
| **Cloud Sync** | Encrypted blob only | Supabase (optional) |
| **AI Scanning** | On-device (Tesseract.js) or Groq AI | Your choice |
| **Server Access** | None — zero-knowledge | We cannot decrypt your vault |

> **Your documents are encrypted on your device before they are stored or synced. We never see your plaintext — only encrypted bytes.**

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20.19+ or 22.12+
- npm

### Install & Run

```bash
git clone https://github.com/syedhaamidk/VaultId.git
cd VaultId
npm install
cp .env.example .env    # add GROQ_API_KEY (server-side)
npm run dev
```

### Build for Production

```bash
npm run build
npm run preview
```

### Run Tests

```bash
npm test
```

---

## 🔧 Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | Yes (for AI scan) | Server-side Groq API key. Never bundled into client. |
| `VITE_SUPABASE_URL` | No | Supabase project URL (enables cloud sync). |
| `VITE_SUPABASE_ANON_KEY` | No | Supabase anon key (enables cloud sync). |
| `VITE_DEMO_MODE` | No | Set to `true` to show demo PIN hint. Default: `false`. |
| `GROQ_VISION_MODEL` | No | Override the Groq vision model. |
| `APP_ORIGIN` | No | Comma-separated allowed origins for /api/scan. |

---

## 📁 Project Structure

```
src/
├── main.jsx               # Entry point, SW registration
├── App.jsx                # Route: landing ↔ vault ↔ privacy
├── crypto.js              # AES-256-GCM, PBKDF2, v2 vault format, key wrapping
├── sync.js                # Supabase auth + encrypted blob sync + conflict matrix
├── supabaseClient.js      # Supabase client singleton
├── data.js                # Constants, demo data, feature cards
├── utils.jsx              # Badge, TiltCard, DocForm, compressImage
├── index.css              # Theme tokens, animations, mobile/PWA styles
├── components/
│   ├── SideRays.jsx       # WebGL god-ray effect (Three.js)
│   ├── CardNav.jsx        # GSAP-animated navigation
│   ├── PassphraseSetup.jsx # Passphrase creation modal
│   └── vault/
│       ├── LockScreen.jsx # v1 PIN keypad + v2 passphrase field
│       ├── Sidebar.jsx    # Navigation, categories, sync, export/import
│       ├── DocumentCard.jsx # Document grid card
│       ├── DocumentModal.jsx # Document detail view
│       └── Modals.jsx     # Add, Emergency, ChangePin, Upgrade, ScanConsent, AuditLog
├── pages/
│   ├── LandingPage.jsx    # Marketing site
│   ├── VaultApp.jsx       # Main vault application
│   └── PrivacyPolicy.jsx  # Privacy policy page
├── utils/
│   ├── passphraseStrength.js  # Shannon entropy strength meter
│   ├── passphraseValidation.js # Pure validation logic
│   ├── documentValidation.js   # Aadhaar (Verhoeff) + PAN validation
│   ├── onDeviceScan.js         # Tesseract.js OCR
│   ├── useLowEndDevice.js      # Low-end device detection
│   └── usePwaInstall.js        # PWA install prompt hook
└── __fixtures__/
    ├── vault-v1-100k.json  # Frozen v1 test fixture (100k iterations)
    └── vault-v1-600k.json  # Frozen v1 test fixture (600k iterations)

api/
└── scan.js                # Serverless Groq proxy (authenticated, rate-limited)

public/
├── manifest.json          # PWA manifest
├── sw.js                  # Service worker (offline support)
├── icon.svg               # App icon
└── offline.html           # Offline fallback page
```

---

## 🧪 Testing

```bash
npm test          # Run all tests (Vitest)
```

**74 tests** covering:
- Crypto round-trip, wrong key, tamper detection, IV uniqueness
- v1 → v2 migration, changePassphrase, recovery slot, storage failure
- NFKC equivalence, slot removal, version detection
- Sync guard, conflict matrix, v1/v2 push/pull
- Passphrase validation, strength estimation
- Aadhaar (Verhoeff) and PAN validation

---

## 📱 PWA

VaultID is a Progressive Web App:

- **Installable** — "Install App" button appears when supported
- **Offline-ready** — service worker caches the app shell
- **Responsive** — mobile bottom nav, safe-area insets, 44×44px touch targets
- **Reduced motion** — respects `prefers-reduced-motion`

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**🔐 Your documents. Your device. Your keys.**

Built with [React](https://react.dev) · [Vite](https://vite.dev) · [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)

</div>
