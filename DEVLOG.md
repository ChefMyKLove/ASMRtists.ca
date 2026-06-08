# Development Log — ASMRtists

**Student:** Michael Needham (ChefMyKLove)
**Project:** ASMRtists — Artist Portfolio & Print Commerce Platform
**Program:** Full-Stack Software Development — Circuit Stream / UBC Continuing Education
**Capstone Period:** May–June 2026

---

## Overview

ASMRtists is a platform for visual artists and the people who collect their work. Artists upload a collection of images. The platform publishes those works to a print-on-demand storefront and mints a BSV 1Sat Ordinal for each one — one token per artwork, available to mint, hold, buy, or sell.

Anyone can buy a print. No wallet, no crypto, just a print. But if you hold the ordinal for a piece, you earn a share of every print that sells from it. That's the part that changes the dynamic. People who own a piece of an artist's work have a reason to tell other people about it. Word of mouth with upside.

Artists, collectors, and curators each have their own portal. Curators build themed collections across multiple artists and sit on the council that vets incoming work before it goes live.

This log covers what was built, what's in active development, and what's roadmap.

---

## Phase 1 — Architecture & Design

Architecture was locked in before any frontend work began. Three distinct user types with meaningfully different permission sets and flows meant the data model had to be explicit from the start.

**Artists** create collections, get published to both the print store and the ordinals layer simultaneously, and eventually appear on a ranked artist leaderboard. **Collectors** operate in two modes — print buyers who never touch a wallet, and ordinal holders who authenticate via Yours Wallet extension or generate a new BSV wallet on signup. **Curators** are the most structurally complex: three tiers (free, pro, enterprise), the ability to build themed multi-artist portals, and a gatekeeper function — submitted artist collections go through a founder-selected curator council for vetting before going live. NSFW and officially recognized offensive content doesn't make it through. Long-term, council membership and platform governance will be managed via a BSV21 token (governance token design is roadmap; nothing in code yet).

The biggest early infrastructure call: **one centralized Shopify store** with tag-based per-artist collections instead of per-artist stores. O(n) operational overhead versus O(1). Per-artist branding is preserved via tags and custom domains — you just don't pay for it in complexity. Printify handles fulfillment only; Shopify owns the storefront.

RLS was on in Supabase from day one. The `profiles` table ended up renamed from `artist_profiles` mid-build when dynamic routes at `/c/[username]/[collection]` needed a single source of truth for usernames. Renaming a table after you've already written frontend queries against it forced a two-query helper pattern that wouldn't have been necessary with better upfront naming. Noted for next time.

---

## Phase 2 — Core Pipeline Development

Scripts before UI. The Printify pipeline (`printify_pipeline.py`) handles collection ingestion, product creation, and sync. When the storefront architecture shifted to Shopify, about 80% of it survived — the main change was swapping the publish target via the `sales_channels` parameter. The modular structure paid off.

The BSV integration was harder. The `@bsv/sdk` documentation is sparse in places and wrong in others. Things that cost real time:

`PrivateKey.fromWif` — not `fromWIF`. Case-sensitive. Three hours of silent failures before that was caught. The kind of bug that makes you question everything before you question the one letter that's actually wrong.

WhatsOnChain UTXO endpoint: `/unspent/all` returning `{ result: [...] }`. Not `/unspent`. Not prominently documented — found through trial and error against the API.

TAAL ARC needs an API key as an environment variable. Omit it and you get a 403 with no explanation. Not "invalid key" — just a flat rejection. Had to trace through request headers manually to find what was missing.

BSV payouts go to `bsvAddress`, not `ordAddress`. Makes sense in retrospect. Not obvious until you've sent a payout to the wrong address type and nothing arrives.

Supabase RLS silent failures deserve their own mention. Missing INSERT policies don't throw. They just do nothing. Added an explicit RLS policy checklist to the setup process after losing time to this.

The in-house ordinal minting platform is fully built and currently in active wiring and testing. This replaced an earlier plan to use a third-party minting service — having the minting layer proprietary closes the one external dependency that would have mattered most at scale.

