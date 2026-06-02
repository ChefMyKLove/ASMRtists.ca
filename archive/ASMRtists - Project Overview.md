---
type: problems
date: 2026-04-02
project: A.S.M.R / ASMRprints.com
author: ChefMyKLove
---

## Goal
Provide a novel and innovative way for artists to monetize their work using BSV blockchain distributed ledger tech — while onboarding new users to the BSV ecosystem — with the eventual goal of selling the platform.

**Platform:** ASMRprints.com ("Art Splash Marketing Resource")

**Core Deadlines:**
- Capstone proposal: May 1, 2026 — **ACCEPTED** (feedback by May 12)
- Built project due: June 6, 2026
- Pitch Day presentation to industry professionals (Circuit Stream course): July 16, 2026

## Why
This project fulfils all of Michael's creative blocks at once: it's a creative expression that earns a living, while helping other artists earn a living and showcase their creativity. It's personal, purposeful, and scalable. It is the productized evolution of Ordinal Rainbows Vol.1 — a live, working proof-of-concept already in production with real on-chain ordinals and real holders. The platform is explicitly designed to be investor-ready and positioned for acquisition.

## Core Innovation
> **Ordinal holders share in print sale revenue.**

When a collector buys an ordinal (a JPEG inscribed on BSV), they become economically motivated to promote and sell physical prints of that artwork. The ordinal is not just a collectible — it's a revenue-sharing artifact. This turns the holder community into a natural sales force.

**ASMR acts as a talent agent, not a DIY toolkit** — artists hand off, ASMR handles the rest.

## Tangible Outcomes
- A live splash platform (ASMRprints.com) with login portals for creators, collectors, curators, and admins
- Artist onboarding portal: profile creation, collection management (up to 64 pieces per collection)
- Automated Printify shop integration (canvas, art print, photo print — 3 product types per artwork)
- PNG-to-JPEG conversion pipeline feeding 1Sat Ordinals inscription (Phase 1 via Zoide; Phase 2 proprietary in-house minter)
- Collection page linking 1Sat Ordinals metadata to print sales via Printify API modals
- Working MNEE reward and payout system for ordinal holders (on-chain activity + print sales)
- Ordinal Rainbows Vol.1 live as proof-of-concept featured collection
- System is secure, live on web and chain, and fully integrated

## Platform Architecture — Four Portals

### Entry: Splash Page
- Interactive animation (skippable) at platform entry
- Sets brand tone: professional, playful, blockchain-native

### Portal 1 — Artists
- Register and create an account
- Upload high quality PNG files (min 281dpi, 3000×3000px) — maximum 64 pieces per collection
- Artwork automatically stocked in the centralized ASMR Shopify store (canvas, art print, photo print)
- PNG files converted to JPEGs, prepared and inscribed as BSV 1Sat Ordinals
- Artists hand off; ASMR handles the rest

### Portal 2 — Collectors
- Browse collections
- Mint ordinals using BSV wallet login
- Buy prints
- Gamified activity: leaderboard rankings + referral system (wallet holders only)
- Ordinal holders can see and claim print revenue payouts in MNEE (stablecoin)

### Portal 3 — Curators
Different tiers allow for different levels of curation within the site. Curators can curate different showrooms or galleries (e.g., a real art gallery wanting to showcase its artists). Tiers: gallery/institution → artists/influencers → general public. Ties into future social media layer and leaderboard stats.

### Portal 4 — Gallery / Marketplace / Leaderboard
- Featured artists
- Ranked collectors
- "Buy" triggers that prompt login if user is not authenticated
- Publicly browsable without login

## Proof of Concept — Ordinal Rainbows Vol.1
Already live at **ordinalrainbows.com** (deployed on Vercel):
- 63 BSV 1Sat Ordinals across 13 wallets
- 5 controlled wallets (4 Michael's, 1 Soma — Michael's son)
- Inscribed via ZoideNFT (collection ID: `ee4ae45304c28d0fa6_0`)
- One piece glitched during minting — being considered as a rarity/special edition (lean into the accident; still need to create that canon in the story)
- MNEE stablecoin revenue-share payout system designed; BSV payouts in testing — not fully implemented
- Printify shop live
- Needs amendment to use the same Shopify modal as the capstone

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Blockchain | BSV 1Sat Ordinals | `@bsv/sdk` for wallet/signing |
| Ordinal Minting | Zoide NFT (Phase 1) | Proprietary in-house minter planned for Phase 2 |
| Broadcasting | TAAL ARC | Requires API key in header |
| UTXOs / Chain Data | WhatsOnChain | Endpoint: `/unspent/all` → `{ result: [...] }` |
| Stablecoin Payouts | MNEE | Chosen because prints sold in USD; stablecoin prevents BSV price erosion |
| Print Fulfillment | Printify | One centralized shop (not per-artist shops); ASMR brand |
| Database / Storage | Supabase | PostgreSQL + Storage; schema v0.2.0 live in `schema.sql` |
| Backend Scripts | Python | `printify_pipeline.py`, `ordinal_prep.py` (in `scripts/`) |
| Frontend Framework | Next.js (App Router) | Lives in `web/` subdirectory; shadcn/ui components |
| Shop Layer | Vite + React | Separate `shop/` app — standalone storefront component |
| Hosting | Vercel + GitHub | VSCode → push → Vercel auto-deploys; domain: asmrtists.ca |
| Discord Gating | Custom bot (`bot.py`) | Yours Wallet + MetaNet support; BSV ordinal tier verification |

