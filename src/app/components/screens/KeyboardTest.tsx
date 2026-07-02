import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, RefreshCw, ChevronRight } from "lucide-react";
import { useInspection } from "../../context/InspectionContext";

const KEY_LAYOUT: (string | null)[][] = [
  ["Esc", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12", "PrtSc", "Ins", "Del"],
  ["`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "=", "Backspace", "Home", "PgUp"],
  ["Tab", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]", "\\", "End", "PgDn"],
  ["CapsLk", "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'", "Enter"],
  ["Shift", "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/", "Shift↑"],
  ["Ctrl", "Fn", "Alt", "Space", "Alt", "Ctrl", "←", "↑", "↓", "→"],
];

const WIDE_KEYS = new Set(["Backspace", "Tab", "CapsLk", "Enter", "Shift", "Shift↑", "Ctrl", "Fn", "Alt", "Space", "Home", "End", "PgUp", "PgDn"]);

interface KeyboardTestProps {
  onNext: () => void;
}

export function KeyboardTest({ onNext }: KeyboardTestProps) {
  const { data, setData } = useInspection();
  const persisted = data.keyboardTest;
  const [pressed, setPressed] = useState<Set<string>>(new Set(persisted.pressed));
  const [failed, setFailed] = useState<Set<string>>(new Set(persisted.failed));
  const [result, setResult] = useState<"pass" | "fail" | null>(persisted.result);

  // Persist pressed/failed/result into context whenever they change.
  useEffect(() => {
    const pressedArr = Array.from(pressed);
    const failedArr = Array.from(failed);
    if (
      JSON.stringify(persisted.pressed) !== JSON.stringify(pressedArr) ||
      JSON.stringify(persisted.failed) !== JSON.stringify(failedArr) ||
      persisted.result !== result
    ) {
      setData((prev) => ({
        ...prev,
        keyboardTest: { pressed: pressedArr, failed: failedArr, result },
      }));
    }
  }, [pressed, failed, result, setData, persisted.pressed, persisted.failed, persisted.result]);

  // Any explicitly-failed key means the overall keyboard test fails.
  useEffect(() => {
    if (failed.size > 0 && result !== "fail") {
      setResult("fail");
    }
  }, [failed, result]);

  const allKeys = KEY_LAYOUT.flat().filter(Boolean) as string[];
  // The physical layout has duplicate labels for left/right modifiers; treat
  // each label only once for progress and missing-key reporting.
  const uniqueKeys = Array.from(new Set(allKeys));
  const testedCount = uniqueKeys.filter((k) => pressed.has(k) || failed.has(k)).length;
  const totalKeys = uniqueKeys.length;
  const pct = Math.round((testedCount / totalKeys) * 100);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      const mapped: Record<string, string> = {
        Backspace: "Backspace", Tab: "Tab", CapsLock: "CapsLk", Enter: "Enter",
        Escape: "Esc", Delete: "Del", Insert: "Ins",
        PrintScreen: "PrtSc", " ": "Space",
        ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓",
        Control: "Ctrl", Alt: "Alt", Meta: "Fn", Home: "Home", End: "End",
        PageUp: "PgUp", PageDown: "PgDn",
      };

      let label = mapped[e.key] ?? key;
      if (e.key === "Shift") {
        label = e.location === KeyboardEvent.DOM_KEY_LOCATION_RIGHT ? "Shift↑" : "Shift";
      }

      setPressed((p) => new Set([...p, label]));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const toggleFailed = (key: string) => {
    setFailed((f) => {
      const n = new Set(f);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  };

  const reset = () => {
    setPressed(new Set());
    setFailed(new Set());
    setResult(null);
  };

  const missingKeys = uniqueKeys.filter((k) => !pressed.has(k) && !failed.has(k));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-800">Keyboard Test</h1>
          <p className="text-sm text-slate-500 mt-0.5">Press each key to verify functionality</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-600">
            <span className="text-blue-600">{testedCount}</span>/{totalKeys} keys tested
          </div>
          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-sm text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            <RefreshCw size={13} />
            Reset
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm text-slate-600 mb-1">Test Progress</div>
            <div className="text-2xl text-blue-600">
              {testedCount} / {totalKeys} <span className="text-sm text-slate-500">keys tested</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl text-blue-600">{pct}%</div>
            <div className="text-xs text-slate-500">Complete</div>
          </div>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-50 rounded p-2 text-center">
            <div className="text-slate-500">Not Pressed</div>
            <div className="text-base text-slate-600 mt-0.5">{missingKeys.length}</div>
          </div>
          <div className="bg-emerald-50 rounded p-2 text-center">
            <div className="text-emerald-600">Pressed</div>
            <div className="text-base text-emerald-700 mt-0.5">{pressed.size}</div>
          </div>
          <div className="bg-red-50 rounded p-2 text-center">
            <div className="text-red-600">Failed</div>
            <div className="text-base text-red-700 mt-0.5">{failed.size}</div>
          </div>
        </div>
      </div>

      {/* Keyboard layout */}
      <div className="bg-slate-900 rounded-xl p-5 shadow-inner w-[1120px] mx-auto">
        <div className="space-y-1.5">
          {KEY_LAYOUT.map((row, rowIdx) => (
            <div key={rowIdx} className="flex gap-1">
              {row.map((key) => {
                if (!key) return null;
                const isPressed = pressed.has(key);
                const isFailed = failed.has(key);
                const isWide = WIDE_KEYS.has(key);
                const isSpace = key === "Space";

                let widthClass = "w-12";
                if (isSpace) widthClass = "w-[352px]";
                else if (key === "Backspace") widthClass = "w-[88px]";
                else if (key === "Tab") widthClass = "w-[72px]";
                else if (key === "CapsLk") widthClass = "w-[80px]";
                else if (key === "Enter") widthClass = "w-[96px]";
                else if (key === "Shift") widthClass = "w-[96px]";
                else if (key === "Shift↑") widthClass = "w-[112px]";
                else if (key === "Ctrl" || key === "Alt" || key === "Fn") widthClass = "w-14";
                else if (key === "Home" || key === "End" || key === "PgUp" || key === "PgDn") widthClass = "w-14";

                return (
                  <button
                    key={key}
                    onClick={() => toggleFailed(key)}
                    className={`
                      h-10 rounded text-[10px] border transition-all select-none flex items-center justify-center
                      ${widthClass}
                      ${isFailed
                        ? "bg-red-600 border-red-500 text-white shadow-red-900/50 shadow-inner"
                        : isPressed
                        ? "bg-emerald-600 border-emerald-500 text-white shadow-emerald-900/50 shadow-inner"
                        : "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
                      }
                    `}
                  >
                    {key}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex gap-4 mt-4 justify-center text-[10px]">
          {[
            { color: "bg-slate-700 border-slate-600", label: "Not Tested" },
            { color: "bg-emerald-600 border-emerald-500", label: "Passed (Pressed)" },
            { color: "bg-red-600 border-red-500", label: "Failed (Click to Mark)" },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className={`w-4 h-3 rounded border ${l.color}`} />
              <span className="text-slate-400">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Missing/Failed keys */}
      {(missingKeys.length > 0 || failed.size > 0) && testedCount > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          {missingKeys.length > 0 && (
            <div className="mb-3">
              <h3 className="text-sm text-slate-700 mb-2">Missing ({missingKeys.length})</h3>
              <div className="flex flex-wrap gap-1.5">
                {missingKeys.map((k) => (
                  <span key={k} className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs border border-slate-200 font-mono">
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}
          {failed.size > 0 && (
            <div>
              <h3 className="text-sm text-red-700 mb-2">Failed Keys ({failed.size})</h3>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(failed).map((k) => (
                  <span key={k} className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs border border-red-200 font-mono">
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Override */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h3 className="text-slate-700 mb-3">Test Result</h3>
        {!result ? (
          <div className="flex gap-3">
            <button
              onClick={() => setResult("pass")}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm transition-colors"
            >
              <CheckCircle2 size={15} />
              Mark as Pass
            </button>
            <button
              onClick={() => setResult("fail")}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-500 hover:bg-red-400 text-white rounded-lg text-sm transition-colors"
            >
              <XCircle size={15} />
              Mark as Fail
            </button>
          </div>
        ) : (
          <div className={`flex items-center gap-2 p-3 rounded-lg ${
            result === "pass" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}>
            {result === "pass" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            <span className="text-sm">Keyboard {result === "pass" ? "Passed" : "Failed"}</span>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={!result}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-sm px-5 py-2.5 rounded-lg transition-colors"
        >
          Continue to Touchpad Test
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
