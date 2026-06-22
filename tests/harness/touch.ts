import type { CDPSession, Page } from "@playwright/test";

/** A direction vector for joystick movement (screen axes: +y is down/south). */
export interface Dir {
  x: number;
  y: number;
}

export const DIR = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
} as const;

/**
 * TouchDriver — drives the game with synthetic touch events, the way a phone
 * user's thumb would. Taps the on-screen buttons and drags the virtual
 * joystick. Uses CDP Input.dispatchTouchEvent so multi-step touch drags (which
 * page.touchscreen can't express) work for the joystick.
 */
export class TouchDriver {
  private constructor(private readonly page: Page, private readonly cdp: CDPSession) {}

  static async create(page: Page): Promise<TouchDriver> {
    const cdp = await page.context().newCDPSession(page);
    return new TouchDriver(page, cdp);
  }

  /** A single tap at screen coordinates. */
  async tap(x: number, y: number): Promise<void> {
    await this.cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }]
    });
    await this.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }

  /**
   * Hold the virtual joystick deflected in `dir` for `ms`, so the player walks
   * that way. The joystick activates wherever a non-button touch begins; we
   * start it in the lower-left play area and deflect toward the direction.
   */
  async walk(dir: Dir, ms = 700): Promise<void> {
    const vp = this.page.viewportSize() ?? { width: 412, height: 915 };
    const ox = Math.min(120, vp.width * 0.28);
    const oy = vp.height - 140;
    const reach = 70;
    const tx = ox + dir.x * reach;
    const ty = oy + dir.y * reach;

    await this.cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: ox, y: oy }]
    });
    // Deflect; the game reads the axis continuously and integrates each frame.
    await this.cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: tx, y: ty }]
    });
    await this.page.waitForTimeout(ms);
    await this.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }

  /** Drag from one point to another over `ms` (e.g. for custom gestures). */
  async drag(fromX: number, fromY: number, toX: number, toY: number, ms = 400, steps = 8): Promise<void> {
    await this.cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: fromX, y: fromY }]
    });
    for (let i = 1; i <= steps; i++) {
      const x = fromX + ((toX - fromX) * i) / steps;
      const y = fromY + ((toY - fromY) * i) / steps;
      await this.cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
      await this.page.waitForTimeout(ms / steps);
    }
    await this.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
}
