use rusqlite::{params, Connection};
use serde_json::Value;

// =============================================================================
// hardware_reports.rs
// =============================================================================
// Mirrors the 10 hardware categories collected during System Scan into their
// own dedicated SQLite tables (see database/sqlite.rs) so they can be
// reported on / queried by serial number directly, without parsing the
// `inspections.json_data` blob.
//
// Called once, when the Hardware Inventory screen hands off to Manual
// Grading. Every insert is an upsert keyed on (uuid, serial_number[, extra
// key for multi-row categories]) so re-visiting Hardware Inventory and
// advancing again just overwrites the same rows instead of erroring or
// duplicating.
//
// Frontend payloads are accepted as loosely-typed `serde_json::Value` rather
// than strict structs: the Tauri command layer already returns the full Rust
// struct shape to the frontend, but the frontend's TS interfaces are a
// looser, occasionally-stale subset of those fields, so extracting fields
// defensively here avoids brittle deserialization failures on drift.
// =============================================================================

fn get_str(v: &Value, key: &str) -> Option<String> {
    v.get(key).and_then(|x| x.as_str()).map(|s| s.to_string())
}

fn get_i64(v: &Value, key: &str) -> Option<i64> {
    v.get(key).and_then(|x| {
        x.as_i64().or_else(|| x.as_f64().map(|f| f as i64))
    })
}

fn get_f64(v: &Value, key: &str) -> Option<f64> {
    v.get(key).and_then(|x| x.as_f64())
}

fn get_bool(v: &Value, key: &str) -> Option<bool> {
    v.get(key).and_then(|x| x.as_bool())
}

/// Returns the array elements for a category that can have multiple rows
/// per inspection (memory modules, storage devices, GPUs). Accepts either a
/// JSON array or a single object (wrapped into a one-element vec) so a
/// slightly different frontend shape doesn't silently drop the row.
fn as_row_list(v: &Value) -> Vec<Value> {
    match v {
        Value::Array(items) => items.clone(),
        Value::Null => Vec::new(),
        other => vec![other.clone()],
    }
}

