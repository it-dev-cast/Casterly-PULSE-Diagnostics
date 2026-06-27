import { useState, useRef, useEffect } from "react";
import { Camera, CheckCircle2, XCircle, ChevronRight, RefreshCw, AlertCircle } from "lucide-react";

interface WebcamTestProps {
  onNext: () => void;
}

export function WebcamTest({ onNext }: WebcamTestProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraStatus, setCameraStatus] = useState<"idle" | "requesting" | "active" | "denied">("idle");
  const [result, setResult] = useState<"pass" | "fail" | null>(null);
  const [resolution, setResolution] = useState<string>("—");

  const startCamera = async () => {
    setCameraStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();
        setResolution(`${settings.width ?? "?"} × ${settings.height ?? "?"}`);
      }
      setCameraStatus("active");
    } catch {
      setCameraStatus("denied");
    }
  };

  useEffect(() => {
    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleResult = (r: "pass" | "fail") => {
    setResult(r);
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
    }
    setCameraStatus("idle");
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

      <div className="grid grid-cols-3 gap-5">
        {/* Camera feed - large */}
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera size={14} className="text-blue-600" />
              <span className="text-sm text-slate-700">Camera Feed</span>
            </div>
            <div className={`flex items-center gap-1.5 text-xs ${
              cameraStatus === "active" ? "text-emerald-600" :
              cameraStatus === "denied" ? "text-red-500" : "text-slate-400"
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                cameraStatus === "active" ? "bg-emerald-500 animate-pulse" :
                cameraStatus === "denied" ? "bg-red-500" : "bg-slate-300"
              }`} />
              {cameraStatus === "active" ? "Live" :
               cameraStatus === "requesting" ? "Connecting..." :
               cameraStatus === "denied" ? "Access Denied" : "Inactive"}
            </div>
          </div>

          <div className="relative bg-slate-900 aspect-video flex items-center justify-center">
            {cameraStatus === "active" ? (
              <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
            ) : (
              <div className="flex flex-col items-center gap-4 text-center p-8">
                {cameraStatus === "denied" ? (
                  <>
                    <AlertCircle size={48} className="text-red-400" />
                    <div>
                      <p className="text-white">Camera access denied</p>
                      <p className="text-slate-400 text-sm mt-1">Allow camera access in browser permissions</p>
                    </div>
                  </>
                ) : (
                  <>
                    <Camera size={48} className="text-slate-500" />
                    <p className="text-slate-400">Camera not started</p>
                  </>
                )}
                <button
                  onClick={startCamera}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
                >
                  <RefreshCw size={14} />
                  {cameraStatus === "denied" ? "Retry Access" : "Activate Camera"}
                </button>
              </div>
            )}

            {cameraStatus === "active" && (
              <div className="absolute bottom-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                LIVE · {resolution}
              </div>
            )}
          </div>

          {cameraStatus === "active" && (
            <div className="p-4 flex gap-3">
              <button
                onClick={() => handleResult("pass")}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg transition-colors"
              >
                <CheckCircle2 size={18} />
                Pass — Camera OK
              </button>
              <button
                onClick={() => handleResult("fail")}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-500 hover:bg-red-400 text-white rounded-lg transition-colors"
              >
                <XCircle size={18} />
                Fail — Camera Issue
              </button>
            </div>
          )}
        </div>

        {/* Status panel */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-slate-700 mb-3">Camera Status</h3>
            <div className="space-y-2.5">
              {[
                { label: "Status", value: cameraStatus === "active" ? "Active" : "Inactive", ok: cameraStatus === "active" },
                { label: "Resolution", value: resolution, ok: resolution !== "—" },
                { label: "Device", value: "HP TrueVision HD", ok: true },
                { label: "Interface", value: "USB 2.0 Internal", ok: true },
                { label: "Microphone", value: "Built-in Array Mic", ok: true },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">{item.label}</span>
                  <span className={`text-xs font-medium ${item.ok ? "text-slate-700" : "text-slate-400"}`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-slate-700 mb-3">Checklist</h3>
            <div className="space-y-2">
              {[
                { label: "Camera activates", done: cameraStatus === "active" || result !== null },
                { label: "Image is clear", done: result === "pass" },
                { label: "No distortion", done: result === "pass" },
                { label: "No dead pixels", done: result === "pass" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <CheckCircle2 size={13} className={item.done ? "text-emerald-500" : "text-slate-300"} />
                  <span className="text-xs text-slate-600">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {result && (
            <div className={`rounded-xl border p-4 ${
              result === "pass" ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
            }`}>
              <div className="flex items-center gap-2">
                {result === "pass" ? (
                  <CheckCircle2 size={16} className="text-emerald-600" />
                ) : (
                  <XCircle size={16} className="text-red-600" />
                )}
                <span className={`text-sm ${result === "pass" ? "text-emerald-700" : "text-red-700"}`}>
                  {result === "pass" ? "Webcam test passed" : "Webcam test failed"}
                </span>
              </div>
            </div>
          )}
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
