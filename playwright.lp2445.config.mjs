import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "lp2445-bare-place-interactive.spec.mjs",
  workers: 1,
  retries: 0,
  reporter: "line",
  webServer: {
    command: "python3 -m http.server 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true
  },
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    headless: true,
    serviceWorkers: "block",
    viewport: { width: 875, height: 400 },
    trace: "off",
    video: "off"
  }
});
