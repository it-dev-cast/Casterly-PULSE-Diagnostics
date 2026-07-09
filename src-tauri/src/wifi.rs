use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Command;

// Wi-Fi scanning/connect support, built on top of NetworkManager's `nmcli`
// (present by default on the Ubuntu boot image this app targets). We shell
// out to `nmcli` rather than talking to NetworkManager over D-Bus directly
// to keep this dependency-free and consistent with the rest of the
// inventory collectors, which also shell out to system tools (lspci, etc).

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WifiNetwork {
    pub ssid: String,
    pub signal: i32,
    pub secured: bool,
    pub security: String,
    pub in_use: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WifiStatus {
    pub connected: bool,
    pub ssid: Option<String>,
}

/// Reverses nmcli's terse-output escaping, where literal `:` and `\` inside
/// a field are backslash-escaped so they don't collide with the `:` field
/// separator.
fn unescape_field(field: &str) -> String {
    let mut out = String::with_capacity(field.len());
    let mut chars = field.chars().peekable();

    while let Some(c) = chars.next() {
        if c == '\\' {
            if let Some(&next) = chars.peek() {
                out.push(next);
                chars.next();
                continue;
            }
        }
        out.push(c);
    }

    out
}

/// Splits an nmcli terse `-t` line on unescaped `:` separators.
fn split_terse_line(line: &str) -> Vec<String> {
    let mut fields = Vec::new();
    let mut current = String::new();
    let mut chars = line.chars().peekable();

    while let Some(c) = chars.next() {
        if c == '\\' {
            if let Some(&next) = chars.peek() {
                current.push(c);
                current.push(next);
                chars.next();
                continue;
            }
        }

        if c == ':' {
            fields.push(unescape_field(&current));
            current.clear();
        } else {
            current.push(c);
        }
    }

    fields.push(unescape_field(&current));
    fields
}

fn nmcli_available() -> bool {
    Command::new("which")
        .arg("nmcli")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Scans for nearby Wi-Fi networks and returns them deduplicated by SSID
/// (keeping the strongest signal reading for each), sorted strongest first.
pub fn scan() -> Result<Vec<WifiNetwork>> {
    if !nmcli_available() {
        return Err(anyhow!("nmcli is not available on this system"));
    }

    // Ask NetworkManager to rescan before listing so results are fresh.
    let _ = Command::new("nmcli")
        .args(["device", "wifi", "rescan"])
        .output();

    let output = Command::new("nmcli")
        .args([
            "-t",
            "-f",
            "IN-USE,SSID,SIGNAL,SECURITY",
            "device",
            "wifi",
            "list",
        ])
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow!("nmcli wifi list failed: {}", stderr.trim()));
    }

    let text = String::from_utf8_lossy(&output.stdout);
    let mut best: HashMap<String, WifiNetwork> = HashMap::new();

    for line in text.lines() {
        let fields = split_terse_line(line);
        if fields.len() < 4 {
            continue;
        }

        let in_use = fields[0].trim() == "*";
        let ssid = fields[1].trim().to_string();
        let signal: i32 = fields[2].trim().parse().unwrap_or(0);
        let security = fields[3].trim().to_string();

        // Skip hidden/blank SSIDs - nothing the user can meaningfully pick.
        if ssid.is_empty() {
            continue;
        }

        let secured = !(security.is_empty() || security == "--");

        let entry = best.entry(ssid.clone()).or_insert_with(|| WifiNetwork {
            ssid: ssid.clone(),
            signal,
            secured,
            security: security.clone(),
            in_use,
        });

        // Keep the strongest reading (multiple APs can share an SSID) and
        // make sure "in use" sticks if any of the duplicate rows report it.
        if signal > entry.signal {
            entry.signal = signal;
            entry.security = security;
            entry.secured = secured;
        }
        if in_use {
            entry.in_use = true;
        }
    }

    let mut networks: Vec<WifiNetwork> = best.into_values().collect();
    networks.sort_by(|a, b| b.signal.cmp(&a.signal));

    Ok(networks)
}

/// Connects to the given SSID. `password` should be `None`/empty for open
/// networks. Returns a human-readable error (from nmcli's stderr) on
/// failure, e.g. for a wrong password.
pub fn connect(ssid: &str, password: Option<&str>) -> Result<()> {
    if !nmcli_available() {
        return Err(anyhow!("nmcli is not available on this system"));
    }

    if ssid.trim().is_empty() {
        return Err(anyhow!("SSID cannot be empty"));
    }

    let mut args = vec!["device", "wifi", "connect", ssid];

    if let Some(pw) = password {
        if !pw.is_empty() {
            args.push("password");
            args.push(pw);
        }
    }

    let output = Command::new("nmcli").args(&args).output()?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let message = if !stderr.trim().is_empty() {
            stderr.trim().to_string()
        } else {
            stdout.trim().to_string()
        };

        Err(anyhow!(
            "Failed to connect to \"{}\": {}",
            ssid,
            if message.is_empty() {
                "unknown error".to_string()
            } else {
                message
            }
        ))
    }
}

/// Disconnects the active Wi-Fi connection, if any.
pub fn disconnect() -> Result<()> {
    if !nmcli_available() {
        return Err(anyhow!("nmcli is not available on this system"));
    }

    let current = status()?;
    let Some(ssid) = current.ssid else {
        return Ok(());
    };

    let output = Command::new("nmcli")
        .args(["connection", "down", &ssid])
        .output()?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(anyhow!("Failed to disconnect: {}", stderr.trim()))
    }
}

/// Returns the currently connected Wi-Fi SSID, if any.
pub fn status() -> Result<WifiStatus> {
    if !nmcli_available() {
        return Ok(WifiStatus {
            connected: false,
            ssid: None,
        });
    }

    let output = Command::new("nmcli")
        .args(["-t", "-f", "ACTIVE,SSID", "device", "wifi", "list"])
        .output()?;

    if !output.status.success() {
        return Ok(WifiStatus {
            connected: false,
            ssid: None,
        });
    }

    let text = String::from_utf8_lossy(&output.stdout);

    for line in text.lines() {
        let fields = split_terse_line(line);
        if fields.len() < 2 {
            continue;
        }

        if fields[0].trim() == "yes" {
            let ssid = fields[1].trim().to_string();
            if !ssid.is_empty() {
                return Ok(WifiStatus {
                    connected: true,
                    ssid: Some(ssid),
                });
            }
        }
    }

    Ok(WifiStatus {
        connected: false,
        ssid: None,
    })
}
