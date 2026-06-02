# ASMRprints.com — Project Briefing

### Everything built, decided, and discussed · April 2026

> **For:** New collaborators, investors, or anyone needing to get up to speed fast. **Author:** ChefMyKLove.

---

## 1. What This Is

**ASMRprints.com** ("Art Splash Marketing Resource") is a multi-portal art marketing platform that connects visual artists, collectors, and blockchain enthusiasts through:

- BSV 1Sat Ordinal inscriptions (JPEGs on-chain)
- Physical print sales via Printify (print-on-demand)
- A gamified collector economy with a revenue-sharing incentive model

It is the **productized evolution of Ordinal Rainbows Vol. 1** — a live, working proof-of-concept already in production with real on-chain ordinals and real holders.

The platform is Michael Needham's (ChefMyKLove) Circuit Stream / UBC Continuing Education capstone project. It is explicitly designed to be **investor-ready and positioned for acquisition**.

**Core deadlines:**

- Capstone proposal: May 1, 2026 (feedback by May 12) ***update  proposal accepted
- Built project due: June 6, 2026
- "Pitch Day" presentation to industry professionals through cicuit stream course Jul 16

---

## 2. The Core Innovation

> **Ordinal holders share in print sale revenue.**

When a collector buys an ordinal (the JPEG inscribed on BSV), they become economically motivated to promote and sell physical prints of that artwork. The ordinal is not just a collectible — it's a revenue-sharing artifact. This turns the holder community into a natural sales force.

This is the central idea. Everything else is infrastructure to make it work at scale.

---

## 3. Platform Architecture — Three Portals

### Entry: Splash Page

- Interactive animation (skippable) at platform entry
- Sets brand tone: professional, playful, blockchain-native

### Portal 1 — Artists

- Register and create an account
- Upload high quality PNG files (min 281dpi 3000X3000px)— maximum **64 pieces per collection**
- Artwork is automatically stocked in the centralized ASMR Shopify store (3 product types: canvas print, art print/poster, photo print)
- PNG files are converted to JPEGs that are prepared and inscribed as BSV 1Sat Ordinals
- **ASMR acts as a talent agent, not a DIY toolkit** — artists hand off, ASMR handles the rest

### Portal 2 — Collectors
- Browse collections
- Mint ordinals using BSV wallet login
- Buy prints
- Gamified activity: leaderboard rankings + referral system (wallet holders only)
- Ordinal holders can see and claim print revenue payouts in MNEE (stablecoin)


###Portal 3--Curators
different tiers allow for differnt levels of curation within the site.  curators can curate different showrooms or galleries (say a real art gallerey wants to use ASMR to showcase some of their artists) can be a tier, artists or influences and then the general public.  this ties into a future social media aspect ,,,,, and also leaderboard stats, etc.  



### Portal 4 — Gallery / Marketplace / Leaderboard

- Featured artists
- Ranked collectors
- "Buy" triggers that prompt login if user is not authenticated
- Publicly browsable without login

---

## 4. Proof of Concept — Ordinal Rainbows Vol. 1

Already live and working at **ordinalrainbows.com** (deployed on Vercel).

