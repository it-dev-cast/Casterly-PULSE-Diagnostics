use anyhow::Result;
use std::fs;
use std::path::Path;

use crate::models::device::DisplayInfo;

pub fn collect() -> Result<Option<DisplayInfo>> {

    let drm_root = "/sys/class/drm";

    let entries = fs::read_dir(drm_root)?;

    for entry in entries {

        let entry = entry?;

        let name =
            entry.file_name()
                .to_string_lossy()
                .to_string();

        if !name.contains("eDP") {
            continue;
        }

        let edid_path =
            format!(
                "{}/{}/edid",
                drm_root,
                name
            );

        if !Path::new(&edid_path).exists() {
            continue;
        }

        let edid =
            fs::read(&edid_path)?;

        return Ok(
            Some(
                parse_edid(&edid)
            )
        );
    }

    Ok(None)
}

fn parse_edid(
    edid: &[u8]
) -> DisplayInfo {

    let manufacturer =
        decode_manufacturer(edid);

    let product_code =
        decode_product_code(edid);

    let panel_string =
        decode_panel_string(edid);

    let width_cm =
        edid.get(21)
            .copied()
            .unwrap_or(0);

    let height_cm =
        edid.get(22)
            .copied()
            .unwrap_or(0);

    let diagonal_inches =
        (((width_cm as f64).powi(2)
        + (height_cm as f64).powi(2))
        .sqrt())
        / 2.54;

    let resolution =
        decode_resolution(edid);

    DisplayInfo {

        manufacturer,

        model: product_code,

        panel_part_number:
            panel_string,

        resolution,

        size_inches:
            (diagonal_inches * 10.0)
                .round()
                / 10.0,
    }
}

fn decode_manufacturer(
    edid: &[u8]
) -> String {

    if edid.len() < 10 {
        return "Unknown".to_string();
    }

    let id =
        ((edid[8] as u16) << 8)
        | edid[9] as u16;

    let c1 =
        (((id >> 10) & 0x1F) as u8 + 64)
            as char;

    let c2 =
        (((id >> 5) & 0x1F) as u8 + 64)
            as char;

    let c3 =
        ((id & 0x1F) as u8 + 64)
            as char;

    let vendor =
        format!(
            "{}{}{}",
            c1,
            c2,
            c3
        );

    match vendor.as_str() {

        "BOE" => "BOE".to_string(),

        "AUO" => "AU Optronics".to_string(),

        "LGD" => "LG Display".to_string(),

        "CMN" => "Innolux".to_string(),

        "SDC" => "Samsung".to_string(),

        _ => vendor,
    }
}

fn decode_product_code(
    edid: &[u8]
) -> String {

    if edid.len() < 12 {
        return String::new();
    }

    let code =
        ((edid[11] as u16) << 8)
        | edid[10] as u16;

    format!("E{:04X}", code)
}

fn decode_panel_string(
    edid: &[u8]
) -> String {

    let mut offset: usize = 54;

    while offset + 18 <= edid.len() {

        if edid[offset] == 0x00
            && edid[offset + 1] == 0x00
            && edid[offset + 2] == 0x00
            && edid[offset + 3] == 0xFE
        {
            let text =
                String::from_utf8_lossy(
                    &edid[offset + 5..offset + 18]
                );

            return text
                .trim()
                .replace('\0', "")
                .to_string();
        }

        offset += 18;
    }

    String::new()
}

fn decode_resolution(
    edid: &[u8]
) -> String {

    if edid.len() < 62 {
        return String::new();
    }

    let h_active =
        edid[56] as u16
        | (((edid[58] & 0xF0) as u16) << 4);

    let v_active =
        edid[59] as u16
        | (((edid[61] & 0xF0) as u16) << 4);

    format!(
        "{}x{}",
        h_active,
        v_active
    )
}