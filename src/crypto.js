/**
 * VaultID — Crypto Module
 *
 * Security model:
 *   PIN  ──►  PBKDF2 (600 000 iter, SHA-256, random salt)  ──►  AES-256-GCM key
 *   key  ──►  encrypt({ docs, imgs, emergency })  ──►  { iv, ct } stored in localStorage
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
export const KDF_ITERATIONS = 600_000;
export const LEGACY_KDF_ITERATIONS = 100_000;

export async function deriveKey(pin, salt, iterations = KDF_ITERATIONS) {
  const raw = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// ── AES-256-GCM encrypt / decrypt ────────────────────────────────────────────
// Optional AAD (additional authenticated data) is bound into the GCM auth
// tag. v1 callers omit it; v2 uses it to bind data to the vault header.
export async function aesEncrypt(data, key, aad) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const params = { name: 'AES-GCM', iv };
  if (aad) params.additionalData = new TextEncoder().encode(aad);
  const ct = await crypto.subtle.encrypt(
    params,
    key,
    new TextEncoder().encode(JSON.stringify(data))
  );
  return { iv: buf2b64(iv), ct: buf2b64(ct) };
}

export async function aesDecrypt({ iv, ct }, key, aad) {
  const params = { name: 'AES-GCM', iv: b642buf(iv) };
  if (aad) params.additionalData = new TextEncoder().encode(aad);
  const pt = await crypto.subtle.decrypt(params, key, b642buf(ct));
  return JSON.parse(new TextDecoder().decode(pt));
}

async function decryptWithKdfFallback(pin, salt, enc) {
  let lastError;
  for (const iterations of [KDF_ITERATIONS, LEGACY_KDF_ITERATIONS]) {
    try {
      const key = await deriveKey(pin, salt, iterations);
      const data = await aesDecrypt(enc, key);
      return { key, data, iterations };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
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

// ── v2 vault format ──────────────────────────────────────────────────────────
// Versioned, self-contained blob: { v, rev, slots, data }. One localStorage
// key, one setItem. Salt and KDF params live inside the blob. The DEK is
// wrapped by per-slot KEKs; the KEK never encrypts data directly.

const VAULT_V2 = 2;

// Deterministic JSON for AAD binding — sorted keys, no whitespace.
function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(value[k])).join(',') + '}';
}

// NFKC-normalize so the same passphrase works across devices/keyboards.
// Never trimmed or otherwise altered.
function normalizePassphrase(passphrase) {
  return passphrase.normalize('NFKC');
}

// Generate a random AES-256-GCM DEK. Extractable only long enough to wrap it.
async function generateDEK() {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey'],
  );
}

// Wrap the DEK with a KEK (AES-GCM). AAD binds the wrapped key to its slot.
async function wrapDEK(dek, kek, aad) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrapped = await crypto.subtle.wrapKey(
    'raw', dek, kek,
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(aad) },
  );
  return { iv: buf2b64(iv), ct: buf2b64(wrapped) };
}

// Unwrap the DEK. Session keys are non-extractable; re-wrap paths
// (passphrase change, slot add/remove) unwrap extractable because
// wrapKey requires the key being wrapped to be extractable.
async function unwrapDEK(wrapped, kek, aad, extractable = false) {
  return crypto.subtle.unwrapKey(
    'raw', b642buf(wrapped.ct), kek,
    { name: 'AES-GCM', iv: b642buf(wrapped.iv), additionalData: new TextEncoder().encode(aad) },
    { name: 'AES-GCM', length: 256 },
    extractable,
    ['encrypt', 'decrypt', 'wrapKey'],
  );
}

// Derive a KEK from a passphrase using the slot's KDF params.
async function deriveKEK(passphrase, kdfParams, salt) {
  const raw = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(normalizePassphrase(passphrase)),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: kdfParams.iterations, hash: 'SHA-256' },
    raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  );
}

// Detect whether a stored blob is v2. Returns the parsed blob or null.
function asV2Blob(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.v === VAULT_V2) return parsed;
  } catch { /* not JSON */ }
  return null;
}

// Returns true if the local vault is v2 (or if no vault exists yet —
// new vaults will be v2). Used by the sync guard.
export function isVaultV2() {
  return asV2Blob(LS.get('vid_vault')) !== null;
}

