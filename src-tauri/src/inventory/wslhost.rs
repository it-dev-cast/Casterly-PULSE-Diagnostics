// =============================================================================
// wslhost.rs
// =============================================================================
// WSL2 doesn't expose the host laptop's DMI/SMBIOS/PCI/battery/camera hardware,
// so the Linux collectors come back empty (or show WSL's virtual disk / eth0).
// When the app runs under WSL, the collectors fall back to these functions,
// which query the Windows host via `powershell.exe` (WMI/CIM) and map the
// results onto the same structs the Linux collectors return.
//
// On real Linux hardware `is_wsl()` is false and none of this runs.
// =============================================================================

use std::collections::HashMap;
use std::fs;
use std::process::Command;

use crate::models::device::{
    AudioInfo,
    BatteryInfo,
    BluetoothInfo,
    CameraInfo,
    DisplayInfo,
    GpuInfo,
    MemoryModule,
    MotherboardInfo,
    NetworkInfo,
    StorageDevice,
};

/// True when running inside WSL (kernel release contains "microsoft"/"wsl").
pub fn is_wsl() -> bool {
    fs::read_to_string("/proc/sys/kernel/osrelease")
        .map(|s| {
            let l = s.to_lowercase();
            l.contains("microsoft") || l.contains("wsl")
        })
        .unwrap_or(false)
}

/// Runs a PowerShell snippet on the Windows host, returning trimmed,
/// non-empty stdout lines. Empty vec if powershell.exe is unavailable.
fn ps_lines(script: &str) -> Vec<String> {
    let output = Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .output();

    match output {
        Ok(o) => String::from_utf8_lossy(&o.stdout)
            .lines()
            .map(|l| l.trim().to_string())
            .filter(|l| !l.is_empty())
            .collect(),
        Err(_) => Vec::new(),
    }
}

/// Splits a "a|b|c" line into owned fields.
fn split_pipe(line: &str) -> Vec<String> {
    line.split('|').map(|s| s.trim().to_string()).collect()
}

fn field(parts: &[String], idx: usize) -> String {
    parts.get(idx).cloned().unwrap_or_default()
}

// ─────────────────────────────────────────────────────────────────────────────
// Memory  ←  Win32_PhysicalMemory
// ─────────────────────────────────────────────────────────────────────────────
pub fn memory() -> Vec<MemoryModule> {
    let script = r#"Get-CimInstance Win32_PhysicalMemory | ForEach-Object { "$($_.DeviceLocator)|$($_.BankLabel)|$($_.Capacity)|$($_.SMBIOSMemoryType)|$($_.Manufacturer)|$($_.SerialNumber)|$($_.PartNumber)|$($_.Speed)" }"#;

    let mut modules = Vec::new();

    for line in ps_lines(script) {
        let p = split_pipe(&line);

        let capacity_bytes: u64 = field(&p, 2).parse().unwrap_or(0);

        modules.push(MemoryModule {
            slot: field(&p, 0),
            bank_locator: field(&p, 1),
            size_mb: capacity_bytes / (1024 * 1024),
            memory_type: smbios_mem_type(&field(&p, 3)),
            manufacturer: field(&p, 4),
            serial: field(&p, 5),
            part_number: field(&p, 6),
            speed_mhz: field(&p, 7).parse().unwrap_or(0),
            is_empty: false,
            is_onboard: false,
        });
    }

    modules
}

