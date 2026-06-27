import { useState } from "react";
import {
  User,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  Mail,
  Phone,
  IdCard,
} from "lucide-react";

interface Inspector {
  id: string;
  name: string;
  employeeId: string;
  email?: string;
  phone?: string;
  lastLogin: string;
  isActive: boolean;
}

const mockInspectors: Inspector[] = [
  {
    id: "1",
    name: "Ravikiran K.",
    employeeId: "EMP-2847",
    email: "ravikiran@example.com",
    phone: "+1-555-0123",
    lastLogin: "Today, 09:00 AM",
    isActive: true,
  },
  {
    id: "2",
    name: "Priya S.",
    employeeId: "EMP-2891",
    email: "priya@example.com",
    phone: "+1-555-0124",
    lastLogin: "Today, 08:30 AM",
    isActive: false,
  },
  {
    id: "3",
    name: "Mohamed A.",
    employeeId: "EMP-2902",
    email: "mohamed@example.com",
    phone: "+1-555-0125",
    lastLogin: "Yesterday, 05:45 PM",
    isActive: false,
  },
  {
    id: "4",
    name: "Sarah L.",
    employeeId: "EMP-2915",
    email: "sarah@example.com",
    lastLogin: "Yesterday, 04:30 PM",
    isActive: false,
  },
];

interface InspectorManagementProps {
  onSelectInspector: (id: string) => void;
}

export function InspectorManagement({ onSelectInspector }: InspectorManagementProps) {
  const [inspectors] = useState<Inspector[]>(mockInspectors);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    employeeId: "",
    email: "",
    phone: "",
  });

  const currentInspector = inspectors.find((i) => i.isActive);

  const handleCreateNew = () => {
    setShowForm(true);
    setFormData({ name: "", employeeId: "", email: "", phone: "" });
  };

  const handleCancel = () => {
    setShowForm(false);
    setFormData({ name: "", employeeId: "", email: "", phone: "" });
  };

  const handleSave = () => {
    // In real implementation, this would save to USB storage
    console.log("Saving inspector:", formData);
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-slate-800">Inspector Management</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Manage technicians and operators using this USB device
        </p>
      </div>

      {/* Current Inspector Card */}
      {currentInspector && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white shrink-0">
              {currentInspector.name.split(" ").map((n) => n[0]).join("")}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-blue-900">Current Inspector</h3>
                <span className="flex items-center gap-1 text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                  <CheckCircle2 size={12} />
                  Active
                </span>
              </div>
              <div className="text-sm text-blue-800 font-medium">
                {currentInspector.name}
              </div>
              <div className="text-xs text-blue-600 mt-1">
                Employee ID: {currentInspector.employeeId}
              </div>
              <div className="flex items-center gap-1 text-xs text-blue-600 mt-1">
                <Clock size={11} />
                Last Login: {currentInspector.lastLogin}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inspector List */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-slate-700">Available Inspectors</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {inspectors.length} inspectors registered on this USB
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
          {inspectors.map((inspector) => (
            <div
              key={inspector.id}
              className="p-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-sm shrink-0">
                  {inspector.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-slate-700 font-medium">
                      {inspector.name}
                    </span>
                    {inspector.isActive && (
                      <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Current
                      </span>
                    )}
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
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Clock size={11} />
                      <span>Last Login: {inspector.lastLogin}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!inspector.isActive && (
                    <button
                      onClick={() => onSelectInspector(inspector.id)}
                      className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1.5 rounded transition-colors"
                    >
                      Select
                    </button>
                  )}
                  <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors">
                    <Edit2 size={14} />
                  </button>
                  <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
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
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-slate-800">Create New Inspector</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Add a new technician to this USB device
              </p>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-slate-700 mb-1">
                  Inspector Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-700 mb-1">
                  Employee ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.employeeId}
                  onChange={(e) =>
                    setFormData({ ...formData, employeeId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="EMP-XXXX"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-700 mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="inspector@example.com"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-700 mb-1">
                  Phone (Optional)
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+1-555-0123"
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
                disabled={!formData.name || !formData.employeeId}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
