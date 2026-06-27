use anyhow::Result;
use std::process::Command;

use crate::models::device::CameraInfo;

pub fn collect() -> Result<Option<CameraInfo>> {

    // WSL doesn't pass through the webcam — use the Windows host.
    if crate::inventory::wslhost::is_wsl() {
        return Ok(crate::inventory::wslhost::camera());
    }

    let output = Command::new("v4l2-ctl")
        .arg("--list-devices")
        .output();

    let output = match output {

        Ok(o) => o,

        Err(_) => {
            return Ok(None);
        }
    };

    let text =
        String::from_utf8_lossy(
            &output.stdout
        );

    let mut model =
        String::new();

    let mut device =
        String::new();

    for line in text.lines() {

        let l = line.trim();

        //
        // Device name line
        //
        if l.contains("Webcam")
            || l.contains("Camera")
            || l.contains("Integrated")
        {
            model =
                l.split(':')
                 .next()
                 .unwrap_or("")
                 .trim()
                 .to_string();
        }

        //
        // First video node
        //
        if l.starts_with("/dev/video")
            && device.is_empty()
        {
            device =
                l.to_string();
        }
    }

    if model.is_empty() {

        return Ok(None);
    }

    let vendor =
        detect_vendor(&model);

    let camera =
        CameraInfo {

            vendor,

            model,

            device,

            status:
                "Detected"
                    .to_string(),
        };

    println!(
        "CAMERA INFO: {:?}",
        camera
    );

    Ok(
        Some(camera)
    )
}

fn detect_vendor(
    model: &str
) -> String {

    let m =
        model.to_lowercase();

    if m.contains("integrated_webcam_hd") {

        return "Realtek"
            .to_string();
    }

    if m.contains("realtek") {

        return "Realtek"
            .to_string();
    }

    if m.contains("sunplus") {

        return "Sunplus"
            .to_string();
    }

    if m.contains("chicony") {

        return "Chicony"
            .to_string();
    }

    if m.contains("bison") {

        return "Bison"
            .to_string();
    }

    if m.contains("liteon") {

        return "Lite-On"
            .to_string();
    }

    "Unknown"
        .to_string()
}