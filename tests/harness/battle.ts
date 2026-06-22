import { expect, type Page } from "@playwright/test";

/**
 * Helpers for driving the Battle scene via touch. The Battle scene isn't part of
 * the window.__GAME__ bridge, so these read its menu items / combatants directly
 * through page.evaluate and tap the on-screen buttons by their live coordinates.
 */

export interface BattleSnapshot {
  active: boolean;
  busy?: boolean;
  playerName?: string;
  playerHp?: number;
  enemyName?: string;
  enemyHp?: number;
  enemyMaxHp?: number;
  rootLabels?: string[];
}

export function battleSnapshot(page: Page): Promise<BattleSnapshot> {
  return page.evaluate(() => {
    const g: any = (window as any).__GAME__.game;
    const active = g.scene.isActive("Battle");
    const bs: any = g.scene.getScene("Battle");
    if (!active || !bs) return { active };
    return {
      active,
      busy: bs.busy,
      playerName: bs.playerMon?.name,
      playerHp: bs.playerMon?.hp,
      enemyName: bs.enemyMon?.name,
      enemyHp: bs.enemyMon?.hp,
      enemyMaxHp: bs.enemyMon?.maxHp,
      rootLabels: (bs.rootMenuItems || []).filter((t: any) => t?.visible).map((t: any) => t.text)
    };
  });
}

/** Tap a Battle-scene menu item whose visible text contains `label`. */
async function tapBattleLabel(page: Page, label: string): Promise<boolean> {
  const coord = await page.evaluate((lbl) => {
    const bs: any = (window as any).__GAME__.game.scene.getScene("Battle");
    if (!bs) return null;
    const pools = [bs.rootMenuItems, bs.moveMenuItems, bs.switchMenuItems, bs.ballMenuItems];
    for (const pool of pools) {
      if (!Array.isArray(pool)) continue;
      const it = pool.find(
        (t: any) => t?.visible && typeof t.text === "string" && t.text.toLowerCase().includes(lbl.toLowerCase())
      );
      if (it) { const m = it.getWorldTransformMatrix(); return { x: Math.round(m.tx), y: Math.round(m.ty) }; }
    }
    return null;
  }, label);
  if (!coord) return false;
  await page.touchscreen.tap(coord.x, coord.y);
  return true;
}

/** Tap the first visible move in the move menu. Returns false if none. */
async function tapFirstMove(page: Page): Promise<boolean> {
  const coord = await page.evaluate(() => {
    const bs: any = (window as any).__GAME__.game.scene.getScene("Battle");
    const pool = bs?.moveMenuItems || [];
    const it = pool.find((t: any) => t?.visible);
    if (!it) return null;
    const m = it.getWorldTransformMatrix();
    return { x: Math.round(m.tx), y: Math.round(m.ty) };
  });
  if (!coord) return false;
  await page.touchscreen.tap(coord.x, coord.y);
  return true;
}

/**
 * Fight (attacking with the first available move each turn) until the battle
 * ends. Designed for a heavily over-levelled team so it wins quickly.
 */
export async function fightUntilOver(page: Page, maxTurns = 15): Promise<void> {
  for (let turn = 0; turn < maxTurns; turn++) {
    await expect
      .poll(async () => {
        const s = await battleSnapshot(page);
        return s.active === false || s.busy === false;
      }, { timeout: 15_000, message: "battle never became ready for input" })
      .toBe(true);

    if (!(await battleSnapshot(page)).active) return;

    if (!(await tapBattleLabel(page, "fight"))) return;
    await page.waitForTimeout(350);
    if (!(await tapFirstMove(page))) {
      // Out of PP on everything: fall back to Struggle if offered.
      await tapBattleLabel(page, "struggle");
    }
    await page.waitForTimeout(600);
  }
}
