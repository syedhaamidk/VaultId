import { lazy, Suspense, useState } from 'react';
import { Shield, Sparkles, Zap, Clock, Globe, Lock, ShieldCheck, Download } from 'lucide-react';
import CardNav from '../components/CardNav.jsx';
import { Button, Card, Badge, TiltCard, Reveal } from '@chomuiro/saisei/react';
import { useLowEndDevice } from '../utils/useLowEndDevice.js';
import { usePwaInstall } from '../utils/usePwaInstall.js';
import IosInstallSheet from '../components/IosInstallSheet.jsx';

const SideRays = lazy(() => import('../components/SideRays.jsx'));
import { NAV_ITEMS, FEATS } from '../data.js';

// Map iconName strings from data.js → lucide-react components
const ICON_MAP = { Shield, Sparkles, Zap, Clock, Globe, Lock };

// Logo element passed to CardNav
const NavLogo = (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <div style={{
      width: 26, height: 26, borderRadius: 8,
      background: 'linear-gradient(135deg,#7B6FE8,#C060F0)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <ShieldCheck size={15} color="#fff" />
    </div>
    <span style={{
      fontWeight: 700, fontSize: 15, color: '#EEEEFF',
      fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-.3px',
    }}>
      VaultID
    </span>
  </div>
);

export default function LandingPage({ onEnterVault, onPrivacy }) {
  const isLowEnd = useLowEndDevice();
  const { canInstall, installed, isIos, promptInstall } = usePwaInstall();
  const [iosHint, setIosHint] = useState(false);
  // Chromium/Android: native install prompt. iOS Safari: manual instructions.
  const showInstall = (canInstall || isIos) && !installed;
  const onInstallClick = () => {
    if (canInstall) promptInstall();
    else setIosHint(true);
  };

  return (
    <div className="site" style={{ minHeight: '100vh' }}>

      {/* ── Navigation (custom GSAP nav — kept, Saisei has no animated nav) ─── */}
      <CardNav
        logo={NavLogo}
        items={NAV_ITEMS}
        onCTA={onEnterVault}
        ease="power3.out"
      />

      {/* ── Hero (WebGL backdrop, CSS fallback for low-end devices) ────────── */}
      <section className="hero">
        {isLowEnd ? (
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse at top right, rgba(123,111,232,.25) 0%, transparent 60%), radial-gradient(ellipse at bottom left, rgba(59,130,246,.15) 0%, transparent 60%)',
          }} />
        ) : (
          <Suspense fallback={null}>
            {/* Primary god-ray (top-right, purple/indigo) */}
            <SideRays
              rayColor1="#7B6FE8" rayColor2="#C060F0"
              intensity={2.4} spread={2.4} opacity={0.85}
              origin="top-right"
            />
            {/* Secondary accent ray (bottom-left, teal) */}
            <SideRays
              rayColor1="#3B82F6" rayColor2="#34D399"
              intensity={1.4} spread={1.8} opacity={0.4}
              origin="bottom-left"
            />
          </Suspense>
        )}

        <div className="hero-content">
          <Badge tone="accent"><Shield size={12} /> AES-256-GCM · Zero-Knowledge · On-Device AI</Badge>

          <h1>
            Store every document.<br />
            <span className="gtext">Encrypted. Instant.</span>
          </h1>

          <p>
            Your Aadhar, passport, medical records, and insurance — encrypted on
            your device with AES-256-GCM. We never see your plaintext. Your data
            stays yours.
          </p>

          <div className="hero-btns">
            <Button variant="primary" onClick={onEnterVault}>
              Open Your Vault →
            </Button>
            <Button
              variant="ghost"
              onClick={() => document.querySelector('.feat-section')?.scrollIntoView({ behavior: 'smooth' })}
            >
              See How It Works
            </Button>
            {showInstall && (
              <Button
                variant="ghost"
                onClick={onInstallClick}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Download size={14} />Install App
              </Button>
            )}
          </div>
        </div>
      </section>
      <IosInstallSheet open={iosHint} onClose={() => setIosHint(false)} />

      {/* ── Stats bar ───────────────────────────────────────────────────────── */}
      <div className="stat-bar" id="security">
        {[
          { Ic: Shield,   t: 'AES-256-GCM Encryption'   },
          { Ic: Lock,     t: 'PBKDF2 · 600k Iterations' },
          { Ic: Zap,      t: 'Zero-Knowledge Arch'       },
          { Ic: Sparkles, t: 'AI Document Scanning'      },
        ].map(({ Ic, t }) => (
          <Badge key={t}><Ic size={12} /> {t}</Badge>
        ))}
      </div>

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <div className="feat-section" id="features">
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <span className="sheet-label" style={{ textAlign: 'center' }}>Why VaultID</span>
          <h2 className="section-title">
            Everything you need.<br />
            <span className="gtext">Nothing you don't.</span>
          </h2>
          <p className="section-sub" style={{ maxWidth: 540, margin: '16px auto 0', textAlign: 'center' }}>
            Built for people who take their documents seriously — with the
            security of a password manager and the simplicity of a notes app.
          </p>
        </div>

        <div className="feat-grid">
          {FEATS.map(({ iconName, title, desc, col }, i) => {
            const Ic = ICON_MAP[iconName] ?? Shield;
            return (
              <Reveal key={title} delay={i * 80}>
                <TiltCard max={6}>
                  <Card tag={`// FEAT-0${i + 1}`} title={title} corners>
                    <div className="avatar" style={{
                      width: 44, height: 44, background: `${col}18`,
                      borderColor: `${col}55`, color: col, marginBottom: 18,
                    }}>
                      <Ic size={22} />
                    </div>
                    <p className="text-soft text-sm" style={{ margin: 0 }}>{desc}</p>
                  </Card>
                </TiltCard>
              </Reveal>
            );
          })}
        </div>
      </div>

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <div className="how-section" id="how-it-works">
        <div className="how-inner">
          <span className="sheet-label">How It Works</span>
          <h2 className="section-title">
            Three steps to a<br />
            <span className="gtext">secure vault.</span>
          </h2>
          <div className="how-steps">
            {[
              { n: '01', t: 'Set your PIN',        d: 'Your PIN drives PBKDF2 to derive an AES-256 key. It never leaves your device — not even in memory after you lock.',          col: '#7B6FE8' },
              { n: '02', t: 'Add documents',       d: "Upload a photo — scan on-device (your image never leaves this device) or with Groq AI for faster, more accurate extraction.", col: '#C060F0' },
              { n: '03', t: 'Access anywhere',     d: 'Encrypted vault loads on any device. Optionally sync via Supabase — zero-knowledge, because the server only sees ciphertext.', col: '#34D399' },
            ].map(({ n, t, d, col }, i) => (
              <Reveal key={n} delay={i * 100}>
                <div className="how-step">
                  <div className="how-num" style={{ color: `${col}40` }}>{n}</div>
                  <h4>{t}</h4>
                  <p>{d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <div className="cta-section">
        <Reveal>
          <div className="cta-icon gbg">
            <ShieldCheck size={30} color="#fff" />
          </div>
          <h2>
            Ready to secure your<br />
            <span className="gtext">documents?</span>
          </h2>
          <p>
            Start today — it's free, local-first, and takes under a minute to set up.
          </p>
          <Button variant="primary" onClick={onEnterVault}>
            Open Your Vault — It's Free →
          </Button>
        </Reveal>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="site-footer">
        <div className="footer-logo">
          <div className="footer-logo-icon gbg">
            <ShieldCheck size={13} color="#fff" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#EEEEFF', fontFamily: "'Space Grotesk', sans-serif" }}>
            VaultID
          </span>
        </div>
        <p>AES-256-GCM encrypted · Zero-knowledge · Privacy by design</p>
        <p style={{ fontSize: 12, color: '#AAAACC', maxWidth: 480, margin: '8px auto 0', lineHeight: 1.6 }}>
          Your documents are encrypted on your device before they are stored or synced.
          We never see your plaintext — only encrypted bytes. Your PIN or passphrase
          never leaves your device. Prefer full privacy? Scan on-device and your
          images never leave this device either.
        </p>
        <p>
          <Badge>Built with Saisei</Badge>
        </p>
        <p style={{ marginTop: 8, color: '#252540' }}>
          © 2026 VaultID · Your data stays yours.
        </p>
        {onPrivacy && (
          <p style={{ marginTop: 4 }}>
            <button
              type="button"
              onClick={onPrivacy}
              style={{ background: 'none', border: 'none', color: '#7B6FE8', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
            >
              Privacy Policy
            </button>
          </p>
        )}
      </footer>
    </div>
  );
}
