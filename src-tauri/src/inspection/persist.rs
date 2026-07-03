use chrono::Local;
use rusqlite::{Connection, params};
use uuid::Uuid;
use serde_json::Value;
use serde::Serialize;

/// Result of a successful save — the assigned UUID and timestamp (PRD §322).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveResult {
    pub uuid: String,
    pub timestamp: String,
}

/// Persist a frontend-assembled inspection payload as a complete InspectionRun
/// (PRD §11.6) into the `inspections` table and enqueue it for upload.
///
/// The frontend supplies `json_data` containing battery_health, grading, the
/// functional tests, and the full inventory. This function injects the
/// record-level fields (uuid, usb_id, inspector, lot_name, timestamp,
/// uploaded) into the JSON, stores it, and adds a PENDING row to
/// upload_queue. Returns the inspection UUID.
///
/// `existing_uuid`: if the frontend already generated a UUID earlier in the
/// flow (at Hardware Inventory, so the per-category report tables and this
/// final record share the same identifier), pass it here so it is reused
/// instead of minting a new one.
pub fn save_inspection(
    conn: &Connection,
    usb_id: &str,
    inspector: &str,
    lot_name: &str,
    json_data: &str,
    existing_uuid: Option<&str>,
)
-> Result<SaveResult, String>
{
    let uuid = match existing_uuid {
        Some(u) if !u.is_empty() => u.to_string(),
        _ => Uuid::new_v4().to_string(),
    };
    let timestamp = Local::now()
        .format("%d/%m/%Y %H:%M:%S")
        .to_string();

    // Enrich the frontend payload into a full InspectionRun JSON object.
    let mut value: Value = serde_json::from_str(json_data)
        .map_err(|e| format!("invalid inspection JSON: {}", e))?;

    if let Some(obj) = value.as_object_mut() {
        obj.insert("uuid".into(), Value::String(uuid.clone()));
        obj.insert("usb_id".into(), Value::String(usb_id.to_string()));
        obj.insert("inspector".into(), Value::String(inspector.to_string()));
        obj.insert("lot_name".into(), Value::String(lot_name.to_string()));
        obj.insert("timestamp".into(), Value::String(timestamp.clone()));
        obj.insert("uploaded".into(), Value::Bool(false));
    } else {
        return Err("inspection JSON must be an object".to_string());
    }

    let json = serde_json::to_string_pretty(&value)
        .map_err(|e| e.to_string())?;

    conn.execute(
        "
        INSERT INTO inspections
        (uuid, lot_name, inspector, timestamp, uploaded, json_data)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        ",
        params![uuid, lot_name, inspector, timestamp, 0, json],
    )
    .map_err(|e| e.to_string())?;

    // PRD §11.4 / §12.1: every saved inspection is immediately queued PENDING.
    crate::upload::queue::add_to_queue(conn, &uuid);

    Ok(SaveResult { uuid, timestamp })
}
