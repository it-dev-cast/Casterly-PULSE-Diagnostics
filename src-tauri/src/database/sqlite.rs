use rusqlite::{Connection, Result};

pub fn initialize_database()
-> Result<Connection>
{
    // PRD §11.1: the embedded database file is opened via
    // Connection::open("udiag.db"). With rusqlite's "bundled" feature, SQLite
    // is compiled into the binary — no external libsqlite3 dependency.
    let conn =
        Connection::open(
            "udiag.db"
        )?;

    // ── One-time migration: re-key multi-row hardware report tables ──────
    // memory_info / storage_info / gpu_info were originally keyed on
    // (uuid, serial_number, slot|device|bus_address). Onboard/soldered
    // memory in particular often reports the same slot ("Motherboard") for
    // every module (only bank_locator differs), which collapsed distinct
    // modules into a single row on upsert. Re-key on an explicit array
    // index instead, which is always unique within one save. Existing
    // rows in these three tables are dropped once (they are a reporting
    // mirror, not the source of truth — the full inventory still lives in
    // `inspections.json_data`).
    let schema_version: i64 = conn
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .unwrap_or(0);

    if schema_version < 1 {
        let _ = conn.execute_batch(
            "DROP TABLE IF EXISTS memory_info;
             DROP TABLE IF EXISTS storage_info;
             DROP TABLE IF EXISTS gpu_info;
             PRAGMA user_version = 1;",
        );
    }

    conn.execute(

        "
        CREATE TABLE IF NOT EXISTS lots (

            id INTEGER PRIMARY KEY,

            lot_name TEXT NOT NULL,

            customer TEXT NOT NULL,

            location TEXT NOT NULL,

            inspection_date TEXT NOT NULL,

            status TEXT NOT NULL
        )
        ",

        []
    )?;

    conn.execute(

        "
        CREATE TABLE IF NOT EXISTS inspections (

            id INTEGER PRIMARY KEY,

            uuid TEXT NOT NULL,

            lot_name TEXT NOT NULL,

            inspector TEXT NOT NULL,

            timestamp TEXT NOT NULL,

            uploaded INTEGER DEFAULT 0,

            json_data TEXT NOT NULL
        )
        ",

        []
    )?;


    conn.execute(

       "
       CREATE TABLE IF NOT EXISTS upload_queue
       (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        inspection_uuid TEXT NOT NULL,

        status TEXT NOT NULL,

        retry_count INTEGER NOT NULL,

        created_at TEXT NOT NULL,

        uploaded_at TEXT
        )
        ",

        []
    )?;



    // ── Hardware inventory report tables ─────────────────────────────────
    // One row per (inspection uuid, device serial_number[, extra key]) for
    // each hardware category collected during System Scan / Hardware
    // Inventory. These exist purely for reporting/querying by serial number
    // without having to parse the `inspections.json_data` blob. The
    // `inspections` table (JSON blob) remains the source of truth used for
    // upload sync; these tables are an additive, queryable mirror written
    // when the Hardware Inventory step hands off to Manual Grading.
    //
    // uuid = the inspection run's UUID (shared with the eventual
    // `inspections` row once the inspection is saved).
    // serial_number = the device's serial number (SystemInfo.serial_number),
    // duplicated onto every table below as a dedicated reporting column.
    // created_at = insert time, always set explicitly by the app (chrono).

    conn.execute(
        "
        CREATE TABLE IF NOT EXISTS system_info (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT NOT NULL,
            serial_number TEXT NOT NULL,
            device_uuid TEXT,
            manufacturer TEXT,
            model TEXT,
            board_serial TEXT,
            bios_version TEXT,
            created_at TEXT NOT NULL,
            UNIQUE(uuid, serial_number)
        )
        ",
        [],
    )?;

    conn.execute(
        "
        CREATE TABLE IF NOT EXISTS cpu_info (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT NOT NULL,
            serial_number TEXT NOT NULL,
            manufacturer TEXT,
            model TEXT,
            architecture TEXT,
            sockets INTEGER,
            cores_per_socket INTEGER,
            threads INTEGER,
            max_speed_mhz REAL,
            min_speed_mhz REAL,
            current_speed_mhz REAL,
            cache_l1 TEXT,
            cache_l2 TEXT,
            cache_l3 TEXT,
            virtualization INTEGER,
            hyper_threading INTEGER,
            created_at TEXT NOT NULL,
            UNIQUE(uuid, serial_number)
        )
        ",
        [],
    )?;

    conn.execute(
        "
        CREATE TABLE IF NOT EXISTS memory_info (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT NOT NULL,
            serial_number TEXT NOT NULL,
            module_index INTEGER NOT NULL,
            slot TEXT,
            bank_locator TEXT,
            size_mb INTEGER,
            memory_type TEXT,
            manufacturer TEXT,
            module_serial TEXT,
            part_number TEXT,
            speed_mhz INTEGER,
            is_empty INTEGER,
            is_onboard INTEGER,
            created_at TEXT NOT NULL,
            UNIQUE(uuid, serial_number, module_index)
        )
        ",
        [],
    )?;

    conn.execute(
        "
        CREATE TABLE IF NOT EXISTS storage_info (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT NOT NULL,
            serial_number TEXT NOT NULL,
            drive_index INTEGER NOT NULL,
            device TEXT,
            slot TEXT,
            model TEXT,
            drive_serial TEXT,
            firmware TEXT,
            size_gb REAL,
            transport TEXT,
            storage_type TEXT,
            health_percent INTEGER,
            temperature_c INTEGER,
            power_on_hours INTEGER,
            power_cycles INTEGER,
            media_errors INTEGER,
            critical_warning TEXT,
            created_at TEXT NOT NULL,
            UNIQUE(uuid, serial_number, drive_index)
        )
        ",
        [],
    )?;

    conn.execute(
        "
        CREATE TABLE IF NOT EXISTS battery_info (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT NOT NULL,
            serial_number TEXT NOT NULL,
            manufacturer TEXT,
            model TEXT,
            battery_serial TEXT,
            technology TEXT,
            status TEXT,
            cycle_count INTEGER,
            design_capacity_mwh INTEGER,
            full_charge_capacity_mwh INTEGER,
            current_capacity_mwh INTEGER,
            voltage_mv INTEGER,
            health_percent REAL,
            created_at TEXT NOT NULL,
            UNIQUE(uuid, serial_number)
        )
        ",
        [],
    )?;

    conn.execute(
        "
        CREATE TABLE IF NOT EXISTS network_info (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT NOT NULL,
            serial_number TEXT NOT NULL,
            wifi TEXT,
            wifi_friendly TEXT,
            wifi_mac TEXT,
            ethernet TEXT,
            ethernet_friendly TEXT,
            ethernet_mac TEXT,
            bluetooth INTEGER,
            created_at TEXT NOT NULL,
            UNIQUE(uuid, serial_number)
        )
        ",
        [],
    )?;

    conn.execute(
        "
        CREATE TABLE IF NOT EXISTS display_info (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT NOT NULL,
            serial_number TEXT NOT NULL,
            manufacturer TEXT,
            model TEXT,
            panel_part_number TEXT,
            resolution TEXT,
            size_inches REAL,
            created_at TEXT NOT NULL,
            UNIQUE(uuid, serial_number)
        )
        ",
        [],
    )?;

    conn.execute(
        "
        CREATE TABLE IF NOT EXISTS gpu_info (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT NOT NULL,
            serial_number TEXT NOT NULL,
            gpu_index INTEGER NOT NULL,
            bus_address TEXT,
            vendor TEXT,
            model TEXT,
            driver TEXT,
            vram TEXT,
            output_resolution TEXT,
            created_at TEXT NOT NULL,
            UNIQUE(uuid, serial_number, gpu_index)
        )
        ",
        [],
    )?;

    conn.execute(
        "
        CREATE TABLE IF NOT EXISTS camera_info (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT NOT NULL,
            serial_number TEXT NOT NULL,
            vendor TEXT,
            model TEXT,
            device TEXT,
            status TEXT,
            created_at TEXT NOT NULL,
            UNIQUE(uuid, serial_number)
        )
        ",
        [],
    )?;

    conn.execute(
        "
        CREATE TABLE IF NOT EXISTS audio_info (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT NOT NULL,
            serial_number TEXT NOT NULL,
            codec TEXT,
            speaker_type TEXT,
            mic_type TEXT,
            jack_type TEXT,
            created_at TEXT NOT NULL,
            UNIQUE(uuid, serial_number)
        )
        ",
        [],
    )?;


    conn.execute(

    "
    CREATE TABLE IF NOT EXISTS settings (

        key TEXT PRIMARY KEY,

        value TEXT NOT NULL
        )
        ",

        []
    )?;

    Ok(conn)
}