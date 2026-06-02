---
type: note
project: A.S.M.R
author: ChefMyKLove
---

# Principles Found — A.S.M.R

These caused real lost time. Treat them as load-bearing facts.

## BSV SDK

- `PrivateKey.fromWif` is **case-sensitive**. `fromWIF` fails silently — no error, wrong result.
- `@bsv/sdk` requires the **full source transaction hex** per UTXO, fetched from WhatsOnChain. Partial tx breaks SPV signing and broadcast.
- WhatsOnChain UTXO endpoint is `/unspent/all`, returning `{ result: [...] }`. Not `/unspent`. Not a flat array.
- TAAL ARC requires API key as `process.env.TAAL_API_KEY` in every broadcast request. It is not optional, even on mainnet.
- BSV payouts must target `bsvAddress`. Targeting `ordAddress` silently routes wrong.

## Supabase

- RLS INSERT policies must be **explicitly granted**. Default is deny. Writes will silently fail with no error unless the policy is set.
- The service role key bypasses RLS. Use it only server-side. Never expose it to the client.
- Storage bucket access is separate from table RLS — set policies on both.

## Printify

- Blueprint IDs and print provider IDs are not guessable — run the catalog API calls first (`/catalog/blueprints.json`, then `/catalog/blueprints/{id}/print_providers.json`).
- The Printify webhook signature uses HMAC-SHA256 over the raw body. Parse JSON only after verifying the signature. The `x-pfy-signature` header is the source.

## Next.js App Router

- Read `node_modules/next/dist/docs/` before assuming APIs match training data. Breaking changes exist.
- Server components cannot use hooks. Client components (`'use client'`) cannot use server-only imports like the Supabase service role client.
- The Supabase browser client and server client are different. Import from `@/lib/supabase/client` in client components, `@/lib/supabase/server` in server components and API routes.
