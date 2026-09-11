// System Scan: ten concurrent hardware collectors. Storage sends basic disk data
// through a Tauri channel before optional health enrichment. Named collectors
// settle in finally; only all-terminal results mark the shared scan complete.
// Cached completed scans restore on mount. Re-scan reloads the page.

// ─────────────────────────────────────────────────────────────────────────────
// Imports
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useRef } from "react";
import { useInspection } from "../../context/InspectionContext";
import { normalizeCapacity } from "../../utils/capacity";
import { REQUIRED_SCANNERS, isScanComplete, storageFallback, settleScanner } from "../../utils/scanState";
import type { Scanner, StorageState } from "../../utils/scanState";

// Tauri IPC bridge — invoke() calls a named Rust command in src-tauri/
import { Channel, invoke } from "@tauri-apps/api/core";

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


// Existing per-page guard: reset by Re-scan/reload.
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
  status?: "ok" | "warn" | "critical" | "scanning" | "unavailable" | "failed";       // Controls the badge color/label
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
    scanning: "bg-blue-500/15 text-blue-300",
    unavailable: "bg-amber-500/15 text-amber-300",
    failed: "bg-red-500/15 text-red-300",
  };

  // Human-readable label shown inside the badge
  const statusLabel = {
    ok:       "Detected",
    warn:     "Warning",
    critical: "Critical",
    scanning: "Scanning",
    unavailable: "Unavailable",
    failed: "Failed",
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

  // Each named scanner settles exactly once; storage must also be terminal.
  const [settledScanners, setSettledScanners] = useState<Set<Scanner>>(new Set());
  const [storageState, setStorageState] = useState<StorageState>("pending");
  const completedCalls = settledScanners.size;
  const scanComplete = isScanComplete(settledScanners, storageState);
  const markSettled = (scanner: Scanner) => setSettledScanners(prev => new Set([...prev, scanner]));

  // ─────────────────────────────────────────────────────────────────────────
  // Refs
  // ─────────────────────────────────────────────────────────────────────────

  // Prevents onNext() from being called more than once if completedCalls
  // changes after completion (e.g. due to React strict mode double effects).
  const autoAdvanced = useRef(false);

  // ─────────────────────────────────────────────────────────────────────────
  // InspectionContext — shared data store across wizard steps
  // ─────────────────────────────────────────────────────────────────────────
  const { data, setData } = useInspection();


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
    setSettledScanners(new Set(REQUIRED_SCANNERS));
    setStorageState(data.storageInfo?.length ? "completed" : "unavailable");

  }, []); // Empty deps — intentionally runs only on initial mount


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
    void settleScanner(
      () => invoke<SystemInfo>("get_system_info"),
      (result) => {
        console.log("System Info:", result);
        setSystemInfo(result);
        setData(prev => ({ ...prev, systemInfo: result }));
      },
      (err) => {
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
      },
      () => markSettled("system"),
    );

    // ── Call 2: CPU Info ───────────────────────────────────────────────────
    // Returns processor model, core/thread counts, speed, cache, etc.
    void settleScanner(
      () => invoke<CpuInfo>("get_cpu_info"),
      (result) => {
        console.log("CPU INFO:", result);
        setCpuInfo(result);
        setData(prev => ({ ...prev, cpuInfo: result }));
      },
      (err) => {
        console.error("CPU ERROR:", err);
      },
      () => markSettled("cpu"),
    );

    // ── Call 3: Battery Info ───────────────────────────────────────────────
    // Returns null on systems without a battery (e.g. desktops).
    // The null check before setBatteryInfo prevents overwriting a valid state
    // with null if the command succeeds but the device has no battery.
    void settleScanner(
      () => invoke<BatteryInfo | null>("get_battery_info"),
      (result) => {
        console.log("BATTERY INFO:", result);
        if (result) setBatteryInfo(result);
        setData(prev => ({ ...prev, batteryInfo: result }));
      },
      (err) => {
        console.error("BATTERY ERROR:", err);
      },
      () => markSettled("battery"),
    );

    // ── Call 4: GPU Info ───────────────────────────────────────────────────
    void settleScanner(
      () => invoke<GpuInfo[]>("get_gpu_info"),
      (result) => {
        console.log("GPU INFO:", result);
        setGpuInfo(result);
        setData(prev => ({ ...prev, gpuInfo: result }));
      },
      (err) => {
        console.error("GPU ERROR:", err);
      },
      () => markSettled("gpu"),
    );

    // ── Call 5: Display Info ───────────────────────────────────────────────
    void settleScanner(
      () => invoke<DisplayInfo | null>("get_display_info"),
      (result) => {
        console.log("DISPLAY INFO:", result);
        setDisplayInfo(result);
        setData(prev => ({ ...prev, displayInfo: result }));
      },
      (err) => {
        console.error("DISPLAY ERROR:", err);
      },
      () => markSettled("display"),
    );

    // ── Call 6: Network Info ───────────────────────────────────────────────
    // Returns Wi-Fi adapter name/MAC, Ethernet adapter name/MAC, Bluetooth flag.
    void settleScanner(
      () => invoke<NetworkInfo>("get_network_info"),
      (result) => {
        console.log("NETWORK INFO:", result);
        setNetworkInfo(result);
        setData(prev => ({ ...prev, networkInfo: result }));
      },
      (err) => {
        console.error("NETWORK ERROR:", err);
      },
      () => markSettled("network"),
    );

    // ── Call 7: Memory Info ────────────────────────────────────────────────
    // Returns an array of MemoryModule — one entry per physical DIMM slot.
    // Slots with is_empty = true are counted but have no data to display.
    void settleScanner(
      () => invoke<MemoryModule[]>("get_memory_info"),
      (result) => {
        console.log("MEMORY INFO:", result);
        setMemoryInfo(result);
        setData(prev => ({ ...prev, memoryInfo: result }));
      },
      (err) => {
        console.error("MEMORY ERROR:", err);
      },
      () => markSettled("memory"),
    );

    // ── Call 8: Storage Info ───────────────────────────────────────────────
    setStorageState("running");
    let storageFinished = false;
    const onProgress = new Channel<StorageDevice[]>();
    onProgress.onmessage = (result) => {
      if (storageFinished) return; // Never let late basic data overwrite final health.
      setStorageInfo(result);
      setData(prev => ({ ...prev, storageInfo: result }));
    };
    void settleScanner(
      () => invoke<StorageDevice[]>("get_storage_info", { onProgress }),
      (result) => {
        storageFinished = true;
        setStorageState(result.length ? "completed" : "unavailable");
        setStorageInfo(result);
        setData(prev => ({
          ...prev,
          storageInfo: result,
        }));
      },
      (err) => {
        storageFinished = true;
        setStorageState("failed");
        console.error("STORAGE ERROR:", err);
      },
      () => markSettled("storage"),
    );
    // ── Call 9: Camera Info ───────────────────────────────────────────────
    void settleScanner(
      () => invoke<CameraInfo | null>("get_camera_info"),
      (result) => {
        console.log("CAMERA INFO:", result);

        setCameraInfo(result);

        setData((prev) => ({
          ...prev,
          cameraInfo: result,
        }));
      },
      (err) => {
        console.error("CAMERA ERROR:", err);
      },
      () => markSettled("camera"),
    );

    // ── Call 10: Audio Info ───────────────────────────────────────────────
    void settleScanner(
      () => invoke<AudioInfo | null>("get_audio_info"),
      (result) => {
        console.log("AUDIO INFO:", result);
        setAudioInfo(result);
        setData((prev) => ({
          ...prev,
          audioInfo: result,
        }));
      },
      (err) => {
        console.error("AUDIO ERROR:", err);
      },
      () => markSettled("audio"),
    );

  }, [isExecutionActive]); // Re-evaluates if this stage becomes active after a premature, non-active mount


  useEffect(() => {

    // Only push the workflow forward when this stage is the active execution
    // step. Clicking back to review a completed scan should not re-trigger the
    // next stage.
    if (
      scanComplete &&
      !autoAdvanced.current &&
      isExecutionActive
    ) {
      autoAdvanced.current = true;
      setData(prev => ({ ...prev, scanCompleted: true, scanTimestamp: Date.now() }));
      console.log("SYSTEM SCAN COMPLETE");
      onNext();
    }

  }, [scanComplete, onNext, isExecutionActive, setData]);


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
  const storageMissing = storageFallback(storageState, !!primaryDrive);

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

          {/* Scan progress badge — switches only when every scanner is terminal */}
          <div className="flex items-center gap-1.5 text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-3 py-1.5 rounded-lg">
            <CheckCircle2 size={13} />
            {scanComplete
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
          status={storageState === "failed" ? "failed" : primaryDrive ? "ok" : storageState === "unavailable" ? "unavailable" : "scanning"}
          items={[
            { label: "Type", value: primaryDrive?.storage_type || storageMissing },
            { label: "Model", value: primaryDrive?.model || storageMissing },
            { label: "Serial", value: primaryDrive?.serial || storageMissing },
            { label: "Capacity", value: primaryDrive?.capacity_gb || (primaryDrive && primaryDrive.size_gb > 0 && normalizeCapacity(primaryDrive.size_gb)) || storageMissing },
            { label: "Firmware", value: primaryDrive?.firmware || "Unavailable" },
            { label: "Transport", value: primaryDrive?.transport || "Unavailable" },
            { label: "Health", value: primaryDrive?.health_percent != null ? `${primaryDrive.health_percent}%` : "Unavailable" },
            { label: "Temp", value: primaryDrive?.temperature_c != null ? `${primaryDrive.temperature_c}°C` : "Unavailable" },
            { label: "Power On", value: primaryDrive?.power_on_hours != null ? `${primaryDrive.power_on_hours}h` : "Unavailable" },
            { label: "Device", value: primaryDrive?.device || "Unavailable" },
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