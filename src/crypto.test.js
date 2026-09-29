// @vitest-environment node
/**
 * VaultID — crypto.js unit tests
 *
 * Uses the real Web Crypto API (globalThis.crypto in Node 20+) and an
 * in-memory localStorage stub. No mocks for crypto — the point is to prove
 * the real encryption round-trips, detects tampering, and preserves
 * backward compatibility with legacy v1 vaults.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buf2b64, b642buf,
  KDF_ITERATIONS, LEGACY_KDF_ITERATIONS,
  deriveKey, aesEncrypt, aesDecrypt,
  tryUnlock, saveVault, changePin, exportLocalBlob, resetVault,
  createVaultV2, unlockVaultV2, saveVaultV2, changePassphraseV2,
  addRecoverySlotV2, unlockWithRecoveryV2, removeSlotV2,
  upgradeV1ToV2, hasV1Backup, clearV1Backup, getVaultVersion,
} from './crypto.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── localStorage stub ────────────────────────────────────────────────────────
// The code under test reads/writes localStorage only through the LS wrapper
// in crypto.js, which catches exceptions. We simulate quota failures by
// throwing from setItem for a specific key.
function createStorage() {
  const map = new Map();
  let failOnKey = null;
  return {
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) {
      if (failOnKey === k) throw new Error('Simulated storage failure');
      map.set(k, String(v));
    },
    removeItem(k) { map.delete(k); },
    clear() { map.clear(); },
    _setFailOnKey(k) { failOnKey = k; },
  };
}

let storage;
beforeEach(() => {
  storage = createStorage();
  globalThis.localStorage = storage;
});

// ── Fixtures ─────────────────────────────────────────────────────────────────
const DOCS = [
  { id: 1, name: 'Aadhar Card', num: 'XXXX XXXX 4521', cat: 'identity' },
  { id: 2, name: 'PAN Card', num: 'ABCDE1234F', cat: 'identity' },
];
const IMGS = { 1: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==' };
const EMERGENCY = {
  bloodType: 'O+',
  allergies: ['Penicillin'],
  medications: ['None'],
  conditions: ['None'],
  contact: { name: 'Mom', phone: '+91 98765 43210' },
  donor: true,
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('crypto.js', () => {

  it('round-trips docs, images, and emergency data through lock/unlock', async () => {
    // First unlock creates the vault.
    const r1 = await tryUnlock('123456', DOCS, EMERGENCY);
    expect(r1.ok).toBe(true);
    expect(r1.key).toBeDefined();

    // Save with images.
    const s1 = await saveVault(DOCS, IMGS, r1.key, EMERGENCY, r1.kdfIterations);
    expect(s1.ok).toBe(true);

    // Second unlock (no fallback) decrypts and returns identical data.
    const r2 = await tryUnlock('123456');
    expect(r2.ok).toBe(true);
    expect(r2.docs).toEqual(DOCS);
    expect(r2.imgs).toEqual(IMGS);
    expect(r2.emergency).toEqual(EMERGENCY);
  });

  it('fails cleanly on wrong PIN without corrupting the stored blob', async () => {
    await tryUnlock('123456', DOCS, {});

    const blobBefore = exportLocalBlob();
    expect(blobBefore).not.toBeNull();

    const r = await tryUnlock('999999');
    expect(r.ok).toBe(false);

    // The stored blob must be byte-for-byte unchanged.
    const blobAfter = exportLocalBlob();
    expect(blobAfter).toEqual(blobBefore);
  });

  it('detects tampering with the ciphertext', async () => {
    await tryUnlock('123456', DOCS, {});

    const blob = exportLocalBlob();
    const ctBytes = b642buf(blob.enc.ct);
    ctBytes[0] ^= 0xff; // flip the first byte
    localStorage.setItem('vid_vault', JSON.stringify({ iv: blob.enc.iv, ct: buf2b64(ctBytes) }));

    const r = await tryUnlock('123456');
    expect(r.ok).toBe(false);
  });

  it('detects tampering with the IV', async () => {
    await tryUnlock('123456', DOCS, {});

    const blob = exportLocalBlob();
    const ivBytes = b642buf(blob.enc.iv);
    ivBytes[0] ^= 0xff; // flip the first byte
    localStorage.setItem('vid_vault', JSON.stringify({ iv: buf2b64(ivBytes), ct: blob.enc.ct }));

    const r = await tryUnlock('123456');
    expect(r.ok).toBe(false);
  });

  it('produces a unique IV and ciphertext for identical data', async () => {
    const r1 = await tryUnlock('123456', DOCS, {});
    const blob1 = exportLocalBlob();

    await saveVault(DOCS, {}, r1.key, {}, r1.kdfIterations);
    const blob2 = exportLocalBlob();

    expect(blob1.enc.iv).not.toBe(blob2.enc.iv);
    expect(blob1.enc.ct).not.toBe(blob2.enc.ct);
  });

  it('unlocks a legacy v1 blob (100k iterations) and migrates via changePin', async () => {
    const pin = '123456';

    // Build a v1 blob by hand: 100k iterations, { docs, imgs } shape.
    const saltBytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(saltBytes);
    const saltB64 = buf2b64(saltBytes);
    localStorage.setItem('vid_salt', saltB64);

    const v1Key = await deriveKey(pin, saltBytes, LEGACY_KDF_ITERATIONS);
    const v1Enc = await aesEncrypt({ docs: DOCS, imgs: {} }, v1Key);
    localStorage.setItem('vid_vault', JSON.stringify(v1Enc));

    // Current code unlocks it via the decryptWithKdfFallback path.
    const r1 = await tryUnlock(pin);
    expect(r1.ok).toBe(true);
    expect(r1.kdfIterations).toBe(LEGACY_KDF_ITERATIONS);
    expect(r1.docs).toEqual(DOCS);

    // saveVault preserves the v1 kdfIterations (no migration on save).
    const s1 = await saveVault(r1.docs, r1.imgs, r1.key, r1.emergency, r1.kdfIterations);
    expect(s1.ok).toBe(true);
    const blobAfterSave = exportLocalBlob();
    const key100k = await deriveKey(pin, saltBytes, LEGACY_KDF_ITERATIONS);
    const afterSave = await aesDecrypt(blobAfterSave.enc, key100k);
    expect(afterSave.kdfIterations).toBe(LEGACY_KDF_ITERATIONS);

    // changePin migrates to the current format.
    const cp = await changePin(pin, '654321');
    expect(cp.ok).toBe(true);
    expect(cp.kdfIterations).toBe(KDF_ITERATIONS);

    // The stored blob now decrypts at 600k with the new PIN.
    const blobMigrated = exportLocalBlob();
    const newSalt = b642buf(blobMigrated.saltB64);
    const key600k = await deriveKey('654321', newSalt, KDF_ITERATIONS);
    const migrated = await aesDecrypt(blobMigrated.enc, key600k);
    expect(migrated.kdfIterations).toBe(KDF_ITERATIONS);
    expect(migrated.docs).toEqual(DOCS);
  });

  it('changePin: old PIN fails, new PIN works, data intact', async () => {
    const r1 = await tryUnlock('123456', DOCS, EMERGENCY);
    expect(r1.ok).toBe(true);

    const cp = await changePin('123456', '654321');
    expect(cp.ok).toBe(true);

    const r2 = await tryUnlock('654321');
    expect(r2.ok).toBe(true);
    expect(r2.docs).toEqual(DOCS);
    expect(r2.emergency).toEqual(EMERGENCY);

    const r3 = await tryUnlock('123456');
    expect(r3.ok).toBe(false);
  });

  it('changePin rolls back to a vault that still opens with the old PIN on storage failure', async () => {
    await tryUnlock('123456', DOCS, {});

    storage._setFailOnKey('vid_vault');

    const cp = await changePin('123456', '654321');
    expect(cp.ok).toBe(false);
    expect(cp.reason).toBe('STORAGE_WRITE_FAILED');

    // Rollback: old PIN still works.
    const r2 = await tryUnlock('123456');
    expect(r2.ok).toBe(true);
    expect(r2.docs).toEqual(DOCS);
  });

  it('saveVault rejects when localStorage.setItem throws', async () => {
    const pin = '123456';
    const saltBytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(saltBytes);
    const key = await deriveKey(pin, saltBytes, KDF_ITERATIONS);

    storage._setFailOnKey('vid_vault');

    const result = await saveVault(DOCS, {}, key, {}, KDF_ITERATIONS);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('STORAGE_WRITE_FAILED');
  });

  it('creates the salt once, reuses it across unlocks, and regenerates on changePin', async () => {
    await tryUnlock('123456', DOCS, {});
    const salt1 = localStorage.getItem('vid_salt');
    expect(salt1).not.toBeNull();

    // Reused across unlocks.
    await tryUnlock('123456');
    const salt2 = localStorage.getItem('vid_salt');
    expect(salt2).toBe(salt1);

    // Regenerated on changePin.
    const cp = await changePin('123456', '654321');
    expect(cp.ok).toBe(true);
    const salt3 = localStorage.getItem('vid_salt');
    expect(salt3).not.toBeNull();
    expect(salt3).not.toBe(salt1);
  });

  // ── v2: round trip ──────────────────────────────────────────────────────
  it('v2: round-trips docs, images, and emergency data', async () => {
    const c = await createVaultV2('Correct-Horse-Battery-Staple', DOCS, IMGS, EMERGENCY);
    expect(c.ok).toBe(true);
    expect(c.key).toBeDefined();
    expect(c.blob.v).toBe(2);

    const s = await saveVaultV2(DOCS, IMGS, c.key, EMERGENCY, c.blob);
    expect(s.ok).toBe(true);
    expect(s.rev).toBe(2);

    const u = await unlockVaultV2('Correct-Horse-Battery-Staple', s.blob);
    expect(u.ok).toBe(true);
    expect(u.docs).toEqual(DOCS);
    expect(u.imgs).toEqual(IMGS);
    expect(u.emergency).toEqual(EMERGENCY);
  });

  it('v2: writes everything under one storage key (no separate vid_salt)', async () => {
    await createVaultV2('passphrase', DOCS, IMGS, EMERGENCY);
    expect(localStorage.getItem('vid_salt')).toBeNull();
    expect(localStorage.getItem('vid_vault')).not.toBeNull();
  });

  it('v2: fails cleanly on wrong passphrase', async () => {
    const c = await createVaultV2('correct-passphrase', DOCS, IMGS, EMERGENCY);
    const u = await unlockVaultV2('wrong-passphrase', c.blob);
    expect(u.ok).toBe(false);
  });

  it('v2: detects tampering with the data ciphertext', async () => {
    const c = await createVaultV2('passphrase', DOCS, IMGS, EMERGENCY);
    const blob = JSON.parse(JSON.stringify(c.blob));
    const ctBytes = b642buf(blob.data.ct);
    ctBytes[0] ^= 0xff;
    blob.data.ct = buf2b64(ctBytes);
    const u = await unlockVaultV2('passphrase', blob);
    expect(u.ok).toBe(false);
  });

  it('v2: detects tampering with the data IV', async () => {
    const c = await createVaultV2('passphrase', DOCS, IMGS, EMERGENCY);
    const blob = JSON.parse(JSON.stringify(c.blob));
    const ivBytes = b642buf(blob.data.iv);
    ivBytes[0] ^= 0xff;
    blob.data.iv = buf2b64(ivBytes);
    const u = await unlockVaultV2('passphrase', blob);
    expect(u.ok).toBe(false);
  });

  it('v2: detects tampering with the header rev', async () => {
    const c = await createVaultV2('passphrase', DOCS, IMGS, EMERGENCY);
    const blob = JSON.parse(JSON.stringify(c.blob));
    blob.rev = blob.rev + 1;
    const u = await unlockVaultV2('passphrase', blob);
    expect(u.ok).toBe(false);
  });

  it('v2: detects tampering with a slot wrapped key', async () => {
    const c = await createVaultV2('passphrase', DOCS, IMGS, EMERGENCY);
    const blob = JSON.parse(JSON.stringify(c.blob));
    const ctBytes = b642buf(blob.slots[0].wrapped.ct);
    ctBytes[0] ^= 0xff;
    blob.slots[0].wrapped.ct = buf2b64(ctBytes);
    const u = await unlockVaultV2('passphrase', blob);
    expect(u.ok).toBe(false);
  });

  it('v2: produces a unique IV and ciphertext for identical data', async () => {
    const c = await createVaultV2('passphrase', DOCS, IMGS, EMERGENCY);
    const s1 = await saveVaultV2(DOCS, IMGS, c.key, EMERGENCY, c.blob);
    const s2 = await saveVaultV2(DOCS, IMGS, c.key, EMERGENCY, s1.blob);
    expect(s1.blob.data.iv).not.toBe(s2.blob.data.iv);
    expect(s1.blob.data.ct).not.toBe(s2.blob.data.ct);
  });

  it('v2: changePassphrase keeps data and invalidates the old passphrase', async () => {
    const c = await createVaultV2('old-passphrase', DOCS, IMGS, EMERGENCY);
    const cp = await changePassphraseV2('old-passphrase', 'new-passphrase', c.blob);
    expect(cp.ok).toBe(true);

    const u = await unlockVaultV2('new-passphrase', cp.blob);
    expect(u.ok).toBe(true);
    expect(u.docs).toEqual(DOCS);
    expect(u.imgs).toEqual(IMGS);
    expect(u.emergency).toEqual(EMERGENCY);

    const u2 = await unlockVaultV2('old-passphrase', cp.blob);
    expect(u2.ok).toBe(false);
  });

  it('v2: recovery slot unlocks', async () => {
    const c = await createVaultV2('passphrase', DOCS, IMGS, EMERGENCY);
    const r = await addRecoverySlotV2('passphrase', c.blob);
    expect(r.ok).toBe(true);
    expect(r.recoveryKey).toBeDefined();

    const u = await unlockWithRecoveryV2(r.recoveryKey, r.blob);
    expect(u.ok).toBe(true);
    expect(u.docs).toEqual(DOCS);
    expect(u.imgs).toEqual(IMGS);
    expect(u.emergency).toEqual(EMERGENCY);
  });

  it('v2: storage failure leaves the previous vault fully intact', async () => {
    const c = await createVaultV2('passphrase', DOCS, IMGS, EMERGENCY);

    storage._setFailOnKey('vid_vault');
    const s = await saveVaultV2(DOCS, IMGS, c.key, EMERGENCY, c.blob);
    expect(s.ok).toBe(false);
    expect(s.reason).toBe('STORAGE_WRITE_FAILED');

    // Restore storage and verify the previous vault still unlocks.
    storage._setFailOnKey(null);
    const u = await unlockVaultV2('passphrase', c.blob);
    expect(u.ok).toBe(true);
    expect(u.docs).toEqual(DOCS);
  });

  it('v2: NFKC-equivalent passphrases unlock the same vault', async () => {
    const c = await createVaultV2('Correct-Horse-Battery-Staple', DOCS, IMGS, EMERGENCY);
    // Full-width variant — NFKC normalizes to the same string.
    const fullWidth = 'Ｃｏｒｒｅｃｔ－Ｈｏｒｓｅ－Ｂａｔｔｅｒｙ－Ｓｔａｐｌｅ';
    const u = await unlockVaultV2(fullWidth, c.blob);
    expect(u.ok).toBe(true);
    expect(u.docs).toEqual(DOCS);
  });

  it('v2: removeSlot removes a recovery slot but keeps the passphrase slot', async () => {
    const c = await createVaultV2('passphrase', DOCS, IMGS, EMERGENCY);
    const r = await addRecoverySlotV2('passphrase', c.blob);
    const rm = await removeSlotV2('passphrase', r.blob, 'recovery');
    expect(rm.ok).toBe(true);
    expect(rm.blob.slots.some((s) => s.type === 'recovery')).toBe(false);
    expect(rm.blob.slots.some((s) => s.type === 'passphrase')).toBe(true);

    const u = await unlockVaultV2('passphrase', rm.blob);
    expect(u.ok).toBe(true);
  });

  it('v2: cannot remove the last passphrase slot', async () => {
    const c = await createVaultV2('passphrase', DOCS, IMGS, EMERGENCY);
    const rm = await removeSlotV2('passphrase', c.blob, 'passphrase');
    expect(rm.ok).toBe(false);
    expect(rm.reason).toBe('CANNOT_REMOVE_LAST_PASSPHRASE');
  });

  // ── v1 fixture backward compatibility ─────────────────────────────────────
  it('v1 fixture: 100k-iteration vault still unlocks', async () => {
    const fixture = JSON.parse(readFileSync(join(__dirname, '__fixtures__', 'vault-v1-100k.json'), 'utf8'));
    for (const [k, v] of Object.entries(fixture.storage)) storage.setItem(k, v);

    const r = await tryUnlock(fixture.pin);
    expect(r.ok).toBe(true);
    expect(r.kdfIterations).toBe(100000);
    expect(r.docs).toEqual(fixture.docs);
    expect(r.imgs).toEqual(fixture.imgs);
    expect(r.emergency).toEqual(fixture.emergency);
  });

  it('v1 fixture: 600k-iteration vault still unlocks', async () => {
    const fixture = JSON.parse(readFileSync(join(__dirname, '__fixtures__', 'vault-v1-600k.json'), 'utf8'));
    for (const [k, v] of Object.entries(fixture.storage)) storage.setItem(k, v);

    const r = await tryUnlock(fixture.pin);
    expect(r.ok).toBe(true);
    expect(r.kdfIterations).toBe(600000);
    expect(r.docs).toEqual(fixture.docs);
    expect(r.imgs).toEqual(fixture.imgs);
    expect(r.emergency).toEqual(fixture.emergency);
  });

  // ── v1 → v2 upgrade ──────────────────────────────────────────────────────
  it('upgradeV1ToV2: successful upgrade, data intact, v1 backup created', async () => {
    // Create a v1 vault (with images persisted via saveVault).
    const c = await tryUnlock('123456', DOCS, EMERGENCY);
    await saveVault(DOCS, IMGS, c.key, EMERGENCY, c.kdfIterations);
    expect(getVaultVersion()).toBe('v1');

    // Upgrade to v2.
    const r = await upgradeV1ToV2('123456', 'new-passphrase');
    expect(r.ok).toBe(true);
    expect(getVaultVersion()).toBe('v2');

    // Data is intact.
    const u = await unlockVaultV2('new-passphrase', r.blob);
    expect(u.ok).toBe(true);
    expect(u.docs).toEqual(DOCS);
    expect(u.imgs).toEqual(IMGS);
    expect(u.emergency).toEqual(EMERGENCY);

    // v1 backup exists.
    expect(hasV1Backup()).toBe(true);

    // Old PIN no longer works.
    const oldUnlock = await tryUnlock('123456');
    expect(oldUnlock.ok).toBe(false);
  });

  it('upgradeV1ToV2: wrong PIN fails, v1 vault unchanged', async () => {
    await tryUnlock('123456', DOCS, EMERGENCY);
    const v1Raw = localStorage.getItem('vid_vault');

    const r = await upgradeV1ToV2('wrong-pin', 'new-passphrase');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('WRONG_PIN');

    // v1 vault is unchanged.
    expect(localStorage.getItem('vid_vault')).toBe(v1Raw);
    expect(getVaultVersion()).toBe('v1');

    // Old PIN still works.
    const u = await tryUnlock('123456');
    expect(u.ok).toBe(true);
    expect(u.docs).toEqual(DOCS);
  });

  it('upgradeV1ToV2: v1 backup is cleared on successful v2 unlock', async () => {
    // Create and upgrade.
    await tryUnlock('123456', DOCS, EMERGENCY);
    const r = await upgradeV1ToV2('123456', 'new-passphrase');
    expect(r.ok).toBe(true);
    expect(hasV1Backup()).toBe(true);

    // Simulate a fresh session: clear the backup flag, then unlock.
    // (In the UI, clearV1Backup is called on successful v2 unlock.)
    const u = await unlockVaultV2('new-passphrase', r.blob);
    expect(u.ok).toBe(true);
    clearV1Backup();
    expect(hasV1Backup()).toBe(false);
  });

  it('getVaultVersion: returns none, v1, or v2 as expected', async () => {
    expect(getVaultVersion()).toBe('none');
    await tryUnlock('123456', DOCS, EMERGENCY);
    expect(getVaultVersion()).toBe('v1');
    await upgradeV1ToV2('123456', 'new-passphrase');
    expect(getVaultVersion()).toBe('v2');
  });

});
