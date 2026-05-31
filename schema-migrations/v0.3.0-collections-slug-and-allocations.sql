-- =============================================================
-- ASMRtists — Migration v0.3.0
-- collections.slug  |  reward_allocations  |  claim_challenges
-- Date: 2026-04-28
-- Run in: Supabase SQL Editor (Settings → SQL Editor)
-- NOTE: Run once against the existing DB. schema.sql has been
--       updated to include these changes for fresh installs.
-- =============================================================

-- ── 1. collections.slug ───────────────────────────────────────────────────────

ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS slug TEXT NOT NULL DEFAULT 'untitled';

-- Backfill: strip every non-alphanumeric character, lowercase.
-- No hyphens — slugs must be safe for use as subdomains.
-- e.g. "Ordinal Rainbows Vol. 1" → "ordinalrainbowsvol1"
UPDATE public.collections
  SET slug = lower(regexp_replace(title, '[^a-zA-Z0-9]+', '', 'g'))
  WHERE slug = 'untitled';

-- Safety net: if stripping leaves an empty string (title was all punctuation),
-- fall back to a stable id-based slug so the NOT NULL + UNIQUE don't fire.
UPDATE public.collections
  SET slug = 'collection' || substr(id::text, 1, 8)
  WHERE slug = '';

-- Per-artist uniqueness — NOT globally unique.
-- Two artists can both have slug 'vol1'; the pair (artist_id, slug) must be unique.
-- CAUTION: if two existing collections from the same artist share a title that
-- maps to the same stripped slug, this ALTER will fail. Resolve manually first.
ALTER TABLE public.collections
  ADD CONSTRAINT collections_artist_slug_unique UNIQUE (artist_id, slug);

-- ── 2. reward_allocations ─────────────────────────────────────────────────────
-- Per-inscription accrual ledger. Tracks "what is owed" per ordinal.
-- Kept separate from ordinal_claims (which records "what has been paid out").
-- Populated by the Printify/Shopify webhook → revenue split pipeline.
-- Zeroed after each successful claim.

CREATE TABLE IF NOT EXISTS public.reward_allocations (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id           UUID          NOT NULL REFERENCES public.artwork(id) ON DELETE CASCADE,
  inscription_outpoint TEXT          NOT NULL UNIQUE,   -- e.g. "abc123_0"
  mnee_claimable       NUMERIC(16,6) NOT NULL DEFAULT 0,
  bsv_claimable        NUMERIC(16,8) NOT NULL DEFAULT 0,
  bsv21_claimable      NUMERIC(16,8) NOT NULL DEFAULT 0, -- stub: OR BSV21 token, not wired MVP
  total_earned_usd     NUMERIC(10,2) NOT NULL DEFAULT 0,
  rarity               TEXT,
  rarity_multiplier    NUMERIC(4,2)  DEFAULT 1.0,
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reward_allocations_artwork_id
  ON public.reward_allocations (artwork_id);

-- Inherit the platform's updated_at auto-stamp trigger
CREATE OR REPLACE TRIGGER trg_reward_allocations_updated_at
  BEFORE UPDATE ON public.reward_allocations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 3. claim_challenges ───────────────────────────────────────────────────────
-- Short-lived server-issued nonces for the wallet signed-challenge protocol.
-- Flow: POST /api/claim/challenge → nonce stored here (TTL 5 min) →
--       wallet signs → POST /api/claim verifies sig + burns nonce (sets used_at).
-- Expired/used rows can be pruned by a scheduled job; they are inert.

CREATE TABLE IF NOT EXISTS public.claim_challenges (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ord_address TEXT        NOT NULL,
  nonce       TEXT        NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,           -- NULL = unused; stamped when claim consumes it
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lookup pattern: find an active (unexpired, unused) challenge for an address
CREATE INDEX IF NOT EXISTS idx_claim_challenges_address_expiry
  ON public.claim_challenges (ord_address, expires_at);

-- ── 4. RLS ────────────────────────────────────────────────────────────────────

-- reward_allocations:
--   SELECT — public (any visitor can see claimable balances on the collection page)
--   INSERT / UPDATE — service role only (pipeline + claim API; no client writes)
ALTER TABLE public.reward_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reward_allocations_public_read"
  ON public.reward_allocations
  FOR SELECT
  USING (true);

-- No INSERT or UPDATE policies → only the service role (which bypasses RLS
-- in Supabase) can write. The claim API and revenue-split webhook use the
-- service role key exclusively.

-- claim_challenges:
--   No policies at all → service role only.
--   Nonces must never be readable client-side (would defeat the challenge).
ALTER TABLE public.claim_challenges ENABLE ROW LEVEL SECURITY;
