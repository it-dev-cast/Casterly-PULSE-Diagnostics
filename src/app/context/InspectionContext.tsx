import {
  createContext,
  useContext,
  useState,
} from "react";

export type GradeResult = "pass" | "fail" | null;

export interface GradingData {
  grades: Record<string, GradeResult>;
  selectedDefects: Record<string, string[]>;
  remarks: string;
}

export interface SpeakerTestData {
  result: "pass" | "fail" | null;
}

export interface WebcamTestData {
  result: "pass" | "fail" | null;
}

export interface KeyboardTestData {
  pressed: string[];
  failed: string[];
  result: "pass" | "fail" | null;
}

export interface TouchpadTestData {
  leftClick: boolean;
  rightClick: boolean;
  movement: boolean;
  scroll: boolean;
  result: "pass" | "fail" | null;
}

export interface BatteryAssessmentData {
  result: "pass" | "fail" | null;
}

export interface InspectionData {
  // Inspection run identifier. Generated client-side once Hardware
  // Inventory hands off to Manual Grading (see HardwareInventory.tsx), so
  // the per-category report tables and the final `inspections` row (Save
  // Inspection) share the same UUID. Null until that point.
  uuid: string | null;

  // Hardware inventory
  systemInfo: any;
  cpuInfo: any;
  memoryInfo: any;
  storageInfo: any;
  batteryInfo: any;
  networkInfo: any;
  displayInfo: any;
  gpuInfo: any;
  cameraInfo: any;
  audioInfo: any;

  scanCompleted: boolean;
  scanTimestamp: number | null;
  inspectionStartTime: number | null;

  // Manual cosmetic grading
  grading: GradingData;

  // Diagnostic tests
  speakerTest: SpeakerTestData;
  webcamTest: WebcamTestData;
  keyboardTest: KeyboardTestData;
  touchpadTest: TouchpadTestData;
  batteryAssessment: BatteryAssessmentData;
}

interface InspectionContextType {
  data: InspectionData;
  setData: React.Dispatch<
    React.SetStateAction<InspectionData>
  >;
  resetInspection: () => void;
}

const defaultGradingData: GradingData = {
  grades: {
    lcd: "pass",
    topCover: "pass",
    bezel: "pass",
    palmrest: "pass",
    bottomCover: "pass",
    keyboard: "pass",
    touchpad: "pass",
  },
  selectedDefects: {
    lcd: [],
    topCover: [],
    bezel: [],
    palmrest: [],
    bottomCover: [],
    keyboard: [],
    touchpad: [],
  },
  remarks: "",
};

const InspectionContext =
  createContext<InspectionContextType | null>(
    null
  );

export function InspectionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [data, setData] =
    useState<InspectionData>({
      uuid: null,
      systemInfo: null,
      cpuInfo: null,
      memoryInfo: null,
      storageInfo: null,
      batteryInfo: null,
      networkInfo: null,
      displayInfo: null,
      gpuInfo: null,
      cameraInfo: null,
      audioInfo: null,

      scanCompleted: false,

      scanTimestamp: null,

      inspectionStartTime:
        Date.now(),

      grading: defaultGradingData,

      speakerTest: { result: null },
      webcamTest: { result: null },
      keyboardTest: { pressed: [], failed: [], result: null },
      touchpadTest: {
        leftClick: false,
        rightClick: false,
        movement: false,
        scroll: false,
        result: null,
      },
      batteryAssessment: { result: null },
    });

  const resetInspection = () =>
    setData({
      uuid: null,
      systemInfo: null,
      cpuInfo: null,
      memoryInfo: null,
      storageInfo: null,
      batteryInfo: null,
      networkInfo: null,
      displayInfo: null,
      gpuInfo: null,
      cameraInfo: null,
      audioInfo: null,

      scanCompleted: false,

      scanTimestamp: null,

      inspectionStartTime:
        Date.now(),

      grading: defaultGradingData,

      speakerTest: { result: null },
      webcamTest: { result: null },
      keyboardTest: { pressed: [], failed: [], result: null },
      touchpadTest: {
        leftClick: false,
        rightClick: false,
        movement: false,
        scroll: false,
        result: null,
      },
      batteryAssessment: { result: null },
    });

  return (
    <InspectionContext.Provider
      value={{
        data,
        setData,
        resetInspection,
      }}
    >
      {children}
    </InspectionContext.Provider>
  );
}

export function useInspection() {
  const ctx =
    useContext(InspectionContext);

  if (!ctx) {
    throw new Error(
      "InspectionContext missing"
    );
  }

  return ctx;
}
