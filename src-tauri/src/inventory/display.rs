use anyhow::Result;
use std::fs;
use std::process::Command;

use crate::models::device::DisplayInfo;

// =============================================================================
// display.rs — port of Display.py
// =============================================================================
// EDID (from /sys/class/drm) gives panel identity: manufacturer, product code,
// model name, physical size, manufacture year. xrandr gives the live mode
// (resolution + refresh + physical size in mm) and xinput tells us whether a
// touchscreen is present. On real Linux hardware all of these work; under WSL
// we fall back to the Windows host.
// =============================================================================

pub fn collect() -> Result<Option<DisplayInfo>> {

    // WSL has no DRM/X panel — use the Windows host.
    if crate::inventory::wslhost::is_wsl() {
        return Ok(crate::inventory::wslhost::display());
    }

    let edid = find_edid();

    let (
        manufacturer,
        product_code,
        panel,
        size_inches,
        edid_res,
        year,
    ) = match &edid {
        Some(b) => (
            decode_manufacturer(b),
            decode_product_code(b),
            decode_model_name(b),
            decode_size_inches(b),
            decode_resolution(b),
            decode_year(b),
        ),
        None => (
            String::new(),
            String::new(),
            String::new(),
            0.0,
            String::new(),
            String::new(),
        ),
    };

    // xrandr — current resolution + refresh + physical size (Display.py).
    let (xr_res, refresh, xr_size) = xrandr_info();

    let resolution = if !xr_res.is_empty() { xr_res } else { edid_res };

    let aspect_ratio = aspect_from_res(&resolution);

    let size = if !xr_size.is_empty() {
        xr_size
    } else {
        edid_size_mm(&edid)
    };

    let touchscreen =
        if has_touchscreen() { "Yes" } else { "No" }.to_string();

    if edid.is_none() && resolution.is_empty() {
        return Ok(None);
    }

    Ok(Some(DisplayInfo {
        manufacturer,
        model: product_code,
        panel_part_number: panel,
        resolution,
        size_inches,
        refresh_rate: refresh,
        aspect_ratio,
        size,
        touchscreen,
        manufacture_year: year,
    }))
}

// ─────────────────────────────────────────────────────────────────────────────
// EDID discovery + decoding
// ─────────────────────────────────────────────────────────────────────────────

/// Finds a usable EDID blob, preferring the internal panel (eDP).
fn find_edid() -> Option<Vec<u8>> {
    let drm_root = "/sys/class/drm";

    let mut fallback: Option<Vec<u8>> = None;

    let entries = fs::read_dir(drm_root).ok()?;

    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        let edid_path = format!("{}/{}/edid", drm_root, name);

        let bytes = match fs::read(&edid_path) {
            Ok(b) if !b.is_empty() => b,
            _ => continue,
        };

        if name.contains("eDP") {
            return Some(bytes);
        }

        if fallback.is_none() {
            fallback = Some(bytes);
        }
    }

    fallback
}

fn decode_manufacturer(edid: &[u8]) -> String {
    if edid.len() < 10 {
        return String::new();
    }

    let id = ((edid[8] as u16) << 8) | edid[9] as u16;

    let c1 = (((id >> 10) & 0x1F) as u8 + 64) as char;
    let c2 = (((id >> 5) & 0x1F) as u8 + 64) as char;
    let c3 = ((id & 0x1F) as u8 + 64) as char;

    let vendor = format!("{}{}{}", c1, c2, c3);

    match vendor.as_str() {
        "BOE" => "BOE".to_string(),
        "AUO" => "AU Optronics".to_string(),
        "LGD" => "LG Display".to_string(),
        "CMN" => "Innolux".to_string(),
        "SDC" => "Samsung".to_string(),
        "SHP" => "Sharp".to_string(),
        _ => vendor,
    }
}

fn decode_product_code(edid: &[u8]) -> String {
    if edid.len() < 12 {
        return String::new();
    }

    let code = ((edid[11] as u16) << 8) | edid[10] as u16;

    format!("E{:04X}", code)
}

/// The display "Model Number" = EDID Display Product Name descriptor (0xFC),
/// matching Display.py. Falls back to the alphanumeric/panel string (0xFE).
fn decode_model_name(edid: &[u8]) -> String {
    let name = decode_descriptor(edid, 0xFC);
    if !name.is_empty() {
        return name;
    }
    decode_descriptor(edid, 0xFE)
}

