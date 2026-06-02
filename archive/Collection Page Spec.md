---
type: spec
date: 2026-04-28
project: ASMRtists
author: ChefMyKLove
status: draft-1
---

# Collection Page Spec

The public-facing per-collection page. The thing a collector lands on when they click into "Ordinal Rainbows Vol. 1" or any other collection on the platform. It must:

1. Show the collection (cover, story, 64-piece grid) without requiring login.
2. Let an **artist** log in and click straight through to the collection-specific area of their dashboard.
3. Let an **ordinal holder** connect a real BSV wallet (Yours, HandCash, etc.), see their claimable balances (MNEE, BSV, and — eventually — the BSV21 OR token), and claim them.
4. Be the canonical template for every collection on the platform — not a one-off rebuild for OR Vol.1.

OR Vol.1's `index.html` is the *functional* reference. Its styling is being thrown out; what we're keeping is the wallet-connect-and-claim flow, the on-chain ownership verification, and the direct-from-treasury BSV payout pattern.

---

## Gap Analysis — OR Vol.1 vs ASMRtists web/

### REUSE AS-IS (port the logic, keep the patterns)

| OR Vol.1 file | What it does | Reuse strategy |
|---|---|---|
| `api/payout.js` (`sendBSVToAddress`, `processClaimPayout`) | Pulls UTXOs from WhatsOnChain, builds tx with `@bsv/sdk`, signs, broadcasts via TAAL ARC, extracts txid robustly | **Port verbatim** to `web/src/lib/bsv/payout.ts` and `web/src/app/api/claim/payout/route.ts`. The robust txid extraction (handles `string`, `result.txid`, `result.id`, `result.data.txid`) is hard-won and worth keeping. |
| `api/claim.js` ownership re-verification (GorillaPool `inscriptions/<id>_0` → `owner` field) | Server-side double-check that the wallet claiming actually owns the inscription | **Port** to `web/src/lib/bsv/ownership.ts`. Critical — never trust client-side ownership claims. |
| `api/claim.js` duplicate-claim logic (pending blocks new, sent allows new only if `bsvAmount > 0`) | Prevents double-claims, allows fresh accruals | **Port** to claim API route. |
| `js/bsv-wallet-sdk.js` `BSVWalletSDKManager` (Yours / HandCash / RelayX / 1SatOrdinals detection + connect + signMessage) | Connect-to-existing-wallet pattern | **Port to TS** as `web/src/lib/wallet/connectors.ts`. ~340 lines of working code. |
| `js/rewards-integration.js` `fetchUserOrdinals(address)` (line 2148) | Pulls owned ordinals from GorillaPool by ord address | **Port** to `web/src/lib/bsv/ordinals.ts`. |
| BSV SDK lessons (overview line 142–149) | `PrivateKey.fromWif` case-sensitivity, full-source-tx requirement, `/unspent/all` endpoint, ARC API key required | Already documented. Apply when porting. |

### PORT (rewrite for current schema + Shopify + Next.js)

| OR Vol.1 thing | Why it can't be reused as-is | New target |
|---|---|---|
| `reward_allocations` table reads (`mnee_claimable`, `bsv_claimable`, `bsv_total_earned`) | ASMRtists schema uses `ordinal_claims` with a single `amount_bsv` column. No `mnee_claimable` or per-token-type tracking. | **Schema migration v0.3.0** (see "Schema Changes" below) |
| Printify iframe modal (`https://asmrprints.printify.me/...`) | Capstone is moving to Shopify | Use existing `web/src/components/shopify/shop-modal.tsx` (already built) |
| Vercel serverless `module.exports = async function (req, res)` API style | Next.js App Router uses Web `Request`/`Response` | Convert to `export async function POST(req: Request)` |
| Treasury hardcoded as `1r1rJXu5znptbcSKYuFW74eDZ3zJtsAwb`, `TREASURY_PAY_PK` env | ASMRtists has separate platform wallet (`PLATFORM_FUNDING_WIF`) for inscription fees, plus MNEE treasury. Need to decide if claim-payout treasury is a third wallet or shared. | Decide and configure (see "Open Questions" below) |
| The 2080-line `index.html` styling | Chef's verdict: stylings aren't what we're after | Build from scratch with shadcn/ui + Tailwind, matching the rest of `(public)/` pages |

