import { useState, useRef, useEffect } from "react";
import { CheckCircle2, XCircle, RefreshCw, ChevronRight, MousePointer2 } from "lucide-react";
import { useInspection } from "../../context/InspectionContext";

interface TouchpadTestProps {
  onNext: () => void;
}

interface Point {
  x: number;
  y: number;
}

interface TouchpadTestData {
  leftClick: boolean;
  rightClick: boolean;
  movement: boolean;
  scroll: boolean;
  result: "pass" | "fail" | null;
}

export function TouchpadTest({ onNext }: TouchpadTestProps) {
  const { data, setData } = useInspection();
  const persisted: TouchpadTestData = data.touchpadTest;

  const [leftClick, setLeftClick] = useState(persisted.leftClick);
  const [rightClick, setRightClick] = useState(persisted.rightClick);
  const [movement, setMovement] = useState(persisted.movement);
  const [scroll, setScroll] = useState(persisted.scroll);
  const [cursorPos, setCursorPos] = useState<Point>({ x: 50, y: 50 });
  const [trail, setTrail] = useState<Point[]>([]);
  const [result, setResult] = useState<"pass" | "fail" | null>(persisted.result);
  const padRef = useRef<HTMLDivElement>(null);

  // Persist detections and result into context whenever they change.
  useEffect(() => {
    if (
      persisted.leftClick !== leftClick ||
      persisted.rightClick !== rightClick ||
      persisted.movement !== movement ||
      persisted.scroll !== scroll ||
      persisted.result !== result
    ) {
      setData((prev) => ({
        ...prev,
        touchpadTest: { leftClick, rightClick, movement, scroll, result },
      }));
    }
  }, [leftClick, rightClick, movement, scroll, result, setData, persisted]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = padRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setCursorPos({ x, y });
    setMovement(true);
    setTrail((t) => [...t.slice(-30), { x, y }]);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setRightClick(true);
  };

  const reset = () => {
    setLeftClick(false);
    setRightClick(false);
    setMovement(false);
    setScroll(false);
    setTrail([]);
    setResult(null);
    setCursorPos({ x: 50, y: 50 });
  };

  const allPassed = leftClick && rightClick && movement;

  return (
    <div className="-m-6 p-6 min-h-[calc(100vh-6rem)] bg-[#0a1626] space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-100">Touchpad Test</h1>
          <p className="text-sm text-slate-500 mt-0.5">Validate touchpad gestures and click detection</p>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1.5 text-sm text-slate-300 bg-[#0f1e35] border border-[#1c3f66] hover:bg-[#132445] px-3 py-1.5 rounded-lg transition-colors"
        >
          <RefreshCw size={13} />
          Reset
        </button>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Interactive pad */}
        <div className="col-span-2 space-y-4">
          <div className="bg-[#0f1e35] rounded-xl border border-[#1c3f66] p-4">
            <div className="flex items-center gap-2 mb-3">
              <MousePointer2 size={14} className="text-blue-400" />
              <span className="text-sm text-slate-200">Cursor Tracking Zone</span>
              <span className="text-xs text-slate-500 ml-auto">Move your mouse inside this area</span>
            </div>

            <div
              ref={padRef}
              className="relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl overflow-hidden select-none cursor-none"
              style={{ height: 280 }}
              onMouseMove={handleMouseMove}
              onWheel={() => setScroll(true)}
            >
              {/* Grid lines */}
              <div className="absolute inset-0 opacity-10">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={`h-${i}`} className="absolute w-full border-t border-white" style={{ top: `${(i + 1) * 14.28}%` }} />
                ))}
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={`v-${i}`} className="absolute h-full border-l border-white" style={{ left: `${(i + 1) * 11.11}%` }} />
                ))}
              </div>

              {/* Left and Right click zones */}
              <div className="absolute inset-0 flex">
                {/* Left click zone — only left mouse button (button === 0) counts */}
                <div
                  className="flex-1 relative cursor-pointer"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    if (e.button === 0) setLeftClick(true);
                  }}
                >
                  {!movement && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <MousePointer2 size={24} className="text-slate-500 mx-auto mb-2" />
                        <p className="text-slate-500 text-xs">LEFT CLICK</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Center divider */}
                <div className="w-px bg-white/10"></div>

                {/* Right click zone — only right mouse button (button === 2) counts */}
                <div
                  className="flex-1 relative cursor-pointer"
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    if (e.button === 2) setRightClick(true);
                  }}
                >
                  {!movement && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <MousePointer2 size={24} className="text-slate-500 mx-auto mb-2" />
                        <p className="text-slate-500 text-xs">RIGHT CLICK</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Trail */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {trail.map((point, i) => (
                  <circle
                    key={i}
                    cx={`${point.x}%`}
                    cy={`${point.y}%`}
                    r={2}
                    fill="#3b82f6"
                    opacity={i / trail.length * 0.6}
                  />
                ))}
              </svg>

              {/* Cursor */}
              {movement && (
                <div
                  className="absolute w-4 h-4 -translate-x-2 -translate-y-2 pointer-events-none"
                  style={{ left: `${cursorPos.x}%`, top: `${cursorPos.y}%` }}
                >
                  <div className="w-4 h-4 rounded-full border-2 border-blue-400 bg-blue-500/20" />
                </div>
              )}

              {/* Corner labels */}
              <div className="absolute bottom-2 left-2 text-[9px] text-slate-500 pointer-events-none">LEFT</div>
              <div className="absolute bottom-2 right-2 text-[9px] text-slate-500 pointer-events-none">RIGHT</div>
            </div>

            <div className="flex gap-2 mt-3">
              <div
                className={`flex-1 py-3 text-center text-sm rounded-lg transition-all border-2 ${
                  leftClick
                    ? "bg-emerald-500 border-emerald-400 text-white"
                    : "bg-[#16294a] border-[#1c3f66] text-slate-200"
                }`}
              >
                {leftClick ? (
                  <div className="flex items-center justify-center gap-1.5">
                    <CheckCircle2 size={14} />
                    Left Click
                  </div>
                ) : (
                  "Left Click"
                )}
              </div>
              <div
                className={`flex-1 py-3 text-center text-sm rounded-lg transition-all border-2 ${
                  rightClick
                    ? "bg-emerald-500 border-emerald-400 text-white"
                    : "bg-[#16294a] border-[#1c3f66] text-slate-200"
                }`}
              >
                {rightClick ? (
                  <div className="flex items-center justify-center gap-1.5">
                    <CheckCircle2 size={14} />
                    Right Click
                  </div>
                ) : (
                  "Right Click"
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Status panel */}
        <div className="space-y-4">
          <div className="bg-[#0f1e35] rounded-xl border border-[#1c3f66] p-4">
            <h3 className="text-slate-200 mb-3">Detection Status</h3>
            <div className="space-y-3">
              {[
                { label: "Left Click", detected: leftClick, key: "left" },
                { label: "Right Click", detected: rightClick, key: "right" },
                { label: "Movement", detected: movement, key: "move" },
                { label: "Scroll", detected: scroll, key: "scroll" },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">{item.label}</span>
                  <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${
                    item.detected
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-[#16294a] text-slate-500"
                  }`}>
                    {item.detected ? (
                      <><CheckCircle2 size={12} /> Detected</>
                    ) : (
                      <><div className="w-2 h-2 rounded-full border border-[#1c3f66]" /> Waiting</>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Overall result */}
          <div className="bg-[#0f1e35] rounded-xl border border-[#1c3f66] p-4">
            <h3 className="text-slate-200 mb-3">Result</h3>
            {!result ? (
              <div className="space-y-2">
                <button
                  onClick={() => setResult("pass")}
                  disabled={!allPassed}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-[#16294a] disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors"
                >
                  <CheckCircle2 size={15} />
                  Mark as Pass
                </button>
                <button
                  onClick={() => setResult("fail")}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-red-500 hover:bg-red-400 text-white rounded-lg text-sm transition-colors"
                >
                  <XCircle size={15} />
                  Mark as Fail
                </button>
              </div>
            ) : (
              <div className={`flex items-center gap-2 p-3 rounded-lg ${
                result === "pass" ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"
              }`}>
                {result === "pass" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                <span className="text-sm">Touchpad {result === "pass" ? "Passed" : "Failed"}</span>
              </div>
            )}
          </div>

          <div className="bg-[#0d1b30] rounded-xl border border-[#1c3f66] p-3 text-xs text-slate-500 space-y-1.5">
            <p className="font-medium text-slate-300">Instructions</p>
            <p>1. Move cursor freely in the tracking zone</p>
            <p>2. Perform a left click</p>
            <p>3. Perform a right click</p>
            <p>4. Test scroll wheel or two-finger scroll</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={!result}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-[#1c3f66] disabled:text-slate-500 disabled:cursor-not-allowed text-white text-sm px-5 py-2.5 rounded-lg transition-colors"
        >
          Continue to Battery Assessment
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
