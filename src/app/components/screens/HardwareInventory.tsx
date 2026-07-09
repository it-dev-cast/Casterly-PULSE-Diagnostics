import { useEffect, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useInspection } from "../../context/InspectionContext";
import { normalizeCapacity } from "../../utils/capacity";

interface HardwareInventoryProps {
  onNext: () => void;
  isExecutionActive: boolean; // Only auto-advance when this is the active workflow step
}

function prettyKey(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function renderValue(value: any): ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-slate-500">N/A</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-slate-500">No entries</span>;
    }

    return (
      <div className="space-y-3">
        {value.map((entry, idx) => (
          <div key={idx} className="rounded-lg bg-[#0d1b30] p-3">
            <div className="text-[11px] text-slate-500 mb-2">Item {idx + 1}</div>
            {typeof entry === "object" && entry !== null ? (
              <div className="grid gap-1">
                {Object.entries(entry).map(([field, fieldValue]) => (
                  <div key={field} className="grid grid-cols-[200px_1fr] gap-4 py-0.5">
                    <div className="text-[11px] text-slate-500">{prettyKey(field)}</div>
                    <div className="text-sm text-slate-100">{renderValue(fieldValue)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-100">{String(entry)}</div>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return <span className="text-slate-500">No data</span>;
    }

    return (
      <div className="grid gap-1">
        {entries.map(([field, fieldValue]) => (
          <div key={field} className="grid grid-cols-[200px_1fr] gap-4 py-0.5">
            <div className="text-[11px] text-slate-500">{prettyKey(field)}</div>
            <div className="text-sm text-slate-100">{renderValue(fieldValue)}</div>
          </div>
        ))}
      </div>
    );
  }

  return <span>{String(value)}</span>;
}

function renderSection(title: string, value: any) {
  return (
    <section key={title} className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
        <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
          {value ? "Collected" : "Missing"}
        </span>
      </div>
      <div className="rounded-2xl border border-[#1c3f66] bg-[#0d1b30] p-4">
        {renderValue(value)}
      </div>
    </section>
  );
}

export function HardwareInventory({ onNext, isExecutionActive }: HardwareInventoryProps) {
  const { data, setData } = useInspection();

  // Display-only: mirror the System Scan screen's Storage "Capacity" logic
  // (prefer a pre-computed capacity_gb, otherwise normalize the raw size_gb
  // into a marketed capacity like "512 GB") so this screen shows the same
  // size figure instead of the raw GiB number. The underlying data.storageInfo
  // used for saving/reporting is untouched.
  const storageInfoDisplay = Array.isArray(data.storageInfo)
    ? data.storageInfo.map((d: any) => ({
        ...d,
        size_gb: d
          ? d.capacity_gb || normalizeCapacity(d.size_gb)
          : d?.size_gb,
      }))
    : data.storageInfo;

  const sections = [
    { title: "System Info", value: data.systemInfo },
    { title: "CPU Info", value: data.cpuInfo },
    { title: "Memory Info", value: data.memoryInfo },
    { title: "Storage Info", value: storageInfoDisplay },
    { title: "Battery Info", value: data.batteryInfo },
    { title: "Network Info", value: data.networkInfo },
    { title: "Display Info", value: data.displayInfo },
    { title: "GPU Info", value: data.gpuInfo },
    { title: "Camera Info", value: data.cameraInfo },
    { title: "Audio Info", value: data.audioInfo },
    {
      title: "Scan Metadata",
      value: {
        scanCompleted: data.scanCompleted,
        scanTimestamp: data.scanTimestamp,
        inspectionStartTime: data.inspectionStartTime,
      },
    },
  ];

  useEffect(() => {
    // Only auto-advance when this is the currently active execution step. If the
    // user clicked back to review the inventory, the timeout should not advance
    // the workflow again.
    if (!isExecutionActive) {
      return;
    }

    // Mirror every collected hardware category into its own reporting table
    // (keyed on uuid + serial_number) as this step hands off to Manual
    // Grading. The inspection UUID is generated once here (if not already
    // set) and reused later by Save Inspection so both share the same id.
    const uuid = data.uuid || crypto.randomUUID();
    if (!data.uuid) {
      setData((prev) => ({ ...prev, uuid }));
    }

    const serialNumber = data.systemInfo?.serial_number || "";
    if (serialNumber) {
      invoke("save_hardware_inventory", {
        uuid,
        serialNumber,
        systemInfo: data.systemInfo,
        cpuInfo: data.cpuInfo,
        memoryInfo: data.memoryInfo,
        storageInfo: data.storageInfo,
        batteryInfo: data.batteryInfo,
        networkInfo: data.networkInfo,
        displayInfo: data.displayInfo,
        gpuInfo: data.gpuInfo,
        cameraInfo: data.cameraInfo,
        audioInfo: data.audioInfo,
      }).catch((err) => {
        console.error("Failed to save hardware inventory report tables:", err);
      });
    } else {
      console.warn(
        "Skipping hardware inventory report save: no serial number collected yet.",
      );
    }

    const timer = setTimeout(() => {
      onNext();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onNext, isExecutionActive]);

  return (
    <div className="-m-6 p-6 min-h-[calc(100vh-6rem)] bg-[#0a1626] space-y-5">
      <div className="flex items-center justify-between gap-6">
        <div>
          <h1 className="text-slate-100">Hardware Inventory</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            All collected hardware details from the system scan are shown below.
          </p>
        </div>
      </div>

      <div className="bg-[#0f1e35] rounded-2xl border border-[#1c3f66] overflow-hidden">
        <div className="px-4 py-4 bg-[#0d1b30] border-b border-[#1c3f66]">
          <p className="text-sm text-slate-300">
            Scroll to review every detected hardware property, including values not shown
            on the summary cards.
          </p>
        </div>

        <div className="max-h-[calc(100vh-16rem)] overflow-y-auto px-4 py-4 space-y-6">
          {sections.map((section) => renderSection(section.title, section.value))}
        </div>
      </div>
    </div>
  );
}
