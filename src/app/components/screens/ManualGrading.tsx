import { CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import { useInspection, type GradeResult } from "../../context/InspectionContext";

type GradeResultLocal = GradeResult;

interface DefectType {
  id: string;
  label: string;
}

const lcdDefects: DefectType[] = [
  { id: "patch", label: "Patch" },
  { id: "spot", label: "Spot" },
  { id: "pressure-mark", label: "Pressure Mark" },
  { id: "keyboard-impression", label: "Keyboard Impression" },
  { id: "line", label: "Line" },
  { id: "crack", label: "Crack" },
  { id: "dead-pixel", label: "Dead Pixel" },
];

const bodyDefects: DefectType[] = [
  { id: "paint-peel", label: "Paint Peel" },
  { id: "scratch", label: "Scratch" },
  { id: "dent", label: "Dent" },
  { id: "broken", label: "Broken" },
];

const keyboardDefects: DefectType[] = [
  { id: "worn-out", label: "Worn Out" },
  { id: "keys-missing", label: "Keys Missing" },
];

interface GradingItemProps {
  label: string;
  result: GradeResultLocal;
  onPass: () => void;
  onFail: () => void;
  defects?: DefectType[];
  selectedDefects?: string[];
  onDefectToggle?: (id: string) => void;
}

function GradingItem({ label, result, onPass, onFail, defects, selectedDefects, onDefectToggle }: GradingItemProps) {
  return (
    <div className={`bg-[#0f1e35] rounded-lg border-2 transition-colors ${
      result === "pass" ? "border-emerald-400" : result === "fail" ? "border-red-400" : "border-[#1c3f66]"
    }`}>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {result === "pass" && <CheckCircle2 size={16} className="text-emerald-400" />}
            {result === "fail" && <XCircle size={16} className="text-red-400" />}
            {result === null && <div className="w-4 h-4 rounded-full border-2 border-[#1c3f66]" />}
            <span className="text-sm text-slate-200">{label}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onPass}
              className={`px-4 py-1.5 rounded text-xs transition-colors ${
                result === "pass"
                  ? "bg-emerald-500 text-white"
                  : "bg-[#16294a] text-slate-300 hover:bg-emerald-500/10 hover:text-emerald-300"
              }`}
            >
              Pass
            </button>
            <button
              onClick={onFail}
              className={`px-4 py-1.5 rounded text-xs transition-colors ${
                result === "fail"
                  ? "bg-red-500 text-white"
                  : "bg-[#16294a] text-slate-300 hover:bg-red-500/10 hover:text-red-300"
              }`}
            >
              Fail
            </button>
          </div>
        </div>

        {defects && result === "fail" && (
          <div className="mt-3 pt-3 border-t border-[#16294a]">
            <p className="text-[11px] text-slate-500 mb-2">Defect Types (Multi-select)</p>
            <div className="flex flex-wrap gap-2">
              {defects.map((d) => (
                <button
                  key={d.id}
                  onClick={() => onDefectToggle?.(d.id)}
                  className={`px-2.5 py-1 rounded text-xs border transition-colors ${
                    selectedDefects?.includes(d.id)
                      ? "bg-red-500/15 border-red-300 text-red-300"
                      : "bg-[#0d1b30] border-[#1c3f66] text-slate-500 hover:border-red-300"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ManualGradingProps {
  onNext: () => void;
}

export function ManualGrading({ onNext }: ManualGradingProps) {
  const { data, setData } = useInspection();
  const { grades, selectedDefects, remarks } = data.grading;

  const setGrade = (key: string, value: GradeResultLocal) => {
    setData((prev) => ({
      ...prev,
      grading: {
        ...prev.grading,
        grades: { ...prev.grading.grades, [key]: value },
      },
    }));
  };

  const toggleDefect = (componentKey: string, defectId: string) => {
    setData((prev) => {
      const current = prev.grading.selectedDefects[componentKey] || [];
      const next = current.includes(defectId)
        ? current.filter((x) => x !== defectId)
        : [...current, defectId];
      return {
        ...prev,
        grading: {
          ...prev.grading,
          selectedDefects: { ...prev.grading.selectedDefects, [componentKey]: next },
        },
      };
    });
  };

  const updateRemarks = (nextRemarks: string) => {
    setData((prev) => ({
      ...prev,
      grading: { ...prev.grading, remarks: nextRemarks },
    }));
  };

  // Cleanup effect was used during debugging; all changes are now committed
  // immediately via functional setData updates above.

  const completedCount = Object.values(grades).filter(Boolean).length;
  const totalCount = Object.keys(grades).length;

  const gradingItems = [
    { key: "lcd", label: "LCD Screen", defects: lcdDefects },
    { key: "topCover", label: "Top Cover (A Side)", defects: bodyDefects },
    { key: "bezel", label: "Bezel / Screen Frame", defects: bodyDefects },
    { key: "palmrest", label: "Palmrest (C Side)", defects: bodyDefects },
    { key: "bottomCover", label: "Bottom Cover (D Side)", defects: bodyDefects },
    { key: "keyboard", label: "Keyboard", defects: keyboardDefects },
    { key: "touchpad", label: "Touchpad" },
  ];

  return (
    <div className="-m-6 p-6 min-h-[calc(100vh-6rem)] bg-[#0a1626] space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-100">Manual Grading</h1>
          <p className="text-sm text-slate-500 mt-0.5">Cosmetic inspection — assess each component visually</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-500">
            {completedCount} / {totalCount} graded
          </div>
          <div className="h-2 w-32 bg-[#1c3f66] rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${(completedCount / totalCount) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {gradingItems.map((item) => (
          <GradingItem
            key={item.key}
            label={item.label}
            result={grades[item.key] ?? null}
            onPass={() => setGrade(item.key, "pass")}
            onFail={() => setGrade(item.key, "fail")}
            defects={item.defects}
            selectedDefects={selectedDefects[item.key]}
            onDefectToggle={item.defects ? (id) => toggleDefect(item.key, id) : undefined}
          />
        ))}
      </div>

      {/* Remarks */}
      <div className="bg-[#0f1e35] rounded-lg border border-[#1c3f66] p-4">
        <label className="text-sm text-slate-200 block mb-2">Technician Remarks</label>
        <textarea
          value={remarks}
          onChange={(e) => updateRemarks(e.target.value)}
          placeholder="Enter any additional observations, cosmetic notes, or defects found during inspection..."
          rows={4}
          className="w-full text-sm text-slate-200 bg-[#0d1b30] border border-[#1c3f66] rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-500"
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          onClick={onNext}
          disabled={completedCount < totalCount}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-[#1c3f66] disabled:text-slate-500 disabled:cursor-not-allowed text-white text-sm px-5 py-2.5 rounded-lg transition-colors"
        >
          Continue to Speaker Test
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
