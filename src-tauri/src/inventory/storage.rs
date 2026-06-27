use anyhow::Result;
use std::collections::HashMap;
use std::process::Command;

use crate::models::device::StorageDevice;

pub fn collect() -> Result<Vec<StorageDevice>> {
    // WSL exposes only its virtual disk — use the Windows host's real drives.
    if crate::inventory::wslhost::is_wsl() {
        return Ok(crate::inventory::wslhost::storage());
    }

    let output = Command::new("lsblk")
        .args([
            "-d",
            "-b",
            "-P",
            "-o",
            "NAME,SIZE,MODEL,SERIAL,TRAN",
        ])
        .output()?;

    let text = String::from_utf8_lossy(&output.stdout);

    let mut drives: Vec<StorageDevice> = Vec::new();

    let mut nvme_slot = 0;
    let mut sata_slot = 0;

    for line in text.lines() {
        let fields = parse_lsblk_line(line);

        let name = fields
            .get("NAME")
            .cloned()
            .unwrap_or_default();

        let model = fields
            .get("MODEL")
            .cloned()
            .unwrap_or_default();

        // lsblk frequently reports "FFFF…"/blank serials for NVMe, so read the
        // real serial straight from sysfs / udev first (the same sources
        // Storage.py uses) and only fall back to lsblk's value.
        let lsblk_serial = fields
            .get("SERIAL")
            .cloned()
            .unwrap_or_default();

        let mut serial = read_real_serial(&name);

        if is_placeholder_serial(&serial) {
            if !is_placeholder_serial(&lsblk_serial) {
                serial = lsblk_serial;
            } else {
                serial = String::new();
            }
        }

        let transport = fields
            .get("TRAN")
            .cloned()
            .unwrap_or_default();

        let size_bytes = fields
            .get("SIZE")
            .and_then(|s| s.parse::<f64>().ok())
            .unwrap_or(0.0);

        //
        // Ignore non-storage devices
        //

        if name.starts_with("loop")
            || name.starts_with("ram")
            || name.starts_with("sr")
        {
            continue;
        }

        //
        // Ignore USB boot media
        //

        if transport.to_lowercase() == "usb" {
            continue;
        }

        let device = format!("/dev/{}", name);

        let size_gb =
            size_bytes / 1024.0 / 1024.0 / 1024.0;

        let storage_type =
            detect_storage_type(
                &device,
                &transport,
                &model,
            );

        let slot =
            get_slot_name(
                &storage_type,
                &mut nvme_slot,
                &mut sata_slot,
            );

        let (
            firmware,
            health_percent,
            temperature_c,
            power_on_hours,
            critical_warning,
            power_cycles,
            media_errors,
        ) = get_smart_data(&device);

        drives.push(StorageDevice {
            slot,
            device,
            model,
            serial,
            firmware,
            size_gb,
            transport,
            storage_type,
            health_percent,
            temperature_c,
            power_on_hours,
            power_cycles,
            media_errors,
            critical_warning,
        });
    }

    println!("--------------------------------");
    println!("STORAGE TOPOLOGY");
    println!("--------------------------------");

    for drive in &drives {
        println!("{:?}", drive);
    }

    println!("--------------------------------");

    Ok(drives)
}

/// True when a serial is empty or a placeholder (all F / all 0).
fn is_placeholder_serial(serial: &str) -> bool {
    let cleaned = serial.replace(
        |c: char| matches!(c, 'F' | 'f' | '0' | ' ' | '.' | '-' | '_'),
        "",
    );
    cleaned.is_empty()
}

/// Reads the real device serial: sysfs first (NVMe + many SATA), then
/// `udevadm ... ID_SERIAL_SHORT` (SATA/USB) — the sources Storage.py uses.
fn read_real_serial(name: &str) -> String {
    let path = format!("/sys/block/{}/device/serial", name);
    let sysfs = std::fs::read_to_string(path)
        .unwrap_or_default()
        .trim()
        .to_string();

    if !is_placeholder_serial(&sysfs) {
        return sysfs;
    }

    // udevadm info --query=property --name=/dev/<name> | grep ID_SERIAL_SHORT
    let output = Command::new("udevadm")
        .args([
            "info",
            "--query=property",
            &format!("--name=/dev/{}", name),
        ])
        .output();

    if let Ok(o) = output {
        let text = String::from_utf8_lossy(&o.stdout);
        for line in text.lines() {
            if let Some(v) = line.strip_prefix("ID_SERIAL_SHORT=") {
                return v.trim().to_string();
            }
        }
    }

    String::new()
}

