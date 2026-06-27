use rusqlite::{
    Connection,
    params
};

use crate::lot::model::Lot;

pub fn create_lot(
    conn: &Connection,
    lot: &Lot
)
{
    conn.execute(

        "
        INSERT INTO lots
        (
            lot_name,
            customer,
            location,
            inspection_date,
            status
        )
        VALUES
        (?1, ?2, ?3, ?4, ?5)
        ",

        params![
            lot.lot_name,
            lot.customer,
            lot.location,
            lot.inspection_date,
            lot.status
        ]

    ).unwrap();

    conn.execute(

        "
        UPDATE settings
        SET value = ?
        WHERE key = 'active_lot'
        ",

        params![
            lot.lot_name
        ]

    ).unwrap();
}

pub fn get_active_lot(
    conn: &Connection
)
-> Option<Lot>
{
    let mut stmt =
        conn.prepare(

            "
            SELECT
                lot_name,
                customer,
                location,
                inspection_date,
                status
            FROM lots
            WHERE status='ACTIVE'
            LIMIT 1
            "

        ).unwrap();

    let mut rows =
        stmt.query([]).unwrap();

    if let Some(row) =
        rows.next().unwrap()
    {
        Some(

            Lot {

                lot_name:
                    row.get(0).unwrap(),

                customer:
                    row.get(1).unwrap(),

                location:
                    row.get(2).unwrap(),

                inspection_date:
                    row.get(3).unwrap(),

                status:
                    row.get(4).unwrap(),
            }

        )
    }
    else
    {
        None
    }
}