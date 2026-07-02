use anyhow::Result;
use std::process::Command;

use crate::models::device::StorageHealth;

pub fn collect()
-> Result<Vec<StorageHealth>>
{
    let mut result =
        Vec::<StorageHealth>::new();

    let output =
        Command::new("nvme")
            .args([
                "list"
            ])
            .output();

    if let Ok(out) = output
    {
        let text =
            String::from_utf8_lossy(
                &out.stdout
            );

        for line in text.lines()
        {
            if line.starts_with("/dev/nvme")
            {
                let device =
                    line
                        .split_whitespace()
                        .next()
                        .unwrap_or("")
                        .to_string();

                let health =
                    collect_nvme_health(
                        &device
                    );

                if let Ok(info) =
                    health
                {
                    result.push(
                        info
                    );
                }
            }
        }
    }

    Ok(result)
}

fn collect_nvme_health(
    device: &str
)
-> Result<StorageHealth>
{
    let output =
        crate::sudo::output(&[
            "nvme",
            "smart-log",
            device,
        ])?;

    let text =
        String::from_utf8_lossy(
            &output.stdout
        );

    let mut health =
        StorageHealth {

            device_name:
                device.to_string(),

            health_percent:
                None,

            temperature_c:
                None,

            power_on_hours:
                None,

            critical_warning:
                None,
        };

    for line in text.lines()
    {
        if line.contains(
            "percentage_used"
        )
        {
            let value =
                line.split(':')
                    .nth(1)
                    .unwrap_or("")
                    .trim()
                    .replace("%","");

            if let Ok(v) =
                value.parse::<f64>()
            {
                health.health_percent =
                    Some(
                        100.0 - v
                    );
            }
        }

        if line.contains(
            "temperature"
        )
        {
            let value =
                line.split(':')
                    .nth(1)
                    .unwrap_or("")
                    .trim()
                    .split_whitespace()
                    .next()
                    .unwrap_or("");

            if let Ok(v) =
                value.parse::<u32>()
            {
                health.temperature_c =
                    Some(v);
            }
        }

        if line.contains(
            "power_on_hours"
        )
        {
            let value =
                line.split(':')
                    .nth(1)
                    .unwrap_or("")
                    .trim();

            if let Ok(v) =
                value.parse::<u64>()
            {
                health.power_on_hours =
                    Some(v);
            }
        }

        if line.contains(
            "critical_warning"
        )
        {
            health.critical_warning =
                Some(
                    line.split(':')
                        .nth(1)
                        .unwrap_or("")
                        .trim()
                        .to_string()
                );
        }
    }

    Ok(health)
}