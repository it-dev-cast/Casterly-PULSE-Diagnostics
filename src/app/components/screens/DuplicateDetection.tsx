import { AlertTriangle, CheckCircle2, Trash2, Calendar, User, Package } from "lucide-react";

interface DuplicateInspection {
  id: string;
  date: string;
  inspector: string;
  lot: string;
  selected: boolean;
}

interface DuplicateGroup {
  serialNumber: string;
  model: string;
  occurrences: number;
  inspections: DuplicateInspection[];
}

const duplicateGroups: DuplicateGroup[] = [
  {
    serialNumber: "5CD125PQRS",
    model: "HP ProBook 440 G8",
    occurrences: 2,
    inspections: [
      {
        id: "1",
        date: "2026-06-08 10:15",
        inspector: "Ravikiran K.",
        lot: "CLY-003",
        selected: false,
      },
      {
        id: "2",
        date: "2026-06-07 16:30",
        inspector: "Mohamed A.",
        lot: "CLY-002",
        selected: false,
      },
    ],
  },
  {
    serialNumber: "5CD129FGHI",
    model: "HP EliteBook 850 G8",
    occurrences: 3,
    inspections: [
      {
        id: "3",
        date: "2026-06-08 09:15",
        inspector: "Priya S.",
        lot: "CLY-003",
        selected: false,
      },
      {
        id: "4",
        date: "2026-06-06 14:22",
        inspector: "Sarah L.",
        lot: "CLY-002",
        selected: false,
      },
      {
        id: "5",
        date: "2026-06-05 11:45",
        inspector: "Ravikiran K.",
        lot: "CLY-001",
        selected: false,
      },
    ],
  },
];

export function DuplicateDetection() {
  return (
    <div className="-m-6 p-6 min-h-[calc(100vh-6rem)] bg-[#0a1626] space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle size={24} className="text-yellow-600" />
          <h1 className="text-slate-100">Duplicate Detection</h1>
        </div>
        <p className="text-sm text-slate-500">
          Resolve duplicate inspections for the same serial number
        </p>
      </div>

      {/* Warning banner */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm text-yellow-900 font-medium">
              Duplicate Inspections Detected
            </div>
            <div className="text-xs text-yellow-700 mt-0.5">
              The following devices have multiple inspection records. Please review and keep
              only the correct inspection for each device. Duplicates may occur when a device
              is re-inspected or mistakenly processed multiple times.
            </div>
          </div>
        </div>
      </div>

      {/* Duplicate Groups */}
      {duplicateGroups.map((group, groupIndex) => (
        <div
          key={groupIndex}
          className="bg-[#0f1e35] rounded-lg border border-yellow-200"
        >
          <div className="p-4 border-b border-yellow-100 bg-yellow-50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-slate-100 font-medium">
                  {group.serialNumber}
                </h3>
                <p className="text-sm text-slate-300 mt-0.5">{group.model}</p>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-yellow-600" />
                <span className="text-sm text-yellow-800 font-medium">
                  {group.occurrences} Occurrences
                </span>
              </div>
            </div>
          </div>

          <div className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#16294a]">
                    <th className="text-left text-xs text-slate-500 pb-3 pr-4">
                      Select
                    </th>
                    <th className="text-left text-xs text-slate-500 pb-3 pr-4">
                      Inspection ID
                    </th>
                    <th className="text-left text-xs text-slate-500 pb-3 pr-4">
                      Date
                    </th>
                    <th className="text-left text-xs text-slate-500 pb-3 pr-4">
                      Inspector
                    </th>
                    <th className="text-left text-xs text-slate-500 pb-3 pr-4">
                      LOT
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {group.inspections.map((inspection, index) => (
                    <tr
                      key={inspection.id}
                      className="border-b border-[#16294a] hover:bg-[#132445] transition-colors"
                    >
                      <td className="py-3 pr-4">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-[#1c3f66] text-blue-400 focus:ring-2 focus:ring-blue-500"
                          defaultChecked={inspection.selected}
                        />
                      </td>
                      <td className="py-3 pr-4">
                        <span className="font-mono text-slate-200 text-xs">
                          INS-{inspection.id.padStart(6, "0")}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Calendar size={12} className="text-slate-500" />
                          {inspection.date}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <User size={12} className="text-slate-500" />
                          {inspection.inspector}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Package size={12} className="text-slate-500" />
                          {inspection.lot}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2 mt-4 pt-4 border-t border-[#16294a]">
              <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-2 rounded-lg transition-colors">
                <CheckCircle2 size={16} />
                Keep Selected
              </button>
              <button className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-sm px-3 py-2 rounded-lg transition-colors">
                <Trash2 size={16} />
                Delete Selected
              </button>
              <button className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-3 py-2 rounded-lg transition-colors">
                <CheckCircle2 size={16} />
                Keep Latest
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Action buttons */}
      <div className="flex gap-2 justify-end">
        <button className="px-4 py-2 text-sm text-slate-300 hover:bg-[#1c3457] rounded-lg transition-colors">
          Cancel
        </button>
        <button className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">
          Apply Changes
        </button>
      </div>
    </div>
  );
}
