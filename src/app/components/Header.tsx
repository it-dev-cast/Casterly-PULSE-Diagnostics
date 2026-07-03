import { useState, useEffect } from "react";
import {
  Timer,
  User,
  FileText,
  Tag,
  Laptop,
} from "lucide-react";
import { useInspection } from "../context/InspectionContext";
import pulseLogo from "../../assets/pulse_logo.png";

interface HeaderProps {
  onNavigate: (screen: string) => void;
  currentScreen: string;
  onSaveDraft: () => void;
  onSaveInspection: () => void;
  isInspectionActive?: boolean;
  lotName?: string;
  inspectorName?: string;
}

export function Header({ onNavigate, currentScreen, onSaveDraft, onSaveInspection, isInspectionActive = false, lotName = "", inspectorName = "" }: HeaderProps) {
  const [elapsed, setElapsed] = useState(0);

  // Read the live scan results straight from the inspection context so the
  // header updates as soon as the System Scan populates them. Mirror the scan
  // card's behaviour: show "Scanning..." until a real value arrives (e.g. in
  // WSL the values stay "Scanning..."; on real Ubuntu hardware they populate).
  const { data } = useInspection();
  const serialNumber: string = data.systemInfo?.serial_number || "Scanning...";
  const deviceModel: string = data.systemInfo?.model || "Scanning...";

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
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-[#0B2545] border-b border-[#123a63] flex items-center shadow-sm">
      {/* Left — Logo */}
      <div className="flex items-center justify-center w-64 shrink-0 border-r border-[#123a63] h-full bg-white px-4 py-2">
        <img
          src={pulseLogo}
          alt="Casterly PULSE 4.0"
          className="max-h-full max-w-full w-auto object-contain"
        />
      </div>

      {/* Center — Session Info */}
      <div className="flex-1 flex items-center justify-center gap-6 px-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Tag size={14} strokeWidth={2.5} className="text-slate-300" />
          <span className="text-slate-300">LOT</span>
          <span className="text-white">
            {lotName || "—"}
          </span>
          <span className="text-slate-500 font-normal">|</span>
          <User size={14} strokeWidth={2.5} className="text-slate-300" />
          <span className="text-slate-300">Inspector</span>
          <span className="text-white">
            {inspectorName || "—"}
          </span>
        </div>
        {isInspectionActive && (
          <>
            <div className="h-5 w-px bg-[#1c3f66]" />
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <FileText size={14} strokeWidth={2.5} className="text-slate-300" />
              <span className="text-slate-300">Serial</span>
              <span className="text-white font-mono">
                {serialNumber}
              </span>
            </div>
            <div className="h-5 w-px bg-[#1c3f66]" />
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Laptop size={14} strokeWidth={2.5} className="text-slate-300" />
              <span className="text-slate-300">Device</span>
              <span className="text-white">
                {deviceModel}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Right — Timer + Actions */}
      <div className="flex items-center gap-2 px-4 shrink-0">
        <div className="flex items-center gap-1.5 bg-[#123a63] border border-[#1c3f66] rounded px-3 py-1.5">
          <Timer size={14} strokeWidth={2.5} className="text-blue-300" />
          <span className="text-white font-semibold font-mono text-sm tracking-widest">{formatTime(elapsed)}</span>
        </div>
      </div>
    </header>
  );
}
