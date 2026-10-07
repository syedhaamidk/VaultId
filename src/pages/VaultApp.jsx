import { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck, Lock, Search, Sun, Moon, Plus, X,
  Upload, Trash2, Copy, Check, Clock, AlertCircle,
  Loader2, Zap, Share2, Pencil, Bell, ChevronRight,
  CreditCard, Activity, Wallet, Home, Scale,
  Sparkles, Shield, FolderOpen, Download, MoreVertical, Globe, LogOut, Smartphone,
} from 'lucide-react';
import { Badge, TiltCard, DocForm, daysLeft, fmtDate, docIcon, compressImage } from '../utils.jsx';
import { VAULT_CAT, DOCS0, EMPTY_EMERGENCY, DEMO_EMERGENCY, DEMO_PIN } from '../data.js';
import { tryUnlock, saveVault, changePin, exportLocalBlob, markVaultSynced, tryUnlockFromRemote, KDF_ITERATIONS, getVaultVersion, upgradeV1ToV2, clearV1Backup, hasV1Backup, createVaultV2, tryUnlockV2FromRemote, logAudit, getAuditLog, changePassphraseV2, getCurrentV2Blob } from '../crypto.js';
import { syncVault, getCurrentUser, onAuthChange, signInWithGoogle, signOut, pullVault, pushVault } from '../sync.js';
import { supabase, supabaseEnabled } from '../supabaseClient.js';
import PassphraseSetup from '../components/PassphraseSetup.jsx';
import { scanOnDevice } from '../utils/onDeviceScan.js';
import LockScreen from '../components/vault/LockScreen.jsx';
import Sidebar from '../components/vault/Sidebar.jsx';
import DocumentCard from '../components/vault/DocumentCard.jsx';
import DocumentModal from '../components/vault/DocumentModal.jsx';
import { AddDocumentModal, EmergencyModal, ChangePinModal, UpgradePrompt, ScanConsent, AuditLogModal } from '../components/vault/Modals.jsx';
import IosInstallSheet from '../components/IosInstallSheet.jsx';
import { usePwaInstall } from '../utils/usePwaInstall.js';

