use std::io;

use rusqlite::Connection;

use crate::lot::model::Lot;
use crate::lot::repository;

pub fn create_new_lot(
    conn: &Connection
)
{
    let mut lot_name =
        String::new();

    let mut customer =
        String::new();

    let mut location =
        String::new();

    let mut date =
        String::new();

    println!();
    println!("CREATE NEW LOT");
    println!("--------------");

    println!("LOT Name:");

    io::stdin()
        .read_line(&mut lot_name)
        .unwrap();

    println!("Customer:");

    io::stdin()
        .read_line(&mut customer)
        .unwrap();

    println!("Location:");

    io::stdin()
        .read_line(&mut location)
        .unwrap();

    println!("Inspection Date (DD/MM/YYYY):");

    io::stdin()
        .read_line(&mut date)
        .unwrap();

    let lot =
        Lot {

            lot_name:
                lot_name.trim().to_string(),

            customer:
                customer.trim().to_string(),

            location:
                location.trim().to_string(),

            inspection_date:
                date.trim().to_string(),

            status:
                "ACTIVE".to_string(),
        };

    repository::create_lot(
        conn,
        &lot
    );

    println!();
    println!("LOT Created");
}