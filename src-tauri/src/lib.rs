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
fn get_storage_info() -> Result<Vec<StorageDevice>, String> {
    let storage = inventory::storage::collect()
        .map_err(|e| e.to_string())?;

    println!("STORAGE INFO: {:?}", storage);

    Ok(storage)
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

    lot::repository::insert_lot(
        &conn,
        &lot_name,
        &customer,
        &location,
    )
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
    )
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
    lot::repository::set_lot_status(&conn, id, "CANCELLED")
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

    inspector::repository::insert_inspector(
        &conn,
        &inspector_name,
        &employee_id,
        &email,
        &phone,
    )
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
    )
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

    lot::repository::select_lot(&conn, id)
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
        "SELECT json_data FROM inspections WHERE uuid = ?1",
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
            "SELECT json_data FROM inspections WHERE uuid = ?1",
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
) -> Result<ExportFilesResult, String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};

    let (json_data, base_url, key): (String, String, String) = {
        let conn = state.lock().map_err(|e| format!("db lock poisoned: {}", e))?;
        let json_data: String = conn
            .query_row(
                "SELECT json_data FROM inspections WHERE uuid = ?1",
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
    let export_dir = std::path::Path::new("exports");
    let (local_saved, local_json_path, local_pdf_path, mut error) =
        match std::fs::create_dir_all(export_dir) {
            Ok(()) => {
                let json_path = export_dir.join(format!("{}.json", uuid));
                let pdf_path = export_dir.join(format!("{}.pdf", uuid));
                let json_write = std::fs::write(&json_path, &json_data);
                let pdf_write = std::fs::write(&pdf_path, &pdf_bytes);
                if json_write.is_ok() && pdf_write.is_ok() {
                    (
                        true,
                        Some(json_path.display().to_string()),
                        Some(pdf_path.display().to_string()),
                        None,
                    )
                } else {
                    let msg = json_write
                        .err()
                        .or(pdf_write.err())
                        .map(|e| e.to_string());
                    (false, None, None, msg)
                }
            }
            Err(e) => (false, None, None, Some(e.to_string())),
        };

    let cloud_uploaded = if base_url.trim().is_empty() || key.trim().is_empty() {
        false
    } else {
        let base = base_url.clone();
        let api_key = key.clone();
        let uuid_c = uuid.clone();
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
                &format!("{}.json", uuid_c),
                "application/json",
                &json_bytes,
            )?;
            upload::storage::upload_object(
                &client,
                &base,
                &api_key,
                "PULSE",
                &format!("{}.pdf", uuid_c),
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
        local_saved,
        local_json_path,
        local_pdf_path,
        cloud_uploaded,
        error,
    })
}

/// Delete an inspection and its upload-queue row.
#[tauri::command]
fn delete_inspection(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    uuid: String,
) -> Result<(), String> {
    let conn = state.lock().map_err(|e| format!("db lock poisoned: {}", e))?;
    conn.execute(
        "DELETE FROM upload_queue WHERE inspection_uuid = ?1",
        rusqlite::params![uuid],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM inspections WHERE uuid = ?1",
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
        "DELETE FROM upload_queue WHERE id = ?1",
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
        "UPDATE upload_queue SET status='PENDING' WHERE id = ?1",
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
        "UPDATE upload_queue SET status='PENDING' WHERE status='FAILED'",
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
    conn.execute("DELETE FROM upload_queue WHERE status='UPLOADED'", [])
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