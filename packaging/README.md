# PULSE 4.0 — Image Packaging Notes

## Branded silent boot (no Ubuntu splash)

Goal: from the moment the target laptop powers on from this USB, the
technician should only ever see the Casterly logo, then Pulse — never a GRUB
menu, the Ubuntu logo/Plymouth splash, or a GNOME desktop/login screen.

`install.sh` now automates everything that lives *inside* the chroot:

- **Plymouth theme** (`plymouth/casterly/`) — replaces the stock Ubuntu logo
  splash with the Casterly Pulse logo (composited onto a white rounded plate,
  the same treatment the app's own header uses) centered on the app's dark
  navy (`#0a1626`). Installed via `plymouth-set-default-theme -R casterly`,
  which also rebuilds the initramfs so the new theme actually ships in the
  boot image (skipping `-R` would leave the old Ubuntu theme baked into
  initramfs even though the theme is "installed").
- **GRUB** — `/etc/default/grub` is set to `GRUB_TIMEOUT=0`,
  `GRUB_TIMEOUT_STYLE=hidden`, and a `quiet splash loglevel=0
  vt.global_cursor_default=0` kernel cmdline, then `update-grub` regenerates
  the config. This is the boot menu for the *installed* system on the
  squashfs; combined with a 0 timeout it never has a chance to render.
- **Desktop/login flash** — GNOME's wallpaper and the GDM greeter background
  are both forced to a solid navy matching the Plymouth background via dconf
  overrides, and the GDM greeter logo is swapped to the Casterly mark. This
  closes the visual gap between "Plymouth splash ends" and "Pulse's window
  covers the screen" (auto-login skips the actual login prompt, but GDM still
  briefly initializes its own background before handing off).

### What you must still do manually, inside Cubic

The pieces above only touch the installed-system config baked into the
squashfs (`chroot`). The **very first thing** a live Ubuntu Desktop ISO shows
— the outer boot menu with "Try or Install Ubuntu" / "OEM install" / "Boot
from next volume" entries — comes from `boot/grub/grub.cfg` (and
`isolinux/*.cfg` on hybrid images) at the top level of the ISO itself, which
sits *outside* the chroot Cubic drops you into for the Terminal step. Editing
it has to happen from Cubic's own project view (its file browser / "Options"
step, before you generate the ISO), not from `install.sh`:

1. Open the ISO's `boot/grub/grub.cfg` (and `isolinux/txt.cfg` if present) in
   Cubic's editor.
2. Set `set timeout=0` (and `set timeout_style=hidden` if the grub version
   supports it) so the menu never has a chance to draw.
3. Point the default entry at the normal live-boot option (the one that
   ordinarily auto-selects after the timeout) rather than "Try Ubuntu without
   installing" if they differ, so a stray keypress can't land on OEM install.
4. Regenerate/rebuild the ISO from Cubic as usual.

### Testing before flashing real hardware

Boot the generated ISO in a VM (QEMU/VirtualBox) first and watch the full
sequence end to end — power-on → Casterly splash → straight into Pulse, no
Ubuntu branding, no visible desktop. It's much faster to catch a missed
`update-grub` or a dconf typo in a VM snapshot than by re-flashing a physical
USB each time.

### Regenerating the splash logo

