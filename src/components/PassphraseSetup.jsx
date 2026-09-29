import { useState, useEffect, useCallback } from 'react';
import { Eye, EyeOff, Download, Check, AlertTriangle } from 'lucide-react';
import { validatePassphrase, MIN_PASSPHRASE_LENGTH } from '../utils/passphraseValidation.js';

/**
 * Passphrase setup for NEW v2 vaults.
 *
 * Validation: min 12 chars (after NFKC), confirm must match, mandatory
 * acknowledgement checkbox. The Create button stays disabled until all
 * pass. The strength meter warns but does not block.
 *
 * The passphrase is held in component state only as long as needed and
 * cleared immediately after creation. It is never logged or persisted.
 */
export default function PassphraseSetup({ onCreate, onCancel }) {
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [strength, setStrength] = useState(null);

  // Recovery key state.
  const [recoveryKey, setRecoveryKey] = useState(null);
  const [recoveryConfirmed, setRecoveryConfirmed] = useState(false);

  // Lazy-load the strength meter (code-split by Vite).
  useEffect(() => {
    if (!passphrase) { setStrength(null); return; }
    let cancelled = false;
    import('../utils/passphraseStrength.js').then((mod) => {
      if (!cancelled) setStrength(mod.estimateStrength(passphrase));
    });
    return () => { cancelled = true; };
  }, [passphrase]);

  // ── Validation ─────────────────────────────────────────────────────────────
  const { errors } = validatePassphrase(passphrase, confirm, acknowledged);
  const isValid = errors.length === 0 && passphrase.length > 0 && acknowledged;

  // ── Recovery key ──────────────────────────────────────────────────────────
  const generateRecoveryKey = useCallback(() => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    setRecoveryKey(btoa(binary));
    setRecoveryConfirmed(false);
  }, []);

  const downloadRecoveryKey = useCallback(() => {
    if (!recoveryKey) return;
    const blob = new Blob([recoveryKey], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vaultid-recovery-key.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [recoveryKey]);

  // ── Create ────────────────────────────────────────────────────────────────
  const handleCreate = useCallback(() => {
    if (!isValid) return;
    // Clear sensitive fields immediately after capturing the value.
    const pp = passphrase;
    setPassphrase('');
    setConfirm('');
    setShowPassphrase(false);
    onCreate(pp, recoveryKey);
  }, [isValid, passphrase, recoveryKey, onCreate]);

  // ── Render ────────────────────────────────────────────────────────────────
  const lbl = {
    fontSize: 11.5, fontWeight: 700, color: 'var(--tx3)',
    display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.6px',
  };

  const strengthColors = ['#F87171', '#FBBF24', '#FBBF24', '#34D399', '#10B981'];
  const strengthWidths = ['20%', '40%', '60%', '80%', '100%'];

  return (
    <div className="mbg" onClick={onCancel}>
      <div
        className="mbox si"
        role="dialog"
        aria-modal="true"
        aria-label="Create passphrase"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--tx)', fontFamily: "'Space Grotesk', sans-serif" }}>
            Create Passphrase
          </h3>
          <button className="abic" aria-label="Close" onClick={onCancel}><span aria-hidden="true">×</span></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Passphrase */}
          <div>
            <label htmlFor="pp-pass" style={lbl}>Passphrase (min {MIN_PASSPHRASE_LENGTH} characters)</label>
            <div style={{ position: 'relative' }}>
              <input
                id="pp-pass"
                className="ainp"
                type={showPassphrase ? 'text' : 'password'}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                autoComplete="new-password"
                aria-describedby="pp-strength pp-errors"
                style={{ width: '100%', paddingRight: 40 }}
              />
              <button
                type="button"
                className="abic"
                aria-label={showPassphrase ? 'Hide passphrase' : 'Show passphrase'}
                aria-pressed={showPassphrase}
                onClick={() => setShowPassphrase((s) => !s)}
                style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)' }}
              >
                {showPassphrase ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Strength meter */}
            {strength && (
              <div id="pp-strength" style={{ marginTop: 6 }} aria-live="polite">
                <div style={{ height: 4, borderRadius: 2, background: 'var(--bd)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: strengthWidths[strength.score],
                    background: strengthColors[strength.score],
                    transition: 'width .2s',
                  }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: strengthColors[strength.score], fontWeight: 600 }}>{strength.label}</span>
                  <span>({strength.entropy} bits)</span>
                  {strength.warnings.map((w, i) => (
                    <span key={i} style={{ color: 'var(--am)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <AlertTriangle size={11} />{w}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Confirm */}
          <div>
            <label htmlFor="pp-confirm" style={lbl}>Confirm Passphrase</label>
            <input
              id="pp-confirm"
              className="ainp"
              type={showPassphrase ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              aria-describedby="pp-errors"
              style={{ width: '100%' }}
            />
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div id="pp-errors" role="alert" style={{ fontSize: 12, color: 'var(--re)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {errors.map((e, i) => <span key={i}>{e}</span>)}
            </div>
          )}

          {/* Acknowledgement */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <input
              id="pp-ack"
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              style={{ marginTop: 2 }}
            />
            <label htmlFor="pp-ack" style={{ fontSize: 13, color: 'var(--tx2)', lineHeight: 1.5 }}>
              I understand that forgetting my passphrase means{' '}
              <strong>permanent data loss</strong>, unless I saved a recovery key.
              There is no way to recover a forgotten passphrase.
            </label>
          </div>

          {/* Recovery key (optional) */}
          <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.6px' }}>
                Recovery Key (optional)
              </span>
              {!recoveryKey && (
                <button type="button" className="abtn abg" style={{ fontSize: 12, padding: '4px 10px' }} onClick={generateRecoveryKey}>
                  Generate
                </button>
              )}
            </div>

            {recoveryKey && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{
                  background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 8,
                  padding: '10px 12px', fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
                  color: 'var(--tx2)', wordBreak: 'break-all', userSelect: 'all',
                }}>
                  {recoveryKey}
                </div>
                <div style={{ fontSize: 11, color: 'var(--am)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertTriangle size={12} />
                  Show only once. Save it somewhere safe — it cannot be recovered.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="abtn abg" style={{ fontSize: 12, padding: '4px 10px' }} onClick={downloadRecoveryKey}>
                    <Download size={13} />Download
                  </button>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--tx3)' }}>
                    <input
                      type="checkbox"
                      checked={recoveryConfirmed}
                      onChange={(e) => setRecoveryConfirmed(e.target.checked)}
                    />
                    I saved my recovery key
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 8, paddingTop: 16, borderTop: '1px solid var(--bd)', justifyContent: 'flex-end' }}>
            <button type="button" className="abtn abg" onClick={onCancel}>Cancel</button>
            <button
              type="button"
              className="abtn abp"
              onClick={handleCreate}
              disabled={!isValid}
              style={{ opacity: isValid ? 1 : 0.5, cursor: isValid ? 'pointer' : 'not-allowed' }}
            >
              <Check size={14} />Create Vault
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
