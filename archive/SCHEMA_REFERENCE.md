# ASMRtists — Database Schema Reference
**Version:** 0.3.0 | **Date:** 2026-04-28  
**Database:** Supabase (PostgreSQL)  
**Schema file:** `schema.sql`  
**Latest migration:** `schema-migrations/v0.3.0-collections-slug-and-allocations.sql`

---

## Entity Relationship Overview

```
auth.users (Supabase managed)
    └── profiles (one per auth user — core identity)
            ├── user_roles (which roles unlocked: collector/artist/curator/admin)
            ├── wallets (BSV wallets — auto-generated for artists/curators)
            ├── artist_profiles (1:1 if artist role)
            │       ├── collections (up to N collections, each up to 64 pieces)
            │       │       └── artwork (individual pieces — PNG → JPEG → ordinal)
            │       │               ├── print_products (canvas/poster/photo per piece)
            │       │               ├── reward_allocations (per-inscription accrual ledger) ← v0.3.0
            │       │               └── curator_collection_artworks (featured in curator rooms)
            │       └── curator_artist_approvals (sponsored by a curator)
            ├── curator_profiles (1:1 if curator role)
            │       ├── curator_tiers (Emerging / Gallery / Institution)
            │       ├── curator_artist_approvals (curators they sponsor)
            │       └── curator_collections (named themed rooms)
            │               └── curator_collection_artworks (which artworks inside)
            ├── treasury_ledger (earnings rows — artist/curator/platform share per sale)
            ├── payouts (BSV distributions triggered by admin)
            └── ordinal_claims (holders claiming BSV from print sales)

print_orders (logged per Shopify/Printify sale — buyer may be anonymous)
    └── treasury_ledger entries (3 rows per order: artist / curator / platform)

claim_challenges (short-lived nonces for wallet signed-challenge protocol) ← v0.3.0
content_flags (anyone flags artwork or artist → admin resolves)
platform_settings (key-value config: splits, image requirements, limits)
```

---

## Tables

### `profiles`
Core identity table. One row per user. Extends `auth.users`.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | FK → auth.users |
| `username` | TEXT | URL slug — `asmrtists.ca/@username` |
| `display_name` | TEXT | Public display name |
| `bio` | TEXT | |
| `avatar_url` | TEXT | |
| `banner_url` | TEXT | Profile banner |
| `website_url` | TEXT | |
| `social_links` | JSONB | `{ twitter, instagram, youtube, tiktok }` |
| `active_role` | ENUM | Current persona: `collector / artist / curator / admin` |

---

### `user_roles`
Which roles a user has unlocked. One row per role per user.

| Column | Type | Notes |
|---|---|---|
| `user_id` | UUID | FK → profiles |
| `role` | ENUM | `collector / artist / curator / admin` |
| `status` | ENUM | `pending / active / suspended` |
| `granted_by` | UUID | Who granted this role (admin or curator) |

**Business rule:** Every user starts with `collector` role `active`. Additional roles require application and approval.  
**Self-approval rule:** Curators cannot approve their own artist profile — enforced at application layer and in the approvals CHECK constraint.

---

### `wallets`
BSV wallets linked to user accounts.

| Column | Type | Notes |
|---|---|---|
| `user_id` | UUID | FK → profiles |
| `address` | TEXT | BSV address (unique) |
| `public_key` | TEXT | |
| `encrypted_private_key` | TEXT | NULL for imported wallets |
| `is_external` | BOOLEAN | TRUE = user imported their own |
| `label` | TEXT | Default: 'Primary' |

**When wallets are created:**
- Artists: auto-generated on registration
- Curators: auto-generated on registration (can import instead)
- Collectors: only if they opt into on-chain activity (buy ordinals / claim rewards)

---

### `curator_tiers`
Tiered paid seats. Admin-managed. Prices configurable over time.

| Tier | Price | Max Artists | Max Collections | Revenue Share |
|---|---|---|---|---|
| Emerging | $29/mo | 5 | 2 | 5% |
| Gallery | $99/mo | 20 | 5 | 8% |
| Institution | $299/mo | 100 | 20 | 10% |

Revenue share = % of print sales from artworks in their curated collections.

---

### `artist_profiles`
Extended data for users with the artist role.

| Column | Type | Notes |
|---|---|---|
| `user_id` | UUID | FK → profiles (unique) |
| `stage_name` | TEXT | Artist's public name |
| `status` | ENUM | `pending / active / suspended` |
| `approved_by_curator_id` | UUID | Which curator sponsored them |
| `approved_at` | TIMESTAMPTZ | |
| `piece_count` | INT | Cached total pieces published |
| `total_print_sales` | INT | Cached lifetime print orders |

