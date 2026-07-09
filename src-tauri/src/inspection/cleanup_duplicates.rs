use std::io;

use rusqlite::{
    Connection,
    params
};

use serde_json::Value;

pub fn run(
    conn: &Connection
)
{
    println!();

    println!("======================");
    println!("DUPLICATE CLEANUP");
    println!("======================");

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
            FROM tbl_pulse_inspections
            ORDER BY id
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
                Ok((
                    row.get::<_, i32>(0)?,
                    row.get::<_, String>(1)?,
                ))
            }

        )
        .unwrap();

    let mut matches =
        Vec::<(i32,String)>::new();

    for row in rows
    {
        if let Ok((
            id,
            json_text
        )) = row
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
                let timestamp =
                    json.get(
                        "timestamp"
                    )
                    .and_then(
                        |v|
                        v.as_str()
                    )
                    .unwrap_or("")
                    .to_string();

                matches.push(
                    (
                        id,
                        timestamp
                    )
                );
            }
        }
    }

    if matches.len() < 2
    {
        println!();

        println!(
            "No Duplicates Found"
        );

        return;
    }

    println!();

    println!(
        "Duplicate Records Found"
    );

    println!();

    for (
        id,
        timestamp
    ) in &matches
    {
        println!(
            "ID: {}   Time: {}",
            id,
            timestamp
        );
    }

    println!();

    println!(
        "Enter Record ID To Keep:"
    );

    let mut keep_id =
        String::new();

    io::stdin()
        .read_line(
            &mut keep_id
        )
        .unwrap();

    let keep_id:i32 =
        match keep_id
            .trim()
            .parse()
    {
        Ok(v) => v,

        Err(_) => {

            println!(
                "Invalid ID"
            );

            return;
        }
    };

    let mut deleted = 0;

    for (
        id,
        _
    ) in matches
    {
        if id != keep_id
        {
            conn.execute(

                "
                DELETE FROM tbl_pulse_inspections
                WHERE id = ?
                ",

                params![id]

            )
            .unwrap();

            deleted += 1;
        }
    }

    println!();

    println!(
        "Deleted {} Duplicate Records",
        deleted
    );

    println!(
        "Kept Record ID {}",
        keep_id
    );
}