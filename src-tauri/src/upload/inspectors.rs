// Best-effort push of a single inspector record to Supabase
// (tbl_pulse_inspectors).
//
// PRD §11 stores the inspector list purely as JSON under the local settings
// key 'inspectors' (see inspector/repository.rs) — there is no local
// tbl_pulse_inspectors table at all. Nothing ever pushed that list to
// Supabase, so the remote tbl_pulse_inspectors table stayed empty even
// though the Inspector screen "worked" (it saved to settings just fine).
// This mirrors upload/lots.rs: fire an upsert immediately after a local
// create/update succeeds.

use rusqlite::Connection;
use serde_json::{Map, Value};
use std::time::Duration;

use crate::database::settings::get_setting;
use crate::inspector::model::Inspector;
use crate::inspector::repository;

fn s(value: &str) -> Value {
    Value::String(value.to_string())
}

/// Fire-and-forget upsert of an inspector into Supabase's tbl_pulse_inspectors
/// (on_conflict=employee_id, which has a unique constraint per schema.sql).
/// Failures are logged only — Inspector creation/editing must never block or
/// fail on the local screen just because the device is offline or Supabase
/// is unreachable.
pub fn push_inspector(conn: &Connection, inspector: &Inspector) {
    let base_url = get_setting(conn, "supabase_url");
    let key = get_setting(conn, "supabase_key");
    if base_url.trim().is_empty() || key.trim().is_empty() {
        return;
    }
    // employee_id is the on_conflict key on the Supabase side; an empty value
    // can't be safely upserted against (a blank employee_id from a second
    // inspector would silently overwrite the first). Local uniqueness
    // (employee_id_taken) already requires it in practice, but skip pushing
    // rather than risk clobbering a different inspector's row.
    if inspector.employee_id.trim().is_empty() {
        eprintln!("Inspector sync skipped: employee_id is empty");
        return;
    }

    let mut m = Map::new();
    m.insert("name".into(), s(&inspector.inspector_name));
    m.insert("employee_id".into(), s(&inspector.employee_id));
    m.insert("email".into(), s(&inspector.email));
    m.insert("phone".into(), s(&inspector.phone));
    m.insert("active".into(), Value::Bool(true));
    let body = Value::Object(m);

    std::thread::spawn(move || {
        let client = match reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(20))
            .build()
        {
            Ok(c) => c,
            Err(e) => {
                eprintln!("Inspector sync: failed to build HTTP client: {}", e);
                return;
            }
        };

        let url = format!(
            "{}/rest/v1/tbl_pulse_inspectors?on_conflict=employee_id",
            base_url.trim_end_matches('/')
        );

        let resp = client
            .post(&url)
            .header("apikey", &key)
            .header("Authorization", format!("Bearer {}", key))
            .header("Content-Type", "application/json")
            .header("Prefer", "resolution=merge-duplicates,return=minimal")
            .json(&body)
            .send();

        match resp {
            Ok(r) if r.status().is_success() => {}
            Ok(r) => {
                let status = r.status();
                let text = r.text().unwrap_or_default();
                eprintln!("Inspector sync failed: HTTP {} — {}", status, text);
            }
            Err(e) => eprintln!("Inspector sync failed: {}", e),
        }
    });
}

/// Push every locally stored inspector to Supabase. Catch-up sync for
/// inspectors created before this push existed (they were never uploaded at
/// all, since the local list only ever lived in the settings table) and for
/// any individual push that failed earlier. Called from the "Sync Now"
/// command alongside the inspection upload queue.
pub fn sync_all_inspectors(conn: &Connection) {
    match repository::get_inspectors(conn) {
        Ok(inspectors) => {
            for inspector in &inspectors {
                push_inspector(conn, inspector);
            }
        }
        Err(e) => eprintln!("Inspector sync: failed to read local inspectors: {}", e),
    }
}
