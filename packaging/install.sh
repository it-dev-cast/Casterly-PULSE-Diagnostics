#!/usr/bin/env bash
#
# Casterly Pulse USB V4 -- ISO install script (PRD section 16, "USB Build &
# Deployment"). This turns the manual steps in the PRD into a single
# repeatable script.
#
# Run this INSIDE the Cubic "Customize" chroot terminal, after copying the
# build artifacts into the chroot's filesystem (via Cubic's file copy feature,
# or plain `cp -r` if you have a shell into the chroot).
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
#   4. Configures GDM3 auto-login for the "ubuntu" user.
#
# Auto-login (step 4) + the auto-launching service (step 3) together are what
# make "insert the pen drive" (i.e. boot the target machine from this USB)
# result in Pulse opening automatically with zero technician interaction.
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

echo "==> Done. Casterly Pulse will auto-launch on the next graphical login."
echo "    (Note: on a live/dd'd ISO without a persistence partition, anything"
echo "    written to ${INSTALL_DIR} at runtime -- udiag.db, exports/ -- will"
echo "    not survive a reboot unless the ISO build sets up persistent"
echo "    storage for that path.)"
