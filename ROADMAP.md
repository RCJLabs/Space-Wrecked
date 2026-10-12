# ROADMAP.md: Space Wrecked

**One-liner:** Build a ship from scrap, run from whoever is hunting you, and find a world to call home. The ship you build is the map you defend: when you are boarded, the fight happens room by room in your own layout, in XCOM-style squad battles.

**Tone:** Not decided yet. Pick one before M14 (the act 1 writing): grim survival, hopeful frontier, or wry and blue-collar.

**Platform:** Browser game on GitHub Pages, installable as a PWA, published as a TWA on Google Play (RCJ Labs convention). Landscape only. Offline-first: no backend and no network calls. Android and web; iPhone is not a target. A Capacitor build comes later, for a possible paid version.

**Art:** Procedural, drawn in code. The game world is 3D, drawn by the game's own small renderer on canvas: a glowing blueprint in the builder, solid ships everywhere else. Menus, panels and icons are SVG. The only image files are WebP portraits, scene illustrations and store art. They are generated in Base44 during development, edited by hand, and logged in `assets/LOG.md`.

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
| Graphics | 3D: a blueprint hologram in the builder and solid ships outside it, drawn by our own renderer on canvas; the rules stay on the 2D grid, and the ship layout is the boarding map (was "2D top-down cutaway" until M4; Evan changed it, 2026-10-11) |
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
- **Cells and tiles:** one builder cell is one battle tile. Until M5b a cell was 2 × 2 tiles; Evan asked for finer building. Rooms that need cover are at least 2 cells across, and a corridor can be one tile wide, so where to put a chokepoint is the player's call. (Revisit after M8.)
- **Hull frames** set the build area and the part cap. The starter frame is an open yard of 24 × 14 cells holding up to 40 parts, nose to the right. The ship can go anywhere in it, and the hull is traced from whatever is built. A typical starter ship is 10 × 5 to 14 × 8 cells, so its battle map fits one phone screen at 48-pixel tiles; bigger ships pan.
- **Frame shapes:** a frame can still cut cells out of its rectangle, for a special hull. The starter frame had a ship-shaped outline from M4 to M5b; it is open now.
- **Module definitions** (`data/modules.json`) hold:
  - id, name, manufacturer, size in cells, and whether it rotates
  - the side that must face space, if any: an engine's exhaust, a gun's barrel
  - stats: power, mass, thrust, crew berths, life support, cargo, hit points
  - tags such as bridge, reactor, engine, airlock or weapon mount
  - an interior template at tile resolution: walls, floor, cover props, consoles
  - cost
- **Placement rules:**
  - in bounds, with no overlap
  - every module reachable from the bridge through shared walls: two rooms that share a wall get one doorway in its middle, and corridors side by side open into each other
  - every engine's exhaust and every gun's barrel facing space
  - at least one airlock on the hull edge
- **Flight checklist** (the act 1 goal and the launch condition):
  - power balance of 0 or more
  - thrust-to-mass at or above the frame's minimum
  - crew berths and life support at least equal to the crew
  - bridge, reactor, engine and airlock all present
  - everything connected

  Each failing line names its fix, for example "Life support 2 of 4 crew".
- **Auto-hull:** trace the outline of the occupied cells, slope the corners between parts (fairings), cap the front with a nose, and add nozzles, gun barrels and docking collars where engines, guns and airlocks face space. The builder shows it as the blueprint's rim; outside the builder it is raised into a solid hull, plated in the manufacturer's skin.
- **Blueprint codes** are versioned, compact (base64url) and carry a checksum. A bad code fails with a message, never a crash.
- **Build replay:** every placement is a command, and replaying the command list plays back a timelapse.
- **Touch controls:**
  - drag from a palette drawer, with a ghost preview tinted valid or invalid
  - nothing lands from a single tap: a tap shows the part as a ghost, and a second tap on it places it
  - tap to select; a placed part moves the same way, a tap where it goes and a tap on its ghost; rotate and delete buttons; undo and redo
  - pinch to zoom and pan; twist two fingers to turn the ship

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

