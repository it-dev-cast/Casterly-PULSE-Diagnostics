import {
  Monitor,
  HardDrive,
  ClipboardCheck,
  Volume2,
  Camera,
  Keyboard,
  MousePointer2,
  Battery,
  FileSearch,
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  Home,
  Upload,
  Cloud,
  FolderSearch,
} from "lucide-react";

export type StageStatus = "pending" | "active" | "passed" | "failed";

export interface WorkflowStage {
  id: string;
  label: string;
  icon: React.ElementType;
  status: StageStatus;
}

interface WorkflowSidebarProps {
  stages: WorkflowStage[];
  currentStage: string;
  onStageClick: (id: string) => void;
  completionPct: number;
  estimatedRemaining: string;
  onNavigate?: (screen: string) => void;
}

const statusConfig: Record<StageStatus, { color: string; dot: string; icon: React.ElementType }> = {
  pending: { color: "text-slate-400", dot: "bg-slate-600", icon: Circle },
  active: { color: "text-blue-400", dot: "bg-blue-500", icon: Loader2 },
  passed: { color: "text-emerald-400", dot: "bg-emerald-500", icon: CheckCircle2 },
  failed: { color: "text-red-400", dot: "bg-red-500", icon: XCircle },
};

export function WorkflowSidebar({
  stages,
  currentStage,
  onStageClick,
  completionPct,
  estimatedRemaining,
  onNavigate,
}: WorkflowSidebarProps) {
  return (
    <aside className="fixed left-0 top-14 bottom-0 w-64 bg-slate-900 border-r border-slate-700 flex flex-col overflow-hidden z-40">
      {/* Navigation links */}
      <div className="border-b border-slate-700">
        <button
          onClick={() => onNavigate && onNavigate("startup-home")}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs transition-colors ${
            currentStage === "startup-home"
              ? "bg-slate-700 text-white"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          <Home size={14} />
          <span>Home</span>
        </button>
        <button
          onClick={() => onNavigate && onNavigate("upload-queue")}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs transition-colors ${
            currentStage === "upload-queue"
              ? "bg-slate-700 text-white"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          <Upload size={14} />
          <span>Upload Queue</span>
        </button>
        <button
          onClick={() => onNavigate && onNavigate("sync-status")}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs transition-colors ${
            currentStage === "sync-status"
              ? "bg-slate-700 text-white"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          <Cloud size={14} />
          <span>Sync Status</span>
        </button>
        <button
          onClick={() => onNavigate && onNavigate("inspection-manager")}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs transition-colors ${
            currentStage === "inspection-manager"
              ? "bg-slate-700 text-white"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          <FolderSearch size={14} />
          <span>Inspection Manager</span>
        </button>
      </div>

      {/* Workflow steps */}
      <div className="flex-1 overflow-y-auto py-1">
        <div className="px-3 py-2">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">Inspection Workflow</span>
        </div>
        {stages.map((stage, index) => {
          const cfg = statusConfig[stage.status];
          const StatusIcon = cfg.icon;
          const StageIcon = stage.icon;
          const isActive = stage.id === currentStage;

          return (
            <button
              key={stage.id}
              onClick={() => onStageClick(stage.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs transition-colors relative ${
                isActive
                  ? "bg-blue-900/40 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500 rounded-r" />
              )}
              <div className={`shrink-0 ${cfg.color}`}>
                <StageIcon size={14} />
              </div>
              <span className="flex-1 text-left">{stage.label}</span>
              <div className={`shrink-0 ${cfg.color}`}>
                {stage.status === "active" ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <StatusIcon size={12} />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Asset tag placeholder */}
      <div className="p-3 border-t border-slate-700 text-[10px] text-slate-500">
        <div className="flex justify-between">
          <span>Asset Tag</span>
          <span className="text-slate-400 font-mono">AT-00892</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>LOT</span>
          <span className="text-slate-400 font-mono">CLY-003</span>
        </div>
      </div>
    </aside>
  );
}

export const defaultStages: WorkflowStage[] = [
  { id: "system-scan", label: "System Scan", icon: Monitor, status: "passed" },
  { id: "hardware-inventory", label: "Hardware Inventory", icon: HardDrive, status: "passed" },
  { id: "manual-grading", label: "Manual Grading", icon: ClipboardCheck, status: "active" },
  { id: "speaker-test", label: "Speaker Test", icon: Volume2, status: "pending" },
  { id: "webcam-test", label: "Webcam Test", icon: Camera, status: "pending" },
  { id: "keyboard-test", label: "Keyboard Test", icon: Keyboard, status: "pending" },
  { id: "touchpad-test", label: "Touchpad Test", icon: MousePointer2, status: "pending" },
  { id: "battery-assessment", label: "Battery Assessment", icon: Battery, status: "pending" },
  { id: "final-review", label: "Final Review", icon: FileSearch, status: "pending" },
  { id: "inspection-complete", label: "Inspection Complete", icon: CheckCircle2, status: "pending" },
];
