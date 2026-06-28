import { test, expect } from "./harness/fixtures";

/**
 * Settings screen — one place for audio, read-aloud and text speed. Reached from
 * the pause menu. Renders every control with its current value and closes
 * cleanly. (The read-aloud toggle's behaviour is exercised in narration.spec;
 * the text-speed → typewriter wiring in battle-typewriter.spec.)
 */
test("the settings screen shows current values and closes cleanly", async ({ probe, page }) => {
  await probe.bootIntoOverworld({ team: [{ speciesId: "charmander", level: 12 }] });

  await page.evaluate(() => (window as any).__GAME__.game.scene.getScene("Overworld").openSettings());
  await expect.poll(async () => (await probe.snapshot()).overworld!.menus.settingsOpen).toBe(true);
  await probe.waitForStableGameSize();

  expect(await probe.uiTargetText("setting-music-value")).toBe("ON");
  expect(await probe.uiTargetText("setting-sfx-value")).toBe("ON");
  expect(await probe.uiTargetText("setting-narration-value")).toBe("ON");
  expect(await probe.uiTargetText("setting-textspeed-value")).toBe("Normal");

  await page.evaluate(() => (window as any).__GAME__.game.scene.getScene("Overworld").closeSettings());
  await expect.poll(async () => (await probe.snapshot()).overworld!.menus.settingsOpen).toBe(false);
  expect((await probe.snapshot()).overworld!.hudVisible, "HUD returns after closing").toBe(true);
});