### BUILD NEW (does not exist anywhere yet)

1. **Public collection route** — `web/src/app/(public)/c/[slug]/page.tsx` (server) + `collection-page-client.tsx` (client). Mirrors the `artists/[slug]` pattern.
2. **Wallet-connect component** for *existing* wallets (Yours, HandCash, etc.) — **not** the wallet-generator that's in `wallet/wallet-connect.tsx` today. New file: `web/src/components/wallet/wallet-connector.tsx`. Confusable name; rename existing `wallet-connect.tsx` to `wallet-generator.tsx` while we're in there.
3. **Holder claim panel** — slides out from the collection page when a wallet is connected. Lists owned ordinals from this collection, shows claimable balances per-piece, "Claim All" button per token type. New file: `web/src/components/collection/holder-claim-panel.tsx`.
4. **Per-holder claim API** — `web/src/app/api/claim/route.ts` (POST, takes `inscriptionId`, `bsvAddress`, `ordAddress`, returns claim status / txid). The existing `/api/mnee/distribute` is admin-batch and doesn't fit. The existing `/api/mint/inscribe` is unrelated.
5. **Claimable-balance lookup API** — `web/src/app/api/claim/balance/route.ts` (GET `?inscriptionId=...` → `{ mnee, bsv, bsv21 }`).
6. **Artist deep-link from collection page** — small "Manage this collection" button visible only to the logged-in owning artist, routes to `/dashboard/collections/[id]`. No new dashboard UI; just the entry point.

### DROP (don't carry forward)

- `js/bsv-auth.js`, `js/bsv-auth-fixed.js` — superseded by `bsv-wallet-sdk.js`
- `js/bsv-wallet-debugger.js`, `js/debug-helper.js` — dev scaffolding
- The cycling rainbow background animation — replace with collection's actual cover image / banner
- `indexindex.html` — leftover original; ignore
- Bootstrap CDN — Tailwind covers it
- Dead code: `web/src/lib/zoide/inscribe.ts` (also called out in Project Overview)

---

## Where it lives

**Internal route: `web/src/app/(public)/c/[username]/[collection]/page.tsx`**

- `(public)` route group — same wrapper as `/artists/[slug]` and `/browse`, gets the public navbar/footer.
- `c/[username]/[collection]` — internal Next.js route. Two URL params: artist username, collection slug.
- Server component fetches data with `createClient()` from `lib/supabase/server.ts`. Client component handles wallet state + claim modals.

**Phase 1 public URL:** `asmrtists.ca/c/chefmyklove/ordinalrainbows`
**Phase 2 public URL (post-middleware):** `ordinalrainbows.chefmyklove.shop.asmrtists.ca`

The internal route file is the same in both phases — only the middleware/DNS layer differs. This becomes the canonical pattern. Every collection — OR Vol.1, the next artist's first drop, every one after — renders through this same route. No per-collection HTML files, ever.

OR Vol.1's existing site at `ordinalrainbows.com` is **not** the URL the collection adopts on ASMRtists. The new home is the subdomain pattern. The old domain stays standalone or 301-redirects later — separate decision.

---

## Route, data model, component tree

### Route: `web/src/app/(public)/c/[username]/[collection]/page.tsx`

