-- =============================================================
-- ASMRtists Platform — Supabase PostgreSQL Schema
-- Version: 0.3.0  |  Date: 2026-04-28
-- Run in Supabase SQL Editor (Settings → SQL Editor)
-- =============================================================

-- =============================================================
-- ENUMS
-- =============================================================

CREATE TYPE user_role AS ENUM ('collector', 'artist', 'curator', 'admin');
CREATE TYPE role_status AS ENUM ('pending', 'active', 'suspended');
CREATE TYPE artwork_status AS ENUM (
  'uploaded',         -- just uploaded, awaiting pipeline
  'processing',       -- image validation in progress
  'shop_pending',     -- Printify product creation in progress (syncs to Shopify)
  'shop_ready',       -- product live in Shopify, available to buy prints
  'minting',          -- ordinal inscription in progress
  'minted',           -- on-chain inscription confirmed
  'mint_error',       -- inscription failed (retryable)
  'error'             -- non-retryable error
);
CREATE TYPE collection_status AS ENUM ('draft', 'pending_review', 'active', 'archived');
CREATE TYPE product_type AS ENUM ('canvas', 'poster', 'photo');
CREATE TYPE product_status AS ENUM ('pending', 'created', 'published', 'unpublished');
CREATE TYPE order_status AS ENUM ('pending', 'fulfilled', 'shipped', 'refunded', 'cancelled');
CREATE TYPE ledger_type AS ENUM ('print_sale', 'ordinal_sale', 'claim', 'payout', 'curator_fee', 'platform_fee');
CREATE TYPE ledger_role AS ENUM ('artist', 'curator', 'platform', 'holder');
CREATE TYPE ledger_status AS ENUM ('pending', 'confirmed', 'paid');
CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'complete', 'failed');
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE claim_status AS ENUM ('pending', 'processing', 'paid', 'failed');
CREATE TYPE flag_status AS ENUM ('open', 'reviewing', 'resolved_removed', 'resolved_cleared');

-- =============================================================
-- USERS (extends Supabase auth.users)
-- One account, multiple switchable roles — like Patreon personas
-- =============================================================

CREATE TABLE public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username        TEXT UNIQUE NOT NULL,           -- url slug: asmrtists.ca/@username
  display_name    TEXT,
  bio             TEXT,
  avatar_url      TEXT,
  banner_url      TEXT,
  website_url     TEXT,
  social_links    JSONB DEFAULT '{}',             -- { twitter, instagram, youtube, tiktok }
  active_role     user_role NOT NULL DEFAULT 'collector',  -- current persona
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Which roles a user has unlocked
CREATE TABLE public.user_roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role            user_role NOT NULL,
  status          role_status NOT NULL DEFAULT 'pending',
  granted_at      TIMESTAMPTZ,
  granted_by      UUID REFERENCES public.profiles(id),
  UNIQUE(user_id, role)
);

-- =============================================================
-- BSV WALLETS
-- Artists and curators get wallets generated on registration.
-- Collectors only get one if they opt into on-chain activity.
-- =============================================================

