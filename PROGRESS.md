# PROGRESS.md

Newest entry first.

## M2 Touch builder (2026-10-11)

**Status:** built and deployed. It passes every check I can run without a phone (headless Chromium at the Fold's screen sizes, below). Done when needs Evan's phone run: a full starter ship built folded and unfolded, without mis-taps, at 60 fps while dragging. The ROADMAP.md box stays unticked until that passes. M2 ran in the same session as M0 and M1 because Evan asked for it.

### Shipped

- **Builder sandbox:** DEV → Builder. The parts drawer is on the left, the tools (Undo, Redo, Turn, Delete) on the right, and the board in between.
- **Placing parts**, two ways:
  - Drag a part from the drawer onto the hull; it places when you let go.
    - The ghost is green where the part fits. Where it doesn't, it's red, and the status line says why.
    - Let go where it can't fit, and it stays as a red preview instead of vanishing.
    - Let go off the hull to cancel.
  - Tap a part (it lights up), tap the hull to preview it there, then tap the preview again to place it.
    - A single tap never places anything. A tap anywhere else moves the preview.
    - The part stays picked for the next one. Done (where Delete was) or tapping the part again stops placing.
- **Editing:**
  - Turn rotates the picked part (before or while previewing) or the selected part, in place.
  - Tap a placed part to select it (white outline). Drag it to move it, or use Turn or Delete. Tap empty hull to clear the selection.
  - Undo and Redo cover every change (500 steps). The status line names what was undone and selects the part it touched.
- **Details:** long-press a part, in the drawer or on the hull. The card shows its size, doors, stats and cost; for a placed part, also its position and whether it reaches the bridge. The next touch closes it.
- **View:** pinch to zoom (up to 3× the fitted size). Drag empty space to pan when zoomed, and tap Fit (top right of the board) to reset. On a desktop, the mouse wheel zooms, and Ctrl+Z, Ctrl+Y, R, Delete and Esc work.
- **Feedback on the board:**
  - Door marks on every part:
    - green: joined
    - orange: open, so a part could join there
    - red: facing a wall
    - cyan: an airlock's door to space
    - gray: any other door to space
  - Parts not joined to the bridge get a dashed red outline.
  - The chip at top left counts parts and names the first layout problem, or says Layout OK.
- **Code:**
  - `src/sim/session.js`: the builder session as a pure reducer. It holds the ship, the undo history of build commands, the selection, the picked part, the preview and notices. Every tap and drop rule lives here and is tested in Node.
  - `src/sim/builder.js`:
    - `moveModule`
    - `rotateModule` and `turnedPlacement`: turn about the middle, so four turns land exactly where they started; near an edge the part slides back inside
    - `applyCommand`: place, move or remove
    - `doorStates` and `moduleAt`
  - `src/sim/modules.js`: `interiorRows`, which turns an interior template; M6 can reuse it.
  - `src/render/`:
    - `camera.js`: fit, pan, pinch, zoom and clamp; pure and tested
    - `shipView.js`: placeholder drawing of the frame, parts, interiors, doors, ghost and selection
    - `parts.js`: part colors and the drawer's SVG icons
    - hull and part-color tokens added to `palette.js`
  - `src/ui/gestures.js`: the tap, long-press, drag and pinch recognizer (pure, tested), a pointer-event adapter, and `onTap` for buttons.
  - `src/ui/builder/`: the screen, drawer, hints and details card. Also `src/ui/icons.js`, and `src/platform/content.js`, which loads `data/*.json` through the service worker cache.
- **Starter hull turned to 7×4, nose to the right** (it was 4×7). The engine is now 2×1 with its door facing forward. The example ship is turned to match:

  ```
  ..RRQLW
  ..RRQ+B
  EE++++B
  EE+..A.
  ```

- 34 new tests, 119 in all.

### Decisions made this session

- **Landscape hull.** The long axis runs along the screen. At 4×7 nose up, cells on the folded screen (370 px tall) would have been about 45 px, under the 48 px minimum. At 7×4 they are:
  - 64 px in a folded Chrome tab
  - 82 px in the folded app
  - 90 px unfolded

  ROADMAP §4.1 is updated. No saves held a ship, so nothing broke.
- **Tap placement takes two taps** (preview, then a tap on the preview), as CLAUDE.md asks. While a part is picked, taps only preview and never select, so each tap has one meaning.
- **Some actions take effect at once:**
  - A drag released on the hull places right away. It's a deliberate gesture, and Undo covers it.
  - Turn and Delete act in one tap too, also covered by Undo.
- **Moving a placed part needs it selected first.** On a zoomed, full hull, a drag then pans instead of grabbing whatever is under the finger.
- **Gesture rules:**
  - a 10 px slop before a touch counts as a drag
  - a long press at 450 ms
  - a second finger cancels any drag (nothing is placed) and starts a pinch
  - after a pinch, nothing happens until every finger is up
  - a tap acts where the finger first touched
- **Buttons act on taps read from pointer events, not on `click`.** In testing, Chrome dropped the click of a tap that came about 80 ms after a fast drag, so Turn silently didn't turn. The board and drawer already used pointer events.
- **The drawer doesn't scroll while all 12 parts fit**, which they do at every Fold size, so a part can be dragged out in any direction. If it ever overflows, it scrolls up and down, and parts must be dragged out sideways.
- **Placement under the finger:**
  - A preview or ghost centers the part's footprint on the finger, snapped to whole cells, so the tapped cell is always inside it.
  - Within one cell of the frame's edge it slides inside. Farther out, a tap clears the preview and letting go cancels.
- **Build commands are `place`, `move` and `remove`.** Turn records a `move` with the new rotation. Replaying the undo history's commands rebuilds the ship (tested), which M5's timelapse can build on.
- **The sandbox ship lives in memory while the page is open.** Leaving the sandbox and coming back keeps it. It isn't saved: saving ships is M3 and M5, and saving now would mean a save-schema change. `SAVE_VERSION` stays 0.

### Verified here (headless Chromium with Playwright and scripted touch events, not a phone)

- **Building the example ship by touch.** The script ran at 821×283 (folded Chrome tab), 905×370 (folded app) and 960×825 (unfolded). It used:
  - tap placement, with Turn before placing
  - drags from the drawer
  - a placed engine dragged to a new spot
  - a reactor turned twice

  At all three sizes the chip ended at "14/20 parts · Layout OK".
- **Mis-tap and gesture checks:**
  - Stray taps while placing don't place anything.
  - A drag let go over other parts places nothing.
  - Undo twice and redo twice work.
  - A long press opens the card, and the next tap closes it.
  - Pinch zooms in, a pan on the zoomed board moves no parts, and Fit resets the view.
- **Offline:** after install, with the server stopped:
  - the builder loads its parts from the cache
  - a part places
  - leaving the sandbox and coming back keeps the ship
  - all 46 files are cached
- **Regressions:** the M0 checks all still pass (install, offline, update prompt, saves).
- **Errors and speed:**
  - No console errors or warnings.
  - The FPS overlay read 60 fps during a two-second drag on a 60 Hz headless display, at under 0.1 ms of drawing per frame.
  - Headless timing says little about the phone.

### Known issues

- The sandbox ship isn't saved. Reloading or closing the app clears it.
- A drag that starts on the outer edge of the drawer's left column may be taken by Android's back gesture. The drawer keeps 16 px of padding on that side, so start drags from the middle of a part. Not checked on the Fold yet.
- On the folded screen, the layout chip and status line overlap the frame's top and bottom edges. They don't take touches.
- In a folded Chrome tab, the dev-only FPS overlay covers the drawer's top row.
- The art is placeholders: colored boxes, glyphs and interior marks. M4 draws the parts.

### What to test on the phone (Galaxy Z Fold 6)

Open the installed app and tap "Update ready, tap to reload" if it shows; DEV → Status should list a new cache. Then DEV → Builder.

1. **Folded build:** build a full starter ship. Either copy the example above, or make your own with a bridge, reactor, engine and airlock, all joined, until the chip says Layout OK. Use both ways of placing: drag from the drawer, and tap part, tap hull, tap again. Note any tap that did something you didn't mean, and where it happened.
2. **FPS while dragging:** drag a part around for a few seconds, then read the overlay's fps and worst ms.
3. **Unfolded build:** unfold and do it again. The ship survives the fold, because the page doesn't reload. Check the board re-fits.
4. **Editing:** select a part, drag it somewhere else, Turn it, then Delete it. Undo and Redo a few times.
5. **Details card:** long-press a part in the drawer and one on the hull. Check the card is readable and closes on your next touch.
6. **View:** pinch to zoom, pan, then tap Fit.
7. **Back gesture:** start a drag on the far left edge of a left-column part. Does Android go back instead?
8. **Anything else:** note whatever felt slow, too small or confusing.

### Next session

First, fix whatever the phone run turns up and tick M2 once it passes. Then M3, flight checklist and stats. Its first task: `src/sim/constraints.js`, with the five checklist lines from ROADMAP §4.1 and the fix each one names, tested, before any UI. That needs a minimum thrust-to-mass on frames and a crew count (a `data/balance.json` number until there's a crew).

## M1 Grid and module data (2026-10-11)

**Status:** done. Done when is met: tests cover overlap, bounds, rotation and connectivity, and `npm run ship` builds the example starter ship from a script with every placement rule passing. The ROADMAP.md box is ticked. M1 ran in the same session as M0 because Evan asked for it.

### Shipped

- `src/sim/grid.js`, the one grid model: create, bounds, cell lookup, copy-on-write updates, neighbours, and `exteriorOf`, a flood fill that tells open space outside the hull from enclosed holes.
- `src/sim/modules.js`: footprints and door sockets under quarter-turn rotation (clockwise; `rot` is 0 to 3).
- `src/sim/builder.js`, the placement rules:
  - checked when placing: in bounds, no overlap, the frame's module cap, and rotation only for modules that rotate
  - checked on the whole layout: every module reachable from the bridge through matching doors, and at least one airlock on the hull edge
  - `layoutProblems` returns structured problems (`rule`, `message`, `uids`) for M3's checklist to build on
- `src/sim/defs.js`: lookup tables over the parsed data files. The simulation never does I/O.
- `data/modules.json`, with the 12 v0.1 types: bridge, reactor, engine, corridor, airlock, crew quarters, life support, cargo hold, med bay, armory, weapon mount, shield generator. Each has a size, sockets, stats, tags, an interior at tile resolution, a cost and an ASCII glyph. The tile legend and `tilesPerCell` (2) live in the same file.
- `data/frames.json` (the 4×7 starter hull, cap 20) and `data/manufacturers.json` (one manufacturer).
- `tools/validate-data.js` (`npm run validate`): checks fields, types, ranges, socket positions, interior size and characters, tags and cross-references. It reports problems and never throws.
- `tools/build-ship.js` (`npm run ship [script.json]`): applies a script of placements in order, prints the layout and every broken rule, and exits 1 on any. `tests/fixtures/example-ship.json` is the example:

  ```
  WBB.
  L++A
  QQ+.
  RR+.
  RR++
  ..EE
  ..EE
  ```

- 28 new tests, 85 in all.

### Decisions made this session

- A placement is `{ type, x, y, rot }`, with (x, y) the top-left cell of the rotated footprint. Ships are plain data, `{ frame, modules: [{ uid, type, x, y, rot }], nextUid }`, and every change is a command. That gives M5's replay something to build on. Uids never repeat.
- Two doors join only when both modules have a socket on the same cell edge. A socket facing a wall or space is just a wall.
- Connectivity and the airlock rule are checked on the whole layout, not on each placement, so a ship can be half-built in any order. Placement itself checks bounds, overlap, the cap and rotation.
- "On the hull edge" means an airlock cell borders open space connected to the outside. An enclosed empty pocket inside the ship doesn't count.
- Interiors are 2×2 tiles per cell and hold floor, cover, machinery, consoles and airlock tiles. Walls aren't drawn in them: M6 puts walls on module boundaries and doors at sockets, so a one-cell corridor is still two tiles wide.
- Placement rules live in `builder.js` rather than `grid.js`. The grid stays a generic model for battle maps and the colony, matching CLAUDE.md's "grid, builder rules".
- Stats, costs, sockets and names are placeholders until the tone is picked (before M14) and M3 or M16 tune them. They are content, not `balance.json` numbers.

### Known issues

- Nothing in the game uses the module data yet; M2's builder is the first consumer. The page now precaches `data/*.json`, so the next visit shows "Update ready".
- The frame is a plain rectangle. Shaped frames (a tapered nose) would need a mask field and a rule.
- Stats aren't checked for sense: power balance, thrust-to-mass and crew are M3's flight checklist.

### What to test on the phone

Nothing new to see; M1 has no UI. One useful check (M0 checklist line 8): open the installed app after this deploys, tap "Update ready, tap to reload", and confirm DEV → Status shows the new cache version.

### Next session

M2 Touch builder. First task: render the starter frame's grid on the canvas with placeholder module shapes from `data/modules.json`, loaded through the service worker cache, in a "Builder" sandbox in the `?dev=1` menu.

## M0 Scaffold (2026-10-11)

**Status:** done. Done when is met: the game installs from Chrome on the Fold at https://spacewrecked.rcjlabs.com/, relaunches in airplane mode, and the tests pass. The ROADMAP.md box is ticked.

### Shipped

- `index.html`: a full-screen canvas under a DOM UI layer that sits inside the safe area, a system font stack, and `viewport-fit=cover`. A CSP blocks every other origin, so an accidental network call fails loudly.
- `manifest.webmanifest`: fullscreen, landscape, `./` start URL and scope, PNG icons at 192, 512 and maskable 512.
- `icon.svg`, rendered to `icons/*.png` by `tools/icons.js` (its own rasterizer and PNG encoder, no dependencies). It reads a strict SVG subset and errors on anything else.
- `sw.js`, `tools/precache.js` and `.githooks/pre-commit`:
  - cache-first, with the version taken from a content hash
  - old caches deleted on activate
  - index.html as the offline fallback
  - "Update ready, tap to reload", never skipping waiting on its own
- Rotate overlay in pure CSS (works before any script runs), plus a best-effort `screen.orientation.lock('landscape')`.
- `src/core/rng.js`: mulberry32 with a pure API (`next`, `int`, `percent`, `pick`, `shuffle`, `seedFrom`) and a uint32 state.
- `src/core/save.js`: `SAVE_VERSION`, an ordered migration list, parse then migrate then validate, export and import codes (`wt.<version>.<base64url JSON>.<checksum>`).
- `src/core/store.js`, with reducers in `src/sim/`. `src/platform/storage.js` wraps localStorage in try/catch and requests persistent storage.
- Render loop: requestAnimationFrame, devicePixelRatio capped at 2, resize handling, and a 60 or 30 fps cap that holds on 60, 90 and 120 Hz screens. The title screen has a seeded starfield.
- `?dev=1`: a dev menu (sandbox list, still empty; frame cap; save export and import; a status readout) and an FPS and frame-time overlay.
- `tools/serve.js`, package.json scripts, and tests under `node --test`.
- The name is **Space Wrecked**, and the address is https://spacewrecked.rcjlabs.com/. The name lives only in `src/config.js` and the manifest, and a test keeps them in sync.

### Decisions made this session

- `SAVE_VERSION` is 0. M12 sets it to 1 with the campaign state, plus a 0 to 1 migration.
- `config.appId` (`wt`) prefixes storage keys, cache names and save codes. Never change it, even on a rename: that would orphan saves.
- The frame cap defaults to 60, because the Fold 6 screen runs at up to 120 Hz. 30 lives in the dev menu until the settings screen (M18).
- `?dev=1` sticks in localStorage so the installed app, which always opens at `./`, can show it. `?dev=0` turns it off.
- `navigator.storage.persist()` runs on every launch until it is granted, not just the first. Chrome decides silently and favors installed apps, while the first launch is usually a browser tab.
- Importing a save takes two taps: tap to check, tap again to replace.
- The pre-commit hook runs `precache --staged`, which hashes what git will commit, not what is on disk. A file on disk but not committed would 404 on Pages and fail the whole service worker install. Unstaged edits would stamp a version that the later commit doesn't change, so phones would never update.
- Offline, a navigation to an uncached path redirects to the start page. index.html served at a deeper path would point its relative URLs at files that aren't cached.
- The manifest `id` is `/?app=wt`. Chrome resolves it against the domain root, so it reads as `https://spacewrecked.rcjlabs.com/?app=wt`. It is the installed app's identity: never change it once anyone has installed (`tests/manifest.test.js` pins it).
- The game has its own domain, `spacewrecked.rcjlabs.com`, so its storage, caches and install records aren't shared with the other RCJLabs projects on `rcjlabs.github.io`. Never move it again once players have saves.
- `appId` stays `wt` through the rename, and save codes keep the `wt.` prefix. Changing it would orphan saves.

### Verified here (headless Chromium with Playwright, not a phone)

- No installability errors from Chrome, and the manifest parses cleanly.
- The second load is controlled by the service worker, and all 28 files are cached.
- With the server stopped, a reload, `?dev=1` and a deep link all reach the title.
- After a file changes and precache runs, the update prompt appears, the old version keeps running, and a tap reloads into the new version. The old cache is deleted.
- Portrait (370×905) shows the rotate overlay; landscape hides it. The canvas backing store is capped at 2x.
- 60 fps at the 60 cap and 30 at the 30 cap on a 60 Hz headless display. Drawing costs about 0.2 ms a frame.
- Save export and import round-trip, bad and damaged codes show clear messages, and there are no console errors or warnings.

### On the phone (Galaxy Z Fold 6, 2026-10-11)

- Passed:
  - The page loads in Chrome, and portrait shows the rotate prompt (checklist lines 1 and 2).
  - Chrome installs it from https://spacewrecked.rcjlabs.com/ (line 3).
  - The installed app relaunches in airplane mode (line 5).
- Folded, in a Chrome tab, the overlay reads 59 to 61 fps with a worst frame of 17 to 25 ms, at 821×283 (2.90:1) on a 60 Hz screen.
- Not run yet, and not part of Done when:
  - line 4: the Status readout in the installed app
  - line 6: FPS in the installed app, folded and unfolded
  - line 7: save export and import on the phone
  - line 8: the update prompt in the installed app

### Known issues

- When M0 closed, GitHub's Pages settings said the certificate for `spacewrecked.rcjlabs.com` hadn't been issued, though Enforce HTTPS was on and the https site installed and worked offline. If the message is still there after a day: remove the custom domain under Settings → Pages, save, add it back, and save again. That restarts the certificate request.
- Deploy logs warn that `actions/checkout@v4`, `configure-pages@v5` and `deploy-pages@v4` target Node 20, which GitHub now forces onto Node 24. They work. Bump them to newer major versions when convenient.
- **Resolved: Chrome wouldn't install at the old address, `rcjlabs.github.io/Space-Wrecked/`.**
  - Chrome's install sheet said "This app is already installed", but no app existed, and opening it gave "Could not open app".
  - A fresh manifest `id` and dropping `orientation` changed nothing, while Samsung Internet installed the same build.
  - At the new domain, Chrome installed it on the first try. That fits a stuck install record inside Chrome tied to the old address, though it was never confirmed.
- The old address redirects to `spacewrecked.rcjlabs.com`. Anything installed or saved at the old address stays behind, so remove the Samsung Internet test install if it's still there.
- `screen.orientation.lock` only works in fullscreen, which means the installed app. In a Chrome tab it fails silently and the overlay covers it. Unverified: on the unfolded inner screen, Android may ignore orientation requests on large screens. The overlay is the fallback either way.
- The hook needs `npm run hooks` (sets `core.hooksPath`) once per clone. Without it, `sw.js` won't change on commit and phones won't update.
- `user-scalable=no` turns off browser pinch zoom; M2's own pinch zoom replaces it.
- "screen Hz" in the overlay is an estimate and takes a couple of seconds to settle.

### Phone checklist (Galaxy Z Fold 6)

Record pass or fail for each line here, plus the FPS numbers.

1. In Chrome on the folded phone, open https://spacewrecked.rcjlabs.com/?dev=1. Expect the title over a starfield, the FPS overlay at top left and DEV at top right.
2. Rotate prompt: hold the phone upright in the Chrome tab. Expect "Turn your phone sideways". Turn it back and the game returns.
3. Install: Chrome menu (⋮), then Add to home screen, then Install. Expect the ship icon on the home screen, not cropped by the launcher's mask.
4. Launch from the home screen. Expect fullscreen, landscape and no browser bar. DEV, then Status: expect "Running as: installed app" and "Service worker: controlling this page". Note the "Persistent storage" line: granted is likely once installed, but Chrome decides.
5. Offline: close the app fully (swipe it away in recents), turn on airplane mode, and launch it from the icon. Expect the title, not Chrome's offline dinosaur. Turn airplane mode off.
6. FPS overlay: read it folded (about 2.4:1) and unfolded (about 1.2:1; turn the unfolded phone sideways if the rotate prompt shows). Write down fps, worst ms and screen Hz for each. Then DEV, 30 fps, and check the overlay reads about 30.
7. Save: DEV, Export, Copy, then paste into a notes app. Paste "hello" into Import: expect a clear error. Paste the real code, tap Import, then Replace save: expect "Imported."
8. Update (after the next push): with the installed app open, wait for Pages to deploy, switch away from the app and back. Expect "Update ready, tap to reload"; tap it.

### Deploy

- Pages source is **GitHub Actions** (Settings, then Pages). `.github/workflows/pages.yml` runs on every push to `main`, and by hand from the Actions tab ("Deploy to Pages", then "Run workflow").
- Each run does three things in order:
  1. runs `node --test`
  2. checks that `sw.js` matches the committed files
  3. publishes the repo root as committed, with no build step

  If any step fails, the live site stays as it was.
- The custom domain `spacewrecked.rcjlabs.com` is set under Settings → Pages, with Enforce HTTPS on. DNS is a CNAME record `spacewrecked` → `rcjlabs.github.io`. With the Actions deploy, GitHub ignores the `CNAME` file; it stays in the repo as a record, and in case the deploy ever goes back to publishing from a branch.
- The `sw.js` check fails when a commit skipped the pre-commit hook, for example an edit in GitHub's web editor or a clone without `npm run hooks`. Fix: `npm run precache`, commit `sw.js`, push. This fails the deploy on purpose: without a new `sw.js`, installed phones would never pick up the change.

### Local testing

- `npm run serve`, then http://localhost:8080/?dev=1.
- On the phone over USB: `adb reverse tcp:8080 tcp:8080`, then open http://localhost:8080/?dev=1 on the phone. Localhost counts as a secure context, so the service worker works. A LAN IP over plain http does not.
- `npm test`, `npm run icons` (after editing `icon.svg`), `npm run precache`.

### Next session

M1 Grid and module data, done in the same session (entry above).
