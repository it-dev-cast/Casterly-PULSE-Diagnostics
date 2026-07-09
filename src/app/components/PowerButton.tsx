import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Power, Loader2, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "./ui/alert-dialog";

// The confirmation below is a Radix dialog rendered inside Pulse's own
// window (via a portal into the app's DOM, not a separate OS window), so it
// always paints above the rest of the UI. This intentionally avoids the
// native `@tauri-apps/plugin-dialog` message()/ask() dialogs for this flow:
// those spawn a real OS window which, when the main window is pinned
// always-on-top (kiosk mode), can end up stuck behind Pulse instead of in
// front of it. Any error from the shutdown attempt is shown inline in this
// same in-app dialog for the same reason.
export function PowerButton() {
  const [open, setOpen] = useState(false);
  const [shuttingDown, setShuttingDown] = useState(false);
  const [error, setError] = useState("");

  const handleOpenChange = (next: boolean) => {
    if (shuttingDown) return;
    setOpen(next);
    if (!next) setError("");
  };

  const handleShutdown = async () => {
    setShuttingDown(true);
    setError("");
    try {
      await invoke("shutdown_system");
      // On success the machine is powering off; leave the dialog open with
      // the spinner showing rather than resetting state.
    } catch (e) {
      setError(typeof e === "string" ? e : "Failed to shut down the system");
      setShuttingDown(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <button
        onClick={() => setOpen(true)}
        className="group flex items-center justify-center bg-[#123a63] border border-[#1c3f66] rounded px-2.5 py-1.5 hover:bg-red-600 hover:border-red-700 transition-colors"
        title="Shut down"
      >
        <Power size={16} strokeWidth={2.5} className="text-slate-300 group-hover:text-white" />
      </button>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-600" />
            Shut down system?
          </AlertDialogTitle>
          <AlertDialogDescription>
            The machine will power off immediately. Any unsaved inspection
            progress will be lost. Make sure the current draft is saved
            before continuing.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </p>
        )}

        <AlertDialogFooter>
          <button
            onClick={() => handleOpenChange(false)}
            disabled={shuttingDown}
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleShutdown}
            disabled={shuttingDown}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-red-600 text-white px-4 py-2 text-sm font-semibold hover:bg-red-700 disabled:opacity-70"
          >
            {shuttingDown ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Shutting down...
              </>
            ) : (
              "Shut Down"
            )}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
