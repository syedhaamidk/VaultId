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

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      ?? '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const supabaseEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Avoid throwing at import time if env vars are missing — features that
// need it just stay disabled (see supabaseEnabled) so local-only mode
// keeps working without a Supabase project configured.
export const supabase = supabaseEnabled
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;
