mod inventory;
mod models;
mod health;
mod diagnostics;
mod grading;
mod inspection;
mod database;
mod upload;
mod lot;
mod inspector;
mod dashboard;
mod sudo;
mod audio;
mod wifi;
mod power;

use crate::wifi::{WifiNetwork, WifiStatus};

use crate::models::device::{
    SystemInfo,
    CpuInfo,
    MemoryModule,
    StorageDevice,
};

use crate::models::device::BatteryInfo;
use crate::models::device::GpuInfo;
use crate::models::device::DisplayInfo;
use crate::models::device::NetworkInfo;
use crate::models::device::CameraInfo;
use crate::models::device::AudioInfo;
use tauri::Manager;
use std::sync::Mutex;

#[tauri::command]
fn get_app_info() -> String {
    "PULSE 4.0 Ready".to_string()
}

#[tauri::command]
fn get_system_info() -> Result<SystemInfo, String> {
    match inventory::system::collect() {
        Ok(info) => {
            println!("SUCCESS: {:?}", info);
            Ok(info)
        }
        Err(e) => {
            println!("ERROR: {}", e);
            Err(format!("System collection failed: {}", e))
        }
    }
}

#[tauri::command]
fn get_cpu_info() -> Result<CpuInfo, String> {
    let cpu = inventory::cpu::collect()
        .map_err(|e| e.to_string())?;

    println!("CPU INFO: {:?}", cpu);

    Ok(cpu)
}

#[tauri::command]
fn get_battery_info() -> Result<Option<BatteryInfo>, String> {

    let battery =
        inventory::battery::collect()
            .map_err(|e| e.to_string())?;

    println!(
        "BATTERY INFO: {:?}",
        battery
    );

    Ok(battery)
}

#[tauri::command]
fn get_gpu_info() -> Result<Vec<GpuInfo>, String> {

    let gpu =
        inventory::gpu::collect()
            .map_err(|e| e.to_string())?;

    println!(
        "GPU INFO: {:?}",
        gpu
    );

    Ok(gpu)
}

#[tauri::command]
fn get_display_info() -> Result<Option<DisplayInfo>, String> {

    let display =
        inventory::display::collect()
            .map_err(|e| e.to_string())?;

    println!(
        "DISPLAY INFO: {:?}",
        display
    );

    Ok(display)
}

#[tauri::command]
fn get_network_info() -> Result<Option<NetworkInfo>, String> {

    let network =
        inventory::network::collect()
            .map_err(|e| e.to_string())?;

    println!(
        "NETWORK INFO: {:?}",
        network
    );

    Ok(network)
}

#[tauri::command]
async fn scan_wifi_networks() -> Result<Vec<WifiNetwork>, String> {
    tokio::task::spawn_blocking(wifi::scan)
        .await
        .map_err(|e| format!("Wifi scan task failed: {}", e))
        .and_then(|inner| inner.map_err(|e| e.to_string()))
}

#[tauri::command]
async fn connect_wifi_network(
    ssid: String,
    password: Option<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || wifi::connect(&ssid, password.as_deref()))
        .await
        .map_err(|e| format!("Wifi connect task failed: {}", e))
        .and_then(|inner| inner.map_err(|e| e.to_string()))
}

#[tauri::command]
async fn disconnect_wifi_network() -> Result<(), String> {
    tokio::task::spawn_blocking(wifi::disconnect)
        .await
        .map_err(|e| format!("Wifi disconnect task failed: {}", e))
        .and_then(|inner| inner.map_err(|e| e.to_string()))
}

#[tauri::command]
async fn get_wifi_status() -> Result<WifiStatus, String> {
    tokio::task::spawn_blocking(wifi::status)
        .await
        .map_err(|e| format!("Wifi status task failed: {}", e))
        .and_then(|inner| inner.map_err(|e| e.to_string()))
}

