use anyhow::Result;

use crate::models::device::MemoryModule;

pub fn collect() -> Result<Vec<MemoryModule>>
{
    let output =
        crate::sudo::output(&[
            "dmidecode",
            "-t",
            "memory",
        ])?;

    let text =
        String::from_utf8_lossy(
            &output.stdout
        );

    let mut modules =
        Vec::<MemoryModule>::new();

    let mut slot =
        String::new();

    let mut bank_locator =
        String::new();

    let mut size_mb =
        0u64;

    let mut memory_type =
        String::new();

    let mut manufacturer =
        String::new();

    let mut serial =
        String::new();

    let mut part_number =
        String::new();

    let mut speed_mhz =
        0u32;

    let mut is_empty =
        false;

    let mut is_onboard =
        false;

    let mut form_factor =
        String::new();

    for line in text.lines()
    {
        let l =
            line.trim();

        //
        // New Memory Device section
        //
        if l.starts_with(
            "Memory Device"
        )
        {
            if !slot.is_empty()
            {
                modules.push(

                    MemoryModule {

                        slot:
                            slot.clone(),

                        bank_locator:
                            bank_locator.clone(),

                        size_mb,

                        memory_type:
                            memory_type.clone(),

                        manufacturer:
                            manufacturer.clone(),

                        serial:
                            serial.clone(),

                        part_number:
                            part_number.clone(),

                        speed_mhz,

                        is_empty,

                        is_onboard,
                    }
                );
            }

            slot.clear();

            bank_locator.clear();

            memory_type.clear();

            manufacturer.clear();

            serial.clear();

            part_number.clear();

            form_factor.clear();

            size_mb = 0;

            speed_mhz = 0;

            is_empty = false;

            is_onboard = false;

            continue;
        }

        //
        // Locator
        //
        if l.starts_with(
            "Locator:"
        )
        {
            slot =
                l.replace(
                    "Locator:",
                    ""
                )
                .trim()
                .to_string();

            let lower =
                slot.to_lowercase();

            if lower.contains(
                "motherboard"
            )
            ||
            lower.contains(
                "system board"
            )
            ||
            lower.contains(
                "onboard"
            )
            {
                is_onboard = true;
            }
        }

        //
        // Bank Locator
        //
        if l.starts_with(
            "Bank Locator:"
        )
        {
            bank_locator =
                l.replace(
                    "Bank Locator:",
                    ""
                )
                .trim()
                .to_string();
        }

        //
        // Form Factor
        //
        if l.starts_with(
            "Form Factor:"
        )
        {
            form_factor =
                l.replace(
                    "Form Factor:",
                    ""
                )
                .trim()
                .to_string();

            let ff =
                form_factor.to_lowercase();

            if ff.contains(
                "row of chips"
            )
            ||
            ff.contains(
                "soldered"
            )
            {
                is_onboard = true;
            }
        }

        //
        // Size
        //
        if l.starts_with(
            "Size:"
        )
        {
            if l.contains(
                "No Module Installed"
            )
            ||
            l.contains(
                "Not Installed"
            )
            {
                is_empty = true;

                size_mb = 0;

                continue;
            }

            let value =
                l.replace(
                    "Size:",
                    ""
                )
                .trim()
                .to_string();

            if value.contains(
                "GB"
            )
            {
                size_mb =
                    value
                        .replace(
                            "GB",
                            ""
                        )
                        .trim()
                        .parse::<u64>()
                        .unwrap_or(0)
                        * 1024;
            }
            else if value.contains(
                "MB"
            )
            {
                size_mb =
                    value
                        .replace(
                            "MB",
                            ""
                        )
                        .trim()
                        .parse::<u64>()
                        .unwrap_or(0);
            }
        }

        //
        // Memory Type
        //
        if l.starts_with(
            "Type:"
        )
        &&
        !l.starts_with(
            "Type Detail:"
        )
        {
            memory_type =
                l.replace(
                    "Type:",
                    ""
                )
                .trim()
                .to_string();
        }

        //
        // Manufacturer
        //
        if l.starts_with(
            "Manufacturer:"
        )
        {
            manufacturer =
                l.replace(
                    "Manufacturer:",
                    ""
                )
                .trim()
                .to_string();

            if manufacturer.is_empty()
            {
                manufacturer =
                    "Unknown"
                        .to_string();
            }
        }

        //
        // Serial Number
        //
        if l.starts_with(
            "Serial Number:"
        )
        {
            serial =
                l.replace(
                    "Serial Number:",
                    ""
                )
                .trim()
                .to_string();
        }

        //
        // Part Number
        //
        if l.starts_with(
            "Part Number:"
        )
        {
            part_number =
                l.replace(
                    "Part Number:",
                    ""
                )
                .trim()
                .to_string();
        }

        //
        // Configured Speed
        //
        if l.starts_with(
            "Configured Memory Speed:"
        )
        {
            speed_mhz =
                l.replace(
                    "Configured Memory Speed:",
                    ""
                )
                .replace(
                    "MT/s",
                    ""
                )
                .trim()
                .parse()
                .unwrap_or(0);
        }
    }

    //
    // Push last module
    //
    if !slot.is_empty()
    {
        modules.push(

            MemoryModule {

                slot,

                bank_locator,

                size_mb,

                memory_type,

                manufacturer,

                serial,

                part_number,

                speed_mhz,

                is_empty,

                is_onboard,
            }
        );
    }

    //
    // Topology Output
    //
    println!(
        "--------------------------------"
    );

    println!(
        "MEMORY TOPOLOGY"
    );

    println!(
        "--------------------------------"
    );

    for m in &modules
    {
        println!(
            "{:?}",
            m
        );
    }

    let total_mb : u64 =
        modules
            .iter()
            .filter(|m| !m.is_empty)
            .map(|m| m.size_mb)
            .sum();

    let empty_slots =
        modules
            .iter()
            .filter(|m| m.is_empty)
            .count();

    let onboard_modules =
        modules
            .iter()
            .filter(|m| m.is_onboard)
            .count();

    println!(
        "--------------------------------"
    );

    println!(
        "Installed RAM : {:.1} GB",
        total_mb as f64 / 1024.0
    );

    println!(
        "Modules       : {}",
        modules.len()
    );

    println!(
        "Empty Slots   : {}",
        empty_slots
    );

    println!(
        "Onboard Mods  : {}",
        onboard_modules
    );

    println!(
        "--------------------------------"
    );

    Ok(modules)
}