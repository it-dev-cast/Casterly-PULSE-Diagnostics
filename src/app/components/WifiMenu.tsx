import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Wifi,
  WifiOff,
  Lock,
  Loader2,
  RefreshCw,
  Check,
  ChevronLeft,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";

interface WifiNetwork {
  ssid: string;
  signal: number;
  secured: boolean;
  security: string;
  in_use: boolean;
}

interface WifiStatus {
  connected: boolean;
  ssid: string | null;
}

function signalBars(signal: number) {
  // Map 0-100 signal strength to a 1-4 bar rating.
  if (signal >= 75) return 4;
  if (signal >= 50) return 3;
  if (signal >= 25) return 2;
  return 1;
}

function SignalIcon({ signal }: { signal: number }) {
  const bars = signalBars(signal);
  return (
    <div className="flex items-end gap-0.5 h-3.5 w-4 shrink-0" title={`${signal}%`}>
      {[1, 2, 3, 4].map((bar) => (
        <div
          key={bar}
          className={`w-[3px] rounded-sm ${
            bar <= bars ? "bg-[#0B2545]" : "bg-slate-200"
          }`}
          style={{ height: `${bar * 25}%` }}
        />
      ))}
    </div>
  );
}

export function WifiMenu() {
  const [open, setOpen] = useState(false);
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [status, setStatus] = useState<WifiStatus>({ connected: false, ssid: null });
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<WifiNetwork | null>(null);
  const [password, setPassword] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  const loadStatus = async () => {
    try {
      const s = await invoke<WifiStatus>("get_wifi_status");
      setStatus(s);
    } catch {
      // Non-fatal: leave last known status in place.
    }
  };

  const scan = async () => {
    setLoading(true);
    setError("");
    try {
      const list = await invoke<WifiNetwork[]>("scan_wifi_networks");
      setNetworks(list);
    } catch (e) {
      setError(typeof e === "string" ? e : "Failed to scan for networks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (open) {
      setSelected(null);
      setPassword("");
      setError("");
      scan();
    }
  }, [open]);

  const handleConnect = async (network: WifiNetwork) => {
    setConnecting(true);
    setError("");
    try {
      await invoke("connect_wifi_network", {
        ssid: network.ssid,
        password: network.secured ? password : null,
      });
      await loadStatus();
      setSelected(null);
      setPassword("");
    } catch (e) {
      setError(typeof e === "string" ? e : "Failed to connect");
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-1.5 bg-[#123a63] border border-[#1c3f66] rounded px-3 py-1.5 hover:bg-[#17457a] transition-colors"
          title={status.connected ? `Connected to ${status.ssid}` : "Wi-Fi"}
        >
          {status.connected ? (
            <Wifi size={14} strokeWidth={2.5} className="text-blue-300" />
          ) : (
            <WifiOff size={14} strokeWidth={2.5} className="text-slate-400" />
          )}
          <span className="text-white font-semibold text-sm max-w-[110px] truncate">
            {status.connected ? status.ssid : "Wi-Fi"}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-[#0B2545]">
          {selected ? (
            <button
              onClick={() => {
                setSelected(null);
                setError("");
              }}
              className="flex items-center gap-1 text-sm font-semibold text-white"
            >
              <ChevronLeft size={16} />
              Back
            </button>
          ) : (
            <span className="text-sm font-semibold text-white">Wi-Fi Networks</span>
          )}
          {!selected && (
            <button
              onClick={scan}
              disabled={loading}
              className="text-slate-300 hover:text-white disabled:opacity-50"
              title="Rescan"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          )}
        </div>

        {selected ? (
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Lock size={14} className="text-slate-500" />
              <span className="font-medium text-sm text-slate-800 truncate">
                {selected.ssid}
              </span>
            </div>

            {selected.secured && (
              <input
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConnect(selected);
                }}
                placeholder="Password"
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B2545]/30 focus:border-[#0B2545]"
              />
            )}

            {error && <p className="text-xs text-red-600">{error}</p>}

            <button
              onClick={() => handleConnect(selected)}
              disabled={connecting || (selected.secured && password.length === 0)}
              className="w-full flex items-center justify-center gap-2 bg-[#0B2545] text-white rounded px-3 py-2 text-sm font-semibold hover:bg-[#123a63] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {connecting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </button>
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            {loading && networks.length === 0 && (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
                <Loader2 size={14} className="animate-spin" />
                Scanning...
              </div>
            )}

            {!loading && networks.length === 0 && !error && (
              <div className="py-6 text-center text-sm text-slate-500">
                No networks found
              </div>
            )}

            {error && networks.length === 0 && (
              <div className="py-6 text-center text-sm text-red-600 px-4">{error}</div>
            )}

            {networks.map((n) => (
              <button
                key={n.ssid}
                onClick={() => {
                  if (n.in_use) return;
                  setSelected(n);
                  setPassword("");
                  setError("");
                }}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 border-b last:border-b-0 text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <SignalIcon signal={n.signal} />
                  <span className="text-sm text-slate-800 truncate">{n.ssid}</span>
                  {n.secured && <Lock size={12} className="text-slate-400 shrink-0" />}
                </div>
                {n.in_use && (
                  <span className="flex items-center gap-1 text-xs font-medium text-green-600 shrink-0">
                    <Check size={13} />
                    Connected
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
