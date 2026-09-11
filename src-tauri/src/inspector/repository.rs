use rusqlite::Connection;
use chrono::Local;

use crate::inspector::model::Inspector;
use crate::database::settings::{get_setting, upsert_setting};

// PRD §11 defines no inspectors table. The inspector list is stored as a JSON
// array under this settings key, and the *selected* inspector's name is stored
// under the 'inspector' settings key (which flows into InspectionRun.inspector).
const INSPECTORS_KEY: &str = "inspectors";
const ACTIVE_INSPECTOR_KEY: &str = "inspector";

/// Load the full inspector list from settings JSON.
fn load_all(
    conn: &Connection,
)
-> Result<Vec<Inspector>, String>
{
    let raw = get_setting(conn, INSPECTORS_KEY);
    let raw = raw.trim();

    if raw.is_empty() {
        return Ok(Vec::new());
    }

    serde_json::from_str::<Vec<Inspector>>(raw)
        .map_err(|e| format!("failed to parse inspectors JSON: {}", e))
}

/// Persist the full inspector list to settings JSON.
fn save_all(
    conn: &Connection,
    list: &[Inspector],
)
-> Result<(), String>
{
    let json = serde_json::to_string(list)
        .map_err(|e| format!("failed to serialize inspectors: {}", e))?;

    upsert_setting(conn, INSPECTORS_KEY, &json)
}

fn next_id(list: &[Inspector]) -> i64 {
    list.iter().map(|i| i.id).max().unwrap_or(0) + 1
}

fn employee_id_taken(
    list: &[Inspector],
    employee_id: &str,
    exclude_id: Option<i64>,
) -> bool {
    list.iter().any(|i| {
        i.employee_id.eq_ignore_ascii_case(employee_id)
            && Some(i.id) != exclude_id
    })
}

/// Look up a single inspector by id. Returns None if no such id exists.
pub fn get_inspector(
    conn: &Connection,
    id: i64,
)
-> Result<Option<Inspector>, String>
{
    let list = load_all(conn)?;
    Ok(list.into_iter().find(|i| i.id == id))
}

/// Fetch all inspectors, newest first.
pub fn get_inspectors(
    conn: &Connection,
)
-> Result<Vec<Inspector>, String>
{
    let mut list = load_all(conn)?;
    list.sort_by(|a, b| b.id.cmp(&a.id));
    Ok(list)
}

/// Add a new inspector. Rejects duplicate Employee IDs. Returns the new id.
pub fn insert_inspector(
    conn: &Connection,
    inspector_name: &str,
    employee_id: &str,
    email: &str,
    phone: &str,
)
-> Result<i64, String>
{
    let mut list = load_all(conn)?;

    if employee_id_taken(&list, employee_id, None) {
        return Err(format!(
            "An inspector with Employee ID \"{}\" already exists.",
            employee_id
        ));
    }

    let id = next_id(&list);
    list.push(Inspector {
        id,
        inspector_name: inspector_name.to_string(),
        employee_id: employee_id.to_string(),
        email: email.to_string(),
        phone: phone.to_string(),
        created_date: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    });

    save_all(conn, &list)?;
    Ok(id)
}

/// Update an existing inspector. Rejects a duplicate Employee ID belonging to a
/// different inspector. created_date is left unchanged.
pub fn update_inspector(
    conn: &Connection,
    id: i64,
    inspector_name: &str,
    employee_id: &str,
    email: &str,
    phone: &str,
)
-> Result<(), String>
{
    let mut list = load_all(conn)?;

    if employee_id_taken(&list, employee_id, Some(id)) {
        return Err(format!(
            "An inspector with Employee ID \"{}\" already exists.",
            employee_id
        ));
    }

    let target = list
        .iter_mut()
        .find(|i| i.id == id)
        .ok_or_else(|| format!("Inspector id {} not found", id))?;

    target.inspector_name = inspector_name.to_string();
    target.employee_id = employee_id.to_string();
    target.email = email.to_string();
    target.phone = phone.to_string();

    save_all(conn, &list)
}

/// Delete an inspector by id.
pub fn delete_inspector(
    conn: &Connection,
    id: i64,
)
-> Result<(), String>
{
    let mut list = load_all(conn)?;
    list.retain(|i| i.id != id);
    save_all(conn, &list)
}

/// Mark an inspector as the active one: store their name under the 'inspector'
/// settings key (flows into InspectionRun.inspector).
pub fn select_inspector(
    conn: &Connection,
    id: i64,
)
-> Result<(), String>
{
    let list = load_all(conn)?;
    let inspector = list
        .iter()
        .find(|i| i.id == id)
        .ok_or_else(|| format!("Inspector id {} not found", id))?;

    upsert_setting(conn, ACTIVE_INSPECTOR_KEY, &inspector.inspector_name)
}
