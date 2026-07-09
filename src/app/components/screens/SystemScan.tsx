// =============================================================================
// SystemScan.tsx
// =============================================================================
// PURPOSE:
//   Displays a full hardware scan page for a device being inspected.
//   On mount, it fires parallel Tauri invoke() calls to gather system info
//   (CPU, memory, storage, battery, GPU, display, network) from the Rust
//   backend. Once all 8 calls complete, it auto-advances to the next step
//   via the onNext() callback.
//
// DATA FLOW:
//   1. On mount → invoke() calls fire in parallel (no await, all concurrent)
//   2. Each call resolves → local state updated + data written to InspectionContext
//   3. completedCalls counter increments per resolved/rejected call
//   4. When completedCalls reaches 8 → onNext() is called automatically
//
// CACHING:
//   If data.scanCompleted is already true in InspectionContext (i.e. user
//   navigated back to this page), the component restores state from context
//   and skips the scan entirely.
//
// RE-SCAN:
//   The "Re-scan" button resets the module-level guard and reloads the page,
//   forcing a completely fresh scan on next mount.
// =============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// Imports
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useRef } from "react";
import { useInspection } from "../../context/InspectionContext";
import { normalizeCapacity } from "../../utils/capacity";

// Tauri IPC bridge — invoke() calls a named Rust command in src-tauri/
import { invoke } from "@tauri-apps/api/core";

// Lucide icons used in each InfoCard
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Battery,
  Wifi,
  Monitor,
  CircuitBoard,
  Server,
  CheckCircle2,
  RefreshCw,
  Speaker,
  Camera,
} from "lucide-react";


// =============================================================================
// MODULE-LEVEL SCAN GUARD
// =============================================================================
// This flag lives outside the component so it survives re-renders.
// It prevents the scan from firing more than once per page load, even if the
// component unmounts and remounts (e.g. during React strict mode double-invoke).
//
// The "Re-scan" button resets this to false before reloading the page, which
// allows a fresh scan on the next mount.
// =============================================================================
let scanAlreadyCompleted = false;


// =============================================================================
// TYPES & INTERFACES
// =============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// InfoCard component props
// ─────────────────────────────────────────────────────────────────────────────
interface InfoCardProps {
  icon: React.ElementType;          // Lucide icon component (e.g. Cpu, HardDrive)
  title: string;                    // Card header label
  items: { label: string; value: string }[]; // Key-value rows inside the card
  status?: "ok" | "warn" | "critical";       // Controls the badge color/label
}

// ─────────────────────────────────────────────────────────────────────────────
// SystemScan component props
// ─────────────────────────────────────────────────────────────────────────────
interface SystemScanProps {
  onNext: () => void; // Called automatically once all invoke() calls complete
  isExecutionActive: boolean; // True only when this stage is the active workflow step
}

// ─────────────────────────────────────────────────────────────────────────────
// Rust backend response shapes
// Each interface maps 1:1 to the struct returned by the corresponding
// Tauri command. Field names use snake_case to match Rust serialization.
// ─────────────────────────────────────────────────────────────────────────────

/** Returned by get_system_info — top-level device identity */
interface SystemInfo {
  manufacturer: string;
  model: string;
  serial_number: string;
  uuid: string;
  board_serial: string;
  bios_version: string;
}

/** Returned by get_cpu_info — processor details */
interface CpuInfo {
  manufacturer: string;
  model: string;
  architecture: string;
  sockets: number;
  cores_per_socket: number;
  threads: number;
  max_speed_mhz: number;
  min_speed_mhz: number;
  current_speed_mhz: number;
  cache_l1: string;
  cache_l2: string;
  cache_l3: string;
  virtualization: boolean;
  hyper_threading: boolean;
}

/** Returned by get_memory_info — one entry per DIMM slot */
interface MemoryModule {
  slot: string;
  bank_locator: string;
  size_mb: number;         // Size in megabytes; divide by 1024 for GB
  memory_type: string;     // e.g. "DDR4", "LPDDR5"
  manufacturer: string;
  serial: string;
  part_number: string;
  speed_mhz: number;
  is_empty: boolean;       // true = slot exists but no module installed
  is_onboard: boolean;     // true = soldered RAM (no physical slots)
}

