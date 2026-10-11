# PROGRESS.md

Newest entry first.

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

M1 Grid and module data. First task: write the bounds and overlap rules in `src/sim/grid.js`, with tests, before any module data (ROADMAP.md §4.1).
