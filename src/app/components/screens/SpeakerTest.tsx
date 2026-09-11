import { useState, useRef, useEffect } from "react";
import { Play, CheckCircle2, XCircle, Volume2, ChevronRight, Loader2 } from "lucide-react";
import { useInspection } from "../../context/InspectionContext";
import { invoke } from "@tauri-apps/api/core";

type TestResult = "pass" | "fail" | null;

interface SpeakerTestProps {
  onNext: () => void;
}

export function SpeakerTest({ onNext }: SpeakerTestProps) {
  const { data, setData } = useInspection();
  const [result, setResult] = useState<TestResult>(data.speakerTest.result);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Track whether audio has finished playing. Pass/Fail are enabled only after this.
  const [hasFinished, setHasFinished] = useState(false);
  const [durationSec, setDurationSec] = useState(10);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Persist the pass/fail result into context.
  useEffect(() => {
    if (data.speakerTest.result !== result) {
      setData((prev) => ({
        ...prev,
        speakerTest: { ...prev.speakerTest, result },
      }));
    }
  }, [result, setData, data.speakerTest.result]);

  const resetPlayback = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsPlaying(false);
    setProgress(0);
    setHasFinished(false);
  };

  const startPlay = async () => {
    setError(null);
    resetPlayback();
    setIsPlaying(true);

    try {
      // This returns immediately; audio playback runs in the background.
      const durationMs = await invoke<number>("play_speaker_test");
      const durationSeconds = Math.max(1, Math.round(durationMs / 1000));
      setDurationSec(durationSeconds);

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const pct = Math.min(100, Math.round((elapsed / durationMs) * 100));
        if (!isMounted.current) {
          if (timerRef.current) clearInterval(timerRef.current);
          return;
        }
        setProgress(pct);
        if (pct >= 100) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          setIsPlaying(false);
          setHasFinished(true);
        }
      }, 50);
    } catch (err: any) {
      console.error("Speaker playback failed", err);
      resetPlayback();
      setError(typeof err === "string" ? err : err?.message || "Playback failed");
    }
  };

  const handleResult = (res: TestResult) => {
    setResult(res);
    resetPlayback();
  };

  return (
    <div className="-m-6 p-6 min-h-[calc(100vh-6rem)] bg-[#0a1626] space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-100">Speaker Test</h1>
          <p className="text-sm text-slate-500 mt-0.5">Test speaker audio output</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-lg">
          <Volume2 size={13} className="text-amber-500" />
          Set system volume to 100% before testing
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        <div className={`bg-[#0f1e35] rounded-xl border-2 transition-all ${
          result === "pass" ? "border-emerald-300" :
          result === "fail" ? "border-red-300" : "border-blue-400 shadow-md"
        }`}>
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Volume2 size={20} className={
                    result === "pass" ? "text-emerald-400" : result === "fail" ? "text-red-400" : "text-blue-500"
                  } />
                  <span className="text-lg text-slate-200">Speaker Audio Test</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Play the test audio and verify both speakers work</p>
              </div>
              {result && (
                <div className={`flex items-center gap-1 text-sm px-3 py-1.5 rounded ${
                  result === "pass" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"
                }`}>
                  {result === "pass" ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  {result === "pass" ? "Passed" : "Failed"}
                </div>
              )}
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-300">
                {error}
              </div>
            )}

            {/* Waveform animation */}
            <div className="flex items-center justify-center gap-1 h-20 bg-[#0d1b30] rounded-lg mb-5">
              {Array.from({ length: 40 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 rounded-full transition-all ${isPlaying ? "bg-blue-400" : "bg-[#1c3f66]"}`}
                  style={{
                    height: isPlaying ? `${24 + Math.abs(Math.sin(i * 0.5 + Date.now() / 200)) * 48}px` : "6px",
                  }}
                />
              ))}
            </div>

            {/* Progress bar */}
            {(isPlaying || progress > 0) && (
              <div className="mb-5">
                <div className="h-2 bg-[#1c3f66] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>{Math.round((progress / 100) * durationSec)}s</span>
                  <span>{durationSec}s</span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 mb-5 p-3 bg-blue-500/10 rounded-lg">
              <Volume2 size={14} className="text-blue-500" />
              <span className="text-sm text-blue-300">Listen for audio from both left and right speakers</span>
            </div>

            <div className="mb-4">
              <button
                onClick={startPlay}
                disabled={isPlaying}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm transition-colors ${
                  isPlaying
                    ? "bg-[#16294a] text-slate-500 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-500 text-white"
                }`}
              >
                {isPlaying ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                {isPlaying ? "Playing..." : "Play Test"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleResult("pass")}
                disabled={!hasFinished}
                className="flex items-center justify-center gap-2 py-3 rounded-lg text-sm bg-emerald-500 hover:bg-emerald-400 disabled:bg-[#16294a] disabled:text-slate-500 disabled:cursor-not-allowed text-white transition-colors"
              >
                <CheckCircle2 size={16} />
                Pass
              </button>
              <button
                onClick={() => handleResult("fail")}
                disabled={!hasFinished}
                className="flex items-center justify-center gap-2 py-3 rounded-lg text-sm bg-red-500 hover:bg-red-400 disabled:bg-[#16294a] disabled:text-slate-500 disabled:cursor-not-allowed text-white transition-colors"
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
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-[#1c3f66] disabled:text-slate-500 disabled:cursor-not-allowed text-white text-sm px-5 py-2.5 rounded-lg transition-colors"
        >
          Continue to Webcam Test
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
