/**
 * Convert the OS-reported binary capacity (GiB) to a manufacturer/marketed
 * capacity string (GB / TB). Mirrors the Rust fallback logic in
 * src-tauri/src/inventory/storage.rs::normalize_capacity.
 */
export function normalizeCapacity(sizeGb: number): string {
  if (sizeGb <= 0) {
    return "Unknown";
  }

  // 1 GiB = 1.073741824 GB
  const decimalGb = sizeGb * 1.073741824;

  const standards: [number, string][] = [
    [128, "128 GB"],
    [256, "256 GB"],
    [512, "512 GB"],
    [1000, "1 TB"],
    [1024, "1 TB"],
    [2000, "2 TB"],
    [2048, "2 TB"],
    [4000, "4 TB"],
    [4096, "4 TB"],
    [8000, "8 TB"],
    [8192, "8 TB"],
  ];

  for (const [threshold, label] of standards) {
    if (Math.abs(decimalGb - threshold) / threshold <= 0.05) {
      return label;
    }
  }

  if (decimalGb >= 1000) {
    return `${Math.round(decimalGb / 1000)} TB`;
  }

  return `${Math.round(decimalGb)} GB`;
}
