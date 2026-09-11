// Supabase sync engine (PRD §12, Table 39). Processes PENDING upload_queue rows,
// POSTs each inspection to the Supabase REST API (inspections + hardware_specs +
// grading_results + test_results + devices), and updates queue/inspection status.

use rusqlite::{Connection, params};
use serde_json::{Map, Value};
use serde::Serialize;
use chrono::Local;
use std::time::Duration;

use crate::database::settings::{get_setting, upsert_setting};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncSummary {
    pub processed: i64,
    pub uploaded: i64,
    pub failed: i64,
    pub message: String,
}

/// Pointer helper — returns an owned JSON value or Null.
fn g(v: &Value, pointer: &str) -> Value {
    v.pointer(pointer).cloned().unwrap_or(Value::Null)
}

fn s(value: &str) -> Value {
    Value::String(value.to_string())
}

fn str_at<'a>(v: &'a Value, pointer: &str) -> &'a str {
    v.pointer(pointer).and_then(|x| x.as_str()).unwrap_or("")
}

fn obj(pairs: Vec<(&str, Value)>) -> Value {
    let mut m = Map::new();
    for (k, val) in pairs {
        m.insert(k.to_string(), val);
    }
    Value::Object(m)
}

fn post_upsert(
    client: &reqwest::blocking::Client,
    base_url: &str,
    key: &str,
    table: &str,
    on_conflict: &str,
    body: &Value,
) -> Result<(), String> {
    let url = format!(
        "{}/rest/v1/{}?on_conflict={}",
        base_url.trim_end_matches('/'),
        table,
        on_conflict
    );

    let resp = client
        .post(&url)
        .header("apikey", key)
        .header("Authorization", format!("Bearer {}", key))
        .header("Content-Type", "application/json")
        .header("Prefer", "resolution=merge-duplicates,return=minimal")
        .json(body)
        .send()
        .map_err(|e| e.to_string())?;

    let status = resp.status();
    if status.is_success() {
        Ok(())
    } else {
        let text = resp.text().unwrap_or_default();
        Err(format!("HTTP {} from {}: {}", status.as_u16(), table, text))
    }
}

/// Plain insert (no on_conflict — does not require a unique constraint).
fn post_insert(
    client: &reqwest::blocking::Client,
    base_url: &str,
    key: &str,
    table: &str,
    body: &Value,
) -> Result<(), String> {
    let url = format!("{}/rest/v1/{}", base_url.trim_end_matches('/'), table);
    let resp = client
        .post(&url)
        .header("apikey", key)
        .header("Authorization", format!("Bearer {}", key))
        .header("Content-Type", "application/json")
        .header("Prefer", "return=minimal")
        .json(body)
        .send()
        .map_err(|e| e.to_string())?;

    let status = resp.status();
    if status.is_success() {
        Ok(())
    } else {
        let text = resp.text().unwrap_or_default();
        Err(format!("HTTP {} from {}: {}", status.as_u16(), table, text))
    }
}

/// Delete rows matching a PostgREST filter (e.g. "inspection_uuid=eq.<uuid>").
fn delete_rows(
    client: &reqwest::blocking::Client,
    base_url: &str,
    key: &str,
    table: &str,
    filter: &str,
) -> Result<(), String> {
    let url = format!(
        "{}/rest/v1/{}?{}",
        base_url.trim_end_matches('/'),
        table,
        filter
    );
    let resp = client
        .delete(&url)
        .header("apikey", key)
        .header("Authorization", format!("Bearer {}", key))
        .header("Prefer", "return=minimal")
        .send()
        .map_err(|e| e.to_string())?;

    let status = resp.status();
    if status.is_success() {
        Ok(())
    } else {
        let text = resp.text().unwrap_or_default();
        Err(format!("HTTP {} from {}: {}", status.as_u16(), table, text))
    }
}

/// Idempotently replace a per-inspection child row: delete any existing rows for
/// the inspection, then insert. Avoids needing a unique(inspection_uuid)
/// constraint and stays correct on retries.
fn replace_child(
    client: &reqwest::blocking::Client,
    base_url: &str,
    key: &str,
    table: &str,
    uuid: &str,
    body: &Value,
) -> Result<(), String> {
    delete_rows(
        client,
        base_url,
        key,
        table,
        &format!("inspection_uuid=eq.{}", uuid),
    )?;
    post_insert(client, base_url, key, table, body)
}

