import { chromium, type FullConfig } from "@playwright/test";

/**
 * Warm the Vite dev server before the suite runs.
 *
 * Vite compiles the module graph (app + Phaser) lazily on the first request,
 * which can take longer than a test's boot timeout — so the very first test
 * used to flake on a cold start. Loading the page once here pays that cost up
 * front, off the clock of any individual test.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL ?? "http://localhost:5173";
  // Honour a pre-installed browser when set (e.g. sandboxed CI where Playwright
  // can't download its own); no effect on a normal local install.
  const executablePath = process.env.PW_EXECUTABLE_PATH || undefined;
  const browser = await chromium.launch({ executablePath });
  try {
    const page = await browser.newPage();
    await page.goto(`${baseURL}/?test=1`, { waitUntil: "load", timeout: 60_000 });
    // Wait for the bridge so we know the app actually compiled and booted.
    await page
      .waitForFunction(() => Boolean((window as { __GAME__?: unknown }).__GAME__), undefined, { timeout: 60_000 })
      .catch(() => { /* best-effort warmup; tests will still retry */ });
  } finally {
    await browser.close();
  }
}
