import { test, expect } from "./harness/fixtures";
import type { UiTarget } from "./harness/types";

/**
 * Regression for map label overlap: town/gym/portal names used to render on top
 * of each other in dense regions (Saffron/Vermilion/Lavender/Celadon, etc.),
 * making them unreadable. A greedy de-collision pass now nudges labels apart.
 */

function intersects(a: UiTarget, b: UiTarget, tol = 2): boolean {
  const ox = Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2);
  const oy = Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2);
  return ox > tol && oy > tol;
}

test("map labels do not overlap each other", async ({ probe, touch }) => {
  await probe.bootIntoOverworld();

  // Open the map via its toolbar button.
  await expect
    .poll(async () => {
      const s = await probe.snapshot();
      if (s.overworld!.menus.mapOpen) return true;
      const btn = await probe.touchButton("map");
      await touch.tap(btn.x, btn.y);
      return (await probe.snapshot()).overworld!.menus.mapOpen;
    })
    .toBe(true);

  const labels = (await probe.uiTargets()).filter((t) => t.testid === "map-label");
  expect(labels.length, "Kanto should render many town/gym labels").toBeGreaterThan(6);

  const overlapping: Array<[number, number]> = [];
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      if (intersects(labels[i], labels[j])) overlapping.push([i, j]);
    }
  }
  expect(overlapping, `overlapping label pairs: ${overlapping.length}`).toHaveLength(0);
});
