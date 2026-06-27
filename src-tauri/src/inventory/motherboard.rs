use anyhow::Result;
use std::fs;
use std::process::Command;

use crate::models::device::MotherboardInfo;

// =============================================================================
// motherboard.rs — port of Motherboard.py
// =============================================================================
// Reads baseboard + BIOS identity from /sys/class/dmi/id. The board serial
// falls back to `dmidecode -t baseboard` and filters OEM placeholder strings.
// Under WSL we use the Windows host.
// =============================================================================

pub fn collect() -> Result<MotherboardInfo> {

    if crate::inventory::wslhost::is_wsl() {
        return Ok(crate::inventory::wslhost::motherboard());
    }

    Ok(MotherboardInfo {
        manufacturer: read_dmi("board_vendor"),
        model: read_dmi("board_name"),
        revision: read_dmi("board_version"),
        serial_number: get_board_serial(),
        bios_version: read_dmi("bios_version"),
        bios_date: read_dmi("bios_date"),
        bios_vendor: read_dmi("bios_vendor"),
    })
}

fn read_dmi(name: &str) -> String {
    fs::read_to_string(format!("/sys/class/dmi/id/{}", name))
        .unwrap_or_default()
        .trim()
        .to_string()
}

/// Rejects empty / OEM-placeholder serials (matches Motherboard.py).
fn is_valid_serial(s: &str) -> bool {
    let l = s.trim().to_lowercase();
    !matches!(
        l.as_str(),
        "" | "none" | "unknown" | "default string" | "to be filled by o.e.m."
    )
}

fn get_board_serial() -> String {
    let sysfs = read_dmi("board_serial");
    if is_valid_serial(&sysfs) {
        return sysfs;
    }

    // sudo dmidecode -t baseboard | grep 'Serial Number'
    let output = Command::new("sudo")
        .args(["dmidecode", "-t", "baseboard"])
        .output();

    if let Ok(o) = output {
        let text = String::from_utf8_lossy(&o.stdout);
        for line in text.lines() {
            if line.contains("Serial Number") {
                if let Some((_, v)) = line.split_once(':') {
                    let v = v.trim().to_string();
                    if is_valid_serial(&v) {
                        return v;
                    }
                }
            }
        }
    }

    "Not Available".to_string()
}