pub fn save_system_info(
    conn: &Connection,
    uuid: &str,
    serial_number: &str,
    created_at: &str,
    info: &Value,
) -> Result<(), String> {
    conn.execute(
        "
        INSERT INTO tbl_pulse_system_info
            (uuid, serial_number, device_uuid, manufacturer, model, board_serial, bios_version, created_at)
        VALUES
            (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        ON CONFLICT(uuid, serial_number) DO UPDATE SET
            device_uuid = excluded.device_uuid,
            manufacturer = excluded.manufacturer,
            model = excluded.model,
            board_serial = excluded.board_serial,
            bios_version = excluded.bios_version,
            created_at = excluded.created_at
        ",
        params![
            uuid,
            serial_number,
            get_str(info, "uuid"),
            get_str(info, "manufacturer"),
            get_str(info, "model"),
            get_str(info, "board_serial"),
            get_str(info, "bios_version"),
            created_at,
        ],
    )
    .map_err(|e| format!("system_info insert failed: {}", e))?;

    Ok(())
}

pub fn save_cpu_info(
    conn: &Connection,
    uuid: &str,
    serial_number: &str,
    created_at: &str,
    info: &Value,
) -> Result<(), String> {
    conn.execute(
        "
        INSERT INTO tbl_pulse_cpu_info
            (uuid, serial_number, manufacturer, model, architecture, sockets, cores_per_socket,
             threads, max_speed_mhz, min_speed_mhz, current_speed_mhz, cache_l1, cache_l2, cache_l3,
             virtualization, hyper_threading, created_at)
        VALUES
            (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)
        ON CONFLICT(uuid, serial_number) DO UPDATE SET
            manufacturer = excluded.manufacturer,
            model = excluded.model,
            architecture = excluded.architecture,
            sockets = excluded.sockets,
            cores_per_socket = excluded.cores_per_socket,
            threads = excluded.threads,
            max_speed_mhz = excluded.max_speed_mhz,
            min_speed_mhz = excluded.min_speed_mhz,
            current_speed_mhz = excluded.current_speed_mhz,
            cache_l1 = excluded.cache_l1,
            cache_l2 = excluded.cache_l2,
            cache_l3 = excluded.cache_l3,
            virtualization = excluded.virtualization,
            hyper_threading = excluded.hyper_threading,
            created_at = excluded.created_at
        ",
        params![
            uuid,
            serial_number,
            get_str(info, "manufacturer"),
            get_str(info, "model"),
            get_str(info, "architecture"),
            get_i64(info, "sockets"),
            get_i64(info, "cores_per_socket"),
            get_i64(info, "threads"),
            get_f64(info, "max_speed_mhz"),
            get_f64(info, "min_speed_mhz"),
            get_f64(info, "current_speed_mhz"),
            get_str(info, "cache_l1"),
            get_str(info, "cache_l2"),
            get_str(info, "cache_l3"),
            get_bool(info, "virtualization"),
            get_bool(info, "hyper_threading"),
            created_at,
        ],
    )
    .map_err(|e| format!("cpu_info insert failed: {}", e))?;

    Ok(())
}

pub fn save_memory_info(
    conn: &Connection,
    uuid: &str,
    serial_number: &str,
    created_at: &str,
    modules: &Value,
) -> Result<(), String> {
    for (idx, module) in as_row_list(modules).iter().enumerate() {
        // Descriptive only now -- NOT part of the uniqueness key. Onboard
        // memory commonly reports the same slot ("Motherboard") for every
        // module, which used to collide on the UNIQUE constraint and make
        // Postgres reject the batch upsert entirely.
        let slot = get_str(module, "slot").unwrap_or_else(|| format!("SLOT-{}", idx));
        let module_index = idx as i64;

        conn.execute(
            "
            INSERT INTO tbl_pulse_memory_info
                (uuid, serial_number, module_index, slot, bank_locator, size_mb, memory_type,
                 manufacturer, module_serial, part_number, speed_mhz, is_empty, is_onboard, created_at)
            VALUES
                (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
            ON CONFLICT(uuid, serial_number, module_index) DO UPDATE SET
                slot = excluded.slot,
                bank_locator = excluded.bank_locator,
                size_mb = excluded.size_mb,
                memory_type = excluded.memory_type,
                manufacturer = excluded.manufacturer,
                module_serial = excluded.module_serial,
                part_number = excluded.part_number,
                speed_mhz = excluded.speed_mhz,
                is_empty = excluded.is_empty,
                is_onboard = excluded.is_onboard,
                created_at = excluded.created_at
            ",
            params![
                uuid,
                serial_number,
                module_index,
                slot,
                get_str(module, "bank_locator"),
                get_i64(module, "size_mb"),
                get_str(module, "memory_type"),
                get_str(module, "manufacturer"),
                get_str(module, "serial"),
                get_str(module, "part_number"),
                get_i64(module, "speed_mhz"),
                get_bool(module, "is_empty"),
                get_bool(module, "is_onboard"),
                created_at,
            ],
        )
        .map_err(|e| format!("memory_info insert failed: {}", e))?;
    }

    Ok(())
}

pub fn save_storage_info(
    conn: &Connection,
    uuid: &str,
    serial_number: &str,
    created_at: &str,
    drives: &Value,
) -> Result<(), String> {
    for (idx, drive) in as_row_list(drives).iter().enumerate() {
        let device = get_str(drive, "device").unwrap_or_else(|| format!("DEVICE-{}", idx));
        let drive_index = idx as i64;

        conn.execute(
            "
            INSERT INTO tbl_pulse_storage_info
                (uuid, serial_number, drive_index, device, slot, model, drive_serial, firmware,
                 size_gb, transport, storage_type, health_percent, temperature_c, power_on_hours,
                 power_cycles, media_errors, critical_warning, created_at)
            VALUES
                (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)
            ON CONFLICT(uuid, serial_number, drive_index) DO UPDATE SET
                device = excluded.device,
                slot = excluded.slot,
                model = excluded.model,
                drive_serial = excluded.drive_serial,
                firmware = excluded.firmware,
                size_gb = excluded.size_gb,
                transport = excluded.transport,
                storage_type = excluded.storage_type,
                health_percent = excluded.health_percent,
                temperature_c = excluded.temperature_c,
                power_on_hours = excluded.power_on_hours,
                power_cycles = excluded.power_cycles,
                media_errors = excluded.media_errors,
                critical_warning = excluded.critical_warning,
                created_at = excluded.created_at
            ",
            params![
                uuid,
                serial_number,
                drive_index,
                device,
                get_str(drive, "slot"),
                get_str(drive, "model"),
                get_str(drive, "serial"),
                get_str(drive, "firmware"),
                get_f64(drive, "size_gb"),
                get_str(drive, "transport"),
                get_str(drive, "storage_type"),
                get_i64(drive, "health_percent"),
                get_i64(drive, "temperature_c"),
                get_i64(drive, "power_on_hours"),
                get_i64(drive, "power_cycles"),
                get_i64(drive, "media_errors"),
                get_str(drive, "critical_warning"),
                created_at,
            ],
        )
        .map_err(|e| format!("storage_info insert failed: {}", e))?;
    }

    Ok(())
}

pub fn save_battery_info(
    conn: &Connection,
    uuid: &str,
    serial_number: &str,
    created_at: &str,
    info: &Value,
) -> Result<(), String> {
    conn.execute(
        "
        INSERT INTO tbl_pulse_battery_info
            (uuid, serial_number, manufacturer, model, battery_serial, technology, status,
             cycle_count, design_capacity_mwh, full_charge_capacity_mwh, current_capacity_mwh,
             voltage_mv, health_percent, created_at)
        VALUES
            (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
        ON CONFLICT(uuid, serial_number) DO UPDATE SET
            manufacturer = excluded.manufacturer,
            model = excluded.model,
            battery_serial = excluded.battery_serial,
            technology = excluded.technology,
            status = excluded.status,
            cycle_count = excluded.cycle_count,
            design_capacity_mwh = excluded.design_capacity_mwh,
            full_charge_capacity_mwh = excluded.full_charge_capacity_mwh,
            current_capacity_mwh = excluded.current_capacity_mwh,
            voltage_mv = excluded.voltage_mv,
            health_percent = excluded.health_percent,
            created_at = excluded.created_at
        ",
        params![
            uuid,
            serial_number,
            get_str(info, "manufacturer"),
            get_str(info, "model"),
            get_str(info, "serial_number"),
            get_str(info, "technology"),
            get_str(info, "status"),
            get_i64(info, "cycle_count"),
            get_i64(info, "design_capacity_mwh"),
            get_i64(info, "full_charge_capacity_mwh"),
            get_i64(info, "current_capacity_mwh"),
            get_i64(info, "voltage_mv"),
            get_f64(info, "health_percent"),
            created_at,
        ],
    )
    .map_err(|e| format!("battery_info insert failed: {}", e))?;

    Ok(())
}

pub fn save_network_info(
    conn: &Connection,
    uuid: &str,
    serial_number: &str,
    created_at: &str,
    info: &Value,
) -> Result<(), String> {
    conn.execute(
        "
        INSERT INTO tbl_pulse_network_info
            (uuid, serial_number, wifi, wifi_friendly, wifi_mac, ethernet, ethernet_friendly,
             ethernet_mac, bluetooth, created_at)
        VALUES
            (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
        ON CONFLICT(uuid, serial_number) DO UPDATE SET
            wifi = excluded.wifi,
            wifi_friendly = excluded.wifi_friendly,
            wifi_mac = excluded.wifi_mac,
            ethernet = excluded.ethernet,
            ethernet_friendly = excluded.ethernet_friendly,
            ethernet_mac = excluded.ethernet_mac,
            bluetooth = excluded.bluetooth,
            created_at = excluded.created_at
        ",
        params![
            uuid,
            serial_number,
            get_str(info, "wifi"),
            get_str(info, "wifi_friendly"),
            get_str(info, "wifi_mac"),
            get_str(info, "ethernet"),
            get_str(info, "ethernet_friendly"),
            get_str(info, "ethernet_mac"),
            get_bool(info, "bluetooth"),
            created_at,
        ],
    )
    .map_err(|e| format!("network_info insert failed: {}", e))?;

    Ok(())
}

pub fn save_display_info(
    conn: &Connection,
    uuid: &str,
    serial_number: &str,
    created_at: &str,
    info: &Value,
) -> Result<(), String> {
    conn.execute(
        "
        INSERT INTO tbl_pulse_display_info
            (uuid, serial_number, manufacturer, model, panel_part_number, resolution, size_inches, created_at)
        VALUES
            (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        ON CONFLICT(uuid, serial_number) DO UPDATE SET
            manufacturer = excluded.manufacturer,
            model = excluded.model,
            panel_part_number = excluded.panel_part_number,
            resolution = excluded.resolution,
            size_inches = excluded.size_inches,
            created_at = excluded.created_at
        ",
        params![
            uuid,
            serial_number,
            get_str(info, "manufacturer"),
            get_str(info, "model"),
            get_str(info, "panel_part_number"),
            get_str(info, "resolution"),
            get_f64(info, "size_inches"),
            created_at,
        ],
    )
    .map_err(|e| format!("display_info insert failed: {}", e))?;

    Ok(())
}

pub fn save_gpu_info(
    conn: &Connection,
    uuid: &str,
    serial_number: &str,
    created_at: &str,
    gpus: &Value,
) -> Result<(), String> {
    for (idx, gpu) in as_row_list(gpus).iter().enumerate() {
        let bus_address = get_str(gpu, "bus_address").unwrap_or_else(|| format!("GPU-{}", idx));
        let gpu_index = idx as i64;

        conn.execute(
            "
            INSERT INTO tbl_pulse_gpu_info
                (uuid, serial_number, gpu_index, bus_address, vendor, model, driver, vram, output_resolution, created_at)
            VALUES
                (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
            ON CONFLICT(uuid, serial_number, gpu_index) DO UPDATE SET
                bus_address = excluded.bus_address,
                vendor = excluded.vendor,
                model = excluded.model,
                driver = excluded.driver,
                vram = excluded.vram,
                output_resolution = excluded.output_resolution,
                created_at = excluded.created_at
            ",
            params![
                uuid,
                serial_number,
                gpu_index,
                bus_address,
                get_str(gpu, "vendor"),
                get_str(gpu, "model"),
                get_str(gpu, "driver"),
                get_str(gpu, "vram"),
                get_str(gpu, "output_resolution"),
                created_at,
            ],
        )
        .map_err(|e| format!("gpu_info insert failed: {}", e))?;
    }

    Ok(())
}

pub fn save_camera_info(
    conn: &Connection,
    uuid: &str,
    serial_number: &str,
    created_at: &str,
    info: &Value,
) -> Result<(), String> {
    conn.execute(
        "
        INSERT INTO tbl_pulse_camera_info
            (uuid, serial_number, vendor, model, device, status, created_at)
        VALUES
            (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        ON CONFLICT(uuid, serial_number) DO UPDATE SET
            vendor = excluded.vendor,
            model = excluded.model,
            device = excluded.device,
            status = excluded.status,
            created_at = excluded.created_at
        ",
        params![
            uuid,
            serial_number,
            get_str(info, "vendor"),
            get_str(info, "model"),
            get_str(info, "device"),
            get_str(info, "status"),
            created_at,
        ],
    )
    .map_err(|e| format!("camera_info insert failed: {}", e))?;

    Ok(())
}

pub fn save_audio_info(
    conn: &Connection,
    uuid: &str,
    serial_number: &str,
    created_at: &str,
    info: &Value,
) -> Result<(), String> {
    conn.execute(
        "
        INSERT INTO tbl_pulse_audio_info
            (uuid, serial_number, codec, speaker_type, mic_type, jack_type, created_at)
        VALUES
            (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        ON CONFLICT(uuid, serial_number) DO UPDATE SET
            codec = excluded.codec,
            speaker_type = excluded.speaker_type,
            mic_type = excluded.mic_type,
            jack_type = excluded.jack_type,
            created_at = excluded.created_at
        ",
        params![
            uuid,
            serial_number,
            get_str(info, "codec"),
            get_str(info, "speaker_type"),
            get_str(info, "mic_type"),
            get_str(info, "jack_type"),
            created_at,
        ],
    )
    .map_err(|e| format!("audio_info insert failed: {}", e))?;

    Ok(())
}

/// Saves every category that was actually collected (non-null / non-empty).
/// Missing categories (e.g. no battery on a desktop) are silently skipped
/// rather than writing an empty row.
#[allow(clippy::too_many_arguments)]
pub fn save_all(
    conn: &Connection,
    uuid: &str,
    serial_number: &str,
    system_info: &Option<Value>,
    cpu_info: &Option<Value>,
    memory_info: &Option<Value>,
    storage_info: &Option<Value>,
    battery_info: &Option<Value>,
    network_info: &Option<Value>,
    display_info: &Option<Value>,
    gpu_info: &Option<Value>,
    camera_info: &Option<Value>,
    audio_info: &Option<Value>,
) -> Result<(), String> {
    use chrono::Local;
    let created_at = Local::now().format("%d/%m/%Y %H:%M:%S").to_string();

    if let Some(v) = system_info {
        if !v.is_null() {
            save_system_info(conn, uuid, serial_number, &created_at, v)?;
        }
    }
    if let Some(v) = cpu_info {
        if !v.is_null() {
            save_cpu_info(conn, uuid, serial_number, &created_at, v)?;
        }
    }
    if let Some(v) = memory_info {
        if !v.is_null() {
            save_memory_info(conn, uuid, serial_number, &created_at, v)?;
        }
    }
    if let Some(v) = storage_info {
        if !v.is_null() {
            save_storage_info(conn, uuid, serial_number, &created_at, v)?;
        }
    }
    if let Some(v) = battery_info {
        if !v.is_null() {
            save_battery_info(conn, uuid, serial_number, &created_at, v)?;
        }
    }
    if let Some(v) = network_info {
        if !v.is_null() {
            save_network_info(conn, uuid, serial_number, &created_at, v)?;
        }
    }
    if let Some(v) = display_info {
        if !v.is_null() {
            save_display_info(conn, uuid, serial_number, &created_at, v)?;
        }
    }
    if let Some(v) = gpu_info {
        if !v.is_null() {
            save_gpu_info(conn, uuid, serial_number, &created_at, v)?;
        }
    }
    if let Some(v) = camera_info {
        if !v.is_null() {
            save_camera_info(conn, uuid, serial_number, &created_at, v)?;
        }
    }
    if let Some(v) = audio_info {
        if !v.is_null() {
            save_audio_info(conn, uuid, serial_number, &created_at, v)?;
        }
    }

    Ok(())
}
