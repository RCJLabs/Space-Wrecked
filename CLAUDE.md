# CLAUDE.md: [working title TBD]

Working agreement for Claude Code sessions on this repo. Read ROADMAP.md before writing any code.

## Project

A 2D ship-first sandbox RPG: build a ship on a grid, run from a pursuer, and settle a world, fighting XCOM-style squad battles inside ship layouts. It is a browser game, landscape only and offline-first. It ships on GitHub Pages now (`RCJLabs/<repo>`, name TBD), as a TWA on Google Play, and as a Capacitor build later. Solo developer (Evan), evening sessions.

## Session protocol

- **One milestone per session.** Do not start the next milestone, even if it's tempting. Meet the current milestone's Done when, then stop.
- **Start** by reading ROADMAP.md §7 and PROGRESS.md. Then state the active milestone and its Done when.
- **End** by updating PROGRESS.md with:
  - the milestone and what shipped
  - known issues
  - what Evan should test on the phone
  - the next session's first task

  Then tick the milestone's box in ROADMAP.md.
- If a milestone won't fit the session, cut scope inside it (fewer modules, smaller maps) rather than deferring its Done when.
- **Phase gates are Evan's call.** Don't start a new phase until PROGRESS.md records that the gate passed.
- Ideas outside the active milestone go in ROADMAP.md §9, not into code.

## Hard conventions

- **Vanilla ES modules. No framework. No build step. No dependencies** without explicit approval. ZzFX (audio) is pre-approved for M35. `package.json` exists only for `"type": "module"` and scripts.
- **Procedural SVG for all game art and UI.** The only image files allowed are WebP portraits, scenes and store art in `assets/img/`, each logged in `assets/LOG.md`, and PNG app icons generated from `icon.svg` by `tools/icons.js`. No sprite sheets, no emoji as art.
- **`SAVE_VERSION` gates all saves.** Never change the save schema without bumping `SAVE_VERSION` and writing a migration. Never reset player saves. (This is the Ascent rule.)
- **Seeded RNG everywhere**, using `mulberry32` in `src/core/rng.js`. This covers battles, the approach phase, generators, loot and events. No bare `Math.random()` in game logic. RNG state is part of the save, so reloading never rerolls.
- **All content is data** in `data/*.json`:
  - modules, hull frames, manufacturers, weapons, enemies
  - jobs, traits, backgrounds, pursuers
  - mission and job templates, events, balance numbers

  Adding content never requires engine edits.
- **The simulation is pure.** `src/sim/` takes plain data and returns plain data. It has no DOM, `window`, timers, `Date.now()` or `Math.random()`, and it must run under Node for tests and balance scripts.
- **Offline always.** No requests to any other origin, no analytics, no ads, and no AI or image calls at runtime. Everything ships in the repo and is precached.
- **One grid model.** The ship, enemy ships, battle maps and the colony all use `src/sim/grid.js`. A ship becomes a battle map only through `src/sim/mapFromShip.js`.

## Layout

```
index.html
manifest.webmanifest
sw.js                       # file list and version written by tools/precache.js
icon.svg                    # source for the PNG app icons
icons/                      # PNG icons from tools/icons.js
.nojekyll                   # lets Pages serve /.well-known/
.githooks/pre-commit        # runs tools/precache.js
.well-known/assetlinks.json # TWA verification, added with the TWA
src/
  core/      rng, save, store, events
  sim/       grid, builder rules, constraints, mapFromShip, battle, ai, approach, heat, campaign, economy, gen/
  render/    canvas renderers, SVG parts, hull tracer, raster cache, tweens, particles
  ui/        screens, panels, gestures
  platform/  storage, service worker registration, haptics, orientation
data/        JSON content, including balance.json
assets/
  img/          WebP only
  LOG.md        prompt, date, model and hand edits for every image
  LICENSES.md   every third-party file and its license
tools/       sim.js, blueprint.js, precache.js, icons.js, serve.js, validate-data.js
tests/       node --test files and golden replays
ROADMAP.md
PROGRESS.md
```

## Code rules

- State flows one way: input, then action, then a sim function, then new state, then render. Renderers never mutate state.
- Hit chance is computed in `src/sim/` and shown exactly. The number on screen is the number rolled against, including any forgiving-odds bonus.
- Balance numbers live in `data/balance.json`. Before changing any, run `node tools/sim.js` and paste the summary into PROGRESS.md.
- SVG parts are functions that return SVG strings. They are rasterized once per zoom level and cached, and the builder and battle boards draw on `<canvas>`. Menus and panels are DOM with CSS.
- Colors come from palette tokens in one file. Manufacturers are skins over the same part shapes.
- Keep files small and named for what they do; no god modules.

## Mobile and landscape

- Landscape only. Portrait shows a rotate prompt.
- Touch targets are at least 48 CSS px. Tap to preview, tap again to confirm. Long-press for details. No hover-only UI.
- Respect safe-area insets.
- Test both screen shapes: about 2.4:1 (Galaxy Z Fold cover screen in landscape) and about 1.2:1 (unfolded). Panels anchor to the corners and the board takes the rest.
- Target 60 fps on a mid-range Android phone. Cap `devicePixelRatio` at 2, offer a 30 fps battery setting, and redraw only what changed.
- Audio starts after the first tap.

## Offline and saves

- `sw.js` precaches the app shell, data and art and serves cache-first. `tools/precache.js` writes the file list and a content hash into `sw.js` between marker comments, so `sw.js` changes whenever any cached file does. Browsers only update a service worker when `sw.js` itself changes. The pre-commit hook runs the tool.
- Never skip waiting automatically. When an update is waiting, show an "Update ready, tap to reload" prompt, so a running game never mixes old and new files.
- Request persistent storage with `navigator.storage.persist()` on first launch.
- Saves go through `src/platform/storage.js` only: localStorage now, IndexedDB if saves outgrow it.
- Settings can export and import a save as text. A TWA shares Chrome's storage, so this export is the player's backup.

## Testing

- `node --test` covers `src/sim/` and `tools/`.
- Golden replays: fixed-seed battles and generators must reproduce identical results. Update a golden file only on purpose, and say so in PROGRESS.md.
- Every rules change ships with a test.

## Deploy

- GitHub Pages serves `main` directly.
- Use relative URLs everywhere (`./`), so the game runs at the Pages project URL now and at a custom subdomain later.
- A custom subdomain under rcjlabs.com via a `CNAME` file, as with Dirtbag.
- The TWA setup follows Dirtbag. Stay on the TWA until feature-complete; the Capacitor conversion is Phase 9.

## Licensing hygiene

- Every third-party file (font, sound, library) gets a line in `assets/LICENSES.md` before it is committed. No NC, ND or SA licenses.
- The repo is public, so never commit an asset whose license forbids redistribution.
- The credits screen lists every entry in LICENSES.md.
- Every Base44 image gets an entry in LOG.md: prompt, date, model, and what was edited by hand.

## Definition of done (every session)

- `node --test` passes.
- The game loads with no console errors, and works offline after a reload with the network off.
- The milestone's Done when is met.
- The ROADMAP.md box is ticked, and PROGRESS.md is updated, including what to test on the phone.

## Don'ts

- Don't start the next milestone.
- Don't add a framework, bundler or dependency.
- Don't use `Math.random()` or `Date.now()` in `src/sim/`.
- Don't call any network service or generate images from game code.
- Don't change a locked decision (ROADMAP.md §3) without Evan's say-so.
- Don't reset or break existing saves.
