use rusqlite::Connection;

use serde_json::Value;

pub fn show_all(
    conn: &Connection
)
{
    println!();

    println!("======================");
    println!("SCANNED SYSTEMS");
    println!("======================");

    let mut stmt =
        match conn.prepare(

            "
            SELECT
                id,
                json_data
            FROM inspections
            ORDER BY id DESC
            "

        )
    {
        Ok(s) => s,

        Err(e) => {

            println!(
                "Database Error: {}",
                e
            );

            return;
        }
    };

    let rows =
        stmt.query_map(

            [],

            |row| {

                Ok((
                    row.get::<_, i32>(0)?,
                    row.get::<_, String>(1)?,
                ))
            }

        );

    match rows {

        Ok(records) => {

            let mut count = 0;

            for record in records {

                if let Ok((
                    id,
                    json_text
                )) = record
                {
                    count += 1;

                    let json: Value =
                        serde_json::from_str(
                            &json_text
                        )
                        .unwrap_or(
                            Value::Null
                        );

                    let serial =
                        json.pointer(
                            "/inventory/system/serial_number"
                        )
                        .and_then(
                            |v|
                            v.as_str()
                        )
                        .unwrap_or(
                            "UNKNOWN"
                        );

                    let manufacturer =
                        json.pointer(
                            "/inventory/system/manufacturer"
                        )
                        .and_then(
                            |v|
                            v.as_str()
                        )
                        .unwrap_or(
                            "UNKNOWN"
                        );

                    let model =
                        json.pointer(
                            "/inventory/system/model"
                        )
                        .and_then(
                            |v|
                            v.as_str()
                        )
                        .unwrap_or(
                            "UNKNOWN"
                        );

                    let inspector =
                        json.get(
                            "inspector"
                        )
                        .and_then(
                            |v|
                            v.as_str()
                        )
                        .unwrap_or(
                            ""
                        );

                    let timestamp =
                        json.get(
                            "timestamp"
                        )
                        .and_then(
                            |v|
                            v.as_str()
                        )
                        .unwrap_or(
                            ""
                        );

                    println!();

                    println!(
                        "Record ID    : {}",
                        id
                    );

                    println!(
                        "Serial       : {}",
                        serial
                    );

                    println!(
                        "Manufacturer : {}",
                        manufacturer
                    );

                    println!(
                        "Model        : {}",
                        model
                    );

                    println!(
                        "Inspector    : {}",
                        inspector
                    );

                    println!(
                        "Timestamp    : {}",
                        timestamp
                    );

                    println!(
                        "----------------------"
                    );
                }
            }

            println!();

            println!(
                "Total Records : {}",
                count
            );
        }

        Err(e) => {

            println!(
                "Query Error: {}",
                e
            );
        }
    }
}