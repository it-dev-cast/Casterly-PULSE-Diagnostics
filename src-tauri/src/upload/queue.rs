use chrono::Local;

use rusqlite::{
    Connection,
    params
};

pub fn add_to_queue(
    conn: &Connection,
    inspection_uuid: &str
)
{
    println!(
        "DEBUG: Adding To Upload Queue"
    );

    let result =
        conn.execute(

            "
            INSERT INTO upload_queue
            (
                inspection_uuid,
                status,
                retry_count,
                created_at
            )
            VALUES
            (?1, ?2, ?3, ?4)
            ",

            params![

                inspection_uuid,

                "PENDING",

                0,

                Local::now()
                    .format(
                        "%d/%m/%Y %H:%M:%S"
                    )
                    .to_string()
            ]
        );

    match result
    {
        Ok(_) =>
        {
            println!(
                "DEBUG: Queue Insert Success"
            );
        }

        Err(e) =>
        {
            println!(
                "DEBUG: Queue Insert Failed: {}",
                e
            );
        }
    }
}