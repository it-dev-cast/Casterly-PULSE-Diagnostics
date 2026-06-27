use anyhow::Result;
use std::collections::HashMap;
use std::process::Command;

use crate::models::device::CpuInfo;

/// Converts an lscpu cache string (e.g. "192 KiB", "1.3 MiB (5 instances)")
/// into MiB. Mirrors the `cache_to_mb` helper in Processor.py: it reads the
/// leading number and the unit token, ignoring any trailing text.
fn cache_to_mb(value: &str) -> f64 {

    let parts: Vec<&str> =
        value.split_whitespace().collect();

    if parts.is_empty() {
        return 0.0;
    }

    let num: f64 =
        match parts[0].parse() {
            Ok(n) => n,
            Err(_) => return 0.0,
        };

    let unit = parts.get(1).copied().unwrap_or("");

    if unit.contains("KiB") {
        num / 1024.0
    } else if unit.contains("MiB") {
        num
    } else if unit.contains("GiB") {
        num * 1024.0
    } else {
        0.0
    }
}

pub fn collect() -> Result<CpuInfo> {

    let output =
        Command::new("lscpu")
            .output()?;

    let text =
        String::from_utf8_lossy(
            &output.stdout
        );

    let mut data =
        HashMap::<String,String>::new();

    for line in text.lines() {

        if let Some((k,v)) =
            line.split_once(':')
        {
            data.insert(
                k.trim().to_string(),
                v.trim().to_string()
            );
        }
    }

    let manufacturer =
        data.get("Vendor ID")
            .unwrap_or(&String::new())
            .to_string();

    let model =
        data.get("Model name")
            .unwrap_or(&String::new())
            .to_string();

    let architecture =
        data.get("Architecture")
            .unwrap_or(&String::new())
            .to_string();

    let sockets =
        data.get("Socket(s)")
            .unwrap_or(&"0".to_string())
            .parse()
            .unwrap_or(0);

    let cores_per_socket =
        data.get("Core(s) per socket")
            .unwrap_or(&"0".to_string())
            .parse()
            .unwrap_or(0);

    let threads =
        data.get("CPU(s)")
            .unwrap_or(&"0".to_string())
            .parse()
            .unwrap_or(0);

    let max_speed_mhz =
        data.get("CPU max MHz")
            .unwrap_or(&"0".to_string())
            .parse()
            .unwrap_or(0.0);

    let min_speed_mhz =
        data.get("CPU min MHz")
            .unwrap_or(&"0".to_string())
            .parse()
            .unwrap_or(0.0);

    let current_speed_mhz =
        get_current_frequency();

    let cache_l1 =
        data.get("L1d cache")
            .unwrap_or(&String::new())
            .to_string();

    let cache_l2 =
        data.get("L2 cache")
            .unwrap_or(&String::new())
            .to_string();

    let cache_l3 =
        data.get("L3 cache")
            .unwrap_or(&String::new())
            .to_string();

    // L1 instruction cache — needed for the total but not stored separately.
    let cache_l1i =
        data.get("L1i cache")
            .unwrap_or(&String::new())
            .to_string();

    // Total cache in MiB = L1d + L1i + L2 + L3 (mirrors Processor.py).
    let cache_total_mb = {
        let total =
            cache_to_mb(&cache_l1)
            + cache_to_mb(&cache_l1i)
            + cache_to_mb(&cache_l2)
            + cache_to_mb(&cache_l3);

        // Round to 2 decimals like the Python round(..., 2).
        (total * 100.0).round() / 100.0
    };

    let virtualization =
        data.contains_key("Virtualization");

    let hyper_threading =
        threads >
        (sockets * cores_per_socket);

    let flags =
        get_cpu_flags()?;

    Ok(

        CpuInfo {

            manufacturer,

            model,

            architecture,

            sockets,

            cores_per_socket,

            threads,

            max_speed_mhz,

            min_speed_mhz,

            current_speed_mhz,

            cache_l1,

            cache_l2,

            cache_l3,

            cache_total_mb,

            virtualization,

            hyper_threading,

            flags,
        }
    )
}

fn get_current_frequency() -> f64 {

    let output =
        Command::new("cat")
            .arg(
                "/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq"
            )
            .output();

    if let Ok(out) = output {

        let text =
            String::from_utf8_lossy(
                &out.stdout
            );

        if let Ok(freq) =
            text.trim().parse::<f64>()
        {
            return freq / 1000.0;
        }
    }

    0.0
}

fn get_cpu_flags()
-> Result<Vec<String>>
{
    let output =
        Command::new("cat")
            .arg("/proc/cpuinfo")
            .output()?;

    let text =
        String::from_utf8_lossy(
            &output.stdout
        );

    for line in text.lines() {

        if line.starts_with("flags")
        {
            if let Some(flags) =
                line.split(':').nth(1)
            {
                return Ok(

                    flags
                        .split_whitespace()
                        .map(|x| x.to_string())
                        .collect()
                );
            }
        }
    }

    Ok(vec![])
}