```tsx
// Server component — fetches collection + artworks + artist + viewer auth state
export default async function CollectionPage({
  params
}: {
  params: Promise<{ username: string; collection: string }>
}) {
  const { username, collection: slug } = await params
  const supabase = await createClient()

  // Two-step: lookup artist by username, then collection by (artist_id, slug)
  const { data: artist } = await supabase
    .from('artist_profiles')
    .select('id, display_name, username, avatar_url, bio, user_id')
    .eq('username', username)
    .eq('is_active', true)
    .single()

  if (!artist) notFound()

  const { data: collection } = await supabase
    .from('collections')
    .select(`
      id, slug, title, description, cover_image_url, status,
      artworks ( id, position, title, description, thumbnail_url, jpeg_storage_path,
                 inscription_txid, inscription_outpoint, ordinal_metadata )
    `)
    .eq('artist_id', artist.id)
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (!collection) notFound()

  const { data: { user } } = await supabase.auth.getUser()
  const isOwningArtist = user?.id === artist.user_id

  return (
    <CollectionPageClient
      collection={{ ...collection, artist }}
      isOwningArtist={isOwningArtist}
    />
  )
}
```

### Client component tree

```
<CollectionPageClient>
  <CollectionHeader>          // banner, title, artist credit, story
    {isOwningArtist && <ManageCollectionButton />}  // → /dashboard/collections/[id]
    <WalletConnectorButton />  // top-right; opens connector modal
  </CollectionHeader>

  <CollectionGrid>             // the 64 pieces
    <ArtworkCard onClick={openCard3D}>
      // front: thumbnail, title, position
      // back (when flipped): inscription id, outpoint, "Buy print" → ShopModal,
      //                      claim widget if connected wallet owns this piece
    </ArtworkCard>
  </CollectionGrid>

  <HolderClaimPanel>           // sheet/sidebar; opens when wallet connected
    <OwnedOrdinalsList />      // pieces in this collection owned by connected wallet
    <ClaimableBalances>
      <MneeClaimable />        // total MNEE across all owned pieces
      <BsvClaimable />         // total BSV across all owned pieces
      <Bsv21Claimable />       // total OR BSV21 token (post-MVP — see Open Questions)
    </ClaimableBalances>
    <ClaimAllButton />         // bulk claim
  </HolderClaimPanel>

  <ShopModal />                // existing component, used for print purchase
</CollectionPageClient>
```

### Auth states

| State | What's visible |
|---|---|
| **Unauthenticated** | Full collection visible. "Buy print" buttons work (route through Shopify). Claim panel shows "Connect a BSV wallet to check for rewards." |
| **Logged-in as collector (no wallet)** | Same as unauth, plus collector dashboard link in navbar. |
| **Logged-in as the artist who owns this collection** | Adds floating "Manage this collection" button → `/dashboard/collections/[id]`. No editing on this page itself. |
| **Wallet connected (no owned pieces in this collection)** | Connected state shown; claim panel says "You don't hold any pieces from this collection." |
| **Wallet connected (owns pieces)** | Owned pieces highlighted in grid (badge or border); claim panel shows balances + claim button. |

---

## Holder claim flow (the meat)

This is the part Chef cares most about preserving from OR Vol.1.

### Step 1 — Wallet connect

User clicks **Connect Wallet** (top-right of collection page). Modal opens, lists detected wallets (Yours, HandCash, RelayX, 1SatOrdinals, MetaNet). Click one → wallet handshake → sign challenge message → page receives:

- `bsvAddress` (payment address)
- `ordAddress` (ordinal-receiving address; differs from bsv address — OR Vol.1 line 12)
- `walletType`

Persist to `localStorage` for session resume (key: `asmr-wallet-session`). **Never** persist signatures.

### Step 2 — Discover owned ordinals

Call `fetchUserOrdinals(ordAddress)` against GorillaPool: `https://ordinals.gorillapool.io/api/txos/address/<ordAddress>/unspent`. Filter results to inscriptions whose `outpoint` is in this collection's `artworks.inscription_outpoint` list.

### Step 3 — Fetch claimable balances

`GET /api/claim/balance?inscriptionId=<txid>` → `{ mnee, bsv, bsv21 }`. Server reads from `ordinal_claims` (post-schema-migration) joined with whatever pending allocations exist for this inscription. Aggregate client-side for "total claimable" display.

