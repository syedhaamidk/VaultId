import { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck, Lock, Search, Sun, Moon, Plus, X,
  Upload, Trash2, Copy, Check, Clock, AlertCircle,
  Loader2, Zap, Share2, Pencil, Bell, ChevronRight,
  CreditCard, Activity, Wallet, Home, Scale,
  Sparkles, Shield, FolderOpen, Download, MoreVertical, Globe,
} from 'lucide-react';
import { Badge, TiltCard, DocForm, daysLeft, fmtDate, docIcon } from '../utils.jsx';
import { VAULT_CAT, DOCS0, EM }                                   from '../data.js';
import { tryUnlock, saveVault, changePin, exportLocalBlob, tryUnlockFromRemote } from '../crypto.js';
import {
  supabaseEnabled, signInWithGoogle, signOut, getCurrentUser,
  onAuthChange, pushVault, pullVault,
} from '../sync.js';

// ── AI document scanner ────────────────────────────────────────────────────────
// The actual Groq call + API key live server-side in /api/scan.js (Vercel
// serverless function). The browser only ever sends the image and gets back
// parsed fields — it never sees, holds, or can extract the Groq key.
async function scanDocumentWithAI(file) {
  // Build base64 data URL
  const b64 = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const dataUrl = `data:${file.type};base64,${b64}`;

  const res = await fetch('/api/scan', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ dataUrl, mimeType: file.type }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (data?.error === 'NO_SERVER_KEY') throw new Error('NO_KEY');
    throw new Error(data?.message ?? `Scan failed (${res.status})`);
  }
  return data;
}