/// Push the 10 hardware categories (already embedded in the inspection JSON
/// under /inventory) into their own Supabase tables, mirroring the local
/// SQLite report tables (see database/sqlite.rs). Single-object categories
/// are upserted as one row; memory/storage/gpu can have multiple entries
/// per inspection, so they're posted as an array with a composite
/// on_conflict key (uuid, serial_number, <slot|device|bus_address>).
fn upload_hardware_categories(
    client: &reqwest::blocking::Client,
    base_url: &str,
    key: &str,
    uuid: &str,
    serial: &str,
    inv: &Value,
) -> Result<(), String> {
    let system = g(inv, "/system");
    if !system.is_null() {
        let row = obj(vec![
            ("uuid", s(uuid)),
            ("serial_number", s(serial)),
            ("device_uuid", g(&system, "/uuid")),
            ("manufacturer", g(&system, "/manufacturer")),
            ("model", g(&system, "/model")),
            ("board_serial", g(&system, "/board_serial")),
            ("bios_version", g(&system, "/bios_version")),
        ]);
        post_upsert(client, base_url, key, "tbl_pulse_system_info", "uuid,serial_number", &row)?;
    }

    let cpu = g(inv, "/cpu");
    if !cpu.is_null() {
        let row = obj(vec![
            ("uuid", s(uuid)),
            ("serial_number", s(serial)),
            ("manufacturer", g(&cpu, "/manufacturer")),
            ("model", g(&cpu, "/model")),
            ("architecture", g(&cpu, "/architecture")),
            ("sockets", g(&cpu, "/sockets")),
            ("cores_per_socket", g(&cpu, "/cores_per_socket")),
            ("threads", g(&cpu, "/threads")),
            ("max_speed_mhz", g(&cpu, "/max_speed_mhz")),
            ("min_speed_mhz", g(&cpu, "/min_speed_mhz")),
            ("current_speed_mhz", g(&cpu, "/current_speed_mhz")),
            ("cache_l1", g(&cpu, "/cache_l1")),
            ("cache_l2", g(&cpu, "/cache_l2")),
            ("cache_l3", g(&cpu, "/cache_l3")),
            ("virtualization", g(&cpu, "/virtualization")),
            ("hyper_threading", g(&cpu, "/hyper_threading")),
        ]);
        post_upsert(client, base_url, key, "tbl_pulse_cpu_info", "uuid,serial_number", &row)?;
    }

    let battery = g(inv, "/battery");
    if !battery.is_null() {
        let row = obj(vec![
            ("uuid", s(uuid)),
            ("serial_number", s(serial)),
            ("manufacturer", g(&battery, "/manufacturer")),
            ("model", g(&battery, "/model")),
            ("battery_serial", g(&battery, "/serial_number")),
            ("technology", g(&battery, "/technology")),
            ("status", g(&battery, "/status")),
            ("cycle_count", g(&battery, "/cycle_count")),
            ("design_capacity_mwh", g(&battery, "/design_capacity_mwh")),
            ("full_charge_capacity_mwh", g(&battery, "/full_charge_capacity_mwh")),
            ("current_capacity_mwh", g(&battery, "/current_capacity_mwh")),
            ("voltage_mv", g(&battery, "/voltage_mv")),
            ("health_percent", g(&battery, "/health_percent")),
        ]);
        post_upsert(client, base_url, key, "tbl_pulse_battery_info", "uuid,serial_number", &row)?;
    }

    let network = g(inv, "/network");
    if !network.is_null() {
        let row = obj(vec![
            ("uuid", s(uuid)),
            ("serial_number", s(serial)),
            ("wifi", g(&network, "/wifi")),
            ("wifi_friendly", g(&network, "/wifi_friendly")),
            ("wifi_mac", g(&network, "/wifi_mac")),
            ("ethernet", g(&network, "/ethernet")),
            ("ethernet_friendly", g(&network, "/ethernet_friendly")),
            ("ethernet_mac", g(&network, "/ethernet_mac")),
            ("bluetooth", g(&network, "/bluetooth")),
        ]);
        post_upsert(client, base_url, key, "tbl_pulse_network_info", "uuid,serial_number", &row)?;
    }

    let display = g(inv, "/display");
    if !display.is_null() {
        let row = obj(vec![
            ("uuid", s(uuid)),
            ("serial_number", s(serial)),
            ("manufacturer", g(&display, "/manufacturer")),
            ("model", g(&display, "/model")),
            ("panel_part_number", g(&display, "/panel_part_number")),
            ("resolution", g(&display, "/resolution")),
            ("size_inches", g(&display, "/size_inches")),
        ]);
        post_upsert(client, base_url, key, "tbl_pulse_display_info", "uuid,serial_number", &row)?;
    }

    let camera = g(inv, "/camera");
    if !camera.is_null() {
        let row = obj(vec![
            ("uuid", s(uuid)),
            ("serial_number", s(serial)),
            ("vendor", g(&camera, "/vendor")),
            ("model", g(&camera, "/model")),
            ("device", g(&camera, "/device")),
            ("status", g(&camera, "/status")),
        ]);
        post_upsert(client, base_url, key, "tbl_pulse_camera_info", "uuid,serial_number", &row)?;
    }

    let audio = g(inv, "/audio");
    if !audio.is_null() {
        let row = obj(vec![
            ("uuid", s(uuid)),
            ("serial_number", s(serial)),
            ("codec", g(&audio, "/codec")),
            ("speaker_type", g(&audio, "/speaker_type")),
            ("mic_type", g(&audio, "/mic_type")),
            ("jack_type", g(&audio, "/jack_type")),
        ]);
        post_upsert(client, base_url, key, "tbl_pulse_audio_info", "uuid,serial_number", &row)?;
    }

    if let Value::Array(modules) = g(inv, "/memory") {
        if !modules.is_empty() {
            let rows: Vec<Value> = modules
                .iter()
                .enumerate()
                .map(|(idx, m)| {
                    // Descriptive only -- NOT part of the uniqueness key.
                    // Onboard memory commonly reports the same slot
                    // ("Motherboard") for every module, which used to
                    // collide within a single batch upsert.
                    let slot = m
                        .get("slot")
                        .and_then(|x| x.as_str())
                        .filter(|s| !s.is_empty())
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| format!("SLOT-{}", idx));
                    obj(vec![
                        ("uuid", s(uuid)),
                        ("serial_number", s(serial)),
                        ("module_index", Value::from(idx as i64)),
                        ("slot", s(&slot)),
                        ("bank_locator", g(m, "/bank_locator")),
                        ("size_mb", g(m, "/size_mb")),
                        ("memory_type", g(m, "/memory_type")),
                        ("manufacturer", g(m, "/manufacturer")),
                        ("module_serial", g(m, "/serial")),
                        ("part_number", g(m, "/part_number")),
                        ("speed_mhz", g(m, "/speed_mhz")),
                        ("is_empty", g(m, "/is_empty")),
                        ("is_onboard", g(m, "/is_onboard")),
                    ])
                })
                .collect();
            post_upsert(
                client,
                base_url,
                key,
                "tbl_pulse_memory_info",
                "uuid,serial_number,module_index",
                &Value::Array(rows),
            )?;
        }
    }

    if let Value::Array(drives) = g(inv, "/storage") {
        if !drives.is_empty() {
            let rows: Vec<Value> = drives
                .iter()
                .enumerate()
                .map(|(idx, d)| {
                    let device = d
                        .get("device")
                        .and_then(|x| x.as_str())
                        .filter(|s| !s.is_empty())
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| format!("DEVICE-{}", idx));
                    obj(vec![
                        ("uuid", s(uuid)),
                        ("serial_number", s(serial)),
                        ("drive_index", Value::from(idx as i64)),
                        ("device", s(&device)),
                        ("slot", g(d, "/slot")),
                        ("model", g(d, "/model")),
                        ("drive_serial", g(d, "/serial")),
                        ("firmware", g(d, "/firmware")),
                        ("size_gb", g(d, "/size_gb")),
                        ("transport", g(d, "/transport")),
                        ("storage_type", g(d, "/storage_type")),
                        ("health_percent", g(d, "/health_percent")),
                        ("temperature_c", g(d, "/temperature_c")),
                        ("power_on_hours", g(d, "/power_on_hours")),
                        ("power_cycles", g(d, "/power_cycles")),
                        ("media_errors", g(d, "/media_errors")),
                        ("critical_warning", g(d, "/critical_warning")),
                    ])
                })
                .collect();
            post_upsert(
                client,
                base_url,
                key,
                "tbl_pulse_storage_info",
                "uuid,serial_number,drive_index",
                &Value::Array(rows),
            )?;
        }
    }

    if let Value::Array(gpus) = g(inv, "/gpu") {
        if !gpus.is_empty() {
            let rows: Vec<Value> = gpus
                .iter()
                .enumerate()
                .map(|(idx, gpu)| {
                    let bus_address = gpu
                        .get("bus_address")
                        .and_then(|x| x.as_str())
                        .filter(|s| !s.is_empty())
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| format!("GPU-{}", idx));
                    obj(vec![
                        ("uuid", s(uuid)),
                        ("serial_number", s(serial)),
                        ("gpu_index", Value::from(idx as i64)),
                        ("bus_address", s(&bus_address)),
                        ("vendor", g(gpu, "/vendor")),
                        ("model", g(gpu, "/model")),
                        ("driver", g(gpu, "/driver")),
                        ("vram", g(gpu, "/vram")),
                        ("output_resolution", g(gpu, "/output_resolution")),
                    ])
                })
                .collect();
            post_upsert(
                client,
                base_url,
                key,
                "tbl_pulse_gpu_info",
                "uuid,serial_number,gpu_index",
                &Value::Array(rows),
            )?;
        }
    }

    Ok(())
}

