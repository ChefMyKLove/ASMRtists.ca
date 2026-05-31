-- v0.4.0 — artwork ordinal pricing
-- Adds optional MNEE price field to artwork for collector-initiated minting.
-- Artist sets this in the dashboard to make a piece available for purchase.

ALTER TABLE public.artwork
  ADD COLUMN IF NOT EXISTS ordinal_price_mnee NUMERIC(12,4) DEFAULT NULL;

COMMENT ON COLUMN public.artwork.ordinal_price_mnee IS
  'Price in MNEE stablecoin for a collector to mint this ordinal. NULL = not listed.';