// ── AI document scanner ────────────────────────────────────────────────────────
async function scanDocumentWithAI(file) {
  const b64 = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const dataUrl = `data:${file.type};base64,${b64}`;

  // Send the Supabase session token for authentication.
  const session = await supabase?.auth.getSession?.();
  const token = session?.data?.session?.access_token;

  const res = await fetch('/api/scan', {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ dataUrl, mimeType: file.type }),
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
const MAX_IMAGE_BYTES = 2_500_000;
const MAX_IMAGE_LABEL = '2.5 MB';
const CLIPBOARD_CLEAR_MS = 30_000;
const HIDDEN_LOCK_MS = 60_000;
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
  const [passphraseSetupMode, setPassphraseSetupMode] = useState('create'); // create | change
  const [passphraseInput, setPassphraseInput] = useState('');
  const [showScanConsent, setShowScanConsent] = useState(false);
  const [pendingScanFile, setPendingScanFile] = useState(null);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
  const { canInstall, installed, isIos, promptInstall } = usePwaInstall();
  const [iosHint, setIosHint] = useState(false);
  const showInstall = (canInstall || isIos) && !installed;
  const onInstallClick = () => {
    if (canInstall) promptInstall();
    else setIosHint(true);
  };

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
  // the cloud before allowing any local write.
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

  // Generate the emergency QR locally.
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
    logAudit('lock');
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

  // ── PIN ───────────────────────────────────────────────────────────────────
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
          cloudReadyRef.current = false;
          setSyncBlocked(true);
          setSyncErr('This device has unsynced changes. The cloud vault was not overwritten.');
          return tryUnlock(np, fallbackDocs, initialEmergency());
        }

        if (action === 'upgrade') {
          cloudReadyRef.current = false;
          setSyncBlocked(true);
          setSyncErr('A newer vault format is available. Upgrade this device to sync.');
          return tryUnlock(np, fallbackDocs, initialEmergency());
        }

        if (action === 'warn-stale-v1') {
          cloudReadyRef.current = false;
          setSyncBlocked(true);
          setSyncErr('A device with the old format has newer data. Upgrade that device to sync.');
          return tryUnlock(np, fallbackDocs, initialEmergency());
        }

        if (remote.version === 'v2') {
          const result = await tryUnlockV2FromRemote(np, remote.blob);
          if (result.ok) {
            cloudReadyRef.current = true;
            setSyncBlocked(false);
            setSyncErr(null);
          }
          return result;
        }

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
        logAudit('unlock', 'PIN');
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
      logAudit('unlock', 'passphrase');
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

    const next = persistQueueRef.current.then(run, run);
    persistQueueRef.current = next.catch(() => {});
    return next;
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

    const reader = new FileReader();
    reader.onload = (e) => setFilePrev(e.target.result);
    reader.readAsDataURL(f);

    setPendingScanFile(f);
    setShowScanConsent(true);
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

  async function runOnDeviceScan(f) {
    setAnalyzing(true); setAnalyzed(false);
    try {
      const p = await scanOnDevice(f);
      if (!p.ok) throw new Error(p.error || 'On-device scan failed');
      setNd({
        name:    p.name     ?? '',
        cat:     'identity',
        num:     p.num      ?? '',
        by:      p.by       ?? '',
        issued:  p.issued   ?? '',
        expires: p.expires  ?? '',
        notes:   p.notes    ?? '',
      });
      setAnalyzed(true);
    } catch (err) {
      setAErr(`On-device scan failed: ${err.message}. Try manual entry below.`);
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
    logAudit('pin_change');
    const cloudConfigured = Boolean(user && supabaseEnabled);
    showToast(
      !cloudConfigured ? 'PIN changed locally' : cloud.ok ? 'PIN changed and synced' : 'PIN changed locally; cloud sync failed',
      !cloudConfigured || cloud.ok ? 'ok' : 'err',
    );
  }

  // ── v1 → v2 upgrade ───────────────────────────────────────────────────────
  function handleUpgrade() {
    setShowUpgradePrompt(false);
    setPassphraseSetupMode('create');
    setShowPassphraseSetup(true);
  }

  // ── v2: rotate passphrase (DEK is re-wrapped; data stays intact) ────────────
  async function handlePassphraseChange(oldPp, newPp) {
    // NOTE: exportLocalBlob() is the v1 shape ({saltB64, enc}) and returns
    // null for v2 vaults — rotation needs the live v2 blob object instead.
    const blob = getCurrentV2Blob();
    if (!blob) {
      showToast('Could not read vault.', 'err');
      return;
    }
    const res = await changePassphraseV2(oldPp, newPp, blob);
    if (!res.ok) {
      showToast(res.reason === 'WRONG_PASSPHRASE' ? 'Current passphrase is incorrect.' : 'Could not change passphrase.', 'err');
      return;
    }
    setShowPassphraseSetup(false);
    setPassphraseSetupMode('create');
    const cloud = await pushEncryptedBlob(res.blob);
    logAudit('passphrase_change');
    const cloudConfigured = Boolean(user && supabaseEnabled);
    showToast(
      !cloudConfigured ? 'Passphrase changed locally' : cloud.ok ? 'Passphrase changed and synced' : 'Passphrase changed locally; cloud sync failed',
      !cloudConfigured || cloud.ok ? 'ok' : 'err',
    );
  }

  async function handlePassphraseCreate(passphrase) {
    setShowPassphraseSetup(false);
    setPassphraseSetupMode('create');

    if (vaultVersion === 'none') {
      const r = await createVaultV2(passphrase, [], cloneEmergency(EMPTY_EMERGENCY), {});
      if (r.ok) {
        setCryptoKey(r.key);
        setDocs(r.docs);
        setImgs(r.imgs);
        setEmergency(r.emergency);
        setVaultVersion('v2');
        setUnlockOk(true);
        showToast('Vault created with AES-256-GCM');
        setTimeout(() => { setPhase('open'); setUnlockOk(false); }, 550);
      } else {
        showToast('Could not create vault', 'err');
      }
    } else if (vaultVersion === 'v1') {
      const r = await upgradeV1ToV2(pinRef.current, passphrase);
      if (r.ok) {
        setCryptoKey(r.key);
        setDocs(r.docs);
        setImgs(r.imgs);
        setEmergency(r.emergency);
        setVaultVersion('v2');
        setUnlockOk(true);
        showToast('Vault upgraded to passphrase security');
        setTimeout(() => { setPhase('open'); setUnlockOk(false); }, 550);
      } else {
        showToast('Upgrade failed — v1 vault unchanged', 'err');
      }
    }
  }

  // Routes PassphraseSetup submit by mode: rotation vs creation/upgrade.
  function handlePassphraseSetupSubmit(newPp, _recoveryKey, currentPp) {
    if (passphraseSetupMode === 'change') handlePassphraseChange(currentPp, newPp);
    else handlePassphraseCreate(newPp);
  }

  function openPinModal() {
    setPinOld(''); setPinNew(''); setPinNew2(''); setPinChErr(null);
    setPinModal(true);
  }

  // ── Export / Import ──────────────────────────────────────────────────────
  function exportVault() {
    const raw = localStorage.getItem('vid_vault');
    if (!raw) return showToast('No vault to export', 'err');
    try {
      const exportData = {
        type: 'vaultid-export',
        version: getVaultVersion(),
        exportedAt: new Date().toISOString(),
        blob: JSON.parse(raw),
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vaultid-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('Vault exported (encrypted)');
    } catch {
      showToast('Export failed', 'err');
    }
  }

  function importVault(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.type !== 'vaultid-export' || !data.blob) {
          showToast('Invalid backup file', 'err');
          return;
        }
        localStorage.setItem('vid_vault', JSON.stringify(data.blob));
        showToast('Vault imported — reloading…');
        setTimeout(() => window.location.reload(), 1000);
      } catch {
        showToast('Could not import vault', 'err');
      }
    };
    reader.readAsText(file);
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
        ? docs.map((doc) => {
            if (doc.id !== id) return doc;
            const versions = Array.isArray(doc.versions) ? [...doc.versions] : [];
            versions.unshift({
              ts: new Date().toISOString(),
              name: doc.name, num: doc.num, by: doc.by, cat: doc.cat,
              issued: doc.issued, expires: doc.expires, notes: doc.notes,
            });
            while (versions.length > 5) versions.pop();
            return { ...doc, ...cleanDoc, versions };
          })
        : [...docs, { ...cleanDoc, id, versions: [] }];
      const compressedImg = file ? await compressImage(file) : null;
      const newImgs = compressedImg ? { ...imgs, [id]: compressedImg } : imgs;
      const result = await persist(newDocs, newImgs);

      if (!result.ok) {
        showToast(result.reason === 'STORAGE_WRITE_FAILED'
          ? 'Could not save locally — storage is full or unavailable'
          : 'Could not save the document', 'err');
        return;
      }

      const wasEditing = Boolean(editingId);
      setDocs(newDocs); setImgs(newImgs);
      logAudit(wasEditing ? 'edit' : 'add', nd.name);
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
      logAudit('delete', docs.find((d) => d.id === id)?.name || '');
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

  // ── Clipboard auto-clear ──────────────────────────────────────────────────
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
    <>
    <LockScreen
      phase={phase}
      dark={dark}
      setDark={setDark}
      onBack={onBack}
      vaultVersion={vaultVersion}
      pin={pin}
      setPin={setPin}
      pinErr={pinErr}
      unlockErr={unlockErr}
      unlockOk={unlockOk}
      lockedOut={lockedOut}
      lockRemain={lockRemain}
      pressKey={pressKey}
      passphraseInput={passphraseInput}
      setPassphraseInput={setPassphraseInput}
      handlePassphraseSubmit={handlePassphraseSubmit}
      showPassphraseSetup={showPassphraseSetup}
      setShowPassphraseSetup={setShowPassphraseSetup}
      supabaseEnabled={supabaseEnabled}
      user={user}
      authBusy={authBusy}
      handleGoogleSignIn={handleGoogleSignIn}
      syncErr={syncErr}
      DEMO_MODE={DEMO_MODE}
      DEMO_PIN={DEMO_PIN}
      PIN_LEN={PIN_LEN}
    />
    {/* Passphrase setup must mount while locked: new users create their
        vault from the lock screen, and v1 users upgrade from it. */}
    {showPassphraseSetup && (
      <PassphraseSetup
        mode={passphraseSetupMode}
        onCreate={handlePassphraseSetupSubmit}
        onCancel={() => { setShowPassphraseSetup(false); setPassphraseSetupMode('create'); }}
      />
    )}
    </>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN APP
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="app" data-t={theme} style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: 'var(--bg)', color: 'var(--tx)' }} id="main-content">

      <Sidebar
        sbCollapsed={sbCollapsed}
        setSbCollapsed={setSbCollapsed}
        cat={cat}
        setCat={(k) => { setCat(k); if (sidebarOpen) setSidebarOpen(false); }}
        docs={docs}
        onEmergency={() => { openEmergency(); if (sidebarOpen) setSidebarOpen(false); }}
        onAlerts={() => setNotifOpen((o) => !o)}
        notifOpen={notifOpen}
        notifs={notifs}
        onPinChange={() => {
          if (vaultVersion === 'v2') { setPassphraseSetupMode('change'); setShowPassphraseSetup(true); }
          else openPinModal();
        }}
        onExport={exportVault}
        onImport={() => document.getElementById('import-file-input')?.click()}
        onAuditLog={() => setShowAuditLog(true)}
        onLock={lockVault}
        onBack={onBack}
        user={user}
        authBusy={authBusy}
        onGoogleSignIn={handleGoogleSignIn}
        onSignOut={handleSignOut}
        syncing={syncing}
        syncErr={syncErr}
        supabaseEnabled={supabaseEnabled}
        vaultVersion={vaultVersion}
        isDrawer={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <input
        id="import-file-input"
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files[0]) importVault(e.target.files[0]); e.target.value = ''; }}
      />

      {/* ── MAIN COLUMN ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Topbar */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--gl)', backdropFilter: 'blur(20px)', flexShrink: 0, gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Mobile hamburger — opens the sidebar as a drawer */}
            <button
              className="abic"
              aria-label="Open menu"
              onClick={() => setSidebarOpen(true)}
              style={{ border: '1px solid var(--bd)', display: 'none' }}
              className="abic sb-hamburger"
            >
              <MoreVertical size={15} />
            </button>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-.4px', fontFamily: "'Space Grotesk', sans-serif", color: 'var(--tx)' }}>
                {VAULT_CAT[cat].label}
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--tx3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {filtered.length} doc{filtered.length !== 1 ? 's' : ''}
                <span className="sbadge" style={{ fontSize: 10, padding: '1px 7px' }}><Shield size={9} />AES-256</span>
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div className="srch top-s">
              <Search size={14} />
              <input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search documents" />
            </div>
            <button className="abic" aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} onClick={() => setDark((d) => !d)} style={{ border: '1px solid var(--bd)' }}>
              {dark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            {showInstall && (
              <button className="abic" aria-label="Install app" onClick={onInstallClick} style={{ border: '1px solid var(--bd)' }}>
                <Smartphone size={15} />
              </button>
            )}
            <IosInstallSheet open={iosHint} onClose={() => setIosHint(false)} />
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
                { l: 'Encrypted',       v: 'On',          cl: 'var(--gr)',  b: 'var(--gr)'  },
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
                  <DocumentCard
                    key={doc.id}
                    doc={doc}
                    img={has ? imgs[doc.id] : null}
                    catColor={cc}
                    icon={DI}
                    onOpen={() => { setDocView(doc); setKebabOpen(false); }}
                    onCopy={copyNum}
                    copied={cpId === doc.id}
                  />
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

      {/* ═══ DOCUMENT DETAIL MODAL ═══ */}
      {docView && (() => {
        const DI  = docIcon(docView.name, docView.cat);
        const cc  = VAULT_CAT[docView.cat]?.color ?? '#7B6FE8';
        const has = !!imgs[docView.id];
        return (
          <DocumentModal
            doc={docView}
            img={has ? imgs[docView.id] : null}
            catColor={cc}
            onClose={() => { setDocView(null); setKebabOpen(false); }}
            onEdit={openEdit}
            onDelete={() => deleteDoc(docView.id)}
            onCopy={copyNum}
            copied={cpId === docView.id}
            onDownloadJPEG={() => downloadJPEG(docView)}
            onDownloadPDF={() => downloadPDF(docView)}
            hasImage={has}
          />
        );
      })()}

      {/* ═══ ADD MODAL ═══ */}
      <AddDocumentModal
        addOpen={addOpen}
        editingId={editingId}
        addTab={addTab}
        setAddTab={setAddTab}
        file={file}
        filePrev={filePrev}
        drag={drag}
        analyzing={analyzing}
        analyzed={analyzed}
        aErr={aErr}
        nd={nd}
        setNd={setNd}
        savingDoc={savingDoc}
        fileRef={fileRef}
        onFile={handleFile}
        onCancel={() => setAddOpen(false)}
        onSave={saveDoc}
        onRemoveFile={() => { setFile(null); setFilePrev(null); setAnalyzed(false); }}
        onManualEntry={() => { setAErr(null); setAddTab('manual'); }}
      />

      {/* ═══ EMERGENCY MODAL ═══ */}
      <EmergencyModal
        emOpen={emOpen}
        emergency={emergency}
        qrDataUrl={qrDataUrl}
        qrError={qrError}
        emDraft={emDraft}
        emEditing={emEditing}
        emSaving={emSaving}
        onClose={() => setEmOpen(false)}
        onEdit={() => { setEmDraft(cloneEmergency(emergency)); setEmEditing(true); }}
        onSave={saveEmergency}
        onShare={shareEmergencyCard}
        onCancelEdit={() => { setEmDraft(cloneEmergency(emergency)); setEmEditing(false); }}
      />

      {/* ═══ CHANGE PIN MODAL ═══ */}
      <ChangePinModal
        pinModal={pinModal}
        pinOld={pinOld}
        pinNew={pinNew}
        pinNew2={pinNew2}
        pinChErr={pinChErr}
        pinChBusy={pinChBusy}
        onClose={() => setPinModal(false)}
        onSave={handlePinChange}
      />

      {/* ═══ UPGRADE PROMPT ═══ */}
      <UpgradePrompt
        showUpgradePrompt={showUpgradePrompt && phase === 'open'}
        onClose={() => setShowUpgradePrompt(false)}
        onUpgrade={handleUpgrade}
      />

      {/* ═══ PASSPHRASE SETUP ═══ */}
      {showPassphraseSetup && (
        <PassphraseSetup
          mode={passphraseSetupMode}
          onCreate={handlePassphraseSetupSubmit}
          onCancel={() => { setShowPassphraseSetup(false); setPassphraseSetupMode('create'); }}
        />
      )}

      {/* ═══ SCAN CONSENT ═══ */}
      <ScanConsent
        showScanConsent={showScanConsent}
        onClose={() => setShowScanConsent(false)}
        onGroq={() => { setShowScanConsent(false); if (pendingScanFile) runScan(pendingScanFile); }}
        onDevice={() => { setShowScanConsent(false); if (pendingScanFile) runOnDeviceScan(pendingScanFile); }}
      />

      {/* ═══ AUDIT LOG ═══ */}
      <AuditLogModal
        showAuditLog={showAuditLog}
        onClose={() => setShowAuditLog(false)}
      />

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
