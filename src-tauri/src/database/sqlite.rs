use rusqlite::{Connection, Result};
use std::path::Path;

pub fn initialize_database(
    db_path: &Path
)
-> Result<Connection>
{
    // Make sure the directory holding the database exists
    // (e.g. the app-data dir on first launch).
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).ok();
    }

    let conn =
        Connection::open(
            db_path
        )?;

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


    conn.execute(

    "
    CREATE TABLE IF NOT EXISTS settings (

        key TEXT PRIMARY KEY,

        value TEXT NOT NULL
        )
        ",

        []
    )?;

    // --------------------------------------------------------------
    // Normalized hardware inventory tables.
    //
    // Each row links back to a scan via `inspection_uuid`, which
    // references `inspections(uuid)`. Single-instance components
    // (system, processor, battery, ...) store one row per scan;
    // multi-instance components (memory, storage, graphics) store
    // one row per physical device.
    //
    // Column types are derived from the structs in models/device.rs.
    // Booleans are stored as INTEGER (0/1); Option<T> fields are
    // nullable.
    // --------------------------------------------------------------

    // Allow inspections(uuid) to act as a foreign-key parent.
    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_inspections_uuid
         ON inspections(uuid)",
        []
    )?;

    // tbl_system_info  <- SystemInfo
    conn.execute(
        "
        CREATE TABLE IF NOT EXISTS tbl_system_info (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            inspection_uuid TEXT NOT NULL,
            manufacturer    TEXT,
            model           TEXT,
            serial_number   TEXT,
            uuid            TEXT,
            FOREIGN KEY (inspection_uuid) REFERENCES inspections(uuid)
        )
        ",
        []
    )?;

    // tbl_processor  <- CpuInfo
    conn.execute(
        "
        CREATE TABLE IF NOT EXISTS tbl_processor (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            inspection_uuid   TEXT NOT NULL,
            manufacturer      TEXT,
            model             TEXT,
            architecture      TEXT,
            sockets           INTEGER,
            cores_per_socket  INTEGER,
            threads           INTEGER,
            max_speed_mhz     REAL,
            min_speed_mhz     REAL,
            current_speed_mhz REAL,
            cache_l1          TEXT,
            cache_l2          TEXT,
            cache_l3          TEXT,
            virtualization    INTEGER,
            hyper_threading   INTEGER,
            flags             TEXT,
            FOREIGN KEY (inspection_uuid) REFERENCES inspections(uuid)
        )
        ",
        []
    )?;

    // tbl_memory  <- MemoryModule (one row per module)
    conn.execute(
        "
        CREATE TABLE IF NOT EXISTS tbl_memory (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            inspection_uuid TEXT NOT NULL,
            slot            TEXT,
            bank_locator    TEXT,
            size_mb         INTEGER,
            memory_type     TEXT,
            manufacturer    TEXT,
            serial          TEXT,
            part_number     TEXT,
            speed_mhz       INTEGER,
            is_empty        INTEGER,
            is_onboard      INTEGER,
            FOREIGN KEY (inspection_uuid) REFERENCES inspections(uuid)
        )
        ",
        []
    )?;

    // tbl_storage  <- StorageDevice (one row per device)
    conn.execute(
        "
        CREATE TABLE IF NOT EXISTS tbl_storage (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            inspection_uuid  TEXT NOT NULL,
            slot             TEXT,
            device           TEXT,
            model            TEXT,
            serial           TEXT,
            firmware         TEXT,
            size_gb          REAL,
            transport        TEXT,
            storage_type     TEXT,
            health_percent   INTEGER,
            temperature_c    INTEGER,
            power_on_hours   INTEGER,
            power_cycles     INTEGER,
            media_errors     INTEGER,
            critical_warning TEXT,
            FOREIGN KEY (inspection_uuid) REFERENCES inspections(uuid)
        )
        ",
        []
    )?;

    // tbl_graphics  <- GpuInfo (one row per GPU)
    conn.execute(
        "
        CREATE TABLE IF NOT EXISTS tbl_graphics (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            inspection_uuid TEXT NOT NULL,
            vendor          TEXT,
            model           TEXT,
            bus_address     TEXT,
            driver          TEXT,
            FOREIGN KEY (inspection_uuid) REFERENCES inspections(uuid)
        )
        ",
        []
    )?;

    // tbl_display  <- DisplayInfo
    conn.execute(
        "
        CREATE TABLE IF NOT EXISTS tbl_display (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            inspection_uuid   TEXT NOT NULL,
            manufacturer      TEXT,
            model             TEXT,
            panel_part_number TEXT,
            resolution        TEXT,
            size_inches       REAL,
            FOREIGN KEY (inspection_uuid) REFERENCES inspections(uuid)
        )
        ",
        []
    )?;

    // tbl_battery  <- BatteryInfo
    conn.execute(
        "
        CREATE TABLE IF NOT EXISTS tbl_battery (
            id                      INTEGER PRIMARY KEY AUTOINCREMENT,
            inspection_uuid         TEXT NOT NULL,
            manufacturer            TEXT,
            model                   TEXT,
            serial_number           TEXT,
            technology              TEXT,
            status                  TEXT,
            cycle_count             INTEGER,
            design_capacity_mwh     INTEGER,
            full_charge_capacity_mwh INTEGER,
            current_capacity_mwh    INTEGER,
            voltage_mv              INTEGER,
            design_capacity_wh      REAL,
            full_charge_capacity_wh REAL,
            current_capacity_wh     REAL,
            health_percent          REAL,
            FOREIGN KEY (inspection_uuid) REFERENCES inspections(uuid)
        )
        ",
        []
    )?;

    // tbl_network  <- NetworkInfo (wifi + ethernet)
    conn.execute(
        "
        CREATE TABLE IF NOT EXISTS tbl_network (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            inspection_uuid  TEXT NOT NULL,
            wifi             TEXT,
            wifi_friendly    TEXT,
            wifi_mac         TEXT,
            ethernet         TEXT,
            ethernet_friendly TEXT,
            ethernet_mac     TEXT,
            bluetooth        INTEGER,
            FOREIGN KEY (inspection_uuid) REFERENCES inspections(uuid)
        )
        ",
        []
    )?;

    // tbl_bluetooth  <- derived from NetworkInfo.bluetooth
    conn.execute(
        "
        CREATE TABLE IF NOT EXISTS tbl_bluetooth (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            inspection_uuid TEXT NOT NULL,
            present         INTEGER,
            name            TEXT,
            address         TEXT,
            FOREIGN KEY (inspection_uuid) REFERENCES inspections(uuid)
        )
        ",
        []
    )?;

    // tbl_audio  (no dedicated model yet; generic device shape)
    conn.execute(
        "
        CREATE TABLE IF NOT EXISTS tbl_audio (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            inspection_uuid TEXT NOT NULL,
            vendor          TEXT,
            model           TEXT,
            device          TEXT,
            status          TEXT,
            FOREIGN KEY (inspection_uuid) REFERENCES inspections(uuid)
        )
        ",
        []
    )?;

    // tbl_motherboard  <- SystemInfo + BiosInfo
    conn.execute(
        "
        CREATE TABLE IF NOT EXISTS tbl_motherboard (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            inspection_uuid   TEXT NOT NULL,
            manufacturer      TEXT,
            model             TEXT,
            serial_number     TEXT,
            bios_vendor       TEXT,
            bios_version      TEXT,
            bios_release_date TEXT,
            FOREIGN KEY (inspection_uuid) REFERENCES inspections(uuid)
        )
        ",
        []
    )?;

    // tbl_webcam  <- CameraInfo
    conn.execute(
        "
        CREATE TABLE IF NOT EXISTS tbl_webcam (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            inspection_uuid TEXT NOT NULL,
            vendor          TEXT,
            model           TEXT,
            device          TEXT,
            status          TEXT,
            FOREIGN KEY (inspection_uuid) REFERENCES inspections(uuid)
        )
        ",
        []
    )?;

    // Indexes on the foreign key for fast per-scan lookups.
    for table in [
        "tbl_system_info",
        "tbl_processor",
        "tbl_memory",
        "tbl_storage",
        "tbl_graphics",
        "tbl_display",
        "tbl_battery",
        "tbl_network",
        "tbl_bluetooth",
        "tbl_audio",
        "tbl_motherboard",
        "tbl_webcam",
    ] {
        conn.execute(
            &format!(
                "CREATE INDEX IF NOT EXISTS idx_{table}_inspection
                 ON {table}(inspection_uuid)"
            ),
            []
        )?;
    }

    Ok(conn)
}