---

### `curator_profiles`
Extended data for users with the curator role.

| Column | Type | Notes |
|---|---|---|
| `user_id` | UUID | FK → profiles (unique) |
| `organization` | TEXT | Gallery name, institution, etc. |
| `tier_id` | UUID | FK → curator_tiers |
| `status` | ENUM | `pending / active / suspended` |
| `approved_by` | UUID | Admin who approved the curator seat |
| `seat_expires_at` | TIMESTAMPTZ | When their paid seat lapses |
| `artist_count` | INT | Cached count of approved artists |

---

### `curator_artist_approvals`
A curator sponsors an artist. Curator cannot sponsor themselves.

| Column | Type | Notes |
|---|---|---|
| `curator_id` | UUID | FK → curator_profiles |
| `artist_id` | UUID | FK → artist_profiles |
| `status` | ENUM | `pending / approved / rejected` |
| `notes` | TEXT | Curator's review notes |

---

### `collections`
An artist's body of work. Min 1, max 64 pieces. Enforced by DB constraint.

| Column | Type | Notes |
|---|---|---|
| `artist_id` | UUID | FK → artist_profiles |
| `title` | TEXT | Collection name |
| `slug` | TEXT | URL/subdomain slug — lowercase, alphanumeric only, no hyphens. **Unique per artist, not globally.** Default `'untitled'`; backfilled from title on creation. |
| `piece_count` | INT | Cached count (≤ 64 — DB enforced) |
| `status` | ENUM | `draft / pending_review / active / archived` |
| `curator_id` | UUID | Curator who approved this collection |
| `tags` | TEXT[] | Categorization tags |

**Slug uniqueness rule:** `UNIQUE (artist_id, slug)` — two artists can both have a collection slugged `vol1`. The slug is only required to be unique within a single artist's catalogue.

**Slug format:** Strip all non-alphanumeric characters, lowercase. No hyphens — slugs are designed to be safe as subdomains (`ordinalrainbows`, not `ordinal-rainbows-vol-1`).

**Worked example — Chef's OR Vol. 1:**
```sql
INSERT INTO public.collections (artist_id, slug, title, status)
VALUES (
  '<chef-artist-profile-uuid>',
  'ordinalrainbows',
  'Ordinal Rainbows Vol. 1',
  'active'
);
-- Public URL (Phase 1):  asmrtists.ca/c/chefmyklove/ordinalrainbows
-- Public URL (Phase 2):  ordinalrainbows.chefmyklove.shop.asmrtists.ca
```

---

### `artwork`
Individual pieces within a collection. The core asset.

| Column | Type | Notes |
|---|---|---|
| `collection_id` | UUID | FK → collections |
| `position` | INT | 1–64 within collection (unique per collection) |
| `storage_path` | TEXT | Supabase Storage path for original PNG |
| `jpeg_storage_path` | TEXT | Converted JPEG (for zoide upload) |
| `width_px / height_px` | INT | Validated on upload (min 3000×3000) |
| `dpi` | INT | Validated on upload (min 281) |
| `status` | ENUM | `uploaded → processing → printify_pending → printify_complete → minted` |
| `printify_image_id` | TEXT | Printify image library ID |
| `inscription_txid` | TEXT | BSV ordinal transaction ID |
| `inscription_outpoint` | TEXT | `txid:vout` |

**Upload validation:** 3000px × 3000px minimum, 281 DPI minimum. Rejected files never enter the pipeline.

---

### `printify_products`
One row per artwork per product type. Three rows created automatically per approved piece.

| Column | Type | Notes |
|---|---|---|
| `artwork_id` | UUID | FK → artwork |
| `product_type` | ENUM | `canvas / poster / photo` |
| `printify_product_id` | TEXT | Printify's internal ID |
| `status` | ENUM | `pending / created / published / unpublished` |

---

### `print_orders`
Logged when a buyer completes a purchase. Buyer may be completely anonymous.

| Column | Type | Notes |
|---|---|---|
| `printify_order_id` | TEXT | Unique Printify order ID |
| `buyer_user_id` | UUID | NULL if buyer has no account |
| `buyer_email` | TEXT | For order tracking |
| `unit_price_cents` | INT | Retail price |
| `printify_cost_cents` | INT | Printify's charge to us |
| `gross_revenue_cents` | INT | `unit_price × quantity` |
| `platform_fee_cents` | INT | 5% of net |
| `curator_share_cents` | INT | Curator's tier % of net |
| `artist_share_cents` | INT | Remainder (~70%+ of net) |

