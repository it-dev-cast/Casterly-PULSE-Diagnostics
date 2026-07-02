// Supabase Storage upload (separate from upload/sync.rs, which pushes the
// structured inspection JSON into Postgres tables via PostgREST). This module
// uploads the actual export files (.json / .pdf) as objects into a Storage
// bucket, so a human can browse/download the original report artifacts.

use std::time::Duration;

/// Upload one file's bytes to a Supabase Storage bucket at `path`. Uses
/// `x-upsert: true` so re-running an export overwrites the previous copy
/// instead of failing with a "already exists" error.
pub fn upload_object(
    client: &reqwest::blocking::Client,
    base_url: &str,
    key: &str,
    bucket: &str,
    path: &str,
    content_type: &str,
    bytes: &[u8],
) -> Result<(), String> {
    let url = format!(
        "{}/storage/v1/object/{}/{}",
        base_url.trim_end_matches('/'),
        bucket.trim_matches('/'),
        path.trim_start_matches('/'),
    );

    let resp = client
        .post(&url)
        .header("apikey", key)
        .header("Authorization", format!("Bearer {}", key))
        .header("Content-Type", content_type)
        .header("x-upsert", "true")
        .body(bytes.to_vec())
        .send()
        .map_err(|e| e.to_string())?;

    let status = resp.status();
    if status.is_success() {
        Ok(())
    } else {
        let text = resp.text().unwrap_or_default();
        Err(format!("HTTP {} uploading {}: {}", status.as_u16(), path, text))
    }
}

/// Build a `reqwest::blocking::Client` suitable for storage uploads.
pub fn build_client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())
}
