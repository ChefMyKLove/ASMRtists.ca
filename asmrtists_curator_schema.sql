-- =============================================================
-- ASMRtists Curator-Collection Schema
-- Migration: curator_collection_model_v1
-- Depends on: archive/schema.sql (base schema must already exist)
-- =============================================================
-- Ownership model:
--   Platform  → owns artist roster
--   Curators  → own collections (per-collection, not per-artist)
--   Artists   → own their IP
-- =============================================================


-- -------------------------------------------------------------
-- 0. PREREQUISITES
-- Add columns that don't yet exist on curator_profiles.
-- Relax user_id NOT NULL so the platform admin identity (which
-- has no auth.users row) can be seeded.
-- -------------------------------------------------------------
ALTER TABLE public.curator_profiles
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.curator_profiles
  ADD COLUMN IF NOT EXISTS username         TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS tier             TEXT NOT NULL DEFAULT 'free'
                                            CHECK (tier IN ('free', 'pro', 'enterprise')),
  ADD COLUMN IF NOT EXISTS is_admin_curator BOOLEAN NOT NULL DEFAULT false;

-- Non-admin curators still require a user_id
ALTER TABLE public.curator_profiles
  DROP CONSTRAINT IF EXISTS curator_non_admin_requires_user_id;
ALTER TABLE public.curator_profiles
  ADD CONSTRAINT curator_non_admin_requires_user_id
  CHECK (is_admin_curator = true OR user_id IS NOT NULL);


-- -------------------------------------------------------------
-- 1. PLATFORM SETTINGS
-- All tunable numbers live here — change without a code deploy.
-- -------------------------------------------------------------
INSERT INTO public.platform_settings (key, value, description) VALUES

  -- GMV tier thresholds (cumulative USD)
  ('gmv_tier_established',           '350',    'Min GMV to reach Established tier'),
  ('gmv_tier_featured',              '2000',   'Min GMV to reach Featured tier'),
  ('gmv_tier_named',                 '10000',  'Min GMV to reach Named tier'),

  -- Supporting curator slot caps per artist tier
  ('support_slots_emerging',         '3',      'Max supporting curators — Emerging'),
  ('support_slots_established',      '7',      'Max supporting curators — Established'),
  ('support_slots_featured',         '15',     'Max supporting curators — Featured'),
  ('support_slots_named',            '30',     'Max supporting curators — Named'),

  -- Supporting curator cap multiplier (3× primary limit)
  ('support_curator_cap_multiplier', '3',      'Supporting slot cap = primary limit × this'),

  -- Curator primary slot limits per tier
  ('primary_slots_free',             '1',      'Primary collection slots — Free tier'),
  ('primary_slots_pro',              '5',      'Primary collection slots — Pro tier'),
  ('primary_slots_enterprise',       '20',     'Primary collection slots — Enterprise tier'),

  -- Claim and slot fees (MNEE) — 0 for beta
  ('curator_claim_fee_mnee',         '0',      'Fee to claim a collection as primary curator'),
  ('support_slot_purchase_mnee',     '0',      'Fee for artist to buy additional supporting slots'),

  -- Invite timeout window (days)
  ('curator_invite_timeout_days',    '7',      'Days before unanswered invite returns to admin'),

  -- Revenue split percentages
  ('rev_artist_pct',                 '70',     'Artist share of net margin per print'),
  ('rev_curator_pool_pct',           '10',     'Total curator pool share — claimed collections'),
  ('rev_platform_pct',               '5',      'Platform share — claimed collections'),
  ('rev_admin_artist_pct',           '4',      'Artist bonus share under admin curation'),
  ('rev_admin_platform_pct',         '6',      'Platform total share under admin curation'),
  ('rev_primary_curator_share',      '70',     'Primary curator % of curator pool (70/30 split)'),
  ('rev_supporting_curator_share',   '30',     'Supporting curators % of curator pool (split equally)'),

  -- Admin curator identity
  ('admin_curator_username',         '"asmrtists-editorial"', 'Platform default curator username')

ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;


