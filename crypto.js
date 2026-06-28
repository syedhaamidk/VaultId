/**
 * VaultID — Crypto Module
 *
 * Security model:
 *   PIN  ──►  PBKDF2 (100 000 iter, SHA-256, random salt)  ──►  AES-256-GCM key
 *   key  ──►  encrypt({ docs, imgs })  ──►  { iv, ct } stored in localStorage
 *
 * The PIN and the derived key NEVER leave the browser session.
 * Wrong PIN → wrong key → AES-GCM auth-tag mismatch → tryUnlock returns { ok: false }.
 */

// ── Buffer ↔ Base64 ─────────────────────────────────────────────────────────
export function buf2b64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.byteLength; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
export const b642buf = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

// ── PBKDF2 key derivation ────────────────────────────────────────────────────
export async function deriveKey(pin, salt) {
  const raw = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// ── AES-256-GCM encrypt / decrypt ────────────────────────────────────────────
export async function aesEncrypt(data, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(data))
  );
  return { iv: buf2b64(iv), ct: buf2b64(ct) };
}

export async function aesDecrypt({ iv, ct }, key) {
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b642buf(iv) },
    key,
    b642buf(ct)
  );
  return JSON.parse(new TextDecoder().decode(pt));
}

// ── localStorage wrapper ─────────────────────────────────────────────────────
const LS = {
  get: (k)    => { try { return localStorage.getItem(k);    } catch { return null;  } },
  set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  del: (k)    => { try { localStorage.removeItem(k);        } catch { /* noop */ }   },
};

// ── Salt (created once, stored in localStorage) ──────────────────────────────
async function getSalt() {
  let s = LS.get('vid_salt');
  if (!s) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    s = buf2b64(bytes);
    LS.set('vid_salt', s);
  }
  return b642buf(s);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Attempt to unlock the vault with the given PIN.
 * @param {string} pin
 * @param {Array}  fallbackDocs  Used only on first run to pre-populate vault.
 * @returns {{ ok: boolean, key?: CryptoKey, docs?: Array, imgs?: object }}
 */
export async function tryUnlock(pin, fallbackDocs = []) {
  try {
    const salt = await getSalt();
    const key  = await deriveKey(pin, salt);
    const raw  = LS.get('vid_vault');

    if (!raw) {
      // First run — initialise vault with demo / empty docs
      const enc = await aesEncrypt({ docs: fallbackDocs, imgs: {} }, key);
      LS.set('vid_vault', JSON.stringify(enc));
      return { ok: true, key, docs: fallbackDocs, imgs: {} };
    }

    const data = await aesDecrypt(JSON.parse(raw), key);
    return { ok: true, key, docs: data.docs ?? [], imgs: data.imgs ?? {} };
  } catch {
    return { ok: false };
  }
}

/**
 * Encrypt and persist the vault to localStorage.
 */
export async function saveVault(docs, imgs, key) {
  try {
    const enc = await aesEncrypt({ docs, imgs }, key);
    LS.set('vid_vault', JSON.stringify(enc));
  } catch (e) {
    console.warn('[VaultID] Save failed:', e);
  }
}

/**
 * Wipe the vault from localStorage (for dev / reset flows).
 */
export function resetVault() {
  LS.del('vid_vault');
  LS.del('vid_salt');
}
