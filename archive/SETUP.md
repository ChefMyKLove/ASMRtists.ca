# ASMRtists.ca — Project Setup Guide

The Next.js app lives in the `web/` subdirectory.

---

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Copy your **Project URL** and **Anon Key** from Settings > API.
3. Copy your **Service Role Key** (keep this secret — server-side only).

---

## 2. Run the Database Schema

1. Open the **SQL Editor** in the Supabase dashboard.
2. Paste and run the contents of `schema.sql` (located in the project root).
3. Verify tables: `profiles`, `artworks`, `orders` are created.

---

## 3. Create Storage Buckets

In the Supabase dashboard, go to **Storage** and create these 6 buckets:

| Bucket name          | Public? | Purpose                                  |
|----------------------|---------|------------------------------------------|
| `artwork-originals`  | No      | Raw artist uploads (PNG, high-res)       |
| `artwork-jpegs`      | No      | Server-generated JPEG derivatives        |
| `artwork-thumbnails` | Yes     | Public-facing thumbnails for gallery     |
| `avatars`            | Yes     | User profile photos                      |
| `banners`            | Yes     | Artist/curator profile banners           |
| `curator-assets`     | Yes     | Curator-uploaded promotional assets      |

Set RLS policies:
- Private buckets: only the owning user's `auth.uid()` can read/write their own files.
- Public buckets: allow anonymous read, authenticated write.

---

## 4. Configure Environment Variables

```bash
cd web
cp .env.local.example .env.local
```

Open `.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL` — from Supabase Settings > API
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase Settings > API
- `SUPABASE_SERVICE_ROLE_KEY` — from Supabase Settings > API (keep secret)
- `PRINTIFY_API_KEY` — from Printify > Settings > API
- `PRINTIFY_SHOP_ID` — your Printify shop ID
- `PRINTIFY_WEBHOOK_SECRET` — set this when configuring webhooks in Printify
- `STRIPE_SECRET_KEY` — from Stripe Dashboard > Developers > API keys
- `STRIPE_PUBLISHABLE_KEY` — from Stripe Dashboard > Developers > API keys
- `STRIPE_WEBHOOK_SECRET` — from Stripe Dashboard > Webhooks > signing secret
- `MNEE_API_KEY` — from MNEE / 1Sat Ordinals API
- `MNEE_TREASURY_WIF` — WIF private key for the treasury BSV wallet (server-only!)
- `ZOIDE_API_KEY` — from Zoide inscription service
- `ZOIDE_API_URL` — Zoide API base URL
- `NEXT_PUBLIC_APP_URL` — `http://localhost:3000` for local, your domain in production

---

## 5. Install Dependencies

```bash
cd web
npm install
```

Or if you have Bun:
```bash
cd web
bun install
```

---

## 6. Start the Development Server

```bash
cd web
npm run dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 7. Printify Webhook Setup

1. In your Printify shop, go to Settings > Webhooks.
2. Add a webhook pointing to: `https://your-domain.com/api/webhooks/printify`
3. Select events: `order:created`, `order:updated`, `order:sent_to_production`
4. Copy the signing secret into `PRINTIFY_WEBHOOK_SECRET` in `.env.local`.

For local testing, use [ngrok](https://ngrok.com) or [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/) to expose localhost.

---

## 8. Stripe Connect Setup

1. Enable Stripe Connect in your Stripe Dashboard.
2. Configure the OAuth redirect URL: `https://your-domain.com/api/stripe/callback`
3. For local development, use the Stripe CLI to forward webhook events:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

---

## 9. Deploy to Vercel

1. Push the `web/` folder (or the entire repo) to a GitHub repository.
2. In [vercel.com](https://vercel.com), import the repository.
3. Set the **Root Directory** to `web` if you pushed the full repo.
4. Add all environment variables from `.env.local` to Vercel's environment settings.
5. Connect your domain: Settings > Domains > Add `asmrtists.ca`.

---

## Project Structure (web/)

```
web/src/
├── app/
│   ├── (public)/          # Public-facing pages (navbar + footer layout)
│   ├── (auth)/            # Login, register, get-started
│   ├── dashboard/         # Authenticated user dashboard
│   ├── admin/             # Admin-only panel
│   └── api/               # API routes (webhooks, wallet, MNEE)
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── layout/            # Navbar, Footer
│   ├── splash/            # Hero carousel, sale ticker
│   ├── gallery/           # Artist cards, artwork grids
│   ├── printify/          # Printify iframe modal
│   ├── wallet/            # BSV wallet generation components
│   └── dashboard/         # Upload, earnings overview
├── lib/
│   ├── supabase/          # Browser + server Supabase clients
│   ├── bsv/               # HD wallet generation (@bsv/sdk)
│   ├── mnee/              # MNEE treasury transfers
│   ├── printify/          # Webhook verification + types
│   ├── stripe/            # Stripe Connect helpers
│   └── zoide/             # Ordinal inscription (Phase 1)
├── middleware.ts           # Auth middleware (protects /dashboard, /admin)
└── types/
    └── supabase.ts        # DB type stubs (run `supabase gen types` to replace)
```