- 63 BSV 1Sat Ordinals across 13 wallets
- 5 controlled wallets (4 Michael's, 1 belonging to Soma — Michael's son)
- Inscribed via ZoideNFT (collection ID: `ee4ae45304c28d0fa6_0`)
- One piece glitched during minting — being considered as a rarity/special edition (lean into accidents... still need to create that canon in the story... 
- MNEE stablecoin revenue-share payout system is **designed but not implemented and working.... bsv payouts are in testing**
- Printify shop is live

This collection is the demo client for the platform and provides the concrete evidence for the capstone proposal.

-- it needs to be amended to use the same shopify modal as the capstone..... add to problems-

## 5. Tech Stack

|Layer|Technology|Notes|
|---|---|---|
|Blockchain|BSV 1Sat Ordinals|`@bsv/sdk` for wallet/signing|
|Ordinal Minting|**Zoide NFT** (Phase 1)|Proprietary in-house minter planned for Phase 2|
|Broadcasting|TAAL ARC|Requires API key in header|
|UTXOs / Chain Data|WhatsOnChain|Endpoint: `/unspent/all` → `{ result: [...] }`|
|Stablecoin Payouts|MNEE|Chosen because prints are sold in USD; stablecoin prevents BSV price erosion|
|Print Fulfillment|Printify|**One centralized shop** (not per-artist shops); ASMR brand|
|Database / Storage|Supabase|Artwork table, pipeline results, ordinal status|
|Backend Scripts|Python|`printify_pipeline.py`, `ordinal_prep.py`|
|Frontend / Hosting|Vercel + GitHub|Current deploy workflow: VSCode → GitHub → Vercel|
|Discord Gating|Custom bot (`bot.py`)|Yours Wallet + MetaNet support; BSV ordinal tier verification|
|Knowledge Management|Obsidian Vault|Path: `C:\Users\micha\Documents\Claude\Projects\ASMRtists`|

---

## 6. What Has Been Built

### `printify_pipeline.py` ✅

Complete Python script that:

1. Polls Supabase for artwork with `status = 'pending'`
2. Downloads PNG from Supabase Storage
3. Uploads PNG to Printify image library
4. Creates 3 product types: canvas print, art print/poster, photo print (full variant sets)
5. Publishes products to the Printify shop
6. Writes results (product IDs, URLs) back to Supabase

All unknown values marked as `<<PLACEHOLDER: description>>` for easy credential substitution.

### `ordinal_prep.py` ✅

Script that:

1. Pulls PNG from Supabase Storage
2. Converts to high-quality JPEG via Pillow (targeting sub-400kb for inscription efficiency)
3. Writes JPEG back to Supabase Storage with status `ordinal_ready`
4. **Phase 1:** Files queued/delivered for inscription via Zoide
5. **Phase 2:** One function swap replaces Zoide handoff with direct proprietary minting API call — nothing else changes

### Ordinal Rainbows Vol. 1 (ordinalrainbows.com) ✅

- Full gallery with carousel, search, sort, rarity tiers
- Wallet connection UI (Yours Wallet, MetaNet, HandCash)
- Flip-card modals with MNEE reward display
- Printify iframe integration for ordering prints
- Mobile-optimized with static rainbow gradient text on mobile, animated on desktop
- MNEE revenue-share payout systemin development  mark as problem

### `bot.py` — Discord Gating Bot ✅

- BSV Ordinals wallet verification for Discord channel gating
- Supports Yours Wallet and MetaNet (not HandCash-dependent)
- Rarity tiers: Legendary (1–2 exist), Epic (3–5), Rare (6–10), Common (11+)
- Privacy-first: signatures never persist server-side
- Weekly re-verification
- GitHub Pages for the web verification interface
- still in development.  ws deployed but still not working....

### Capstone Proposal Document ✅

Full formatted `.docx` exported and ready for May 1 submission. Covers: problem statement, solution architecture, target audience, key features, tech stack, proof-of-concept evidence, phased timeline, curriculum concepts applied, long-term vision.

### Obsidian Vault ✅

Established at `C:\Users\micha\Documents\Claude\Projects\ASMRtists` with:

- `CLAUDE.md` at vault root
- `02 Projects/ASMRprints/Project Overview`
- `02 Projects/ASMRprints/Principles Found` (BSV SDK hard-won lessons)
- `02 Projects/ASMRprints/Development Log` (pre-populated through June 6 with weekly slots + test plan section)

we need a way to point this obsidian vaoult as the "brains of the operation" to that vault which handles this project specifically.  

---

## 7. Decided Architecture Choices

|Decision|Choice|Rationale|
|---|---|---|
|Printify shop structure|**One centralized shop**|ASMR brand, not per-artist; simpler to manage and present to investors|
|Payout currency|**MNEE stablecoin**|Prints sold in USD; stablecoin preserves value regardless of BSV price|
|Product types per artwork|**3:** canvas, art print, photo print|Covers the main print formats; variants auto-generated|
|Minting (Phase 1)|**Zoide NFT**|Fastest path to market; automation TBD|
|Minting (Phase 2)|**Proprietary in-house**|Full control; swap is isolated to one function in `ordinal_prep.py`|
|Artist model|**Talent agency**|ASMR as agent, not DIY toolkit|
|Database|**Supabase**|Storage + DB in one; RLS policies required (default is deny)|
|Deployment|**Vercel via GitHub**|Edit locally → push → deploy; no direct Cloud Shell editing|

---

## 8. BSV SDK — Hard-Won Lessons (Do Not Relearn These)

These caused real lost time and are documented formally in `Principles Found`:

- `PrivateKey.fromWif` — **case-sensitive**. `fromWIF` fails silently.
- `@bsv/sdk` requires **full source transaction hex** per UTXO (fetched from WhatsOnChain) for proper SPV signing. Partial tx breaks broadcast.
- WhatsOnChain UTXO endpoint is `/unspent/all`, returning `{ result: [...] }` — not `/unspent`.
- TAAL ARC requires API key passed as `process.env.TAAL_API_KEY` — not optional even on mainnet.
- BSV payouts must target `bsvAddress`, not `ordAddress`.
- Supabase RLS INSERT policies must be explicitly set — default deny will silently block writes.

---

## 9. Open Problems / What's Not Built Yet

|#|Problem|Status|
|---|---|---|
|1|Minting destination automation|✅ Decided: Zoide Phase 1 → proprietary Phase 2. **Open:** how far can the Zoide interface be automated from our platform?|
|2|Artist portal frontend|🔲 Not built — the upload trigger that kicks off both pipelines|
|3|Fill pipeline placeholders|🔲 Gather Supabase + Printify credentials; run catalog API calls for blueprint/provider IDs|
|4|Artist onboarding terms|🔲 Draft needed before signup goes live — revenue split, IP licensing, agent authority, payout terms, exclusivity clauses|
|5|Admin dashboard|🔲 MNEE transfer script UI and payout tracking|
|6|Per-artist portal clone architecture|🔲 How to isolate per-artist upload flows while sharing one backend/shop|
|7|Terms acceptance flow|🔲 Digital agreement UX and storage|
|8|Unit test plan|🔲 What to test; must be documented for capstone submission|
|9|sCrypt smart contract enforcement|🔲 Planned future evolution — royalty splits enforced on-chain once platform is complete|
|10|Obsidian vault amalgamation|🔲 Blocked by Cowork sync issues — existing A.S.M.R folder content not yet merged|

---

## 10. Planned Future Features

- **Card game** using the base 64 inscriptions as card art palette — planned as a minting mechanic for the collector portal... this is more part of spectral quest project.
- **Vol. 2 harvest** and generation.  this will occur much later..... once things have settled with asmr
- **Proprietary minting platform** — full in-house BSV ordinal minting environment is not a future option.  it is the way we are moving in this now
- **sCrypt smart contracts** — on-chain enforcement of royalty splits  which may be essential to deal with MNEE  

---

## 11. Build Order for the Coding Agent

When handing off to a coding agent, the established sequence is:

1. `schema.sql` — Supabase `artwork` table schema (verify column names match pipeline placeholders)
2. Fill placeholders in `printify_pipeline.py` and `ordinal_prep.py`
3. Artist upload frontend — the trigger that initiates both pipelines
4. Terms acceptance flow — required before artist signup
5. Admin dashboard — MNEE payout tracking UI

---

## 12. Working Style & Preferences

- **Single correct solution** — commit to one approach, never offer "alternatively" options
- **No manual steps in core flows** — automation is non-negotiable; manual workarounds are temporary only
- **Claude handles architecture, documentation, drafting** — a separate coding agent handles file edits and git commits
- **GitHub-first deployment** — edit in VSCode → commit/push → Vercel deploys from there
- Hard-won lessons are **formally documented** in `Principles Found` to avoid relearning
- Projects are positioned for **dual utility**: income-generating now + feeding the larger strategic vision

---

## 13. Key People & Relationships

| Person                       | Role                                                                       |
| ---------------------------- | -------------------------------------------------------------------------- |
| MichaelNeedham (ChefMyKLove) | Builder, artist, former professional chef turned full-stack developer      |
| Soma                         | Michael's son; holds Vol. 1 ordinals used as test cases for the claim flow |

---

_Last updated: April 2026 · Compiled from all project conversations_