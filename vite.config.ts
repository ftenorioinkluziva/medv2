import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: fileURLToPath(new URL("./frontend-react", import.meta.url)),
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL("./frontend/dist", import.meta.url)),
    emptyOutDir: true
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
        configure(proxy) {
          proxy.on("proxyReq", proxyRequest => {
            proxyRequest.setHeader("origin", "http://127.0.0.1:3000");
          });
        }
      }
    }
  }
});
