import { test, expect } from "./harness/fixtures";

/**
 * Regression coverage for resuming a saved game at the nearest town.
 *
 * Previously a resumed game always spawned at the new-game start
 * (region.zones[0]). Now the player's position is persisted and, on resume,
 * they are placed at the town nearest where they last saved.
 *
 * Kanto's Lavender Town sits at logical (30, 2) → world px (960, 64) and has a
 * Pokémon Center, so a last-saved position right there must resume exactly
 * there — not at the default Route 1 start (logical -40,20 → -1280,640).
 */
test("resuming spawns at the town nearest the last-saved position", async ({ probe }) => {
  await probe.bootIntoOverworld({ team: [{ speciesId: "charmander", level: 14 }] });

  // Stand the player next to Lavender Town (logical ~28,3) and re-enter the
  // scene the way a resume does (create() runs again). We move the live player
  // too, because the overworld continuously records its position as the
  // last-saved point each frame.
  await probe.page.evaluate(() => {
    const g = (window as any).__GAME__;
    const ow = g.game.scene.getScene("Overworld");
    ow.player.setPosition(900, 100);
    g.gameState.lastPlayerX = 900;
    g.gameState.lastPlayerY = 100;
    g.gameState.portalTargetX = undefined;
    g.gameState.portalTargetY = undefined;
    ow.scene.restart();
  });

  // Wait until the restarted scene has placed the player at Lavender Town
  // (logical 30,2 → world px 960,64). Read both coordinates atomically and
  // tolerate transient frames where the snapshot has no overworld yet.
  await expect
    .poll(async () => probe.page.evaluate(() => {
      const p = (window as any).__GAME__.snapshot().overworld?.player;
      return p ? `${Math.round(p.x)},${Math.round(p.y)}` : null;
    }), { timeout: 10_000 })
    .toBe("960,64");
});
