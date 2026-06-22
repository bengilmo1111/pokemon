import { test, expect } from "./harness/fixtures";

/**
 * The starter-select screen is the first thing a new player sees. On touch it
 * must use touch wording ("Tap", not "Click") and spell Pokémon with the é.
 */
test("starter select uses touch wording", async ({ probe }) => {
  await probe.bootIntoStarterSelect();

  const hint = await probe.uiTargetText("starter-hint");
  expect(hint).toBeTruthy();
  expect(hint, "should say Tap, not Click, on touch").toContain("Tap");
  expect(hint).not.toContain("Click");
  expect(hint, "Pokémon spelled with the accent").toContain("Pokémon");
});
