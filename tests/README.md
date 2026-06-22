# Mobile-touch test harness

Automated tests that drive this Phaser game **the way a phone user does** —
real mobile viewport, touch emulation, synthetic touch events on the canvas —
and assert on the game's **actual state machine**, not on screenshots.

This exists because the game's recurring bugs (encounter→save loops, HUD
bleed-through, instant-completing battles) are *state* bugs that are invisible
through pixels. The harness makes state observable and randomness reproducible,
so a bug can be reproduced on demand and locked down with a regression test.

## Quick start

```bash
npm install
npm run test:install     # one-time: downloads Chromium for Playwright
npm run test:e2e         # run the whole suite (headless)
```

Other modes:

```bash
npm run test:e2e:headed  # watch it run in a real browser window
npm run test:e2e:ui      # Playwright's interactive UI mode
npx playwright test tests/encounter.spec.ts          # one file
npx playwright test -g "fully fainted team"          # one test by name
```

The dev server (`npm run dev`) is started automatically by Playwright. After a
run, an HTML report is written to `tests/.report` (open `index.html`); failures
also capture a screenshot, video, and trace.

## How it works — three layers

### 1. The in-game test bridge (`src/game/testBridge.ts`)

Test-only instrumentation, **gated behind `?test=1`** (or a `__test_mode__`
localStorage flag) so it never affects normal play. When active it installs
`window.__GAME__`, which exposes:

- **`snapshot()`** — a structured read of the live state machine: active/paused
  scenes, every Overworld menu flag, `inBattle`, `encounterCooldown`,
  `hudVisible`, player position, and a slice of `gameState` (team HP, badges,
  wild count, money…).
- **`events(sinceSeq?)`** — an append-only log of *semantic* transitions the
  game emits at the real call sites: `encounter:trigger`, `encounter:blocked`,
  `battle:active`, `battle:instant-escape`, `battle:complete`, `save:fired`,
  `bridge:installed`, plus `scenario:*` setup markers.
- **Control helpers** — `bootIntoOverworld()`, `giveTeam()`, `faintTeam()`,
  `healTeam()`, `forceEncounter()`, `seedRng()`, `touchButtons()`.

Game code emits events with `emitTestEvent(type, data?)`, which is a no-op until
the bridge is installed — safe to call from hot paths.

### 2. Deterministic RNG (`src/game/rng.ts`)

All gameplay randomness routes through `rng()` instead of `Math.random()`. The
harness pins a seed (`?seed=<n>` or `seedRng()`), so encounters, battles, and
world generation are reproducible run to run. In normal play the seed comes from
the clock, so behaviour is unchanged.

### 3. The Playwright driver (`tests/harness/`)

- **`probe.ts` — `GameProbe`**: typed wrappers around `window.__GAME__`
  (`snapshot`, `events`, `waitForEvent`, `expectNoEvent`, `forceEncounter`,
  `bootIntoOverworld`, …). This is how specs read and control the game.
- **`touch.ts` — `TouchDriver`**: thumb-style input via CDP touch events.
  `walk(DIR.down, ms)` holds the virtual joystick deflected; `tap(x, y)` taps;
  buttons are located via `probe.touchButton(id)`.
- **`fixtures.ts`**: provides `{ probe, touch }` to every test, with the page
  already loaded in test mode (`?test=1&seed=…`) and the bridge ready.

## Writing a test

```ts
import { test, expect, DIR } from "./harness/fixtures";

test("walking into a wild Pokémon starts a battle", async ({ probe, touch }) => {
  await probe.bootIntoOverworld({ team: [{ speciesId: "charmander", level: 14 }] });

  const since = await probe.clearEvents();
  await probe.forceEncounter();                       // real collision path

  await probe.waitForEvent("battle:active", { sinceSeq: since });
  expect(await probe.countEvents("save:fired", since)).toBe(0);  // not a save loop
});
```

Patterns that keep tests robust:

- **Boot into a known scenario** with `bootIntoOverworld({ team, seed })` instead
  of clicking through Title/starter-select.
- **Clear the event log** (`const since = await probe.clearEvents()`) right
  before the action, then assert with `{ sinceSeq: since }`.
- **Assert on events/state, not timing.** Use `waitForEvent` /
  `expect.poll(...)`; use `expectNoEvent(type, { windowMs })` to prove a *bad*
  thing didn't happen.
- **Drive real input** (`touch.walk`, `touch.tap(button.x, button.y)`) for
  end-to-end coverage; use `forceEncounter()` for fast, deterministic logic
  checks.

## Current coverage

| File | Guards against |
|------|----------------|
| `touch-movement.spec.ts` | Joystick actually moves the player; action buttons are on-screen. Canary for the whole touch path. |
| `encounter.spec.ts` | Wild encounter starts a real battle (not a save); a fully fainted team never enters the auto-save loop; no instant-escape. |
| `menus.spec.ts` | HUD is hidden whenever Team / Map / pause is open and restored on close; every touch-openable menu opens and closes cleanly. |

## Extending it

- **New observable transition?** Add an `emitTestEvent("thing:happened", {...})`
  at the real call site, then assert on it. Keep names `domain:event`.
- **New state to assert?** Add a field to `GameSnapshot` in `testBridge.ts`
  (and mirror it in `tests/harness/types.ts`).
- **New scenario shortcut?** Add a control helper to the bridge API.

### Known gaps / TODO

- Mart (shop) and Pokédex are opened via in-town NPC/building interaction, not a
  direct touch button, so they aren't yet covered by the HUD/menu specs. Add a
  scenario helper that positions the player at a shop, or a bridge opener, to
  cover them.
- Close-**button position** consistency (bottom bar vs corner ✕) is a visual
  property; specs verify menus *close cleanly*, but eyeball the failure
  screenshots / `test:e2e:headed` for layout.
- Simulating a full battle *loss* through touch is not yet automated; the
  fainted-team regression covers the resulting loop instead.