## What Has Been Built

### `schema.sql` + `SCHEMA_REFERENCE.md` ✅
Full PostgreSQL schema (v0.2.0, dated 2026-04-23) covering all entities: profiles, user_roles, wallets, curator_tiers, artist_profiles, curator_profiles, collections, artwork, printify_products, print_orders, treasury_ledger, payouts, ordinal_claims, content_flags, platform_settings. All enums, constraints, and business rules encoded. Detailed reference doc in `SCHEMA_REFERENCE.md`. Six Supabase Storage buckets specified in `SETUP.md`.

### `printify_pipeline.py` ✅
Complete Python script that polls Supabase for artwork with `status = 'pending'`, downloads PNG from Supabase Storage, uploads to Printify image library, creates 3 product types with full variant sets, publishes to Printify shop, and writes results back to Supabase. All unknown values marked as `<<PLACEHOLDER>>` for easy credential substitution. Tutorial doc in `ASMR_Printify_Pipeline_Tutorial.docx`.

### `ordinal_prep.py` ✅
Pulls PNG from Supabase Storage, converts to high-quality JPEG via Pillow (targeting sub-400kb for inscription efficiency), writes JPEG back to Supabase with status `ordinal_ready`. Phase 1: files queued for inscription via Zoide. Phase 2: one function swap replaces Zoide handoff with direct proprietary minting API call — nothing else changes.

### Next.js Frontend (`web/`) ✅ scaffolded — awaiting credentials
Full Next.js App Router project with shadcn/ui. Substantial code already exists:
- **Auth flows:** Login, register (artist/collector/curator), multi-step onboarding form
- **Artist upload wizard** — complete 4-step flow (collection details → file upload → processing → confirmation). Drag-and-drop, client-side validation, Supabase Storage upload, artwork row creation, progress bar. File: `web/src/app/dashboard/collections/upload/page.tsx`
- **Dashboard pages:** Collections list, individual collection view, earnings overview, ordinals tracker, curator page, profile
- **Public pages:** Splash/home, artist profile `/@slug`, browse gallery, about
- **Admin panel:** Stub at `web/src/app/admin/`
- **API routes:** Printify webhook (HMAC verified, order fulfillment TODOs), Shopify webhook, MNEE distribute (admin-only, groups pending claims by BSV address), wallet generate, wallet save-address, mint/inscribe, leaderboard, Stripe Connect, collection create
- **Components:** Hero carousel, sale ticker, artist cards, artwork grid, Printify print modal, Shopify shop modal, BSV wallet components, earnings overview, dashboard sidebar
- **Lib integrations:** Supabase (browser + server), BSV HD wallet + **in-house 1Sat Ordinals minter** (`lib/bsv/inscribe.ts` — complete), MNEE treasury, Printify webhook verification, Stripe Connect. (`lib/zoide/` is dead code — will be removed.)

### Shop App (`shop/`) ✅ scaffolded
Separate Vite + React app functioning as a standalone storefront component. Cart drawer, product cards, site header/footer. Intended to embed into the main platform as the print-buying experience.

### Ordinal Rainbows Vol.1 (ordinalrainbows.com) ✅
Full gallery with carousel, search, sort, rarity tiers. Wallet connection UI (Yours Wallet, MetaNet, HandCash). Flip-card modals with MNEE reward display. Printify iframe integration. Mobile-optimized. MNEE revenue-share payout system in development.

### `bot.py` — Discord Gating Bot ⚠️
BSV Ordinals wallet verification for Discord channel gating. Supports Yours Wallet and MetaNet. Rarity tiers: Legendary (1–2), Epic (3–5), Rare (6–10), Common (11+). Privacy-first: signatures never persist server-side. Weekly re-verification. GitHub Pages for web verification interface. Deployed but still not fully working — needs a development plan. Also needs a welcome bot and a moderator bot that acts on flagged words.

