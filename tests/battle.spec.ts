import { test, expect } from "./harness/fixtures";
import { battleSnapshot, fightUntilOver } from "./harness/battle";

/**
 * Full wild-battle playthrough driven via touch: trigger an encounter, fight to
 * victory, and verify the win resolves cleanly back into the overworld. Guards
 * the battle→overworld handoff (exactly one post-battle save, exp gained, wild
 * removed, HUD restored, no instant-escape).
 */
test("winning a wild battle resolves cleanly back to the overworld", async ({ probe, page }) => {
  await probe.bootIntoOverworld({ team: [{ speciesId: "charizard", level: 60 }] });

  const expBefore = await page.evaluate(() => (window as any).__GAME__.gameState.team[0].exp as number);
  const wildBefore = (await probe.snapshot()).game.wildMonCount;
  const since = await probe.clearEvents();

  await probe.forceEncounter();
  await probe.waitForEvent("battle:active", { sinceSeq: since });

  await fightUntilOver(page);

  const complete = await probe.waitForEvent("battle:complete", { sinceSeq: since, timeout: 20_000 });
  expect(complete.data?.result, "an over-levelled Charizard should win").toBe("victory");

  // Battle scene closes and the overworld comes back.
  await expect.poll(async () => (await battleSnapshot(page)).active, { timeout: 10_000 }).toBe(false);
  await expect.poll(async () => (await probe.snapshot()).battleActive).toBe(false);
  await page.waitForTimeout(600);

  const snap = await probe.snapshot();
  const expAfter = await page.evaluate(() => (window as any).__GAME__.gameState.team[0].exp as number);

  expect(await probe.countEvents("battle:instant-escape", since), "no instant-escape").toBe(0);
  expect(await probe.countEvents("save:fired", since), "exactly one post-battle save").toBe(1);
  expect(expAfter, "winner should gain exp").toBeGreaterThan(expBefore);
  expect(snap.game.wildMonCount, "the defeated wild Pokémon is removed").toBeLessThan(wildBefore);
  expect(snap.overworld!.hudVisible, "HUD restored after battle").toBe(true);
  expect(snap.overworld!.anyMenuOpen, "no menu left open").toBe(false);
});
