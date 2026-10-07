import { X, Share, PlusSquare, Check } from 'lucide-react';

/**
 * IosInstallSheet — manual install instructions for iOS Safari, which has
 * no beforeinstallprompt event. Bottom-sheet styled to match the VaultID
 * dark UI (same surfaces, borders, gradient CTA as the rest of the app).
 */
export default function IosInstallSheet({ open, onClose }) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Install VaultID on iPhone"
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
              Add it to your Home Screen — works offline, opens full-screen.
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
          {[
            { Ic: Share, t: 'Tap the Share button', d: 'The square-with-arrow icon in Safari’s toolbar.' },
            { Ic: PlusSquare, t: 'Tap “Add to Home Screen”', d: 'Scroll the share sheet down a little to find it.' },
            { Ic: Check, t: 'Tap “Add”', d: 'VaultID appears on your Home Screen like a native app.' },
          ].map(({ Ic, t, d }, i) => (
            <li key={t} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{
                width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(123,111,232,.14)', border: '1px solid rgba(123,111,232,.35)',
                color: '#B0A8FF', fontWeight: 700, fontSize: 13,
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
