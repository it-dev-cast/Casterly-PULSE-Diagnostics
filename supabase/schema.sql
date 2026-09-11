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


1) Inside the Manual Grading Screen once everything completes and user clicks on "Continue to speaker test" button it should automatically moves to Speaker Test Screen. now manually user as to clicks on the menu

2) Inside the Speaker Test Screen once everything completes and user clicks on "Continue to webcam test" button it should automatically moves to webcam Test Screen. now manually user as to clicks on the menu

3) Inside the webcam Test Screen once everything completes and user clicks on "Continue to keyboard test" button it should automatically moves to keyboard Test Screen. now manually user as to clicks on the menu

4) Inside the keyboard Test Screen once everything completes and user clicks on "Continue to touchpad test" button it should automatically moves to touch Test Screen. now manually user as to clicks on the menu

5) Inside the touch Test Screen once everything completes and user clicks on "Continue to Battery Assessment test" button it should automatically moves to Battery Assessment Test Screen. now manually user as to clicks on the menu

6) Inside the Battery Assessment Test Screen once everything completes and user clicks on "Continue to final review" button it should automatically moves to final review Screen. now manually user as to clicks on the menu


"This diagnostic tool performs a read-only assessment of your laptop and does not make any changes to hardware, software, files, or system configurations."

Display the following disclaimer in the application footer as a continuously scrolling marquee from left to right, looping indefinitely throughout the application's runtime.



develop windows application in vs 2026 c# and give me the full application for download, details are given below.

The below project is related to PULSE Application

1) Screen Name is Casterly Label Printing, in the header casterly image should be there inside the screen with the caption Casterly Label Printing and Reporting.
2) Label Name = "Service-Tag" with icon on the Label
3) Text Box for the same and inside this text box auto filling should be there from supabase table (tbl_pulse_inspections), when user types the characters based on that avaialble serial_number should be displayed in the drop down.
4) Label Name = "LOT-Number" with icon on the Label
5) Text Box for the same and inside this text box auto filling should be there from supabase table (tbl_pulse_inspections), when user types the characters based on that avaialble lot_name should be displayed in the drop down.
6) Button Name = "View Label" with icon on the button, if user clicks on this button with live data label priview should be display inside the screen
7) Button Name = "Print Label" with icon on the button.
8) After clicking on the button first excel sheet as to be generated in the local system and with same excels sheet print should be come to the default printer which as been set.
9) Label desgin as been attached its in .yix format which is designed in wagelabel software.
10) with service tag print only the latest record as to be pick.
11) with lot-number print all the data related to that should get exported to the excel then print.
12) Supabase credentials are given below
DATABASE_URL="postgresql://postgres.pesgdrfeauofhtbjqkbz:Renew2026DB@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres"
SUPABASE_URL=https://pesgdrfeauofhtbjqkbz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlc2dkcmZlYXVvZmh0Ympxa2J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzgwNjg5NywiZXhwIjoyMDkzMzgyODk3fQ.pqikpnfrtSttjAS6Z4A-zyUyzTypveMEllxCuHVjqpE


only the below details should be shown in the label
9DHMSQ3
B3SLSQ3

Before you answer, tell me what you need to know to answer well, and point out any assumptions you'd otherwise make.

1) Put border line(top, bottom, left, right) for the label, all values should get print inside this line.
2) Take CLY Number from tbl_pulse_inspections according to the serial_number.
3) Put this cly number on top of the label, font size should large and bold which should fit accordinglly inside the border line.
4) Below the Cly number print barcode height and width of the barcode should be matched with cly number, inside barcode cly number should be there means if we scan cly number should get come.
5) below cly number put vertical line
6) below barcode put vertical line
7) below this all other details should get print means manufauturer model etc(retain fontsize and formats)
8) below this details put vertical line
9) below this vertical line put caption as MRP Rs 65,000 in bold and bigger font

1) barcode line should not get overlap on left and right line, and reduce height and width of the barcode little bit.
2) cly number font on the top reduce the font to 25%
3) reduce MRP details font size to 50%
4) before cly number print "CASTERLY CERTIFIED REFURBISHED LAPTOP" adjust the font according to the label.
5) replace MRP details with the below and print the below given details which should get fit in the label so according to that give the font size.

MRP: ₹39,990 (Inclusive of all Taxes)
Warranty:
1-Year Nationwide Replacement Warranty
Packed & Marketed By:
Casterly Private Limited

Customer Support:
+91 63668 90658
support@casterly.com
support.casterly.com

1) Increase the cly number font size to 15pt on the top with bold.
2) make phone number and website details on the below to bold.

create .env file with below supabse details

DATABASE_URL="postgresql://postgres.pesgdrfeauofhtbjqkbz:Renew2026DB@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres"
SUPABASE_URL=https://pesgdrfeauofhtbjqkbz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlc2dkcmZlYXVvZmh0Ympxa2J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzgwNjg5NywiZXhwIjoyMDkzMzgyODk3fQ.pqikpnfrtSttjAS6Z4A-zyUyzTypveMEllxCuHVjqpE


1) Grade is not saving the DB, please save the Grade in "tbl_pulse_inspections" table and field name is "grade"
2) tbl_pulse_inspectors and tbl_pulse_lots tabkes are empty i think data is not saving in to this table from Lot and Inspector screens.


1) create another table called tbl_pulse_mrp and create field uuid, model, memory_size, storage_size, mrp, created_date.

2) now for the first time insert all the records from the according tables.

3) in future recrods should get inserted through triggers from related tables.

4) Only mrp value will not be there as of now because we are not getting this through udiag4.

actually mrp should be update according to the below

1) Laptop, Dell, Latitude 5420, 16 GB, 256 GB, Intel(R) Core(TM) i5-1145G7 	11th, 14, 51975	

2) Laptop, Dell, Latitude 5420, 16 GB, 512 GB	Intel(R) Core(TM) i5-1145G7 	11th, 14, 56356

our client Requirement is that when they plug the PULSE USB Pendrive in to their laptop automatically PULSE application should get executed without any manual intervention.