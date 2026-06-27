use anyhow::Result;
use std::process::Command;

use crate::models::device::GpuInfo;

// =============================================================================
// gpu.rs — port of Graphics.py
// =============================================================================
// `lspci` lists the VGA / 3D / Display controllers. We detect the vendor from a
// known list and use the text after ": " as the model. The kernel driver in use
// is read from `lspci -k`. Under WSL we fall back to the Windows host.
// =============================================================================

pub fn collect() -> Result<Vec<GpuInfo>> {

    // WSL has no real PCI GPU — use the Windows host.
    if crate::inventory::wslhost::is_wsl() {
        return Ok(crate::inventory::wslhost::gpu());
    }

    let output = Command::new("lspci").output()?;
    let text = String::from_utf8_lossy(&output.stdout);

    let vendors = [
        "Intel", "AMD", "ATI", "NVIDIA", "Qualcomm", "Matrox",
    ];

    let mut gpus = Vec::new();

    for line in text.lines() {
        let lower = line.to_lowercase();

        // Graphics.py: grep -Ei 'VGA|3D|Display'
        let is_gpu = lower.contains("vga")
            || lower.contains("3d controller")
            || lower.contains("display controller");

        if !is_gpu {
            continue;
        }

        let bus_address = line
            .split_whitespace()
            .next()
            .unwrap_or("")
            .to_string();

        // Model = text after the first ": " (the device description).
        let model = line
            .split_once(": ")
            .map(|(_, rest)| rest.trim().to_string())
            .unwrap_or_else(|| line.trim().to_string());

        let mut vendor = String::new();
        for v in vendors {
            if lower.contains(&v.to_lowercase()) {
                vendor = v.to_string();
                break;
            }
        }

        let driver = get_kernel_driver(&bus_address);

        gpus.push(GpuInfo {
            vendor,
            model,
            bus_address,
            driver,
        });
    }

    Ok(gpus)
}

/// Reads the in-use kernel driver for a PCI device via `lspci -k -s <bus>`.
fn get_kernel_driver(bus: &str) -> String {
    if bus.is_empty() {
        return String::new();
    }

    let output = Command::new("lspci")
        .args(["-k", "-s", bus])
        .output();

    let text = match output {
        Ok(o) => String::from_utf8_lossy(&o.stdout).to_string(),
        Err(_) => return String::new(),
    };

    for line in text.lines() {
        let l = line.trim();
        if let Some(rest) = l.strip_prefix("Kernel driver in use:") {
            return rest.trim().to_string();
        }
    }

    String::new()
}
