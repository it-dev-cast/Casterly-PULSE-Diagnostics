import { useEffect, type ReactNode } from "react";
import { useInspection } from "../../context/InspectionContext";

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
    return <span className="text-slate-400">N/A</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-slate-400">No entries</span>;
    }

    return (
      <div className="space-y-3">
        {value.map((entry, idx) => (
          <div key={idx} className="rounded-lg bg-slate-50 p-3">
            <div className="text-[11px] text-slate-500 mb-2">Item {idx + 1}</div>
            {typeof entry === "object" && entry !== null ? (
              <div className="grid gap-1">
                {Object.entries(entry).map(([field, fieldValue]) => (
                  <div key={field} className="grid grid-cols-[200px_1fr] gap-4 py-0.5">
                    <div className="text-[11px] text-slate-500">{prettyKey(field)}</div>
                    <div className="text-sm text-slate-800">{renderValue(fieldValue)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-800">{String(entry)}</div>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return <span className="text-slate-400">No data</span>;
    }

    return (
      <div className="grid gap-1">
        {entries.map(([field, fieldValue]) => (
          <div key={field} className="grid grid-cols-[200px_1fr] gap-4 py-0.5">
            <div className="text-[11px] text-slate-500">{prettyKey(field)}</div>
            <div className="text-sm text-slate-800">{renderValue(fieldValue)}</div>
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
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
          {value ? "Collected" : "Missing"}
        </span>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        {renderValue(value)}
      </div>
    </section>
  );
}

export function HardwareInventory({ onNext, isExecutionActive }: HardwareInventoryProps) {
  const { data } = useInspection();

  const sections = [
    { title: "System Info", value: data.systemInfo },
    { title: "CPU Info", value: data.cpuInfo },
    { title: "Memory Info", value: data.memoryInfo },
    { title: "Storage Info", value: data.storageInfo },
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

    const timer = setTimeout(() => {
      onNext();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onNext, isExecutionActive]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-6">
        <div>
          <h1 className="text-slate-800">Hardware Inventory</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            All collected hardware details from the system scan are shown below.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-4 bg-slate-50 border-b border-slate-200">
          <p className="text-sm text-slate-600">
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
