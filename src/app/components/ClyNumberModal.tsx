import { useState } from "react";

interface ClyNumberModalProps {
  open: boolean;
  onConfirm: (clyNo: string) => void;
  onCancel: () => void;
}

const PREFIX = "CLY-";

/**
 * Mandatory CLY Number gate shown every time a new inspection is started
 * (both "Start New Inspection" from the Active LOT summary and "New
 * Inspection" from the completion screen). The "CLY-" prefix is fixed and
 * non-editable; the user may only type digits 0-9 after it. The confirm
 * action stays disabled until at least one digit has been entered, so an
 * inspection cannot begin without a CLY Number -- unless the user taps
 * "N/A" (see handleNotApplicable below), which stores "N/A" instead and
 * starts the inspection immediately.
 */
export function ClyNumberModal({ open, onConfirm, onCancel }: ClyNumberModalProps) {
  const [digits, setDigits] = useState("");

  if (!open) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDigits(e.target.value.replace(/[^0-9]/g, ""));
  };

  const handleConfirm = () => {
    if (!digits) return;
    const value = `${PREFIX}${digits}`;
    setDigits("");
    onConfirm(value);
  };

  const handleCancel = () => {
    setDigits("");
    onCancel();
  };

  // Lets the user skip entering a CLY Number when one genuinely isn't
  // available. Stores "N/A" as the cly_no value and starts the inspection
  // immediately, bypassing the digit-entry requirement.
  const handleNotApplicable = () => {
    setDigits("");
    onConfirm("N/A");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#0f1e35] rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="p-4 border-b border-[#1c3f66]">
          <h3 className="text-slate-100">Enter CLY Number</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Required before an inspection can be started
          </p>
        </div>
        <div className="p-4">
          <label className="block text-sm text-slate-200 mb-1">
            CLY Number <span className="text-red-400">*</span>
          </label>
          <div className="flex items-stretch w-full rounded-lg border border-[#1c3f66] bg-[#0d1b30] focus-within:ring-2 focus-within:ring-blue-500 overflow-hidden">
            <span className="px-3 py-2 text-sm text-slate-400 select-none bg-[#132743]">
              {PREFIX}
            </span>
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              value={digits}
              onChange={handleChange}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirm();
              }}
              className="flex-1 min-w-0 px-3 py-2 bg-transparent text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none"
              placeholder="1234"
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">Digits only (0-9)</p>
        </div>
        <div className="p-4 border-t border-[#1c3f66] flex gap-2 justify-end">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm text-slate-300 hover:bg-[#1c3457] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleNotApplicable}
            className="px-4 py-2 text-sm text-slate-300 bg-[#16294a] hover:bg-[#22436e] rounded-lg transition-colors"
          >
            N/A
          </button>
          <button
            onClick={handleConfirm}
            disabled={!digits}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
