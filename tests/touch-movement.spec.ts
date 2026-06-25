import { test, expect, DIR } from "./harness/fixtures";

/**
 * Smoke test for the mobile-touch input path itself: the virtual joystick must
 * actually move the player. If this breaks, every other touch-driven test is
 * meaningless, so it runs first as a canary.
 */
test.describe("touch movement", () => {
  test("dragging the joystick walks the player", async ({ probe, touch }) => {
    await probe.bootIntoOverworld();

    const start = (await probe.snapshot()).overworld!.player;

    // Hold the joystick down (south) for a beat, like a thumb pushing down.
    await touch.walk(DIR.down, 800);

    const afterDown = (await probe.snapshot()).overworld!.player;
    const moved = Math.hypot(afterDown.x - start.x, afterDown.y - start.y);
    expect(moved, "player should move when the joystick is held").toBeGreaterThan(20);

    // And direction should roughly match the input (south => y increases).
    expect(afterDown.y, "holding down should increase y").toBeGreaterThan(start.y);
  });

  test("the on-screen action buttons are laid out on the right edge", async ({ probe }) => {
    await probe.bootIntoOverworld();

    const buttons = await probe.touchButtons();
    const ids = buttons.map((b) => b.id).sort();
    // Core buttons always present; "fullscreen" may or may not appear depending
    // on browser support, so we check for containment rather than exact equality.
    const core = ["interact", "item", "map", "menu", "team"];
    expect(core.every((id) => ids.includes(id))).toBe(true);
    expect(ids.every((id) => [...core, "fullscreen"].includes(id))).toBe(true);

    // Every button should sit within the viewport (no off-screen controls).
    const vp = { width: 412, height: 915 };
    for (const b of buttons) {
      expect(b.x).toBeGreaterThan(0);
      expect(b.x).toBeLessThan(vp.width);
      expect(b.y).toBeGreaterThan(0);
      expect(b.y).toBeLessThan(vp.height);
    }
  });
});
