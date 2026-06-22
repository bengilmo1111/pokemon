import { test, expect } from "./harness/fixtures";
import { battleHasBackdrop, battleMessageVisible, battleSnapshot, battleText, fightUntilOver, tapBattleLabel } from "./harness/battle";

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

/**
 * The Bag/Move/Switch submenus extend up into the message-bar band, so the bar
 * must be hidden while a submenu is open (it used to overlap the items) and
 * restored when the player backs out.
 */
test("battle submenus hide the message bar (no overlap), restored on Back", async ({ probe, page }) => {
  await probe.bootIntoOverworld({ team: [{ speciesId: "charizard", level: 40 }] });
  await probe.forceEncounter();
  await probe.waitForEvent("battle:active");
  await expect.poll(async () => (await battleSnapshot(page)).busy === false).toBe(true);

  expect(await battleMessageVisible(page), "bar visible at battle start").toBe(true);

  // Open Bag → message bar hidden so it can't overlap the item rows, and a
  // modal backdrop appears so rows don't float over the sprites.
  expect(await tapBattleLabel(page, "bag")).toBe(true);
  await expect.poll(() => battleMessageVisible(page)).toBe(false);
  expect(await battleHasBackdrop(page), "submenu should dim the battle behind it").toBe(true);

  // Back → bar restored, backdrop gone.
  expect(await tapBattleLabel(page, "back")).toBe(true);
  await expect.poll(() => battleMessageVisible(page)).toBe(true);
  expect(await battleHasBackdrop(page), "backdrop removed on Back").toBe(false);

  // Same contract for the Fight (move) submenu.
  expect(await tapBattleLabel(page, "fight")).toBe(true);
  await expect.poll(() => battleMessageVisible(page)).toBe(false);
  expect(await battleHasBackdrop(page)).toBe(true);
});

test("ball targeting instructions use touch wording (no keyboard hint)", async ({ probe, page }) => {
  await probe.bootIntoOverworld({ team: [{ speciesId: "charizard", level: 40 }] });
  await probe.forceEncounter();
  await probe.waitForEvent("battle:active");
  await expect.poll(async () => (await battleSnapshot(page)).busy === false).toBe(true);

  expect(await tapBattleLabel(page, "bag")).toBe(true);
  await page.waitForTimeout(300);
  expect(await tapBattleLabel(page, "poke ball")).toBe(true);

  await expect.poll(() => battleText(page, "targeting-instructions")).toContain("tap THROW");
  const instr = await battleText(page, "targeting-instructions");
  expect(instr).not.toContain("arrow keys");
  expect(instr).not.toContain("SPACE");
});

test("a caught Pokémon can be nicknamed via a real input (works on touch)", async ({ probe, page }) => {
  await probe.bootIntoOverworld({ team: [{ speciesId: "charizard", level: 40 }] });
  await probe.forceEncounter();
  await probe.waitForEvent("battle:active");
  await expect.poll(async () => (await battleSnapshot(page)).busy === false).toBe(true);

  // Open the naming screen for the wild Pokémon (skips the catch RNG).
  await page.evaluate(() => {
    const bs: any = (window as any).__GAME__.game.scene.getScene("Battle");
    bs.pendingCatchMon = bs.enemyMon;
    bs.showNamingScreen();
  });

  // A real HTML <input> is present — this is what lets the soft keyboard open
  // on touch (the old canvas-only field couldn't be typed into on mobile).
  const input = page.locator("input");
  await expect(input).toBeVisible({ timeout: 5_000 });
  await input.fill("Sparky");
  await input.press("Enter");

  // The nickname is applied and the overlay is cleaned up.
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const gs: any = (window as any).__GAME__.gameState;
        return [...gs.team, ...gs.box].some((m: any) => m.nickname === "Sparky");
      })
    )
    .toBe(true);
  expect(await page.locator("input").count(), "input overlay removed after submit").toBe(0);
});
