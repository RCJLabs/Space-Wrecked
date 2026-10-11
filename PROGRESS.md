# PROGRESS.md

Newest entry first.

## M0 Scaffold (2026-10-11)

**Status:** built, and checked in headless Chromium at Fold-sized viewports. The phone half of Done when (installs on the Fold, reloads offline on the Fold) is still to run: see the checklist below. The ROADMAP.md box is ticked.

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
- `tools/serve.js`, package.json scripts, and 54 tests under `node --test`.

### Decisions made this session

- `SAVE_VERSION` is 0. M12 sets it to 1 with the campaign state, plus a 0 to 1 migration.
- `config.appId` (`wt`) prefixes storage keys, cache names and save codes. Never change it, even on a rename: that would orphan saves.
- The frame cap defaults to 60, because the Fold 6 screen runs at up to 120 Hz. 30 lives in the dev menu until the settings screen (M18).
- `?dev=1` sticks in localStorage so the installed app, which always opens at `./`, can show it. `?dev=0` turns it off.
- `navigator.storage.persist()` runs on every launch until it is granted, not just the first. Chrome decides silently and favors installed apps, while the first launch is usually a browser tab.
- Importing a save takes two taps: tap to check, tap again to replace.
- The pre-commit hook runs `precache --staged`, which hashes what git will commit, not what is on disk. A file on disk but not committed would 404 on Pages and fail the whole service worker install. Unstaged edits would stamp a version that the later commit doesn't change, so phones would never update.
- Offline, a navigation to an uncached path redirects to the start page. index.html served at a deeper path would point its relative URLs at files that aren't cached.
- The manifest `id` is `/?app=wt`. Chrome resolves it against the domain root, so it reads as `https://rcjlabs.github.io/?app=wt`. It is the installed app's identity: never change it once anyone has installed (`tests/manifest.test.js` pins it).

### Verified here (headless Chromium with Playwright, not a phone)

- No installability errors from Chrome, and the manifest parses cleanly.
- The second load is controlled by the service worker, and all 28 files are cached.
- With the server stopped, a reload, `?dev=1` and a deep link all reach the title.
- After a file changes and precache runs, the update prompt appears, the old version keeps running, and a tap reloads into the new version. The old cache is deleted.
- Portrait (370×905) shows the rotate overlay; landscape hides it. The canvas backing store is capped at 2x.
- 60 fps at the 60 cap and 30 at the 30 cap on a 60 Hz headless display. Drawing costs about 0.2 ms a frame.
- Save export and import round-trip, bad and damaged codes show clear messages, and there are no console errors or warnings.

### Known issues

- On the phone so far, the page loads in Chrome and portrait shows the rotate prompt. Install failed (next item). The rest of the checklist is still to run.
- **First install attempt failed.** Chrome's install sheet said "This app is already installed", but no app was on the phone, and nothing in `chrome://webapks` covered this page. The likeliest cause is an install that started and never finished, which Chrome counts as installed; this is unconfirmed. The fix was an explicit manifest `id`, giving the app a fresh identity. If it happens again, the install itself is failing on the phone: check Chrome's notifications during the install.
- **Origin change later.** Saves, the install and the cache all belong to `rcjlabs.github.io`. Adding the custom subdomain (`CNAME`) moves the game to a new origin, and existing installs and saves don't follow; players would need export and import. Set the subdomain before anyone but Evan has a save.
- **Shared origin.** Every RCJLabs Pages project without a custom domain shares `rcjlabs.github.io`, including its localStorage and cache storage. This game namespaces both. But if another project there has a service worker that deletes every cache but its own, or calls `localStorage.clear()`, it would hit this game too. I couldn't check the other repos.
- `screen.orientation.lock` only works in fullscreen, which means the installed app. In a Chrome tab it fails silently and the overlay covers it. Unverified: on the unfolded inner screen, Android may ignore orientation requests on large screens. The overlay is the fallback either way.
- The hook needs `npm run hooks` (sets `core.hooksPath`) once per clone. Without it, `sw.js` won't change on commit and phones won't update.
- `user-scalable=no` turns off browser pinch zoom; M2's own pinch zoom replaces it.
- "screen Hz" in the overlay is an estimate and takes a couple of seconds to settle.

### Phone checklist (Galaxy Z Fold 6)

Record pass or fail for each line here, plus the FPS numbers.

1. In Chrome on the folded phone, open https://rcjlabs.github.io/Space-Wrecked/?dev=1. Expect the title over a starfield, the FPS overlay at top left and DEV at top right.
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
- The `sw.js` check fails when a commit skipped the pre-commit hook, for example an edit in GitHub's web editor or a clone without `npm run hooks`. Fix: `npm run precache`, commit `sw.js`, push. This fails the deploy on purpose: without a new `sw.js`, installed phones would never pick up the change.

### Local testing

- `npm run serve`, then http://localhost:8080/?dev=1.
- On the phone over USB: `adb reverse tcp:8080 tcp:8080`, then open http://localhost:8080/?dev=1 on the phone. Localhost counts as a secure context, so the service worker works. A LAN IP over plain http does not.
- `npm test`, `npm run icons` (after editing `icon.svg`), `npm run precache`.

### Next session

M1 Grid and module data. First task: write the bounds and overlap rules in `src/sim/grid.js`, with tests, before any module data (ROADMAP.md §4.1).
