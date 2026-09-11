// Compile the actual production modules without the GUI/system dependencies.
#![allow(dead_code)]
pub mod models {
    pub mod device {
        include!("../../src-tauri/src/models/device.rs");
    }
}
#[path = "../../src-tauri/src/sudo.rs"]
mod sudo;
#[path = "../../src-tauri/src/inventory/storage.rs"]
mod storage;
