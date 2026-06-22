import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the mobile-touch test harness.
 *
 * The suite drives the game the way a phone user does: a real mobile viewport,
 * touch emulation, and synthetic touch events on the canvas. It boots the game
 * with `?test=1` so the in-game test bridge (window.__GAME__) is available for
 * deterministic setup and state/event assertions.
 *
 * Run:  npm run test:install   (one-time, downloads Chromium)
 *       npm run test:e2e
 */
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "tests/.report" }]],
  use: {
    baseURL: "http://localhost:5173",
    // Trace is cheap and invaluable on failure; video recording is heavy and
    // slows the canvas frame rate enough to cause flakiness, so leave it off.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off"
  },
  projects: [
    {
      name: "mobile-chromium",
      use: {
        // A real phone profile: mobile viewport, touch enabled, device scale.
        ...devices["Pixel 7"]
      }
    }
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  }
});
