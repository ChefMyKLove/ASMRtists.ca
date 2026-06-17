# ASMRtists.ca — Dev Log

---

## Week of June 10–17, 2026

### June 10 — BSV Auth & Ordinals Page Foundation

Started wiring up the ordinals page in earnest. The main work was in `lib/bsv/auth.ts` — building out the BSV wallet authentication layer that the ordinals flow depends on. Also began the ordinals client UI and data layer (`ordinals/page.tsx`, `ordinals-client.tsx`), setting up the structure for mintable items, listings, and collector-owned ordinals.

---

### June 11 — Splash Page Polish

Minor but important: tweaked the splash/home page layout and layering. Added visual layers to improve the hero composition. Style pass across the splash.

---

### June 13 — Artist Upload Flow + Full Admin Panel

**Big day.** Multiple interconnected systems landed:

**Artist upload flow** — Fixed a broken upload flow for artists submitting collections. Wired up `actions/ordinals.ts` with the mint/listing/purchase server actions, and added the BSV price API route (`/api/bsv-price`) to support MNEE-to-BSV price display in the UI.

**Admin panel** — Built the full admin panel from scratch (`/admin`):
- Pending Approvals tab (approve/reject artist and curator role applications)
- Collections Queue tab (review collections submitted for approval)
- Content Flags tab (moderate reported artwork)
- Treasury tab (view MNEE balance, trigger distributions)

**Admin RLS fix** — The Collections Queue wasn't loading because the client-side Supabase calls were hitting Row Level Security. Moved those queries to server actions (`actions/collections.ts`) using the admin client to bypass RLS correctly.

**Dashboard redirect fix** — Admin users were getting force-redirected to `/admin` even when they wanted to view their artist dashboard. Removed the bad guard from middleware; admins now land in the artist view like everyone else.

**Redirect loop fix** — A faulty admin guard in middleware was causing redirect loops. Cleaned up the middleware logic so the admin layout handles its own auth check independently.

---

### June 16 — Yours Wallet Integration Overhaul

Replaced the deprecated Yours Wallet connector flow. Major rework of `wallet-connector.tsx` and `lib/wallet/connectors.ts` (300+ lines changed). Updated the home page to reflect the new wallet connection pattern. Added `providers.tsx` for wallet context and wired it into the root layout. Also added the `featured-carousel.tsx` component to the splash page — cycles through active collections with cover images in the hero.

---

### June 17 — Ordinals Flow Cleanup + Browse Bug Fixes

**Ordinals listing/purchase flow** — Cleaned up the full buy/sell/cancel flow on the ordinals page. Added a migration (`004_ordinal_listings_drift_columns.sql`) to align the `ordinal_listings` table with columns the app had drifted to expecting. Added a `/api/ordinals/revalidate` route to purge cached ordinal data after state changes.

**Browse page — missing artist bug** — Discovered that approving a collection via the admin Collections Queue was only setting `collections.status = 'active'` but never activating the artist's `artist_profiles` record. The browse page filters on `artist_profiles.status = 'active'`, so approved artists were invisible. Fixed `adminApproveCollectionAction` to also activate the artist profile. Also ran a one-time SQL backfill to fix already-approved artists.

**Browse page heading** — "Browse Collections" button on the home page linked to `/browse` which was titled "Browse Artists" — confusing. Renamed the page heading to "Browse" to reflect that it shows artists and their collections.

**Page-level caching** — Added `export const revalidate = 300` to all public-facing server component pages (home, browse, ordinals, artist pages, collection pages, collector/curator profiles). The `about` page gets 3600 seconds. This reduces Supabase egress on deployed builds by serving cached HTML instead of hitting the DB on every request.

---