-- -------------------------------------------------------------
-- 2. ADMIN CURATOR SEED
-- Fixed UUID so foreign keys can reference it without lookups.
-- No user_id — this is a platform identity, not an auth user.
-- -------------------------------------------------------------
INSERT INTO public.curator_profiles (
  id,
  username,
  display_name,
  bio,
  tier,
  is_admin_curator,
  created_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'asmrtists-editorial',
  'ASMRtists Editorial',
  'The official ASMRtists platform collection — home for every artist finding their audience.',
  'enterprise',
  true,
  now()
)
ON CONFLICT (username) DO NOTHING;


-- -------------------------------------------------------------
-- 3. COLLECTIONS TABLE ADDITIONS
-- Add curator tracking columns to the existing collections table.
-- -------------------------------------------------------------
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS primary_curator_id  UUID REFERENCES public.curator_profiles(id)
                                               DEFAULT '00000000-0000-0000-0000-000000000001',
  ADD COLUMN IF NOT EXISTS curation_state      TEXT NOT NULL DEFAULT 'admin'
                                               CHECK (curation_state IN ('admin', 'pending', 'claimed')),
  ADD COLUMN IF NOT EXISTS admin_absorbed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cumulative_gmv      NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS artist_tier         TEXT NOT NULL DEFAULT 'emerging'
                                               CHECK (artist_tier IN ('emerging','established','featured','named')),
  ADD COLUMN IF NOT EXISTS supporting_slot_cap INTEGER NOT NULL DEFAULT 3;


