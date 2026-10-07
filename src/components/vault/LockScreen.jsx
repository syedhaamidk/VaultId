import { useState } from 'react';
import { ShieldCheck, Sun, Moon, ChevronRight, Loader2, Check, AlertTriangle, Globe } from 'lucide-react';

/**
 * Lock screen — handles v1 (PIN keypad) and v2 (passphrase) unlock.
 */
export default function LockScreen({
  phase, dark, setDark, onBack, vaultVersion, pin, setPin, pinErr, unlockErr, unlockOk,
  lockedOut, lockRemain, pressKey, passphraseInput, setPassphraseInput, handlePassphraseSubmit,
  showPassphraseSetup, setShowPassphraseSetup, supabaseEnabled, user, authBusy,
  handleGoogleSignIn, syncErr, DEMO_MODE, DEMO_PIN, PIN_LEN,
}) {
  const [showPassphrase, setShowPassphrase] = useState(false);

  return (
    <div
      className="app"
      data-t={dark ? 'dark' : 'light'}
      style={{ height: '100vh', minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', position: 'relative', overflow: 'hidden', padding: 'max(12px, env(safe-area-inset-top)) 16px max(12px, env(safe-area-inset-bottom))' }}
    >
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 600, background: 'radial-gradient(circle, var(--acs) 0%, transparent 65%)', pointerEvents: 'none' }} />

      <button className="abic" aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} onClick={() => setDark((d) => !d)} style={{ position: 'absolute', top: 16, right: 16, background: 'var(--gl)', backdropFilter: 'blur(12px)', border: '1px solid var(--glb)', borderRadius: 10 }}>
        {dark ? <Sun size={15} /> : <Moon size={15} />}
      </button>
      {onBack && (
        <button className="abic" onClick={onBack} style={{ position: 'absolute', top: 16, left: 16, background: 'var(--gl)', backdropFilter: 'blur(12px)', border: '1px solid var(--glb)', borderRadius: 10, width: 'auto', padding: '6px 12px', gap: 5, color: 'var(--tx3)', fontSize: 12, display: 'flex', alignItems: 'center' }}>
          <ChevronRight size={13} style={{ transform: 'rotate(180deg)' }} /> Site
        </button>
      )}

      <div className="acard fl" style={{ padding: 'clamp(28px, 7vw, 44px) clamp(20px, 6vw, 52px)', textAlign: 'center', width: 'min(420px, calc(100vw - 32px))', boxShadow: 'var(--s4)' }}>
        <div style={{ position: 'relative', width: 76, height: 76, margin: '0 auto 22px' }}>
          <div className="pu" style={{ position: 'absolute', top: -12, right: -12, bottom: -12, left: -12, borderRadius: '50%', border: '2px solid var(--ac1)', opacity: 0.6 }} />
          <div style={{ width: 76, height: 76, borderRadius: '50%', background: 'var(--acs)', border: '2px solid var(--ac1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: unlockOk ? 'var(--gr)' : 'var(--act)', transition: 'color .3s' }}>
            {phase === 'unlocking' ? <Loader2 size={32} className="spin" /> : unlockOk ? <Check size={32} /> : <ShieldCheck size={32} />}
          </div>
        </div>

        <h1 className="gtext" style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.5px', margin: '0 0 5px', fontFamily: "'Space Grotesk', sans-serif" }}>VaultID</h1>
        <p style={{ fontSize: 13, color: 'var(--tx3)', margin: '0 0 28px' }}>
          {phase === 'boot' ? 'Loading…' : phase === 'unlocking' ? 'Deriving key…' : vaultVersion === 'v2' ? 'Enter passphrase to unlock' : 'Enter PIN to unlock'}
        </p>

        {/* v2: passphrase field */}
        {phase !== 'boot' && vaultVersion === 'v2' && (
          <>
            <div style={{ marginBottom: 28 }}>
              <input
                type={showPassphrase ? 'text' : 'password'}
                className="ainp"
                placeholder="Enter passphrase"
                value={passphraseInput}
                onChange={(e) => setPassphraseInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handlePassphraseSubmit(); }}
                autoComplete="current-password"
                aria-label="Passphrase"
                style={{ width: '100%', textAlign: 'center', letterSpacing: 2, fontFamily: "'JetBrains Mono', monospace" }}
              />
            </div>
            {unlockErr && <p role="alert" style={{ color: 'var(--re)', fontSize: 12, marginTop: 14, fontWeight: 500 }}>{unlockErr}</p>}
            {unlockOk && <p role="status" aria-live="polite" style={{ color: 'var(--gr)', fontSize: 12, marginTop: 14, fontWeight: 600 }}>Unlocked ✓</p>}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
              <span className="sbadge"><ShieldCheck size={10} />AES-256-GCM · Passphrase</span>
            </div>
          </>
        )}

        {/* v1: PIN keypad */}
        {phase !== 'boot' && vaultVersion === 'v1' && (
          <>
            <div
              className={pinErr ? 'shk' : ''}
              style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 28 }}
              role="status"
              aria-label={`${pin.length} of ${PIN_LEN} digits entered`}
              aria-live="polite"
            >
              {Array.from({ length: PIN_LEN }).map((_, i) => (
                <div key={i} style={{ width: 13, height: 13, borderRadius: 4, background: pin.length > i ? 'var(--ac1)' : 'var(--bd2)', transition: 'all .15s', boxShadow: pin.length > i ? '0 0 12px var(--ac1)' : undefined }} />
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 72px)', gap: 10, justifyContent: 'center' }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <button key={n} className="nk" aria-label={`Enter ${n}`} onClick={() => pressKey(String(n))}>{n}</button>
              ))}
              <div />
              <button className="nk" aria-label="Enter 0" onClick={() => pressKey('0')}>0</button>
              <button className="nk" aria-label="Delete last digit" style={{ fontSize: 16 }} onClick={() => setPin((p) => p.slice(0, -1))}>⌫</button>
            </div>

            {lockedOut && <p style={{ color: 'var(--re)', fontSize: 12, marginTop: 14, fontWeight: 600 }}>Too many attempts — try again in {lockRemain}s</p>}
            {!lockedOut && pinErr && <p style={{ color: 'var(--re)', fontSize: 12, marginTop: 14, fontWeight: 500 }}>Incorrect PIN — try again</p>}
            {!lockedOut && unlockErr && <p role="alert" style={{ color: 'var(--re)', fontSize: 12, marginTop: 14, fontWeight: 500 }}>{unlockErr}</p>}
            {unlockOk && <p role="status" aria-live="polite" style={{ color: 'var(--gr)', fontSize: 12, marginTop: 14, fontWeight: 600 }}>Unlocked ✓</p>}

            {DEMO_MODE && (
              <p style={{ color: 'var(--tx4)', fontSize: 11, marginTop: 20 }}>
                Demo PIN: <code style={{ color: 'var(--act)', fontFamily: "'JetBrains Mono', monospace" }}>{DEMO_PIN}</code>
              </p>
            )}
            {vaultVersion === 'v1' && (
              <p style={{ color: 'var(--am)', fontSize: 11, marginTop: 14, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <AlertTriangle size={12} />PIN security is limited — upgrade to a passphrase for stronger protection.
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
              <span className="sbadge"><ShieldCheck size={10} />AES-256-GCM · Groq AI</span>
            </div>
          </>
        )}

        {/* new vault: prompt to create a passphrase */}
        {phase !== 'boot' && vaultVersion === 'none' && (
          <div style={{ marginTop: 8 }}>
            <button className="abtn abp" onClick={() => setShowPassphraseSetup(true)}>
              Create Passphrase
            </button>
          </div>
        )}
      </div>

      {supabaseEnabled && (
        <div style={{ marginTop: 18, textAlign: 'center', maxWidth: 420, width: 'calc(100% - 32px)' }}>
          {user ? (
            <p style={{ color: 'var(--tx3)', fontSize: 12 }}>
              Cloud account connected: {user.email || user.user_metadata?.full_name || 'signed in'}
            </p>
          ) : (
            <button className="abtn abg" type="button" onClick={handleGoogleSignIn} disabled={authBusy}>
              {authBusy ? <Loader2 size={14} className="spin" /> : <Globe size={14} />}
              {authBusy ? 'Signing in…' : 'Sign in with Google to restore cloud vault'}
            </button>
          )}
          {syncErr && <p role="alert" style={{ color: 'var(--re)', fontSize: 11, marginTop: 8 }}>{syncErr}</p>}
        </div>
      )}
    </div>
  );
}
