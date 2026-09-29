import { X, Pencil, MoreVertical, Download, Trash2, Copy, Check, AlertCircle } from 'lucide-react';
import { Badge, fmtDate, docIcon } from '../../utils.jsx';
import { VAULT_CAT } from '../../data.js';

/**
 * Document detail modal.
 */
export default function DocumentModal({
  doc, img, catColor, onClose, onEdit, onDelete, onCopy, copied,
  onDownloadJPEG, onDownloadPDF, hasImage,
}) {
  const Icon = docIcon(doc.name, doc.cat);

  return (
    <div className="mbg" onClick={onClose}>
      <div className="mbox si" role="dialog" aria-modal="true" aria-label="Document details" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ width: 48, height: 48, borderRadius: 13, background: `${catColor}1A`, border: `1.5px solid ${catColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: catColor, overflow: 'hidden' }}>
              {img ? <img src={img} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <Icon size={22} />}
            </div>
            <div>
              <h3 style={{ margin: '0 0 3px', fontSize: 17, fontWeight: 700, color: 'var(--tx)', fontFamily: "'Space Grotesk', sans-serif" }}>{doc.name}</h3>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--tx3)' }}>{doc.by}</p>
            </div>
          </div>
          <button className="abic" aria-label="Close document details" onClick={onClose}><X size={18} /></button>
        </div>

        {img ? (
          <img src={img} style={{ width: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 10, background: 'var(--bg2)', marginBottom: 16 }} alt="Document" />
        ) : (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
            <span className="no-img-tag"><AlertCircle size={11} />No image attached</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
          {[
            { l: 'Category', v: VAULT_CAT[doc.cat]?.label },
            { l: 'Issue Date', v: fmtDate(doc.issued) },
            { l: 'Expiry', v: doc.expires ? fmtDate(doc.expires) : 'No expiry' },
            { l: 'Status', v: <Badge exp={doc.expires} /> },
          ].map((r) => (
            <div key={r.l}>
              <div className="lbl" style={{ marginBottom: 5 }}>{r.l}</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--tx2)' }}>{r.v}</div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div className="lbl" style={{ marginBottom: 7 }}>Document Number</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg2)', borderRadius: 10, padding: '11px 14px', border: '1px solid var(--bd)' }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, flex: 1, color: 'var(--tx2)' }}>{doc.num}</span>
            <button className="abtn abg" style={{ padding: '5px 11px', fontSize: 12, gap: 5 }} onClick={(e) => onCopy(e, doc.id, doc.num)}>
              {copied ? <><Check size={12} />Copied</> : <><Copy size={12} />Copy</>}
            </button>
          </div>
        </div>

        {doc.notes && (
          <div style={{ background: 'var(--sur2)', border: '1px solid var(--bd)', borderLeft: `3px solid ${catColor}`, borderRadius: 10, padding: '11px 14px', marginBottom: 16 }}>
            <div className="lbl" style={{ marginBottom: 4 }}>Notes</div>
            <div style={{ fontSize: 13, color: 'var(--tx2)', lineHeight: 1.6 }}>{doc.notes}</div>
          </div>
        )}

        {/* Version history */}
        {doc.versions && doc.versions.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div className="lbl" style={{ marginBottom: 8 }}>Version History</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {doc.versions.map((v, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg2)', borderRadius: 8, border: '1px solid var(--bd)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--tx2)', fontWeight: 600 }}>{v.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--tx4)' }}>
                      {new Date(v.ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, paddingTop: 18, borderTop: '1px solid var(--bd)' }}>
          <button type="button" className="abtn abg" style={{ flex: 1, justifyContent: 'center' }} onClick={() => onEdit(doc)}><Pencil size={13} />Edit</button>
          <div className="kebab-menu">
            <button className="abic" aria-label="More document actions" style={{ border: '1px solid var(--bd)' }} title="More actions">
              <MoreVertical size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
