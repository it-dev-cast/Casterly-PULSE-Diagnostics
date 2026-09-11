// Live read-model queries for the dashboard / summary / list screens. All
// structs serialize to camelCase for the React frontend.

use rusqlite::Connection;
use serde::Serialize;
use serde_json::Value;
use chrono::Local;

use crate::database::settings::get_setting;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsbInfo {
    pub usb_id: String,
    pub version: String,
    pub last_sync: String,
    pub pending_upload: i64,
    pub stored_locally: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OperatorInfo {
    pub inspector: String,
    pub employee_id: String,
    pub login_status: String,
    pub last_login: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LotInfo {
    pub lot_id: String,
    pub created: String,
    pub inspector: String,
    pub customer: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardData {
    pub usb: UsbInfo,
    pub operator: OperatorInfo,
    pub lot: Option<LotInfo>,
    pub total_today: i64,
    pub passed: i64,
    pub failed: i64,
    pub pass_rate: f64,
    pub fail_rate: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueueItem {
    pub id: i64,
    pub inspection_uuid: String,
    pub status: String,
    pub retry_count: i64,
    pub created_at: String,
    pub uploaded_at: Option<String>,
    pub serial: String,
    pub model: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueueData {
    pub items: Vec<QueueItem>,
    pub pending: i64,
    pub uploaded: i64,
    pub failed: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatusData {
    pub pending: i64,
    pub uploaded: i64,
    pub failed: i64,
    pub total: i64,
    pub last_sync: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InspectionRow {
    pub id: i64,
    pub uuid: String,
    pub serial: String,
    pub manufacturer: String,
    pub model: String,
    pub inspector: String,
    pub lot: String,
    pub timestamp: String,
    pub grade: String,
    pub uploaded: bool,
}

fn ptr_str<'a>(json: &'a Value, pointer: &str) -> &'a str {
    json.pointer(pointer).and_then(|v| v.as_str()).unwrap_or("")
}

// grade_for()/is_failed() moved to crate::inspection::grade so the exact same
// logic is used both here (read-model) and in inspection::persist::save_inspection
// (write path), keeping the displayed grade and the stored `grade` column/field
// in sync.
use crate::inspection::grade::{grade_for, is_failed};

fn count_where(conn: &Connection, sql: &str) -> i64 {
    conn.query_row(sql, [], |row| row.get(0)).unwrap_or(0)
}

fn get_employee_id(conn: &Connection, name: &str) -> String {
    if name.is_empty() {
        return String::new();
    }
    let raw = get_setting(conn, "inspectors");
    let list: Vec<Value> = serde_json::from_str(raw.trim()).unwrap_or_default();
    for i in &list {
        if ptr_str(i, "/inspectorName").eq_ignore_ascii_case(name) {
            return ptr_str(i, "/employeeId").to_string();
        }
    }
    String::new()
}

fn current_lot(conn: &Connection) -> Option<LotInfo> {
    let name = get_setting(conn, "active_lot");
    if name.trim().is_empty() {
        return None;
    }

    conn.query_row(
        "SELECT customer, inspection_date FROM tbl_pulse_lots WHERE lot_name = ?1 LIMIT 1",
        rusqlite::params![name],
        |row| {
            Ok(LotInfo {
                lot_id: name.clone(),
                customer: row.get(0)?,
                created: row.get(1)?,
                inspector: String::new(),
            })
        },
    )
    .ok()
    .map(|mut l| {
        l.inspector = get_setting(conn, "inspector");
        l
    })
}

pub fn get_dashboard(conn: &Connection) -> Result<DashboardData, String> {
    let stored_locally = count_where(conn, "SELECT COUNT(*) FROM tbl_pulse_inspections");
    let pending_upload =
        count_where(conn, "SELECT COUNT(*) FROM tbl_pulse_upload_queue WHERE status='PENDING'");

    // Today's inspections — timestamps are stored as 'dd/mm/YYYY HH:MM:SS'.
    let today = Local::now().format("%d/%m/%Y").to_string();
    let mut total_today = 0i64;
    let mut failed = 0i64;

    if let Ok(mut stmt) =
        conn.prepare("SELECT timestamp, json_data FROM tbl_pulse_inspections")
    {
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        });
        if let Ok(rows) = rows {
            for r in rows.flatten() {
                let (ts, json_text) = r;
                if !ts.starts_with(&today) {
                    continue;
                }
                total_today += 1;
                let json: Value =
                    serde_json::from_str(&json_text).unwrap_or(Value::Null);
                if is_failed(&json) {
                    failed += 1;
                }
            }
        }
    }

    let passed = total_today - failed;
    let pass_rate = if total_today > 0 {
        (passed as f64 / total_today as f64 * 100.0 * 10.0).round() / 10.0
    } else {
        0.0
    };
    let fail_rate = if total_today > 0 {
        (failed as f64 / total_today as f64 * 100.0 * 10.0).round() / 10.0
    } else {
        0.0
    };

    let inspector = get_setting(conn, "inspector");

    let usb = UsbInfo {
        usb_id: get_setting(conn, "usb_id"),
        version: get_setting(conn, "version"),
        last_sync: get_setting(conn, "last_sync"),
        pending_upload,
        stored_locally,
    };

    let operator = OperatorInfo {
        employee_id: get_employee_id(conn, &inspector),
        login_status: if inspector.is_empty() {
            "Inactive".to_string()
        } else {
            "Active".to_string()
        },
        last_login: {
            let l = get_setting(conn, "last_login");
            if l.is_empty() { "—".to_string() } else { l }
        },
        inspector,
    };

    Ok(DashboardData {
        usb,
        operator,
        lot: current_lot(conn),
        total_today,
        passed,
        failed,
        pass_rate,
        fail_rate,
    })
}

pub fn get_upload_queue(conn: &Connection) -> Result<QueueData, String> {
    let mut items = Vec::new();

    let mut stmt = conn
        .prepare(
            "
            SELECT q.id, q.inspection_uuid, q.status, q.retry_count,
                   q.created_at, q.uploaded_at, i.json_data
            FROM tbl_pulse_upload_queue q
            LEFT JOIN tbl_pulse_inspections i ON i.uuid = q.inspection_uuid
            ORDER BY q.id DESC
            ",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let json_text: Option<String> = row.get(6)?;
            let (serial, model) = match json_text {
                Some(t) => {
                    let json: Value =
                        serde_json::from_str(&t).unwrap_or(Value::Null);
                    (
                        ptr_str(&json, "/inventory/system/serial_number")
                            .to_string(),
                        ptr_str(&json, "/inventory/system/model").to_string(),
                    )
                }
                None => (String::new(), String::new()),
            };
            Ok(QueueItem {
                id: row.get(0)?,
                inspection_uuid: row.get(1)?,
                status: row.get(2)?,
                retry_count: row.get(3)?,
                created_at: row.get(4)?,
                uploaded_at: row.get(5)?,
                serial,
                model,
            })
        })
        .map_err(|e| e.to_string())?;

    for r in rows {
        items.push(r.map_err(|e| e.to_string())?);
    }

    Ok(QueueData {
        pending: count_where(
            conn,
            "SELECT COUNT(*) FROM tbl_pulse_upload_queue WHERE status='PENDING'",
        ),
        uploaded: count_where(
            conn,
            "SELECT COUNT(*) FROM tbl_pulse_upload_queue WHERE status='UPLOADED'",
        ),
        failed: count_where(
            conn,
            "SELECT COUNT(*) FROM tbl_pulse_upload_queue WHERE status='FAILED'",
        ),
        items,
    })
}

pub fn get_sync_status(conn: &Connection) -> Result<SyncStatusData, String> {
    Ok(SyncStatusData {
        pending: count_where(
            conn,
            "SELECT COUNT(*) FROM tbl_pulse_upload_queue WHERE status='PENDING'",
        ),
        uploaded: count_where(
            conn,
            "SELECT COUNT(*) FROM tbl_pulse_upload_queue WHERE status='UPLOADED'",
        ),
        failed: count_where(
            conn,
            "SELECT COUNT(*) FROM tbl_pulse_upload_queue WHERE status='FAILED'",
        ),
        total: count_where(conn, "SELECT COUNT(*) FROM tbl_pulse_upload_queue"),
        last_sync: get_setting(conn, "last_sync"),
    })
}

pub fn get_inspections(conn: &Connection) -> Result<Vec<InspectionRow>, String> {
    let mut out = Vec::new();

    let mut stmt = conn
        .prepare(
            "
            SELECT id, uuid, inspector, lot_name, timestamp, uploaded, json_data
            FROM tbl_pulse_inspections
            ORDER BY id DESC
            ",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let json_text: String = row.get(6)?;
            let json: Value =
                serde_json::from_str(&json_text).unwrap_or(Value::Null);
            Ok(InspectionRow {
                id: row.get(0)?,
                uuid: row.get(1)?,
                inspector: row.get(2)?,
                lot: row.get(3)?,
                timestamp: row.get(4)?,
                uploaded: row.get::<_, i64>(5)? != 0,
                serial: ptr_str(&json, "/inventory/system/serial_number")
                    .to_string(),
                manufacturer: ptr_str(&json, "/inventory/system/manufacturer")
                    .to_string(),
                model: ptr_str(&json, "/inventory/system/model").to_string(),
                grade: grade_for(&json),
            })
        })
        .map_err(|e| e.to_string())?;

    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}
