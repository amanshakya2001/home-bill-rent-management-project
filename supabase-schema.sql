-- Home Bill & Rent Manager — Supabase schema
-- Run this in the Supabase dashboard: SQL Editor → New query → paste → Run.
--
-- This app uses NO authentication: a single shared dataset is accessed with the
-- anon key. RLS is enabled and opened to the `anon` role so the client can read
-- and write. (If you later add auth, tighten these policies to use auth.uid().)

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.electricity_bills (
  id               bigint generated always as identity primary key,
  month            integer not null,
  year             integer not null,
  previous_reading numeric not null default 0,
  current_reading  numeric not null default 0,
  units_consumed   numeric not null default 0,
  price_per_unit   numeric not null default 0,
  total_amount     numeric not null default 0,
  status           text    not null default 'unpaid',
  paid_date        text,
  image_uri        text,
  created_at       timestamptz not null default now()
);

create table if not exists public.rent_payments (
  id         bigint generated always as identity primary key,
  month      integer not null,
  year       integer not null,
  amount     numeric not null default 0,
  status     text    not null default 'unpaid',
  paid_date  text,
  created_at timestamptz not null default now()
);

create table if not exists public.split_records (
  id                 bigint generated always as identity primary key,
  period             text    not null,
  total_amount       numeric not null,
  total_units        numeric not null,
  per_unit           numeric not null,
  our_units          numeric not null,
  our_amount         numeric not null,
  top_floor_units    numeric not null,
  top_floor_amount   numeric not null,
  underground_units  numeric not null,
  underground_amount numeric not null,
  created_at         timestamptz not null default now()
);

create table if not exists public.app_settings (
  id              integer primary key default 1 check (id = 1),
  apartment_name  text    not null default 'My Apartment',
  onboarding_done integer not null default 0
);

-- Seed the single settings row.
insert into public.app_settings (id, apartment_name, onboarding_done)
values (1, 'My Apartment', 0)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Row Level Security — open to anon (no-auth shared dataset)
-- ---------------------------------------------------------------------------

alter table public.electricity_bills enable row level security;
alter table public.rent_payments     enable row level security;
alter table public.split_records     enable row level security;
alter table public.app_settings      enable row level security;

-- Helper: drop existing policy if present, then create a fully-permissive one.
drop policy if exists "anon full access" on public.electricity_bills;
create policy "anon full access" on public.electricity_bills
  for all to anon using (true) with check (true);

drop policy if exists "anon full access" on public.rent_payments;
create policy "anon full access" on public.rent_payments
  for all to anon using (true) with check (true);

drop policy if exists "anon full access" on public.split_records;
create policy "anon full access" on public.split_records
  for all to anon using (true) with check (true);

drop policy if exists "anon full access" on public.app_settings;
create policy "anon full access" on public.app_settings
  for all to anon using (true) with check (true);
