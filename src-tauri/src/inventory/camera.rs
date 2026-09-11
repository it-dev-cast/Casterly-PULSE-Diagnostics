use anyhow::Result;
use std::process::Command;

use crate::models::device::CameraInfo;

pub fn collect() -> Result<Option<CameraInfo>> {

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

    // v4l2-ctl groups devices like:
    //   "<name> (<bus>):\n\t/dev/videoN\n\t/dev/videoM\n\n"
    // Split into per-device blocks on blank lines so a video node always
    // gets attributed to the device it actually belongs to, instead of just
    // grabbing the first "/dev/video*" line anywhere in the whole output
    // (which could belong to an unrelated entry listed earlier).
    let blocks: Vec<&str> = text
        .split("\n\n")
        .map(|b| b.trim())
        .filter(|b| !b.is_empty())
        .collect();

    // Matched case-insensitively: different drivers/vendors capitalize (or
    // don't) "webcam" / "camera" inconsistently, and the previous
    // case-sensitive match on just "Webcam"/"Camera"/"Integrated" was
    // silently reporting "No webcam detected" for real cameras whose
    // reported name didn't happen to match that exact casing.
    let keywords = ["webcam", "camera", "integrated", "uvc"];

    let mut matched: Option<(String, String)> = None;
    let mut fallback: Option<(String, String)> = None;

    for block in &blocks {

        let mut lines = block.lines();

        let name_line = match lines.next() {
            Some(l) => l,
            None => continue,
        };

        let name =
            name_line
                .trim()
                .split(':')
                .next()
                .unwrap_or("")
                .trim()
                .to_string();

        let device =
            block
                .lines()
                .map(|l| l.trim())
                .find(|l| l.starts_with("/dev/video"))
                .unwrap_or("")
                .to_string();

        if name.is_empty() || device.is_empty() {
            // Metadata-only entry (e.g. a media controller node with no
            // video device attached) -- nothing usable here.
            continue;
        }

        if keywords.iter().any(|k| name.to_lowercase().contains(*k)) {
            matched = Some((name, device));
            break;
        }

        // Keep the first plausible device+node pair as a fallback in case
        // nothing in the list matches the keyword set -- better to report
        // an unusually-named camera than to claim no webcam exists when
        // v4l2-ctl clearly sees a video capture device.
        if fallback.is_none() {
            fallback = Some((name, device));
        }
    }

    let (model, device) = match matched.or(fallback) {
        Some(v) => v,
        None => return Ok(None),
    };

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