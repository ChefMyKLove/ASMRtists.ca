# ASMRtists — Artist Portfolio & Print Commerce Platform

> **Art Splash Marketing Roster** — a full-stack platform connecting visual artists, print buyers, and collectors through portfolio management, automated print-on-demand fulfillment, and optional BSV blockchain provenance.

**Live platform:** https://ASMRtists.ca  
**Commerce storefront:** https://ASMRprints.com  
**Demo collection:** https://ordinalrainbows.com

---

## Project Overview

ASMRtists is a multi-portal web application built as a capstone project for the Circuit Stream / UBC Continuing Education Full-Stack Software Development program. It solves a real fragmentation problem for independent visual artists: portfolio, fulfillment, and collector engagement typically live on separate platforms with no connection between them.

The platform unifies these into three portals:

- **Artist Portal** — onboarding, portfolio management, collection upload, Printify and Shopify sync
- **Collector/Curator Portal** — artwork discovery, gamified leaderboard, referral system, wallet-based login
- **Gallery / Marketplace** — public-facing storefront with featured artists, ranked collectors, and purchase triggers

An optional blockchain layer mints BSV 1Sat Ordinals per artwork. Ordinal holders receive a perpetual revenue share on every print sold from that artwork — a verifiable, on-chain stake that never expires.

---

## Features

- Artist registration, profile management, and collection upload (up to 64 JPEGs per collection)
- Automated product creation via Printify API (canvas print, art print, photo print per artwork)
- Shopify storefront sync with tag-based per-artist collections
- Public collection pages at `/c/[username]/[collection]`
- BSV 1Sat Ordinal minting with TAAL ARC broadcast and WhatsOnChain UTXO resolution
- Wallet authentication for collector interactions (Yours Wallet, HandCash, RelayX)
- Gamified collector leaderboard and referral tracking
- Revenue split automation via MNEE stablecoin: Artist 70% / Ordinal holders 15% / Curators 10% / Platform 5%
- Live proof-of-concept: Ordinal Rainbows Vol. 1 (63 ordinals, 13 wallets)

---

## Repository Structure

```
ASMRtists.ca/
├── web/        # Next.js 16 app — main platform (ASMRtists.ca)
├── shop/       # Cloudflare Worker — Shopify storefront proxy (ASMRprints.com)
└── scripts/    # Python utilities — Printify pipeline, ordinal prep, Shopify sync
```

---

## Installation

### Prerequisites

- Node.js 18+
- A Supabase project (PostgreSQL)
- A Vercel account (for deployment)
- API keys: Printify, Shopify, TAAL

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
PRINTIFY_API_KEY=
SHOPIFY_STORE_URL=
SHOPIFY_ACCESS_TOKEN=
TAAL_API_KEY=
SHOPIFY_WEBHOOK_SECRET=
MNEE_API_KEY=
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
3. Products are automatically created in Printify and synced to the Shopify storefront
4. Optionally mint BSV 1Sat Ordinals for each artwork to enable collector revenue sharing

### Collector Flow
1. Browse the gallery at the platform homepage
2. Connect a BSV wallet to participate in the collector portal
3. Mint or acquire ordinals to earn a perpetual share of print revenue
4. Track your rank on the collector leaderboard

### Print Buyer Flow
1. Visit [ASMRprints.com](https://ASMRprints.com)
2. Browse by artist or collection
3. Purchase prints — fulfilled automatically via Printify

---

## Technologies Used

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, React, Tailwind CSS, shadcn/ui |
| Backend / API | Next.js API routes, Node.js |
| Database | Supabase (PostgreSQL), Row Level Security |
| Authentication | Supabase Auth + BSV wallet login |
| Fulfillment | Printify API |
| Storefront | Shopify API |
| Blockchain | BSV 1Sat Ordinals, `@bsv/sdk`, TAAL ARC, WhatsOnChain |
| Payouts | MNEE stablecoin |
| Scripting | Python (Printify pipeline, ordinal prep, Shopify sync) |
| Hosting | Vercel (CI/CD), Supabase Pro |
| Version Control | GitHub |

---

## Future Improvements

- Proprietary in-house ordinal minting platform (currently using Zoide NFT for launch)
- Artist portal frontend (admin dashboard for collection and payout management)
- Discord community gating bot (partially built; Fly.io deployment pending)
- Card game feature using Ordinal Rainbows Vol. 1 inscriptions as card art
- Per-artist branded storefronts via Shopify Collaborator access
- Unit and integration test suite expansion
- Self-hosted infrastructure migration (Supabase + Next.js) as a cost lever post-launch
- Mobile-responsive collector portal optimization

---

## License

All rights reserved. This project is a capstone submission for Circuit Stream / UBC Continuing Education. Contact the author for licensing inquiries.