### Step 4 — Claim (signed-challenge protocol)

The claim is a two-call protocol to keep it secure:

**Call 1 — `POST /api/claim/challenge`**
- Body: `{ ordAddress }`
- Server generates a random nonce (32 bytes hex), stores it in a short-lived row (`claim_challenges` table or Redis-style — TTL 5 min), keyed to `ordAddress`.
- Returns: `{ challenge: "asmr-claim:{nonce}:{timestamp}", expiresAt }`.

**Call 2 — Wallet signs the challenge string** via `signMessage(walletType, challenge)`. One popup. Returns a signature.

**Call 3 — `POST /api/claim`**
- Body:
  ```ts
  {
    inscriptionOutpoints: string[],
    bsvAddress: string,         // payment destination
    ordAddress: string,         // for ownership re-verify
    challenge: string,          // the exact string signed
    signature: string,          // wallet's signature of `challenge`
    collectionId: string
  }
  ```
- Server, for each inscription:
  1. **Verify the signed challenge** — re-fetch the nonce row, check it matches and isn't expired, verify the signature against `ordAddress` using `bsv-message` or `@bsv/sdk` `BSM`. Reject with 401 on mismatch. Burn the nonce.
  2. Re-verify ownership via GorillaPool (`inscriptions/<id>_0` → `owner` matches `ordAddress`). Reject with 403 on mismatch.
  3. Look up `reward_allocations` row by outpoint.
  4. Apply duplicate-claim guard (port from OR Vol.1 `claim.js` lines 30–47).
  5. Mark allocation as `processing`.
  6. For BSV: call `sendBSVToAddress(bsvAddress, satoshis)` (port of `payout.js`). Update `payout_txid`, mark `paid`.
  7. For MNEE: call existing `lib/mnee/treasury.ts` `distributeMnee()` for this single recipient.
  8. For BSV21 OR token: **stub for MVP** — log "BSV21 claim not yet implemented" and continue. UI shows "Coming soon."
  9. Insert `ordinal_claims` row with txid + ticketId.
  10. Zero out `mnee_claimable` and `bsv_claimable` on the allocation.
- Returns `{ results: [{ outpoint, mneeTicketId?, bsvTxid?, bsv21Status: 'deferred' }] }`.

### Step 5 — UI feedback

Optimistic update of claim panel + toast notifications via `sonner`. Refetch balances after 2s to confirm zeros.

---

## Schema changes needed (v0.3.0)

The current `ordinal_claims` table is post-claim only — it doesn't track *unclaimed accrual* per inscription. OR Vol.1 used `reward_allocations` for that. Two options:

**Decision: Option A — add `reward_allocations` table** (mirrors OR Vol.1):

```sql
CREATE TABLE public.reward_allocations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id          UUID NOT NULL REFERENCES public.artwork(id) ON DELETE CASCADE,
  inscription_outpoint TEXT NOT NULL,
  mnee_claimable      NUMERIC(16,6) NOT NULL DEFAULT 0,
  bsv_claimable       NUMERIC(16,8) NOT NULL DEFAULT 0,
  bsv21_claimable     NUMERIC(16,8) NOT NULL DEFAULT 0,  -- stub for OR token; not wired in MVP
  total_earned_usd    NUMERIC(10,2) NOT NULL DEFAULT 0,
  rarity              TEXT,
  rarity_multiplier   NUMERIC(4,2) DEFAULT 1.0,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(inscription_outpoint)
);
```

Why Option A and not extending `ordinal_claims`: keeps "what's owed" (per artwork, address-agnostic, accumulates from print sales) separate from "what's been claimed" (per claim event, by address). Matches the OR Vol.1 mental model that already works.

Also add `slug` and per-artist uniqueness to `collections`:

```sql
ALTER TABLE public.collections ADD COLUMN slug TEXT NOT NULL DEFAULT 'untitled';
ALTER TABLE public.collections
  ADD CONSTRAINT collections_artist_slug_unique UNIQUE (artist_id, slug);

-- Backfill existing rows
UPDATE public.collections
SET slug = lower(regexp_replace(title, '[^a-zA-Z0-9]+', '', 'g'))
WHERE slug = 'untitled';
```

