use rusqlite::Connection;

pub fn pending_count(
    conn: &Connection
)
-> i64
{
    conn.query_row(

        "
        SELECT COUNT(*)
        FROM inspections
        WHERE uploaded = 0
        ",

        [],

        |row| row.get(0)

    )
    .unwrap_or(0)
}