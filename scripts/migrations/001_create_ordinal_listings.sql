-- Migration: create ordinal_listings table
-- Run in Supabase SQL Editor or via migrate_ordinal_listings.py

-- 1. Create the table
create table if not exists public.ordinal_listings (
  id                   uuid        primary key default gen_random_uuid(),
  artwork_id           uuid        not null references public.artwork(id) on delete cascade,
  inscription_outpoint text        not null,
  seller_ord_address   text        not null,
  price_mnee           numeric     not null,
  status               text        not null default 'active',
  created_at           timestamptz not null default now()
);

-- 2. Only one active listing per outpoint
create unique index if not exists ordinal_listings_one_active_per_outpoint
  on public.ordinal_listings (inscription_outpoint)
  where status = 'active';

-- 3. Standard indexes for common query patterns
create index if not exists ordinal_listings_status_idx
  on public.ordinal_listings (status);

create index if not exists ordinal_listings_artwork_idx
  on public.ordinal_listings (artwork_id);

-- 4. Enable RLS (service_role bypasses it; anon/authenticated reads are safe)
alter table public.ordinal_listings enable row level security;

-- Allow anyone to read active listings (public marketplace)
create policy "public read active listings"
  on public.ordinal_listings for select
  using (status = 'active');

-- Only service_role (server-side actions) can insert/update/delete
-- (No policy needed — service_role bypasses RLS by default)

-- 5. Reload PostgREST schema cache so the REST API sees the new table
notify pgrst, 'reload schema';
