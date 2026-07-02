// Builds a real PDF file (as raw bytes) from the same InspectionRun-shaped
// object used by report.ts's buildInspectionRun/buildReportHtml. Unlike
// report.ts's printHtmlReport (which opens the OS print dialog for the user
// to manually "Save as PDF"), this produces actual PDF bytes programmatically
// so a copy can be written straight to disk / uploaded to Supabase Storage
// without any user interaction.

import { jsPDF } from "jspdf";

type AnyObj = Record<string, any>;

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "-";
  return String(v);
}

export function buildInspectionPdf(run: AnyObj): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 50;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 40) {
      doc.addPage();
      y = 50;
    }
  };

  const title = (text: string) => {
    ensureSpace(24);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(30, 58, 138);
    doc.text(text, marginX, y);
    y += 20;
  };

  const subtitle = (text: string) => {
    ensureSpace(16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(text, marginX, y);
    y += 18;
  };

  const sectionHeader = (text: string) => {
    ensureSpace(24);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(37, 99, 235);
    doc.text(text, marginX, y);
    y += 12;
    doc.setDrawColor(226, 232, 240);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 12;
  };

  const kv = (label: string, value: unknown) => {
    ensureSpace(14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    doc.text(label, marginX, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(fmt(value), pageWidth - marginX, y, { align: "right" });
    y += 14;
  };

  const gradeLine = (label: string, status: unknown, defects?: any[]) => {
    const d = defects && defects.length ? ` (${defects.join(", ")})` : "";
    kv(label, `${fmt(status)}${d}`);
  };

  title("Casterly PULSE 4.0 - Inspection Report");
  subtitle(`Refurbishment Inspection - Generated ${new Date().toLocaleString()}`);
  y += 6;

  const inv = run.inventory || {};
  const sys = inv.system || {};
  const cpu = inv.cpu || {};
  const mem: AnyObj[] = inv.memory || [];
  const storage: AnyObj[] = inv.storage || [];
  const batt = inv.battery || {};
  const bios = inv.bios || {};
  const gpu: AnyObj[] = Array.isArray(inv.gpu) ? inv.gpu : inv.gpu ? [inv.gpu] : [];
  const disp = inv.display || {};
  const net = inv.network || {};
  const grading = run.grading || {};

  const totalMemGb = mem.reduce((s, m) => s + (m?.size_mb || 0), 0) / 1024;
  const memType = mem.find((m) => !m?.is_empty)?.memory_type;
  const drive = storage[0] || {};

  sectionHeader("Inspection");
  kv("UUID", run.uuid);
  kv("Timestamp", run.timestamp);
  kv("LOT", run.lot_name);
  kv("Inspector", run.inspector);
  kv("Grade", run.grade ? `Grade ${run.grade}` : "-");
  kv("Battery Health", run.battery_health != null ? `${run.battery_health}%` : "-");
  y += 6;

  sectionHeader("System");
  kv("Manufacturer", sys.manufacturer);
  kv("Model", sys.model);
  kv("Serial", sys.serial_number);
  kv("UUID", sys.uuid);
  kv("BIOS Version", sys.bios_version || bios.version);
  y += 6;

  sectionHeader("CPU");
  kv("Processor", cpu.model);
  kv("Vendor", cpu.manufacturer);
  kv(
    "Cores / Threads",
    cpu.cores_per_socket != null ? `${cpu.cores_per_socket} / ${cpu.threads}` : "-",
  );
  kv("Max Speed", cpu.max_speed_mhz ? `${cpu.max_speed_mhz} MHz` : "-");
  y += 6;

  sectionHeader("Memory");
  kv("Installed", mem.length ? `${totalMemGb.toFixed(1)} GB` : "-");
  kv("Type", memType);
  kv("Modules", mem.length || "-");
  y += 6;

  sectionHeader("Storage");
  kv("Type", drive.storage_type);
  kv("Model", drive.model);
  kv("Capacity", drive.size_gb != null ? `${Math.round(drive.size_gb)} GB` : "-");
  kv("Health", drive.health_percent != null ? `${drive.health_percent}%` : "-");
  y += 6;

  sectionHeader("Battery");
  kv("Manufacturer", batt.manufacturer);
  kv("Cycle Count", batt.cycle_count);
  kv("Status", batt.status);
  y += 6;

  sectionHeader("Display");
  kv("Manufacturer", disp.manufacturer);
  kv("Resolution", disp.resolution);
  kv("Size", disp.size_inches != null ? `${disp.size_inches}"` : "-");
  y += 6;

  if (gpu.length) {
    sectionHeader("GPU");
    gpu.forEach((g) => kv(g.vendor || "GPU", g.model));
    y += 6;
  }

  sectionHeader("Network");
  kv("WiFi", net.wifi_friendly);
  kv("Ethernet", net.ethernet_friendly);
  kv("Bluetooth", net.bluetooth ? "Yes" : "No");
  y += 6;

  sectionHeader("Cosmetic Grading");
  gradeLine("LCD", grading.lcd_status, grading.lcd_defects);
  gradeLine("Top Cover", grading.top_cover_status, grading.top_cover_defects);
  gradeLine("Bezel", grading.bezel_status, grading.bezel_defects);
  gradeLine("Palmrest", grading.palmrest_status, grading.palmrest_defects);
  gradeLine("Bottom Cover", grading.bottom_cover_status, grading.bottom_cover_defects);
  gradeLine("Keyboard", grading.keyboard_status, grading.keyboard_defects);
  gradeLine("Touchpad", grading.touchpad_status);
  kv("Remarks", grading.remarks);
  y += 6;

  sectionHeader("Functional Tests");
  kv("Speaker", run.speaker_test?.result);
  kv("Webcam", run.webcam_test?.result);
  kv("Keyboard", run.keyboard_test?.result);
  kv("Touchpad", run.touchpad_test?.result);
  kv("Battery Assessment", run.battery_assessment?.result);

  return new Uint8Array(doc.output("arraybuffer"));
}

/** Base64-encode a Uint8Array in chunks (avoids call-stack overflow on large
 * arrays from a single `String.fromCharCode(...bytes)` spread). */
export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...Array.from(chunk));
  }
  return btoa(binary);
}
