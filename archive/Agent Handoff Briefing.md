# Agent Handoff Briefing — ASMRtists Collection Page Build

You're picking up a build that has already been spec'd in detail. Read this whole briefing before doing anything. Then read the two reference files at the bottom. Do not propose new architecture — the decisions are locked. Your job is to execute the prompt sequence.

## Who you're working with

Michael "Chef" Needham (myklove@gmail.com), Nanaimo BC. Thirty-year professional chef pivoting to BSV blockchain development due to injury. ASMRtists is his Circuit Stream capstone project. Built proposal already accepted; final build due **June 6, 2026**. He prefers a literary, grounded, campfire tone — never corporate polish, no "excited to share," no AI-sounding filler. Batch related tasks, don't do one-thing-at-a-time. Always confirm before deleting or sending anything.

## What we're building

ASMRtists.ca is a multi-tenant platform for artists to monetize work via BSV 1Sat Ordinals. Ordinal holders share in print sale revenue, paid out in MNEE stablecoin. Artists hand off — ASMR acts as their talent agent, not a DIY toolkit.

**This specific build:** the public collection page. The thing a collector lands on when they click into "Ordinal Rainbows Vol. 1" or any other collection. It must:

1. Show the collection unauthenticated (banner, story, 64-piece grid).
2. Let the owning artist deep-link to their dashboard's collection-specific area.
3. Let an ordinal holder connect a real BSV wallet (Yours / HandCash / RelayX / 1Sat / MetaNet), see their claimable balances per piece, and claim them via a signed-challenge protocol.

The proof-of-concept reference is **Ordinal Rainbows Vol. 1** — already live at ordinalrainbows.com with 63 BSV 1Sat Ordinals across 13 wallets (Zoide collection `ee4ae45304c28d0fa6_0`). Its wallet auth + claim/payout patterns are being ported. Its styling is being thrown out.

## Stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind 4, shadcn/ui
- **Backend:** Next.js API routes, Supabase SSR
- **Database:** Supabase (PostgreSQL), schema v0.2.0 → migrating to v0.3.0
- **Blockchain:** BSV 1Sat Ordinals via `@bsv/sdk` 2.0.13, in-house minter at `lib/bsv/inscribe.ts`
- **Stablecoin:** MNEE via `@mnee/ts-sdk`
- **Indexer:** GorillaPool ordinals API
- **Broadcast:** TAAL ARC
- **Hosting:** Vercel via GitHub
- **Repo location:** `C:\Users\micha\Desktop\ASMRtists.ca\` (web/ subdirectory is the Next.js app)

## Locked architectural decisions (do not relitigate)

1. **Public route:** internal Next.js path is `web/src/app/(public)/c/[username]/[collection]/page.tsx`. Phase 1 URL is path-based at `asmrtists.ca/c/chefmyklove/ordinalrainbows`. Phase 2 layers a `middleware.ts` that rewrites subdomain hits → `<collection>.<artist>.shop.asmrtists.ca`. Same route file in both phases. Phase 2 requires Vercel Pro for nested wildcard SSL — defer until Phase 1 is proven.

2. **Treasury wallet:** reuse OR Vol.1's existing wallet. Address `1r1rJXu5znptbcSKYuFW74eDZ3zJtsAwb`, env var `TREASURY_PAY_PK`. Already funded, already proven in production.

3. **BSV21 OR token:** live on-chain (14 holders) but stub on the collection page for MVP. Future use case is curator voting weight. Do not build BSV21 claim logic — log a TODO and continue.

4. **Wallet challenge signing:** required, both layers. Three-call protocol:
   - `POST /api/claim/challenge` → server returns nonce
   - Wallet signs nonce (one popup)
   - `POST /api/claim` with signature → server verifies via `@bsv/sdk` BSM module AND re-checks GorillaPool ownership before paying out

5. **Claim payout:** instant, synchronous. Claim API broadcasts the BSV tx and returns the txid in the response body. No queue, no polling.

6. **Collection slug rules:** `collections.slug` is unique PER ARTIST (`UNIQUE(artist_id, slug)`), NOT globally. Slugs strip all non-alphanumerics — no hyphens — to be subdomain-friendly. OR Vol.1's slug is `ordinalrainbows`.

7. **Schema migration v0.3.0:** adds `reward_allocations` table (per-artwork accrual ledger, separate from post-claim `ordinal_claims`), `collections.slug` column, `claim_challenges` table (nonce TTL 5 min).

8. **Pre-minted collection import:** OR Vol.1's 64 inscriptions exist on chain. The standard upload-and-mint flow MUST NOT be used for them (would create duplicate inscriptions). Build a one-time `scripts/import_or_vol1.py` that registers pre-minted artwork rows from a manifest, skipping the mint stage. The artist-facing import wizard is post-MVP and tracked as a separate gap.

## Hard-won BSV SDK lessons (do not relearn these)

- `PrivateKey.fromWif` is case-sensitive. `fromWIF` fails silently.
- `@bsv/sdk` requires the FULL source transaction hex per UTXO for proper SPV signing — fetch each from WhatsOnChain.
- WhatsOnChain UTXO endpoint is `/unspent/all` returning `{ result: [...] }`, not `/unspent`.
- TAAL ARC requires `process.env.TAAL_API_KEY` in the header, even on mainnet.
- BSV payouts target `bsvAddress`, never `ordAddress` — the two addresses differ.
- Supabase RLS INSERT policies must be explicitly set; default deny silently blocks writes.
- Robust txid extraction from broadcast result: try `string` → `result.txid` → `result.id` → `result.data.txid`. Never fall back to `JSON.stringify`.

## What's done

- Full audit of OR Vol.1 codebase (2080-line index.html, 9 JS files, 5 Vercel API routes) and the ASMRtists `web/` directory.
- Spec doc with gap analysis, schema DDL, component tree, signed-challenge protocol, file checklist, definition of done, URL routing phased plan.
- Nine-prompt sequence for execution. Each prompt is self-contained and includes test plans.
- Project Overview updated with locked decisions and new Open Problems.

## What you do next

1. Read the two reference files (paths below) in full.
2. Confirm understanding back to Chef in one paragraph.
3. Wait for him to say "go."
4. Run **Prompt 0** to load context.
5. Run **Prompt 1** (schema migration). Stop. Show the SQL. Wait for confirmation before applying.
6. Continue prompt-by-prompt, stopping after each one for verification.

## Rules of the road

- **Stop after every prompt.** The sequence is designed for verification gates. Skipping ahead paints into corners.
- **Prompt 6 is the riskiest** — real BSV moves. Do not skip its test plan. If anything fails, stop and report; do not try to fix inline.
- **Do not propose new architecture.** All five major decisions are locked. If you genuinely think one is wrong, raise it with Chef as a question — don't act on it.
- **Style:** literary, grounded, terse. No corporate polish. No emoji. No "excited to" language.

## Reference files (read these before acting)

- `C:\Users\micha\Desktop\ChefVault\02 Projects\ASMRtists\Collection Page Spec.md` — the full architectural spec
- `C:\Users\micha\Desktop\ChefVault\02 Projects\ASMRtists\Collection Page - Claude Code Prompts.md` — the 9-prompt execution sequence
- `C:\Users\micha\Desktop\ChefVault\02 Projects\ASMRtists\ASMRtists - Project Overview.md` — full project context, Open Problems list, decisions log
- `C:\Users\micha\Desktop\ChefVault\02 Projects\ASMRtists\SCHEMA_REFERENCE.md` — current schema documentation
- `C:\Users\micha\ordinalrainbowsproject\ORDINALRAINBOWS-Vol.1\` — the proof-of-concept being ported (read `index.html`, `js/bsv-wallet-sdk.js`, `js/rewards-integration.js`, `api/claim.js`, `api/payout.js`)

That's the briefing. Read the spec, then start with Prompt 0.
