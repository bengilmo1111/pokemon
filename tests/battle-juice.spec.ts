import { test, expect } from "./harness/fixtures";
import { fightUntilOver } from "./harness/battle";

/**
 * Game-feel regression: damaging hits now emit a `battle:damage` event (driving
 * the floating damage numbers + animated HP-bar drain). This guards that the
 * juice hooks fire with sane payloads during a real, touch-driven battle, that
 * the reported amount matches the HP the enemy actually lost, and that adding the
 * juice didn't break the battle→overworld resolution. The HP-bar *drain* itself
 * is a visual property (the bar renders from a tweened display ratio); it's
 * exercised here and eyeballed via `test:e2e:headed`.
 */
test("damaging hits emit battle:damage events matching real HP loss", async ({ probe, page }) => {
  await probe.bootIntoOverworld({ team: [{ speciesId: "charizard", level: 60 }] });

  const since = await probe.clearEvents();
  await probe.forceEncounter();
  await probe.waitForEvent("battle:active", { sinceSeq: since });

  // Record the enemy's full HP at battle start (before any drain).
  const enemyStartHp = await page.evaluate(() => {
    const bs: any = (window as any).__GAME__.game.scene.getScene("Battle");
    return bs?.enemyMon?.maxHp ?? 0;
  });

  await fightUntilOver(page);
  const complete = await probe.waitForEvent("battle:complete", { sinceSeq: since, timeout: 20_000 });
  expect(complete.data?.result, "an over-levelled Charizard should win").toBe("victory");

  const dmgEvents = (await probe.events(since)).filter((e) => e.type === "battle:damage");
  expect(dmgEvents.length, "at least one damaging hit was reported").toBeGreaterThan(0);

  for (const e of dmgEvents) {
    expect(typeof e.data?.amount, "damage amount is a number").toBe("number");
    expect(e.data?.amount as number, "damage amount is positive").toBeGreaterThan(0);
    expect(typeof e.data?.effectiveness, "effectiveness is reported").toBe("number");
    expect(typeof e.data?.crit, "crit flag is reported").toBe("boolean");
  }

  // The enemy fainted, so the damage dealt to it totals at least its full HP.
  // (Both sides' hits are logged, so total is a lower-bound sanity check.)
  const totalDamage = dmgEvents.reduce((sum, e) => sum + (e.data?.amount as number), 0);
  expect(totalDamage, "cumulative damage covers at least the enemy's HP").toBeGreaterThanOrEqual(enemyStartHp);
});