### Capstone Proposal Document ✅
Full formatted `.docx` exported and submitted. Covers: problem statement, solution architecture, target audience, key features, tech stack, proof-of-concept evidence, phased timeline, curriculum concepts applied, long-term vision.

## Decided Architecture Choices

| Decision | Choice | Rationale |
|---|---|---|
| Storefront | Shopify + Printify integration | Shopify is the customer-facing store; Printify fulfils orders. OR Vol.1 needs to be updated to match. |
| Print products per artwork | 3: canvas, art print, photo print | Variants auto-generated; one centralized ASMR shop |
| Minting | In-house BSV minter — **NOW, not Phase 2** | `lib/bsv/inscribe.ts` is complete. Builds 1Sat Ordinal envelope scripts, signs, broadcasts via `@bsv/sdk`. Zoide is dropped. Needs `PLATFORM_FUNDING_WIF` env var + funded platform wallet. `ordinal_prep.py` Zoide section to be removed. |
| Payout currency | MNEE stablecoin | Prints sold in USD; stablecoin preserves value regardless of BSV price |
| Payment processor | Stripe | Stripe Connect Express for artist/curator fiat payouts (`lib/stripe/connect.ts` complete). Future: explore Stripe as fiat on-ramp for ordinal purchases — research task, not a capstone blocker. |
| Revenue split | **70 / 25 / 5** | Artist 70% always. Holder pool 25% — curator rev share carved from here (Emerging 5%, Gallery 8%, Institution 10%). No curator = holders get full 25%. Platform 5%. Always sums to 100%. |
| Artist model | Talent agency | ASMR as agent, not DIY toolkit |
| Database | Supabase | PostgreSQL + Storage; schema v0.2.0 |
| Deployment | Vercel via GitHub | Edit locally → push → Vercel auto-deploys |

## BSV SDK — Hard-Won Lessons (Do Not Relearn These)

- `PrivateKey.fromWif` — **case-sensitive**. `fromWIF` fails silently.
- `@bsv/sdk` requires **full source transaction hex** per UTXO (fetched from WhatsOnChain) for proper SPV signing. Partial tx breaks broadcast.
- WhatsOnChain UTXO endpoint is `/unspent/all`, returning `{ result: [...] }` — not `/unspent`.
- TAAL ARC requires API key passed as `process.env.TAAL_API_KEY` — not optional even on mainnet.
- BSV payouts must target `bsvAddress`, not `ordAddress`.
- Supabase RLS INSERT policies must be explicitly set — default deny will silently block writes.

## Open Problems

1. **Credentials / env vars not filled** — The entire pipeline is built but nothing can run until `.env.local` is populated: Supabase URL + service key, Printify API key + shop ID, blueprint/provider IDs from catalog API, Zoide API key, MNEE treasury WIF, TAAL API key. This is the single biggest gate. See `SETUP.md` and `Printify Pipeline — Status & Notes.md` for the complete checklist.
2. **Printify webhook → MNEE bridge (TODOs not yet wired)** — The Printify webhook route exists and verifies HMAC signatures, but the order fulfillment handler contains TODO stubs. Need to: look up artwork → resolve BSV addresses → calculate split → call `distributeMnee()` → update Supabase. The MNEE distribute API route is ~80% complete; needs the treasury WIF and end-to-end test.
3. **In-house minter needs a funded platform wallet** — `lib/bsv/inscribe.ts` is complete and integrated into `/api/mint/inscribe`. What's missing: generate a dedicated BSV platform wallet, fund it with enough BSV to cover inscription fees (~500–2000 sats per piece), and add `PLATFORM_FUNDING_WIF` to `.env.local`. Also: remove the dead Zoide section from `ordinal_prep.py` and update its `minting_target` metadata to `"in-house"`.
4. **Artist portal frontend wiring** — The upload wizard UI is complete (`/dashboard/collections/upload/`). What's missing: the server-side trigger that fires `printify_pipeline.py` and `ordinal_prep.py` after an upload completes. Currently the wizard writes [TRUNCATED — needs reconstruction]

5. **Public collection page does not exist** — There is no `/c/[slug]` route in `web/`. Collectors cannot land on a per-collection page to view pieces, connect a wallet, or claim rewards. OR Vol.1's standalone `index.html` is the functional reference, but its styling is being thrown out and its data model (`reward_allocations` table, hardcoded Printify modal, single-file vanilla JS) does not match the current ASMRtists schema or stack. **Spec written 2026-04-28**: see `Collection Page Spec.md` and `Collection Page - Claude Code Prompts.md` in this folder.

