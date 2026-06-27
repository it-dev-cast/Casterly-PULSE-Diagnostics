import { useState, useEffect } from "react";
import {
  Save,
  LogOut,
  ChevronDown,
  Timer,
  Cpu,
  User,
  FileText,
} from "lucide-react";

interface HeaderProps {
  onNavigate: (screen: string) => void;
  currentScreen: string;
  onSaveDraft: () => void;
  onSaveInspection: () => void;
  isInspectionActive?: boolean;
}

export function Header({ onNavigate, currentScreen, onSaveDraft, onSaveInspection, isInspectionActive = false }: HeaderProps) {
  const [elapsed, setElapsed] = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-slate-900 border-b border-slate-700 flex items-center">
      {/* Left — Logo */}
      <div className="flex items-center gap-3 px-4 w-64 shrink-0 border-r border-slate-700 h-full">
        <div className="flex items-center justify-center w-8 h-8 rounded bg-blue-600">
          <Cpu size={16} className="text-white" />
        </div>
        <div>
          <div className="text-white text-sm leading-none tracking-wide">UDIAG 4.0</div>
          <div className="text-slate-400 text-[10px] leading-none mt-0.5 tracking-wider">
            REFURBISHMENT INSPECTION
          </div>
        </div>
      </div>

      {/* Center — Session Info */}
      <div className="flex-1 flex items-center justify-center gap-6 px-4">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <span className="text-slate-500">LOT</span>
          <span className="text-white font-medium">CLY-003</span>
          <span className="text-slate-600">|</span>
          <User size={11} className="text-slate-400" />
          <span className="text-slate-500">Inspector</span>
          <span className="text-white font-medium">Ravikiran</span>
        </div>
        {isInspectionActive && (
          <>
            <div className="h-5 w-px bg-slate-700" />
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <FileText size={11} className="text-slate-400" />
              <span className="text-slate-500">Serial</span>
              <span className="text-white font-mono font-medium">5CD124NJWZ</span>
            </div>
            <div className="h-5 w-px bg-slate-700" />
            <div className="text-xs text-slate-300">
              <span className="text-slate-500">Device</span>{" "}
              <span className="text-white font-medium">HP ProBook 440 G8</span>
            </div>
          </>
        )}
      </div>

      {/* Right — Timer + Actions */}
      <div className="flex items-center gap-2 px-4 shrink-0">
        <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded px-3 py-1.5">
          <Timer size={13} className="text-blue-400" />
          <span className="text-white font-mono text-sm tracking-widest">{formatTime(elapsed)}</span>
        </div>

        <button
          onClick={onSaveDraft}
          className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs px-3 py-1.5 rounded border border-slate-600 transition-colors"
        >
          <Save size={13} />
          Save Draft
        </button>

        <button
          onClick={onSaveInspection}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded transition-colors"
        >
          <Save size={13} />
          Save Inspection
        </button>

        <div className="h-5 w-px bg-slate-700 mx-1" />

        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 hover:bg-slate-800 rounded px-2 py-1.5 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-medium">
              RK
            </div>
            <ChevronDown size={12} className="text-slate-400" />
          </button>
          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-slate-700 rounded shadow-xl z-50">
              <div className="px-3 py-2 border-b border-slate-700">
                <div className="text-white text-sm">Ravikiran K.</div>
                <div className="text-slate-400 text-xs">Senior Technician</div>
              </div>
              <button
                onClick={() => setUserMenuOpen(false)}
                className="w-full flex items-center gap-2 px-3 py-2 text-slate-300 hover:bg-slate-700 text-xs transition-colors"
              >
                <LogOut size={13} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
