import { test, expect } from "./harness/fixtures";
import { battleSnapshot, tapBattleLabel } from "./harness/battle";

/**
 * Super-effective move hints. The Fight menu badges each damaging move with how
 * it fares against the current enemy ("▲ Strong!" / "▼ Weak" / "✕ No effect"),
 * so kids learn type matchups by seeing them. Bulbasaur's Grass move (vine-whip)
 * is super-effective against a Water enemy.
 */

/** All visible text in the Battle scene's move menu (buttons + badges). */
function moveMenuText(page: import("@playwright/test").Page): Promise<string[]> {
  return page.evaluate(() => {
    const bs: any = (window as any).__GAME__.game.scene.getScene("Battle");
    return (bs?.moveMenuItems || [])
      .filter((t: any) => typeof t.text === "string")
      .map((t: any) => t.text as string);
  });
}

test("a super-effective move is badged 'Strong!' against the enemy's type", async ({ probe, page }) => {
  await probe.bootIntoOverworld({ team: [{ speciesId: "bulbasaur", level: 12 }] });
  await probe.forceEncounter();
  await probe.waitForEvent("battle:active");
  await expect.poll(async () => (await battleSnapshot(page)).busy === false).toBe(true);

  // Pin the enemy to pure Water so Bulbasaur's Grass move is super-effective and
  // its Normal move (Tackle) stays neutral — a deterministic matchup.
  await page.evaluate(() => {
    const bs: any = (window as any).__GAME__.game.scene.getScene("Battle");
    bs.enemyMon.types = ["water"];
  });

  expect(await tapBattleLabel(page, "fight")).toBe(true);
  await page.waitForTimeout(200);

  const labels = await moveMenuText(page);
  expect(labels.some((l) => l.includes("Strong!")), `move labels: ${labels.join(" | ")}`).toBe(true);
  // The neutral Normal move must not be mislabelled.
  expect(labels.some((l) => l.includes("Weak") || l.includes("No effect"))).toBe(false);
});
