use rusqlite::{
    Connection,
    params
};

use crate::models::settings::Settings;
use uuid::Uuid;

pub fn create_default_settings(
    conn: &Connection
)
{
    conn.execute(

        "
        INSERT OR IGNORE INTO tbl_pulse_settings
        (key,value)
        VALUES
        ('usb_id','UDIAG-001')
        ",

        []
    ).unwrap();

    conn.execute(

        "
        INSERT OR IGNORE INTO tbl_pulse_settings
        (key,value)
        VALUES
        ('inspector','')
        ",

        []
    ).unwrap();

    conn.execute(

        "
        INSERT OR IGNORE INTO tbl_pulse_settings
        (key,value)
        VALUES
        ('active_lot','')
        ",

        []
    ).unwrap();

    conn.execute(

        "
        INSERT OR IGNORE INTO tbl_pulse_settings
        (key,value)
        VALUES
        ('last_sync','Never')
        ",

        []
    ).unwrap();

    conn.execute(

        "
        INSERT OR IGNORE INTO tbl_pulse_settings
        (key,value)
        VALUES
        ('version','3.0')
        ",

        []
    ).unwrap();

    // Supabase connection config (PRD §12). Seeded once; can be changed later
    // via the settings table / future Settings screen.
    conn.execute(
        "
        INSERT OR IGNORE INTO tbl_pulse_settings (key, value)
        VALUES ('supabase_url', 'https://pesgdrfeauofhtbjqkbz.supabase.co')
        ",
        []
    ).unwrap();

    conn.execute(
        "
        INSERT OR IGNORE INTO tbl_pulse_settings (key, value)
        VALUES ('supabase_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlc2dkcmZlYXVvZmh0Ympxa2J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzgwNjg5NywiZXhwIjoyMDkzMzgyODk3fQ.pqikpnfrtSttjAS6Z4A-zyUyzTypveMEllxCuHVjqpE')
        ",
        []
    ).unwrap();
}

pub fn get_setting(
    conn: &Connection,
    key: &str
) -> String {

    conn.query_row(

        "
        SELECT value
        FROM tbl_pulse_settings
        WHERE key=?
        ",

        params![key],

        |row| row.get(0)

    )
    .unwrap_or_default()
}

pub fn load_settings(
    conn: &Connection
)
-> Settings
{
    Settings {

        usb_id:
            get_setting(
                conn,
                "usb_id"
            ),

        inspector:
            get_setting(
                conn,
                "inspector"
            ),

        active_lot:
            get_setting(
                conn,
                "active_lot"
            ),

        last_sync:
            get_setting(
                conn,
                "last_sync"
            ),

        version:
            get_setting(
                conn,
                "version"
            ),
    }
}

pub fn set_setting(
    conn: &Connection,
    key: &str,
    value: &str
)
{
    conn.execute(

        "
        UPDATE tbl_pulse_settings
        SET value = ?
        WHERE key = ?
        ",

        params![
            value,
            key
        ]

    ).unwrap();
}

/// Insert or update a setting key (creates the row if it does not exist).
pub fn upsert_setting(
    conn: &Connection,
    key: &str,
    value: &str,
)
-> Result<(), String>
{
    conn.execute(
        "
        INSERT INTO tbl_pulse_settings (key, value)
        VALUES (?1, ?2)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        ",
        params![key, value],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub fn initialize_usb_id(
    conn: &Connection
)
{
    let current =
        get_setting(
            conn,
            "usb_id"
        );

    if !current.is_empty()
        &&
        current != "UDIAG-001"
    {
        return;
    }

    let uuid =
        Uuid::new_v4();

    let short_id =
        uuid
            .to_string()
            .replace("-", "");

    let usb_id =
        format!(
            "UDIAG-{}",
            &short_id[0..8]
                .to_uppercase()
        );

    set_setting(
        conn,
        "usb_id",
        &usb_id
    );
}