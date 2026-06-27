import { useEffect } from "react";
import { CheckCircle2, ChevronRight, AlertTriangle } from "lucide-react";

interface HardwareInventoryProps {
  onNext: () => void;
}

const inventoryItems = [
  {
    category: "Processor",
    items: [
      { component: "CPU", detected: "Intel Core i5-1135G7 @ 2.40GHz", expected: "Intel i5 Gen 11", match: true },
    ],
  },
  {
    category: "Memory",
    items: [
      { component: "RAM Total", detected: "16 GB", expected: "16 GB", match: true },
      { component: "Slot 1", detected: "8 GB DDR4 Samsung", expected: "—", match: true },
      { component: "Slot 2", detected: "8 GB DDR4 Micron", expected: "—", match: true },
    ],
  },
  {
    category: "Storage",
    items: [
      { component: "Primary Drive", detected: "512 GB NVMe SK Hynix BC711", expected: "512 GB SSD", match: true },
      { component: "Health", detected: "94%", expected: "> 80%", match: true },
    ],
  },
  {
    category: "Display",
    items: [
      { component: "Panel", detected: "14\" 1920×1080 IPS", expected: "14\" FHD", match: true },
    ],
  },
  {
    category: "Battery",
    items: [
      { component: "Battery", detected: "45 Wh — 78% Health", expected: "> 80% Health", match: false },
      { component: "Cycle Count", detected: "312", expected: "< 500", match: true },
    ],
  },
  {
    category: "Network",
    items: [
      { component: "WiFi", detected: "Intel Wi-Fi 6 AX201", expected: "WiFi Present", match: true },
      { component: "Ethernet", detected: "Intel I219-LM GbE", expected: "LAN Present", match: true },
      { component: "Bluetooth", detected: "BT 5.2", expected: "BT Present", match: true },
    ],
  },
  {
    category: "Ports & I/O",
    items: [
      { component: "USB-A (×2)", detected: "Detected", expected: "Present", match: true },
      { component: "USB-C / TB4", detected: "Detected", expected: "Present", match: true },
      { component: "HDMI", detected: "Detected", expected: "Present", match: true },
      { component: "3.5mm Audio", detected: "Detected", expected: "Present", match: true },
      { component: "SD Card", detected: "Not Detected", expected: "Optional", match: true },
    ],
  },
];

export function HardwareInventory({ onNext }: HardwareInventoryProps) {
  const allItems = inventoryItems.flatMap((c) => c.items);
  const matchCount = allItems.filter((i) => i.match).length;
  const mismatchCount = allItems.filter((i) => !i.match).length;

  // Auto-advance after inventory verification
  useEffect(() => {
    const timer = setTimeout(() => {
      onNext();
    }, 3000); // 3 seconds to review inventory
    return () => clearTimeout(timer);
  }, [onNext]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-800">Hardware Inventory</h1>
          <p className="text-sm text-slate-500 mt-0.5">Verify detected hardware against expected specifications</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1.5 rounded">
            <CheckCircle2 size={12} />
            {matchCount} Match
          </div>
          {mismatchCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1.5 rounded">
              <AlertTriangle size={12} />
              {mismatchCount} Mismatch
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left text-xs text-slate-500 px-4 py-3">Category</th>
              <th className="text-left text-xs text-slate-500 px-4 py-3">Component</th>
              <th className="text-left text-xs text-slate-500 px-4 py-3">Detected</th>
              <th className="text-left text-xs text-slate-500 px-4 py-3">Expected</th>
              <th className="text-left text-xs text-slate-500 px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {inventoryItems.map((category) =>
              category.items.map((item, itemIdx) => (
                <tr
                  key={`${category.category}-${item.component}`}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  {itemIdx === 0 && (
                    <td
                      rowSpan={category.items.length}
                      className="px-4 py-3 text-xs text-slate-500 border-r border-slate-100 bg-slate-50 align-top"
                    >
                      {category.category}
                    </td>
                  )}
                  <td className="px-4 py-3 text-sm text-slate-600">{item.component}</td>
                  <td className="px-4 py-3 text-sm text-slate-800 font-medium">{item.detected}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{item.expected}</td>
                  <td className="px-4 py-3">
                    {item.match ? (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                        <CheckCircle2 size={13} />
                        Match
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-amber-600">
                        <AlertTriangle size={13} />
                        Warning
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {mismatchCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
          <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-700">Hardware mismatch detected - Auto-advancing...</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Battery health is below the 80% threshold. This has been flagged for review.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
