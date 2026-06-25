import { test, expect } from "./harness/fixtures";

/**
 * Regression coverage for the wild-Pokémon movement rewrite.
 *
 * The roaming was changed from a continuous Brownian drift into an idle ↔ hop
 * state machine (eased hops, idle breathing, grounded shadows). Two invariants
 * must survive that change:
 *   1. Mons actually roam (the world feels alive), and
 *   2. Mons never escape their zone (containment still holds), which the
 *      encounter/collision logic depends on.
 *
 * Encounters are suppressed here (a huge cooldown) so battles don't interrupt
 * the observation window — the collision→battle path itself is covered by
 * encounter.spec.ts.
 */
test.describe("wild Pokémon motion", () => {
  test("mons roam but always stay inside their zone", async ({ probe }) => {
    await probe.bootIntoOverworld({ team: [{ speciesId: "charmander", level: 14 }] });

    const snap = await probe.snapshot();
    expect(snap.game.wildMonCount, "region should have spawned wild Pokémon").toBeGreaterThan(0);

    // Suppress encounters so the mons can roam without starting a battle.
    await probe.page.evaluate(() => {
      const ow = (window as any).__GAME__.game.scene.getScene("Overworld");
      ow.encounterCooldown = 9e9;
    });

    const sample = () =>
      probe.page.evaluate(() => {
        const WORLD_SCALE = 32;
        const ow = (window as any).__GAME__.game.scene.getScene("Overworld");
        const mons = (window as any).__GAME__.gameState.wildMons as Array<{
          id: string; x: number; y: number; zoneId: string;
        }>;
        let outside = 0;
        const pos: Record<string, { x: number; y: number }> = {};
        for (const m of mons) {
          pos[m.id] = { x: m.x, y: m.y };
          const z = ow.zoneMap.get(m.zoneId);
          if (!z) continue;
          const d = Math.hypot(m.x - z.x * WORLD_SCALE, m.y - z.y * WORLD_SCALE);
          if (d > z.r * WORLD_SCALE) outside++;
        }
        return { pos, outside, count: mons.length };
      });

    const before = await sample();
    expect(before.outside, "no mon should spawn outside its zone").toBe(0);

    // Let the real game loop run for a couple of seconds of roaming.
    await probe.page.waitForTimeout(2500);

    const after = await sample();

    // Containment invariant: still nobody outside their zone after roaming.
    expect(after.outside, "no mon should wander outside its zone").toBe(0);

    // Liveliness: a meaningful share of mons should have moved.
    let moved = 0;
    for (const id of Object.keys(before.pos)) {
      const a = after.pos[id];
      if (!a) continue;
      const d = Math.hypot(a.x - before.pos[id].x, a.y - before.pos[id].y);
      if (d > 2) moved++;
    }
    expect(moved, "wild Pokémon should roam over time").toBeGreaterThan(0);
  });
});
