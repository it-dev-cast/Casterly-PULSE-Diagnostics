-- =============================================================================
-- PULSE 4.0 — Supabase (PostgreSQL) schema
-- Aligned with PRD §12.2 (Table 38). Run in the Supabase SQL Editor.
--
-- All System Scan hardware lands in `hardware_specs` (one row per inspection,
-- one JSONB column per collector). Key device-identity fields are also denormalized
-- onto `inspections` for easy querying/filtering.
-- =============================================================================

-- One row per LOT (mirrors local SQLite `lots`)
create table if not exists public.lots (
  id              bigint generated always as identity primary key,
  lot_name        text not null unique,
  customer        text,
  location        text,
  inspection_date date,
  status          text default 'ACTIVE',
  created_at      timestamptz default now()
);

-- Named inspector registry
create table if not exists public.inspectors (
  id          bigint generated always as identity primary key,
  name        text not null,
  employee_id text unique,
  email       text,
  phone       text,
  active      boolean default true,
  created_at  timestamptz default now()
);

-- Normalized device identity (one row per physical device serial)
create table if not exists public.devices (
  id            bigint generated always as identity primary key,
  serial_number text unique,
  manufacturer  text,
  model         text,
  dmi_uuid      text,
  created_at    timestamptz default now()
);

-- One row per inspection — full JSON payload + extracted key fields
create table if not exists public.inspections (
  uuid           uuid primary key,
  usb_id         text,
  lot_name       text,
  inspector      text,
  serial_number  text,
  manufacturer   text,
  model          text,
  grade          text,                       -- A / B / C
  battery_health numeric,
  inspected_at   text,                       -- device-local 'dd/mm/yyyy HH:MM:SS'
  uploaded       boolean default true,
  json_data      jsonb,                      -- complete InspectionRun (PRD §11.6)
  created_at     timestamptz default now()
);

-- One row per inspection — System Scan output, one JSONB column per collector
create table if not exists public.hardware_specs (
  id              bigint generated always as identity primary key,
  inspection_uuid uuid unique references public.inspections(uuid) on delete cascade,
  serial_number   text,
  system          jsonb,   -- manufacturer, model, serial, uuid, board_serial, bios_version
  cpu             jsonb,   -- model, vendor, arch, sockets, cores, threads, speeds, cache
  memory          jsonb,   -- array of DIMM modules
  storage         jsonb,   -- array of drives (model, serial, size, smart health, temp)
  battery         jsonb,   -- capacities, cycle_count, health, technology, status
  bios            jsonb,   -- vendor, version, release_date
  gpu             jsonb,   -- array of GPUs (vendor, model, driver, vram)
  display         jsonb,   -- manufacturer, model, panel_pn, resolution, size
  network         jsonb,   -- wifi/ethernet adapters, MACs, bluetooth
  audio           jsonb,   -- codec, speaker/mic/jack types
  camera          jsonb,   -- vendor, model, device, status
  created_at      timestamptz default now()
);

-- One row per inspection — cosmetic grading
create table if not exists public.grading_results (
  id                  bigint generated always as identity primary key,
  inspection_uuid     uuid references public.inspections(uuid) on delete cascade,
  serial_number       text,
  lcd_status          text, lcd_defects          jsonb,
  top_cover_status    text, top_cover_defects    jsonb,
  bezel_status        text, bezel_defects        jsonb,
  palmrest_status     text, palmrest_defects     jsonb,
  bottom_cover_status text, bottom_cover_defects jsonb,
  keyboard_status     text, keyboard_defects     jsonb,
  touchpad_status     text,
  remarks             text,
  created_at          timestamptz default now()
);

-- One row per inspection — functional test outcomes
create table if not exists public.test_results (
  id                   bigint generated always as identity primary key,
  inspection_uuid      uuid references public.inspections(uuid) on delete cascade,
  serial_number        text,
  speaker_test         text,
  webcam_test          text,
  keyboard_test        text,
  keyboard_unique_keys integer,
  touchpad_test        text,
  battery_assessment   text,
  created_at           timestamptz default now()
);

-- Audit log of sync operations (observability)
create table if not exists public.upload_log (
  id              bigint generated always as identity primary key,
  inspection_uuid uuid,
  status          text,        -- UPLOADED / FAILED
  http_code       integer,
  error           text,
  created_at      timestamptz default now()
);

-- Helpful indexes
create index if not exists idx_inspections_lot     on public.inspections(lot_name);
create index if not exists idx_inspections_serial  on public.inspections(serial_number);
create index if not exists idx_hardware_specs_uuid on public.hardware_specs(inspection_uuid);
create index if not exists idx_grading_uuid        on public.grading_results(inspection_uuid);
create index if not exists idx_test_uuid           on public.test_results(inspection_uuid);
-- serial_number indexes for serial-based reporting joins
create index if not exists idx_hardware_specs_serial on public.hardware_specs(serial_number);
create index if not exists idx_grading_serial        on public.grading_results(serial_number);
create index if not exists idx_test_serial           on public.test_results(serial_number);

-- =============================================================================
-- Row Level Security
-- The app currently authenticates with the service_role key, which BYPASSES RLS,
-- so inserts will work even with RLS enabled. Enabling RLS (with no public
-- policies) is recommended so the anon key cannot read/write these tables.
-- =============================================================================
alter table public.lots            enable row level security;
alter table public.inspectors      enable row level security;
alter table public.devices         enable row level security;
alter table public.inspections     enable row level security;
alter table public.hardware_specs  enable row level security;
alter table public.grading_results enable row level security;
alter table public.test_results    enable row level security;
alter table public.upload_log      enable row level security;
