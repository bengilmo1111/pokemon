# AGENTS.md

Guidance for AI coding agents (and humans) working in this repo. This is the
single source of truth for working conventions; `CLAUDE.md` just points here.

## What this is

A Pokémon-style adventure game for **mobile web**, built with **Phaser 3** +
**TypeScript** + **Vite**. The primary target is a phone in portrait, played
with on-screen touch controls (a virtual joystick + action buttons). Always
consider the mobile/touch experience first.

## Commands

```bash
npm run dev          # Vite dev server at http://localhost:5173
npm run build        # tsc type-check + production build (must pass before merge)
npm run test:install # one-time: download Chromium for Playwright
npm run test:e2e     # run the mobile-touch test suite (see below)
```

## Project layout

- `src/main.ts` — Phaser game bootstrap + scene list.
- `src/scenes/` — `Title`, `Boot`, `Preload`, `Overworld` (the big one), `Battle`.
- `src/game/` — state, persistence, battle logic, touch controls, RNG, test bridge.
- `src/data/` — species, moves, regions, types, natures, abilities, biomes.
- `tests/` — the Playwright mobile-touch harness (`tests/README.md`).

## Testing — required workflow

This repo has a **mobile-touch test harness** that drives the game the way a
phone user does (real mobile viewport, touch emulation, synthetic touch events)
and asserts on the **actual game state machine**, not screenshots. It exists
because this game's bugs (encounter/save loops, HUD bleed, menu rendering) are
state bugs that are invisible through pixels.

**Expectations for any change to game behaviour:**

1. **Run the suite before opening a PR:** `npm run test:e2e`. It must be green.
   (`npm run build` must also pass.)
2. **Add coverage for what you change.** If you fix a bug, add a regression test
   that fails before your fix and passes after. If you add a feature with
   observable behaviour, add a spec for it.
3. **Reproduce bugs through the harness first** instead of guessing from
   screenshots — that is the whole point of it.

**How it works** (full detail in [tests/README.md](tests/README.md)):

- `src/game/rng.ts` — seedable RNG; all gameplay randomness goes through `rng()`
  so tests are reproducible. Do **not** reintroduce bare `Math.random()` in
  gameplay logic.
- `src/game/testBridge.ts` — test-only `window.__GAME__`, gated behind `?test=1`
  (no effect on shipped game). Exposes a state snapshot, a semantic event log,
  and control helpers. Emit new observable transitions at the real call site
  with `emitTestEvent("domain:event", {...})` — it's a no-op until the bridge is
  installed, so it's safe in hot paths.
- `tests/harness/` — `GameProbe` (typed state/event access), `TouchDriver`
  (joystick + taps), shared fixtures. `tests/*.spec.ts` — the specs.

When adding a spec: boot a known scenario via `probe.bootIntoOverworld(...)`,
`clearEvents()` right before the action, then assert on events/state (not
timing). Use the retry-tap helpers — the viewport settles shortly after load.

## Conventions

- **Match the surrounding code** — comment density, naming, and idiom.
- **TypeScript stays clean:** `npx tsc --noEmit` must pass (strict mode).
- **Mobile first:** new UI must work in portrait with touch; keep tap targets
  large and clear of safe-area insets (`src/game/uiLayout.ts`).
- **Two-camera gotcha:** full-screen menus live in a container that must
  `setScrollFactor(0)` (or go through `fitMenu`), or they render through the
  zoomed world camera with mis-aligned touch targets. Tag in-panel buttons the
  harness needs to tap with `setData("testid", "...")`.

## Git / PRs

- Branch off `main`; don't commit directly to `main`.
- Keep PRs focused. Ensure `npm run build` and `npm run test:e2e` pass first.
