# ROADMAP.md: Space Wrecked

**One-liner:** Build a ship from scrap, run from whoever is hunting you, and find a world to call home. The ship you build is the map you defend: when you are boarded, the fight happens room by room in your own layout, in XCOM-style squad battles.

**Tone:** Not decided yet. Pick one before M14 (the act 1 writing): grim survival, hopeful frontier, or wry and blue-collar.

**Platform:** Browser game on GitHub Pages, installable as a PWA, published as a TWA on Google Play (RCJ Labs convention). Landscape only. Offline-first: no backend and no network calls. Android and web; iPhone is not a target. A Capacitor build comes later, for a possible paid version.

**Art:** Procedural SVG for everything in the game world and interface. The only image files are WebP portraits, scene illustrations and store art. They are generated in Base44 during development, edited by hand, and logged in `assets/LOG.md`.

**Design history:** the "Space tactics RPG: brainstorm plan" doc. Where the two differ, this file wins.

---

## 1. Pillars and laws

**Pillars, in priority order:**

1. **BUILD.** The ship builder is the selling point. It has to be satisfying on a phone with nothing else around it.
2. **FIGHT.** XCOM-style squad battles, fought mostly inside ship layouts.
3. **FLEE AND SETTLE.** The journey: a pursuer, sectors to cross, a world to choose, a colony to hold.

**Laws (test every feature against these):**

- **Law 1: Every module changes something outside the builder.** That can be the battle map, the approach phase, travel range, crew or the colony. A module that only changes a number on the builder screen gets cut.
- **Law 2: The ship you build is the map you defend.** Boarding maps always come from the actual layout, damage included.
- **Law 3: Every battle feeds the ship or the run.** It leaves behind salvage, parts, wounds, heat or crew. No battle ends with nothing changed.
- **Law 4: Odds are visible and honest.** The hit chance on screen is the number rolled against. Rolls are seeded and the RNG state is saved, so reloading never rerolls.
- **Law 5: Heat is the clock.** Pressure comes from the pursuer in every act. It is soft: it raises danger, but it never ends a run on a timer.
- **Law 6: Offline always.** No feature may need the network.

---

## 2. Campaign structure

The game has three acts, and the home moves at each gate.

| Act | Hub (home) | What you do | Pressure | Ends when |
| --- | --- | --- | --- | --- |
| 1 · Homeworld | A hangar with a half-built hull | Jobs for your background pay in parts and credits; you finish the ship | Each job raises heat; at thresholds the pursuer raids the hangar | The ship passes its flight checklist and you launch |
| 2 · The run | Your ship | Jump between sectors, scout worlds, trade, board and salvage | Heat rises with time and noise; regrouping heals but costs time | You pick a world and found the colony |
| 3 · The colony | Your settlement | Build with the ship grid, run expeditions in the ship, hold off raids | Heat sets how often the pursuer finds you | Open-ended |

Every act runs the same mission loop: hub, travel, node, mission, aftermath, then push on or regroup.

Act length targets (proposed, to check in play): act 1 under an hour, act 2 the longest, act 3 open-ended.

**Settling:** the ship stays flyable for expeditions. Founding the colony asks you to donate modules, such as a reactor or hydroponics, which become its first buildings.

---

## 3. Locked decisions

| Topic | Decision |
| --- | --- |
| Spine | Ship-first sandbox captain; squad battles matter too |
| Structure | Expeditions from a persistent home; the home moves from hangar to ship to colony |
| Story | Start on a homeworld set by your background, earn parts for a starter ship, flee, search, settle |
| Act 1 | Half-built hull in the hangar from the first minute; jobs pay in parts; launching ends the act |
| Graphics | 2D top-down cutaway; the ship layout is the boarding map |
| Ship combat | A short approach phase decided by ship stats, then boarding as a squad battle |
| Hit model | XCOM-style percentage rolls, exact odds shown, seeded |
| Pressure | Heat from the pursuer in all three acts |
| Backgrounds | Each sets your start, kit and pursuer; 3 at launch, on one shared homeworld |
| Settling | The ship stays flyable; donated modules seed the colony |
| Platform | Offline-first, Android (TWA) and web, no backend at launch |
| Images | Base44 at development time only, for portraits, scenes and store art; builder parts drawn in code; nothing generated during play |
| Money | Free for now; if paid later, a Capacitor build with the web version cut to a demo |