- **Maps:** a ship layout converted by `src/sim/mapFromShip.js`, or a planet map built from templates. A ship's map is one tile per builder cell (`tilesPerCell`), with a tile of space around it; the same ship always converts to the identical map (M6, tested against a golden map).
- **Tiles** come from each room's interior template: floor, half cover, full cover, machinery, console (objective), airlock floor. Outside the rooms a tile is space, or hull where the hull closes over a notch.
- **Edges:** walls stand between tiles, not on them, since rooms can be one tile across. An edge is a wall between rooms, the hull, a door (open, closed or locked) where the builder joins two rooms, or a hatch where an airlock opens onto space (entry and exit).
- **Wrecked rooms** from the approach phase put their hazard on every tile of the room: fire, vacuum or rubble.
- **What tiles do** is data (`data/tiles.json`): units stand on floor and airlock floor; crates and consoles are half cover, lockers and machinery full cover; lockers, machinery and the hull block sight.
- **Squad size:** 3 at the start, up to 5 with drop bay modules later. Enemies number 4 to 8. Crew fight as their job (`data/jobs.json`: hit points, aim, defense, mobility, armor, a weapon), and enemies by type (`data/enemies.json`). The attributes in §4.5 feed these numbers later. A campaign's crew fights as itself, wounds and all (M12); the sandboxes and `tools/sim.js` fight with the squad in `data/encounters.json`, where each encounter's enemies are listed too.
- **Where they start** (M8): on a boarding, the squad on the bridge and the boarders at the hatches they come in by, each taking the tiles nearest by walking distance (`src/sim/deploy.js`). The crew moves first.
- **Turns:** sides take turns; each unit gets 2 actions (`balance.actionPoints`):
  - move: one action within its mobility, both for a dash within twice it
  - shoot, which ends the unit's turn
  - overwatch, which ends it too
  - reload, open a door beside it, or stabilize a downed ally beside it: one action each

  A side's turn ends when it says so, or when none of its units has an action left.
