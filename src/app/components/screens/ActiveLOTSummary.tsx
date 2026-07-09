import {
  Package,
  Calendar,
  User,
  Upload,
  Play,
  History,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Building2,
  HardDrive,
  Search,
  Filter,
  ExternalLink,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type UploadStatus = "uploaded" | "pending" | "failed";

// Mirrors the InspectionRow struct returned by the Rust `get_inspections`
// command (dashboard.rs).
interface InspectionRow {
  id: number;
  uuid: string;
  serial: string;
  manufacturer: string;
  model: string;
  inspector: string;
  lot: string;
  timestamp: string;
  grade: string;
  uploaded: boolean;
}

// Mirrors the QueueItem struct returned by `get_upload_queue` -- used here
// only to resolve the granular PENDING/UPLOADED/FAILED status per record.
interface QueueItem {
  id: number;
  inspectionUuid: string;
  status: string;
  retryCount: number;
  createdAt: string;
  uploadedAt: string | null;
  serial: string;
  model: string;
}

interface QueueData {
  items: QueueItem[];
  pending: number;
  uploaded: number;
  failed: number;
}

// Mirrors the DashboardData struct returned by `get_dashboard`.
interface DashboardData {
  usb: {
    usbId: string;
    version: string;
    lastSync: string;
    pendingUpload: number;
    storedLocally: number;
  };
  operator: {
    inspector: string;
    employeeId: string;
    loginStatus: string;
    lastLogin: string;
  };
  lot: {
    lotId: string;
    created: string;
    inspector: string;
    customer: string;
  } | null;
  totalToday: number;
  passed: number;
  failed: number;
  passRate: number;
  failRate: number;
}

interface Inspection {
  id: string;
  uuid: string;
  serialNumber: string;
  model: string;
  inspectionDate: string;
  uploadStatus: UploadStatus;
  result: "passed" | "failed";
}

interface ActiveLOTSummaryProps {
  onStartInspection: () => void;
  onViewHistory: () => void;
  onViewUploadQueue: () => void;
}

function UploadBadge({ status }: { status: UploadStatus }) {
  if (status === "uploaded") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded">
        <CheckCircle2 size={11} />
        Uploaded
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-orange-300 bg-orange-500/15 px-2 py-0.5 rounded">
        <Clock size={11} />
        Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-red-300 bg-red-500/15 px-2 py-0.5 rounded">
      <XCircle size={11} />
      Failed
    </span>
  );
}

type FilterType = "all" | "pending" | "uploaded" | "failed";

