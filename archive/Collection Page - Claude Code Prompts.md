---
type: handoff
date: 2026-04-28
project: ASMRtists
author: ChefMyKLove
companion: Collection Page Spec.md
---

# Collection Page — Claude Code Prompt Sequence

**Why handoff and not build inline:** 12+ files to create/edit across `web/`, schema migration that needs `psql` against Railway/Supabase, wallet connectors that only work when Chef tests with real Yours/HandCash extensions in a browser. Cowork mode can write the files, but VS Code + Claude Code can run `npm run dev`, hit `supabase db push`, lint, type-check, and tail the Next.js dev server output as the build progresses. That feedback loop matters here.

**Decisions locked in (2026-04-28):**
1. **Treasury wallet** — reuse OR Vol.1's `1r1rJXu5znptbcSKYuFW74eDZ3zJtsAwb`, env var `TREASURY_PAY_PK`.
2. **BSV21 OR token** — stub for MVP. Token is live on-chain (14 holders) but no claim wiring yet. Future use: curator voting weight.
3. **Wallet challenge signing** — required. Two-call protocol: GET nonce → wallet signs → POST claim with signature. Server verifies signature AND re-checks GorillaPool ownership.
4. **Claim payout** — instant, synchronous. Claim API broadcasts BSV tx and returns txid in response body.
5. **URL routing** — phased. Phase 1 (this build): path-based `asmrtists.ca/c/{username}/{collection}`. Phase 2 (after): subdomain rewriter → `{collection}.{username}.shop.asmrtists.ca`. The internal route file is the same in both phases.

---

## Prompt 0 — Context loader (paste once at session start)

```
Read these in order:
- C:\Users\micha\Desktop\ChefVault\02 Projects\ASMRtists\ASMRtists - Project Overview.md
- C:\Users\micha\Desktop\ChefVault\02 Projects\ASMRtists\Collection Page Spec.md
- C:\Users\micha\Desktop\ChefVault\02 Projects\ASMRtists\SCHEMA_REFERENCE.md
- web/package.json
- web/src/app/(public)/artists/[slug]/page.tsx (the closest analog to what we're building)
- web/src/lib/mnee/treasury.ts
- web/src/lib/bsv/inscribe.ts (existing in-house minter)
- C:\Users\micha\ordinalrainbowsproject\ORDINALRAINBOWS-Vol.1\api\payout.js (we are porting this)
- C:\Users\micha\ordinalrainbowsproject\ORDINALRAINBOWS-Vol.1\api\claim.js (we are porting this)
- C:\Users\micha\ordinalrainbowsproject\ORDINALRAINBOWS-Vol.1\js\bsv-wallet-sdk.js (we are porting this)

Then confirm you understand:
1. We are building a public collection page at web/src/app/(public)/c/[username]/[collection]/page.tsx
2. OR Vol.1's wallet auth + claim/payout patterns are being ported to TypeScript
3. Schema migration v0.3.0 adds reward_allocations table, collections.slug column, and UNIQUE(artist_id, slug)
4. The page shows the collection unauth, lets the artist deep-link to /dashboard, and lets a holder connect a real BSV wallet to see + claim MNEE/BSV balances (BSV21 OR token claim is stubbed for MVP)
5. Claim flow uses a two-call signed-challenge protocol: client requests nonce, wallet signs it, claim request submits signature alongside ownership data. Server verifies signature AND re-checks GorillaPool ownership before paying out.
6. Treasury wallet is reused from OR Vol.1: address 1r1rJXu5znptbcSKYuFW74eDZ3zJtsAwb, env var TREASURY_PAY_PK. The same WIF Chef has been using.
7. Phase 2 subdomain rewriter is deferred to a separate prompt — Phase 1 ships at path-based URL.

Do not write code yet. Reply with a one-paragraph confirmation of the plan.
```

---

## Prompt 1 — Schema migration v0.3.0

