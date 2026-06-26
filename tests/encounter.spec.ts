import { test, expect } from "./harness/fixtures";

/**
 * Regression coverage for the wild-encounter / auto-save loop.
 *
 * The reported bug: "walking into wild Pokémon doesn't result in battle, but a
 * triggering of auto-save instead. Once this happens, no more wild battles
 * occur — only constant saves."
 *
 * Root cause found via the harness: losing a wild battle never healed the team
 * (only trainer/gym losses did), so the team stayed fainted. Every subsequent
 * encounter hit Battle.create()'s `!playerMon` guard, instant-escaped, resumed
 * the overworld, and fired an auto-save — forever.
 */
test.describe("wild encounters", () => {
  test("a healthy team's encounter starts a real battle, not a save", async ({ probe }) => {
    await probe.bootIntoOverworld({ team: [{ speciesId: "charmander", level: 14 }] });

    const snap = await probe.snapshot();
    expect(snap.game.anyAliveTeamMember, "team should be alive after boot").toBe(true);
    expect(snap.game.wildMonCount, "region should have spawned wild Pokémon").toBeGreaterThan(0);

    const since = await probe.clearEvents();
    const wildId = await probe.forceEncounter();
    expect(wildId, "forceEncounter should find a wild Pokémon").not.toBeNull();

    // The real collision path should produce: encounter -> battle launch -> active.
    await probe.waitForEvent("encounter:trigger", { sinceSeq: since });
    await probe.waitForEvent("battle:active", { sinceSeq: since });

    const after = await probe.snapshot();
    expect(after.battleActive, "Battle scene should be running").toBe(true);

    // And crucially must NOT have instant-escaped or auto-saved.
    expect(await probe.countEvents("battle:instant-escape", since)).toBe(0);
    expect(await probe.countEvents("save:fired", since)).toBe(0);
  });

  test("a fully fainted team never enters the save loop (regression)", async ({ probe }) => {
    await probe.bootIntoOverworld({ team: [{ speciesId: "charmander", level: 14 }] });
    await probe.faintTeam();

    let snap = await probe.snapshot();
    expect(snap.game.anyAliveTeamMember, "team should start fainted for this test").toBe(false);

    const since = await probe.clearEvents();
    await probe.forceEncounter();

    // Give the game plenty of update ticks to misbehave the old way.
    await probe.expectNoEvent("save:fired", { sinceSeq: since, windowMs: 2500 });

    // No instant-escape battle, no battle at all — the encounter is blocked and
    // the team is recovered (mirrors a battle defeat) instead of looping.
    expect(await probe.countEvents("battle:instant-escape", since)).toBe(0);
    expect(await probe.countEvents("battle:active", since)).toBe(0);
    expect(await probe.countEvents("encounter:blocked", since)).toBeGreaterThan(0);

    snap = await probe.snapshot();
    expect(snap.battleActive).toBe(false);
    expect(snap.game.anyAliveTeamMember, "team should be recovered, not stuck fainted").toBe(true);
  });

  test("wild Pokémon respawn over time after encounters deplete them", async ({ probe }) => {
    await probe.bootIntoOverworld({ team: [{ speciesId: "charmander", level: 14 }], seed: 7 });

    const initial = (await probe.snapshot()).game.wildMonCount;
    expect(initial, "region should start with wild Pokémon").toBeGreaterThan(0);

    const since = await probe.clearEvents();
    await probe.page.evaluate(() => {
      const scene = (window as any).__GAME__.game.scene.getScene("Overworld") as any;
      for (const sprite of scene.wildSprites.values()) {
        sprite.shadow?.destroy();
        sprite.destroy();
      }
      scene.wildSprites.clear();
      scene.wildAnim.clear();
      (window as any).__GAME__.gameState.wildMons = [];
      scene.wildRespawnTimer = 30_000;
    });

    await probe.waitForEvent("wild:respawn", { sinceSeq: since });
    expect((await probe.snapshot()).game.wildMonCount, "a depleted map should repopulate").toBeGreaterThan(0);
  });
});
