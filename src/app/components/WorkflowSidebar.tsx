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
    <aside className="fixed left-0 top-16 bottom-8 w-64 bg-[#0B2545] border-r border-[#123a63] flex flex-col overflow-hidden z-40">
      {/* Navigation links */}
      <div className="border-b border-[#123a63]">
        <button
          onClick={() => onNavigate && onNavigate("startup-home")}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-semibold text-white transition-colors ${
            currentStage === "startup-home"
              ? "bg-[#123a63]"
              : "hover:bg-[#123a63]/60"
          }`}
        >
          <Home size={14} />
          <span>Home</span>
        </button>
        <button
          onClick={() => onNavigate && onNavigate("upload-queue")}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-semibold text-white transition-colors ${
            currentStage === "upload-queue"
              ? "bg-[#123a63]"
              : "hover:bg-[#123a63]/60"
          }`}
        >
          <Upload size={14} />
          <span>Upload Queue</span>
        </button>
        <button
          onClick={() => onNavigate && onNavigate("sync-status")}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-semibold text-white transition-colors ${
            currentStage === "sync-status"
              ? "bg-[#123a63]"
              : "hover:bg-[#123a63]/60"
          }`}
        >
          <Cloud size={14} />
          <span>Sync Status</span>
        </button>
        <button
          onClick={() => onNavigate && onNavigate("inspection-manager")}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-semibold text-white transition-colors ${
            currentStage === "inspection-manager"
              ? "bg-[#123a63]"
              : "hover:bg-[#123a63]/60"
          }`}
        >
          <FolderSearch size={14} />
          <span>Inspection Manager</span>
        </button>
      </div>

      {/* Workflow steps */}
      <div className="flex-1 min-h-0 overflow-y-auto py-1 sidebar-scroll">
        <div className="px-3 py-2">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Inspection Workflow</span>
        </div>
        {stages.map((stage, index) => {
          const cfg = statusConfig[stage.status];
          const StatusIcon = cfg.icon;
          const StageIcon = stage.icon;
          const isActive = stage.id === currentStage;
          // A stage hasn't been reached yet until it's at least "active"
          // (in progress) — "pending" stages are locked so the user can't
          // jump ahead to a screen with no real data collected yet.
          const isLocked = stage.status === "pending";

          return (
            <button
              key={stage.id}
              onClick={() => onStageClick(stage.id)}
              disabled={isLocked}
              title={isLocked ? "Complete the previous steps first" : undefined}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-semibold text-white transition-colors relative ${
                isActive
                  ? "bg-blue-900/40"
                  : isLocked
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-[#123a63]/60"
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500 rounded-r" />
              )}
              <div className={`shrink-0 ${cfg.color}`}>
                <StageIcon size={14} />
              </div>
              <span className="flex-1 text-left">{stage.label}</span>
              <div className={`shrink-0 flex items-center justify-center ${cfg.color}`}>
                {stage.status === "active" ? (
                  <Loader2 size={16} strokeWidth={2.75} className="animate-spin" />
                ) : (
                  <StatusIcon size={16} strokeWidth={2.75} />
                )}
              </div>
            </button>
          );
        })}
      </div>

    </aside>
  );
}

// All stages start "pending" (round, unstarted icon). App.tsx's
// startInspection() is what flips the first stage to "active" once the
// user actually clicks "Start New Inspection" — nothing here should imply
// progress before that happens.
export const defaultStages: WorkflowStage[] = [
  { id: "system-scan", label: "System Scan", icon: Monitor, status: "pending" },
  { id: "hardware-inventory", label: "Hardware Inventory", icon: HardDrive, status: "pending" },
  { id: "manual-grading", label: "Manual Grading", icon: ClipboardCheck, status: "pending" },
  { id: "speaker-test", label: "Speaker Test", icon: Volume2, status: "pending" },
  { id: "webcam-test", label: "Webcam Test", icon: Camera, status: "pending" },
  { id: "keyboard-test", label: "Keyboard Test", icon: Keyboard, status: "pending" },
  { id: "touchpad-test", label: "Touchpad Test", icon: MousePointer2, status: "pending" },
  { id: "battery-assessment", label: "Battery Assessment", icon: Battery, status: "pending" },
  { id: "final-review", label: "Final Review", icon: FileSearch, status: "pending" },
  { id: "inspection-complete", label: "Inspection Complete", icon: CheckCircle2, status: "pending" },
];