6. **No "connect existing wallet" component** — `web/src/components/wallet/wallet-connect.tsx` is misnamed; it is a wallet *generator* for new users. There is no component that connects to existing Yours / HandCash / RelayX / 1SatOrdinals wallets. OR Vol.1's `js/bsv-wallet-sdk.js` has a working `BSVWalletSDKManager` covering all five wallet types — needs porting to TypeScript at `lib/wallet/connectors.ts`.

7. **Per-holder claim flow is unbuilt** — `/api/mnee/distribute` is admin-batch only (groups all pending claims, requires admin role). There is no per-holder, per-inscription claim API. OR Vol.1's `api/claim.js` and `api/payout.js` have the working pattern (re-verify ownership via GorillaPool → check `reward_allocations` → send BSV directly via `@bsv/sdk` → mark sent). Port plan documented in spec.

8. **Schema gap: `reward_allocations` table missing, `collections.slug` column missing** — Schema v0.2.0 has `ordinal_claims` (post-claim ledger only) but no per-inscription accrual table. Migration v0.3.0 drafted in spec; needs to land before any claim flow can be built.

9. **Pre-minted collection import is a one-time script, not a feature** — OR Vol.1's 64 inscriptions exist on chain (Zoide collection `ee4ae45304c28d0fa6_0`); the standard upload-and-mint flow can't be used for it (would create duplicate inscriptions). Solution for June 6: one-time `scripts/import_or_vol1.py` that registers pre-minted artwork rows from a manifest, skipping the mint stage. **Post-MVP gap:** any future artist arriving with pre-existing on-chain work needs an artist-facing import wizard at `/dashboard/collections/import` parallel to the upload flow. Required before non-Chef artists with pre-existing collections can join. Spec'd in Prompt 7.5 of Collection Page prompts.

## Session Log

### 2026-04-28 — Collection page architecture (locked)
- Audited OR Vol.1 (2080-line `index.html`, 9 JS files, 5 Vercel API routes) against ASMRtists `web/` (Next.js 16, App Router, shadcn/ui, MNEE SDK, in-house BSV minter).
- Confirmed: OR Vol.1's *wallet auth + claim/payout patterns* are the keepers; styling and data model are not.
- Decided: handoff to Claude Code in VS Code rather than build inline. 12+ files touch, schema migration, real-wallet browser testing required. 9-prompt sequence written.

**Architectural decisions (Chef, 2026-04-28):**
1. **Treasury wallet** — reuse OR Vol.1's `1r1rJXu5znptbcSKYuFW74eDZ3zJtsAwb` / `TREASURY_PAY_PK`. Already funded, already proven. One funded address handles all claim payouts for MVP.
2. **BSV21 OR token** — live on-chain (14 holders), but stub on the collection page for MVP. Future use case: curator voting weight on platform decisions. No claim mechanism wired yet.
3. **Wallet challenge signing** — required, both layers. Two-call protocol: GET nonce → wallet signs → POST claim with signature. Server verifies signature via `@bsv/sdk` BSM module AND re-checks GorillaPool ownership before paying out. One extra wallet popup; meaningful security gain.
4. **Claim payout** — instant, synchronous. API broadcasts BSV tx and returns txid in response body. No queue, no polling.
5. **URL pattern** — subdomain-based, double-nested: `<collection>.<artist>.shop.asmrtists.ca` → `ordinalrainbows.chefmyklove.shop.asmrtists.ca`. Phased: Phase 1 path-based at `asmrtists.ca/c/{username}/{collection}`, Phase 2 layers `middleware.ts` over top to rewrite subdomains. Phase 2 requires Vercel Pro ($20/mo) for nested wildcard cert provisioning.

**Schema migration v0.3.0 drafted:**
- `collections` gains `slug TEXT NOT NULL`, `UNIQUE (artist_id, slug)` (NOT globally unique). Slugs strip non-alphanumerics — no hyphens — to keep them subdomain-friendly.
- New `reward_allocations` table (per-artwork accrual ledger; mirrors OR Vol.1 pattern).
- New `claim_challenges` table (5-min TTL nonces for signed-challenge protocol).

**Deliverables (this folder):**
- `Collection Page Spec.md` — full architecture, gap analysis, schema DDL, file checklist, definition of done, URL routing phased plan.
- `Collection Page - Claude Code Prompts.md` — 9 self-contained prompts for VS Code Claude Code (Prompts 1-8 = Phase 1 path-based; Prompt 9 = Phase 2 subdomain rewriter, run after Phase 1 is proven).

**Next session:** Chef opens VS Code, runs Prompt 0 to load context, then Prompt 1 to land the schema migration. Decisions are locked — no further architecture discussion needed before code starts.