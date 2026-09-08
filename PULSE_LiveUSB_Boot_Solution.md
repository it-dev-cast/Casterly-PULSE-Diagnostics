# PULSE Auto-Launch — Live-Boot Ubuntu USB (Zero-Touch Laptop)

**Scenario:** Client requires zero pre-existing configuration on the target laptop — not even MDM, not even a one-time setting — and the laptops may be untrusted/unmanaged third-party machines. PULSE is bundled on a bootable Ubuntu USB.

---

## Why This Is a Different (and Workable) Problem

Everything proposed previously assumed PULSE runs *inside* whatever OS is already installed on the laptop. Under that assumption, "zero click + zero pre-existing config" is only achievable via USB keystroke injection (BadUSB-class hardware), which I won't implement — it's the same mechanism used in malicious USB drop attacks and directly violates "don't compromise system security."

Booting the laptop **from the pendrive itself** sidesteps that whole problem. The laptop's installed OS and disk are never touched, never trusted, and never even started — the laptop is used purely as hardware (CPU, RAM, screen, ports) to run an operating system that lives entirely on the USB stick. This is the standard architecture behind hardware diagnostic tools (MemTest86, PC-Doctor, OEM factory test USBs) and fits your refurbishment/intake use case well.

---

## Primary Method: Ubuntu Live-Boot USB, Kiosk Auto-Launch

### How it satisfies the constraints

| Constraint | How it's met |
|---|---|
| No software/config on the laptop, ever | Laptop's internal disk is never mounted or written to; OS runs entirely from the USB's read-only squashfs image |
| No manual intervention (click/browse) | GRUB boots with zero timeout straight into a kiosk session that auto-launches PULSE full-screen — no desktop, no file browser |
| Works on untrusted/unmanaged laptops | No admin credentials, no host trust relationship, no drivers required from the host — Ubuntu carries its own |
| Doesn't compromise laptop security posture | Nothing is installed, modified, or persisted on the laptop; image is read-only by construction |

### The one thing that genuinely can't be engineered away

At power-on, laptop firmware (UEFI/BIOS) decides what device to boot — normally the internal drive. Getting it to boot the USB instead requires either:

1. Pressing the OEM's one-time boot-menu key (F12 Dell, F9 HP, F2/Esc Lenovo, etc.) and selecting the drive, **or**
2. The firmware already trying USB before internal disk by default (common on some consumer laptops, not guaranteed).

This isn't a software gap — it's a deliberate firmware trust boundary, the direct analog of Windows disabling AutoRun: vendors added boot-device selection specifically so external media can't silently take control of a machine at power-on. It is a categorically smaller and different kind of "manual step" than clicking to run a program (it's "power on, pick boot device" — happens before any OS or PULSE UI even exists), but it can't be reduced to literally zero action while that boundary exists. Surface this explicitly with the client: the realistic floor is *insert USB → power on → (possibly) tap one boot-menu key*, not *insert USB → power on → done*.

If the client's own laptops are ones IT can set once to boot-from-USB-first, that last step disappears too — but that would itself be a one-time firmware config, which the client has ruled out for third-party machines.

---

## Implementation Steps

### 1. Build a custom Ubuntu live image with `live-build`

```bash
sudo apt install live-build
mkdir pulse-live && cd pulse-live
lb config --distribution jammy --archive-areas "main restricted universe multiverse"
```

### 2. Embed PULSE in the image

```bash
mkdir -p config/includes.chroot/opt/pulse
cp /path/to/PULSE config/includes.chroot/opt/pulse/PULSE
chmod +x config/includes.chroot/opt/pulse/PULSE
```

Add any runtime dependencies (Qt/GTK/Electron libs, etc.) to `config/package-lists/pulse.list.chroot`.

### 3. Configure auto-login (no username/password prompt)

```
# config/includes.chroot/etc/systemd/system/getty@tty1.service.d/autologin.conf
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin pulseuser --noclear %I $TERM
```

### 4. Auto-launch PULSE full-screen (kiosk pattern — no desktop environment needed)

```bash
# config/includes.chroot/home/pulseuser/.bash_profile
if [ -z "$DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
    exec startx
fi
```

```bash
# config/includes.chroot/home/pulseuser/.xinitrc
exec /opt/pulse/PULSE
```

Using a bare X session (no window manager, no panel) means there is nothing else on screen to click into — PULSE is the only reachable application.

### 5. Zero-timeout boot — skip the GRUB menu

```
set timeout=0
set default=0
```
(set via `lb config --bootappend-live` or directly in the generated `grub.cfg`)

### 6. Build and write the image

```bash
sudo lb build
sudo dd if=live-image-amd64.hybrid.iso of=/dev/sdX bs=4M status=progress conv=fsync
```

### 7. Confirm Secure Boot compatibility

Ubuntu's official build includes a Microsoft-signed shim (`EFI/BOOT/BOOTX64.EFI`), so the USB boots on stock UEFI Secure-Boot laptops **without** requiring Secure Boot to be disabled — important, since disabling it would itself count as "touching" the laptop.

### 8. Networking for result upload (if PULSE syncs to Supabase)

Enable `NetworkManager` in the image so Wi-Fi/Ethernet works out of the box; if sites use fixed Wi-Fi, pre-seed credentials via `/etc/NetworkManager/system-connections/` on the image (a config file baked into the USB, not the laptop).

---

## Fallback Methods

- **Firmware whitelists boot images by hash, not just Microsoft's key (rare, some enterprise fleets):** requires a one-time MOK (Machine Owner Key) enrollment on first boot — still never touches the laptop's OS/disk, just a firmware-level one-time acknowledgment.
- **OEM boot-menu key varies / unknown:** ship a quick-reference card or QR code with the fleet covering common vendors (F12/F9/F2/Esc) — a documentation fix, not a technical one.
- **USB boot disabled entirely in firmware:** no software-only fix exists. This is a hard floor — flag it to the client rather than trying to work around it (working around it would mean either firmware config, which they've excluded, or keystroke injection, which is the attack-tooling path already ruled out).
- **Need persisted logs/settings between sessions without touching the laptop:** use a `casper-rw` persistence partition on the USB itself, not the laptop's disk.

---

## Security Considerations

- **Read-only squashfs** — PULSE cannot modify the boot image itself; tamper-resistant by construction.
- **No host trust required** — the whole point of this design is that it works identically on a completely unknown, unmanaged laptop, because it never depends on that laptop's OS, credentials, or configuration.
- **Bypasses whatever security stack is installed on the laptop's normal OS** — booting external media means any EDR/DLP on the laptop's installed OS never starts, because that OS never starts. For refurbishment intake (laptops likely being wiped/reset anyway) this is typically a non-issue or even desirable; flag it explicitly if any target laptop is still in active use by an owner who'd want their normal OS/security stack respected.
- **Verify PULSE's integrity at boot** — have the live image checksum/hash-verify the PULSE binary against a known-good value before launch, and log the result, so tampering with a USB between deployments is detectable.
- **Physical possession implication** — this design assumes whoever is booting the USB has legitimate physical access to insert it and select the boot device; it's not intended for, and shouldn't be used for, running code on a laptop without the owner/operator's knowledge.

---

## Summary

This is the architecture that actually satisfies "cannot touch the laptop at all, not even once" as a literal constraint, because PULSE never runs inside the laptop's own OS — the laptop only supplies hardware. The one irreducible step is selecting the boot device at power-on, which is a firmware trust boundary that exists by design and can't be removed without either (a) prior firmware configuration, which the client has excluded, or (b) keystroke-injection hardware, which was already ruled out on security grounds.
