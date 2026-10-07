import { X, Share, Plus, Check, MoreVertical, Download, Globe } from 'lucide-react';

/**
 * InstallHelpSheet — manual install instructions for platforms where the
 * native beforeinstallprompt is unavailable (iOS Safari, dismissed prompts,
 * Firefox, Safari desktop). Bottom-sheet styled to match the VaultID dark
 * UI. On Chromium with a pending prompt, the UI calls promptInstall()
 * directly and this sheet never appears.
 */
const STEPS = {
  ios: [
    { Ic: Share, t: 'Tap the Share button', d: 'The square-with-arrow icon in Safari’s toolbar.' },
    { Ic: Plus, t: 'Tap “Add to Home Screen”', d: 'Scroll the share sheet down a little to find it.' },
    { Ic: Check, t: 'Tap “Add”', d: 'VaultID appears on your Home Screen like a native app.' },
  ],
  android: [
    { Ic: MoreVertical, t: 'Open the browser menu', d: 'The ⋮ icon at the top corner of Chrome.' },
    { Ic: Download, t: 'Tap “Install app”', d: 'On some versions it says “Add to Home screen” instead.' },
    { Ic: Check, t: 'Confirm Install', d: 'VaultID installs as a real app — offline-capable, full-screen.' },
  ],
  desktop: [
    { Ic: Download, t: 'Click the install icon', d: 'Look for the monitor-and-arrow icon at the right of the address bar.' },
    { Ic: MoreVertical, t: 'Or use the browser menu', d: '⋮ → “Install VaultID…” (Edge: Apps → Install this site as an app).' },
    { Ic: Check, t: 'Click Install', d: 'VaultID gets its own window and taskbar/dock icon.' },
  ],
  other: [
    { Ic: Globe, t: 'Use an install-capable browser', d: 'Open this page in Chrome or Edge (any device) or Safari (iPhone/iPad).' },
    { Ic: Download, t: 'Tap “Install App”', d: 'The button appears in the hero section and triggers a true install.' },
    { Ic: Check, t: 'Works fully offline', d: 'Once installed, your encrypted vault opens even with no connection.' },
  ],
};

export default function InstallHelpSheet({ open, onClose, platform = 'desktop' }) {
  if (!open) return null;
  const steps = STEPS[platform] || STEPS.other;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="How to install VaultID"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(4,4,10,.72)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: 16, paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
      }}
    >
      <div
        className="si"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420, background: 'var(--sur, #11111F)',
          border: '1px solid var(--bd, #252540)', borderRadius: 20,
          padding: '20px 20px 16px', color: 'var(--tx, #EEEEFF)',
          fontFamily: "'Inter', sans-serif",
          boxShadow: '0 24px 64px rgba(0,0,0,.8)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <img src="/icon-192.png" alt="" width={44} height={44} style={{ borderRadius: 12 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 16, fontFamily: "'Space Grotesk', sans-serif" }}>
              Install VaultID
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--tx2, #AAAACC)' }}>
              A real install — own window, offline support, no browser chrome.
            </div>
          </div>
          <button
            type="button" onClick={onClose} aria-label="Close install instructions"
            style={{ background: 'none', border: 'none', color: 'var(--tx3, #666690)', cursor: 'pointer', padding: 6 }}
          >
            <X size={18} />
          </button>
        </div>
        <ol style={{ margin: '12px 0 4px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {steps.map(({ Ic, t, d }, i) => (
            <li key={t} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{
                width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(123,111,232,.14)', border: '1px solid rgba(123,111,232,.35)',
                color: '#B0A8FF',
              }}>
                <Ic size={15} />
              </span>
              <span>
                <span style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>{i + 1}. {t}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--tx2, #AAAACC)', marginTop: 2 }}>{d}</span>
              </span>
            </li>
          ))}
        </ol>
        <button
          type="button" onClick={onClose}
          style={{
            width: '100%', marginTop: 14, padding: '12px 0', border: 'none', borderRadius: 10,
            background: 'linear-gradient(135deg,#7B6FE8,#C060F0)', color: '#fff',
            fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
