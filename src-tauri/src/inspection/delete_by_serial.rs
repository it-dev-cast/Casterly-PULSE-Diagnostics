use std::io;

use rusqlite::{
    Connection,
    params
};

use serde_json::Value;

pub fn delete_by_serial(
    conn: &Connection
)
{
    println!();

    println!(
        "Enter Serial Number:"
    );

    let mut serial =
        String::new();

    io::stdin()
        .read_line(
            &mut serial
        )
        .unwrap();

    let serial =
        serial.trim();

    let mut stmt =
        match conn.prepare(

            "
            SELECT
                id,
                json_data
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

            |row| {

                Ok((
                    row.get::<_, i32>(0)?,
                    row.get::<_, String>(1)?,
                ))
            }

        );

    if let Ok(records) = rows {

        for record in records {

            if let Ok((
                id,
                json_text
            )) = record
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
                        serial
                    )
                {
                    println!();

                    println!(
                        "Record Found"
                    );

                    println!(
                        "Serial : {}",
                        existing_serial
                    );

                    println!();

                    println!(
                        "Delete Record?"
                    );

                    println!(
                        "1. Yes"
                    );

                    println!(
                        "2. No"
                    );

                    let mut choice =
                        String::new();

                    io::stdin()
                        .read_line(
                            &mut choice
                        )
                        .unwrap();

                    if choice.trim() == "1"
                    {
                        conn.execute(

                            "
                            DELETE FROM inspections
                            WHERE id=?
                            ",

                            params![id]

                        )
                        .unwrap();

                        println!();

                        println!(
                            "Record Deleted"
                        );
                    }

                    return;
                }
            }
        }
    }

    println!();

    println!(
        "Serial Number Not Found"
    );
}