export function ActiveLOTSummary({
  onStartInspection,
  onViewHistory,
  onViewUploadQueue,
}: ActiveLOTSummaryProps) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dash, rows, queue] = await Promise.all([
        invoke<DashboardData>("get_dashboard"),
        invoke<InspectionRow[]>("get_inspections"),
        invoke<QueueData>("get_upload_queue"),
      ]);

      const queueStatus = new Map<string, string>();
      for (const item of queue.items) {
        queueStatus.set(item.inspectionUuid, item.status.toLowerCase());
      }

      // Scope this workspace to the currently active LOT only (PRD:
      // "real-time view of the current LOT's progress").
      const currentLot = dash.lot?.lotId ?? null;
      const scoped = currentLot
        ? rows.filter((r) => r.lot === currentLot)
        : rows;

      const mapped: Inspection[] = scoped.map((r) => {
        const rawStatus = queueStatus.get(r.uuid);
        const uploadStatus: UploadStatus =
          rawStatus === "pending" || rawStatus === "failed" || rawStatus === "uploaded"
            ? rawStatus
            : r.uploaded
            ? "uploaded"
            : "pending";

        return {
          id: String(r.id),
          uuid: r.uuid,
          serialNumber: r.serial || "--",
          model: r.model || "--",
          inspectionDate: r.timestamp,
          uploadStatus,
          result: r.grade === "C" ? "failed" : "passed",
        };
      });

      setDashboard(dash);
      setInspections(mapped);
    } catch (err) {
      console.error("Failed to load LOT workspace data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleView = async (inspection: Inspection) => {
    try {
      const json = await invoke<string>("get_inspection_detail", {
        uuid: inspection.uuid,
      });
      try {
        setDetail(JSON.stringify(JSON.parse(json), null, 2));
      } catch {
        setDetail(json);
      }
    } catch (err) {
      alert(`Failed to load record: ${err}`);
    }
  };

  const totalStored = inspections.length;
  const pendingCount = inspections.filter((i) => i.uploadStatus === "pending").length;
  const uploadedCount = inspections.filter((i) => i.uploadStatus === "uploaded").length;
  const failedCount = inspections.filter((i) => i.uploadStatus === "failed").length;

  const filtered = inspections.filter((i) => {
    const matchesSearch =
      search === "" ||
      i.serialNumber.toLowerCase().includes(search.toLowerCase()) ||
      i.model.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || i.uploadStatus === filter;
    return matchesSearch && matchesFilter;
  });

  const filterButtons: { key: FilterType; label: string; count: number }[] = [
    { key: "all", label: "Current LOT Only", count: totalStored },
    { key: "pending", label: "Pending Upload", count: pendingCount },
    { key: "uploaded", label: "Uploaded", count: uploadedCount },
    { key: "failed", label: "Failed Upload", count: failedCount },
  ];

  const lot = dashboard?.lot ?? null;

  return (
    <div className="-m-6 p-6 min-h-[calc(100vh-6rem)] bg-[#0a1626] space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-100">LOT Workspace</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Active workspace for collecting and uploading inspections
          </p>
        </div>
        <button
          onClick={onStartInspection}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg transition-colors"
        >
          <Play size={16} />
          Start New Inspection
        </button>
      </div>

      {!loading && !lot && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm text-amber-200 font-medium">No active LOT selected</div>
            <div className="text-xs text-amber-300 mt-0.5">
              Select or create a LOT from LOT Management to see its workspace here.
            </div>
          </div>
        </div>
      )}

      <div className="bg-[#0f1e35] rounded-lg border border-[#1c3f66] p-4">
        <h3 className="text-slate-200 mb-4">LOT Details</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
              <Package size={20} className="text-purple-300" />
            </div>
            <div>
              <div className="text-xs text-slate-500">LOT ID</div>
              <div className="text-sm text-slate-200 font-medium font-mono mt-0.5">
                {loading ? "..." : lot?.lotId ?? "--"}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <Building2 size={20} className="text-blue-400" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Customer</div>
              <div className="text-sm text-slate-200 font-medium mt-0.5">
                {loading ? "..." : lot?.customer || "--"}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#16294a] flex items-center justify-center shrink-0">
              <Calendar size={20} className="text-slate-300" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Created Date</div>
              <div className="text-sm text-slate-200 font-medium mt-0.5">
                {loading ? "..." : lot?.created || "--"}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              <User size={20} className="text-emerald-400" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Current Inspector</div>
              <div className="text-sm text-slate-200 font-medium mt-0.5">
                {loading ? "..." : dashboard?.operator.inspector || "--"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <HardDrive size={16} className="text-slate-500" />
          <h3 className="text-slate-200">This USB -- Local Statistics</h3>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-[#0f1e35] rounded-lg border border-[#1c3f66] p-4">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive size={16} className="text-blue-400" />
              <span className="text-xs text-slate-500">Stored on USB</span>
            </div>
            <div className="text-2xl text-slate-100 leading-none">
              {loading ? "..." : totalStored}
            </div>
            <div className="text-xs text-slate-500 mt-1">inspections locally</div>
          </div>

          <div className="bg-[#0f1e35] rounded-lg border border-[#1c3f66] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={16} className="text-orange-400" />
              <span className="text-xs text-slate-500">Pending Upload</span>
            </div>
            <div className="text-2xl text-orange-400 leading-none">
              {loading ? "..." : pendingCount}
            </div>
            <div className="text-xs text-slate-500 mt-1">awaiting sync</div>
          </div>

          <div className="bg-[#0f1e35] rounded-lg border border-[#1c3f66] p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span className="text-xs text-slate-500">Uploaded Records</span>
            </div>
            <div className="text-2xl text-emerald-400 leading-none">
              {loading ? "..." : uploadedCount}
            </div>
            <div className="text-xs text-slate-500 mt-1">synced to cloud</div>
          </div>

          <div className="bg-[#0f1e35] rounded-lg border border-[#1c3f66] p-4">
            <div className="flex items-center gap-2 mb-2">
              <XCircle size={16} className="text-red-400" />
              <span className="text-xs text-slate-500">Failed Uploads</span>
            </div>
            <div className="text-2xl text-red-400 leading-none">
              {loading ? "..." : failedCount}
            </div>
            <div className="text-xs text-slate-500 mt-1">need retry</div>
          </div>
        </div>
      </div>

      <div className="bg-[#0f1e35] rounded-lg border border-[#1c3f66]">
        <div className="p-4 border-b border-[#1c3f66]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-slate-200">Inspections</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Records stored on this USB device
              </p>
            </div>
            <button
              onClick={onViewHistory}
              className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300"
            >
              <History size={14} />
              View All History
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search serial or model..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-[#1c3f66] rounded-lg bg-[#0d1b30] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-[#132445]"
              />
            </div>
            <div className="flex items-center gap-1">
              <Filter size={13} className="text-slate-500 mr-1" />
              {filterButtons.map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    filter === key
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-[#0f1e35] text-slate-300 border-[#1c3f66] hover:bg-[#132445]"
                  }`}
                >
                  {label}
                  <span
                    className={`ml-1.5 px-1 py-0.5 rounded text-xs ${
                      filter === key ? "bg-blue-500 text-white" : "bg-[#16294a] text-slate-500"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#16294a] bg-[#0d1b30]">
                <th className="text-left text-xs text-slate-500 px-4 py-3">Serial Number</th>
                <th className="text-left text-xs text-slate-500 px-4 py-3">Model</th>
                <th className="text-left text-xs text-slate-500 px-4 py-3">Inspection Date</th>
                <th className="text-left text-xs text-slate-500 px-4 py-3">Upload Status</th>
                <th className="text-left text-xs text-slate-500 px-4 py-3">Result</th>
                <th className="text-left text-xs text-slate-500 px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    Loading...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    No inspections match your search or filter.
                  </td>
                </tr>
              ) : (
                filtered.map((inspection) => (
                  <tr
                    key={inspection.id}
                    className="border-b border-[#16294a] hover:bg-[#132445] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-slate-200">{inspection.serialNumber}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{inspection.model}</td>
                    <td className="px-4 py-3 text-slate-500">
                      <div className="flex items-center gap-1">
                        <Clock size={11} />
                        {inspection.inspectionDate}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <UploadBadge status={inspection.uploadStatus} />
                    </td>
                    <td className="px-4 py-3">
                      {inspection.result === "passed" ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded">
                          <CheckCircle2 size={11} />
                          Passed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-red-300 bg-red-500/10 px-2 py-0.5 rounded">
                          <XCircle size={11} />
                          Failed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleView(inspection)}
                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      >
                        <ExternalLink size={11} />
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onViewHistory}
          className="bg-[#0f1e35] hover:bg-[#132445] text-slate-200 border border-[#1c3f66] rounded-lg p-3 flex items-center gap-3 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-[#16294a] flex items-center justify-center">
            <History size={20} className="text-slate-300" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-medium">View History</div>
            <div className="text-xs text-slate-500">All inspections on this USB</div>
          </div>
        </button>

        <button
          onClick={onViewUploadQueue}
          className="bg-[#0f1e35] hover:bg-[#132445] text-slate-200 border border-[#1c3f66] rounded-lg p-3 flex items-center gap-3 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
            <Upload size={20} className="text-orange-400" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-medium">View Upload Queue</div>
            <div className="text-xs text-slate-500">
              {loading ? "..." : `${pendingCount + failedCount} records need attention`}
            </div>
          </div>
        </button>
      </div>

      <div className="bg-[#0d1b30] border border-[#1c3f66] rounded-lg p-4">
        <div className="flex items-start gap-3">
          <HardDrive size={18} className="text-slate-500 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm text-slate-200 font-medium">USB-Local Data Only</div>
            <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              This USB device only displays inspections stored locally. Complete LOT statistics and refurbishment decisions are available in the Cloud Command Center.
            </div>
          </div>
        </div>
      </div>

      {detail !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f1e35] rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-[#1c3f66] flex items-center justify-between">
              <h3 className="text-slate-100">Inspection Record</h3>
              <button
                onClick={() => setDetail(null)}
                className="text-sm text-slate-500 hover:text-slate-100"
              >
                Close
              </button>
            </div>
            <pre className="p-4 overflow-auto text-xs text-slate-200 font-mono whitespace-pre-wrap">
              {detail}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
