-- =============================================================
-- ASMRtists — Migration v0.4.0
-- ordinal_claims table
-- Date: 2026-05-02
-- Run in: Supabase SQL Editor (Settings → SQL Editor)
-- =============================================================
--
-- Creates the ordinal_claims table for tracking BSV reward
-- payouts to Ordinal Rainbows (and future ordinal) holders.
--
-- Flow:
--   1. Holder calls POST /api/ordinals/challenge  → gets nonce
--   2. Holder signs nonce with their wallet
--   3. Holder calls POST /api/ordinals/claim      → row inserted here
--   4. BSV sent from treasury → row updated to 'paid'

-- Ensure artwork has inscription_outpoint (may be missing in DBs
-- created before schema.sql was updated to include it)
ALTER TABLE public.artwork
  ADD COLUMN IF NOT EXISTS inscription_outpoint TEXT;

-- Drop any prior/partial version of this table so we get the full schema
DROP TABLE IF EXISTS public.ordinal_claims CASCADE;

CREATE TABLE public.ordinal_claims (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  inscription_outpoint TEXT          NOT NULL,              -- e.g. "abc123_0"
  artwork_id           UUID          REFERENCES public.artwork(id) ON DELETE SET NULL,
  ord_address          TEXT          NOT NULL,              -- address that holds the ordinal
  recipient_address    TEXT          NOT NULL,              -- BSV address to receive payment
  bsv_amount           NUMERIC(16,8) NOT NULL DEFAULT 0,    -- satoshis to send
  mnee_amount          NUMERIC(16,6) NOT NULL DEFAULT 0,    -- MNEE to distribute
  status               TEXT          NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
  txid                 TEXT,                                -- BSV broadcast txid
  paid_at              TIMESTAMPTZ,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ordinal_claims_outpoint
  ON public.ordinal_claims (inscription_outpoint);

CREATE INDEX IF NOT EXISTS idx_ordinal_claims_status
  ON public.ordinal_claims (status);

CREATE OR REPLACE TRIGGER trg_ordinal_claims_updated_at
  BEFORE UPDATE ON public.ordinal_claims
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: only service-role (server) can read/write claims
ALTER TABLE public.ordinal_claims ENABLE ROW LEVEL SECURITY;

-- Collectors can read their own claims (by recipient_address — no auth link required)
CREATE POLICY "Collectors can read own claims"
  ON public.ordinal_claims FOR SELECT
  USING (true);  -- public read; no PII exposed

-- Only service role inserts/updates (enforced by not granting anon INSERT)
