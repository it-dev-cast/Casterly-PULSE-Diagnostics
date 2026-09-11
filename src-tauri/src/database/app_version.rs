// Local mirror of Supabase's tbl_pulse_app_ver (app_version where
// active_yn = true). Whenever get_pulse_app_version successfully reaches
// Supabase over Wi-Fi, it writes the value here via save_local_app_version;
// when Wi-Fi is down (or the Supabase call fails), the frontend falls back to
// whatever was last cached via get_local_app_version.
//
// Only ever one row (fixed id = 1) — this is a single "currently active
// version" cache, not a full history mirror of the remote table.

use rusqlite::{params, Connection};

/// Upserts the cached active app version (id is fixed at 1 so this always
/// updates the same row instead of accumulating history).
pub fn save_local_app_version(conn: &Connection, app_version: &str) -> Result<(), String> {
    conn.execute(
        "
        INSERT INTO tbl_pulse_app_ver (id, app_version, active_yn, created_at)
        VALUES (1, ?1, 1, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
            app_version = excluded.app_version,
            active_yn = 1,
            created_at = excluded.created_at
        ",
        params![app_version],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Reads back the last-synced active app version, if any (e.g. on a
/// brand-new install that has never had Wi-Fi/Supabase access yet).
pub fn get_local_app_version(conn: &Connection) -> Option<String> {
    conn.query_row(
        "
        SELECT app_version
        FROM tbl_pulse_app_ver
        WHERE active_yn = 1
        ORDER BY id DESC
        LIMIT 1
        ",
        [],
        |row| row.get::<_, String>(0),
    )
    .ok()
    .filter(|v| !v.trim().is_empty())
}
