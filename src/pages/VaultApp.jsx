import { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck, Lock, Search, Sun, Moon, Plus, X,
  Upload, Trash2, Copy, Check, Clock, AlertCircle,
  Loader2, Zap, Share2, Pencil, Bell, ChevronRight,
  CreditCard, Activity, Wallet, Home, Scale,
  Sparkles, Shield, FolderOpen, Download, MoreVertical, Globe, LogOut,
} from 'lucide-react';
import { Badge, TiltCard, DocForm, daysLeft, fmtDate, docIcon } from '../utils.jsx';
import { VAULT_CAT, DOCS0, EMPTY_EMERGENCY, DEMO_EMERGENCY, DEMO_PIN } from '../data.js';
import { tryUnlock, saveVault, changePin, exportLocalBlob, markVaultSynced, tryUnlockFromRemote, KDF_ITERATIONS, getVaultVersion, upgradeV1ToV2, clearV1Backup, hasV1Backup, createVaultV2, tryUnlockV2FromRemote } from '../crypto.js';
import { syncVault } from '../sync.js';
import PassphraseSetup from '../components/PassphraseSetup.jsx';
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
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('The scanner returned an invalid response. Try manual entry below.');
  }
  return data;
}

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';
const CLIPBOARD_CLEAR_MS = 30_000;
// Lock if the tab has been hidden this long. Not immediate: mobile file/camera
// pickers and OS share sheets briefly hide the page mid-flow.
const HIDDEN_LOCK_MS = 60_000;
const MAX_IMAGE_BYTES = 2_500_000;
const MAX_IMAGE_LABEL = '2.5 MB';
const EMPTY_FORM = {
  name: '', cat: 'identity', num: '', by: '', issued: '', expires: '', notes: '',
};

const cloneEmergency = (value = {}) => ({
  bloodType: value.bloodType || '',
  allergies: Array.isArray(value.allergies) ? [...value.allergies] : [],
  medications: Array.isArray(value.medications) ? [...value.medications] : [],
  conditions: Array.isArray(value.conditions) ? [...value.conditions] : [],
  contact: { name: value.contact?.name || '', phone: value.contact?.phone || '' },
  donor: Boolean(value.donor),
});

const listFromText = (value) => value.split(',').map((item) => item.trim()).filter(Boolean);
const initialEmergency = () => cloneEmergency(DEMO_MODE ? DEMO_EMERGENCY : EMPTY_EMERGENCY);

