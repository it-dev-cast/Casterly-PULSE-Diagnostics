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
  Complete: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  "In Progress": "bg-blue-500/15 text-blue-300 border-blue-500/30",
  Failed: "bg-red-500/15 text-red-300 border-red-500/30",
  Pending: "bg-[#16294a] text-slate-200 border-[#1c3f66]",
};

const gradeColors = {
  A: "bg-emerald-500/15 text-emerald-300",
  B: "bg-blue-500/15 text-blue-300",
  C: "bg-amber-500/15 text-amber-300",
  D: "bg-red-500/15 text-red-300",
  F: "bg-red-200 text-red-800",
};

export function InspectionHistory() {
  const [filter, setFilter] = useState<"all" | "today" | "week" | "month" | "lot" | "duplicates">("all");
  const [searchTerm, setSearchTerm] = useState("");

  const getUploadStatusBadge = (status: UploadStatus) => {
    switch (status) {
      case "uploaded":
        return (
          <span className="flex items-center gap-1 text-xs text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded">
            <CheckCircle2 size={12} />
            Uploaded
          </span>
        );
      case "pending":
        return (
          <span className="flex items-center gap-1 text-xs text-orange-300 bg-orange-500/15 px-2 py-0.5 rounded">
            <Clock size={12} />
            Pending
          </span>
        );
      case "failed":
        return (
          <span className="flex items-center gap-1 text-xs text-red-300 bg-red-500/15 px-2 py-0.5 rounded">
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
    <div className="-m-6 p-6 min-h-[calc(100vh-6rem)] bg-[#0a1626] space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-100">Inspection History</h1>
          <p className="text-sm text-slate-500 mt-0.5">View and search past inspections</p>
        </div>
        <button className="flex items-center gap-2 text-sm text-slate-300 bg-[#0f1e35] border border-[#1c3f66] hover:bg-[#132445] px-3 py-2 rounded-lg transition-colors">
          <Download size={14} />
          Export
        </button>
      </div>

      {/* Filters and Search */}
      <div className="bg-[#0f1e35] rounded-lg border border-[#1c3f66] p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by serial number, model, inspector, or LOT..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-[#0d1b30] border border-[#1c3f66] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-500" />
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
                      : "bg-[#16294a] text-slate-300 hover:bg-[#22436e]"
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
          { label: "Total Inspections", value: filteredInspections.length, color: "text-blue-400" },
          { label: "Uploaded", value: filteredInspections.filter(i => i.uploadStatus === "uploaded").length, color: "text-emerald-400" },
          { label: "Pending Upload", value: filteredInspections.filter(i => i.uploadStatus === "pending").length, color: "text-orange-400" },
          { label: "Failed Upload", value: filteredInspections.filter(i => i.uploadStatus === "failed").length, color: "text-red-400" },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#0f1e35] rounded-lg border border-[#1c3f66] p-4 text-center">
            <div className={`text-2xl ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#0f1e35] rounded-lg border border-[#1c3f66] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#0d1b30] border-b border-[#1c3f66]">
              <tr>
                <th className="text-left px-4 py-3 text-xs text-slate-300 uppercase tracking-wider">Serial Number</th>
                <th className="text-left px-4 py-3 text-xs text-slate-300 uppercase tracking-wider">Model</th>
                <th className="text-left px-4 py-3 text-xs text-slate-300 uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 text-xs text-slate-300 uppercase tracking-wider">Grade</th>
                <th className="text-left px-4 py-3 text-xs text-slate-300 uppercase tracking-wider">Inspector</th>
                <th className="text-left px-4 py-3 text-xs text-slate-300 uppercase tracking-wider">LOT</th>
                <th className="text-left px-4 py-3 text-xs text-slate-300 uppercase tracking-wider">Upload Status</th>
                <th className="text-left px-4 py-3 text-xs text-slate-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInspections.map((inspection) => (
                <tr key={inspection.id} className="hover:bg-[#132445] transition-colors">
                  <td className="px-4 py-3 text-sm text-slate-100 font-mono">{inspection.serialNumber}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{inspection.model}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{inspection.date}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded text-xs ${gradeColors[inspection.grade as keyof typeof gradeColors]}`}>
                      {inspection.grade}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300">{inspection.inspector}</td>
                  <td className="px-4 py-3 text-sm text-slate-300 font-mono text-xs">{inspection.lot}</td>
                  <td className="px-4 py-3">
                    {getUploadStatusBadge(inspection.uploadStatus)}
                  </td>
                  <td className="px-4 py-3">
                    <button className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
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
