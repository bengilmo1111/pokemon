import { test, expect } from "./harness/fixtures";

/**
 * Read-aloud narration. Game text funnels through Battle.setMessage and
 * Overworld.showNotification, which both call the narrator. We can't assert on
 * real audio, so the narrator emits a `narrate:speak` test event when (and only
 * when) it would speak. These tests prove the wiring and the Settings toggle.
 */

/** Fire an overworld toast through the real showNotification sink. */
async function fireNotification(page: import("@playwright/test").Page, msg: string): Promise<void> {
  await page.evaluate((m) => {
    const s: any = (window as any).__GAME__.game.scene.getScene("Overworld");
    s.showNotification(m);
  }, msg);
}

test("game text is narrated by default, and the Settings toggle silences it", async ({ probe, touch, page }) => {
  await probe.bootIntoOverworld({ team: [{ speciesId: "charmander", level: 12 }] });
  // Clear roaming wilds so a chance encounter can't pause the overworld mid-test.
  await page.evaluate(() => { (window as any).__GAME__.gameState.wildMons = []; });

  // Default ON: a notification is read aloud (emits a narrate:speak event whose
  // text matches). Poll the log so unrelated toasts don't mask the match.
  let since = await probe.clearEvents();
  await fireNotification(page, "Hello trainer");
  await expect
    .poll(async () => {
      const evts = await probe.events(since);
      return evts.some((e) => e.type === "narrate:speak" && String(e.data?.text).includes("Hello trainer"));
    })
    .toBe(true);

  // Open the Settings screen and flip "Read aloud" off via its tagged row.
  await page.evaluate(() => (window as any).__GAME__.game.scene.getScene("Overworld").openSettings());
  await expect.poll(async () => (await probe.snapshot()).overworld!.menus.settingsOpen).toBe(true);
  expect(await probe.uiTargetText("setting-narration-value")).toBe("ON");
  await expect
    .poll(async () => {
      if ((await probe.uiTargetText("setting-narration-value")) === "OFF") return true;
      const row = await probe.uiTarget("setting-narration");
      await touch.tap(row.x, row.y);
      return (await probe.uiTargetText("setting-narration-value")) === "OFF";
    })
    .toBe(true);

  // Close Settings and confirm further game text is NOT narrated.
  await page.evaluate(() => (window as any).__GAME__.game.scene.getScene("Overworld").closeSettings());
  since = await probe.clearEvents();
  await fireNotification(page, "This should be silent");
  await probe.expectNoEvent("narrate:speak", { sinceSeq: since });
});
