import { CheckCircle2, Download, Plus, Home, Star } from "lucide-react";
import { motion } from "motion/react";

interface InspectionCompleteProps {
  onNewInspection: () => void;
  onHome: () => void;
}

export function InspectionComplete({ onNewInspection, onHome }: InspectionCompleteProps) {
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
        <p className="text-slate-500">HP ProBook 440 G8 · Serial: 5CD124NJWZ</p>
        <p className="text-slate-400 text-sm">LOT CLY-003 · Inspected by Ravikiran K.</p>
      </motion.div>

      {/* Result summary */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex gap-4"
      >
        {[
          { label: "Overall Score", value: "82/100", color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
          { label: "Refurb Grade", value: "Grade B", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
          { label: "Duration", value: "22 mins", color: "text-slate-600", bg: "bg-slate-50 border-slate-200" },
          { label: "Tests Passed", value: "8/8", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
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
        <button className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm px-4 py-2.5 rounded-lg transition-colors">
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
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-slate-700">LOT CLY-003 Progress</h3>
          <span className="text-xs text-slate-400">33 / 48 complete</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
          <div className="h-full bg-blue-500 rounded-full" style={{ width: "68.75%" }} />
        </div>
        <p className="text-xs text-slate-400">15 devices remaining in this LOT</p>
      </motion.div>
    </div>
  );
}
