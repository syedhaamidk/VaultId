import { Badge, TiltCard } from '../../utils.jsx';
import { VAULT_CAT } from '../../data.js';
import { Copy, Check } from 'lucide-react';

/**
 * Document card in the grid.
 */
export default function DocumentCard({ doc, img, catColor, icon: Icon, onOpen, onCopy, copied }) {
  return (
    <TiltCard aria-label={`Open ${doc.name}`} onClick={onOpen}>
      <div className="acard" style={{ borderTop: `2.5px solid ${catColor}`, padding: 16, position: 'relative', overflow: 'hidden' }}>
        <div className="shine" style={{ position: 'absolute', inset: 0, borderRadius: 16, pointerEvents: 'none', transition: 'background .1s' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${catColor}1A`, border: `1px solid ${catColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: catColor, flexShrink: 0, overflow: 'hidden' }}>
                {img ? <img src={img} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <Icon size={17} />}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--tx)', marginBottom: 2 }}>{doc.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--tx4)', maxWidth: 148, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.by}</div>
              </div>
            </div>
            <Badge exp={doc.expires} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg2)', borderRadius: 8, padding: '6px 10px', border: '1px solid var(--bd)' }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--tx3)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.num}</span>
            <button className="abic" aria-label={`Copy ${doc.name} document number`} style={{ width: 26, height: 26, borderRadius: 6, marginLeft: 6, flexShrink: 0 }} onClick={(e) => onCopy(e, doc.id, doc.num)}>
              <span aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
                {copied ? 'Copied' : ''}
              </span>
              {copied ? <Check size={12} style={{ color: 'var(--gr)' }} /> : <Copy size={12} />}
            </button>
          </div>
        </div>
      </div>
    </TiltCard>
  );
}