Note slugs are stripped — no hyphens — to match Chef's preferred subdomain shape (`ordinalrainbows`, not `ordinal-rainbows-vol-1`). Adjust the regex if hyphen-containing slugs are wanted later.

---

## Implementation order (smallest viable first)

1. **Schema migration v0.3.0** — `reward_allocations` table, `collections.slug`, plus a SQL seeder that builds OR Vol.1's 64 allocations from the existing `artwork` rows once they're inserted.
2. **Public collection route scaffold** — `c/[slug]/page.tsx` rendering data from Supabase. No wallet, no claim. Just a viewable page. Test by inserting OR Vol.1 collection + 64 artworks via SQL.
3. **Wallet connector component** — port `BSVWalletSDKManager` to TypeScript, wire up Yours + HandCash detection. Connect button + connected state. No claim flow yet.
4. **Owned-ordinal detection** — call GorillaPool, highlight owned cards in grid. Read-only.
5. **Balance lookup API + claim panel** — `/api/claim/balance`, the panel shows numbers. Still no claim button.
6. **Per-holder claim API** — `/api/claim` POST. BSV payout first (we have working code to port). MNEE second. BSV21 stubbed.
7. **End-to-end test** — Chef on a real wallet, real owned inscription, claims real (testnet first?) BSV.
8. **Artist deep-link button** — trivial; gated on `auth.user.id === collection.artist.user_id`.
9. **Polish + mobile** — flip-card 3D modal optional; can ship without it.

