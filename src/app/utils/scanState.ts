export const REQUIRED_SCANNERS = [
  "system", "cpu", "battery", "gpu", "display", "network", "memory", "storage", "camera", "audio",
] as const;
export type Scanner = typeof REQUIRED_SCANNERS[number];
export type StorageState = "pending" | "running" | "completed" | "unavailable" | "failed";

export function isScanComplete(settled: ReadonlySet<Scanner>, storage: StorageState): boolean {
  return !["pending", "running"].includes(storage)
    && REQUIRED_SCANNERS.every(scanner => settled.has(scanner));
}

export function storageFallback(state: StorageState, hasBasicData: boolean): string {
  return !hasBasicData && (state === "pending" || state === "running") ? "Scanning..." : "Unavailable";
}

/** One terminal notification, even when the IPC task or result handler throws. */
export async function settleScanner<T>(
  task: () => Promise<T>, onResult: (value: T) => void,
  onError: (error: unknown) => void, onSettled: () => void,
): Promise<void> {
  try { onResult(await task()); }
  catch (error) { onError(error); }
  finally { onSettled(); }
}