// ── VaultApp ──────────────────────────────────────────────────────────────────
export default function VaultApp({ onBack }) {
  // ── theme / auth ──
  const [dark,      setDark]      = useState(true);
  const [sbCollapsed, setSbCollapsed] = useState(false);
  const [phase,     setPhase]     = useState('boot');  // boot | locked | unlocking | open
  const [pin,       setPin]       = useState('');
  const [pinErr,    setPinErr]    = useState(false);
  const [unlockOk,  setUnlockOk]  = useState(false);
  const [cryptoKey, setCryptoKey] = useState(null);
  const [failCount, setFailCount] = useState(0);
  const [lockedOut, setLockedOut] = useState(false);
  const [lockRemain,setLockRemain]= useState(0);

  // ── cloud sync / auth ──
  const [user,       setUser]       = useState(null);
  const [authBusy,   setAuthBusy]   = useState(false);
  const [syncing,    setSyncing]    = useState(false);
  const [syncErr,    setSyncErr]    = useState(null);

  // ── vault data ──
  const [docs, setDocs] = useState([]);
  const [imgs, setImgs] = useState({});

  // ── ui ──
  const [cat,        setCat]        = useState('all');
  const [q,          setQ]          = useState('');
  const [docView,    setDocView]    = useState(null);
  const [kebabOpen,  setKebabOpen]  = useState(false);
  const [addOpen,    setAddOpen]    = useState(false);
  const [emOpen,     setEmOpen]     = useState(false);
  const [pinModal,   setPinModal]   = useState(false);
  const [pinOld,     setPinOld]     = useState('');
  const [pinNew,     setPinNew]     = useState('');
  const [pinNew2,    setPinNew2]    = useState('');
  const [pinChErr,   setPinChErr]   = useState(null);
  const [pinChBusy,  setPinChBusy]  = useState(false);
  const [notifOpen,  setNotifOpen]  = useState(false);
  const [cpId,       setCpId]       = useState(null);
  const [toast,      setToast]      = useState(null);
  const [idleWarn,   setIdleWarn]   = useState(false);
  const idleTimer    = useRef(null);
  const idleWarnTimer= useRef(null);

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

  // ── Auth state ──────────────────────────────────────────────────────────────
  useEffect(() => {
    getCurrentUser().then(setUser);
    const unsub = onAuthChange(setUser);
    return unsub;
  }, []);

  async function handleGoogleSignIn() {
    setAuthBusy(true); setSyncErr(null);
    try {
      await signInWithGoogle();
      // Browser redirects for OAuth — execution typically doesn't continue past here.
    } catch (e) {
      setSyncErr(e.message === 'SUPABASE_NOT_CONFIGURED'
        ? 'Cloud sync isn\'t configured yet — add VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY to .env'
        : `Sign-in failed: ${e.message}`);
      setAuthBusy(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    setUser(null);
    showToast('Signed out — vault stays local-only');
  }

  // ── Auto-lock on idle ───────────────────────────────────────────────────────
  // Warn at 4 min idle, lock at 5 min. Resets on any mouse/keyboard/touch
  // activity. Only runs while the vault is unlocked — a left-open device
  // with sensitive docs visible is the realistic risk this addresses.
  useEffect(() => {
    if (phase !== 'open') return;

    const WARN_MS = 4 * 60 * 1000;
    const LOCK_MS = 5 * 60 * 1000;

    function resetIdle() {
      setIdleWarn(false);
      clearTimeout(idleTimer.current);
      clearTimeout(idleWarnTimer.current);
      idleWarnTimer.current = setTimeout(() => setIdleWarn(true), WARN_MS);
      idleTimer.current = setTimeout(() => {
        setPhase('locked'); setCryptoKey(null); setDocs([]); setImgs({}); setIdleWarn(false);
      }, LOCK_MS);
    }

    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, resetIdle));
    resetIdle();

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, resetIdle));
      clearTimeout(idleTimer.current);
      clearTimeout(idleWarnTimer.current);
    };
  }, [phase]);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const showToast = (txt, type = 'ok') => {
    setToast({ txt, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── PIN ───────────────────────────────────────────────────────────────────
  // On a fresh device with no local vault yet, but a signed-in user with an
  // existing cloud vault, try the remote copy first. Otherwise fall back to
  // the normal local unlock (which also handles first-run/demo seeding).
  async function resolveUnlock(np) {
    const hasLocalVault = !!localStorage.getItem('vid_vault');
    if (!hasLocalVault && user && supabaseEnabled) {
      const remote = await pullVault(user.id);
      if (remote.ok && remote.found) {
        const r = await tryUnlockFromRemote(np, { saltB64: remote.salt, enc: remote.enc });
        if (r.ok) return r;
        // Wrong PIN against the remote vault — don't fall through to a
        // fresh local vault, that would silently mask the real error.
        return { ok: false };
      }
    }
    return tryUnlock(np, DOCS0);
  }

  const PIN_LEN = 6;
  async function pressKey(k) {
    if (phase === 'unlocking' || lockedOut) return;
    if (pin.length >= PIN_LEN) return;
    const np = pin + k;
    setPin(np);
    if (np.length !== PIN_LEN) return;

    setPhase('unlocking');
    setTimeout(async () => {
      const res = await resolveUnlock(np);
      if (res.ok) {
        setFailCount(0);
        setCryptoKey(res.key);
        setDocs(res.docs);
        setImgs(res.imgs);
        setUnlockOk(true);
        setTimeout(() => { setPhase('open'); setPin(''); setUnlockOk(false); }, 550);
      } else {
        const nextFail = failCount + 1;
        setFailCount(nextFail);
        setPinErr(true);

        if (nextFail >= 5) {
          // Lock out for 30s after 5 wrong attempts — slows down anyone
          // guessing through the UI. Doesn't stop someone attacking the
          // raw localStorage data directly, but raises the bar for the
          // common case (someone picking up an unlocked/left-open device).
          const seconds = 30;
          setLockedOut(true);
          setLockRemain(seconds);
          const iv = setInterval(() => {
            setLockRemain((s) => {
              if (s <= 1) { clearInterval(iv); setLockedOut(false); setFailCount(0); return 0; }
              return s - 1;
            });
          }, 1000);
        }

        setTimeout(() => { setPin(''); setPinErr(false); setPhase('locked'); }, 700);
      }
    }, 80);
  }

  // ── Vault persistence ─────────────────────────────────────────────────────
  async function persist(newDocs, newImgs) {
    if (!cryptoKey) return;
    await saveVault(newDocs, newImgs, cryptoKey);

    // Mirror to cloud if signed in — best-effort, never blocks the local save.
    if (user && supabaseEnabled) {
      setSyncing(true);
      const blob = exportLocalBlob();
      if (blob) {
        const res = await pushVault(user.id, blob.saltB64, blob.enc);
        if (!res.ok) setSyncErr(`Cloud sync failed: ${res.reason}`);
        else setSyncErr(null);
      }
      setSyncing(false);
    }
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
        ? 'Add GROQ_API_KEY to your server environment (Vercel project settings → Environment Variables) — free at console.groq.com'
        : `Scan failed: ${err.message}. Try manual entry below.`;
      setAErr(msg);
      setAddTab('manual');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handlePinChange() {
    setPinChErr(null);
    if (!/^\d{6}$/.test(pinNew)) return setPinChErr('New PIN must be exactly 6 digits.');
    if (pinNew !== pinNew2)      return setPinChErr('New PIN entries don\'t match.');
    if (pinNew === pinOld)       return setPinChErr('New PIN must differ from the old one.');

    setPinChBusy(true);
    const res = await changePin(pinOld, pinNew);
    setPinChBusy(false);

    if (!res.ok) {
      setPinChErr(res.reason === 'WRONG_PIN' ? 'Current PIN is incorrect.' : 'Could not change PIN.');
      return;
    }
    setCryptoKey(res.key);
    setPinModal(false);
    setPinOld(''); setPinNew(''); setPinNew2('');
    showToast('PIN changed successfully');
  }

  function openPinModal() {
    setPinOld(''); setPinNew(''); setPinNew2(''); setPinChErr(null);
    setPinModal(true);
  }

  // ── Download helpers ─────────────────────────────────────────────────────
  function downloadJPEG(doc) {
    const dataUrl = imgs[doc.id];
    if (!dataUrl) return showToast('No image attached to this document', 'err');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${doc.name.replace(/[^a-z0-9]+/gi, '_')}.jpg`;
    document.body.appendChild(a); a.click(); a.remove();
    showToast('Downloaded as JPEG');
  }

  async function downloadPDF(doc) {
    const dataUrl = imgs[doc.id];
    if (!dataUrl) return showToast('No image attached to this document', 'err');
    try {
      // jsPDF loaded on-demand from CDN — keeps it out of the main bundle
      // since most sessions never trigger a PDF download.
      const { jsPDF } = await import('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm');
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });

      const pdf = new jsPDF({ orientation: img.width > img.height ? 'landscape' : 'portrait', unit: 'pt' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pageW / img.width, pageH / img.height) * 0.92;
      const w = img.width * ratio, h = img.height * ratio;
      pdf.addImage(dataUrl, 'JPEG', (pageW - w) / 2, (pageH - h) / 2, w, h);
      pdf.save(`${doc.name.replace(/[^a-z0-9]+/gi, '_')}.pdf`);
      showToast('Downloaded as PDF');
    } catch (e) {
      showToast('PDF export failed — check connection', 'err');
    }
  }


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
              {Array.from({ length: PIN_LEN }).map((_, i) => (
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

            {lockedOut && <p style={{ color: 'var(--re)', fontSize: 12, marginTop: 14, fontWeight: 600 }}>Too many attempts — try again in {lockRemain}s</p>}
            {!lockedOut && pinErr   && <p style={{ color: 'var(--re)', fontSize: 12, marginTop: 14, fontWeight: 500 }}>Incorrect PIN — try again</p>}
            {unlockOk && <p style={{ color: 'var(--gr)', fontSize: 12, marginTop: 14, fontWeight: 600 }}>Unlocked ✓</p>}

            {import.meta.env.VITE_DEMO_MODE === 'true' && (
              <p style={{ color: 'var(--tx4)', fontSize: 11, marginTop: 20 }}>
                Demo PIN: <code style={{ color: 'var(--act)', fontFamily: "'JetBrains Mono', monospace" }}>123456</code>
              </p>
            )}
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
      <aside className={`asidebar${sbCollapsed ? ' collapsed' : ''}`} style={{ width: sbCollapsed ? 64 : 215, background: 'var(--gl)', backdropFilter: 'blur(20px)', borderRight: '1px solid var(--bd)', padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0, overflowY: 'auto' }}>
        <div style={{ padding: '8px 10px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, var(--ac1), var(--ac2))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ShieldCheck size={17} color="#fff" />
          </div>
          <span className="gtext sb-logo-text" style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-.4px', fontFamily: "'Space Grotesk', sans-serif", flex: 1 }}>VaultID</span>
          {!sbCollapsed && (
            <button className="sb-collapse-btn" onClick={() => setSbCollapsed(true)} title="Collapse sidebar">
              <ChevronRight size={13} style={{ transform: 'rotate(180deg)' }} />
            </button>
          )}
        </div>
        {sbCollapsed && (
          <button className="sb-collapse-btn" style={{ margin: '0 auto 10px' }} onClick={() => setSbCollapsed(false)} title="Expand sidebar">
            <ChevronRight size={13} />
          </button>
        )}

        <p className="lbl sb-label" style={{ padding: '0 10px 6px' }}>Library</p>
        {Object.entries(VAULT_CAT).map(([k, m]) => {
          const Ic  = CAT_ICONS[k] ?? FolderOpen;
          const cnt = k === 'all' ? docs.length : docs.filter((d) => d.cat === k).length;
          return (
            <div key={k} className={`anv${cat === k ? ' on' : ''}`} onClick={() => setCat(k)} title={sbCollapsed ? m.label : undefined}>
              <Ic size={15} /><span style={{ flex: 1 }}>{m.label}</span>
              <span className="cnt">{cnt}</span>
            </div>
          );
        })}

        <div className="divr" />
        <div className="anv danger" onClick={() => setEmOpen(true)} title={sbCollapsed ? 'Emergency Card' : undefined}>
          <Zap size={15} /><span style={{ flex: 1 }}>Emergency Card</span><ChevronRight size={13} />
        </div>
        <div className="anv" onClick={() => setNotifOpen((o) => !o)} title={sbCollapsed ? 'Alerts' : undefined}>
          <Bell size={15} /><span style={{ flex: 1 }}>Alerts</span>
          {notifs.length > 0 && (
            <span style={{ background: 'var(--re)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20 }}>
              {notifs.length}
            </span>
          )}
        </div>
        <div className="anv" onClick={openPinModal} title={sbCollapsed ? 'Change PIN' : undefined}>
          <Lock size={15} /><span style={{ flex: 1 }}>Change PIN</span>
        </div>

        <div style={{ flex: 1 }} />
        <div className="divr" />

        {supabaseEnabled && (
          user ? (
            <div className="anv" style={{ cursor: 'default' }} title={sbCollapsed ? user.email : undefined}>
              {user.user_metadata?.avatar_url
                ? <img src={user.user_metadata.avatar_url} alt="" style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0 }} />
                : <Globe size={15} />}
              <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.email}
              </span>
              {syncing
                ? <Loader2 size={12} className="spin" style={{ color: 'var(--tx3)' }} />
                : <span title="Synced"><Check size={12} style={{ color: 'var(--gr)' }} /></span>}
            </div>
          ) : (
            <div className="anv" onClick={handleGoogleSignIn} title={sbCollapsed ? 'Sign in with Google' : undefined}>
              {authBusy ? <Loader2 size={15} className="spin" /> : <Globe size={15} />}
              <span style={{ flex: 1 }}>{authBusy ? 'Signing in…' : 'Sign in with Google'}</span>
            </div>
          )
        )}
        {user && (
          <div className="anv" onClick={handleSignOut} title={sbCollapsed ? 'Sign out' : undefined}>
            <X size={15} /><span style={{ flex: 1, fontSize: 13 }}>Sign Out</span>
          </div>
        )}
        {syncErr && !sbCollapsed && (
          <p style={{ fontSize: 10.5, color: 'var(--re)', padding: '2px 10px 4px', lineHeight: 1.4 }}>{syncErr}</p>
        )}

        {onBack && (
          <div className="anv" style={{ color: 'var(--tx3)' }} onClick={onBack} title={sbCollapsed ? 'Back to Site' : undefined}>
            <ChevronRight size={15} style={{ transform: 'rotate(180deg)' }} />
            <span style={{ flex: 1, fontSize: 13 }}>Back to Site</span>
          </div>
        )}
        <div
          className="anv"
          style={{ color: 'var(--tx3)' }}
          title={sbCollapsed ? 'Lock Vault' : undefined}
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
                  <TiltCard key={doc.id} onClick={() => { setDocView(doc); setKebabOpen(false); }}>
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
                <button className="abic" onClick={() => { setDocView(null); setKebabOpen(false); }}><X size={18} /></button>
              </div>

              {has ? (
                <img src={imgs[docView.id]} style={{ width: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 10, background: 'var(--bg2)', marginBottom: 16 }} alt="Document" />
              ) : (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                  <span className="no-img-tag"><AlertCircle size={11} />No image attached</span>
                </div>
              )}

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
                <div className="kebab-menu">
                  <button className="abic" style={{ border: '1px solid var(--bd)' }} onClick={() => setKebabOpen((o) => !o)} title="More actions">
                    <MoreVertical size={16} />
                  </button>
                  {kebabOpen && (
                    <>
                      <div style={{ position: 'fixed', inset: 0, zIndex: 19 }} onClick={() => setKebabOpen(false)} />
                      <div className="kebab-pop">
                        {has && (
                          <>
                            <div className="kebab-item" onClick={() => { downloadJPEG(docView); setKebabOpen(false); }}>
                              <Download size={14} />Download as JPEG
                            </div>
                            <div className="kebab-item" onClick={() => { downloadPDF(docView); setKebabOpen(false); }}>
                              <Download size={14} />Download as PDF
                            </div>
                          </>
                        )}
                        <div className="kebab-item danger" onClick={() => { deleteDoc(docView.id); setKebabOpen(false); }}>
                          <Trash2 size={14} />Delete document
                        </div>
                      </div>
                    </>
                  )}
                </div>
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
                    Powered by <strong>Groq</strong> · Free tier
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
                  <div style={{ textAlign: 'center', background: 'var(--res)', border: '1px solid var(--re)', borderRadius: 12, padding: '20px 16px', marginBottom: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(248,113,113,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', color: 'var(--re)' }}>
                      <AlertCircle size={20} />
                    </div>
                    <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--ret)', fontWeight: 600 }}>{aErr}</p>
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

      {/* ═══ CHANGE PIN MODAL ═══ */}
      {pinModal && (
        <div className="mbg" onClick={() => setPinModal(false)}>
          <div className="mbox si" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--tx)', fontFamily: "'Space Grotesk', sans-serif" }}>Change PIN</h3>
              <button className="abic" onClick={() => setPinModal(false)}><X size={18} /></button>
            </div>

            {pinChErr && (
              <div style={{ background: 'var(--res)', border: '1px solid var(--re)', borderRadius: 10, padding: '10px 13px', marginBottom: 14, fontSize: 13, color: 'var(--ret)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={14} />{pinChErr}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label>
                <div className="lbl" style={{ marginBottom: 5 }}>Current PIN</div>
                <input
                  type="password" inputMode="numeric" maxLength={6}
                  value={pinOld} onChange={(e) => setPinOld(e.target.value.replace(/\D/g, ''))}
                  className="ainp" style={{ width: '100%', letterSpacing: 4, fontFamily: "'JetBrains Mono', monospace" }}
                />
              </label>
              <label>
                <div className="lbl" style={{ marginBottom: 5 }}>New PIN (6 digits)</div>
                <input
                  type="password" inputMode="numeric" maxLength={6}
                  value={pinNew} onChange={(e) => setPinNew(e.target.value.replace(/\D/g, ''))}
                  className="ainp" style={{ width: '100%', letterSpacing: 4, fontFamily: "'JetBrains Mono', monospace" }}
                />
              </label>
              <label>
                <div className="lbl" style={{ marginBottom: 5 }}>Confirm New PIN</div>
                <input
                  type="password" inputMode="numeric" maxLength={6}
                  value={pinNew2} onChange={(e) => setPinNew2(e.target.value.replace(/\D/g, ''))}
                  className="ainp" style={{ width: '100%', letterSpacing: 4, fontFamily: "'JetBrains Mono', monospace" }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--bd)', justifyContent: 'flex-end' }}>
              <button className="abtn abg" onClick={() => setPinModal(false)}>Cancel</button>
              <button className="abtn abp" onClick={handlePinChange} disabled={pinChBusy}>
                {pinChBusy ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                {pinChBusy ? 'Re-encrypting…' : 'Save New PIN'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ IDLE AUTO-LOCK WARNING ═══ */}
      {idleWarn && phase === 'open' && (
        <div className="idle-warn">
          <Clock size={14} />
          Vault will auto-lock in 1 minute due to inactivity
          <button onClick={() => setIdleWarn(false)}>I'm still here</button>
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
