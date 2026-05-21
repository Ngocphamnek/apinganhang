/**
 * Core Bank Tool - Backend Server
 */

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import apiRoutes from "./routes/api";
import { warmup } from "./services/wasm-engine";
import { warmupOCR } from "./services/captcha-ocr";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.BACKEND_PORT || "2002");
const BASE = (process.env.BASE_PATH || "/corebank").replace(/\/$/, "");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.use(`${BASE}/api`, apiRoutes);

// Serve built Vue frontend in production
const distDir = path.join(__dirname, "..", "dist", "public");
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((_req: express.Request, res: express.Response) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
} else {
  app.use((req: express.Request, res: express.Response) => {
    if (req.originalUrl.startsWith(`${BASE}/api`)) {
      res.status(404).json({ success: false, message: "API endpoint not found" });
      return;
    }
    res.status(404).json({ success: false, message: "Not found" });
  });
}

app.listen(PORT, async () => {
  console.log(`\n🏦 CoreBank Panel PRO running on http://localhost:${PORT}`);
  console.log(`📡 API endpoints at http://localhost:${PORT}${BASE}/api\n`);

  try {
    await warmup();
    console.log("🔐 WASM encryption engine ready");
    await warmupOCR();
    console.log("🤖 OCR captcha model ready\n");
  } catch (err) {
    console.warn("⚠️  Warmup failed (will retry on first request):", err);
  }
});
