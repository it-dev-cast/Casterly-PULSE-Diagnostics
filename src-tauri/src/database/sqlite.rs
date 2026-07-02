use rusqlite::{Connection, Result};

pub fn initialize_database()
-> Result<Connection>
{
    // PRD §11.1: the embedded database file is opened via
    // Connection::open("udiag.db"). With rusqlite's "bundled" feature, SQLite
    // is compiled into the binary — no external libsqlite3 dependency.
    let conn =
        Connection::open(
            "udiag.db"
        )?;

    conn.execute(

        "
        CREATE TABLE IF NOT EXISTS lots (

            id INTEGER PRIMARY KEY,

            lot_name TEXT NOT NULL,

            customer TEXT NOT NULL,

            location TEXT NOT NULL,

            inspection_date TEXT NOT NULL,

            status TEXT NOT NULL
        )
        ",

        []
    )?;

    conn.execute(

        "
        CREATE TABLE IF NOT EXISTS inspections (

            id INTEGER PRIMARY KEY,

            uuid TEXT NOT NULL,

            lot_name TEXT NOT NULL,

            inspector TEXT NOT NULL,

            timestamp TEXT NOT NULL,

            uploaded INTEGER DEFAULT 0,

            json_data TEXT NOT NULL
        )
        ",

        []
    )?;


    conn.execute(

       "
       CREATE TABLE IF NOT EXISTS upload_queue
       (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        inspection_uuid TEXT NOT NULL,

        status TEXT NOT NULL,

        retry_count INTEGER NOT NULL,

        created_at TEXT NOT NULL,

        uploaded_at TEXT
        )
        ",

        []
    )?;


    conn.execute(

    "
    CREATE TABLE IF NOT EXISTS settings (

        key TEXT PRIMARY KEY,

        value TEXT NOT NULL
        )
        ",

        []
    )?;

    Ok(conn)
}