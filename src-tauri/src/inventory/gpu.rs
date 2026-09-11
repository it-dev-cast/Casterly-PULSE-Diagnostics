use anyhow::Result;

use std::process::Command;

use crate::models::device::
    GpuInfo;

pub fn collect()
-> Result<Vec<GpuInfo>>
{
    let output =
        Command::new(
            "lspci"
        )
        .output()?;

    let text =
        String::from_utf8_lossy(
            &output.stdout
        );

    let mut gpus =
        Vec::new();

    for line in text.lines()
    {
        let lower =
            line.to_lowercase();

        if lower.contains("vga")
        ||
        lower.contains(
            "3d controller"
        )
        {
            let mut vendor =
                String::new();

            if line.contains(
                "Intel"
            )
            {
                vendor =
                    "Intel"
                    .to_string();
            }
            else if line.contains(
                "AMD"
            )
            {
                vendor =
                    "AMD"
                    .to_string();
            }
            else if line.contains(
                "NVIDIA"
            )
            {
                vendor =
                    "NVIDIA"
                    .to_string();
            }

            let bus_address =
                line
                .split_whitespace()
                .next()
                .unwrap_or("")
                .to_string();

            let vram =
                extract_vram(&bus_address);

            gpus.push(

                GpuInfo {

                    vendor,

                    model:
                        line.to_string(),

                    bus_address,

                    driver:
                        String::new(),

                    vram,

                    output_resolution:
                        String::new(),
                }
            );
        }
    }

    Ok(gpus)
}

fn extract_vram(bus_address: &str) -> String {
    // Try to extract VRAM from lspci -v output for the specific device
    let output = Command::new("lspci")
        .args(["-v", "-s", bus_address])
        .output();

    if let Ok(o) = output {
        let text = String::from_utf8_lossy(&o.stdout);
        // Look for memory size in output
        for line in text.lines() {
            if line.contains("Memory at") || line.contains("prefetchable") {
                // Try to extract size
                if let Some(size) = extract_memory_size(line) {
                    return size;
                }
            }
        }
    }

    String::new()
}

fn extract_memory_size(line: &str) -> Option<String> {
    // Look for patterns like "4G", "8G", "2M", etc.
    let parts: Vec<&str> = line.split_whitespace().collect();
    for part in parts {
        if part.ends_with('G') || part.ends_with('M') {
            if part[..part.len()-1].parse::<f64>().is_ok() {
                return Some(part.to_string());
            }
        }
    }
    None
}