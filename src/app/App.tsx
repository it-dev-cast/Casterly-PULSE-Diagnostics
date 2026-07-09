import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import {
  WorkflowSidebar,
  defaultStages,
  WorkflowStage,
  StageStatus,
} from "./components/WorkflowSidebar";
import { SummaryPanel } from "./components/SummaryPanel";
import { SystemScan } from "./components/screens/SystemScan";
import { HardwareInventory } from "./components/screens/HardwareInventory";
import { ManualGrading } from "./components/screens/ManualGrading";
import { SpeakerTest } from "./components/screens/SpeakerTest";
import { WebcamTest } from "./components/screens/WebcamTest";
import { KeyboardTest } from "./components/screens/KeyboardTest";
import { TouchpadTest } from "./components/screens/TouchpadTest";
import { BatteryAssessment } from "./components/screens/BatteryAssessment";
import { FinalReview } from "./components/screens/FinalReview";
import { InspectionComplete } from "./components/screens/InspectionComplete";
import { InspectionHistory } from "./components/screens/InspectionHistory";
import { StartupHome } from "./components/screens/StartupHome";
import { InspectorManagement } from "./components/screens/InspectorManagement";
import { LOTManagement } from "./components/screens/LOTManagement";
import { ActiveLOTSummary } from "./components/screens/ActiveLOTSummary";
import { UploadQueue } from "./components/screens/UploadQueue";
import { SyncStatus } from "./components/screens/SyncStatus";
import { InspectionManager } from "./components/screens/InspectionManager";
import { DuplicateDetection } from "./components/screens/DuplicateDetection";
import { InspectionSaveConfirmation } from "./components/screens/InspectionSaveConfirmation";
import { ClyNumberModal } from "./components/ClyNumberModal";
import { useInspection } from "./context/InspectionContext";
import { buildInspectionRun } from "./lib/report";
import { buildInspectionPdf, buildExportFilename, uint8ToBase64 } from "./lib/pdf";
import { message } from "@tauri-apps/plugin-dialog";

const STAGE_ORDER = [
  "system-scan",
  "hardware-inventory",
  "manual-grading",
  "speaker-test",
  "webcam-test",
  "keyboard-test",
  "touchpad-test",
  "battery-assessment",
  "final-review",
  "inspection-complete",
];

