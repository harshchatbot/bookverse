import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load root .env into Playwright process
dotenv.config({ path: path.resolve(__dirname, ".env") });

process.env.SHIPROCKET_MODE = process.env.SHIPROCKET_MODE ?? "mock";
process.env.SHIPROCKET_AUTO_CREATE_AFTER_PAYMENT =
  process.env.SHIPROCKET_AUTO_CREATE_AFTER_PAYMENT ?? "false";
process.env.SHIPROCKET_ALLOW_LIVE_ORDER_CREATION =
  process.env.SHIPROCKET_ALLOW_LIVE_ORDER_CREATION ?? "false";

if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
  process.env.RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "test-secret";
}

if (
  !process.env.FIREBASE_SERVICE_ACCOUNT_JSON &&
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY
) {
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    project_id: process.env.FIREBASE_PROJECT_ID,
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_PRIVATE_KEY,
  });
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 1,
  use: {
    baseURL: "http://localhost:8080",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:8080",
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER !== "false",
    timeout: 30_000,
  },
});
