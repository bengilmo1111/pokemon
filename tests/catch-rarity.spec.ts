import { test, expect } from "./harness/fixtures";

/**
 * Rarity-based catch difficulty. catchChance() now lets a species' catchRate set
 * the starting odds, so common route Pokémon stay easy while legendaries are a
 * real challenge until you weaken them. Driven through the bridge so it asserts
 * the actual probability, not a flaky RNG outcome.
 */

type Ball = "pokeball" | "greatball" | "ultraball";

/** Catch chance for a fresh (full-HP) Pokémon of a species. */
function chance(
  page: import("@playwright/test").Page,
  speciesId: string,
  level: number,
  ball: Ball = "pokeball",
  patch: { hpRatio?: number; status?: string } = {}
): Promise<number> {
  return page.evaluate(({ speciesId, level, ball, patch }) => {
    const api: any = (window as any).__GAME__;
    const mon = api.makeMon(speciesId, level);
    if (patch.hpRatio !== undefined) mon.hp = Math.max(1, Math.round(mon.maxHp * patch.hpRatio));
    if (patch.status) mon.status = patch.status;
    return api.catchChance(mon, ball) as number;
  }, { speciesId, level, ball, patch });
}

test("common Pokémon are much easier to catch than legendaries", async ({ probe, page }) => {
  await probe.bootIntoOverworld();

  const common = await chance(page, "pidgey", 5);       // catchRate 255
  const legendary = await chance(page, "mewtwo", 70);   // catchRate 3

  expect(common, "a common is catchable from full HP").toBeGreaterThan(0.4);
  expect(legendary, "a legendary is hard from full HP").toBeLessThan(0.12);
  expect(legendary).toBeLessThan(common);
});

test("weakening and a better ball turn a legendary from a long shot into a real chance", async ({ probe, page }) => {
  await probe.bootIntoOverworld();

  const fresh = await chance(page, "mewtwo", 70, "pokeball");
  const worn = await chance(page, "mewtwo", 70, "ultraball", { hpRatio: 0.08, status: "sleep" });

  expect(worn, "low HP + sleep + Ultra Ball should help a lot").toBeGreaterThan(fresh + 0.4);
  expect(worn).toBeGreaterThan(0.7);
});
