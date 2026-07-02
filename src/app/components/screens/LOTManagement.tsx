import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Plus,
  Archive,
  Trash2,
  Edit2,
} from "lucide-react";

// Mirrors the LotRow struct returned by the Rust `get_lots` command
// (PRD §11.2 — lots table).
interface LOT {
  id: number;
  lotName: string;
  customer: string;
  location: string;
  inspectionDate: string;
  status: string;
}

interface LOTManagementProps {
  onSelectLOT: (id: string) => void;
}

export function LOTManagement({ onSelectLOT }: LOTManagementProps) {
  const [lots, setLots] = useState<LOT[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    lotName: "",
    customer: "",
    location: "",
  });

  const loadLots = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await invoke<LOT[]>("get_lots");
      setLots(rows);
    } catch (err) {
      console.error("Failed to load LOTs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLots();
  }, [loadLots]);

  const handleCreateNew = () => {
    setEditingId(null);
    setShowForm(true);
    setFormData({ lotName: "", customer: "", location: "" });
  };

  const handleEdit = (lot: LOT) => {
    setEditingId(lot.id);
    setShowForm(true);
    setFormData({
      lotName: lot.lotName,
      customer: lot.customer,
      location: lot.location,
    });
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ lotName: "", customer: "", location: "" });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingId !== null) {
        await invoke("update_lot", {
          id: editingId,
          lotName: formData.lotName,
          customer: formData.customer,
          location: formData.location,
        });
        console.log("Updated LOT id:", editingId);
      } else {
        const newId = await invoke<number>("create_lot", {
          lotName: formData.lotName,
          customer: formData.customer,
          location: formData.location,
        });
        console.log("Created LOT in lots table with id:", newId);
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ lotName: "", customer: "", location: "" });
      await loadLots();
    } catch (err) {
      console.error("Failed to save LOT:", err);
      alert(`Failed to save LOT: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (lot: LOT) => {
    try {
      await invoke("archive_lot", { id: lot.id });
      await loadLots();
    } catch (err) {
      console.error("Failed to archive LOT:", err);
      alert(`Failed to archive LOT: ${err}`);
    }
  };

  const handleDelete = async (lot: LOT) => {
    if (
      !window.confirm(`Delete LOT "${lot.lotName}"? This cannot be undone.`)
    ) {
      return;
    }
    try {
      await invoke("delete_lot", { id: lot.id });
      await loadLots();
    } catch (err) {
      console.error("Failed to delete LOT:", err);
      alert(`Failed to delete LOT: ${err}`);
    }
  };

  // PRD LOT statuses: ACTIVE / COMPLETED / CANCELLED.
  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === "COMPLETED") {
      return (
        <span className="text-xs text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded w-fit">
          Completed
        </span>
      );
    }
    if (s === "CANCELLED") {
      return (
        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded w-fit">
          Cancelled
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded w-fit">
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
        Active
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-slate-800">LOT Management</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Create and manage refurbishment LOTs
        </p>
      </div>

      {/* LOT List */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-slate-700">Recent LOTs</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {loading ? "Loading…" : `${lots.length} LOTs on this USB`}
            </p>
          </div>
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Create New LOT
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs text-slate-500 px-4 py-3">
                  LOT Name
                </th>
                <th className="text-left text-xs text-slate-500 px-4 py-3">
                  Customer
                </th>
                <th className="text-left text-xs text-slate-500 px-4 py-3">
                  Location
                </th>
                <th className="text-left text-xs text-slate-500 px-4 py-3">
                  Inspection Date
                </th>
                <th className="text-left text-xs text-slate-500 px-4 py-3">
                  Status
                </th>
                <th className="text-left text-xs text-slate-500 px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {!loading && lots.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-slate-400"
                  >
                    No LOTs yet. Click “Create New LOT” to add one.
                  </td>
                </tr>
              )}
              {lots.map((lot) => (
                <tr
                  key={lot.id}
                  className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="text-slate-700 font-medium">
                      {lot.lotName}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{lot.customer}</td>
                  <td className="px-4 py-3 text-slate-600">{lot.location}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {lot.inspectionDate}
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(lot.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onSelectLOT(String(lot.id))}
                        className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-2 py-1 rounded transition-colors"
                      >
                        Select
                      </button>
                      <button
                        onClick={() => handleEdit(lot)}
                        className="text-xs bg-slate-50 hover:bg-slate-100 text-slate-600 px-2 py-1 rounded transition-colors"
                      >
                        <Edit2 size={12} className="inline mr-1" />
                        Edit
                      </button>
                      {lot.status.toUpperCase() !== "CANCELLED" && (
                        <button
                          onClick={() => handleArchive(lot)}
                          className="text-xs bg-slate-50 hover:bg-slate-100 text-slate-600 px-2 py-1 rounded transition-colors"
                        >
                          <Archive size={12} className="inline mr-1" />
                          Archive
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(lot)}
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

      {/* New LOT Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-slate-800">
                {editingId !== null ? "Edit LOT" : "Create New LOT"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {editingId !== null
                  ? "Update this LOT's details"
                  : "Start a new refurbishment LOT"}
              </p>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-slate-700 mb-1">
                  LOT Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.lotName}
                  onChange={(e) =>
                    setFormData({ ...formData, lotName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., CLY-004"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-700 mb-1">
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.customer}
                  onChange={(e) =>
                    setFormData({ ...formData, customer: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter customer name"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-700 mb-1">
                  Location <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Warehouse A"
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex gap-2 justify-end">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={
                  saving ||
                  !formData.lotName ||
                  !formData.customer ||
                  !formData.location
                }
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving
                  ? "Saving..."
                  : editingId !== null
                  ? "Update LOT"
                  : "Create LOT"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