// ── v2: create ───────────────────────────────────────────────────────────────
export async function createVaultV2(passphrase, docs = [], imgs = {}, emergency = {}) {
  try {
    const dek = await generateDEK();
    const kekSalt = crypto.getRandomValues(new Uint8Array(16));
    const kdfParams = { name: 'PBKDF2-SHA256', iterations: KDF_ITERATIONS };
    const kek = await deriveKEK(passphrase, kdfParams, kekSalt);

    const slotMeta = { type: 'passphrase', kdf: kdfParams, salt: buf2b64(kekSalt) };
    const wrapped = await wrapDEK(dek, kek, canonicalize(slotMeta));
    const slot = { ...slotMeta, wrapped };

    const header = { v: VAULT_V2, rev: 1, slots: [slot] };
    const data = await aesEncrypt({ docs, imgs, emergency }, dek, canonicalize(header));

    const blob = { ...header, data };
    if (!LS.set('vid_vault', JSON.stringify(blob))) {
      return { ok: false, reason: 'STORAGE_WRITE_FAILED' };
    }

    // Unwrap the DEK for the session (non-extractable).
    const sessionKey = await unwrapDEK(wrapped, kek, canonicalize(slotMeta));
    return { ok: true, key: sessionKey, docs, imgs, emergency, rev: 1, blob };
  } catch (e) {
    return { ok: false, reason: e?.message || 'VAULT_CREATE_FAILED' };
  }
}

// ── v2: unlock ───────────────────────────────────────────────────────────────
export async function unlockVaultV2(passphrase, blob) {
  try {
    const slot = blob.slots.find((s) => s.type === 'passphrase');
    if (!slot) return { ok: false, reason: 'NO_PASSPHRASE_SLOT' };

    const kek = await deriveKEK(passphrase, slot.kdf, b642buf(slot.salt));
    const slotMeta = { type: slot.type, kdf: slot.kdf, salt: slot.salt };
    const dek = await unwrapDEK(slot.wrapped, kek, canonicalize(slotMeta), true);

    const header = { v: blob.v, rev: blob.rev, slots: blob.slots };
    const data = await aesDecrypt(blob.data, dek, canonicalize(header));

    return { ok: true, key: dek, docs: data.docs ?? [], imgs: data.imgs ?? {}, emergency: data.emergency ?? {}, rev: blob.rev, blob };
  } catch {
    return { ok: false };
  }
}

// ── v2: unlock with recovery key ─────────────────────────────────────────────
export async function unlockWithRecoveryV2(recoveryKeyB64, blob) {
  try {
    const slot = blob.slots.find((s) => s.type === 'recovery');
    if (!slot) return { ok: false, reason: 'NO_RECOVERY_SLOT' };

    const recoveryKey = await crypto.subtle.importKey(
      'raw', b642buf(recoveryKeyB64),
      { name: 'AES-GCM', length: 256 },
      false,
      ['wrapKey', 'unwrapKey'],
    );

    const dek = await unwrapDEK(slot.wrapped, recoveryKey, canonicalize({ type: 'recovery' }));
    const header = { v: blob.v, rev: blob.rev, slots: blob.slots };
    const data = await aesDecrypt(blob.data, dek, canonicalize(header));

    return { ok: true, key: dek, docs: data.docs ?? [], imgs: data.imgs ?? {}, emergency: data.emergency ?? {}, rev: blob.rev, blob };
  } catch {
    return { ok: false };
  }
}

// ── v2: save (bumps rev, re-encrypts data, does not re-derive) ──────────────
export async function saveVaultV2(docs, imgs, key, emergency = {}, blob) {
  try {
    const rev = blob.rev + 1;
    const header = { v: VAULT_V2, rev, slots: blob.slots };
    const data = await aesEncrypt({ docs, imgs, emergency }, key, canonicalize(header));
    const newBlob = { ...header, data };

    if (!LS.set('vid_vault', JSON.stringify(newBlob))) {
      return { ok: false, reason: 'STORAGE_WRITE_FAILED' };
    }
    return { ok: true, blob: newBlob, rev };
  } catch (e) {
    return { ok: false, reason: e?.message || 'ENCRYPTION_FAILED' };
  }
}

