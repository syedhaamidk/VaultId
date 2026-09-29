/**
 * Generate frozen v1 test fixtures for crypto.js backward-compat tests.
 *
 * Run BEFORE any crypto.js changes. The fixtures capture the exact
 * localStorage state of a real v1 vault so tests can prove that v1 vaults
 * remain unlockable for the life of the project.
 *
 *   node scripts/generate-fixtures.mjs
 *
 * Output: src/__fixtures__/vault-v1-100k.json
 *         src/__fixtures__/vault-v1-600k.json
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'src', '__fixtures__');

// ── localStorage stub (must match what crypto.js expects) ───────────────────
function createStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    clear: () => map.clear(),
    _dump: () => Object.fromEntries(map),
  };
}

// ── Fixture data (realistic but clearly fake) ────────────────────────────────
const DOCS = [
  { id: 1, name: 'Aadhar Card', num: 'XXXX XXXX 4521', cat: 'identity', by: 'UIDAI', issued: '2015-06-10', expires: null, notes: 'Primary government ID' },
  { id: 2, name: 'PAN Card', num: 'ABCDE1234F', cat: 'identity', by: 'Income Tax Dept.', issued: '2018-03-20', expires: null, notes: 'Required for transactions ≥ ₹50k' },
  { id: 3, name: "Driver's License", num: 'KA01-2020-0045123', cat: 'identity', by: 'Karnataka RTO', issued: '2020-03-15', expires: '2040-03-15', notes: '' },
];
const IMGS = {
  1: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
};
const EMERGENCY = {
  bloodType: 'O+',
  allergies: ['Penicillin'],
  medications: ['None currently'],
  conditions: ['Mild myopia (corrected)'],
  contact: { name: 'Mom', phone: '+91 98765 43210' },
  donor: true,
};

// ── Generate a v1 vault at a specific KDF iteration count ───────────────────
async function makeV1Vault(pin, iterations) {
  const storage = createStorage();
  globalThis.localStorage = storage;

  // Import crypto.js fresh (it reads localStorage at call time, not import time).
  const crypto = await import('../src/crypto.js');

  if (iterations === crypto.KDF_ITERATIONS) {
    // Use the normal first-run path for the current KDF cost.
    const r = await crypto.tryUnlock(pin, DOCS, EMERGENCY);
    if (!r.ok) throw new Error('tryUnlock failed for 600k fixture');
    // Persist images (tryUnlock creates the vault with imgs: {}).
    const s = await crypto.saveVault(DOCS, IMGS, r.key, EMERGENCY, r.kdfIterations);
    if (!s.ok) throw new Error('saveVault failed for 600k fixture');
  } else {
    // Manually build a legacy vault (simulates an old device).
    const saltBytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.deriveKey(pin, saltBytes, iterations);
    const enc = await crypto.aesEncrypt(
      { docs: DOCS, imgs: IMGS, emergency: EMERGENCY, kdfIterations: iterations },
      key,
    );
    storage.setItem('vid_salt', crypto.buf2b64(saltBytes));
    storage.setItem('vid_vault', JSON.stringify(enc));
    storage.setItem('vid_updated_at', new Date().toISOString());
    storage.setItem('vid_dirty', '0');
  }

  return {
    pin,
    iterations,
    docs: DOCS,
    imgs: IMGS,
    emergency: EMERGENCY,
    storage: storage._dump(),
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────
mkdirSync(outDir, { recursive: true });

const fixtures = [
  { name: 'vault-v1-100k.json', pin: '123456', iterations: 100_000 },
  { name: 'vault-v1-600k.json', pin: '654321', iterations: 600_000 },
];

for (const { name, pin, iterations } of fixtures) {
  const fixture = await makeV1Vault(pin, iterations);
  const path = join(outDir, name);
  writeFileSync(path, JSON.stringify(fixture, null, 2) + '\n');
  console.log(`Wrote ${name} (pin=${pin}, iterations=${iterations})`);
}

console.log('Done. Fixtures are frozen — commit them under src/__fixtures__/.');
