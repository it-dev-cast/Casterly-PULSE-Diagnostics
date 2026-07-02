use rusqlite::Connection;

pub fn pending_count(
    conn: &Connection
)
-> i64
{
    conn.query_row(

        "
        SELECT COUNT(*)
        FROM upload_queue
        WHERE status='PENDING'
        ",

        [],

        |row|
        {
            row.get(0)
        }

    )
    .unwrap_or(0)
}