/// Fetches the active PULSE app version (tbl_pulse_app_ver, app_version
/// where active_yn = true). Always attempts the live Supabase lookup first
/// — rather than gating on nmcli's reported Wi-Fi state (nmcli doesn't exist
/// on non-Linux dev machines, and even on the target hardware "associated
/// with an AP" isn't the same thing as "can actually reach Supabase") — and
/// falls back to the local SQLite cache (database::app_version) on any
/// failure: no network, DNS failure, Supabase unreachable, timeout, etc.
/// Every successful Supabase fetch re-syncs the local cache so the most
/// recent value is always available offline.
#[tauri::command]
async fn get_pulse_app_version(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<String, String> {
    let (base_url, key) = {
        let conn = state
            .lock()
            .map_err(|e| format!("db lock poisoned: {}", e))?;
        (
            database::settings::get_setting(&conn, "supabase_url"),
            database::settings::get_setting(&conn, "supabase_key"),
        )
    };

    let remote = tokio::task::spawn_blocking(move || {
        upload::app_version::fetch_active_app_version(&base_url, &key)
    })
    .await
    .map_err(|e| format!("App version fetch task failed: {}", e))?;

    match remote {
        Ok(version) => {
            // Sync: cache the freshly fetched value locally so it's still
            // available the next time the network is down.
            let conn = state
                .lock()
                .map_err(|e| format!("db lock poisoned: {}", e))?;
            if let Err(e) = database::app_version::save_local_app_version(&conn, &version) {
                eprintln!("Failed to cache app version locally: {}", e);
            }
            Ok(version)
        }
        Err(e) => {
            eprintln!(
                "Supabase app version fetch failed, falling back to local cache: {}",
                e
            );
            let conn = state
                .lock()
                .map_err(|e| format!("db lock poisoned: {}", e))?;
            database::app_version::get_local_app_version(&conn).ok_or_else(|| {
                "No app version available (offline and no cached value)".to_string()
            })
        }
    }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct AppUpdateInfo {
    current_version: String,
    new_version: String,
}

/// Checks whether Supabase's active app_version (tbl_pulse_app_ver) differs
/// from what this specific device last recorded as installed
/// (tbl_pulse_settings key "installed_app_version"). Meant to be called once
/// when the app finishes loading.
///
/// Returns `None` when there's nothing to report: offline/unreachable, the
/// versions already match, or this is the very first check this device has
/// ever been able to make (in which case the current Supabase value is
/// silently adopted as "installed" instead of prompting a freshly-deployed
/// device to update itself). Returns `Some(AppUpdateInfo)` only when a real
/// mismatch is found, for the frontend to prompt the user.
#[tauri::command]
async fn check_app_update(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<Option<AppUpdateInfo>, String> {
    let (base_url, key, installed) = {
        let conn = state
            .lock()
            .map_err(|e| format!("db lock poisoned: {}", e))?;
        (
            database::settings::get_setting(&conn, "supabase_url"),
            database::settings::get_setting(&conn, "supabase_key"),
            database::settings::get_setting(&conn, "installed_app_version"),
        )
    };

    let remote = tokio::task::spawn_blocking(move || {
        upload::app_version::fetch_active_app_version(&base_url, &key)
    })
    .await
    .map_err(|e| format!("Update check task failed: {}", e))?;

    let remote_version = match remote {
        Ok(v) => v,
        // Offline / Supabase unreachable — nothing to report, not an error
        // worth surfacing on every app load.
        Err(_) => return Ok(None),
    };

    if installed.trim().is_empty() {
        let conn = state
            .lock()
            .map_err(|e| format!("db lock poisoned: {}", e))?;
        let _ =
            database::settings::upsert_setting(&conn, "installed_app_version", &remote_version);
        return Ok(None);
    }

    if installed == remote_version {
        return Ok(None);
    }

    Ok(Some(AppUpdateInfo {
        current_version: installed,
        new_version: remote_version,
    }))
}

/// Downloads the new udiag4 build from Supabase Storage
/// (PULSE_Applications/udiag4), atomically replaces the running executable
/// on the pendrive, records `new_version` as installed, then relaunches: a
/// fresh process is spawned at the same (now-updated) path and this process
/// exits immediately after, handing the kiosk display over to the new one.
#[tauri::command]
async fn apply_app_update(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    new_version: String,
) -> Result<(), String> {
    let (base_url, key) = {
        let conn = state
            .lock()
            .map_err(|e| format!("db lock poisoned: {}", e))?;
        (
            database::settings::get_setting(&conn, "supabase_url"),
            database::settings::get_setting(&conn, "supabase_key"),
        )
    };

    let current_exe = std::env::current_exe()
        .map_err(|e| format!("Could not determine the running executable's path: {}", e))?;

    let exe_for_task = current_exe.clone();
    tokio::task::spawn_blocking(move || {
        upload::self_update::download_and_replace(&base_url, &key, &exe_for_task)
    })
    .await
    .map_err(|e| format!("Update task failed: {}", e))??;

    {
        let conn = state
            .lock()
            .map_err(|e| format!("db lock poisoned: {}", e))?;
        let _ = database::settings::upsert_setting(&conn, "installed_app_version", &new_version);
    }

    // Relaunch: current_exe now points at the newly downloaded build, so a
    // fresh process at the same path runs it. Spawn the replacement before
    // tearing this one down so the kiosk display hands over cleanly.
    std::process::Command::new(&current_exe)
        .spawn()
        .map_err(|e| format!("Failed to relaunch after update: {}", e))?;

    std::process::exit(0);
}

#[tauri::command]
async fn shutdown_system() -> Result<(), String> {
    tokio::task::spawn_blocking(power::shutdown)
        .await
        .map_err(|e| format!("Shutdown task failed: {}", e))
        .and_then(|inner| inner.map_err(|e| e.to_string()))
}

#[tauri::command]
fn get_camera_info() -> Result<Option<CameraInfo>, String> {

    let camera =
        inventory::camera::collect()
            .map_err(|e| e.to_string())?;

    println!(
        "CAMERA INFO: {:?}",
        camera
    );

    Ok(camera)
}

#[tauri::command]fn get_audio_info() -> Result<Option<AudioInfo>, String> {
    let audio = inventory::audio::collect()
        .map_err(|e| e.to_string())?;

    println!("AUDIO INFO: {:?}", audio);

    Ok(audio)
}

#[tauri::command]fn get_memory_info() -> Result<Vec<MemoryModule>, String> {
    let memory = inventory::memory::collect()
        .map_err(|e| e.to_string())?;

    println!("MEMORY INFO: {:?}", memory);

    Ok(memory)
}

#[tauri::command]
async fn start_webcam_test(handle: tauri::AppHandle) -> Result<(), String> {
    // Pulse runs in kiosk mode with the main window pinned "always on top",
    // which otherwise keeps the ffplay preview window stuck behind it.
    // Drop the always-on-top pin while the preview is open so the OS/window
    // manager can bring ffplay to the front, then restore kiosk mode once
    // the preview window is closed (success or failure).
    let main_window = handle.get_webview_window("main");
    if let Some(window) = &main_window {
        let _ = window.set_always_on_top(false);
    }

    let result = tokio::task::spawn_blocking(diagnostics::webcam::start_test)
        .await
        .map_err(|e| format!("Webcam test task failed: {}", e))
        .and_then(|inner| inner);

    if let Some(window) = &main_window {
        let _ = window.set_always_on_top(true);
        let _ = window.set_focus();
    }

    result
}

#[tauri::command]
async fn play_speaker_test(
    handle: tauri::AppHandle,
) -> Result<u64, String> {
    let primary_resource = handle
        .path()
        .resolve(
            "resources/audio/speaker_test.wav",
            tauri::path::BaseDirectory::Resource,
        )
        .ok();

    // The bundled resource path is tried first; if that fails (e.g. on a
    // USB/live-boot environment), fall back to common runtime locations.
    let wav_path = audio::resolve_speaker_test_wav(primary_resource.as_deref())?;
    let duration = audio::estimate_wav_duration(&wav_path)?;

    // Spawn playback in the background so the command returns immediately.
    // This lets the UI start its progress bar at the same time as the audio.
    let playback_path = wav_path.clone();
    tokio::task::spawn_blocking(move || {
        if let Err(e) = audio::play_wav_blocking(&playback_path) {
            eprintln!("Speaker test playback error: {}", e);
        }
    });

    Ok(duration.as_millis() as u64)
}

#[tauri::command]
async fn get_storage_info(
    on_progress: tauri::ipc::Channel<serde_json::Value>,
) -> Result<Vec<StorageDevice>, String> {
    // Blocking hardware commands must never occupy Tauri's UI thread.
    // JoinError (including worker panic) rejects IPC so the frontend finally runs.
    tokio::task::spawn_blocking(move || {
        inventory::storage::collect_with_progress(|drives| {
            let channel = &on_progress;
            {
                match serde_json::to_value(drives) {
                    Ok(value) => {
                        if channel.send(value).is_err() {
                            eprintln!("[PULSE][Storage] progress receiver unavailable");
                        }
                    }
                    Err(e) => eprintln!("[PULSE][Storage] progress serialization failed: {}", e),
                }
            }
        }).map_err(|e| e.to_string())
    }).await.map_err(|e| format!("Storage worker failed: {}", e))?
}

#[tauri::command]
fn create_lot(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    lot_name: String,
    customer: String,
    location: String,
) -> Result<i64, String> {
    let conn = state
        .lock()
        .map_err(|e| format!("db lock poisoned: {}", e))?;

    let id = lot::repository::insert_lot(
        &conn,
        &lot_name,
        &customer,
        &location,
    )?;

    // Best-effort push to Supabase so tbl_pulse_lots isn't only ever
    // populated locally (see upload/lots.rs).
    if let Ok(Some(lot)) = lot::repository::get_lot(&conn, id) {
        upload::lots::push_lot(&conn, &lot);
    }

    Ok(id)
}

#[tauri::command]
fn get_lots(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<Vec<lot::model::LotRow>, String> {
    let conn = state
        .lock()
        .map_err(|e| format!("db lock poisoned: {}", e))?;

    lot::repository::get_lots(&conn)
}

#[tauri::command]
fn update_lot(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    id: i64,
    lot_name: String,
    customer: String,
    location: String,
) -> Result<(), String> {
    let conn = state
        .lock()
        .map_err(|e| format!("db lock poisoned: {}", e))?;

    lot::repository::update_lot(
        &conn,
        id,
        &lot_name,
        &customer,
        &location,
    )?;

    if let Ok(Some(lot)) = lot::repository::get_lot(&conn, id) {
        upload::lots::push_lot(&conn, &lot);
    }

    Ok(())
}

#[tauri::command]
fn delete_lot(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    id: i64,
) -> Result<(), String> {
    let conn = state
        .lock()
        .map_err(|e| format!("db lock poisoned: {}", e))?;

    lot::repository::delete_lot(&conn, id)
}

#[tauri::command]
fn archive_lot(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    id: i64,
) -> Result<(), String> {
    let conn = state
        .lock()
        .map_err(|e| format!("db lock poisoned: {}", e))?;

    // PRD LOT statuses are ACTIVE / COMPLETED / CANCELLED; "archive" maps to
    // CANCELLED.
    lot::repository::set_lot_status(&conn, id, "CANCELLED")?;

    if let Ok(Some(lot)) = lot::repository::get_lot(&conn, id) {
        upload::lots::push_lot(&conn, &lot);
    }

    Ok(())
}

#[tauri::command]
fn create_inspector(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    inspector_name: String,
    employee_id: String,
    email: String,
    phone: String,
) -> Result<i64, String> {
    let conn = state
        .lock()
        .map_err(|e| format!("db lock poisoned: {}", e))?;

    let id = inspector::repository::insert_inspector(
        &conn,
        &inspector_name,
        &employee_id,
        &email,
        &phone,
    )?;

    // Best-effort push to Supabase so tbl_pulse_inspectors isn't only ever
    // populated locally (see upload/inspectors.rs). The inspector list itself
    // lives in the local settings table (PRD §11), not a local table, so this
    // is the only place the remote copy gets created/refreshed.
    if let Ok(Some(inspector)) = inspector::repository::get_inspector(&conn, id) {
        upload::inspectors::push_inspector(&conn, &inspector);
    }

    Ok(id)
}

#[tauri::command]
fn get_inspectors(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<Vec<inspector::model::Inspector>, String> {
    let conn = state
        .lock()
        .map_err(|e| format!("db lock poisoned: {}", e))?;

    inspector::repository::get_inspectors(&conn)
}

#[tauri::command]
fn update_inspector(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    id: i64,
    inspector_name: String,
    employee_id: String,
    email: String,
    phone: String,
) -> Result<(), String> {
    let conn = state
        .lock()
        .map_err(|e| format!("db lock poisoned: {}", e))?;

    inspector::repository::update_inspector(
        &conn,
        id,
        &inspector_name,
        &employee_id,
        &email,
        &phone,
    )?;

    if let Ok(Some(inspector)) = inspector::repository::get_inspector(&conn, id) {
        upload::inspectors::push_inspector(&conn, &inspector);
    }

    Ok(())
}

#[tauri::command]
fn delete_inspector(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    id: i64,
) -> Result<(), String> {
    let conn = state
        .lock()
        .map_err(|e| format!("db lock poisoned: {}", e))?;

    inspector::repository::delete_inspector(&conn, id)
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionInfo {
    lot_name: String,
    inspector_name: String,
}

#[tauri::command]
fn select_lot(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    id: i64,
) -> Result<(), String> {
    let conn = state
        .lock()
        .map_err(|e| format!("db lock poisoned: {}", e))?;

    lot::repository::select_lot(&conn, id)?;

    if let Ok(Some(lot)) = lot::repository::get_lot(&conn, id) {
        upload::lots::push_lot(&conn, &lot);
    }

    Ok(())
}

#[tauri::command]
fn select_inspector(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    id: i64,
) -> Result<(), String> {
    let conn = state
        .lock()
        .map_err(|e| format!("db lock poisoned: {}", e))?;

    inspector::repository::select_inspector(&conn, id)
}

/// Returns the names of the active LOT and inspector, read directly from the
/// settings keys 'active_lot' and 'inspector' (PRD §11.5).
#[tauri::command]
fn get_session(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<SessionInfo, String> {
    let conn = state
        .lock()
        .map_err(|e| format!("db lock poisoned: {}", e))?;

    let lot_name = database::settings::get_setting(&conn, "active_lot");
    let inspector_name = database::settings::get_setting(&conn, "inspector");

    Ok(SessionInfo {
        lot_name,
        inspector_name,
    })
}

/// Duplicate detection (PRD §3.x): checks whether a serial_number + lot_name
/// combination already exists in the inspections table.
#[tauri::command]
fn check_duplicate(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    serial_number: String,
    lot_name: String,
) -> Result<bool, String> {
    let conn = state
        .lock()
        .map_err(|e| format!("db lock poisoned: {}", e))?;

    Ok(inspection::duplicate::serial_exists(
        &conn,
        &serial_number,
        &lot_name,
    ))
}

/// Save the inspection: write the InspectionRun JSON to `inspections` and add a
/// PENDING row to `upload_queue`. Returns the new inspection UUID.
#[tauri::command]
fn save_inspection(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    lot_name: String,
    inspector: String,
    cly_no: String,
    json_data: String,
    uuid: Option<String>,
) -> Result<inspection::persist::SaveResult, String> {
    let conn = state
        .lock()
        .map_err(|e| format!("db lock poisoned: {}", e))?;

    let usb_id = database::settings::get_setting(&conn, "usb_id");

    inspection::persist::save_inspection(
        &conn,
        &usb_id,
        &cly_no,
        &inspector,
        &lot_name,
        &json_data,
        uuid.as_deref(),
    )
}

/// Persist the 10 hardware categories collected during System Scan into
/// their own reporting tables (see database/sqlite.rs), keyed on
/// (uuid, serial_number[, extra key]). Called once the Hardware Inventory
/// screen hands off to Manual Grading. `uuid` is the inspection's UUID,
/// generated client-side up front and later reused by `save_inspection` so
/// both share the same identifier.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
fn save_hardware_inventory(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    uuid: String,
    serial_number: String,
    system_info: Option<serde_json::Value>,
    cpu_info: Option<serde_json::Value>,
    memory_info: Option<serde_json::Value>,
    storage_info: Option<serde_json::Value>,
    battery_info: Option<serde_json::Value>,
    network_info: Option<serde_json::Value>,
    display_info: Option<serde_json::Value>,
    gpu_info: Option<serde_json::Value>,
    camera_info: Option<serde_json::Value>,
    audio_info: Option<serde_json::Value>,
) -> Result<(), String> {
    let conn = state
        .lock()
        .map_err(|e| format!("db lock poisoned: {}", e))?;

    inspection::hardware_reports::save_all(
        &conn,
        &uuid,
        &serial_number,
        &system_info,
        &cpu_info,
        &memory_info,
        &storage_info,
        &battery_info,
        &network_info,
        &display_info,
        &gpu_info,
        &camera_info,
        &audio_info,
    )
}

#[tauri::command]
fn get_dashboard(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<dashboard::DashboardData, String> {
    let conn = state.lock().map_err(|e| format!("db lock poisoned: {}", e))?;
    dashboard::get_dashboard(&conn)
}

#[tauri::command]
fn get_upload_queue(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<dashboard::QueueData, String> {
    let conn = state.lock().map_err(|e| format!("db lock poisoned: {}", e))?;
    dashboard::get_upload_queue(&conn)
}

#[tauri::command]
fn get_sync_status(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<dashboard::SyncStatusData, String> {
    let conn = state.lock().map_err(|e| format!("db lock poisoned: {}", e))?;
    dashboard::get_sync_status(&conn)
}

#[tauri::command]
fn get_inspections(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<Vec<dashboard::InspectionRow>, String> {
    let conn = state.lock().map_err(|e| format!("db lock poisoned: {}", e))?;
    dashboard::get_inspections(&conn)
}

#[tauri::command]
fn sync_now(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<upload::sync::SyncSummary, String> {
    let conn = state.lock().map_err(|e| format!("db lock poisoned: {}", e))?;

    // Best-effort catch-up push for LOTs and inspectors created before their
    // Supabase sync existed (or whose earlier push failed). Fire-and-forget,
    // same as the per-save pushes in lot/inspector command handlers.
    upload::lots::sync_all_lots(&conn);
    upload::inspectors::sync_all_inspectors(&conn);

    upload::sync::sync_pending(&conn)
}

/// Return the full InspectionRun JSON for one inspection (for View/Export).
#[tauri::command]
fn get_inspection_detail(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    uuid: String,
) -> Result<String, String> {
    let conn = state.lock().map_err(|e| format!("db lock poisoned: {}", e))?;
    conn.query_row(
        "SELECT json_data FROM tbl_pulse_inspections WHERE uuid = ?1",
        rusqlite::params![uuid],
        |row| row.get::<_, String>(0),
    )
    .map_err(|e| e.to_string())
}

/// Export an inspection's JSON. Opens a native Save dialog so the user picks the
/// path/drive, then writes the file there. Returns the saved path, or None if the
/// user cancelled.
///
/// This must be `async` and run the dialog on a spawned blocking thread. The
/// tauri-plugin-dialog `blocking_*` helpers wait for the native dialog to be
/// pumped on the app's main/IPC thread; calling them from a *synchronous*
/// `#[tauri::command]` executes on that same main/IPC thread, so the wait
/// deadlocks and freezes the entire application (the bug behind the "export
/// hangs the app" report). Wrapping the blocking call in
/// `spawn_blocking` moves it off that thread so the dialog can complete
/// normally.
#[tauri::command]
async fn export_inspection(
    app: tauri::AppHandle,
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    uuid: String,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let json: String = {
        let conn = state.lock().map_err(|e| format!("db lock poisoned: {}", e))?;
        conn.query_row(
            "SELECT json_data FROM tbl_pulse_inspections WHERE uuid = ?1",
            rusqlite::params![uuid],
            |row| row.get::<_, String>(0),
        )
        .map_err(|e| e.to_string())?
    };

    // Suggest a filename from the device serial (fallback to uuid).
    let serial = serde_json::from_str::<serde_json::Value>(&json)
        .ok()
        .and_then(|v| {
            v.pointer("/inventory/system/serial_number")
                .and_then(|x| x.as_str())
                .map(|s| s.to_string())
        })
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| uuid.clone());

    let safe: String = serial
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();

    tokio::task::spawn_blocking(move || {
        // Native Save dialog — genuinely blocking, must run off the main/IPC
        // thread (see doc comment above).
        let chosen = app
            .dialog()
            .file()
            .set_title("Export Inspection")
            .set_file_name(format!("{}.json", safe))
            .add_filter("JSON", &["json"])
            .blocking_save_file();

        let file_path = match chosen {
            Some(fp) => fp,
            None => return Ok(None), // user cancelled
        };

        let path = file_path.into_path().map_err(|e| e.to_string())?;
        std::fs::write(&path, json).map_err(|e| e.to_string())?;

        Ok(Some(path.display().to_string()))
    })
    .await
    .map_err(|e| format!("export task failed: {}", e))?
}

/// Result of `export_inspection_files` — tells the frontend which of the two
/// destinations (this USB / Supabase Storage) actually succeeded, so it can
/// show the right confirmation message.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportFilesResult {
    // json_saved / pdf_saved are tracked separately (rather than a single
    // combined `local_saved` flag) because the two writes can fail
    // independently — e.g. a large PDF write can fail on a slow/near-full
    // USB drive while the tiny JSON write next to it succeeds. Collapsing
    // them into one boolean previously let a PDF write failure go silently
    // unreported whenever the JSON write (or the Supabase upload, which
    // uploads from memory and doesn't depend on the local file at all)
    // happened to succeed.
    json_saved: bool,
    pdf_saved: bool,
    local_saved: bool,
    local_json_path: Option<String>,
    local_pdf_path: Option<String>,
    cloud_uploaded: bool,
    error: Option<String>,
}

/// Save a JSON + PDF copy of a saved inspection to this USB's local "exports"
/// folder (same drive as udiag.db, since it's opened with a relative path),
/// and best-effort upload both files as objects into the Supabase Storage
/// bucket "PULSE" using the project's configured URL/service-role key
/// (settings: supabase_url / supabase_key). Called right after
/// `save_inspection` when the user completes an inspection.
#[tauri::command]
async fn export_inspection_files(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    uuid: String,
    pdf_base64: String,
    file_base_name: Option<String>,
) -> Result<ExportFilesResult, String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};

    // The frontend computes the "serialnumber-lotno--dd-mm-yy-HH-MM-SS" base
    // name (see src/app/lib/pdf.ts's buildExportFilename) so the JSON and PDF
    // saved here — both locally and in Supabase Storage — share that exact
    // name. Fall back to the uuid if it wasn't supplied, and sanitize either
    // way since this is used directly in a filesystem path.
    let base_name: String = file_base_name
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| uuid.clone())
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();

    let (json_data, base_url, key): (String, String, String) = {
        let conn = state.lock().map_err(|e| format!("db lock poisoned: {}", e))?;
        let json_data: String = conn
            .query_row(
                "SELECT json_data FROM tbl_pulse_inspections WHERE uuid = ?1",
                rusqlite::params![uuid],
                |row| row.get::<_, String>(0),
            )
            .map_err(|e| e.to_string())?;
        let base_url = database::settings::get_setting(&conn, "supabase_url");
        let key = database::settings::get_setting(&conn, "supabase_key");
        (json_data, base_url, key)
    };

    let pdf_bytes = STANDARD
        .decode(pdf_base64.as_bytes())
        .map_err(|e| format!("invalid PDF data: {}", e))?;

    // Write local copies to an "exports" folder next to udiag.db — since that
    // database is opened with a relative path, this folder lands on the same
    // USB/pendrive the app is running from.
    //
    // json_saved / pdf_saved / their paths / their errors are tracked
    // independently: each std::fs::write is attempted and its own
    // success/failure recorded, instead of collapsing both into one
    // pass/fail flag. That way a PDF-specific failure (e.g. a large write
    // choking on a near-full or slow pendrive) is never hidden behind the
    // small JSON write succeeding.
    let export_dir = std::path::Path::new("exports");
    // On Unix (this app's target runtime), a permission-denied write into an
    // *existing* "exports" folder almost always means the folder was created
    // by a different user/owner than the one this process runs as (e.g. it
    // was baked into the pendrive image as root during setup, but the kiosk
    // app itself runs as a regular user afterward). create_dir_all() treats
    // "the directory already exists" as success, so that mismatch is
    // otherwise invisible until the write itself fails. Best-effort loosen
    // the directory's permissions right after create/find so a stale
    // restrictive mode doesn't silently eat every export; this is a no-op
    // (and safely ignored) if the current process isn't the owner and isn't
    // root, in which case the write below will still fail and report why.
    #[cfg(unix)]
    fn ensure_export_dir_writable(dir: &std::path::Path) {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(meta) = std::fs::metadata(dir) {
            let mut perms = meta.permissions();
            if perms.mode() & 0o200 == 0 {
                perms.set_mode(0o777);
                let _ = std::fs::set_permissions(dir, perms);
            }
        }
    }
    #[cfg(not(unix))]
    fn ensure_export_dir_writable(_dir: &std::path::Path) {}

    fn is_permission_denied(r: &std::io::Result<()>) -> bool {
        matches!(r, Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied)
    }

    let (json_saved, pdf_saved, local_json_path, local_pdf_path, mut error) =
        match std::fs::create_dir_all(export_dir) {
            Ok(()) => {
                ensure_export_dir_writable(export_dir);

                let json_path = export_dir.join(format!("{}.json", base_name));
                let pdf_path = export_dir.join(format!("{}.pdf", base_name));

                let mut json_write = std::fs::write(&json_path, &json_data);
                let mut pdf_write = std::fs::write(&pdf_path, &pdf_bytes);

                // A permission-denied write is worth exactly one retry after
                // the chmod attempt above -- anything else (disk full, path
                // too long, etc.) wouldn't be fixed by retrying so it's left
                // to fail and report immediately.
                if is_permission_denied(&json_write) {
                    ensure_export_dir_writable(export_dir);
                    json_write = std::fs::write(&json_path, &json_data);
                }
                if is_permission_denied(&pdf_write) {
                    ensure_export_dir_writable(export_dir);
                    pdf_write = std::fs::write(&pdf_path, &pdf_bytes);
                }

                if let Err(e) = &json_write {
                    eprintln!(
                        "Local JSON export failed ({}): {}",
                        json_path.display(),
                        e
                    );
                }
                if let Err(e) = &pdf_write {
                    eprintln!(
                        "Local PDF export failed ({}, {} bytes): {}",
                        pdf_path.display(),
                        pdf_bytes.len(),
                        e
                    );
                }

                let json_ok = json_write.is_ok();
                let pdf_ok = pdf_write.is_ok();
                let msg = pdf_write
                    .err()
                    .map(|e| {
                        let hint = if e.kind() == std::io::ErrorKind::PermissionDenied {
                            " -- the exports folder likely has the wrong owner/permissions on this pendrive; delete it and let PULSE recreate it, or fix its permissions."
                        } else {
                            ""
                        };
                        format!("PDF export failed ({}): {}{}", pdf_path.display(), e, hint)
                    })
                    .or_else(|| {
                        json_write
                            .err()
                            .map(|e| format!("JSON export failed ({}): {}", json_path.display(), e))
                    });

                (
                    json_ok,
                    pdf_ok,
                    json_ok.then(|| json_path.display().to_string()),
                    pdf_ok.then(|| pdf_path.display().to_string()),
                    msg,
                )
            }
            Err(e) => {
                eprintln!(
                    "Failed to create export dir ({}): {}",
                    export_dir.display(),
                    e
                );
                (
                    false,
                    false,
                    None,
                    None,
                    Some(format!("Could not create exports folder: {}", e)),
                )
            }
        };
    let local_saved = json_saved && pdf_saved;

    let cloud_uploaded = if base_url.trim().is_empty() || key.trim().is_empty() {
        false
    } else {
        let base = base_url.clone();
        let api_key = key.clone();
        let base_name_c = base_name.clone();
        let json_bytes = json_data.clone().into_bytes();
        let pdf_bytes_c = pdf_bytes.clone();

        // reqwest::blocking cannot run inside the tokio runtime that drives this
        // async command, so the HTTP calls are done on a spawned blocking thread
        // (same pattern as upload::sync::sync_pending).
        let result: Result<(), String> = tokio::task::spawn_blocking(move || {
            let client = upload::storage::build_client()?;
            upload::storage::upload_object(
                &client,
                &base,
                &api_key,
                "PULSE",
                &format!("{}.json", base_name_c),
                "application/json",
                &json_bytes,
            )?;
            upload::storage::upload_object(
                &client,
                &base,
                &api_key,
                "PULSE",
                &format!("{}.pdf", base_name_c),
                "application/pdf",
                &pdf_bytes_c,
            )?;
            Ok(())
        })
        .await
        .map_err(|e| format!("upload task failed: {}", e))?;

        match &result {
            Ok(()) => true,
            Err(e) => {
                eprintln!("Supabase Storage upload failed for {}: {}", uuid, e);
                if error.is_none() {
                    error = Some(e.clone());
                }
                false
            }
        }
    };

    Ok(ExportFilesResult {
        json_saved,
        pdf_saved,
        local_saved,
        local_json_path,
        local_pdf_path,
        cloud_uploaded,
        error,
    })
}

/// User-triggered report export (Final Review "Export PDF" / "Download
/// Report", Inspection Complete "Download Report", and Inspection Manager
/// "Export"). Unlike `export_inspection_files` (which silently writes into
/// this USB's own "exports" folder right after a save), this opens a native
/// "choose a folder" dialog so the user can pick any destination, then
/// writes `<file_base_name>.pdf` (and `<file_base_name>.xlsx`, when the
/// caller also supplies an Excel workbook) into that folder in one go.
///
/// Must be `async` + run the dialog on a spawned blocking thread for the
/// same reason as `export_inspection` above (blocking_* dialog helpers
/// deadlock the main/IPC thread if called synchronously).
#[tauri::command]
async fn export_report_files(
    app: tauri::AppHandle,
    pdf_base64: String,
    xlsx_base64: Option<String>,
    file_base_name: String,
) -> Result<Option<String>, String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    use tauri_plugin_dialog::DialogExt;

    let pdf_bytes = STANDARD
        .decode(pdf_base64.as_bytes())
        .map_err(|e| format!("invalid PDF data: {}", e))?;
    let xlsx_bytes = match &xlsx_base64 {
        Some(b) => Some(
            STANDARD
                .decode(b.as_bytes())
                .map_err(|e| format!("invalid XLSX data: {}", e))?,
        ),
        None => None,
    };

    let safe_name: String = file_base_name
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();
    let safe_name = if safe_name.trim().is_empty() {
        "report".to_string()
    } else {
        safe_name
    };

    tokio::task::spawn_blocking(move || {
        let chosen = app
            .dialog()
            .file()
            .set_title("Choose export folder")
            .blocking_pick_folder();

        let folder = match chosen {
            Some(f) => f,
            None => return Ok(None), // user cancelled
        };

        let dir = folder.into_path().map_err(|e| e.to_string())?;

        let pdf_path = dir.join(format!("{}.pdf", safe_name));
        std::fs::write(&pdf_path, &pdf_bytes).map_err(|e| e.to_string())?;

        if let Some(bytes) = xlsx_bytes {
            let xlsx_path = dir.join(format!("{}.xlsx", safe_name));
            std::fs::write(&xlsx_path, &bytes).map_err(|e| e.to_string())?;
        }

        Ok(Some(dir.display().to_string()))
    })
    .await
    .map_err(|e| format!("export task failed: {}", e))?
}

/// Delete an inspection and its upload-queue row.
#[tauri::command]
fn delete_inspection(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    uuid: String,
) -> Result<(), String> {
    let conn = state.lock().map_err(|e| format!("db lock poisoned: {}", e))?;
    conn.execute(
        "DELETE FROM tbl_pulse_upload_queue WHERE inspection_uuid = ?1",
        rusqlite::params![uuid],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM tbl_pulse_inspections WHERE uuid = ?1",
        rusqlite::params![uuid],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Delete a single upload-queue row by id.
#[tauri::command]
fn delete_queue_item(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    id: i64,
) -> Result<(), String> {
    let conn = state.lock().map_err(|e| format!("db lock poisoned: {}", e))?;
    conn.execute(
        "DELETE FROM tbl_pulse_upload_queue WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Reset one queue row to PENDING and run the sync engine.
#[tauri::command]
fn retry_upload(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    id: i64,
) -> Result<upload::sync::SyncSummary, String> {
    let conn = state.lock().map_err(|e| format!("db lock poisoned: {}", e))?;
    conn.execute(
        "UPDATE tbl_pulse_upload_queue SET status='PENDING' WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;
    upload::sync::sync_pending(&conn)
}

/// Reset all FAILED queue rows to PENDING and run the sync engine.
#[tauri::command]
fn retry_all_failed(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<upload::sync::SyncSummary, String> {
    let conn = state.lock().map_err(|e| format!("db lock poisoned: {}", e))?;
    conn.execute(
        "UPDATE tbl_pulse_upload_queue SET status='PENDING' WHERE status='FAILED'",
        [],
    )
    .map_err(|e| e.to_string())?;
    upload::sync::sync_pending(&conn)
}

/// Delete all queue rows that have already uploaded.
#[tauri::command]
fn delete_uploaded(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<(), String> {
    let conn = state.lock().map_err(|e| format!("db lock poisoned: {}", e))?;
    conn.execute("DELETE FROM tbl_pulse_upload_queue WHERE status='UPLOADED'", [])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Open (or create) the SQLite database, ensure the schema and
            // default rows exist, then keep the connection in managed state
            // so Tauri commands can access it via State<Mutex<Connection>>.
            let conn = database::sqlite::initialize_database()
                .expect("failed to initialize database");

            database::settings::create_default_settings(&conn);
            database::settings::initialize_usb_id(&conn);

            app.manage(Mutex::new(conn));

            // Kiosk mode: the window config (fullscreen/decorations/skipTaskbar)
            // already sets this up, but some window managers (notably minimal/
            // kiosk X11 setups on the Ubuntu USB image) don't reliably honor the
            // "fullscreen" hint at creation time -- the window can end up stuck
            // at the configured fallback size (1280x800) instead of expanding to
            // the laptop's actual screen resolution. Explicitly resize/reposition
            // to the monitor's real dimensions as a fallback that doesn't depend
            // on the window manager implementing fullscreen correctly, then also
            // request true fullscreen on top of that.
            if let Some(window) = app.get_webview_window("main") {
                if let Ok(Some(monitor)) = window.primary_monitor() {
                    let size = *monitor.size();
                    let position = *monitor.position();
                    let _ = window.set_position(tauri::Position::Physical(position));
                    let _ = window.set_size(tauri::Size::Physical(size));
                }
                let _ = window.set_fullscreen(true);
                let _ = window.set_always_on_top(true);
                let _ = window.set_skip_taskbar(true);
                let _ = window.set_focus();
            }

            Ok(())
        })
        .invoke_handler(
            tauri::generate_handler![
                get_app_info,
                get_system_info,
                get_cpu_info,
                get_memory_info,
                get_storage_info,
                get_battery_info,
                get_gpu_info,
                get_display_info,
                get_network_info,
                scan_wifi_networks,
                connect_wifi_network,
                disconnect_wifi_network,
                get_wifi_status,
                get_pulse_app_version,
                check_app_update,
                apply_app_update,
                shutdown_system,
                get_camera_info,
                get_audio_info,
                play_speaker_test,
                start_webcam_test,
                create_lot,
                get_lots,
                update_lot,
                delete_lot,
                archive_lot,
                create_inspector,
                get_inspectors,
                update_inspector,
                delete_inspector,
                select_lot,
                select_inspector,
                get_session,
                check_duplicate,
                save_inspection,
                save_hardware_inventory,
                get_dashboard,
                get_upload_queue,
                get_sync_status,
                get_inspections,
                sync_now,
                get_inspection_detail,
                export_inspection,
                export_inspection_files,
                export_report_files,
                delete_inspection,
                delete_queue_item,
                retry_upload,
                retry_all_failed,
                delete_uploaded,
            ]
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
