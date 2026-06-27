import { Battery, BatteryCharging, AlertTriangle, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import { useState } from "react";

interface BatteryAssessmentProps {
  onNext: () => void;
}

export function BatteryAssessment({ onNext }: BatteryAssessmentProps) {
  const [result, setResult] = useState<"pass" | "fail" | null>(null);

  const health = 78;
  const cycleCount = 312;
  const designCapacity = 45;
  const fullChargeCapacity = 35.1;
  const voltage = 11.4;
  const status = "Charging";

  const isHealthWarning = health < 80;
  const isCycleWarning = cycleCount > 500;

  const healthColor = health >= 80 ? "text-emerald-600" : health >= 60 ? "text-amber-600" : "text-red-600";
  const healthBg = health >= 80 ? "#10b981" : health >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-800">Battery Assessment</h1>
          <p className="text-sm text-slate-500 mt-0.5">Evaluate battery health and capacity</p>
        </div>
        {result && (
          <div className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg ${
            result === "pass" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
          }`}>
            {result === "pass" ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
            Battery {result === "pass" ? "Passed" : "Failed"}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Health gauge */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col items-center">
          <div className="relative w-32 h-32 flex items-center justify-center mb-4">
            <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="10" />
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
              <span className="text-[10px] text-slate-400">Health</span>
            </div>
          </div>
        </div>

        {/* Detailed metrics */}
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-slate-700 mb-4">Battery Metrics</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Design Capacity", value: `${designCapacity} Wh`, warn: false },
              { label: "Full Charge Capacity", value: `${fullChargeCapacity} Wh`, warn: false },
              { label: "Health", value: `${health}%`, warn: isHealthWarning },
              { label: "Cycle Count", value: cycleCount.toString(), warn: isCycleWarning },
              { label: "Current Voltage", value: `${voltage} V`, warn: false },
              { label: "Charge Status", value: status, warn: false },
            ].map((item) => (
              <div key={item.label} className={`rounded-lg p-3 border ${
                item.warn ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200"
              }`}>
                <div className={`text-base ${item.warn ? "text-amber-700" : "text-slate-800"}`}>
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
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-slate-700">Capacity vs Design</span>
          <span className="text-slate-500">{fullChargeCapacity} / {designCapacity} Wh ({health}%)</span>
        </div>
        <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              health >= 80 ? "bg-emerald-500" : health >= 60 ? "bg-amber-500" : "bg-red-500"
            }`}
            style={{ width: `${health}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-slate-700 mb-3">Assessment Decision</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setResult("pass")}
            className={`flex items-center justify-center gap-2 py-4 rounded-lg text-sm transition-colors ${
              result === "pass"
                ? "bg-emerald-500 text-white"
                : "bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100"
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
                : "bg-red-50 border border-red-200 text-red-700 hover:bg-red-100"
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
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-sm px-5 py-2.5 rounded-lg transition-colors"
        >
          Continue to Final Review
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
