import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

import {
  InspectionProvider,
} from "./app/context/InspectionContext";

createRoot(
  document.getElementById("root")!
).render(
  <InspectionProvider>
    <App />
  </InspectionProvider>
);