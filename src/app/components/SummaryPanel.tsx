import { AlertTriangle, Clock, Activity, Cpu, MemoryStick, HardDrive, Battery, Monitor, CheckCircle, XCircle, ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useInspection } from "../context/InspectionContext";

interface Alert {
  type: "warning" | "error" | "info";
  message: string;
}

interface ActivityEntry {
  label: string;
  time: number;
}

interface SummaryPanelProps {
  completionPct: number;
  passed: number;
  failed: number;
  remaining: number;
  alerts: Alert[];
  elapsedTime: string;
  currentStage: string;
  activityLog: ActivityEntry[];
}

const alertColors = {
  warning: "border-l-orange-500 bg-orange-500/10 text-orange-300",
  error: "border-l-red-500 bg-red-500/10 text-red-300",
  info: "border-l-blue-500 bg-blue-500/10 text-blue-400",
};

const alertIcons = {
  warning: <AlertTriangle size={11} className="text-orange-400 shrink-0 mt-0.5" />,
  error: <XCircle size={11} className="text-red-400 shrink-0 mt-0.5" />,
  info: <CheckCircle size={11} className="text-blue-500 shrink-0 mt-0.5" />,
};

export function SummaryPanel({
  completionPct,
  passed,
  failed,
  remaining,
  alerts,
  elapsedTime,
  currentStage,
  activityLog,
}: SummaryPanelProps) {
  const [isTimelineExpanded, setIsTimelineExpanded] = useState(false);
  const { data } = useInspection();
  const [upload, setUpload] = useState({ pending: 0, uploaded: 0, failed: 0 });

  useEffect(() => {
    invoke<{ pending: number; uploaded: number; failed: number }>(
      "get_sync_status",
    )
      .then((s) =>
        setUpload({ pending: s.pending, uploaded: s.uploaded, failed: s.failed }),
      )
      .catch((err) => console.error("Failed to load upload status:", err));
  }, [currentStage]);

  // Device summary from the live scan (InspectionContext).
  const sys = data.systemInfo as any;
  const cpu = data.cpuInfo as any;
  const mem = (data.memoryInfo || []) as any[];
  const totalMemGb =
    mem.reduce((s, m) => s + (m.size_mb || 0), 0) / 1024;
  const memType = mem.find((m) => !m.is_empty)?.memory_type;
  const drive = (data.storageInfo || [])[0] as any;
  const batt = data.batteryInfo as any;
  const battHealth =
    batt && batt.design_capacity_mwh > 0
      ? Math.round((batt.full_charge_capacity_mwh / batt.design_capacity_mwh) * 100)
      : null;
  const disp = data.displayInfo as any;

  const deviceSummary = [
    { icon: <span className="text-[10px] font-mono text-slate-500">SN</span>, label: sys?.serial_number || "—" },
    { icon: <Cpu size={11} className="text-slate-500" />, label: cpu?.model || "—" },
    { icon: <MemoryStick size={11} className="text-slate-500" />, label: mem.length ? `${totalMemGb.toFixed(0)} GB ${memType || ""}`.trim() : "—" },
    { icon: <HardDrive size={11} className="text-slate-500" />, label: drive ? `${drive.size_gb?.toFixed(0)} GB ${drive.storage_type || ""}`.trim() : "—" },
    { icon: <Battery size={11} className="text-slate-500" />, label: battHealth != null ? `Battery: ${battHealth}%` : "—" },
    { icon: <Monitor size={11} className="text-slate-500" />, label: disp ? `${disp.size_inches?.toFixed(0)}" ${disp.resolution || ""}`.trim() : "—" },
  ];

  const g = data.grading.grades;
  const st = (v: string | null) =>
    v === "pass" ? "Pass" : v === "fail" ? "Fail" : "Pending";
  const cosmeticSummary = [
    { label: "LCD", status: st(g.lcd) },
    { label: "Top Cover", status: st(g.topCover) },
    { label: "Bezel", status: st(g.bezel) },
    { label: "Palmrest", status: st(g.palmrest) },
    { label: "Bottom Cover", status: st(g.bottomCover) },
  ];

  return (
    // Positioning/fixing is the caller's responsibility (it's mounted in
    // three different contexts: a standalone fixed rail, a collapsible
    // panel, and a slide-out drawer). This component just fills whatever
    // box it's given and handles its own internal scrolling, so content
    // never gets silently clipped on shorter/narrower laptop screens.
    <div className="h-full w-full bg-[#0f1e35] border-l border-[#1c3f66] flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto sidebar-scroll-light">
      {/* Progress metrics */}
      <div className="p-3 border-b border-[#16294a]">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Progress Metrics</div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Complete", value: `${completionPct}%`, color: "text-blue-400" },
            { label: "Passed", value: passed, color: "text-emerald-400" },
            { label: "Failed", value: failed, color: failed > 0 ? "text-red-400" : "text-slate-500" },
            { label: "Remaining", value: remaining, color: "text-slate-300" },
          ].map((m) => (
            <div key={m.label} className="bg-[#0d1b30] rounded p-2 text-center">
              <div className={`text-base leading-none ${m.color}`}>{m.value}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Upload Status Widget */}
      <div className="p-3 border-b border-[#16294a]">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Upload Status</div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Clock size={11} className="text-orange-400" />
              <span className="text-xs text-slate-300">Pending</span>
            </div>
            <span className="text-sm text-orange-400 font-medium">{upload.pending}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={11} className="text-emerald-400" />
              <span className="text-xs text-slate-300">Uploaded</span>
            </div>
            <span className="text-sm text-emerald-400 font-medium">{upload.uploaded}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <XCircle size={11} className="text-red-400" />
              <span className="text-xs text-slate-300">Failed</span>
            </div>
            <span className="text-sm text-red-400 font-medium">{upload.failed}</span>
          </div>
        </div>
      </div>

      {/* Device summary */}
      <div className="p-3 border-b border-[#16294a]">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Device Summary</div>
        <div className="space-y-1.5">
          {deviceSummary.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-4 flex items-center justify-center">{item.icon}</div>
              <span className="text-xs text-slate-300">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Cosmetic summary */}
      <div className="p-3 border-b border-[#16294a]">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Cosmetic Summary</div>
        <div className="space-y-1">
          {cosmeticSummary.map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{item.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  item.status === "Pass"
                    ? "bg-emerald-500/15 text-emerald-300"
                    : item.status === "Fail"
                    ? "bg-red-500/15 text-red-300"
                    : "bg-[#16294a] text-slate-500"
                }`}
              >
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="p-3 border-b border-[#16294a]">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Alerts</div>
          <div className="space-y-1.5">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className={`flex gap-1.5 text-[10px] border-l-2 pl-2 py-1 rounded-r ${alertColors[alert.type]}`}
              >
                {alertIcons[alert.type]}
                <span>{alert.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity timeline - Collapsible */}
      <div className="border-t border-[#16294a]">
        <button
          onClick={() => setIsTimelineExpanded(!isTimelineExpanded)}
          className="w-full p-3 flex items-center justify-between hover:bg-[#132445] transition-colors"
        >
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">Activity Timeline</div>
          {isTimelineExpanded ? (
            <ChevronDown size={12} className="text-slate-500" />
          ) : (
            <ChevronRight size={12} className="text-slate-500" />
          )}
        </button>
        {isTimelineExpanded && (
          <div className="px-3 pb-3 space-y-2 max-h-48 overflow-y-auto">
            {[
              ...activityLog.map((entry) => ({
                icon: entry.label.includes("Started") ? (
                  <Activity size={10} />
                ) : entry.label.includes("Failed") ? (
                  <XCircle size={10} />
                ) : (
                  <CheckCircle size={10} />
                ),
                label: entry.label,
                time: new Date(entry.time).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                color: entry.label.includes("Failed")
                  ? "text-red-400"
                  : entry.label.includes("Started")
                    ? "text-blue-500"
                    : "text-emerald-400",
              })),
              {
                icon: <Clock size={10} />,
                label: currentStage.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
                time: "Now",
                color: "text-blue-500",
              },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className={`mt-0.5 ${item.color}`}>{item.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-slate-300 truncate">{item.label}</div>
                  <div className="text-[9px] text-slate-500">{item.time}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      </div>
    </div>
  );
}