`plymouth/casterly/logo.png` is `src/assets/pulse_logo.png` (the same lockup
used in the app's header) composited onto a white rounded-rect plate with a
transparent surround, so it drops onto the dark splash without a hard
rectangular seam. Regenerate it if the logo ever changes:

```python
from PIL import Image, ImageDraw
logo = Image.open("src/assets/pulse_logo.png").convert("RGBA")
pad_x, pad_y, radius = 90, 70, 36
plate = Image.new("RGBA", (logo.width + pad_x*2, logo.height + pad_y*2), (0,0,0,0))
mask = Image.new("L", plate.size, 0)
ImageDraw.Draw(mask).rounded_rectangle([0,0,plate.width-1,plate.height-1], radius=radius, fill=255)
plate.paste(Image.new("RGBA", plate.size, (255,255,255,255)), (0,0), mask)
plate.paste(logo, (pad_x, pad_y), logo)
plate.save("packaging/plymouth/casterly/logo.png")
```

## Passwordless sudo for hardware collectors

The app's hardware collectors run a few privileged, read-only tools:

- `dmidecode` — system / BIOS / memory info
- `smartctl` — SATA SMART health
- `nvme` — NVMe SMART health

To avoid an interactive `sudo` password prompt during **System Scan** — which
would otherwise hang the collector or spawn a polkit dialog that could get
stranded behind the app's always-on-top kiosk window — the bootable Ubuntu
image grants passwordless sudo for *only those three binaries* via a sudoers
drop-in. The app calls `sudo -n` (non-interactive) for these, so:

- with the rule installed → the command runs with no prompt;
- without it → the command fails fast and the collector degrades gracefully
  (returns empty / "N/A") instead of hanging the scan.

## Power-off button

The header's power-off button no longer touches `sudo` at all in the normal
case. Powering off is a `systemd-logind` action ("power-off"), and logind's
default polkit policy grants that to whichever user has the active local
session with **no authentication required** — the same reason a normal
desktop user can click "Power Off" in the system menu, or press the physical
power button, without being asked for a password. `power.rs` calls
`systemctl poweroff` directly as the kiosk user, so on a standard Ubuntu
image this just works with no prompt of any kind.

If `systemctl poweroff` is refused (e.g. an image whose polkit policy has
been locked down, or a headless/non-seat session where `allow_active`
doesn't apply), `power.rs` falls back to `sudo -S`, piping the login user's
known account password (`"a"`, hardcoded — this image is a single-purpose
kiosk with a fixed, non-secret local account). If the bootable image's
account password is ever changed from `a`, update `SUDO_PASSWORD` in
`src-tauri/src/power.rs` to match, or that fallback will fail with the same
"a password is required" error. This fallback path should rarely run in
practice.

The `PULSE_POWER` sudoers rule below is still included for that fallback and
doesn't hurt to install (if present, `sudo -S` just ignores the piped
password and runs NOPASSWD instead), but it isn't required for either path
to work.

If the button *still* prompts for a password after rebuilding with this
change, it means `systemctl poweroff` is being refused on that image — check
`polkit` / `logind` config (`loginctl show-session <id> -p Active -p
Remote` should show `Active=yes` and `Remote=no`; a remote/inactive session
is the most common reason `allow_active` doesn't kick in).

### Install (on the Ubuntu image / Cubic chroot)

`install.sh` now copies, chowns, chmods, and `visudo -cf` validates this file
automatically — no manual step needed for a normal build. The commands below
are only for installing it by hand instead:

```bash
sudo cp packaging/sudoers.d/pulse-collectors /etc/sudoers.d/pulse-collectors
sudo chown root:root /etc/sudoers.d/pulse-collectors
sudo chmod 0440      /etc/sudoers.d/pulse-collectors
sudo visudo -cf      /etc/sudoers.d/pulse-collectors   # must report "parsed OK"
```

### Before installing

The file already grants to `ubuntu`, matching `AUTOLOGIN_USER` in `install.sh`
and `User=` in `casterly-pulse.service`. If you ever rename that account,
update all three in lockstep (or switch the rule to `%sudo` to grant the
whole sudo group instead of one named user). Verify the binary paths match
the image (`which dmidecode smartctl nvme shutdown`); both `/usr/sbin` and
`/usr/bin` (and, for `shutdown`, `/sbin`/`/bin` too) locations are already
listed.

### Security note

This grants NOPASSWD for three specific read-only diagnostic commands only —
not blanket root access. The power-off button is handled separately (see
above): it embeds the account password rather than relying on this file,
which is a deliberate tradeoff for this specific single-purpose kiosk device
and would not be appropriate on a general-purpose or multi-user machine.
