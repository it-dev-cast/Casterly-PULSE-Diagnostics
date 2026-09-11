import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Search, Filter, Eye, Download, Trash2, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { exportReportFiles } from "../../lib/exportReport";

type UploadStatus = "uploaded" | "pending" | "failed";

// Mirrors the InspectionRow struct from the Rust `get_inspections` command.
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

export function InspectionManager() {
  const [rows, setRows] = useState<InspectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLot, setActiveLot] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "current-lot" | "pending" | "uploaded" | "failed" | "duplicates">("all");

  const loadInspections = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoke<InspectionRow[]>("get_inspections");
      setRows(data);
    } catch (err) {
      console.error("Failed to load inspections:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInspections();
    invoke<{ lotName: string }>("get_session")
      .then((s) => setActiveLot(s.lotName))
      .catch(() => {});
  }, [loadInspections]);

  const [detail, setDetail] = useState<string | null>(null);

  const handleView = async (uuid: string) => {
    try {
      const json = await invoke<string>("get_inspection_detail", { uuid });
      try {
        setDetail(JSON.stringify(JSON.parse(json), null, 2));
      } catch {
        setDetail(json);
      }
    } catch (err) {
      alert(`Failed to load record: ${err}`);
    }
  };

  // Exports the full report for this inspection as both a PDF (same styled
  // layout as everywhere else in the app) and an Excel workbook with the
  // same content, into a single user-chosen folder.
  const handleExport = async (uuid: string) => {
    try {
      const json = await invoke<string>("get_inspection_detail", { uuid });
      const run = JSON.parse(json);
      const folder = await exportReportFiles(run, { includeExcel: true });
      if (folder) alert(`Report (PDF + Excel) saved to:\n${folder}`);
    } catch (err) {
      alert(`Failed to export record: ${err}`);
    }
  };

  const handleDelete = async (uuid: string, serial: string) => {
    if (!window.confirm(`Delete inspection "${serial || uuid}"? This cannot be undone.`)) {
      return;
    }
    try {
      await invoke("delete_inspection", { uuid });
      await loadInspections();
    } catch (err) {
      alert(`Failed to delete record: ${err}`);
    }
  };

  // Count serials to flag duplicates.
  const serialCounts = rows.reduce<Record<string, number>>((acc, r) => {
    if (r.serial) acc[r.serial] = (acc[r.serial] || 0) + 1;
    return acc;
  }, {});

  const mockInspections = rows.map((r) => ({
    id: String(r.id),
    uuid: r.uuid,
    serialNumber: r.serial,
    model: r.model,
    date: r.timestamp,
    inspector: r.inspector,
    lot: r.lot,
    uploadStatus: (r.uploaded ? "uploaded" : "pending") as UploadStatus,
    isDuplicate: !!r.serial && serialCounts[r.serial] > 1,
  }));

  const getStatusBadge = (status: UploadStatus) => {
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
        matchesFilter = inspection.lot === activeLot;
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
    <div className="-m-6 p-6 min-h-[calc(100vh-6rem)] bg-[#0a1626] space-y-6">
      <div>
        <h1 className="text-slate-100">Inspection Manager</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Browse and manage locally stored inspections
        </p>
      </div>

      {/* Search and Filters */}
      <div className="bg-[#0f1e35] rounded-lg border border-[#1c3f66] p-4">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Search</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by serial, model, inspector, or LOT..."
                className="w-full pl-10 pr-3 py-2 border border-[#1c3f66] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Filter By</label>
            <div className="flex items-center gap-1.5">
              <Filter size={14} className="text-slate-500 ml-1" />
              <button
                onClick={() => setFilterMode("all")}
                className={`text-xs px-2.5 py-1.5 rounded transition-colors ${
                  filterMode === "all"
                    ? "bg-blue-600 text-white"
                    : "bg-[#16294a] text-slate-300 hover:bg-[#22436e]"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterMode("current-lot")}
                className={`text-xs px-2.5 py-1.5 rounded transition-colors ${
                  filterMode === "current-lot"
                    ? "bg-blue-600 text-white"
                    : "bg-[#16294a] text-slate-300 hover:bg-[#22436e]"
                }`}
              >
                Current LOT
              </button>
              <button
                onClick={() => setFilterMode("pending")}
                className={`text-xs px-2.5 py-1.5 rounded transition-colors ${
                  filterMode === "pending"
                    ? "bg-blue-600 text-white"
                    : "bg-[#16294a] text-slate-300 hover:bg-[#22436e]"
                }`}
              >
                Pending Upload
              </button>
              <button
                onClick={() => setFilterMode("uploaded")}
                className={`text-xs px-2.5 py-1.5 rounded transition-colors ${
                  filterMode === "uploaded"
                    ? "bg-blue-600 text-white"
                    : "bg-[#16294a] text-slate-300 hover:bg-[#22436e]"
                }`}
              >
                Uploaded
              </button>
              <button
                onClick={() => setFilterMode("failed")}
                className={`text-xs px-2.5 py-1.5 rounded transition-colors ${
                  filterMode === "failed"
                    ? "bg-blue-600 text-white"
                    : "bg-[#16294a] text-slate-300 hover:bg-[#22436e]"
                }`}
              >
                Failed Upload
              </button>
              <button
                onClick={() => setFilterMode("duplicates")}
                className={`text-xs px-2.5 py-1.5 rounded transition-colors ${
                  filterMode === "duplicates"
                    ? "bg-blue-600 text-white"
                    : "bg-[#16294a] text-slate-300 hover:bg-[#22436e]"
                }`}
              >
                Duplicates
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="bg-[#0f1e35] rounded-lg border border-[#1c3f66]">
        <div className="p-4 border-b border-[#1c3f66]">
          <h3 className="text-slate-200">Inspection Records</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {loading
              ? "Loading…"
              : `${filteredInspections.length} record${filteredInspections.length !== 1 ? "s" : ""} found`}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#16294a] bg-[#0d1b30]">
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
              {!loading && filteredInspections.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                    No inspection records found.
                  </td>
                </tr>
              )}
              {filteredInspections.map((inspection) => (
                <tr
                  key={inspection.id}
                  className={`border-b border-[#16294a] hover:bg-[#132445] transition-colors ${
                    inspection.isDuplicate ? "bg-yellow-50" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-200">
                        {inspection.serialNumber}
                      </span>
                      {inspection.isDuplicate && (
                        <AlertTriangle size={14} className="text-yellow-600" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{inspection.model}</td>
                  <td className="px-4 py-3 text-slate-500">{inspection.date}</td>
                  <td className="px-4 py-3 text-slate-300">{inspection.inspector}</td>
                  <td className="px-4 py-3 text-slate-300">{inspection.lot}</td>
                  <td className="px-4 py-3">{getStatusBadge(inspection.uploadStatus)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleView(inspection.uuid)}
                        className="text-xs bg-blue-500/10 hover:bg-blue-500/15 text-blue-400 px-2 py-1 rounded transition-colors"
                      >
                        <Eye size={12} className="inline mr-1" />
                        View
                      </button>
                      <button
                        onClick={() => handleExport(inspection.uuid)}
                        className="text-xs bg-[#0d1b30] hover:bg-[#1c3457] text-slate-300 px-2 py-1 rounded transition-colors"
                      >
                        <Download size={12} className="inline mr-1" />
                        Export
                      </button>
                      <button
                        onClick={() =>
                          handleDelete(inspection.uuid, inspection.serialNumber)
                        }
                        className="text-xs bg-red-500/10 hover:bg-red-500/15 text-red-400 px-2 py-1 rounded transition-colors"
                      >
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

      {/* Record detail modal */}
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
