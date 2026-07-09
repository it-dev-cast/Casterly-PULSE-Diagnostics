// Builds a real PDF file (as raw bytes) from the InspectionRun-shaped object
// (see report.ts's buildInspectionRun). This is the single PDF-generation
// path used both for the silent auto-export (Final Review -> Save & Complete
// -> export_inspection_files, which writes to the USB "exports" folder and
// uploads to Supabase Storage) and for the user-triggered "Export PDF" /
// "Download Report" buttons, so every exported PDF is byte-for-byte the same
// layout regardless of where it was triggered from.
//
// Layout mirrors the "Casterly PULSE Report" format: a logo + title header,
// underlined section headings, zebra-striped label/value tables, a
// Test Results table with colour-coded Pass/Fail, and a Specifications
// section broken into subsections (System, Processor, Memory, Storage,
// Motherboard, Network, Audio, Battery, Bluetooth, Display, Graphics,
// Webcam).

import { jsPDF } from "jspdf";
import reportLogo from "../../assets/casterly_logo.png";
import { normalizeCapacity } from "../utils/capacity";

type AnyObj = Record<string, any>;
type RGB = [number, number, number];

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "-";
  return String(v);
}

/** Strip control/non-printable bytes (e.g. mojibake from a raw EDID/dmidecode
 * field like a display Panel Part Number that contains padding or non-ASCII
 * junk) and collapse whitespace, so garbled source data can't throw off
 * jsPDF's text-width measurements and overflow the page margin. */
function cleanText(v: unknown): string {
  const s = fmt(v);
  if (s === "-") return s;
  const cleaned = s
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "-";
}

/** Formats a Date the way BurnInTest stamps its own "Report Date" field,
 * e.g. "Mon Jul 6 05:45:26 2026" (day name, month name, non-zero-padded
 * day-of-month, 24h HH:MM:SS, year). */
function formatReportDate(d: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const day = days[d.getDay()];
  const month = months[d.getMonth()];
  const date = d.getDate();
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  return `${day} ${month} ${date} ${time} ${d.getFullYear()}`;
}

/** Word-wrap `text` to fit within `maxWidth` using the doc's current font,
 * falling back to a hard character-break for any single "word" that's still
 * too wide on its own (guards against unbroken long tokens overflowing past
 * the page margin, which plain splitTextToSize can miss on odd input). */
function wrapToWidth(doc: jsPDF, text: string, maxWidth: number): string[] {
  const clean = cleanText(text);
  if (clean === "-") return [clean];

  const lines: string[] = [];
  let current = "";

  const pushHardBreak = (word: string) => {
    let chunk = "";
    for (const ch of word) {
      const test = chunk + ch;
      if (chunk && doc.getTextWidth(test) > maxWidth) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk = test;
      }
    }
    return chunk;
  };

  for (const word of clean.split(" ")) {
    const candidate = current ? `${current} ${word}` : word;
    if (doc.getTextWidth(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) {
      lines.push(current);
      current = "";
    }
    if (doc.getTextWidth(word) > maxWidth) {
      current = pushHardBreak(word);
    } else {
      current = word;
    }
  }
  if (current) lines.push(current);

  return lines.length ? lines : ["-"];
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Strip characters that aren't safe in a filename on Windows/Linux. */
function safeSegment(s: unknown): string {
  return String(s ?? "").trim().replace(/[^a-zA-Z0-9_-]+/g, "_") || "UNKNOWN";
}

/**
 * Builds the export filename: serialnumber-lotno--dd-mm-yy-HH-MM-SS.pdf
 * (double dash between the LOT number and the date/time stamp).
 */
export function buildExportFilename(run: AnyObj): string {
  const sys = run?.inventory?.system || {};
  const serial = sys.serial_number || run?.uuid || "UNKNOWN";
  const lot = run?.lot_name || "NOLOT";

  const d = new Date();
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yy = pad2(d.getFullYear() % 100);
  const HH = pad2(d.getHours());
  const MI = pad2(d.getMinutes());
  const SS = pad2(d.getSeconds());

  return `${safeSegment(serial)}-${safeSegment(lot)}--${dd}-${mm}-${yy}-${HH}-${MI}-${SS}.pdf`;
}

/** Trigger a browser download of PDF bytes under an exact filename. */
export function downloadPdf(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
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

/** Load an imported image asset (Vite-resolved URL) as a PNG data URL, since
 * jsPDF's addImage needs a data URL / raw base64, not an arbitrary URL. */
function loadImageAsDataUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || 1;
      canvas.height = img.naturalHeight || 1;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("no 2d canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("failed to load logo image"));
    img.src = url;
  });
}

