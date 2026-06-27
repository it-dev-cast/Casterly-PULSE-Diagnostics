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
import { useState } from "react";

type UploadStatus = "uploaded" | "pending" | "failed";

interface Inspection {
  id: string;
  serialNumber: string;
  model: string;
  inspectionDate: string;
  uploadStatus: UploadStatus;
  result?: "passed" | "failed";
}

const allInspections: Inspection[] = [
  {
    id: "1",
    serialNumber: "5CD124NJWZ",
    model: "HP ProBook 440 G8",
    inspectionDate: "2026-06-15 10:23",
    uploadStatus: "uploaded",
    result: "passed",
  },
  {
    id: "2",
    serialNumber: "5CD125PQRS",
    model: "HP ProBook 440 G8",
    inspectionDate: "2026-06-15 10:15",
    uploadStatus: "uploaded",
    result: "passed",
  },
  {
    id: "3",
    serialNumber: "5CD126TUVW",
    model: "HP EliteBook 840 G7",
    inspectionDate: "2026-06-15 10:08",
    uploadStatus: "pending",
    result: "failed",
  },
  {
    id: "4",
    serialNumber: "5CD127XYZA",
    model: "HP ProBook 450 G8",
    inspectionDate: "2026-06-15 09:58",
    uploadStatus: "pending",
    result: "passed",
  },
  {
    id: "5",
    serialNumber: "5CD128BCDE",
    model: "HP ProBook 440 G8",
    inspectionDate: "2026-06-15 09:45",
    uploadStatus: "failed",
    result: "passed",
  },
  {
    id: "6",
    serialNumber: "5CD129FGHI",
    model: "HP EliteBook 830 G8",
    inspectionDate: "2026-06-14 16:30",
    uploadStatus: "uploaded",
    result: "passed",
  },
  {
    id: "7",
    serialNumber: "5CD130JKLM",
    model: "HP ProBook 440 G8",
    inspectionDate: "2026-06-14 15:55",
    uploadStatus: "pending",
    result: "passed",
  },
];

interface ActiveLOTSummaryProps {
  onStartInspection: () => void;
  onViewHistory: () => void;
  onViewUploadQueue: () => void;
}