```
Create schema-migrations/v0.3.0-collections-slug-and-allocations.sql.

Requirements:
- Add column `slug TEXT NOT NULL DEFAULT 'untitled'` to public.collections.
- Backfill stripping non-alphanumerics (no hyphens — Chef wants subdomain-friendly slugs):
    UPDATE public.collections
    SET slug = lower(regexp_replace(title, '[^a-zA-Z0-9]+', '', 'g'))
    WHERE slug = 'untitled';
- Add UNIQUE constraint per artist (NOT globally unique — two artists can both have a collection slugged 'vol1'):
    ALTER TABLE public.collections ADD CONSTRAINT collections_artist_slug_unique UNIQUE (artist_id, slug);
- Create public.reward_allocations per spec (id, artwork_id FK ON DELETE CASCADE, inscription_outpoint TEXT UNIQUE NOT NULL, mnee_claimable NUMERIC(16,6) NOT NULL DEFAULT 0, bsv_claimable NUMERIC(16,8) NOT NULL DEFAULT 0, bsv21_claimable NUMERIC(16,8) NOT NULL DEFAULT 0, total_earned_usd NUMERIC(10,2) NOT NULL DEFAULT 0, rarity TEXT, rarity_multiplier NUMERIC(4,2) DEFAULT 1.0, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()).
- Create public.claim_challenges (id UUID PK, ord_address TEXT NOT NULL, nonce TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()). Index on (ord_address, expires_at).
- Add RLS: reward_allocations — SELECT public, UPDATE/INSERT service role only. claim_challenges — service role only (no public read).
- Append the new tables to schema.sql in the correct section ordering. Bump schema version comment to v0.3.0.
- Update SCHEMA_REFERENCE.md with: the new tables, the slug column, the per-artist uniqueness rule, and a worked example for "Chef's OR Vol.1": INSERT INTO collections (artist_id, slug, title) VALUES (<chef-id>, 'ordinalrainbows', 'Ordinal Rainbows Vol. 1').

After writing, output the SQL and ask me to confirm before running `supabase db push` (or whatever command Railway uses).
```

---

## Prompt 2 — Public collection route (read-only, no wallet)

```
Build web/src/app/(public)/c/[username]/[collection]/page.tsx and collection-page-client.tsx.

The page is a server component that:
- Awaits params: { username, collection } (where 'collection' is the slug).
- Two-step Supabase lookup (cannot do single nested join because we filter on artist.username):
  Step 1: from('artist_profiles').select('id, display_name, username, avatar_url, bio, user_id').eq('username', username).eq('is_active', true).single() — notFound() if missing.
  Step 2: from('collections').select('id, slug, title, description, cover_image_url, status, artworks (id, position, title, description, thumbnail_url, jpeg_storage_path, inscription_txid, inscription_outpoint, ordinal_metadata)').eq('artist_id', artist.id).eq('slug', collection).eq('status', 'active').single() — notFound() if missing.
- Calls supabase.auth.getUser(); computes isOwningArtist = user?.id === artist.user_id.
- Renders <CollectionPageClient collection={{ ...collection, artist }} isOwningArtist={isOwningArtist} />.

The client component renders:
- Banner using collection.cover_image_url with a gradient fade like artist-page-client does.
- Header with title, description, artist credit (avatar + display_name → /artists/[username]).
- A "Manage this collection" button visible only when isOwningArtist, routes to /dashboard/collections/[id].
- A grid of ArtworkCard components — one per artwork. Use the existing <ArtworkGrid> if it works; otherwise build collection/collection-grid.tsx and collection/artwork-card.tsx.
- The card front shows thumbnail, title, position. Back (on click) shows description, inscription_outpoint with copy-to-clipboard, "Buy print" button that opens the existing ShopModal with shopUrl=`https://asmrprints.com/product/${artwork.shopify_handle}?embed=1`.
- Stub the Connect Wallet button top-right (does nothing yet — Prompt 3 wires it).

Do NOT add wallet logic yet. Do NOT add claim panel yet.

Generate Metadata via generateMetadata using collection.title and description (must accept the same params shape).

Match the visual style of (public)/artists/[slug]/artist-page-client.tsx — same Tailwind palette, same shadcn primitives.