fn upload_one(
    client: &reqwest::blocking::Client,
    base_url: &str,
    key: &str,
    uuid: &str,
    json_text: &str,
) -> Result<(), String> {
    let v: Value =
        serde_json::from_str(json_text).map_err(|e| e.to_string())?;
    let inv = g(&v, "/inventory");

    let raw_serial = str_at(&inv, "/system/serial_number");
    let manufacturer = str_at(&inv, "/system/manufacturer");
    let model = str_at(&inv, "/system/model");
    let dmi_uuid = str_at(&inv, "/system/uuid");

    // Resolve a serial used consistently across all tables for linking. When the
    // hardware reports no serial (e.g. VMs / WSL), fall back to a stable
    // per-inspection identity so the device row is still created and joinable.
    let serial: String = if raw_serial.trim().is_empty() {
        format!("UNKNOWN-{}", uuid.chars().take(8).collect::<String>())
    } else {
        raw_serial.to_string()
    };

    // 1) inspections — full payload + extracted key fields
    let inspections_row = obj(vec![
        ("uuid", s(uuid)),
        ("usb_id", g(&v, "/usb_id")),
        ("cly_no", g(&v, "/cly_no")),
        ("lot_name", g(&v, "/lot_name")),
        ("inspector", g(&v, "/inspector")),
        ("serial_number", s(&serial)),
        ("manufacturer", s(manufacturer)),
        ("model", s(model)),
        ("grade", g(&v, "/grade")),
        ("battery_health", g(&v, "/battery_health")),
        ("inspected_at", g(&v, "/timestamp")),
        ("uploaded", Value::Bool(true)),
        ("json_data", v.clone()),
    ]);
    post_upsert(client, base_url, key, "tbl_pulse_inspections", "uuid", &inspections_row)?;

    // 2) devices — normalized identity (always upserted)
    let device_row = obj(vec![
        ("serial_number", s(&serial)),
        ("manufacturer", s(manufacturer)),
        ("model", s(model)),
        ("dmi_uuid", s(dmi_uuid)),
    ]);
    post_upsert(client, base_url, key, "tbl_pulse_devices", "serial_number", &device_row)?;

    // 3) hardware_specs — System Scan, one JSONB column per collector
    let hw_row = obj(vec![
        ("inspection_uuid", s(uuid)),
        ("serial_number", s(&serial)),
        ("system", g(&inv, "/system")),
        ("cpu", g(&inv, "/cpu")),
        ("memory", g(&inv, "/memory")),
        ("storage", g(&inv, "/storage")),
        ("battery", g(&inv, "/battery")),
        ("bios", g(&inv, "/bios")),
        ("gpu", g(&inv, "/gpu")),
        ("display", g(&inv, "/display")),
        ("network", g(&inv, "/network")),
        ("audio", g(&inv, "/audio")),
        ("camera", g(&inv, "/camera")),
    ]);
    replace_child(client, base_url, key, "tbl_pulse_hardware_specs", uuid, &hw_row)?;

    // 3b) mirror the same 10 categories into their own normalized tables
    // (system_info, cpu_info, memory_info, ...) alongside the JSONB blob
    // above, matching the local SQLite report tables.
    upload_hardware_categories(client, base_url, key, uuid, &serial, &inv)?;

    // 4) grading_results
    let gr_row = obj(vec![
        ("inspection_uuid", s(uuid)),
        ("serial_number", s(&serial)),
        ("lcd_status", g(&v, "/grading/lcd_status")),
        ("lcd_defects", g(&v, "/grading/lcd_defects")),
        ("top_cover_status", g(&v, "/grading/top_cover_status")),
        ("top_cover_defects", g(&v, "/grading/top_cover_defects")),
        ("bezel_status", g(&v, "/grading/bezel_status")),
        ("bezel_defects", g(&v, "/grading/bezel_defects")),
        ("palmrest_status", g(&v, "/grading/palmrest_status")),
        ("palmrest_defects", g(&v, "/grading/palmrest_defects")),
        ("bottom_cover_status", g(&v, "/grading/bottom_cover_status")),
        ("bottom_cover_defects", g(&v, "/grading/bottom_cover_defects")),
        ("keyboard_status", g(&v, "/grading/keyboard_status")),
        ("keyboard_defects", g(&v, "/grading/keyboard_defects")),
        ("touchpad_status", g(&v, "/grading/touchpad_status")),
        ("remarks", g(&v, "/grading/remarks")),
    ]);
    replace_child(client, base_url, key, "tbl_pulse_grading_results", uuid, &gr_row)?;

    // 5) test_results
    let tr_row = obj(vec![
        ("inspection_uuid", s(uuid)),
        ("serial_number", s(&serial)),
        ("speaker_test", g(&v, "/speaker_test/result")),
        ("webcam_test", g(&v, "/webcam_test/result")),
        ("keyboard_test", g(&v, "/keyboard_test/result")),
        ("keyboard_unique_keys", g(&v, "/keyboard_test/unique_keys")),
        ("touchpad_test", g(&v, "/touchpad_test/result")),
        ("battery_assessment", g(&v, "/battery_assessment/result")),
    ]);
    replace_child(client, base_url, key, "tbl_pulse_test_results", uuid, &tr_row)?;

    Ok(())
}

