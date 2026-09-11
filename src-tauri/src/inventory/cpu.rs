use anyhow::Result;
use std::collections::HashMap;
use std::process::Command;

use crate::models::device::CpuInfo;

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

    let virtualization =
        data.contains_key("Virtualization");

    let hyper_threading =
        threads >
        (sockets * cores_per_socket);

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

            virtualization,

            hyper_threading,
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
