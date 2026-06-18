# Pokémon Fan Game — Deep Overhaul Plan

> Working plan for the `claude/game-playtest-improvements-pbl3v7` branch. Persisted in the
> repo so it survives across sessions (the dev environment is ephemeral). Update the
> **Progress log** at the bottom as phases land.

## Context

Phaser 3 + TypeScript + Vite web game (mobile + desktop), client-only with localStorage saves
(~9,300 lines of TS, no tests, no linter). A code-level playtest shows a **solid, faithful
skeleton** — full 18-type chart with STAB/effectiveness, turn-based battles, catching mini-game,
66 species, 97 moves, evolution, gyms/Elite Four, procedural chiptune audio, touch + keyboard
controls, save/load.

It diverges from real Pokémon in three ways we want to close:
1. **Depth** — the battle/stat model is shallow.
2. **Polish** — several rough edges and missing feedback.
3. **Fidelity** — the world is *invented* (6 made-up regions, generic gym leaders "Kai/Nari/Rook"),
   even though canon assets (Brock, Misty, Erika, Koga, Sabrina, Giovanni, Lance, Blue/Red sprites)
   are already shipped but unused.

**User direction:** Deep overhaul · top priority = **Pokémon-universe fidelity** · **recreate canon
regions**. The plan front-loads (A) an authentic battle/stat model and (B) a canonical **Kanto**
world recreation, then layers deeper systems and polish.