-- -------------------------------------------------------------
-- 4. CURATOR COLLECTION RELATIONSHIPS
-- One row per curator-collection association.
-- Primary = claimed ownership. Supporting = exposure/revenue share.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.curator_collection_relationships (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  collection_id     UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  curator_id        UUID NOT NULL REFERENCES public.curator_profiles(id) ON DELETE CASCADE,

  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('primary', 'supporting')),

  -- Lifecycle
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'active', 'declined', 'dropped')),

  -- Who initiated
  initiated_by      TEXT NOT NULL CHECK (initiated_by IN ('artist', 'curator', 'admin')),

  -- Claim fee paid in MNEE (0 during beta)
  claim_fee_paid    NUMERIC(10,4) NOT NULL DEFAULT 0.0000,

  -- Timestamps
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at      TIMESTAMPTZ,
  dropped_at        TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,   -- 7-day timeout for pending invites

  UNIQUE (collection_id, curator_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_ccr_collection ON public.curator_collection_relationships(collection_id);
CREATE INDEX IF NOT EXISTS idx_ccr_curator    ON public.curator_collection_relationships(curator_id);
CREATE INDEX IF NOT EXISTS idx_ccr_status     ON public.curator_collection_relationships(status);
CREATE INDEX IF NOT EXISTS idx_ccr_expires    ON public.curator_collection_relationships(expires_at)
                                              WHERE status = 'pending';


-- -------------------------------------------------------------
-- 5. REVENUE DISTRIBUTION LOG
-- Immutable record of every payout event — auditable on-chain.
-- Snapshot curation state at time of sale so disputes can be resolved.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.revenue_distribution_log (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  collection_id             UUID NOT NULL REFERENCES public.collections(id),
  order_id                  TEXT NOT NULL,          -- Shopify/Printify order reference
  sale_amount               NUMERIC(10,2) NOT NULL,
  printify_cogs             NUMERIC(10,2) NOT NULL,
  net_margin                NUMERIC(10,2) NOT NULL, -- sale_amount - printify_cogs

  -- Immutable snapshot of curation state at time of sale
  curation_state_at_sale    TEXT NOT NULL,
  primary_curator_id_at_sale UUID REFERENCES public.curator_profiles(id),

  -- Calculated payouts
  artist_payout             NUMERIC(10,2) NOT NULL,
  curator_pool_total        NUMERIC(10,2) NOT NULL,
  platform_payout           NUMERIC(10,2) NOT NULL,
  ordinal_holder_payout     NUMERIC(10,2) NOT NULL, -- 15% of net margin (existing mechanic)

  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rdl_collection ON public.revenue_distribution_log(collection_id);
CREATE INDEX IF NOT EXISTS idx_rdl_order      ON public.revenue_distribution_log(order_id);


-- -------------------------------------------------------------
-- 6. CURATOR PAYOUT BREAKDOWN
-- One row per curator per sale — child of revenue_distribution_log.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.curator_payout_breakdown (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_log_id UUID NOT NULL REFERENCES public.revenue_distribution_log(id) ON DELETE CASCADE,
  curator_id          UUID NOT NULL REFERENCES public.curator_profiles(id),
  relationship_type   TEXT NOT NULL CHECK (relationship_type IN ('primary', 'supporting', 'admin')),
  payout_amount       NUMERIC(10,4) NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cpb_curator ON public.curator_payout_breakdown(curator_id);
CREATE INDEX IF NOT EXISTS idx_cpb_log     ON public.curator_payout_breakdown(distribution_log_id);


-- -------------------------------------------------------------
-- 7. ARTIST TIER VIEW
-- Dynamically calculates tier from cumulative GMV across all
-- collections. Never stored — always accurate.
-- -------------------------------------------------------------
CREATE OR REPLACE VIEW public.artist_tier_view AS
SELECT
  c.artist_id,
  SUM(c.cumulative_gmv) AS total_gmv,
  CASE
    WHEN SUM(c.cumulative_gmv) >= 10000 THEN 'named'
    WHEN SUM(c.cumulative_gmv) >= 2000  THEN 'featured'
    WHEN SUM(c.cumulative_gmv) >= 350   THEN 'established'
    ELSE 'emerging'
  END AS artist_tier,
  CASE
    WHEN SUM(c.cumulative_gmv) >= 10000 THEN 30
    WHEN SUM(c.cumulative_gmv) >= 2000  THEN 15
    WHEN SUM(c.cumulative_gmv) >= 350   THEN 7
    ELSE 3
  END AS max_supporting_curators
FROM public.collections c
GROUP BY c.artist_id;


-- -------------------------------------------------------------
-- 8. CURATOR SLOT USAGE VIEW
-- How many primary slots a curator has used vs. their tier limit.
-- -------------------------------------------------------------
CREATE OR REPLACE VIEW public.curator_slot_usage AS
SELECT
  cp.id AS curator_id,
  cp.tier,
  COUNT(ccr.id) FILTER (
    WHERE ccr.relationship_type = 'primary'
    AND   ccr.status = 'active'
  ) AS primary_slots_used,
  CASE cp.tier
    WHEN 'free'       THEN 1
    WHEN 'pro'        THEN 5
    WHEN 'enterprise' THEN 20
    ELSE 999
  END AS primary_slots_total
FROM public.curator_profiles cp
LEFT JOIN public.curator_collection_relationships ccr ON ccr.curator_id = cp.id
GROUP BY cp.id, cp.tier;


-- -------------------------------------------------------------
-- 9. RLS POLICIES
-- -------------------------------------------------------------

ALTER TABLE public.curator_collection_relationships ENABLE ROW LEVEL SECURITY;

-- Curator sees their own relationships
CREATE POLICY "curator_sees_own_relationships"
  ON public.curator_collection_relationships
  FOR SELECT USING (
    curator_id = (SELECT id FROM public.curator_profiles WHERE user_id = auth.uid())
  );

-- Artist sees relationships on their own collections
CREATE POLICY "artist_sees_collection_relationships"
  ON public.curator_collection_relationships
  FOR SELECT USING (
    collection_id IN (
      SELECT id FROM public.collections WHERE artist_id = (
        SELECT id FROM public.artist_profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Public sees active relationships (collection pages)
CREATE POLICY "public_sees_active_relationships"
  ON public.curator_collection_relationships
  FOR SELECT USING (status = 'active');


ALTER TABLE public.revenue_distribution_log ENABLE ROW LEVEL SECURITY;

-- Artist sees revenue logs for their own collections
CREATE POLICY "artist_sees_own_revenue"
  ON public.revenue_distribution_log
  FOR SELECT USING (
    collection_id IN (
      SELECT id FROM public.collections WHERE artist_id = (
        SELECT id FROM public.artist_profiles WHERE user_id = auth.uid()
      )
    )
  );


ALTER TABLE public.curator_payout_breakdown ENABLE ROW LEVEL SECURITY;

-- Curator sees their own payout rows
CREATE POLICY "curator_sees_own_payouts"
  ON public.curator_payout_breakdown
  FOR SELECT USING (
    curator_id = (SELECT id FROM public.curator_profiles WHERE user_id = auth.uid())
  );
