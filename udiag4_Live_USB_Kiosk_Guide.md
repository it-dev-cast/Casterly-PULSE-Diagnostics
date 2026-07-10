# udiag4 — Fully Automated Ubuntu Desktop Live-USB Kiosk

**Goal:** insert USB → F12 → Boot from USB → Ubuntu Desktop loads with no login screen and no setup wizard → `udiag4` launches automatically. No clicks, no typed commands, works offline.

**Tooling note up front:** you asked about preseed/kickstart — those automate an *installer* (Debian-installer/Ubiquity writing an OS to the laptop's disk), which doesn't apply here since this design never installs anything to the laptop. The correct mechanism for a live-boot-only kiosk is customizing the live squashfs image itself, via **Cubic** (GUI tool, builds from the official Ubuntu Desktop ISO — the right tool for a full-desktop respin) rather than `live-build` (lower-level, better suited to minimal/headless images) or preseed/kickstart (wrong tool for this use case entirely).

This supersedes the earlier "copy files onto a stock ISO" attempt — that failed because nothing was baked into the live filesystem. Everything below gets baked into the image itself, so no USB persistence partition is needed either.

---

## Part 1 — Build the Custom ISO with Cubic

### 1. Install Cubic

```bash
sudo apt-add-repository ppa:cubic-wizard/release -y
sudo apt update
sudo apt install cubic -y
```

### 2. Launch Cubic and point it at the official Ubuntu Desktop ISO

```bash
cubic
```

- Create a new project directory (e.g. `~/udiag4-live`).
- Select the official `ubuntu-24.04-desktop-amd64.iso` (or your target LTS) as the source ISO.
- Click through to the **chroot terminal** step — this drops you into a live shell *inside* the image filesystem. Every command below (steps 3–9) runs inside that chroot terminal.

### 3. Copy `udiag4` into the image

```bash
mkdir -p /opt/udiag4
cp /root/udiag4_files/udiag4 /opt/udiag4/udiag4   # Cubic exposes your host's project dir here
chmod +x /opt/udiag4/udiag4
```

(Cubic's chroot has network access at this stage too, so `apt install` any runtime dependencies `udiag4` needs.)

---

## Part 2 — No Login Screen (GDM Autologin)

### 4. Configure automatic login

```bash
nano /etc/gdm3/custom.conf
```

Under `[daemon]`:

```ini
[daemon]
AutomaticLoginEnable=true
AutomaticLogin=ubuntu
```

`ubuntu` is the default live-session username baked into the Desktop ISO — keep it unless you've created a different user in the image.

---

## Part 3 — No Setup Wizard / No Installer Prompts

### 5. Kill `gnome-initial-setup` (the first-login wizard — Livepatch, keyboard layout, Ubuntu One prompts, etc.)

The old trick of editing its autostart `.desktop` file stopped working in 22.04+ because it's now gated by a systemd unit. Use both of these together for reliability:

```bash
apt remove --purge gnome-initial-setup -y

mkdir -p /etc/skel/.config
printf yes | tee /etc/skel/.config/gnome-initial-setup-done > /dev/null

systemctl --global mask gnome-initial-setup-first-login.service
```

### 6. Remove the installer entirely

Two reasons: it can pop a "Try/Install Ubuntu" prompt on some releases, and — more importantly for a diagnostic tool — it removes the risk of a technician accidentally clicking "Install Ubuntu" and wiping the laptop's real OS.

```bash
apt remove --purge ubiquity ubiquity-frontend-gtk ubiquity-slideshow-ubuntu -y
rm -f /etc/xdg/autostart/ubiquity*.desktop
```

### 7. Silence update/notification popups

```bash
apt remove --purge update-notifier update-manager -y
```

---

## Part 4 — Auto-Launch udiag4

### 8. Autostart entry

```bash
mkdir -p /etc/skel/.config/autostart
cat > /etc/skel/.config/autostart/udiag4.desktop << 'EOF'
[Desktop Entry]
Type=Application
Name=udiag4
Exec=/opt/udiag4/udiag4
X-GNOME-Autostart-enable=true
EOF

# Also drop it directly into the live user's home, since the live
# session may already have /home/ubuntu populated rather than freshly
# copied from /etc/skel on every boot:
mkdir -p /home/ubuntu/.config/autostart
cp /etc/skel/.config/autostart/udiag4.desktop /home/ubuntu/.config/autostart/
chown -R ubuntu:ubuntu /home/ubuntu/.config
```

---

## Part 5 — Lock Down the Desktop for Robustness

Prevents screen lock / suspend / notification popups from ever interrupting `udiag4`, and makes sure these settings are baked into the image (system-wide dconf defaults survive in the squashfs; a live `gsettings set` alone would not).

### 9. System-wide dconf overrides

```bash
mkdir -p /etc/dconf/db/local.d /etc/dconf/db/local.d/locks

cat > /etc/dconf/db/local.d/00-udiag4-kiosk << 'EOF'
[org/gnome/desktop/screensaver]
lock-enabled=false
idle-activation-enabled=false

[org/gnome/desktop/session]
idle-delay=uint32 0

[org/gnome/settings-daemon/plugins/power]
sleep-inactive-ac-type='nothing'
sleep-inactive-battery-type='nothing'

[org/gnome/desktop/notifications]
show-banners=false
EOF

cat > /etc/dconf/db/local.d/locks/udiag4-lock << 'EOF'
/org/gnome/desktop/screensaver/lock-enabled
/org/gnome/desktop/session/idle-delay
EOF

dconf update
```

---

## Part 6 — Skip the GRUB Menu

### 10. Zero-timeout boot

In Cubic's **Options** tab (after exiting the chroot terminal), set:
- **Kernel Boot Parameters:** leave defaults, or add `quiet splash` to suppress boot-log text.
- **Boot menu display time:** `0` seconds.

Or manually, still inside the chroot, before generating:

```bash
sed -i 's/timeout=[0-9]*/timeout=0/' /boot/grub/grub.cfg
```

This means: boot menu never actually shows — the laptop goes straight from POST → GRUB default entry → kernel → GDM autologin → desktop → `udiag4`.

---

## Part 7 — Generate and Flash

### 11. Generate the ISO

Exit the chroot terminal in Cubic, click through **Generate** — Cubic rebuilds the squashfs and produces a new bootable `.iso` (e.g. `udiag4-live.iso`) with everything above baked in, including a valid Secure-Boot-signed shim inherited from the source Ubuntu ISO.

### 12. Flash to USB

```bash
sudo dd if=udiag4-live.iso of=/dev/sdX bs=4M status=progress conv=fsync
sync
```

Use `lsblk` first to confirm `/dev/sdX` is actually the USB drive, not your internal disk. On Windows, use Rufus in **"DD Image mode"** with the same ISO (no persistence partition needed this time — everything is already inside the image).

---

## Part 8 — Test

1. Insert the USB into the target laptop with **networking disconnected** (Wi-Fi off / Ethernet unplugged) to confirm the whole boot-to-launch sequence is genuinely offline-capable.
2. Power on, press the OEM boot-menu key (F12/F9/F2/Esc), select the USB drive.
3. Confirm: no GRUB menu wait, no GDM login prompt, no first-login wizard, no "Install Ubuntu" prompt, desktop appears and `udiag4` opens automatically within a few seconds — no clicks anywhere in that sequence.
4. Re-test with networking on, if `udiag4` itself needs it for syncing (separate from the boot mechanism, which doesn't need it).
5. Test on at least one machine per hardware model in the target fleet — GRUB/kernel boot behavior and the boot-menu key both vary by OEM, and this is worth confirming before wide rollout.
6. Re-test after a full power-off/power-on cycle (not just a warm reboot) to make sure autologin and autostart hold on true cold boot.

---

## Summary of What Changed vs. the Earlier Broken Attempt

| Problem before | Fix here |
|---|---|
| Files copied onto USB after flashing a stock ISO | Everything baked into the squashfs via Cubic chroot, before the ISO is generated |
| Desktop loaded with login prompt | GDM `AutomaticLoginEnable`/`AutomaticLogin` set in `/etc/gdm3/custom.conf` inside the image |
| First-login wizard could still appear | `gnome-initial-setup` purged + `/etc/skel` marker + systemd unit masked (the two-part fix required on 22.04+) |
| No persistence, so config didn't survive reboot | Not needed anymore — config lives in the read-only image itself, not a writable overlay |
| Risk of technician clicking "Install Ubuntu" | Ubiquity installer fully removed from the image |

Sources: [GNOME automatic login docs](https://help.gnome.org/system-admin-guide/login-automatic.html), [Cubic (GitHub)](https://github.com/PJ-Singh-001/Cubic), [disabling gnome-initial-setup on 22.04+](https://sleeplessbeastie.eu/2025/02/04/how-to-prevent-the-gnome-initial-setup-wizard/)
