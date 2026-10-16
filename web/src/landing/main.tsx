import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../shared/styles/index.css";
import { legacyRedirectTarget } from "../shared/lib/legacyRedirect";
import { Landing } from "./Landing";

// Every link of the old single-page app (`/?tab=investigate&ws=...`, including the one in the MCP gateway's tool error)
// carries query parameters: forward it to the app untouched. Nothing is rendered in that case.
const target = legacyRedirectTarget(window.location.search, window.location.hash);
if (target !== null) {
  window.location.replace(target);
} else {
  const root = document.getElementById("root");
  if (!root) throw new Error("#root not found");
  createRoot(root).render(
    <StrictMode>
      <Landing />
    </StrictMode>,
  );
}
