import {
  CheckCircle2,
  XCircle,
  Download,
  Save,
  ChevronRight,
  Cpu,
  MemoryStick,
  HardDrive,
  Battery,
  Monitor,
  AlertTriangle,
  Star,
} from "lucide-react";

interface FinalReviewProps {
  onComplete: () => void;
}

const gradeColors: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300" },
  B: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-300" },
  C: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-300" },
  D: { bg: "bg-red-50", text: "text-red-700", border: "border-red-300" },
};

function ScoreRing({ score }: { score: number }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={r} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl text-slate-800" style={{ color }}>{score}</span>
        <span className="text-[9px] text-slate-400">/ 100</span>
      </div>
    </div>
  );
}

export function FinalReview({ onComplete }: FinalReviewProps) {
  const diagResults = [
    { label: "System Scan", status: "pass" },
    { label: "Hardware Inventory", status: "pass" },
    { label: "Manual Grading", status: "pass" },
    { label: "Speaker Test", status: "pass" },
    { label: "Webcam Test", status: "pass" },
    { label: "Keyboard Test", status: "pass" },
    { label: "Touchpad Test", status: "pass" },
    { label: "Battery Assessment", status: "warn" },
  ];

  const passed = diagResults.filter((d) => d.status === "pass").length;
  const total = diagResults.length;
  const score = 82;
  const suggestedGrade = "B";
  const gradeStyle = gradeColors[suggestedGrade];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-800">Final Review</h1>
          <p className="text-sm text-slate-500 mt-0.5">Comprehensive inspection summary</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-lg transition-colors">
            <Download size={14} />
            Export PDF
          </button>
          <button
            onClick={onComplete}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            <Save size={14} />
            Save & Complete
          </button>
        </div>
      </div>

      {/* Score + grade hero */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-8">
        <ScoreRing score={score} />
        <div>
          <div className="text-slate-500 text-sm mb-1">Overall Inspection Score</div>
          <div className="text-3xl text-slate-800 mb-2">{score} / 100</div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-sm">Suggested Grade:</span>
            <span className={`text-lg px-3 py-0.5 rounded border-2 ${gradeStyle.bg} ${gradeStyle.text} ${gradeStyle.border}`}>
              Grade {suggestedGrade}
            </span>
          </div>
        </div>
        <div className="flex-1" />
        <div className="grid grid-cols-2 gap-3 text-center">
          {[
            { label: "Tests Passed", value: `${passed}/${total}`, color: "text-emerald-600" },
            { label: "Battery Health", value: "78%", color: "text-amber-600" },
            { label: "Storage Health", value: "94%", color: "text-emerald-600" },
            { label: "Cosmetic Grade", value: "B+", color: "text-blue-600" },
          ].map((m) => (
            <div key={m.label} className="bg-slate-50 rounded-lg p-3">
              <div className={`text-lg leading-none ${m.color}`}>{m.value}</div>
              <div className="text-[10px] text-slate-400 mt-1">{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Device info */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-slate-700 mb-3">Device Information</h3>
          <div className="space-y-2">
            {[
              { label: "Manufacturer", value: "HP" },
              { label: "Model", value: "ProBook 440 G8" },
              { label: "Serial", value: "5CD124NJWZ" },
              { label: "Asset Tag", value: "AT-00892" },
              { label: "LOT", value: "CLY-003" },
            ].map((item) => (
              <div key={item.label} className="flex justify-between">
                <span className="text-xs text-slate-500">{item.label}</span>
                <span className="text-xs text-slate-700 font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hardware summary */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-slate-700 mb-3">Hardware Summary</h3>
          <div className="space-y-2.5">
            {[
              { icon: <Cpu size={13} className="text-blue-500" />, label: "Intel Core i5-1135G7" },
              { icon: <MemoryStick size={13} className="text-purple-500" />, label: "16 GB DDR4 3200 MHz" },
              { icon: <HardDrive size={13} className="text-slate-400" />, label: "512 GB NVMe SSD" },
              { icon: <Battery size={13} className="text-amber-500" />, label: "Battery 78% · 312 cycles" },
              { icon: <Monitor size={13} className="text-emerald-500" />, label: "14\" FHD IPS" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                {item.icon}
                <span className="text-xs text-slate-600">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Diagnostic results */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-slate-700 mb-3">Diagnostic Results</h3>
          <div className="space-y-1.5">
            {diagResults.map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{item.label}</span>
                <div className={`flex items-center gap-1 text-[10px] ${
                  item.status === "pass" ? "text-emerald-600" :
                  item.status === "warn" ? "text-amber-600" : "text-red-600"
                }`}>
                  {item.status === "pass" ? <CheckCircle2 size={11} /> :
                   item.status === "warn" ? <AlertTriangle size={11} /> : <XCircle size={11} />}
                  {item.status === "pass" ? "Pass" : item.status === "warn" ? "Warn" : "Fail"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grading summary */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-slate-700 mb-3">Cosmetic Grading Summary</h3>
        <div className="flex gap-3 flex-wrap">
          {[
            { label: "LCD Screen", grade: "Pass" },
            { label: "Top Cover", grade: "Pass" },
            { label: "Bezel", grade: "Pass" },
            { label: "Palmrest", grade: "Pass" },
            { label: "Bottom Cover", grade: "Pass" },
            { label: "Keyboard", grade: "Pass" },
            { label: "Touchpad", grade: "Pass" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
              <CheckCircle2 size={12} className="text-emerald-600" />
              <span className="text-xs text-emerald-700">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Remarks */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-slate-700 mb-2">Technician Remarks</h3>
        <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 border border-slate-100">
          Battery health is below recommended 80% threshold. Device otherwise in good condition.
          Minor keyboard key wear noted but all keys functional. Recommend Grade B refurbishment.
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button className="flex items-center gap-2 text-sm bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-4 py-2.5 rounded-lg transition-colors">
          <Download size={14} />
          Export PDF
        </button>
        <button className="flex items-center gap-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2.5 rounded-lg transition-colors">
          <Save size={14} />
          Save Draft
        </button>
        <button
          onClick={onComplete}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm px-5 py-2.5 rounded-lg transition-colors"
        >
          <CheckCircle2 size={15} />
          Save & Complete Inspection
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