fn smbios_mem_type(code: &str) -> String {
    match code {
        "20" => "DDR",
        "21" => "DDR2",
        "24" => "DDR3",
        "26" => "DDR4",
        "34" => "DDR5",
        _ => "Unknown",
    }
    .to_string()
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage  ←  Win32_DiskDrive
// ─────────────────────────────────────────────────────────────────────────────
pub fn storage() -> Vec<StorageDevice> {
    // Get-PhysicalDisk gives a clean SerialNumber (Win32_DiskDrive returns
    // "FFFF..." placeholders for many NVMe drives), plus MediaType (3=HDD,4=SSD)
    // and BusType (e.g. NVMe/SATA). FriendlyName is the real model string.
    let script = r#"Get-PhysicalDisk | ForEach-Object { "$($_.DeviceId)|$($_.FriendlyName)|$($_.SerialNumber)|$($_.FirmwareVersion)|$($_.Size)|$($_.BusType)|$($_.MediaType)" }"#;

    let mut drives = Vec::new();
    let mut idx = 0u32;

    for line in ps_lines(script) {
        let p = split_pipe(&line);

        let size_bytes: f64 = field(&p, 4).parse().unwrap_or(0.0);
        let model = field(&p, 1);
        let bus = field(&p, 5);
        let media = field(&p, 6);

        // MediaType: "SSD"/"HDD"/numeric (4=SSD,3=HDD). BusType e.g. "NVMe".
        let kind = if media.eq_ignore_ascii_case("ssd") || media == "4" {
            "SSD"
        } else if media.eq_ignore_ascii_case("hdd") || media == "3" {
            "HDD"
        } else {
            "Disk"
        };

        let storage_type = if bus.is_empty() {
            kind.to_string()
        } else {
            format!("{} {}", bus, kind)
        };

        // Clean placeholder serials (all-F / all-0).
        let mut serial = field(&p, 2);
        let s_clean = serial.replace(
            |c: char| matches!(c, 'F' | 'f' | '0' | ' ' | '.'),
            "",
        );
        if s_clean.is_empty() {
            serial = String::new();
        }

        idx += 1;

        drives.push(StorageDevice {
            slot: format!("Disk{}", idx),
            device: field(&p, 0),
            model,
            serial,
            firmware: field(&p, 3),
            size_gb: size_bytes / 1024.0 / 1024.0 / 1024.0,
            transport: bus,
            storage_type,
            health_percent: None,
            temperature_c: None,
            power_on_hours: None,
            power_cycles: None,
            media_errors: None,
            critical_warning: None,
        });
    }

    drives
}

// ─────────────────────────────────────────────────────────────────────────────
// GPU  ←  Win32_VideoController
// ─────────────────────────────────────────────────────────────────────────────
pub fn gpu() -> Vec<GpuInfo> {
    let script = r#"Get-CimInstance Win32_VideoController | ForEach-Object { "$($_.AdapterCompatibility)|$($_.Name)|$($_.DriverVersion)" }"#;

    let mut gpus = Vec::new();

    for line in ps_lines(script) {
        let p = split_pipe(&line);
        let vendor = field(&p, 0);
        let model = field(&p, 1);

        if model.is_empty() {
            continue;
        }

        gpus.push(GpuInfo {
            vendor,
            model,
            bus_address: String::new(),
            driver: field(&p, 2),
        });
    }

    gpus
}

// ─────────────────────────────────────────────────────────────────────────────
// Display  ←  Win32_VideoController (mode) + WmiMonitorID (panel identity)
// ─────────────────────────────────────────────────────────────────────────────
pub fn display() -> Option<DisplayInfo> {
    let script = r#"
$vc = Get-CimInstance Win32_VideoController | Where-Object { $_.CurrentHorizontalResolution } | Select-Object -First 1
Write-Output "ResX=$($vc.CurrentHorizontalResolution)"
Write-Output "ResY=$($vc.CurrentVerticalResolution)"
Write-Output "Refresh=$($vc.CurrentRefreshRate)"
$mon = Get-CimInstance -Namespace root/wmi -ClassName WmiMonitorID -ErrorAction SilentlyContinue | Select-Object -First 1
if ($mon) {
  $name = ($mon.UserFriendlyName | Where-Object { $_ -ne 0 } | ForEach-Object { [char]$_ }) -join ''
  $mfg  = ($mon.ManufacturerName | Where-Object { $_ -ne 0 } | ForEach-Object { [char]$_ }) -join ''
  $code = ($mon.ProductCodeID    | Where-Object { $_ -ne 0 } | ForEach-Object { [char]$_ }) -join ''
  Write-Output "Name=$name"
  Write-Output "Mfg=$mfg"
  Write-Output "Code=$code"
  Write-Output "Year=$($mon.YearOfManufacture)"
}
$touch = Get-CimInstance Win32_PnPEntity -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'touch' -and $_.Name -match 'screen|digitizer' }
Write-Output "Touch=$(($touch | Measure-Object).Count)"
"#;

    let mut kv: HashMap<String, String> = HashMap::new();
    for line in ps_lines(script) {
        if let Some((k, v)) = line.split_once('=') {
            kv.insert(k.trim().to_string(), v.trim().to_string());
        }
    }
    if kv.is_empty() {
        return None;
    }

    let get = |k: &str| kv.get(k).cloned().unwrap_or_default();

    let rx = get("ResX");
    let ry = get("ResY");
    let resolution = if !rx.is_empty() && !ry.is_empty() {
        format!("{}x{}", rx, ry)
    } else {
        String::new()
    };

    let aspect_ratio = aspect_from_res(&rx, &ry);

    let touch_count: u32 = get("Touch").parse().unwrap_or(0);

    Some(DisplayInfo {
        manufacturer: get("Mfg"),
        model: get("Code"),
        panel_part_number: get("Name"),
        resolution,
        size_inches: 0.0,
        refresh_rate: if get("Refresh").is_empty() {
            String::new()
        } else {
            format!("{} Hz", get("Refresh"))
        },
        aspect_ratio,
        size: String::new(),
        touchscreen: if touch_count > 0 { "Yes".to_string() } else { "No".to_string() },
        manufacture_year: get("Year"),
    })
}

