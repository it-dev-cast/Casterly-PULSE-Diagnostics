import { Upload, CheckCircle2, XCircle, Clock, RefreshCw, Trash2, Eye } from "lucide-react";

type UploadStatus = "pending" | "uploaded" | "failed";

interface QueueItem {
  id: string;
  serialNumber: string;
  model: string;
  inspectionDate: string;
  uploadStatus: UploadStatus;
  retryCount: number;
}

const queueData: QueueItem[] = [
  {
    id: "1",
    serialNumber: "5CD124NJWZ",
    model: "HP ProBook 440 G8",
    inspectionDate: "2026-06-08 10:23",
    uploadStatus: "pending",
    retryCount: 0,
  },
  {
    id: "2",
    serialNumber: "5CD125PQRS",
    model: "HP ProBook 440 G8",
    inspectionDate: "2026-06-08 10:15",
    uploadStatus: "pending",
    retryCount: 0,
  },
  {
    id: "3",
    serialNumber: "5CD126TUVW",
    model: "HP EliteBook 840 G7",
    inspectionDate: "2026-06-08 10:08",
    uploadStatus: "pending",
    retryCount: 0,
  },
  {
    id: "4",
    serialNumber: "5CD127XYZA",
    model: "HP ProBook 450 G8",
    inspectionDate: "2026-06-08 09:58",
    uploadStatus: "uploaded",
    retryCount: 0,
  },
  {
    id: "5",
    serialNumber: "5CD128BCDE",
    model: "HP ProBook 440 G8",
    inspectionDate: "2026-06-08 09:45",
    uploadStatus: "uploaded",
    retryCount: 0,
  },
  {
    id: "6",
    serialNumber: "5CD129FGHI",
    model: "HP EliteBook 850 G8",
    inspectionDate: "2026-06-07 17:32",
    uploadStatus: "failed",
    retryCount: 3,
  },
];

export function UploadQueue() {
  const pendingCount = queueData.filter((i) => i.uploadStatus === "pending").length;
  const uploadedCount = queueData.filter((i) => i.uploadStatus === "uploaded").length;
  const failedCount = queueData.filter((i) => i.uploadStatus === "failed").length;

  const getStatusBadge = (status: UploadStatus) => {
    switch (status) {
      case "pending":
        return (
          <span className="flex items-center gap-1 text-xs text-orange-700 bg-orange-100 px-2 py-0.5 rounded">
            <Clock size={12} />
            Pending
          </span>
        );
      case "uploaded":
        return (
          <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
            <CheckCircle2 size={12} />
            Uploaded
          </span>
        );
      case "failed":
        return (
          <span className="flex items-center gap-1 text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded">
            <XCircle size={12} />
            Failed
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-800">Upload Queue</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage pending inspection uploads
          </p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-2 rounded-lg transition-colors">
            <RefreshCw size={16} />
            Retry All Failed
          </button>
          <button className="flex items-center gap-2 bg-slate-600 hover:bg-slate-500 text-white text-sm px-3 py-2 rounded-lg transition-colors">
            <Trash2 size={16} />
            Delete Uploaded
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-orange-600" />
            <span className="text-xs text-slate-500">Pending Uploads</span>
          </div>
          <div className="text-2xl text-orange-600 leading-none">{pendingCount}</div>
          <div className="text-xs text-slate-400 mt-1">awaiting sync</div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span className="text-xs text-slate-500">Uploaded Records</span>
          </div>
          <div className="text-2xl text-emerald-600 leading-none">{uploadedCount}</div>
          <div className="text-xs text-slate-400 mt-1">synced to cloud</div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle size={16} className="text-red-500" />
            <span className="text-xs text-slate-500">Failed Uploads</span>
          </div>
          <div className="text-2xl text-red-500 leading-none">{failedCount}</div>
          <div className="text-xs text-slate-400 mt-1">requires retry</div>
        </div>
      </div>

      {/* Upload Queue Table */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <h3 className="text-slate-700">Upload Queue</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {queueData.length} total records
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs text-slate-500 px-4 py-3">
                  Serial Number
                </th>
                <th className="text-left text-xs text-slate-500 px-4 py-3">
                  Model
                </th>
                <th className="text-left text-xs text-slate-500 px-4 py-3">
                  Inspection Date
                </th>
                <th className="text-left text-xs text-slate-500 px-4 py-3">
                  Upload Status
                </th>
                <th className="text-left text-xs text-slate-500 px-4 py-3">
                  Retry Count
                </th>
                <th className="text-left text-xs text-slate-500 px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {queueData.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-slate-700">
                      {item.serialNumber}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.model}</td>
                  <td className="px-4 py-3 text-slate-500">{item.inspectionDate}</td>
                  <td className="px-4 py-3">{getStatusBadge(item.uploadStatus)}</td>
                  <td className="px-4 py-3">
                    {item.retryCount > 0 ? (
                      <span className="text-red-600">{item.retryCount}</span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {item.uploadStatus === "failed" && (
                        <button className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-2 py-1 rounded transition-colors">
                          <RefreshCw size={12} className="inline mr-1" />
                          Retry
                        </button>
                      )}
                      <button className="text-xs bg-slate-50 hover:bg-slate-100 text-slate-600 px-2 py-1 rounded transition-colors">
                        <Eye size={12} className="inline mr-1" />
                        View
                      </button>
                      {item.uploadStatus !== "pending" && (
                        <button className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1 rounded transition-colors">
                          <Trash2 size={12} className="inline mr-1" />
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info message */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Upload size={16} className="text-blue-600 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm text-blue-900 font-medium">Upload Information</div>
            <div className="text-xs text-blue-700 mt-0.5">
              Pending uploads will automatically sync when internet connection is available.
              Failed uploads can be retried manually or will retry automatically after 5 minutes.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
