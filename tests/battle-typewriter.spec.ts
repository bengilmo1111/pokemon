import { test, expect } from "./harness/fixtures";
import { battleSnapshot } from "./harness/battle";

/**
 * Typewriter battle text. setMessage reveals a line character-by-character at the
 * configured text speed; a tap (completeMessage) shows the whole line at once.
 * Read-aloud still speaks the full line immediately (covered in narration.spec).
 */

const readMsg = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const bs: any = (window as any).__GAME__.game.scene.getScene("Battle");
    return { text: bs.messageText.text as string, typing: bs.isTyping as boolean };
  });

async function enterBattle(probe: any, page: import("@playwright/test").Page) {
  await probe.bootIntoOverworld({ team: [{ speciesId: "charizard", level: 50 }] });
  await probe.forceEncounter();
  await probe.waitForEvent("battle:active");
  await expect.poll(async () => (await battleSnapshot(page)).busy === false).toBe(true);
}

test("a line reveals gradually and can be skipped to full", async ({ probe, page }) => {
  await enterBattle(probe, page);

  const LINE = "A slow message reveals letter by letter here!";
  await page.evaluate((line) => {
    const api: any = (window as any).__GAME__;
    api.setTextSpeed("slow");
    api.game.scene.getScene("Battle").setMessage(line);
  }, LINE);

  // Mid-reveal: still typing and not yet the whole line.
  const a = await readMsg(page);
  expect(a.typing, "should be typing").toBe(true);
  expect(a.text.length, "only part shown so far").toBeLessThan(LINE.length);
  expect(LINE.startsWith(a.text), "reveals the line in order").toBe(true);

  // It keeps revealing more characters over time.
  await page.waitForTimeout(250);
  const b = await readMsg(page);
  expect(b.text.length).toBeGreaterThan(a.text.length);

  // Skipping (tap → completeMessage) shows the whole line at once.
  await page.evaluate(() => (window as any).__GAME__.game.scene.getScene("Battle").completeMessage());
  const c = await readMsg(page);
  expect(c.typing).toBe(false);
  expect(c.text).toBe(LINE);
});

test("fast text speed finishes the reveal on its own", async ({ probe, page }) => {
  await enterBattle(probe, page);

  await page.evaluate(() => {
    const api: any = (window as any).__GAME__;
    api.setTextSpeed("fast");
    api.game.scene.getScene("Battle").setMessage("A quick line that finishes fast.");
  });

  await expect.poll(async () => (await readMsg(page)).typing, { timeout: 5_000 }).toBe(false);
  expect((await readMsg(page)).text).toBe("A quick line that finishes fast.");
});
