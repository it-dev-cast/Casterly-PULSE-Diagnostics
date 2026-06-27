import { useState, useEffect } from "react";
import { Header } from "./components/Header";
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
import { Toaster } from "./components/ui/sonner";

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
  const [currentScreen, setCurrentScreen] =
    useState<string>("startup-home");
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

    setStages((prev) =>
      prev.map((s) => {
        if (s.id === currentId)
          return { ...s, status: "passed" as StageStatus };
        if (s.id === nextId)
          return { ...s, status: "active" as StageStatus };
        return s;
      }),
    );

    if (nextId) {
      setWorkflowStage(nextId);
      //setIsDashboard(false);
    }
  };

  const goToStage = (id: string) => {
    setCurrentScreen(id);
  };

  const goToHistory = () => {
    setCurrentScreen("inspection-history");
  };

  const startInspection = () => {
    
    setStages(
      defaultStages.map((s, i) => ({
        ...s,
        status:
          i === 0
            ? ("active" as StageStatus)
            : ("pending" as StageStatus),
      })),
    );
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

  const alerts = [
    {
      type: "warning" as const,
      message: "Battery below 80% threshold",
    },
    { type: "info" as const, message: "System scan complete" },
  ];

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
            onSyncNow={() => setCurrentScreen("sync-status")}
          />
        );
      case "inspector-management":
        return (
          <InspectorManagement
            onSelectInspector={() =>
              setCurrentScreen("startup-home")
            }
          />
        );
      case "lot-management":
        return (
          <LOTManagement
            onSelectLOT={() => setCurrentScreen("startup-home")}
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
            onSave={() =>
              setCurrentScreen("inspection-complete")
            }
            onSaveDraft={() => setCurrentScreen("startup-home")}
            onCancel={() => setCurrentScreen("final-review")}
          />
        );
      case "inspection-history":
        return <InspectionHistory />;
      case "system-scan":
        return (
          <SystemScan
            onNext={() => advanceStage("system-scan")}
          />
        );
      case "hardware-inventory":
        return (
          <HardwareInventory
            onNext={() => advanceStage("hardware-inventory")}
          />
        );
      case "manual-grading":
        return (
          <ManualGrading
            onNext={() => advanceStage("manual-grading")}
          />
        );
      case "speaker-test":
        return (
          <SpeakerTest
            onNext={() => advanceStage("speaker-test")}
          />
        );
      case "webcam-test":
        return (
          <WebcamTest
            onNext={() => advanceStage("webcam-test")}
          />
        );
      case "keyboard-test":
        return (
          <KeyboardTest
            onNext={() => advanceStage("keyboard-test")}
          />
        );
      case "touchpad-test":
        return (
          <TouchpadTest
            onNext={() => advanceStage("touchpad-test")}
          />
        );
      case "battery-assessment":
        return (
          <BatteryAssessment
            onNext={() => advanceStage("battery-assessment")}
          />
        );
      case "final-review":
        return (
          <FinalReview
            onComplete={() =>
              setCurrentScreen("inspection-save-confirmation")
            }
          />
        );
      case "inspection-complete":
        return (
          <InspectionComplete
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
            onSyncNow={() => setCurrentScreen("sync-status")}
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
      />

      <WorkflowSidebar
        stages={stages}
        currentStage={workflowStage || currentScreen}
        onStageClick={goToStage}
        completionPct={completionPct}
        estimatedRemaining={`${Math.max(0, remaining * 3)}m`}
        onNavigate={setCurrentScreen}
      />

      {/* Main content with responsive padding */}
      <main
        className={`pt-14 pl-64 min-h-screen transition-all duration-300 ${
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

      {/* Summary Panel with responsive behavior */}
      {showInWorkflow && layoutMode === "full" && (
        <SummaryPanel
          completionPct={completionPct}
          passed={passed}
          failed={failed}
          remaining={remaining}
          alerts={alerts}
          elapsedTime="00:22"
          currentStage={currentScreen}
        />
      )}

      {/* Standard mode - Collapsible panel */}
      {showInWorkflow && layoutMode === "standard" && (
        <div
          className={`fixed right-0 top-14 bottom-0 bg-white border-l border-slate-200 z-40 transition-all duration-300 ${
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
                <div
                  className="overflow-y-auto"
                  style={{ height: "calc(100% - 57px)" }}
                >
                  <SummaryPanel
                    completionPct={completionPct}
                    passed={passed}
                    failed={failed}
                    remaining={remaining}
                    alerts={alerts}
                    elapsedTime="00:22"
                    currentStage={currentScreen}
                  />
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Global toast host — renders save success/failure popups (sonner) */}
      <Toaster richColors position="top-center" />
    </div>
  );
}