---

### `treasury_ledger`
Source of truth for earnings. Every sale creates 3 rows (artist / curator / platform).

| Column | Type | Notes |
|---|---|---|
| `user_id` | UUID | Who earns this |
| `order_id` | UUID | Which print sale generated it |
| `earned_as` | ENUM | `artist / curator / platform / holder` |
| `type` | ENUM | `print_sale / ordinal_sale / claim / payout / curator_fee / platform_fee` |
| `amount_usd` | NUMERIC | USD amount owed |
| `amount_bsv` | NUMERIC | Populated when converted for payout |
| `status` | ENUM | `pending / confirmed / paid` |
| `payout_id` | UUID | FK → payouts (set when paid out) |

---

### `payouts`
Admin-triggered BSV distributions. Eventually automated.

| Column | Type | Notes |
|---|---|---|
| `user_id` | UUID | Who receives this payout |
| `wallet_address` | TEXT | BSV destination |
| `amount_bsv` | NUMERIC | Amount sent |
| `txid` | TEXT | BSV transaction ID once broadcast |
| `ledger_ids` | UUID[] | Array of ledger entries this payout covers |
| `triggered_by` | UUID | Admin who fired it |
| `status` | ENUM | `pending / processing / complete / failed` |

---

### `curator_collections`
Named themed rooms curators create. e.g. *"The Vancouver Gallery presents: Coastal Light"*

| Column | Type | Notes |
|---|---|---|
| `curator_id` | UUID | FK → curator_profiles |
| `title` | TEXT | Collection room name |
| `theme_tags` | TEXT[] | Categorization |
| `status` | ENUM | `draft / active / archived` |

---

### `curator_collection_artworks`
Junction table — which artworks live in a curator's themed room.

| Column | Type | Notes |
|---|---|---|
| `curator_collection_id` | UUID | |
| `artwork_id` | UUID | |
| `position` | INT | Display order |

---

### `ordinal_claims`
Holders of an artist's ordinals claim their BSV share of print sales.  
Claim widget appears in: gallery page + collector dashboard.

| Column | Type | Notes |
|---|---|---|
| `inscription_txid` | TEXT | The ordinal the user holds |
| `artwork_id` | UUID | Which artwork this ordinal represents |
| `amount_bsv` | NUMERIC | BSV owed to this holder |
| `status` | ENUM | `pending / processing / paid / failed` |
| `payout_txid` | TEXT | BSV tx once paid |

---

### `reward_allocations` ← v0.3.0
Per-inscription accrual ledger. Tracks **"what is owed"** for each on-chain ordinal.  
Populated by the revenue-split pipeline when a print order is fulfilled.  
Zeroed per token type after each successful holder claim.  
Distinct from `ordinal_claims`, which is a post-claim event log.

| Column | Type | Notes |
|---|---|---|
| `artwork_id` | UUID | FK → artwork (ON DELETE CASCADE) |
| `inscription_outpoint` | TEXT | Unique on-chain identifier, e.g. `abc123_0` |
| `mnee_claimable` | NUMERIC(16,6) | MNEE stablecoin balance owed to current holder |
| `bsv_claimable` | NUMERIC(16,8) | BSV balance owed to current holder (satoshis expressed as decimal) |
| `bsv21_claimable` | NUMERIC(16,8) | OR BSV21 token balance — **stub for MVP, not wired** |
| `total_earned_usd` | NUMERIC(10,2) | Cumulative USD earned by this inscription since inception |
| `rarity` | TEXT | Optional rarity label (e.g. `'legendary'`) for multiplier logic |
| `rarity_multiplier` | NUMERIC(4,2) | Payout multiplier by rarity tier. Default `1.0` |
| `updated_at` | TIMESTAMPTZ | Auto-stamped by trigger on every write |

**RLS:** `SELECT` public (anyone can see balances on the collection page). `INSERT`/`UPDATE` service role only (claim API, revenue-split webhook).

---

### `claim_challenges` ← v0.3.0
Short-lived server-issued nonces for the wallet signed-challenge protocol.  
Prevents replay attacks and stolen-session claims.

**Protocol:**
1. Client calls `POST /api/claim/challenge` with `{ ordAddress }`.
2. Server inserts a row here with a random nonce and `expires_at = NOW() + interval '5 minutes'`.
3. Server returns `{ challenge: "asmr-claim:{nonce}:{timestamp}", expiresAt }`.
4. Client's wallet signs the challenge string (one popup).
5. Client calls `POST /api/claim` with the signature.
6. Server fetches this row, verifies the sig, stamps `used_at`, then proceeds.

