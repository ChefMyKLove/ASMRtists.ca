# ASMRtists — Artist Portfolio & Print Commerce Platform

> **Art Splash Marketing Roster** — a platform for visual artists, print buyers, and the collectors who have a stake in both.

**Live platform:** https://ASMRtists.ca  
**Commerce storefront:** https://ASMRprints.com  
**Demo collection:** https://ordinalrainbows.com

---

## Project Overview

Artists upload a collection of images. ASMRtists publishes them to a print-on-demand storefront and mints a BSV 1Sat Ordinal for each artwork simultaneously — one token per piece.

Anyone can buy a print. No wallet required, no crypto knowledge needed. But if you hold the ordinal for a piece, you earn a share of every print that sells from it. Rewards accumulate as long as you hold. You can claim them, let them grow, or sell the ordinal on the secondary market. The more an artist's work sells, the more interesting it is to hold their tokens — which gives holders a real reason to promote the artists they believe in.

Three user types, three portals: artists who publish, collectors who buy prints or hold tokens, and curators who organize work into themed collections and vet incoming submissions before they go live.

---

## Repository Structure

```
ASMRtists.ca/
├── web/        # Next.js 16 app — main platform (ASMRtists.ca)
└── scripts/    # Python utilities — one-time data migration and backfill tools
```

---

## Features

**Live / In Active Development**
- Artist registration, profile management, and collection upload (up to 64 JPEGs per collection)
- Simultaneous publish to Shopify storefront and BSV ordinals minting on collection approval
- Proprietary in-house ordinal minting pipeline (fully built, in active testing)
- Automated Printify fulfillment — canvas print, art print, photo print per artwork
- Shopify storefront sync with tag-based per-artist collections
- Public collection pages at `/c/[username]/[collection]`
- BSV wallet authentication — Yours Wallet extension or new wallet generation on signup
- Revenue split automation via MNEE stablecoin on net revenue after production costs: Artist 70% / Ordinal holders 15% / Curators 10% / Platform 5%
- Curator content vetting council (founder-selected at launch)
- Ordinal Rainbows Vol. 1 — pre-platform proof of concept validating the core model: art on-chain, prints on demand

**Roadmap**
- Collector and artist leaderboards
- Referral system and social layer
- Discord community gating bot
- Artist opt-in licensing for recursive ordinal use in external projects (generates additional BSV21 token rewards for holders)
- Curator governance via BSV21 token (council elections, feature voting)
- Per-artist branded storefronts via Shopify Collaborator access

---

## Installation

### Prerequisites

- Node.js 18+
- A Supabase project (PostgreSQL)
- A Vercel account (for deployment)
- API keys: Printify, Shopify

### Local Setup

```bash
git clone https://github.com/ChefMyKLove/ASMRtists.ca.git
cd ASMRtists.ca/web
npm install
```

Copy the environment variable template and fill in your credentials:

```bash
cp ../.env.local.example .env.local
```

Required variables:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PRINTIFY_API_TOKEN=
PRINTIFY_BLUEPRINT_ID=
PRINTIFY_PRINT_PROVIDER_ID=
SHOPIFY_STORE_URL=
SHOPIFY_ACCESS_TOKEN=
SHOPIFY_WEBHOOK_SECRET=
PLATFORM_FUNDING_WIF=
PIPELINE_WEBHOOK_SECRET=
MNEE_API_KEY=
```

Optional:

```
TAAL_API_KEY=        # TAAL ARC broadcaster for BSV payouts (falls back to mainnet default)
NEXT_PUBLIC_SITE_URL=
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Usage

### Artist Flow
1. Register at `/register` and complete your artist profile
2. Upload a collection of JPEGs (max 64) via the Artist Portal
3. A curator approves the collection — the platform automatically publishes to Shopify and mints BSV ordinals (one per artwork)
4. Collectors can buy prints or hold ordinals; print sales generate rewards for holders

### Collector Flow
1. Browse the gallery at the platform homepage
2. Buy prints directly — no wallet required
3. Or: connect via Yours Wallet to mint and hold ordinals
4. Accumulate rewards as the artist's prints sell; hold, sell, or use ordinals in external projects

### Curator Flow
1. Sign up and complete a curator profile
2. Build themed portals across multiple artists' collections
3. Participate in the content vetting council to review and approve incoming artist submissions

### Print Buyer Flow
1. Visit [ASMRprints.com](https://ASMRprints.com)
2. Browse by artist or collection
3. Purchase — fulfilled automatically via Printify

---

## Technologies Used

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.4 (App Router, Turbopack) |
| Language | TypeScript 5 |
| UI | React 19, Tailwind CSS v4, shadcn/ui, Base UI, Lucide React, Sonner |
| Forms & Validation | react-hook-form, Zod |
| Data Fetching | TanStack React Query v5 |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Auth | Supabase Auth + BSV wallet login via @1sat/connect (Yours Wallet) |
| BSV SDK | @bsv/sdk v2, @1sat/actions, @1sat/client, @1sat/react |
| Minting Broadcaster | WhatsOnChainBroadcaster (inscriptions), TAAL ARC (payouts, optional) |
| Fulfillment | Printify API |
| Storefront | Shopify API |
| Payments / Payouts | MNEE stablecoin (@mnee/ts-sdk), Stripe |
| Hosting | Vercel (CI/CD + serverless runtime) |
| Migration tooling | Python (one-time data import and Shopify backfill scripts) |
| Version Control | GitHub |

---

## Next Steps

### Immediate
- Fund the platform BSV wallet and complete end-to-end minting test
- Connect artist BSV wallet addresses via Yours Wallet on signup
- Deploy `PLATFORM_FUNDING_WIF` and `PIPELINE_WEBHOOK_SECRET` to Vercel

### Near-term
- Collector and artist leaderboards with gamification layer
- Referral system and social features on artist portfolio pages
- Mobile optimization across all portals

### Infrastructure
- ASMRprints.com storefront — Cloudflare Worker proxy in front of Shopify (`shop/` — not yet built)
- Discord community gating bot (partially built; deployment pending)

### Platform Expansion
- Artist opt-in licensing agreement for recursive ordinal use in external projects
- BSV21 governance token for curator council elections and platform feature voting
- Per-artist branded storefronts via Shopify Collaborator access

---

## License

All rights reserved. This project is a capstone submission for Circuit Stream / UBC Continuing Education. Contact the author for licensing inquiries.
