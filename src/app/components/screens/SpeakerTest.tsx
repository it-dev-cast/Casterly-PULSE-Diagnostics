import { useState, useRef } from "react";
import { Play, RotateCcw, CheckCircle2, XCircle, Volume2, ChevronRight } from "lucide-react";

type TestResult = "pass" | "fail" | null;

interface SpeakerTestProps {
  onNext: () => void;
}

export function SpeakerTest({ onNext }: SpeakerTestProps) {
  const [result, setResult] = useState<TestResult>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPlay = () => {
    setIsPlaying(true);
    setProgress(0);
    timerRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(timerRef.current!);
          setIsPlaying(false);
          return 100;
        }
        return p + 1;
      });
    }, 100);
  };

  const replay = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsPlaying(false);
    setProgress(0);
    setTimeout(startPlay, 100);
  };

  const handleResult = (res: TestResult) => {
    setResult(res);
    if (timerRef.current) clearInterval(timerRef.current);
    setIsPlaying(false);
    setProgress(0);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-800">Speaker Test</h1>
          <p className="text-sm text-slate-500 mt-0.5">Test speaker audio output</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
          <Volume2 size={13} className="text-amber-500" />
          Set system volume to 100% before testing
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        <div className={`bg-white rounded-xl border-2 transition-all ${
          result === "pass" ? "border-emerald-300" :
          result === "fail" ? "border-red-300" : "border-blue-400 shadow-md"
        }`}>
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Volume2 size={20} className={
                    result === "pass" ? "text-emerald-500" : result === "fail" ? "text-red-500" : "text-blue-500"
                  } />
                  <span className="text-lg text-slate-700">Speaker Audio Test</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">Play the test audio and verify both speakers work</p>
              </div>
              {result && (
                <div className={`flex items-center gap-1 text-sm px-3 py-1.5 rounded ${
                  result === "pass" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                }`}>
                  {result === "pass" ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  {result === "pass" ? "Passed" : "Failed"}
                </div>
              )}
            </div>

            {/* Waveform animation */}
            <div className="flex items-center justify-center gap-1 h-20 bg-slate-50 rounded-lg mb-5">
              {Array.from({ length: 40 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 rounded-full transition-all ${isPlaying ? "bg-blue-400" : "bg-slate-200"}`}
                  style={{
                    height: isPlaying ? `${24 + Math.abs(Math.sin(i * 0.5 + Date.now() / 200)) * 48}px` : "6px",
                  }}
                />
              ))}
            </div>

            {/* Progress bar */}
            {isPlaying && (
              <div className="mb-5">
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>{Math.round(progress / 10)}s</span>
                  <span>10s</span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 mb-5 p-3 bg-blue-50 rounded-lg">
              <Volume2 size={14} className="text-blue-500" />
              <span className="text-sm text-blue-700">Listen for audio from both left and right speakers</span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={startPlay}
                disabled={isPlaying}
                className={`flex items-center justify-center gap-2 py-3 rounded-lg text-sm transition-colors ${
                  isPlaying ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-500 text-white"
                }`}
              >
                <Play size={16} />
                {isPlaying ? "Playing..." : "Play Test"}
              </button>
              <button
                onClick={replay}
                className="flex items-center justify-center gap-2 py-3 rounded-lg text-sm bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
              >
                <RotateCcw size={16} />
                Replay
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleResult("pass")}
                className="flex items-center justify-center gap-2 py-3 rounded-lg text-sm bg-emerald-500 hover:bg-emerald-400 text-white transition-colors"
              >
                <CheckCircle2 size={16} />
                Pass
              </button>
              <button
                onClick={() => handleResult("fail")}
                className="flex items-center justify-center gap-2 py-3 rounded-lg text-sm bg-red-500 hover:bg-red-400 text-white transition-colors"
              >
                <XCircle size={16} />
                Fail
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={!result}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-sm px-5 py-2.5 rounded-lg transition-colors"
        >
          Continue to Webcam Test
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
