import { expect, type Page } from "@playwright/test";
import type { GameSnapshot, TeamSpec, TestEvent, TouchButton } from "./types";

/**
 * GameProbe — a typed window into the running game via the in-game test bridge
 * (window.__GAME__). Everything here reads/controls real game state, so tests
 * assert on the state machine ("a battle is active", "no save fired") instead
 * of pixels.
 *
 * All methods run inside the page via page.evaluate.
 */
export class GameProbe {
  constructor(public readonly page: Page) {}

  /** Wait until the test bridge has been installed on window. */
  async waitForBridge(): Promise<void> {
    await this.page.waitForFunction(() => Boolean((window as any).__GAME__), undefined, {
      timeout: 15_000
    });
  }

  /** Current structured snapshot of scenes + game state. */
  snapshot(): Promise<GameSnapshot> {
    return this.page.evaluate(() => (window as any).__GAME__.snapshot() as GameSnapshot);
  }

  /** The Phaser canvas/scale size (CSS px), which the UI is laid out against. */
  gameSize(): Promise<{ width: number; height: number }> {
    return this.page.evaluate(() => {
      const g = (window as any).__GAME__.game;
      return { width: g.scale.width, height: g.scale.height };
    });
  }

  /** Recorded semantic events, optionally only those after `sinceSeq`. */
  events(sinceSeq = 0): Promise<TestEvent[]> {
    return this.page.evaluate((s) => (window as any).__GAME__.events(s) as TestEvent[], sinceSeq);
  }

  /** Clear the event log; returns the seq it was cleared at. */
  clearEvents(): Promise<number> {
    return this.page.evaluate(() => (window as any).__GAME__.clearEvents() as number);
  }

  /** Reset + boot straight into the Overworld with a known team and seed. */
  async bootIntoOverworld(opts?: { team?: TeamSpec[]; seed?: number }): Promise<void> {
    await this.page.evaluate((o) => (window as any).__GAME__.bootIntoOverworld(o), opts ?? {});
    await this.waitForOverworld();
  }

  /** Wait until the Overworld scene is live and no menu/modal is open. */
  async waitForOverworld(): Promise<void> {
    await expect
      .poll(async () => {
        const s = await this.snapshot();
        return Boolean(s.overworld) && !s.overworld!.anyMenuOpen && s.activeScenes.includes("Overworld");
      }, { timeout: 20_000, message: "Overworld did not become ready" })
      .toBe(true);
    // The RESIZE scale mode settles a beat after load; taps land in the wrong
    // place until the canvas size stops changing, so wait for it to stabilise.
    await this.waitForStableGameSize();
  }

  /** Resolve once the Phaser canvas size has been unchanged for `stableMs`. */
  async waitForStableGameSize(stableMs = 350, timeout = 8_000): Promise<void> {
    const start = Date.now();
    let last = "";
    let lastChange = Date.now();
    while (Date.now() - start < timeout) {
      const s = await this.gameSize();
      const key = `${s.width}x${s.height}`;
      if (key !== last) { last = key; lastChange = Date.now(); }
      else if (Date.now() - lastChange >= stableMs) return;
      await this.page.waitForTimeout(100);
    }
  }

  giveTeam(team: TeamSpec[]): Promise<void> {
    return this.page.evaluate((t) => (window as any).__GAME__.giveTeam(t), team);
  }

  faintTeam(): Promise<void> {
    return this.page.evaluate(() => (window as any).__GAME__.faintTeam());
  }

  healTeam(): Promise<void> {
    return this.page.evaluate(() => (window as any).__GAME__.healTeam());
  }

  /** Deterministically trigger a wild encounter through the real collision path. */
  forceEncounter(): Promise<string | null> {
    return this.page.evaluate(() => (window as any).__GAME__.forceEncounter() as string | null);
  }

  /** Screen-space positions of the on-screen touch buttons. */
  touchButtons(): Promise<TouchButton[]> {
    return this.page.evaluate(() => (window as any).__GAME__.touchButtons() as TouchButton[]);
  }

  /** Screen-space centres of UI elements tagged with a testid (e.g. close buttons). */
  uiTargets(): Promise<Array<{ testid: string; x: number; y: number }>> {
    return this.page.evaluate(() => (window as any).__GAME__.uiTargets() as Array<{ testid: string; x: number; y: number }>);
  }

  /** Look up one tagged UI target by testid (e.g. "close-map"). */
  async uiTarget(testid: string): Promise<{ testid: string; x: number; y: number }> {
    const all = await this.uiTargets();
    const found = all.find((t) => t.testid === testid);
    if (!found) {
      throw new Error(`UI target "${testid}" not visible. Visible: ${all.map((t) => t.testid).join(", ") || "(none)"}`);
    }
    return found;
  }

  /** Look up one touch button by id. */
  async touchButton(id: string): Promise<TouchButton> {
    const all = await this.touchButtons();
    const found = all.find((b) => b.id === id);
    if (!found) {
      throw new Error(`Touch button "${id}" not found. Available: ${all.map((b) => b.id).join(", ")}`);
    }
    return found;
  }

  /** Wait for a semantic event of `type` to appear after `sinceSeq`. */
  async waitForEvent(type: string, opts?: { sinceSeq?: number; timeout?: number }): Promise<TestEvent> {
    const since = opts?.sinceSeq ?? 0;
    let match: TestEvent | undefined;
    await expect
      .poll(async () => {
        const evts = await this.events(since);
        match = evts.find((e) => e.type === type);
        return Boolean(match);
      }, { timeout: opts?.timeout ?? 8_000, message: `event "${type}" never fired` })
      .toBe(true);
    return match!;
  }

  /** Assert no event of `type` occurs within `windowMs` (after `sinceSeq`). */
  async expectNoEvent(type: string, opts?: { sinceSeq?: number; windowMs?: number }): Promise<void> {
    const since = opts?.sinceSeq ?? 0;
    await this.page.waitForTimeout(opts?.windowMs ?? 1500);
    const evts = await this.events(since);
    const hit = evts.filter((e) => e.type === type);
    expect(hit, `expected no "${type}" events but saw ${hit.length}`).toHaveLength(0);
  }

  /** Count events of a given type after `sinceSeq`. */
  async countEvents(type: string, sinceSeq = 0): Promise<number> {
    const evts = await this.events(sinceSeq);
    return evts.filter((e) => e.type === type).length;
  }
}
