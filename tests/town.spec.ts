import { test, expect } from "./harness/fixtures";

/**
 * Town & gym services on touch: standing on a location and tapping Talk opens a
 * service choice menu whose options open the right screens / battles.
 * (Relies on the harness teleport helpers to reach places deterministically.)
 */
test("tapping Talk in a town opens the service menu", async ({ probe, touch }) => {
  await probe.bootIntoOverworld();
  const town = await probe.teleportToTown(0);
  expect(town, "should have teleported onto a town").toBeTruthy();

  const talk = await probe.touchButton("interact");
  await touch.tap(talk.x, talk.y);

  await expect.poll(async () => (await probe.snapshot()).overworld!.menus.serviceMenuOpen).toBe(true);
  expect((await probe.snapshot()).overworld!.hudVisible, "HUD hidden behind the service menu").toBe(false);
  // The "Visit Mart" service option is present (tagged hit target exists).
  const mart = await probe.uiTarget("service-visit-mart");
  expect(mart.testid).toBe("service-visit-mart");
});

test("the Visit Mart service opens the shop", async ({ probe, touch }) => {
  await probe.bootIntoOverworld();
  await probe.teleportToTown(0);

  const talk = await probe.touchButton("interact");
  await touch.tap(talk.x, talk.y);
  await expect.poll(async () => (await probe.snapshot()).overworld!.menus.serviceMenuOpen).toBe(true);

  const mart = await probe.uiTarget("service-visit-mart");
  await touch.tap(mart.x, mart.y);
  await expect.poll(async () => (await probe.snapshot()).overworld!.menus.martOpen).toBe(true);

  // The shop has 2 pages, so a "Next" pagination button exists. It must sit
  // clearly above the "Leave Shop" close button (they used to overlap).
  const next = await probe.uiTarget("mart-next");
  const close = await probe.uiTarget("close-mart");
  expect(next.y + next.h / 2, "Next button must be above the Leave Shop button")
    .toBeLessThan(close.y - close.h / 2);
});

test("a gym is challengeable on touch", async ({ probe, touch }) => {
  await probe.bootIntoOverworld({ team: [{ speciesId: "charizard", level: 60 }] });
  const gym = await probe.teleportToGym(0);
  expect(gym, "should have teleported onto a gym").toBeTruthy();

  const since = await probe.clearEvents();
  const talk = await probe.touchButton("interact");
  await touch.tap(talk.x, talk.y);

  // Tapping Talk at a gym either offers the battle in the service menu (when the
  // gym shares a town with other services) or starts the gym battle directly
  // (a lone gym). Either way it must be reachable on touch.
  await expect
    .poll(async () => {
      const snap = await probe.snapshot();
      if (snap.overworld!.menus.serviceMenuOpen) {
        return (await probe.uiTargets()).some((t) => t.testid.startsWith("service-battle"));
      }
      return (await probe.events(since)).some((e) => e.type === "battle:active");
    }, { timeout: 12_000, message: "gym was not challengeable via Talk" })
    .toBe(true);
});
