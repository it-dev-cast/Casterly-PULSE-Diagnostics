use anyhow::Result;
use std::process::Command;

use crate::models::device::AudioInfo;

pub fn collect() -> Result<Option<AudioInfo>> {
    let playback = Command::new("aplay").arg("-l").output();
    let playback_text = match playback {
        Ok(output) => String::from_utf8_lossy(&output.stdout).to_string(),
        Err(_) => String::new(),
    };

    let capture = Command::new("arecord").arg("-l").output();
    let capture_text = match capture {
        Ok(output) => String::from_utf8_lossy(&output.stdout).to_string(),
        Err(_) => String::new(),
    };

    if playback_text.trim().is_empty() && capture_text.trim().is_empty() {
        return Ok(None);
    }

    let codec = detect_codec(&playback_text, &capture_text);
    let speaker_type = detect_speaker_type(&playback_text);
    let mic_type = detect_mic_type(&capture_text);
    let jack_type = detect_jack_type(&speaker_type, &mic_type);

    Ok(Some(AudioInfo {
        codec,
        speaker_type,
        mic_type,
        jack_type,
    }))
}

fn detect_codec(playback_text: &str, capture_text: &str) -> String {
    for text in [playback_text, capture_text] {
        for line in text.lines() {
            let trimmed = line.trim();
            if trimmed.contains("card") && trimmed.contains("device") {
                return trimmed.to_string();
            }
        }
    }

    "Unknown".to_string()
}

fn detect_speaker_type(playback_text: &str) -> String {
    let lower = playback_text.to_lowercase();

    if lower.contains("hdmi") {
        "HDMI".to_string()
    } else if lower.contains("analog") {
        "Analog".to_string()
    } else if lower.contains("digital") {
        "Digital".to_string()
    } else if lower.contains("headphone") {
        "Headphones".to_string()
    } else {
        "Unknown".to_string()
    }
}

fn detect_mic_type(capture_text: &str) -> String {
    let lower = capture_text.to_lowercase();

    if lower.contains("mic") {
        "Built-in Mic".to_string()
    } else if lower.contains("analog") {
        "Analog Mic".to_string()
    } else {
        "Unknown".to_string()
    }
}

fn detect_jack_type(speaker_type: &str, mic_type: &str) -> String {
    let lower_speaker = speaker_type.to_lowercase();
    let lower_mic = mic_type.to_lowercase();

    if lower_speaker.contains("analog") || lower_mic.contains("analog") {
        "3.5mm Jack".to_string()
    } else if lower_speaker.contains("hdmi") {
        "HDMI".to_string()
    } else {
        "Unknown".to_string()
    }
}
