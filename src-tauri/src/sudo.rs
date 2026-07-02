use std::process::{Command, Output};

// Privileged hardware collectors (dmidecode, smartctl, nvme) require root.
// Rather than embedding a password, the bootable Ubuntu image grants passwordless
// sudo (NOPASSWD) for exactly those binaries via /etc/sudoers.d/pulse-collectors
// (see packaging/sudoers.d/pulse-collectors). We invoke sudo non-interactively
// (`sudo -n`) so it never blocks on a password prompt: if the NOPASSWD rule is in
// place the command runs, otherwise it fails fast and the collector degrades
// gracefully (returns None / empty) instead of hanging.
pub fn output(args: &[&str]) -> std::io::Result<Output> {
    Command::new("sudo").arg("-n").args(args).output()
}
