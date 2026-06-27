use serde::{Serialize, Deserialize};

use crate::models::inventory::
    DeviceInventory;

use crate::models::device::
    ManualGrading;

use crate::models::device::
    {SpeakerTest, WebcamTest, KeyboardTest};



#[derive(Debug, Serialize, Deserialize)]
pub struct InspectionRun {

    pub uuid: String,

    pub usb_id: String,

    pub inspector: String,

    pub lot_name: String,

    pub timestamp: String,

    pub uploaded: bool,

    pub battery_health: Option<f64>,

    pub grading: ManualGrading,

    pub inventory: DeviceInventory,

    pub speaker_test: SpeakerTest,

    pub webcam_test: WebcamTest,

    pub keyboard_test: KeyboardTest,
}