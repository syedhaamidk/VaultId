/**
 * VaultID — Cloud Sync Module
 *
 * Identity (Google OAuth) and storage (Postgres) are handled by Supabase.
 * Encryption is handled entirely client-side in crypto.js — this module
 * only ever moves opaque { iv, salt, ciphertext } blobs in and out.
 *
 * Security model recap:
 *   Google Auth  ──► proves WHO you are (gates row access via RLS)
 *   PIN/passphrase ──► the ONLY thing that can decrypt your docs
 * Supabase can be fully compromised and an attacker still only gets
 * ciphertext — same guarantee as local-only mode, just synced.
 */
import { supabase, supabaseEnabled } from './supabaseClient.js';
import { isVaultV2 } from './crypto.js';

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
 * Returns the current sync status. For v2 vaults, sync is paused until
 * the sync layer is updated to handle the v2 format (see 4d).
 * @returns {{ status: 'active'|'paused_v2'|'not_configured', reason?: string }}
 */
export function getSyncStatus() {
  if (!supabaseEnabled) return { status: 'not_configured' };
  if (isVaultV2()) return { status: 'paused_v2', reason: 'Sync paused for upgraded vaults' };
  return { status: 'active' };
}

// ── Encrypted vault sync ───────────────────────────────────────────────────────
// Table: vaults (user_id uuid PK references auth.users, salt text, iv text,
// ciphertext text, updated_at timestamptz). RLS restricts all access to
// auth.uid() = user_id — see supabase_schema.sql.

/**
 * Push the current encrypted vault (already produced by crypto.js) to Supabase,
 * tied to the signed-in user. Last-write-wins.
 *
 * @param {string} userId
 * @param {string} saltB64
 * @param {{iv: string, ct: string}} encBlob
 */
export async function pushVault(userId, saltB64, encBlob, updatedAt = new Date().toISOString()) {
  if (!supabaseEnabled) return { ok: false, reason: 'NOT_CONFIGURED' };
  if (isVaultV2()) return { ok: false, reason: 'SYNC_PAUSED_V2' };
  if (!userId || !saltB64 || !encBlob?.iv || !encBlob?.ct) {
    return { ok: false, reason: 'INVALID_VAULT_BLOB' };
  }
  const { error } = await supabase.from('vaults').upsert({
    user_id:    userId,
    salt:       saltB64,
    iv:         encBlob.iv,
    ciphertext: encBlob.ct,
    updated_at: updatedAt || new Date().toISOString(),
  });
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

/**
 * Pull the encrypted vault for the signed-in user.
 * @returns {{ ok: boolean, found?: boolean, salt?: string, enc?: {iv,ct} }}
 */
export async function pullVault(userId) {
  if (!supabaseEnabled) return { ok: false, reason: 'NOT_CONFIGURED' };
  if (isVaultV2()) return { ok: false, reason: 'SYNC_PAUSED_V2' };
  const { data, error } = await supabase
    .from('vaults')
    .select('salt, iv, ciphertext, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return { ok: false, reason: error.message };
  if (!data) return { ok: true, found: false };

  return {
    ok: true,
    found: true,
    salt: data.salt,
    enc: { iv: data.iv, ct: data.ciphertext },
    updatedAt: data.updated_at,
  };
}