/// Process all PENDING upload_queue rows.
pub fn sync_pending(conn: &Connection) -> Result<SyncSummary, String> {
    let base_url = get_setting(conn, "supabase_url");
    let key = get_setting(conn, "supabase_key");

    if base_url.trim().is_empty() || key.trim().is_empty() {
        return Err("Supabase URL/key not configured".to_string());
    }

    // Gather pending items: (queue_id, uuid, json_data)
    let mut pending: Vec<(i64, String, String)> = Vec::new();
    {
        let mut stmt = conn
            .prepare(
                "SELECT q.id, q.inspection_uuid, i.json_data
                 FROM tbl_pulse_upload_queue q
                 JOIN tbl_pulse_inspections i ON i.uuid = q.inspection_uuid
                 WHERE q.status = 'PENDING'
                 ORDER BY q.id ASC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })
            .map_err(|e| e.to_string())?;
        for r in rows {
            pending.push(r.map_err(|e| e.to_string())?);
        }
    }

    // Run all blocking HTTP on a dedicated OS thread. reqwest::blocking cannot be
    // called from within Tauri's tokio runtime (it would panic with "Cannot start
    // a runtime from within a runtime"), so we isolate it here. The thread does no
    // DB work — it only returns per-item results which we apply below.
    let base = base_url.clone();
    let api_key = key.clone();
    let items = pending.clone();

    let results: Vec<(i64, String, Result<(), String>)> = std::thread::spawn(
        move || -> Result<Vec<(i64, String, Result<(), String>)>, String> {
            let client = reqwest::blocking::Client::builder()
                .timeout(Duration::from_secs(20))
                .build()
                .map_err(|e| e.to_string())?;

            let mut out = Vec::new();
            for (qid, uuid, json_text) in &items {
                let r = upload_one(&client, &base, &api_key, uuid, json_text);
                out.push((*qid, uuid.clone(), r));
            }
            Ok(out)
        },
    )
    .join()
    .map_err(|_| "sync worker thread panicked".to_string())??;

    let mut uploaded = 0i64;
    let mut failed = 0i64;
    let mut last_error = String::new();

    for (qid, uuid, result) in &results {
        match result {
            Ok(()) => {
                let now = Local::now().format("%d/%m/%Y %H:%M:%S").to_string();
                let _ = conn.execute(
                    "UPDATE tbl_pulse_upload_queue SET status='UPLOADED', uploaded_at=?1 WHERE id=?2",
                    params![now, qid],
                );
                let _ = conn.execute(
                    "UPDATE tbl_pulse_inspections SET uploaded=1 WHERE uuid=?1",
                    params![uuid],
                );
                uploaded += 1;
            }
            Err(e) => {
                eprintln!("Supabase upload failed for {}: {}", uuid, e);
                last_error = e.clone();
                let _ = conn.execute(
                    "UPDATE tbl_pulse_upload_queue SET status='FAILED', retry_count=retry_count+1 WHERE id=?1",
                    params![qid],
                );
                failed += 1;
            }
        }
    }

    if uploaded > 0 {
        let now = Local::now().format("%d/%m/%Y %H:%M:%S").to_string();
        let _ = upsert_setting(conn, "last_sync", &now);
    }

    let message = if pending.is_empty() {
        "Nothing to sync".to_string()
    } else if failed > 0 {
        format!("{} uploaded, {} failed — {}", uploaded, failed, last_error)
    } else {
        format!("{} uploaded, {} failed", uploaded, failed)
    };

    Ok(SyncSummary {
        processed: pending.len() as i64,
        uploaded,
        failed,
        message,
    })
}
