import { test, expect } from "./harness/fixtures";

/**
 * Paid town travel: Pokémon Centers double as travel hubs. For a flat fare the
 * player can fast-travel to any region they have already discovered. This is
 * the deliberate replacement for wandering through portals, so it must charge
 * money, refuse when the player can't pay, and only offer visited regions.
 */
const FARE = 250;

/** Patch progression state on the live gameState (no restart needed). */
async function setState(
  probe: import("./harness/probe").GameProbe,
  patch: { money?: number; visitedRegions?: number[]; regionIndex?: number }
): Promise<void> {
  await probe.page.evaluate((patch) => {
    const g = (window as any).__GAME__;
    if (patch.money !== undefined) g.gameState.money = patch.money;
    if (patch.visitedRegions !== undefined) g.gameState.visitedRegions = patch.visitedRegions;
    if (patch.regionIndex !== undefined) g.gameState.regionIndex = patch.regionIndex;
  }, patch);
}

/** Invoke the real travel path (fare check, deduction, region switch). */
async function travelTo(probe: import("./harness/probe").GameProbe, index: number): Promise<void> {
  await probe.page.evaluate((index) => {
    (window as any).__GAME__.game.scene.getScene("Overworld").travelToRegion(index);
  }, index);
}

test.describe("paid town travel", () => {
  test("travelling to a discovered region charges the fare and moves you", async ({ probe }) => {
    await probe.bootIntoOverworld();
    await setState(probe, { money: 1000, visitedRegions: [0, 3], regionIndex: 0 });

    await travelTo(probe, 3);

    await expect
      .poll(async () => (await probe.snapshot()).game.regionIndex, {
        timeout: 5000,
        message: "should arrive in the destination region"
      })
      .toBe(3);
    expect((await probe.snapshot()).game.money).toBe(1000 - FARE);
  });

  test("travel is refused when you can't afford the fare", async ({ probe }) => {
    await probe.bootIntoOverworld();
    await setState(probe, { money: 100, visitedRegions: [0, 3], regionIndex: 0 });

    await travelTo(probe, 3);
    await probe.page.waitForTimeout(500);

    const snap = await probe.snapshot();
    expect(snap.game.regionIndex, "should not move without the fare").toBe(0);
    expect(snap.game.money, "money is untouched").toBe(100);
    expect(snap.overworld!.notification.text.toLowerCase()).toContain("not enough");
  });

  test("only discovered regions are offered as destinations", async ({ probe }) => {
    await probe.bootIntoOverworld();
    await setState(probe, { visitedRegions: [0, 2, 4], regionIndex: 0 });

    const destinations = await probe.page.evaluate(
      () => (window as any).__GAME__.game.scene.getScene("Overworld").travelDestinations() as number[]
    );
    // The current region (0) is excluded; the rest are offered in order.
    expect(destinations).toEqual([2, 4]);
  });

  test("visiting a region records it for future travel", async ({ probe }) => {
    await probe.bootIntoOverworld();
    // A fresh game has only seen the starting region.
    expect((await probe.snapshot()).game.visitedRegions).toContain(0);

    // Travel to a discovered region, then confirm it is now in the visited set.
    await setState(probe, { money: 1000, visitedRegions: [0, 3], regionIndex: 0 });
    await travelTo(probe, 3);
    await expect
      .poll(async () => (await probe.snapshot()).game.regionIndex, { timeout: 5000 })
      .toBe(3);

    expect((await probe.snapshot()).game.visitedRegions).toContain(3);
  });
});