/// Reads an EDID 18-byte display descriptor by tag (0xFC name, 0xFE string,
/// 0xFF serial). Descriptors live at bytes 54, 72, 90, 108.
fn decode_descriptor(edid: &[u8], tag: u8) -> String {
    let mut offset: usize = 54;

    while offset + 18 <= edid.len() {
        if edid[offset] == 0x00
            && edid[offset + 1] == 0x00
            && edid[offset + 2] == 0x00
            && edid[offset + 3] == tag
        {
            let text = String::from_utf8_lossy(&edid[offset + 5..offset + 18]);
            return text
                .split('\n')
                .next()
                .unwrap_or("")
                .trim()
                .replace('\0', "")
                .trim()
                .to_string();
        }
        offset += 18;
    }

    String::new()
}

fn decode_resolution(edid: &[u8]) -> String {
    if edid.len() < 62 {
        return String::new();
    }

    let h_active = edid[56] as u16 | (((edid[58] & 0xF0) as u16) << 4);
    let v_active = edid[59] as u16 | (((edid[61] & 0xF0) as u16) << 4);

    if h_active == 0 || v_active == 0 {
        return String::new();
    }

    format!("{}x{}", h_active, v_active)
}

fn decode_size_inches(edid: &[u8]) -> f64 {
    let width_cm = edid.get(21).copied().unwrap_or(0) as f64;
    let height_cm = edid.get(22).copied().unwrap_or(0) as f64;

    let diagonal = ((width_cm.powi(2) + height_cm.powi(2)).sqrt()) / 2.54;

    (diagonal * 10.0).round() / 10.0
}

fn decode_year(edid: &[u8]) -> String {
    // EDID byte 17 = year of manufacture, offset from 1990.
    let y = edid.get(17).copied().unwrap_or(0) as u32;
    if y == 0 {
        return String::new();
    }
    (1990 + y).to_string()
}

fn edid_size_mm(edid: &Option<Vec<u8>>) -> String {
    match edid {
        Some(b) => {
            let w = b.get(21).copied().unwrap_or(0) as u32 * 10;
            let h = b.get(22).copied().unwrap_or(0) as u32 * 10;
            if w > 0 && h > 0 {
                format!("{}mm x {}mm", w, h)
            } else {
                String::new()
            }
        }
        None => String::new(),
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// xrandr / xinput
// ─────────────────────────────────────────────────────────────────────────────

/// Returns (resolution, refresh_rate, size_mm) parsed from `xrandr --current`.
fn xrandr_info() -> (String, String, String) {
    let output = Command::new("xrandr").arg("--current").output();

    let text = match output {
        Ok(o) => String::from_utf8_lossy(&o.stdout).to_string(),
        Err(_) => return (String::new(), String::new(), String::new()),
    };

    let mut resolution = String::new();
    let mut refresh = String::new();
    let mut size = String::new();

    for line in text.lines() {
        // Physical size sits on the "connected" line: "... 309mm x 173mm".
        if size.is_empty() && line.contains("mm x ") && line.contains("connected") {
            let toks: Vec<&str> = line.split_whitespace().collect();
            for (i, t) in toks.iter().enumerate() {
                if *t == "x" && i > 0 && i + 1 < toks.len() {
                    let a = toks[i - 1];
                    let b = toks[i + 1];
                    if a.ends_with("mm") && b.ends_with("mm") {
                        size = format!("{} x {}", a, b);
                        break;
                    }
                }
            }
        }

        // Current mode line contains a refresh token ending in '*'.
        if line.contains('*') {
            let toks: Vec<&str> = line.split_whitespace().collect();
            if let Some(first) = toks.first() {
                if first.contains('x') && resolution.is_empty() {
                    resolution = first.to_string();
                }
            }
            for t in &toks {
                if t.contains('*') {
                    let cleaned = t.trim_end_matches(|c| c == '*' || c == '+');
                    if !cleaned.is_empty() {
                        refresh = format!("{} Hz", cleaned);
                    }
                }
            }
        }
    }

    (resolution, refresh, size)
}

fn has_touchscreen() -> bool {
    let output = Command::new("xinput").arg("--list").output();

    match output {
        Ok(o) => String::from_utf8_lossy(&o.stdout)
            .to_lowercase()
            .contains("touch"),
        Err(_) => false,
    }
}

fn aspect_from_res(res: &str) -> String {
    let parts: Vec<&str> = res.split('x').collect();
    if parts.len() != 2 {
        return String::new();
    }

    let w: u64 = parts[0].trim().parse().unwrap_or(0);
    let h: u64 = parts[1].trim().parse().unwrap_or(0);

    if w == 0 || h == 0 {
        return String::new();
    }

    let g = gcd(w, h);
    format!("{}:{}", w / g, h / g)
}

fn gcd(a: u64, b: u64) -> u64 {
    if b == 0 {
        a
    } else {
        gcd(b, a % b)
    }
}
