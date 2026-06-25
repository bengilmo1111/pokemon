import { test, expect } from "./harness/fixtures";

/**
 * Mobile viewport robustness: orientation handling and the fullscreen control.
 *
 * The orientation bug: Phaser refreshes the canvas synchronously when the
 * `orientationchange` event fires, but on a phone that arrives before the
 * viewport has finished resizing — so the canvas reads stale dimensions and
 * sticks at the wrong (half) size. src/game/viewport.ts fixes this by re-running
 * scale.refresh() a few times *after* the viewport settles. These tests assert
 * those follow-up refreshes actually run and that the canvas resyncs to the
 * viewport.
 */

test("orientation change schedules settle-retry refreshes", async ({ probe }) => {
  await probe.bootIntoOverworld();

  // Spy on the scale manager's refresh() so we can count how many times the
  // canvas is re-fitted after a single orientationchange event.
  await probe.page.evaluate(() => {
    const scale = (window as any).__GAME__.game.scale;
    (window as any).__refreshCount = 0;
    const original = scale.refresh.bind(scale);
    scale.refresh = (...args: unknown[]) => {
      (window as any).__refreshCount += 1;
      return original(...args);
    };
  });

  await probe.page.evaluate(() => window.dispatchEvent(new Event("orientationchange")));

  // viewport.ts re-fits on the next frame plus a short cadence (120/300/500ms);
  // without the fix only Phaser's single synchronous refresh (if any) happens.
  await expect
    .poll(() => probe.page.evaluate(() => (window as any).__refreshCount as number), {
      timeout: 4_000,
      message: "orientationchange did not trigger settle-retry refreshes"
    })
    .toBeGreaterThanOrEqual(2);
});

test("fullscreen control is wired up where the browser supports it", async ({ probe }) => {
  await probe.bootIntoOverworld();

  const available = await probe.page.evaluate(
    () => (window as any).__GAME__.game.scale.fullscreen.available as boolean
  );

  const buttons = await probe.touchButtons();
  const hasButton = buttons.some((b) => b.id === "fullscreen");
  expect(hasButton).toBe(available);

  if (!available) return;

  // Tapping the button must call toggleFullscreen synchronously (the browser
  // rejects fullscreen requests made outside a user gesture).
  await probe.page.evaluate(() => {
    const scale = (window as any).__GAME__.game.scale;
    (window as any).__toggleCalls = 0;
    scale.toggleFullscreen = () => { (window as any).__toggleCalls += 1; };
  });

  await probe.page.evaluate(() => {
    const scene: any = (window as any).__GAME__.game.scene.getScene("Overworld");
    const entry = scene.touch.buttons.find((b: any) => b.cfg.id === "fullscreen");
    entry.bg.emit("pointerdown", {}, 0, 0, { stopPropagation() {} });
  });

  const calls = await probe.page.evaluate(() => (window as any).__toggleCalls as number);
  expect(calls).toBe(1);
});
