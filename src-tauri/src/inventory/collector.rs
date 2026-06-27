use anyhow::Result;

use crate::inventory::{
    cpu,
    memory,
    storage,
    system,
    battery,
    bios,
    gpu,
    display,
    network,
};

use crate::models::inventory::
    DeviceInventory;

pub fn collect_all()
-> Result<DeviceInventory>
{
    Ok(

        DeviceInventory {

            system:
                system::collect()?,

            cpu:
                cpu::collect()?,

            memory:
                memory::collect()?,

            storage:
                storage::collect()?,

            battery:
                battery::collect()?,

            bios:
                bios::collect()?,

            gpu:
                gpu::collect()?,

            display:
                display::collect()?,

            network:
                network::collect()?,
        }
    )
}