**Milestone:** Ordinal Rainbows Vol. 1 — a pre-ASMRtists collection that served as the proof of concept for the core idea: art pieces with on-chain ordinal ownership tied to print commerce. The architecture worked. ASMRtists is the platform built around it.

---

## Phase 3 — Frontend Build

Next.js 16 App Router, TypeScript, Tailwind. The primary frontend deliverable was the public collection page at `/c/[username]/[collection]`, deployed via GitHub → Vercel. Artist portfolio pages are built and structured to support the social and leaderboard layer when that ships. The landing page has a hero carousel.

The collector portal is functional for wallet authentication and ordinal interactions. The gamified leaderboard, referral tracking, and social features are designed and roadmapped — not yet built.

The App Router's server/client component boundary caused the most refactoring work. Several components were built mixing server-side data fetching with client-side interactivity — which the router doesn't support. The error messages when you get this wrong are not always helpful. You learn quickly to think about the boundary before writing the component, not after.

Vercel's build environment caught a few environment variable issues that didn't surface locally. All credential references now use `<<PLACEHOLDER>>` convention as a forcing function — if a build succeeds with placeholders in place, the variable handling is correct.

Deploy workflow is VSCode → GitHub → Vercel, strictly. No Cloud Shell editing. Every change goes through version control.

---

## Phase 4 — Integration, Testing & Deployment

End-to-end flow: artist uploads collection → Printify products created → synced to Shopify → buyer purchases print → revenue split fires on net revenue after production costs (Artist 70% / Ordinal holders 15% / Curators 10% / Platform 5%). Getting that chain working without manual intervention at any step was the integration goal.

Unit testing is focused on the pipeline scripts and key API utility functions. The blockchain layer has the most coverage — a bug in a broadcast transaction costs real money.

Three product types per artwork — canvas, art print, photo print. Three live domains. Placeholder artwork is in place; the pipeline is running.

**What's still in progress or roadmap:**

- Artist portal admin dashboard — frontend scaffolded, full functionality in progress
- Collector leaderboard, referral system, social layer — designed, not yet built
- Discord community gating bot — partially built, Fly.io deployment deferred
- Curator governance via BSV21 token — long-term roadmap, not in code
- Artist opt-in licensing agreement for recursive ordinal use — needs drafting; this governs whether an artist's ordinals can be incorporated into other projects (games, generative art, etc.), which generates additional on-chain income for holders via BSV21 tokens
- Getting this to market will require a funding raise — that's the next phase after capstone delivery

---

## Risks & Mitigations

Printify rate limits are the most likely operational friction point at scale — the pipeline has batching and retry logic, and artist onboarding will be staged rather than bulk-processed.

BSV fees are low and stable relative to other chains, but artists shouldn't have to care about crypto volatility. MNEE stablecoin handles all payouts — artists see a dollar amount.

Vercel cold starts on serverless functions are real at low traffic. Mitigation is edge caching where possible and keeping compute-heavy work in the Python pipeline layer rather than API routes.

RLS misconfiguration is now process-controlled — every new Supabase table goes through an explicit policy checklist before any frontend code touches it. Burned once; that's enough.

---

## Key Learnings

Blockchain integrations don't forgive sloppiness the way web APIs do. A 500 from a REST endpoint is recoverable. A broadcast transaction to the wrong address type is not. Test environments and defensive programming matter more here, not less.

The App Router is genuinely good once you internalize the server/client boundary as a first-class design constraint rather than a framework gotcha. The cost of learning it wrong first is real refactoring time.

Python as a pipeline layer alongside Node.js is the right call for this kind of project. Forcing the data processing work into TypeScript API routes would have been worse in every dimension.

Building a real product under capstone constraints forces scope discipline that purely academic projects don't. The pressure to cut cleanly and document what was cut — and why — produced a clearer architecture than unlimited time probably would have.

---

## Repository

**GitHub:** https://github.com/ChefMyKLove/ASMRtists.ca

**Live URLs:**
- https://ASMRtists.ca (platform)
- https://ASMRprints.com (commerce storefront)
- https://ordinalrainbows.com (live proof-of-concept)