| Column | Type | Notes |
|---|---|---|
| `ord_address` | TEXT | The ordinal address that requested the challenge |
| `nonce` | TEXT | 32-byte hex random value |
| `expires_at` | TIMESTAMPTZ | 5-minute TTL from creation |
| `used_at` | TIMESTAMPTZ | `NULL` until the claim API burns it |
| `created_at` | TIMESTAMPTZ | Auto-set on insert |

**Index:** `(ord_address, expires_at)` — the claim API queries by address filtering to unexpired rows.

**RLS:** Service role only — no client-side read. Exposing nonces client-side would defeat the challenge.

---

### `content_flags`
Anyone can flag. Admin resolves. Must flag either an artwork or an artist.

---

### `platform_settings`
Admin-configurable key-value store. Current keys:

| Key | Default Value |
|---|---|
| `revenue_split` | `{ artist_pct: 70, holder_pct: 25, platform_pct: 5 }` | Curator rev share carved from holder_pct. If curator tier is 5%, holders effectively receive 20%. Artist always receives 70%. |
| `image_requirements` | `{ min_dpi: 281, min_width_px: 3000, min_height_px: 3000 }` |
| `collection_limits` | `{ max_pieces: 64, min_pieces_to_publish: 1 }` |
| `printify_product_types` | `["canvas", "poster", "photo"]` |

---

## Revenue Flow (per print sale)

```
Buyer pays retail price (fiat via Printify modal)
    ↓
Printify processes payment, fulfils order
    ↓
Platform receives net (retail - Printify cost)
    ↓
treasury_ledger entries created:
    • Artist:   70% of net   → pending  (always fixed)
    • Curator:  tier %        → pending  (5% / 8% / 10%) — carved from holder pool
    • Holders:  25% - curator % → pending  (e.g. 20% if curator tier is 5%)
    • Platform: 5%            → pending
    ↓
Admin triggers payout (or automation runs)
    ↓
USD → BSV conversion at market rate
    ↓
BSV sent to artist/curator wallets via GorillaPool
    ↓
ledger entries marked paid, payout txid recorded
    ↓
Ordinal holders can then claim their portion (holder_pct)
via the gallery claim widget
```

---

## User Role Journey

```
Register (email/password via Supabase Auth)
    ↓
profiles row created + collector role granted automatically
    ↓
Browse gallery, buy prints — no wallet needed
    ↓
Want to sell art?  →  Apply for Artist role
                        ↓
                      BSV wallet generated
                        ↓
                      Upload collection (1–64 PNGs, 3000px+, 281 DPI+)
                        ↓
                      Curator reviews + approves
                        ↓
                      Printify pipeline fires (3 products per piece)
                        ↓
                      Profile page goes live, pieces in gallery

Want to curate?  →  Apply for Curator role
                        ↓
                      Select tier + pay seat fee
                        ↓
                      Admin approves
                        ↓
                      BSV wallet generated
                        ↓
                      Sponsor artists, create themed collections
                        ↓
                      Earn revenue share on sponsored collection sales

Want ordinals?  →  Connect or generate BSV wallet
                        ↓
                      Buy ordinal from artist's collection
                        ↓
                      Claim BSV from print sales via gallery claim widget
```

---

## Key Business Rules (enforced in DB)

1. `collection.piece_count` ≤ 64 — hard DB constraint
2. `artwork.position` must be 1–64 and unique within a collection
3. A curator cannot approve their own artist application — CHECK constraint + app layer
4. Image upload minimum: 3000×3000px, 281 DPI — validated before row is created
5. Every print order creates 3 ledger rows atomically (artist + curator + platform)
6. A collector buying prints never needs a BSV wallet
7. Curator seat expires when `seat_expires_at` passes — role auto-suspended (cronjob)
8. `collections.slug` is unique **per artist**, not globally — `UNIQUE (artist_id, slug)` ← v0.3.0
9. `reward_allocations.inscription_outpoint` is globally unique — one accrual row per ordinal ← v0.3.0
10. Claim challenges expire after 5 minutes — `expires_at` enforced at application layer; `used_at` is stamped on consumption to prevent replay ← v0.3.0

---

## Supabase Storage Buckets

| Bucket | Contents | Access |
|---|---|---|
| `artwork-originals` | Original PNG uploads | Private (service role only) |
| `artwork-jpegs` | Converted JPEGs for zoide | Private (service role only) |
| `artwork-thumbnails` | Generated preview images | Public |
| `avatars` | User profile photos | Public |
| `banners` | Profile banners | Public |
| `curator-assets` | Curator collection covers | Public |