### Verified facts that shape the plan (checked against code)
- `baseStats` / `PokemonInstance.stats` were `{hp, atk, def, spd}` — **no Special Atk/Def split**.
  Every "special" move used raw physical `atk` vs `def`. (#1 fidelity gap.)
- Stat-stage moves *partly* worked but were **hardcoded** in `Battle.ts` `STAT_MOVES` (~11 moves).
  Status-**inflicting** moves (sing, sleep-powder, poison-powder, thunder-wave, toxic, will-o-wisp)
  fell through and did nothing.
- Damage-move status was **type-based & random** (10% flat by attack type), not per-move.
- `moves.json` entries are `{id,name,type,power,accuracy,category}` — no `pp`, no `effect`.
- Learning a 5th move **silently shifts the oldest** — no "forget move" UI.
- Battle message box has **no word-wrap**; HP is **text-only**; New Game **deletes save with no
  confirm**; Preload has **no progress bar**.
- Canon trainer sprites present in `assets/trainers/`: `brock, misty, erika, koga, sabrina,
  giovanni, lance, blue, red, green, ash` + class sprites (`bugcatcher, hiker, youngster, fisherman,
  psychic, acetrainer`). Missing canon leaders Lt. Surge & Blaine (reuse `acetrainer`/`psychic`).
- Gym progress is keyed by gym `id` in `defeatedGyms`; `persistence.ts` has a `SAVE_VERSION` field.

## Guiding principle

Deep overhaul shipped as a **sequence of mergeable, type-safe, save-migrated commits** — not one
big-bang rewrite. Bump `SAVE_VERSION` once (Phase 1) with a migration that recomputes derived
stats; restructure world data with stable gym `id`s so badge progress survives.

---

## Phase 1 — Authentic battle & stat model (fidelity core)

- **1.1 Special Attack / Special Defense split.** Extend `SpeciesData.baseStats` to include
  optional `spAtk`/`spDef` (fallback to `atk`/`def`); backfill all 66 species with canonical base
  stats. Add `spAtk`/`spDef` to `PokemonInstance.stats` + `calculateStats`. `battle.ts
  calculateDamage` picks stats by `move.category`. Extend `Battle.ts` `StatStages`. **Save
  migration:** recompute derived stats on load; bump `SAVE_VERSION`.
- **1.2 Functional status-inflicting moves.** Add optional `effect`/`effectChance` to moves; make
  status moves call `tryInflictStatus`; make `STAT_MOVES` data-driven.
- **1.3 Move-driven damage status.** Replace type-switch status block with per-move chance.
- **1.4 Abilities & Natures.** `data/abilities.ts` + `data/natures.ts`; `PokemonInstance.ability`/
  `nature`; nature multiplier in `calculateStats`; hook high-impact abilities (Levitate, Intimidate,
  Blaze/Torrent/Overgrow, Static, Flash Fire).
- **1.5 IVs (light).** `PokemonInstance.ivs` folded into `calculateStats`; default mid-range on
  migration. (EVs out of scope.)

## Phase 2 — Canonical Kanto recreation (top fidelity priority)

Rebuild `src/data/regions.ts` so the flagship region is canonical Kanto; re-theme remaining invented
regions as post-game areas.
- **2.1 Canon geography & town names:** Pallet → Viridian → Viridian Forest → Pewter → Mt. Moon →
  Cerulean → Vermilion → Lavender/Rock Tunnel → Celadon → Fuchsia → Saffron → Cinnabar → Indigo
  Plateau, with canon-aligned wild spawns.
- **2.2 Eight canon Gym Leaders:** Brock · Misty · Lt. Surge · Erika · Koga · Sabrina · Blaine ·
  Giovanni, with type-themed teams, canon badges, matching sprites. Keep gym `id`s stable.
- **2.3 Canon Elite Four + Champion:** Lorelei · Bruno · Agatha · Lance; Champion = rival (Blue).
- **2.4 Team Rocket villain arc:** grunt trainers at canon beats (Mt. Moon, Rocket Hideout, Silph
  Co., Viridian Gym = Giovanni). Add `storyFlags` to `GameState`.
- **2.5 Rival fidelity:** re-skin rival to Blue/Green with starter-countering teams.

## Phase 3 — Deeper fidelity systems

- **3.1 Evolution methods** beyond level: `EvolutionData` gains `item`/`friendship`/`trade`; add
  evolution stones + "use item on Pokémon" flow.
- **3.2 PP system** (breaking save change, isolated commit): `moves: {id,pp,maxPp}[]` + UI.
- **3.3 Weather** modifiers + visual overlay.

## Phase 4 — Polish pass

- Battle message word-wrap · graphical HP bars above sprites · New Game confirmation · Preload
  progress bar · "forget a move" UI · disabled-button affordance + tooltip clamp.

## Phase 5 — Content expansion (additive)

- Add remaining canon Kanto species needed for authentic gym/route/E4 teams, with sprites.

## Recommended sequencing

1.1 (special split + migration) → 1.2/1.3 → 1.4/1.5 → Phase 2 → Phase 4 (interleave) →
Phase 3 → Phase 5. Each phase is its own commit(s), type-checked via `npm run build`.

## Verification

- `npm install` then `npm run build` (strict `tsc`) after every phase — zero type errors is the gate.
- Save migration: load a v1 save → no crash, stats recompute, badges/team preserved.
- Battle model (`npm run dev`): special split changes damage; status moves apply status; natures
  skew stats; Levitate negates Ground.
- Canon world: Pallet → Pewter, beat Brock; reach Indigo Plateau; trigger a Team Rocket beat.
- Polish: long messages wrap; HP bars track damage; New Game prompts; preload bar fills; 5th move
  opens forget prompt.
- Smoke test on a narrow (mobile portrait) viewport.

---

## Progress log

- **Phase 1 — DONE.** Special Atk/Def split (all 64 species backfilled with canonical
  base stats), natures (25-table), IVs, and a curated ability set (Levitate, Intimidate,
  Static, Blaze/Torrent/Overgrow/Swarm, Thick Fat, Water/Volt Absorb, Flash Fire) wired
  into damage + send-out hooks. Functional status moves (Sleep Powder, Thunder Wave,
  Toxic, Will-O-Wisp, Sing, Spore…) and per-move damage status. Save migration → v2.
  Runtime-verified: special split changes damage as expected; Levitate negates Ground.
- **Phase 2 — DONE.** Region 0 rebuilt as canonical Kanto: official towns/zones/landmarks,
  the 8 canon Gym Leaders (Brock→Giovanni) with canon types/badges/teams/sprites/titles,
  dynamic badge-count gating. Elite Four already canon (Lorelei/Bruno/Agatha/Lance).
  **Team Rocket** grunts added at canon sites (Mt. Moon, Rocket Hideout, Silph Co.) via the
  NpcTrainer pipeline + `storyFlags`; rival **re-skinned to canon Blue** (cocky voice, Kanto
  beats, counter-starter teams retained).
- **Phase 3 — DONE.** Item-based evolution via stones (shared `evolveMon`/`tryItemEvolution`,
  Mart + team-screen "Use Stone"; Eevee branches Fire→Flareon/Water→Vaporeon/Thunder→Jolteon;
  v3 migration). **Weather** (Rain/Sun/Sandstorm: damage modifiers, field tint, sandstorm chip +
  countdown; taught to Blastoise/Charizard/Ninetales/Golem/Onix). **PP system** as a parallel
  per-move map (menu shows/dims PP, AI respects it, Struggle fallback, restored on heal; no
  migration needed). Runtime-verified (rain ×1.5 Water / sun ×0.5; PP drain/restore/Struggle).
- **Phase 4 — DONE.** Battle message word-wrap, graphical HP bars, preload progress bar,
  New Game confirmation, "forget a move" prompt, **disabled-button affordance**, and
  **move-tooltip clamping**.
- **Phase 5 — DONE (core).** Added 48 canonical Gen-1 species (sprites already shipped;
  Preload auto-loads by id), and upgraded every gym, the Elite Four, and rival Blue to
  authentic rosters (Brock/Onix, Misty/Starmie, Erika/Vileplume, Koga/Weezing, Blaine/
  Arcanine, Giovanni/Rhydon, Lance/Aerodactyl, …). 112 species total. **Canon wild spawns**
  tuned per Kanto biome (Zubat/Onix caves, Oddish/Bellsprout forest, Voltorb Power Plant,
  Drowzee/Hypno tower, Growlithe/Vulpix/Ponyta volcano, Staryu/Slowpoke lakes, Jynx/Shellder
  tundra, Rhyhorn/Golbat Victory Road).
- **All planned phases complete.** Optional future work: the remaining Gen-1 dex (~40 species
  for a complete Pokédex), friendship/trade evolutions, and EV training.
