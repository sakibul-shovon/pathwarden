import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In development the UI calls a relative `/api/...`; the proxy forwards it to the local API, so no
// CORS is involved. A hosted build sets VITE_API_BASE to the API's absolute URL instead.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://localhost:8000", changeOrigin: true } },
  },
});