- **Movement** (M7): four-way steps between tiles units stand on. Walls, the hull and hatches are in the way; walking through a closed door opens it. Rubble costs 2 a step. A unit passes its own side's units but not the other's, and stops on no one.
- **Line of sight** (M7): a straight line between tile middles. Walls, the hull, hatches and closed doors on the edges it crosses block it, and so do tiles that block sight; through an exact corner it gets by if either way round is clear. Units don't block it. It is the same from either end, and reaches 20 tiles (`balance.sightRange`).
- **Cover** (M7) is directional. Each side of a unit's tile gives cover from what is there: a wall, the hull, a hatch or a closed door is full cover, otherwise the next tile gives its own. Cover on a side counts against attackers on that side of the unit: the north side's against anyone north of it, at any angle. The best that counts is the unit's cover; with none, it is **flanked**.
- **Hit chance** = shooter aim + weapon accuracy at range band − target cover − target defense − overwatch + forgiving odds, kept within 0 to 100. Range bands are straight-line distances: close up to 3 tiles, mid up to 7, long beyond; each weapon gains or loses accuracy by band (`data/weapons.json`). Starting values: half cover 20, full cover 40, overwatch 15. `src/sim/odds.js` returns every part, for the target preview.
- **Crits:** the weapon's crit chance, plus 30 when flanking (`balance.flankCrit`). A crit adds the weapon's crit damage.
- **Damage:** the weapon's damage range, plus crit damage, minus armor, with a minimum of 1. The hit, crit and damage are rolled in that order from the battle's seeded RNG.
- **Overwatch:** the unit fires once, at the first enemy that steps into its sight during the other side's turn, with the overwatch penalty; not while that enemy is passing through an ally's tile, so two units never share one. It ends at the start of the unit's own next turn.
- **Down, not dead:** crew at 0 HP go down and bleed out over 3 of their own turns (`balance.bleedOutTurns`) unless an ally beside them stabilizes them. Bleeding out puts them out of the fight, badly hurt, or kills them where permanent death is on (harder settings only). Enemies at 0 HP die.
- **Hazards** (M7): fire burns 2 at the start of each of a unit's turns there. In vacuum, suit air lasts 3 turns, then the unit takes 2 a turn (the oxygen clock).
- **Objectives:** eliminate, extract, hack, rescue, hold, salvage. M7 has eliminate: a side wins when the other has no one standing.
- **Forgiving odds:** an optional menu setting adds 10 to the crew's next shot for each miss in a row, up to 30. The bonus is included in the number shown, so Law 4 still holds.
- **The log:** every action returns the events it caused, and the same setup, seed and actions always give the same events (`src/sim/battle.js`; the example battle in `tests/golden/` is replayed by the tests).
- **Giving orders** (M8, `src/sim/fight.js`): a tap never spends an action. A tap on a tile shows the move (its path, one action or a dash, and the cover where it stops), and a second tap on it makes it. A tap on an enemy, or Shoot, shows the shot with its odds part by part, and Fire or a second tap takes it. Overwatch, Reload, Stabilize and Open door are buttons; End turn takes a second tap while anyone can still act. The board opens square to the ship, where tiles are biggest, and every enemy is shown (no fog of war); those the selected unit can see show the hit chance.
- **The enemy's turn** is worked out at once by the rules and then played out on the board, event by event: walks, shots that land or fly wide with the damage over the unit hit, doors opening, whose turn it is. Skip goes to the end.
- **The enemy AI** (M9, `src/sim/ai.js`, pure and with no random numbers) plays the enemy's turns. It plays a unit at a time and scores every plan the unit could make:
  - stay, move or dash, then shoot, overwatch or nothing;
  - or breach: open a door beside it and shoot or watch through, which draws no overwatch fire.

  A plan's score is in expected hit points. It is the harm its shot should do (kills count 4 more), minus the harm every enemy who can see where it ends up could do to it there, and minus the overwatch fire on the way. Overwatch adds something, more with an enemy close enough to step into sight. When it won't shoot, each step from the enemy costs a little. Doors its path opens count.

  A shot worth taking goes before holding back, unless it is reckless. The AI never ends up in the open (seen by an enemy with no cover between) unless no cover is in reach, or the shot from there beats every covered tile's. The weights are starting values for M11 to tune.

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
- **Wounds** carry between battles and heal in the med bay over time. Since M12 a crew member's hit points carry from fight to fight, and anyone who went down comes back with 1. Nothing heals them yet: the med bay is M23's, so act 1 needs a rule of its own (for M14, Evan's call).
- **Portraits:** recruits use layered SVG portraits drawn in code, so scars and implants can appear mid-game. Named characters use hand-edited Base44 portraits.

### 4.6 Economy

- **Credits** buy parts and services. **Parts** are modules held in inventory. **Salvage** is raw material for repairs and, later, crafting.
- Act 1 target: launch after roughly 8 to 12 jobs, in under an hour. Check this in play.

### 4.7 Generators (all seeded)

- **Enemy ships** (M10, `src/sim/gen/`, pure) are built with the builder's own rules from a preset in `data/ships.json` and a seed: a pirate cutter, a patrol corvette, a derelict hauler. The same preset and seed always give the same ship.
  - **A preset** names its frame, the crew it carries, its beam (cells across), whether it is mirrored about its middle row, and its parts bow to stern, each a count or a range. A derelict also says how many rooms come wrecked.
  - **The parts** are the preset's counts, then whatever the flight checklist asks for: its fixes name the part to add. On a mirrored ship a part comes in pairs unless it can sit in the line along the middle row with the way on open. Engines, guns and airlocks can't, nor can rooms with a crate or locker at an end of their middle row.
  - **The layout** grows from the bridge at the front:
    - a spine of corridors aft along the middle row;
    - the rooms, bow to stern;
    - engines at the stern, then guns, then airlocks.

    Every part goes in through `placeModule`, and every layout rule has to pass after each one. Each goes in the best place by a score: within the beam, at its place bow to stern, sharing the most wall, plus a seeded nudge.
  - **The generator asks more than the builder:**
    - nothing stands in an engine's wake or a gun's line of fire;
    - every airlock keeps a hatch;
    - every room can be walked to. A doorway in front of a locker or machinery could otherwise cut a room off.
  - **Every generated ship** passes the flight checklist for its crew, converts to a boarding map with a way on foot from its hatches to every room, and opens in the builder, where its build log replays.
- Planet maps from templates plus props.
- A job board built from templates crossed with who, where and a twist.
- Act 2 sectors as node graphs with typed nodes.

### 4.8 Saves

- `SAVE_VERSION` gates all saves, with a migration for every bump. Never reset player saves.
- Every change to the campaign is saved as it happens (M12): at the hub, as a fight begins, after every order in a fight, and as it ends. This list first named the start of each player turn; saving only there would let a player quit after a miss, reopen to the same roll and spend it on another shot.
- A saved fight holds its battle whole, the map and its RNG state included, so a game update between quitting and reopening can't move a wall under a unit.
- The game reopens at the title, and Continue goes back to where the campaign was: the hub, or the fight as it stood.
- The RNG state is part of the save.
- Settings can export and import a save as text. A TWA shares Chrome's storage, so clearing Chrome's data wipes saves; the export is the player's backup.
- The builder keeps up to six ships in slots, each with the build log its replay plays back. A single ship travels between devices as a blueprint code.

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

- [x] **M1 Grid and module data.** grid.js placement rules, rotation and door-socket connectivity; the 12 module types in data/modules.json; a data validator.
  **Done when:** tests cover overlap, bounds, rotation and connectivity, and a ship can be built from a script.
- [x] **M2 Touch builder.** Canvas grid, palette drawer, drag ghost, select, rotate, delete, undo and redo, pinch zoom and pan. Placeholder shapes are fine.
  **Done when:** a full starter ship builds on the Fold, folded and unfolded, without mis-taps, at 60 fps while dragging.
- [x] **M3 Flight checklist and stats.** constraints.js, a stat panel, and the checklist with fixes.
  **Done when:** every failing line names its fix, and a failing ship saves but cannot launch.
- [x] **M4 Parts art and auto-hull, in 3D.** The 3D blueprint builder on our own canvas renderer: 3D fittings for all 12 module types, the hull tracer (rim, fairings, nose, nozzles, barrels, collars), the ship-shaped starter frame, twist to turn, and a Hull view of the solid ship in one manufacturer's skin. (Planned as 2D SVG parts; changed to 3D mid-milestone.)
  **Done when:** any layout looks like a ship from outside, and zooming stays smooth.
- [x] **M5 Blueprints, saves and replays.** The blueprint codec, copy and paste, save slots (six ships kept in the builder, each with its build log), and the build replay timelapse.
  **Done when:** a code from one device rebuilds the identical ship on another, and a broken code shows a message.
- [x] **M5b Fine grid, smaller parts, build anywhere.** Evan's change after M5 (2026-10-11):
  - The half squares under the old cells become the build grid, one square per battle tile.
  - Every part shrinks to a size of its own.
  - The fixed hull outline goes: a ship can be built anywhere on a 24 × 14 yard, up to 40 parts.
  - Rooms that share a wall join through a doorway on their own. An engine's exhaust and a gun's barrel must face space.
  - Saves (version 3) and blueprint codes (version 2) convert.

  **Done when:** on the Fold's cover screen, a ship built from the smaller parts, off the old outline and joined only by shared walls, passes the flight checklist with no part placed by mistake; and ships and codes from M5 still open.
- [x] **M5c Tap to move.** Evan's ask after M5b (2026-10-11): a placed part moves by taps, the way a new one is placed. Tap it, tap where it goes to see it there, and tap that preview to move it; Turn turns the preview. Dragging still works.
  **Done when:** on the Fold, a placed part moves and turns by taps alone, the move can be undone, and a stray tap never moves anything.

**Gate 1:** Evan builds for 15 minutes on the Fold and wants to keep going. If not, fix the builder before Phase 2. **Passed 2026-10-11** ("All good. Continue the work").

### Phase 2: Prove the boarding fight

- [x] **M6 Ship to battle map.** Interior templates become tiles: doors, walls, cover, airlocks, wrecked-room flags.
  **Done when:** the same ship always converts to the identical map (tested), and the map renders.
- [x] **M7 Tactical rules, headless.** Units, actions, movement, line of sight, directional cover, flanking, hit chance, crits, armor, overwatch, reload, bleed-out, an event log.
  **Done when:** hit-chance math is tested and a fixed-seed battle replays identically.
- [x] **M8 Tactical UI.** Selection, movement ranges, target preview with exact odds, tap to preview and tap to confirm, enemy turn playback with skip, hit and miss feedback.
  **Done when:** a full 3-against-4 fight plays on the Fold.
- [x] **M9 Enemy AI v1.** Scored positions (cover, flank, distance, threat), target choice, an overwatch fallback, breaching from airlocks.
  **Done when:** in test scenarios the AI takes cover and flanks, and never stands in the open without a reason.
- [x] **M10 Enemy ship generator.** Presets built with the builder's rules.
  **Done when:** 100 generated ships all pass the flight checklist (tested).
- [x] **M11 Balance harness.** `node tools/sim.js` runs AI-against-AI battles headless and reports win rate, turn count and hit distribution.
  **Done when:** 1,000 fights report in under a minute.

**Gate 2:** moving modules changes how the fight plays, and a fight takes 5 to 8 minutes. **Passed 2026-10-12** ("Gate 2 passed").

### Phase 3: Act 1 (v0.1)

Pick the tone before M14.

- [x] **M12 Campaign state.** Acts, hub, credits, parts, crew, heat and flags; autosave points; `SAVE_VERSION` 4 (M3 took 1 for the builder's ship, M5 took 2 for its slots, M5b took 3 for the finer grid).
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
| Players build chokepoint fortresses | Balance runs show defenders always win. AI against AI on the example ship, the crew of 3 wins 64% (58–70) against 4 boarders (`tools/sim.js`, M11). With the airlock moved under the bridge it wins 83% | Enemies breach walls and choose entry points; corridors stay two tiles wide. Since M9 the AI breaches doors: it opens one and shoots through, which overwatch can't punish |
| Fights stall in standoffs | AI-against-AI fights reach the round limit. The harness's 1,000 fights in M11 stalled on 24% of cutters, 9% of corvettes and 5% of haulers, and none on the example ship. Both sides hold on overwatch either side of a chokepoint. Boarders never attack a crew that holds the bridge: with a crew that only ends its turn, 5 of 5 fights reached 60 rounds on the example ship and on the campaign's start ship (M12). A campaign fight can't be left until one side wins, so there the player has to go to them | Candidates, Evan's call: boarders press on (they came to fight), cutting through walls, ships with a second way round. `tools/sim.js` reports the stalls ("No winner") |
| Percentage misses feel unfair | Testers complain about high-odds misses | Clearer cover display, the forgiving-odds setting, the math always shown |
| 3D on canvas runs slowly on mid-range phones | Dropped frames turning or zooming the board (M4), or in battles (M8) | Rough half-resolution frames while the camera moves or units walk, only on a phone too slow for full ones (the frame budget, after M6: they blurred zooming on the Fold); cache the still board, and in a fight redraw it only when something on it changed (M8); fewer lines, cap the pixel ratio. Past that: three.js (MIT, one vendored file, no build step), with Evan's approval |
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
- closing doors in battle, and locked doors: since M7 a unit can open a door beside it, but not shut one (raised in M7: defenders sealing a breach)
- fog of war: since M8 every enemy is always shown; hiding those no one in the crew can see would make scouting matter (raised in M7, decided against for now in M8)
- the camera following the action in an enemy turn: on a ship too big for the screen, part of a turn can play out of view (raised in M8)
- dragging to lay a run of corridor in one go: since M5b a corridor is one cell, so a long one takes two taps a cell (raised in M5b; could come sooner if Gate 1 finds it tedious)
- doorways onto lockers: the builder puts a doorway in the middle of a shared wall even with a locker, crates or machinery behind it. That can leave a room out of reach on foot in a fight. Generated ships avoid it; a player's ship still can, with no warning (raised in M10)
- an enemy hull frame: §5 counts one for v0.1, but every preset builds on the starter yard for now. One comes when enemy ships need a bigger yard or a higher cap (raised in M10)

Ideas that come up during a session go here, not into code.
