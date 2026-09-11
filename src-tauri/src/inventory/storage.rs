use anyhow::{anyhow, Result};
use serde_json::Value;
use crate::models::device::StorageDevice;

const LSBLK: &[&str] = &["lsblk", "-J", "-b", "-d", "-o", "NAME,PATH,TYPE,SIZE,MODEL,SERIAL,ROTA,TRAN,RM"];
type Runner<'a> = dyn Fn(&[&str], bool, u64) -> std::io::Result<std::process::Output> + 'a;
type SmartData = (String, Option<u32>, Option<u32>, Option<u64>, Option<String>, Option<u64>, Option<u64>);

pub fn collect() -> Result<Vec<StorageDevice>> {
    collect_with_progress(|_| {})
}

pub fn collect_with_progress(mut progress: impl FnMut(&[StorageDevice])) -> Result<Vec<StorageDevice>> {
    collect_using(&crate::sudo::storage_output, &mut progress, &live_sources())
}

fn collect_using(run: &Runner<'_>, progress: &mut dyn FnMut(&[StorageDevice]), boot: &[String]) -> Result<Vec<StorageDevice>> {
    let output = run(LSBLK, false, 5)?;
    if !output.status.success() { return Err(anyhow!("lsblk failed: {}", output.status)); }
    let mut drives = parse_disks(&String::from_utf8_lossy(&output.stdout), boot)?;
    eprintln!("[PULSE][Storage] lsblk completed: {} internal disk(s)", drives.len());
    progress(&drives); // Publish ALL basic disks before any optional command.
    for i in 0..drives.len() {
        eprintln!("[PULSE][Storage] selected device={} type={}", drives[i].device, drives[i].storage_type);
        enrich(&mut drives[i], run);
        progress(&drives);
    }
    eprintln!("[PULSE][Storage] scan completed");
    Ok(drives)
}

fn disk_name(device: &str) -> &str { device.strip_prefix("/dev/").unwrap_or(device) }
fn string(v: &Value, key: &str) -> String { v[key].as_str().unwrap_or("").trim().to_string() }
fn number(v: &Value) -> Option<u64> {
    v.as_u64().or_else(|| v.as_str()?.trim().replace(',', "").parse().ok())
}
fn flag(v: &Value) -> Option<bool> {
    v.as_bool().or_else(|| match number(v) { Some(0) => Some(false), Some(1) => Some(true), _ => None })
}
fn live_sources() -> Vec<String> {
    std::fs::read_to_string("/proc/self/mountinfo").unwrap_or_default().lines().filter_map(|line| {
        let (left, right) = line.split_once(" - ")?;
        let mount = left.split_whitespace().nth(4)?;
        if ["/cdrom", "/isodevice", "/run/live/medium", "/lib/live/mount/medium"].contains(&mount) {
            Some(right.split_whitespace().nth(1)?.to_string())
        } else { None }
    }).collect()
}
fn is_boot_disk(device: &str, boot: &[String]) -> bool {
    boot.iter().any(|source| {
        if source == device { return true; }
        source.strip_prefix(device).map(|suffix| {
            let suffix = suffix.strip_prefix('p').unwrap_or(suffix);
            !suffix.is_empty() && suffix.chars().all(|c| c.is_ascii_digit())
        }).unwrap_or(false)
    })
}
fn parse_disks(text: &str, boot: &[String]) -> Result<Vec<StorageDevice>> {
    let value: Value = serde_json::from_str(text)?;
    let blocks = value["blockdevices"].as_array().ok_or_else(|| anyhow!("lsblk missing blockdevices"))?;
    let mut drives = Vec::new();
    let (mut nvme_slot, mut other_slot) = (0, 0);
    for block in blocks {
        let name = string(block, "name");
        let mut device = string(block, "path");
        if device.is_empty() { device = format!("/dev/{}", name); }
        let name = disk_name(&device);
        let transport = string(block, "tran").to_lowercase();
        let model = string(block, "model");
        if string(block, "type") != "disk" || flag(&block["rm"]) == Some(true)
            || is_boot_disk(&device, boot)
            || ["loop", "zram", "ram", "sr"].iter().any(|p| name.starts_with(p))
            || !device.starts_with("/dev/") || name.is_empty() || name.contains('/') { continue; }
        // Some Latitude 7410 firmware/kernel combinations expose the internal
        // NVMe namespace as /dev/sdX with TRAN=usb and RM=0. RM plus the live
        // boot source identifies removable media more reliably than TRAN here.
        let native_nvme = name.starts_with("nvme") || transport == "nvme";
        let nvme = native_nvme || model.to_lowercase().contains("nvme");
        let storage_type = if nvme { "NVMe SSD" } else {
            match (transport.as_str(), flag(&block["rota"])) {
                ("sata", Some(false)) => "SATA SSD", ("sata", Some(true)) => "SATA HDD",
                (_, Some(false)) => "SSD", (_, Some(true)) => "HDD", _ => "Storage Device",
            }
        }.to_string();
        let slot = if nvme { nvme_slot += 1; format!("NVMe{}", nvme_slot) }
            else { other_slot += 1; format!("SATA{}", other_slot) };
        drives.push(StorageDevice {
            slot, model, serial: string(block, "serial"), firmware: String::new(),
            size_gb: number(&block["size"]).unwrap_or(0) as f64 / 1024.0_f64.powi(3),
            transport: if native_nvme && transport.is_empty() { "nvme".into() } else { transport }, storage_type, device,
            health_percent: None, temperature_c: None, power_on_hours: None,
            power_cycles: None, media_errors: None, critical_warning: None,
        });
    }
    Ok(drives)
}

