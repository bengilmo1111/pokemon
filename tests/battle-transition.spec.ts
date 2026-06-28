import { test, expect } from "./harness/fixtures";

/**
 * Unified battle-start transition. Trainer/gym/Elite/rival battles used to
 * hard-cut straight into the Battle scene while only wild battles flashed. Now
 * they all run through beginBattle (flash + shake, emitting battle:transition),
 * then launch. This checks a gym battle takes that path and still launches.
 */
test("a gym battle runs through the flash transition, then launches", async ({ probe, page }) => {
  await probe.bootIntoOverworld({ team: [{ speciesId: "charizard", level: 50 }] });

  const gymId = await page.evaluate(() => (window as any).__GAME__.regionInfo().gyms[0].id as string);
  const since = await probe.clearEvents();

  await page.evaluate((id) => (window as any).__GAME__.game.scene.getScene("Overworld").startGymBattle(id), gymId);

  // The transition fires first…
  await probe.waitForEvent("battle:transition", { sinceSeq: since });
  // …then the battle actually launches a beat later.
  await probe.waitForEvent("battle:active", { sinceSeq: since, timeout: 5_000 });
  await expect.poll(async () => (await probe.snapshot()).battleActive).toBe(true);
});
