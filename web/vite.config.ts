import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// In development the UI calls a relative `/api/...`; the proxy forwards it to the local API, so no
// CORS is involved. VITE_PROXY_TARGET points the proxy elsewhere when port 8000 is taken by another
// project. A hosted build sets VITE_API_BASE to the API's absolute URL instead.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "VITE_");
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: { "/api": { target: env.VITE_PROXY_TARGET ?? "http://localhost:8000", changeOrigin: true } },
    },
  };
});
