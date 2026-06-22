import { test, expect } from "./harness/fixtures";
import type { GameProbe } from "./harness/probe";
import type { TouchDriver } from "./harness/touch";

/**
 * Regression coverage for the two menu issues:
 *  1. "I still see the HUD" — the overworld HUD bled through on top of open
 *     menus. Contract: whenever a menu/overlay is open, the HUD is hidden;
 *     when it closes, the HUD comes back.
 *  2. Inconsistent close UX — the map used to close via a tiny corner ✕ while
 *     other menus used a labelled bottom button. Contract: every menu exposes a
 *     consistent, tappable close button (tagged `close-*`) that returns the
 *     game to a clean overworld state.
 *
 * Menus are opened with the real on-screen toolbar buttons and closed with the
 * menu's own in-panel close button (the toolbar is hidden while a menu is up),
 * exactly as a phone user would. The open/close helpers re-read coordinates and
 * re-tap each poll iteration, so they are robust to the viewport settling/
 * resizing shortly after load (which moves elements) — just like a user who
 * taps again if the first tap misses.
 */

/** Tap the toolbar button until `flag` reports the menu is open. */
async function openMenu(probe: GameProbe, touch: TouchDriver, buttonId: string, flag: string) {
  await expect
    .poll(async () => {
      const snap = await probe.snapshot();
      if (snap.overworld!.menus[flag]) return true;
      const btn = await probe.touchButton(buttonId);
      await touch.tap(btn.x, btn.y);
      return (await probe.snapshot()).overworld!.menus[flag];
    }, { message: `menu "${flag}" never opened` })
    .toBe(true);
}

/** Tap the in-panel close button until `flag` reports the menu is closed. */
async function closeMenu(probe: GameProbe, touch: TouchDriver, closeId: string, flag: string) {
  await expect
    .poll(async () => {
      const snap = await probe.snapshot();
      if (!snap.overworld!.menus[flag]) return false;
      try {
        const t = await probe.uiTarget(closeId);
        await touch.tap(t.x, t.y);
      } catch {
        /* close button briefly absent during a re-render; retry */
      }
      return (await probe.snapshot()).overworld!.menus[flag];
    }, { message: `menu "${flag}" never closed` })
    .toBe(false);
}

const MENUS = [
  { name: "Team", button: "team", flag: "teamOpen", closeId: "close-team" },
  { name: "Map", button: "map", flag: "mapOpen", closeId: "close-map" }
] as const;

for (const menu of MENUS) {
  test(`${menu.name}: HUD hides while open and returns on close`, async ({ probe, touch }) => {
    await probe.bootIntoOverworld();
    expect((await probe.snapshot()).overworld!.hudVisible).toBe(true);

    await openMenu(probe, touch, menu.button, menu.flag);
    expect(
      (await probe.snapshot()).overworld!.hudVisible,
      `HUD must hide behind ${menu.name}`
    ).toBe(false);

    await closeMenu(probe, touch, menu.closeId, menu.flag);
    const snap = await probe.snapshot();
    expect(snap.overworld!.anyMenuOpen, `${menu.name} should be fully closed`).toBe(false);
    expect(snap.overworld!.hudVisible, `HUD must return after closing ${menu.name}`).toBe(true);
  });

  test(`${menu.name}: exposes a consistent bottom close button`, async ({ probe, touch }) => {
    await probe.bootIntoOverworld();
    await openMenu(probe, touch, menu.button, menu.flag);

    // The labelled close button must exist and sit in the lower half of the
    // screen (a bottom bar), not as a tiny corner glyph.
    const target = await probe.uiTarget(menu.closeId);
    const { height } = await probe.gameSize();
    expect(
      target.y,
      `${menu.name} close button should be a bottom bar, not a corner glyph`
    ).toBeGreaterThan(height / 2);
  });
}

test("HUD is hidden while the pause menu is open", async ({ probe, touch }) => {
  await probe.bootIntoOverworld();
  await expect
    .poll(async () => {
      const snap = await probe.snapshot();
      if (snap.overworld!.isPaused) return true;
      const btn = await probe.touchButton("menu");
      await touch.tap(btn.x, btn.y);
      return (await probe.snapshot()).overworld!.isPaused;
    })
    .toBe(true);
  expect((await probe.snapshot()).overworld!.hudVisible, "HUD must hide while paused").toBe(false);
});
