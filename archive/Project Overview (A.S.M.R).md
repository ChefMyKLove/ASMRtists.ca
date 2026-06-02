---
type: status
date: 2026-06-01
project: A.S.M.R / ASMRtists.ca
author: ChefMyKLove
canonical: true
---

# Where We Are At (Current Project Status)

This is the canonical status document for the project.
Code is treated as source of truth when docs and code differ.

## Executive Summary

- Project state: core architecture is in place, with critical flows partially wired.
- Main blocker: environment/config completion and full end-to-end validation.
- Most important unfinished work: Printify fulfillment-to-payout bridge, pipeline automation verification, and submission-grade test evidence.

## Code-Verified Current Reality

### Implemented and present now

- Next.js app with role-oriented route groups exists under web/src/app.
- Public collection route exists and is operationally scaffolded:
	- web/src/app/(public)/c/[username]/[collection]/page.tsx
- Ordinal authentication and claim routes exist:
	- web/src/app/api/ordinals/challenge/route.ts
	- web/src/app/api/ordinals/claim/route.ts
- In-house inscription path exists:
	- web/src/lib/bsv/inscribe.ts
	- web/src/app/api/mint/inscribe/route.ts
- Wallet generation/derivation helpers exist:
	- web/src/lib/bsv/wallet.ts
- Admin page exists with functional tabs and moderation/approval patterns:
	- web/src/app/admin/page.tsx
- Supabase schema is versioned and documented:
	- schema.sql
	- schema-migrations/v0.3.0-collections-slug-and-allocations.sql
	- schema-migrations/v0.4.0-artwork-ordinal-price.sql
	- schema-migrations/v0.4.0-ordinal-claims.sql

### Implemented but incomplete

- Printify webhook signature verification is implemented, but fulfillment business logic is not complete:
	- web/src/app/api/webhooks/printify/route.ts
	- File contains TODO blocks for artwork lookup, address resolution, split calculation, treasury call, and persistence updates.

### Readiness that still needs confirmation

- Credential readiness in web/.env.local against web/.env.local.example.
- Live integration reliability for upload -> pipeline -> mint -> claim -> payout sequence.

## Full Markdown Audit: Docs vs Current Code

Legend:
- Current: aligned with code and useful as active reference.
- Partially Current: useful but contains timeline/history assumptions.
- Stale: superseded by newer architecture/state.
- Ignore: empty/non-substantive.

| File | Status | Why | Keep/Action |
|---|---|---|---|
| #project schema test.md | Partially Current | Good architecture sketch; not canonical planning doc | Keep as historical reference |
| 30-day-plan.md | Partially Current | Useful retrospective sprint plan; date-bound | Keep as historical reference |
| Agent Handoff Briefing.md | Current | Still useful implementation context and constraints | Keep active |
| ASMRtists - Project Overview.md | Partially Current | Product direction is useful; several sections are historical | Keep active as strategy reference |
| Collection Page - Claude Code Prompts.md | Current | Prompted execution history/spec guidance remains useful | Keep active |
| Collection Page Spec.md | Current | Spec aligns with implemented route and surrounding architecture | Keep active |
| Principles Found (A.S.M.R).md | Current | Engineering lessons are still relevant | Keep active |
| Printify Pipeline — Status & Notes.md | Current | Still relevant to pipeline state and TODOs | Keep active |
| Project Board (ASMRprints).excalidraw.md | Current | Planning artifact still useful | Keep active |
| Project Overview (A.S.M.R).md | Current | Canonical status doc | This file |
| RawNotes.md | Stale | Exploratory and superseded by structured docs | Keep archived; do not use as source of truth |
| SCHEMA_REFERENCE.md | Current | Strong schema reference aligned with schema.sql | Keep active |
| SETUP.md | Current | Required setup guide for environment readiness | Keep active |
| this-week.md | Partially Current | Historical execution checklist | Keep as historical reference |
| Untitled.md | Ignore | Empty | Leave or remove later |
| ordinalrainbows/BSV_WALLET_IMPLEMENTATION_COMPLETE.md | Stale | Legacy POC milestone details | Keep archived |
| ordinalrainbows/BSV_WALLET_SDK_INTEGRATION_GUIDE.md | Stale | Legacy POC integration guide | Keep archived |
| ordinalrainbows/HANDOFF_SECURITY_CRITICAL.md | Stale | Legacy handoff context from standalone phase | Keep archived |
| ordinalrainbows/README_REWARDS.md | Stale | Legacy rewards ops flow | Keep archived |
| ordinalrainbows/README.md | Stale | Legacy standalone repo readme | Keep archived |
| ordinalrainbows/TESTING-GUIDE.md | Stale | Legacy standalone testing path | Keep archived |
| web/AGENTS.md | Current | Tooling config doc | Keep active |
| web/CLAUDE.md | Current | Tooling/project instruction context | Keep active |
| web/README.md | Stale | Generic template readme, not project-specific status | Replace with project-specific readme in next docs pass |

## Goal Status (Derived from Docs + Code)

### Done or mostly done

- Core Next.js app skeleton with public/auth/dashboard/admin route architecture.
- Schema design and migration artifacts.
- BSV wallet utility layer.
- In-house inscription module and mint route.
- Challenge-sign flow and claim route structure.
- Collection page route path and server-side data assembly structure.

### In progress

- Printify order fulfillment automation into payout and claim accounting.
- Admin operational confidence for payout workflows.
- Credential and secret wiring validation across local/deploy environments.

### Not yet proven complete

- Fully reliable end-to-end pipeline under real credentials and real transactions.
- Submission-grade test evidence and explicit test plan outcomes.

## Remaining Steps to Achieve Project Goals

Priority 1: Environment and integration gate

1. Complete and verify all required env values in web/.env.local.
2. Confirm all external dependencies are reachable and valid: Supabase, Printify, Shopify, Stripe, treasury key material.
3. Run a full local smoke test of auth, collection page fetch path, and mint prerequisites.

Priority 2: Fulfillment-to-payout bridge

1. Implement TODOs in web/src/app/api/webhooks/printify/route.ts.
2. On fulfilled orders: resolve artwork and participants, compute split, persist rows, and trigger treasury distribution path.
3. Add robust idempotency checks for webhook retries.

Priority 3: Payout and claims reliability

1. Verify claim lifecycle transitions (pending -> processing -> paid/failed) with clear retry strategy.
2. Ensure duplicate claim prevention stays enforced in edge cases.
3. Validate admin visibility of payout state and failure handling.

Priority 4: End-to-end project proof

1. Artist flow test: upload -> pipeline -> mint update.
2. Collector flow test: ownership verification -> claim -> payout accounting.
3. Admin flow test: review queues -> trigger/retry payout -> verify ledger/claim state.

Priority 5: Submission readiness

1. Finalize and capture unit/integration test plan plus executed results.
2. Keep setup docs synchronized with actual deploy/run steps.
3. Keep this file updated as the single source of status truth.

## Documentation Governance

- Canonical status source: this file.
- Active operational docs: SETUP.md, SCHEMA_REFERENCE.md, Collection Page Spec.md, Agent Handoff Briefing.md, Principles Found (A.S.M.R).md, Printify Pipeline — Status & Notes.md.
- Historical references only: 30-day-plan.md, this-week.md, RawNotes.md, and Ordinal Rainbows legacy docs.

## Recommended Next Execution Order

1. Environment + secret validation pass.
2. Complete Printify webhook fulfillment business logic.
3. Run full end-to-end integration test pass with recorded outcomes.
4. Harden payout operations and failure/retry handling.
5. Update this file with test evidence and final completion checkpoints.
