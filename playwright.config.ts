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
  // Warm the Vite dev server once so the first test doesn't race its cold compile.
  globalSetup: "./tests/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  // One retry absorbs dev-server cold-start / GPU-stall flakiness on the first
  // test without masking real, repeatable failures.
  retries: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
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
        ...devices["Pixel 7"],
        // Honour a pre-installed browser when set (sandboxed CI); ignored locally.
        launchOptions: process.env.PW_EXECUTABLE_PATH
          ? { executablePath: process.env.PW_EXECUTABLE_PATH }
          : {}
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