CREATE TABLE public.wallets (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  address               TEXT NOT NULL UNIQUE,
  public_key            TEXT NOT NULL,
  encrypted_private_key TEXT,                    -- NULL for imported/external wallets
  is_external           BOOLEAN NOT NULL DEFAULT FALSE,
  label                 TEXT DEFAULT 'Primary',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- CURATOR TIERS
-- Tiered seats — accessible but meaningful.
-- Admin manages tiers; prices and perks configurable over time.
-- =============================================================

CREATE TABLE public.curator_tiers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,             -- e.g. 'Emerging', 'Gallery', 'Institution'
  slug                TEXT NOT NULL UNIQUE,      -- e.g. 'emerging'
  description         TEXT,
  price_usd           NUMERIC(10,2) NOT NULL,
  price_bsv           NUMERIC(16,8),             -- optional BSV pricing
  billing_interval    TEXT NOT NULL DEFAULT 'monthly',  -- 'monthly' | 'annual' | 'one_time'
  max_artists         INT NOT NULL DEFAULT 5,    -- max artists they can sponsor
  max_collections     INT NOT NULL DEFAULT 3,    -- max themed collections
  revenue_share_pct   NUMERIC(5,2) NOT NULL DEFAULT 5.00,  -- % of their collection's print sales
  features            JSONB DEFAULT '[]',        -- feature flags as string array
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  display_order       INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default tiers
INSERT INTO public.curator_tiers
  (name, slug, description, price_usd, billing_interval, max_artists, max_collections, revenue_share_pct, features, display_order)
VALUES
  ('Emerging',    'emerging',    'For independent curators and collectors building their eye.',  29.00, 'monthly', 5,   2, 5.00,  '["profile_badge","collection_page"]', 1),
  ('Gallery',     'gallery',     'For established galleries and curators with a public following.', 99.00, 'monthly', 20,  5, 8.00,  '["profile_badge","collection_page","featured_slot","curator_analytics"]', 2),
  ('Institution', 'institution', 'For museums, foundations, and major cultural institutions.',  299.00, 'monthly', 100, 20, 10.00, '["profile_badge","collection_page","featured_slot","curator_analytics","priority_support","custom_branding"]', 3);

-- =============================================================
-- ARTIST PROFILES
-- =============================================================

CREATE TABLE public.artist_profiles (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  stage_name              TEXT,
  bio                     TEXT,
  avatar_url              TEXT,
  banner_url              TEXT,
  location                TEXT,
  status                  role_status NOT NULL DEFAULT 'pending',
  approved_by_curator_id  UUID,
  approved_at             TIMESTAMPTZ,
  piece_count             INT NOT NULL DEFAULT 0,
  total_print_sales       INT NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- CURATOR PROFILES
-- =============================================================

CREATE TABLE public.curator_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_name        TEXT,
  bio                 TEXT,
  avatar_url          TEXT,
  organization        TEXT,                      -- gallery name, institution, etc.
  tier_id             UUID REFERENCES public.curator_tiers(id),
  status              role_status NOT NULL DEFAULT 'pending',
  approved_by         UUID REFERENCES public.profiles(id),  -- admin who approved
  approved_at         TIMESTAMPTZ,
  seat_expires_at     TIMESTAMPTZ,               -- when their paid seat renews/expires
  artist_count        INT NOT NULL DEFAULT 0,    -- cached count of approved artists
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fix forward reference — artist_profiles references curator_profiles
-- (curator_profiles must exist before this FK is valid)
ALTER TABLE public.artist_profiles
  ADD CONSTRAINT fk_artist_approved_by_curator
  FOREIGN KEY (approved_by_curator_id) REFERENCES public.curator_profiles(id);

-- =============================================================
-- CURATOR ↔ ARTIST APPROVALS
-- A curator sponsors an artist. Cannot self-approve.
-- =============================================================

CREATE TABLE public.curator_artist_approvals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curator_id      UUID NOT NULL REFERENCES public.curator_profiles(id) ON DELETE CASCADE,
  artist_id       UUID NOT NULL REFERENCES public.artist_profiles(id) ON DELETE CASCADE,
  status          approval_status NOT NULL DEFAULT 'pending',
  notes           TEXT,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(curator_id, artist_id),
  -- Enforce: curator cannot approve their own artist profile
  -- Application layer must also enforce this; constraint here as safety net
  CHECK (curator_id != artist_id)
);

-- =============================================================
-- ARTIST COLLECTIONS
-- An artist's body of work. Max 64 pieces. Can go live at 1.
-- =============================================================

CREATE TABLE public.collections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id       UUID NOT NULL REFERENCES public.artist_profiles(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  -- Subdomain-safe slug: lowercase, alphanumeric only, no hyphens.
  -- Unique per artist — NOT globally unique (two artists can both have 'vol1').
  slug            TEXT NOT NULL DEFAULT 'untitled',
  description     TEXT,
  cover_image_url TEXT,
  piece_count     INT NOT NULL DEFAULT 0,        -- cached, max 64
  status          collection_status NOT NULL DEFAULT 'draft',
  curator_id      UUID REFERENCES public.curator_profiles(id),  -- who approved
  approved_at     TIMESTAMPTZ,
  tags            TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT max_64_pieces CHECK (piece_count <= 64),
  CONSTRAINT collections_artist_slug_unique UNIQUE (artist_id, slug)
);

-- =============================================================
-- ARTWORK (individual pieces)
-- =============================================================

CREATE TABLE public.artwork (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id         UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  artist_id             UUID NOT NULL REFERENCES public.artist_profiles(id),
  title                 TEXT NOT NULL,
  description           TEXT,
  position              INT NOT NULL,            -- 1–64 within collection
  -- Storage
  storage_path          TEXT NOT NULL,           -- Supabase Storage path for original PNG
  jpeg_storage_path     TEXT,                    -- converted JPEG (for zoide/ordinals)
  thumbnail_url         TEXT,                    -- generated preview
  -- Image metadata (validated on upload)
  width_px              INT,
  height_px             INT,
  dpi                   INT,
  file_size_bytes       BIGINT,
  -- Pipeline status
  status                artwork_status NOT NULL DEFAULT 'uploaded',
  error_message         TEXT,
  -- Printify
  printify_image_id     TEXT,
  -- On-chain (BSV / 1Sat Ordinals)
  inscription_txid      TEXT,                    -- ordinal inscription transaction ID
  inscription_outpoint  TEXT,                    -- txid:vout
  ordinal_metadata      JSONB DEFAULT '{}',
  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(collection_id, position),
  -- Enforce position in valid range
  CONSTRAINT position_range CHECK (position >= 1 AND position <= 64)
);

-- =============================================================
-- PRINT PRODUCTS
-- One row per artwork per product type (canvas / poster / photo).
-- Printify creates the product internally; Shopify is the storefront.
-- We store both internal Printify IDs and the public Shopify handles.
-- =============================================================

CREATE TABLE public.print_products (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id            UUID NOT NULL REFERENCES public.artwork(id) ON DELETE CASCADE,
  product_type          product_type NOT NULL,
  -- Printify (internal production pipeline only — not exposed to frontend)
  printify_product_id   TEXT,
  printify_image_id     TEXT,
  -- Shopify (public storefront — used for embed modal URLs and webhook matching)
  shopify_product_id    TEXT,              -- GID: gid://shopify/Product/123456789
  shopify_product_handle TEXT,            -- URL slug: e.g. alchemybow-canvas-print
  shopify_variant_ids   JSONB DEFAULT '{}', -- { "8x10": "gid://shopify/ProductVariant/..." }
  -- Artist markup (above platform minimum, configurable per product)
  artist_markup_pct     NUMERIC(5,2) DEFAULT 0.00,
  status                product_status NOT NULL DEFAULT 'pending',
  published_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(artwork_id, product_type)
);

-- =============================================================
-- PRINT ORDERS
-- Logged when a buyer completes a Shopify purchase (via orders/paid webhook).
-- Buyer may be anonymous (print-only, no account needed).
-- =============================================================

CREATE TABLE public.print_orders (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id              UUID NOT NULL REFERENCES public.artwork(id),
  -- Shopify order identifiers
  shopify_order_id        TEXT UNIQUE,           -- Shopify order GID
  shopify_order_number    TEXT,                  -- human-readable e.g. #1001
  -- Buyer (optional — print buyers don't need accounts)
  buyer_user_id           UUID REFERENCES public.profiles(id),
  buyer_email             TEXT,
  -- Product details
  product_type            product_type NOT NULL,
  variant_title           TEXT,                  -- e.g. '8x10 inches'
  quantity                INT NOT NULL DEFAULT 1,
  -- Revenue split (all in cents USD)
  unit_price_cents        INT NOT NULL,
  production_cost_cents   INT NOT NULL,          -- what Printify (via Shopify) charges
  gross_revenue_cents     INT NOT NULL,          -- unit_price * quantity
  platform_fee_cents      INT NOT NULL,          -- 5%
  curator_share_cents     INT NOT NULL,          -- curator's tier %
  artist_share_cents      INT NOT NULL,          -- remainder to artist (~70%+)
  -- Status
  status                  order_status NOT NULL DEFAULT 'pending',
  shopify_order_data      JSONB DEFAULT '{}',    -- full Shopify webhook payload
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- TREASURY LEDGER
-- Source of truth for who is owed what.
-- Every sale creates entries for artist, curator, platform.
-- =============================================================

CREATE TABLE public.treasury_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id),
  order_id        UUID REFERENCES public.print_orders(id),
  earned_as       ledger_role NOT NULL,          -- in what capacity they earned this
  type            ledger_type NOT NULL,
  amount_usd      NUMERIC(10,2) NOT NULL,
  amount_bsv      NUMERIC(16,8),                -- populated when converted for payout
  status          ledger_status NOT NULL DEFAULT 'pending',
  payout_id       UUID,                         -- FK added after payouts table created
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- PAYOUTS
-- Admin-triggered (later: automated) BSV distributions.
-- =============================================================

CREATE TABLE public.payouts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id),
  wallet_address  TEXT NOT NULL,
  amount_bsv      NUMERIC(16,8) NOT NULL,
  txid            TEXT,                          -- BSV transaction ID once broadcast
  ledger_ids      UUID[] NOT NULL DEFAULT '{}', -- which ledger entries this covers
  triggered_by    UUID REFERENCES public.profiles(id),  -- admin who fired it
  status          payout_status NOT NULL DEFAULT 'pending',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

-- Now add FK from ledger to payouts
ALTER TABLE public.treasury_ledger
  ADD CONSTRAINT fk_ledger_payout
  FOREIGN KEY (payout_id) REFERENCES public.payouts(id);

-- =============================================================
-- CURATOR THEMED COLLECTIONS
-- Named rooms curators create: "The Vancouver Gallery presents: Coastal Light"
-- =============================================================

CREATE TABLE public.curator_collections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curator_id      UUID NOT NULL REFERENCES public.curator_profiles(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  cover_image_url TEXT,
  theme_tags      TEXT[] DEFAULT '{}',
  status          collection_status NOT NULL DEFAULT 'draft',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Which artworks belong to a curator's themed collection
CREATE TABLE public.curator_collection_artworks (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curator_collection_id   UUID NOT NULL REFERENCES public.curator_collections(id) ON DELETE CASCADE,
  artwork_id              UUID NOT NULL REFERENCES public.artwork(id) ON DELETE CASCADE,
  position                INT,                   -- display order within collection
  added_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(curator_collection_id, artwork_id)
);

-- =============================================================
-- ORDINAL CLAIMS
-- Holders of an artist's ordinals claim their BSV share of print sales.
-- Claim widget lives in gallery and collector dashboard.
-- =============================================================

CREATE TABLE public.ordinal_claims (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id),
  wallet_address      TEXT NOT NULL,
  inscription_txid    TEXT NOT NULL,             -- the ordinal they hold
  artwork_id          UUID REFERENCES public.artwork(id),
  amount_bsv          NUMERIC(16,8) NOT NULL,
  status              claim_status NOT NULL DEFAULT 'pending',
  payout_txid         TEXT,                      -- BSV tx once paid
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at             TIMESTAMPTZ
);

-- =============================================================
-- REWARD ALLOCATIONS
-- Per-inscription accrual ledger — "what is owed" per ordinal.
-- Populated by the Printify/Shopify webhook → revenue split pipeline.
-- Zeroed after each successful holder claim.
-- Kept separate from ordinal_claims (post-claim event log).
-- =============================================================

CREATE TABLE public.reward_allocations (
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

-- =============================================================
-- CLAIM CHALLENGES
-- Short-lived server-issued nonces for the wallet signed-challenge
-- protocol. TTL: 5 minutes (enforced at application layer).
-- Flow: issue nonce → wallet signs → claim API verifies + burns nonce.
-- =============================================================

CREATE TABLE public.claim_challenges (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ord_address TEXT        NOT NULL,
  nonce       TEXT        NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,           -- NULL = unused; stamped on claim
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- CONTENT FLAGS
-- Anyone can flag. Admin resolves.
-- =============================================================

CREATE TABLE public.content_flags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_by     UUID REFERENCES public.profiles(id),
  artwork_id      UUID REFERENCES public.artwork(id),
  artist_id       UUID REFERENCES public.artist_profiles(id),
  reason          TEXT NOT NULL,
  details         TEXT,
  status          flag_status NOT NULL DEFAULT 'open',
  resolved_by     UUID REFERENCES public.profiles(id),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (artwork_id IS NOT NULL OR artist_id IS NOT NULL)  -- must flag something
);

-- =============================================================
-- PLATFORM SETTINGS
-- Key-value store for admin-configurable platform settings.
-- Revenue splits, feature flags, etc.
-- =============================================================

CREATE TABLE public.platform_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  description TEXT,
  updated_by  UUID REFERENCES public.profiles(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default revenue split and platform settings
INSERT INTO public.platform_settings (key, value, description) VALUES
  ('revenue_split', '{"artist_pct": 70, "holder_pct": 25, "platform_pct": 5}',
    'Default print sale revenue split percentages'),
  ('image_requirements', '{"min_dpi": 281, "min_width_px": 3000, "min_height_px": 3000, "allowed_formats": ["png", "jpeg"]}',
    'Minimum image specs for artwork uploads'),
  ('collection_limits', '{"max_pieces": 64, "min_pieces_to_publish": 1}',
    'Collection size constraints'),
  ('print_product_types', '["canvas", "poster", "photo"]',
    'Which product types to auto-create per artwork (via Printify → Shopify pipeline)'),
  ('shopify_store_domain', '"asmrtists-ca.myshopify.com"',
    'Shopify store domain for Storefront API calls'),
  ('asmrprints_url', '"https://asmrprints.com"',
    'URL of the ASMRprints.com Shopify storefront (used for embed modal)');


-- =============================================================
-- INDEXES
-- =============================================================

-- profiles
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_profiles_active_role ON public.profiles(active_role);

-- user_roles
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role_status ON public.user_roles(role, status);

-- wallets
CREATE INDEX idx_wallets_user_id ON public.wallets(user_id);
CREATE INDEX idx_wallets_address ON public.wallets(address);

-- artwork
CREATE INDEX idx_artwork_collection_id ON public.artwork(collection_id);
CREATE INDEX idx_artwork_artist_id ON public.artwork(artist_id);
CREATE INDEX idx_artwork_status ON public.artwork(status);
CREATE INDEX idx_artwork_inscription ON public.artwork(inscription_txid) WHERE inscription_txid IS NOT NULL;

-- collections
CREATE INDEX idx_collections_artist_id ON public.collections(artist_id);
CREATE INDEX idx_collections_status ON public.collections(status);
CREATE INDEX idx_collections_curator_id ON public.collections(curator_id) WHERE curator_id IS NOT NULL;

-- print_products
CREATE INDEX idx_print_products_artwork_id ON public.print_products(artwork_id);
CREATE INDEX idx_print_products_status ON public.print_products(status);
CREATE INDEX idx_print_products_shopify_handle ON public.print_products(shopify_product_handle) WHERE shopify_product_handle IS NOT NULL;

-- print_orders
CREATE INDEX idx_print_orders_artwork_id ON public.print_orders(artwork_id);
CREATE INDEX idx_print_orders_buyer ON public.print_orders(buyer_user_id) WHERE buyer_user_id IS NOT NULL;
CREATE INDEX idx_print_orders_status ON public.print_orders(status);
CREATE INDEX idx_print_orders_created ON public.print_orders(created_at DESC);

-- treasury_ledger
CREATE INDEX idx_ledger_user_id ON public.treasury_ledger(user_id);
CREATE INDEX idx_ledger_order_id ON public.treasury_ledger(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_ledger_status ON public.treasury_ledger(status);
CREATE INDEX idx_ledger_payout_id ON public.treasury_ledger(payout_id) WHERE payout_id IS NOT NULL;

-- payouts
CREATE INDEX idx_payouts_user_id ON public.payouts(user_id);
CREATE INDEX idx_payouts_status ON public.payouts(status);

-- ordinal_claims
CREATE INDEX idx_claims_user_id ON public.ordinal_claims(user_id);
CREATE INDEX idx_claims_inscription ON public.ordinal_claims(inscription_txid);
CREATE INDEX idx_claims_status ON public.ordinal_claims(status);

-- curator_collections
CREATE INDEX idx_curator_collections_curator_id ON public.curator_collections(curator_id);

-- content_flags
CREATE INDEX idx_flags_status ON public.content_flags(status);

-- collections (slug lookup)
CREATE INDEX idx_collections_artist_slug ON public.collections(artist_id, slug);

-- reward_allocations
CREATE INDEX idx_reward_allocations_artwork_id ON public.reward_allocations(artwork_id);

-- claim_challenges (active challenge lookup by address)
CREATE INDEX idx_claim_challenges_address_expiry ON public.claim_challenges(ord_address, expires_at);

-- =============================================================
-- UPDATED_AT TRIGGER
-- Auto-update updated_at on any row change
-- =============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_artist_profiles_updated_at
  BEFORE UPDATE ON public.artist_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_curator_profiles_updated_at
  BEFORE UPDATE ON public.curator_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_collections_updated_at
  BEFORE UPDATE ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_artwork_updated_at
  BEFORE UPDATE ON public.artwork
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_print_products_updated_at
  BEFORE UPDATE ON public.print_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_print_orders_updated_at
  BEFORE UPDATE ON public.print_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_treasury_ledger_updated_at
  BEFORE UPDATE ON public.treasury_ledger
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_curator_collections_updated_at
  BEFORE UPDATE ON public.curator_collections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_curator_tiers_updated_at
  BEFORE UPDATE ON public.curator_tiers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_reward_allocations_updated_at
  BEFORE UPDATE ON public.reward_allocations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================
-- NEW USER BOOTSTRAP TRIGGER
-- When a new auth.users row is created, seed a profiles row
-- and grant the default 'collector' role.
-- =============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      LOWER(SPLIT_PART(NEW.email, '@', 1)) || '_' || SUBSTR(gen_random_uuid()::TEXT, 1, 6)
    ),
    COALESCE(NEW.raw_user_meta_data->>'display_name', SPLIT_PART(NEW.email, '@', 1))
  );

  INSERT INTO public.user_roles (user_id, role, status, granted_at)
  VALUES (NEW.id, 'collector', 'active', NOW());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================
-- REVENUE SPLIT HELPER FUNCTION
-- Calculates the split for a given gross revenue amount.
-- Reads from platform_settings so splits are configurable.
-- =============================================================

CREATE OR REPLACE FUNCTION public.calculate_revenue_split(
  gross_cents INT,
  production_cost_cents INT
)
RETURNS TABLE (
  net_cents       INT,
  platform_cents  INT,
  curator_cents   INT,
  artist_cents    INT
) AS $$
DECLARE
  split JSONB;
  platform_pct NUMERIC;
  holder_pct   NUMERIC;
  net          INT;
BEGIN
  SELECT value INTO split FROM public.platform_settings WHERE key = 'revenue_split';
  platform_pct := (split->>'platform_pct')::NUMERIC / 100;
  holder_pct   := (split->>'holder_pct')::NUMERIC / 100;

  net := gross_cents - production_cost_cents;

  RETURN QUERY SELECT
    net,
    ROUND(net * platform_pct)::INT,
    ROUND(net * holder_pct)::INT,
    net - ROUND(net * platform_pct)::INT - ROUND(net * holder_pct)::INT;
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================

-- reward_allocations:
--   SELECT — public (collection page shows balances without login)
--   INSERT / UPDATE — service role only (pipeline + claim API)
ALTER TABLE public.reward_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reward_allocations_public_read"
  ON public.reward_allocations
  FOR SELECT
  USING (true);

-- No INSERT or UPDATE policies → service role only (bypasses RLS by default).

-- claim_challenges:
--   No policies → service role only. Nonces must not be readable client-side.
ALTER TABLE public.claim_challenges ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- END OF SCHEMA
-- =============================================================
