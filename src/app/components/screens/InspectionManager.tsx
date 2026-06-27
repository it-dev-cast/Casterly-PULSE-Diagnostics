import { useState } from "react";
import { Search, Filter, Eye, Download, Trash2, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";

type UploadStatus = "uploaded" | "pending" | "failed";

interface Inspection {
  id: string;
  serialNumber: string;
  model: string;
  date: string;
  inspector: string;
  lot: string;
  uploadStatus: UploadStatus;
  isDuplicate?: boolean;
}

const mockInspections: Inspection[] = [
  {
    id: "1",
    serialNumber: "5CD124NJWZ",
    model: "HP ProBook 440 G8",
    date: "2026-06-08 10:23",
    inspector: "Ravikiran K.",
    lot: "CLY-003",
    uploadStatus: "pending",
    isDuplicate: false,
  },
  {
    id: "2",
    serialNumber: "5CD125PQRS",
    model: "HP ProBook 440 G8",
    date: "2026-06-08 10:15",
    inspector: "Ravikiran K.",
    lot: "CLY-003",
    uploadStatus: "pending",
    isDuplicate: false,
  },
  {
    id: "3",
    serialNumber: "5CD126TUVW",
    model: "HP EliteBook 840 G7",
    date: "2026-06-08 10:08",
    inspector: "Ravikiran K.",
    lot: "CLY-003",
    uploadStatus: "failed",
    isDuplicate: false,
  },
  {
    id: "4",
    serialNumber: "5CD127XYZA",
    model: "HP ProBook 450 G8",
    date: "2026-06-08 09:58",
    inspector: "Ravikiran K.",
    lot: "CLY-003",
    uploadStatus: "uploaded",
    isDuplicate: false,
  },
  {
    id: "5",
    serialNumber: "5CD128BCDE",
    model: "HP ProBook 440 G8",
    date: "2026-06-08 09:45",
    inspector: "Priya S.",
    lot: "CLY-003",
    uploadStatus: "uploaded",
    isDuplicate: false,
  },
  {
    id: "6",
    serialNumber: "5CD125PQRS",
    model: "HP ProBook 440 G8",
    date: "2026-06-07 16:30",
    inspector: "Mohamed A.",
    lot: "CLY-002",
    uploadStatus: "uploaded",
    isDuplicate: true,
  },
];

export function InspectionManager() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "current-lot" | "pending" | "uploaded" | "failed" | "duplicates">("all");

  const getStatusBadge = (status: UploadStatus) => {
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
    // Apply text search filter
    const matchesSearch = searchTerm === "" ||
      inspection.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inspection.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inspection.inspector.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inspection.lot.toLowerCase().includes(searchTerm.toLowerCase());

    // Apply filter mode
    let matchesFilter = true;
    switch (filterMode) {
      case "current-lot":
        matchesFilter = inspection.lot === "CLY-003";
        break;
      case "pending":
        matchesFilter = inspection.uploadStatus === "pending";
        break;
      case "uploaded":
        matchesFilter = inspection.uploadStatus === "uploaded";
        break;
      case "failed":
        matchesFilter = inspection.uploadStatus === "failed";
        break;
      case "duplicates":
        matchesFilter = inspection.isDuplicate === true;
        break;
    }

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-slate-800">Inspection Manager</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Browse and manage locally stored inspections
        </p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Search</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by serial, model, inspector, or LOT..."
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Filter By</label>
            <div className="flex items-center gap-1.5">
              <Filter size={14} className="text-slate-400 ml-1" />
              <button
                onClick={() => setFilterMode("all")}
                className={`text-xs px-2.5 py-1.5 rounded transition-colors ${
                  filterMode === "all"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterMode("current-lot")}
                className={`text-xs px-2.5 py-1.5 rounded transition-colors ${
                  filterMode === "current-lot"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Current LOT
              </button>
              <button
                onClick={() => setFilterMode("pending")}
                className={`text-xs px-2.5 py-1.5 rounded transition-colors ${
                  filterMode === "pending"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Pending Upload
              </button>
              <button
                onClick={() => setFilterMode("uploaded")}
                className={`text-xs px-2.5 py-1.5 rounded transition-colors ${
                  filterMode === "uploaded"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Uploaded
              </button>
              <button
                onClick={() => setFilterMode("failed")}
                className={`text-xs px-2.5 py-1.5 rounded transition-colors ${
                  filterMode === "failed"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Failed Upload
              </button>
              <button
                onClick={() => setFilterMode("duplicates")}
                className={`text-xs px-2.5 py-1.5 rounded transition-colors ${
                  filterMode === "duplicates"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Duplicates
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <h3 className="text-slate-700">Inspection Records</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {filteredInspections.length} record{filteredInspections.length !== 1 ? "s" : ""} found
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs text-slate-500 px-4 py-3">
                  Serial Number
                </th>
                <th className="text-left text-xs text-slate-500 px-4 py-3">
                  Model
                </th>
                <th className="text-left text-xs text-slate-500 px-4 py-3">
                  Date
                </th>
                <th className="text-left text-xs text-slate-500 px-4 py-3">
                  Inspector
                </th>
                <th className="text-left text-xs text-slate-500 px-4 py-3">
                  LOT
                </th>
                <th className="text-left text-xs text-slate-500 px-4 py-3">
                  Upload Status
                </th>
                <th className="text-left text-xs text-slate-500 px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredInspections.map((inspection) => (
                <tr
                  key={inspection.id}
                  className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                    inspection.isDuplicate ? "bg-yellow-50" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-700">
                        {inspection.serialNumber}
                      </span>
                      {inspection.isDuplicate && (
                        <AlertTriangle size={14} className="text-yellow-600" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{inspection.model}</td>
                  <td className="px-4 py-3 text-slate-500">{inspection.date}</td>
                  <td className="px-4 py-3 text-slate-600">{inspection.inspector}</td>
                  <td className="px-4 py-3 text-slate-600">{inspection.lot}</td>
                  <td className="px-4 py-3">{getStatusBadge(inspection.uploadStatus)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-2 py-1 rounded transition-colors">
                        <Eye size={12} className="inline mr-1" />
                        View
                      </button>
                      <button className="text-xs bg-slate-50 hover:bg-slate-100 text-slate-600 px-2 py-1 rounded transition-colors">
                        <Download size={12} className="inline mr-1" />
                        Export
                      </button>
                      <button className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1 rounded transition-colors">
                        <Trash2 size={12} className="inline mr-1" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
