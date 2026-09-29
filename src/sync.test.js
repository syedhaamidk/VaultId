// @vitest-environment node
/**
 * VaultID — sync tests
 *
 * Verifies v1/v2 push/pull and the conflict matrix.
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
import { pushVault, pullVault, getSyncStatus, syncVault } from './sync.js';
import { createVaultV2, tryUnlock } from './crypto.js';

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

// ── v1 push/pull ─────────────────────────────────────────────────────────────

describe('v1 sync', () => {
  it('pushVault stores v1 blob in salt/iv/ciphertext columns', async () => {
    await tryUnlock('123456', [{ id: 1 }], {});
    const result = await pushVault('user-1', { saltB64: 'salt', encBlob: { iv: 'iv', ct: 'ct' } });
    expect(result.ok).toBe(true);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      salt: 'salt',
      iv: 'iv',
      ciphertext: 'ct',
    }));
  });

  it('pullVault returns v1 blob', async () => {
    await tryUnlock('123456', [{ id: 1 }], {});
    maybeSingleMock.mockReturnValueOnce({
      data: { salt: 'salt', iv: 'iv', ciphertext: 'ct', blob: null, updated_at: '2026-01-01' },
      error: null,
    });
    const result = await pullVault('user-1');
    expect(result.ok).toBe(true);
    expect(result.found).toBe(true);
    expect(result.version).toBe('v1');
    expect(result.blob.saltB64).toBe('salt');
  });
});

// ── v2 push/pull ─────────────────────────────────────────────────────────────

describe('v2 sync', () => {
  it('pushVault stores v2 blob in the blob column', async () => {
    await createVaultV2('passphrase', [{ id: 1 }], {}, {});
    const v2Blob = storage.getItem('vid_vault');
    const result = await pushVault('user-1', { blob: v2Blob });
    expect(result.ok).toBe(true);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      blob: v2Blob,
    }));
  });

  it('pullVault returns v2 blob', async () => {
    await createVaultV2('passphrase', [{ id: 1 }], {}, {});
    const v2Blob = storage.getItem('vid_vault');
    maybeSingleMock.mockReturnValueOnce({
      data: { salt: null, iv: null, ciphertext: null, blob: v2Blob, updated_at: '2026-01-01' },
      error: null,
    });
    const result = await pullVault('user-1');
    expect(result.ok).toBe(true);
    expect(result.found).toBe(true);
    expect(result.version).toBe('v2');
    expect(result.blob.blob).toBe(v2Blob);
  });
});

// ── Conflict matrix ──────────────────────────────────────────────────────────

describe('syncVault conflict matrix', () => {
  const local = (overrides = {}) => ({ version: 'v1', dirty: false, updatedAt: '2026-01-01', ...overrides });
  const remote = (overrides = {}) => ({ found: true, version: 'v1', updatedAt: '2026-01-01', ...overrides });

  it('no remote vault → push', () => {
    expect(syncVault(local(), { found: false }).action).toBe('push');
  });

  it('v1 × v1, clean, remote newer → pull', () => {
    expect(syncVault(local(), remote({ updatedAt: '2026-01-02' })).action).toBe('pull');
  });

  it('v1 × v1, clean, local newer → push', () => {
    expect(syncVault(local({ updatedAt: '2026-01-03' }), remote()).action).toBe('push');
  });

  it('v1 × v1, dirty → keep-local', () => {
    expect(syncVault(local({ dirty: true }), remote({ updatedAt: '2026-01-02' })).action).toBe('keep-local');
  });

  it('v1 × v2, clean → upgrade', () => {
    expect(syncVault(local(), remote({ version: 'v2' })).action).toBe('upgrade');
  });

  it('v1 × v2, dirty → keep-local', () => {
    expect(syncVault(local({ dirty: true }), remote({ version: 'v2' })).action).toBe('keep-local');
  });

  it('v2 × v1, remote newer → warn-stale-v1', () => {
    expect(syncVault(local({ version: 'v2' }), remote({ updatedAt: '2026-01-02' })).action).toBe('warn-stale-v1');
  });

  it('v2 × v1, local newer → push', () => {
    expect(syncVault(local({ version: 'v2', updatedAt: '2026-01-03' }), remote()).action).toBe('push');
  });

  it('v2 × v2, clean, remote higher rev → pull', () => {
    expect(syncVault(local({ version: 'v2', rev: 1 }), remote({ version: 'v2', rev: 2 })).action).toBe('pull');
  });

  it('v2 × v2, clean, local higher rev → push', () => {
    expect(syncVault(local({ version: 'v2', rev: 3 }), remote({ version: 'v2', rev: 2 })).action).toBe('push');
  });

  it('v2 × v2, dirty → keep-local', () => {
    expect(syncVault(local({ version: 'v2', dirty: true }), remote({ version: 'v2', rev: 99 })).action).toBe('keep-local');
  });
});

// ── Sync status ──────────────────────────────────────────────────────────────

describe('getSyncStatus', () => {
  it('returns active when Supabase is configured', () => {
    expect(getSyncStatus().status).toBe('active');
  });
});