function UploadBadge({ status }: { status: UploadStatus }) {
  if (status === "uploaded") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
        <CheckCircle2 size={11} />
        Uploaded
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-orange-700 bg-orange-100 px-2 py-0.5 rounded">
        <Clock size={11} />
        Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded">
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
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  const totalStored = allInspections.length;
  const pendingCount = allInspections.filter((i) => i.uploadStatus === "pending").length;
  const uploadedCount = allInspections.filter((i) => i.uploadStatus === "uploaded").length;
  const failedCount = allInspections.filter((i) => i.uploadStatus === "failed").length;

  const filtered = allInspections.filter((i) => {
    const matchesSearch =
      search === "" ||
      i.serialNumber.toLowerCase().includes(search.toLowerCase()) ||
      i.model.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === "all" || i.uploadStatus === filter;
    return matchesSearch && matchesFilter;
  });

  const filterButtons: { key: FilterType; label: string; count: number }[] = [
    { key: "all", label: "Current LOT Only", count: totalStored },
    { key: "pending", label: "Pending Upload", count: pendingCount },
    { key: "uploaded", label: "Uploaded", count: uploadedCount },
    { key: "failed", label: "Failed Upload", count: failedCount },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-800">LOT Workspace</h1>
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

      {/* LOT Identity Card */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h3 className="text-slate-700 mb-4">LOT Details</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
              <Package size={20} className="text-purple-600" />
            </div>
            <div>
              <div className="text-xs text-slate-500">LOT ID</div>
              <div className="text-sm text-slate-700 font-medium font-mono mt-0.5">CLY-003</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <Building2 size={20} className="text-blue-600" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Customer</div>
              <div className="text-sm text-slate-700 font-medium mt-0.5">Dell Technologies</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <Calendar size={20} className="text-slate-600" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Created Date</div>
              <div className="text-sm text-slate-700 font-medium mt-0.5">2026-06-07</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
              <User size={20} className="text-emerald-600" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Current Inspector</div>
              <div className="text-sm text-slate-700 font-medium mt-0.5">Ravikiran K.</div>
            </div>
          </div>
        </div>
      </div>

      {/* USB-Local Statistics Only */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <HardDrive size={16} className="text-slate-500" />
          <h3 className="text-slate-700">This USB — Local Statistics</h3>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive size={16} className="text-blue-600" />
              <span className="text-xs text-slate-500">Stored on USB</span>
            </div>
            <div className="text-2xl text-slate-800 leading-none">{totalStored}</div>
            <div className="text-xs text-slate-400 mt-1">inspections locally</div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={16} className="text-orange-500" />
              <span className="text-xs text-slate-500">Pending Upload</span>
            </div>
            <div className="text-2xl text-orange-600 leading-none">{pendingCount}</div>
            <div className="text-xs text-slate-400 mt-1">awaiting sync</div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <span className="text-xs text-slate-500">Uploaded Records</span>
            </div>
            <div className="text-2xl text-emerald-600 leading-none">{uploadedCount}</div>
            <div className="text-xs text-slate-400 mt-1">synced to cloud</div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <XCircle size={16} className="text-red-500" />
              <span className="text-xs text-slate-500">Failed Uploads</span>
            </div>
            <div className="text-2xl text-red-500 leading-none">{failedCount}</div>
            <div className="text-xs text-slate-400 mt-1">need retry</div>
          </div>
        </div>
      </div>

      {/* Inspections Table */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-slate-700">Inspections</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Records stored on this USB device
              </p>
            </div>
            <button
              onClick={onViewHistory}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-500"
            >
              <History size={14} />
              View All History
            </button>
          </div>

          {/* Search and Filters */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search serial or model…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
            <div className="flex items-center gap-1">
              <Filter size={13} className="text-slate-400 mr-1" />
              {filterButtons.map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    filter === key
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {label}
                  <span
                    className={`ml-1.5 px-1 py-0.5 rounded text-xs ${
                      filter === key ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-500"
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
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs text-slate-500 px-4 py-3">Serial Number</th>
                <th className="text-left text-xs text-slate-500 px-4 py-3">Model</th>
                <th className="text-left text-xs text-slate-500 px-4 py-3">Inspection Date</th>
                <th className="text-left text-xs text-slate-500 px-4 py-3">Upload Status</th>
                <th className="text-left text-xs text-slate-500 px-4 py-3">Result</th>
                <th className="text-left text-xs text-slate-500 px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                    No inspections match your search or filter.
                  </td>
                </tr>
              ) : (
                filtered.map((inspection) => (
                  <tr
                    key={inspection.id}
                    className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-slate-700">{inspection.serialNumber}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{inspection.model}</td>
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
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                          <CheckCircle2 size={11} />
                          Passed
                        </span>
                      ) : inspection.result === "failed" ? (
                        <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded">
                          <XCircle size={11} />
                          Failed
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-xs text-blue-600 hover:text-blue-500 flex items-center gap-1">
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

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onViewHistory}
          className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg p-3 flex items-center gap-3 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
            <History size={20} className="text-slate-600" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-medium">View History</div>
            <div className="text-xs text-slate-500">All inspections on this USB</div>
          </div>
        </button>

        <button
          onClick={onViewUploadQueue}
          className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg p-3 flex items-center gap-3 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
            <Upload size={20} className="text-orange-600" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-medium">View Upload Queue</div>
            <div className="text-xs text-slate-500">{pendingCount + failedCount} records need attention</div>
          </div>
        </button>
      </div>

      {/* USB scope information banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <HardDrive size={18} className="text-slate-500 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm text-slate-700 font-medium">USB-Local Data Only</div>
            <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              This USB device only displays inspections stored locally. Complete LOT statistics and refurbishment decisions are available in the Cloud Command Center.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
