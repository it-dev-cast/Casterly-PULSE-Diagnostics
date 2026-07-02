import { useState } from "react";
import { Search, Filter, Download, Eye, CheckCircle2, Clock, XCircle } from "lucide-react";

type UploadStatus = "uploaded" | "pending" | "failed";

interface Inspection {
  id: string;
  serialNumber: string;
  model: string;
  date: string;
  grade: string;
  inspector: string;
  lot: string;
  status: "Complete" | "In Progress" | "Failed" | "Pending";
  uploadStatus: UploadStatus;
}

const mockInspections: Inspection[] = [
  {
    id: "1",
    serialNumber: "5CD124NJWZ",
    model: "HP ProBook 440 G8",
    date: "2026-06-07 09:14",
    grade: "A",
    inspector: "John Smith",
    lot: "LOT-2026-06-001",
    status: "Complete",
    uploadStatus: "pending",
  },
  {
    id: "2",
    serialNumber: "5CD124NK3P",
    model: "HP ProBook 440 G8",
    date: "2026-06-07 08:45",
    grade: "B",
    inspector: "John Smith",
    lot: "LOT-2026-06-001",
    status: "Complete",
    uploadStatus: "pending",
  },
  {
    id: "3",
    serialNumber: "5CD124NM7T",
    model: "Dell Latitude 5420",
    date: "2026-06-07 08:12",
    grade: "C",
    inspector: "Sarah Johnson",
    lot: "LOT-2026-06-001",
    status: "Complete",
    uploadStatus: "failed",
  },
  {
    id: "4",
    serialNumber: "5CD124NN9R",
    model: "HP ProBook 440 G8",
    date: "2026-06-06 16:33",
    grade: "A",
    inspector: "Mike Davis",
    lot: "LOT-2026-06-001",
    status: "Complete",
    uploadStatus: "uploaded",
  },
  {
    id: "5",
    serialNumber: "5CD124NP2K",
    model: "Lenovo ThinkPad T14",
    date: "2026-06-06 15:48",
    grade: "B",
    inspector: "Sarah Johnson",
    lot: "LOT-2026-06-001",
    status: "Complete",
    uploadStatus: "uploaded",
  },
  {
    id: "6",
    serialNumber: "5CD124NQ5L",
    model: "HP ProBook 440 G8",
    date: "2026-06-06 14:22",
    grade: "D",
    inspector: "John Smith",
    lot: "LOT-2026-05-028",
    status: "Complete",
    uploadStatus: "uploaded",
  },
  {
    id: "7",
    serialNumber: "5CD124NR8M",
    model: "Dell Latitude 5420",
    date: "2026-06-05 11:05",
    grade: "A",
    inspector: "Mike Davis",
    lot: "LOT-2026-05-028",
    status: "Complete",
    uploadStatus: "uploaded",
  },
  {
    id: "8",
    serialNumber: "5CD124NS1N",
    model: "HP ProBook 440 G8",
    date: "2026-06-05 10:17",
    grade: "C",
    inspector: "Sarah Johnson",
    lot: "LOT-2026-05-028",
    status: "Failed",
    uploadStatus: "failed",
  },
];

const statusColors = {
  Complete: "bg-emerald-100 text-emerald-700 border-emerald-200",
  "In Progress": "bg-blue-100 text-blue-700 border-blue-200",
  Failed: "bg-red-100 text-red-700 border-red-200",
  Pending: "bg-slate-100 text-slate-700 border-slate-200",
};

const gradeColors = {
  A: "bg-emerald-100 text-emerald-700",
  B: "bg-blue-100 text-blue-700",
  C: "bg-amber-100 text-amber-700",
  D: "bg-red-100 text-red-700",
  F: "bg-red-200 text-red-800",
};

export function InspectionHistory() {
  const [filter, setFilter] = useState<"all" | "today" | "week" | "month" | "lot" | "duplicates">("all");
  const [searchTerm, setSearchTerm] = useState("");

  const getUploadStatusBadge = (status: UploadStatus) => {
    switch (status) {
      case "uploaded":
        return (
          <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
            <CheckCircle2 size={12} />
            Uploaded
          </span>
        );
      case "pending":
        return (
          <span className="flex items-center gap-1 text-xs text-orange-700 bg-orange-100 px-2 py-0.5 rounded">
            <Clock size={12} />
            Pending
          </span>
        );
      case "failed":
        return (
          <span className="flex items-center gap-1 text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded">
            <XCircle size={12} />
            Failed
          </span>
        );
    }
  };

  const filteredInspections = mockInspections.filter((inspection) => {
    const matchesSearch =
      inspection.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inspection.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inspection.inspector.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inspection.lot.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    const now = new Date();
    const inspectionDate = new Date(inspection.date);

    switch (filter) {
      case "today": {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return inspectionDate >= today;
      }
      case "week": {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return inspectionDate >= weekAgo;
      }
      case "month": {
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        return inspectionDate >= monthAgo;
      }
      case "lot":
        return inspection.lot === "LOT-2026-06-001";
      default:
        return true;
    }
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-800">Inspection History</h1>
          <p className="text-sm text-slate-500 mt-0.5">View and search past inspections</p>
        </div>
        <button className="flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-lg transition-colors">
          <Download size={14} />
          Export
        </button>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by serial number, model, inspector, or LOT..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-400" />
            <div className="flex gap-1.5">
              {[
                { key: "all", label: "All" },
                { key: "today", label: "Today" },
                { key: "week", label: "This Week" },
                { key: "month", label: "This Month" },
                { key: "lot", label: "Current LOT" },
                { key: "duplicates", label: "Duplicates" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key as typeof filter)}
                  className={`px-3 py-1.5 rounded text-xs transition-colors ${
                    filter === f.key
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Inspections", value: filteredInspections.length, color: "text-blue-600" },
          { label: "Uploaded", value: filteredInspections.filter(i => i.uploadStatus === "uploaded").length, color: "text-emerald-600" },
          { label: "Pending Upload", value: filteredInspections.filter(i => i.uploadStatus === "pending").length, color: "text-orange-600" },
          { label: "Failed Upload", value: filteredInspections.filter(i => i.uploadStatus === "failed").length, color: "text-red-600" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg border border-slate-200 p-4 text-center">
            <div className={`text-2xl ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs text-slate-600 uppercase tracking-wider">Serial Number</th>
                <th className="text-left px-4 py-3 text-xs text-slate-600 uppercase tracking-wider">Model</th>
                <th className="text-left px-4 py-3 text-xs text-slate-600 uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 text-xs text-slate-600 uppercase tracking-wider">Grade</th>
                <th className="text-left px-4 py-3 text-xs text-slate-600 uppercase tracking-wider">Inspector</th>
                <th className="text-left px-4 py-3 text-xs text-slate-600 uppercase tracking-wider">LOT</th>
                <th className="text-left px-4 py-3 text-xs text-slate-600 uppercase tracking-wider">Upload Status</th>
                <th className="text-left px-4 py-3 text-xs text-slate-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInspections.map((inspection) => (
                <tr key={inspection.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-slate-800 font-mono">{inspection.serialNumber}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{inspection.model}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{inspection.date}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded text-xs ${gradeColors[inspection.grade as keyof typeof gradeColors]}`}>
                      {inspection.grade}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{inspection.inspector}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 font-mono text-xs">{inspection.lot}</td>
                  <td className="px-4 py-3">
                    {getUploadStatusBadge(inspection.uploadStatus)}
                  </td>
                  <td className="px-4 py-3">
                    <button className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors">
                      <Eye size={12} />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredInspections.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <p>No inspections found matching your criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}
