use std::io;
use std::process::Command;

use crate::inventory::camera;
use crate::models::device::WebcamTest;

/// Terminal-driven legacy CLI entry point. Kept for UDIAG3 compatibility; do
/// not use from the Tauri UI.
pub fn run() -> WebcamTest {
    println!();
    println!("======================");
    println!("WEBCAM TEST");
    println!("======================");
    println!();
    println!("Opening Webcam Preview...");
    println!("Close the preview window when done.");
    println!();

    let _ = Command::new("ffplay")
        .args(["-f", "v4l2", "-i", "/dev/video0"])
        .status();

    println!();
    println!("Did Webcam Test Pass?");
    println!("1. PASS");
    println!("2. FAIL");

    let mut choice = String::new();
    io::stdin().read_line(&mut choice).unwrap();

    let result = if choice.trim() == "1" { "PASS" } else { "FAIL" };

    WebcamTest {
        result: result.to_string(),
    }
}

/// Launch the webcam preview and block until the operator closes the ffplay
/// window. Uses the camera detected by the existing hardware collector; never
/// hardcodes a video device path.
pub fn start_test() -> Result<(), String> {
    let camera_info = camera::collect()
        .map_err(|e| format!("Camera detection failed: {}", e))?
        .ok_or_else(|| "No webcam detected.".to_string())?;

    if camera_info.device.is_empty() {
        return Err("No webcam detected.".to_string());
    }

    if !command_exists("ffplay") {
        return Err("Unable to launch webcam preview: ffplay not found.".to_string());
    }

    // Try the preferred 720p settings first.
    match run_ffplay_preview(&camera_info.device, "1280x720") {
        Ok(()) => return Ok(()),
        Err(first_err) => {
            // Some webcams (especially older/integrated ones) don't expose 1280x720.
            // Fall back to the device's reported default format by omitting -video_size.
            match run_ffplay_preview_default(&camera_info.device) {
                Ok(()) => return Ok(()),
                Err(second_err) => Err(format!(
                    "Unable to open webcam preview.\n\nWith 1280x720:\n{}\n\nWith default format:\n{}",
                    first_err, second_err
                )),
            }
        }
    }
}

fn run_ffplay_preview(device: &str, resolution: &str) -> Result<(), String> {
    let output = Command::new("ffplay")
        .args([
            "-f",
            "v4l2",
            "-framerate",
            "30",
            "-video_size",
            resolution,
            "-window_title",
            "Pulse Webcam Test",
            "-i",
            device,
        ])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .output()
        .map_err(|e| format!("Failed to execute ffplay: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if output.status.success() {
        Ok(())
    } else {
        let mut msg = format!("ffplay exited with status: {:?}", output.status.code());
        if !stdout.trim().is_empty() {
            msg.push_str("\nstdout:\n");
            msg.push_str(&stdout);
        }
        if !stderr.trim().is_empty() {
            msg.push_str("\nstderr:\n");
            msg.push_str(&stderr);
        }
        Err(msg)
    }
}

fn run_ffplay_preview_default(device: &str) -> Result<(), String> {
    let output = Command::new("ffplay")
        .args([
            "-f",
            "v4l2",
            "-framerate",
            "30",
            "-window_title",
            "Pulse Webcam Test",
            "-i",
            device,
        ])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .output()
        .map_err(|e| format!("Failed to execute ffplay: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if output.status.success() {
        Ok(())
    } else {
        let mut msg = format!("ffplay exited with status: {:?}", output.status.code());
        if !stdout.trim().is_empty() {
            msg.push_str("\nstdout:\n");
            msg.push_str(&stdout);
        }
        if !stderr.trim().is_empty() {
            msg.push_str("\nstderr:\n");
            msg.push_str(&stderr);
        }
        Err(msg)
    }
}

fn command_exists(cmd: &str) -> bool {
    Command::new("which")
        .arg(cmd)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}