Steps 1–4 can land before any of the "credentials still missing" gates (Open Problem #1) bite, because they don't transact. Steps 6–7 require `TREASURY_PAY_PK` (or whatever wallet does claim payouts) to be funded.

---

## Decisions (Chef, 2026-04-28)

1. **Claim-payout treasury wallet** → **Reuse OR Vol.1's existing treasury.** Address `1r1rJXu5znptbcSKYuFW74eDZ3zJtsAwb`, env var `TREASURY_PAY_PK`. Already funded, already proven, lessons baked in. Down the road we may split per-platform-function wallets, but for MVP one funded address handles all claim payouts.

2. **BSV21 OR token** → **Live on-chain (14 holders), but stub on the collection page for MVP.** The token exists; it has no current claim mechanism. Future use case is curator voting weight on platform decisions — not yet wired. Collection page shows "BSV21 OR token: Coming soon" placeholder; no claim logic built. Revisit when curator voting design starts.

3. **Wallet challenge signing** → **Both layers, always.** Server-side GorillaPool ownership re-verify *and* a wallet-signed challenge at claim time. The signed challenge proves the connecting wallet controls the ord address at the moment of claim — defends against stolen-session / localStorage hijacking. Cost is one extra wallet popup; benefit is the difference between "trust the address string" and "prove cryptographic control." Required, not optional.

4. **Claim payout** → **Instant, synchronous.** Claim API call broadcasts the BSV transaction, waits for the txid, returns it in the response body. Matches OR Vol.1 `payout.js` pattern. Holder sees txid immediately, can verify on WhatsOnChain. No queue, no polling.

5. **Slug + URL routing** → **Subdomain-based, double-nested.** The user-facing URL is `<collection>.<artist>.shop.asmrtists.ca` (e.g. `ordinalrainbows.chefmyklove.shop.asmrtists.ca`). Database: `collections.slug` is `'ordinalrainbows'` (lowercase, no hyphens, no version). See "URL Routing & Subdomains" section below — built in two phases: path-based first, subdomain rewriter second.

---

## URL Routing & Subdomains

The platform is multi-tenant by subdomain:

- `asmrtists.ca` — root, splash, browse, marketing
- `shop.asmrtists.ca` — top-level e-commerce surface (might be the gallery / browse-all-shoppable)
- `<artist>.shop.asmrtists.ca` — an individual artist's storefront (lists their collections)
- `<collection>.<artist>.shop.asmrtists.ca` — a single collection page (the thing this spec covers)

### Internal route structure

The Next.js App Router doesn't see the subdomain — `middleware.ts` parses the Host header and rewrites the URL internally. The actual route file lives at:

```
web/src/app/(public)/c/[username]/[collection]/page.tsx
```

So `ordinalrainbows.chefmyklove.shop.asmrtists.ca/anything` becomes `/c/chefmyklove/ordinalrainbows/anything` server-side. The user's address bar keeps the subdomain.

### Schema implication

`collections.slug` is **not globally unique** — it's unique *per artist*:

```sql
ALTER TABLE public.collections ADD COLUMN slug TEXT NOT NULL DEFAULT 'untitled';
ALTER TABLE public.collections ADD CONSTRAINT collections_artist_slug_unique UNIQUE (artist_id, slug);
```

This way two artists can both have a collection slugged `vol-1`.

### Phased rollout

**Phase 1 (during this build) — path-based.** Public URL is `asmrtists.ca/c/chefmyklove/ordinalrainbows`. No middleware, no DNS, no certs. The collection page works end-to-end. Chef can dogfood the entire flow.

**Phase 2 (after Phase 1 is proven) — subdomain rewriter.** Add `web/src/middleware.ts` that:
1. Reads `req.headers.get('host')`.
2. If host matches `*.*.shop.asmrtists.ca` regex, extracts `<collection>` and `<artist>`.
3. Rewrites with `NextResponse.rewrite(new URL('/c/{artist}/{collection}', req.url))`.
4. Falls through unchanged for `asmrtists.ca` itself.

DNS work (one-time):
- `*.shop.asmrtists.ca` CNAME → `cname.vercel-dns.com` (covers single-level)
- For double-nested `<collection>.<artist>.shop.asmrtists.ca`, Vercel Pro plan + per-artist wildcard cert provisioning via the Vercel Domains API. Triggered on artist signup: `await vercel.domains.add('*.${username}.shop.asmrtists.ca')`.

**Cost gate:** Vercel Pro is $20/mo. The Hobby plan won't issue the per-artist wildcard certs needed for the double-nested pattern. If budget is a constraint, fall back to single-level (`<artist>-<collection>.shop.asmrtists.ca` flattened) which works on the Hobby plan with a single wildcard cert.

### Vol.1 transition

`ordinalrainbows.com` (the existing standalone site) does NOT become the URL of the collection on ASMRtists. The new URL is `ordinalrainbows.chefmyklove.shop.asmrtists.ca`. The old `ordinalrainbows.com` either: (a) 301-redirects to the new URL once Phase 2 lands, or (b) stays up as a separate marketing site. Decision can wait.

---

## Pre-minted collection import (OR Vol.1 caveat)

OR Vol.1's 64 inscriptions are already on chain (Zoide collection ID `ee4ae45304c28d0fa6_0`, 13 holder wallets). The standard upload-and-mint flow does NOT apply — running it would create duplicate inscriptions with no provenance link. The on-chain artifacts already exist; we just need to register them as ASMRtists artwork rows.

### Two flows, one schema

The `artwork` table doesn't need to change. `inscription_txid` and `inscription_outpoint` are already columns on the row — they just happen to get filled by `lib/bsv/inscribe.ts` in the standard flow. For imports, the manifest fills them before insert.

| Flow | Status path | Who fills `inscription_txid` |
|---|---|---|
| **Standard** (new work, PNG → JPEG → mint) | `uploaded` → `processing` → `minting` → `shop_pending` → `shop_ready` | `lib/bsv/inscribe.ts` |
| **Import** (pre-minted, off-platform inscription) | `shop_pending` → `shop_ready` | manifest, before insert |

The import flow skips `uploaded` / `processing` / `minting` entirely. `printify_pipeline.py` doesn't care HOW the txid got there — it polls for `shop_pending` and creates Printify products. That part is untouched.

### Image fidelity note

The JPGs in `C:\Users\micha\ordinalrainbowsproject\ORDINALRAINBOWS-Vol.1\images\` are almost certainly higher-resolution than what's actually on chain — the on-chain inscriptions targeted sub-400kb for inscription efficiency (per Project Overview). That's fine and intentional:
- **Local high-res JPG** → Supabase Storage → Printify (high-quality print source)
- **On-chain inscription** → ownership artifact, viewable via GorillaPool content endpoint
- **Thumbnail** → generated from local JPG, served from Supabase Storage CDN

Two layers, separate concerns. The `inscription_txid` ties the high-res print artwork to its on-chain proof.

### MVP approach: one-time script

For OR Vol.1, build a one-time import script (`scripts/import_or_vol1.py`). Inputs: local image folder + a manifest mapping filenames to inscription txids/outpoints. The manifest can be built by querying GorillaPool for the Zoide collection ID. Spec'd in Prompt 7.5 of `Collection Page - Claude Code Prompts.md`.

### Post-MVP: artist-facing import wizard

Eventually any artist arriving with pre-minted on-chain work needs a way to bring it to the platform without re-minting. The one-time script proves the data shape; a wizard at `/dashboard/collections/import` (parallel to `/dashboard/collections/upload`) would expose it as a feature. **Not blocking June 6.** Tracked as an Open Problem.

---

## File checklist (what gets created/touched)

```
NEW (Phase 1 — path-based, fully-functional):
  web/src/app/(public)/c/[username]/[collection]/page.tsx
  web/src/app/(public)/c/[username]/[collection]/collection-page-client.tsx
  web/src/app/api/claim/route.ts
  web/src/app/api/claim/balance/route.ts
  web/src/app/api/claim/challenge/route.ts                 (issues nonce for wallet to sign)
  web/src/components/wallet/wallet-connector.tsx           (connect to existing wallets)
  web/src/components/collection/holder-claim-panel.tsx
  web/src/components/collection/collection-header.tsx
  web/src/components/collection/collection-grid.tsx
  web/src/components/collection/artwork-card.tsx           (with flip)
  web/src/lib/wallet/connectors.ts                         (Yours/HandCash/RelayX/1Sat/MetaNet)
  web/src/lib/wallet/challenge.ts                          (signed-challenge verification)
  web/src/lib/bsv/payout.ts                                (port of OR Vol.1 payout.js)
  web/src/lib/bsv/ownership.ts                             (GorillaPool re-verify)
  web/src/lib/bsv/ordinals.ts                              (fetchUserOrdinals)
  schema-migrations/v0.3.0-collections-slug-and-allocations.sql

NEW (Phase 2 — subdomain rewriter, optional later):
  web/src/middleware.ts                                    (parse Host, rewrite to internal route)

RENAMED:
  web/src/components/wallet/wallet-connect.tsx → wallet-generator.tsx

UPDATED:
  schema.sql                                               (merge v0.3.0)
  SCHEMA_REFERENCE.md                                      (document new table + slug)
  ASMRtists - Project Overview.md                          (record decisions)
  .env.local                                               (TREASURY_PAY_PK reused from OR Vol.1)

DROPPED:
  web/src/lib/zoide/inscribe.ts                            (already flagged dead)
```

---

## Definition of done (MVP)

- Chef logs in with the artist account.
- Creates a collection titled "Ordinal Rainbows Vol. 1" via existing `/dashboard/collections/upload` flow with all 64 pieces.
- Visits `asmrtists.ca/c/ordinal-rainbows-vol-1` while logged out — sees the collection.
- Clicks **Connect Wallet** in another browser as a test holder, connects Yours.
- Sees their owned pieces highlighted, sees a non-zero MNEE balance, clicks Claim, sees a txid, sees the balance go to zero.
- Clicks **Manage this collection** while logged in as the artist — routes to dashboard.

That's the bar.