fn optional(run: &Runner<'_>, args: &[&str], privileged: bool, seconds: u64, smart: bool) -> Option<String> {
    match run(args, privileged, seconds) {
        Ok(o) if o.status.success() || (smart && o.status.code().map(|c| c & 7 == 0).unwrap_or(false)) =>
            Some(String::from_utf8_lossy(&o.stdout).into_owned()),
        Ok(_) => { eprintln!("[PULSE][Storage] {} unavailable", args[0]); None },
        Err(e) => { eprintln!("[PULSE][Storage] {} unavailable ({})", args[0], e.kind()); None },
    }
}
fn controller(device: &str) -> Option<String> {
    let name = disk_name(device).strip_prefix("nvme")?;
    let digits: String = name.chars().take_while(|c| c.is_ascii_digit()).collect();
    if digits.is_empty() { None } else { Some(format!("/dev/nvme{}", digits)) }
}
fn fill_properties(d: &mut StorageDevice, text: &str) {
    for line in text.lines() {
        if let Some((key, value)) = line.split_once('=') {
            match key {
                "ID_MODEL" if d.model.is_empty() => d.model = value.trim().replace('_', " "),
                "ID_SERIAL_SHORT" if d.serial.is_empty() => d.serial = value.trim().to_string(),
                "ID_REVISION" if d.firmware.is_empty() => d.firmware = value.trim().to_string(),
                _ => {},
            }
        }
    }
}
fn enrich(d: &mut StorageDevice, run: &Runner) {
    // sysfs reads are local kernel attributes, never writes to the disk.
    for (field, attribute) in [(&mut d.model, "model"), (&mut d.serial, "serial"), (&mut d.firmware, "firmware_rev")] {
        if field.is_empty() {
            *field = std::fs::read_to_string(format!("/sys/class/block/{}/device/{}", disk_name(&d.device), attribute))
                .unwrap_or_default().trim().to_string();
        }
    }
    if d.model.is_empty() || d.serial.is_empty() {
        if let Some(text) = optional(run, &["udevadm", "info", "--query=property", &format!("--name={}", d.device)], false, 5, false) {
            fill_properties(d, &text);
        }
    }
    if let Some(ctrl) = controller(&d.device) {
        if d.model.is_empty() || d.serial.is_empty() || d.firmware.is_empty() {
            if let Some(text) = optional(run, &["nvme", "id-ctrl", &ctrl, "-o", "json"], true, 5, false) {
                if let Ok(v) = serde_json::from_str::<Value>(&text) {
                    if d.model.is_empty() { d.model = string(&v, "mn"); }
                    if d.serial.is_empty() { d.serial = string(&v, "sn"); }
                    if d.firmware.is_empty() { d.firmware = string(&v, "fr"); }
                }
            }
        }
        let namespace = d.device.clone();
        for device in [&namespace, &ctrl] {
            if let Some(text) = optional(run, &["nvme", "smart-log", device, "-o", "json"], true, 7, false) {
                if let Ok(v) = serde_json::from_str::<Value>(&text) {
                    apply_nvme(d, &v);
                    if d.health_percent.is_some() && d.temperature_c.is_some() && d.power_on_hours.is_some() { break; }
                }
            }
        }
    }
    if d.health_percent.is_none() || d.temperature_c.is_none() || d.power_on_hours.is_none() || d.firmware.is_empty() {
        eprintln!("[PULSE][Storage] smartctl fallback started");
        if let Some(text) = optional(run, &["smartctl", "-a", &d.device], true, 7, true) {
            let (fw, health, temp, hours, warning, cycles, errors) = parse_smart(&text);
            if d.firmware.is_empty() { d.firmware = fw; }
            d.health_percent = d.health_percent.or(health);
            d.temperature_c = d.temperature_c.or(temp);
            d.power_on_hours = d.power_on_hours.or(hours);
            d.critical_warning = d.critical_warning.take().or(warning);
            d.power_cycles = d.power_cycles.or(cycles);
            d.media_errors = d.media_errors.or(errors);
            for line in text.lines() {
                if let Some((key, value)) = line.trim().split_once(':') {
                    match key {
                        "Device Model" | "Model Number" if d.model.is_empty() => d.model = value.trim().into(),
                        "Serial Number" if d.serial.is_empty() => d.serial = value.trim().into(),
                        _ => {},
                    }
                }
            }
        }
    }
}
fn apply_nvme(d: &mut StorageDevice, v: &Value) {
    d.health_percent = number(&v["percentage_used"]).map(|wear| 100_u64.saturating_sub(wear) as u32);
    // nvme-cli JSON temperature is Kelvin; text output is Celsius.
    d.temperature_c = number(&v["temperature"]).and_then(|k| k.checked_sub(273)).and_then(|c| u32::try_from(c).ok());
    d.power_on_hours = number(&v["power_on_hours"]);
    d.power_cycles = number(&v["power_cycles"]);
    d.media_errors = number(&v["media_errors"]);
    d.critical_warning = number(&v["critical_warning"]).map(|n| format!("0x{:02x}", n));
}
fn parse_smart(text: &str) -> SmartData {


    let mut firmware =
        String::new();

    let mut health = None;

    let mut temperature = None;

    let mut power_hours = None;

    let mut critical_warning = None;

    let mut power_cycles = None;

    let mut media_errors = None;

    for line in text.lines() {
        let l = line.trim();

        //
        // Firmware
        //

        if l.starts_with(
            "Firmware Version:"
        ) {
            firmware = l
                .replace(
                    "Firmware Version:",
                    "",
                )
                .trim()
                .to_string();
        }

        //
        // NVMe Health
        //
        // Percentage Used = wear
        //

        if l.starts_with(
            "Percentage Used:"
        ) {
            if let Some(v) =
                l.split(':').nth(1)
            {
                let wear = v
                    .trim()
                    .replace("%", "")
                    .parse::<u32>()
                    .ok();

                health = wear.map(|wear| 100_u32.saturating_sub(wear));
            }
        }

        //
        // SATA SMART fallback
        //

        if l.contains("FAILED") {


            critical_warning =
                Some(
                    "SMART FAILED"
                        .to_string(),
                );
        }

        //
        // Temperature
        //

        if l.starts_with(
            "Temperature:"
        ) {
            if let Some(v) =
                l.split(':').nth(1)
            {
                temperature = v
                    .trim()
                    .split_whitespace()
                    .next()
                    .and_then(
                        |x| x.parse().ok(),
                    );
            }
        }

        //
        // NVMe Power Hours
        //

        if l.starts_with(
            "Power On Hours:"
        ) {
            if let Some(v) =
                l.split(':').nth(1)
            {
                power_hours = v
                    .trim()
                    .replace(",", "")
                    .parse()
                    .ok();
            }
        }

        //
        // SATA Power Hours
        //

        if l.contains(
            "Power_On_Hours"
        ) && power_hours.is_none()
        {
            if let Some(v) =
                l.split_whitespace()
                    .last()
            {
                power_hours =
                    v.parse().ok();
            }
        }

        //
        // Power Cycles
        //

        if l.starts_with(
            "Power Cycles:"
        ) {
            if let Some(v) =
                l.split(':').nth(1)
            {
                power_cycles = v
                    .trim()
                    .replace(",", "")
                    .parse()
                    .ok();
            }
        }

        //
        // Media Errors
        //

        if l.starts_with(
            "Media and Data Integrity Errors:"
        ) {
            if let Some(v) =
                l.split(':').nth(1)
            {
                media_errors = v
                    .trim()
                    .replace(",", "")
                    .parse()
                    .ok();
            }
        }

        //
        // Critical Warning
        //

        if l.starts_with(
            "Critical Warning:"
        ) {
            critical_warning =
                Some(
                    l.replace(
                        "Critical Warning:",
                        "",
                    )
                    .trim()
                    .to_string(),
                );
        }
    }

    (
        firmware,
        health,
        temperature,
        power_hours,
        critical_warning,
        power_cycles,
        media_errors,
    )
}
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::cell::Cell;
    #[cfg(unix)]
    use std::os::unix::process::ExitStatusExt;

    fn disk(name: &str, tran: Value, rota: Value) -> Value {
        json!({"name":name,"path":format!("/dev/{}",name),"type":"disk","size":512000000000_u64,
            "model":"Test drive","serial":"TEST-ONLY","tran":tran,"rota":rota,"rm":false})
    }
    fn parse(blocks: Vec<Value>) -> Vec<StorageDevice> {
        parse_disks(&json!({"blockdevices":blocks}).to_string(), &[]).unwrap()
    }
    #[test] fn nvme_discovery() {
        let d = parse(vec![disk("nvme0n1", json!("nvme"), json!(false))]);
        assert_eq!(d[0].storage_type, "NVMe SSD"); assert_eq!(d[0].slot, "NVMe1");
        assert_eq!(d[0].device, "/dev/nvme0n1"); assert!(d[0].size_gb > 476.0);
    }
    #[test] fn nvme_without_transport() {
        let d = parse(vec![disk("nvme0n1", Value::Null, json!(0))]);
        assert_eq!(d[0].storage_type, "NVMe SSD"); assert_eq!(d[0].transport, "nvme");
    }
    #[test] fn sata_ssd_without_ssd_in_model() {
        assert_eq!(parse(vec![disk("sda", json!("sata"), json!(0))])[0].storage_type, "SATA SSD");
    }
    #[test] fn sata_hdd() {
        assert_eq!(parse(vec![disk("sda", json!("sata"), json!(1))])[0].storage_type, "SATA HDD");
    }
    #[test] fn missing_transport_uses_rotation() {
        assert_eq!(parse(vec![disk("sda", Value::Null, json!(1))])[0].storage_type, "HDD");
    }
    #[test] fn keeps_non_removable_usb_reported_nvme_and_excludes_live_usb() {
        // Exact Latitude 7410 shape observed in the field: internal WDC SN530
        // appears as /dev/sda, TRAN=usb, RM=0; PULSE Live USB is RM=1.
        let mut internal = disk("sda", json!("usb"), json!(0));
        internal["model"] = json!("PC SN530 NVMe WDC 256GB");
        let mut removable = disk("sdb", Value::Null, json!(0)); removable["rm"] = json!("1");
        let mut partition = disk("nvme0n1p1", Value::Null, json!(0)); partition["type"] = json!("part");
        let d = parse(vec![internal, removable, partition, disk("zram0", Value::Null, json!(0)),
            disk("nvme0n1", Value::Null, json!(0)), disk("sdc", json!("sata"), json!(1))]);
        assert_eq!(d.len(), 3);
        assert_eq!(d[0].device, "/dev/sda");
        assert_eq!(d[0].storage_type, "NVMe SSD");
        assert_eq!(d[0].transport, "usb");
    }
    #[test] fn excludes_live_boot_disk_with_blank_transport() {
        let input = json!({"blockdevices":[disk("sda", Value::Null, json!(0)),disk("nvme0n1", Value::Null,json!(0))]});
        let d = parse_disks(&input.to_string(), &["/dev/sda1".into()]).unwrap();
        assert_eq!(d.len(), 1); assert_eq!(d[0].device,"/dev/nvme0n1");
    }
    #[test] fn controller_from_namespace() {
        assert_eq!(controller("/dev/nvme12n3"), Some("/dev/nvme12".into()));
        assert_eq!(controller("/dev/sda"), None);
    }
    #[test] fn nvme_health_units_wear_and_hours() {
        let mut d = parse(vec![disk("nvme0n1", Value::Null,json!(0))]).remove(0);
        apply_nvme(&mut d,&json!({"percentage_used":31,"temperature":308,"power_on_hours":"1,234","critical_warning":0}));
        assert_eq!(d.health_percent,Some(69)); assert_eq!(d.temperature_c,Some(35)); assert_eq!(d.power_on_hours,Some(1234));
        apply_nvme(&mut d,&json!({"percentage_used":150})); assert_eq!(d.health_percent,Some(0));
    }
    #[test] fn smart_pass_does_not_fabricate_remaining_life() {
        assert_eq!(parse_smart("SMART overall-health self-assessment test result: PASSED").1,None);
        assert_eq!(parse_smart("Percentage Used: unsupported").1,None);
    }
    #[test] fn smart_sata_hours_and_nvme_fields() {
        let v=parse_smart("Firmware Version: FW1\nPercentage Used: 12%\nTemperature: 34 Celsius\nPower On Hours: 1,000\nPower Cycles: 20\nMedia and Data Integrity Errors: 0");
        assert_eq!(v.0,"FW1"); assert_eq!(v.1,Some(88)); assert_eq!(v.2,Some(34)); assert_eq!(v.3,Some(1000));
        assert_eq!(parse_smart("9 Power_On_Hours 0x0032 099 099 000 Old_age Always - 123").3,Some(123));
    }
    #[test] fn udev_blank_model_serial_fallback() {
        let mut d=parse(vec![disk("sda",json!("sata"),json!(0))]).remove(0);
        d.model.clear();d.serial.clear();fill_properties(&mut d,"ID_MODEL=Test_SSD\nID_SERIAL_SHORT=TEST123");
        assert_eq!(d.model,"Test SSD");assert_eq!(d.serial,"TEST123");
    }
    #[cfg(unix)]
    fn out(text: &str, code: i32) -> std::io::Result<std::process::Output> {
        Ok(std::process::Output { status: std::process::ExitStatus::from_raw(code << 8), stdout:text.as_bytes().to_vec(),stderr:vec![] })
    }
    #[cfg(unix)]
    #[test] fn optional_timeouts_keep_basic_data_and_publish_first() {
        let published=Cell::new(false); let optional_calls=Cell::new(0);
        let run=|args:&[&str],_:bool,seconds:u64| {
            assert!((5..=7).contains(&seconds));
            if args[0]=="lsblk" { return out(&json!({"blockdevices":[disk("nvme99n1",Value::Null,json!(0))]}).to_string(),0); }
            assert!(published.get(),"basic information must precede optional commands");
            optional_calls.set(optional_calls.get()+1);
            Err(std::io::Error::new(std::io::ErrorKind::TimedOut,"fixture timeout"))
        };
        let d=collect_using(&run,&mut |d| {assert_eq!(d.len(),1);published.set(true);},&[]).unwrap();
        assert!(optional_calls.get()>=3);assert_eq!(d[0].model,"Test drive");assert_eq!(d[0].health_percent,None);
    }
    #[cfg(unix)]
    #[test] fn unsupported_smart_still_returns_sata_disk() {
        let run=|args:&[&str],_:bool,_:u64| {
            if args[0]=="lsblk" {out(&json!({"blockdevices":[disk("sdzz",json!("sata"),json!(0))]}).to_string(),0)}
            else {out("unsupported",2)}
        };
        let d=collect_using(&run,&mut |_| {},&[]).unwrap();assert_eq!(d.len(),1);assert_eq!(d[0].health_percent,None);
    }
    #[cfg(unix)]
    #[test] fn nvme_identity_and_smartctl_fallback_after_nvme_timeout() {
        let run=|args:&[&str],_:bool,_:u64| {
            match args[0] {
                "lsblk" => {
                    let mut disk=disk("nvme99n1",Value::Null,json!(0));disk["model"]=json!("");disk["serial"]=Value::Null;
                    out(&json!({"blockdevices":[disk]}).to_string(),0)
                },
                "udevadm" => out("",0),
                "nvme" if args[1]=="id-ctrl" => out(r#"{"mn":"Fallback model","sn":"FIXTURE","fr":"FW2"}"#,0),
                "nvme" => Err(std::io::Error::new(std::io::ErrorKind::TimedOut,"fixture timeout")),
                "smartctl" => out("Percentage Used: 5%\nTemperature: 32 Celsius\nPower On Hours: 45",8),
                _ => panic!("unexpected command"),
            }
        };
        let d=collect_using(&run,&mut |_| {},&[]).unwrap();
        assert_eq!(d[0].model,"Fallback model");assert_eq!(d[0].serial,"FIXTURE");
        assert_eq!(d[0].firmware,"FW2");assert_eq!(d[0].health_percent,Some(95));
        assert_eq!(d[0].power_on_hours,Some(45));
    }
    #[cfg(unix)]
    #[test] fn lsblk_timeout_returns_error() {
        let run=|_:&[&str],_:bool,_:u64| Err(std::io::Error::new(std::io::ErrorKind::TimedOut,"fixture timeout"));
        assert!(collect_using(&run,&mut |_| panic!("no discovery data"),&[]).is_err());
    }
    #[test] fn malformed_discovery_is_error_not_fake_disk() {
        assert!(parse_disks("not json",&[]).is_err());assert!(parse_disks("{}",&[]).is_err());
    }
}
