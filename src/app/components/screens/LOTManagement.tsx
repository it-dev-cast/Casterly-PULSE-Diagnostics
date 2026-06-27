import { useState } from "react";
import {
  Package,
  Plus,
  Archive,
  Calendar,
  User,
  CheckCircle2,
  AlertCircle,
  MapPin,
} from "lucide-react";

interface LOT {
  id: string;
  lotName: string;
  customerName: string;
  location: string;
  createdDate: string;
  inspector: string;
  deviceCount: number;
  inspectedCount: number;
  status: "active" | "completed" | "archived";
}

const mockLOTs: LOT[] = [
  {
    id: "1",
    lotName: "CLY-003",
    customerName: "Dell Technologies",
    location: "Warehouse A",
    createdDate: "2026-06-07",
    inspector: "Ravikiran K.",
    deviceCount: 48,
    inspectedCount: 32,
    status: "active",
  },
  {
    id: "2",
    lotName: "CLY-002",
    customerName: "HP Inc.",
    location: "Warehouse A",
    createdDate: "2026-06-05",
    inspector: "Priya S.",
    deviceCount: 60,
    inspectedCount: 60,
    status: "completed",
  },
  {
    id: "3",
    lotName: "CLY-001",
    customerName: "Lenovo Group",
    location: "Warehouse B",
    createdDate: "2026-06-03",
    inspector: "Mohamed A.",
    deviceCount: 45,
    inspectedCount: 45,
    status: "completed",
  },
];

interface LOTManagementProps {
  onSelectLOT: (id: string) => void;
}

export function LOTManagement({ onSelectLOT }: LOTManagementProps) {
  const [lots] = useState<LOT[]>(mockLOTs);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    lotName: "",
    customerName: "",
    location: "",
    remarks: "",
  });

  const activeLOT = lots.find((lot) => lot.status === "active");

  const handleCreateNew = () => {
    setShowForm(true);
    setFormData({ lotName: "", customerName: "", location: "", remarks: "" });
  };

  const handleCancel = () => {
    setShowForm(false);
    setFormData({ lotName: "", customerName: "", location: "", remarks: "" });
  };

  const handleSave = () => {
    console.log("Creating LOT:", formData);
    setShowForm(false);
  };

  const getStatusBadge = (status: LOT["status"]) => {
    switch (status) {
      case "active":
        return (
          <span className="flex items-center gap-1 text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Active
          </span>
        );
      case "completed":
        return (
          <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
            <CheckCircle2 size={12} />
            Completed
          </span>
        );
      case "archived":
        return (
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
            Archived
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-slate-800">LOT Management</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Create and manage refurbishment LOTs
        </p>
      </div>

      {/* Current Active LOT Card */}
      {activeLOT && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0">
                <Package size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-blue-900">Current Active LOT</h3>
                  <span className="flex items-center gap-1 text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    Active
                  </span>
                </div>
                <div className="text-sm text-blue-800 font-medium">
                  {activeLOT.lotName} · {activeLOT.customerName}
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-blue-700">
                  <span>Created: {activeLOT.createdDate}</span>
                  <span>·</span>
                  <span>Inspector: {activeLOT.inspector}</span>
                  <span>·</span>
                  <span>
                    Progress: {activeLOT.inspectedCount}/{activeLOT.deviceCount}
                  </span>
                </div>
                <div className="mt-2">
                  <div className="h-2 bg-blue-200 rounded-full overflow-hidden w-48">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{
                        width: `${(activeLOT.inspectedCount / activeLOT.deviceCount) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LOT List */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-slate-700">Recent LOTs</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {lots.length} LOTs on this USB
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
                  Created Date
                </th>
                <th className="text-left text-xs text-slate-500 px-4 py-3">
                  Inspector
                </th>
                <th className="text-left text-xs text-slate-500 px-4 py-3">
                  Device Count
                </th>
                <th className="text-left text-xs text-slate-500 px-4 py-3">
                  Progress
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
              {lots.map((lot) => {
                const progress = Math.round(
                  (lot.inspectedCount / lot.deviceCount) * 100
                );
                return (
                  <tr
                    key={lot.id}
                    className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="text-slate-700 font-medium">
                        {lot.lotName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {lot.customerName}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{lot.createdDate}</td>
                    <td className="px-4 py-3 text-slate-600">{lot.inspector}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {lot.deviceCount}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              progress === 100 ? "bg-emerald-500" : "bg-blue-500"
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-600">
                          {lot.inspectedCount}/{lot.deviceCount}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(lot.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {lot.status !== "active" && (
                          <button
                            onClick={() => onSelectLOT(lot.id)}
                            className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-2 py-1 rounded transition-colors"
                          >
                            Select
                          </button>
                        )}
                        {lot.status === "completed" && (
                          <button className="text-xs bg-slate-50 hover:bg-slate-100 text-slate-600 px-2 py-1 rounded transition-colors">
                            <Archive size={12} className="inline mr-1" />
                            Archive
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* New LOT Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-slate-800">Create New LOT</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Start a new refurbishment LOT
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
                  value={formData.customerName}
                  onChange={(e) =>
                    setFormData({ ...formData, customerName: e.target.value })
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
              <div>
                <label className="block text-sm text-slate-700 mb-1">
                  Remarks (Optional)
                </label>
                <textarea
                  value={formData.remarks}
                  onChange={(e) =>
                    setFormData({ ...formData, remarks: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Add any additional notes"
                  rows={3}
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
                  !formData.lotName || !formData.customerName || !formData.location
                }
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create LOT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
