---
type: problems
date: 2026-04-02
project: A.S.M.R
author: claude
---

## Goal
Provide a novel and innovative way for artists to monetize their work using BSV blockchain distributed ledger tech — while onboarding new users to the BSV ecosystem — with the eventual goal of selling the platform.

## Why
This project fulfils all of Michael's creative blocks at once: it's a creative expression that earns a living, while helping other artists earn a living and showcase their creativity. It's personal, purposeful, and scalable.

## Tangible Outcomes
- A live splash platform (ASMRtists.ca) with login portals for creators, collectors, curators, investors and admins
- An innovative "latest pieces" carousel/marketplace for collectors to browse art and artists on the splash page
- Artist onboarding portal: profile creation, collection management (up to 64 pieces per collection)
- Automated integration with a Printify shop (canvas, poster, card prints) — organized per collection
- PNG-to-JPEG conversion pipeline feeding a 1Sat Ordinals collection produced with in-house minter
- Collection page linking 1Sat Ordinals metadata to print sales via Printify API modals
- Working MNEE reward and payout system for token holders (on-chain activity + print sales)
- Ordinal Rainbows Vol.1 live as proof-of-concept featured collection
- System is secure, live on web and chain, and fully integrated

## Open Problems
1. **Credentials not filled** — Every pipeline and API route is built but nothing can run until `.env.local` is populated. Supabase URL/keys, Printify API key + shop ID, blueprint/provider IDs, MNEE treasury WIF, TAAL API key, Zoide API key. This is the single biggest gate. See `SETUP.md`.
2. **Printify webhook → MNEE bridge** — The webhook route exists and is HMAC-verified. The order fulfillment handler has TODO stubs. Need to: look up artwork → resolve BSV addresses → calculate revenue split → call `distributeMnee()` → write ordinal_claims rows.
3. **Upload-to-pipeline trigger** — The artist upload wizard is complete. What's missing: the server-side trigger (edge function, cron, or queue) that fires `printify_pipeline.py` and `ordinal_prep.py` after artwork rows are created.
4. **Artist onboarding terms** — Draft needed before signup opens: revenue split, IP licensing, agent authority, payout terms, exclusivity clauses.
5. **Terms acceptance flow** — No UI built yet. Checkbox + timestamp on artist registration; required before registrations open.
6. **Admin dashboard** — Stub only. Needs: payout queue (pending treasury rows), manual payout trigger, order history.
7. **Stripe Connect decision** — The codebase has a `/api/stripe/connect/` route. Unclear if this was decided or is exploratory. Confirm: is Stripe for curator seat fiat payments only, or something else?
8. **Discord bot** — Deployed but not working. Needs a development plan. Scope welcome bot and word-based moderator bot alongside it.
9. **MNEE payout bridge (print sales)** — Full automation of Printify print sale → MNEE payout to ordinal holders is unsolved at business logic level. `ordinal_claims` table and distribute route exist; the missing link is the webhook writing claim rows correctly.
10. **Brand aesthetic** — No final branding in place. Needed before public launch and Pitch Day.
11. **Marketing campaign** — Campaign to attract first artists. Initial free tier or revenue share sweetener for early adopters.
12. **OR Vol.1 Shopify modal** — ordinalrainbows.com needs to use the same shop modal as the capstone platform.
13. **Unit test plan** — Must be documented for capstone submission. What to test, tools, coverage threshold.
14. **Zoide API contact** — Confirm whether batch/API minting is available. Until then, `ordinal_prep.py` outputs JPEG URL for manual inscription.
