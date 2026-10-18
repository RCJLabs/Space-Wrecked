# CLAUDE.md: Space Wrecked

Working agreement for Claude Code sessions on this repo. Read ROADMAP.md before writing any code.

## Project

A ship-first sandbox RPG in 3D: build a ship on a grid, run from a pursuer, and settle a world, fighting XCOM-style squad battles inside ship layouts. It is a browser game, landscape only and offline-first. It ships on GitHub Pages now (`RCJLabs/Space-Wrecked`, served at `spacewrecked.rcjlabs.com`), as a TWA on Google Play, and as a Capacitor build later. Solo developer (Evan), evening sessions.

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

- **Vanilla ES modules. No framework. No build step. No dependencies** without explicit approval. ZzFX (audio, MIT) came in with M35, vendored as published in `src/platform/zzfx.js`. `package.json` exists only for `"type": "module"` and scripts.
- **Procedural art, drawn in code.** The game world is 3D, drawn by our own renderer on canvas (`src/render/`, no library); the painted backdrops behind the title, the lift-off and the landing are shapes our renderer paints too (`src/render/scenes/`, M34); menus, panels and icons are SVG and DOM. The only image files allowed are WebP portraits, scenes and store art in `assets/img/`, each logged in `assets/LOG.md`, and PNG app icons generated from `icon.svg` by `tools/icons.js`. No sprite sheets, no emoji as art. (The fight keeps each figure our renderer draws for reuse, `src/render/figures/sprites.js`; that is a cache of our own drawings, not image files.)
- **Sound is made in code too** (M35): each sound is ZzFX's parameters in `data/sounds.json`, built into samples on the phone. No sound files.
- **`SAVE_VERSION` gates all saves.** Never change the save schema without bumping `SAVE_VERSION` and writing a migration. Never reset player saves. (This is the Ascent rule.)
- **Seeded RNG everywhere**, using `mulberry32` in `src/core/rng.js`. This covers battles, the approach phase, generators, loot and events. No bare `Math.random()` in game logic. RNG state is part of the save, so reloading never rerolls.
- **All content is data** in `data/*.json`:
  - modules (each maker's versions with them) and the builder's part categories, hull frames, hull styles, styling pieces with the paints and trims, manufacturers, weapons (each one's kind, price and rules: bursts, piercing, reach, stun and fire), enemies, encounters, ship presets (each with its side's look and makers), the campaign's acts (act 1 naming the scene it lifts off from)
  - crew jobs (with the kinds of weapon each carries), traits, recruits' names, backgrounds (each with its start, district and pursuer, the pursuer's side and words, fighters, ships and raiders in each act, and its payment or none), districts (each with its clients, their sides, sites and shop, weapons among its stock), the stations' clients and the sites at their docks and on the rocks nearby (`docks.json`), the job sites' map templates (a dock's or a rock's naming its look), the run's sectors (with their stations and shipyards), the worlds past the charts (each kind naming the scene it lands on, and the worlds in each system a voyage from the colony crosses, with the words for its way in and jump point), the colony's buildings (with the shots its defenses fire at a raid's lander) and what it builds (farms, mines, solar arrays and shelters), the places within reach of the colony, the sides (with whose stations and shipyards are whose, what their stations' racks sell and the makers their shipyards lean to), the quests (each background's thread and the sides' chains, their steps and pay-offs, and each companion's loyalty quest), the companions (each with their side, job, traits, face, the clothes and gear of their bust, past, chain, loyalty quest and talent)
  - the sounds (each one's ZzFX parameters by name, and how loud it is meant to be) and the sound each weapon's shot makes
  - how jobs, enemies and weapons look in a fight (`look` and `held`, checked against `src/render/figures/looks.js`)
  - mission and job templates, and the people a job brings out (`data/contracts.json`), events (each choice's needs, a job or a trait among them; each background's own; traps, wrecks and repairs), balance numbers

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
CNAME                       # spacewrecked.rcjlabs.com
.github/workflows/pages.yml # tests, checks sw.js, deploys main to Pages
.githooks/pre-commit        # runs tools/precache.js
.well-known/assetlinks.json # TWA verification, added with the TWA
src/
  core/      rng, save, blueprint codes, store, events, sound parameters (soundParams.js)
  sim/       grid, builder rules, styling, makers, constraints, mapFromShip, battle, objectives (a job's, with what the AI plays for in them, objectiveAi.js), ai, approach, heat, standing (the sides), events (with the pools they are drawn from, eventPool.js), quests, companions (with their talents), campaign, colony (with its building by hand, its days and its expeditions), voyages from it (voyage.js, with who is aboard and who at home while the ship is away, away.js), the other colonies (colonies.js), raids (with the colony as a battle map), economy, weapons (their rules), loadout (who carries what, and the spares on hand), gear (what a won fight leaves), racks (the stations'), stationJobs (the stations' boards), yards (the shipyards'), dev (the dev menu's cheats; God mode is god), gen/
  render/    3D camera, scenes and painters, part and styling piece models, figures (figures/), portraits (portraits/, the companions' busts with them), painted backdrops (scenes/), hull tracer and hull shapes, the approach's two ships seen from outside (approachView.js, with the marks on a hull, hullMarks.js, and a round played out, approachPlayback.js), SVG icons, tweens, particles
  ui/        screens, panels, gestures, which moment plays which sound (sounds.js), the ?dev=1 menu (dev/)
  platform/  storage, service worker registration, haptics, orientation, audio (audio.js, playing zzfx.js)
data/        JSON content, including balance.json
assets/
  img/          WebP only
  LOG.md        prompt, date, model and hand edits for every image
  LICENSES.md   every third-party file and its license
tools/       sim.js, blueprint.js, precache.js, icons.js, serve.js, validate-data.js (with validate-campaign.js, validate-sectors.js, validate-worlds.js, validate-colony.js, validate-expeditions.js, validate-events.js, validate-factions.js, validate-quests.js, validate-companions.js, validate-sounds.js and checks.js), sounds.js, build-ship.js, battle-map.js, battle-log.js, gen-ship.js, jobs.js, run.js, arms.js (the test players' weapons), raids.js, sectors.js, voyage.js (with voyagePlan.js), approach.js (with approachPlan.js), boarding.js, startShip.js, data.js
tests/       node --test files; golden/ holds golden maps and replays
ROADMAP.md
PROGRESS.md
```

## Code rules

- State flows one way: input, then action, then a sim function, then new state, then render. Renderers never mutate state.
- Hit chance is computed in `src/sim/` and shown exactly. The number on screen is the number rolled against, including any forgiving-odds bonus.
- Balance numbers live in `data/balance.json`. Before changing any, run `node tools/sim.js` and paste the summary into PROGRESS.md.
- Parts, hulls and figures are pure functions from data to 3D models: plain data (faces, lines, glows) in cells, z up. The painters project them through the orbit camera (`src/render/orbit.js`) onto `<canvas>`: the see-through blueprint is batched by style, solid views are depth-sorted with back faces dropped. Menus, panels and icons are DOM and SVG with CSS. Portraits are pure functions too, from a crew member's look (`src/sim/looks.js`, whose choices are drawings, so they live in code) to SVG text, shown as images.
- Colors come from palette tokens in one file. Manufacturers are skins over the same part shapes.
- Keep files small and named for what they do; no god modules.

## Mobile and landscape

- Landscape only. Portrait shows a rotate prompt.
- Touch targets are at least 48 CSS px. Tap to preview, tap again to confirm. Long-press for details. No hover-only UI.
- In 3D views a cell is smaller than 48 px (about 24 px with a whole starter ship in view on the cover screen; Evan's call in M5b), so a single tap never places anything: the part shows as a ghost first, and a second tap on it, or the end of a drag, puts it down. The default camera fits the whole ship with every cell at least 22 px (`tests/orbit.test.js` checks it); zoom covers the rest.
- In a fight, likewise, a tap on the board never spends an action: it shows the move or the shot, and a second tap makes it. The fight camera opens square to the ship, where tiles are biggest (48 px and up for the example ship on the cover screen in the app). Choosing a unit, Fire and every other order are buttons of 48 px or more.
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
- Golden files in `tests/golden/`: a ship always converts to the identical battle map (`tools/battle-map.js --golden` writes the example ship's), and fixed-seed battles and generators must reproduce identical results. Update a golden file only on purpose, and say so in PROGRESS.md.
- Every rules change ships with a test.
- New content changes how every test voyage rolls out. A voyage check it breaks on seeds 1 to 30 becomes a rate over 100 seeds, held within a margin of main's 100-seed rate (`MAIN` in `tests/voyage.test.js`), not a new limit picked to pass (Evan's call, M31).

## Deploy

- GitHub Pages serves `main`, published by `.github/workflows/pages.yml` (Pages source: GitHub Actions).
- Use relative URLs everywhere (`./`), so the game runs at any address.
- The game lives at `spacewrecked.rcjlabs.com`, set under Settings → Pages. With the Actions deploy GitHub ignores the `CNAME` file; it stays in the repo as a record. Never move the domain once players have saves: storage belongs to the origin.
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
