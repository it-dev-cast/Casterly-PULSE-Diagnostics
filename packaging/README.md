# PULSE 4.0 — Image Packaging Notes

## Passwordless sudo for hardware collectors

The app's hardware collectors run a few privileged, read-only tools:

- `dmidecode` — system / BIOS / memory info
- `smartctl` — SATA SMART health
- `nvme` — NVMe SMART health

To avoid an interactive `sudo` password prompt during **System Scan**, the
bootable Ubuntu image grants passwordless sudo for *only those binaries* via a
sudoers drop-in. The app calls `sudo -n` (non-interactive), so:

- with the rule installed → the command runs with no prompt;
- without it → the command fails fast and the collector degrades gracefully
  (returns empty / "N/A") instead of hanging the scan.

### Install (on the Ubuntu image / Cubic chroot)

```bash
sudo cp packaging/sudoers.d/pulse-collectors /etc/sudoers.d/pulse-collectors
sudo chown root:root /etc/sudoers.d/pulse-collectors
sudo chmod 0440      /etc/sudoers.d/pulse-collectors
sudo visudo -cf      /etc/sudoers.d/pulse-collectors   # must report "parsed OK"
```

### Before installing

Edit `pulse-collectors` and replace `pulse` with the actual login username on
the bootable image (or use `%sudo` to grant the whole sudo group). Verify the
binary paths match the image (`which dmidecode smartctl nvme`); both `/usr/sbin`
and `/usr/bin` locations are already listed.

### Security note

This grants NOPASSWD for three specific read-only diagnostic commands only — not
blanket root access — which is the recommended approach over embedding a sudo
password in the application binary.
