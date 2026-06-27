use anyhow::Result;
use std::collections::HashMap;
use std::fs;
use std::process::Command;

use crate::models::device::SystemInfo;

pub fn collect() -> Result<SystemInfo> {

    let mut manufacturer =
        read_file(
            "/sys/devices/virtual/dmi/id/sys_vendor"
        );

    let mut model =
        read_file(
            "/sys/devices/virtual/dmi/id/product_name"
        );

    let mut serial =
        read_file(
            "/sys/devices/virtual/dmi/id/product_serial"
        );

    let mut uuid =
        read_file(
            "/sys/devices/virtual/dmi/id/product_uuid"
        );

    if serial.is_empty()
    {
        serial =
            get_dmidecode_value(
                "system-serial-number"
            );
    }

    if uuid.is_empty()
    {
        uuid =
            get_dmidecode_value(
                "system-uuid"
            );
    }

    // Additional DMI/SMBIOS system fields (mirrors System.py).
    // Read from sysfs first, fall back to dmidecode if empty.
    let mut version =
        read_file(
            "/sys/devices/virtual/dmi/id/product_version"
        );

    if version.is_empty()
    {
        version =
            get_dmidecode_value(
                "system-version"
            );
    }

    let mut sku_number =
        read_file(
            "/sys/devices/virtual/dmi/id/product_sku"
        );

    if sku_number.is_empty()
    {
        sku_number =
            get_dmidecode_value(
                "system-sku-number"
            );
    }

    let mut family =
        read_file(
            "/sys/devices/virtual/dmi/id/product_family"
        );

    if family.is_empty()
    {
        family =
            get_dmidecode_value(
                "system-family"
            );
    }

    // WSL fallback: WSL2 doesn't expose the host laptop's DMI/SMBIOS tables, so
    // every sysfs read above comes back empty. When running under WSL, pull the
    // real values from the Windows host via powershell.exe so the System card
    // shows live data during development. On real Linux hardware this is skipped
    // because manufacturer/model are already populated from sysfs.
    if is_wsl() && manufacturer.is_empty() && model.is_empty()
    {
        let host = get_wsl_host_system();

        if manufacturer.is_empty() {
            manufacturer =
                host.get("Manufacturer").cloned().unwrap_or_default();
        }
        if model.is_empty() {
            model =
                host.get("Model").cloned().unwrap_or_default();
        }
        if version.is_empty() {
            version =
                host.get("Version").cloned().unwrap_or_default();
        }
        if serial.is_empty() {
            serial =
                host.get("Serial").cloned().unwrap_or_default();
        }
        if uuid.is_empty() {
            uuid =
                host.get("UUID").cloned().unwrap_or_default();
        }
        if sku_number.is_empty() {
            sku_number =
                host.get("SKU").cloned().unwrap_or_default();
        }
        if family.is_empty() {
            family =
                host.get("Family").cloned().unwrap_or_default();
        }
    }

    Ok(
        SystemInfo {

            manufacturer,

            model,

            serial_number:
                serial,

            uuid,

            version,

            sku_number,

            family,
        }
    )
}

fn read_file(
    path: &str
)
-> String
{
    fs::read_to_string(path)
        .unwrap_or_default()
        .trim()
        .to_string()
}

fn get_dmidecode_value(
    key: &str
)
-> String
{
    let output =
        Command::new("sudo")
            .args([
                "dmidecode",
                "-s",
                key
            ])
            .output();

    match output
    {
        Ok(o) => {

            String::from_utf8_lossy(
                &o.stdout
            )
            .trim()
            .to_string()
        }

        Err(_) => String::new(),
    }
}

/// Returns true when running inside WSL (the Linux kernel release string
/// contains "microsoft" / "wsl").
fn is_wsl() -> bool {

    fs::read_to_string("/proc/sys/kernel/osrelease")
        .map(|s| {
            let lower = s.to_lowercase();
            lower.contains("microsoft") || lower.contains("wsl")
        })
        .unwrap_or(false)
}

/// Fetches the Windows host's system identity via powershell.exe (WMI/CIM).
/// Returns a key→value map: Manufacturer, Model, Version, Serial, UUID, SKU,
/// Family. Empty map if powershell.exe is unavailable or fails.
fn get_wsl_host_system() -> HashMap<String, String> {

    let mut map = HashMap::new();

    // One PowerShell call emits "Key=Value" lines that are easy to parse.
    let script = "\
$cs   = Get-CimInstance Win32_ComputerSystem; \
$bios = Get-CimInstance Win32_BIOS; \
$prod = Get-CimInstance Win32_ComputerSystemProduct; \
Write-Output ('Manufacturer=' + $cs.Manufacturer); \
Write-Output ('Model=' + $cs.Model); \
Write-Output ('Version=' + $prod.Version); \
Write-Output ('Serial=' + $bios.SerialNumber); \
Write-Output ('UUID=' + $prod.UUID); \
Write-Output ('SKU=' + $cs.SystemSKUNumber); \
Write-Output ('Family=' + $cs.SystemFamily)";

    let output =
        Command::new("powershell.exe")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                script,
            ])
            .output();

    if let Ok(o) = output {

        let text =
            String::from_utf8_lossy(&o.stdout);

        for line in text.lines() {

            if let Some((k, v)) = line.split_once('=') {

                let value = v.trim().to_string();

                if !value.is_empty() {
                    map.insert(
                        k.trim().to_string(),
                        value,
                    );
                }
            }
        }
    }

    map
}