import { X, Check, AlertTriangle, Shield, Sparkles, Download, Pencil, Share2, Loader2 } from 'lucide-react';
import { DocForm } from '../../utils.jsx';
import { validatePassphrase, MIN_PASSPHRASE_LENGTH } from '../../utils/passphraseValidation.js';
import { getAuditLog } from '../../crypto.js';

/**
 * All modals for the vault app, extracted from VaultApp for maintainability.
 */
export function AddDocumentModal({
  addOpen, editingId, addTab, setAddTab, file, filePrev, drag, analyzing, analyzed, aErr,
  nd, setNd, savingDoc, fileRef, onFile, onCancel, onSave, onRemoveFile, onManualEntry,
}) {
  if (!addOpen) return null;
  return (
    <div className="mbg" onClick={onCancel}>
      <div className="mbox si" role="dialog" aria-modal="true" aria-label={editingId ? 'Edit document' : 'Add document'} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--tx)', fontFamily: "'Space Grotesk', sans-serif" }}>{editingId ? 'Edit Document' : 'Add Document'}</h3>
          <button className="abic" aria-label="Close" onClick={onCancel}><X size={18} /></button>
        </div>

        <div className="tbar" role="tablist" aria-label="Document input method" style={{ marginBottom: 20 }}>
          <button type="button" role="tab" aria-selected={addTab === 'scan'} className={`atab${addTab === 'scan' ? ' on' : ''}`} onClick={() => setAddTab('scan')}>
            <Sparkles size={12} style={{ display: 'inline', marginRight: 5, verticalAlign: '-1px' }} />Scan with AI
          </button>
          <button type="button" role="tab" aria-selected={addTab === 'manual'} className={`atab${addTab === 'manual' ? ' on' : ''}`} onClick={() => setAddTab('manual')}>
            <Pencil size={12} style={{ display: 'inline', marginRight: 5, verticalAlign: '-1px' }} />Manual Entry
          </button>
        </div>

        {addTab === 'scan' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--acs)', border: '1px solid rgba(123,111,232,.25)', borderRadius: 9, padding: '8px 12px', marginBottom: 16 }}>
              <Sparkles size={13} style={{ color: 'var(--ac1)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--act)', flex: 1 }}>Powered by <strong>Groq</strong> · Free tier</span>
              <span style={{ fontSize: 10, color: 'var(--tx4)' }}>PNG/JPG/WEBP · max 2.5 MB</span>
            </div>

            {!file && !analyzing && (
              <div
                className={`uz${drag ? ' dg' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
                onClick={() => fileRef.current?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}
                role="button"
                tabIndex={0}
                aria-label="Choose a document image"
              >
                <div style={{ width: 54, height: 54, borderRadius: 14, background: 'linear-gradient(135deg, var(--ac1), var(--ac2))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', boxShadow: '0 4px 16px rgba(108,92,231,.3)' }}>
                  <Upload size={24} color="#fff" />
                </div>
                <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx2)', margin: '0 0 5px', fontFamily: "'Space Grotesk', sans-serif" }}>Drop your document here</p>
                <p style={{ fontSize: 12, color: 'var(--tx3)', margin: '0 0 4px' }}>PNG, JPG or WEBP · max 2.5 MB</p>
                <p style={{ fontSize: 11, color: 'var(--tx4)', margin: '0 0 18px' }}>For PDFs: take a screenshot first, then upload the image</p>
                <button type="button" className="abtn abp" style={{ fontSize: 13 }} onClick={(e) => e.stopPropagation()}>Browse Files</button>
                <input type="file" ref={fileRef} hidden accept=".png,.jpg,.jpeg,.webp" onChange={(e) => { if (e.target.files[0]) onFile(e.target.files[0]); }} />
              </div>
            )}

            {analyzing && (
              <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'linear-gradient(135deg, var(--ac1), var(--ac2))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                  <Loader2 size={28} color="#fff" className="spin" />
                </div>
                <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx)', margin: '0 0 4px', fontFamily: "'Space Grotesk', sans-serif" }}>Groq AI reading document…</p>
                <p style={{ fontSize: 12, color: 'var(--tx3)', margin: 0 }}>{file?.name}</p>
                {filePrev && <img src={filePrev} style={{ width: '100%', maxHeight: 90, objectFit: 'contain', borderRadius: 8, marginTop: 12, opacity: 0.5 }} alt="" />}
              </div>
            )}

            {aErr && (
              <div style={{ textAlign: 'center', background: 'var(--res)', border: '1px solid var(--re)', borderRadius: 12, padding: '20px 16px', marginBottom: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(248,113,113,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', color: 'var(--re)' }}>
                  <AlertCircle size={20} />
                </div>
                <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--ret)', fontWeight: 600 }}>{aErr}</p>
                <button className="abtn abg" style={{ fontSize: 12, padding: '5px 11px' }} onClick={onManualEntry}>Fill in manually instead</button>
              </div>
            )}

            {analyzed && !analyzing && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--grs)', border: '1px solid rgba(52,211,153,.3)', borderRadius: 9, padding: '9px 13px', marginBottom: 14 }}>
                  <Check size={15} style={{ color: 'var(--gr)', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: 'var(--grt)', fontWeight: 500, flex: 1 }}>Groq analyzed successfully — review below.</span>
                  <button className="abic" aria-label="Remove scanned file" style={{ width: 26, height: 26 }} onClick={onRemoveFile}><X size={13} /></button>
                </div>
                {filePrev && <img src={filePrev} style={{ width: '100%', maxHeight: 150, objectFit: 'contain', borderRadius: 10, marginBottom: 14, background: 'var(--bg2)', padding: 8 }} alt="" />}
                <DocForm nd={nd} setNd={setNd} />
              </div>
            )}
          </div>
        )}

        {addTab === 'manual' && <DocForm nd={nd} setNd={setNd} />}

        {(addTab === 'manual' || analyzed) && (
          <div style={{ display: 'flex', gap: 10, marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--bd)', justifyContent: 'flex-end' }}>
            <button className="abtn abg" onClick={onCancel}>Cancel</button>
            <button className="abtn abp" onClick={onSave} disabled={savingDoc || !nd.name.trim() || !nd.num.trim()}>
              <Check size={14} />{editingId ? 'Save Changes' : 'Save & Encrypt'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function EmergencyModal({ emOpen, emergency, qrDataUrl, qrError, emDraft, emEditing, emSaving, onClose, onEdit, onSave, onShare, onCancelEdit }) {
  if (!emOpen) return null;
  return (
    <div className="mbg" onClick={onClose}>
      <div className="mbox si" role="dialog" aria-modal="true" aria-label="Emergency card" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--res)', border: '1.5px solid var(--re)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--re)' }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 style={{ margin: '0 0 3px', fontSize: 17, fontWeight: 700, color: 'var(--tx)', fontFamily: "'Space Grotesk', sans-serif" }}>Emergency Card</h3>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--tx3)' }}>Present to medical staff · QR for quick access</p>
            </div>
          </div>
          <button className="abic" aria-label="Close emergency card" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'start', marginBottom: 16 }}>
          <div style={{ background: 'var(--res)', border: '1px solid rgba(248,113,113,.2)', borderRadius: 14, padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              { l: 'Blood Type', v: <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--re)', fontFamily: "'Space Grotesk', sans-serif" }}>{emergency.bloodType || '—'}</span> },
              { l: 'Organ Donor', v: emergency.donor ? 'Yes ✓' : 'No' },
              { l: 'Allergies', v: emergency.allergies.join(', ') || 'None listed' },
              { l: 'Medications', v: emergency.medications.join(', ') || 'None listed' },
              { l: 'Conditions', v: emergency.conditions.join(', ') || 'None listed' },
              { l: 'Emergency Contact', v: <div><div style={{ fontWeight: 600, fontSize: 13, color: 'var(--tx)' }}>{emergency.contact.name || 'Not provided'}</div><div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--tx3)', marginTop: 2 }}>{emergency.contact.phone}</div></div> },
            ].map((r) => (
              <div key={r.l}>
                <div className="lbl" style={{ marginBottom: 4 }}>{r.l}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--tx2)' }}>{r.v}</div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', background: 'var(--bg2)', borderRadius: 12, padding: 10, border: '1px solid var(--bd)' }}>
            {qrDataUrl ? (
              <img src={qrDataUrl} width={155} height={155} alt="Emergency QR generated locally" style={{ display: 'block', borderRadius: 6 }} />
            ) : (
              <div style={{ width: 155, height: 155, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx4)', fontSize: 11, textAlign: 'center', padding: 12 }}>
                {qrError ? 'QR unavailable — use Share instead' : 'Generating QR locally…'}
              </div>
            )}
            <p style={{ fontSize: 10, color: 'var(--tx4)', margin: '8px 0 0', fontWeight: 500 }}>Generated locally ·<br />no QR data leaves this device</p>
          </div>
        </div>

        {emEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            <div className="lbl">Edit emergency details</div>
            <label className="lbl">Blood type
              <input className="ainp" value={emDraft.bloodType} onChange={(e) => setEmDraft((value) => ({ ...value, bloodType: e.target.value }))} placeholder="e.g. O+" />
            </label>
            <label className="lbl">Allergies (comma-separated)
              <input className="ainp" value={emDraft.allergies.join(', ')} onChange={(e) => setEmDraft((value) => ({ ...value, allergies: listFromText(e.target.value) }))} placeholder="None" />
            </label>
            <label className="lbl">Medications (comma-separated)
              <input className="ainp" value={emDraft.medications.join(', ')} onChange={(e) => setEmDraft((value) => ({ ...value, medications: listFromText(e.target.value) }))} placeholder="None" />
            </label>
            <label className="lbl">Conditions (comma-separated)
              <input className="ainp" value={emDraft.conditions.join(', ')} onChange={(e) => setEmDraft((value) => ({ ...value, conditions: listFromText(e.target.value) }))} placeholder="None" />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label className="lbl">Contact name
                <input className="ainp" value={emDraft.contact.name} onChange={(e) => setEmDraft((value) => ({ ...value, contact: { ...value.contact, name: e.target.value } }))} />
              </label>
              <label className="lbl">Contact phone
                <input className="ainp" value={emDraft.contact.phone} onChange={(e) => setEmDraft((value) => ({ ...value, contact: { ...value.contact, phone: e.target.value } }))} />
              </label>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--tx2)', fontSize: 13, textTransform: 'none', letterSpacing: 0 }}>
              <input type="checkbox" checked={emDraft.donor} onChange={(e) => setEmDraft((value) => ({ ...value, donor: e.target.checked }))} />
              Organ donor
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="abtn abg" onClick={onCancelEdit}>Cancel</button>
              <button type="button" className="abtn abp" onClick={onSave} disabled={emSaving}>
                {emSaving ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                Save details
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="abtn abg" onClick={onEdit} style={{ width: '100%', justifyContent: 'center', marginBottom: 14 }}>
            <Pencil size={14} />Edit emergency details
          </button>
        )}

        <button type="button" className="abtn abd" onClick={onShare} style={{ width: '100%', justifyContent: 'center', padding: 11, fontSize: 14, fontWeight: 600 }}>
          <Share2 size={15} />Share Emergency Card
        </button>
      </div>
    </div>
  );
}

export function ChangePinModal({ pinModal, pinOld, pinNew, pinNew2, pinChErr, pinChBusy, onClose, onSave }) {
  if (!pinModal) return null;
  return (
    <div className="mbg" onClick={onClose}>
      <div className="mbox si" role="dialog" aria-modal="true" aria-label="Change PIN" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--tx)', fontFamily: "'Space Grotesk', sans-serif" }}>Change PIN</h3>
          <button className="abic" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>

        {pinChErr && (
          <div style={{ background: 'var(--res)', border: '1px solid var(--re)', borderRadius: 10, padding: '10px 13px', marginBottom: 14, fontSize: 13, color: 'var(--ret)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertCircle size={14} />{pinChErr}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label>
            <div className="lbl" style={{ marginBottom: 5 }}>Current PIN</div>
            <input type="password" inputMode="numeric" maxLength={6} value={pinOld} onChange={(e) => setPinOld(e.target.value.replace(/\D/g, ''))} className="ainp" style={{ width: '100%', letterSpacing: 4, fontFamily: "'JetBrains Mono', monospace" }} />
          </label>
          <label>
            <div className="lbl" style={{ marginBottom: 5 }}>New PIN (6 digits)</div>
            <input type="password" inputMode="numeric" maxLength={6} value={pinNew} onChange={(e) => setPinNew(e.target.value.replace(/\D/g, ''))} className="ainp" style={{ width: '100%', letterSpacing: 4, fontFamily: "'JetBrains Mono', monospace" }} />
          </label>
          <label>
            <div className="lbl" style={{ marginBottom: 5 }}>Confirm New PIN</div>
            <input type="password" inputMode="numeric" maxLength={6} value={pinNew2} onChange={(e) => setPinNew2(e.target.value.replace(/\D/g, ''))} className="ainp" style={{ width: '100%', letterSpacing: 4, fontFamily: "'JetBrains Mono', monospace" }} />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--bd)', justifyContent: 'flex-end' }}>
          <button className="abtn abg" onClick={onClose}>Cancel</button>
          <button className="abtn abp" onClick={onSave} disabled={pinChBusy}>
            {pinChBusy ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
            {pinChBusy ? 'Re-encrypting…' : 'Save New PIN'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function UpgradePrompt({ showUpgradePrompt, onClose, onUpgrade }) {
  if (!showUpgradePrompt) return null;
  return (
    <div className="mbg" onClick={onClose}>
      <div className="mbox si" role="dialog" aria-modal="true" aria-label="Upgrade security" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--ams)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--am)' }}>
              <AlertTriangle size={18} />
            </div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--tx)', fontFamily: "'Space Grotesk', sans-serif" }}>Upgrade Security</h3>
          </div>
          <button className="abic" aria-label="Close" onClick={onClose}><span aria-hidden="true">×</span></button>
        </div>
        <p style={{ fontSize: 14, color: 'var(--tx2)', lineHeight: 1.6, marginBottom: 16 }}>
          Your vault is secured with a <strong>6-digit PIN</strong> — only 1 million possible combinations. A long, unique passphrase is exponentially harder to crack.
        </p>
        <p style={{ fontSize: 13, color: 'var(--tx3)', lineHeight: 1.5, marginBottom: 20 }}>
          Your documents and images will be re-encrypted with the new format. The old PIN vault is backed up until your next unlock.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="abtn abg" onClick={onClose}>Not now</button>
          <button type="button" className="abtn abp" onClick={onUpgrade}>Upgrade</button>
        </div>
      </div>
    </div>
  );
}

export function ScanConsent({ showScanConsent, onClose, onGroq, onDevice }) {
  if (!showScanConsent) return null;
  return (
    <div className="mbg" onClick={onClose}>
      <div className="mbox si" role="dialog" aria-modal="true" aria-label="Scan consent" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--tx)', fontFamily: "'Space Grotesk', sans-serif" }}>Scan Document</h3>
          <button className="abic" aria-label="Close" onClick={onClose}><span aria-hidden="true">×</span></button>
        </div>
        <p style={{ fontSize: 14, color: 'var(--tx2)', lineHeight: 1.6, marginBottom: 16 }}>
          Your document image can be scanned in two ways:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12, background: 'var(--grs)', borderRadius: 10, border: '1px solid rgba(52,211,153,.3)' }}>
            <Shield size={16} style={{ color: 'var(--gr)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>Scan on-device <span style={{ fontSize: 10, color: 'var(--gr)', fontWeight: 700, marginLeft: 4 }}>RECOMMENDED</span></div>
              <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 2 }}>
                Your image never leaves this device. Fully private — no third-party processing.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12, background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--bd)' }}>
            <Sparkles size={16} style={{ color: 'var(--ac1)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>Scan with Groq AI</div>
              <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 2 }}>
                Faster and more accurate. Your image is sent to Groq's servers for processing.
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="abtn abg" onClick={onClose}>Cancel</button>
          <button type="button" className="abtn abg" onClick={onDevice}>
            <Shield size={14} />On-device
          </button>
          <button type="button" className="abtn abp" onClick={onGroq}>
            <Sparkles size={14} />Scan with Groq
          </button>
        </div>
      </div>
    </div>
  );
}

export function AuditLogModal({ showAuditLog, onClose }) {
  if (!showAuditLog) return null;
  const entries = getAuditLog();
  return (
    <div className="mbg" onClick={onClose}>
      <div className="mbox si" role="dialog" aria-modal="true" aria-label="Audit log" tabIndex={-1} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--tx)', fontFamily: "'Space Grotesk', sans-serif" }}>Audit Log</h3>
          <button className="abic" aria-label="Close audit log" onClick={onClose}><span aria-hidden="true">×</span></button>
        </div>
        <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {entries.length === 0 ? (
            <p style={{ color: 'var(--tx3)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No activity yet.</p>
          ) : (
            [...entries].reverse().map((entry, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--bg2)', borderRadius: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--tx4)', fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
                  {new Date(entry.ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span style={{ fontSize: 12, color: 'var(--tx2)', fontWeight: 600, textTransform: 'capitalize' }}>
                  {entry.event}
                </span>
                {entry.details && (
                  <span style={{ fontSize: 12, color: 'var(--tx3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.details}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
