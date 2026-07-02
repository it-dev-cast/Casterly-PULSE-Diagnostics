import { useEffect, useState } from "react";
import { CheckCircle2, Download, Plus, Home, Star } from "lucide-react";
import { motion } from "motion/react";
import { invoke } from "@tauri-apps/api/core";
import { buildReportHtml, printHtmlReport } from "../../lib/report";

function deriveGrade(run: any): string {
  const g = run?.grading || {};
  const statuses = Object.entries(g)
    .filter(([k]) => k.endsWith("_status"))
    .map(([, v]) => String(v).toUpperCase());
  if (statuses.some((s) => s === "FAIL")) return "C";
  if (statuses.length && statuses.every((s) => s === "PASS")) return "A";
  return "B";
}

interface InspectionCompleteProps {
  onNewInspection: () => void;
  onHome: () => void;
  uuid?: string;
  timestamp?: string;
  lotName?: string;
  inspector?: string;
  serial?: string;
  deviceModel?: string;
  grade?: string;
}

export function InspectionComplete({
  onNewInspection,
  onHome,
  uuid = "",
  timestamp = "",
  lotName = "",
  inspector = "",
  serial = "",
  deviceModel = "",
  grade = "",
}: InspectionCompleteProps) {
  // Fetch the saved record so the screen reflects exactly what was stored,
  // independent of prop timing/session state.
  const [rec, setRec] = useState<any | null>(null);
  useEffect(() => {
    if (!uuid) return;
    invoke<string>("get_inspection_detail", { uuid })
      .then((j) => setRec(JSON.parse(j)))
      .catch((err) => console.error("Failed to load saved record:", err));
  }, [uuid]);

  // The real upload/sync state. Not read from the saved record's JSON blob --
  // that JSON is a snapshot frozen at save time with "uploaded" hardcoded to
  // false (see inspection/persist.rs), so it never reflects a sync that
  // completes afterwards. get_inspections reads the live "uploaded" column,
  // which sync_now / sync_pending update to 1 once the upload actually
  // succeeds (see upload/sync.rs), so that's the source of truth here.
  const [uploaded, setUploaded] = useState<boolean | null>(null);
  useEffect(() => {
    if (!uuid) return;
    let cancelled = false;
    const checkUploadStatus = () => {
      invoke<{ uuid: string; uploaded: boolean }[]>("get_inspections")
        .then((rows) => {
          if (cancelled) return;
          const row = rows.find((r) => r.uuid === uuid);
          if (row) setUploaded(row.uploaded);
        })
        .catch((err) => console.error("Failed to load upload status:", err));
    };
    checkUploadStatus();
    // sync_now runs in the background after save; poll briefly so this
    // screen picks up the flip from pending -> uploaded without a refresh.
    const interval = setInterval(checkUploadStatus, 2000);
    const timeout = setTimeout(() => clearInterval(interval), 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [uuid]);

  const uploadLabel = uploaded ? "Completed" : "Pending";
  const uploadColor = uploaded ? "text-emerald-600" : "text-amber-600";
  const uploadBg = uploaded
    ? "bg-emerald-50 border-emerald-200"
    : "bg-amber-50 border-amber-200";

  const sys = rec?.inventory?.system || {};
  const vSerial = serial || sys.serial_number || "—";
  const vModel = deviceModel || sys.model || "—";
  const vLot = lotName || rec?.lot_name || "—";
  const vInspector = inspector || rec?.inspector || "—";
  const vTimestamp = timestamp || rec?.timestamp || "—";
  const vGrade = grade || (rec ? deriveGrade(rec) : "");

  const handleDownloadReport = async () => {
    if (!uuid) {
      alert("No saved inspection to export.");
      return;
    }
    try {
      const json = await invoke<string>("get_inspection_detail", { uuid });
      printHtmlReport(buildReportHtml(JSON.parse(json)));
    } catch (err) {
      console.error("Failed to generate report:", err);
      alert(`Failed to generate report: ${err}`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8">
      {/* Success animation */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="relative"
      >
        <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center">
          <CheckCircle2 size={48} className="text-emerald-500" />
        </div>
        <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs">
          <Star size={14} fill="white" />
        </div>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="space-y-2"
      >
        <h1 className="text-slate-800 text-3xl">Inspection Complete!</h1>
        <p className="text-slate-500">
          {vModel} · Serial: {vSerial}
        </p>
        <p className="text-slate-400 text-sm">
          LOT {vLot} · Inspected by {vInspector}
        </p>
      </motion.div>

      {/* Result summary */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex gap-4"
      >
        {[
          { label: "Refurb Grade", value: vGrade ? `Grade ${vGrade}` : "—", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
          { label: "Upload", value: uploadLabel, color: uploadColor, bg: uploadBg },
          { label: "Inspector", value: vInspector, color: "text-slate-600", bg: "bg-slate-50 border-slate-200" },
          { label: "LOT", value: vLot, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
        ].map((item) => (
          <div key={item.label} className={`rounded-xl border px-6 py-4 text-center ${item.bg}`}>
            <div className={`text-xl leading-none ${item.color}`}>{item.value}</div>
            <div className="text-xs text-slate-500 mt-1">{item.label}</div>
          </div>
        ))}
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="flex gap-3"
      >
        <button
          onClick={handleDownloadReport}
          className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm px-4 py-2.5 rounded-lg transition-colors"
        >
          <Download size={15} />
          Download Report
        </button>
        <button
          onClick={onHome}
          className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm px-4 py-2.5 rounded-lg transition-colors"
        >
          <Home size={15} />
          Go Home
        </button>
        <button
          onClick={onNewInspection}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm px-5 py-2.5 rounded-lg transition-colors"
        >
          <Plus size={15} />
          New Inspection
        </button>
      </motion.div>

      {/* LOT progress */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="bg-white rounded-xl border border-slate-200 p-5 w-full max-w-md text-left"
      >
        <h3 className="text-slate-700 mb-3">Saved Record</h3>
        <div className="space-y-2">
          {[
            { label: "Inspection UUID", value: uuid || "—", mono: true },
            { label: "Saved", value: vTimestamp },
            { label: "Serial", value: vSerial, mono: true },
            { label: "Model", value: vModel },
            { label: "Grade", value: vGrade ? `Grade ${vGrade}` : "—" },
            { label: "Upload Status", value: uploadLabel, color: uploadColor },
          ].map((row) => (
            <div key={row.label} className="flex justify-between gap-3">
              <span className="text-xs text-slate-500">{row.label}</span>
              <span
                className={`text-xs font-medium text-right break-all ${
                  row.mono ? "font-mono" : ""
                } ${row.color || "text-slate-700"}`}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
