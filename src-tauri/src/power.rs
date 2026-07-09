use anyhow::{anyhow, Result};
use std::io::Write;
use std::process::{Command, Stdio};

// Powering off does NOT actually need root. systemd-logind grants the
// "power-off" action to whichever user has the active local session
// without any authentication by default (this is the same polkit default
// that lets a normal desktop user click "Power Off" in the GNOME menu, or
// press the physical power button, with no password) — so a plain
// `systemctl poweroff`, run as the kiosk user with zero privilege
// escalation, is normally all that's needed.
//
// We still keep a `sudo -S` fallback (piping the bootable image's known,
// fixed account password — this is a single-purpose kiosk/live USB, not a
// general-purpose machine) in case a given image's polkit policy has been
// locked down to require authentication, but that path should rarely, if
// ever, actually run.
const SUDO_PASSWORD: &str = "a";

pub fn shutdown() -> Result<()> {
    match systemctl_poweroff() {
        Ok(()) => Ok(()),
        Err(_) => sudo_shutdown(),
    }
}

fn systemctl_poweroff() -> Result<()> {
    let output = Command::new("systemctl").arg("poweroff").output()?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(anyhow!(
            "systemctl poweroff failed: {}",
            stderr.trim()
        ))
    }
}

fn sudo_shutdown() -> Result<()> {
    let mut child = Command::new("sudo")
        .args(["-S", "-p", "", "shutdown", "-h", "now"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;

    if let Some(stdin) = child.stdin.as_mut() {
        stdin.write_all(format!("{}\n", SUDO_PASSWORD).as_bytes())?;
    }

    let output = child.wait_with_output()?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let message = stderr.trim();

        Err(anyhow!(
            "Failed to shut down: {}",
            if message.is_empty() {
                "unknown error".to_string()
            } else {
                message.to_string()
            }
        ))
    }
}
