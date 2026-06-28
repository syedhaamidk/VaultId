import { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck, Lock, Search, Sun, Moon, Plus, X,
  Upload, Trash2, Copy, Check, Clock, AlertCircle,
  Loader2, Zap, Share2, Pencil, Bell, ChevronRight,
  CreditCard, Activity, Wallet, Home, Scale,
  Sparkles, Shield, FolderOpen,
} from 'lucide-react';
import { Badge, TiltCard, DocForm, daysLeft, fmtDate, docIcon } from '../utils.jsx';
import { VAULT_CAT, DOCS0, EM }                                   from '../data.js';
import { tryUnlock, saveVault }                                   from '../crypto.js';

// ── Groq config ───────────────────────────────────────────────────────────────
// Free tier — no credit card. Sign up at https://console.groq.com
const GROQ_KEY         = import.meta.env.VITE_GROQ_API_KEY         ?? '';
const GROQ_VISION_MODEL = import.meta.env.VITE_GROQ_VISION_MODEL  ?? 'qwen/qwen3.6-27b';
const GROQ_URL          = 'https://api.groq.com/openai/v1/chat/completions';

// ── AI document scanner (Groq) ────────────────────────────────────────────────
// Groq supports images (PNG, JPG, WEBP) up to 4 MB via base64.
// PDFs are NOT natively supported — the UI will show a friendly message.
async function scanDocumentWithAI(file) {
  if (!GROQ_KEY) throw new Error('NO_KEY');

  // Build base64 data URL
  const b64 = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

  const dataUrl = `data:${file.type};base64,${b64}`;

  const PROMPT = `You are a document data extractor. Carefully read this document image and extract the key fields.
Return ONLY a valid JSON object with no markdown fences, explanation, or extra text:
{
  "name": "document type in English (e.g. Aadhar Card, PAN Card, Passport, Driver's License, Health Insurance)",
  "category": "one of: identity | medical | financial | property | legal",
  "num": "the primary document number, ID number, or policy number",
  "by": "the issuing authority or organization",
  "issued": "issue date in YYYY-MM-DD format, or null if not visible",
  "expires": "expiry date in YYYY-MM-DD format, or null if the document doesn't expire",
  "notes": "any other important details in one short sentence (blood group, sum insured, UAN, etc.), or empty string"
}`;

  const body = {
    model: GROQ_VISION_MODEL,
    max_tokens: 600,
    temperature: 0.1,
    response_format: { type: 'json_object' }, // force JSON output
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: dataUrl },
          },
          {
            type: 'text',
            text: PROMPT,
          },
        ],
      },
    ],
  };

  const res = await fetch(GROQ_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Groq error ${res.status}`);
  }

  const data    = await res.json();
  const content = data.choices?.[0]?.message?.content ?? '{}';

  // Safely parse — Groq with response_format:json_object should always return valid JSON
  return JSON.parse(content.replace(/```json|```/g, '').trim());
}

// ── VaultApp ──────────────────────────────────────────────────────────────────
export default function VaultApp({ onBack }) {
  // ── theme / auth ──
  const [dark,      setDark]      = useState(true);
  const [phase,     setPhase]     = useState('boot');  // boot | locked | unlocking | open
  const [pin,       setPin]       = useState('');
  const [pinErr,    setPinErr]    = useState(false);
  const [unlockOk,  setUnlockOk]  = useState(false);
  const [cryptoKey, setCryptoKey] = useState(null);

  // ── vault data ──
  const [docs, setDocs] = useState([]);
  const [imgs, setImgs] = useState({});

  // ── ui ──
  const [cat,        setCat]        = useState('all');
  const [q,          setQ]          = useState('');
  const [docView,    setDocView]    = useState(null);
  const [addOpen,    setAddOpen]    = useState(false);
  const [emOpen,     setEmOpen]     = useState(false);
  const [notifOpen,  setNotifOpen]  = useState(false);
  const [cpId,       setCpId]       = useState(null);
  const [toast,      setToast]      = useState(null);

  // ── add-document modal ──
  const [addTab,     setAddTab]     = useState('scan');
  const [file,       setFile]       = useState(null);
  const [filePrev,   setFilePrev]   = useState(null);
  const [analyzing,  setAnalyzing]  = useState(false);
  const [analyzed,   setAnalyzed]   = useState(false);
  const [aErr,       setAErr]       = useState(null);
  const [drag,       setDrag]       = useState(false);
  const [nd, setNd] = useState({
    name: '', cat: 'identity', num: '', by: '', issued: '', expires: '', notes: '',
  });
  const fileRef = useRef(null);

  // Boot delay
  useEffect(() => { setTimeout(() => setPhase('locked'), 300); }, []);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const showToast = (txt, type = 'ok') => {
    setToast({ txt, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── PIN ───────────────────────────────────────────────────────────────────
  async function pressKey(k) {
    if (phase === 'unlocking') return;
    if (pin.length >= 4) return;
    const np = pin + k;
    setPin(np);
    if (np.length !== 4) return;

    setPhase('unlocking');
    setTimeout(async () => {
      const res = await tryUnlock(np, DOCS0);
      if (res.ok) {
        setCryptoKey(res.key);
        setDocs(res.docs);
        setImgs(res.imgs);
        setUnlockOk(true);
        setTimeout(() => { setPhase('open'); setPin(''); setUnlockOk(false); }, 550);
      } else {
        setPinErr(true);
        setTimeout(() => { setPin(''); setPinErr(false); setPhase('locked'); }, 700);
      }
    }, 80);
  }

  // ── Vault persistence ─────────────────────────────────────────────────────
  async function persist(newDocs, newImgs) {
    if (cryptoKey) await saveVault(newDocs, newImgs, cryptoKey);
  }

  // ── Copy number ───────────────────────────────────────────────────────────
  function copyNum(e, id, num) {
    e.stopPropagation();
    navigator.clipboard?.writeText(num).catch(() => {});
    setCpId(id);
    setTimeout(() => setCpId(null), 2000);
    showToast('Copied to clipboard');
  }

  // ── File handling ─────────────────────────────────────────────────────────
  function handleFile(f) {
    // Groq vision only supports images (not PDFs)
    const validImages = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    const isPDF       = f.type === 'application/pdf';

    if (isPDF) {
      setAErr('Groq vision doesn\'t support PDFs directly. Please take a screenshot or photo of the document and upload that instead.');
      return;
    }
    if (!validImages.includes(f.type)) {
      setAErr('Unsupported file type. Please use PNG, JPG, or WEBP.');
      return;
    }
    if (f.size > 4_000_000) {
      setAErr('File too large — Groq\'s limit is 4 MB. Please compress or crop the image.');
      return;
    }
    if (!GROQ_KEY) {
      setAErr('No Groq API key found. Add VITE_GROQ_API_KEY to your .env file — it\'s free at console.groq.com');
      return;
    }

    setFile(f); setAErr(null);

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => setFilePrev(e.target.result);
    reader.readAsDataURL(f);

    runScan(f);
  }

  async function runScan(f) {
    setAnalyzing(true); setAnalyzed(false);
    try {
      const p = await scanDocumentWithAI(f);
      setNd({
        name:    p.name     ?? '',
        cat:     p.category ?? 'identity',
        num:     p.num      ?? '',
        by:      p.by       ?? '',
        issued:  p.issued   ?? '',
        expires: p.expires  ?? '',
        notes:   p.notes    ?? '',
      });
      setAnalyzed(true);
    } catch (err) {
      const msg = err.message === 'NO_KEY'
        ? 'Add VITE_GROQ_API_KEY to your .env file (free at console.groq.com)'
        : `Scan failed: ${err.message}. Try manual entry below.`;
      setAErr(msg);
      setAddTab('manual');
    } finally {
      setAnalyzing(false);
    }
  }

  // ── Save / delete ─────────────────────────────────────────────────────────
  async function saveDoc() {
    if (!nd.name.trim() || !nd.num.trim()) return;
    const newId   = Date.now();
    const newDocs = [...docs, { ...nd, id: newId }];
    const newImgs = filePrev ? { ...imgs, [newId]: filePrev } : imgs;
    setDocs(newDocs); setImgs(newImgs);
    await persist(newDocs, newImgs);
    resetAdd(); setAddOpen(false);
    showToast('Saved & encrypted with AES-256');
  }

  async function deleteDoc(id) {
    const newDocs = docs.filter((d) => d.id !== id);
    const newImgs = { ...imgs }; delete newImgs[id];
    setDocs(newDocs); setImgs(newImgs);
    await persist(newDocs, newImgs);
    setDocView(null);
    showToast('Document deleted');
  }

  function resetAdd() {
    setNd({ name: '', cat: 'identity', num: '', by: '', issued: '', expires: '', notes: '' });
    setFile(null); setFilePrev(null); setAnalyzed(false); setAErr(null); setAddTab('scan');
  }

  function openAdd() { resetAdd(); setAddOpen(true); }

  // ── Derived ───────────────────────────────────────────────────────────────
  const filtered = docs.filter((d) => {
    if (cat !== 'all' && d.cat !== cat) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      d.name.toLowerCase().includes(s) ||
      d.num.toLowerCase().includes(s)  ||
      d.by.toLowerCase().includes(s)
    );
  });

  const stats = {
    total:   docs.length,
    soon:    docs.filter((d) => { const n = daysLeft(d.expires); return n !== null && n >= 0 && n <= 90; }).length,
    expired: docs.filter((d) => { const n = daysLeft(d.expires); return n !== null && n < 0; }).length,
  };

  const notifs = [
    ...docs
      .filter((d) => { const n = daysLeft(d.expires); return n !== null && n >= 0 && n <= 90; })
      .map((d) => ({ id: d.id, type: 'warn', msg: `${d.name} expires in ${daysLeft(d.expires)} days` })),
    ...docs
      .filter((d) => { const n = daysLeft(d.expires); return n !== null && n < 0; })
      .map((d) => ({ id: d.id, type: 'err', msg: `${d.name} has expired — renew now` })),
  ];

  const theme  = dark ? 'dark' : 'light';
  const qrURL  = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(`VAULTID|B:${EM.bloodType}|A:${EM.allergies.join(',')}|C:${EM.contact.phone}`)}&size=180x180&margin=10&color=${dark ? 'EEEEFF' : '0A0A20'}`;

  const CAT_ICONS = {
    all: FolderOpen, identity: CreditCard, medical: Activity,
    financial: Wallet, property: Home, legal: Scale,
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // LOCK SCREEN
  // ═══════════════════════════════════════════════════════════════════════════
  if (phase !== 'open') return (
    <div
      className="app"
      data-t={theme}
      style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}
    >
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 600, background: 'radial-gradient(circle, var(--acs) 0%, transparent 65%)', pointerEvents: 'none' }} />

      <button className="abic" onClick={() => setDark((d) => !d)} style={{ position: 'absolute', top: 16, right: 16, background: 'var(--gl)', backdropFilter: 'blur(12px)', border: '1px solid var(--glb)', borderRadius: 10 }}>
        {dark ? <Sun size={15} /> : <Moon size={15} />}
      </button>
      {onBack && (
        <button
          className="abic"
          onClick={onBack}
          style={{ position: 'absolute', top: 16, left: 16, background: 'var(--gl)', backdropFilter: 'blur(12px)', border: '1px solid var(--glb)', borderRadius: 10, width: 'auto', padding: '6px 12px', gap: 5, color: 'var(--tx3)', fontSize: 12, display: 'flex', alignItems: 'center' }}
        >
          <ChevronRight size={13} style={{ transform: 'rotate(180deg)' }} /> Site
        </button>
      )}

      <div className="acard fl" style={{ padding: '44px 52px', textAlign: 'center', minWidth: 360, boxShadow: 'var(--s4)' }}>
        <div style={{ position: 'relative', width: 76, height: 76, margin: '0 auto 22px' }}>
          <div className="pu" style={{ position: 'absolute', top: -12, right: -12, bottom: -12, left: -12, borderRadius: '50%', border: '2px solid var(--ac1)', opacity: 0.6 }} />
          <div style={{ width: 76, height: 76, borderRadius: '50%', background: 'var(--acs)', border: '2px solid var(--ac1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: unlockOk ? 'var(--gr)' : 'var(--act)', transition: 'color .3s' }}>
            {phase === 'unlocking' ? <Loader2 size={32} className="spin" /> : unlockOk ? <Check size={32} /> : <ShieldCheck size={32} />}
          </div>
        </div>

        <h1 className="gtext" style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.5px', margin: '0 0 5px', fontFamily: "'Space Grotesk', sans-serif" }}>VaultID</h1>
        <p style={{ fontSize: 13, color: 'var(--tx3)', margin: '0 0 28px' }}>
          {phase === 'boot' ? 'Loading…' : phase === 'unlocking' ? 'Deriving key with PBKDF2…' : 'Enter PIN to unlock'}
        </p>

        {phase !== 'boot' && (
          <>
            <div className={pinErr ? 'shk' : ''} style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 28 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ width: 13, height: 13, borderRadius: 4, background: pin.length > i ? 'var(--ac1)' : 'var(--bd2)', transition: 'all .15s', boxShadow: pin.length > i ? '0 0 12px var(--ac1)' : undefined }} />
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 72px)', gap: 10, justifyContent: 'center' }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <button key={n} className="nk" onClick={() => pressKey(String(n))}>{n}</button>
              ))}
              <div />
              <button className="nk" onClick={() => pressKey('0')}>0</button>
              <button className="nk" style={{ fontSize: 16 }} onClick={() => setPin((p) => p.slice(0, -1))}>⌫</button>
            </div>

            {pinErr   && <p style={{ color: 'var(--re)', fontSize: 12, marginTop: 14, fontWeight: 500 }}>Incorrect PIN — try again</p>}
            {unlockOk && <p style={{ color: 'var(--gr)', fontSize: 12, marginTop: 14, fontWeight: 600 }}>Unlocked ✓</p>}

            <p style={{ color: 'var(--tx4)', fontSize: 11, marginTop: 20 }}>
              Demo PIN: <code style={{ color: 'var(--act)', fontFamily: "'JetBrains Mono', monospace" }}>1234</code>
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
              <span className="sbadge"><Shield size={10} />AES-256-GCM · Groq AI</span>
            </div>
          </>
        )}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN APP
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="app" data-t={theme} style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: 'var(--bg)', color: 'var(--tx)' }}>

      {/* ── SIDEBAR ── */}
      <aside className="asidebar" style={{ width: 215, background: 'var(--gl)', backdropFilter: 'blur(20px)', borderRight: '1px solid var(--bd)', padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0, overflowY: 'auto' }}>
        <div style={{ padding: '8px 10px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, var(--ac1), var(--ac2))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={17} color="#fff" />
          </div>
          <span className="gtext" style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-.4px', fontFamily: "'Space Grotesk', sans-serif" }}>VaultID</span>
        </div>

        <p className="lbl" style={{ padding: '0 10px 6px' }}>Library</p>
        {Object.entries(VAULT_CAT).map(([k, m]) => {
          const Ic  = CAT_ICONS[k] ?? FolderOpen;
          const cnt = k === 'all' ? docs.length : docs.filter((d) => d.cat === k).length;
          return (
            <div key={k} className={`anv${cat === k ? ' on' : ''}`} onClick={() => setCat(k)}>
              <Ic size={15} /><span style={{ flex: 1 }}>{m.label}</span>
              <span className="cnt">{cnt}</span>
            </div>
          );
        })}

        <div className="divr" />
        <div className="anv danger" onClick={() => setEmOpen(true)}>
          <Zap size={15} /><span style={{ flex: 1 }}>Emergency Card</span><ChevronRight size={13} />
        </div>
        <div className="anv" onClick={() => setNotifOpen((o) => !o)}>
          <Bell size={15} /><span style={{ flex: 1 }}>Alerts</span>
          {notifs.length > 0 && (
            <span style={{ background: 'var(--re)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20 }}>
              {notifs.length}
            </span>
          )}
        </div>

        <div style={{ flex: 1 }} />
        <div className="divr" />
        {onBack && (
          <div className="anv" style={{ color: 'var(--tx3)' }} onClick={onBack}>
            <ChevronRight size={15} style={{ transform: 'rotate(180deg)' }} />
            <span style={{ flex: 1, fontSize: 13 }}>Back to Site</span>
          </div>
        )}
        <div
          className="anv"
          style={{ color: 'var(--tx3)' }}
          onClick={() => { setPhase('locked'); setCryptoKey(null); setDocs([]); setImgs({}); }}
        >
          <Lock size={15} /><span style={{ flex: 1, fontSize: 13 }}>Lock Vault</span>
        </div>
      </aside>

      {/* ── MAIN COLUMN ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Topbar */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--gl)', backdropFilter: 'blur(20px)', flexShrink: 0, gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-.4px', fontFamily: "'Space Grotesk', sans-serif", color: 'var(--tx)' }}>
              {VAULT_CAT[cat].label}
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--tx3)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {filtered.length} doc{filtered.length !== 1 ? 's' : ''}
              <span className="sbadge" style={{ fontSize: 10, padding: '1px 7px' }}><Shield size={9} />AES-256</span>
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div className="srch top-s">
              <Search size={14} />
              <input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <button className="abic" onClick={() => setDark((d) => !d)} style={{ border: '1px solid var(--bd)' }}>
              {dark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button className="abtn abp" onClick={openAdd} style={{ fontSize: 13, padding: '7px 14px' }}>
              <Plus size={14} />Add
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="c-area" style={{ flex: 1, padding: 24, overflowY: 'auto' }}>

          {/* Stats */}
          {cat === 'all' && (
            <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
              {[
                { l: 'Total Documents', v: stats.total,   cl: 'var(--tx)',  b: 'var(--glb)' },
                { l: 'Expiring Soon',   v: stats.soon,    cl: 'var(--am)',  b: stats.soon    ? 'var(--am)' : 'var(--glb)' },
                { l: 'Expired',         v: stats.expired, cl: 'var(--re)',  b: stats.expired ? 'var(--re)' : 'var(--glb)' },
                { l: 'Encrypted 🔐',   v: 'On',          cl: 'var(--gr)',  b: 'var(--gr)'  },
              ].map((s) => (
                <div key={s.l} className="stc" style={{ borderColor: s.b }}>
                  <div style={{ fontSize: 26, fontWeight: 700, color: s.cl, marginBottom: 5, fontFamily: "'Space Grotesk', sans-serif" }}>{s.v}</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--tx3)' }}>{s.l}</div>
                </div>
              ))}
            </div>
          )}

          {/* Alerts panel */}
          {notifOpen && notifs.length > 0 && (
            <div className="fa" style={{ background: 'var(--sur2)', border: '1px solid var(--bd)', borderRadius: 14, padding: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>⚠️ {notifs.length} Alert{notifs.length > 1 ? 's' : ''}</span>
                <button className="abic" onClick={() => setNotifOpen(false)}><X size={14} /></button>
              </div>
              {notifs.map((n, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < notifs.length - 1 ? '1px solid var(--bd)' : undefined }}>
                  {n.type === 'err'
                    ? <AlertCircle size={14} style={{ color: 'var(--re)', flexShrink: 0 }} />
                    : <Clock size={14} style={{ color: 'var(--am)', flexShrink: 0 }} />}
                  <span style={{ fontSize: 13, color: 'var(--tx2)' }}>{n.msg}</span>
                </div>
              ))}
            </div>
          )}

          {/* Document grid */}
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--tx3)' }}>
              <ShieldCheck size={40} style={{ marginBottom: 14, opacity: 0.25 }} />
              <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, color: 'var(--tx2)' }}>Vault is empty</p>
              <p style={{ margin: '0 0 18px', fontSize: 13 }}>{q ? 'No results — try a different search' : 'Add your first document'}</p>
              {!q && <button className="abtn abp" onClick={openAdd}><Plus size={14} />Add Document</button>}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(256px, 1fr))', gap: 16 }}>
              {filtered.map((doc) => {
                const DI  = docIcon(doc.name, doc.cat);
                const cc  = VAULT_CAT[doc.cat]?.color ?? '#7B6FE8';
                const has = !!imgs[doc.id];
                return (
                  <TiltCard key={doc.id} onClick={() => setDocView(doc)}>
                    <div className="acard" style={{ borderTop: `2.5px solid ${cc}`, padding: 16, position: 'relative', overflow: 'hidden' }}>
                      <div className="shine" style={{ position: 'absolute', inset: 0, borderRadius: 16, pointerEvents: 'none', transition: 'background .1s' }} />
                      <div style={{ position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${cc}1A`, border: `1px solid ${cc}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cc, flexShrink: 0, overflow: 'hidden' }}>
                              {has ? <img src={imgs[doc.id]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <DI size={17} />}
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
                          <button className="abic" style={{ width: 26, height: 26, borderRadius: 6, marginLeft: 6, flexShrink: 0 }} onClick={(e) => copyNum(e, doc.id, doc.num)}>
                            {cpId === doc.id ? <Check size={12} style={{ color: 'var(--gr)' }} /> : <Copy size={12} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </TiltCard>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="mob-nav">
        {Object.entries(VAULT_CAT).slice(0, 5).map(([k, m]) => {
          const Ic = CAT_ICONS[k] ?? FolderOpen;
          return (
            <div key={k} onClick={() => setCat(k)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer', color: cat === k ? 'var(--act)' : 'var(--tx3)' }}>
              <Ic size={22} />
              <span style={{ fontSize: 9.5, fontWeight: 500 }}>{m.label.split(' ')[0]}</span>
            </div>
          );
        })}
      </div>

      {/* ═══ DETAIL MODAL ═══ */}
      {docView && (() => {
        const DI  = docIcon(docView.name, docView.cat);
        const cc  = VAULT_CAT[docView.cat]?.color ?? '#7B6FE8';
        const has = !!imgs[docView.id];
        return (
          <div className="mbg" onClick={() => setDocView(null)}>
            <div className="mbox si" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 13, background: `${cc}1A`, border: `1.5px solid ${cc}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cc, overflow: 'hidden' }}>
                    {has ? <img src={imgs[docView.id]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <DI size={22} />}
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 3px', fontSize: 17, fontWeight: 700, color: 'var(--tx)', fontFamily: "'Space Grotesk', sans-serif" }}>{docView.name}</h3>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--tx3)' }}>{docView.by}</p>
                  </div>
                </div>
                <button className="abic" onClick={() => setDocView(null)}><X size={18} /></button>
              </div>

              {has && <img src={imgs[docView.id]} style={{ width: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 10, background: 'var(--bg2)', marginBottom: 16 }} alt="Document" />}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                {[
                  { l: 'Category',   v: VAULT_CAT[docView.cat]?.label },
                  { l: 'Issue Date', v: fmtDate(docView.issued) },
                  { l: 'Expiry',     v: docView.expires ? fmtDate(docView.expires) : 'No expiry' },
                  { l: 'Status',     v: <Badge exp={docView.expires} /> },
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
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, flex: 1, color: 'var(--tx2)' }}>{docView.num}</span>
                  <button className="abtn abg" style={{ padding: '5px 11px', fontSize: 12, gap: 5 }} onClick={(e) => copyNum(e, docView.id, docView.num)}>
                    {cpId === docView.id ? <><Check size={12} />Copied</> : <><Copy size={12} />Copy</>}
                  </button>
                </div>
              </div>

              {docView.notes && (
                <div style={{ background: 'var(--sur2)', border: '1px solid var(--bd)', borderLeft: `3px solid ${cc}`, borderRadius: 10, padding: '11px 14px', marginBottom: 16 }}>
                  <div className="lbl" style={{ marginBottom: 4 }}>Notes</div>
                  <div style={{ fontSize: 13, color: 'var(--tx2)', lineHeight: 1.6 }}>{docView.notes}</div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, paddingTop: 18, borderTop: '1px solid var(--bd)' }}>
                <button className="abtn abg" style={{ flex: 1, justifyContent: 'center' }}><Pencil size={13} />Edit</button>
                <button className="abtn abd" onClick={() => deleteDoc(docView.id)}><Trash2 size={13} />Delete</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══ ADD MODAL ═══ */}
      {addOpen && (
        <div className="mbg" onClick={() => setAddOpen(false)}>
          <div className="mbox si" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--tx)', fontFamily: "'Space Grotesk', sans-serif" }}>Add Document</h3>
              <button className="abic" onClick={() => setAddOpen(false)}><X size={18} /></button>
            </div>

            <div className="tbar" style={{ marginBottom: 20 }}>
              <div className={`atab${addTab === 'scan' ? ' on' : ''}`} onClick={() => setAddTab('scan')}>
                <Sparkles size={12} style={{ display: 'inline', marginRight: 5, verticalAlign: '-1px' }} />Scan with AI
              </div>
              <div className={`atab${addTab === 'manual' ? ' on' : ''}`} onClick={() => setAddTab('manual')}>
                <Pencil size={12} style={{ display: 'inline', marginRight: 5, verticalAlign: '-1px' }} />Manual Entry
              </div>
            </div>

            {/* ── SCAN TAB ── */}
            {addTab === 'scan' && (
              <div>
                {/* Groq badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--acs)', border: '1px solid rgba(123,111,232,.25)', borderRadius: 9, padding: '8px 12px', marginBottom: 16 }}>
                  <Sparkles size={13} style={{ color: 'var(--ac1)', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--act)', flex: 1 }}>
                    Powered by <strong>Groq</strong> · {GROQ_VISION_MODEL} · Free tier
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--tx4)' }}>PNG/JPG/WEBP · max 4 MB</span>
                </div>

                {!file && !analyzing && (
                  <div
                    className={`uz${drag ? ' dg' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                    onDragLeave={() => setDrag(false)}
                    onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                    onClick={() => fileRef.current?.click()}
                  >
                    <div style={{ width: 54, height: 54, borderRadius: 14, background: 'linear-gradient(135deg, var(--ac1), var(--ac2))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', boxShadow: '0 4px 16px rgba(108,92,231,.3)' }}>
                      <Upload size={24} color="#fff" />
                    </div>
                    <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx2)', margin: '0 0 5px', fontFamily: "'Space Grotesk', sans-serif" }}>Drop your document here</p>
                    <p style={{ fontSize: 12, color: 'var(--tx3)', margin: '0 0 4px' }}>PNG, JPG or WEBP · max 4 MB</p>
                    <p style={{ fontSize: 11, color: 'var(--tx4)', margin: '0 0 18px' }}>For PDFs: take a screenshot first, then upload the image</p>
                    <button className="abtn abp" style={{ fontSize: 13 }}>Browse Files</button>
                    <input type="file" ref={fileRef} hidden accept=".png,.jpg,.jpeg,.webp" onChange={(e) => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />
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
                  <div style={{ background: 'var(--res)', border: '1px solid var(--re)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                    <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--ret)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AlertCircle size={14} />{aErr}
                    </p>
                    <button className="abtn abg" style={{ fontSize: 12, padding: '5px 11px' }} onClick={() => { setAErr(null); setAddTab('manual'); }}>
                      Fill in manually instead
                    </button>
                  </div>
                )}

                {analyzed && !analyzing && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--grs)', border: '1px solid rgba(52,211,153,.3)', borderRadius: 9, padding: '9px 13px', marginBottom: 14 }}>
                      <Check size={15} style={{ color: 'var(--gr)', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: 'var(--grt)', fontWeight: 500, flex: 1 }}>Groq analyzed successfully — review below.</span>
                      <button className="abic" style={{ width: 26, height: 26 }} onClick={() => { setFile(null); setFilePrev(null); setAnalyzed(false); }}><X size={13} /></button>
                    </div>
                    {filePrev && (
                      <img src={filePrev} style={{ width: '100%', maxHeight: 150, objectFit: 'contain', borderRadius: 10, marginBottom: 14, background: 'var(--bg2)', padding: 8 }} alt="" />
                    )}
                    <DocForm nd={nd} setNd={setNd} />
                  </div>
                )}
              </div>
            )}

            {addTab === 'manual' && <DocForm nd={nd} setNd={setNd} />}

            {(addTab === 'manual' || analyzed) && (
              <div style={{ display: 'flex', gap: 10, marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--bd)', justifyContent: 'flex-end' }}>
                <button className="abtn abg" onClick={() => setAddOpen(false)}>Cancel</button>
                <button className="abtn abp" onClick={saveDoc} disabled={!nd.name.trim() || !nd.num.trim()}>
                  <Check size={14} />Save & Encrypt
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ EMERGENCY MODAL ═══ */}
      {emOpen && (
        <div className="mbg" onClick={() => setEmOpen(false)}>
          <div className="mbox si" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--res)', border: '1.5px solid var(--re)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--re)' }}>
                  <Zap size={20} />
                </div>
                <div>
                  <h3 style={{ margin: '0 0 3px', fontSize: 17, fontWeight: 700, color: 'var(--tx)', fontFamily: "'Space Grotesk', sans-serif" }}>Emergency Card</h3>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--tx3)' }}>Present to medical staff · QR for quick access</p>
                </div>
              </div>
              <button className="abic" onClick={() => setEmOpen(false)}><X size={18} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'start', marginBottom: 16 }}>
              <div style={{ background: 'var(--res)', border: '1px solid rgba(248,113,113,.2)', borderRadius: 14, padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {[
                  { l: 'Blood Type',        v: <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--re)', fontFamily: "'Space Grotesk', sans-serif" }}>{EM.bloodType}</span> },
                  { l: 'Organ Donor',       v: EM.donor ? 'Yes ✓' : 'No' },
                  { l: 'Allergies',         v: EM.allergies.join(', ') },
                  { l: 'Medications',       v: EM.medications.join(', ') },
                  { l: 'Conditions',        v: EM.conditions.join(', ') },
                  { l: 'Emergency Contact', v: <div><div style={{ fontWeight: 600, fontSize: 13, color: 'var(--tx)' }}>{EM.contact.name}</div><div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--tx3)', marginTop: 2 }}>{EM.contact.phone}</div></div> },
                ].map((r) => (
                  <div key={r.l}>
                    <div className="lbl" style={{ marginBottom: 4 }}>{r.l}</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--tx2)' }}>{r.v}</div>
                  </div>
                ))}
              </div>

              <div style={{ textAlign: 'center', background: 'var(--bg2)', borderRadius: 12, padding: 10, border: '1px solid var(--bd)' }}>
                <img src={qrURL} width={155} height={155} alt="Emergency QR" style={{ display: 'block', borderRadius: 6 }} onError={(e) => { e.target.style.display = 'none'; }} />
                <p style={{ fontSize: 10, color: 'var(--tx4)', margin: '8px 0 0', fontWeight: 500 }}>Scan QR for<br />emergency info</p>
              </div>
            </div>

            <button className="abtn abd" style={{ width: '100%', justifyContent: 'center', padding: 11, fontSize: 14, fontWeight: 600 }}>
              <Share2 size={15} />Share Emergency Card
            </button>
          </div>
        </div>
      )}

      {/* ═══ TOAST ═══ */}
      {toast && (
        <div className="fa" style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', alignItems: 'center', gap: 8, background: toast.type === 'err' ? 'var(--re)' : 'var(--tx)', color: 'var(--bg)', padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600, zIndex: 200, boxShadow: 'var(--s4)' }}>
          {toast.type === 'err' ? <AlertCircle size={14} /> : <Check size={14} />}
          {toast.txt}
        </div>
      )}
    </div>
  );
}
