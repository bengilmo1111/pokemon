import { test, expect } from "./harness/fixtures";

/**
 * Read-aloud narration. Game text funnels through Battle.setMessage and
 * Overworld.showNotification, which both call the narrator. We can't assert on
 * real audio, so the narrator emits a `narrate:speak` test event when (and only
 * when) it would speak. These tests prove the wiring and the pause-menu toggle.
 */

/** Fire an overworld toast through the real showNotification sink. */
async function fireNotification(page: import("@playwright/test").Page, msg: string): Promise<void> {
  await page.evaluate((m) => {
    const s: any = (window as any).__GAME__.game.scene.getScene("Overworld");
    s.showNotification(m);
  }, msg);
}

test("game text is narrated by default, and the pause toggle silences it", async ({ probe, touch, page }) => {
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

  // Open the pause menu.
  await page.evaluate(() => (window as any).__GAME__.game.scene.getScene("Overworld").togglePause());
  await expect.poll(async () => (await probe.snapshot()).overworld!.isPaused).toBe(true);

  // Flip "Read aloud" off via its tagged button.
  expect(await probe.uiTargetText("pause-narration")).toContain("ON");
  await expect
    .poll(async () => {
      const txt = await probe.uiTargetText("pause-narration");
      if (txt?.includes("OFF")) return true;
      const toggle = await probe.uiTarget("pause-narration");
      await touch.tap(toggle.x, toggle.y);
      return (await probe.uiTargetText("pause-narration"))?.includes("OFF") ?? false;
    })
    .toBe(true);

  // Resume and confirm further game text is NOT narrated.
  await page.evaluate(() => (window as any).__GAME__.game.scene.getScene("Overworld").resumeGame());
  since = await probe.clearEvents();
  await fireNotification(page, "This should be silent");
  await probe.expectNoEvent("narrate:speak", { sinceSeq: since });
});