// ── VaultApp ──────────────────────────────────────────────────────────────────
export default function VaultApp({ onBack }) {
  // ── theme / auth ──
  const [dark,      setDark]      = useState(true);
  const [sbCollapsed, setSbCollapsed] = useState(false);
  const [phase,     setPhase]     = useState('boot');  // boot | locked | unlocking | open
  const [pin,       setPin]       = useState('');
  const [pinErr,    setPinErr]    = useState(false);
  const [unlockErr, setUnlockErr] = useState(null);
  const [unlockOk,  setUnlockOk]  = useState(false);
  const [cryptoKey, setCryptoKey] = useState(null);
  const [kdfIterations, setKdfIterations] = useState(KDF_ITERATIONS);
  const [failCount, setFailCount] = useState(0);
  const [lockedOut, setLockedOut] = useState(false);
  const [lockRemain,setLockRemain]= useState(0);
  const [vaultVersion, setVaultVersion] = useState('none'); // none | v1 | v2
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [showPassphraseSetup, setShowPassphraseSetup] = useState(false);
  const [passphraseInput, setPassphraseInput] = useState('');

  // ── cloud sync / auth ──
  const [user,       setUser]       = useState(null);
  const [authBusy,   setAuthBusy]   = useState(false);
  const [syncing,    setSyncing]    = useState(false);
  const [syncErr,    setSyncErr]    = useState(null);
  const [syncBlocked, setSyncBlocked] = useState(false);
  const [editingId,  setEditingId]  = useState(null);
  const [qrDataUrl,  setQrDataUrl]  = useState(null);
  const [qrError,    setQrError]    = useState(false);

  // ── vault data ──
  const [docs, setDocs] = useState([]);
  const [imgs, setImgs] = useState({});
  const [emergency, setEmergency] = useState(() => initialEmergency());
  const [emDraft, setEmDraft] = useState(() => initialEmergency());
  const [emEditing, setEmEditing] = useState(false);
  const [emSaving, setEmSaving] = useState(false);

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
  const clipboardTimer = useRef(null);
  const clipboardDirty = useRef(false);
  const hiddenAtRef   = useRef(null);

  // ── add-document modal ──
  const [addTab,     setAddTab]     = useState('scan');
  const [file,       setFile]       = useState(null);
  const [filePrev,   setFilePrev]   = useState(null);
  const [analyzing,  setAnalyzing]  = useState(false);
  const [analyzed,   setAnalyzed]   = useState(false);
  const [aErr,       setAErr]       = useState(null);
  const [savingDoc,  setSavingDoc]  = useState(false);
  const [drag,       setDrag]       = useState(false);
  const [nd, setNd] = useState({
    name: '', cat: 'identity', num: '', by: '', issued: '', expires: '', notes: '',
  });
  const fileRef = useRef(null);
  const modalRef = useRef(null);
  const cloudReadyRef = useRef(false);
  const userIdRef = useRef(null);
  const mutationBusyRef = useRef(false);
  const persistQueueRef = useRef(Promise.resolve());
  const pinRef = useRef(null);

  // Boot delay
  useEffect(() => {
    const timer = setTimeout(() => setPhase('locked'), 300);
    return () => clearTimeout(timer);
  }, []);

  // Detect the vault version on mount (no secret needed).
  useEffect(() => {
    setVaultVersion(getVaultVersion());
  }, []);

  // ── Auth state ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((currentUser) => {
        if (!active) return;
        if (userIdRef.current && !currentUser) return;
        userIdRef.current = currentUser?.id || null;
        setUser(currentUser);
        setAuthBusy(false);
      })
      .catch(() => {
        if (active) setAuthBusy(false);
      });
    const unsub = onAuthChange((nextUser) => {
      const previousId = userIdRef.current;
      const nextId = nextUser?.id || null;
      const accountChanged = previousId !== nextId;
      userIdRef.current = nextId;
      setUser(nextUser);
      setAuthBusy(false);
      if (accountChanged) {
        cloudReadyRef.current = false;
        if (!nextUser) {
          setSyncBlocked(false);
          setSyncErr(null);
        }
      }
    });
    return () => {
      active = false;
      unsub();
    };
  }, []);

  // If an account becomes known while a local vault is already open, check
  // the cloud before allowing any local write. A remote row is never silently
  // overwritten by a device-local vault.
  useEffect(() => {
    if (!user || !supabaseEnabled || phase !== 'open' || cloudReadyRef.current) return;
    let cancelled = false;

    (async () => {
      setSyncing(true);
      const remote = await pullVault(user.id);
      if (cancelled) return;
      setSyncing(false);

      if (!remote.ok) {
        setSyncBlocked(true);
        setSyncErr(`Cloud check failed: ${remote.reason}`);
        return;
      }
      if (remote.found) {
        setSyncBlocked(true);
        setSyncErr('A cloud vault exists. Lock and unlock with its PIN before syncing changes.');
        return;
      }

      cloudReadyRef.current = true;
      setSyncBlocked(false);
      setSyncErr(null);
    })();

    return () => { cancelled = true; };
  }, [user?.id, phase]);

  // Keep keyboard users on the active dialog and close it with Escape.
  useEffect(() => {
    const modalOpen = Boolean(docView || addOpen || emOpen || pinModal);
    if (!modalOpen) return;

    const previousFocus = document.activeElement;
    const frame = requestAnimationFrame(() => modalRef.current?.focus());
    const closeTopModal = () => {
      if (pinModal) setPinModal(false);
      else if (addOpen) setAddOpen(false);
      else if (emOpen) setEmOpen(false);
      else if (docView) setDocView(null);
      setKebabOpen(false);
    };

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeTopModal();
        return;
      }
      if (event.key !== 'Tab') return;

      const node = modalRef.current;
      if (!node) return;
      const focusable = [...node.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((element) => element.offsetParent !== null);
      if (!focusable.length) {
        event.preventDefault();
        node.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [docView, addOpen, emOpen, pinModal]);

  // Generate the emergency QR locally. No medical/contact data is sent to a
  // third-party QR service.
  useEffect(() => {
    let cancelled = false;
    setQrDataUrl(null);
    setQrError(false);
    if (!emOpen) return undefined;

    import('qrcode')
      .then((module) => {
        const QRCode = module.default || module;
        const payload = JSON.stringify({
          type: 'vaultid-emergency',
          bloodType: emergency.bloodType,
          allergies: emergency.allergies,
          medications: emergency.medications,
          conditions: emergency.conditions,
          contact: emergency.contact,
          donor: emergency.donor,
        });
        return QRCode.toDataURL(payload, {
          errorCorrectionLevel: 'M',
          margin: 2,
          width: 310,
          color: { dark: '#0A0A20', light: '#FFFFFF' },
        });
      })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrError(true);
      });

    return () => { cancelled = true; };
  }, [emOpen, emergency]);

  // Physical number keys and Backspace mirror the on-screen PIN keypad.
  useEffect(() => {
    if (phase === 'open' || phase === 'boot') return undefined;
    const onKeyDown = (event) => {
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        pressKey(event.key);
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        setPin((value) => value.slice(0, -1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, pin, lockedOut]);

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
    cloudReadyRef.current = false;
    setSyncBlocked(false);
    setSyncErr(null);
    showToast('Signed out — vault stays local-only');
  }

  function lockVault() {
    clearClipboardNow();
    setPhase('locked');
    setCryptoKey(null);
    setKdfIterations(KDF_ITERATIONS);
    setDocs([]);
    setImgs({});
    setEmergency(cloneEmergency(EMPTY_EMERGENCY));
    setEmDraft(cloneEmergency(EMPTY_EMERGENCY));
    setEmOpen(false);
    setEmEditing(false);
    setDocView(null);
    setAddOpen(false);
    setPinModal(false);
    setKebabOpen(false);
    setPinErr(false);
    setUnlockErr(null);
    setPin('');
    setIdleWarn(false);
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
        lockVault();
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

  // ── Lock after the tab has been hidden a while ────────────────────────────
  // Background timers are throttled, so compare timestamps on return rather
  // than trusting a setTimeout that may not have fired.
  useEffect(() => {
    if (phase !== 'open') return;
    hiddenAtRef.current = null;

    function onVisibility() {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
      } else if (hiddenAtRef.current !== null) {
        const away = Date.now() - hiddenAtRef.current;
        hiddenAtRef.current = null;
        if (away >= HIDDEN_LOCK_MS) lockVault();
      }
    }

    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [phase]);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const showToast = (txt, type = 'ok') => {
    setToast({ txt, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Unlock ─────────────────────────────────────────────────────────────────
  // Prefer the cloud copy when the account is known, but never overwrite a
  // device that contains unsynced local changes. Uses the syncVault conflict
  // matrix to determine the correct action for each local × remote combination.
  async function resolveUnlock(np) {
    const fallbackDocs = DEMO_MODE ? DOCS0 : [];

    if (user && supabaseEnabled) {
      setSyncing(true);
      const remote = await pullVault(user.id);
      setSyncing(false);

      if (!remote.ok) {
        cloudReadyRef.current = false;
        setSyncBlocked(true);
        setSyncErr(`Cloud check failed: ${remote.reason}`);
        return tryUnlock(np, fallbackDocs, initialEmergency());
      }

      if (remote.found) {
        // Determine local vault info for the conflict matrix.
        const localVersion = getVaultVersion();
        const localBlob = exportLocalBlob();
        const localInfo = {
          version: localVersion,
          dirty: localBlob?.dirty ?? false,
          updatedAt: localBlob?.updatedAt,
          rev: localVersion === 'v2' ? (JSON.parse(localStorage.getItem('vid_vault'))?.rev ?? 0) : undefined,
        };
        const remoteInfo = {
          found: true,
          version: remote.version,
          updatedAt: remote.updatedAt,
          rev: remote.version === 'v2' ? (JSON.parse(remote.blob.blob)?.rev ?? 0) : undefined,
        };

        const { action } = syncVault(localInfo, remoteInfo);

        if (action === 'keep-local') {
          // Never overwrite unsynced local data.
          cloudReadyRef.current = false;
          setSyncBlocked(true);
          setSyncErr('This device has unsynced changes. The cloud vault was not overwritten.');
          return tryUnlock(np, fallbackDocs, initialEmergency());
        }

        if (action === 'upgrade') {
          // v1 device, v2 remote — prompt to upgrade.
          cloudReadyRef.current = false;
          setSyncBlocked(true);
          setSyncErr('A newer vault format is available. Upgrade this device to sync.');
          return tryUnlock(np, fallbackDocs, initialEmergency());
        }

        if (action === 'warn-stale-v1') {
          // v2 device, v1 remote with newer data — don't overwrite.
          cloudReadyRef.current = false;
          setSyncBlocked(true);
          setSyncErr('A device with the old format has newer data. Upgrade that device to sync.');
          return tryUnlock(np, fallbackDocs, initialEmergency());
        }

        // action === 'pull' — unlock from the remote.
        if (remote.version === 'v2') {
          const result = await tryUnlockV2FromRemote(np, remote.blob);
          if (result.ok) {
            cloudReadyRef.current = true;
            setSyncBlocked(false);
            setSyncErr(null);
          }
          return result;
        }

        // v1 remote.
        const remoteBlob = {
          saltB64: remote.blob.saltB64,
          enc: remote.blob.encBlob,
          updatedAt: remote.updatedAt,
        };
        const result = await tryUnlockFromRemote(np, remoteBlob);
        if (result.ok) {
          cloudReadyRef.current = true;
          setSyncBlocked(false);
          setSyncErr(null);
        }
        return result;
      }

      cloudReadyRef.current = true;
      setSyncBlocked(false);
      setSyncErr(null);
    }

    return tryUnlock(np, fallbackDocs, initialEmergency());
  }

  const PIN_LEN = 6;
  async function pressKey(k) {
    if (phase === 'unlocking' || lockedOut) return;
    if (pin.length >= PIN_LEN) return;
    setUnlockErr(null);
    const np = pin + k;
    setPin(np);
    if (np.length !== PIN_LEN) return;

    setPhase('unlocking');
    setTimeout(async () => {
      const res = await resolveUnlock(np);
      if (res.ok) {
        setFailCount(0);
        setCryptoKey(res.key);
        setKdfIterations(res.kdfIterations || KDF_ITERATIONS);
        setDocs(res.docs);
        setImgs(res.imgs);
        setUnlockErr(null);
        setEmergency(cloneEmergency(res.emergency || initialEmergency()));
        setEmDraft(cloneEmergency(res.emergency || initialEmergency()));
        setUnlockOk(true);
        pinRef.current = np;
        // Offer the v1 → v2 upgrade after a successful v1 unlock.
        if (vaultVersion === 'v1') setShowUpgradePrompt(true);
        setTimeout(() => { setPhase('open'); setPin(''); setUnlockOk(false); }, 550);
      } else {
        if (res.reason === 'STORAGE_WRITE_FAILED') {
          setPinErr(false);
          setUnlockErr('Local storage is full or unavailable. Free space and try again.');
          setPin('');
          setPhase('locked');
          return;
        }
        const nextFail = failCount + 1;
        setFailCount(nextFail);
        setPinErr(true);

        if (nextFail >= 5) {
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

  // ── v2 passphrase submit ─────────────────────────────────────────────────
  async function handlePassphraseSubmit() {
    if (phase === 'unlocking' || !passphraseInput) return;
    setPhase('unlocking');
    setUnlockErr(null);
    const pp = passphraseInput;
    setPassphraseInput('');

    const res = await resolveUnlock(pp);
    if (res.ok) {
      setFailCount(0);
      setCryptoKey(res.key);
      setKdfIterations(res.kdfIterations || KDF_ITERATIONS);
      setDocs(res.docs);
      setImgs(res.imgs);
      setUnlockErr(null);
      setEmergency(cloneEmergency(res.emergency || initialEmergency()));
      setEmDraft(cloneEmergency(res.emergency || initialEmergency()));
      setUnlockOk(true);
      // Clear the v1 backup on a successful v2 unlock in a fresh session.
      if (hasV1Backup()) clearV1Backup();
      setTimeout(() => { setPhase('open'); setUnlockOk(false); }, 550);
    } else {
      setUnlockErr('Incorrect passphrase — try again');
      setPhase('locked');
    }
  }

  // ── Vault persistence ─────────────────────────────────────────────────────
  async function pushEncryptedBlob(blob) {
    if (!user || !supabaseEnabled || !blob) {
      return { ok: true, skipped: true };
    }
    if (syncBlocked || !cloudReadyRef.current) {
      return { ok: false, skipped: true, reason: syncBlocked ? 'SYNC_BLOCKED' : 'SYNC_NOT_READY' };
    }

    setSyncing(true);
    const result = await pushVault(user.id, blob, blob.updatedAt);
    setSyncing(false);
    if (!result.ok) {
      setSyncErr(`Cloud sync failed: ${result.reason}`);
      return { ok: false, reason: result.reason };
    }
    cloudReadyRef.current = true;
    markVaultSynced();
    setSyncErr(null);
    return { ok: true };
  }

  function persist(newDocs, newImgs, emergencyToSave = emergency) {
    const key = cryptoKey;
    const run = async () => {
      if (!key) return { ok: false, reason: 'VAULT_LOCKED' };

      const local = await saveVault(newDocs, newImgs, key, emergencyToSave, kdfIterations);
      if (!local.ok) {
        return { ok: false, reason: local.reason, localSaved: false };
      }

      const cloud = await pushEncryptedBlob(local.blob || exportLocalBlob());
      return {
        ok: true,
        localSaved: true,
        cloudSynced: !user || !supabaseEnabled || cloud.ok,
        cloudSkipped: cloud.skipped || false,
        cloudReason: cloud.reason,
      };
    };

    // Serialize writes so rapid edits cannot finish out of order and leave the
    // cloud with an older snapshot than localStorage.
    const next = persistQueueRef.current.then(run, run);
    persistQueueRef.current = next.catch(() => {});
    return next;
  }

  // ── Clipboard auto-clear ──────────────────────────────────────────────────
  // Best-effort: browsers only allow writeText while the page is focused, so
  // this can silently fail if the user has switched away. lockVault() also
  // triggers an immediate attempt. It overwrites unconditionally — reading the
  // clipboard first would need an extra permission prompt.
  function clearClipboardNow() {
    clearTimeout(clipboardTimer.current);
    clipboardTimer.current = null;
    if (!clipboardDirty.current) return;
    clipboardDirty.current = false;
    navigator.clipboard?.writeText('').catch(() => {});
  }
  function scheduleClipboardClear() {
    clipboardDirty.current = true;
    clearTimeout(clipboardTimer.current);
    clipboardTimer.current = setTimeout(clearClipboardNow, CLIPBOARD_CLEAR_MS);
  }

  // ── Copy number ───────────────────────────────────────────────────────────
  async function copyNum(e, id, num) {
    e.stopPropagation();
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(num);
      setCpId(id);
      setTimeout(() => setCpId(null), 2000);
      showToast(`Copied — clipboard clears in ${CLIPBOARD_CLEAR_MS / 1000}s`);
      scheduleClipboardClear();
    } catch {
      showToast('Could not access the clipboard', 'err');
    }
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
    if (f.size > MAX_IMAGE_BYTES) {
      setAErr(`File too large — the secure upload limit is ${MAX_IMAGE_LABEL}. Please compress or crop the image.`);
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
    if (user && supabaseEnabled && syncBlocked) {
      return setPinChErr('Cloud sync is blocked until the existing cloud vault is unlocked.');
    }

    setPinChBusy(true);
    const res = await changePin(pinOld, pinNew);
    if (!res.ok) {
      setPinChBusy(false);
      setPinChErr(res.reason === 'WRONG_PIN' ? 'Current PIN is incorrect.' : 'Could not change PIN.');
      return;
    }

    const cloud = await pushEncryptedBlob(res.blob);
    setCryptoKey(res.key);
    setKdfIterations(res.kdfIterations || KDF_ITERATIONS);
    setPinChBusy(false);
    setPinModal(false);
    setPinOld(''); setPinNew(''); setPinNew2('');
    const cloudConfigured = Boolean(user && supabaseEnabled);
    showToast(
      !cloudConfigured ? 'PIN changed locally' : cloud.ok ? 'PIN changed and synced' : 'PIN changed locally; cloud sync failed',
      !cloudConfigured || cloud.ok ? 'ok' : 'err',
    );
  }

  // ── v1 → v2 upgrade ───────────────────────────────────────────────────────
  function handleUpgrade() {
    setShowUpgradePrompt(false);
    setShowPassphraseSetup(true);
  }

  async function handlePassphraseCreate(passphrase) {
    setShowPassphraseSetup(false);

    if (vaultVersion === 'none') {
      // New vault.
      const r = await createVaultV2(passphrase, [], {}, {});
      if (r.ok) {
        setCryptoKey(r.key);
        setDocs(r.docs);
        setImgs(r.imgs);
        setEmergency(r.emergency);
        setVaultVersion('v2');
        showToast('Vault created with AES-256-GCM');
      } else {
        showToast('Could not create vault', 'err');
      }
    } else if (vaultVersion === 'v1') {
      // Upgrade from v1 — uses the saved PIN to re-unlock and verify.
      const r = await upgradeV1ToV2(pinRef.current, passphrase);
      if (r.ok) {
        setCryptoKey(r.key);
        setDocs(r.docs);
        setImgs(r.imgs);
        setEmergency(r.emergency);
        setVaultVersion('v2');
        showToast('Vault upgraded to passphrase security');
      } else {
        showToast('Upgrade failed — v1 vault unchanged', 'err');
      }
    }
  }

  function openPinModal() {
    setPinOld(''); setPinNew(''); setPinNew2(''); setPinChErr(null);
    setPinModal(true);
  }

  // ── Download helpers ─────────────────────────────────────────────────────
  async function downloadJPEG(doc) {
    const dataUrl = imgs[doc.id];
    if (!dataUrl) return showToast('No image attached to this document', 'err');

    try {
      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = dataUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (!blob) throw new Error('JPEG conversion failed');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.name.replace(/[^a-z0-9]+/gi, '_')}.jpg`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('Downloaded as JPEG');
    } catch {
      showToast('JPEG export failed', 'err');
    }
  }

  async function downloadPDF(doc) {
    const dataUrl = imgs[doc.id];
    if (!dataUrl) return showToast('No image attached to this document', 'err');
    try {
      // jsPDF is an npm dependency, loaded lazily so it stays out of the main
      // bundle (Vite code-splits it). Never load it from a CDN: this runs in
      // the unlocked vault context, so third-party code here can read every doc.
      const { jsPDF } = await import('jspdf');
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);

      const pdf = new jsPDF({ orientation: img.width > img.height ? 'landscape' : 'portrait', unit: 'pt' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pageW / img.width, pageH / img.height) * 0.92;
      const w = img.width * ratio, h = img.height * ratio;
      pdf.addImage(jpegDataUrl, 'JPEG', (pageW - w) / 2, (pageH - h) / 2, w, h);
      pdf.save(`${doc.name.replace(/[^a-z0-9]+/gi, '_')}.pdf`);
      showToast('Downloaded as PDF');
    } catch (e) {
      showToast('PDF export failed', 'err');
    }
  }


  async function saveDoc() {
    if (!nd.name.trim() || !nd.num.trim() || mutationBusyRef.current) return;

    mutationBusyRef.current = true;
    setSavingDoc(true);
    try {
      const id = editingId || Date.now();
      const cleanDoc = {
        ...nd,
        name: nd.name.trim(),
        num: nd.num.trim(),
        by: nd.by.trim(),
        notes: nd.notes.trim(),
      };
      const newDocs = editingId
        ? docs.map((doc) => doc.id === id ? { ...doc, ...cleanDoc } : doc)
        : [...docs, { ...cleanDoc, id }];
      const newImgs = filePrev ? { ...imgs, [id]: filePrev } : imgs;
      const result = await persist(newDocs, newImgs);

      if (!result.ok) {
        showToast(result.reason === 'STORAGE_WRITE_FAILED'
          ? 'Could not save locally — storage is full or unavailable'
          : 'Could not save the document', 'err');
        return;
      }

      const wasEditing = Boolean(editingId);
      setDocs(newDocs); setImgs(newImgs);
      resetAdd(); setAddOpen(false);
      showToast(
        result.cloudSynced
          ? `${wasEditing ? 'Document updated' : 'Saved & encrypted'} with AES-256`
          : 'Saved locally; cloud sync is currently blocked',
        result.cloudSynced ? 'ok' : 'err',
      );
    } finally {
      mutationBusyRef.current = false;
      setSavingDoc(false);
    }
  }

  async function deleteDoc(id) {
    if (mutationBusyRef.current) return;
    mutationBusyRef.current = true;
    try {
      const newDocs = docs.filter((d) => d.id !== id);
      const newImgs = { ...imgs }; delete newImgs[id];
      const result = await persist(newDocs, newImgs);

      if (!result.ok) {
        showToast('Could not delete the document — the local vault was not changed', 'err');
        return;
      }

      setDocs(newDocs); setImgs(newImgs);
      setDocView(null);
      showToast(result.cloudSynced ? 'Document deleted' : 'Deleted locally; cloud sync is currently blocked', result.cloudSynced ? 'ok' : 'err');
    } finally {
      mutationBusyRef.current = false;
    }
  }

  function resetAdd() {
    setEditingId(null);
    setNd({ ...EMPTY_FORM });
    setFile(null); setFilePrev(null); setAnalyzed(false); setAErr(null); setAddTab('scan');
  }

  function openAdd() {
    resetAdd();
    setAddOpen(true);
  }

  function openEdit(doc) {
    setEditingId(doc.id);
    setNd({ ...EMPTY_FORM, ...doc });
    setFile(null);
    setFilePrev(imgs[doc.id] || null);
    setAnalyzed(false);
    setAErr(null);
    setAddTab('manual');
    setDocView(null);
    setAddOpen(true);
  }

  function openEmergency() {
    setEmDraft(cloneEmergency(emergency));
    setEmEditing(false);
    setEmOpen(true);
  }

  async function saveEmergency() {
    if (mutationBusyRef.current) return;
    mutationBusyRef.current = true;
    const next = cloneEmergency(emDraft);
    setEmSaving(true);
    try {
      const result = await persist(docs, imgs, next);
      if (!result.ok) {
        showToast('Could not save emergency details', 'err');
        return;
      }
      setEmergency(next);
      setEmDraft(cloneEmergency(next));
      setEmEditing(false);
      showToast(result.cloudSynced ? 'Emergency card saved' : 'Emergency card saved locally; cloud sync blocked', result.cloudSynced ? 'ok' : 'err');
    } finally {
      mutationBusyRef.current = false;
      setEmSaving(false);
    }
  }

  async function shareEmergencyCard() {
    const text = [
      'VAULTID EMERGENCY CARD',
      `Blood type: ${emergency.bloodType || 'Not provided'}`,
      `Allergies: ${emergency.allergies.join(', ') || 'None listed'}`,
      `Medications: ${emergency.medications.join(', ') || 'None listed'}`,
      `Conditions: ${emergency.conditions.join(', ') || 'None listed'}`,
      `Emergency contact: ${emergency.contact.name || 'Not provided'} ${emergency.contact.phone || ''}`.trim(),
    ].join('\n');

    try {
      if (navigator.share) {
        await navigator.share({ title: 'VaultID Emergency Card', text });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        showToast('Emergency card copied to clipboard');
      } else {
        throw new Error('Sharing unavailable');
      }
    } catch (error) {
      if (error?.name !== 'AbortError') showToast('Could not share the emergency card', 'err');
    }
  }

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

      <button className="abic" aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} onClick={() => setDark((d) => !d)} style={{ position: 'absolute', top: 16, right: 16, background: 'var(--gl)', backdropFilter: 'blur(12px)', border: '1px solid var(--glb)', borderRadius: 10 }}>
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
          {phase === 'boot' ? 'Loading…' : phase === 'unlocking' ? 'Deriving key…' : vaultVersion === 'v2' ? 'Enter passphrase to unlock' : 'Enter PIN to unlock'}
        </p>

        {/* v2: passphrase field */}
        {phase !== 'boot' && vaultVersion === 'v2' && (
          <>
            <div style={{ marginBottom: 28 }}>
              <input
                type="password"
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
            {unlockOk && <p style={{ color: 'var(--gr)', fontSize: 12, marginTop: 14, fontWeight: 600 }}>Unlocked ✓</p>}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
              <span className="sbadge"><Shield size={10} />AES-256-GCM · Passphrase</span>
            </div>
          </>
        )}

        {/* v1: PIN keypad (existing) */}
        {phase !== 'boot' && vaultVersion === 'v1' && (
          <>
            <div className={pinErr ? 'shk' : ''} style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 28 }}>
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
            {!lockedOut && pinErr   && <p style={{ color: 'var(--re)', fontSize: 12, marginTop: 14, fontWeight: 500 }}>Incorrect PIN — try again</p>}
            {!lockedOut && unlockErr && <p role="alert" style={{ color: 'var(--re)', fontSize: 12, marginTop: 14, fontWeight: 500 }}>{unlockErr}</p>}
            {unlockOk && <p style={{ color: 'var(--gr)', fontSize: 12, marginTop: 14, fontWeight: 600 }}>Unlocked ✓</p>}

            {DEMO_MODE && (
              <p style={{ color: 'var(--tx4)', fontSize: 11, marginTop: 20 }}>
                Demo PIN: <code style={{ color: 'var(--act)', fontFamily: "'JetBrains Mono', monospace" }}>{DEMO_PIN}</code>
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
              <span className="sbadge"><Shield size={10} />AES-256-GCM · Groq AI</span>
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
            <button
              type="button"
              key={k}
              className={`anv${cat === k ? ' on' : ''}`}
              onClick={() => setCat(k)}
              data-tip={sbCollapsed ? m.label : undefined}
              aria-label={m.label}
              aria-pressed={cat === k}
            >
              <Ic size={15} /><span style={{ flex: 1 }}>{m.label}</span>
              <span className="cnt">{cnt}</span>
            </button>
          );
        })}

        <div className="divr" />
        <button type="button" className="anv danger" onClick={openEmergency} data-tip={sbCollapsed ? 'Emergency Card' : undefined} aria-label="Emergency Card">
          <Zap size={15} /><span style={{ flex: 1 }}>Emergency Card</span><ChevronRight size={13} />
        </button>
        <button type="button" className="anv" onClick={() => setNotifOpen((o) => !o)} data-tip={sbCollapsed ? 'Alerts' : undefined} aria-label="Alerts" aria-expanded={notifOpen}>
          <Bell size={15} /><span style={{ flex: 1 }}>Alerts</span>
          {notifs.length > 0 && (
            <span style={{ background: 'var(--re)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20 }}>
              {notifs.length}
            </span>
          )}
        </button>
        <button type="button" className="anv" onClick={openPinModal} data-tip={sbCollapsed ? 'Change PIN' : undefined} aria-label="Change PIN">
          <Lock size={15} /><span style={{ flex: 1 }}>Change PIN</span>
        </button>

        <div style={{ flex: 1 }} />
        <div className="divr" />

        {supabaseEnabled && (
          user ? (
            <div
              className="sb-profile"
              data-tip={sbCollapsed ? `${user.user_metadata?.full_name || user.email}${syncing ? ' · Syncing…' : ' · Synced'}` : undefined}
            >
              {user.user_metadata?.avatar_url
                ? <img className="sb-profile-av" src={user.user_metadata.avatar_url} alt="" />
                : <div className="sb-profile-av-fallback">{(user.user_metadata?.full_name || user.email || '?')[0].toUpperCase()}</div>}
              <div className="sb-profile-info">
                <div className="sb-profile-name">{user.user_metadata?.full_name || 'Signed in'}</div>
                <div className="sb-profile-email">{user.email}</div>
              </div>
              <button
                type="button"
                className="sb-profile-sync"
                title={syncing ? 'Syncing…' : 'Synced — click to sign out'}
                aria-label="Sign out"
                onClick={handleSignOut}
              >
                {syncing
                  ? <Loader2 size={13} className="spin" style={{ color: 'var(--tx3)' }} />
                  : <LogOut size={13} style={{ color: 'var(--tx3)' }} />}
              </button>
            </div>
          ) : (
            <button type="button" className="anv" onClick={handleGoogleSignIn} data-tip={sbCollapsed ? 'Sign in with Google' : undefined} aria-label="Sign in with Google" disabled={authBusy}>
              {authBusy ? <Loader2 size={15} className="spin" /> : <Globe size={15} />}
              <span style={{ flex: 1 }}>{authBusy ? 'Signing in…' : 'Sign in with Google'}</span>
            </button>
          )
        )}
        {syncErr && !sbCollapsed && (
          <p style={{ fontSize: 10.5, color: 'var(--re)', padding: '2px 10px 4px', lineHeight: 1.4 }}>{syncErr}</p>
        )}

        {onBack && (
          <button type="button" className="anv" style={{ color: 'var(--tx3)' }} onClick={onBack} data-tip={sbCollapsed ? 'Back to Site' : undefined} aria-label="Back to Site">
            <ChevronRight size={15} style={{ transform: 'rotate(180deg)' }} />
            <span style={{ flex: 1, fontSize: 13 }}>Back to Site</span>
          </button>
        )}
        <button
          type="button"
          className="anv"
          style={{ color: 'var(--tx3)' }}
          data-tip={sbCollapsed ? 'Lock Vault' : undefined}
          aria-label="Lock Vault"
          onClick={lockVault}
        >
          <Lock size={15} /><span style={{ flex: 1, fontSize: 13 }}>Lock Vault</span>
        </button>
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
            <button className="abic" aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} onClick={() => setDark((d) => !d)} style={{ border: '1px solid var(--bd)' }}>
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
                <button className="abic" aria-label="Close alerts" onClick={() => setNotifOpen(false)}><X size={14} /></button>
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
                  <TiltCard key={doc.id} aria-label={`Open ${doc.name}`} onClick={() => { setDocView(doc); setKebabOpen(false); }}>
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
                          <button className="abic" aria-label={`Copy ${doc.name} document number`} style={{ width: 26, height: 26, borderRadius: 6, marginLeft: 6, flexShrink: 0 }} onClick={(e) => copyNum(e, doc.id, doc.num)}>
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
            <button key={k} type="button" onClick={() => setCat(k)} aria-label={m.label} aria-pressed={cat === k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer', color: cat === k ? 'var(--act)' : 'var(--tx3)', background: 'transparent', border: 0 }}>
              <Ic size={22} />
              <span style={{ fontSize: 9.5, fontWeight: 500 }}>{m.label.split(' ')[0]}</span>
            </button>
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
            <div ref={modalRef} className="mbox si" role="dialog" aria-modal="true" aria-label="Document details" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
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
                <button className="abic" aria-label="Close document details" onClick={() => { setDocView(null); setKebabOpen(false); }}><X size={18} /></button>
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
                <button type="button" className="abtn abg" style={{ flex: 1, justifyContent: 'center' }} onClick={() => openEdit(docView)}><Pencil size={13} />Edit</button>
                <div className="kebab-menu">
                  <button className="abic" aria-label="More document actions" style={{ border: '1px solid var(--bd)' }} onClick={() => setKebabOpen((o) => !o)} title="More actions">
                    <MoreVertical size={16} />
                  </button>
                  {kebabOpen && (
                    <>
                      <div style={{ position: 'fixed', inset: 0, zIndex: 19 }} onClick={() => setKebabOpen(false)} />
                      <div className="kebab-pop">
                        {has && (
                          <>
                            <button type="button" className="kebab-item" onClick={() => { downloadJPEG(docView); setKebabOpen(false); }}>
                              <Download size={14} />Download as JPEG
                            </button>
                            <button type="button" className="kebab-item" onClick={() => { downloadPDF(docView); setKebabOpen(false); }}>
                              <Download size={14} />Download as PDF
                            </button>
                          </>
                        )}
                        <button type="button" className="kebab-item danger" onClick={() => { deleteDoc(docView.id); setKebabOpen(false); }}>
                          <Trash2 size={14} />Delete document
                        </button>
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
          <div ref={modalRef} className="mbox si" role="dialog" aria-modal="true" aria-label={editingId ? 'Edit document' : 'Add document'} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--tx)', fontFamily: "'Space Grotesk', sans-serif" }}>{editingId ? 'Edit Document' : 'Add Document'}</h3>
              <button className="abic" aria-label="Close add document dialog" onClick={() => setAddOpen(false)}><X size={18} /></button>
            </div>

            <div className="tbar" role="tablist" aria-label="Document input method" style={{ marginBottom: 20 }}>
              <button type="button" role="tab" aria-selected={addTab === 'scan'} className={`atab${addTab === 'scan' ? ' on' : ''}`} onClick={() => setAddTab('scan')}>
                <Sparkles size={12} style={{ display: 'inline', marginRight: 5, verticalAlign: '-1px' }} />Scan with AI
              </button>
              <button type="button" role="tab" aria-selected={addTab === 'manual'} className={`atab${addTab === 'manual' ? ' on' : ''}`} onClick={() => setAddTab('manual')}>
                <Pencil size={12} style={{ display: 'inline', marginRight: 5, verticalAlign: '-1px' }} />Manual Entry
              </button>
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
                  <span style={{ fontSize: 10, color: 'var(--tx4)' }}>PNG/JPG/WEBP · max 2.5 MB</span>
                </div>

                {!file && !analyzing && (
                  <div
                    className={`uz${drag ? ' dg' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                    onDragLeave={() => setDrag(false)}
                    onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                    onClick={() => fileRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        fileRef.current?.click();
                      }
                    }}
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
                      <button className="abic" aria-label="Remove scanned file" style={{ width: 26, height: 26 }} onClick={() => { setFile(null); setFilePrev(null); setAnalyzed(false); }}><X size={13} /></button>
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
                <button className="abtn abp" onClick={saveDoc} disabled={savingDoc || !nd.name.trim() || !nd.num.trim()}>
                  <Check size={14} />{editingId ? 'Save Changes' : 'Save & Encrypt'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ EMERGENCY MODAL ═══ */}
      {emOpen && (
        <div className="mbg" onClick={() => setEmOpen(false)}>
          <div ref={modalRef} className="mbox si" role="dialog" aria-modal="true" aria-label="Emergency card" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
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
              <button className="abic" aria-label="Close emergency card" onClick={() => setEmOpen(false)}><X size={18} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'start', marginBottom: 16 }}>
              <div style={{ background: 'var(--res)', border: '1px solid rgba(248,113,113,.2)', borderRadius: 14, padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {[
                  { l: 'Blood Type',        v: <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--re)', fontFamily: "'Space Grotesk', sans-serif" }}>{emergency.bloodType || '—'}</span> },
                  { l: 'Organ Donor',       v: emergency.donor ? 'Yes ✓' : 'No' },
                  { l: 'Allergies',         v: emergency.allergies.join(', ') || 'None listed' },
                  { l: 'Medications',       v: emergency.medications.join(', ') || 'None listed' },
                  { l: 'Conditions',        v: emergency.conditions.join(', ') || 'None listed' },
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
                   <button type="button" className="abtn abg" onClick={() => { setEmDraft(cloneEmergency(emergency)); setEmEditing(false); }}>Cancel</button>
                   <button type="button" className="abtn abp" onClick={saveEmergency} disabled={emSaving}>
                     {emSaving ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                     Save details
                   </button>
                 </div>
               </div>
             ) : (
               <button type="button" className="abtn abg" onClick={() => { setEmDraft(cloneEmergency(emergency)); setEmEditing(true); }} style={{ width: '100%', justifyContent: 'center', marginBottom: 14 }}>
                 <Pencil size={14} />Edit emergency details
               </button>
             )}

             <button type="button" className="abtn abd" onClick={shareEmergencyCard} style={{ width: '100%', justifyContent: 'center', padding: 11, fontSize: 14, fontWeight: 600 }}>
              <Share2 size={15} />Share Emergency Card
            </button>
          </div>
        </div>
      )}

      {/* ═══ CHANGE PIN MODAL ═══ */}
      {pinModal && (
        <div className="mbg" onClick={() => setPinModal(false)}>
          <div ref={modalRef} className="mbox si" role="dialog" aria-modal="true" aria-label="Change PIN" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--tx)', fontFamily: "'Space Grotesk', sans-serif" }}>Change PIN</h3>
              <button className="abic" aria-label="Close change PIN dialog" onClick={() => setPinModal(false)}><X size={18} /></button>
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

      {/* ═══ UPGRADE PROMPT ═══ */}
      {showUpgradePrompt && phase === 'open' && (
        <div className="mbg" onClick={() => setShowUpgradePrompt(false)}>
          <div className="mbox si" role="dialog" aria-modal="true" aria-label="Upgrade security" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--tx)', fontFamily: "'Space Grotesk', sans-serif" }}>Upgrade Security</h3>
              <button className="abic" aria-label="Close" onClick={() => setShowUpgradePrompt(false)}><span aria-hidden="true">×</span></button>
            </div>
            <p style={{ fontSize: 14, color: 'var(--tx2)', lineHeight: 1.6, marginBottom: 16 }}>
              Your vault is secured with a 6-digit PIN. Upgrade to a passphrase for stronger security — a long, unique passphrase is far harder to brute-force than a PIN.
            </p>
            <p style={{ fontSize: 13, color: 'var(--tx3)', lineHeight: 1.5, marginBottom: 20 }}>
              Your documents and images will be re-encrypted with the new format. The old PIN vault is backed up until your next unlock.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="abtn abg" onClick={() => setShowUpgradePrompt(false)}>Not now</button>
              <button type="button" className="abtn abp" onClick={handleUpgrade}>Upgrade</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PASSPHRASE SETUP ═══ */}
      {showPassphraseSetup && (
        <PassphraseSetup
          onCreate={handlePassphraseCreate}
          onCancel={() => setShowPassphraseSetup(false)}
        />
      )}
    </div>
  );
}
