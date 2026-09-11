use serde::{Serialize, Deserialize};

use crate::models::device::{
    CpuInfo,
    MemoryModule,
    StorageDevice,
    SystemInfo,
    BatteryInfo,
    BiosInfo,
    GpuInfo,
    DisplayInfo,
    NetworkInfo,
};

#[derive(Debug, Serialize, Deserialize)]
pub struct DeviceInventory {

    pub system: SystemInfo,

    pub cpu: CpuInfo,

    pub memory: Vec<MemoryModule>,

    pub storage: Vec<StorageDevice>,

    pub battery: Option<BatteryInfo>,

    pub bios: BiosInfo,

    pub gpu: Vec<GpuInfo>,

    pub display: Option<DisplayInfo>,

    pub network: Option<NetworkInfo>,
}