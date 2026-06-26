import { test, expect } from "./harness/fixtures";

/**
 * Regression: the on-screen touch controls vanished after going through a region
 * portal and never came back. The scene-restart / arrival-encounter transitions
 * could leave the controls hidden with nothing restoring them. The overworld now
 * reconciles control visibility every tick, so they can never stay wrongly hidden
 * during normal play.
 */

const allButtonsVisible = (probe: import("./harness/probe").GameProbe) =>
  probe.page.evaluate(() => {
    const ow = (window as any).__GAME__.game.scene.getScene("Overworld");
    const btns = ow?.touch?.buttons ?? [];
    return btns.length > 0 && btns.every((b: any) => b.bg.visible);
  });

test.describe("touch controls", () => {
  test("controls recover if left hidden during overworld play", async ({ probe }) => {
    await probe.bootIntoOverworld();
    expect(await allButtonsVisible(probe)).toBe(true);

    // Simulate any transition (portal restart, arrival encounter, …) that left
    // the controls hidden without restoring them. The per-tick reconcile must
    // bring them back during normal overworld play (it restores within a frame,
    // so we assert the controls do not stay hidden).
    await probe.page.evaluate(() => {
      (window as any).__GAME__.game.scene.getScene("Overworld").touch.setVisible(false);
    });
    await expect.poll(() => allButtonsVisible(probe), {
      timeout: 4000,
      message: "controls should be restored automatically"
    }).toBe(true);
  });

  test("controls stay hidden while a menu is open", async ({ probe }) => {
    await probe.bootIntoOverworld();
    await expect.poll(() => allButtonsVisible(probe), { timeout: 4000 }).toBe(true);

    // Open a menu; controls must hide and stay hidden (reconcile must respect it).
    await probe.page.evaluate(() => {
      (window as any).__GAME__.game.scene.getScene("Overworld").mapOpen = true;
    });
    await expect.poll(() => allButtonsVisible(probe), {
      timeout: 4000,
      message: "controls should hide while a menu is open"
    }).toBe(false);

    // Close it; controls must return.
    await probe.page.evaluate(() => {
      (window as any).__GAME__.game.scene.getScene("Overworld").mapOpen = false;
    });
    await expect.poll(() => allButtonsVisible(probe), {
      timeout: 4000,
      message: "controls should return when the menu closes"
    }).toBe(true);
  });

  test("controls are restored after a region portal transition", async ({ probe }) => {
    await probe.bootIntoOverworld();

    await probe.page.evaluate(() => {
      const ow = (window as any).__GAME__.game.scene.getScene("Overworld");
      ow.triggerPortalTransition({
        id: "t", name: "t", x: 0, y: 0,
        targetRegionIndex: 1, targetX: 0, targetY: 0, color: 0x9f5bff
      });
    });
    await probe.page.waitForFunction(
      () => (window as any).__GAME__.gameState.regionIndex === 1,
      undefined, { timeout: 15000 }
    );

    // Keep the arrival area clear of wild Pokémon so no encounter battle pauses
    // the (restarted) scene; the per-tick reconcile must then keep the controls
    // shown during normal overworld play in the new region.
    await expect.poll(async () => {
      return probe.page.evaluate(() => {
        const g = (window as any).__GAME__;
        const ow = g.game.scene.getScene("Overworld");
        ow.encounterCooldown = 9e9;
        g.gameState.wildMons = [];
        const btns = ow?.touch?.buttons ?? [];
        return g.snapshot().battleActive === false && btns.length > 0 && btns.every((b: any) => b.bg.visible);
      });
    }, {
      timeout: 6000,
      message: "controls must be visible after arriving through a portal"
    }).toBe(true);
  });

  test("portals still work after the first transition", async ({ probe }) => {
    await probe.bootIntoOverworld();

    // First portal: Kanto (0) -> region 1.
    await probe.page.evaluate(() => {
      const ow = (window as any).__GAME__.game.scene.getScene("Overworld");
      ow.triggerPortalTransition({ id: "a", name: "a", x: 0, y: 0, targetRegionIndex: 1, targetX: 0, targetY: 0, color: 0x9f5bff });
    });
    await probe.page.waitForFunction(() => (window as any).__GAME__.gameState.regionIndex === 1, undefined, { timeout: 15000 });

    // portalTransitioning must have reset, so a second portal still fires
    // (it used to stay true across the scene restart, freezing all portals).
    const stuck = await probe.page.evaluate(() => (window as any).__GAME__.game.scene.getScene("Overworld").portalTransitioning);
    expect(stuck, "portalTransitioning must reset after a transition").toBe(false);

    await probe.page.evaluate(() => {
      const ow = (window as any).__GAME__.game.scene.getScene("Overworld");
      ow.triggerPortalTransition({ id: "b", name: "b", x: 0, y: 0, targetRegionIndex: 2, targetX: 0, targetY: 0, color: 0x9f5bff });
    });
    await probe.page.waitForFunction(() => (window as any).__GAME__.gameState.regionIndex === 2, undefined, { timeout: 15000 });
    expect((await probe.snapshot()).game.regionIndex).toBe(2);
  });
});
