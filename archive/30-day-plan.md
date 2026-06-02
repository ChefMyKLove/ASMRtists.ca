---
type: plan
project: A.S.M.R / ASMRprints.com
created: 2026-04-24
deadline: 2026-06-06
author: ChefMyKLove
---

# 30-Day Sprint Plan
**April 25 → May 24, 2026**
Leaves ~2 weeks for integration testing, polish, and submission prep before the June 6 deadline.

---

## The Shape of the Work

The code is further along than the open problems list suggested. The upload wizard is built. The schema is built. The Python pipelines are built. The API routes are scaffolded. **The entire project is gated on credentials and wiring — not on writing new features from scratch.**

The 30 days break into four phases:

---

## Week 1: Credential Sprint + Pipeline Validation
**April 25–May 1**

The gate. Nothing runs until this week is complete.

- [ ] **Generate + fund the platform BSV wallet** — run `generateWallet()` from `lib/bsv/wallet.ts`, save mnemonic offline, add WIF as `PLATFORM_FUNDING_WIF` in `.env.local`, send ~50K sats to fund inscription fees
- [ ] Audit all OR Vol.1 wallets — confirm WIFs accessible for Michael's 4 wallets + Soma's 1 wallet
- [ ] Fill all credentials in `web/.env.local` — Supabase URL/keys, Printify API key + shop ID, MNEE treasury WIF, TAAL API key, Stripe keys, `CRON_SECRET` (see `SETUP.md`)
- [ ] Fill placeholders in `scripts/printify_pipeline.py`; clean Zoide section from `ordinal_prep.py` (dead code — in-house minter handles inscription now)
- [ ] Run `schema.sql` (v0.2.0) in Supabase SQL Editor — verify all tables created cleanly
- [ ] Create all 6 Supabase Storage buckets per `SETUP.md` spec, apply RLS policies
- [ ] Run Printify catalog API calls to get canvas, poster, photo blueprint IDs + provider IDs; connect Printify to Shopify
- [ ] Test `printify_pipeline.py` end-to-end using one OR Vol.1 piece as dummy data
- [ ] Test `ordinal_prep.py` → JPEG in Supabase; then hit `/api/mint/inscribe` → confirm BSV txid on-chain
- [ ] Confirm Supabase auth: register test user, verify `profiles` + `user_roles` rows created

---

## Week 2: Wire the Pipes + Capstone Feedback
**May 2–May 9 (feedback arrives ~May 12)**

Take what validated in Week 1 and connect the frontend to the backend.

- [ ] Build the server-side trigger: after artwork rows are written by the upload wizard, queue/fire `printify_pipeline.py` and `ordinal_prep.py` (cron, edge function, or server action — decide and commit)
- [ ] Fill TODO stubs in `/api/webhooks/printify/route.ts`: on `order:fulfilled` → look up artwork → resolve artist BSV address → calculate revenue split → call `distributeMnee()` → write `ordinal_claims` rows
- [ ] Test MNEE distribute route end-to-end: POST to `/api/mnee/distribute` as admin, confirm claim rows created and marked `processing`
- [ ] Make the **Stripe for ordinals** research decision — is Stripe fiat on-ramp for ordinal purchases viable for capstone scope, or post-launch? Document outcome in Overview.
- [ ] Confirm Shopify store URL + embed settings for `ShopModal` component
- [ ] Receive + review May 12 capstone feedback

---

## Week 3: Respond to Feedback + Critical Missing Features
**May 10–May 16**

Incorporate any capstone feedback, fill the two missing flows that block artist registration.

- [ ] Act on May 12 capstone feedback — triage, prioritize, execute
- [ ] Draft **Artist Terms of Service** — cover: revenue split (70% artist / up to 25% holder pool with curator share carved from it / 5% platform), IP licensing grant to ASMR, agent authority, payout timeline, exclusivity clauses, ordinal inscription consent
- [ ] Build **Terms acceptance flow** — checkbox + timestamp on artist registration; store acceptance in `user_roles` granted_at field or a separate `terms_acceptances` table
- [ ] Build out **Admin dashboard** at `/admin/`: payout queue (pending treasury_ledger rows), manual payout trigger button (calls `/api/mnee/distribute`), order history table
- [ ] Wire curator tier seat payment (Stripe or BSV — per decision from Week 2)

---

## Week 4: Integration Test + Secondary Work
**May 17–May 24**

End-to-end smoke test of the full artist journey. Fix what breaks.

- [ ] **Full artist journey test:** register artist → upload collection → pipeline fires → products appear in Printify shop → in-house minter inscribes ordinal on BSV → collection page live
- [ ] **Full collector journey test:** browse gallery → buy print → Printify webhook fires → treasury rows created → admin triggers payout → MNEE sent
- [ ] Write the **Unit Test Plan** document for capstone submission (what's tested, tools, coverage approach — even if tests aren't all written yet)
- [ ] Discord bot: write a development plan for getting `bot.py` working; scope welcome bot and word-based moderator
- [ ] Brand audit: identify what branding decisions are still unmade; block time with Michael to resolve
- [ ] Update OR Vol.1 (ordinalrainbows.com) to use the same Shopify modal as the capstone

---

## Remaining Sprint (May 25–June 6): Polish + Submission
Not part of the 30-day window but already visible from here:

- Final QA pass
- Populate OR Vol.1 as the featured proof-of-concept collection inside the capstone platform
- Capstone submission package
- Begin Pitch Day prep (presentation materials, demo flow script)

---

## Open Problems Deferred Past June 6

These are real problems but explicitly not capstone blockers:

- sCrypt smart contract enforcement — future evolution
- Stripe fiat on-ramp for ordinal purchases — research task, post-capstone
- Discord bot (nice-to-have for capstone; required for post-launch community)
- Marketing campaign — post-launch
- Vol.2 harvest — well after launch
- Multi-chain bridge (BTC Ordinals) — Q2 2027 target

---

## Milestone Summary

| Date | Milestone |
|---|---|
| May 1 | Credentials filled; platform wallet funded; pipeline + in-house minter tested on-chain |
| May 9 | Upload wizard wired to pipeline; Printify webhook TODOs filled |
| ~May 12 | Capstone feedback received |
| May 16 | Terms drafted; artist registration flow complete; admin dashboard functional |
| May 24 | End-to-end artist + collector journey tested; unit test plan written |
| June 6 | **Deadline — built project submitted** |
| July 16 | Pitch Day |
