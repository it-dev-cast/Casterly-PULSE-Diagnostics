use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

const SPEAKER_WAV_RELATIVE: &str = "resources/audio/speaker_test.wav";

/// Resolve the bundled speaker test WAV. First tries the provided primary path
/// (e.g. the Tauri bundle resource), then falls back to common locations useful
/// for USB/live-boot deployments.
pub fn resolve_speaker_test_wav(primary: Option<&Path>) -> Result<PathBuf, String> {
    let candidates = build_candidate_paths(primary);

    for path in &candidates {
        if path.exists() {
            return Ok(path.clone());
        }
    }

    let searched = candidates
        .iter()
        .map(|p| p.display().to_string())
        .collect::<Vec<_>>()
        .join("\n  - ");

    Err(format!(
        "speaker_test.wav not found. Searched:\n  - {}",
        searched
    ))
}

fn build_candidate_paths(primary: Option<&Path>) -> Vec<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Some(p) = primary {
        candidates.push(p.to_path_buf());
    }

    // Same directory as the running executable.
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.join(SPEAKER_WAV_RELATIVE));
            candidates.push(dir.join("audio").join("speaker_test.wav"));
        }
    }

    // Current working directory.
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join(SPEAKER_WAV_RELATIVE));
        candidates.push(cwd.join("src-tauri").join(SPEAKER_WAV_RELATIVE));
        candidates.push(cwd.join("audio").join("speaker_test.wav"));
    }

    // Common installed/package locations.
    candidates.push(PathBuf::from("/opt/udiag4/").join(SPEAKER_WAV_RELATIVE));
    candidates.push(PathBuf::from("/opt/pulse/").join(SPEAKER_WAV_RELATIVE));
    candidates.push(PathBuf::from("/opt/").join(SPEAKER_WAV_RELATIVE));
    candidates.push(PathBuf::from("/usr/lib/udiag4/").join(SPEAKER_WAV_RELATIVE));
    candidates.push(PathBuf::from("/usr/share/udiag4/").join(SPEAKER_WAV_RELATIVE));

    // Common live-USB / CD-ROM mount points.
    candidates.push(PathBuf::from("/cdrom/").join(SPEAKER_WAV_RELATIVE));
    candidates.push(PathBuf::from("/run/live/medium/").join(SPEAKER_WAV_RELATIVE));
    candidates.push(PathBuf::from("/media/cdrom/").join(SPEAKER_WAV_RELATIVE));

    // Mounted removable media / USB drives.
    candidates.extend(scan_mount_points());

    candidates
}

fn scan_mount_points() -> Vec<PathBuf> {
    let mut found = Vec::new();
    for base in ["/media", "/mnt"] {
        let entries = match std::fs::read_dir(base) {
            Ok(e) => e,
            Err(_) => continue,
        };

        for entry in entries.flatten() {
            let mount = entry.path();
            if !mount.is_dir() {
                continue;
            }

            // Direct layout: <mount>/resources/audio/speaker_test.wav
            found.push(mount.join(SPEAKER_WAV_RELATIVE));

            // Wrapped in app/project folders.
            for wrapper in ["udiag4", "pulse", "udiag4-app", "pulse-app"] {
                found.push(mount.join(wrapper).join(SPEAKER_WAV_RELATIVE));
            }
        }
    }
    found
}

