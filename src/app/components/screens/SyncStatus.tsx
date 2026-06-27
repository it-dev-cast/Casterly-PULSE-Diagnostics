import { Cloud, CheckCircle2, XCircle, Clock, RefreshCw, AlertCircle, Activity } from "lucide-react";

interface SyncActivity {
  id: string;
  timestamp: string;
  record: string;
  result: "success" | "failed";
}

const syncHistory: SyncActivity[] = [
  {
    id: "1",
    timestamp: "2026-06-08 10:25:14",
    record: "5CD127XYZA",
    result: "success",
  },
  {
    id: "2",
    timestamp: "2026-06-08 10:20:42",
    record: "5CD128BCDE",
    result: "success",
  },
  {
    id: "3",
    timestamp: "2026-06-08 10:15:18",
    record: "5CD125PQRS",
    result: "failed",
  },
  {
    id: "4",
    timestamp: "2026-06-08 10:10:05",
    record: "5CD126TUVW",
    result: "success",
  },
  {
    id: "5",
    timestamp: "2026-06-08 10:05:33",
    record: "5CD123MNOP",
    result: "success",
  },
  {
    id: "6",
    timestamp: "2026-06-08 09:58:47",
    record: "5CD122JKLM",
    result: "failed",
  },
  {
    id: "7",
    timestamp: "2026-06-08 09:52:12",
    record: "5CD121GHIJ",
    result: "success",
  },
];

export function SyncStatus() {
  const lastSync = "Today, 10:25 AM";
  const pendingCount = 3;
  const failedCount = 2;
  const successfulSyncs = syncHistory.filter((s) => s.result === "success").length;
  const failedSyncs = syncHistory.filter((s) => s.result === "failed").length;
  const syncHealth = successfulSyncs / (successfulSyncs + failedSyncs);

  const getHealthStatus = (health: number) => {
    if (health >= 0.9) return { text: "Excellent", color: "text-emerald-600", bg: "bg-emerald-50" };
    if (health >= 0.75) return { text: "Good", color: "text-blue-600", bg: "bg-blue-50" };
    if (health >= 0.5) return { text: "Fair", color: "text-orange-600", bg: "bg-orange-50" };
    return { text: "Poor", color: "text-red-600", bg: "bg-red-50" };
  };

  const healthStatus = getHealthStatus(syncHealth);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-800">Cloud Synchronization</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage cloud sync and upload status
          </p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-2 rounded-lg transition-colors">
            <RefreshCw size={16} />
            Sync Now
          </button>
          <button className="flex items-center gap-2 bg-slate-600 hover:bg-slate-500 text-white text-sm px-3 py-2 rounded-lg transition-colors">
            <RefreshCw size={16} />
            Retry Failed Uploads
          </button>
        </div>
      </div>

      {/* Sync Status Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-blue-600" />
            <span className="text-xs text-slate-500">Last Successful Sync</span>
          </div>
          <div className="text-sm text-slate-800 leading-none font-medium">{lastSync}</div>
          <div className="text-xs text-slate-400 mt-1">2 minutes ago</div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Cloud size={16} className="text-orange-600" />
            <span className="text-xs text-slate-500">Pending Upload Count</span>
          </div>
          <div className="text-2xl text-orange-600 leading-none">{pendingCount}</div>
          <div className="text-xs text-slate-400 mt-1">awaiting sync</div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle size={16} className="text-red-500" />
            <span className="text-xs text-slate-500">Failed Upload Count</span>
          </div>
          <div className="text-2xl text-red-500 leading-none">{failedCount}</div>
          <div className="text-xs text-slate-400 mt-1">requires retry</div>
        </div>

        <div className={`rounded-lg border border-slate-200 p-4 ${healthStatus.bg}`}>
          <div className="flex items-center gap-2 mb-2">
            <Activity size={16} className={healthStatus.color} />
            <span className="text-xs text-slate-500">Sync Health</span>
          </div>
          <div className={`text-2xl ${healthStatus.color} leading-none`}>
            {healthStatus.text}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {Math.round(syncHealth * 100)}% success rate
          </div>
        </div>
      </div>

      {/* Sync Health Details */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h3 className="text-slate-700 mb-4">Synchronization Health</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-slate-500 mb-2">Success Rate (Last 24 Hours)</div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${syncHealth * 100}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs">
              <span className="text-emerald-600">{successfulSyncs} Successful</span>
              <span className="text-red-500">{failedSyncs} Failed</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Internet Connection</span>
              <span className="flex items-center gap-1 text-emerald-600">
                <CheckCircle2 size={12} />
                Connected
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Cloud API Status</span>
              <span className="flex items-center gap-1 text-emerald-600">
                <CheckCircle2 size={12} />
                Operational
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">USB Storage</span>
              <span className="flex items-center gap-1 text-emerald-600">
                <CheckCircle2 size={12} />
                Available
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Upload Activity */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <h3 className="text-slate-700">Recent Upload Activity</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Last {syncHistory.length} sync attempts
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs text-slate-500 px-4 py-3">
                  Timestamp
                </th>
                <th className="text-left text-xs text-slate-500 px-4 py-3">
                  Record
                </th>
                <th className="text-left text-xs text-slate-500 px-4 py-3">
                  Result
                </th>
              </tr>
            </thead>
            <tbody>
              {syncHistory.map((activity) => (
                <tr
                  key={activity.id}
                  className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-3 text-slate-500">{activity.timestamp}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-slate-700">
                      {activity.record}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {activity.result === "success" ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded w-fit">
                        <CheckCircle2 size={12} />
                        Success
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded w-fit">
                        <XCircle size={12} />
                        Failed
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info notice */}
      {failedCount > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={16} className="text-orange-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm text-orange-900 font-medium">
                Failed Uploads Detected
              </div>
              <div className="text-xs text-orange-700 mt-0.5">
                {failedCount} upload{failedCount > 1 ? "s have" : " has"} failed. These will be automatically retried in 5 minutes, or you can retry them manually now.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
