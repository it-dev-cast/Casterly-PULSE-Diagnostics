use std::io;

use rusqlite::Connection;

use crate::inspection::{
    browser,
    delete_by_serial,
    duplicate_report,
    cleanup_duplicates,
};

pub fn menu(
    conn: &Connection
)
{
    loop
    {
        println!();

        println!(
            "======================"
        );

        println!(
            "INSPECTION MANAGER"
        );

        println!(
            "======================"
        );

        println!(
            "1. View Records"
        );

        println!(
            "2. Delete By Serial"
        );

        println!(
            "3. Duplicate Report"
        );

        println!(
            "4. Cleanup Duplicates"
        );

        println!(
            "5. Back"
        );

        println!();

        println!(
            "Enter Choice:"
        );

        let mut choice =
            String::new();

        io::stdin()
            .read_line(
                &mut choice
            )
            .unwrap();

        match choice.trim()
        {
            "1" => {

                browser::
                    show_all(
                        conn
                    );
            }

            "2" => {

                delete_by_serial::
                    delete_by_serial(
                        conn
                    );
            }

            "3" => {

                duplicate_report::
                    show_report(
                        conn
                    );
            }

            "4" => {

                cleanup_duplicates::
                    run(
                        conn
                    );
            }

            "5" => {

                break;
            }

            _ => {

                println!(
                    "Invalid Option"
                );
            }
        }
    }
}