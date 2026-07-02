import { useState, useRef, useEffect } from "react";
import { Camera, CheckCircle2, XCircle, ChevronRight, Loader2 } from "lucide-react";
import { useInspection } from "../../context/InspectionContext";
import { invoke } from "@tauri-apps/api/core";

type TestResult = "pass" | "fail" | null;

interface WebcamTestProps {
  onNext: () => void;
}

export function WebcamTest({ onNext }: WebcamTestProps) {
  const { data, setData } = useInspection();
  const [result, setResult] = useState<TestResult>(data.webcamTest.result);
  const [isTesting, setIsTesting] = useState(false);
  const [hasFinished, setHasFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Persist the pass/fail result into context.
  useEffect(() => {
    if (data.webcamTest.result !== result) {
      setData((prev) => ({
        ...prev,
        webcamTest: { ...prev.webcamTest, result },
      }));
    }
  }, [result, setData, data.webcamTest.result]);

  const resetTest = () => {
    setIsTesting(false);
    setHasFinished(false);
    setError(null);
  };

  const startTest = async () => {
    setError(null);
    resetTest();
    setIsTesting(true);

    try {
      await invoke("start_webcam_test");
      if (isMounted.current) {
        setIsTesting(false);
        setHasFinished(true);
      }
    } catch (err: any) {
      console.error("Webcam test failed", err);
      if (isMounted.current) {
        resetTest();
        const message =
          typeof err === "string"
            ? err
            : err?.message || "Unable to launch webcam preview.";
        setError(message);
      }
    }
  };

  const handleResult = (res: TestResult) => {
    setResult(res);
    setHasFinished(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-800">Webcam Test</h1>
          <p className="text-sm text-slate-500 mt-0.5">Verify camera functionality and image quality</p>
        </div>
        {result && (
          <div className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg ${
            result === "pass" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
          }`}>
            {result === "pass" ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
            {result === "pass" ? "Webcam Passed" : "Webcam Failed"}
          </div>
        )}
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
                  <Camera size={20} className={
                    result === "pass" ? "text-emerald-500" : result === "fail" ? "text-red-500" : "text-blue-500"
                  } />
                  <span className="text-lg text-slate-700">Webcam Preview Test</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Open the preview window and verify the camera image is clear
                </p>
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

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            {!isTesting && !hasFinished && !result && !error && (
              <div className="mb-5 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  Click <strong>Start Test</strong> to open the webcam preview window.
                  Close the preview window when you are done inspecting the camera feed.
                </p>
              </div>
            )}

            {isTesting && (
              <div className="mb-5 p-4 bg-slate-50 rounded-lg flex items-center gap-3">
                <Loader2 size={20} className="animate-spin text-blue-500" />
                <p className="text-sm text-slate-700">
                  Webcam preview is open. Close the preview window to continue.
                </p>
              </div>
            )}

            {!isTesting && hasFinished && !result && (
              <div className="mb-5 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-sm text-emerald-700">
                  Preview closed. Select <strong>Pass</strong> if the camera image was clear, otherwise <strong>Fail</strong>.
                </p>
              </div>
            )}

            <div className="mb-4">
              <button
                onClick={startTest}
                disabled={isTesting}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm transition-colors ${
                  isTesting
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-500 text-white"
                }`}
              >
                {isTesting ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                {isTesting ? "Testing..." : result ? "Restart Test" : "Start Test"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleResult("pass")}
                disabled={!hasFinished}
                className="flex items-center justify-center gap-2 py-3 rounded-lg text-sm bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white transition-colors"
              >
                <CheckCircle2 size={16} />
                Pass
              </button>
              <button
                onClick={() => handleResult("fail")}
                disabled={!hasFinished}
                className="flex items-center justify-center gap-2 py-3 rounded-lg text-sm bg-red-500 hover:bg-red-400 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white transition-colors"
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
          Continue to Keyboard Test
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