/// Parse a PCM WAV file and return its playback duration. Searches the header
/// for the `data` chunk so it works with files that have extra chunks before
/// the data chunk.
pub fn estimate_wav_duration(path: &Path) -> Result<Duration, String> {
    let mut file = File::open(path)
        .map_err(|e| format!("Failed to open WAV for duration estimation: {}", e))?;

    let mut header = [0u8; 44];
    file.read_exact(&mut header)
        .map_err(|e| format!("WAV file too short: {}", e))?;

    // RIFF WAVE sanity checks.
    if &header[0..4] != b"RIFF" || &header[8..12] != b"WAVE" {
        return Err("File is not a valid RIFF/WAVE audio file".to_string());
    }

    let channels = u16::from_le_bytes([header[22], header[23]]) as u32;
    let sample_rate = u32::from_le_bytes([header[24], header[25], header[26], header[27]]);
    let bits_per_sample = u16::from_le_bytes([header[34], header[35]]) as u32;

    if channels == 0 || sample_rate == 0 || bits_per_sample == 0 {
        return Err("Invalid WAV format parameters".to_string());
    }

    let byte_rate = sample_rate * channels * (bits_per_sample / 8);

    // Try to read a `data` chunk size. Some files have additional chunks before
    // `data`; scan forward from the current position.
    let data_chunk_size = find_data_chunk_size(&mut file)?;

    let seconds = if byte_rate > 0 {
        data_chunk_size as f64 / byte_rate as f64
    } else {
        0.0
    };

    Ok(Duration::from_secs_f64(seconds.max(1.0)))
}

fn find_data_chunk_size(file: &mut File) -> Result<u64, String> {
    let mut chunk_header = [0u8; 8];

    loop {
        match file.read_exact(&mut chunk_header) {
            Ok(()) => {}
            Err(_) => {
                // Could not find a data chunk; fall back to file length minus header.
                let pos = file
                    .seek(SeekFrom::End(0))
                    .map_err(|e| format!("Failed to seek file: {}", e))?;
                return Ok(pos.saturating_sub(44));
            }
        }

        let chunk_id = &chunk_header[0..4];
        let chunk_size = u32::from_le_bytes([
            chunk_header[4],
            chunk_header[5],
            chunk_header[6],
            chunk_header[7],
        ]) as u64;

        if chunk_id == b"data" {
            return Ok(chunk_size);
        }

        // Skip over this chunk's payload (pad to even byte count).
        let skip = chunk_size + (chunk_size % 2);
        file.seek(SeekFrom::Current(skip as i64))
            .map_err(|e| format!("Failed to seek past WAV chunk: {}", e))?;
    }
}

/// Play a WAV file using the system's available audio player and block until
/// playback completes.
///
/// 1. Try `ffplay` first.
/// 2. If ffplay is missing or exits with an error, fall back to `aplay`.
/// 3. If both fail, return a detailed error containing the captured stdout/stderr.
pub fn play_wav_blocking(path: &Path) -> Result<(), String> {
    let abs_path = path
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize WAV path: {}", e))?;
    let path_str = abs_path
        .to_str()
        .ok_or_else(|| "Invalid audio path".to_string())?;

    // Try ffplay first.
    if command_exists("ffplay") {
        let ffplay_args: Vec<&str> = vec!["-nodisp", "-autoexit", path_str];
        match run_player("ffplay", &ffplay_args) {
            Ok(()) => return Ok(()),
            Err(ffplay_err) => {
                // Try aplay as fallback.
                if command_exists("aplay") {
                    let aplay_args: Vec<&str> = vec![path_str];
                    match run_player("aplay", &aplay_args) {
                        Ok(()) => return Ok(()),
                        Err(aplay_err) => {
                            return Err(format!(
                                "ffplay failed:\n{}\n\naplay fallback also failed:\n{}",
                                ffplay_err, aplay_err
                            ));
                        }
                    }
                } else {
                    return Err(format!(
                        "ffplay failed:\n{}\n\nffplay not available (no aplay fallback available either)",
                        ffplay_err
                    ));
                }
            }
        }
    }

    // ffplay not available; try aplay directly.
    if command_exists("aplay") {
        let aplay_args: Vec<&str> = vec![path_str];
        run_player("aplay", &aplay_args)
    } else {
        Err("No suitable audio player found. Install ffplay (ffmpeg) or aplay (alsa-utils).".to_string())
    }
}

fn run_player(cmd: &str, args: &[&str]) -> Result<(), String> {
    let output = Command::new(cmd)
        .args(args)
        .stdin(std::process::Stdio::null())
        .output()
        .map_err(|e| format!("Failed to execute {}: {}", cmd, e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if output.status.success() {
        Ok(())
    } else {
        let mut msg = format!(
            "{} exited with status: {:?}",
            cmd,
            output.status.code()
        );
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
