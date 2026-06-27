import { test, expect } from "./harness/fixtures";

/**
 * Deterministic coverage for the battle-ability mechanics wired into the damage
 * engine (Guts, Thick Fat, Flash Fire, Water/Volt Absorb). These drive the pure
 * `calculateDamage` via the test bridge (window.__GAME__.calcDamage) rather than
 * a full battle, so they assert the maths directly and never flake on RNG: each
 * paired comparison re-seeds the RNG so the crit/variance rolls are identical and
 * only the ability under test differs. Abilities are overridden on the built
 * instances so the checks are species-independent.
 */

// Two same-seed damage calcs that differ only in the abilities/status/flash flag.
type CalcOpts = {
  attacker: string;
  defender: string;
  moveId: string;
  seed: number;
  atkAbility?: string;
  atkStatus?: string;
  defAbility?: string;
  flash?: boolean;
};

function calc(page: import("@playwright/test").Page, opts: CalcOpts): Promise<number> {
  return page.evaluate((o) => {
    const g = (window as any).__GAME__;
    g.seedRng(o.seed);
    const atk = g.makeMon(o.attacker, 30);
    const def = g.makeMon(o.defender, 30);
    atk.ability = o.atkAbility;
    if (o.atkStatus) atk.status = o.atkStatus;
    def.ability = o.defAbility;
    return g.calcDamage(atk, def, o.moveId, o.flash ?? false).damage as number;
  }, opts);
}

test("Guts boosts physical damage while statused (and ignores the burn penalty)", async ({ probe, page }) => {
  await probe.bootIntoOverworld({ team: [{ speciesId: "rattata", level: 10 }] });

  const healthy = await calc(page, { attacker: "rattata", defender: "rattata", moveId: "tackle", seed: 777, atkAbility: "guts" });
  const burned = await calc(page, { attacker: "rattata", defender: "rattata", moveId: "tackle", seed: 777, atkAbility: "guts", atkStatus: "burn" });

  expect(burned, "a burned Guts attacker hits harder than a healthy one").toBeGreaterThan(healthy);
});

test("Thick Fat halves incoming Fire damage", async ({ probe, page }) => {
  await probe.bootIntoOverworld({ team: [{ speciesId: "rattata", level: 10 }] });

  const normal = await calc(page, { attacker: "charmander", defender: "rattata", moveId: "ember", seed: 4242 });
  const softened = await calc(page, { attacker: "charmander", defender: "rattata", moveId: "ember", seed: 4242, defAbility: "thick-fat" });

  expect(softened, "Thick Fat takes less Fire damage").toBeLessThan(normal);
  expect(softened, "roughly half, allowing for independent flooring").toBeLessThanOrEqual(Math.ceil(normal * 0.6));
});

test("Flash Fire powers up the holder's own Fire moves after absorbing one", async ({ probe, page }) => {
  await probe.bootIntoOverworld({ team: [{ speciesId: "rattata", level: 10 }] });

  const normal = await calc(page, { attacker: "charmander", defender: "rattata", moveId: "flamethrower", seed: 9001 });
  const charged = await calc(page, { attacker: "charmander", defender: "rattata", moveId: "flamethrower", seed: 9001, flash: true });

  expect(charged, "a Flash-Fire-charged Fire move hits harder").toBeGreaterThan(normal);
});

test("Water Absorb negates the hit and restores HP when hurt", async ({ probe, page }) => {
  await probe.bootIntoOverworld({ team: [{ speciesId: "rattata", level: 10 }] });

  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    const def = g.makeMon("rattata", 30);
    def.ability = "water-absorb";
    def.hp = def.maxHp - 5; // hurt, so absorption heals rather than just no-ops
    const atk = g.makeMon("squirtle", 30);
    return g.calcDamage(atk, def, "water-gun");
  });

  expect(result.damage, "Water Absorb negates Water damage").toBe(0);
  expect(result.absorbed).toBe("heal");
  expect(result.healAmount, "it restores some HP").toBeGreaterThan(0);
});

test("Flash Fire absorbs the Fire hit (no damage)", async ({ probe, page }) => {
  await probe.bootIntoOverworld({ team: [{ speciesId: "rattata", level: 10 }] });

  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    const def = g.makeMon("growlithe", 30);
    def.ability = "flash-fire";
    const atk = g.makeMon("charmander", 30);
    return g.calcDamage(atk, def, "ember");
  });

  expect(result.damage, "Flash Fire takes no Fire damage").toBe(0);
  expect(result.absorbed).toBe("flash-fire");
});
