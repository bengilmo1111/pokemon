import { test as base } from "@playwright/test";
import { GameProbe } from "./probe";
import { TouchDriver } from "./touch";

/**
 * Shared fixtures. Every spec gets:
 *  - `probe`: typed access to game state/events (window.__GAME__), with the
 *    page already navigated in test mode and the bridge ready.
 *  - `touch`: a touch driver for thumb-style input.
 *
 * The page loads with ?test=1 (enables the bridge) and a fixed ?seed for
 * deterministic randomness. Individual tests still call
 * probe.bootIntoOverworld() to set up their scenario.
 */
type Fixtures = {
  probe: GameProbe;
  touch: TouchDriver;
};

export const test = base.extend<Fixtures>({
  probe: async ({ page }, use) => {
    await page.goto("/?test=1&seed=20240622");
    const probe = new GameProbe(page);
    await probe.waitForBridge();
    await use(probe);
  },
  touch: async ({ page }, use) => {
    const driver = await TouchDriver.create(page);
    await use(driver);
  }
});

export { expect } from "@playwright/test";
export { DIR } from "./touch";
