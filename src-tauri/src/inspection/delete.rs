use std::io;

use rusqlite::{
    Connection,
    params
};

pub fn delete_record(
    conn: &Connection
)
{
    println!();

    println!(
        "Enter Record ID:"
    );

    let mut id =
        String::new();

    io::stdin()
        .read_line(
            &mut id
        )
        .unwrap();

    let id: i32 =
        match id.trim().parse()
    {
        Ok(v) => v,

        Err(_) => {

            println!(
                "Invalid ID"
            );

            return;
        }
    };

    conn.execute(

        "
        DELETE FROM tbl_pulse_inspections
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