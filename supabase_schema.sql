-- VaultID — Supabase schema
-- Run this in the Supabase SQL editor for your project.
--
-- This table NEVER stores plaintext. salt/iv/ciphertext are all opaque
-- base64 blobs produced by crypto.js — Supabase only ever sees encrypted
-- bytes. Row Level Security ensures a user can only read/write their own row.

create table if not exists public.vaults (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  salt        text not null,
  iv          text not null,
  ciphertext  text not null,
  updated_at  timestamptz not null default now(),
  blob        text  -- v2 self-contained JSON blob; NULL for v1 rows
);

alter table public.vaults enable row level security;

-- A user may only ever see or modify their own vault row.
create policy "Users can read own vault"
  on public.vaults for select
  using (auth.uid() = user_id);

create policy "Users can insert own vault"
  on public.vaults for insert
  with check (auth.uid() = user_id);

create policy "Users can update own vault"
  on public.vaults for update
  using (auth.uid() = user_id);

create policy "Users can delete own vault"
  on public.vaults for delete
  using (auth.uid() = user_id);

-- ── Setup checklist ──────────────────────────────────────────────────────────
-- 1. Create a Supabase project → https://supabase.com/dashboard
-- 2. Run this file in SQL Editor.
-- 3. Authentication → Providers → enable Google.
--    - Create OAuth credentials in Google Cloud Console.
--    - Add the Supabase callback URL (shown on the Google provider page)
--      as an Authorized redirect URI in Google Cloud Console.
-- 4. Authentication → URL Configuration → add your deployed URL
--    (e.g. https://vault-id-pearl.vercel.app) to Redirect URLs.
-- 5. Project Settings → API → copy the Project URL and anon public key
--    into your .env as VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
