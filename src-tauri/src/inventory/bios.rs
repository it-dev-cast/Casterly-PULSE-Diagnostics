use anyhow::Result;

use std::process::Command;

use crate::models::device::BiosInfo;

pub fn collect()
-> Result<BiosInfo>
{
    Ok(

        BiosInfo {

            vendor:
                get_dmidecode(
                    "bios-vendor"
                ),

            version:
                get_dmidecode(
                    "bios-version"
                ),

            release_date:
                get_dmidecode(
                    "bios-release-date"
                ),
        }
    )
}

fn get_dmidecode(
    field: &str
)
-> String
{
    let output =
        Command::new("sudo")
            .args([
                "dmidecode",
                "-s",
                field
            ])
            .output();

    match output {

        Ok(out) => {

            String::from_utf8_lossy(
                &out.stdout
            )
            .trim()
            .to_string()
        }

        Err(_) => {

            String::new()
        }
    }
}