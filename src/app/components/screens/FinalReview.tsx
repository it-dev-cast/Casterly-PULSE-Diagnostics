import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { buildInspectionRun, buildReportHtml, printHtmlReport } from "../../lib/report";
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
} from "lucide-react";
import { useInspection } from "../../context/InspectionContext";

interface FinalReviewProps {
  onComplete: () => void;
  onSaveDraft?: () => void;
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

export function FinalReview({ onComplete, onSaveDraft }: FinalReviewProps) {
  const { data } = useInspection();
  const grading = data.grading;

  // Active LOT name and inspector come from the session (settings keys
  // 'active_lot' / 'inspector') — these populate InspectionRun.lot_name and
  // InspectionRun.inspector per the PRD.
  const [session, setSession] = useState<{
    lotName: string;
    inspectorName: string;
  }>({ lotName: "", inspectorName: "" });

  useEffect(() => {
    invoke<{ lotName: string; inspectorName: string }>("get_session")
      .then(setSession)
      .catch((err) => console.error("Failed to load session:", err));
  }, []);

  const manualGradingStatus = Object.values(grading.grades).some((g) => g === "fail")
    ? "fail"
    : Object.values(grading.grades).every((g) => g === "pass")
    ? "pass"
    : "warn";

  const diagResults = [
    { label: "System Scan", status: data.scanCompleted ? "pass" : "warn" },
    { label: "Hardware Inventory", status: data.scanCompleted ? "pass" : "warn" },
    { label: "Manual Grading", status: manualGradingStatus },
    { label: "Speaker Test", status: data.speakerTest.result ?? "warn" },
    { label: "Webcam Test", status: data.webcamTest.result ?? "warn" },
    { label: "Keyboard Test", status: data.keyboardTest.result ?? "warn" },
    { label: "Touchpad Test", status: data.touchpadTest.result ?? "warn" },
    { label: "Battery Assessment", status: data.batteryAssessment.result ?? "warn" },
  ] as { label: string; status: "pass" | "fail" | "warn" }[];

  const passed = diagResults.filter((d) => d.status === "pass").length;
  const failed = diagResults.filter((d) => d.status === "fail").length;
  const total = diagResults.length;

  // Score: start at 100, subtract for failures (15 each) and warnings (5 each),
  // floor at 0.
  const score = Math.max(0, 100 - failed * 15 - (total - passed - failed) * 5);

  // Cosmetic grade based on manual grading results.
  const suggestedGrade = (() => {
    if (manualGradingStatus === "fail") return "C";
    if (Object.values(grading.grades).every((g) => g === "pass")) return "A";
    return "B";
  })();
  const gradeStyle = gradeColors[suggestedGrade];

  const handleExportPdf = () => {
    const run = buildInspectionRun(
      data,
      session.lotName,
      session.inspectorName,
      suggestedGrade,
    );
    printHtmlReport(buildReportHtml(run));
  };

  const system = data.systemInfo || {};
  const primaryDrive = data.storageInfo?.[0];
  const firstMemoryModule = (data.memoryInfo || []).find((m: any) => !m.is_empty);
  const totalMemoryGb = (data.memoryInfo || []).reduce((sum: number, m: any) => sum + (m.size_mb || 0), 0) / 1024;

  const batteryHealth = data.batteryInfo && data.batteryInfo.design_capacity_mwh > 0
    ? Math.round((data.batteryInfo.full_charge_capacity_mwh / data.batteryInfo.design_capacity_mwh) * 100)
    : null;

  const cosmeticSummary = [
    { key: "lcd", label: "LCD Screen" },
    { key: "topCover", label: "Top Cover" },
    { key: "bezel", label: "Bezel" },
    { key: "palmrest", label: "Palmrest" },
    { key: "bottomCover", label: "Bottom Cover" },
    { key: "keyboard", label: "Keyboard" },
    { key: "touchpad", label: "Touchpad" },
  ].map((item) => ({
    label: item.label,
    grade: grading.grades[item.key] === "fail" ? "Fail" : grading.grades[item.key] === "pass" ? "Pass" : "Pending",
    defects: grading.selectedDefects[item.key] || [],
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-800">Final Review</h1>
          <p className="text-sm text-slate-500 mt-0.5">Comprehensive inspection summary</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-lg transition-colors"
          >
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
            { label: "Battery Health", value: batteryHealth ? `${batteryHealth}%` : "N/A", color: batteryHealth && batteryHealth < 80 ? "text-amber-600" : "text-emerald-600" },
            { label: "Storage Health", value: primaryDrive?.health_percent ? `${primaryDrive.health_percent}%` : "N/A", color: "text-emerald-600" },
            { label: "Cosmetic Grade", value: suggestedGrade, color: "text-blue-600" },
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
              { label: "Manufacturer", value: system.manufacturer || "—" },
              { label: "Model", value: system.model || "—" },
              { label: "Serial", value: system.serial_number || "—" },
              { label: "UUID", value: system.uuid || "—" },
              { label: "LOT", value: session.lotName || "—" },
              { label: "Inspector", value: session.inspectorName || "—" },
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
              { icon: <Cpu size={13} className="text-blue-500" />, label: data.cpuInfo?.model || "CPU" },
              { icon: <MemoryStick size={13} className="text-purple-500" />, label: `${totalMemoryGb.toFixed(1)} GB ${firstMemoryModule?.memory_type || "RAM"}` },
              { icon: <HardDrive size={13} className="text-slate-400" />, label: `${primaryDrive ? `${primaryDrive.size_gb.toFixed(0)} GB ${primaryDrive.storage_type}` : "Storage"}` },
              { icon: <Battery size={13} className="text-amber-500" />, label: batteryHealth ? `Battery ${batteryHealth}% · ${data.batteryInfo?.cycle_count ?? 0} cycles` : "No battery" },
              { icon: <Monitor size={13} className="text-emerald-500" />, label: `${data.displayInfo?.size_inches?.toFixed(1) || "?"}" ${data.displayInfo?.resolution || ""}`.trim() },
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
                  {item.status === "pass" ? "Pass" : item.status === "warn" ? "Pending" : "Fail"}
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
          {cosmeticSummary.map((item) => {
            const isFail = item.grade === "Fail";
            const isPass = item.grade === "Pass";
            return (
              <div key={item.label} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 border ${
                isFail
                  ? "bg-red-50 border-red-200 text-red-700"
                  : isPass
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-slate-50 border-slate-200 text-slate-500"
              }`}>
                {isFail ? <XCircle size={12} className="text-red-600" /> :
                 isPass ? <CheckCircle2 size={12} className="text-emerald-600" /> :
                 <div className="w-3 h-3 rounded-full border border-slate-300" />}
                <span className="text-xs">
                  {item.label} — {item.grade}
                  {item.defects.length > 0 ? ` (${item.defects.join(", ")})` : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Remarks */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-slate-700 mb-2">Technician Remarks</h3>
        <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 border border-slate-100 min-h-[3.5rem]">
          {grading.remarks || "No remarks recorded."}
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          onClick={handleExportPdf}
          className="flex items-center gap-2 text-sm bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-4 py-2.5 rounded-lg transition-colors"
        >
          <Download size={14} />
          Export PDF
        </button>
        <button
          onClick={onSaveDraft}
          className="flex items-center gap-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2.5 rounded-lg transition-colors"
        >
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
