// Self-update support: downloads the latest built `udiag4` executable from
// Supabase Storage (bucket "PULSE_Applications", object "udiag4") and
// atomically replaces the currently running executable with it, so the next
// launch at the same path runs the new build.
//
// Linux-only assumption: POSIX filesystems let you replace/unlink the file
// backing a running executable — the process that's already executing it
// keeps using the old inode until it exits, and any *new* process started
// against that path afterwards picks up whatever is there now. This is what
// makes the plain `rename()` below safe to do while this very binary is
// running. (This would not work the same way on Windows, where the running
// executable's file is locked — this app's target is the Ubuntu kiosk
// hardware, not the Windows dev environment.)

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::Duration;

const BUCKET: &str = "PULSE_Applications";
const OBJECT: &str = "udiag4";

// Sanity checks so a truncated download, a Storage error page, or an empty
// object can never clobber a working install:
const ELF_MAGIC: [u8; 4] = [0x7f, b'E', b'L', b'F'];
// Real builds of this app are comfortably multi-megabyte; anything under 1
// MiB almost certainly isn't a real binary (e.g. an HTML/JSON error body).
const MIN_BINARY_SIZE: usize = 1024 * 1024;

/// Downloads the new udiag4 binary and atomically swaps it in at
/// `current_exe`. Blocking (HTTP + filesystem I/O) — run inside
/// `spawn_blocking` from an async tauri command. The caller is responsible
/// for relaunching / exiting the process afterwards.
pub fn download_and_replace(base_url: &str, key: &str, current_exe: &Path) -> Result<(), String> {
    if base_url.trim().is_empty() || key.trim().is_empty() {
        return Err("Supabase is not configured".to_string());
    }

    let bytes = download_binary(base_url, key)?;

    if bytes.len() < MIN_BINARY_SIZE {
        return Err(format!(
            "Downloaded update looks too small ({} bytes) to be a valid build — aborting without touching the current install",
            bytes.len()
        ));
    }
    if bytes.get(0..4) != Some(&ELF_MAGIC[..]) {
        return Err(
            "Downloaded update is not a valid ELF executable — aborting without touching the current install"
                .to_string(),
        );
    }

    let parent = current_exe
        .parent()
        .ok_or_else(|| "Could not determine the app's directory".to_string())?;
    // Same directory as the current executable so the final rename() is a
    // same-filesystem (and therefore atomic) rename rather than a cross-
    // filesystem copy.
    let tmp_path: PathBuf = parent.join(".udiag4.update.tmp");

    {
        let mut f = fs::File::create(&tmp_path)
            .map_err(|e| format!("failed to create temp file for update: {}", e))?;
        f.write_all(&bytes)
            .map_err(|e| format!("failed to write update to disk: {}", e))?;
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&tmp_path, fs::Permissions::from_mode(0o755))
            .map_err(|e| format!("failed to mark update executable: {}", e))?;
    }

    fs::rename(&tmp_path, current_exe)
        .map_err(|e| format!("failed to replace the running executable: {}", e))?;

    Ok(())
}

fn download_binary(base_url: &str, key: &str) -> Result<Vec<u8>, String> {
    let client = reqwest::blocking::Client::builder()
        // Full app builds can be sizeable; allow a couple of minutes.
        .timeout(Duration::from_secs(180))
        .build()
        .map_err(|e| format!("failed to build HTTP client: {}", e))?;

    let url = format!(
        "{}/storage/v1/object/{}/{}",
        base_url.trim_end_matches('/'),
        BUCKET,
        OBJECT
    );

    let resp = client
        .get(&url)
        .header("apikey", key)
        .header("Authorization", format!("Bearer {}", key))
        .send()
        .map_err(|e| e.to_string())?;

    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().unwrap_or_default();
        return Err(format!(
            "HTTP {} downloading update from Supabase Storage: {}",
            status.as_u16(),
            text
        ));
    }

    resp.bytes()
        .map(|b| b.to_vec())
        .map_err(|e| format!("failed to read downloaded update: {}", e))
}
