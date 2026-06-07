-- =============================================================
-- ASMRtists — Migration v0.5.0
-- ordinal_listings table
-- Date: 2026-06-07
-- Run in: Supabase SQL Editor (Settings → SQL Editor)
-- =============================================================
--
-- Allows holders of minted ordinals to list them for resale
-- on the public Ordinals Marketplace page.
--
-- Flow:
--   1. Holder connects BSV wallet on /ordinals
--   2. Provides inscription outpoint + MNEE price
--   3. Server verifies on-chain ownership (1sat.app)
--   4. Row inserted here with status = 'active'
--   5. Listing appears on /ordinals Buyable section
--   6. On sale: status → 'sold', buyer_ord_address + sale_txid recorded

CREATE TABLE public.ordinal_listings (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id            UUID          NOT NULL REFERENCES public.artwork(id) ON DELETE CASCADE,
  inscription_outpoint  TEXT          NOT NULL,
  seller_ord_address    TEXT          NOT NULL,
  price_mnee            NUMERIC(12,4) NOT NULL CHECK (price_mnee > 0),
  status                TEXT          NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'sold', 'cancelled')),
  buyer_ord_address     TEXT,
  sale_txid             TEXT,
  sold_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (inscription_outpoint, status)  -- one active listing per outpoint
);

CREATE INDEX idx_ordinal_listings_status
  ON public.ordinal_listings (status);

CREATE INDEX idx_ordinal_listings_outpoint
  ON public.ordinal_listings (inscription_outpoint);

CREATE OR REPLACE TRIGGER trg_ordinal_listings_updated_at
  BEFORE UPDATE ON public.ordinal_listings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: public read, service-role only for writes
ALTER TABLE public.ordinal_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active listings"
  ON public.ordinal_listings FOR SELECT
  USING (status = 'active');
