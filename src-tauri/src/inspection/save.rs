use chrono::Local;

use rusqlite::{
    Connection,
    params
};

use uuid::Uuid;

use crate::inventory::collector;

use crate::models::run::
    InspectionRun;

use crate::health::
    battery_health;

use std::io;

pub fn create_and_save(
    conn: &Connection,

    usb_id: &str,

    inspector: &str,

    lot_name: &str
)
{
    let inventory =
        match collector::collect_all()
    {
        Ok(inv) => inv,

        Err(e) => {

            println!(
                "Scan Failed: {}",
                e
            );

            return;
        }
    };

    let grading =
        crate::grading::
            manual_grading::
                collect();

    let speaker_test =
        crate::diagnostics::
            speaker::
                run();

    let webcam_test =
        crate::diagnostics::
            webcam::
                run();

    let keyboard_test =
        crate::diagnostics::
            keyboard::
                run();

    let battery_health =
        if let Some(
            battery
        ) = &inventory.battery
    {
        Some(

            battery_health::
                calculate(
                    battery
                )
                .health_percent
        )
    }
    else
    {
        None
    };

    let serial_number =
        inventory
            .system
            .serial_number
            .clone();

    if !serial_number.is_empty()
    {
        let duplicate =
            crate::inspection::
                duplicate::
                    serial_exists(

                        conn,

                        &serial_number,

                        lot_name
                    );

        if duplicate
        {
            println!();

            println!(
                "WARNING"
            );

            println!(
                "Duplicate System Detected"
            );

            println!(
                "Serial Number : {}",
                serial_number
            );

            println!();

            println!(
                "1. Save Anyway"
            );

            println!(
                "2. Cancel"
            );

            let mut choice =
                String::new();

            io::stdin()
                .read_line(
                    &mut choice
                )
                .unwrap();

            if choice.trim() == "2"
            {
                println!();

                println!(
                    "Inspection Cancelled"
                );

                return;
            }
        }
    }

    let run =
        InspectionRun {

            uuid:
                Uuid::new_v4()
                    .to_string(),

            usb_id:
                usb_id.to_string(),

            inspector:
                inspector.to_string(),

            lot_name:
                lot_name.to_string(),

            timestamp:
                Local::now()
                    .format(
                        "%d/%m/%Y %H:%M:%S"
                    )
                    .to_string(),

            uploaded: false,

            battery_health,

            grading,

            speaker_test,

            webcam_test,

            keyboard_test,

            inventory,
        };

    let json =
        serde_json::
            to_string_pretty(
                &run
            )
            .unwrap();

      conn.execute(

         "
         INSERT INTO inspections
         (
            uuid,
            lot_name,
            inspector,
            timestamp,
            uploaded,
            json_data
         )
         VALUES
         (?1, ?2, ?3, ?4, ?5, ?6)
         ",

         params![

            run.uuid,

            run.lot_name,

            run.inspector,

            run.timestamp,

            0,

            json
         ]

         )
         .unwrap();

          crate::upload::
          queue::
          add_to_queue(

            conn,

            &run.uuid
          );

         println!();

         println!(
         "Inspection Saved"
      );

        println!();
}