// @vitest-environment node
/**
 * VaultID — sync guard tests
 *
 * Verifies that v2 vaults are fully inert on the sync layer (no push, no
 * pull, no markVaultSynced) while v1 vaults behave exactly as before.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock Supabase client ─────────────────────────────────────────────────────
const upsertMock = vi.fn(() => ({ error: null }));
const maybeSingleMock = vi.fn(() => ({ data: null, error: null }));

vi.mock('./supabaseClient.js', () => ({
  supabaseEnabled: true,
  supabase: {
    from: vi.fn(() => ({
      upsert: upsertMock,
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: maybeSingleMock,
        })),
      })),
    })),
    auth: {
      getSession: vi.fn(() => ({ data: { session: { user: { id: 'user-1' } } }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithOAuth: vi.fn(() => ({ error: null })),
      signOut: vi.fn(() => ({ error: null })),
    },
  },
}));

// Import after the mock is registered.
import { pushVault, pullVault, getSyncStatus } from './sync.js';
import { createVaultV2, tryUnlock, markVaultSynced, exportLocalBlob } from './crypto.js';

// ── localStorage stub ────────────────────────────────────────────────────────
function createStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    clear: () => map.clear(),
  };
}

let storage;
beforeEach(() => {
  storage = createStorage();
  globalThis.localStorage = storage;
  upsertMock.mockClear();
  maybeSingleMock.mockClear();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('sync guard', () => {

  it('v2 vault: pushVault makes zero network calls and returns SYNC_PAUSED_V2', async () => {
    await createVaultV2('passphrase', [{ id: 1 }], {}, {});

    const result = await pushVault('user-1', 'salt', { iv: 'iv', ct: 'ct' });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('SYNC_PAUSED_V2');
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it('v2 vault: pullVault makes zero network calls and returns SYNC_PAUSED_V2', async () => {
    await createVaultV2('passphrase', [{ id: 1 }], {}, {});

    const result = await pullVault('user-1');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('SYNC_PAUSED_V2');
    expect(maybeSingleMock).not.toHaveBeenCalled();
  });

  it('v2 vault: markVaultSynced is a no-op (vid_dirty untouched)', async () => {
    const c = await createVaultV2('passphrase', [{ id: 1 }], {}, {});
    storage.setItem('vid_dirty', '1');

    markVaultSynced();
    expect(storage.getItem('vid_dirty')).toBe('1');
  });

  it('v2 vault: getSyncStatus returns paused_v2', async () => {
    await createVaultV2('passphrase', [{ id: 1 }], {}, {});
    const status = getSyncStatus();
    expect(status.status).toBe('paused_v2');
    expect(status.reason).toBe('Sync paused for upgraded vaults');
  });

  it('v2 vault: full sync cycle leaves remote row and vid_dirty untouched', async () => {
    await createVaultV2('passphrase', [{ id: 1 }], {}, {});
    storage.setItem('vid_dirty', '1');

    const pushResult = await pushVault('user-1', 'salt', { iv: 'iv', ct: 'ct' });
    const pullResult = await pullVault('user-1');
    markVaultSynced();

    expect(pushResult.ok).toBe(false);
    expect(pullResult.ok).toBe(false);
    expect(upsertMock).not.toHaveBeenCalled();
    expect(maybeSingleMock).not.toHaveBeenCalled();
    expect(storage.getItem('vid_dirty')).toBe('1');
  });

  // ── v1 behavior unchanged ─────────────────────────────────────────────────

  it('v1 vault: pushVault still calls Supabase', async () => {
    await tryUnlock('123456', [{ id: 1 }], {});

    const result = await pushVault('user-1', 'salt', { iv: 'iv', ct: 'ct' });
    expect(result.ok).toBe(true);
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });

  it('v1 vault: pullVault still calls Supabase and returns data', async () => {
    await tryUnlock('123456', [{ id: 1 }], {});
    maybeSingleMock.mockReturnValueOnce({
      data: { salt: 'salt', iv: 'iv', ciphertext: 'ct', updated_at: '2026-01-01' },
      error: null,
    });

    const result = await pullVault('user-1');
    expect(result.ok).toBe(true);
    expect(result.found).toBe(true);
    expect(result.salt).toBe('salt');
    expect(maybeSingleMock).toHaveBeenCalledTimes(1);
  });

  it('v1 vault: markVaultSynced still clears vid_dirty', async () => {
    await tryUnlock('123456', [{ id: 1 }], {});
    storage.setItem('vid_dirty', '1');

    markVaultSynced();
    expect(storage.getItem('vid_dirty')).toBe('0');
  });

  it('v1 vault: getSyncStatus returns active', async () => {
    await tryUnlock('123456', [{ id: 1 }], {});
    const status = getSyncStatus();
    expect(status.status).toBe('active');
  });

});
