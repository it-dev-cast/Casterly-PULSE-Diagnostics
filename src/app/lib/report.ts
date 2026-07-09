// Assembles the InspectionRun-shaped payload from the live InspectionContext
// data. The actual PDF rendering (and its "Casterly PULSE Report" layout,
// logo, filename convention, etc.) lives in ./pdf.ts — see
// buildInspectionPdf / buildExportFilename / downloadPdf.

type AnyObj = Record<string, any>;

/** Assemble an InspectionRun-shaped object from the InspectionContext data. */
export function buildInspectionRun(
  data: AnyObj,
  lotName: string,
  inspector: string,
  grade: string,
  clyNo: string = "",
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
    cly_no: clyNo,
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
