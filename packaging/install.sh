#!/usr/bin/env bash
#
# Casterly Pulse USB V4 -- ISO install script (PRD section 16, "USB Build &
# Deployment"). This turns the manual steps in the PRD into a single
# repeatable script.
#
# Run this INSIDE the Cubic "Customize" chroot terminal, after copying the
# build artifacts into the chroot's filesystem (via Cubic's file copy feature,
# or plain `cp -r` if you have a shell into the chroot). This whole
# packaging/ directory (install.sh + casterly-pulse.service + plymouth/)
# should be copied in as one unit -- the plymouth/casterly/ theme files are
# read from alongside this script (see SCRIPT_DIR below), not from SOURCE_DIR.
#
# Expects, at $SOURCE_DIR (default: /root/casterly-pulse-build):
#   udiag4                     -- built on the host with:
#                                   npm install && npm run tauri build
#                                 produces src-tauri/target/release/udiag4
#                                 (must be built on Linux -- a Windows/WSL
#                                 build produces udiag4.exe, which will not
#                                 run inside this Ubuntu image)
#   resources/audio/speaker_test.wav
#                              -- from src-tauri/resources/audio/speaker_test.wav.
#                                 This exact "resources/audio/" layout must be
#                                 preserved next to the binary: audio.rs's
#                                 resolve_speaker_test_wav() looks for it at
#                                 <exe_dir>/resources/audio/speaker_test.wav
#                                 (see SPEAKER_WAV_RELATIVE in src-tauri/src/audio.rs).
#
# The built frontend (dist/) does NOT need to be copied separately -- Tauri
# embeds it into the compiled binary at build time, so udiag4 is otherwise
# self-contained.
#
# What this script does:
#   1. Installs the runtime packages the hardware/diagnostics collectors and
#      audio/webcam tests shell out to.
#   2. Copies the app into /opt/casterly/pulse/.
#   3. Installs + enables casterly-pulse.service (see casterly-pulse.service
#      in this same directory) so the app auto-launches on graphical login.
#   4. Installs the passwordless-sudo rule (sudoers.d/pulse-collectors) so the
#      hardware collectors and power-off button never hit an interactive
#      password/polkit prompt stranded behind the kiosk window.
#   5. Installs a Casterly-branded Plymouth boot theme (plymouth/casterly/) in
#      place of the stock Ubuntu logo, and rebuilds the initramfs to use it.
#   6. Sets GRUB_TIMEOUT=0 / hidden + a quiet kernel cmdline so the installed
#      system's own boot menu never flashes on screen.
#   7. Blanks the GNOME/GDM wallpaper to solid navy so there's no desktop or
#      login-screen flash in the gap between login and Pulse's window
#      appearing.
#   8. Configures GDM3 auto-login for the "ubuntu" user.
#
# Auto-login (step 8) + the auto-launching service (step 3) together are what
# make "insert the pen drive" (i.e. boot the target machine from this USB)
# result in Pulse opening automatically with zero technician interaction.
# Steps 5-7 are what make everything *before* that -- GRUB, Plymouth, the
# login screen -- show Casterly branding (or nothing) instead of Ubuntu's.
#
# IMPORTANT: steps 4-6 only cover the installed-system configuration baked
# into the squashfs. The ISO's own outer live-boot menu (the "Try/Install
# Ubuntu" screen from boot/grub/grub.cfg at the top of the ISO, outside this
# chroot) must still be hidden manually inside Cubic itself -- see
# packaging/README.md, "Branded silent boot".
#
# Run as root -- you already are, inside the Cubic chroot.

set -euo pipefail

SOURCE_DIR="${SOURCE_DIR:-/root/casterly-pulse-build}"
INSTALL_DIR=/opt/casterly/pulse
SERVICE_NAME=casterly-pulse.service
AUTOLOGIN_USER=ubuntu
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -f "${SOURCE_DIR}/udiag4" ]; then
  echo "ERROR: ${SOURCE_DIR}/udiag4 not found." >&2
  echo "Build it on Linux first with: npm install && npm run tauri build" >&2
  echo "Then copy udiag4 and resources/audio/speaker_test.wav into ${SOURCE_DIR}" >&2
  echo "(override the location with SOURCE_DIR=/some/path $0)" >&2
  exit 1
