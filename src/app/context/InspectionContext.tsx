import {
  createContext,
  useContext,
  useState,
} from "react";

export interface InspectionData {
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
  motherboardInfo: any;
  bluetoothInfo: any;

  scanCompleted: boolean;

  scanTimestamp: number | null;

  inspectionStartTime: number | null;
}

interface InspectionContextType {
  data: InspectionData;

  setData: React.Dispatch<
    React.SetStateAction<InspectionData>
  >;

  resetInspection: () => void;
}

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
      motherboardInfo: null,
      bluetoothInfo: null,

      scanCompleted: false,

      scanTimestamp: null,

      inspectionStartTime:
        Date.now(),
    });

  const resetInspection = () =>
    setData({
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
      motherboardInfo: null,
      bluetoothInfo: null,

      scanCompleted: false,

      scanTimestamp: null,

      inspectionStartTime:
        Date.now(),
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