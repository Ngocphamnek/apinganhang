import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

const rawPort = process.env.PORT;
if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;
if (!basePath) {
  throw new Error("BASE_PATH environment variable is required but was not provided.");
}

const backendPort = process.env.BACKEND_PORT || "2002";
const base = basePath.replace(/\/$/, "");

export default defineConfig({
  base: basePath,
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      [`${base}/api`]: {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
  build: {
    outDir: "dist/public",
    emptyOutDir: true,
  },
});
