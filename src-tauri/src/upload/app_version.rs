// Fetches the currently active PULSE application version from Supabase
// (tbl_pulse_app_ver, column app_version, filtered to active_yn = true).
// Mirrors the request style used elsewhere in `upload/` (plain reqwest
// blocking client against the PostgREST endpoint with the apikey/service-role
// Authorization headers) but is a read instead of a write.

use serde::Deserialize;
use std::time::Duration;

#[derive(Debug, Deserialize)]
struct AppVerRow {
    app_version: Option<String>,
}

/// Blocking HTTP call — run this inside `spawn_blocking` from an async tauri
/// command, not directly on the async runtime.
pub fn fetch_active_app_version(base_url: &str, key: &str) -> Result<String, String> {
    if base_url.trim().is_empty() || key.trim().is_empty() {
        return Err("Supabase is not configured".to_string());
    }

    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("failed to build HTTP client: {}", e))?;

    let url = format!(
        "{}/rest/v1/tbl_pulse_app_ver?select=app_version&active_yn=eq.true&order=id.desc&limit=1",
        base_url.trim_end_matches('/')
    );

    let resp = client
        .get(&url)
        .header("apikey", key)
        .header("Authorization", format!("Bearer {}", key))
        .header("Accept", "application/json")
        .send()
        .map_err(|e| e.to_string())?;

    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().unwrap_or_default();
        return Err(format!(
            "HTTP {} fetching app version: {}",
            status.as_u16(),
            text
        ));
    }

    let rows: Vec<AppVerRow> = resp.json().map_err(|e| e.to_string())?;

    rows.into_iter()
        .find_map(|r| r.app_version)
        .filter(|v| !v.trim().is_empty())
        .ok_or_else(|| "No active app version found in tbl_pulse_app_ver".to_string())
}