Change a locked decision only with Evan's say-so. Record the change here and in the plan doc.

---

## 4. Systems

Numbers marked as starting values live in `data/balance.json` and get tuned with `tools/sim.js`.

### 4.1 Grid and builder

- **One grid model** (`src/sim/grid.js`) serves the player's ship, enemy ships, battle maps and the colony.
- **Cells and tiles:** modules snap to builder cells, and one cell becomes 2 × 2 battle tiles. Rooms get space for cover, and corridors are never one tile wide. (Starting value; revisit after M8.)
- **Hull frames** set the maximum footprint and module cap. Size the starter frame so its battle map fits one phone screen at 48-pixel tiles: about 4 × 7 cells, or 8 × 14 tiles. Bigger frames pan.
- **Module definitions** (`data/modules.json`) hold:
  - id, name, manufacturer, size in cells, and whether it rotates
  - door sockets on its edges
  - stats: power, mass, thrust, crew berths, life support, cargo, hit points
  - tags such as bridge, reactor, engine, airlock or weapon mount
  - an interior template at tile resolution: walls, floor, cover props, consoles
  - cost
- **Placement rules:**
  - in bounds, with no overlap
  - every module reachable from the bridge through matching door sockets
  - at least one airlock on the hull edge
- **Flight checklist** (the act 1 goal and the launch condition):
  - power balance of 0 or more
  - thrust-to-mass at or above the frame's minimum
  - crew berths and life support at least equal to the crew
  - bridge, reactor, engine and airlock all present
  - everything connected

  Each failing line names its fix, for example "Life support 2 of 4 crew".
- **Auto-hull:** trace the outer boundary of occupied cells, offset it outward, round the corners, and draw plating in the manufacturer's style.
- **Blueprint codes** are versioned, compact (base64url) and carry a checksum. A bad code fails with a message, never a crash.
- **Build replay:** every placement is a command, and replaying the command list plays back a timelapse.
- **Touch controls:**
  - drag from a palette drawer, with a ghost preview tinted valid or invalid
  - tap to select; rotate and delete buttons; undo and redo
  - pinch to zoom and pan

### 4.2 Approach phase (ship against ship)

- It starts when you meet a hostile ship at a node and lasts up to 3 rounds.
- Each round both sides pick one order: **Fire** at a module type (weapons, engines, shields, reactor), **Evade**, **Flee**, or **Close to board**.
- Volleys use visible percentage odds: the attacker's gunnery against the target's evasion. Shields absorb damage before modules take it.
- **Outcomes:**
  - one side escapes
  - one side is disabled and boarded
  - a ship is destroyed, which leaves only scrap
- Damaged modules carry into the boarding map as wrecked rooms: fire, vacuum or rubble.

### 4.3 Squad battles

- **Maps:** a ship layout converted by `src/sim/mapFromShip.js`, or a planet map built from templates.
- **Tiles:** floor, wall, door (open, closed or locked), half cover, full cover, hazard (fire, vacuum), airlock (entry and exit), console (objective).
- **Squad size:** 3 at the start, up to 5 with drop bay modules later. Enemies number 4 to 8.
- **Turns:** each unit gets 2 actions:
  - move, or dash using both actions
  - shoot, which ends the unit's turn
  - overwatch, reload, use an ability, or interact
- **Line of sight** is a grid ray cast. **Cover** is directional, half or full, from the side facing the shooter. **Flanking** removes cover.
- **Hit chance** = shooter aim + weapon accuracy at range band − target cover − target defense + modifiers. Overwatch shots take a penalty. Starting values: half cover 20, full cover 40, overwatch 15.
- **Crits:** the weapon's crit chance, plus a bonus when flanking.
- **Damage:** the weapon's damage range minus armor, with a minimum of 1.
- **Down, not dead:** a unit at 0 HP bleeds out over a few turns unless stabilized. Permanent death applies on harder settings only.
- **Oxygen clock:** on vacuum maps, suit air runs down each turn.
- **Objectives:** eliminate, extract, hack, rescue, hold, salvage.
- **Forgiving odds:** an optional menu setting adds a small bonus after consecutive misses. The bonus is included in the number shown, so Law 4 still holds.