// ── v2: change passphrase (re-wraps DEK under a new KEK) ───────────────────
// The DEK stays the same; the data is re-encrypted with a fresh IV and the
// new header as AAD (the header changed, so the AAD must change too).
export async function changePassphraseV2(oldPassphrase, newPassphrase, blob) {
  try {
    const slot = blob.slots.find((s) => s.type === 'passphrase');
    if (!slot) return { ok: false, reason: 'NO_PASSPHRASE_SLOT' };

    const oldKek = await deriveKEK(oldPassphrase, slot.kdf, b642buf(slot.salt));
    const slotMeta = { type: 'passphrase', kdf: slot.kdf, salt: slot.salt };
    const dek = await unwrapDEK(slot.wrapped, oldKek, canonicalize(slotMeta), true);

    // Decrypt the data with the current header.
    const currentHeader = { v: blob.v, rev: blob.rev, slots: blob.slots };
    const data = await aesDecrypt(blob.data, dek, canonicalize(currentHeader));

    // Derive a new KEK from the new passphrase and re-wrap the DEK.
    const newKekSalt = crypto.getRandomValues(new Uint8Array(16));
    const newKek = await deriveKEK(newPassphrase, slot.kdf, newKekSalt);
    const newSlotMeta = { type: 'passphrase', kdf: slot.kdf, salt: buf2b64(newKekSalt) };
    const newWrapped = await wrapDEK(dek, newKek, canonicalize(newSlotMeta));

    const newSlots = blob.slots.map((s) =>
      s.type === 'passphrase' ? { ...newSlotMeta, wrapped: newWrapped } : s,
    );
    const header = { v: VAULT_V2, rev: blob.rev + 1, slots: newSlots };
    const newData = await aesEncrypt(data, dek, canonicalize(header));
    const newBlob = { ...header, data: newData };

    if (!LS.set('vid_vault', JSON.stringify(newBlob))) {
      return { ok: false, reason: 'STORAGE_WRITE_FAILED' };
    }
    return { ok: true, blob: newBlob, rev: header.rev };
  } catch (e) {
    return { ok: false, reason: e?.name === 'OperationError' ? 'WRONG_PASSPHRASE' : 'PASSPHRASE_CHANGE_FAILED' };
  }
}

// ── v2: add recovery slot (opt-in) ───────────────────────────────────────────
export async function addRecoverySlotV2(passphrase, blob) {
  try {
    const slot = blob.slots.find((s) => s.type === 'passphrase');
    if (!slot) return { ok: false, reason: 'NO_PASSPHRASE_SLOT' };

    const kek = await deriveKEK(passphrase, slot.kdf, b642buf(slot.salt));
    const slotMeta = { type: 'passphrase', kdf: slot.kdf, salt: slot.salt };
    const dek = await unwrapDEK(slot.wrapped, kek, canonicalize(slotMeta), true);

    // Generate a random 256-bit recovery key.
    const recoveryKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 }, true, ['wrapKey', 'unwrapKey'],
    );
    const recoveryKeyRaw = await crypto.subtle.exportKey('raw', recoveryKey);
    const recoveryKeyB64 = buf2b64(recoveryKeyRaw);

    const wrapped = await wrapDEK(dek, recoveryKey, canonicalize({ type: 'recovery' }));
    const recoverySlot = { type: 'recovery', wrapped };

    // Decrypt the data with the current header.
    const currentHeader = { v: blob.v, rev: blob.rev, slots: blob.slots };
    const data = await aesDecrypt(blob.data, dek, canonicalize(currentHeader));

    const newSlots = [...blob.slots, recoverySlot];
    const header = { v: VAULT_V2, rev: blob.rev + 1, slots: newSlots };
    const newData = await aesEncrypt(data, dek, canonicalize(header));
    const newBlob = { ...header, data: newData };

    if (!LS.set('vid_vault', JSON.stringify(newBlob))) {
      return { ok: false, reason: 'STORAGE_WRITE_FAILED' };
    }
    return { ok: true, recoveryKey: recoveryKeyB64, blob: newBlob, rev: header.rev };
  } catch (e) {
    return { ok: false, reason: e?.message || 'RECOVERY_SLOT_FAILED' };
  }
}

