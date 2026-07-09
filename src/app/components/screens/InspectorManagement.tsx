import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Plus,
  Edit2,
  Trash2,
  Clock,
  Mail,
  Phone,
  IdCard,
} from "lucide-react";

// Mirrors the Inspector struct returned by the Rust `get_inspectors` command
// (PRD: inspectors persisted as JSON in the settings table).
interface Inspector {
  id: number;
  inspectorName: string;
  employeeId: string;
  email: string;
  phone: string;
  createdDate: string;
}

interface InspectorManagementProps {
  onSelectInspector: (id: string) => void;
}

export function InspectorManagement({ onSelectInspector }: InspectorManagementProps) {
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    employeeId: "",
    email: "",
    phone: "",
  });

  const loadInspectors = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await invoke<Inspector[]>("get_inspectors");
      setInspectors(rows);
    } catch (err) {
      console.error("Failed to load inspectors:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInspectors();
  }, [loadInspectors]);

  const handleCreateNew = () => {
    setEditingId(null);
    setShowForm(true);
    setFormData({ name: "", employeeId: "", email: "", phone: "" });
  };

  const handleEdit = (inspector: Inspector) => {
    setEditingId(inspector.id);
    setShowForm(true);
    setFormData({
      name: inspector.inspectorName,
      employeeId: inspector.employeeId,
      email: inspector.email,
      phone: inspector.phone,
    });
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ name: "", employeeId: "", email: "", phone: "" });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingId !== null) {
        await invoke("update_inspector", {
          id: editingId,
          inspectorName: formData.name,
          employeeId: formData.employeeId,
          email: formData.email,
          phone: formData.phone,
        });
        console.log("Updated inspector id:", editingId);
      } else {
        const newId = await invoke<number>("create_inspector", {
          inspectorName: formData.name,
          employeeId: formData.employeeId,
          email: formData.email,
          phone: formData.phone,
        });
        console.log("Created inspector with id:", newId);
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ name: "", employeeId: "", email: "", phone: "" });
      await loadInspectors();
    } catch (err) {
      console.error("Failed to save inspector:", err);
      alert(`Failed to save inspector: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (inspector: Inspector) => {
    if (
      !window.confirm(
        `Delete inspector "${inspector.inspectorName}"? This cannot be undone.`
      )
    ) {
      return;
    }
    try {
      await invoke("delete_inspector", { id: inspector.id });
      await loadInspectors();
    } catch (err) {
      console.error("Failed to delete inspector:", err);
      alert(`Failed to delete inspector: ${err}`);
    }
  };

  return (
    <div className="-m-6 p-6 min-h-[calc(100vh-6rem)] bg-[#0a1626] space-y-6">
      <div>
        <h1 className="text-slate-100">Inspector Management</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Manage technicians and operators using this USB device
        </p>
      </div>

      {/* Inspector List */}
      <div className="bg-[#0f1e35] rounded-lg border border-[#1c3f66]">
        <div className="p-4 border-b border-[#1c3f66] flex items-center justify-between">
          <div>
            <h3 className="text-slate-200">Available Inspectors</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {loading
                ? "Loading…"
                : `${inspectors.length} inspectors registered on this USB`}
            </p>
          </div>
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Create New Inspector
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {!loading && inspectors.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-500">
              No inspectors yet. Click “Create New Inspector” to add one.
            </div>
          )}
          {inspectors.map((inspector) => (
            <div
              key={inspector.id}
              className="p-4 hover:bg-[#132445] transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#1c3f66] flex items-center justify-center text-slate-300 text-sm shrink-0">
                  {inspector.inspectorName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-slate-200 font-medium">
                      {inspector.inspectorName}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <IdCard size={11} />
                      <span>Employee ID: {inspector.employeeId}</span>
                    </div>
                    {inspector.email && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Mail size={11} />
                        <span>{inspector.email}</span>
                      </div>
                    )}
                    {inspector.phone && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Phone size={11} />
                        <span>{inspector.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Clock size={11} />
                      <span>Created: {inspector.createdDate}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onSelectInspector(String(inspector.id))}
                    className="text-xs bg-blue-500/10 hover:bg-blue-500/15 text-blue-400 px-3 py-1.5 rounded transition-colors"
                  >
                    Select
                  </button>
                  <button
                    onClick={() => handleEdit(inspector)}
                    className="p-2 text-slate-500 hover:text-slate-300 hover:bg-[#1c3457] rounded transition-colors"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(inspector)}
                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New Inspector Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#0f1e35] rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b border-[#1c3f66]">
              <h3 className="text-slate-100">
                {editingId !== null ? "Edit Inspector" : "Create New Inspector"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {editingId !== null
                  ? "Update this technician's details"
                  : "Add a new technician to this USB device"}
              </p>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-slate-200 mb-1">
                  Inspector Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-[#1c3f66] bg-[#0d1b30] text-slate-100 placeholder:text-slate-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-200 mb-1">
                  Employee ID <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.employeeId}
                  onChange={(e) =>
                    setFormData({ ...formData, employeeId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-[#1c3f66] bg-[#0d1b30] text-slate-100 placeholder:text-slate-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="EMP-XXXX"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-200 mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-[#1c3f66] bg-[#0d1b30] text-slate-100 placeholder:text-slate-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="inspector@example.com"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-200 mb-1">
                  Phone (Optional)
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-[#1c3f66] bg-[#0d1b30] text-slate-100 placeholder:text-slate-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+1-555-0123"
                />
              </div>
            </div>
            <div className="p-4 border-t border-[#1c3f66] flex gap-2 justify-end">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm text-slate-300 hover:bg-[#1c3457] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.name || !formData.employeeId}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving
                  ? "Saving..."
                  : editingId !== null
                  ? "Update Inspector"
                  : "Save Inspector"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
