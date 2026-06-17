# Pokémon Adventure — Mobile Web

A Phaser 3 + Vite + TypeScript Pokémon-style game, built to play in the browser on **mobile and desktop**.

## Play
- **Touch (mobile):** drag the left side of the screen to move (virtual joystick); use the on-screen buttons on the right — **A** (interact: challenge gyms, heal at a Pokémon Center, enter the League), **+** (use a Potion), **T** (team), **M** (map), **☰** (menu/save/load).
- **Keyboard (desktop):** Arrow keys to move; `E` interact, `H` heal, `P` potion, `T` team, `D` Pokédex, `M` map, `S` save, `F1` load, `Esc` pause.
- **Battles:** tap **Fight / Bag / Pokémon / Run**. When catching, **drag to aim** the throw and tap **THROW** (arrow keys + space also work).

## Requirements
- Node.js 18+

## Develop
```bash
npm install
npm run dev      # http://localhost:5173
```

## Build
```bash
npm run build    # type-checks then bundles to dist/
npm run preview  # serve the production build locally
```

## Deploy (Vercel)
The repo includes `vercel.json` (build command `npm run build`, output `dist/`).

1. Push this repo to GitHub.
2. In Vercel, **New Project → Import** the GitHub repo.
3. Vercel auto-detects the Vite framework and the included config; click **Deploy**.

No environment variables are required.

## Notes
- Rendering scales to any screen via a fixed 720×1280 portrait design resolution (Phaser `Scale.FIT`), so the UI never clips on small phones.
- Scene flow: Boot → Preload → Overworld (Battle launches from encounters).
- Legacy single-file prototypes (`PokemonGame.html`, `game.js`, `styles.css`, etc.) are kept for reference and are **not** part of the Vite build.
