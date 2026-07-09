import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Upload, CheckCircle2, XCircle, Clock, RefreshCw, Trash2, Eye } from "lucide-react";

type UploadStatus = "pending" | "uploaded" | "failed";

// Mirrors the QueueItem struct from the Rust `get_upload_queue` command.
interface QueueItem {
  id: number;
  inspectionUuid: string;
  status: string; // PENDING / UPLOADED / FAILED
  retryCount: number;
  createdAt: string;
  uploadedAt: string | null;
  serial: string;
  model: string;
}

interface QueueData {
  items: QueueItem[];
  pending: number;
  uploaded: number;
  failed: number;
}

export function UploadQueue() {
  const [queue, setQueue] = useState<QueueData>({
    items: [],
    pending: 0,
    uploaded: 0,
    failed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const q = await invoke<QueueData>("get_upload_queue");
      setQueue(q);
    } catch (err) {
      console.error("Failed to load upload queue:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await loadQueue();
    } catch (err) {
      console.error(err);
      alert(`Action failed: ${err}`);
    } finally {
      setBusy(false);
    }
  };

  const runSync = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      const r = (await fn()) as { message?: string };
      await loadQueue();
      alert(`Sync: ${r?.message ?? "done"}`);
    } catch (err) {
      console.error(err);
      alert(`Sync failed: ${err}`);
    } finally {
      setBusy(false);
    }
  };

  const handleRetry = (item: QueueItem) =>
    runSync(() => invoke("retry_upload", { id: item.id }));
  const handleRetryAll = () => runSync(() => invoke("retry_all_failed"));
  const handleDelete = (item: QueueItem) => {
    if (!window.confirm("Remove this record from the upload queue?")) return;
    run(() => invoke("delete_queue_item", { id: item.id }));
  };
  const handleDeleteUploaded = () => {
    if (!window.confirm("Delete all uploaded records from the queue?")) return;
    run(() => invoke("delete_uploaded"));
  };
  const handleView = async (item: QueueItem) => {
    try {
      const json = await invoke<string>("get_inspection_detail", {
        uuid: item.inspectionUuid,
      });
      try {
        setDetail(JSON.stringify(JSON.parse(json), null, 2));
      } catch {
        setDetail(json);
      }
    } catch (err) {
      alert(`Failed to load record: ${err}`);
    }
  };

  const queueData = queue.items;
  const pendingCount = queue.pending;
  const uploadedCount = queue.uploaded;
  const failedCount = queue.failed;

  const getStatusBadge = (raw: string) => {
    const status = raw.toLowerCase() as UploadStatus;
    switch (status) {
      case "pending":
        return (
          <span className="flex items-center gap-1 text-xs text-orange-300 bg-orange-500/15 px-2 py-0.5 rounded">
            <Clock size={12} />
            Pending
          </span>
        );
      case "uploaded":
        return (
          <span className="flex items-center gap-1 text-xs text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded">
            <CheckCircle2 size={12} />
            Uploaded
          </span>
        );
      case "failed":
        return (
          <span className="flex items-center gap-1 text-xs text-red-300 bg-red-500/15 px-2 py-0.5 rounded">
            <XCircle size={12} />
            Failed
          </span>
        );
    }
  };

  return (
    <div className="-m-6 p-6 min-h-[calc(100vh-6rem)] bg-[#0a1626] space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-100">Upload Queue</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage pending inspection uploads
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRetryAll}
            disabled={busy || (failedCount === 0 && pendingCount === 0)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={busy ? "animate-spin" : ""} />
            Retry All Failed
          </button>
          <button
            onClick={handleDeleteUploaded}
            disabled={busy || uploadedCount === 0}
            className="flex items-center gap-2 bg-slate-600 hover:bg-slate-500 text-white text-sm px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            <Trash2 size={16} />
            Delete Uploaded
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#0f1e35] rounded-lg border border-[#1c3f66] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-orange-400" />
            <span className="text-xs text-slate-500">Pending Uploads</span>
          </div>
          <div className="text-2xl text-orange-400 leading-none">{pendingCount}</div>
          <div className="text-xs text-slate-500 mt-1">awaiting sync</div>
        </div>

        <div className="bg-[#0f1e35] rounded-lg border border-[#1c3f66] p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span className="text-xs text-slate-500">Uploaded Records</span>
          </div>
          <div className="text-2xl text-emerald-400 leading-none">{uploadedCount}</div>
          <div className="text-xs text-slate-500 mt-1">synced to cloud</div>
        </div>

        <div className="bg-[#0f1e35] rounded-lg border border-[#1c3f66] p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle size={16} className="text-red-400" />
            <span className="text-xs text-slate-500">Failed Uploads</span>
          </div>
          <div className="text-2xl text-red-400 leading-none">{failedCount}</div>
          <div className="text-xs text-slate-500 mt-1">requires retry</div>
        </div>
      </div>

      {/* Upload Queue Table */}
      <div className="bg-[#0f1e35] rounded-lg border border-[#1c3f66]">
        <div className="p-4 border-b border-[#1c3f66]">
          <h3 className="text-slate-200">Upload Queue</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {loading ? "Loading…" : `${queueData.length} total records`}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#16294a] bg-[#0d1b30]">
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
              {!loading && queueData.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    Upload queue is empty.
                  </td>
                </tr>
              )}
              {queueData.map((item) => {
                const status = item.status.toLowerCase();
                return (
                  <tr
                    key={item.id}
                    className="border-b border-[#16294a] hover:bg-[#132445] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-slate-200">
                        {item.serial || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{item.model || "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{item.createdAt}</td>
                    <td className="px-4 py-3">{getStatusBadge(item.status)}</td>
                    <td className="px-4 py-3">
                      {item.retryCount > 0 ? (
                        <span className="text-red-400">{item.retryCount}</span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {status !== "uploaded" && (
                          <button
                            onClick={() => handleRetry(item)}
                            disabled={busy}
                            className="text-xs bg-blue-500/10 hover:bg-blue-500/15 text-blue-400 px-2 py-1 rounded transition-colors disabled:opacity-50"
                          >
                            <RefreshCw size={12} className="inline mr-1" />
                            Retry
                          </button>
                        )}
                        <button
                          onClick={() => handleView(item)}
                          className="text-xs bg-[#0d1b30] hover:bg-[#1c3457] text-slate-300 px-2 py-1 rounded transition-colors"
                        >
                          <Eye size={12} className="inline mr-1" />
                          View
                        </button>
                        {status !== "pending" && (
                          <button
                            onClick={() => handleDelete(item)}
                            disabled={busy}
                            className="text-xs bg-red-500/10 hover:bg-red-500/15 text-red-400 px-2 py-1 rounded transition-colors disabled:opacity-50"
                          >
                            <Trash2 size={12} className="inline mr-1" />
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info message */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Upload size={16} className="text-blue-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm text-blue-200 font-medium">Upload Information</div>
            <div className="text-xs text-blue-300 mt-0.5">
              Pending uploads will automatically sync when internet connection is available.
              Failed uploads can be retried manually or will retry automatically after 5 minutes.
            </div>
          </div>
        </div>
      </div>

      {/* Record detail modal */}
      {detail !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f1e35] rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-[#1c3f66] flex items-center justify-between">
              <h3 className="text-slate-100">Inspection Record</h3>
              <button
                onClick={() => setDetail(null)}
                className="text-sm text-slate-500 hover:text-slate-100"
              >
                Close
              </button>
            </div>
            <pre className="p-4 overflow-auto text-xs text-slate-200 font-mono whitespace-pre-wrap">
              {detail}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
