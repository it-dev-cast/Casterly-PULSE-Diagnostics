use anyhow::Result;

use std::fs;

use crate::models::device::BatteryInfo;

pub fn collect()
-> Result<Option<BatteryInfo>>
{
    // WSL doesn't pass through the battery — use the Windows host.
    if crate::inventory::wslhost::is_wsl() {
        return Ok(crate::inventory::wslhost::battery());
    }

    let power_supply =
        "/sys/class/power_supply";

    let mut battery_path =
        String::new();

    for entry in fs::read_dir(
        power_supply
    )?
    {
        let entry =
            entry?;

        let name =
            entry
                .file_name()
                .to_string_lossy()
                .to_string();

        if name.starts_with("BAT")
        {
            battery_path =
                format!(
                    "{}/{}",
                    power_supply,
                    name
                );

            break;
        }
    }

    if battery_path.is_empty()
    {
        return Ok(None);
    }

    //
    // ENERGY based batteries
    //
    let mut design_capacity =
        read_u64(
            &battery_path,
            "energy_full_design"
        );

    let mut full_capacity =
        read_u64(
            &battery_path,
            "energy_full"
        );

    let mut current_capacity =
        read_u64(
            &battery_path,
            "energy_now"
        );

    //
    // CHARGE based batteries
    //
    if design_capacity == 0
    {
        design_capacity =
            read_u64(
                &battery_path,
                "charge_full_design"
            );
    }

    if full_capacity == 0
    {
        full_capacity =
            read_u64(
                &battery_path,
                "charge_full"
            );
    }

    if current_capacity == 0
    {
        current_capacity =
            read_u64(
                &battery_path,
                "charge_now"
            );
    }

    let design_capacity_wh =
        convert_to_wh(
            design_capacity
        );

    let full_capacity_wh =
        convert_to_wh(
            full_capacity
        );

    let current_capacity_wh =
        convert_to_wh(
            current_capacity
        );

    let health_percent =
        if design_capacity > 0
        {
            (full_capacity as f64
                / design_capacity as f64)
                * 100.0
        }
        else
        {
            0.0
        };

    println!(
        "BATTERY RAW: DESIGN={} FULL={} NOW={}",
        design_capacity,
        full_capacity,
        current_capacity
    );

    println!(
        "BATTERY WH : DESIGN={:.1} FULL={:.1} NOW={:.1}",
        design_capacity_wh,
        full_capacity_wh,
        current_capacity_wh
    );

    println!(
        "BATTERY HEALTH: {:.1}%",
        health_percent
    );

    Ok(

        Some(

            BatteryInfo {

                manufacturer:
                    read_string(
                        &battery_path,
                        "manufacturer"
                    ),

                model:
                    read_string(
                        &battery_path,
                        "model_name"
                    ),

                serial_number:
                    read_string(
                        &battery_path,
                        "serial_number"
                    ),

                technology:
                    read_string(
                        &battery_path,
                        "technology"
                    ),

                status:
                    read_string(
                        &battery_path,
                        "status"
                    ),

                cycle_count:
                    read_u32(
                        &battery_path,
                        "cycle_count"
                    ),

                //
                // Raw values
                //
                design_capacity_mwh:
                    design_capacity,

                full_charge_capacity_mwh:
                    full_capacity,

                current_capacity_mwh:
                    current_capacity,

                voltage_mv:
                    read_u64(
                        &battery_path,
                        "voltage_now"
                    ),

                //
                // Normalized values
                //
                design_capacity_wh:
                    design_capacity_wh,

                full_charge_capacity_wh:
                    full_capacity_wh,

                current_capacity_wh:
                    current_capacity_wh,

                //
                // Wear %
                //
                health_percent:
                    health_percent,
            }
        )
    )
}

fn convert_to_wh(
    value: u64
)
-> f64
{
    // Linux sysfs energy_* values are in µWh (microwatt-hours), e.g. a 52 Wh
    // battery reports ~52,000,000. mWh sources (e.g. Windows WMI) report ~52,000.
    if value >= 1_000_000 {
        // µWh → Wh
        value as f64 / 1_000_000.0
    } else if value >= 1_000 {
        // mWh → Wh
        value as f64 / 1_000.0
    } else {
        // already Wh
        value as f64
    }
}

fn read_string(
    base: &str,
    file: &str
)
-> String
{
    fs::read_to_string(
        format!(
            "{}/{}",
            base,
            file
        )
    )
    .unwrap_or_default()
    .trim()
    .to_string()
}

fn read_u32(
    base: &str,
    file: &str
)
-> u32
{
    fs::read_to_string(
        format!(
            "{}/{}",
            base,
            file
        )
    )
    .unwrap_or_default()
    .trim()
    .parse()
    .unwrap_or(0)
}

fn read_u64(
    base: &str,
    file: &str
)
-> u64
{
    fs::read_to_string(
        format!(
            "{}/{}",
            base,
            file
        )
    )
    .unwrap_or_default()
    .trim()
    .parse()
    .unwrap_or(0)
}