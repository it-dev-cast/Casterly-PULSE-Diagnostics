use anyhow::Result;

use std::fs;
use std::process::Command;

use crate::models::device::NetworkInfo;

pub fn collect()
-> Result<Option<NetworkInfo>>
{
    // WSL shows only the virtual eth0 — use the Windows host's real adapters.
    if crate::inventory::wslhost::is_wsl() {
        return Ok(crate::inventory::wslhost::network());
    }

    let output =
        Command::new(
            "lspci"
        )
        .output();

    let output =
        match output
    {
        Ok(o) => o,

        Err(_) =>
        {
            return Ok(None);
        }
    };

    let text =
        String::from_utf8_lossy(
            &output.stdout
        );

    let mut wifi =
        String::new();

    let mut ethernet =
        String::new();

    for line in text.lines()
    {
        let lower =
            line.to_lowercase();

        if lower.contains(
            "network controller"
        )
        {
            wifi =
                line.to_string();
        }

        if lower.contains(
            "ethernet controller"
        )
        {
            ethernet =
                line.to_string();
        }
    }

    let bluetooth =
        Command::new(
            "hciconfig"
        )
        .output()
        .is_ok();

    let wifi_interface =
        find_wifi_interface();

    let ethernet_interface =
        find_ethernet_interface();

    let wifi_mac =
        wifi_interface
            .as_ref()
            .map(|i|
                get_mac_address(i)
            )
            .unwrap_or_default();

    let ethernet_mac =
        ethernet_interface
            .as_ref()
            .map(|i|
                get_mac_address(i)
            )
            .unwrap_or_default();

    let wifi_friendly =
        clean_pci_name(
            &wifi
        );

    let ethernet_friendly =
        clean_pci_name(
            &ethernet
        );

    println!(
        "WIFI ADAPTER: {}",
        wifi_friendly
    );

    println!(
        "ETHERNET ADAPTER: {}",
        ethernet_friendly
    );

    Ok(

        Some(

            NetworkInfo {

                wifi,

                wifi_friendly,

                wifi_mac,

                ethernet,

                ethernet_friendly,

                ethernet_mac,

                bluetooth,
            }
        )
    )
}

fn clean_pci_name(
    text: &str
)
-> String
{
    if text.is_empty()
    {
        return String::new();
    }

    let mut name =
        text.to_string();

    //
    // Remove PCI address
    //
    if let Some(pos) =
        name.find(": ")
    {
        name =
            name[pos + 2..]
                .to_string();
    }

    //
    // Remove controller prefixes
    //
    name =
        name.replace(
            "Network controller: ",
            ""
        );

    name =
        name.replace(
            "Ethernet controller: ",
            ""
        );

    //
    // Remove revision suffix
    //
    if let Some(pos) =
        name.find("(rev")
    {
        name =
            name[..pos]
                .trim()
                .to_string();
    }

    //
    // Cosmetic cleanup
    //
    name =
        name.replace(
            "Corporation",
            ""
        );

    name
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn find_wifi_interface()
-> Option<String>
{
    let entries =
        fs::read_dir(
            "/sys/class/net"
        )
        .ok()?;

    for entry in entries
    {
        let entry =
            entry.ok()?;

        let name =
            entry
                .file_name()
                .to_string_lossy()
                .to_string();

        if name.starts_with("wl")
        {
            return Some(name);
        }
    }

    None
}

fn find_ethernet_interface()
-> Option<String>
{
    let entries =
        fs::read_dir(
            "/sys/class/net"
        )
        .ok()?;

    for entry in entries
    {
        let entry =
            entry.ok()?;

        let name =
            entry
                .file_name()
                .to_string_lossy()
                .to_string();

        if name.starts_with("en")
        ||
        name.starts_with("eth")
        {
            return Some(name);
        }
    }

    None
}

fn get_mac_address(
    interface: &str
)
-> String
{
    let path =
        format!(
            "/sys/class/net/{}/address",
            interface
        );

    fs::read_to_string(path)
        .unwrap_or_default()
        .trim()
        .to_string()
}