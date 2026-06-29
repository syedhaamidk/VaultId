import { Shield, Sparkles, Zap, Clock, Globe, Lock, ShieldCheck } from 'lucide-react';
import CardNav    from '../components/CardNav.jsx';
import SideRays   from '../components/SideRays.jsx';
import BorderGlow from '../components/BorderGlow.jsx';
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

export default function LandingPage({ onEnterVault }) {
  return (
    <div className="site" style={{ minHeight: '100vh' }}>

      {/* ── Navigation ──────────────────────────────────────────────────────── */}
      <CardNav
        logo={NavLogo}
        items={NAV_ITEMS}
        onCTA={onEnterVault}
        ease="power3.out"
      />

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="hero">
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

        <div className="hero-content">
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(123,111,232,.14)',
            border: '1px solid rgba(123,111,232,.3)',
            borderRadius: 30, padding: '6px 14px',
            fontSize: 12, fontWeight: 600, color: '#B0A8FF', marginBottom: 24,
          }}>
            <Shield size={12} />
            AES-256-GCM · Zero-Knowledge · AI-Powered
          </div>

          <h1>
            Store every document.<br />
            <span className="gtext">Encrypted. Instant.</span>
          </h1>

          <p>
            Your Aadhar, passport, medical records, and insurance — secured with
            military-grade encryption and accessible the moment you need them.
          </p>

          <div className="hero-btns">
            <button className="land-btn-primary" onClick={onEnterVault}>
              Open Your Vault →
            </button>
            <button
              className="land-btn-ghost"
              onClick={() => document.querySelector('.feat-section')?.scrollIntoView({ behavior: 'smooth' })}
            >
              See How It Works
            </button>
          </div>
        </div>
      </section>

      {/* ── Stats bar ───────────────────────────────────────────────────────── */}
      <div className="stat-bar">
        {[
          { Ic: Shield,   t: 'AES-256-GCM Encryption'   },
          { Ic: Lock,     t: 'PBKDF2 · 100k Iterations' },
          { Ic: Zap,      t: 'Zero-Knowledge Arch'       },
          { Ic: Sparkles, t: 'AI Document Scanning'      },
        ].map(({ Ic, t }) => (
          <div key={t} className="stat-item">
            <Ic size={14} />{t}
          </div>
        ))}
      </div>

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <div className="feat-section">
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <p className="section-label">Why VaultID</p>
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
          {FEATS.map(({ iconName, title, desc, col, cols, glow }) => {
            const Ic = ICON_MAP[iconName] ?? Shield;
            return (
              <BorderGlow
                key={title}
                glowColor={glow}
                colors={cols}
                backgroundColor="#0F0F1C"
                borderRadius={20}
                glowRadius={44}
                glowIntensity={1.1}
                fillOpacity={0.4}
              >
                <div style={{ padding: 28 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: `${col}18`, border: `1px solid ${col}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: col, marginBottom: 18,
                  }}>
                    <Ic size={22} />
                  </div>
                  <h3 style={{
                    margin: '0 0 10px', fontSize: 17, fontWeight: 700,
                    color: '#EEEEFF', fontFamily: "'Space Grotesk', sans-serif",
                    letterSpacing: '-.3px',
                  }}>
                    {title}
                  </h3>
                  <p style={{ margin: 0, fontSize: 13.5, color: '#7878A0', lineHeight: 1.65 }}>
                    {desc}
                  </p>
                </div>
              </BorderGlow>
            );
          })}
        </div>
      </div>

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <div className="how-section">
        <div className="how-inner">
          <p className="section-label">How It Works</p>
          <h2 className="section-title">
            Three steps to a<br />
            <span className="gtext">secure vault.</span>
          </h2>
          <div className="how-steps">
            {[
              { n: '01', t: 'Set your PIN',        d: 'Your PIN drives PBKDF2 to derive an AES-256 key. It never leaves your device — not even in memory after you lock.',          col: '#7B6FE8' },
              { n: '02', t: 'Add documents',       d: "Drop a photo or PDF — Claude's AI reads it and extracts the document type, number, issuer, and expiry dates instantly.",      col: '#C060F0' },
              { n: '03', t: 'Access anywhere',     d: 'Encrypted vault loads on any device. Optionally sync via Supabase — zero-knowledge, because the server only sees ciphertext.', col: '#34D399' },
            ].map(({ n, t, d, col }) => (
              <div key={n} className="how-step">
                <div className="how-num" style={{ color: `${col}40` }}>{n}</div>
                <h4>{t}</h4>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <div className="cta-section">
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
        <button className="land-btn-primary" onClick={onEnterVault}>
          Open Your Vault — It's Free →
        </button>
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
        <p style={{ marginTop: 8, color: '#252540' }}>
          © 2026 VaultID · Your data never leaves your device without your permission.
        </p>
      </footer>
    </div>
  );
}