After writing, run `npm run typecheck` and `npm run lint`. Insert a test collection: INSERT INTO public.collections (artist_id, slug, title, description, cover_image_url, status) VALUES ((SELECT id FROM artist_profiles WHERE username = 'chefmyklove'), 'ordinalrainbows', 'Ordinal Rainbows Vol. 1', 'Live, on-chain digital photography. 64 originals minted as 1Sat Ordinals on BSV.', '<some-url>', 'active'); so I can hit /c/chefmyklove/ordinalrainbows in dev.
```

---

## Prompt 3 — Wallet connector (existing-wallet connect, not generator)

```
Two parts:

Part A — rename existing component:
- Rename web/src/components/wallet/wallet-connect.tsx → wallet-generator.tsx.
- Update the export name from WalletConnect to WalletGenerator.
- Find all usages with grep -r "WalletConnect" web/src and update imports.

Part B — port BSV Wallet SDK Manager from OR Vol.1 to TypeScript:
- Read C:\Users\micha\ordinalrainbowsproject\ORDINALRAINBOWS-Vol.1\js\bsv-wallet-sdk.js carefully (lines 1-340 are the core; there is a Yours, Babbage, HandCash, RelayX, 1SatOrdinals connector pattern).
- Port to web/src/lib/wallet/connectors.ts as a typed module:

  export type WalletType = 'yours' | 'handcash' | 'relayx' | '1sat' | 'metanet'
  export type WalletConnection = { type: WalletType; bsvAddress: string; ordAddress: string }
  export async function detectAvailableWallets(): Promise<WalletType[]>
  export async function connectWallet(type: WalletType): Promise<WalletConnection>
  export async function signMessage(type: WalletType, message: string): Promise<string>
  export function disconnectWallet(): void

- Persist connection to localStorage under key 'asmr-wallet-session'. Never persist signatures.
- Build web/src/components/wallet/wallet-connector.tsx — a button + modal. Detects available wallets on mount; shows them as clickable list; calls connectWallet on click; emits onConnected(WalletConnection) prop.
- Use shadcn Dialog + Button + a small icon per wallet (Lucide icons or unicode emoji is fine).

After writing:
- Run npm run typecheck.
- Mount <WalletConnector /> on the collection page (replace the stub from Prompt 2).
- Test that Yours Wallet detection works in a browser with the extension installed. Stop here and report results before continuing to Prompt 4.
```

---

## Prompt 4 — Owned-ordinal detection

```
Build web/src/lib/bsv/ordinals.ts with:

  export type OwnedOrdinal = { inscriptionId: string; outpoint: string; ordAddress: string }
  export async function fetchUserOrdinals(ordAddress: string): Promise<OwnedOrdinal[]>

The implementation calls GorillaPool: `https://ordinals.gorillapool.io/api/txos/address/${ordAddress}/unspent?bsv20=false&limit=100`. Parse response; filter to entries with `origin.outpoint` set. Return one OwnedOrdinal per inscription, deduplicated by outpoint.

Reference (do not blindly copy — port to TS):
- C:\Users\micha\ordinalrainbowsproject\ORDINALRAINBOWS-Vol.1\js\rewards-integration.js around line 2148 (`fetchUserOrdinals`).

In collection-page-client.tsx:
- When wallet connects (onConnected), call fetchUserOrdinals(connection.ordAddress).
- Cross-reference returned outpoints against this collection's artwork.inscription_outpoint values.
- Mark matched cards with a "Owned by you" badge (Badge component from shadcn).

No claim flow yet — just visual highlighting. Run typecheck. Test with a wallet that holds at least one OR Vol.1 inscription.
```

---

## Prompt 5 — Balance lookup API + claim panel UI

```
Two pieces:

