use anyhow::Result;
use std::fs;

use crate::models::device::SystemInfo;

pub fn collect() -> Result<SystemInfo> {

    let manufacturer =
        read_file(
            "/sys/devices/virtual/dmi/id/sys_vendor"
        );

    let model =
        read_file(
            "/sys/devices/virtual/dmi/id/product_name"
        );

    let mut serial =
        read_file(
            "/sys/devices/virtual/dmi/id/product_serial"
        );

    let mut uuid =
        read_file(
            "/sys/devices/virtual/dmi/id/product_uuid"
        );

    if serial.is_empty()
    {
        serial =
            get_dmidecode_value(
                "system-serial-number"
            );
    }

    if uuid.is_empty()
    {
        uuid =
            get_dmidecode_value(
                "system-uuid"
            );
    }

    let board_serial =
        get_dmidecode_value(
            "baseboard-serial-number"
        );

    let bios_version =
        get_dmidecode_value(
            "bios-version"
        );

    Ok(
        SystemInfo {

            manufacturer,

            model,

            serial_number:
                serial,

            uuid,

            board_serial,

            bios_version,
        }
    )
}

fn read_file(
    path: &str
)
-> String
{
    fs::read_to_string(path)
        .unwrap_or_default()
        .trim()
        .to_string()
}

fn get_dmidecode_value(
    key: &str
)
-> String
{
    let output =
        crate::sudo::output(&[
            "dmidecode",
            "-s",
            key,
        ]);

    match output
    {
        Ok(o) => {

            String::from_utf8_lossy(
                &o.stdout
            )
            .trim()
            .to_string()
        }

        Err(_) => String::new(),
    }
}