### 4.4 Heat

- A meter from 0 to 100 per run, owned by your background's pursuer.
- **Gains (starting values):**
  - job +8, loud job +15
  - jump +3, regroup +5
  - docking at a station in pursuer space +10
- **Losses:**
  - long jump −10
  - transponder swap −30, once per sector
  - bribes, hiding in nebulae
- **Thresholds:**
  - 25: rumors, and agents at stations
  - 50: hunter encounters at nodes
  - 75: a task force, and raids
  - 100: a forced confrontation event
- **In act 3**, heat decays slowly, distance from pursuer space lowers what you gain, and raid frequency follows heat.

### 4.5 Characters

- **Captain:** background, 2 traits and a starting job. **Crew:** generated recruits with a background, a trait and a job.
- **Attributes:** Grit, Aim, Wits, Nerve.
- **Jobs:** Marine, Engineer and Medic in v0.1; Pilot, Scout, Xenobiologist and Quartermaster later. Each job has a ship station effect, battle abilities and a colony effect.
- **Wounds** carry between battles and heal in the med bay over time.
- **Portraits:** recruits use layered SVG portraits drawn in code, so scars and implants can appear mid-game. Named characters use hand-edited Base44 portraits.

### 4.6 Economy

- **Credits** buy parts and services. **Parts** are modules held in inventory. **Salvage** is raw material for repairs and, later, crafting.
- Act 1 target: launch after roughly 8 to 12 jobs, in under an hour. Check this in play.

### 4.7 Generators (all seeded)

- Enemy ships built with the builder's rules, with presets: pirate cutter, patrol corvette, derelict hauler.
- Planet maps from templates plus props.
- A job board built from templates crossed with who, where and a twist.
- Act 2 sectors as node graphs with typed nodes.

### 4.8 Saves

- `SAVE_VERSION` gates all saves, with a migration for every bump. Never reset player saves.
- Autosave at the hub, before and after each battle, and at the start of each player turn in battle.
- The RNG state is part of the save.
- Settings can export and import a save as text. A TWA shares Chrome's storage, so clearing Chrome's data wipes saves; the export is the player's backup.

---

## 5. Content targets

| Content | v0.1 | v1.0 |
| --- | --- | --- |
| Module types | 12 | 40 to 60 |
| Hull frames | 1 starter, 1 enemy | 6 |
| Manufacturers | 1 | 3 |
| Weapons | 4 | 15 |
| Enemy types | 4 | 15 to 20 |
| Mission types | 3 plus the hangar raid | 8 |
| Job templates | 10 | 40 or more |
| Backgrounds | 1 | 3 |
| Crew jobs | 3 | 7 |
| Traits | 6 | 20 |
| Events | 10 | 100 or more |

The v1.0 column is a set of targets, not commitments.

**v0.1 module types:** bridge, reactor, engine, corridor, airlock, crew quarters, life support, cargo hold, med bay, armory, weapon mount, shield generator.

**v0.1 background** (my proposal; any one works): debt-bound miner. The company's repo crews hunt you by tracking your ship's registration.

---

## 6. Versions

| Version | Phases | What a player gets |
| --- | --- | --- |
| v0.1 | 0 to 3 | Build a ship in your hangar, take jobs, fight off a raid, launch |
| v0.2 | 4 | The run: sectors, the approach phase, boarding both ways, recruits, scouting worlds |
| v0.3 | 5 | The colony: settling, the colony builder, expeditions, raids |
| v0.4 | 6 | Breadth: 3 backgrounds, 3 manufacturers, all jobs, factions, quests, images, audio |
| v1.0 | 7 and 8 | Balanced, with a tutorial, released on Google Play |

Session estimates (mine, not measured): about 19 sessions for v0.1, 7 for v0.2, 4 for v0.3 and 6 for v0.4. v1.0 is open.

