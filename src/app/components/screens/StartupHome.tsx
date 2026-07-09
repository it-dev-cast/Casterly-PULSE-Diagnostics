import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Usb,
  User,
  Package,
  Plus,
  Play,
  UserCog,
  Upload,
  Settings,
  RefreshCw,
  CheckCircle2,
  XCircle,
  BarChart3,
  Building2,
  Calendar,
} from "lucide-react";

interface StartupHomeProps {
  onContinueLOT: () => void;
  onCreateLOT: () => void;
  onChangeInspector: () => void;
  onUploadQueue: () => void;
  onSettings: () => void;
  onSyncNow: () => void;
}

interface DashboardData {
  usb: {
    usbId: string;
    version: string;
    lastSync: string;
    pendingUpload: number;
    storedLocally: number;
  };
  operator: {
    inspector: string;
    employeeId: string;
    loginStatus: string;
    lastLogin: string;
  };
  lot: {
    lotId: string;
    created: string;
    inspector: string;
    customer: string;
  } | null;
  totalToday: number;
  passed: number;
  failed: number;
  passRate: number;
  failRate: number;
}

// Shared card chrome for the "command center" look: a flat dark surface that
// sits directly on the panel background, with a hairline border rather than a
// shadow so it stays crisp at kiosk resolutions.
const CARD =
  "bg-[#0f1e35] border border-[#1c3f66] rounded-xl";

