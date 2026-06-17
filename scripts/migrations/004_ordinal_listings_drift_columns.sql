-- Migration: add drift-detection columns to ordinal_listings
-- Run in Supabase SQL Editor after 002_ordinal_listings_purchase_columns.sql

alter table public.ordinal_listings
  add column if not exists listed_outpoint   text,        -- txid_0 of the escrow UTXO at listing time
  add column if not exists last_verified_at  timestamptz; -- last time escrow UTXO was confirmed unspent

-- status values now include:
-- 'pending_escrow'      — listing created, seller has not yet transferred to escrow
-- 'active'             — ordinal is in platform escrow, visible in marketplace
-- 'processing'         — purchase in flight (prevents double-delivery)
-- 'sold'               — buyer paid and received ordinal
-- 'cancelled'          — seller cancelled, ordinal returned
-- 'delisted_transferred' — escrow UTXO was spent outside normal flow; listing auto-removed

notify pgrst, 'reload schema';
