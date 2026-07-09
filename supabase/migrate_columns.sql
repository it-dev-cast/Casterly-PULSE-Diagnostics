-- =============================================================================
-- PULSE 4.0 — ensure all columns used by the sync engine exist (idempotent).
-- Run this in the Supabase SQL Editor if you get PGRST204 "Could not find the
-- '<col>' column ... in the schema cache" errors. Safe to run multiple times.
-- =============================================================================

-- inspections -----------------------------------------------------------------
alter table public.tbl_pulse_inspections add column if not exists usb_id        text;
alter table public.tbl_pulse_inspections add column if not exists lot_name      text;
alter table public.tbl_pulse_inspections add column if not exists inspector     text;
alter table public.tbl_pulse_inspections add column if not exists serial_number text;
alter table public.tbl_pulse_inspections add column if not exists manufacturer  text;
alter table public.tbl_pulse_inspections add column if not exists model         text;
alter table public.tbl_pulse_inspections add column if not exists grade         text;
alter table public.tbl_pulse_inspections add column if not exists battery_health numeric;
alter table public.tbl_pulse_inspections add column if not exists inspected_at  text;
alter table public.tbl_pulse_inspections add column if not exists uploaded      boolean default true;
alter table public.tbl_pulse_inspections add column if not exists json_data     jsonb;

-- devices ---------------------------------------------------------------------
alter table public.tbl_pulse_devices add column if not exists serial_number text;
alter table public.tbl_pulse_devices add column if not exists manufacturer  text;
alter table public.tbl_pulse_devices add column if not exists model         text;
alter table public.tbl_pulse_devices add column if not exists dmi_uuid      text;
-- on_conflict=serial_number needs a unique index:
create unique index if not exists devices_serial_number_key
  on public.tbl_pulse_devices(serial_number);

-- hardware_specs --------------------------------------------------------------
alter table public.tbl_pulse_hardware_specs add column if not exists inspection_uuid uuid;
alter table public.tbl_pulse_hardware_specs add column if not exists system   jsonb;
alter table public.tbl_pulse_hardware_specs add column if not exists cpu      jsonb;
alter table public.tbl_pulse_hardware_specs add column if not exists memory   jsonb;
alter table public.tbl_pulse_hardware_specs add column if not exists storage  jsonb;
alter table public.tbl_pulse_hardware_specs add column if not exists battery  jsonb;
alter table public.tbl_pulse_hardware_specs add column if not exists bios     jsonb;
alter table public.tbl_pulse_hardware_specs add column if not exists gpu      jsonb;
alter table public.tbl_pulse_hardware_specs add column if not exists display  jsonb;
alter table public.tbl_pulse_hardware_specs add column if not exists network  jsonb;
alter table public.tbl_pulse_hardware_specs add column if not exists audio    jsonb;
alter table public.tbl_pulse_hardware_specs add column if not exists camera   jsonb;

-- grading_results -------------------------------------------------------------
alter table public.tbl_pulse_grading_results add column if not exists inspection_uuid     uuid;
alter table public.tbl_pulse_grading_results add column if not exists lcd_status          text;
alter table public.tbl_pulse_grading_results add column if not exists lcd_defects         jsonb;
alter table public.tbl_pulse_grading_results add column if not exists top_cover_status    text;
alter table public.tbl_pulse_grading_results add column if not exists top_cover_defects   jsonb;
alter table public.tbl_pulse_grading_results add column if not exists bezel_status        text;
alter table public.tbl_pulse_grading_results add column if not exists bezel_defects       jsonb;
alter table public.tbl_pulse_grading_results add column if not exists palmrest_status     text;
alter table public.tbl_pulse_grading_results add column if not exists palmrest_defects    jsonb;
alter table public.tbl_pulse_grading_results add column if not exists bottom_cover_status text;
alter table public.tbl_pulse_grading_results add column if not exists bottom_cover_defects jsonb;
alter table public.tbl_pulse_grading_results add column if not exists keyboard_status     text;
alter table public.tbl_pulse_grading_results add column if not exists keyboard_defects    jsonb;
alter table public.tbl_pulse_grading_results add column if not exists touchpad_status     text;
alter table public.tbl_pulse_grading_results add column if not exists remarks             text;

-- test_results ----------------------------------------------------------------
alter table public.tbl_pulse_test_results add column if not exists inspection_uuid      uuid;
alter table public.tbl_pulse_test_results add column if not exists speaker_test         text;
alter table public.tbl_pulse_test_results add column if not exists webcam_test          text;
alter table public.tbl_pulse_test_results add column if not exists keyboard_test        text;
alter table public.tbl_pulse_test_results add column if not exists keyboard_unique_keys integer;
alter table public.tbl_pulse_test_results add column if not exists touchpad_test        text;
alter table public.tbl_pulse_test_results add column if not exists battery_assessment   text;

-- serial_number on every per-inspection table for serial-based reporting links.
-- NOT unique here (a device can be inspected multiple times); only devices keeps
-- a unique serial. Indexed for fast joins/filters.
alter table public.tbl_pulse_hardware_specs  add column if not exists serial_number text;
alter table public.tbl_pulse_grading_results add column if not exists serial_number text;
alter table public.tbl_pulse_test_results    add column if not exists serial_number text;

create index if not exists idx_inspections_serial_rep    on public.tbl_pulse_inspections(serial_number);
create index if not exists idx_hardware_specs_serial      on public.tbl_pulse_hardware_specs(serial_number);
create index if not exists idx_grading_results_serial     on public.tbl_pulse_grading_results(serial_number);
create index if not exists idx_test_results_serial        on public.tbl_pulse_test_results(serial_number);

-- Unique indexes on inspection_uuid for the child tables. Required so the
-- ON CONFLICT (inspection_uuid) upsert works (older app builds use upsert; newer
-- builds use delete-then-insert, which is also compatible with these indexes).
create unique index if not exists hardware_specs_inspection_uuid_key
  on public.tbl_pulse_hardware_specs(inspection_uuid);
create unique index if not exists grading_results_inspection_uuid_key
  on public.tbl_pulse_grading_results(inspection_uuid);
create unique index if not exists test_results_inspection_uuid_key
  on public.tbl_pulse_test_results(inspection_uuid);

-- Reload PostgREST's schema cache so the new columns are picked up immediately.
notify pgrst, 'reload schema';
