use std::collections::HashMap;

use rusqlite::Connection;

use serde_json::Value;

pub fn show_report(
    conn: &Connection
)
{
    println!();

    println!(
        "======================"
    );

    println!(
        "DUPLICATE REPORT"
    );

    println!(
        "======================"
    );

    let mut stmt =
        match conn.prepare(

            "
            SELECT json_data
            FROM inspections
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

            |row|
            {
                row.get::<_, String>(0)
            }

        );

    let mut counts:
        HashMap<String, i32>
        = HashMap::new();

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

                let serial =
                    json.pointer(
                        "/inventory/system/serial_number"
                    )
                    .and_then(
                        |v|
                        v.as_str()
                    )
                    .unwrap_or("")
                    .to_string();

                if !serial.is_empty()
                {
                    *counts
                        .entry(serial)
                        .or_insert(0)
                        += 1;
                }
            }
        }
    }

    let mut found = false;

    for (serial, count)
        in counts
    {
        if count > 1
        {
            found = true;

            println!();

            println!(
                "Serial : {}",
                serial
            );

            println!(
                "Copies : {}",
                count
            );

            println!(
                "----------------------"
            );
        }
    }

    if !found
    {
        println!();

        println!(
            "No Duplicates Found"
        );
    }
}