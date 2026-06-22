import { test, expect } from "./harness/fixtures";

/**
 * Town services on touch: standing on a town and tapping Talk opens a service
 * choice menu, and its options actually open the corresponding screens.
 * (Relies on the harness teleport helper to reach a town deterministically.)
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
});
