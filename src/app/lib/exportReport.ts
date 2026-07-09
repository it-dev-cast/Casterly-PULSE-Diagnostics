// Shared "save this inspection's report to disk" action used by every
// user-triggered export button (Final Review "Export PDF", Inspection
// Complete "Download Report", Inspection Manager "Export"). Unlike the
// silent auto-export that runs right after Save & Complete
// (export_inspection_files, which always writes into this USB's own
// "exports" folder), this opens a native "choose a folder" dialog via the
// export_report_files Tauri command so the user can pick any destination,
// and always writes the same styled PDF produced by buildInspectionPdf --
// plus, when requested, an Excel workbook (buildInspectionXlsx) with the
// same content -- into that folder.

import { invoke } from "@tauri-apps/api/core";
import { buildInspectionPdf, buildExportFilename, uint8ToBase64 } from "./pdf";
import { buildInspectionXlsx } from "./xlsx";

type AnyObj = Record<string, any>;

export interface ExportReportOptions {
  /** Also generate and save a .xlsx workbook alongside the .pdf. */
  includeExcel?: boolean;
}

/**
 * Builds the PDF (and optionally the Excel workbook) for `run`, prompts the
 * user for a destination folder, and writes the file(s) there.
 *
 * Returns the chosen folder path, or `null` if the user cancelled the
 * dialog.
 */
export async function exportReportFiles(
  run: AnyObj,
  options: ExportReportOptions = {},
): Promise<string | null> {
  const pdfBytes = await buildInspectionPdf(run);
  const pdfBase64 = uint8ToBase64(pdfBytes);

  let xlsxBase64: string | undefined;
  if (options.includeExcel) {
    const xlsxBytes = buildInspectionXlsx(run);
    xlsxBase64 = uint8ToBase64(xlsxBytes);
  }

  const fileBaseName = buildExportFilename(run).replace(/\.pdf$/i, "");

  return invoke<string | null>("export_report_files", {
    pdfBase64,
    xlsxBase64,
    fileBaseName,
  });
}
