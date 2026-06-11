-- Migration: create platform_settings table and seed featured_collection_id
-- Run in Supabase SQL Editor

create table if not exists public.platform_settings (
  key         text primary key,
  value       text not null,
  description text,
  updated_at  timestamptz not null default now()
);

alter table public.platform_settings enable row level security;

-- Public read (homepage needs it server-side via admin client, but allow anon reads too)
create policy if not exists "public read platform_settings"
  on public.platform_settings for select using (true);

-- Seed / update featured collection
insert into public.platform_settings (key, value, description)
values (
  'featured_collection_id',
  '5ef4864c-4583-48aa-96eb-0bad07827773',
  'Collection UUID to feature on the homepage. Update to rotate the featured spot.'
)
on conflict (key) do update
  set value       = excluded.value,
      description = excluded.description,
      updated_at  = now();

notify pgrst, 'reload schema';
