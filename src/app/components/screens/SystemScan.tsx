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
  Bluetooth,
} from "lucide-react";

// Toast notifications — popup feedback after the Save action
import { toast } from "sonner";

// Supabase client — writes the GPU card values into the cloud tbl_GPU table
import { supabase } from "../../../lib/supabase";


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
  onNext: () => void; // Called automatically once all 8 invoke() calls complete
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
  version: string;
  sku_number: string;
  family: string;
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
  cache_total_mb: number;  // Sum of L1d+L1i+L2+L3 in MiB (from Processor.py logic)
  virtualization: boolean;
  hyper_threading: boolean;
  flags: string[];
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
  slot: string;            // e.g. "NVMe1", "Disk1"
  device: string;
  model: string;
  serial: string;
  firmware: string;
  size_gb: number;
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
  design_capacity_wh: number;       // Normalized to Wh by the backend
  full_charge_capacity_wh: number;
  current_capacity_wh: number;
  health_percent: number;           // full / design × 100
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

interface CameraInfo {
  vendor: string;
  model: string;
  device: string;
  status: string;
}

/** Returned by get_audio_info — primary audio controller (mirrors Audio.py) */
interface AudioInfo {
  manufacturer: string;
  model: string;
}

/** Returned by get_motherboard_info — baseboard + BIOS (mirrors Motherboard.py) */
interface MotherboardInfo {
  manufacturer: string;
  model: string;
  revision: string;
  serial_number: string;
  bios_version: string;
  bios_date: string;
  bios_vendor: string;
}

/** Returned by get_bluetooth_info — Bluetooth adapter (mirrors Bluetooth.py) */
interface BluetoothInfo {
  manufacturer: string;
  model: string;
}

/** Returned by get_gpu_info — one entry per detected GPU adapter */
interface GpuInfo {
  vendor: string;
  model: string;
  bus_address: string;
  driver: string;
}