export function StartupHome({
  onContinueLOT,
  onCreateLOT,
  onChangeInspector,
  onUploadQueue,
  onSettings,
  onSyncNow,
}: StartupHomeProps) {
  const [d, setD] = useState<DashboardData | null>(null);

  useEffect(() => {
    invoke<DashboardData>("get_dashboard")
      .then(setD)
      .catch((err) => console.error("Failed to load dashboard:", err));
  }, []);

  const dash = (v?: string) => (v && v.length ? v : "—");
  const now = new Date();
  const welcome = now.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const lotName = d?.lot?.lotId || "—";

  return (
    <div className="-m-6 p-6 min-h-[calc(100vh-6rem)] bg-[#0a1626] space-y-6">
      <div>
        <h1 className="text-slate-100">PULSE 4.0 Home</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Welcome back · {welcome}
        </p>
      </div>

      {/* Top info cards row */}
      <div className="grid grid-cols-3 gap-4">
        {/* USB Information Card */}
        <div className={`${CARD} p-4`}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Usb size={18} className="text-blue-300" />
            </div>
            <h3 className="text-slate-200">USB Information</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">USB ID</span>
              <span className="text-slate-200 font-mono">{dash(d?.usb.usbId)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Version</span>
              <span className="text-slate-200">{dash(d?.usb.version)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Last Sync</span>
              <span className="text-slate-200">{dash(d?.usb.lastSync)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Pending Upload</span>
              <span className="text-amber-400 font-medium">
                {d?.usb.pendingUpload ?? 0}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Stored Locally</span>
              <span className="text-slate-200 font-medium">
                {d?.usb.storedLocally ?? 0}
              </span>
            </div>
          </div>
        </div>

        {/* Current Operator Card */}
        <div className={`${CARD} p-4`}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <User size={18} className="text-emerald-300" />
            </div>
            <h3 className="text-slate-200">Current Operator</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Inspector</span>
              <span className="text-slate-200 font-medium">
                {dash(d?.operator.inspector)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Employee ID</span>
              <span className="text-slate-200 font-mono">
                {dash(d?.operator.employeeId)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Login Status</span>
              {d?.operator.loginStatus === "Active" ? (
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  Active
                </span>
              ) : (
                <span className="text-slate-500">Inactive</span>
              )}
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Last Login</span>
              <span className="text-slate-200">{dash(d?.operator.lastLogin)}</span>
            </div>
          </div>
        </div>

        {/* Current LOT Card — USB-local info only */}
        <div className={`${CARD} p-4`}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Package size={18} className="text-purple-300" />
            </div>
            <h3 className="text-slate-200">Current LOT</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">LOT ID</span>
              <span className="text-slate-200 font-medium font-mono">
                {dash(d?.lot?.lotId)}
              </span>
            </div>
            <div className="flex justify-between text-sm items-center">
              <span className="flex items-center gap-1 text-slate-500">
                <Calendar size={12} />
                Created
              </span>
              <span className="text-slate-200">{dash(d?.lot?.created)}</span>
            </div>
            <div className="flex justify-between text-sm items-center">
              <span className="flex items-center gap-1 text-slate-500">
                <User size={12} />
                Inspector
              </span>
              <span className="text-slate-200">{dash(d?.lot?.inspector)}</span>
            </div>
            <div className="flex justify-between text-sm items-center">
              <span className="flex items-center gap-1 text-slate-500">
                <Building2 size={12} />
                Customer
              </span>
              <span className="text-slate-200">{dash(d?.lot?.customer)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Today's stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className={`${CARD} p-4 flex items-start gap-4`}>
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
            <BarChart3 size={20} className="text-blue-300" />
          </div>
          <div>
            <div className="text-2xl text-slate-100 leading-none">
              {d?.totalToday ?? 0}
            </div>
            <div className="text-sm text-slate-400 mt-1">Total Inspections Today</div>
            <div className="text-xs text-slate-500 mt-0.5">Stored locally: {d?.usb.storedLocally ?? 0}</div>
          </div>
        </div>
        <div className={`${CARD} p-4 flex items-start gap-4`}>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
            <CheckCircle2 size={20} className="text-emerald-300" />
          </div>
          <div>
            <div className="text-2xl text-slate-100 leading-none">
              {d?.passed ?? 0}
            </div>
            <div className="text-sm text-slate-400 mt-1">Devices Passed</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {d?.passRate ?? 0}% pass rate
            </div>
          </div>
        </div>
        <div className={`${CARD} p-4 flex items-start gap-4`}>
          <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
            <XCircle size={20} className="text-red-400" />
          </div>
          <div>
            <div className="text-2xl text-slate-100 leading-none">
              {d?.failed ?? 0}
            </div>
            <div className="text-sm text-slate-400 mt-1">Devices Failed</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {d?.failRate ?? 0}% fail rate
            </div>
          </div>
        </div>
      </div>

      {/* Primary action buttons */}
      <div>
        <h3 className="text-slate-300 mb-3">Primary Actions</h3>
        <div className="grid grid-cols-4 gap-3">
          {/* Continue Active LOT — prominent, no progress metrics */}
          <button
            onClick={onContinueLOT}
            className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl p-4 flex flex-col items-center gap-3 transition-colors group"
          >
            <div className="w-12 h-12 rounded-lg bg-blue-700 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
              <Play size={24} />
            </div>
            <div className="text-center">
              <div className="text-sm font-medium">Continue Active LOT</div>
              <div className="text-xs text-blue-200 mt-0.5">LOT: {lotName}</div>
            </div>
          </button>

          <button
            onClick={onCreateLOT}
            className={`${CARD} hover:bg-[#132445] text-slate-200 p-4 flex flex-col items-center gap-3 transition-colors group`}
          >
            <div className="w-12 h-12 rounded-lg bg-[#16294a] flex items-center justify-center group-hover:bg-[#1c3457] transition-colors">
              <Plus size={24} className="text-slate-300" />
            </div>
            <span className="text-sm font-medium">Select / Create LOT</span>
          </button>

          <button
            onClick={onChangeInspector}
            className={`${CARD} hover:bg-[#132445] text-slate-200 p-4 flex flex-col items-center gap-3 transition-colors group`}
          >
            <div className="w-12 h-12 rounded-lg bg-[#16294a] flex items-center justify-center group-hover:bg-[#1c3457] transition-colors">
              <UserCog size={24} className="text-slate-300" />
            </div>
            <span className="text-sm font-medium">Change Inspector</span>
          </button>
        </div>
      </div>

      {/* Secondary actions */}
      <div>
        <h3 className="text-slate-300 mb-3">System Actions</h3>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={onUploadQueue}
            className={`${CARD} hover:bg-[#132445] text-slate-200 p-3 flex items-center gap-3 transition-colors`}
          >
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Upload size={20} className="text-amber-300" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">Upload Queue</div>
              <div className="text-xs text-slate-500">
                {d?.usb.pendingUpload ?? 0} pending uploads
              </div>
            </div>
          </button>

          <button
            onClick={onSettings}
            className={`${CARD} hover:bg-[#132445] text-slate-200 p-3 flex items-center gap-3 transition-colors`}
          >
            <div className="w-10 h-10 rounded-lg bg-[#16294a] flex items-center justify-center">
              <Settings size={20} className="text-slate-300" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">Settings</div>
              <div className="text-xs text-slate-500">Configure PULSE</div>
            </div>
          </button>

          <button
            onClick={onSyncNow}
            className={`${CARD} hover:bg-[#132445] text-slate-200 p-3 flex items-center gap-3 transition-colors`}
          >
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <RefreshCw size={20} className="text-blue-300" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">Synchronize Now</div>
              <div className="text-xs text-slate-500">
                Last sync: {dash(d?.usb.lastSync)}
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* System status */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 size={20} className="text-blue-300 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm text-blue-200 font-medium">System Ready</div>
            <div className="text-xs text-blue-300/80 mt-0.5">
              All systems operational. Ready to collect inspections for LOT {lotName}.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
