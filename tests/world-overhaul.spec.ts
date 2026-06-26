import { test, expect } from "./harness/fixtures";
import type { GameProbe } from "./harness/probe";

/**
 * World overhaul invariants:
 *  - walkable land matches the painted footprint (the ellipse/blob "looks
 *    walkable but isn't" bug is gone),
 *  - new games start in Pallet Town on walkable land,
 *  - every region is one connected walkable landmass — you can actually walk
 *    from the start to every town (open-world roaming).
 */

const REGION_COUNT = 6;

/** Restart the Overworld in a chosen region as a clean fresh game. */
async function enterRegion(probe: GameProbe, regionIndex: number): Promise<void> {
  await probe.page.evaluate((regionIndex) => {
    const g = (window as any).__GAME__;
    g.gameState.regionIndex = regionIndex;
    g.gameState.wildMons = [];
    g.gameState.portalTargetX = undefined;
    g.gameState.portalTargetY = undefined;
    g.gameState.lastPlayerX = undefined;
    g.gameState.lastPlayerY = undefined;
    g.game.scene.getScene("Overworld").scene.restart();
  }, regionIndex);
  await probe.waitForOverworld();
}

test.describe("world overhaul", () => {
  test("walkable area matches the painted footprint for every zone shape", async ({ probe }) => {
    await probe.bootIntoOverworld();

    // For each zone, its centre and a point near its painted footprint edge
    // must be walkable; a point far out in open ocean must not be.
    const report = await probe.page.evaluate(() => {
      const g = (window as any).__GAME__;
      const ow = g.game.scene.getScene("Overworld");
      const info = g.regionInfo();
      const failures: string[] = [];
      for (const z of info.zones) {
        if (!g.isWalkable(z.x, z.y)) failures.push(`${z.id}: centre not walkable`);
        // The painter draws each zone's footprint discs; sample inside each one.
        const discs = ow.zoneFootprintDiscs(
          { id: z.id, x: z.x / 32, y: z.y / 32, r: z.r / 32 },
          1
        );
        for (const d of discs) {
          if (!g.isWalkable(d.cx, d.cy)) failures.push(`${z.id}: a painted disc centre is not walkable`);
        }
      }
      // A point far below the world (deep ocean) must be blocked.
      const oceanY = info.bounds.y + info.bounds.height + 2000;
      const oceanWalkable = g.isWalkable(info.bounds.x + info.bounds.width / 2, oceanY);
      return { failures, oceanWalkable };
    });

    expect(report.failures, report.failures.join("\n")).toEqual([]);
    expect(report.oceanWalkable, "open ocean must not be walkable").toBe(false);
  });

  test("a new game starts in Pallet Town on walkable land", async ({ probe }) => {
    await probe.bootIntoOverworld();

    const snap = await probe.snapshot();
    // Pallet Town logical (-44, 30) → world (-1408, 960).
    expect(snap.game.regionIndex).toBe(0);
    expect(snap.overworld!.player.x).toBeGreaterThan(-1460);
    expect(snap.overworld!.player.x).toBeLessThan(-1360);
    expect(snap.overworld!.player.y).toBeGreaterThan(910);
    expect(snap.overworld!.player.y).toBeLessThan(1010);

    const startWalkable = await probe.page.evaluate(() => {
      const g = (window as any).__GAME__;
      const ow = g.game.scene.getScene("Overworld");
      return g.isWalkable(ow.player.x, ow.player.y);
    });
    expect(startWalkable, "the start must be on walkable land").toBe(true);
  });

  test("every region is one connected landmass reachable from the start", async ({ probe }) => {
    await probe.bootIntoOverworld();

    for (let region = 0; region < REGION_COUNT; region++) {
      await enterRegion(probe, region);

      const result = await probe.page.evaluate(() => {
        const g = (window as any).__GAME__;
        const ow = g.game.scene.getScene("Overworld");
        const info = g.regionInfo();
        const start = info.start ?? { x: ow.player.x, y: ow.player.y };

        // Flood-fill the walkable map on a coarse grid from the start.
        const STEP = 16;
        const b = info.bounds;
        const minX = b.x, minY = b.y;
        const cols = Math.ceil(b.width / STEP) + 1;
        const rows = Math.ceil(b.height / STEP) + 1;
        const key = (cx: number, cy: number) => cy * cols + cx;
        const visited = new Set<number>();
        const sx = Math.round((start.x - minX) / STEP);
        const sy = Math.round((start.y - minY) / STEP);
        const queue: Array<[number, number]> = [[sx, sy]];
        visited.add(key(sx, sy));
        while (queue.length) {
          const [cx, cy] = queue.pop()!;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
            const k = key(nx, ny);
            if (visited.has(k)) continue;
            const wx = minX + nx * STEP, wy = minY + ny * STEP;
            if (!g.isWalkable(wx, wy)) continue;
            visited.add(k);
            queue.push([nx, ny]);
          }
        }

        // Every town must be reachable from the start by walking.
        const unreachable: string[] = [];
        for (const t of info.towns) {
          const tx = Math.round((t.x - minX) / STEP);
          const ty = Math.round((t.y - minY) / STEP);
          // Accept reaching any cell within one step of the town centre.
          let near = false;
          for (let ox = -1; ox <= 1 && !near; ox++) {
            for (let oy = -1; oy <= 1 && !near; oy++) {
              if (visited.has(key(tx + ox, ty + oy))) near = true;
            }
          }
          if (!near) unreachable.push(t.id);
        }
        return { regionId: info.id, unreachable };
      });

      expect(result.unreachable, `${result.regionId}: unreachable towns ${result.unreachable.join(", ")}`).toEqual([]);
    }
  });
});
