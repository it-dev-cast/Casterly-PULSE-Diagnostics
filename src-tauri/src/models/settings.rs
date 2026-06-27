use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Settings {

    pub usb_id: String,

    pub inspector: String,

    pub active_lot: String,

    pub last_sync: String,

    pub version: String,
}