use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Lot {

    pub lot_name: String,

    pub customer: String,

    pub location: String,

    pub inspection_date: String,

    pub status: String,
}

/// A row from the `tbl_pulse_lots` table, serialized to the frontend with camelCase keys.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LotRow {

    pub id: i64,

    pub lot_name: String,

    pub customer: String,

    pub location: String,

    pub inspection_date: String,

    pub status: String,
}