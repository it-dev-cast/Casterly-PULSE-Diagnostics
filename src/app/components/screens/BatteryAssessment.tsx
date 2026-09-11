import { Battery, BatteryCharging, AlertTriangle, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { useInspection } from "../../context/InspectionContext";

interface BatteryInfo {
  manufacturer: string;
  model: string;
  serial_number: string;
  technology: string;
  status: string;
  cycle_count: number;
  design_capacity_mwh: number;
  full_charge_capacity_mwh: number;
  current_capacity_mwh: number;
  voltage_mv: number;
}

interface BatteryAssessmentProps {
  onNext: () => void;
}

export function BatteryAssessment({ onNext }: BatteryAssessmentProps) {
  const { data, setData } = useInspection();
  const batteryInfo: BatteryInfo | null = data.batteryInfo;

  const [result, setResult] = useState<"pass" | "fail" | null>(data.batteryAssessment.result);

  // Persist the assessment result whenever the user makes a decision.
  useEffect(() => {
    if (data.batteryAssessment.result !== result) {
      setData((prev) => ({
        ...prev,
        batteryAssessment: { result },
      }));
    }
  }, [result, setData, data.batteryAssessment.result]);

  // Fallback defaults for layout when no battery is present.
  const designCapacity = batteryInfo && batteryInfo.design_capacity_mwh > 0
    ? batteryInfo.design_capacity_mwh / 1000
    : 45;
  const fullChargeCapacity = batteryInfo && batteryInfo.full_charge_capacity_mwh > 0
    ? batteryInfo.full_charge_capacity_mwh / 1000
    : 35.1;
  const cycleCount = batteryInfo ? batteryInfo.cycle_count : 0;
  const voltage = batteryInfo ? batteryInfo.voltage_mv / 1000 : 11.4;
  const status = batteryInfo ? batteryInfo.status : "Unknown";
  const health = designCapacity > 0
    ? Math.round((fullChargeCapacity / designCapacity) * 100)
    : 78;

  const isHealthWarning = health < 80;
  const isCycleWarning = cycleCount > 500;

  const healthColor = health >= 80 ? "text-emerald-400" : health >= 60 ? "text-amber-400" : "text-red-400";
  const healthBg = health >= 80 ? "#10b981" : health >= 60 ? "#f59e0b" : "#ef4444";

  if (!batteryInfo) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-slate-100">Battery Assessment</h1>
          <p className="text-sm text-slate-500 mt-0.5">No battery detected on this device.</p>
        </div>
        <div className="flex justify-end">
          <button
            onClick={onNext}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm px-5 py-2.5 rounded-lg transition-colors"
          >
            Continue to Final Review
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="-m-6 p-6 min-h-[calc(100vh-6rem)] bg-[#0a1626] space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-100">Battery Assessment</h1>
          <p className="text-sm text-slate-500 mt-0.5">Evaluate battery health and capacity</p>
        </div>
        {result && (
          <div className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg ${
            result === "pass" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"
          }`}>
            {result === "pass" ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
            Battery {result === "pass" ? "Passed" : "Failed"}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Health gauge */}
        <div className="bg-[#0f1e35] rounded-xl border border-[#1c3f66] p-5 flex flex-col items-center">
          <div className="relative w-32 h-32 flex items-center justify-center mb-4">
            <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#1c3f66" strokeWidth="10" />
              <circle
                cx="50" cy="50" r="40" fill="none"
                stroke={healthBg} strokeWidth="10"
                strokeDasharray={`${(health / 100) * 251.2} 251.2`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Battery size={20} className={healthColor} />
              <span className={`text-2xl mt-1 ${healthColor}`}>{health}%</span>
              <span className="text-[10px] text-slate-500">Health</span>
            </div>
          </div>
        </div>

        {/* Detailed metrics */}
        <div className="col-span-2 bg-[#0f1e35] rounded-xl border border-[#1c3f66] p-4">
          <h3 className="text-slate-200 mb-4">Battery Metrics</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Design Capacity", value: `${designCapacity.toFixed(1)} Wh`, warn: false },
              { label: "Full Charge Capacity", value: `${fullChargeCapacity.toFixed(1)} Wh`, warn: false },
              { label: "Health", value: `${health}%`, warn: isHealthWarning },
              { label: "Cycle Count", value: cycleCount.toString(), warn: isCycleWarning },
              { label: "Current Voltage", value: `${voltage.toFixed(2)} V`, warn: false },
              { label: "Charge Status", value: status, warn: false },
            ].map((item) => (
              <div key={item.label} className={`rounded-lg p-3 border ${
                item.warn ? "bg-amber-500/10 border-amber-500/30" : "bg-[#0d1b30] border-[#1c3f66]"
              }`}>
                <div className={`text-base ${item.warn ? "text-amber-300" : "text-slate-100"}`}>
                  {item.value}
                </div>
                <div className={`text-xs mt-0.5 ${item.warn ? "text-amber-500" : "text-slate-500"}`}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Capacity bar */}
      <div className="bg-[#0f1e35] rounded-xl border border-[#1c3f66] p-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-slate-200">Capacity vs Design</span>
          <span className="text-slate-500">{fullChargeCapacity.toFixed(1)} / {designCapacity.toFixed(1)} Wh ({health}%)</span>
        </div>
        <div className="h-4 bg-[#16294a] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              health >= 80 ? "bg-emerald-500" : health >= 60 ? "bg-amber-500" : "bg-red-500"
            }`}
            style={{ width: `${health}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 mt-1">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      <div className="bg-[#0f1e35] rounded-xl border border-[#1c3f66] p-4">
        <h3 className="text-slate-200 mb-3">Assessment Decision</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setResult("pass")}
            className={`flex items-center justify-center gap-2 py-4 rounded-lg text-sm transition-colors ${
              result === "pass"
                ? "bg-emerald-500 text-white"
                : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/15"
            }`}
          >
            <CheckCircle2 size={16} />
            Pass — Accept Battery
          </button>
          <button
            onClick={() => setResult("fail")}
            className={`flex items-center justify-center gap-2 py-4 rounded-lg text-sm transition-colors ${
              result === "fail"
                ? "bg-red-500 text-white"
                : "bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/15"
            }`}
          >
            <XCircle size={16} />
            Fail — Flag for Replacement
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={!result}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-[#1c3f66] disabled:text-slate-500 disabled:cursor-not-allowed text-white text-sm px-5 py-2.5 rounded-lg transition-colors"
        >
          Continue to Final Review
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