let cachedLogo: { dataUrl: string; ratio: number } | null | undefined;
async function getLogo(): Promise<{ dataUrl: string; ratio: number } | null> {
  if (cachedLogo !== undefined) return cachedLogo;
  try {
    const dataUrl = await loadImageAsDataUrl(reportLogo);
    const img = new Image();
    const ratio: number = await new Promise((resolve) => {
      img.onload = () => resolve((img.naturalWidth || 1) / (img.naturalHeight || 1));
      img.onerror = () => resolve(1);
      img.src = dataUrl;
    });
    cachedLogo = { dataUrl, ratio };
  } catch {
    cachedLogo = null;
  }
  return cachedLogo;
}

// Palette and geometry below are lifted directly from the reference
// BurnInTest certificate's own PDF content stream (measured with
// pdfplumber): label-cell background rgb(233,236,239), value-cell
// background rgb(248,249,250), grid-line grey rgb(221,221,221) at 0.4pt,
// title/section-heading text rgb(52,58,64), row-label text rgb(73,80,87),
// row-value text rgb(74,74,74), and PASS/FAIL rgb(40,167,69)/rgb(220,53,69).
// Values are normal weight throughout the reference (only labels are
// bold) — see zebraRows below for where Pulse intentionally keeps a
// handful of values bold regardless (Serial Number, MAC, etc.), which is
// a Pulse-specific emphasis convention outside the "match exactly" scope.
const COLOR: Record<string, RGB> = {
  text: [74, 74, 74],
  muted: [90, 90, 90],
  heading: [52, 58, 64],
  rowLabel: [73, 80, 87],
  labelBg: [233, 236, 239],
  valueBg: [248, 249, 250],
  border: [221, 221, 221],
  pass: [40, 167, 69],
  fail: [220, 53, 69],
  pending: [217, 119, 6],
  onBand: [255, 255, 255],
};

function resultColor(result: unknown): RGB {
  const r = String(result || "").toUpperCase();
  if (r === "PASS") return COLOR.pass;
  if (r === "FAIL") return COLOR.fail;
  return COLOR.pending;
}

