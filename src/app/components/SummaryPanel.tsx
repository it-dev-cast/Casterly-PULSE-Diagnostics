import { AlertTriangle, Clock, Activity, Cpu, MemoryStick, HardDrive, Battery, Monitor, CheckCircle, XCircle, ChevronDown, ChevronRight, Upload, CheckCircle2 } from "lucide-react";
import { useState } from "react";

interface Alert {
  type: "warning" | "error" | "info";
  message: string;
}

interface SummaryPanelProps {
  completionPct: number;
  passed: number;
  failed: number;
  remaining: number;
  alerts: Alert[];
  elapsedTime: string;
  currentStage: string;
}

const alertColors = {
  warning: "border-l-orange-500 bg-orange-50 text-orange-700",
  error: "border-l-red-500 bg-red-50 text-red-700",
  info: "border-l-blue-500 bg-blue-50 text-blue-600",
};

const alertIcons = {
  warning: <AlertTriangle size={11} className="text-orange-500 shrink-0 mt-0.5" />,
  error: <XCircle size={11} className="text-red-500 shrink-0 mt-0.5" />,
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
}: SummaryPanelProps) {
  const [isTimelineExpanded, setIsTimelineExpanded] = useState(false);

  return (
    <aside className="fixed right-0 top-14 bottom-0 w-64 bg-white border-l border-slate-200 flex flex-col overflow-hidden z-40">
      {/* Progress metrics */}
      <div className="p-3 border-b border-slate-100">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Progress Metrics</div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Complete", value: `${completionPct}%`, color: "text-blue-600" },
            { label: "Passed", value: passed, color: "text-emerald-600" },
            { label: "Failed", value: failed, color: failed > 0 ? "text-red-600" : "text-slate-400" },
            { label: "Remaining", value: remaining, color: "text-slate-600" },
          ].map((m) => (
            <div key={m.label} className="bg-slate-50 rounded p-2 text-center">
              <div className={`text-base leading-none ${m.color}`}>{m.value}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Upload Status Widget */}
      <div className="p-3 border-b border-slate-100">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Upload Status</div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Clock size={11} className="text-orange-500" />
              <span className="text-xs text-slate-600">Pending</span>
            </div>
            <span className="text-sm text-orange-600 font-medium">3</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={11} className="text-emerald-500" />
              <span className="text-xs text-slate-600">Uploaded</span>
            </div>
            <span className="text-sm text-emerald-600 font-medium">124</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <XCircle size={11} className="text-red-500" />
              <span className="text-xs text-slate-600">Failed</span>
            </div>
            <span className="text-sm text-red-600 font-medium">2</span>
          </div>
        </div>
      </div>

      {/* Device summary */}
      <div className="p-3 border-b border-slate-100">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Device Summary</div>
        <div className="space-y-1.5">
          {[
            { icon: <span className="text-[10px] font-mono text-slate-400">SN</span>, label: "5CD124NJWZ" },
            { icon: <Cpu size={11} className="text-slate-400" />, label: "Intel Core i5-1135G7" },
            { icon: <MemoryStick size={11} className="text-slate-400" />, label: "16 GB DDR4" },
            { icon: <HardDrive size={11} className="text-slate-400" />, label: "512 GB SSD NVMe" },
            { icon: <Battery size={11} className="text-slate-400" />, label: "Battery: 78%" },
            { icon: <Monitor size={11} className="text-slate-400" />, label: "14\" FHD IPS" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-4 flex items-center justify-center">{item.icon}</div>
              <span className="text-xs text-slate-600">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Cosmetic summary */}
      <div className="p-3 border-b border-slate-100">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Cosmetic Summary</div>
        <div className="space-y-1">
          {[
            { label: "LCD", status: "Pass" },
            { label: "Top Cover", status: "Pass" },
            { label: "Bezel", status: "Pending" },
            { label: "Palmrest", status: "Pending" },
            { label: "Bottom Cover", status: "Pending" },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{item.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  item.status === "Pass"
                    ? "bg-emerald-100 text-emerald-700"
                    : item.status === "Fail"
                    ? "bg-red-100 text-red-700"
                    : "bg-slate-100 text-slate-500"
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
        <div className="p-3 border-b border-slate-100">
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
      <div className="border-t border-slate-100">
        <button
          onClick={() => setIsTimelineExpanded(!isTimelineExpanded)}
          className="w-full p-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">Activity Timeline</div>
          {isTimelineExpanded ? (
            <ChevronDown size={12} className="text-slate-400" />
          ) : (
            <ChevronRight size={12} className="text-slate-400" />
          )}
        </button>
        {isTimelineExpanded && (
          <div className="px-3 pb-3 space-y-2 max-h-48 overflow-y-auto">
            {[
              { icon: <Activity size={10} />, label: "Inspection Started", time: "09:14 AM", color: "text-blue-500" },
              { icon: <CheckCircle size={10} />, label: "System Scan Passed", time: "09:17 AM", color: "text-emerald-500" },
              { icon: <CheckCircle size={10} />, label: "Hardware Verified", time: "09:19 AM", color: "text-emerald-500" },
              { icon: <Clock size={10} />, label: currentStage.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), time: "Now", color: "text-blue-500" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className={`mt-0.5 ${item.color}`}>{item.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-slate-600 truncate">{item.label}</div>
                  <div className="text-[9px] text-slate-400">{item.time}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1"></div>

      {/* Bottom actions */}
      <div className="p-3 border-t border-slate-200 space-y-1.5">
        <button className="w-full text-xs bg-blue-600 hover:bg-blue-500 text-white rounded py-2 transition-colors">
          Save Inspection
        </button>
        <div className="grid grid-cols-2 gap-1.5">
          <button className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded py-1.5 transition-colors">
            Save Draft
          </button>
          <button className="text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded py-1.5 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </aside>
  );
}