/** Returned by get_storage_info — one entry per detected block device */
interface StorageDevice {
  device: string;
  model: string;
  serial: string;
  firmware: string;
  size_gb: number;
  capacity_gb?: string;    // Manufacturer/marketed capacity (e.g. "512 GB"), if backend provides it
  transport: string;       // e.g. "NVMe", "SATA"
  storage_type: string;    // e.g. "SSD", "HDD"
  health_percent: number | null;   // SMART health; null if unavailable
  temperature_c: number | null;    // Drive temp; null if unavailable
  power_on_hours: number | null;   // Total uptime; null if unavailable
}

/** Returned by get_battery_info — may be null on desktop/non-battery systems */
interface BatteryInfo {
  manufacturer: string;
  model: string;
  serial_number: string;
  technology: string;           // e.g. "Lithium Ion"
  status: string;               // e.g. "Charging", "Discharging"
  cycle_count: number;
  design_capacity_mwh: number;      // Original rated capacity in mWh
  full_charge_capacity_mwh: number; // Current max charge capacity (reflects wear)
  current_capacity_mwh: number;     // Charge level right now
  voltage_mv: number;
}

/** Returned by get_network_info — primary network adapters */
interface NetworkInfo {
  wifi: string;             // Internal adapter identifier
  wifi_friendly: string;    // Human-readable name (e.g. "Intel Wi-Fi 6 AX201")
  wifi_mac: string;
  ethernet: string;         // Internal adapter identifier
  ethernet_friendly: string;
  ethernet_mac: string;
  bluetooth: boolean;
}

interface DisplayInfo {
  manufacturer: string;
  model: string;
  panel_part_number: string;
  resolution: string;
  size_inches: number;
}

interface GpuInfo {
  vendor: string;
  model: string;
  bus_address: string;
  driver: string;
  vram: string;
  output_resolution: string;
}

interface CameraInfo {
  vendor: string;
  model: string;
  device: string;
  status: string;
}

interface AudioInfo {
  codec: string;
  speaker_type: string;
  mic_type: string;
  jack_type: string;
}


// =============================================================================
// InfoCard — Reusable hardware info tile
// =============================================================================
// Renders a card with a header (icon + title + status badge) and a list of
// label/value rows. Used for every hardware category on this page.
//
// STATUS BADGE:
//   "ok"       → green  "Detected"
//   "warn"     → amber  "Warning"
//   "critical" → red    "Critical"
//
// TO ADD A NEW STATUS:
//   1. Add the key to InfoCardProps status union
//   2. Add an entry to statusBadge and statusLabel below
// =============================================================================
function InfoCard({ icon: Icon, title, items, status = "ok" }: InfoCardProps) {

  // Tailwind classes for each status badge variant
  const statusBadge = {
    ok:       "bg-emerald-500/15 text-emerald-300",
    warn:     "bg-amber-500/15 text-amber-300",
    critical: "bg-red-500/15 text-red-300",
  };

  // Human-readable label shown inside the badge
  const statusLabel = {
    ok:       "Detected",
    warn:     "Warning",
    critical: "Critical",
  };

  return (
    <div className="bg-[#0f1e35] rounded-lg border border-[#1c3f66] overflow-hidden flex flex-col">

      {/* ── Card Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0d1b30] border-b border-[#1c3f66]">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-blue-400" />
          <span className="text-[11px] text-slate-200 font-medium">{title}</span>
        </div>

        <span className={`text-[9px] px-2 py-0.5 rounded-full ${statusBadge[status]}`}>
          {statusLabel[status]}
        </span>
      </div>

      {/* ── Card Body ───────────────────────────────────────────────────────── */}
      <div className="p-2 space-y-0.5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-2 px-1.5 py-0.5">
            <span className="text-[9px] text-slate-500 leading-tight">{item.label}</span>
            <span className="text-[10px] text-slate-100 font-medium leading-tight text-right break-words">
              {item.value}
            </span>
          </div>
        ))}
      </div>

    </div>
  );
}


