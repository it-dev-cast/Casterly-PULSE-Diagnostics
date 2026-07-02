import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Search, Filter, Eye, Download, Trash2, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";

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

  const handleExport = async (uuid: string) => {
    try {
      const path = await invoke<string | null>("export_inspection", { uuid });
      if (path) alert(`Exported to:\n${path}`);
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
            {loading
              ? "Loading…"
              : `${filteredInspections.length} record${filteredInspections.length !== 1 ? "s" : ""} found`}
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
              {!loading && filteredInspections.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                    No inspection records found.
                  </td>
                </tr>
              )}
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
                      <button
                        onClick={() => handleView(inspection.uuid)}
                        className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-2 py-1 rounded transition-colors"
                      >
                        <Eye size={12} className="inline mr-1" />
                        View
                      </button>
                      <button
                        onClick={() => handleExport(inspection.uuid)}
                        className="text-xs bg-slate-50 hover:bg-slate-100 text-slate-600 px-2 py-1 rounded transition-colors"
                      >
                        <Download size={12} className="inline mr-1" />
                        Export
                      </button>
                      <button
                        onClick={() =>
                          handleDelete(inspection.uuid, inspection.serialNumber)
                        }
                        className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1 rounded transition-colors"
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
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-slate-800">Inspection Record</h3>
              <button
                onClick={() => setDetail(null)}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Close
              </button>
            </div>
            <pre className="p-4 overflow-auto text-xs text-slate-700 font-mono whitespace-pre-wrap">
              {detail}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
