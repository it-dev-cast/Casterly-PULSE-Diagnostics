import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { buildInspectionRun } from "../../lib/report";
import { exportReportFiles } from "../../lib/exportReport";
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
  clyNo?: string;
}

const gradeColors: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: "bg-emerald-500/10", text: "text-emerald-300", border: "border-emerald-300" },
  B: { bg: "bg-blue-500/10", text: "text-blue-300", border: "border-blue-300" },
  C: { bg: "bg-amber-500/10", text: "text-amber-300", border: "border-amber-300" },
  D: { bg: "bg-red-500/10", text: "text-red-300", border: "border-red-300" },
};

function ScoreRing({ score }: { score: number }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#1c3f66" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={r} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl text-slate-100" style={{ color }}>{score}</span>
        <span className="text-[9px] text-slate-500">/ 100</span>
      </div>
    </div>
  );
}

export function FinalReview({ onComplete, onSaveDraft, clyNo = "" }: FinalReviewProps) {
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

  const handleExportPdf = async () => {
    const run = buildInspectionRun(
      data,
      session.lotName,
      session.inspectorName,
      suggestedGrade,
      clyNo,
    );
    try {
      const folder = await exportReportFiles(run);
      if (folder) alert(`Report saved to:\n${folder}`);
    } catch (err) {
      console.error("Failed to export report:", err);
      alert(`Failed to export report: ${err}`);
    }
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
    <div className="-m-6 p-6 min-h-[calc(100vh-6rem)] bg-[#0a1626] space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-100">Final Review</h1>
          <p className="text-sm text-slate-500 mt-0.5">Comprehensive inspection summary</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-2 text-sm text-slate-300 bg-[#0f1e35] border border-[#1c3f66] hover:bg-[#132445] px-3 py-2 rounded-lg transition-colors"
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
      <div className="bg-[#0f1e35] rounded-xl border border-[#1c3f66] p-5 flex items-center gap-8">
        <ScoreRing score={score} />
        <div>
          <div className="text-slate-500 text-sm mb-1">Overall Inspection Score</div>
          <div className="text-3xl text-slate-100 mb-2">{score} / 100</div>
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
            { label: "Tests Passed", value: `${passed}/${total}`, color: "text-emerald-400" },
            { label: "Battery Health", value: batteryHealth ? `${batteryHealth}%` : "N/A", color: batteryHealth && batteryHealth < 80 ? "text-amber-400" : "text-emerald-400" },
            { label: "Storage Health", value: primaryDrive?.health_percent ? `${primaryDrive.health_percent}%` : "N/A", color: "text-emerald-400" },
            { label: "Cosmetic Grade", value: suggestedGrade, color: "text-blue-400" },
          ].map((m) => (
            <div key={m.label} className="bg-[#0d1b30] rounded-lg p-3">
              <div className={`text-lg leading-none ${m.color}`}>{m.value}</div>
              <div className="text-[10px] text-slate-500 mt-1">{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Device info */}
        <div className="bg-[#0f1e35] rounded-xl border border-[#1c3f66] p-4">
          <h3 className="text-slate-200 mb-3">Device Information</h3>
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
                <span className="text-xs text-slate-200 font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hardware summary */}
        <div className="bg-[#0f1e35] rounded-xl border border-[#1c3f66] p-4">
          <h3 className="text-slate-200 mb-3">Hardware Summary</h3>
          <div className="space-y-2.5">
            {[
              { icon: <Cpu size={13} className="text-blue-500" />, label: data.cpuInfo?.model || "CPU" },
              { icon: <MemoryStick size={13} className="text-purple-500" />, label: `${totalMemoryGb.toFixed(1)} GB ${firstMemoryModule?.memory_type || "RAM"}` },
              { icon: <HardDrive size={13} className="text-slate-500" />, label: `${primaryDrive ? `${primaryDrive.size_gb.toFixed(0)} GB ${primaryDrive.storage_type}` : "Storage"}` },
              { icon: <Battery size={13} className="text-amber-500" />, label: batteryHealth ? `Battery ${batteryHealth}% · ${data.batteryInfo?.cycle_count ?? 0} cycles` : "No battery" },
              { icon: <Monitor size={13} className="text-emerald-400" />, label: `${data.displayInfo?.size_inches?.toFixed(1) || "?"}" ${data.displayInfo?.resolution || ""}`.trim() },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                {item.icon}
                <span className="text-xs text-slate-300">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Diagnostic results */}
        <div className="bg-[#0f1e35] rounded-xl border border-[#1c3f66] p-4">
          <h3 className="text-slate-200 mb-3">Diagnostic Results</h3>
          <div className="space-y-1.5">
            {diagResults.map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{item.label}</span>
                <div className={`flex items-center gap-1 text-[10px] ${
                  item.status === "pass" ? "text-emerald-400" :
                  item.status === "warn" ? "text-amber-400" : "text-red-400"
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
      <div className="bg-[#0f1e35] rounded-xl border border-[#1c3f66] p-4">
        <h3 className="text-slate-200 mb-3">Cosmetic Grading Summary</h3>
        <div className="flex gap-3 flex-wrap">
          {cosmeticSummary.map((item) => {
            const isFail = item.grade === "Fail";
            const isPass = item.grade === "Pass";
            return (
              <div key={item.label} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 border ${
                isFail
                  ? "bg-red-500/10 border-red-500/30 text-red-300"
                  : isPass
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-[#0d1b30] border-[#1c3f66] text-slate-500"
              }`}>
                {isFail ? <XCircle size={12} className="text-red-400" /> :
                 isPass ? <CheckCircle2 size={12} className="text-emerald-400" /> :
                 <div className="w-3 h-3 rounded-full border border-[#1c3f66]" />}
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
      <div className="bg-[#0f1e35] rounded-xl border border-[#1c3f66] p-4">
        <h3 className="text-slate-200 mb-2">Technician Remarks</h3>
        <p className="text-sm text-slate-300 bg-[#0d1b30] rounded-lg p-3 border border-[#16294a] min-h-[3.5rem]">
          {grading.remarks || "No remarks recorded."}
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          onClick={handleExportPdf}
          className="flex items-center gap-2 text-sm bg-[#0f1e35] border border-[#1c3f66] hover:bg-[#132445] text-slate-300 px-4 py-2.5 rounded-lg transition-colors"
        >
          <Download size={14} />
          Export PDF
        </button>
        <button
          onClick={onSaveDraft}
          className="flex items-center gap-2 text-sm bg-[#16294a] hover:bg-[#22436e] text-slate-300 px-4 py-2.5 rounded-lg transition-colors"
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
