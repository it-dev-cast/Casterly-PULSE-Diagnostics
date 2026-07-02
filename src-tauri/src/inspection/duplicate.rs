use rusqlite::Connection;

use serde_json::Value;

pub fn serial_exists(
    conn: &Connection,

    serial_number: &str,

    lot_name: &str
)
-> bool
{
    let mut stmt =
        match conn.prepare(

            "
            SELECT json_data
            FROM inspections
            WHERE lot_name = ?
            "

        )
    {
        Ok(s) => s,

        Err(_) => {
            return false;
        }
    };

    let rows =
        stmt.query_map(

            [lot_name],

            |row|
            {
                row.get::<_, String>(0)
            }

        );

    if let Ok(records) = rows {

        for record in records {

            if let Ok(json_text)
                = record
            {
                let json: Value =
                    serde_json::from_str(
                        &json_text
                    )
                    .unwrap_or(
                        Value::Null
                    );

                let existing_serial =
                    json.pointer(
                        "/inventory/system/serial_number"
                    )
                    .and_then(
                        |v|
                        v.as_str()
                    )
                    .unwrap_or("");

                if existing_serial
                    .eq_ignore_ascii_case(
                        serial_number
                    )
                {
                    return true;
                }
            }
        }
    }

    false
}