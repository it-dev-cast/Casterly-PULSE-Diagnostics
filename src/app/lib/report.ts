// Builds a printable HTML inspection report and prints it via a hidden iframe,
// which opens the system print dialog (choose "Save as PDF"). Used by Final
// Review (Export PDF) and Inspection Complete (Download Report).

type AnyObj = Record<string, any>;

function esc(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function row(label: string, value: unknown): string {
  return `<tr><td class="k">${esc(label)}</td><td class="v">${esc(value)}</td></tr>`;
}

function section(title: string, rowsHtml: string): string {
  return `<div class="card"><h2>${esc(title)}</h2><table>${rowsHtml}</table></div>`;
}

/** Assemble an InspectionRun-shaped object from the InspectionContext data. */
export function buildInspectionRun(
  data: AnyObj,
  lotName: string,
  inspector: string,
  grade: string,
): AnyObj {
  const g = data.grading || { grades: {}, selectedDefects: {} };
  const up = (v: string | null) =>
    v === "pass" ? "PASS" : v === "fail" ? "FAIL" : "PENDING";
  const batt = data.batteryInfo;
  const batteryHealth =
    batt && batt.design_capacity_mwh > 0
      ? Number(
          ((batt.full_charge_capacity_mwh / batt.design_capacity_mwh) * 100).toFixed(2),
        )
      : null;

  return {
    lot_name: lotName,
    inspector,
    grade,
    timestamp: new Date().toLocaleString(),
    battery_health: batteryHealth,
    grading: {
      lcd_status: up(g.grades?.lcd),
      lcd_defects: g.selectedDefects?.lcd || [],
      top_cover_status: up(g.grades?.topCover),
      top_cover_defects: g.selectedDefects?.topCover || [],
      bezel_status: up(g.grades?.bezel),
      bezel_defects: g.selectedDefects?.bezel || [],
      palmrest_status: up(g.grades?.palmrest),
      palmrest_defects: g.selectedDefects?.palmrest || [],
      bottom_cover_status: up(g.grades?.bottomCover),
      bottom_cover_defects: g.selectedDefects?.bottomCover || [],
      keyboard_status: up(g.grades?.keyboard),
      keyboard_defects: g.selectedDefects?.keyboard || [],
      touchpad_status: up(g.grades?.touchpad),
      remarks: g.remarks || "",
    },
    speaker_test: { result: up(data.speakerTest?.result) },
    webcam_test: { result: up(data.webcamTest?.result) },
    keyboard_test: { result: up(data.keyboardTest?.result) },
    touchpad_test: { result: up(data.touchpadTest?.result) },
    battery_assessment: { result: up(data.batteryAssessment?.result) },
    inventory: {
      system: data.systemInfo,
      cpu: data.cpuInfo,
      memory: data.memoryInfo,
      storage: data.storageInfo,
      battery: data.batteryInfo,
      bios: data.biosInfo,
      gpu: data.gpuInfo,
      display: data.displayInfo,
      network: data.networkInfo,
      audio: data.audioInfo,
      camera: data.cameraInfo,
    },
  };
}

export function buildReportHtml(run: AnyObj): string {
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

  const totalMemGb =
    mem.reduce((s, m) => s + (m?.size_mb || 0), 0) / 1024;
  const memType = mem.find((m) => !m?.is_empty)?.memory_type;
  const drive = storage[0] || {};

  const gradeRow = (label: string, status: unknown, defects?: any[]) => {
    const d = defects && defects.length ? ` (${defects.map(esc).join(", ")})` : "";
    return `<tr><td class="k">${esc(label)}</td><td class="v">${esc(status)}${d}</td></tr>`;
  };

  const meta = section(
    "Inspection",
    row("UUID", run.uuid) +
      row("Timestamp", run.timestamp) +
      row("LOT", run.lot_name) +
      row("Inspector", run.inspector) +
      row("Grade", run.grade ? `Grade ${run.grade}` : "—") +
      row(
        "Battery Health",
        run.battery_health != null ? `${run.battery_health}%` : "—",
      ),
  );

  const system = section(
    "System",
    row("Manufacturer", sys.manufacturer) +
      row("Model", sys.model) +
      row("Serial", sys.serial_number) +
      row("UUID", sys.uuid) +
      row("Board Serial", sys.board_serial) +
      row("BIOS Version", sys.bios_version || bios.version),
  );

  const cpuSec = section(
    "CPU",
    row("Processor", cpu.model) +
      row("Vendor", cpu.manufacturer) +
      row("Arch", cpu.architecture) +
      row("Cores / Threads", cpu.cores_per_socket != null ? `${cpu.cores_per_socket} / ${cpu.threads}` : "—") +
      row("Max Speed", cpu.max_speed_mhz ? `${cpu.max_speed_mhz} MHz` : "—"),
  );

  const memorySec = section(
    "Memory",
    row("Installed", mem.length ? `${totalMemGb.toFixed(1)} GB` : "—") +
      row("Type", memType) +
      row("Modules", mem.length || "—"),
  );

  const storageSec = section(
    "Storage",
    row("Type", drive.storage_type) +
      row("Model", drive.model) +
      row("Serial", drive.serial) +
      row("Capacity", drive.size_gb != null ? `${Math.round(drive.size_gb)} GB` : "—") +
      row("Health", drive.health_percent != null ? `${drive.health_percent}%` : "—"),
  );

  const batterySec = section(
    "Battery",
    row("Manufacturer", batt.manufacturer) +
      row("Model", batt.model) +
      row("Serial", batt.serial_number) +
      row("Technology", batt.technology) +
      row("Cycle Count", batt.cycle_count) +
      row("Status", batt.status),
  );

  const displaySec = section(
    "Display",
    row("Manufacturer", disp.manufacturer) +
      row("Model", disp.model) +
      row("Resolution", disp.resolution) +
      row("Size", disp.size_inches != null ? `${disp.size_inches}"` : "—"),
  );

  const gpuSec = section(
    "GPU",
    (gpu.length
      ? gpu.map((x) => row(x.vendor || "GPU", x.model)).join("")
      : row("GPU", "—")),
  );

  const networkSec = section(
    "Network",
    row("WiFi", net.wifi_friendly) +
      row("WiFi MAC", net.wifi_mac) +
      row("Ethernet", net.ethernet_friendly) +
      row("Ethernet MAC", net.ethernet_mac) +
      row("Bluetooth", net.bluetooth ? "Yes" : "No"),
  );

  const audioSec = section(
    "Audio",
    row("Codec", audio.codec) +
      row("Speakers", audio.speaker_type) +
      row("Mic", audio.mic_type),
  );

  const cameraSec = section(
    "Camera",
    row("Model", cam.model) + row("Vendor", cam.vendor) + row("Status", cam.status),
  );

  const gradingSec = section(
    "Cosmetic Grading",
    gradeRow("LCD", grading.lcd_status, grading.lcd_defects) +
      gradeRow("Top Cover", grading.top_cover_status, grading.top_cover_defects) +
      gradeRow("Bezel", grading.bezel_status, grading.bezel_defects) +
      gradeRow("Palmrest", grading.palmrest_status, grading.palmrest_defects) +
      gradeRow("Bottom Cover", grading.bottom_cover_status, grading.bottom_cover_defects) +
      gradeRow("Keyboard", grading.keyboard_status, grading.keyboard_defects) +
      gradeRow("Touchpad", grading.touchpad_status) +
      row("Remarks", grading.remarks),
  );

  const testsSec = section(
    "Functional Tests",
    row("Speaker", run.speaker_test?.result) +
      row("Webcam", run.webcam_test?.result) +
      row("Keyboard", run.keyboard_test?.result) +
      row("Touchpad", run.touchpad_test?.result) +
      row("Battery Assessment", run.battery_assessment?.result),
  );

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Casterly PULSE 4.0 — Inspection Report</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; margin: 24px; }
  .head { border-bottom: 3px solid #2563eb; padding-bottom: 10px; margin-bottom: 16px; }
  .head h1 { margin: 0; font-size: 20px; color: #1e3a8a; }
  .head p { margin: 2px 0 0; font-size: 12px; color: #64748b; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; page-break-inside: avoid; }
  .card h2 { margin: 0 0 6px; font-size: 13px; color: #2563eb; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px 0; font-size: 11px; vertical-align: top; }
  td.k { color: #64748b; width: 45%; }
  td.v { color: #0f172a; font-weight: 600; text-align: right; }
  @media print { body { margin: 12mm; } }
</style></head>
<body>
  <div class="head">
    <h1>Casterly PULSE 4.0 — Inspection Report</h1>
    <p>Refurbishment Inspection · Generated ${esc(new Date().toLocaleString())}</p>
  </div>
  ${meta}
  <div class="grid">
    ${system}${cpuSec}${memorySec}${storageSec}${batterySec}${displaySec}${gpuSec}${networkSec}${audioSec}${cameraSec}
  </div>
  ${gradingSec}
  ${testsSec}
</body></html>`;
}

export function printHtmlReport(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 1500);
  }, 300);
}
