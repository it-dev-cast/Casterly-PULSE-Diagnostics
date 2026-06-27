-- =============================================================================
-- tbl_GPU — stores GPU details saved from the System Scan screen
-- Run this once in your Supabase project: Dashboard → SQL Editor → New query.
-- The table name is quoted to preserve the exact mixed-case name "tbl_GPU".
-- =============================================================================

create table if not exists "tbl_GPU" (
  id         bigint generated always as identity primary key,
  graphics   text,
  vram       text,
  driver     text,
  output     text,
  created_at timestamptz not null default now()
);

-- Enable Row Level Security so the public anon key can't do anything we
-- haven't explicitly allowed.
alter table "tbl_GPU" enable row level security;

-- Allow the app (using the anon public key) to INSERT rows.
-- Adjust/remove later if you add authenticated users.
drop policy if exists "anon can insert gpu" on "tbl_GPU";
create policy "anon can insert gpu"
  on "tbl_GPU"
  for insert
  to anon
  with check (true);

-- Optional: allow reading rows back (e.g. to list saved GPUs).
drop policy if exists "anon can read gpu" on "tbl_GPU";
create policy "anon can read gpu"
  on "tbl_GPU"
  for select
  to anon
  using (true);
