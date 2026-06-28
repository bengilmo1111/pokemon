import { test, expect } from "./harness/fixtures";

/**
 * Sticker book — a milestone achievements screen derived from game state. A
 * fresh save has none; clearing the big milestones lights them up. Progress is
 * shown as "Stickers: X / N" (tagged sticker-progress).
 */

const openStickers = (page: import("@playwright/test").Page) =>
  page.evaluate(() => (window as any).__GAME__.game.scene.getScene("Overworld").openStickers());
const closeStickers = (page: import("@playwright/test").Page) =>
  page.evaluate(() => (window as any).__GAME__.game.scene.getScene("Overworld").closeStickers());

test("the sticker book opens, tracks milestones, and closes cleanly", async ({ probe, page }) => {
  await probe.bootIntoOverworld({ team: [{ speciesId: "charmander", level: 12 }] });

  // Fresh save: nothing earned yet.
  await openStickers(page);
  await expect.poll(async () => (await probe.snapshot()).overworld!.menus.stickerOpen).toBe(true);
  expect(await probe.uiTargetText("sticker-progress")).toBe("Stickers: 0 / 12");
  await closeStickers(page);
  await expect.poll(async () => (await probe.snapshot()).overworld!.menus.stickerOpen).toBe(false);
  expect((await probe.snapshot()).overworld!.hudVisible, "HUD returns after closing").toBe(true);

  // Earn almost everything (all but "catch all 151").
  await page.evaluate(() => {
    const api: any = (window as any).__GAME__;
    const gs = api.gameState;
    api.giveTeam(Array.from({ length: 6 }, () => ({ speciesId: "charizard", level: 50 }))); // full team, evolved, lvl 50
    gs.badges = Array.from({ length: 8 }, (_, i) => `badge-${i}`);
    gs.isChampion = true;
    gs.eliteFourDefeated = true;
    gs.legendariesCompleted = { "sanctum-x": true };
    gs.pokedex = {};
    for (let i = 0; i < 50; i++) gs.pokedex[`s${i}`] = { seen: true, caught: true };
  });

  await openStickers(page);
  expect(await probe.uiTargetText("sticker-progress")).toBe("Stickers: 11 / 12");
});
