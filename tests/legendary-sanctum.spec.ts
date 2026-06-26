import { test, expect } from "./harness/fixtures";

/**
 * Legendary Sanctums: gated, guaranteed legendary encounters reached through a
 * gateway. Replaces the old near-invisible 0.05%-weight biome lottery. A
 * sanctum stays sealed until the player has earned enough badges, fires a
 * single scripted encounter when entered, and falls quiet once claimed.
 *
 * Region 3 (Solstice Isles) holds the Ember Sanctum (Moltres), which opens at
 * 13 badges — a convenient fixture for all three states.
 */
const SOLSTICE = 3;

/** Restart the Overworld in a chosen region with patched progression state. */
async function enterRegion(
  probe: import("./harness/probe").GameProbe,
  regionIndex: number,
  patch: { badges?: number; legendariesCompleted?: Record<string, boolean> }
): Promise<void> {
  await probe.page.evaluate(
    ({ regionIndex, patch }) => {
      const g = (window as any).__GAME__;
      g.gameState.regionIndex = regionIndex;
      g.gameState.badges = Array.from({ length: patch.badges ?? 0 }, (_, i) => `badge-${i}`);
      g.gameState.legendariesCompleted = patch.legendariesCompleted ?? {};
      g.gameState.wildMons = [];
      g.gameState.portalTargetX = undefined;
      g.gameState.portalTargetY = undefined;
      g.game.scene.getScene("Overworld").scene.restart();
    },
    { regionIndex, patch }
  );
  await probe.waitForOverworld();
}

test.describe("legendary sanctums", () => {
  test("a sealed sanctum blocks the encounter until enough badges are earned", async ({ probe }) => {
    await probe.bootIntoOverworld();
    await enterRegion(probe, SOLSTICE, { badges: 5 }); // below the 13-badge seal

    await probe.clearEvents();
    expect(await probe.teleportToSanctum(0)).toBe("sanctum-moltres");
    await probe.page.waitForTimeout(500); // let the proximity check run

    const snap = await probe.snapshot();
    expect(snap.overworld!.inBattle, "no battle should start while sealed").toBe(false);
    expect(snap.battleActive).toBe(false);
    expect(snap.overworld!.notification.text.toLowerCase()).toContain("sealed");

    const events = await probe.events();
    expect(events.some((e) => e.type === "sanctum:enter"), "must not enter a sealed sanctum").toBe(false);
  });

  test("an unlocked sanctum starts a guaranteed legendary battle", async ({ probe }) => {
    await probe.bootIntoOverworld();
    await enterRegion(probe, SOLSTICE, { badges: 13 }); // meets the seal

    await probe.clearEvents();
    await probe.teleportToSanctum(0);
    // Encounter fires on the proximity tick, then a short delay before the battle.
    await probe.page.waitForTimeout(900);

    const events = await probe.events();
    const enter = events.find((e) => e.type === "sanctum:enter");
    expect(enter, "the gateway should trigger a legendary encounter").toBeTruthy();
    expect(enter!.data?.legendary).toBe("moltres");

    await expect
      .poll(async () => (await probe.snapshot()).battleActive, {
        timeout: 5000,
        message: "legendary battle should launch"
      })
      .toBe(true);
  });

  test("a claimed sanctum stays quiet and never re-triggers", async ({ probe }) => {
    await probe.bootIntoOverworld();
    await enterRegion(probe, SOLSTICE, {
      badges: 13,
      legendariesCompleted: { "sanctum-moltres": true }
    });

    await probe.clearEvents();
    await probe.teleportToSanctum(0);
    await probe.page.waitForTimeout(500);

    const snap = await probe.snapshot();
    expect(snap.overworld!.inBattle).toBe(false);
    expect(snap.battleActive).toBe(false);
    expect(snap.overworld!.notification.text.toLowerCase()).toContain("quiet");

    const events = await probe.events();
    expect(events.some((e) => e.type === "sanctum:enter")).toBe(false);
  });
});