/// Reduces a WxH resolution to an aspect ratio like "16:9".
fn aspect_from_res(w: &str, h: &str) -> String {
    let wn: u64 = w.parse().unwrap_or(0);
    let hn: u64 = h.parse().unwrap_or(0);
    if wn == 0 || hn == 0 {
        return String::new();
    }
    let g = gcd(wn, hn);
    format!("{}:{}", wn / g, hn / g)
}

fn gcd(a: u64, b: u64) -> u64 {
    if b == 0 { a } else { gcd(b, a % b) }
}

// ─────────────────────────────────────────────────────────────────────────────
// Battery  ←  Win32_PortableBattery / Win32_Battery / root\wmi battery classes
// ─────────────────────────────────────────────────────────────────────────────
pub fn battery() -> Option<BatteryInfo> {
    // Identity comes from Win32 classes; design capacity, full-charge capacity
    // and cycle count come from `powercfg /batteryreport` (the root\wmi battery
    // classes need elevation and return nothing in a non-admin WSL shell).
    let script = r#"
$pb = Get-CimInstance Win32_PortableBattery -ErrorAction SilentlyContinue | Select-Object -First 1
$wb = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1
Write-Output "Manufacturer=$($pb.Manufacturer)"
Write-Output "Model=$($pb.Name)"
Write-Output "Serial=$($pb.SerialNumber)"
Write-Output "Chemistry=$($pb.Chemistry)"
Write-Output "Pct=$($wb.EstimatedChargeRemaining)"
Write-Output "Voltage=$($wb.DesignVoltage)"
Write-Output "Status=$($wb.BatteryStatus)"
$design=0; $full=0; $cycle=0
$f = Join-Path $env:TEMP 'udiag_batt.xml'
try {
  powercfg /batteryreport /xml /output $f | Out-Null
  $raw = Get-Content $f -Raw -ErrorAction SilentlyContinue
  if ($raw) {
    if ($raw -match '<DesignCapacity>(\d+)</DesignCapacity>') { $design = $Matches[1] }
    if ($raw -match '<FullChargeCapacity>(\d+)</FullChargeCapacity>') { $full = $Matches[1] }
    if ($raw -match '<CycleCount>(\d+)</CycleCount>') { $cycle = $Matches[1] }
  }
} catch {}
Write-Output "Design=$design"
Write-Output "Full=$full"
Write-Output "Cycle=$cycle"
"#;

    let mut kv: HashMap<String, String> = HashMap::new();
    for line in ps_lines(script) {
        if let Some((k, v)) = line.split_once('=') {
            kv.insert(k.trim().to_string(), v.trim().to_string());
        }
    }

    let get = |k: &str| kv.get(k).cloned().unwrap_or_default();

    let design_mwh: u64 = get("Design").parse().unwrap_or(0);
    let mut full_mwh: u64 = get("Full").parse().unwrap_or(0);
    let voltage_mv: u64 = get("Voltage").parse().unwrap_or(0);
    let cycle_count: u32 = get("Cycle").parse().unwrap_or(0);
    let pct: f64 = get("Pct").parse().unwrap_or(0.0);

    // powercfg sometimes omits full-charge capacity — fall back to design.
    if full_mwh == 0 {
        full_mwh = design_mwh;
    }

    // Win32_Battery reports charge as a percentage; derive current mWh from it.
    let current_mwh: u64 = ((full_mwh as f64) * pct / 100.0) as u64;

    // No battery present on the host → nothing useful to show.
    if get("Manufacturer").is_empty() && design_mwh == 0 && full_mwh == 0 {
        return None;
    }

    let health_percent = if design_mwh > 0 {
        (full_mwh as f64 / design_mwh as f64) * 100.0
    } else {
        0.0
    };

    Some(BatteryInfo {
        manufacturer: get("Manufacturer"),
        model: get("Model"),
        serial_number: get("Serial"),
        technology: battery_chemistry(&get("Chemistry")),
        status: battery_status(&get("Status")),
        cycle_count,
        design_capacity_mwh: design_mwh,
        full_charge_capacity_mwh: full_mwh,
        current_capacity_mwh: current_mwh,
        voltage_mv,
        design_capacity_wh: design_mwh as f64 / 1000.0,
        full_charge_capacity_wh: full_mwh as f64 / 1000.0,
        current_capacity_wh: current_mwh as f64 / 1000.0,
        health_percent: (health_percent * 100.0).round() / 100.0,
    })
}

