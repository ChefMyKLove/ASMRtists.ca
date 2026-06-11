-- Migration: add purchase/escrow columns to ordinal_listings
-- Run in Supabase SQL Editor

alter table public.ordinal_listings
  add column if not exists escrow_txid      text,
  add column if not exists buyer_ord_address text,
  add column if not exists sale_txid         text,
  add column if not exists updated_at        timestamptz not null default now();

-- status values: 'pending_escrow' | 'active' | 'sold' | 'cancelled'
-- pending_escrow: DB row created, waiting for seller to transfer to escrow
-- active:         ordinal is in platform escrow, visible in marketplace
-- sold:           buyer paid and received ordinal
-- cancelled:      seller cancelled, ordinal returned

notify pgrst, 'reload schema';
