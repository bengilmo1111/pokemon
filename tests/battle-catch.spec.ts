import { test, expect } from "./harness/fixtures";
import { battleSnapshot } from "./harness/battle";

/**
 * Catch mini-game. The throw is graded by how close the reticle is to the
 * moving ring: sweet spot = "perfect", on the ring = "good", off the ring =
 * "weak". The key kid-friendly contract is that EVERY throw is a real attempt —
 * an off-ring throw is a weak chance, never a 0% wasted ball. fireAtTarget emits
 * a `catch:throw` event with the graded quality.
 */

type Off = { x: number; y: number };

/**
 * Enter the targeting mini-game via the real Bag → Poké Ball path
 * (handleCatch → startTargetingGame). Driven through the bridge because this
 * environment's headless browser can't reliably tap nested submenu buttons.
 */
async function startTargeting(page: import("@playwright/test").Page): Promise<void> {
  await page.evaluate(() => {
    const bs: any = (window as any).__GAME__.game.scene.getScene("Battle");
    bs.handleCatch("pokeball");
  });
  await expect
    .poll(() => page.evaluate(() => Boolean((window as any).__GAME__.game.scene.getScene("Battle")?.targetingActive)))
    .toBe(true);
}

/** Place the reticle at the live ring centre + offset, then throw. */
async function aimAndThrow(page: import("@playwright/test").Page, off: Off): Promise<void> {
  await page.evaluate((o) => {
    const bs: any = (window as any).__GAME__.game.scene.getScene("Battle");
    bs.reticleX = bs.targetRing.x + o.x;
    bs.reticleY = bs.targetRing.y + o.y;
    bs.fireAtTarget();
  }, off);
}

const pokeballs = (page: import("@playwright/test").Page) =>
  page.evaluate(() => (window as any).__GAME__.gameState.inventory.pokeball as number);

async function enterWildBattle(probe: any, page: import("@playwright/test").Page) {
  await probe.bootIntoOverworld({ team: [{ speciesId: "charizard", level: 60 }] });
  await probe.forceEncounter();
  await probe.waitForEvent("battle:active");
  await expect.poll(async () => (await battleSnapshot(page)).busy === false).toBe(true);
}

test("aiming on the sweet spot grades as a 'perfect' throw", async ({ probe, page }) => {
  await enterWildBattle(probe, page);

  const before = await pokeballs(page);
  const since = await probe.clearEvents();
  await startTargeting(page);
  await aimAndThrow(page, { x: 0, y: 0 });

  const ev = await probe.waitForEvent("catch:throw", { sinceSeq: since });
  expect(ev.data?.quality).toBe("perfect");
  expect(await pokeballs(page), "one ball is used").toBe(before - 1);
});

test("an off-ring throw is a forgiving 'weak' throw, not a wasted ball", async ({ probe, page }) => {
  await enterWildBattle(probe, page);

  const before = await pokeballs(page);
  const since = await probe.clearEvents();
  await startTargeting(page);
  await aimAndThrow(page, { x: 220, y: 160 }); // far outside the ring

  const ev = await probe.waitForEvent("catch:throw", { sinceSeq: since });
  expect(ev.data?.quality, "off-ring still throws (no 0% miss)").toBe("weak");
  expect(await pokeballs(page), "the ball is a real attempt, still consumed once").toBe(before - 1);
});
