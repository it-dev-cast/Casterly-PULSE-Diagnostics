use rusqlite::{
    Connection,
    params,
};

use crate::lot::model::{Lot, LotRow};

/// Set the active LOT name in the settings key 'active_lot' (PRD §11.5).
fn set_active_lot_name(
    conn: &Connection,
    lot_name: &str,
)
-> Result<(), String>
{
    conn.execute(
        "
        INSERT INTO tbl_pulse_settings (key, value)
        VALUES ('active_lot', ?1)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        ",
        params![lot_name],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Returns true if a LOT with the given name already exists (case-insensitive).
pub fn lot_name_exists(
    conn: &Connection,
    lot_name: &str,
)
-> Result<bool, String>
{
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM tbl_pulse_lots WHERE LOWER(lot_name) = LOWER(?1)",
            params![lot_name],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    Ok(count > 0)
}

/// Insert a new LOT into the `tbl_pulse_lots` table (PRD §11.2). inspection_date is set to
/// today, status to 'ACTIVE', and the LOT becomes the active LOT (settings).
/// Rejects duplicate LOT names. Returns the new row id.
pub fn insert_lot(
    conn: &Connection,
    lot_name: &str,
    customer: &str,
    location: &str,
)
-> Result<i64, String>
{
    if lot_name_exists(conn, lot_name)? {
        return Err(format!("A LOT named \"{}\" already exists.", lot_name));
    }

    conn.execute(
        "
        INSERT INTO tbl_pulse_lots
        (lot_name, customer, location, inspection_date, status)
        VALUES (?1, ?2, ?3, date('now','localtime'), 'ACTIVE')
        ",
        params![lot_name, customer, location],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    set_active_lot_name(conn, lot_name)?;
    Ok(id)
}

/// Fetch all rows from the `tbl_pulse_lots` table, newest first.
pub fn get_lots(
    conn: &Connection,
)
-> Result<Vec<LotRow>, String>
{
    let mut stmt = conn
        .prepare(
            "
            SELECT id, lot_name, customer, location, inspection_date, status
            FROM tbl_pulse_lots
            ORDER BY id DESC
            "
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(LotRow {
                id: row.get(0)?,
                lot_name: row.get(1)?,
                customer: row.get(2)?,
                location: row.get(3)?,
                inspection_date: row.get(4)?,
                status: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut lots = Vec::new();
    for r in rows {
        lots.push(r.map_err(|e| e.to_string())?);
    }
    Ok(lots)
}

/// Look up a single LOT's full row by id. Returns None if no such row exists.
pub fn get_lot(
    conn: &Connection,
    id: i64,
)
-> Result<Option<LotRow>, String>
{
    let result = conn.query_row(
        "
        SELECT id, lot_name, customer, location, inspection_date, status
        FROM tbl_pulse_lots
        WHERE id = ?1
        ",
        params![id],
        |row| {
            Ok(LotRow {
                id: row.get(0)?,
                lot_name: row.get(1)?,
                customer: row.get(2)?,
                location: row.get(3)?,
                inspection_date: row.get(4)?,
                status: row.get(5)?,
            })
        },
    );

    match result {
        Ok(lot) => Ok(Some(lot)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Look up a single LOT's name by id. Returns None if no such row exists.
pub fn get_lot_name(
    conn: &Connection,
    id: i64,
)
-> Result<Option<String>, String>
{
    let result = conn.query_row(
        "SELECT lot_name FROM tbl_pulse_lots WHERE id = ?1",
        params![id],
        |row| row.get::<_, String>(0),
    );

    match result {
        Ok(name) => Ok(Some(name)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Update an existing LOT row. Rejects a duplicate LOT name that belongs to a
/// *different* LOT. inspection_date and status are left unchanged.
pub fn update_lot(
    conn: &Connection,
    id: i64,
    lot_name: &str,
    customer: &str,
    location: &str,
)
-> Result<(), String>
{
    let duplicate: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM tbl_pulse_lots \
             WHERE LOWER(lot_name) = LOWER(?1) AND id <> ?2",
            params![lot_name, id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if duplicate > 0 {
        return Err(format!("A LOT named \"{}\" already exists.", lot_name));
    }

    conn.execute(
        "
        UPDATE tbl_pulse_lots
        SET lot_name = ?1, customer = ?2, location = ?3
        WHERE id = ?4
        ",
        params![lot_name, customer, location, id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Permanently delete a LOT row by id.
pub fn delete_lot(
    conn: &Connection,
    id: i64,
)
-> Result<(), String>
{
    conn.execute(
        "DELETE FROM tbl_pulse_lots WHERE id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Set the status of a LOT row (PRD statuses: ACTIVE / COMPLETED / CANCELLED).
pub fn set_lot_status(
    conn: &Connection,
    id: i64,
    status: &str,
)
-> Result<(), String>
{
    conn.execute(
        "UPDATE tbl_pulse_lots SET status = ?1 WHERE id = ?2",
        params![status, id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Mark a LOT as the active one: set its status to ACTIVE and record its name in
/// settings 'active_lot'.
pub fn select_lot(
    conn: &Connection,
    id: i64,
)
-> Result<(), String>
{
    let name = get_lot_name(conn, id)?
        .ok_or_else(|| format!("LOT id {} not found", id))?;

    set_lot_status(conn, id, "ACTIVE")?;
    set_active_lot_name(conn, &name)?;
    Ok(())
}

/// Create a LOT from a full Lot struct (used by non-UI/CLI flows). Inserts into
/// `tbl_pulse_lots` and records it as the active LOT.
pub fn create_lot(
    conn: &Connection,
    lot: &Lot,
)
{
    conn.execute(
        "
        INSERT INTO tbl_pulse_lots
        (lot_name, customer, location, inspection_date, status)
        VALUES (?1, ?2, ?3, ?4, ?5)
        ",
        params![
            lot.lot_name,
            lot.customer,
            lot.location,
            lot.inspection_date,
            lot.status
        ],
    )
    .unwrap();

    let _ = set_active_lot_name(conn, &lot.lot_name);
}

pub fn get_active_lot(
    conn: &Connection
)
-> Option<Lot>
{
    let mut stmt =
        conn.prepare(
            "
            SELECT
                lot_name,
                customer,
                location,
                inspection_date,
                status
            FROM tbl_pulse_lots
            WHERE status='ACTIVE'
            LIMIT 1
            "
        ).unwrap();

    let mut rows =
        stmt.query([]).unwrap();

    if let Some(row) = rows.next().unwrap() {
        Some(Lot {
            lot_name: row.get(0).unwrap(),
            customer: row.get(1).unwrap(),
            location: row.get(2).unwrap(),
            inspection_date: row.get(3).unwrap(),
            status: row.get(4).unwrap(),
        })
    } else {
        None
    }
}
