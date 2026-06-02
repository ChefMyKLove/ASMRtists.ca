---
type: focus
project: A.S.M.R / ASMRprints.com
week: April 25–May 1, 2026
author: ChefMyKLove
---

# This Week: Credential Sprint + Wallet Setup

**The gate:** Everything is built. Nothing runs until credentials exist and wallets are funded. This week is about filling `.env.local`, running the schema, and getting a funded platform wallet live on BSV mainnet.

No Zoide. The in-house minter (`lib/bsv/inscribe.ts`) is complete and wired. It just needs `PLATFORM_FUNDING_WIF` and some sats.

---

## The Checklist (do these in order)

### 1. Supabase
- Create a Supabase project (or confirm existing one)
- Copy **Project URL**, **Anon Key**, **Service Role Key** from Settings → API
- Run `schema.sql` (v0.2.0) in the SQL Editor — verify all tables create cleanly
- Create the 6 storage buckets: `artwork-originals`, `artwork-jpegs`, `artwork-thumbnails`, `avatars`, `banners`, `curator-assets`
- Apply RLS policies: private read/write for `artwork-originals` and `artwork-jpegs`; public read for the rest

### 2. Platform BSV Wallet (new this week — critical for minting)
The in-house minter pays inscription fees from a dedicated platform wallet. This wallet needs to exist and hold BSV before any ordinal can be minted.

- Generate a new BSV wallet using `generateWallet()` from `lib/bsv/wallet.ts` — run it in a local Node script or browser console
- Save the **mnemonic somewhere safe and offline** — this is the platform treasury key
- Copy the **WIF** → add as `PLATFORM_FUNDING_WIF` in `.env.local`
- Note the **BSV address** — this is where you'll send sats to fund inscription fees
- Fund it: ~10,000–50,000 sats is enough to mint the OR Vol.1 collection and test. Send from your existing BSV wallet.
- Confirm UTXOs on WhatsOnChain: `https://whatsonchain.com/address/<your-address>`

### 3. Printify + Shopify
- Copy **Printify API key** from Printify → Settings → Connections → API access
- Copy **Printify Shop ID** from the URL inside your shop
- Run catalog API calls to get blueprint + provider IDs:
  ```
  GET https://api.printify.com/v1/catalog/blueprints.json
  ```
  Find canvas, poster/art print, photo entries. For each:
  ```
  GET https://api.printify.com/v1/catalog/blueprints/{id}/print_providers.json
  ```
- Connect Shopify to Printify if not already done
- Note the Shopify store URL for the `ShopModal` component (`shop-modal.tsx` points to `asmrprints.com`)

### 4. Stripe
- Add `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` to `.env.local`
- Keys are in Stripe Dashboard → Developers → API keys

### 5. Fill `.env.local`
Open `web/.env.local` (copy from `.env.local.example`) and fill:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PRINTIFY_API_KEY=
PRINTIFY_SHOP_ID=
PRINTIFY_WEBHOOK_SECRET=
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
MNEE_API_KEY=
MNEE_TREASURY_WIF=
PLATFORM_FUNDING_WIF=          ← new this week — BSV inscription wallet
TAAL_API_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=                   ← generate any random string; used to protect /api/mint/inscribe
```

### 6. Fill Python script placeholders
- `scripts/printify_pipeline.py` — replace all `<<PLACEHOLDER>>` with real Supabase + Printify values
- `scripts/ordinal_prep.py` — same for Supabase values; also remove the Zoide section (it's dead code — the in-house minter handles inscription now)

### 7. Test
- Run `printify_pipeline.py` with one OR Vol.1 piece as dummy data → 3 products appear in Printify shop
- Run `ordinal_prep.py` → JPEG appears in `artwork-jpegs` bucket in Supabase
- Hit `/api/mint/inscribe` with the artwork ID → confirm BSV transaction broadcast, txid written back to artwork row
- Register a test user in the web app → confirm `profiles` + `user_roles` rows in Supabase

### 8. OR Vol.1 wallet audit
- The OR Vol.1 collection holders need their wallets identified and documented (5 controlled wallets: 4 Michael's, 1 Soma's)
- Confirm all wallet private keys / WIFs are accessible — these will be needed for the MNEE claim flow

---

## Definition of Done

- `PLATFORM_FUNDING_WIF` in `.env.local` and the wallet has UTXOs on-chain
- `printify_pipeline.py` runs without errors against real Printify
- `ordinal_prep.py` produces a JPEG in Supabase Storage
- `/api/mint/inscribe` successfully broadcasts a BSV transaction for a test piece
- A test user can register and their Supabase rows exist

---

## What This Unlocks

- Week 2: wire upload wizard → pipeline trigger → inscribe in one automated flow
- Week 2: fill Printify webhook TODOs (now there's real order data to test against)
- Week 3: open artist registration (once Terms are drafted)
- June 6 deadline: stays reachable