// =============================================================================
// SystemScan — Main page component
// =============================================================================
export function SystemScan({ onNext, isExecutionActive }: SystemScanProps) {

  // ─────────────────────────────────────────────────────────────────────────
  // Local state — one slice per hardware category
  // Each is null/[] until the corresponding invoke() call resolves.
  // While null, cards display "Scanning..." placeholder text.
  // ─────────────────────────────────────────────────────────────────────────
  const [systemInfo,  setSystemInfo]  = useState<SystemInfo | null>(null);
  const [cpuInfo,     setCpuInfo]     = useState<CpuInfo | null>(null);
  const [memoryInfo,  setMemoryInfo]  = useState<MemoryModule[]>([]);
  const [storageInfo, setStorageInfo] = useState<StorageDevice[]>([]);
  const [batteryInfo, setBatteryInfo] = useState<BatteryInfo | null>(null);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [displayInfo, setDisplayInfo] = useState<DisplayInfo | null>(null);
  const [gpuInfo, setGpuInfo] = useState<GpuInfo[]>([]);
  const [cameraInfo, setCameraInfo] = useState<CameraInfo | null>(null);
  const [audioInfo, setAudioInfo] = useState<AudioInfo | null>(null);

  // Tracks how many of the 8 parallel invoke() calls have settled (resolved OR
  // rejected). When this hits 8, the scan is considered complete.
  const [completedCalls, setCompletedCalls] = useState(0);

  // ─────────────────────────────────────────────────────────────────────────
  // Refs
  // ─────────────────────────────────────────────────────────────────────────

  // Prevents onNext() from being called more than once if completedCalls
  // somehow increments past 8 (e.g. due to React strict mode double effects).
  const autoAdvanced = useRef(false);

  // ─────────────────────────────────────────────────────────────────────────
  // InspectionContext — shared data store across wizard steps
  // ─────────────────────────────────────────────────────────────────────────
  const { data, setData } = useInspection();


  // ===========================================================================
  // EFFECT 1 — Restore cached scan from InspectionContext
  // ===========================================================================
  // Runs once on mount. If the user already completed a scan (e.g. navigated
  // back from a later step), data.scanCompleted will be true. In that case,
  // we repopulate local state from the context cache so the UI shows results
  // instantly without re-running any invoke() calls.
  //
  // completedCalls is set to 8 directly to mark the scan as done and prevent
  // the scan effect (Effect 2) from running.
  // ===========================================================================
  useEffect(() => {

    if (!data.scanCompleted) return; // No cached data → fall through to Effect 2

    console.log("RESTORING SCAN FROM CONTEXT");

    setSystemInfo(data.systemInfo);
    setCpuInfo(data.cpuInfo);
    setMemoryInfo(data.memoryInfo || []);
    setStorageInfo(data.storageInfo || []);
    setBatteryInfo(data.batteryInfo);
    setNetworkInfo(data.networkInfo);
    setDisplayInfo(data.displayInfo);
    setGpuInfo(data.gpuInfo || []);
    setCameraInfo(data.cameraInfo);
    setAudioInfo(data.audioInfo);
    setCompletedCalls(10); // Mark complete; suppresses fresh scan

  }, []); // Empty deps — intentionally runs only on initial mount


  // ===========================================================================
  // EFFECT 2 — Run fresh hardware scan via Tauri invoke() calls
  // ===========================================================================
  // Fires all 8 backend commands in parallel. Each .then() / .catch() handler:
  //   1. Updates the relevant local state slice
  //   2. Writes the result into InspectionContext (setData)
  //   3. Increments completedCalls by 1
  //
  // IMPORTANT: All 8 calls are fire-and-forget (no await). They run concurrently
  // and the UI updates progressively as each one resolves.
  //
  // GUARDS (all must pass before any invoke fires):
  //   - isExecutionActive: this stage must actually be the active workflow
  //     step (i.e. the user has clicked "Start Inspection" and progressed
  //     here normally) -- prevents the real hardware scan from firing just
  //     because the user clicked into this screen from the sidebar before
  //     starting an inspection
  //   - data.scanCompleted: context already has a fresh scan → skip
  //   - scanAlreadyCompleted: module-level flag → prevents double-fire in
  //     React Strict Mode or accidental remounts
  //
  // TO ADD A NEW INVOKE CALL:
  //   1. Define the response interface above
  //   2. Add a useState slice above
  //   3. Add the invoke() block below, incrementing completedCalls in both
  //      .then() and .catch()
  //   4. Increase the threshold in Effect 3 from 8 to 9 (or whatever new total)
  // ===========================================================================
  useEffect(() => {

    // Guard 0: don't auto-run the actual hardware scan until this stage is
    // genuinely the active workflow step. Just navigating here (e.g. via the
    // sidebar) before clicking "Start Inspection" should not kick off a scan.
    if (!isExecutionActive) {
      console.log("SYSTEM SCAN NOT ACTIVE - skipping until Start Inspection");
      return;
    }

    // Guard 1: cached scan exists in context
    if (data.scanCompleted) {
      console.log("USING CACHED SCAN");
      return;
    }

    // Guard 2: already fired this session (survives re-renders / strict mode)
    if (scanAlreadyCompleted) return;
    scanAlreadyCompleted = true;

    console.log("RUNNING FRESH SCAN");

    // ── Call 1: System Info ────────────────────────────────────────────────
    // Returns device manufacturer, model, serial number, and UUID.
    // On error, populates systemInfo with the error string so it's visible
    // in the UI rather than silently missing.
    invoke<SystemInfo>("get_system_info")
      .then((result) => {
        console.log("System Info:", result);
        setSystemInfo(result);
        setData(prev => ({ ...prev, systemInfo: result }));
        setCompletedCalls(prev => prev + 1);
      })
      .catch((err) => {
        console.error("System scan failed:", err);
        // Surface the error in the UI instead of showing a blank card, and
        // mirror it into the shared context so a later restore stays consistent.
        const errInfo = {
          manufacturer: "ERROR",
          model: String(err),
          serial_number: "-",
          uuid: "-",
          board_serial: "-",
          bios_version: "-",
        };
        setSystemInfo(errInfo);
        setData(prev => ({ ...prev, systemInfo: errInfo }));
        setCompletedCalls(prev => prev + 1);
      });

    // ── Call 2: CPU Info ───────────────────────────────────────────────────
    // Returns processor model, core/thread counts, speed, cache, etc.
    invoke<CpuInfo>("get_cpu_info")
      .then((result) => {
        console.log("CPU INFO:", result);
        setCpuInfo(result);
        setData(prev => ({ ...prev, cpuInfo: result }));
        setCompletedCalls(prev => prev + 1);
      })
      .catch((err) => {
        console.error("CPU ERROR:", err);
        setCompletedCalls(prev => prev + 1);
      });

    // ── Call 3: Battery Info ───────────────────────────────────────────────
    // Returns null on systems without a battery (e.g. desktops).
    // The null check before setBatteryInfo prevents overwriting a valid state
    // with null if the command succeeds but the device has no battery.
    invoke<BatteryInfo | null>("get_battery_info")
      .then((result) => {
        console.log("BATTERY INFO:", result);
        if (result) setBatteryInfo(result);
        setData(prev => ({ ...prev, batteryInfo: result }));
        setCompletedCalls(prev => prev + 1);
      })
      .catch((err) => {
        console.error("BATTERY ERROR:", err);
        setCompletedCalls(prev => prev + 1);
      });

    // ── Call 4: GPU Info ───────────────────────────────────────────────────
    invoke<GpuInfo[]>("get_gpu_info")
      .then((result) => {
        console.log("GPU INFO:", result);
        setGpuInfo(result);
        setData(prev => ({ ...prev, gpuInfo: result }));
        setCompletedCalls(prev => prev + 1);
      })
      .catch((err) => {
        console.error("GPU ERROR:", err);
        setCompletedCalls(prev => prev + 1);
      });

    // ── Call 5: Display Info ───────────────────────────────────────────────
    invoke<DisplayInfo | null>("get_display_info")
      .then((result) => {
        console.log("DISPLAY INFO:", result);
        setDisplayInfo(result);
        setData(prev => ({ ...prev, displayInfo: result }));
        setCompletedCalls(prev => prev + 1);
      })
      .catch((err) => {
        console.error("DISPLAY ERROR:", err);
        setCompletedCalls(prev => prev + 1);
      });

    // ── Call 6: Network Info ───────────────────────────────────────────────
    // Returns Wi-Fi adapter name/MAC, Ethernet adapter name/MAC, Bluetooth flag.
    invoke<NetworkInfo>("get_network_info")
      .then((result) => {
        console.log("NETWORK INFO:", result);
        setNetworkInfo(result);
        setData(prev => ({ ...prev, networkInfo: result }));
        setCompletedCalls(prev => prev + 1);
      })
      .catch((err) => {
        console.error("NETWORK ERROR:", err);
        setCompletedCalls(prev => prev + 1);
      });

    // ── Call 7: Memory Info ────────────────────────────────────────────────
    // Returns an array of MemoryModule — one entry per physical DIMM slot.
    // Slots with is_empty = true are counted but have no data to display.
    invoke<MemoryModule[]>("get_memory_info")
      .then((result) => {
        console.log("MEMORY INFO:", result);
        setMemoryInfo(result);
        setData(prev => ({ ...prev, memoryInfo: result }));
        setCompletedCalls(prev => prev + 1);
      })
      .catch((err) => {
        console.error("MEMORY ERROR:", err);
        setCompletedCalls(prev => prev + 1);
      });

    // ── Call 8: Storage Info ───────────────────────────────────────────────
    invoke<StorageDevice[]>("get_storage_info")
      .then((result) => {
        console.log("STORAGE INFO:", result);
        setStorageInfo(result);
        setData(prev => ({
          ...prev,
          storageInfo: result,
        }));
        setCompletedCalls(prev => prev + 1);
      })
      .catch((err) => {
        console.error("STORAGE ERROR:", err);
        setCompletedCalls(prev => prev + 1);
      });
    // ── Call 9: Camera Info ───────────────────────────────────────────────
    invoke<CameraInfo | null>("get_camera_info")
      .then((result) => {
        console.log("CAMERA INFO:", result);

        setCameraInfo(result);

        setData((prev) => ({
          ...prev,
          cameraInfo: result,
        }));

        setCompletedCalls((prev) => prev + 1);
      })
      .catch((err) => {
        console.error("CAMERA ERROR:", err);

        setCompletedCalls((prev) => prev + 1);
      });

    // ── Call 10: Audio Info ───────────────────────────────────────────────
    invoke<AudioInfo | null>("get_audio_info")
      .then((result) => {
        console.log("AUDIO INFO:", result);
        setAudioInfo(result);
        setData((prev) => ({
          ...prev,
          audioInfo: result,
          scanCompleted: true,
        }));
        setCompletedCalls((prev) => prev + 1);
      })
      .catch((err) => {
        console.error("AUDIO ERROR:", err);
        setCompletedCalls((prev) => prev + 1);
      });

  }, [isExecutionActive]); // Re-evaluates if this stage becomes active after a premature, non-active mount


  // ===========================================================================
  // EFFECT 3 — Auto-advance when all invoke() calls have settled
  // ===========================================================================
  // Watches completedCalls. Once it reaches 8 (total number of invoke() calls),
  // calls onNext() to move to the next wizard step.
  //
  // The autoAdvanced ref prevents calling onNext() more than once even if
  // this effect re-runs (e.g. React strict mode, parent re-renders).
  //
  // TO CHANGE THE TOTAL CALL COUNT: update the >= 8 threshold below.
  // ===========================================================================
  useEffect(() => {

    // Only push the workflow forward when this stage is the active execution
    // step. Clicking back to review a completed scan should not re-trigger the
    // next stage.
    if (
      completedCalls >= 10 &&
      !autoAdvanced.current &&
      isExecutionActive
    ) {
      autoAdvanced.current = true;
      console.log("SYSTEM SCAN COMPLETE");
      onNext();
    }

  }, [completedCalls, onNext, isExecutionActive]);


  // ===========================================================================
  // DERIVED VALUES — computed from raw state for display
  // ===========================================================================

  // Total installed RAM in GB, summed across all populated DIMM slots
  const totalMemoryGb = memoryInfo.reduce((sum, m) => sum + m.size_mb, 0) / 1024;

  // Number of slots that actually have a module installed
  const populatedSlots = memoryInfo.filter((m) => !m.is_empty).length;

  // First non-empty DIMM — used for type and speed (assumes uniform configuration)
  const firstModule = memoryInfo.find((m) => !m.is_empty);

  // true if all modules are soldered (no user-replaceable slots)
  const onboardMemory = memoryInfo.every((m) => m.is_onboard);

  // Primary storage device (first in list, typically the boot drive)
  const primaryDrive = storageInfo.length > 0 ? storageInfo[0] : null;

  // Primary GPU (first detected GPU)
  const primaryGpu = gpuInfo.length > 0 ? gpuInfo[0] : null;


  // ===========================================================================
  // RENDER
  // ===========================================================================
  return (
    <div className="-m-6 p-6 min-h-[calc(100vh-6rem)] bg-[#0a1626] space-y-5">

      {/* ── Page Header ───────────────────────────────────────────────────── */}
      {/* Title/subtitle on the left; Re-scan button + scan progress on the right */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-100">System Scan</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Automated hardware detection and diagnostics
          </p>
        </div>

        <div className="flex items-center gap-3">

          {/* Re-scan button: resets module guard and reloads the page */}
          <button
            onClick={() => {
              scanAlreadyCompleted = false;
              window.location.reload();
            }}
            className="flex items-center gap-2 text-sm text-slate-300 bg-[#0f1e35] border border-[#1c3f66] hover:bg-[#132445] px-3 py-2 rounded-lg transition-colors"
          >
            <RefreshCw size={14} />
            Re-scan
          </button>

          {/* Scan progress badge — switches to "complete" message at 8/8 */}
          <div className="flex items-center gap-1.5 text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-3 py-1.5 rounded-lg">
            <CheckCircle2 size={13} />
            {completedCalls >= 10
              ? "Scan Complete - Auto advancing..."
              : `Scanning... ${completedCalls}/10`}
          </div>

        </div>
      </div>


      {/* ── Row 1: Core hardware cards ────────────────────────────────────── */}
      {/* System · CPU · Memory · Storage · Battery */}
      <div className="grid grid-cols-5 gap-1 auto-rows-min">

        {/* System — device identity from DMI/SMBIOS */}
        <InfoCard
          icon={Server}
          title="System"
          items={[
            { label: "Manufacturer", value: systemInfo?.manufacturer || "Scanning..." },
            { label: "Model", value: systemInfo?.model || "Scanning..." },
            { label: "Serial", value: systemInfo?.serial_number || "Scanning..." },
            { label: "UUID", value: systemInfo?.uuid || "Scanning..." },
            { label: "Board Serial", value: systemInfo?.board_serial || "Scanning..." },
            { label: "BIOS Version", value: systemInfo?.bios_version || "Scanning..." },
          ]}
        />

        {/* CPU — processor details */}
        <InfoCard
          icon={Cpu}
          title="CPU"
          items={[
            { label: "Processor", value: cpuInfo?.model || "Scanning..." },
            { label: "Vendor", value: cpuInfo?.manufacturer || "Scanning..." },
            { label: "Arch", value: cpuInfo?.architecture || "Scanning..." },
            { label: "Sockets", value: cpuInfo ? `${cpuInfo.sockets}` : "Scanning..." },
            { label: "Cores/Socket", value: cpuInfo ? `${cpuInfo.cores_per_socket}` : "Scanning..." },
            { label: "Threads", value: cpuInfo ? `${cpuInfo.threads}` : "Scanning..." },
            { label: "Max Speed", value: cpuInfo ? `${cpuInfo.max_speed_mhz} MHz` : "Scanning..." },
            { label: "Min Speed", value: cpuInfo ? `${cpuInfo.min_speed_mhz} MHz` : "Scanning..." },
            { label: "Current Speed", value: cpuInfo ? `${cpuInfo.current_speed_mhz} MHz` : "Scanning..." },
            { label: "Cache L1", value: cpuInfo?.cache_l1 || "Scanning..." },
            { label: "Cache L2", value: cpuInfo?.cache_l2 || "Scanning..." },
            { label: "Cache L3", value: cpuInfo?.cache_l3 || "Scanning..." },
          ]}
        />

        {/* Memory — total RAM, type, speed, slot topology */}
        <InfoCard
          icon={MemoryStick}
          title="Memory"
          items={[
            { label: "Installed", value: memoryInfo.length > 0 ? `${totalMemoryGb.toFixed(1)} GB` : "Scanning..." },
            { label: "Type", value: firstModule?.memory_type || "Scanning..." },
            { label: "Speed", value: firstModule ? `${firstModule.speed_mhz} MT/s` : "Scanning..." },
            { label: "Modules", value: memoryInfo.length > 0 ? `${memoryInfo.length}` : "Scanning..." },
            { label: "Used Slots", value: `${populatedSlots}` },
            { label: "Empty Slots", value: `${memoryInfo.length - populatedSlots}` },
            { label: "Topology", value: onboardMemory ? "Onboard" : `${populatedSlots} Used` },
            { label: "Slot", value: firstModule?.slot || "N/A" },
            { label: "Manufacturer", value: firstModule?.manufacturer || "N/A" },
            { label: "Part Number", value: firstModule?.part_number || "N/A" },
            { label: "Serial", value: firstModule?.serial || "N/A" },
          ]}
        />

        {/* Storage — primary drive (index 0 of storageInfo array) */}
        <InfoCard
          icon={HardDrive}
          title="Storage"
          items={[
            { label: "Type", value: primaryDrive?.storage_type || "Scanning..." },
            { label: "Model", value: primaryDrive?.model || "Scanning..." },
            { label: "Serial", value: primaryDrive?.serial || "Scanning..." },
            { label: "Capacity", value: primaryDrive?.capacity_gb || (primaryDrive && normalizeCapacity(primaryDrive.size_gb)) || "Scanning..." },
            { label: "Firmware", value: primaryDrive?.firmware || "N/A" },
            { label: "Transport", value: primaryDrive?.transport || "N/A" },
            { label: "Health", value: primaryDrive?.health_percent != null ? `${primaryDrive.health_percent}%` : "N/A" },
            { label: "Temp", value: primaryDrive?.temperature_c != null ? `${primaryDrive.temperature_c}°C` : "N/A" },
            { label: "Power On", value: primaryDrive?.power_on_hours != null ? `${primaryDrive.power_on_hours}h` : "N/A" },
            { label: "Device", value: primaryDrive?.device || "N/A" },
          ]}
        />

        {/* Battery — health %, current vs full charge capacity, cycle count */}
        <InfoCard
          icon={Battery}
          title="Battery"
          status="ok"
          items={[
            { label: "Health", value: batteryInfo ? `${Math.round((batteryInfo.full_charge_capacity_mwh / batteryInfo.design_capacity_mwh) * 100)}%` : "Scanning..." },
            { label: "Capacity", value: batteryInfo ? `${(batteryInfo.current_capacity_mwh / 1000).toFixed(0)} / ${(batteryInfo.full_charge_capacity_mwh / 1000).toFixed(0)} Wh` : "Scanning..." },
            { label: "Status", value: batteryInfo?.status || "Scanning..." },
            { label: "Technology", value: batteryInfo?.technology || "Scanning..." },
            { label: "Cycle Count", value: batteryInfo ? batteryInfo.cycle_count.toString() : "Scanning..." },
            { label: "Voltage", value: batteryInfo ? `${batteryInfo.voltage_mv} mV` : "Scanning..." },
            { label: "Manufacturer", value: batteryInfo?.manufacturer || "N/A" },
            { label: "Model", value: batteryInfo?.model || "N/A" },
            { label: "Serial", value: batteryInfo?.serial_number || "N/A" },
            { label: "Design", value: batteryInfo ? `${(batteryInfo.design_capacity_mwh / 1000).toFixed(0)} Wh` : "N/A" },
          ]}
        />

      </div>


      {/* ── Row 2: Peripheral / connectivity cards ────────────────────────── */}
      {/* Display · GPU · Network · Audio · Camera */}
      {/* NOTE: Display, GPU, Audio, Camera use static placeholder values.    */}
      {/* TODO: Replace statics with dynamic data from context (displayInfo,  */}
      {/*       gpuInfo) once those invoke() calls are wired to local state.  */}
      <div className="grid grid-cols-5 gap-1 mt-2 auto-rows-min">

        {/* Display — details from the display collector when available */}
        <InfoCard
          icon={Monitor}
          title="Display"
          items={[
            { label: "Manufacturer", value: displayInfo?.manufacturer || "N/A" },
            { label: "Model", value: displayInfo?.model || "N/A" },
            { label: "Panel PN", value: displayInfo?.panel_part_number || "N/A" },
            { label: "Resolution", value: displayInfo?.resolution || "N/A" },
            { label: "Size", value: displayInfo ? `${displayInfo.size_inches.toFixed(1)} in` : "N/A" },
            { label: "Source", value: displayInfo ? "EDID / DRM" : "N/A" },
          ]}
        />

        {/* GPU — details from the GPU collector when available */}
        <InfoCard
          icon={CircuitBoard}
          title="GPU"
          items={[
            { label: "Vendor", value: primaryGpu?.vendor || "Scanning..." },
            { label: "Model", value: primaryGpu?.model || "N/A" },
            { label: "Driver", value: primaryGpu?.driver || "N/A" },
            { label: "Bus", value: primaryGpu?.bus_address || "N/A" },
            { label: "VRAM", value: primaryGpu?.vram || "N/A" },
            { label: "Output", value: primaryGpu?.output_resolution || displayInfo?.resolution || "N/A" },
            { label: "Display Res", value: displayInfo?.resolution || "N/A" },
            { label: "Status", value: primaryGpu ? "Detected" : "Scanning..." },
          ]}
        />

        {/* Network — dynamic data from networkInfo state */}
        <InfoCard
          icon={Wifi}
          title="Network"
          items={[
            { label: "WiFi", value: networkInfo?.wifi_friendly || "Scanning..." },
            { label: "WiFi Adapter", value: networkInfo?.wifi || "N/A" },
            { label: "WiFi MAC", value: networkInfo?.wifi_mac || "N/A" },
            { label: "LAN", value: networkInfo?.ethernet_friendly || "Not Present" },
            { label: "LAN Adapter", value: networkInfo?.ethernet || "N/A" },
            { label: "LAN MAC", value: networkInfo?.ethernet_mac || "Not Present" },
            { label: "Bluetooth", value: networkInfo?.bluetooth ? "Yes" : "No" },
            { label: "Status", value: networkInfo ? "Connected / Available" : "Scanning..." },
          ]}
        />

        {/* Audio — details from the audio collector when available */}
        <InfoCard
          icon={Speaker}
          title="Audio"
          items={[
            { label: "Speakers", value: audioInfo?.speaker_type || "Scanning..." },
            { label: "Codec", value: audioInfo?.codec || "Scanning..." },
            { label: "Jack", value: audioInfo?.jack_type || "Scanning..." },
            { label: "Mic", value: audioInfo?.mic_type || "Scanning..." },
            { label: "Playback", value: audioInfo ? "Available" : "Scanning..." },
            { label: "Capture", value: audioInfo ? "Available" : "Scanning..." },
            { label: "Status", value: audioInfo ? "Detected" : "Scanning..." },
          ]}
        />

        {/* Camera — details from the camera collector when available */}
        <InfoCard
          icon={Camera}
          title="Camera"
          items={[
            { label: "Model", value: cameraInfo?.model || "Scanning..." },
            { label: "Vendor", value: cameraInfo?.vendor || "Scanning..." },
            { label: "Device", value: cameraInfo?.device || "Scanning..." },
            { label: "Status", value: cameraInfo?.status || "Scanning..." },
            { label: "Source", value: cameraInfo ? "v4l2-ctl" : "Scanning..." },
            { label: "Detection", value: cameraInfo ? "Detected" : "Scanning..." },
          ]}
        />

      </div>

    </div>
  );
}