fn parse_lsblk_line(
    line: &str,
) -> HashMap<String, String> {
    let mut map = HashMap::new();

    for token in line.split("\" ") {
        let cleaned = token.trim();

        if let Some(pos) = cleaned.find('=') {
            let key = &cleaned[..pos];

            let value = cleaned[pos + 1..]
                .trim_matches('"')
                .to_string();

            map.insert(
                key.to_string(),
                value,
            );
        }
    }

    map
}

fn detect_storage_type(
    device: &str,
    transport: &str,
    model: &str,
) -> String {
    let t = transport.to_lowercase();

    let m = model.to_lowercase();

    if device.contains("nvme") {
        return "NVMe".to_string();
    }

    if t.contains("sata") {
        if m.contains("ssd") {
            return "SATA SSD".to_string();
        }

        return "SATA HDD".to_string();
    }

    "Unknown".to_string()
}

fn get_slot_name(
    storage_type: &str,
    nvme_slot: &mut u32,
    sata_slot: &mut u32,
) -> String {
    match storage_type {
        "NVMe" => {
            *nvme_slot += 1;

            format!("NVMe{}", nvme_slot)
        }

        _ => {
            *sata_slot += 1;

            format!("SATA{}", sata_slot)
        }
    }
}

fn get_smart_data(
    device: &str,
) -> (
    String,
    Option<u32>,
    Option<u32>,
    Option<u64>,
    Option<String>,
    Option<u64>,
    Option<u64>,
) {
    let output = Command::new("sudo")
        .args([
            "smartctl",
            "-a",
            device,
        ])
        .output();

    let output = match output {
        Ok(o) => o,

        Err(_) => {
            return (
                String::new(),
                None,
                None,
                None,
                None,
                None,
                None,
            );
        }
    };

    let text =
        String::from_utf8_lossy(
            &output.stdout,
        );

    let mut firmware =
        String::new();

    let mut health = None;

    let mut temperature = None;

    let mut power_hours = None;

    let mut critical_warning = None;

    let mut power_cycles = None;

    let mut media_errors = None;

    for line in text.lines() {
        let l = line.trim();

        //
        // Firmware
        //

        if l.starts_with(
            "Firmware Version:"
        ) {
            firmware = l
                .replace(
                    "Firmware Version:",
                    "",
                )
                .trim()
                .to_string();
        }

        //
        // NVMe Health
        //
        // Percentage Used = wear
        //

        if l.starts_with(
            "Percentage Used:"
        ) {
            if let Some(v) =
                l.split(':').nth(1)
            {
                let wear = v
                    .trim()
                    .replace("%", "")
                    .parse::<u32>()
                    .unwrap_or(0);

                health = Some(
                    100_u32
                        .saturating_sub(
                            wear,
                        ),
                );
            }
        }

        //
        // SATA SMART fallback
        //

        if l.contains("PASSED")
            && health.is_none()
        {
            health = Some(100);
        }

        if l.contains("FAILED") {
            health = Some(0);

            critical_warning =
                Some(
                    "SMART FAILED"
                        .to_string(),
                );
        }

        //
        // Temperature
        //

        if l.starts_with(
            "Temperature:"
        ) {
            if let Some(v) =
                l.split(':').nth(1)
            {
                temperature = v
                    .trim()
                    .split_whitespace()
                    .next()
                    .and_then(
                        |x| x.parse().ok(),
                    );
            }
        }

        //
        // NVMe Power Hours
        //

        if l.starts_with(
            "Power On Hours:"
        ) {
            if let Some(v) =
                l.split(':').nth(1)
            {
                power_hours = v
                    .trim()
                    .replace(",", "")
                    .parse()
                    .ok();
            }
        }

        //
        // SATA Power Hours
        //

        if l.contains(
            "Power_On_Hours"
        ) && power_hours.is_none()
        {
            if let Some(v) =
                l.split_whitespace()
                    .last()
            {
                power_hours =
                    v.parse().ok();
            }
        }

        //
        // Power Cycles
        //

        if l.starts_with(
            "Power Cycles:"
        ) {
            if let Some(v) =
                l.split(':').nth(1)
            {
                power_cycles = v
                    .trim()
                    .replace(",", "")
                    .parse()
                    .ok();
            }
        }

        //
        // Media Errors
        //

        if l.starts_with(
            "Media and Data Integrity Errors:"
        ) {
            if let Some(v) =
                l.split(':').nth(1)
            {
                media_errors = v
                    .trim()
                    .replace(",", "")
                    .parse()
                    .ok();
            }
        }

        //
        // Critical Warning
        //

        if l.starts_with(
            "Critical Warning:"
        ) {
            critical_warning =
                Some(
                    l.replace(
                        "Critical Warning:",
                        "",
                    )
                    .trim()
                    .to_string(),
                );
        }
    }

    (
        firmware,
        health,
        temperature,
        power_hours,
        critical_warning,
        power_cycles,
        media_errors,
    )
}