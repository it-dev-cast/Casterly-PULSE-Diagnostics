use anyhow::Result;
use std::process::Command;

use crate::models::device::AudioInfo;

/// Collects the primary audio controller's manufacturer and model.
/// Port of Audio.py: parse the first `lspci` line containing "audio",
/// take the text after ": " as the model, and match a known vendor name.
pub fn collect() -> Result<AudioInfo> {

    // WSL has no real PCI audio device — use the Windows host.
    if crate::inventory::wslhost::is_wsl() {
        return Ok(crate::inventory::wslhost::audio());
    }

    let mut model = String::new();
    let mut manufacturer = String::new();

    let output =
        Command::new("lspci")
            .output();

    if let Ok(o) = output {

        let text =
            String::from_utf8_lossy(&o.stdout);

        // lspci | grep -i 'audio' | head -1
        let audio_line =
            text.lines()
                .find(|l| l.to_lowercase().contains("audio"));

        if let Some(line) = audio_line {

            // Split once on ": " — the remainder is the device description.
            if let Some((_, rest)) = line.split_once(": ") {

                model = rest.trim().to_string();

                let vendors = [
                    "Intel", "Realtek", "AMD", "NVIDIA",
                    "Creative", "Qualcomm", "Conexant",
                    "Cirrus", "ESS", "MediaTek",
                ];

                let lower = model.to_lowercase();

                for v in vendors {
                    if lower.contains(v.to_lowercase().as_str()) {
                        manufacturer = v.to_string();
                        break;
                    }
                }
            }
        }
    }

    Ok(
        AudioInfo {
            manufacturer:
                if manufacturer.is_empty() {
                    "Unknown".to_string()
                } else {
                    manufacturer
                },
            model:
                if model.is_empty() {
                    "Unknown".to_string()
                } else {
                    model
                },
        }
    )
}
