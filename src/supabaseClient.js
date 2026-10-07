/**
 * VaultID — Supabase client
 *
 * Used ONLY for:
 *   1. Identity (Google OAuth via Supabase Auth)
 *   2. Storing/retrieving the encrypted vault blob ({ iv, salt, ciphertext })
 *
 * Supabase NEVER sees the PIN, the derived AES key, or plaintext documents —
 * only opaque ciphertext, scoped to the signed-in user via Row Level Security.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL_RAW = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

/**
 * Normalize the project URL. Common misconfiguration: pasting the REST
 * endpoint (https://xyz.supabase.co/rest/v1) instead of the bare project
 * URL. The JS clients append their own paths (/auth/v1, /rest/v1), so a
 * suffixed base double-ups (/rest/v1/auth/v1/…) and every auth/storage
 * call fails. Strip it rather than breaking at runtime.
 */
function normalizeSupabaseUrl(raw) {
  const trimmed = (raw || '').trim().replace(/\/+$/, '');
  const clean = trimmed.replace(/\/rest\/v1$/, '').replace(/\/rest$/, '');
  if (clean && clean !== trimmed) {
    console.warn('[VaultID] VITE_SUPABASE_URL had a path suffix — using ' + clean);
  }
  return clean;
}

const SUPABASE_URL = normalizeSupabaseUrl(SUPABASE_URL_RAW);

export const supabaseEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Avoid throwing at import time if env vars are missing — features that
// need it just stay disabled (see supabaseEnabled) so local-only mode
// keeps working without a Supabase project configured.
export const supabase = supabaseEnabled
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;
