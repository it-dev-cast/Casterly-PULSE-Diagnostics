use anyhow::Result;
use std::process::Command;

use crate::models::device::BluetoothInfo;

// =============================================================================
// bluetooth.rs — port of Bluetooth.py
// =============================================================================
// Finds the Bluetooth adapter via `lsusb` (falling back to `lspci`), detects
// the vendor from a known list, and uses the device line as the model.
// Under WSL we use the Windows host.
// =============================================================================

pub fn collect() -> Result<BluetoothInfo> {

    if crate::inventory::wslhost::is_wsl() {
        return Ok(crate::inventory::wslhost::bluetooth());
    }

    let vendors = [
        "Intel", "Realtek", "Broadcom", "Qualcomm", "MediaTek", "CSR",
    ];

    // lsusb | grep -i bluetooth | head -1
    let mut model = grep_first("lsusb", "bluetooth");

    // Fallback: lspci | grep -i bluetooth | head -1
    if model.is_empty() {
        model = grep_first("lspci", "bluetooth");
    }

    let mut manufacturer = String::new();
    let lower = model.to_lowercase();
    for v in vendors {
        if lower.contains(&v.to_lowercase()) {
            manufacturer = v.to_string();
            break;
        }
    }

    Ok(BluetoothInfo {
        manufacturer: if manufacturer.is_empty() {
            "Unknown".to_string()
        } else {
            manufacturer
        },
        model: if model.is_empty() {
            "Unknown".to_string()
        } else {
            model
        },
    })
}

/// Runs `cmd` and returns the first stdout line containing `needle` (case-insensitive).
fn grep_first(cmd: &str, needle: &str) -> String {
    let output = Command::new(cmd).output();

    if let Ok(o) = output {
        let text = String::from_utf8_lossy(&o.stdout);
        if let Some(line) = text
            .lines()
            .find(|l| l.to_lowercase().contains(needle))
        {
            return line.trim().to_string();
        }
    }

    String::new()
}
