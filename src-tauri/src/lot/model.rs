use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Lot {

    pub lot_name: String,

    pub customer: String,

    pub location: String,

    pub inspection_date: String,

    pub status: String,
}