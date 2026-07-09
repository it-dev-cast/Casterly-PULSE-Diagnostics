// Best-effort push of a single LOT row to Supabase (tbl_pulse_lots).
//
// Unlike inspections, LOTs were never part of the upload_queue/sync_pending
// pipeline in upload/sync.rs at all — creating or editing a LOT only ever
// wrote to the local `tbl_pulse_lots` table, so the remote Supabase
// `tbl_pulse_lots` table stayed empty no matter how many LOTs were created.
// This mirrors the upsert pattern used in upload/sync.rs, but fires
// immediately after a local LOT write succeeds instead of waiting for the
// upload_queue (LOTs aren't queued items).

use rusqlite::Connection;
use serde_json::{Map, Value};
use std::time::Duration;

use crate::database::settings::get_setting;
use crate::lot::model::LotRow;
use crate::lot::repository;

fn s(value: &str) -> Value {
    Value::String(value.to_string())
}

/// Fire-and-forget upsert of a LOT row into Supabase's tbl_pulse_lots
/// (on_conflict=lot_name, which has a unique constraint per schema.sql).
/// Failures are logged only — LOT creation/editing must never block or fail
/// on the local screen just because the device is offline or Supabase is
/// unreachable.
pub fn push_lot(conn: &Connection, lot: &LotRow) {
    let base_url = get_setting(conn, "supabase_url");
    let key = get_setting(conn, "supabase_key");
    if base_url.trim().is_empty() || key.trim().is_empty() {
        return;
    }

    let mut m = Map::new();
    m.insert("lot_name".into(), s(&lot.lot_name));
    m.insert("customer".into(), s(&lot.customer));
    m.insert("location".into(), s(&lot.location));
    m.insert("inspection_date".into(), s(&lot.inspection_date));
    m.insert("status".into(), s(&lot.status));
    let body = Value::Object(m);

    std::thread::spawn(move || {
        let client = match reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(20))
            .build()
        {
            Ok(c) => c,
            Err(e) => {
                eprintln!("LOT sync: failed to build HTTP client: {}", e);
                return;
            }
        };

        let url = format!(
            "{}/rest/v1/tbl_pulse_lots?on_conflict=lot_name",
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
                eprintln!("LOT sync failed: HTTP {} — {}", status, text);
            }
            Err(e) => eprintln!("LOT sync failed: {}", e),
        }
    });
}

/// Push every locally stored LOT to Supabase. Catch-up sync for LOTs created
/// before this push existed (they were never uploaded at all) and for any
/// individual push that failed earlier (offline, transient error, etc.).
/// Called from the "Sync Now" command alongside the inspection upload queue.
pub fn sync_all_lots(conn: &Connection) {
    match repository::get_lots(conn) {
        Ok(lots) => {
            for lot in &lots {
                push_lot(conn, lot);
            }
        }
        Err(e) => eprintln!("LOT sync: failed to read local lots: {}", e),
    }
}