fi

if [ ! -f "${SOURCE_DIR}/resources/audio/speaker_test.wav" ]; then
  echo "ERROR: ${SOURCE_DIR}/resources/audio/speaker_test.wav not found." >&2
  echo "Copy it from src-tauri/resources/audio/speaker_test.wav, preserving the" >&2
  echo "resources/audio/ folder structure." >&2
  exit 1
fi

echo "==> Installing runtime dependencies"
apt-get update
apt-get install -y \
  v4l-utils ffmpeg smartmontools nvme-cli lshw dmidecode \
  usbutils pciutils bluetooth bluez

echo "==> Installing application to ${INSTALL_DIR}"
mkdir -p "${INSTALL_DIR}/resources/audio"
cp "${SOURCE_DIR}/udiag4" "${INSTALL_DIR}/udiag4"
chmod +x "${INSTALL_DIR}/udiag4"
cp "${SOURCE_DIR}/resources/audio/speaker_test.wav" "${INSTALL_DIR}/resources/audio/speaker_test.wav"

echo "==> Installing systemd service"
cp "${SCRIPT_DIR}/casterly-pulse.service" "/etc/systemd/system/${SERVICE_NAME}"
systemctl enable "${SERVICE_NAME}"

echo "==> Installing passwordless sudo rule for hardware collectors + power-off"
cp "${SCRIPT_DIR}/sudoers.d/pulse-collectors" /etc/sudoers.d/pulse-collectors
chown root:root /etc/sudoers.d/pulse-collectors
chmod 0440 /etc/sudoers.d/pulse-collectors
visudo -cf /etc/sudoers.d/pulse-collectors

echo "==> Installing Casterly boot splash (replaces the stock Ubuntu Plymouth theme)"
PLYMOUTH_THEME_DIR=/usr/share/plymouth/themes/casterly
mkdir -p "${PLYMOUTH_THEME_DIR}"
cp "${SCRIPT_DIR}/plymouth/casterly/casterly.plymouth" "${PLYMOUTH_THEME_DIR}/"
cp "${SCRIPT_DIR}/plymouth/casterly/casterly.script" "${PLYMOUTH_THEME_DIR}/"
cp "${SCRIPT_DIR}/plymouth/casterly/logo.png" "${PLYMOUTH_THEME_DIR}/"
# -R rebuilds the initramfs with the new theme baked in; without it the
# theme is registered but the boot-time initramfs still ships the old one.
if command -v plymouth-set-default-theme >/dev/null 2>&1; then
  plymouth-set-default-theme -R casterly
else
  echo "WARNING: plymouth-set-default-theme not found -- install the 'plymouth' and" >&2
  echo "         'plymouth-themes' packages, then re-run: plymouth-set-default-theme -R casterly" >&2
fi

echo "==> Silencing the GRUB boot menu (quiet, hidden timeout, no cursor blink)"
GRUB_DEFAULT_FILE=/etc/default/grub
if [ -f "${GRUB_DEFAULT_FILE}" ]; then
  cp "${GRUB_DEFAULT_FILE}" "${GRUB_DEFAULT_FILE}.pre-casterly.bak"
  sed -i 's/^GRUB_TIMEOUT=.*/GRUB_TIMEOUT=0/' "${GRUB_DEFAULT_FILE}"
  if grep -q '^GRUB_TIMEOUT_STYLE=' "${GRUB_DEFAULT_FILE}"; then
    sed -i 's/^GRUB_TIMEOUT_STYLE=.*/GRUB_TIMEOUT_STYLE=hidden/' "${GRUB_DEFAULT_FILE}"
  else
    echo 'GRUB_TIMEOUT_STYLE=hidden' >> "${GRUB_DEFAULT_FILE}"
  fi
  sed -i 's/^GRUB_CMDLINE_LINUX_DEFAULT=.*/GRUB_CMDLINE_LINUX_DEFAULT="quiet splash loglevel=0 vt.global_cursor_default=0"/' "${GRUB_DEFAULT_FILE}"
  update-grub