---

## 7. Milestones

One milestone per session. Each has a **Done when**; if a milestone won't fit, cut scope inside it rather than deferring its Done when. A phase gate is Evan's call after testing on the phone.

### Phase 0: Foundation

- [x] **M0 Scaffold.**
  - index.html and the ES module layout in CLAUDE.md
  - landscape manifest and rotate prompt
  - service worker, cache-first and versioned
  - `src/core/rng.js`: mulberry32 with saved state
  - `src/core/save.js`: `SAVE_VERSION`, migrations, export and import
  - state store, a `?dev=1` menu to jump between sandboxes, and an FPS overlay
  - `node --test` running, `.nojekyll`, Pages serving `main`, and an empty PROGRESS.md

  **Done when:** it installs as a PWA on the Fold, reloads with the network off, and tests pass.

### Phase 1: Prove the builder

- [ ] **M1 Grid and module data.** grid.js placement rules, rotation and door-socket connectivity; the 12 module types in data/modules.json; a data validator.
  **Done when:** tests cover overlap, bounds, rotation and connectivity, and a ship can be built from a script.
- [ ] **M2 Touch builder.** Canvas grid, palette drawer, drag ghost, select, rotate, delete, undo and redo, pinch zoom and pan. Placeholder shapes are fine.
  **Done when:** a full starter ship builds on the Fold, folded and unfolded, without mis-taps, at 60 fps while dragging.
- [ ] **M3 Flight checklist and stats.** constraints.js, a stat panel, and the checklist with fixes.
  **Done when:** every failing line names its fix, and a failing ship saves but cannot launch.
- [ ] **M4 Parts art and auto-hull.** SVG parts for all 12 module types in one manufacturer style; palette tokens; rasterize and cache per zoom level; the hull tracer with plating.
  **Done when:** any layout looks like a ship from outside, and zooming stays smooth.
- [ ] **M5 Blueprints, saves and replays.** The blueprint codec, copy and paste, save slots, and the build replay timelapse.
  **Done when:** a code from one device rebuilds the identical ship on another, and a broken code shows a message.

**Gate 1:** Evan builds for 15 minutes on the Fold and wants to keep going. If not, fix the builder before Phase 2.

### Phase 2: Prove the boarding fight

- [ ] **M6 Ship to battle map.** Interior templates become tiles: doors, walls, cover, airlocks, wrecked-room flags.
  **Done when:** the same ship always converts to the identical map (tested), and the map renders.
- [ ] **M7 Tactical rules, headless.** Units, actions, movement, line of sight, directional cover, flanking, hit chance, crits, armor, overwatch, reload, bleed-out, an event log.
  **Done when:** hit-chance math is tested and a fixed-seed battle replays identically.
- [ ] **M8 Tactical UI.** Selection, movement ranges, target preview with exact odds, tap to preview and tap to confirm, enemy turn playback with skip, hit and miss feedback.
  **Done when:** a full 3-against-4 fight plays on the Fold.
- [ ] **M9 Enemy AI v1.** Scored positions (cover, flank, distance, threat), target choice, an overwatch fallback, breaching from airlocks.
  **Done when:** in test scenarios the AI takes cover and flanks, and never stands in the open without a reason.
- [ ] **M10 Enemy ship generator.** Presets built with the builder's rules.
  **Done when:** 100 generated ships all pass the flight checklist (tested).
- [ ] **M11 Balance harness.** `node tools/sim.js` runs AI-against-AI battles headless and reports win rate, turn count and hit distribution.
  **Done when:** 1,000 fights report in under a minute.

**Gate 2:** moving modules changes how the fight plays, and a fight takes 5 to 8 minutes.

### Phase 3: Act 1 (v0.1)

Pick the tone before M14.

- [ ] **M12 Campaign state.** Acts, hub, credits, parts, crew, heat and flags; autosave points; `SAVE_VERSION` 1.
  **Done when:** quitting anywhere and reopening resumes correctly.
- [ ] **M13 Hangar hub.** The half-built starter hull, construction mode (owned parts only), the flight checklist as the act goal, and a crew panel.
  **Done when:** a new player is building within 60 seconds of starting.
