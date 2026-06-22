import { test, expect } from "./harness/fixtures";
import type { GameProbe } from "./harness/probe";

/**
 * Regression coverage for the overworld Items button.
 *
 * Bug: it showed "No potions left!" whenever no heal happened — including when
 * the team was simply at full HP — even though the bag had potions. The message
 * must distinguish "out of potions" from "nobody needs healing", and must not
 * consume a potion in either no-op case.
 */

function potions(probe: GameProbe) {
  return probe.page.evaluate(() => (window as any).__GAME__.gameState.inventory.potion as number);
}
function setPotions(probe: GameProbe, n: number) {
  return probe.page.evaluate((v) => { (window as any).__GAME__.gameState.inventory.potion = v; }, n);
}
function damageFirstMon(probe: GameProbe, toHp: number) {
  return probe.page.evaluate((hp) => {
    (window as any).__GAME__.gameState.team[0].hp = hp;
  }, toHp);
}
async function pressItem(probe: GameProbe, touch: any) {
  const btn = await probe.touchButton("item");
  await touch.tap(btn.x, btn.y);
}

test("Items at full HP says 'full HP' (not 'no potions') and keeps the potion", async ({ probe, touch }) => {
  await probe.bootIntoOverworld({ team: [{ speciesId: "charmander", level: 20 }] });
  const before = await potions(probe);
  expect(before).toBeGreaterThan(0);

  await pressItem(probe, touch);
  await expect
    .poll(async () => (await probe.snapshot()).overworld!.notification.text)
    .toContain("full HP");
  expect(await potions(probe), "no potion should be consumed at full HP").toBe(before);
});

test("Items with a hurt team heals and consumes one potion", async ({ probe, touch }) => {
  await probe.bootIntoOverworld({ team: [{ speciesId: "charmander", level: 20 }] });
  await damageFirstMon(probe, 1);
  const before = await potions(probe);

  await pressItem(probe, touch);
  await expect
    .poll(async () => (await probe.snapshot()).overworld!.notification.text)
    .toContain("Used Potion");
  expect(await potions(probe)).toBe(before - 1);
  expect((await probe.snapshot()).game.teamHp[0], "mon should have healed").toBeGreaterThan(1);
});

test("Items with zero potions says 'No potions left'", async ({ probe, touch }) => {
  await probe.bootIntoOverworld({ team: [{ speciesId: "charmander", level: 20 }] });
  await damageFirstMon(probe, 1);   // someone needs healing...
  await setPotions(probe, 0);       // ...but the bag is empty

  await pressItem(probe, touch);
  await expect
    .poll(async () => (await probe.snapshot()).overworld!.notification.text)
    .toContain("No potions left");
});
