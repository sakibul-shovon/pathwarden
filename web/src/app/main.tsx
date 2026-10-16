import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../shared/styles/index.css";
import { applyTheme, readStoredTheme } from "../shared/lib/theme";
import { Shell } from "./Shell";

// the stored theme is applied before the first paint of the app, so there is no flash of the wrong theme
applyTheme(readStoredTheme());

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");
createRoot(root).render(
  <StrictMode>
    <Shell />
  </StrictMode>,
);