// ── v2: remove a slot ────────────────────────────────────────────────────────
export async function removeSlotV2(passphrase, blob, slotType) {
  try {
    const slot = blob.slots.find((s) => s.type === 'passphrase');
    if (!slot) return { ok: false, reason: 'NO_PASSPHRASE_SLOT' };

    const kek = await deriveKEK(passphrase, slot.kdf, b642buf(slot.salt));
    const slotMeta = { type: 'passphrase', kdf: slot.kdf, salt: slot.salt };
    const dek = await unwrapDEK(slot.wrapped, kek, canonicalize(slotMeta), true);

    const newSlots = blob.slots.filter((s) => s.type !== slotType);
    if (newSlots.length === blob.slots.length) {
      return { ok: false, reason: 'SLOT_NOT_FOUND' };
    }
    if (!newSlots.some((s) => s.type === 'passphrase')) {
      return { ok: false, reason: 'CANNOT_REMOVE_LAST_PASSPHRASE' };
    }

    // Decrypt the data with the current header.
    const currentHeader = { v: blob.v, rev: blob.rev, slots: blob.slots };
    const data = await aesDecrypt(blob.data, dek, canonicalize(currentHeader));

    const header = { v: VAULT_V2, rev: blob.rev + 1, slots: newSlots };
    const newData = await aesEncrypt(data, dek, canonicalize(header));
    const newBlob = { ...header, data: newData };

    if (!LS.set('vid_vault', JSON.stringify(newBlob))) {
      return { ok: false, reason: 'STORAGE_WRITE_FAILED' };
    }
    return { ok: true, blob: newBlob, rev: header.rev };
  } catch (e) {
    return { ok: false, reason: e?.message || 'SLOT_REMOVE_FAILED' };
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Attempt to unlock the vault with the given PIN.
 * @param {string} pin
 * @param {Array}  fallbackDocs  Used only on first run to pre-populate vault.
 * @returns {{ ok: boolean, key?: CryptoKey, docs?: Array, imgs?: object }}
 */
export async function tryUnlock(pin, fallbackDocs = [], fallbackEmergency = {}) {
  try {
    const raw = LS.get('vid_vault');

    // v2 detection — delegate to the v2 unlock path.
    const v2Blob = asV2Blob(raw);
    if (v2Blob) {
      return await unlockVaultV2(pin, v2Blob);
    }

    // v1 path
    const salt = await getSalt();

    if (!raw) {
      // First run — initialise vault with demo / empty docs using the current
      // KDF cost. Legacy vaults are still accepted by the fallback below.
      const key = await deriveKey(pin, salt, KDF_ITERATIONS);
      const enc = await aesEncrypt({ docs: fallbackDocs, imgs: {}, emergency: fallbackEmergency, kdfIterations: KDF_ITERATIONS }, key);
      if (!LS.set('vid_vault', JSON.stringify(enc))) {
        return { ok: false, reason: 'STORAGE_WRITE_FAILED' };
      }
      const updatedAt = new Date().toISOString();
      LS.set('vid_updated_at', updatedAt);
      LS.set('vid_dirty', '0');
      return { ok: true, key, docs: fallbackDocs, imgs: {}, emergency: fallbackEmergency, kdfIterations: KDF_ITERATIONS, updatedAt };
    }

    const { key, data, iterations } = await decryptWithKdfFallback(pin, salt, JSON.parse(raw));
    return { ok: true, key, docs: data.docs ?? [], imgs: data.imgs ?? {}, emergency: data.emergency ?? {}, kdfIterations: iterations, updatedAt: LS.get('vid_updated_at') };
  } catch {
    return { ok: false };
  }
}

/**
 * Encrypt and persist the vault to localStorage.
 */
export async function saveVault(docs, imgs, key, emergency = {}, kdfIterations = KDF_ITERATIONS) {
  // v2 detection — delegate to the v2 save path.
  const raw = LS.get('vid_vault');
  const v2Blob = asV2Blob(raw);
  if (v2Blob) {
    return await saveVaultV2(docs, imgs, key, emergency, v2Blob);
  }

  try {
    const enc = await aesEncrypt({ docs, imgs, emergency, kdfIterations }, key);
    const raw = JSON.stringify(enc);
    if (!LS.set('vid_vault', raw)) {
      return { ok: false, reason: 'STORAGE_WRITE_FAILED' };
    }

    const updatedAt = new Date().toISOString();
    LS.set('vid_updated_at', updatedAt);
    LS.set('vid_dirty', '1');
    return {
      ok: true,
      blob: { saltB64: LS.get('vid_salt'), enc },
      updatedAt,
    };
  } catch (e) {
    console.warn('[VaultID] Save failed:', e);
    return { ok: false, reason: e?.message || 'ENCRYPTION_FAILED' };
  }
}

/**
 * Wipe the vault from localStorage (for dev / reset flows).
 */
export function resetVault() {
  LS.del('vid_vault');
  LS.del('vid_salt');
  LS.del('vid_updated_at');
  LS.del('vid_dirty');
}

/** Mark the local encrypted blob as successfully mirrored to the cloud. */
export function markVaultSynced() {
  if (isVaultV2()) return; // sync is paused for v2 — don't touch vid_dirty
  LS.set('vid_dirty', '0');
}

/**
 * Return the raw { saltB64, enc } currently in localStorage, for pushing to
 * cloud sync. Returns null if there's nothing to sync yet.
 */
export function exportLocalBlob() {
  const saltB64 = LS.get('vid_salt');
  const raw     = LS.get('vid_vault');
  if (!saltB64 || !raw) return null;

  try {
    const enc = JSON.parse(raw);
    if (!enc?.iv || !enc?.ct) return null;
    return { saltB64, enc, updatedAt: LS.get('vid_updated_at'), dirty: LS.get('vid_dirty') === '1' };
  } catch {
    return null;
  }
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
    const { key, data, iterations } = await decryptWithKdfFallback(pin, salt, remote.enc);

    const previousSalt = LS.get('vid_salt');
    const previousVault = LS.get('vid_vault');
    const saltWritten = LS.set('vid_salt', remote.saltB64);
    const vaultWritten = saltWritten && LS.set('vid_vault', JSON.stringify(remote.enc));
    if (!saltWritten || !vaultWritten) {
      if (previousSalt) LS.set('vid_salt', previousSalt); else LS.del('vid_salt');
      if (previousVault) LS.set('vid_vault', previousVault); else LS.del('vid_vault');
      return { ok: false, reason: 'STORAGE_WRITE_FAILED' };
    }
    LS.set('vid_updated_at', remote.updatedAt || new Date().toISOString());
    LS.set('vid_dirty', '0');

    return {
      ok: true,
      key,
      docs: data.docs ?? [],
      imgs: data.imgs ?? {},
      emergency: data.emergency ?? {},
      kdfIterations: iterations,
      updatedAt: remote.updatedAt || LS.get('vid_updated_at'),
    };
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
    const raw     = LS.get('vid_vault');
    if (!raw) return { ok: false, reason: 'NO_VAULT' };

    // Verify the old PIN actually unlocks the vault before changing anything.
    const { data } = await decryptWithKdfFallback(oldPin, oldSalt, JSON.parse(raw));

    // Fresh salt + current KDF cost for the new PIN.
    const newSaltBytes = crypto.getRandomValues(new Uint8Array(16));
    const newSaltB64   = buf2b64(newSaltBytes);
    const newKey        = await deriveKey(newPin, newSaltBytes, KDF_ITERATIONS);

    const enc = await aesEncrypt({ ...data, kdfIterations: KDF_ITERATIONS }, newKey);
    const previousSalt = LS.get('vid_salt');
    const previousVault = LS.get('vid_vault');
    const saltWritten = LS.set('vid_salt', newSaltB64);
    const vaultWritten = saltWritten && LS.set('vid_vault', JSON.stringify(enc));

    if (!saltWritten || !vaultWritten) {
      // Best-effort rollback prevents a partial salt/ciphertext update from
      // locking the user out of the previous vault.
      if (previousSalt) LS.set('vid_salt', previousSalt); else LS.del('vid_salt');
      if (previousVault) LS.set('vid_vault', previousVault); else LS.del('vid_vault');
      return { ok: false, reason: 'STORAGE_WRITE_FAILED' };
    }

    const updatedAt = new Date().toISOString();
    LS.set('vid_updated_at', updatedAt);
    LS.set('vid_dirty', '1');
    return {
      ok: true,
      key: newKey,
      blob: { saltB64: newSaltB64, enc },
      kdfIterations: KDF_ITERATIONS,
      updatedAt,
    };
  } catch (e) {
    return { ok: false, reason: e?.name === 'OperationError' ? 'WRONG_PIN' : 'PIN_CHANGE_FAILED' };
  }
}
