import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PrimitivesHarness } from "./PrimitivesHarness";
import "../styles/fonts.css";
import "../styles/tokens.css";
import "../ui/primitives.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element #root is missing");
}

createRoot(root).render(
  <StrictMode>
    <PrimitivesHarness />
  </StrictMode>,
);