export default function App() {
  const { data, resetInspection } = useInspection();
  const [currentScreen, setCurrentScreen] =
    useState<string>("startup-home");
  // Holds the assembled inspection payload when a duplicate is detected, so the
  // InspectionSaveConfirmation "Save Anyway" action can persist it.
  const [pendingSave, setPendingSave] = useState<{
    lotName: string;
    inspector: string;
    jsonData: string;
  } | null>(null);
  // The saved inspection record shown on the InspectionComplete screen (PRD §322).
  const [completedInfo, setCompletedInfo] = useState<{
    uuid: string;
    timestamp: string;
    lotName: string;
    inspector: string;
    serial: string;
    deviceModel: string;
    grade: string;
  } | null>(null);
  const [stages, setStages] =
    useState<WorkflowStage[]>(defaultStages);
  const [showSummaryDrawer, setShowSummaryDrawer] =
    useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] =
    useState(true);
  const [workflowStage, setWorkflowStage] =
  useState<string | null>(null);
  const [screenWidth, setScreenWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1920,
  );
  const [session, setSession] = useState<{
    lotName: string;
    inspectorName: string;
  }>({ lotName: "", inspectorName: "" });
  // Mandatory CLY Number (e.g. "CLY-1234"), captured fresh for every
  // inspection via ClyNumberModal before the workflow is allowed to start.
  const [clyNo, setClyNo] = useState<string>("");
  const [showClyModal, setShowClyModal] = useState(false);
  // Real activity log for the Progress Metrics panel (replaces mock timeline
  // entries). Populated as stages actually complete, with real timestamps.
  const [activityLog, setActivityLog] = useState<
    { label: string; time: number }[]
  >([]);

  const refreshSession = useCallback(async () => {
    try {
      const s = await invoke<{ lotName: string; inspectorName: string }>(
        "get_session",
      );
      setSession(s);
    } catch (err) {
      console.error("Failed to load session:", err);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  // Kiosk mode: the window itself is fullscreen/borderless/skip-taskbar
  // (configured in tauri.conf.json + reasserted in Rust setup()), but the
  // WebView still passes through browser-level shortcuts and the right-click
  // context menu unless we block them here. Alt+F4 is intentionally left
  // untouched as an escape hatch for technicians.
  useEffect(() => {
    const blockContextMenu = (e: MouseEvent) => e.preventDefault();
    const blockKeys = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const blocked =
        key === "f5" ||
        key === "f12" ||
        key === "f11" ||
        ((e.ctrlKey || e.metaKey) && key === "r") ||
        ((e.ctrlKey || e.metaKey) && key === "p") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (key === "i" || key === "j" || key === "c"));
      if (blocked) e.preventDefault();
    };

    document.addEventListener("contextmenu", blockContextMenu);
    document.addEventListener("keydown", blockKeys);

    return () => {
      document.removeEventListener("contextmenu", blockContextMenu);
      document.removeEventListener("keydown", blockKeys);
    };
  }, []);

  const handleSelectLOT = async (id: string) => {
    try {
      await invoke("select_lot", { id: Number(id) });
      await refreshSession();
    } catch (err) {
      console.error("Failed to select LOT:", err);
    }
    setCurrentScreen("startup-home");
  };

  const handleSelectInspector = async (id: string) => {
    try {
      await invoke("select_inspector", { id: Number(id) });
      await refreshSession();
    } catch (err) {
      console.error("Failed to select inspector:", err);
    }
    setCurrentScreen("startup-home");
  };

  const handleSyncNow = async () => {
    try {
      await invoke("sync_now");
    } catch (err) {
      console.error("Sync failed:", err);
    }
    setCurrentScreen("sync-status");
  };

  // Assemble the InspectionRun payload (PRD §11.6) from the inspection context.
  // uuid / usb_id / inspector / lot_name / timestamp / uploaded are injected by
  // the Rust save_inspection command.
  const buildInspectionPayload = (): string => {
    const g = data.grading;
    const up = (v: string | null) =>
      v === "pass" ? "PASS" : v === "fail" ? "FAIL" : "PENDING";

    const batteryHealth =
      data.batteryInfo && data.batteryInfo.design_capacity_mwh > 0
        ? Number(
            (
              (data.batteryInfo.full_charge_capacity_mwh /
                data.batteryInfo.design_capacity_mwh) *
              100
            ).toFixed(2),
          )
        : null;

    return JSON.stringify({
      battery_health: batteryHealth,
      grading: {
        lcd_status: up(g.grades.lcd),
        lcd_defects: g.selectedDefects.lcd || [],
        top_cover_status: up(g.grades.topCover),
        top_cover_defects: g.selectedDefects.topCover || [],
        bezel_status: up(g.grades.bezel),
        bezel_defects: g.selectedDefects.bezel || [],
        palmrest_status: up(g.grades.palmrest),
        palmrest_defects: g.selectedDefects.palmrest || [],
        bottom_cover_status: up(g.grades.bottomCover),
        bottom_cover_defects: g.selectedDefects.bottomCover || [],
        keyboard_status: up(g.grades.keyboard),
        keyboard_defects: g.selectedDefects.keyboard || [],
        touchpad_status: up(g.grades.touchpad),
        remarks: g.remarks,
      },
      speaker_test: { result: up(data.speakerTest.result) },
      webcam_test: { result: up(data.webcamTest.result) },
      keyboard_test: {
        result: up(data.keyboardTest.result),
        unique_keys: data.keyboardTest.pressed?.length || 0,
      },
      touchpad_test: { result: up(data.touchpadTest.result) },
      battery_assessment: { result: up(data.batteryAssessment.result) },
      inventory: {
        system: data.systemInfo,
        cpu: data.cpuInfo,
        memory: data.memoryInfo,
        storage: data.storageInfo,
        battery: data.batteryInfo,
        bios: (data as any).biosInfo,
        gpu: data.gpuInfo,
        display: data.displayInfo,
        network: data.networkInfo,
        audio: data.audioInfo,
        camera: data.cameraInfo,
      },
    });
  };

  // Final grade (PRD §322): C if any component fails, A if all pass, else B.
  const computeGrade = (): string => {
    const grades = Object.values(data.grading.grades);
    if (grades.some((g) => g === "fail")) return "C";
    if (grades.length > 0 && grades.every((g) => g === "pass")) return "A";
    return "B";
  };

  // Persist a payload, record the saved details, and route to InspectionComplete.
  const persistInspection = async (info: {
    lotName: string;
    inspector: string;
    jsonData: string;
  }) => {
    const result = await invoke<{ uuid: string; timestamp: string }>(
      "save_inspection",
      {
        lotName: info.lotName,
        inspector: info.inspector,
        clyNo,
        jsonData: info.jsonData,
        uuid: data.uuid,
      },
    );
    const grade = computeGrade();
    setCompletedInfo({
      uuid: result.uuid,
      timestamp: result.timestamp,
      lotName: info.lotName,
      inspector: info.inspector,
      serial: data.systemInfo?.serial_number || "",
      deviceModel: data.systemInfo?.model || "",
      grade,
    });
    setPendingSave(null);

    // Export a JSON + PDF copy of this inspection to the pendrive, and
    // best-effort upload both files to Supabase Storage (bucket "PULSE").
    // Shows a confirmation message depending on which destinations succeeded.
    try {
      const run = buildInspectionRun(data, info.lotName, info.inspector, grade, clyNo);
      run.uuid = result.uuid;
      run.timestamp = result.timestamp;
      const pdfBytes = await buildInspectionPdf(run);
      const pdfBase64 = uint8ToBase64(pdfBytes);
      const fileBaseName = buildExportFilename(run).replace(/\.pdf$/i, "");

      const exportResult = await invoke<{
        jsonSaved: boolean;
        pdfSaved: boolean;
        localSaved: boolean;
        cloudUploaded: boolean;
        error?: string | null;
      }>("export_inspection_files", {
        uuid: result.uuid,
        pdfBase64,
        fileBaseName,
      });

      console.log("Export result:", exportResult);

      // Check the PDF pendrive write FIRST and independently of everything
      // else. Previously a successful Supabase upload (which uploads the PDF
      // bytes straight from memory, not from the local file) would show a
      // blanket "saved successfully" message even when the local PDF write
      // had actually failed -- silently hiding a missing pendrive copy. Now
      // a PDF write failure is always reported, regardless of cloud status.
      if (!exportResult.pdfSaved) {
        await message(
          `Inspection saved, but the PDF was NOT saved to the pendrive's exports folder.${
            exportResult.error ? `\n\nReason: ${exportResult.error}` : ""
          }`,
          { title: "PDF Not Saved to Pendrive", kind: "warning" },
        );
      } else if (exportResult.cloudUploaded) {
        await message("Inspection saved and exported successfully to the server", {
          title: "Inspection Saved",
          kind: "info",
        });
      } else if (exportResult.localSaved) {
        await message("Inspection saved in the Pendrive successfully", {
          title: "Inspection Saved",
          kind: "info",
        });
      } else {
        await message(
          "Inspection saved, but exporting the JSON/PDF copy failed. Please check the USB drive and try again.",
          { title: "Inspection Saved", kind: "warning" },
        );
      }
    } catch (err) {
      console.error("Export to file failed:", err);
      await message("Inspection saved, but export failed: " + err, {
        title: "Inspection Saved",
        kind: "warning",
      });
    }

    // Mark the "Final Review" stage as passed in the sidebar (green check),
    // same as every other stage does when it completes. This screen doesn't
    // go through advanceStageAndView like the others, so it needs an explicit
    // call here — otherwise it stays stuck on the blue "active" spinner even
    // though the inspection has actually been saved.
    advanceStage("final-review");
    // advanceStage("final-review") flips "Inspection Complete" from pending to
    // active (it's the next stage in STAGE_ORDER), but nothing ever marks it
    // passed since it's the last stage and no further screen calls
    // advanceStage for it. Do that explicitly here so its sidebar entry also
    // gets the green checkmark once we actually land on this screen.
    advanceStage("inspection-complete");

    setCurrentScreen("inspection-complete");

    // Best-effort: push the saved inspection (incl. full System Scan) to Supabase.
    invoke("sync_now")
      .then((r) => console.log("Sync result:", r))
      .catch((err) => console.error("Sync failed (will retry from queue):", err));
  };

  // FinalReview "Save & Complete": run duplicate detection, then either route to
  // the confirmation screen (duplicate) or save and go to InspectionComplete.
  const handleFinalReviewComplete = async () => {
    const serial = data.systemInfo?.serial_number || "";
    let lotName = "";
    let inspector = "";
    try {
      const s = await invoke<{ lotName: string; inspectorName: string }>(
        "get_session",
      );
      lotName = s.lotName;
      inspector = s.inspectorName;
    } catch (err) {
      console.error("Failed to load session:", err);
    }

    const jsonData = buildInspectionPayload();

    try {
      const duplicate = serial
        ? await invoke<boolean>("check_duplicate", {
            serialNumber: serial,
            lotName,
          })
        : false;

      if (duplicate) {
        setPendingSave({ lotName, inspector, jsonData });
        setCurrentScreen("inspection-save-confirmation");
        return;
      }

      await persistInspection({ lotName, inspector, jsonData });
    } catch (err) {
      console.error("Failed to save inspection:", err);
      await message(`Failed to save inspection: ${err}`, {
        title: "Save Failed",
        kind: "error",
      });
    }
  };

  // InspectionSaveConfirmation "Save Anyway": persist the pending payload.
  const handleSaveAnyway = async () => {
    const payload =
      pendingSave ?? {
        lotName: "",
        inspector: "",
        jsonData: buildInspectionPayload(),
      };
    try {
      await persistInspection(payload);
    } catch (err) {
      console.error("Failed to save inspection:", err);
      await message(`Failed to save inspection: ${err}`, {
        title: "Save Failed",
        kind: "error",
      });
    }
  };

  // FinalReview "Save Draft": persist the current inspection and return home,
  // skipping the completion screen.
  const handleSaveDraft = async () => {
    let lotName = "";
    let inspector = "";
    try {
      const s = await invoke<{ lotName: string; inspectorName: string }>(
        "get_session",
      );
      lotName = s.lotName;
      inspector = s.inspectorName;
    } catch (err) {
      console.error("Failed to load session:", err);
    }
    try {
      await invoke<{ uuid: string; timestamp: string }>("save_inspection", {
        lotName,
        inspector,
        clyNo,
        jsonData: buildInspectionPayload(),
        uuid: data.uuid,
      });
      setCurrentScreen("startup-home");
    } catch (err) {
      console.error("Failed to save draft:", err);
      alert(`Failed to save draft: ${err}`);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
    };
    window.addEventListener("resize", handleResize);
    return () =>
      window.removeEventListener("resize", handleResize);
  }, []);

  // Determine layout mode based on screen width
  const layoutMode =
    screenWidth < 1600
      ? "compact"
      : screenWidth < 1920
        ? "standard"
        : "full";

  const advanceStage = (currentId: string) => {
    const idx = STAGE_ORDER.indexOf(currentId);
    const nextId = STAGE_ORDER[idx + 1];
    let didAdvance = false;

    setStages((prev) => {
      const current = prev.find((s) => s.id === currentId);
      // Only advance if this stage is currently the active one. This guards
      // against re-triggering when the user navigates back to a completed stage
      // or when an effect fires on a re-mount.
      if (!current || current.status !== "active") {
        return prev;
      }

      didAdvance = true;
      return prev.map((s) => {
        if (s.id === currentId)
          return { ...s, status: "passed" as StageStatus };
        if (s.id === nextId && s.status === "pending")
          return { ...s, status: "active" as StageStatus };
        return s;
      });
    });

    if (nextId && didAdvance) {
      setWorkflowStage(nextId);
    }

    if (didAdvance) {
      const label =
        defaultStages.find((s) => s.id === currentId)?.label ?? currentId;
      setActivityLog((prev) => [
        ...prev,
        { label: `${label} Passed`, time: Date.now() },
      ]);
    }
  };

  // For stages that run automatically, advance both execution state and view.
  const advanceStageAndView = (currentId: string) => {
    const idx = STAGE_ORDER.indexOf(currentId);
    const nextId = STAGE_ORDER[idx + 1];
    advanceStage(currentId);
    if (nextId) {
      setCurrentScreen(nextId);
    }
  };

  // Guards against jumping ahead to a stage that hasn't been reached yet
  // (the sidebar already disables "pending" stage buttons, but this is a
  // second line of defense for any other caller of goToStage). A stage is
  // fair game once it's "active" (in progress) or further along.
  const goToStage = (id: string) => {
    const stage = stages.find((s) => s.id === id);
    if (stage && stage.status === "pending") {
      alert("Complete the previous steps first.");
      return;
    }
    setCurrentScreen(id);
  };

  const goToHistory = () => {
    setCurrentScreen("inspection-history");
  };

  // Both "Start New Inspection" (Active LOT summary) and "New Inspection"
  // (completion screen) call this. It no longer jumps straight into the
  // workflow — a mandatory CLY Number must be entered first via
  // ClyNumberModal (see beginInspection below).
  const startInspection = () => {
    setShowClyModal(true);
  };

  // Runs once the CLY Number has been entered and confirmed. Wipes all
  // per-device inspection data (scan results, grading, test results, etc.)
  // back to the same blank state as a fresh app launch, so neither entry
  // point can leak the previous device's values into the new one.
  const beginInspection = (enteredClyNo: string) => {
    setClyNo(enteredClyNo);
    setShowClyModal(false);
    resetInspection();

    setStages(
      defaultStages.map((s, i) => ({
        ...s,
        status:
          i === 0
            ? ("active" as StageStatus)
            : ("pending" as StageStatus),
      })),
    );
    setActivityLog([{ label: "Inspection Started", time: Date.now() }]);
    setWorkflowStage("system-scan");
    setCurrentScreen("system-scan");
  };

  const passed = stages.filter(
    (s) => s.status === "passed",
  ).length;
  const failed = stages.filter(
    (s) => s.status === "failed",
  ).length;
  const completionPct = Math.round(
    (passed / stages.length) * 100,
  );
  const remaining = stages.filter(
    (s) => s.status === "pending",
  ).length;

  // Real alerts derived from the live inspection data (replaces mock list).
  const gradeLabels: Record<string, string> = {
    lcd: "LCD",
    topCover: "Top Cover",
    bezel: "Bezel",
    palmrest: "Palmrest",
    bottomCover: "Bottom Cover",
    keyboard: "Keyboard",
    touchpad: "Touchpad",
  };

  const alerts: { type: "warning" | "error" | "info"; message: string }[] = (() => {
    const list: { type: "warning" | "error" | "info"; message: string }[] = [];

    const batt = data.batteryInfo as any;
    const battHealth =
      batt && batt.design_capacity_mwh > 0
        ? Math.round(
            (batt.full_charge_capacity_mwh / batt.design_capacity_mwh) * 100,
          )
        : null;
    if (battHealth != null && battHealth < 80) {
      list.push({
        type: "warning",
        message: `Battery health at ${battHealth}%, below 80% threshold`,
      });
    }

    if (data.scanCompleted) {
      list.push({ type: "info", message: "System scan complete" });
    }

    Object.entries(data.grading.grades).forEach(([key, value]) => {
      if (value === "fail") {
        list.push({
          type: "warning",
          message: `${gradeLabels[key] || key} failed cosmetic grading`,
        });
      }
    });

    const testResults: { label: string; result: string | null }[] = [
      { label: "Speaker test", result: data.speakerTest.result },
      { label: "Webcam test", result: data.webcamTest.result },
      { label: "Keyboard test", result: data.keyboardTest.result },
      { label: "Touchpad test", result: data.touchpadTest.result },
      { label: "Battery assessment", result: data.batteryAssessment.result },
    ];
    testResults.forEach(({ label, result }) => {
      if (result === "fail") {
        list.push({ type: "error", message: `${label} failed` });
      }
    });

    return list;
  })();

  const renderScreen = () => {
    switch (currentScreen) {
      case "startup-home":
        return (
          <StartupHome
            onContinueLOT={() =>
              setCurrentScreen("active-lot-summary")
            }
            onCreateLOT={() =>
              setCurrentScreen("lot-management")
            }
            onChangeInspector={() =>
              setCurrentScreen("inspector-management")
            }

            onUploadQueue={() =>
              setCurrentScreen("upload-queue")
            }
            onSettings={() => {}}
            onSyncNow={handleSyncNow}
          />
        );
      case "inspector-management":
        return (
          <InspectorManagement
            onSelectInspector={handleSelectInspector}
          />
        );
      case "lot-management":
        return (
          <LOTManagement
            onSelectLOT={handleSelectLOT}
          />
        );
      case "active-lot-summary":
        return (
          <ActiveLOTSummary
            onStartInspection={startInspection}
            onViewHistory={goToHistory}
            onViewUploadQueue={() =>
              setCurrentScreen("upload-queue")
            }
          />
        );
      case "upload-queue":
        return <UploadQueue />;
      case "sync-status":
        return <SyncStatus />;
      case "inspection-manager":
        return <InspectionManager />;
      case "duplicate-detection":
        return <DuplicateDetection />;
      case "inspection-save-confirmation":
        return (
          <InspectionSaveConfirmation
            onSave={handleSaveAnyway}
            onSaveDraft={() => setCurrentScreen("startup-home")}
            onCancel={() => setCurrentScreen("final-review")}
          />
        );
      case "inspection-history":
        return <InspectionHistory />;
      case "system-scan":
        return (
          <SystemScan
            onNext={() => advanceStageAndView("system-scan")}
            isExecutionActive={currentScreen === workflowStage}
          />
        );
      case "hardware-inventory":
        return (
          <HardwareInventory
            onNext={() => advanceStageAndView("hardware-inventory")}
            isExecutionActive={currentScreen === workflowStage}
          />
        );
      case "manual-grading":
        return (
          <ManualGrading
            onNext={() => advanceStageAndView("manual-grading")}
          />
        );
      case "speaker-test":
        return (
          <SpeakerTest
            onNext={() => advanceStageAndView("speaker-test")}
          />
        );
      case "webcam-test":
        return (
          <WebcamTest
            onNext={() => advanceStageAndView("webcam-test")}
          />
        );
      case "keyboard-test":
        return (
          <KeyboardTest
            onNext={() => advanceStageAndView("keyboard-test")}
          />
        );
      case "touchpad-test":
        return (
          <TouchpadTest
            onNext={() => advanceStageAndView("touchpad-test")}
          />
        );
      case "battery-assessment":
        return (
          <BatteryAssessment
            onNext={() => advanceStageAndView("battery-assessment")}
          />
        );
      case "final-review":
        return (
          <FinalReview
            onComplete={handleFinalReviewComplete}
            onSaveDraft={handleSaveDraft}
            clyNo={clyNo}
          />
        );
      case "inspection-complete":
        return (
          <InspectionComplete
            uuid={completedInfo?.uuid}
            timestamp={completedInfo?.timestamp}
            lotName={completedInfo?.lotName}
            inspector={completedInfo?.inspector}
            serial={completedInfo?.serial}
            deviceModel={completedInfo?.deviceModel}
            grade={completedInfo?.grade}
            onNewInspection={startInspection}
            onHome={() => setCurrentScreen("startup-home")}
          />
        );
      default:
        return (
          <StartupHome
            onContinueLOT={() =>
              setCurrentScreen("active-lot-summary")
            }
            onCreateLOT={() =>
              setCurrentScreen("lot-management")
            }
            onChangeInspector={() =>
              setCurrentScreen("inspector-management")
            }

            onUploadQueue={() =>
              setCurrentScreen("upload-queue")
            }
            onSettings={() => {}}
            onSyncNow={handleSyncNow}
          />
        );
    }
  };

  const showInWorkflow =
    ![
      "startup-home",
      "inspector-management",
      "lot-management",
      "active-lot-summary",
      "upload-queue",
      "sync-status",
      "inspection-manager",
      "inspection-history",
      "duplicate-detection",
    ].includes(currentScreen);

  return (
    <div className="min-h-screen bg-slate-100">
      <Header
        onNavigate={setCurrentScreen}
        currentScreen={currentScreen}
        onSaveDraft={() => {}}
        onSaveInspection={() => {}}
        isInspectionActive={showInWorkflow}
        lotName={session.lotName}
        inspectorName={session.inspectorName}
      />

      <WorkflowSidebar
        stages={stages}
        currentStage={currentScreen}
        onStageClick={goToStage}
        completionPct={completionPct}
        estimatedRemaining={`${Math.max(0, remaining * 3)}m`}
        onNavigate={setCurrentScreen}
      />

      {/* Main content with responsive padding */}
      <main
        className={`pt-16 pl-64 pb-8 min-h-screen transition-all duration-300 ${
          layoutMode === "compact"
            ? "pr-0"
            : layoutMode === "standard"
              ? rightPanelCollapsed
                ? "pr-10"
                : "pr-[280px]"
              : "pr-64"
        }`}
      >
        <div className="p-6">{renderScreen()}</div>
      </main>

      <Footer />

      {/* Summary Panel with responsive behavior */}
      {showInWorkflow && layoutMode === "full" && (
        <div className="fixed right-0 top-16 bottom-0 w-64 z-40">
          <SummaryPanel
            completionPct={completionPct}
            passed={passed}
            failed={failed}
            remaining={remaining}
            alerts={alerts}
            elapsedTime="00:22"
            currentStage={currentScreen}
            activityLog={activityLog}
          />
        </div>
      )}

      {/* Standard mode - Collapsible panel */}
      {showInWorkflow && layoutMode === "standard" && (
        <div
          className={`fixed right-0 top-16 bottom-8 bg-white border-l border-slate-200 z-40 transition-all duration-300 ${
            rightPanelCollapsed ? "w-10" : "w-[280px]"
          }`}
        >
          <button
            onClick={() =>
              setRightPanelCollapsed(!rightPanelCollapsed)
            }
            className="absolute left-2 top-4 p-1.5 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
            title={
              rightPanelCollapsed
                ? "Expand panel"
                : "Collapse panel"
            }
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              className={`transition-transform ${rightPanelCollapsed ? "rotate-180" : ""}`}
            >
              <path
                d="M8 2L4 6L8 10"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {!rightPanelCollapsed && (
            <SummaryPanel
              completionPct={completionPct}
              passed={passed}
              failed={failed}
              remaining={remaining}
              alerts={alerts}
              elapsedTime="00:22"
              currentStage={currentScreen}
              activityLog={activityLog}
            />
          )}
        </div>
      )}

      {/* Compact mode - Summary button and drawer */}
      {showInWorkflow && layoutMode === "compact" && (
        <>
          <button
            onClick={() => setShowSummaryDrawer(true)}
            className="fixed top-16 right-4 z-40 flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-2 rounded-lg shadow-lg transition-colors"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
            >
              <path
                d="M1 7H13M1 3H13M1 11H13"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            Inspection Summary
          </button>

          {/* Slide-out drawer */}
          {showSummaryDrawer && (
            <>
              <div
                className="fixed inset-0 bg-black/50 z-50"
                onClick={() => setShowSummaryDrawer(false)}
              />
              <div className="fixed right-0 top-0 bottom-0 w-80 bg-white shadow-xl z-50 animate-slide-in-right">
                <div className="flex items-center justify-between p-4 border-b border-slate-200">
                  <h3 className="text-slate-800">
                    Inspection Summary
                  </h3>
                  <button
                    onClick={() => setShowSummaryDrawer(false)}
                    className="p-1 hover:bg-slate-100 rounded transition-colors"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                    >
                      <path
                        d="M4 4L12 12M12 4L4 12"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
                <div style={{ height: "calc(100% - 57px)" }}>
                  <SummaryPanel
                    completionPct={completionPct}
                    passed={passed}
                    failed={failed}
                    remaining={remaining}
                    alerts={alerts}
                    elapsedTime="00:22"
                    currentStage={currentScreen}
                    activityLog={activityLog}
                  />
                </div>
              </div>
            </>
          )}
        </>
      )}

      <ClyNumberModal
        open={showClyModal}
        onConfirm={beginInspection}
        onCancel={() => setShowClyModal(false)}
      />
    </div>
  );
}
