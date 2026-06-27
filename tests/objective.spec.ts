import { test, expect } from "./harness/fixtures";

/**
 * "Where do I go?" goal tracker. deriveNextObjective(gameState) drives the
 * persistent goal banner (tagged "goal-banner"). These tests walk the banner
 * through the progression: next gym → Elite Four → Champion.
 */

test("the goal banner advances from the next gym to the league to champion", async ({ probe, page }) => {
  await probe.bootIntoOverworld({ team: [{ speciesId: "charmander", level: 14 }] });
  // Park in a town and clear roaming wilds so a chance encounter can't pause the
  // overworld (which would freeze the banner mid-test).
  await probe.teleportToTown(0);
  await page.evaluate(() => { (window as any).__GAME__.gameState.wildMons = []; });

  // Fresh save: the goal is the first undefeated gym.
  await expect.poll(() => probe.uiTargetText("goal-banner")).toContain("Goal: Beat");
  expect(await probe.uiTargetText("goal-banner")).toContain("earn the");

  // Clear every gym in the region → the league opens.
  await page.evaluate(() => {
    const gs: any = (window as any).__GAME__.gameState;
    const ids: string[] = (window as any).__GAME__.regionInfo().gyms.map((g: any) => g.id);
    ids.forEach((id) => { gs.defeatedGyms[id] = true; });
    gs.badges = ids.slice();
  });
  await expect.poll(() => probe.uiTargetText("goal-banner")).toContain("Elite Four");

  // Become champion → celebratory, no more "Goal:".
  await page.evaluate(() => { (window as any).__GAME__.gameState.isChampion = true; });
  await expect.poll(() => probe.uiTargetText("goal-banner")).toContain("Champion");
});