else
  echo "WARNING: ${GRUB_DEFAULT_FILE} not found -- set GRUB_TIMEOUT=0, GRUB_TIMEOUT_STYLE=hidden" >&2
  echo "         and GRUB_CMDLINE_LINUX_DEFAULT=\"quiet splash loglevel=0 vt.global_cursor_default=0\" manually, then run update-grub." >&2
fi
# NOTE: this only silences the *installed-system* grub config baked into the
# squashfs. The outer live-boot menu (the "Try/Install Ubuntu" screen defined
# in the ISO's own boot/grub/grub.cfg) lives outside this chroot and cannot be
# edited from here -- see packaging/README.md "Branded silent boot" for the
# manual step to do inside Cubic's own UI before generating the ISO.

echo "==> Suppressing the desktop flash between login and Pulse launching"
mkdir -p /etc/dconf/profile
cat > /etc/dconf/profile/user <<'EOF'
user-db:user
system-db:local
EOF
mkdir -p /etc/dconf/db/local.d
cat > /etc/dconf/db/local.d/00-casterly-kiosk <<'EOF'
[org/gnome/desktop/background]
picture-uri=''
picture-uri-dark=''
primary-color='#0a1626'
secondary-color='#0a1626'
color-shading-type='solid'

[org/gnome/desktop/screensaver]
picture-uri=''
primary-color='#0a1626'
secondary-color='#0a1626'
color-shading-type='solid'
EOF
dconf update
# GDM's own greeter background/logo (path may vary slightly by Ubuntu
# release -- verify with `dpkg -L gdm3 | grep dconf` on the build image).
mkdir -p /etc/gdm3
cat > /etc/gdm3/greeter.dconf-defaults <<'EOF'
[org/gnome/login-screen]
logo='/opt/casterly/pulse/resources/casterly_logo.png'

[org/gnome/desktop/background]
picture-uri=''
primary-color='#0a1626'
secondary-color='#0a1626'
color-shading-type='solid'
EOF
mkdir -p "${INSTALL_DIR}/resources"
cp "${SCRIPT_DIR}/plymouth/casterly/logo.png" "${INSTALL_DIR}/resources/casterly_logo.png"

echo "==> Configuring GDM3 auto-login for user '${AUTOLOGIN_USER}'"
GDM_CONF=/etc/gdm3/custom.conf
if [ -f "${GDM_CONF}" ]; then
  if ! grep -q "^AutomaticLoginEnable" "${GDM_CONF}"; then
    sed -i "/^\[daemon\]/a AutomaticLoginEnable = true\nAutomaticLogin = ${AUTOLOGIN_USER}" "${GDM_CONF}"
  else
    sed -i "s/^AutomaticLoginEnable.*/AutomaticLoginEnable = true/" "${GDM_CONF}"
    sed -i "s/^AutomaticLogin *=.*/AutomaticLogin = ${AUTOLOGIN_USER}/" "${GDM_CONF}"
  fi
else
  echo "WARNING: ${GDM_CONF} not found -- add these lines under [daemon] manually:"
  echo "  AutomaticLoginEnable = true"
  echo "  AutomaticLogin = ${AUTOLOGIN_USER}"
fi

echo "==> Done. Casterly Pulse will auto-launch on the next graphical login,"
echo "    with the Casterly splash shown in place of the Ubuntu boot logo."
echo "    (Note: on a live/dd'd ISO without a persistence partition, anything"
echo "    written to ${INSTALL_DIR} at runtime -- udiag.db, exports/ -- will"
echo "    not survive a reboot unless the ISO build sets up persistent"
echo "    storage for that path.)"
echo "    REMINDER: hide the ISO's own outer boot menu inside Cubic before"
echo "    generating the ISO -- see packaging/README.md, 'Branded silent boot'."
