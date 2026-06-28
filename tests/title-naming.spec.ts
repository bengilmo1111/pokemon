import { test, expect } from "@playwright/test";

/**
 * Save naming uses an on-screen field, not window.prompt. The old browser
 * prompt is clunky on a kid's tablet; this drives the real Title modal, types
 * into the HTML <input>, and confirms the typed name reaches the save.
 */
test("naming a new save uses an on-screen field and persists the name", async ({ page }) => {
  await page.goto("/?test=1");
  await page.waitForFunction(() => Boolean((window as any).__GAME__), undefined, { timeout: 15_000 });

  // Open the new-game name modal for slot 1 (the Title scene is the landing).
  await page.evaluate(() => {
    const g: any = (window as any).__GAME__.game;
    if (!g.scene.isActive("Title")) g.scene.start("Title");
  });
  await expect
    .poll(() => page.evaluate(() => Boolean((window as any).__GAME__.game.scene.getScene("Title"))))
    .toBe(true);
  await page.evaluate(() => (window as any).__GAME__.game.scene.getScene("Title").startNewGame(1));

  // A real HTML <input> appears (this is what opens the soft keyboard on touch).
  const input = page.locator("input");
  await expect(input).toBeVisible({ timeout: 5_000 });
  await input.fill("Ash");
  await input.press("Enter");

  // The typed name is saved to slot 1.
  await expect
    .poll(() =>
      page.evaluate(() => {
        try {
          return JSON.parse(localStorage.getItem("pokemon_game_save_slot_1") || "{}").slotName ?? null;
        } catch {
          return null;
        }
      })
    )
    .toBe("Ash");
  expect(await page.locator("input").count(), "input overlay removed after submit").toBe(0);
});