/** Returned by get_display_info — the primary display panel */
interface DisplayInfo {
  manufacturer: string;
  model: string;
  panel_part_number: string;
  resolution: string;
  size_inches: number;
  refresh_rate: string;
  aspect_ratio: string;
  size: string;
  touchscreen: string;
  manufacture_year: string;
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
    ok:       "bg-emerald-100 text-emerald-700",
    warn:     "bg-amber-100 text-amber-700",
    critical: "bg-red-100 text-red-700",
  };

  // Human-readable label shown inside the badge
  const statusLabel = {
    ok:       "Detected",
    warn:     "Warning",
    critical: "Critical",
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-lg border border-slate-200 overflow-hidden">

      {/* ── Card Header ─────────────────────────────────────────────────────── */}
      {/* Icon + title on the left; status badge on the right */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <Icon size={15} className="text-blue-600" />
          <span className="text-sm text-slate-700">{title}</span>
        </div>

        <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusBadge[status]}`}>
          {statusLabel[status]}
        </span>
      </div>

      {/* ── Card Body ───────────────────────────────────────────────────────── */}
      {/* One block per item: small uppercase label above, full-width value below */}
      {/* so long values (serials, model strings) wrap and display in full.       */}
      <div className="p-4 space-y-2.5">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex flex-col gap-0.5 pb-2 border-b border-slate-100 last:border-b-0 last:pb-0"
          >
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
              {item.label}
            </span>
            <span className="text-[13px] leading-snug text-slate-800 font-medium break-words">
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
export function SystemScan({ onNext }: SystemScanProps) {

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
  const [cameraInfo, setCameraInfo] = useState<any>(null);
  const [audioInfo, setAudioInfo] = useState<AudioInfo | null>(null);
  const [motherboardInfo, setMotherboardInfo] = useState<MotherboardInfo | null>(null);
  const [bluetoothInfo, setBluetoothInfo] = useState<BluetoothInfo | null>(null);

  // GPU adapters + primary display — used to render the GPU card live.
  const [gpuInfo, setGpuInfo] = useState<GpuInfo[]>([]);
  const [displayInfo, setDisplayInfo] = useState<DisplayInfo | null>(null);

  // Tracks the in-flight Save → Supabase request for the GPU card.
  const [savingGpu, setSavingGpu] = useState(false);

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

  // ─────────────────────────────────────────────────────────────────────────
  // GPU card values (currently the static placeholders shown in the GPU card).
  // Defined once here so the card display and the Save handler stay in sync.
  // ─────────────────────────────────────────────────────────────────────────
  // Primary GPU = first detected adapter. The GPU backend reports vendor,
  // model and driver — so Graphics and Driver are live. VRAM is not collected
  // by the backend, and Output (resolution) is a display property, so it's
  // pulled from displayInfo. Rows fall back until their data arrives.
  const primaryGpu = gpuInfo[0];
  const gpuCardItems = [
    { label: "Manufacturer", value: primaryGpu?.vendor   || "Scanning..." },
    { label: "Model",        value: primaryGpu?.model    || "Scanning..." },
    { label: "Driver",       value: primaryGpu?.driver   || "N/A" },
    { label: "Output",       value: displayInfo?.resolution || "N/A" },
  ];

  // Saves the GPU card values into the Supabase `tbl_GPU` table, then shows a
  // success/failure popup reporting whether the row was saved.
  const handleSaveGpu = async () => {
    setSavingGpu(true);

    const record = {
      graphics: primaryGpu?.model        || "",
      vram:     "N/A",
      driver:   primaryGpu?.driver       || "",
      output:   displayInfo?.resolution  || "",
    };

    const { error } = await supabase.from("tbl_GPU").insert(record);

    setSavingGpu(false);

    if (error) {
      toast.error("Could not save GPU details to tbl_GPU", {
        description: error.message,
      });
    } else {
      toast.success("GPU details saved to tbl_GPU");
    }
  };


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
    setGpuInfo(data.gpuInfo || []);
    setDisplayInfo(data.displayInfo || null);
    setCameraInfo(data.cameraInfo || null);
    setAudioInfo(data.audioInfo || null);
    setMotherboardInfo(data.motherboardInfo || null);
    setBluetoothInfo(data.bluetoothInfo || null);
    setCompletedCalls(12); // Mark complete; suppresses fresh scan

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
  // GUARDS (both must pass before any invoke fires):
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
        // Surface the error in the UI instead of showing a blank card
        setSystemInfo({
          manufacturer: "ERROR",
          model: String(err),
          serial_number: "-",
          uuid: "-",
          version: "-",
          sku_number: "-",
          family: "-",
        });
        setCompletedCalls(prev => prev + 1);
      });

    // ── Call 2: CPU Info ───────────────────────────────────────────────────
    // Returns processor model, core/thread counts, speed, cache, flags, etc.
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
    // Result stored in context only (gpuInfo). No local state needed here
    // because the GPU card currently uses static placeholder values.
    // TODO: Wire up local gpuInfo state and render dynamic values.
    invoke<GpuInfo[]>("get_gpu_info")
      .then((result) => {
        console.log("GPU INFO:", result);
        setGpuInfo(result || []);
        setData(prev => ({ ...prev, gpuInfo: result }));
        setCompletedCalls(prev => prev + 1);
      })
      .catch((err) => {
        console.error("GPU ERROR:", err);
        setCompletedCalls(prev => prev + 1);
      });

    // ── Call 5: Display Info ───────────────────────────────────────────────
    // Result stored in context only (displayInfo). No local state needed here
    // because the Display card currently uses static placeholder values.
    // TODO: Wire up local displayInfo state and render dynamic values.
    invoke<DisplayInfo>("get_display_info")
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
    // Returns an array of StorageDevice. Also sets scanCompleted: true in
    // context — this is the last call, so it acts as the "all done" signal.
    
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
    // ------------------------------------------------------
// Call 9 : Camera Info
// Final collector - marks scan as complete
// ------------------------------------------------------
// NOTE: If you add more calls, move scanCompleted: true to Effect 3 instead.
invoke("get_camera_info")
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

    // ── Call 10: Audio Info ────────────────────────────────────────────────
    // Primary audio controller via lspci (port of Audio.py).
    invoke<AudioInfo>("get_audio_info")
      .then((result) => {
        console.log("AUDIO INFO:", result);

        setAudioInfo(result);

        setData((prev) => ({ ...prev, audioInfo: result }));

        setCompletedCalls((prev) => prev + 1);
      })
      .catch((err) => {
        console.error("AUDIO ERROR:", err);

        setCompletedCalls((prev) => prev + 1);
      });

    // ── Call 11: Motherboard Info ──────────────────────────────────────────
    // Baseboard + BIOS from sysfs DMI (port of Motherboard.py).
    invoke<MotherboardInfo>("get_motherboard_info")
      .then((result) => {
        console.log("MOTHERBOARD INFO:", result);

        setMotherboardInfo(result);

        setData((prev) => ({ ...prev, motherboardInfo: result }));

        setCompletedCalls((prev) => prev + 1);
      })
      .catch((err) => {
        console.error("MOTHERBOARD ERROR:", err);

        setCompletedCalls((prev) => prev + 1);
      });

    // ── Call 12: Bluetooth Info ────────────────────────────────────────────
    // Bluetooth adapter via lsusb/lspci (port of Bluetooth.py). Final collector —
    // marks scanCompleted: true in context.
    invoke<BluetoothInfo>("get_bluetooth_info")
      .then((result) => {
        console.log("BLUETOOTH INFO:", result);

        setBluetoothInfo(result);

        setData((prev) => ({
          ...prev,
          bluetoothInfo: result,
          scanCompleted: true,
        }));

        setCompletedCalls((prev) => prev + 1);
      })
      .catch((err) => {
        console.error("BLUETOOTH ERROR:", err);

        setCompletedCalls((prev) => prev + 1);
      });

  }, []); // Empty deps — intentionally runs only on initial mount


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

    if (completedCalls >= 12 && !autoAdvanced.current) {
      autoAdvanced.current = true;
      console.log("SYSTEM SCAN COMPLETE");
      onNext();
    }

  }, [completedCalls, onNext]);


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


  // ===========================================================================
  // RENDER
  // ===========================================================================
  return (
    <div className="space-y-5">

      {/* ── Page Header ───────────────────────────────────────────────────── */}
      {/* Title/subtitle on the left; Re-scan button + scan progress on the right */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-800">System Scan</h1>
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
            className="flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-lg transition-colors"
          >
            <RefreshCw size={14} />
            Re-scan
          </button>

          {/* Scan progress badge — switches to "complete" message at 8/8 */}
          <div className="flex items-center gap-1.5 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg">
            <CheckCircle2 size={13} />
            {completedCalls >= 12
              ? "Scan Complete - Auto advancing..."
              : `Scanning... ${completedCalls}/12`}
          </div>

        </div>
      </div>


      {/* ── Row 1: Core hardware cards ────────────────────────────────────── */}
      {/* System · CPU · Memory · Storage · Battery */}
      <div className="grid grid-cols-5 gap-4">

        {/* System — live device identity from DMI/SMBIOS (mirrors System.py) */}
        <InfoCard
          icon={Server}
          title="System"
          items={[
            { label: "Manufacturer",  value: systemInfo?.manufacturer  || "Scanning..." },
            { label: "Product Name",  value: systemInfo?.model          || "Scanning..." },
            { label: "Version",       value: systemInfo?.version        || "N/A" },
            { label: "Serial Number", value: systemInfo?.serial_number  || "Scanning..." },
            { label: "UUID",          value: systemInfo?.uuid           || "Scanning..." },
            { label: "SKU Number",    value: systemInfo?.sku_number     || "N/A" },
            { label: "Family",        value: systemInfo?.family         || "N/A" },
          ]}
        />

        {/* CPU — live processor details (mirrors Processor.py output fields) */}
        <InfoCard
          icon={Cpu}
          title="Processor"
          items={[
            { label: "Manufacturer",    value: cpuInfo?.manufacturer || "Scanning..." },
            { label: "Model",           value: cpuInfo?.model        || "Scanning..." },
            { label: "Physical Cores",  value: cpuInfo ? `${cpuInfo.cores_per_socket}` : "Scanning..." },
            { label: "Logical Cores",   value: cpuInfo ? `${cpuInfo.threads}`          : "Scanning..." },
            { label: "Clock Frequency", value: cpuInfo ? `${Math.round(cpuInfo.max_speed_mhz)} MHz` : "Scanning..." },
            { label: "Sockets",        value: cpuInfo ? `${cpuInfo.sockets}` : "Scanning..." },
            { label: "Cache",          value: cpuInfo ? `${cpuInfo.cache_total_mb} MB` : "Scanning..." },
          ]}
        />

        {/* Memory — total RAM, type, speed, slot topology */}
        <InfoCard
          icon={MemoryStick}
          title="Memory"
          items={[
            { label: "Manufacturer",    value: firstModule?.manufacturer || "Scanning..." },
            { label: "Model",           value: firstModule?.part_number  || "N/A" },
            { label: "Size",            value: memoryInfo.length > 0 ? `${totalMemoryGb} GB` : "Scanning..." },
            { label: "Type",            value: firstModule?.memory_type  || "Scanning..." },
            { label: "Clock Frequency", value: firstModule ? `${firstModule.speed_mhz} MT/s` : "Scanning..." },
            { label: "Serial Number",   value: firstModule?.serial       || "N/A" },
            { label: "Total Slots",     value: memoryInfo.length > 0 ? `${memoryInfo.length}` : "Scanning..." },
            { label: "Installed Slots", value: memoryInfo.length > 0 ? `${populatedSlots}` : "Scanning..." },
          ]}
        />

        {/* Storage — primary drive, labels matched to Storage.py keys */}
        <InfoCard
          icon={HardDrive}
          title="Storage"
          items={[
            { label: "Manufacturer",      value: primaryDrive?.model ? (primaryDrive.model.split(" ")[0] || "Unknown") : "Scanning..." },
            { label: "Part Number/Model", value: primaryDrive?.model        || "Scanning..." },
            { label: "Size",              value: primaryDrive ? `${primaryDrive.size_gb.toFixed(0)} GB` : "Scanning..." },
            { label: "Type",              value: primaryDrive?.storage_type || "Scanning..." },
            { label: "Serial Number",     value: primaryDrive?.serial       || "N/A" },
            { label: "Locator",           value: primaryDrive?.device       || "N/A" },
            { label: "Bank Location",     value: primaryDrive?.slot          || "N/A" },
          ]}
        />

        {/* Battery — live from sysfs (mirrors Battery.py): identity, capacities, health */}
        <InfoCard
          icon={Battery}
          title="Battery"
          status="ok"
          items={[
            { label: "Manufacturer",  value: batteryInfo?.manufacturer  || "Scanning..." },
            { label: "Model Number",  value: batteryInfo?.model          || "N/A" },
            { label: "Composition",   value: batteryInfo?.technology     || "N/A" },
            { label: "Serial Number", value: batteryInfo?.serial_number  || "N/A" },
            {
              label: "Energy Full",
              value: batteryInfo ? `${batteryInfo.full_charge_capacity_wh.toFixed(1)} Wh` : "Scanning...",
            },
            {
              label: "Energy Design",
              value: batteryInfo ? `${batteryInfo.design_capacity_wh.toFixed(1)} Wh` : "Scanning...",
            },
            {
              label: "Wear Level",
              value: batteryInfo ? `${Math.max(0, 100 - batteryInfo.health_percent).toFixed(1)}%` : "Scanning...",
            },
            {
              label: "Cycle Count",
              value: batteryInfo ? batteryInfo.cycle_count.toString() : "Scanning...",
            },
            {
              label: "Battery Health",
              value: batteryInfo ? `${batteryInfo.health_percent.toFixed(1)}%` : "Scanning...",
            },
            { label: "Status", value: batteryInfo?.status || "N/A" },
          ]}
        />

      </div>


      {/* ── Row 2: Peripheral / connectivity cards ────────────────────────── */}
      {/* Display · GPU · Network · Audio · Camera — all live from the scan.  */}
      <div className="grid grid-cols-5 gap-4 mt-4">

        {/* Display — live panel info from EDID/xrandr (mirrors Display.py) */}
        <InfoCard
          icon={Monitor}
          title="Display"
          items={[
            { label: "Manufacturer",     value: displayInfo?.manufacturer      || "Scanning..." },
            { label: "Product Code",     value: displayInfo?.model             || "N/A" },
            { label: "Model Number",     value: displayInfo?.panel_part_number || "N/A" },
            { label: "Size",             value: displayInfo?.size || (displayInfo?.size_inches ? `${displayInfo.size_inches}"` : "N/A") },
            { label: "Resolution",       value: displayInfo?.resolution        || "Scanning..." },
            { label: "Refresh Rate",     value: displayInfo?.refresh_rate      || "N/A" },
            { label: "Aspect Ratio",     value: displayInfo?.aspect_ratio      || "N/A" },
            { label: "Touchscreen",      value: displayInfo?.touchscreen       || "N/A" },
            { label: "Manufacture Year", value: displayInfo?.manufacture_year  || "N/A" },
          ]}
        />

        {/* GPU — static placeholder values; Save button writes them to Supabase */}
        <div className="space-y-2">
          <InfoCard
            icon={CircuitBoard}
            title="GPU"
            items={gpuCardItems}
          />

          {/* Save → insert the GPU values into Supabase tbl_GPU, then popup */}
          <button
            onClick={handleSaveGpu}
            disabled={savingGpu}
            className="w-full text-xs px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white transition-colors"
          >
            {savingGpu ? "Saving..." : "Save"}
          </button>
        </div>

        {/* Network — dynamic data from networkInfo state */}
        <InfoCard
          icon={Wifi}
          title="Network"
          items={[
            { label: "WiFi",      value: networkInfo?.wifi_friendly      || "Scanning..." },
            { label: "WiFi MAC",  value: networkInfo?.wifi_mac           || "N/A" },
            { label: "LAN",       value: networkInfo?.ethernet_friendly  || "Not Present" },
            { label: "LAN MAC",   value: networkInfo?.ethernet_mac       || "Not Present" },
            { label: "Bluetooth", value: networkInfo?.bluetooth ? "Yes"  : "No" },
          ]}
        />

        {/* Audio — live audio controller via lspci (mirrors Audio.py) */}
        <InfoCard
          icon={Speaker}
          title="Audio"
          items={[
            { label: "Manufacturer", value: audioInfo?.manufacturer || "Scanning..." },
            { label: "Model",        value: audioInfo?.model        || "Scanning..." },
          ]}
        />

        {/* Camera — live webcam via v4l2/lsusb (mirrors Webcam.py) */}
        <InfoCard
          icon={Camera}
          title="Camera"
          items={[
            { label: "Manufacturer", value: cameraInfo?.vendor || "Scanning..." },
            { label: "Model",        value: cameraInfo?.model  || "Scanning..." },
            { label: "Status",       value: cameraInfo?.status || "N/A" },
          ]}
        />

        {/* Motherboard — baseboard + BIOS from sysfs DMI (mirrors Motherboard.py) */}
        <InfoCard
          icon={CircuitBoard}
          title="Motherboard"
          items={[
            { label: "Manufacturer",  value: motherboardInfo?.manufacturer  || "Scanning..." },
            { label: "Model",         value: motherboardInfo?.model         || "Scanning..." },
            { label: "Revision",      value: motherboardInfo?.revision      || "N/A" },
            { label: "Serial Number", value: motherboardInfo?.serial_number || "N/A" },
            { label: "BIOS Version",  value: motherboardInfo?.bios_version  || "N/A" },
            { label: "BIOS Date",     value: motherboardInfo?.bios_date     || "N/A" },
            { label: "BIOS Vendor",   value: motherboardInfo?.bios_vendor   || "N/A" },
          ]}
        />

        {/* Bluetooth — adapter via lsusb/lspci (mirrors Bluetooth.py) */}
        <InfoCard
          icon={Bluetooth}
          title="Bluetooth"
          items={[
            { label: "Manufacturer", value: bluetoothInfo?.manufacturer || "Scanning..." },
            { label: "Model",        value: bluetoothInfo?.model        || "Scanning..." },
          ]}
        />

      </div>

    </div>
  );
}