fn battery_chemistry(code: &str) -> String {
    match code {
        "3" => "Lead Acid",
        "4" => "Nickel Cadmium",
        "5" => "Nickel Metal Hydride",
        "6" => "Lithium-ion",
        "7" => "Zinc Air",
        "8" => "Lithium Polymer",
        _ => "Unknown",
    }
    .to_string()
}

fn battery_status(code: &str) -> String {
    match code {
        "1" => "Discharging",
        "2" => "AC / Charging",
        "3" => "Fully Charged",
        "4" => "Low",
        "5" => "Critical",
        "6" => "Charging",
        _ => "Unknown",
    }
    .to_string()
}

// ─────────────────────────────────────────────────────────────────────────────
// Network  ←  Win32_NetworkAdapter (+ Bluetooth PnP presence)
// ─────────────────────────────────────────────────────────────────────────────
pub fn network() -> Option<NetworkInfo> {
    let script = r#"
Get-CimInstance Win32_NetworkAdapter -Filter "PhysicalAdapter=true" | ForEach-Object { Write-Output "NIC|$($_.Name)|$($_.MACAddress)|$($_.AdapterType)" }
$bt = Get-CimInstance Win32_PnPEntity -Filter "PNPClass='Bluetooth'" -ErrorAction SilentlyContinue
Write-Output "BT|$(($bt | Measure-Object).Count)"
"#;

    let mut info = NetworkInfo {
        wifi: String::new(),
        wifi_friendly: String::new(),
        wifi_mac: String::new(),
        ethernet: String::new(),
        ethernet_friendly: String::new(),
        ethernet_mac: String::new(),
        bluetooth: false,
    };

    let mut found_any = false;

    for line in ps_lines(script) {
        let p = split_pipe(&line);
        let tag = field(&p, 0);

        if tag == "NIC" {
            let name = field(&p, 1);
            let mac = field(&p, 2);
            let name_l = name.to_lowercase();

            if name_l.contains("wi-fi")
                || name_l.contains("wireless")
                || name_l.contains("wlan")
                || name_l.contains("802.11")
            {
                if info.wifi_friendly.is_empty() {
                    info.wifi = name.clone();
                    info.wifi_friendly = name;
                    info.wifi_mac = mac;
                    found_any = true;
                }
            } else if name_l.contains("ethernet") || name_l.contains("gbe") {
                if info.ethernet_friendly.is_empty() {
                    info.ethernet = name.clone();
                    info.ethernet_friendly = name;
                    info.ethernet_mac = mac;
                    found_any = true;
                }
            }
        } else if tag == "BT" {
            let count: u32 = field(&p, 1).parse().unwrap_or(0);
            info.bluetooth = count > 0;
        }
    }

    if found_any || info.bluetooth {
        Some(info)
    } else {
        None
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Audio  ←  Win32_SoundDevice
// ─────────────────────────────────────────────────────────────────────────────
pub fn audio() -> AudioInfo {
    let script = r#"Get-CimInstance Win32_SoundDevice | Select-Object -First 1 | ForEach-Object { "$($_.Manufacturer)|$($_.Name)" }"#;

    let lines = ps_lines(script);

    if let Some(line) = lines.first() {
        let p = split_pipe(line);
        let manufacturer = field(&p, 0);
        let model = field(&p, 1);

        return AudioInfo {
            manufacturer: if manufacturer.is_empty() { "Unknown".to_string() } else { manufacturer },
            model: if model.is_empty() { "Unknown".to_string() } else { model },
        };
    }

    AudioInfo {
        manufacturer: "Unknown".to_string(),
        model: "Unknown".to_string(),
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Camera  ←  Win32_PnPEntity (Camera / Image class)
// ─────────────────────────────────────────────────────────────────────────────
pub fn camera() -> Option<CameraInfo> {
    let script = r#"Get-CimInstance Win32_PnPEntity -Filter "PNPClass='Camera' OR PNPClass='Image'" -ErrorAction SilentlyContinue | Select-Object -First 1 | ForEach-Object { "$($_.Manufacturer)|$($_.Name)|$($_.DeviceID)|$($_.Status)" }"#;

    let lines = ps_lines(script);

    let line = lines.first()?;
    let p = split_pipe(line);

    let model = field(&p, 1);
    if model.is_empty() {
        return None;
    }

    Some(CameraInfo {
        vendor: field(&p, 0),
        model,
        device: field(&p, 2),
        status: field(&p, 3),
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// Motherboard  ←  Win32_BaseBoard + Win32_BIOS
// ─────────────────────────────────────────────────────────────────────────────
pub fn motherboard() -> MotherboardInfo {
    let script = r#"
$b = Get-CimInstance Win32_BaseBoard -ErrorAction SilentlyContinue | Select-Object -First 1
$bios = Get-CimInstance Win32_BIOS -ErrorAction SilentlyContinue | Select-Object -First 1
Write-Output "Manufacturer=$($b.Manufacturer)"
Write-Output "Model=$($b.Product)"
Write-Output "Revision=$($b.Version)"
Write-Output "Serial=$($b.SerialNumber)"
Write-Output "BiosVersion=$($bios.SMBIOSBIOSVersion)"
Write-Output "BiosDate=$(if ($bios.ReleaseDate) { $bios.ReleaseDate.ToString('yyyy-MM-dd') })"
Write-Output "BiosVendor=$($bios.Manufacturer)"
"#;

    let mut kv: HashMap<String, String> = HashMap::new();
    for line in ps_lines(script) {
        if let Some((k, v)) = line.split_once('=') {
            kv.insert(k.trim().to_string(), v.trim().to_string());
        }
    }
    let get = |k: &str| kv.get(k).cloned().unwrap_or_default();

    MotherboardInfo {
        manufacturer: get("Manufacturer"),
        model: get("Model"),
        revision: get("Revision"),
        serial_number: get("Serial"),
        bios_version: get("BiosVersion"),
        bios_date: get("BiosDate"),
        bios_vendor: get("BiosVendor"),
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bluetooth  ←  Win32_PnPEntity (Bluetooth class)
// ─────────────────────────────────────────────────────────────────────────────
pub fn bluetooth() -> BluetoothInfo {
    let script = r#"Get-CimInstance Win32_PnPEntity -Filter "PNPClass='Bluetooth'" -ErrorAction SilentlyContinue | Where-Object { $_.Name -notmatch 'Enumerator' } | Select-Object -First 1 | ForEach-Object { "$($_.Manufacturer)|$($_.Name)" }"#;

    let lines = ps_lines(script);

    if let Some(line) = lines.first() {
        let p = split_pipe(line);
        let manufacturer = field(&p, 0);
        let model = field(&p, 1);

        return BluetoothInfo {
            manufacturer: if manufacturer.is_empty() { "Unknown".to_string() } else { manufacturer },
            model: if model.is_empty() { "Unknown".to_string() } else { model },
        };
    }

    BluetoothInfo {
        manufacturer: "Unknown".to_string(),
        model: "Unknown".to_string(),
    }
}
