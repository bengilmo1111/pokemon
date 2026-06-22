import { test, expect } from "./harness/fixtures";

/**
 * Reviving a fainted team member must be possible on touch. It used to be bound
 * only to the "R" key (no soft equivalent), so mobile players could buy Revives
 * but never use them. The team screen now offers a Revive action on a fainted,
 * selected Pokémon.
 */
test("a fainted team member can be revived from the team screen", async ({ probe, touch }) => {
  await probe.bootIntoOverworld({ team: [{ speciesId: "charmander", level: 20 }, { speciesId: "pidgey", level: 15 }] });

  // Faint the first mon and make sure a Revive is in the bag.
  await probe.page.evaluate(() => {
    const gs: any = (window as any).__GAME__.gameState;
    gs.team[0].hp = 0;
    gs.inventory.revive = 1;
  });

  // Open the team screen.
  const teamBtn = await probe.touchButton("team");
  await touch.tap(teamBtn.x, teamBtn.y);
  await expect.poll(async () => (await probe.snapshot()).overworld!.menus.teamOpen).toBe(true);

  // Select the fainted (first) row until the Revive action appears.
  const { width } = await probe.gameSize();
  await expect
    .poll(async () => {
      const targets = await probe.uiTargets();
      if (targets.some((t) => t.testid === "team-revive")) return true;
      await touch.tap(width / 2, 134); // first team row
      return (await probe.uiTargets()).some((t) => t.testid === "team-revive");
    }, { message: "Revive action never appeared for the fainted mon" })
    .toBe(true);

  const revive = await probe.uiTarget("team-revive");
  await touch.tap(revive.x, revive.y);

  // The mon is revived and a Revive was consumed.
  await expect
    .poll(async () => probe.page.evaluate(() => (window as any).__GAME__.gameState.team[0].hp))
    .toBeGreaterThan(0);
  expect(await probe.page.evaluate(() => (window as any).__GAME__.gameState.inventory.revive)).toBe(0);
});