- [ ] **M14 Background, district and jobs.** One background, a job board, 10 job templates, planet map generator v1, 3 mission types, rewards.
  **Done when:** ten jobs in a row feel varied (Evan's call).
- [ ] **M15 Heat v1 and the hangar raid.** Heat from jobs, thresholds, and a raid defended on the hangar map.
  **Done when:** ignoring heat brings a raid, and managing it avoids one.
- [ ] **M16 Shop and economy v1.** A parts shop, prices and drop tables.
  **Done when:** a test run reaches launch in under an hour.
- [ ] **M17 Launch.** The checklist passes, the launch sequence plays, and a stub stands in for act 2.
  **Done when:** launching saves and moves on cleanly.
- [ ] **M18 First run and settings.**
  - captain creation: background fixed for v0.1, 2 traits, a job
  - tutorial prompts for building and for the first battle
  - settings: difficulty, forgiving odds, reduce motion, sound, export and import save

  **Done when:** Gate 3 passes.

**Gate 3:** a stranger plays from the first screen to launch unaided.

### Phase 4: Act 2 (v0.2), detailed after v0.1 ships

- [ ] M19 Sector generator, supplies and jumps
- [ ] M20 Node types, events and scanning
- [ ] M21 Approach phase
- [ ] M22 Boarding both ways
- [ ] M23 Recruits, crew management, med bay healing
- [ ] M24 Heat v2: hunters, regrouping, transponders
- [ ] M25 Scouting candidate worlds

### Phase 5: Act 3 (v0.3)

- [ ] M26 Settling and donated modules
- [ ] M27 Colony builder and production
- [ ] M28 Expeditions from the colony
- [ ] M29 Raids

### Phase 6: Breadth (v0.4)

- [ ] M30 Backgrounds 2 and 3, and their pursuers
- [ ] M31 Manufacturers
- [ ] M32 All jobs, traits and talents
- [ ] M33 Factions, quests and companions
- [ ] M34 Image pass: Base44 portraits and scenes, layered recruit portraits
- [ ] M35 Audio pass with ZzFX

### Phase 7: Content and balance

Rosters, balance runs, difficulty settings, accessibility (a colorblind-safe palette, text size), and tutorial polish.

### Phase 8: Release (v1.0)

TWA build, Play listing, closed test, performance on a low-end phone, offline and lost-save checks, license audit, credits screen, privacy policy.

### Phase 9: Later

A Capacitor build; a paid version with a web demo; optional cloud saves on Base44; a daily seeded sector; online blueprint sharing.

---

## 8. Risks

| Risk | Early sign | Response |
| --- | --- | --- |
| The builder feels fiddly on a phone | Gate 1 fails | Fix it before Phase 2; fall back to bigger modules or a slot hull |
| Two deep systems overrun scope | Phase 2 runs past about 8 sessions | Keep the shared grid; cut base building to slots first |
| Players build chokepoint fortresses | Balance runs show defenders always win | Enemies breach walls and choose entry points; corridors stay two tiles wide |
| Percentage misses feel unfair | Testers complain about high-odds misses | Clearer cover display, the forgiving-odds setting, the math always shown |
| Canvas runs slowly on mid-range phones | Dropped frames in M2 or M8 | Cache rasterized parts, redraw only what changed, cap the pixel ratio |
| Lost saves | Reports after Chrome data is cleared | Persistent storage request, export and import, migrations |
| Act 1 drags | Test runs pass an hour | Fewer jobs to launch; the builder from the first minute |
| Generated images look mismatched | The image pass looks patchy | Palette pass, reference images, fewer images |
| Tone still undecided | M14 arrives | Decide before writing jobs and events |

---

## 9. Parking lot

These ideas wait until v0.4 or later:

- roles as licenses: mercenary, surveyor, homesteader, hauler, salvager, smuggler
- nemesis captains and legacy captains
- black box derelicts and zero-g drift
- a daily anomaly and a blueprint gallery
- named companions with loyalty quests
- paint and decals
- vibration on hits

Ideas that come up during a session go here, not into code.
