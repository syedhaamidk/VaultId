import { useRef, useCallback } from 'react';
import {
  AlertCircle, Clock, CheckCircle, Minus,
  CreditCard, Activity, Wallet, Home, Scale,
  Fingerprint, Globe, Car, Key, Droplet, Syringe, FileText,
} from 'lucide-react';
import { VAULT_CAT } from './data.js';

// ── Date helpers ─────────────────────────────────────────────────────────────
// Date-only values are parsed as local calendar dates. Parsing them with
// `new Date('YYYY-MM-DD')` treats them as UTC and can display the previous day
// for users west of Greenwich.
function parseCalendarDate(value) {
  if (!value) return null;

  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (match) {
      const [, year, month, day] = match.map(Number);
      const date = new Date(year, month - 1, day);
      if (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
      ) return date;
      return null;
    }
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function daysLeft(exp) {
  const expiry = parseCalendarDate(exp);
  if (!expiry) return null;

  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const expiryDay = Date.UTC(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
  return Math.round((expiryDay - today) / 86_400_000);
}

export function fmtDate(value) {
  const date = parseCalendarDate(value);
  return date
    ? date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
}

// ── Pick a lucide icon based on document name / category ─────────────────────
export function docIcon(name = '', cat = 'identity') {
  const n = name.toLowerCase();
  if (n.includes('aadhar') || n.includes('aadhaar')) return Fingerprint;
  if (n.includes('passport'))                          return Globe;
  if (n.includes('license') || n.includes('driving')) return Car;
  if (n.includes('blood')   || n.includes('report'))  return Droplet;
  if (n.includes('vacc')    || n.includes('covid'))   return Syringe;
  if (n.includes('rental')  || n.includes('lease'))   return Key;
  return (
    { identity: CreditCard, medical: Activity, financial: Wallet, property: Home, legal: Scale }[cat]
    ?? FileText
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
export function Badge({ exp }) {
  const d   = daysLeft(exp);
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontSize: 11, fontWeight: 600, padding: '3px 9px',
    borderRadius: 20, whiteSpace: 'nowrap',
  };
  if (d === null) return <span style={{ ...base, background: 'var(--bg2)', color: 'var(--tx4)' }}><Minus size={10} />No expiry</span>;
  if (d < 0)      return <span style={{ ...base, background: 'var(--res)', color: 'var(--re)'  }}><AlertCircle size={10} />Expired</span>;
  if (d <= 90)    return <span style={{ ...base, background: 'var(--ams)', color: 'var(--am)'  }}><Clock size={10} />Exp. {d}d</span>;
  return               <span style={{ ...base, background: 'var(--grs)', color: 'var(--gr)'  }}><CheckCircle size={10} />Valid</span>;
}

// ── TiltCard — 3-D perspective tilt that follows the mouse ───────────────────
export function TiltCard({ children, onClick, style, 'aria-label': ariaLabel }) {
  const ref = useRef(null);
  const raf = useRef(null);

  const onMove = useCallback((e) => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const x = (e.clientX - r.left)  / r.width  - 0.5;
      const y = (e.clientY - r.top)   / r.height - 0.5;
      ref.current.style.transform =
        `perspective(900px) rotateX(${-y * 10}deg) rotateY(${x * 10}deg) translateZ(8px) scale(1.02)`;
      const sh = ref.current.querySelector('.shine');
      if (sh) sh.style.background =
        `radial-gradient(circle at ${(x + 0.5) * 100}% ${(y + 0.5) * 100}%, rgba(255,255,255,.13) 0%, transparent 65%)`;
    });
  }, []);

  const onLeave = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    if (ref.current) {
      ref.current.style.transform =
        'perspective(900px) rotateX(0) rotateY(0) translateZ(0) scale(1)';
      const sh = ref.current.querySelector('.shine');
      if (sh) sh.style.background = 'transparent';
    }
  }, []);

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onMouseDown={(e) => { if (ref.current) ref.current.style.transform += ' scale(.98)'; }}
      onMouseUp={onLeave}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(e);
        }
      }}
      role="button"
      aria-label={ariaLabel}
      tabIndex={0}
      style={{ transition: 'transform .12s ease, box-shadow .12s ease', cursor: 'pointer', ...style }}
    >
      {children}
    </div>
  );
}

// ── DocForm — shared add / edit document form ────────────────────────────────
export function DocForm({ nd, setNd }) {
  const lbl = {
    fontSize: 11.5, fontWeight: 700, color: 'var(--tx3)',
    display: 'block', marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: '.6px',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {[
        { l: 'Document Name *',   p: 'e.g. Aadhar Card, Passport', k: 'name' },
        { l: 'Document Number *', p: 'e.g. XXXX XXXX 4521',        k: 'num'  },
        { l: 'Issued By',         p: 'Issuing authority',           k: 'by'   },
      ].map(({ l, p, k }) => (
        <div key={k}>
          <label style={lbl}>{l}</label>
          <input
            className="ainp"
            placeholder={p}
            value={nd[k]}
            onChange={(e) => setNd((n) => ({ ...n, [k]: e.target.value }))}
          />
        </div>
      ))}

      <div>
        <label style={lbl}>Category</label>
        <select
          className="ainp"
          value={nd.cat}
          onChange={(e) => setNd((n) => ({ ...n, cat: e.target.value }))}
        >
          {Object.entries(VAULT_CAT)
            .filter(([k]) => k !== 'all')
            .map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={lbl}>Issue Date</label>
          <input type="date" className="ainp" value={nd.issued}
            onChange={(e) => setNd((n) => ({ ...n, issued: e.target.value }))} />
        </div>
        <div>
          <label style={lbl}>Expiry Date</label>
          <input type="date" className="ainp" value={nd.expires}
            onChange={(e) => setNd((n) => ({ ...n, expires: e.target.value }))} />
        </div>
      </div>

      <div>
        <label style={lbl}>Notes</label>
        <textarea
          className="ainp"
          rows={3}
          placeholder="Additional details…"
          value={nd.notes}
          onChange={(e) => setNd((n) => ({ ...n, notes: e.target.value }))}
        />
      </div>
    </div>
  );
}
