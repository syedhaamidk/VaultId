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

/**
 * Return the raw { saltB64, enc } currently in localStorage, for pushing to
 * cloud sync. Returns null if there's nothing to sync yet.
 */
export function exportLocalBlob() {
  const saltB64 = LS.get('vid_salt');
  const raw     = LS.get('vid_vault');
  if (!saltB64 || !raw) return null;
  return { saltB64, enc: JSON.parse(raw) };
}

/**
 * Try to unlock using a blob pulled from cloud sync rather than localStorage
 * (e.g. first login on a new device). On success, also writes it into
 * localStorage so this device has an offline-capable copy going forward.
 *
 * @param {string} pin
 * @param {{ saltB64: string, enc: {iv,ct} }} remote
 */
export async function tryUnlockFromRemote(pin, remote) {
  try {
    const salt = b642buf(remote.saltB64);
    const key  = await deriveKey(pin, salt);
    const data = await aesDecrypt(remote.enc, key);

    LS.set('vid_salt', remote.saltB64);
    LS.set('vid_vault', JSON.stringify(remote.enc));

    return { ok: true, key, docs: data.docs ?? [], imgs: data.imgs ?? {} };
  } catch {
    return { ok: false };
  }
}

/**
 * Change the PIN: re-encrypts the vault under a brand-new salt + key.
 * Re-salting on every PIN change means an attacker who captured an old
 * (salt, ciphertext) pair from a previous backup can't reuse it against
 * the new PIN.
 *
 * @param {string} oldPin
 * @param {string} newPin
 * @returns {{ ok: boolean, key?: CryptoKey, reason?: string }}
 */
export async function changePin(oldPin, newPin) {
  try {
    const oldSalt = await getSalt();
    const oldKey  = await deriveKey(oldPin, oldSalt);
    const raw     = LS.get('vid_vault');
    if (!raw) return { ok: false, reason: 'NO_VAULT' };

    // Verify the old PIN actually unlocks the vault before changing anything.
    const data = await aesDecrypt(JSON.parse(raw), oldKey);

    // Fresh salt + key for the new PIN.
    const newSaltBytes = crypto.getRandomValues(new Uint8Array(16));
    const newSaltB64   = buf2b64(newSaltBytes);
    const newKey        = await deriveKey(newPin, newSaltBytes);

    const enc = await aesEncrypt(data, newKey);
    LS.set('vid_salt', newSaltB64);
    LS.set('vid_vault', JSON.stringify(enc));

    return { ok: true, key: newKey };
  } catch {
    return { ok: false, reason: 'WRONG_PIN' };
  }
}