Part A — API route web/src/app/api/claim/balance/route.ts (GET):
- Accepts ?inscriptionOutpoint=... (single) or comma-separated outpoints=...
- Reads from public.reward_allocations.
- Returns { balances: [{ outpoint, mnee_claimable, bsv_claimable, bsv21_claimable }] }
- No auth required (claimable balances are not sensitive — they're outpoint-scoped, anyone seeing the outpoint can already query the chain).

Part B — web/src/components/collection/holder-claim-panel.tsx:
- Sheet (right-side drawer using shadcn Sheet primitive). Trigger button is already in the connected wallet UI.
- Header: "Your Rewards from {collection.title}" + connected address.
- Body: list of OwnedOrdinal items. For each, show thumbnail (look up from collection.artworks), MNEE pending, BSV pending. Sum totals at top.
- Footer: "Claim All" button (disabled if all totals are zero). Stub the click handler — Prompt 6 wires it.
- Empty state: "You don't hold any pieces from this collection. Browse other collections."

Wire the panel into collection-page-client.tsx. When wallet connects + ordinals are detected + balances are fetched, the panel becomes openable.

Test: insert a manual reward_allocations row with mnee_claimable=10.00, bsv_claimable=0.0001 for one of OR Vol.1's outpoints. Connect a wallet that owns it. Open the panel. Verify the numbers render.
```

---

## Prompt 6 — Signed-challenge claim flow + payout port

```
This prompt is the riskiest in the sequence — real money moves. Take it slow. Do not skip the test plan.

FOUR parts:

Part A — port BSV payout to web/src/lib/bsv/payout.ts:
- Read C:\Users\micha\ordinalrainbowsproject\ORDINALRAINBOWS-Vol.1\api\payout.js fully.
- Port sendBSVToAddress to TypeScript. Use @bsv/sdk imports (PrivateKey, Transaction, P2PKH, ARC) — same ones that lib/bsv/inscribe.ts uses.
- KEEP the txid extraction logic verbatim (string-or-result.txid-or-result.id-or-result.data.txid fallback). This is hard-won.
- KEEP the WhatsOnChain `/unspent/all` endpoint and the full source-tx fetch loop.
- env var: TREASURY_PAY_PK (reusing OR Vol.1's existing wallet — same WIF Chef has been using). Treasury address is hardcoded to '1r1rJXu5znptbcSKYuFW74eDZ3zJtsAwb' for now.

Part B — port ownership re-verification to web/src/lib/bsv/ownership.ts:
- export async function verifyOrdinalOwnership(inscriptionId: string, expectedOrdAddress: string): Promise<boolean>
- Calls https://ordinals.gorillapool.io/api/inscriptions/<inscriptionId>_0, checks `owner` matches expectedOrdAddress (case-insensitive). Returns boolean.

Part C — challenge endpoint + signature verification:

C.1 — web/src/app/api/claim/challenge/route.ts (POST):
- Body: { ordAddress: string }
- Generate 32 random bytes (crypto.randomBytes(32).toString('hex')).
- Build challenge string: `asmr-claim:${nonce}:${Date.now()}`
- INSERT into claim_challenges with expires_at = NOW() + 5 minutes.
- Returns { challenge, expiresAt }.

C.2 — web/src/lib/wallet/challenge.ts:
- export async function verifyChallengeSignature(ordAddress: string, challenge: string, signature: string): Promise<boolean>
- Look up the challenge row by (ord_address, challenge nonce). Reject if not found, expired, or already used.
- Verify signature using @bsv/sdk's BSM (Bitcoin Signed Message) module:
    import { BSM, BigNumber } from '@bsv/sdk'
    const isValid = BSM.verify(challenge, signature, ordAddress)
- On success, mark the row used_at = NOW(). Return true.
- On any failure, return false. Do NOT throw — let the caller decide what to do.

Part D — claim API route web/src/app/api/claim/route.ts (POST):
- Body: { inscriptionOutpoints: string[]; bsvAddress: string; ordAddress: string; challenge: string; signature: string; collectionId: string }
- Step 1: verifyChallengeSignature(ordAddress, challenge, signature) — return 401 'Invalid or expired challenge' if false.
- For each outpoint:
  2. Extract inscriptionId from outpoint (split ':')
  3. verifyOrdinalOwnership(inscriptionId, ordAddress) — return 403 'Ownership mismatch' if false.
  4. Look up reward_allocations row by inscription_outpoint.
  5. Apply duplicate-claim guard (port from OR Vol.1 claim.js lines 30-47).
  6. Mark allocation as 'processing' (add a status column or use a transient lock — service-role-only).
  7. If mnee_claimable > 0: call distributeMnee([{ address: bsvAddress, amount: mnee_claimable }]) from lib/mnee/treasury.ts. Capture ticketId.
  8. If bsv_claimable > 0: call sendBSVToAddress(bsvAddress, satoshisFromBsv(bsv_claimable)). Capture txid.
  9. BSV21 OR token: STUB. Add a TODO comment and continue. Do not fail. The token is live on-chain (14 holders) but no claim mechanism is wired yet.
  10. Insert ordinal_claims row with status='paid', payout_txid=bsvTxid, notes=`mnee:${mneeTicketId}`.
  11. Zero out reward_allocations.mnee_claimable and bsv_claimable.
- Returns { results: [{ outpoint, mneeTicketId?, bsvTxid?, bsv21Status: 'deferred', error? }] }.

Wire the panel's "Claim All" button:
1. Call POST /api/claim/challenge with ordAddress → get { challenge }.
2. Call signMessage(walletType, challenge) → get signature (ONE wallet popup).
3. Call POST /api/claim with all the above + outpoints.
4. Show toast notifications per result via sonner. Display txids as links to whatsonchain.com/tx/{txid}.
5. Refetch balances 2s after success.

Test plan (mandatory):
- Seed reward_allocations for one inscription Chef holds, with small amounts: mnee_claimable=0.10, bsv_claimable=0.0001 (10000 sats).
- In dev: connect a real wallet that holds this inscription.
- Click Claim All. Verify wallet popup asks for signature.
- After signing: verify response contains both bsvTxid and mneeTicketId.
- Verify BSV arrives in the connected wallet (check WhatsOnChain).
- Verify MNEE arrives.
- Verify reward_allocations row has both claimable fields zeroed.
- Verify ordinal_claims row exists with status='paid' and payout_txid populated.
- Re-click Claim All — verify duplicate-claim guard blocks with 'nothing to claim'.
- Bonus: try with a wallet that does NOT own the inscription — verify 403 ownership mismatch.
- Bonus: try with a stale challenge (wait 6 minutes) — verify 401 invalid/expired.

If ANY of the above fails, do NOT mark this prompt complete. Stop and report exactly what failed.
```

---

## Prompt 7 — Polish + edge cases

```
Address these in one pass:

1. Empty states:
   - Collection has zero artworks → render "This collection is being prepared."
   - Wallet connects but owns nothing in this collection → panel says so kindly.
   - Wallet connects, owns pieces, but all balances are zero → panel shows pieces with "$0 — no rewards yet" per piece.

2. Loading states:
   - Skeleton on initial Supabase fetch.
   - Spinner inside the Connect Wallet modal during handshake.
   - Spinner on Claim All while transactions broadcast.

3. Error states:
   - Wallet handshake fails → modal shows error + "Try a different wallet" link.
   - GorillaPool 5xx → "Couldn't reach the ordinals indexer. Try again." (Don't block the page render; just disable claim until it succeeds.)
   - Claim API returns ownership mismatch → toast: "It looks like you no longer hold this ordinal. Reconnect and try again."

4. Mobile:
   - Sheet on mobile renders as bottom drawer (shadcn Sheet supports this with side="bottom" or just leave default — verify visually).
   - Card grid: 2 cols mobile, 3 cols sm, 4 cols md+.

5. SEO:
   - generateMetadata pulls collection.title + description.
   - OG image: collection.cover_image_url. Falls back to a default ASMRtists OG.

After this pass, run npm run build (full production build) and confirm no TypeScript or lint errors.
```

---

## Prompt 7.5 — Import script for pre-minted collections (OR Vol.1 dogfood prep)

```
Context: OR Vol.1's 64 inscriptions already exist on chain (collection ID ee4ae45304c28d0fa6_0,
minted via Zoide). We must NOT run the standard upload-and-mint flow for them — that would
create duplicate inscriptions with no provenance link. Instead, build a one-time import
script that registers the existing inscriptions as ASMRtists artwork rows.

Build scripts/import_or_vol1.py (Python, mirrors the style of printify_pipeline.py and ordinal_prep.py).

Inputs:
- Local image folder: C:\Users\micha\ordinalrainbowsproject\ORDINALRAINBOWS-Vol.1\images\
- Collection ID: ee4ae45304c28d0fa6_0 (Zoide collection)
- Artist username: chefmyklove
- Collection slug: ordinalrainbows
- Collection title: "Ordinal Rainbows Vol. 1"
- Manifest mapping: filename → on-chain inscription txid + outpoint

Build the manifest by querying GorillaPool's collection endpoint:
  GET https://ordinals.gorillapool.io/api/inscriptions/search?map.subTypeData.collectionId=ee4ae45304c28d0fa6_0&limit=64
  (verify the exact endpoint shape — GorillaPool's API has shifted; if that 404s, try
  /api/collections/<id>/inscriptions or /api/txos/collection/<id>)
For each returned inscription, capture: txid, outpoint, ordinal_metadata (the on-chain
MAP/JSON), and the original filename if available in the metadata.

If filename mapping isn't preserved on chain, fall back to manual mapping: hash each local
JPG (sha256) and compare against a hash-of-inscription-content fetched via GorillaPool's
content endpoint. If hashes don't match (likely — on-chain is sub-400kb, local is full-res),
ask Chef to provide a manual filename→txid CSV. Document this fallback clearly.

For each piece (in collection order, position 1-64):
1. Upload local JPG to Supabase Storage at: artwork-originals/{artist_id}/{collection_id}/{position}.jpg
2. Generate thumbnail (Pillow, 600px max dimension), upload to artwork-thumbnails bucket.
3. INSERT artwork row:
   - artist_id = (SELECT id FROM artist_profiles WHERE username = 'chefmyklove')
   - collection_id = (SELECT id FROM collections WHERE slug = 'ordinalrainbows' AND artist_id = ...)
   - position = i (1-64)
   - title = pull from on-chain metadata, fallback to filename
   - description = pull from rainbow lore doc if available; else empty
   - storage_path = the Supabase storage path
   - thumbnail_url = the thumbnail public URL
   - inscription_txid = from manifest
   - inscription_outpoint = from manifest
   - ordinal_metadata = from manifest (JSONB)
   - status = 'shop_pending' (skip 'uploaded'/'processing'/'minting' — already on chain)
4. INSERT reward_allocations row:
   - artwork_id = the artwork row's id
   - inscription_outpoint = same
   - mnee_claimable = 0 (or pull from OR Vol.1's existing reward_allocations if Chef can dump that)
   - bsv_claimable = 0 (same)
   - rarity = pull from on-chain metadata if present
   - rarity_multiplier = 1.0 default

Idempotent: re-running should not duplicate rows. Use ON CONFLICT (inscription_outpoint) DO NOTHING
or check existence first.

Do NOT call ordinal_prep.py. Do NOT call /api/mint/inscribe. The on-chain part is done.

After inserting all 64 artwork rows, the existing printify_pipeline.py will pick them up
on its next poll and create Printify products as normal. That part is unchanged.

Output: log every successful import + the count, and any skipped/failed entries with reasons.

Add a runbook entry to ASMRtists - Project Overview.md Open Problems noting:
"Pre-minted collection import is currently a one-time script. Becoming a first-class
artist-facing flow is a post-MVP feature — required before any other artist with
pre-existing on-chain work can join the platform."

Do NOT run the script automatically. Output the command and ask Chef to run it manually
once the manifest is verified.
```

---

## Prompt 8 — Onboard ChefMyKLove + OR Vol.1 (dogfood pass)

```
This is the dogfooding pass. Keep this conversational — Chef will be doing the clicking.

1. Walk Chef through the live signup flow at /get-started. Pick "Artist". Username: chefmyklove. Display name: Chef MyKLove.
2. Create the empty collection record directly via SQL (skip the upload wizard for this — OR Vol.1 is pre-minted, the standard upload path doesn't apply):
     INSERT INTO public.collections (artist_id, slug, title, description, cover_image_url, status)
     VALUES ((SELECT id FROM artist_profiles WHERE username = 'chefmyklove'),
             'ordinalrainbows',
             'Ordinal Rainbows Vol. 1',
             'Live, on-chain digital photography. 64 originals minted as 1Sat Ordinals on BSV. The proof-of-concept collection that started ASMRtists.',
             '<cover-image-url>',
             'draft');
3. Run scripts/import_or_vol1.py from Prompt 7.5. Verify all 64 artwork rows + reward_allocations rows are created. If any fail, stop and report.
4. Run the existing printify_pipeline.py against status='shop_pending' rows. Verify Printify products are created for all 64 (3 products each = 192 total). This step needs Printify API credentials — confirm with Chef before running.
5. Optional: seed reward_allocations with non-zero claimable balances for testing — pull from OR Vol.1's existing Supabase if Chef can dump that table; otherwise leave at zero and let real print sales accrue from here.
6. Set collection.status = 'active' once Printify products exist.
7. Visit /c/chefmyklove/ordinalrainbows in incognito. Confirm full public render — banner, all 64 cards, artist credit, working Buy Print buttons.
8. Connect a wallet that holds OR Vol.1 inscriptions (Chef has 4 such wallets). Confirm owned cards highlight, panel shows balances, claim works (wallet popup for signature → BSV arrives → balance zeros).
9. Switch to artist account in another browser. Confirm "Manage this collection" button routes to /dashboard/collections/[id].

Document what worked, what broke, and add anything broken to ASMRtists - Project Overview.md Open Problems.
```

---

## Prompt 9 — Phase 2: Subdomain rewriter (run AFTER Prompts 1–8 are proven working)

```
This is a Phase 2 prompt — only run after the path-based collection page is fully working
end-to-end (Prompt 8 dogfood pass complete).

Goal: serve the same collection page at the subdomain URL `<collection>.<artist>.shop.asmrtists.ca`
without changing any route or component code.

Build web/src/middleware.ts:

import { NextRequest, NextResponse } from 'next/server'

const ROOT_DOMAIN = 'asmrtists.ca'  // strip port in dev

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') || ''
  const hostname = host.split(':')[0]  // strip port

  // Match: <collection>.<artist>.shop.asmrtists.ca
  const match = hostname.match(/^([^.]+)\.([^.]+)\.shop\.asmrtists\.ca$/)
  if (match) {
    const [, collection, username] = match
    const url = req.nextUrl.clone()
    url.pathname = `/c/${username}/${collection}${url.pathname === '/' ? '' : url.pathname}`
    return NextResponse.rewrite(url)
  }

  // Match: <artist>.shop.asmrtists.ca → artist storefront index
  const artistMatch = hostname.match(/^([^.]+)\.shop\.asmrtists\.ca$/)
  if (artistMatch) {
    const [, username] = artistMatch
    const url = req.nextUrl.clone()
    url.pathname = `/artists/${username}${url.pathname === '/' ? '' : url.pathname}`
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}

DNS work (Chef does manually):
1. In Cloudflare (or wherever asmrtists.ca DNS lives): add CNAME `*.shop` → `cname.vercel-dns.com`.
2. In Vercel project settings: add `*.shop.asmrtists.ca` as a domain. Confirm SSL provisioning.
3. For the double-nested pattern `*.<artist>.shop.asmrtists.ca`: this requires Vercel Pro
   ($20/mo). On signup, the artist registration handler should call the Vercel Domains API:
   `await vercel.domains.add(\`*.${username}.shop.asmrtists.ca\`)`. SSL auto-provisions.
   For MVP test: manually add `*.chefmyklove.shop.asmrtists.ca` as a Vercel domain.

Test plan:
- Local: edit /etc/hosts (or Windows hosts file) to add a line:
    127.0.0.1 ordinalrainbows.chefmyklove.shop.asmrtists.local
  Run dev server. Visit http://ordinalrainbows.chefmyklove.shop.asmrtists.local:3000.
  Confirm collection page renders. (You'll need to relax ROOT_DOMAIN check for .local in dev.)
- Production: hit https://ordinalrainbows.chefmyklove.shop.asmrtists.ca. Confirm SSL valid.
  Confirm same content as path-based URL.

Update Project Overview with Phase 2 completion + Vercel Pro decision.
```

---

## Notes for Chef

- **Stop after each prompt** and verify before moving on. The spec assumes prompts run in order; out-of-order will paint into corners.
- **Don't skip Prompt 0** — Claude Code starts cold each time and re-deriving context burns budget.
- **If something fails in Prompt 6**, don't try to fix it inline — that's the riskiest prompt (real money moving). Report back, we'll triage.
- **Prompt 9 is Phase 2** — only run after Prompts 1–8 produce a working collection page at the path-based URL. The subdomain rewriter is purely a URL aesthetic layer; getting the claim flow right is the primary goal.
