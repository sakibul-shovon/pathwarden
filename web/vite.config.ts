import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In development the UI calls a relative `/api/...`; the proxy forwards it to the local API, so no
// CORS is involved. A hosted build sets VITE_API_BASE to the API's absolute URL instead.
// The target is 127.0.0.1, not localhost: Node resolves localhost to ::1 first on some machines while
// uvicorn listens on IPv4 only, which showed up as "Bad Gateway" in the UI.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://127.0.0.1:8000", changeOrigin: true } },
  },
});
