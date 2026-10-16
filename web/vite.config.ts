import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Two entry pages (ui-redesign.md §10.1): `/` is the public landing page, `/app/` the workspace application.
// `system.html` (the development-only design system page) is not an entry, so the production build never contains it.
//
// In development the UI calls a relative `/api/...`; the proxy forwards it to the local API, so no
// CORS is involved. A hosted build sets VITE_API_BASE to the API's absolute URL instead.
// The target is 127.0.0.1, not localhost: Node resolves localhost to ::1 first on some machines while
// uvicorn listens on IPv4 only, which showed up as "Bad Gateway" in the UI.
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      input: {
        index: resolve(import.meta.dirname, "index.html"),
        app: resolve(import.meta.dirname, "app/index.html"),
      },
    },
  },
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://127.0.0.1:8000", changeOrigin: true } },
  },
});
