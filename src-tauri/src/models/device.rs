use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct CpuInfo {

    pub manufacturer: String,

    pub model: String,

    pub architecture: String,

    pub sockets: u32,

    pub cores_per_socket: u32,

    pub threads: u32,

    pub max_speed_mhz: f64,

    pub min_speed_mhz: f64,

    pub current_speed_mhz: f64,

    pub cache_l1: String,

    pub cache_l2: String,

    pub cache_l3: String,

    // Sum of L1d + L1i + L2 + L3 caches in MiB (mirrors the Python script).
    pub cache_total_mb: f64,

    pub virtualization: bool,

    pub hyper_threading: bool,

    pub flags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MemoryModule {

    pub slot: String,

    pub bank_locator: String,

    pub size_mb: u64,

    pub memory_type: String,

    pub manufacturer: String,

    pub serial: String,

    pub part_number: String,

    pub speed_mhz: u32,

    pub is_empty: bool,

    pub is_onboard: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MemorySummary {

    pub total_installed_mb: u64,

    pub memory_type: String,

    pub speed_mhz: u32,

    pub module_count: usize,

    pub empty_slots: usize,

    pub onboard_modules: usize,

    pub slot_modules: usize,

    pub upgradeable: bool,

    pub modules: Vec<MemoryModule>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StorageDevice {

    pub slot: String,

    pub device: String,

    pub model: String,

    pub serial: String,

    pub firmware: String,

    pub size_gb: f64,

    pub transport: String,

    pub storage_type: String,

    pub health_percent: Option<u32>,

    pub temperature_c: Option<u32>,

    pub power_on_hours: Option<u64>,

    pub power_cycles: Option<u64>,

    pub media_errors: Option<u64>,

    pub critical_warning: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemInfo {

    pub manufacturer: String,

    pub model: String,

    pub serial_number: String,

    pub uuid: String,

    pub version: String,

    pub sku_number: String,

    pub family: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatteryInfo {

    pub manufacturer: String,

    pub model: String,

    pub serial_number: String,

    pub technology: String,

    pub status: String,

    pub cycle_count: u32,

    //
    // Raw values from Linux
    //
    pub design_capacity_mwh: u64,

    pub full_charge_capacity_mwh: u64,

    pub current_capacity_mwh: u64,

    pub voltage_mv: u64,

    //
    // Normalized values for UI
    //
    pub design_capacity_wh: f64,

    pub full_charge_capacity_wh: f64,

    pub current_capacity_wh: f64,

    //
    // Battery wear calculation
    //
    pub health_percent: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatteryHealth {

    pub health_percent: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BiosInfo {

    pub vendor: String,

    pub version: String,

    pub release_date: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StorageHealth {

    pub device_name: String,

    pub health_percent: Option<f64>,

    pub temperature_c: Option<u32>,

    pub power_on_hours: Option<u64>,

    pub critical_warning: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ManualGrading {

    pub lcd_status: String,

    pub lcd_defects: Vec<String>,

    pub top_cover_status: String,

    pub bezel_status: String,

    pub palmrest_status: String,

    pub bottom_cover_status: String,

    pub keyboard_status: String,

    pub touchpad_status: String,

    pub remarks: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GpuInfo {

    pub vendor: String,

    pub model: String,

    pub bus_address: String,

    pub driver: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DisplayInfo {
    pub manufacturer: String,
    pub model: String,
    pub panel_part_number: String,
    pub resolution: String,
    pub size_inches: f64,
    pub refresh_rate: String,
    pub aspect_ratio: String,
    pub size: String,
    pub touchscreen: String,
    pub manufacture_year: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AudioInfo {
    pub manufacturer: String,
    pub model: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MotherboardInfo {
    pub manufacturer: String,
    pub model: String,
    pub revision: String,
    pub serial_number: String,
    pub bios_version: String,
    pub bios_date: String,
    pub bios_vendor: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BluetoothInfo {
    pub manufacturer: String,
    pub model: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NetworkInfo {

    pub wifi: String,

    pub wifi_friendly: String,

    pub wifi_mac: String,

    pub ethernet: String,

    pub ethernet_friendly: String,

    pub ethernet_mac: String,

    pub bluetooth: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CameraInfo {

    pub vendor: String,

    pub model: String,

    pub device: String,

    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SpeakerTest {

    pub result: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WebcamTest {

    pub result: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct KeyboardTest {

    pub result: String,

    pub unique_keys: usize,
}