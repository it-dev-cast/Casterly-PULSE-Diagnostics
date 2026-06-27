mod inventory;
mod models;
mod health;
mod diagnostics;
mod grading;
mod inspection;
mod database;
mod upload;
mod lot;

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
use crate::models::device::MotherboardInfo;
use crate::models::device::BluetoothInfo;

use std::sync::Mutex;
use tauri::Manager;

/// Shared SQLite connection stored as Tauri managed state.
pub struct Db(pub Mutex<rusqlite::Connection>);

#[tauri::command]
fn get_app_info() -> String {
    "UDIAG 4.0 Ready".to_string()
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

#[tauri::command]
fn get_audio_info() -> Result<AudioInfo, String> {
    let audio = inventory::audio::collect()
        .map_err(|e| e.to_string())?;

    println!("AUDIO INFO: {:?}", audio);

    Ok(audio)
}

#[tauri::command]
fn get_motherboard_info() -> Result<MotherboardInfo, String> {
    let mb = inventory::motherboard::collect()
        .map_err(|e| e.to_string())?;

    println!("MOTHERBOARD INFO: {:?}", mb);

    Ok(mb)
}

#[tauri::command]
fn get_bluetooth_info() -> Result<BluetoothInfo, String> {
    let bt = inventory::bluetooth::collect()
        .map_err(|e| e.to_string())?;

    println!("BLUETOOTH INFO: {:?}", bt);

    Ok(bt)
}

#[tauri::command]
fn get_memory_info() -> Result<Vec<MemoryModule>, String> {
    let memory = inventory::memory::collect()
        .map_err(|e| e.to_string())?;

    println!("MEMORY INFO: {:?}", memory);

    Ok(memory)
}

#[tauri::command]
fn get_storage_info() -> Result<Vec<StorageDevice>, String> {
    let storage = inventory::storage::collect()
        .map_err(|e| e.to_string())?;

    println!("STORAGE INFO: {:?}", storage);

    Ok(storage)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Resolve a stable, per-user location for the database
            // instead of a bare relative "udiag.db" next to the cwd.
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");

            let db_path = app_data_dir.join("udiag.db");

            let conn = database::sqlite::initialize_database(&db_path)
                .expect("failed to initialize database");

            database::settings::create_default_settings(&conn);
            database::settings::initialize_usb_id(&conn);

            println!("DATABASE: {}", db_path.display());

            app.manage(Db(Mutex::new(conn)));

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
                get_motherboard_info,
                get_bluetooth_info,
            ]
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}