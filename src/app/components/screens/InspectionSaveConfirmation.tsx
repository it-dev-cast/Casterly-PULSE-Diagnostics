import { CheckCircle2, Circle, Monitor, HardDrive, ClipboardCheck, Volume2, Camera, Keyboard, MousePointer2, Battery, AlertCircle, Save, FileText } from "lucide-react";

interface ChecklistItem {
  id: string;
  label: string;
  icon: React.ElementType;
  status: "completed" | "pending" | "skipped";
}

const checklistItems: ChecklistItem[] = [
  { id: "system-scan", label: "System Scan", icon: Monitor, status: "completed" },
  { id: "hardware-inventory", label: "Hardware Inventory", icon: HardDrive, status: "completed" },
  { id: "manual-grading", label: "Manual Grading", icon: ClipboardCheck, status: "completed" },
  { id: "speaker-test", label: "Speaker Test", icon: Volume2, status: "completed" },
  { id: "webcam-test", label: "Webcam Test", icon: Camera, status: "completed" },
  { id: "keyboard-test", label: "Keyboard Test", icon: Keyboard, status: "completed" },
  { id: "touchpad-test", label: "Touchpad Test", icon: MousePointer2, status: "completed" },
  { id: "battery-assessment", label: "Battery Assessment", icon: Battery, status: "completed" },
];

interface InspectionSaveConfirmationProps {
  onSave: () => void;
  onSaveDraft: () => void;
  onCancel: () => void;
}

export function InspectionSaveConfirmation({
  onSave,
  onSaveDraft,
  onCancel,
}: InspectionSaveConfirmationProps) {
  const completedCount = checklistItems.filter((item) => item.status === "completed").length;
  const totalCount = checklistItems.length;
  const isComplete = completedCount === totalCount;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-slate-800">Ready To Save Inspection</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Review checklist before saving the inspection record
        </p>
      </div>

      {/* Status banner */}
      {isComplete ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm text-emerald-900 font-medium">
                All Steps Completed
              </div>
              <div className="text-xs text-emerald-700 mt-0.5">
                All inspection steps have been completed successfully. The inspection is ready to be saved.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-orange-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm text-orange-900 font-medium">
                Incomplete Inspection
              </div>
              <div className="text-xs text-orange-700 mt-0.5">
                Some inspection steps are pending. You can save as draft or complete all steps before saving.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inspection Checklist */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <h3 className="text-slate-700">Inspection Checklist</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {completedCount} of {totalCount} steps completed
          </p>
          <div className="mt-3">
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  isComplete ? "bg-emerald-500" : "bg-blue-500"
                }`}
                style={{ width: `${(completedCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-2 gap-3">
            {checklistItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    item.status === "completed"
                      ? "bg-emerald-50 border-emerald-200"
                      : item.status === "skipped"
                      ? "bg-slate-50 border-slate-200"
                      : "bg-orange-50 border-orange-200"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      item.status === "completed"
                        ? "bg-emerald-100"
                        : item.status === "skipped"
                        ? "bg-slate-100"
                        : "bg-orange-100"
                    }`}
                  >
                    <Icon
                      size={16}
                      className={
                        item.status === "completed"
                          ? "text-emerald-600"
                          : item.status === "skipped"
                          ? "text-slate-400"
                          : "text-orange-600"
                      }
                    />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-slate-700">{item.label}</div>
                    {item.status === "completed" && (
                      <div className="flex items-center gap-1 text-xs text-emerald-600 mt-0.5">
                        <CheckCircle2 size={10} />
                        Complete
                      </div>
                    )}
                    {item.status === "pending" && (
                      <div className="flex items-center gap-1 text-xs text-orange-600 mt-0.5">
                        <Circle size={10} />
                        Pending
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Device Summary */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h3 className="text-slate-700 mb-3">Device Summary</h3>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-slate-500">Serial Number</div>
            <div className="text-sm text-slate-700 font-mono mt-0.5">5CD124NJWZ</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Model</div>
            <div className="text-sm text-slate-700 mt-0.5">HP ProBook 440 G8</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">LOT</div>
            <div className="text-sm text-slate-700 mt-0.5">CLY-003</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Inspector</div>
            <div className="text-sm text-slate-700 mt-0.5">Ravikiran K.</div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onSave}
          disabled={!isComplete}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={16} />
          Save Inspection
        </button>
        <button
          onClick={onSaveDraft}
          className="flex-1 flex items-center justify-center gap-2 bg-slate-600 hover:bg-slate-500 text-white text-sm px-4 py-3 rounded-lg transition-colors"
        >
          <FileText size={16} />
          Save Draft
        </button>
        <button
          onClick={onCancel}
          className="px-6 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Additional info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle size={16} className="text-blue-600 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-700">
            <strong>Note:</strong> Saved inspections will be added to the upload queue and synced
            to the cloud when internet connection is available. Draft inspections can be completed later.
          </div>
        </div>
      </div>
    </div>
  );
}
