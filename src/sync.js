/**
 * VaultID — Cloud Sync Module
 *
 * Identity (Google OAuth) and storage (Postgres) are handled by Supabase.
 * Encryption is handled entirely client-side in crypto.js — this module
 * only ever moves opaque blobs in and out.
 *
 * Supports both v1 ({ salt, iv, ciphertext }) and v2 (self-contained
 * JSON blob) formats. The conflict matrix in syncVault() determines the
 * correct action for each local × remote combination.
 */
import { supabase, supabaseEnabled } from './supabaseClient.js';

export { supabaseEnabled };

// ── Auth ──────────────────────────────────────────────────────────────────────

/**
 * Kick off Google OAuth via Supabase. Redirects the browser — call this
 * directly from a click handler, then handle the return via onAuthChange.
 */
export async function signInWithGoogle() {
  if (!supabaseEnabled) throw new Error('SUPABASE_NOT_CONFIGURED');
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOut() {
  if (!supabaseEnabled) return;
  await supabase.auth.signOut();
}

/** Returns the current session's user, or null if signed out / not configured. */
export async function getCurrentUser() {
  if (!supabaseEnabled) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.user ?? null;
}

/**
 * Subscribe to auth state changes (sign-in, sign-out, token refresh).
 * Returns an unsubscribe function.
 */
export function onAuthChange(callback) {
  if (!supabaseEnabled) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => data.subscription.unsubscribe();
}

// ── Sync status ───────────────────────────────────────────────────────────────

/**
 * Returns the current sync status.
 * @returns {{ status: 'active'|'not_configured' }}
 */
export function getSyncStatus() {
  if (!supabaseEnabled) return { status: 'not_configured' };
  return { status: 'active' };
}

// ── Push ──────────────────────────────────────────────────────────────────────

/**
 * Push the current encrypted vault to Supabase, tied to the signed-in user.
 * Accepts either a v1 blob ({ saltB64, encBlob }) or a v2 blob ({ blob }).
 *
 * @param {string} userId
 * @param {{ saltB64?: string, encBlob?: {iv,ct}, blob?: string }} blob
 * @param {string} updatedAt
 */
export async function pushVault(userId, blob, updatedAt = new Date().toISOString()) {
  if (!supabaseEnabled) return { ok: false, reason: 'NOT_CONFIGURED' };
  if (!userId || !blob) return { ok: false, reason: 'INVALID_VAULT_BLOB' };

  const isV2 = blob.blob !== undefined;

  if (isV2) {
    const { error } = await supabase.from('vaults').upsert({
      user_id: userId,
      blob: blob.blob,
      updated_at: updatedAt,
    });
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  }

  // v1
  if (!blob.saltB64 || !blob.encBlob?.iv || !blob.encBlob?.ct) {
    return { ok: false, reason: 'INVALID_VAULT_BLOB' };
  }
  const { error } = await supabase.from('vaults').upsert({
    user_id: userId,
    salt: blob.saltB64,
    iv: blob.encBlob.iv,
    ciphertext: blob.encBlob.ct,
    updated_at: updatedAt,
  });
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

// ── Pull ──────────────────────────────────────────────────────────────────────

/**
 * Pull the encrypted vault for the signed-in user.
 * @returns {{ ok: boolean, found?: boolean, version?: 'v1'|'v2', blob?: object, updatedAt?: string }}
 */
export async function pullVault(userId) {
  if (!supabaseEnabled) return { ok: false, reason: 'NOT_CONFIGURED' };
  const { data, error } = await supabase
    .from('vaults')
    .select('salt, iv, ciphertext, blob, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return { ok: false, reason: error.message };
  if (!data) return { ok: true, found: false };

  if (data.blob) {
    return {
      ok: true,
      found: true,
      version: 'v2',
      blob: { blob: data.blob },
      updatedAt: data.updated_at,
    };
  }

  return {
    ok: true,
    found: true,
    version: 'v1',
    blob: { saltB64: data.salt, encBlob: { iv: data.iv, ct: data.ciphertext } },
    updatedAt: data.updated_at,
  };
}

// ── Conflict matrix ───────────────────────────────────────────────────────────

/**
 * Determines the correct sync action for a local × remote combination.
 *
 * Core rule: never overwrite unsynced local data (local.dirty).
 *
 * @param {{ version: 'v1'|'v2', dirty: boolean, updatedAt: string, rev?: number }} local
 * @param {{ found: boolean, version?: 'v1'|'v2', updatedAt?: string, rev?: number }} remote
 * @returns {{ action: 'push'|'pull'|'keep-local'|'upgrade'|'warn-stale-v1' }}
 */
export function syncVault(local, remote) {
  if (!remote.found) {
    // No remote vault — push the local one.
    return { action: 'push' };
  }

  // v1 × v1: if dirty, keep local. If clean, last-write-wins by updated_at.
  if (local.version === 'v1' && remote.version === 'v1') {
    if (local.dirty) return { action: 'keep-local' };
    if (remote.updatedAt > local.updatedAt) return { action: 'pull' };
    return { action: 'push' };
  }

  // v1 × v2: if dirty, keep local v1. If clean, prompt to upgrade.
  if (local.version === 'v1' && remote.version === 'v2') {
    if (local.dirty) return { action: 'keep-local' };
    return { action: 'upgrade' };
  }

  // v2 × v1: if remote is newer, don't overwrite (a v1 device has newer data).
  // Otherwise, push v2 (safe — v2 ⊇ v1 data).
  if (local.version === 'v2' && remote.version === 'v1') {
    if (remote.updatedAt > local.updatedAt) {
      return { action: 'warn-stale-v1' };
    }
    return { action: 'push' };
  }

  // v2 × v2: if dirty, keep local. If clean, last-write-wins by rev.
  if (local.version === 'v2' && remote.version === 'v2') {
    if (local.dirty) return { action: 'keep-local' };
    if ((remote.rev ?? 0) > (local.rev ?? 0)) return { action: 'pull' };
    return { action: 'push' };
  }

  // Default: keep local.
  return { action: 'keep-local' };
}