export async function buildInspectionPdf(run: AnyObj): Promise<Uint8Array> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 36.32;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - marginX * 2;
  const footerY = pageHeight - 28;
  let y = 40;

  const newPage = () => {
    doc.addPage();
    y = 40;
  };
  const ensureSpace = (needed: number) => {
    if (y + needed > footerY - 12) newPage();
  };

  // ---- Header: title on the left, logo top-right (mirrors the reference
  // certificate's "<Title> ... [logo]" layout). Title is 11.6pt bold, the
  // reference's own exact title size. The reference has NO rule line under
  // its title — just a large (~24.5pt) whitespace gap before the first
  // section heading — so the divider line has been removed here too. -----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.6);
  doc.setTextColor(...COLOR.heading);
  doc.text("Casterly PULSE USB Report", marginX, y + 10);

  const logo = await getLogo();
  if (logo) {
    const logoH = 40;
    const logoW = Math.min(90, logoH * logo.ratio);
    try {
      doc.addImage(logo.dataUrl, "PNG", pageWidth - marginX - logoW, y - 10, logoW, logoH);
    } catch {
      // Malformed image data — fall back to text-only header.
    }
  }
  y += 30;

  // ---- Section / row drawing helpers -----------------------------------------
  // Font sizes and colours below are matched to the reference certificate's
  // actual embedded values (see the COLOR palette comment above). Every
  // heading gets breathing room on both sides: a gap BEFORE its own text
  // (separating it from whatever content precedes it) and a smaller gap
  // AFTER (before the next table's rows begin) — mirroring the reference's
  // own ~9pt-before / ~5pt-after heading spacing.
  const sectionTitle = (text: string) => {
    ensureSpace(9 + 12 + 9);
    y += 9;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2);
    doc.setTextColor(...COLOR.heading);
    doc.text(text, marginX, y);
    y += 9;
  };

  const subTitle = (text: string) => {
    ensureSpace(6 + 10 + 9);
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.4);
    doc.setTextColor(...COLOR.heading);
    doc.text(text, marginX, y);
    y += 9;
  };

  // Label column is always shaded rgb(233,236,239) with bold text; the
  // value column is always rgb(248,249,250) — the reference's own fixed
  // two-tone label/value grid (no alternating zebra stripe anywhere in the
  // source document). Values are normal weight by default, matching the
  // reference exactly — Pulse passes `true` as the 3rd tuple element only
  // for the handful of fields it deliberately keeps bold regardless
  // (Serial Number, Serial, Size/Capacity, Health Percentage, WiFi/Ethernet
  // MAC), which is a Pulse-only emphasis convention layered on top. The
  // shared edge between the two adjacent bordered rects forms the vertical
  // divider line, and each row's border forms the horizontal separator
  // between rows. Long values wrap onto extra lines instead of overflowing
  // past the page margin.
  const labelColW = contentWidth * 0.3;
  const valueColW = contentWidth - labelColW;
  const valueMaxWidth = valueColW - 8;
  const lineH = 10.4;
  const zebraRows = (pairs: [string, unknown, boolean?][]) => {
    pairs.forEach(([label, value, bold]) => {
      const valueStyle = bold ? "bold" : "normal";
      doc.setFont("helvetica", valueStyle);
      doc.setFontSize(5.6);
      const valueLines: string[] = wrapToWidth(doc, fmt(value), valueMaxWidth);
      const rowH = Math.max(10.4, valueLines.length * lineH);

      ensureSpace(rowH);
      doc.setDrawColor(...COLOR.border);
      doc.setLineWidth(0.4);
      doc.setFillColor(...COLOR.labelBg);
      doc.rect(marginX, y - 7, labelColW, rowH, "FD");
      doc.setFillColor(...COLOR.valueBg);
      doc.rect(marginX + labelColW, y - 7, valueColW, rowH, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.6);
      doc.setTextColor(...COLOR.rowLabel);
      doc.text(label, marginX + 3, y);

      doc.setFont("helvetica", valueStyle);
      doc.setTextColor(...COLOR.text);
      valueLines.forEach((line, li) => {
        doc.text(line, marginX + labelColW + 3, y + li * lineH);
      });
      y += rowH;
    });
  };

  // Matches the reference's own Test/Result table exactly: the header row
  // shades BOTH cells with the usual label background; every data row's
  // Test Name cell stays the plain value background (never the grey label
  // shade, and never alternating/zebra-striped — the reference has no
  // stripe here either), and only the Result cell itself is filled with
  // the solid pass/fail colour. The grid border stays the ordinary grey
  // throughout, including on top of the coloured cells, exactly as in the
  // reference.
  const testResultsTable = (rows: [string, unknown][]) => {
    const rowH = 10.4;
    ensureSpace(rowH);
    doc.setDrawColor(...COLOR.border);
    doc.setLineWidth(0.4);
    doc.setFillColor(...COLOR.labelBg);
    doc.rect(marginX, y - 7, contentWidth, rowH, "FD");
    doc.line(marginX + labelColW, y - 7, marginX + labelColW, y - 7 + rowH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.6);
    doc.setTextColor(...COLOR.rowLabel);
    doc.text("Test Name", marginX + 3, y);
    doc.text("Result", marginX + labelColW + 3, y);
    y += rowH;

    rows.forEach(([name, result]) => {
      ensureSpace(rowH);
      const r = String(result || "PENDING").toUpperCase();
      const isBand = r === "PASS" || r === "FAIL";

      doc.setDrawColor(...COLOR.border);
      doc.setLineWidth(0.4);
      doc.setFillColor(...COLOR.valueBg);
      doc.rect(marginX, y - 7, labelColW, rowH, "FD");
      doc.setFillColor(...(isBand ? resultColor(r) : COLOR.valueBg));
      doc.rect(marginX + labelColW, y - 7, valueColW, rowH, "FD");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.6);
      doc.setTextColor(...COLOR.text);
      doc.text(name, marginX + 3, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...(isBand ? COLOR.onBand : resultColor(r)));
      doc.text(r, marginX + labelColW + 3, y);
      y += rowH;
    });
  };

  // ---- Data ------------------------------------------------------------------
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
  const audio = inv.audio || {};
  const cam = inv.camera || {};
  const grading = run.grading || {};

  const totalMemGb = mem.reduce((s, m) => s + (m?.size_mb || 0), 0) / 1024;
  const memType = mem.find((m) => !m?.is_empty)?.memory_type;

  // ---- Certificate Details ------------------------------------------------
  // Mirrors BurnInTest's own certificate footer fields ("Report Date" /
  // "Generated by BurnInTest Version 11.0 (64-bit)"), stamped with the
  // actual export timestamp rather than the inspection's own event date.
  sectionTitle("Certificate Details");
  zebraRows([
    ["Report Date", formatReportDate(new Date())],
    ["Generated by", "Pulse Version 4.0 (64-bit)"],
  ]);

  // ---- System Information ------------------------------------------------
  sectionTitle("System Information");
  zebraRows([
    ["Manufacturer", sys.manufacturer],
    ["Model", sys.model],
    ["Serial Number", sys.serial_number, true],
    ["System UUID", sys.uuid],
    ["BIOS Version", sys.bios_version || bios.version],
  ]);

  // ---- Event Information --------------------------------------------------
  sectionTitle("Event Information");
  zebraRows([
    ["Date", run.timestamp],
    ["CLY No", run.cly_no],
    ["Inspector", run.inspector],
    ["LOT", run.lot_name],
    ["Inspection UUID", run.uuid],
    ["Grade", run.grade ? `Grade ${run.grade}` : "-"],
  ]);

  // ---- Test Results ---------------------------------------------------------
  sectionTitle("Test Results");
  testResultsTable([
    ["Speaker Test", run.speaker_test?.result],
    ["Webcam Test", run.webcam_test?.result],
    ["Keyboard Test", run.keyboard_test?.result],
    ["Touchpad Test", run.touchpad_test?.result],
    ["Battery Assessment", run.battery_assessment?.result],
    ["LCD Screen", grading.lcd_status],
    ["Top Cover", grading.top_cover_status],
    ["Bezel", grading.bezel_status],
    ["Palmrest", grading.palmrest_status],
    ["Bottom Cover", grading.bottom_cover_status],
    ["Keyboard (Cosmetic)", grading.keyboard_status],
    ["Touchpad (Cosmetic)", grading.touchpad_status],
  ]);

  if (grading.remarks) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.4);
    doc.setTextColor(...COLOR.heading);
    ensureSpace(9);
    doc.text("Remarks", marginX, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.6);
    doc.setTextColor(...COLOR.text);
    const lines = doc.splitTextToSize(String(grading.remarks), contentWidth);
    ensureSpace(lines.length * 7 + 5);
    doc.text(lines, marginX, y);
    y += lines.length * 7 + 8;
  }

  // ---- Specifications ---------------------------------------------------------
  sectionTitle("Specifications");

  // Field sets below mirror the columns of the Hardware Inventory tables
  // written by hardware_reports.rs (tbl_pulse_system_info, tbl_pulse_cpu_info,
  // tbl_pulse_memory_info, tbl_pulse_storage_info, tbl_pulse_battery_info,
  // tbl_pulse_network_info, tbl_pulse_display_info, tbl_pulse_gpu_info,
  // tbl_pulse_camera_info, tbl_pulse_audio_info) so every captured detail
  // shows up here, not just a trimmed subset.

  subTitle("System");
  zebraRows([
    ["Manufacturer", sys.manufacturer],
    ["Model", sys.model],
    ["Serial Number", sys.serial_number, true],
    ["System UUID", sys.uuid],
    ["Board Serial", sys.board_serial],
    ["BIOS Version", sys.bios_version || bios.version],
  ]);

  subTitle("Processor");
  zebraRows([
    ["Processor", cpu.model],
    ["Vendor", cpu.manufacturer],
    ["Architecture", cpu.architecture],
    ["Sockets", cpu.sockets],
    ["Cores per Socket", cpu.cores_per_socket],
    ["Threads", cpu.threads],
    ["Max Speed", cpu.max_speed_mhz ? `${cpu.max_speed_mhz} MHz` : "-"],
    ["Min Speed", cpu.min_speed_mhz ? `${cpu.min_speed_mhz} MHz` : "-"],
    ["Current Speed", cpu.current_speed_mhz ? `${cpu.current_speed_mhz} MHz` : "-"],
    ["Cache L1", cpu.cache_l1],
    ["Cache L2", cpu.cache_l2],
    ["Cache L3", cpu.cache_l3],
    ["Virtualization", cpu.virtualization != null ? (cpu.virtualization ? "Yes" : "No") : "-"],
    ["Hyper-Threading", cpu.hyper_threading != null ? (cpu.hyper_threading ? "Yes" : "No") : "-"],
  ]);

  subTitle("Memory");
  zebraRows([
    ["Total Installed", mem.length ? `${totalMemGb.toFixed(1)} GB` : "-"],
    ["Type", memType],
    ["Modules", mem.length || "-"],
  ]);
  mem.forEach((m, i) => {
    if (m?.is_empty) return;
    subTitle(`Memory Module ${i + 1}`);
    zebraRows([
      ["Slot", m.slot],
      ["Bank Locator", m.bank_locator],
      ["Size", m.size_mb != null ? `${(m.size_mb / 1024).toFixed(1)} GB` : "-"],
      ["Type", m.memory_type],
      ["Manufacturer", m.manufacturer],
      ["Serial", m.serial, true],
      ["Part Number", m.part_number],
      ["Speed", m.speed_mhz ? `${m.speed_mhz} MHz` : "-"],
      ["Onboard", m.is_onboard ? "Yes" : "No"],
    ]);
  });

  subTitle("Storage");
  zebraRows([
    ["Drives", storage.length || "-"],
  ]);
  storage.forEach((d, i) => {
    subTitle(storage.length > 1 ? `Storage Drive ${i + 1}` : "Storage Drive");
    zebraRows([
      ["Device", d.device],
      ["Slot", d.slot],
      ["Model", d.model],
      ["Serial", d.serial, true],
      ["Firmware", d.firmware],
      ["Transport", d.transport],
      ["Type", d.storage_type],
      // Prefer a backend-supplied marketed capacity (capacity_gb) if present;
      // otherwise normalize the raw binary GiB figure into the manufacturer
      // capacity label (e.g. a 256GB drive reports ~238 GiB raw, which
      // normalizeCapacity snaps back to "256 GB") -- mirrors the same logic
      // already used on the System Scan and Hardware Inventory screens.
      ["Capacity", d.capacity_gb || (d.size_gb != null ? normalizeCapacity(d.size_gb) : "-"), true],
      ["Health", d.health_percent != null ? `${d.health_percent}%` : "-", true],
      ["Temperature", d.temperature_c != null ? `${d.temperature_c} °C` : "-"],
      ["Power-On Hours", d.power_on_hours],
      ["Power Cycles", d.power_cycles],
      ["Media Errors", d.media_errors],
      ["Critical Warning", d.critical_warning],
    ]);
  });

  subTitle("Motherboard");
  zebraRows([
    ["BIOS Version", sys.bios_version || bios.version],
    ["BIOS Vendor", bios.vendor],
    ["BIOS Date", bios.release_date],
    ["Board Serial", sys.board_serial],
  ]);

  subTitle("Network");
  zebraRows([
    ["WiFi Adapter", net.wifi],
    ["WiFi", net.wifi_friendly],
    ["WiFi MAC", net.wifi_mac, true],
    ["Ethernet Adapter", net.ethernet],
    ["Ethernet", net.ethernet_friendly],
    ["Ethernet MAC", net.ethernet_mac, true],
  ]);

  subTitle("Audio");
  zebraRows([
    ["Codec", audio.codec],
    ["Speakers", audio.speaker_type],
    ["Mic", audio.mic_type],
    ["Jack Type", audio.jack_type],
  ]);

  subTitle("Battery");
  zebraRows([
    ["Manufacturer", batt.manufacturer],
    ["Model", batt.model],
    ["Serial", batt.serial_number],
    ["Technology", batt.technology],
    ["Status", batt.status],
    ["Cycle Count", batt.cycle_count],
    ["Design Capacity", batt.design_capacity_mwh != null ? `${batt.design_capacity_mwh} mWh` : "-"],
    [
      "Full Charge Capacity",
      batt.full_charge_capacity_mwh != null ? `${batt.full_charge_capacity_mwh} mWh` : "-",
    ],
    [
      "Current Capacity",
      batt.current_capacity_mwh != null ? `${batt.current_capacity_mwh} mWh` : "-",
    ],
    ["Voltage", batt.voltage_mv != null ? `${batt.voltage_mv} mV` : "-"],
    ["Health", run.battery_health != null ? `${run.battery_health}%` : "-", true],
  ]);

  subTitle("Bluetooth");
  zebraRows([["Bluetooth", net.bluetooth ? "Yes" : "No"]]);

  subTitle("Display");
  zebraRows([
    ["Manufacturer", disp.manufacturer],
    ["Model", disp.model],
    ["Panel Part Number", disp.panel_part_number],
    ["Resolution", disp.resolution],
    ["Size", disp.size_inches != null ? `${disp.size_inches}"` : "-"],
  ]);

  subTitle("Graphics");
  if (gpu.length) {
    gpu.forEach((g, i) => {
      if (gpu.length > 1) subTitle(`GPU ${i + 1}`);
      zebraRows([
        ["Vendor", g.vendor],
        ["Model", g.model],
        ["Bus Address", g.bus_address],
        ["Driver", g.driver],
        ["VRAM", g.vram],
        ["Output Resolution", g.output_resolution],
      ]);
    });
  } else {
    zebraRows([["GPU", "-"]]);
  }

  subTitle("Webcam");
  zebraRows([
    ["Vendor", cam.vendor],
    ["Model", cam.model],
    ["Device", cam.device],
    ["Status", cam.status],
  ]);

  // ---- Footer on every page ---------------------------------------------------
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...COLOR.border);
    doc.setLineWidth(0.5);
    doc.line(marginX, footerY - 10, pageWidth - marginX, footerY - 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...COLOR.muted);
    doc.text("Generated by Casterly PULSE USB Report - System Test Report", marginX, footerY);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - marginX, footerY, { align: "right" });
  }

  return new Uint8Array(doc.output("arraybuffer"));
}
