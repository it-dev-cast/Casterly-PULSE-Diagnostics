# PULSE USB Auto-Launch — Solution Design

**Prepared for:** Implementation team
**Author:** Technical Solutions Architecture
**Scope:** Auto-execute `PULSE.exe` from a designated USB pendrive on insertion, Windows 10/11 primary, macOS/Linux optional.

---

## 1. Reality Check Before Designing

Before proposing an architecture, one constraint in the brief needs to be corrected, because it changes the whole design: **`autorun.inf`-based silent execution of a `.exe` from a USB flash drive does not work on Windows 10/11, and hasn't since ~2011.**

Microsoft removed the "Install or run program" option from the AutoPlay dialog for USB mass-storage devices specifically to stop the autorun-worm class of malware (Conficker, Stuxnet's original vector, etc.). This is enforced at the OS level for *removable* drives — it is not a policy you can toggle back on with a registry edit, and it applies whether or not the machine is domain-joined. `autorun.inf` still has a narrow, legitimate use (setting a custom icon/label), but the `[autorun] open=` / `shellexecute=` directives are ignored for USB storage.

Practical consequence: **there is no way to get a genuinely zero-click launch on a "clean" Windows 10/11 laptop with nothing pre-configured on it.** Something has to already be listening on the laptop for the USB insertion event. The good news is that "something" can be built entirely from components already built into Windows (Task Scheduler + PowerShell) — no third-party installer, no background service, no MSI. That satisfies the spirit of "no additional software" even though it requires a one-time, ~2-minute provisioning step per laptop.

This document proposes that as the primary architecture (Tier 1), and documents the legacy `autorun.inf` approach as a secondary/legacy option (Tier 2) with its real, limited effect.

---

## 2. Recommended Architecture (Tier 1): Event-Driven Scheduled Task

**How it works:**

1. Windows logs a Plug-and-Play event (`Microsoft-Windows-DriverFrameworks-UserMode`, Event ID `2003`) every time a USB storage device is connected.
2. A Task Scheduler task, provisioned once per laptop, is triggered by that event.
3. The task runs a small PowerShell watcher script that:
   - Enumerates newly attached removable volumes.
   - Confirms the volume is the genuine PULSE drive (checked two ways — label *and* a hidden marker file, see §5 Security).
   - Launches `PULSE.exe` from that drive in the logged-in user's context.
4. Nothing runs as SYSTEM, nothing listens in the background consuming resources — the trigger is purely event-driven (native OS eventing, zero polling).

```
USB inserted → PnP event 2003 logged → Task Scheduler trigger fires
   → PowerShell script validates drive → launches PULSE.exe
```

### 2.1 Step 1 — Enable the required event log

Disabled by default; enable once per machine.

```powershell
# Run as Administrator
wevtutil sl Microsoft-Windows-DriverFrameworks-UserMode/Operational /e:true
```

### 2.2 Step 2 — Deploy the watcher script

Save to a stable local path, e.g. `C:\ProgramData\Pulse\Watch-PulseUsb.ps1`.

```powershell
# Watch-PulseUsb.ps1
# Fires from Task Scheduler on USB PnP arrival (Event 2003).
# Validates the inserted drive is the genuine PULSE pendrive, then launches PULSE.exe.

$ExpectedLabel   = "PULSE"
$MarkerFileName  = ".pulse_id"                       # hidden marker file at drive root
$ExpectedMarker  = "8f2c1e2a-6b7a-4b9c-9a10-PULSE01"  # unique token written to the marker file
$ExeRelativePath = "PULSE.exe"                        # location of the exe on the drive
$LogPath         = "$env:ProgramData\Pulse\launch.log"

function Write-Log($msg) {
    "$(Get-Date -Format s)  $msg" | Out-File -FilePath $LogPath -Append -Encoding utf8
}

# Only look at removable drives (DriveType 2)
$removable = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=2"

foreach ($drive in $removable) {
    $root       = $drive.DeviceID + "\"
    $markerPath = Join-Path $root $MarkerFileName
    $exePath    = Join-Path $root $ExeRelativePath

    if ($drive.VolumeName -ne $ExpectedLabel) { continue }
    if (-not (Test-Path $markerPath))          { continue }

    $marker = Get-Content $markerPath -Raw -ErrorAction SilentlyContinue
    if ($marker.Trim() -ne $ExpectedMarker) {
        Write-Log "REJECTED: $root has label '$ExpectedLabel' but marker mismatch. Possible spoofed drive."
        continue
    }

    if (-not (Test-Path $exePath)) {
        Write-Log "REJECTED: marker matched but $exePath not found."
        continue
    }

    # Optional but recommended: verify Authenticode signature before executing
    $sig = Get-AuthenticodeSignature $exePath
    if ($sig.Status -ne 'Valid') {
        Write-Log "REJECTED: $exePath signature status = $($sig.Status). Refusing to launch."
        continue
    }

    Write-Log "LAUNCHING: $exePath"
    Start-Process -FilePath $exePath -WorkingDirectory $root
    break
}
```

### 2.3 Step 3 — Create the Scheduled Task

Use an XML definition so it's reproducible across machines via a deployment script (Intune, GPO, SCCM, or manual `schtasks /create`).

```xml
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>
    <EventTrigger>
      <Enabled>true</Enabled>
      <Subscription>
        &lt;QueryList&gt;&lt;Query Id="0" Path="Microsoft-Windows-DriverFrameworks-UserMode/Operational"&gt;
        &lt;Select Path="Microsoft-Windows-DriverFrameworks-UserMode/Operational"&gt;*[System[(EventID=2003)]]&lt;/Select&gt;
        &lt;/Query&gt;&lt;/QueryList&gt;
      </Subscription>
    </EventTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <StartWhenAvailable>true</StartWhenAvailable>
    <ExecutionTimeLimit>PT1M</ExecutionTimeLimit>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>powershell.exe</Command>
      <Arguments>-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\ProgramData\Pulse\Watch-PulseUsb.ps1"</Arguments>
    </Exec>
  </Actions>
</Task>
```

Import it:

```powershell
schtasks /Create /TN "PULSE-USB-AutoLaunch" /XML "C:\ProgramData\Pulse\PulseAutoLaunch.xml" /F
```

Key choices explained:
- `LogonType = InteractiveToken`, `RunLevel = LeastPrivilege` — the task runs as the logged-in user, not SYSTEM, so `PULSE.exe` opens with the same permissions a user double-clicking it would have. This avoids privilege-escalation risk and avoids the app silently running with no visible window under a service account.
- `MultipleInstancesPolicy = IgnoreNew` — prevents a second launch if two PnP events fire in quick succession (common — USB enumeration often logs the event twice).
- `ExecutionTimeLimit = PT1M` — the watcher script should finish in well under a minute; this is a safety cap, not a normal-case limit.

### 2.4 One-time provisioning package

Bundle steps 2.1–2.3 into a single provisioning script IT can run once per laptop (or push via Intune/GPO as a startup script):

```powershell
# Provision-PulseAutoLaunch.ps1  (run once as Administrator)
New-Item -Path "C:\ProgramData\Pulse" -ItemType Directory -Force | Out-Null
Copy-Item ".\Watch-PulseUsb.ps1" "C:\ProgramData\Pulse\Watch-PulseUsb.ps1" -Force
wevtutil sl Microsoft-Windows-DriverFrameworks-UserMode/Operational /e:true
schtasks /Create /TN "PULSE-USB-AutoLaunch" /XML ".\PulseAutoLaunch.xml" /F
Write-Host "PULSE USB auto-launch provisioned."
```

---

## 3. Secondary Option (Tier 2): AutoPlay + `autorun.inf` — Legacy / Limited

Include this only if the client's fleet is centrally managed and AutoPlay for removable drives has already been re-enabled via Group Policy, or for older/locked-down kiosk-style Windows builds. On an out-of-box consumer Windows 10/11 laptop, **this will not produce a zero-click launch** — at best it surfaces an AutoPlay balloon the user must click.

`autorun.inf` at the root of the PULSE drive:

```ini
[autorun]
label=PULSE
icon=PULSE.exe,0
action=Run PULSE Diagnostic Tool
open=PULSE.exe
UseAutoPlay=1
```

To make Windows *remember* a one-time user choice ("Always do this for this device") so subsequent insertions skip the dialog, the user's first-ever click is stored in `HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\AutoplayHandlers\UserChosenExecuteHandlers`, keyed to the drive's volume GUID. This still requires:
- AutoPlay enabled (`NoDriveTypeAutoRun` policy not blocking removable drives), and
- One manual click, once, per laptop.

Given the client's explicit requirement of *no manual intervention, ever*, Tier 2 does not meet the bar and is documented here only for completeness / fallback discussion.

---

## 4. macOS / Linux (Optional Extension)

**macOS** — `launchd` LaunchAgent watching `/Volumes` via `diskutil activity` or a `WatchPaths` key:

```xml
<!-- ~/Library/LaunchAgents/com.client.pulse.watcher.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
  <key>Label</key><string>com.client.pulse.watcher</string>
  <key>ProgramArguments</key>
  <array><string>/usr/local/bin/pulse_watch.sh</string></array>
  <key>WatchPaths</key><array><string>/Volumes</string></array>
  <key>RunAtLoad</key><true/>
</dict></plist>
```

`pulse_watch.sh` checks `/Volumes/PULSE/.pulse_id` the same way as the Windows script, then `open /Volumes/PULSE/PULSE.app`.

**Linux** — a `udev` rule matching the drive's VID/PID, calling a validation script via `systemd-run`:

```
# /etc/udev/rules.d/99-pulse.rules
ACTION=="add", SUBSYSTEM=="block", ENV{ID_FS_LABEL}=="PULSE", RUN+="/usr/local/bin/pulse-launch.sh"
```

Both are optional per the brief ("optionally macOS/Linux") and follow the identical validate-then-launch pattern as Tier 1.

---

## 5. Security Considerations & Mitigations

| Risk | Mitigation |
|---|---|
| Attacker relabels a malicious USB drive "PULSE" to trigger auto-execution | Script checks label **and** a hidden marker file containing a secret token, **and** an Authenticode signature check on the exe before launch. All three must pass. |
| Malicious `PULSE.exe` swapped onto a legitimate-looking drive | Authenticode signature validation (`Get-AuthenticodeSignature`) rejects unsigned/tampered binaries. Optionally pin the exact certificate thumbprint or a SHA-256 hash allow-list instead of just "Valid" status. |
| Task runs with elevated privileges, widening blast radius | Task configured with `LeastPrivilege` / `InteractiveToken` — runs as the current user, same as manual double-click. Never run this as SYSTEM. |
| Endpoint security software flags the scheduled task or PowerShell execution as suspicious (this pattern resembles known malware TTPs) | Pre-clear with the client's EDR/AV team; sign the watcher script; add to allow-list; document the task clearly in change management so a SOC analyst doesn't treat it as an incident. |
| `-ExecutionPolicy Bypass` weakens PowerShell script-execution controls system-wide | Scope is limited to this single task invocation, not a system-wide policy change (`Bypass` is a process-level flag here, not `Set-ExecutionPolicy`). Alternatively, sign `Watch-PulseUsb.ps1` and use `-ExecutionPolicy AllSigned`. |
| USB drive stolen/cloned — marker token extracted and copied to another drive | Marker token alone is not sufficient defense (it's static); the exe signature check is the real backstop. For higher assurance, consider a per-device challenge (e.g., token tied to the drive's hardware serial via `Win32_DiskDrive.SerialNumber`, checked in the script) instead of a static string. |
| SmartScreen prompts on first run of `PULSE.exe` from removable media | Use an EV or standard code-signing certificate with enough reputation built up, or pre-seed SmartScreen exclusion via policy on managed fleets. |
| Task Scheduler event trigger fires twice for one insertion (known Windows PnP quirk) | `MultipleInstancesPolicy=IgnoreNew` plus a short in-script debounce (e.g., skip if `PULSE.exe` already running) prevents double-launch. |

---

## 6. Testing Plan

1. **Log enablement check**
   ```powershell
   wevtutil gl Microsoft-Windows-DriverFrameworks-UserMode/Operational
   ```
   Confirm `enabled: true`.

2. **Trigger firing check** — insert any USB drive, then:
   ```powershell
   Get-WinEvent -LogName "Microsoft-Windows-DriverFrameworks-UserMode/Operational" -MaxEvents 5
   ```
   Confirm Event ID 2003 appears with a recent timestamp.

3. **Positive path** — insert the genuine PULSE drive (correct label + marker file + signed exe). Confirm `PULSE.exe` launches within a few seconds, and `C:\ProgramData\Pulse\launch.log` shows a `LAUNCHING` entry.

4. **Negative path — wrong label** — insert an unrelated USB drive. Confirm nothing launches.

5. **Negative path — spoofed label** — relabel a test USB drive to "PULSE" without the marker file. Confirm the script logs `REJECTED ... marker mismatch` and does not launch anything.

6. **Negative path — tampered exe** — copy `PULSE.exe`, modify one byte, reuse the same marker file. Confirm the Authenticode check fails and logs a rejection.

7. **Double-insert / rapid re-insert** — remove and reinsert the drive quickly several times. Confirm only one instance of `PULSE.exe` launches (no duplicate processes).

8. **Non-admin user session** — repeat test 3 logged in as a standard (non-admin) user. Confirm the task still fires and `PULSE.exe` still launches (validates `LeastPrivilege` config).

9. **Reboot persistence** — reboot the laptop, then repeat test 3. Confirm the scheduled task survives reboot without needing re-provisioning.

10. **EDR/AV pass** — confirm the client's endpoint protection does not quarantine `Watch-PulseUsb.ps1`, the scheduled task, or `PULSE.exe`.

---

## 7. Risks & Compatibility Notes

- **Domain-managed / locked-down laptops:** Group Policy may block Task Scheduler event-log access or PowerShell execution entirely. Requires coordination with the client's IT/security team to allow-list this specific task.
- **Windows editions:** Works on Windows 10/11 Home, Pro, Enterprise. No AutoPlay/AutoRun dependency, so it is unaffected by the security hardening that killed Tier 2.
- **User must be logged in:** Since the task runs as `InteractiveToken`, it only fires within an active user session — it won't launch anything at the Windows lock screen. This is intentional (running arbitrary code pre-logon would be a much larger security exposure) and should be confirmed as acceptable with the client.
- **Not literally "zero software":** The one-time provisioning script and watcher script are new files placed on the laptop. If the client's constraint is strictly "nothing new touches the laptop, ever," this requirement is not achievable on Windows 10/11 by design — flag this back to the client as a scope clarification rather than silently under-delivering.
- **Antivirus false positives:** "Scheduled task launches an exe from removable media on insertion" is a documented living-off-the-land pattern also used by real malware. Expect this to need explicit sign-off from the client's security team, ideally documented in a change request referencing this design doc.

---

## 8. Summary

| Requirement | Met by Tier 1? |
|---|---|
| Auto-execute on insertion, no manual click | Yes |
| Works on Windows 10/11 | Yes |
| Uniquely identify the PULSE drive | Yes (label + marker + signature) |
| No `autorun.inf` security exposure | Yes (doesn't use autorun.inf at all) |
| No third-party software installed | Yes (native Task Scheduler + PowerShell only) — requires one-time OS configuration, not an installer |
| macOS/Linux optional support | Yes (equivalent launchd/udev pattern) |

Recommend proceeding with Tier 1 as the implementation baseline, with Tier 2 documented only as a fallback discussion point if the client's environment turns out to already have AutoPlay policies re-enabled fleet-wide.
