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

/// Storage-only deadline. GNU timeout owns the process group (including sudo)
/// and escalates TERM to KILL after one second. Never retry without a deadline.
/// Existing non-storage collectors retain their original execution path.
pub fn storage_output(args: &[&str], privileged: bool, seconds: u64) -> std::io::Result<Output> {
    if args.is_empty() || seconds == 0 {
        return Err(std::io::Error::new(std::io::ErrorKind::InvalidInput, "invalid storage command"));
    }
    let mut command = Command::new("timeout");
    command.args(["--signal=TERM", "--kill-after=1s", &format!("{}s", seconds)]);
    if privileged { command.args(["sudo", "-n"]); }
    let output = command.args(args).env("LC_ALL", "C").output()?;
    match output.status.code() {
        Some(124) | Some(137) => {
            eprintln!("[PULSE][Storage] {} timed out", args[0]);
            Err(std::io::Error::new(std::io::ErrorKind::TimedOut, "storage command timed out"))
        }
        _ => {
            if !output.status.success() {
                eprintln!("[PULSE][Storage] {} exit={:?}", args[0], output.status.code());
            }
            Ok(output)
        }
    }
}

#[cfg(all(test, unix))]
mod storage_timeout_tests {
    #[test]
    fn terminates_stalled_command() {
        let start = std::time::Instant::now();
        let error = super::storage_output(&["sleep", "10"], false, 1).unwrap_err();
        assert_eq!(error.kind(), std::io::ErrorKind::TimedOut);
        assert!(start.elapsed().as_secs() < 4);
    }
}
