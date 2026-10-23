# PROGRESS.md

Newest entry first.

## M46 Refits on the move (2026-10-23)

**Status:** done, and the ROADMAP.md box is ticked. Every bar of the Done when is met. Saves are at v42.

**How it was picked:** item 3 of the Phase 8 brainstorm, next in my recommended order, on Evan's "Do recommendations". From §9: refits away from stations, scrapping a wrecked part for a spare, picking what to strip, and scrap by what is left. Measured first on main after M45 (100 voyages, and the approach harness):
- Parts moved only at a port. A wreck stayed on until a station repaired it (4 repairs in 100 voyages).
- A won boarding stripped 1 or 2 of her working parts by a roll: 20 parts in 100 voyages, a bridge or an airlock as likely as a gun.
- Her scrap came in full, though 73% to 93% of her parts still work when she can be boarded (median 91%).

**What shipped:**
- **Rearrange between jumps** (`src/sim/rearrange.js`): on the run away from a port, with nothing to deal with first, the ship's panel says Rearrange and opens construction mode on the parts aboard alone. They move and turn, and the look can change, but none comes off or goes on: Delete and Swap say so.
- **Joins hold the ship on the run** (`travel.js` failingCheck): a move that splits the joins keeps the ship from jumping, anywhere on the run, and the chart says Rearrange fixes it. Away from a port no other line holds it, as a move can't change them. At the colony nothing changes.
- **Scrap a wreck for a spare** (`campaign.js` refitShip, `session.js` swap): in a full refit, a wrecked part's card offers Scrap for each version of it on hand, its own too. The first tap asks; the second puts the spare in the wreck's spot and turn. The wreck is gone, its damage with it, nothing on hand, and the history starts over, since a scrap can't be undone. The ship is never without that part in between.
- **Pick what to strip** (`src/sim/strip.js`): a won boarding aboard her, and a derelict won on a trip from the colony, offer her working parts on the end panel as toggles, with the dearest picked to start. Continue strips the picks. Save v42 keeps her pool; a fight saved before offers what it had rolled.
- **Scrap by what is left:** a boarding's scrap is scaled by the share of her parts still working. The approach screen's stakes give that range ("what the volleys left of it"). A ship blown up pays as before.

**Done when** (ROADMAP.md, M46), and how each is met:
- **Rearrange, the joins' hold, the scrap, the chart's words:** `tests/rearrange.test.js` (6). The picks, the scrap left and save v42: `tests/strip.test.js` (5). The end panel's words and picks: `tests/tripText.test.js`, `tests/approachText.test.js`.
- **Measured** (100 voyages, the test player taking the dearest, against main's):

  | | Main | M46 |
  | --- | --- | --- |
  | Won boardings aboard her | 20 | 19 |
  | Parts stripped | 20 | 19 (18 reactors, 1 Kestrel engine) |
  | Their worth at sell price | 1,010 | 1,920 |
  | Her scrap | 372 | 296 |
  | Fed all the way | 98 | 97 |
  | A trip flown from the colony | 100 | 99 |

  The test player picks the dearest every time, which is a reactor on every boarding ship, so these are the most a strip can be worth. A player choosing for the ship will often take less.
- **The voyage tests stay within main's margins:** they pass. Two moved on purpose (below).
- **Touch, at the three sizes:** `m46/verify.mjs`, 23 of 23 at cover, tab and open (below).
- **Every rule tested;** every earlier milestone's check passes (below).

**Tests:**
- `node --test`: 1210 pass (1199 on main).
- **New:** `tests/rearrange.test.js` (6), `tests/strip.test.js` (5).
- **Changed on purpose:**
  - every test pinning the save version, from 41 to 42, and `tests/citizens.test.js`, which finds v38's migration fifth from the end now;
  - `tests/refit.test.js`: away from a station, the joins now hold a ship whose reactor came off and split it;
  - `tests/builderText.test.js`: a wreck's card line names the scrap;
  - `tests/tripText.test.js`, `tests/approachText.test.js`: the end panel's and the stakes' words;
  - `tests/voyage.test.js`: a boarding's scrap may be below the preset's least, as much as she has left. "Every run flies a trip" on seeds 1 to 30 broke when seed 24 settled a world that ran short of food. As CLAUDE.md says, it is now a rate over 100 seeds within main's margin (99 of 100; main 100). M40's bar of none of 100 hungry in the system is now 2 or fewer (Evan's call). The deserter's seed 73 came in hungry, broke from sector 2. Main misses the bar too past 100 seeds (seed 300 of 300).

**Browser checks:**
- **M46's own:** `m46/verify.mjs`, 23 of 23 at the three sizes:
  - between jumps the panel says Rearrange; its card offers no swap; Delete says why; a drag moves the gun, the parts on hand untouched;
  - a move that splits the joins: the chart says Rearrange fixes it; Undo, the session kept, moves it back;
  - at a station a wreck's card offers Scrap for the Kestrel mount; the first tap asks, the second scraps it into its spot;
  - a won boarding's end panel: the dearest picked, a tap picks the cheapest, Continue strips it;
  - every new button 48 px or more; saved at v42; no console errors.
- **Every earlier milestone's check,** in two chains (`m46/regress-a.sh`, M45's back to M30's; `m46/regress-b.sh`, M29's back to M8's), each the latest adapted copy:
  - **Copies made for M46:** 18 checks pinned save v41 and now read v42 (M45's, M44's, M42's, M41's, M40's, M39's, M38f's, M38e's, M38d fix's, M38c's, M38b's, M35's, M34's, M31's, M30's, M29's, M28's and M27's, each `verify46.mjs`).
  - **M22's check adapted (`m22/verify46.mjs`):** the boarding stakes now read "strip 1 part you pick off her", and the won panel offers the picks ("Strip a part off her: the dearest is picked, tap to pick others.") where it listed what was stripped. It passes 35 of 35 at the three sizes.
  - **All pass,** apart from M32b's first copy, the known exception from M32b's fix (its fix copy passes in its place). The two chains first ran side by side and some checks collided on the server's port or ran out of time (M38e's, M44's, M17's, M18's, M23b's and M25's at some sizes). Rerun one after another, each passed in full.

**Known issues:**
- **The dearest is always a reactor:** every boarding ship carries one, so Continue alone takes a reactor each time. The end panel shows the rest to choose from.
- **The test player never rearranges or scraps a wreck:** it repairs at stations as before, so neither is measured in the voyages.

**What Evan should test on the phone:**
- **Between jumps,** tap the ship's panel (Rearrange): move a part, see Delete refuse. Split the ship and try to jump: the chart says why.
- **At a station with a wreck** and a spare of it on hand: long-press the wreck, Scrap for the spare, twice.
- **Win a boarding aboard her:** pick the part you want on the end panel, then Continue.

**Next milestone's first task:** M47, item 10 of the brainstorm, controls and feel: study and measure, then settle its Done when on my recommendations.

## M45 Doors as tactics (2026-10-23)

**Status:** done, and the ROADMAP.md box is ticked. Every bar of the Done when is met. Saves are at v41.

**How it was picked:** item 6 of the Phase 8 brainstorm, next in my recommended order, on Evan's "Do recommendations". From §9: closing and locking doors (defenders sealing a breach), and fog of war. Measured first on main after M44:
- A door opened by a walk or Open door stayed open. Only the engineer's Weld could shut one.
- The harness: 400 fights, crew wins 49%, boarders 38%, no winner 13%.
- Every enemy always showed on the board.

**What shipped:**
- **Close door** (1 action) on an open door beside a crew member. A walk through still opens it.
- **Lock door** (1 action), closing it if open. No one walks or sees through a locked door. The crew's Open door unlocks it, 1 action.
- **Forcing:** the other side breaks a lock from beside it with a whole turn. The door is broken: open for the rest of the fight, with no Close, Lock or Weld for it, so a lock can't be shut in an enemy's face turn after turn. A welded door can't be locked or forced until the weld gives way.
- **The AI forces what's in its way:** distance maps count a lock as a way through, so the enemy and everyone pressing on (`press.js`) walk up to it. With a whole turn and no shot to take, they force it. They never close or lock a door themselves (`src/sim/locks.js`).
- **On the board:** a locked door is red and wall-high, a second cue besides its color. The fight log tells each door event in words, and each plays the door sound.
- **Fog of war,** a setting (Settings: Fog of war, off by default), save v41. With it on, an enemy no one in the crew can see is hidden on the board and can't be tapped. A tap on its tile shows nothing, and while it walks unseen the status line says only that something moves. One that fires shows for its shot. The rules and the AI are the same either way (`sight.js` sightedBy).
- **A tip** the first time a crew member stands by a door.
- **The harness:** `node tools/sim.js --doors lock` plays a crew that locks the doors beside it; with `--compare`, against the same fights with no locks.

**Done when** (ROADMAP.md, M45), and how each is met:
- **Close, lock, force, broken, the AI forcing, the log:** `tests/locks.test.js` (7). Fog, the setting, save v41 and the board's playback of door events: `tests/fog.test.js` (4). The harness: `tests/harness.test.js` (a locking crew's boarders force their way, and the fights end).
- **No fight stalls at a lock:** `--doors lock --compare` over 400 fights:

  | | No locks | Locking crew |
  | --- | --- | --- |
  | Crew wins | 49% | 31% |
  | Boarders win | 38% | 52% |
  | No winner | 13% | 17% |
  | Rounds | 7 (5–12) | 9 (6–13) |
  | Doors locked / forced a fight | 0 / 0 | 3.9 / 1.1 |

  No winner rises 4 points, inside the 5-point bar. The locking player locks every door it can, even ones that shut it in, so its win rate is no guide to locking well.
- **Fog is display only:** the harness's no-lock run reproduces main's numbers exactly. The fog changes no rule.
- **Touch, at the three sizes:** `m45/verify.mjs`, 19 of 19 at cover, tab and open (below).
- **Every rule tested;** every earlier milestone's check passes (below).

**Tests:**
- `node --test`: 1199 pass (1187 on main).
- **New:** `tests/locks.test.js` (7), `tests/fog.test.js` (4), and one more in `tests/harness.test.js`.
- **Changed on purpose:**
  - every test pinning the save version, from 40 to 41, and `tests/citizens.test.js`, which finds v38's migration fourth from the end now;
  - `tests/accessibility.test.js`, whose v40 migration now ends at the current version;
  - `tests/captain.test.js` and `tests/sim.test.js`, whose settings carry `fog`;
  - `tests/harness.test.js`, whose `--compare` message names `--doors`.

**Browser checks:**
- **M45's own:** `m45/verify.mjs`, 19 of 19 at the three sizes:
  - beside a closed door, Open door and Lock door (48 px or more);
  - Open, then Close, by touch;
  - Lock, then Open door unlocks it;
  - locked, End turn, and the pirate forces it: broken open, no Close or Lock after;
  - fog off, a tap on the hidden pirate says the marine can't see it; fog on, the same tap shows nothing; the door opened, the pirate shows and a tap aims at it;
  - the doors tip; saved at v41; no console errors.
- **Every earlier milestone's check,** in two chains (`m45/regress-a.sh`, M44's back to M30's; `m45/regress-b.sh`, M29's back to M8's), each the latest adapted copy:
  - **Copies made for M45:** 17 checks pinned save v40 and now read v41 (M44's, M42's, M41's, M40's, M39's, M38f's, M38e's, M38d fix's, M38c's, M38b's, M35's, M34's, M31's, M30's, M29's, M28's and M27's, each `verify45.mjs`). M17's and M13's ran as their M44 copies.
  - **M18's check adapted (`m18/verify45.mjs`):** it plays its first fight to the end expecting no tip in the way, and M45's doors tip now shows once when a crew member stands by a door, over the board at 821 × 283. The copy taps Got it when it shows. The old copy failed 2 of 3 runs at that size and passed 3 of 3 against main; the new one passes 43 of 43 at the three sizes, 3 of 3 at 821 × 283.
  - **All pass,** apart from two cases:
    - M32b's first copy, the known exception from M32b's fix (its fix copy passes in its place).
    - M14's check at 905 × 370 failed once on the pay it reads. The jobs it wins differ from run to run, and when enough are won the union's standing adds 10% to the pay. The rerun passed 41 of 41.

**Known issues:**
- **Fog can be read from the move overlay:** the tile a hidden enemy stands on is left out of where the crew can walk.
- **The enemy is not fogged:** it knows where the crew is, as before. Fog is the player's view only.
- **Two doors by one tile:** Close, Lock and Open act on the first (north, east, south, west), as Open door and Weld always have.
- **The AI never locks a door.**

**What Evan should test on the phone:**
- **In a fight, a crew member by a door:** Lock door (it goes red and tall), then End turn. If the enemy is across it, they spend a turn forcing it, and it stays open.
- **Open door on your own lock;** Close door on an open one.
- **Settings, Fog of war On:** in a boarding or a raid, enemies out of sight vanish and come back when seen.
- **The doors tip,** the first time a crew member stands by a door.

**Next milestone's first task:** M46, item 3 of the brainstorm, refits on the move: study and measure, then settle its Done when on my recommendations.

## M44 Builder ergonomics (2026-10-23)

**Status:** done, and the ROADMAP.md box is ticked. Every bar of the Done when is met. No save change: saves stay at v40, and blueprint codes are unchanged.

**How it was picked:** Evan's "Do 1 now" from the Phase 8 brainstorm. M44 measured the builder's everyday chores in taps first (main after M43). My recommendations, taken on Evan's word, are ROADMAP.md's M44 Done when.

**What shipped:**
- **Drag a run:** with any maker's corridor armed, a drag from its ghost lays one on each cell the finger passes, in straight grid steps. Going back over a cell takes it off the run. It shows as ghosts while dragging, with blocked cells crossed and a count on the last. It goes on as one undo step and stops at the first cell that can't take one, or when the corridors on hand run out; the hint says so ("Placed 3 × Corridor. Stopped: …"). A tap on the ghost still places one.
- **Suggest:** with a part armed, a button on the board puts its ghost where it fits best; a tap on the ghost places it. With no spot, the hint says so. It uses `src/sim/fit.js`, the test players' fitter moved there from `tools/run.js`. On a ship still being built, a spot only has to add no layout problem of its own.
- **Swap a maker in place:** a placed part's card (long press) has a button for each other maker's version on hand. A tap swaps it, keeping the spot, the turn and its styling pieces, as one undo step, and the old part goes back on hand. A wrecked part has no swap buttons. The build log keeps a remove and a place.
- **Checklist lines as shortcuts:** at the hangar, a goal line whose part is on hand is a button. A tap opens the builder with that part armed (any maker's on hand) and its ghost at the suggested spot. A line with none on hand stays text.
- **Launch in the builder:** in act 1, the Ship tab has Launch in construction mode too, two taps, and it launches the campaign as the hangar's does. On the run and at the colony, construction mode still has none.

**Done when** (ROADMAP.md, M44), and how each is met:
- **Each rule tested:** `tests/builderErgonomics.test.js` (8 tests):
  - a run as one undo step, with undo and redo;
  - its two stops (a taken cell; none left on hand);
  - only corridors run;
  - Suggest on a half-built ship, and Suggest equal to the fitter on a whole one;
  - an empty frame says there is no spot;
  - a swap and its refusals (another part, none on hand, wrecked);
  - a log with a swap and a run plays back to the same ship.
- **Touch, at the three sizes:** `m44/verify.mjs`, 29 of 29 at cover, tab and open. Gestures, against the counts measured on main:

  | Chore | M44 | Main |
  | --- | --- | --- |
  | Checklist line to the part placed | 2 | 5 or more |
  | Four corridors in a row | 3 | 9 |
  | Another maker's version | 2 | 4, and two undo steps |
  | Launch with the last part fitted | 3 (Ship tab, Launch twice) | Back, then Launch twice |

  Suggest's ghost lands on the fitter's spot and a tap places it there. Every new button is 48 px or more and reachable. The checklist shortcut works offline, with no console errors.
- **No save change:** saves stay at v40, codes unchanged.

**Tests:**
- `node --test`: 1187 pass (1179 on main).
- **New:** `tests/builderErgonomics.test.js` (8).
- **Changed on purpose:** `tests/hubText.test.js`, whose goal lines now carry `add`, the part when one is on hand.

**Browser checks:**
- **M44's own:** `m44/verify.mjs`, 29 of 29 at cover, tab and open (above).
- **Every earlier milestone's browser check:** passes at the three sizes, each the latest adapted copy (`m44/regress-a.sh` and `regress-b.sh`), with M43's walk added (cover 171 of 171, tab 169 of 169, open 171 of 171). The exception is M32b's first copy, whose 2 known failures since M36 its fix copy covers.
- **Adapted for M44:**
  - M17's: construction mode's ready hint now names Launch in the Ship tab, or Hangar.
  - M13's: construction mode in act 1 has Launch (locked until every check passes); it still has no Saves tab.

**Known issues:**
- **Suggest's icon is the wrench Build uses.** Its label tells them apart.
- **A run is corridors only,** as the Done when says. Other one-cell parts aren't laid by a drag.
- **Suggest picks the spot touching most of the ship,** as the test players' fitter does, not the one that best serves the layout's flow.

**What Evan should test on the phone:**
- **At the hangar on a new game:** tap "Berths 0 of 3 crew". The builder opens with the quarters' ghost on the hull; tap it to place it.
- **A corridor run:** arm a corridor, tap a cell beside the ship, then drag from the ghost along a row. Check that one Undo takes the run back.
- **Suggest:** arm any part and tap Suggest.
- **A maker swap:** with a Bastion corridor on hand (from the shop), long-press a corridor and tap "Swap for Bastion corridor".
- **With every check passing in act 1:** in the builder, open the Ship tab and tap Launch twice.

**Next milestone's first task:** Evan's next pick from the Phase 8 brainstorm. My recommended order after this one is 6, then 3, then 10.

## Phase 8 started (2026-10-23)

Evan's call: "Do 1 now", picking the builder's ergonomics from the Phase 8 brainstorm. Phase 8 starts with it (M44). Gate 7's play on the phone and its stranger test are still to come. Whatever they turn up becomes Phase 8 milestones, and Gate 8 still guards the release.

## A phase before the release (2026-10-20)

Evan's call: before the launch, keep building and fine-tuning. ROADMAP.md §7 has a new **Phase 8: Build and tune** between Phase 7 (content and balance) and the release, which moves to Phase 9; Later is Phase 10, and CLAUDE.md's Capacitor line says so.
- **Gate 7** now leads into Phase 8: v1.0's content plays on the phone, balanced from each start, with a tutorial a stranger can follow, and Evan wants to keep going. It is still Evan's call, and not yet passed.
- **Gate 8 (draft)** leads to the release: the game plays on the phone as Evan wants it at launch, and he wants to release.
- **Phase 8's milestones** are open: what Gate 7's play and its stranger turn up, picks from §9, and new content or systems Evan asks for. Each is added as he picks it, its Done when settled as it starts.
- §6's v1.0 now spans Phases 7 to 9.

**Next:** Gate 7 (Evan's), then Phase 8's first milestone, as Evan picks it.

## M43 Tutorial polish (2026-10-19)

**Status:** done, and the ROADMAP.md box is ticked. Every bar of the Done when is met but the stranger with the phone, which is Evan's, at Gate 7. No save change: saves stay at v40.

**How it was picked:** M43 measured first (main after M42). M18's 11 tips all come before the first fight's end. Past them, the guidance is each screen's hint line, which rings nothing and says nothing the first time a thing comes. One tip had gone stale since M42 (a blocked ghost "red"). My recommendations, taken on Evan's standing word to go with them (2026-10-19), are ROADMAP.md's M43 Done when.

**What shipped:**
- **21 new tips** (`data/tips.json`, `src/ui/tipSteps.js`), ringed and seen once as M18's are:
  - act 1: a raid, heat, a payment, the shop, Launch;
  - the run: the chart (with the long jump), a jump, an event, a station, Scan, Regroup or Hide, the swap;
  - the approach: its orders, Board her;
  - Survey, Settle here;
  - the colony: Defend, needs, Build, Next day, a trip.
- **No tip over a card or a round:** none shows on the chart under an event or the crew card, or on the approach while a round plays (`data-playing`) or over its end. Board her's tip waits until boarding is the crew's choice.
- **A tip brings its control into sight** (`src/ui/tips.js`).
- **The builder's tip** says a blocked ghost is crossed.
- **Guidance the walk found missing:**
  - the colony's hint says what's next (`colonyText` `next`) where it showed the act's stub words;
  - Build lists first at the colony;
  - a day's report ends with what's next;
  - the approach's later rounds say to tap an order;
  - the station's supplies hint names Buy and Fill up.

**Done when** (ROADMAP.md, M43), and how each is met:
- **Tips past the first fight:** `tests/tutorial.test.js` (6 tests: act 1's, the run's, the approach's, the colony's in order, the builder's words, the colony's next); by touch in the walk.
- **A tip never covers its control:** the walk checks every tip it meets at the three sizes (card clear of the ring, on screen, its control under the ring's middle).
- **A stranger, as far as a check can stand in:** `m43/walk.mjs` (below).
- **No save change:** `tipsSeen` takes the new ids; a save under way meets each new tip once.
- **Every rule tested;** every earlier milestone's check: below.

**The walk** (`m43/walk.mjs`): New game to the colony's first day by touch.
- **How it goes:** act 1 by touch to the first fight's end. Then a save the sim makes, ready to launch, stands in for act 1's remaining jobs and building, with the tips seen so far kept. From there it is touch again: Launch, two sectors' events, stations and an approach, the system, Survey, Settle here, the landing, and the colony's tips and a day. Fights are won and supplies filled from the dev menu.
- **Results:** cover 171 of 171 (146 stops), tab 169 of 169 (145 stops), open 171 of 171 (146 stops), with no console errors.
- **Tips met on the way (22):** the goal, Build, the parts, Take the job, the crew, heat, Pay, Launch, the chart, a jump, an event, Scan, a station, Regroup, the approach's orders, the swap, Survey, Settle here, the needs, Build, Next day and a trip.
- **Covered by the tests only:** the raid's, the shop's, Board her's and the colony's Defend, which the walk's run didn't meet.

**Tests:**
- `node --test`: 1179 pass (1173 on main).
- **New:** `tests/tutorial.test.js` (6).
- **Changed on purpose:** `tests/approachText.test.js`, whose later rounds now carry a hint ("Next round: tap an order to see its odds.").

**Browser checks:**
- **The walk:** above.
- **Every earlier milestone's browser check:** passes at the three sizes, each the latest adapted copy (`m43/regress-a.sh`, `regress-b.sh`, M42's own check added). The exception is M32b's first copy, whose 2 known failures since M36 its fix copy covers.
- **Adapted for M43:**
  - M26's: the colony's hint says what's next, not the act's words.
  - M27's, M28's, M38d fix's and M38e's: the colony lists Build first, then the places and the voyage out, so rows are found by their heading.
  - M27's and M29's: a day's report ends "Tap Next day for the next.", dropped before comparing.
  - M18's: it counts its own 11 tips, and back at the hangar allows one of M43's (heat, the shop).

**Known issues:**
- **Not a stranger:** the walk proves every stop has guidance, not that a stranger follows it. That is Evan's test at Gate 7.
- **A save under way meets the new tips once,** where their things next come, even a player who knows them. Settings' Tips Off puts them all away.
- **The act's words for what's ahead** no longer show at the colony: its hint says what's next instead. `data/campaign.json` keeps them.

**What Evan should test on the phone:**
- **New game with tips on, to the colony:** each new thing gets a ringed card the first time (heat, the shop, Launch, the chart, a jump, an event, a station, an approach, Survey, Settle here, the colony's needs, Build, Next day, a trip), and none covers what it points at.
- **The colony:** Build is at the top of the side panel; the hint says which needs are unmet; after Next day it says to tap it again.
- **An approach past round 1:** the hint says to tap an order.
- **Hand it to someone new** (Gate 7).

**Next milestone's first task:** none in Phase 7. Gate 7 is Evan's call: v1.0's content on the phone, balanced from each start, with a tutorial a stranger can follow.

## M42 Accessibility (2026-10-19)

**Status:** done, and the ROADMAP.md box is ticked. Every bar of the Done when is met. Saves are at v40.

**How it was picked:** M42 measured first (main after M41). Color was the only cue in 11 places, and simulated colorblindness put `good`/`bad` 7.8 apart for deuteranopia. Every text size was fixed px, the smallest 8.6 px, and the Motion setting did nothing in a fight, where an enemy turn played for 5.7 s at the median. My recommendations, taken on Evan's standing word to go with them (2026-10-19), are ROADMAP.md's M42 Done when.

**What shipped:**
- **A second cue for each of the 11 color-only places:**
  - a dash tile is hatched (`src/render/units.js` `hatch`);
  - a way in held is crossed;
  - a hurt to the crew reads "HURT −2" (`src/render/playback.js`);
  - a blocked ghost is crossed, in the builder (`shipScene.js`) and the colony (`colonyScene.js`);
  - a wounded HP bar is striped;
  - an unmet need starts with "!";
  - the hunters' ring is doubled;
  - a station's side pip carries the side's letter;
  - the enemy's shots on the approach are dashed (`approachView.js`);
  - each crew member's initial sits beside their pips on the board (`fightLabels.js`).
- **Colors, in Settings:** Standard or Colorblind-safe. `src/render/palette.js` has the safe set and `MUST_DIFFER`, the 21 pairs a player tells apart by color. `usePalette` swaps the set in place, so the canvas styles read it live; `src/ui/look.js` writes the CSS tokens.
- **Text size, in Settings:** 100%, 115% or 130%. Every CSS size is multiplied by `--ts`, and the fight's canvas labels by `textScale()` (`src/render/textScale.js`). The builder's tiles are floored at 10 px. At 115% and 130%, names and lines that were cut short wrap instead: the hangar, the job board, the shop, the colony's home line, and the builder's part and look tiles, whose rows grow to hold them.
- **Reduced motion in a fight:** with Motion at Reduce (or the phone asking for less), a playback shows its end at once (`makeTimeline(..., { still: true })`). Each action's words still rise, stacked where they share a tile, and the sounds play. The Settings line says so.
- **Saves v40:** `colors` and `textSize` in the settings; the migration gives Standard and 100%.

**Done when** (ROADMAP.md, M42), and how each is met:
- **Never color alone:** `tests/accessibility.test.js` (the board's cues), `tests/units.test.js` (hatching), `tests/missionText.test.js` (zones, "HURT −4"), `tests/standingText.test.js` (the pip's letter); by touch.
- **Colors, at least 20 apart to every eye; AA on the panels:** `tests/palette.test.js`, from the palette itself (below).
- **Text size:** by touch at 130% (below). At 100% nothing renders under 10 px.
- **Reduced motion in a fight:** `tests/accessibility.test.js` (a still enemy turn takes 0 ms); by touch, the board free 6 ms after End turn against about 5.6 s at full motion.
- **Saves v40,** the migration tested (`tests/accessibility.test.js`).
- **Touch, at the three sizes:** below.

**The palette** (CIEDE2000 on Machado 2009's simulations; the least of the 21 pairs):

| | Normal | Protanopia | Deuteranopia | Tritanopia | Pairs under 20 | Least text contrast |
| --- | --- | --- | --- | --- | --- | --- |
| Standard | 15.5 | 9.5 | 6.5 | 9.8 | 12 of 21 | 6.4 |
| Colorblind-safe | 25.1 | 22.5 | 20.8 | 20.8 | 0 of 21 | 4.9 |

**Tests:**
- `node --test`: 1173 pass (1165 on main).
- **New:** `tests/palette.test.js` (3), `tests/accessibility.test.js` (5), with `tests/colorVision.js`, the color kit both use.
- **Changed on purpose:** the save version pins (39 → 40); the new settings' defaults in `tests/sim.test.js` and `tests/captain.test.js`; the zones' crosses, "HURT −4", the dash's hatching and the pip's letter in the tests above. No golden file changed.

**Browser checks:**
- **`m42/verify.mjs`:** 17 of 17 at each of the three sizes. It covers Settings' two rows (Colorblind-safe saved and swapped in the CSS, 130% saved and the title's words 1.3 times as big); a fight's enemy turn under reduced motion (board free in under 1 s, Skip never needed) and full (over 2 s); at 130% the fight, the chart, the builder and the colony with every button 48 px or more and reachable; the chart's side letters, no part's name clipped, an unmet need marked; a quit and reopen at v40; offline; no console errors.
- **Every earlier milestone's browser check:** passes at the three sizes unless named, each the latest adapted copy (`m42/regress-a.sh`, `regress-b.sh`), but M32b's first copy, whose 2 known failures since M36 its fix copy covers.
  - **Adapted for M42:** the checks that pin the save version (now 40), and M38c's, whose dock-floor color sample now leaves out amber pixels. The new hatching on the dash tiles had pulled the board's middle from rgb(65, 68, 69) to rgb(67, 69, 69), under its "leaning blue" bar. With the hatching left out it reads rgb(60, 64, 68).
  - **Run again on their own, and passed:** M14's at the cover size, cut off when the chain reached its two-hour limit.
- **Text sizes measured** (`m42/measure2.mjs`, 10 screens at each of the three sizes): at 100% the smallest text is 10 px; at 130%, 11 px. Nothing is clipped at either, and no line ellipsises at 130%.

**Known issues:**
- **Standard stays as it was:** its 12 pairs under 20 for some eye remain, with the second cues to tell them apart. Colorblind-safe is the fix, off unless picked.
- **Colorblind-safe's text is closer to AA:** its least contrast on a panel is 4.9 (Standard's 6.4), over 4.5 but with less to spare.
- **At 130% on the short screens** the panels scroll more, and the colony's crew list runs taller than its panel.
- **Reduced motion stills the crew's own actions too:** a move or shot shows its end at once, with no walk to watch.

**What Evan should test on the phone:**
- **Settings, Colors:** Colorblind-safe turns the greens blue and the reds magenta across the fight, the builder, the chart and the colony; Standard brings them back.
- **Settings, Text size:** 130% on the cover screen; the hangar, job board, shop, builder, chart and colony still read, and every button reaches.
- **A fight with Motion at Reduce:** End turn shows the enemy's turn done at once, with its words over the units.
- **The cues:** a dash tile hatched, "HURT" on the crew's wounds, a crossed ghost where a part won't fit, initials beside the crew's pips.

**Next milestone's first task:** M43 Tutorial polish: study the tips past the first fight (the run, the colony; §9), measure where a new player is left without one, settle its Done when.

## M41 Difficulty settings (2026-10-19)

**Status:** done, and the ROADMAP.md box is ticked. Every bar of the Done when is met. Saves are at v39.

**How it was picked:** M41 measured first (main after M40: 100 whole games from each start at each setting, act 1 to the days after the voyage out). Every setting reached the colony in all 100, and the fights parted as they should. Two gaps: an enemy ship's guns, and a raid fought out where the ship isn't, took no difficulty. Permanent death, tried with every bleed-out a death, killed 3 to 9 a game, because the test crews' AI never stabilized anyone. With stabilizing, deaths fell to 0 or 1 a game, and the failures were act 1 crews stuck a member short. My recommendations, taken on Evan's standing word to go with them (2026-10-19), are ROADMAP.md's M41 Done when.

**What shipped:**
- **The difficulty is the game's** (`src/sim/difficulty.js`): it moves from the settings into the campaign (`campaign.difficulty`, save v39). It is picked at New game, Normal unless changed, and changed in Settings from the next fight; Settings' row shows only with a game under way.
- **It reaches every enemy:** every fight as before (act 1's jobs and raids, boardings, station jobs, the colony's raids and trips), a raid fought out where the ship isn't (`fightAway`), and in an approach an enemy ship's guns: 10 worse on Easy, 5 better on Hard (`easyEnemyGunnery`, `hardEnemyGunnery` in `data/balance.json`), in the odds shown and the odds rolled. The save keeps the ship, not the difficulty's aim.
- **Permanent death,** picked at New game and kept for the game (`campaign.permadeath`):
  - someone who bleeds out dies (`src/sim/campaign.js` `buried`): they leave the crew, their weapon goes back to the spares, a companion's loyalty quest goes cold, and they are named among the fallen (`campaign.fallen`, the newest 99), counted in the flags (`crewLost`, `captainsLost`);
  - a captain's death passes command to whoever has stood in the most fights;
  - with no one left aboard the game is over (`gameOver`, derived, not stored): the end screen names the fallen and the record, and Continue comes back to it until New game;
  - in act 1 the hangar signs on a green hand, free, in the first job the crew is short of (`src/sim/recruits.js` `hangarRecruit`). A fee left a crew of one with no credits and no way to earn any; Hard with permanent death stalled there;
  - a raid fought out where the ship isn't kills no one;
  - the crew's AI gets a downed ally up first (`src/sim/rescueAi.js`), so the test players play it as a careful player would. A fallen crew member's id is never used again.
- **New game's last screen,** "Your game" (`src/ui/campaign/startGame.js`): Difficulty and Permanent death side by side, each with what it means, Back to the captain with nothing lost, then Start. The captain's button says Next.
- **Deaths in the UI:** the fight's end panel says who died, and that the game is over if no one is left; the crew card says who was lost; the hangar's hint and the crew card offer the recruit ("Looking for a berth", Sign on, free).
- **The tools:** `node tools/voyage.js --difficulty <easy|normal|hard> --permadeath on`, with the share of fights won and a line for the dead, the captains lost and the games over; `tools/run.js` the same for act 1.

**Done when** (ROADMAP.md, M41), and how each is met:
- **The difficulty is the game's:** `tests/difficulty.test.js`, `tests/captain.test.js`; by touch.
- **It reaches every enemy:** `tests/difficulty.test.js` (raids faced and fought out, an approach's odds), `tests/captain.test.js` (the other fights).
- **Permanent death:** `tests/permadeath.test.js` (6 tests: the fight's option, the dead and command, the game's end, the hangar's recruit, the rescue AI, a raid fought out); by touch.
- **Each setting through all three acts:** met (below).
- **At Normal without permanent death, the voyage tests' rates stay main's and the golden files don't move:** `tests/voyage.test.js` passes against M40's `MAIN`; no golden file changed.
- **Saves v39,** the migration tested (`tests/difficulty.test.js`): a save's settings difficulty becomes its campaign's, death not permanent, no one fallen.
- **Touch, at the three sizes:** below.

**Each setting through all three acts** (`node tools/voyage.js --runs 100 --background <start> --difficulty <setting> [--permadeath on]`, seeds 1 to 100, act 1 to the days after the voyage out):

| | Easy | Normal | Hard |
| --- | --- | --- | --- |
| Reached the colony, miner / deserter / smuggler | 100 / 100 / 100 | 100 / 100 / 100 | 100 / 100 / 100 |
| Fights won, miner | 89% | 78% | 63% |
| Fights won, deserter | 84% | 70% | 61% |
| Fights won, smuggler | 89% | 79% | 69% |

With permanent death:

| | Easy | Normal | Hard |
| --- | --- | --- | --- |
| Reached the colony, miner / deserter / smuggler | 100 / 100 / 100 | 100 / 100 / 99 | 100 / 100 / 96 |
| Games over | 0 | 0 | 1 (smuggler, act 3) |
| Died a game, the median (most), miner | 0 (2) | 0 (3) | 1 (4) |
| … deserter | 0 (5) | 1 (6) | 0 (9) |
| … smuggler | 0 (3) | 0 (4) | 1 (6) |
| Games with a captain lost, miner / deserter / smuggler | 6 / 13 / 14 | 10 / 16 / 25 | 15 / 18 / 40 |

The smuggler's games short of the colony with permanent death are its act 1 test player not reaching launch in 30 jobs (seed 90 at Normal; 90, 93 and 96 at Hard), not games over.

**Balance numbers** (`data/balance.json`): two new, `easyEnemyGunnery` −10 and `hardEnemyGunnery` 5. `node tools/sim.js` (1,000 fights at Normal, AI against AI) doesn't read them, and its summary is as main's: 49% crew wins (45–52), 24.0 shots a fight, the shown odds as hit (9/9, 28/29, 45/45, 68/67, 83/83).

**Tests:**
- `node --test`: 1165 pass (1154 on main).
- **New:** `tests/difficulty.test.js` (5), `tests/permadeath.test.js` (6).
- **Changed on purpose:** the save version pins (38 → 39) across the tests; the campaign's new fields (`difficulty`, `permadeath`, `fallen`) in `tests/campaign.test.js`, `tests/sim.test.js` and the migration tests; the difficulty set on the campaign in `tests/captain.test.js`; the captain's hint says "Tap Next." (`tests/captainText.test.js`).

**Browser checks:**
- **`m41/verify.mjs`:** 25 of 25 at each of the three sizes. It covers New game to "Your game" (Normal and Off as it comes, Hard and On picked, Back keeps them, Start begins the game with both); Settings' Difficulty row (Easy saved in the campaign, none without a game); a death at a fight's end, the crew card's "Lost:", the hangar's free recruit in two taps; the game's end (the end panel, the fallen, the record, Continue back to it, New game to the backgrounds); a quit and reopen at v39; offline; every button 48 px or more; no console errors.
- **Every earlier milestone's browser check:** passes at the three sizes unless named, each the latest adapted copy (`m41/regress-a.sh`, `regress-b.sh`), but M32b's first copy, whose 2 known failures since M36 its fix copy covers.
  - **Adapted for M41:** the checks that pin the save version (now 39), and those that make a captain by touch, which now tap Start on "Your game" after the captain's Next (`m18/old.mjs` makeCaptain for the rest); M18's settings check reads the difficulty from the campaign.
  - **Run again on their own, and passed:** M37's at the tab size, M34's, M33b's, M28's and M14's at the cover size and M23d's at the tab size, which timed out or found their server's port taken while both halves ran side by side.

**Known issues:**
- **The smuggler's act 1 can stall with permanent death** for the test player (4 of 300 games across the settings): a crew rebuilt from green hands takes longer than 30 jobs to launch. A player can go on; the test player gives up.
- **Hard with permanent death costs the smuggler's captain often** (40 of 100 games): command passes on as it should, but it may feel harsh. Evan's call whether that is Hard.
- **The difficulty applies from the next fight:** a fight under way keeps the setting it began with.

**What Evan should test on the phone:**
- **New game:** after the captain, "Your game" offers Difficulty and Permanent death; Back keeps what you picked; Start begins the game.
- **Settings during a game:** Difficulty shows and changes the game from the next fight.
- **Permanent death:** let someone bleed out; the end panel says they died, the crew card names them, and in act 1 the hangar offers a green hand for nothing.
- **The game's end:** lose everyone; the end screen names the fallen and the record, and New game starts over.
- **Quit and reopen:** a save from before opens at Normal, death not permanent.

**Next milestone's first task:** M42 Accessibility: study the palette for colorblind players, text size and motion in a fight (§9); measure what today's UI does at each; settle its Done when.

## M40 Balance runs (2026-10-19)

**Status:** done but for one bullet, and the ROADMAP.md box is ticked. Every bar of the Done when is met except one talent: **Bosun's weld still lifts its squad 0 points**, where the bar is 5 to 15. No weld I tried reached 5, so it is Evan's call (below, and ROADMAP.md §9). Saves stay at v38.

**How it was picked:** M40 measured first (main after M39): 100 voyages from each start, act 1's 50 runs a start, every act 1 board job over 200 seeds, 1,000 fights a talent, 25 boardings a row. Evan's picks (2026-10-19):
- each start meets the hunters in at most 25 voyages of 100, fed all the way in 80 or more, hungry in the system in none;
- past the charts only the task force follows;
- a swap costs more each time, hydroponics grows 1 a jump, and the jump into the system warns when the holds are short;
- every act 1 job won 35% to 90%, each talent worth 5 to 15 points, every boarding won 20% to 80%.

**What shipped:**
- **The rules:**
  - **past the charts only the task force follows** (`src/sim/hunt.js`): in an uncharted system (act 2's, and those a voyage out crosses), under heat 75 the hunters have lost the trail, and the jump's plan, a survey's and a regroup's say so;
  - **a swap costs more each time** (`src/sim/transponder.js` swapPriceOf): 40 credits and 20 more (`swapRise`) for each swap made; every price shown is the next swap's own;
  - **hydroponics grows 1 supply a jump** (was 2); at the colony still 2 food a day;
  - **the jump into the system warns** (`src/sim/travel.js` leavePlan): when the holds can't cover a survey's day and a jump on, its plan, the hint and the Here panel say by how much.
- **The fights:**
  - **four act 1 jobs** came in by their enemies (`data/encounters.json`): the picket line's strikebreakers are two guards and a breacher, the dock war's other gang three dockers, the pawn tickets' drinkers a scavver, a jumper and a heavy, Impounded's bonded store three MPs;
  - **talents** (`data/companions.json`): Steward's kit is armor 1 and 8 aim (was armor 2), Surveyor's eye Mark +60 (was +30), Family medicine's Patch reaches an ally in sight 3 tiles off. For these an order kind may have numbers besides its own (`src/sim/orders.js` `extras`): Patch a `reach` (2 to 6), Kit out an `aim` (1 to 50), validated, and words for each on the crew card, the fight's hints and the log;
  - **the crew's AI patches** an ally who has lost 5 hit points (`PATCH_LOST`) where a talent's patch is bigger than that; it waited for 8;
  - **boardings:** Con-Reg's gunship sends a crew of its own (two agents, a heavy and a breacher; it sent the task force), and the Halloran yacht's party is a collector fewer;
  - **a fight past round 40 with no step nearer takes its best shot** (`src/sim/fightOut.js`): a deserter's boarding went to the round limit, a pilot and a brute stepping in and out of each other's sight.
- **The test players** (`tools/`):
  - the voyage's keeps **the food to the system** in hand (`voyagePlan.js` foodReserve): in act 2's charted sectors, credits enough for what the jumps left eat (7 a sector, half a sector into the system, 4 jumps' buffer) and the system's survey and jump on, less what the holds carry. Swaps, yard parts, racks, recruits, patching and repairs come out of what is above it, and credits below it weigh as the supplies they buy;
  - it swaps only with that and half a holdful left, hides only while fed, and takes no station job with a squad short of hands;
  - act 1's takes **a job more** once ready while its credits fall short of act 2's food and a first swap (`run.js` launchFood: 123 for a crew of three). It took up to three at first, but then the smuggler's act 1 ran 12 minutes past the miner's, over `tests/run.test.js`'s 10; with one the voyages still meet the bars (fed all the way in 98, 93 and 97 of 100, against 99, 96 and 98 with three);
  - it gives the colony **no part whose going leaves a hatch no one can walk to from the bridge** (`voyagePlan.js` hatchesCutOff): a reactor given on smuggler seed 22 joined the airlock's side to the bridge's by weapon mounts alone, and the boarding there never ended.

**Done when** (ROADMAP.md, M40), and how each is met:
- **The voyage from each start:** met, below; `tests/voyage.test.js` holds the three bars (`BARS`), and `MAIN` is M40's rates.
- **Past the charts, only the task force follows:** `tests/system.test.js`, `tests/sectorText.test.js`, `tests/colonyVoyage.test.js`; by touch.
- **A swap costs more each time:** `tests/regroup.test.js`, `tests/huntText.test.js`, and each voyage's swaps in `tests/voyage.test.js`; by touch.
- **Hydroponics 1 a jump:** `tests/partRules.test.js`, `tests/builderText.test.js`.
- **The jump into the system warns:** `tests/sectorText.test.js`; by touch. The test player comes in with that much where its credits allow (`tests/foodReserve.test.js`): hungry in the system in none of 300.
- **Every act 1 board job 35% to 90%:** met, 44% to 90% (below).
- **Each talent 5 to 15 points:** three met (12, 9, 7); **Bosun's weld 0, not met.**
- **Every boarding 20% to 80%:** met, 21% to 64% (below).
- **Act 1 within 10 minutes of main's:** met (below); raids measured (below).
- **Saves stay at v38:** nothing new is saved; a quit and reopen by touch.
- **Every rule tested:** `tests/orders.test.js` (2 new), `tests/orderAi.test.js` (1), `tests/fightOut.test.js` (1), `tests/foodReserve.test.js` (4), `tests/hatches.test.js` (2), `tests/data.test.js` (5 cases), and the rules' tests above.
- **Touch, at the three sizes:** below.

**The voyage** (100 voyages from each start, seeds 1 to 100, the voyage tests' own sets; main's in brackets):

| | Miner | Deserter | Smuggler |
| --- | --- | --- | --- |
| Met the hunters | 11 (35) | 21 (26) | 6 (13) |
| … in the sectors | 11 (21) | 18 (15) | 6 (5) |
| … past the charts | 2 (20) | 4 (16) | 0 (9) |
| Fed all the way | 98 (80) | 93 (85) | 97 (94) |
| Hungry in the system | 0 (8) | 0 (7) | 0 (2) |
| Surveyed two worlds or more | 96 (76) | 87 (77) | 94 (93) |
| Lost a raid at the colony | 13 (13) | 11 (6) | 4 (5) |
| Heat at launch, the median | 36 (31) | 43 (39) | 40 (38) |

Past the charts only the task force comes now, from heat 75. The other sets the voyage tests fly, all as M40's rates now (`MAIN`; main's in brackets): fed with a cargo hold 97 (78), with a med bay 96 (75), with surgery 95 (76), with bunks 94 (73), with the large hold 99 (94), the careful player without refits 94 (76); recruits signed on with a cargo hold in 72 runs (50); ignoring heat, the hunters in all 100 (100).

**Act 1** (`node tools/run.js --runs 50 --background <start>`, the median slow-pace minutes): the miner 42 (main 39), the deserter 40 (39), the smuggler 50 (49), each within `tests/run.test.js`'s 10 of the miner's and of the M33 fix's. The job for the food: 24 of the miner's 50 runs took it, 13 of the deserter's, 14 of the smuggler's.

**Jobs** (every act 1 board job, 200 seeds, its start's fresh crew): all 41 won 44% to 90%. The four brought in: the picket line 57% (was 6%), the dock war 44% (13%), pawn tickets 64% (32%), Impounded 88% (97%). Lowest after the dock war: Back rent and Dock strike, 45%; highest: Left luggage 90%, Impounded and Repossession 88%.

**Talents** (`node tools/sim.js --talent <companion> --compare`, 1,000 fights against the same squad at rank 2):

| Talent | Wins | Points |
| --- | --- | --- |
| Steward's kit (Teo Brandt) | 51% → 63% | +12 (was +27) |
| Surveyor's eye (Osei) | 42% → 51% | +9 (was +2) |
| Family medicine (Dez Halloran) | 50% → 57% | +7 (was +1) |
| Bosun's weld (Varga) | 50% → 50% | 0 (was 0) |

**Bosun's weld:** the AI welds 0.2 times a fight, and in 1,000-fight trials no weld lifted the wins more than 4 points: 20 rounds or 6 uses, none; a weld that also patches the allies beside it 4 to 10 hit points, 2 to 3; that and getting a fallen ally beside it up, 3 to 4; welding as soon as an enemy is in sight cost 9 to 13. Candidates, Evan's call: accept it as it is, the weld that patches and gets the fallen up (+4), or an engineer's talent of another kind.

**Boardings** (`node tools/sim.js --boardings --fights 1600`, 100 a row, the crew's wins):

| Preset | At home | Boarding her |
| --- | --- | --- |
| Pirate cutter | 62% | 58% |
| Patrol corvette | 51% | 44% |
| Con-Reg repo tug | 52% | 53% |
| Con-Reg gunship | 21% (was 8%) | 24% |
| Provost cutter | 43% | 45% |
| Fleet frigate | 28% | 30% |
| Halloran runner | 64% | 64% |
| Halloran yacht | 38% (was 16%) | 37% (was 12%) |

**Raids** (`node tools/raids.js`, 150 a row): as on main. At the hangar the miner's crew wins 53%, the deserter's 63%, the smuggler's 46%; at the colony 41%, 42% and 41%.

**Balance numbers** (`data/balance.json`): one new, `swapRise` 20. `node tools/sim.js` (1,000 fights, the example ship, AI against AI) doesn't read it, so its summary is as main's:

```
1,000 fights on example ship, pirate cutter, patrol corvette, derelict hauler, con-reg repo tug, con-reg gunship, provost cutter, fleet frigate, halloran runner, halloran yacht. The squad (marine, engineer, medic), played by the AI with every job order, against the boarding party (pirate, gunner, brute, pirate), played by the AI. 30 rounds at most, seed "balance".

Ship              Fights    Crew wins  Boarders win  No winner    Rounds  Crew orders
Example ship         100  69% (59–77)           29%         2%  7 (5–10)           31
Pirate cutter        100  53% (43–62)           28%        19%  8 (6–12)           32
Patrol corvette      100  43% (34–53)           44%        13%  8 (5–13)           30
Derelict hauler      100  55% (45–64)           44%         1%  7 (5–14)           29
Con-Reg repo tug     100  53% (43–62)           37%        10%  7 (5–12)           29
Con-Reg gunship      100  32% (24–42)           35%        33%  8 (5–13)           31
Provost cutter       100  51% (41–61)           44%         5%  6 (5–12)           28
Fleet frigate        100  38% (29–48)           29%        33%  7 (5–13)           32
Halloran runner      100  51% (41–61)           43%         6%  7 (5–10)           27
Halloran yacht       100  40% (31–50)           38%        22%  8 (5–11)           29
All                1,000  49% (45–52)           37%        14%  7 (5–12)           30

Rounds and crew orders count the fights with a winner: the median (10th to 90th percentile). Win rates have a 95% interval.

Shots: 23,985, 24.0 a fight. Hit: crew 57%, boarders 39%.
Shown odds  Shots  Shown  Hit
0–19%       2,211     9%   9%
20–39%      7,306    28%  29%
40–59%      5,049    45%  45%
60–79%      6,868    68%  67%
80–100%     2,551    83%  83%
On overwatch: 8% of shots, 25% hit. Crits: 34% of hits. Damage a hit: crew 4.5, boarders 4.4.
A fight: 1.9 crew go down, 0.8 bleed out, 2.6 boarders die.
Job orders a fight: patch 0.8, suppress 0.4, weld 0.2.

1,000 fights in 58.4 s (58 ms a fight).
```

**Tests:**
- `node --test`: 1154 pass (1139 on main); about 15 minutes here, with browser checks running beside it.
- **New:** `tests/foodReserve.test.js` (4), `tests/hatches.test.js` (2); in `tests/orders.test.js` Patch with a reach and Kit out with aim; in `tests/orderAi.test.js` PATCH_LOST; in `tests/fightOut.test.js` the stalled duel (`tests/fixtures/stalled-duel.json`); in `tests/voyage.test.js` M40's bars and each run's swaps rising in price; in `tests/data.test.js` the extras' validation; the rules' tests in M40's first commits.
- **Changed on purpose:**
  - `MAIN` in `tests/voyage.test.js` is M40's rates, as its Done when asks; the colony's gifts leave aboard what would cut a hatch off;
  - a raid calling the ship home on a voyage out is checked on seed 130: it came on 1 or 2 of the miner's 100 voyages out, and since M40 on none of seeds 1 to 100 (3 of seeds 101 to 220);
  - the same seed's voyage is flown again with the options it was flown with: station jobs, now taken on seed 2, made the steps differ;
  - the jump plan says "1 grows aboard" (`tests/sectorText.test.js`);
  - the validator's counts: 28 encounters;
  - Surveyor's eye reads +60 to hit (`tests/companionText.test.js`).

**Browser checks:**
- **`m40/verify.mjs`:** 22 of 22 at each of the three sizes. It covers:
  - a swap's price at a station with two made before (Transponder · 80, the first tap asks, the second pays);
  - the system's warning at act 2's last jump point with the holds short (the hint, the Here panel, Jump on's first tap);
  - "lost the trail" past the charts at heat 60 (a jump's plan, Survey's and Regroup's first taps);
  - the talents' new numbers on the crew card (Dez's 3 tiles, Teo's 8 aim);
  - a quit and reopen at v38, offline, every button 48 px or more, no console errors.
- **Every earlier milestone's browser check** passes at the three sizes unless named, each the latest adapted copy (`m40/regress-a.sh`, `regress-b.sh`), but M32b's first copy, whose 2 known failures since M36 its fix copy covers.
  - **Adapted for M40:** M39's (hydroponics grows 1 a jump) and M33c's (Steward's kit is +1 armor and +8 aim).
  - **Run again on their own, and passed:** M29's at the open size, M37's at the tab size, M23's at the cover size and M17's at the open size, which timed out while the voyage tests ran beside them.

**Known issues:**
- **Bosun's weld lifts its squad 0 points** (above). Evan's call.
- **A ship whose airlock can't be walked to from the bridge** can still be built, or left after giving parts to the colony, by a player: a boarding there never ends. The test player avoids it; §9 has the candidates.
- **Heat at launch is up** 2 to 5 at the median: act 1's test player takes a job more for the voyage's food, and a job adds heat.
- **The deserter's colonies are short of air** in 16 of 100 (main 15): parts fitted on the run that hang off the life support (§9).

**What Evan should test on the phone:**
- **A swap's price:** swap at a station, then at the next sector's: the button says 40, then 60; the first tap says the price.
- **The system's warning:** reach act 2's last jump point with the holds low: the hint warns, and Jump on's first tap says how far short.
- **Past the charts:** with heat between 50 and 74, a jump's plan, Survey and Regroup say the hunters have lost the trail; from 75 the task force's chance shows.
- **A loyal Dez and Teo:** Dez's Patch can be given to an ally in sight up to 3 tiles off; Teo's Kit out adds 8 aim (the log says so, and the ally's odds show it).
- **The four act 1 jobs:** the picket line, the dock war, pawn tickets and Impounded feel winnable, and no easy walk.
- **Quit and reopen:** a save from before opens and plays on.

**Next milestone's first task:** M41 Difficulty settings: study what Easy, Normal and Hard change today (since M18) through all three acts, and permanent death as a harder setting (§9); measure each from each start; ask Evan; settle its Done when.

## M39 Parts and hull frames (2026-10-19)

**Status:** done, and the ROADMAP.md box is ticked. 19 new module types bring the total to 40, each with every maker's version as §4.1 has them: 147 parts in `data/modules.json`. Six hull frames: three more for the player, sold at shipyards, each with a trait, and two for enemies. Saves stay at v38.

**How it was picked:** §5 asks for 40 to 60 module types and 6 hull frames; there were 21 and 1. Measured first (100 voyages, every preset at seeds 1 to 50):
- no ship came near the starter frame's 40 parts: the test player's had 13 at the landing, the biggest preset 28;
- four of the 21 types never ended up on the test player's ship (the armory, the cannon, the shield array, the heavy engine);
- the crew jobs' ship effects came only from who was aboard.

Evan's picks (2026-10-19):
- 19 new types to reach 40: 5 doing a crew job's ship effect, 5 with rules of their own, 9 versions of parts already there;
- frames that differ in kind, each with a trait, bought at a shipyard;
- a part and a job with the same effect add up, within the effect's cap;
- enemy ships fly some of the new parts now.

ROADMAP.md has the Done when in full, and what was built where it differs.

**What shipped:**
- **The 19 parts** (`data/modules.json`), each with its interior, plan, model outside, roof and icon (`src/render/`), and its makers' versions:
  - **doing a job's ship effect:** the scanner (a scan reaches a link more), fire control (+10 to hit in the approach), the ECM suite (+10 evasion), the workshop (mends a wrecked part a jump) and the survey lab (a survey takes no day);
  - **with rules of their own:**
    - the torpedo bay: 20 a hit that no shield takes off, firing in rounds 1 and 3 of an approach, slower and heavier on screen;
    - the grapple: +15 to closing to board and 15 off the other ship's fleeing, the best working one counting;
    - the stealth baffles: each jump adds 1 heat less;
    - the security turret: in a boarding fight on its ship it fights for that ship's side from its mount, with a gun and no moves; at 0 hit points it is wrecked;
    - hydroponics: 2 supplies grown aboard a jump;
  - **versions:** the railgun (45 a hit), the flak battery (20 point defense), the large reactor (14 power), the thruster (4 thrust), the cockpit (a 2 × 1 bridge), the dormitory (8 berths), the air recycler (8 life support), the cargo pod (6 cargo) and the shield emitter (5 shield).
- **Effects add up** (`src/sim/edges.js` `shipEdge`): a working part's, the frame's trait and the best job's among the crew, within the effect's cap. A wrecked part gives nothing, and a second of the same part nothing past the cap.
- **Hull frames** (`data/frames.json`):

  | Frame | Cells | Parts | Thrust for mass | Trait | Price |
  | --- | --- | --- | --- | --- | --- |
  | Starter hull | 24 × 14 | 40 | 0.5 | | 500 |
  | Courier | 18 × 10 | 24 | 0.3 | +10 evasion | 600 |
  | Gunship | 28 × 14 | 48 | 0.5 | +10 to hit | 1000 |
  | Freighter | 30 × 16 | 56 | 0.6 | the lockers hold 20 more | 1200 |
  | Patrol hull (enemies) | 30 × 16 | 56 | 0.5 | | |
  | Small-craft hull (enemies) | 16 × 9 | 20 | 0.5 | | |
- **A new frame at a shipyard** (`src/sim/yards.js`, `src/sim/reframe.js`):
  - every yard sells the player's frames but the ship's own, at the yard's percent and its side's share, less half what the old frame fetches there;
  - two taps move the ship over, its parts and styling pieces keeping their places, shifted together into the new yard if they don't fit;
  - refused, saying why, past the parts cap, the styling cap or the yard;
  - the trait and the thrust for mass hold at once: a ship that then fails a flight check can't jump until a refit (M23h's rule).
- **At the colony:** each new part gives what its numbers give. The scanner and fire control add +10 to hit at a raid's lander, the workshop a material more from each mine a day, the survey lab a place more within reach, and hydroponics 2 food a day (the greenhouse). The ECM suite, the grapple, the baffles, the turret, the thruster and the cockpit can't be given, and the card says why.
- **Enemy ships:** the frigate flies fire control, the corvette a flak battery, the runner stealth baffles, the hauler hydroponics and cargo pods, the Provost cutter a security turret and the yacht an ECM suite. The patrol hull carries the corvette and the frigate, the small-craft hull the two cutters and the repo tug. None flies a grapple or a torpedo bay: with them the start ship did worse against those presets with a part added, which Law 1 forbids (ROADMAP.md, §9). The golden ships file is rewritten on purpose.
- **Where the parts come from:** every yard can sell any; act 1's shops carry some of the variants and job parts (the Tailings the thruster, the cargo pod and the workshop; the Strand the flak battery, fire control and the shield emitter; the Narrows the cargo pod, the cockpit, the scanner and the large reactor); the jobs drop the variants and the job parts; act 2's salvage the cheaper new parts.
- **The screens:**
  - **the builder:** the drawer's 40 types with their makers; each new part's card says what it does, its cap, and what it gives at the colony; the Ship tab names the hull and its trait; construction mode builds on the ship's own frame;
  - **the yard:** the Here panel counts the frames for sale, and a Hull frames section lists them, each frame's card with its size, cap, trait and price after the old frame's part payment, and a warning when a flight check would then fail;
  - **the approach:** the odds count torpedo bays and the grapple's pull, Board's first tap says what the grapple adds, the log says a torpedo went through the shields, and the round shows it in flight;
  - **the jump's plan:** what hydroponics grow and what the baffles keep off the heat;
  - **the fight:** the turret on its mount, its badge in the crew bar, its card (long-press it on the board), and only Shoot, Overwatch and Reload; the log says when it is wrecked.
- **Saves at v38:** a frame is the ship's `frame`, a turret a unit of its part's kind, torpedoes go by the approach's round. Counted in the campaign's flags: `framesBought` and `suppliesGrown`.
- **The test players:**
  - act 1's (`tools/run.js` `helps`) fits and buys a part the checklist doesn't name where it leaves the checklist asking for fewer parts: a thruster or a light engine for an engine, a dormitory for quarters;
  - the voyage's (`tools/voyagePlan.js`) also fits the scanner, the workshop, the survey lab and the grapple, never a part whose effects are at their caps already, nor a second grapple;
  - `tools/voyage.js --frame` flies the ship moved to a frame; `tools/sim.js --boardings --fit turret` boards the start ship with parts added; `tools/approach.js` adds the seven new parts that fight in an approach, puts a cockpit in the bridge's place, and moves the ship onto the courier's and the gunship's hulls; `tools/approachPlan.js` `boarderOrder` closes to board whenever it can.

**Rules changed on the way:**
- **A side whose people are all down has lost, whatever its turrets** (`src/sim/battle.js`). A crew down to its turret held a fight up for good: the crew won 13% of its boardings of the Provost cutter, against 50% with her turret taken off.
- **Those pressing on go past a turret to the people** (`src/sim/press.js`).
- **A turret stands on its mount**, its room's tile of full cover (`deploy.js` `mountOf`): on its floor tile it shut the only way through its room.
- **Past 40 rounds, a shot under 25% to hit gives way to a step nearer** (`src/sim/fightOut.js` `LONG_SHOT`, was 10%): a medic in cover took 20% shots at a brute who couldn't hit back for 20 rounds, and a voyage's boarding stalled.

**Done when** (ROADMAP.md, M39), and how each is met:
- **The 19 parts and each maker's versions:** `tests/data.test.js`, `tests/makers.test.js`, `tests/catalog.test.js`, `tests/figures.test.js`; by touch.
- **Effects add up within their caps:** `tests/partRules.test.js`.
- **Law 1:** below; none worse than another part in every way (`tests/catalog.test.js`, with the new effects among what a part gives).
- **At the colony:** `tests/partRules.test.js` and `tests/builderText.test.js`.
- **Hull frames, and a new frame at a shipyard:** `tests/frames.test.js` and `tests/yardText.test.js`; by touch.
- **Enemy ships:** `tests/ships.test.js` and the golden ships file; the approach and boarding fights measured against main's, below.
- **Where the parts come from:** `tests/run.test.js`, with act 1's run as long as main's within its margin (below).
- **The screens:** `tests/builderText.test.js`, `tests/yardText.test.js`, `tests/approachText.test.js`, `tests/approachScene.test.js` and `tests/sectorText.test.js`; by touch.
- **Saves at v38:** nothing new is saved; a quit and reopen by touch.
- **The test players:** `tests/run.test.js` and `tests/voyage.test.js`; the voyage's rates within main's margins (`MAIN`).
- **Every rule tested:** `tests/partRules.test.js` (15), `tests/frames.test.js` (7), `tests/fightOut.test.js` (1), and Law 1 in `tests/approach.test.js`.
- **Touch, at the three sizes:** below.

**Law 1, each new part and frame:**
- **In the approach** (`tools/approach.js`, 120 approaches a preset: the score's change against the start ship's, and boardings of the ship fewer in every 100; `tests/approach.test.js`):

  | Part or frame | Better against some preset | Worst |
  | --- | --- | --- |
  | Railgun | +101 the Provost cutter, +94 the pirate cutter | −5 the frigate, −4 the repo gunship (a trade, below) |
  | Flak battery | 9 fewer boardings, the corvette | −3 the runner |
  | Shield emitter | +20 the cutter | −1 the yacht |
  | Thruster | +37 the cutter | +7 |
  | Fire control | 8 fewer, the runner | 0 |
  | ECM suite | 8 fewer, the corvette | 0 |
  | Torpedo bay | +46 the cutter | +2 |
  | Cockpit, in the bridge's place | 9 fewer, the Provost cutter (evasion 30 to 32) | +3 |
  | On the courier's hull | 8 fewer, the cutter, the repo gunship and the Provost cutter (evasion 30 to 40) | +3 |
  | On the gunship's hull | +11 the cutter, +10 the runner | 0 |

  **The railgun's trade:** its mass costs 5 evasion, so the repo gunship and the frigate, which the start ship beats in none of 120 with it or without it, board it a little more often. It is listed beside M31's shield array (`TRADES`).
- **The grapple** (`tests/approach.test.js`): its pull plays only when the ship closes to board, and the test player never does. With a player who closes whenever it can (`boarderOrder`, 120 approaches a preset), it boards the other ship more often against every preset:

  | | Without | With | With its pull at 0 |
  | --- | --- | --- | --- |
  | Pirate cutter | 87 | 100 | 82 |
  | Halloran runner | 65 | 89 | 58 |
  | The other six | 88 to 103 | 96 to 112 | 79 to 100 |
- **In a fight** (`tools/sim.js --boardings --fit turret`, 40 a preset): with a turret aboard, the crew fights off more boarding parties against every preset: the gunship's 5% to 18%, the Provost cutter's 38% to 55%, the runner's 68% to 83%, the others 2 to 10 points more.
- **On the voyage** (30 voyages, no refits, jobs or voyage out: the part fitted against the same ship without it). Approaches won and lost, and boardings, move with any small part's mass (the workshop, the survey lab, the turret and the grapple all read "won 8 to 15"), so each part's own column is the one to read:

  | Part or frame | What it moves |
  | --- | --- |
  | Scanner | scans 305 to 331, surveys 49 to 53 |
  | Survey lab | surveys 49 to 65 |
  | Stealth baffles | heat 1696 to 1343, runs that met the hunters 15 to 7 |
  | Hydroponics | hungry jumps 46 to 0; 2426 supplies grown; supplies bought 2538 to 1027 |
  | Cargo pod | hungry jumps 35 to 15 |
  | Dormitory | hungry jumps 46 to 23 |
  | Air recycler | hungry jumps 46 to 33 |
  | Large reactor | approaches won 9 to 23, lost 19 to 28 |
  | Workshop | parts mended 63 to 64: the start crew's engineer mends already, and few parts are wrecked |
  | On the courier's hull | approaches lost 19 to 13 |
  | On the freighter's hull | hungry jumps 35 to 22, runs that met the hunters 15 to 9, recruits signed on 0 to 14 |
- **At the colony:** the workshop's material from each mine, the survey lab's place, hydroponics' food and the scanner's and fire control's aim at a lander are tested (`tests/partRules.test.js`); no tool plays the colony with them, as the test player seldom has the parts to give.

**Measured against main's:**
- **100 voyages** (seeds 1 to 100, the miner as `tools/voyage.js` plays by default):

  | | M39 | Main |
  | --- | --- | --- |
  | Fed all the way | 80 | 77 |
  | Settled the system's best world | 78 | 73 |
  | Met the hunters | 35 | 32 |
  | Lost a boarding at home | 28 | 22 |
  | Station jobs taken | in 81 runs | in 75 |
  | Second colonies founded | 70 | 76 |
  | The Fleet's chain started | 9 | 18 |
  | Citizens at the first colony | any in 92 | any in 86 |

  Refits fitted the new parts in 78 of 100 runs (cargo pods 20 times, the survey lab 5, the scanner 4). The voyage tests hold every rate within main's margins (`MAIN`, `VOYAGE_OUT`, `SECOND`). No ship bought a frame: the test player never does.
- **Act 1** (`tools/run.js`, 50 runs a background, the median slow-pace minutes): the miner 39 (main 42), the smuggler 49 (47), the deserter 40 (35), each within `tests/run.test.js`'s 10.
- **The approach** (`tools/approach.js`, 300 a preset, the start ship's score): within 4 points of main's against every preset; the frigate −14 (main −11), the runner −31 (−35).
- **Boarding fights** (`tools/sim.js --boardings`, 40 a preset): at home, as on main (the start ship is the same). Boarding them, on their new hulls and parts: the pirate cutter 65% (main 38%), the repo tug 55% (43%), the Provost cutter 50% (45%), the corvette 50% (48%), the gunship 23% (23%), the frigate 28% (35%), the runner 55% (68%), the yacht 13% (25%).

**Tests:**
- `node --test`: 1139 pass (1107 on main).
- **New:** `tests/partRules.test.js` (15), `tests/frames.test.js` (7), `tests/fightOut.test.js` (1); in `tests/approach.test.js` the grapple's Law 1; in `tests/approachText.test.js` the torpedo bay's and the grapple's words.
- **Changed on purpose:**
  - the golden ships file (`tests/golden/ships.txt`), for the presets' new parts and hulls;
  - the Law 1 test lists the railgun's trade, the cockpit and the courier's and gunship's hulls;
  - the catalog's, the data's and the makers' counts and orders;
  - the hustle check flies 96 fights (`tests/harness.test.js`): the enemy hulls moved the fights, and its first 48 changed none.

**Browser checks:**
- **`m39/verify.mjs`:** 43 of 43 at each of the three sizes. It covers:
  - the drawer with the 40 types and their makers, and a new part's card;
  - a frame bought and moved to at a yard, and one refused;
  - a part placed in two taps on each new frame;
  - an approach with a torpedo bay and a grapple, the torpedo in flight;
  - a boarding fight with a turret: its badge, its card, its orders;
  - a jump's plan with hydroponics and baffles;
  - a quit and reopen at v38, offline, every button 48 px or more, no console errors.
- **Every earlier milestone's browser check** passes at the three sizes unless named, each the latest adapted copy (`m39/regress-a.sh`, `regress-b.sh` and the follow-ups beside them). The one exception is M32b's first copy, whose 2 known failures since M36 its fix copy covers.
  - **Adapted for M39:** M37b's (the yard lists its hull frames, three rows, and its hint and Here panel offer them), M31's, M23g's and M23e's (the drawer's counts: 147 parts, the makers 40, 27 and 40, four engines from Bastion and Scrapline, the torpedo bay and the railgun the first medium weapons).
  - **Run again on its own, and passed:** M38b's at the open size, which timed out beside the voyage tests.

**Found while building, and fixed:**
- **No fight opened** on this branch: the fight screen handed the crew bar the content before it had loaded. Every fight's screen threw on opening; M39's browser check found it.
- **The builder built on the starter hull** whatever the ship's frame: construction mode and the sandbox now use the ship's own.
- **A crew down to its turret held a fight up for good, and those pressing on went for the turret:** the two rules above.

**Known issues:**
- **Hydroponics ends hunger outright** for the test player (46 hungry jumps in 30 voyages to none) and cuts the supplies it buys by 60%: strong for 200 credits. For M40's balance runs.
- **The workshop does little on a voyage** with an engineer aboard, and the start crews of the miner and the smuggler have one.
- **No test player buys a frame,** so the frames' worth on a run is measured only with `--frame`.
- **Boarding the yacht** is down to 13% from 25%, and the runner to 55% from 68%, with their new parts and layouts. For M40.
- **A turret aboard an enemy ship changes little:** those pressing on go past it (§9).
- **No enemy flies a grapple or a torpedo bay** (§9).

**What Evan should test on the phone:**
- **The drawer:** All with the 40 types and their makers; the maker row's counts; a new part's card (a torpedo bay's rounds, the grapple's pull, the scanner's cap, what each gives at the colony).
- **A frame at a yard:** Yard on the chart, the Hull frames section, a frame's card (size, cap, trait, price after the old frame), Buy in two taps; the ship on the new frame at once, and Refit opening on it; a frame refused with the ship over its cap.
- **Building on each frame:** a part in two taps on the courier, the gunship and the freighter; the Ship tab's Hull row and trait.
- **An approach with a torpedo bay and a grapple:** the odds name them, Board's first tap says what the grapple adds, a torpedo in flight in round 1, and the bays holding fire in round 2.
- **A boarding with a turret aboard:** Fight them off; the turret on its mount, its badge in the crew bar; long-press it on the board for its card; picked, only Shoot, Overwatch and Reload; wrecked, it slumps and the log says so.
- **A jump's plan** with hydroponics (what grows aboard) and baffles (the heat they keep off).
- **Quit and reopen:** a save from before opens and plays on.

**Next milestone's first task:** M40 Balance runs: study what to balance (the voyage's rates against their first targets, the miner's hunters past the charts, the deserter's crew aboard ships, the talents' worth, and M39's hydroponics and boardings), measure from each start, ask Evan, settle its Done when.

## M38f Citizens (2026-10-19)

**Status:** done, and the ROADMAP.md box is ticked. Every colony now has citizens: a headcount, not crew. They:
- eat, sleep and work its farms and mines;
- grow on its good days, and leave on its hungry ones;
- include a captive freed on a voyage's rescue, who settles at the colony flown from.

A raid at a colony the ship isn't at is fought out on the day it lands, the AI playing both sides. The ship is never held, and a report waits. In a raid the player fights, the citizens stand beside the crew as colonists, under the player's orders. Saves are at v38.

**How it was picked:** Evan asked (2026-10-18) for colonies that thrive with citizens of their own. He picked a colony that runs itself while the ship is away, its citizens grown, rescued or left behind.

Measured first (the miner, 100 voyages out, medians):
- the first colony as the ship flies out: 1 at home of 3, room for 1 more, 6 food a day against 1 eaten;
- with nothing built, 1 or 2 defending won 0 of 40 raids fought out by the AI on both sides, and 3 won 18 of 40.

His picks (2026-10-19):
- a citizen is a headcount;
- a raid where the ship isn't is fought out at once;
- a raid lost costs the stores and the citizens who fell;
- in a raid the player fights, the citizens fight under the player's orders.

ROADMAP.md has the Done when in full, and what was built where it differs.

**What shipped:**
- **Citizens** (`colony.citizens` and `colony.growth`, at every colony; `src/sim/colony.js`):
  - each eats a jump's supplies a day;
  - each takes a bed and air after the crew there;
  - each works a farm or a mine, one to a building in the order built, for `citizenWork` (1) more a day;
  - they aren't crew: the 20 don't count them, and none comes aboard.
- **Grown** (`src/sim/days.js`):
  - every `citizenDays` (5) fit days at a colony, one more comes. A fit day is fed, has a bed and air free for one more, and has every building powered;
  - a hungry day there, one leaves;
  - with nobody there, crew or citizens, none comes;
  - the day's plan says why none comes ('hungry', 'nobody', 'room' or 'dark').
- **The rescued** (`src/sim/contracts.js`): a captive freed on a station job during a voyage settles at the colony flown from, if it has room. Without room, or before act 3, they go their way as before.
- **Raids where the ship isn't** (`src/sim/raids.js` `fightAway`, `src/sim/fightOut.js`). That covers a voyage, a trip, and another colony.
  - On the day the lander comes down, the guns fire as before. Those who land fight whoever is there, crew and up to `raidCitizens` (6) citizens, on its grid, the AI playing both sides.
  - Past 40 rounds both sides press on, and at 60 the raiders pull out and the colony holds.
  - Crew come out with at least 1 hit point and their fights counted. The colonists who fell are gone, unless stabilized.
  - It is settled as before (that colony's heat and, lost, what a raid takes from its stores), and the colony's news tells it.
  - The playing-on that M32's test players used (`tools/boarding.js`) moved into the sim as `fightOut.js`, so the sim can fight out a raid without the player.
- **When a raid lands while the ship is away:** no sooner than the day after the ship could be back. To meet it, the ship must land the day before, since on its day it is fought out.
  - A flight, a leg or a voyage under way never stops for a raid now.
  - A raid down while away, or a flight or a leg one stopped, exists only in a save from before. It keeps Defend and Fly on.
- **The news** (`colony.news`, at most 12 entries): raids fought out, citizens come, gone or settled, added only while the ship is away. It is kept once the ship lands, until a day passes there or the ship leaves again.
- **Colonists in a raid the player fights** (`data/colony.json` `citizen`: 6 hit points, aim 55, a pistol):
  - up to 6 citizens stand on the grid beside the crew, under the player's orders and in the crew bar (Colonist 1 to 6, "Col. 1" on its button);
  - their card says a fallen colonist is lost unless stabilized;
  - those who fall are lost to the colony.
- **The screens:**
  - **the colony screen:**
    - a Citizens line: how many, the beds they take, and the days to the next or why none comes ("2 in 2 beds · the next in 3 days");
    - a farm or a mine a citizen works says so;
    - the day's words count the citizens eating, coming and leaving;
  - **landing:** the words say what happened while the ship was away ("While the ship was away, Con-Reg Recovery's raiders were fought off on day 34; 1 colonist fell"), and the hint keeps it until a day passes;
  - **the chart:** each colony's panel names who is there, its citizens with them, and its last news ("Raid fought off, day 34 · 1 fell");
  - **a trip's legs:** the report says what happened at the colony;
  - **a lander coming while away:** the hint says who fights it without the ship, and whether flying home now meets it;
  - **Defend:** its first tap counts the colonists, and the end panel says how many fell and how many are left;
  - **a rescue on a voyage:** the end panel says the captive settles.
  - Words for a landing or a flight now carry across to the screen that opens (`src/ui/campaign/carried.js`). Since M38d every screen switch remounts the screen, so they were lost.
- **Saves at v38** (`src/core/save.js`): every colony from before has no citizens, nothing toward the next, and no news. `campaign.js` checks each colony's citizens, growth and news.
- **Validation:** `tools/validate-colony.js` checks the colonist and the three balance numbers. `tools/validate-campaign.js` refuses a colonist id that is a job's, an enemy's or a person's.
- **The test player** (`tools/voyage.js`):
  - back from its voyage out, it plays the first colony's next 20 days (`AFTER_DAYS`), so the second lives them too;
  - it flies home for a raid only when it can land the day before.

  The report adds a citizens line.

**Done when** (ROADMAP.md, M38f), and how each is met:
- **Citizens** (eat, beds and air, work, not crew): `tests/citizens.test.js`.
- **Grown, and one leaving on a hungry day:** `tests/citizens.test.js`. Over 100 test voyages, `tests/voyage.test.js` checks each colony's headcount: those grown and settled, less those gone and fallen.
- **The rescued:** `tests/citizens.test.js` and `tests/citizensText.test.js`.
- **A raid at a colony the ship isn't at:** `tests/citizens.test.js`, `tests/raids.test.js` (on a trip), `tests/colonyVoyage.test.js` (on a voyage) and `tests/colonies.test.js` (at another colony); by touch.
- **A raid the player fights, with colonists:** `tests/citizens.test.js`; by touch.
- **A colony with nobody left:** `tests/citizens.test.js`.
- **The screens:** `tests/citizensText.test.js`, `tests/colonyText.test.js`, `tests/voyageText.test.js`, `tests/colonyListText.test.js` and `tests/raidText.test.js`; by touch.
- **Saves:** `tests/citizens.test.js` (v38, a v37 save migrated, broken ones refused) and the stopped flights and legs from before in the tests above.
- **The test player:** `tests/voyage.test.js` (a new test over its 100 voyages).
- **Measured over 100 voyages:** below.
- **Every rule tested:** as above.
- **Touch, at the three sizes:** below.

**Measured:** 100 voyages out, seeds 1 to 100, the miner as `tools/voyage.js` plays by default, then the 20 days after. Medians, then the least and most:

| | |
| --- | --- |
| Citizens at the first colony | 1 (0 to 5), any in 86 of 100 |
| Citizens at the second | 1 (0 to 5), any in 42 of the 76 founded |
| Since flying out | 133 came, 5 left hungry, 7 fell in raids, 1 freed captive settled |
| Raids fought out without the player | 1, lost (the test player flies home for every raid it can meet) |
| Raids met at home once back | 9, 6 won |
| Hungry days in the 20 after | 11, in 3 runs |
| The voyage's rates (`VOYAGE_OUT`) | home 100, crossed 98, fed 99, fed aboard 99 (main's 100, 96, 100 and 100): within the margin |
| Second colonies (`SECOND`) | founded on 76 (main's 75) |

**A raid fought out, by who is there** (20 seeds each, the kit's colony with nothing built, the miner's 4 raiders):
- 2 crew and 3 colonists won 7;
- 3 colonists alone, 2 crew alone, and nobody there each won none.

The longest fight took 132 ms.

**Tests:**
- `node --test`: 1107 pass (1088 on main).
- **New:**
  - `tests/citizens.test.js` (9): the headcount, its beds, air and work, growing and leaving, the rescued, raids fought out on a voyage, a trip and at another colony, colonists in a raid the player fights, the colony with nobody left, and v38 saves;
  - `tests/citizensText.test.js` (9): the words for each;
  - `tests/voyage.test.js`: the citizens over 100 voyages (`CITIZENS`).
- **Changed on purpose:**
  - the tests that pinned `SAVE_VERSION` at 37 now pin 38;
  - M38d's and M38e's raid timing and stopped flights, M29's stopped legs: a raid where the ship isn't is fought out, and a stopped flight or leg is built as a save from before;
  - the new colony's shape (`citizens`, `growth`, `news`);
  - a battle's error for an unknown unit names colonists too.

**Browser checks:**
- **`m38f/verify.mjs`:** 21 of 21 at each of the three sizes. It covers:
  - the colony screen's citizens, and a farm a citizen works;
  - a lander coming while the ship is away, Fly home too late, and the raid fought out on the last day;
  - the landing's words with the news, which go once a day passes;
  - the chart's colony panel with the news;
  - Defend with three colonists, Col. 1 to Col. 3 in the crew bar, every button 48 px or more;
  - a quit and reopen at v38;
  - offline, and no console errors.
- **Every earlier milestone's browser check** passes at the three sizes unless named, each the latest adapted copy (`m38f/regress-a.sh` and `regress-b.sh`; after the container restarted mid-run, `regress-a2.sh` and `regress-b2.sh` ran the rest). The one exception is M32b's first copy, whose 2 known failures since M36 its fix copy covers, as in M36 to M38e.
  - **Adapted for M38f:**
    - M38e's, M38d fix's, M38c's, M38b's, M35's, M34's, M31's, M30's, M29's, M28's and M27's pinned saves at v37; their copies (`verify38f.mjs` beside each) pin v38;
    - M38d fix's lander coming says those at home fight it without the ship;
    - M29's legs no longer stop for a raid. Its steps 7 and 8 now fly out with the raid fought out at home, with someone there and with nobody, and check the leg's report. Its stopped leg, and Defend with nobody home, are built as saves from before;
    - M27's and M26's checks read the needs with the Citizens line in them.
  - **Run again on its own, and passed:** M35's at the tab size, which lost its port to the run beside it.

**Found while building, and fixed:**
- **The landing's words never showed:** since M38d a screen switch remounts the screen, so what Fly home, Fly to and Fly out said was lost with it. The words are now carried across (`carried.js`), and the colony's news is in its hint.
- **The news went stale:** it now goes once a day passes at the colony, or when the ship leaves.
- **A stabilized colonist was counted as fallen:** they now survive the fight.
- **The colonists' names were cut to the same "Coloni…"** in the crew bar: a numbered name is shortened to "Col. 1" (`src/ui/names.js`).

**Known issues:**
- **The test player builds no room for citizens:** its shelters are for the crew who stay home, so a colony grows only into what is free (median 1; §9).
- **Raids fought out without the player were rare** in the test runs (1 in 100 voyages, lost), since the test player flies home for every raid it can meet. A colony with few people and no guns loses them: 2 crew alone won none of 20.
- **A raid fought out is decided whole at once.** There is no replay, and its news doesn't say who fell beyond a count (§9).
- **A colony grid with no room for those there and the raiders** counts the raid as lost without a fight. The colonies seen so far have room.
- **Since M38d, the words for a stopped flight or leg are gone:** they exist only in a save from before, whose hint is the raid's, with Defend and Fly on.

**What Evan should test on the phone:**
- **A colony's Citizens line:** how many, the beds, the days to the next. A farm a citizen works says so. Next day's words count them.
- **A raid while the ship is away:**
  - fly out leaving someone home, and let a lander come down before you can get back;
  - the chart's colony panel says what happened;
  - fly home: the landing's words give the news, and the hint keeps it until Next day.
- **Defend with citizens at home:**
  - Col. 1 and on in the crew bar, under your orders;
  - long-press one for its card;
  - the end panel counts those who fell and those left.
- **A rescue at a station on a voyage:** the end panel says the captive settles at the colony.
- **Quit and reopen:** a save from before opens with no citizens and plays on.

**Next milestone's first task:** M39 Parts and hull frames: study the parts and frames (21 module types against §5's 40 to 60, one hull frame), measure, ask Evan, settle its Done when.

## M38e More colonies (2026-10-18)

**Status:** done, and the ROADMAP.md box is ticked. A world a voyage passes can now be settled. The ship lands there with those aboard and founds another colony, and the colony it flew from keeps whoever was at home and its food. Each colony:
- lives every day, wherever the ship is;
- is found by its own trail of heat, and can be raided;
- holds the ship with a lander down until the raid is faced.

The ship flies straight to any colony, from a voyage or from the colony screen. Saves are at v37.

**How it was picked:** Evan asked (2026-10-18) for colonizing multiple worlds, leaving thriving colonies. Measured first (the miner, 100 voyages out after the first colony's 60 days, medians):
- 2 aboard and 1 at home;
- 6 worlds passed, none surveyed by the test player;
- 5 parts in the hold and 49 credits;
- the one colony runs through about 40 files, and its raid odds used the ship's heat even while the ship was away.

His picks:
- whoever you leave stays, with that colony's own food;
- fly straight there;
- its own trail of heat;
- a new colony starts with a landing's salvage.

ROADMAP.md has the Done when in full, and what was built where it differs.

**What shipped:**
- **Settling on a voyage** (`src/sim/settle.js`). At a world in a system past a colony's, Settle here founds another colony:
  - it starts with a landing's 20 materials, nothing built, and its system's other worlds for its trips;
  - those aboard land with the ship, the landing plays and names the colony ("The crew's second colony"), and the act stays 3;
  - the colony flown from keeps whoever was at home and its food. At most 12 colonies.
- **More colonies** (`src/sim/colonies.js`, new):
  - `campaign.colony` is the colony the ship is landed at or flew from, so the colony screen, building, trips, Fly out and refits work there as before;
  - the others wait in `campaign.colonies`, each keeping whoever is there and its food;
  - each colony has its number, its place along the line of systems (the first at 0, a voyage's at its systems out) and its own heat;
  - a voyage knows where the ship is along the line (`at`), and the colony a stopped flight is for (`to`).
- **Every colony lives every day** (`src/sim/days.js` `othersDay`). Next day, a trip's days, and each jump, survey, rest and day of a flight pass at every colony. A colony the ship isn't at runs as a colony with the ship away does:
  - its own power, and no rest without a bed and air;
  - its food eaten and its heat falling a day;
  - the pursuer able to find it.

  The flags count the other colonies' days apart (`othersDays`, `othersHungryDays`, `othersRaidsFound`).
- **Its own trail** (`src/sim/raids.js`, `colonies.js` `heatAt`):
  - the ship leaves its heat with the colony it flies from, and that heat falls `colonyHeatFall` a day. The pursuer's odds go by it (M38d let the ship's heat stand for it);
  - landing, the ship takes the greater of its heat and the colony's;
  - a raid sets that colony's heat to `heatAfterRaid`, and the ship's only when it is landed there;
  - the ship's own heat is the hunters', as before.
- **Raids at every colony:**
  - found while the ship isn't there, a lander comes down no sooner than the ship could reach it;
  - a lander down at any colony holds the ship;
  - Defend, from the chart or the colony screen, faces it on that colony's grid, with whoever is there or the guns alone. The ship's side waits at that colony while the fight is on (`parked`);
  - lost, it takes from that colony's stores and nothing from the hold.
- **Fly to a colony** (`src/sim/voyage.js` `flyTo`, `flyFrom`), two taps:
  - from anywhere on a voyage, or from the colony screen with the crew picked as for Fly out;
  - each system between costs a day and a jump's supplies for those aboard, one system at least, plus one jump's heat; no hunters roll;
  - a lander on the way stops it, and Fly on finishes it. Stopped on a flight from the colony screen, the ship waits in a system rolled where it stopped (`travel.js` `waitIn`);
  - landed, the crews and the stores join, up to the stores' room, and the colony flown from keeps its own.
- **The screens:**
  - **the chart:** the colony flown from keeps its panel, now with the flight home's days. Each other colony gets a panel under it (the flight there, its day, food, who is there and its raid) with Fly to;
  - **the colony screen:** the other colonies are listed under Voyage as Colonies, and a tap plans the flight;
  - **the hints, Defend's first tap and the landing's report** name the colony a lander is at;
  - **Continue** says "on the way to …" for a stopped flight.

  The words are `src/ui/campaign/colonyListText.js`'s (new).
- **The whole crew is at most 20** (`MAX_CREW`), across every colony and aboard, since a save past it wouldn't read. A recruit or a companion signs on only under it.
- **Saves at v37** (`src/core/save.js`):
  - the one colony becomes the first, at 0, with the ship's heat;
  - a voyage is as far along as it is out, or as its flight home has left;
  - a v36 save opens as it did.

  `campaign.js` checks every colony and each voyage's flight (its colony, and its days left matching where the ship is).
- **The test player** (`tools/voyage.js`, `tools/voyagePlan.js` `settleMove`, `backCrew`):
  - on its voyage out it settles the best world of the second system out;
  - it gives the ship's parts and plays the new colony's first 10 days (`NEW_DAYS`), building farms and mines, and meets a raid coming there before it leaves;
  - it leaves the least fit there when three or more landed, and flies straight back to the first colony, at once if a raid is coming there.

  `--settle no` keeps M38d's voyage out. `--out` and `--settle` now work from the command line (`--out` was documented in M38d but never read).

**Done when** (ROADMAP.md, M38e), and how each is met:
- **Settling on a voyage:** `tests/colonies.test.js` and `tests/colonyListText.test.js`; by touch.
- **Each colony's own grid, buildings, stores, days, raid and heat:** `tests/colonies.test.js`; by touch (the new colony's screen, with a part given).
- **Where each lies:** `tests/colonies.test.js`.
- **Fly to a colony:** `tests/colonies.test.js` (from a voyage; from the colony screen, stopped and flown on) and `tests/colonyListText.test.js`; by touch.
- **Every colony lives its days:** `tests/colonies.test.js`. Over 100 test voyages, `tests/voyage.test.js` checks that the first colony's days away come to the voyage's days.
- **Its own trail:** `tests/colonies.test.js`.
- **Raids at every colony:** `tests/colonies.test.js` (the timing, the hold, Defend from either screen, the fight, lost and won); by touch.
- **The screens:** `tests/colonyListText.test.js`; by touch.
- **Saves:** `tests/colonies.test.js` (v37, a v36 save migrated, broken colonies refused).
- **The test player:** `tests/voyage.test.js` (a new test over its 100 refitting voyages).
- **Measured over 100 voyages:** below.
- **Every rule tested:** as above.
- **Touch, at the three sizes:** below.

**Measured:** 100 voyages out, seeds 1 to 100, the miner as `tools/voyage.js` plays by default. Medians, then the least and most:

| | |
| --- | --- |
| Second colonies | founded on 75 of 100 voyages out, in the second system. The other 25 flew home first by M38d's rules: 22 with the holds down to the way home (21 of them already in the second system), and 3 called home by a raid |
| Days there | 10 (10 to 12); none cut short by a raid at the first |
| Left there | one in 56 (three or more landed), nobody in 19 |
| The flight back | all 75 in 2 days, none stopped by a lander; hungry aboard in 1 |
| Raids since flying out | at the first: found 4, faced 4, none lost. At the second: found 6, faced 5, lost 2 |
| Every colony fed | in 99 of 100 |
| The voyage out | home in 100; 1 system crossed (0 to 1); the first colony's days away 22 (2 to 28); jumps 10 (1 to 13); no raid faced while away |
| The voyage's rates (`VOYAGE_OUT`) | home 100, crossed 97, fed 99, fed aboard 99 (main's 100, 96, 100 and 100): within the margin |

**The heat rule alone** (`--settle no`: M38d's voyage out on M38e's rules; main's numbers in brackets):
- the colony found in 4 runs (8), with 3 calling the ship home (7);
- 4 raids met at home, all won (8 met, 7 won);
- systems crossed 3 (0 to 3), all 3 in 55 (54);
- the ship boarded 15 times, 7 fought off (8, 1); signed on 101 (110).

The colony's odds while away now go by its own heat, which falls a day. M38d's went by the ship's, which rises with each jump. On a day with no odds no roll is drawn (`raids.js` `raidDayEnd`), so once the two heats part, every roll after it on that voyage comes out differently:
- 60 of the 100 voyages out roll out differently from main's;
- 52 of those 60 have the same call home.

The boardings moved with that reshuffle; nothing in M38e touches a boarding.

**Act 2's and the colony's first 60 days are as main's:** the 100-voyage report (`tools/voyage.js --runs 100`, run from main and from this branch) matches main's line for line, apart from the voyage-out lines.

**Tests:**
- `node --test`: 1088 pass (1073 on main).
- **New:**
  - `tests/colonies.test.js` (9): settling on a voyage, every colony's days, the trails of heat, a raid's timing at another colony, the hold and Defend, Fly to from a voyage and from the colony screen, the crew limit, and v37 saves with broken colonies refused;
  - `tests/colonyListText.test.js` (5): the words for each;
  - `tests/voyage.test.js`: the second colony over 100 voyages (`SECOND`).
- **Changed on purpose:**
  - the tests that pinned `SAVE_VERSION` at 36 now pin 37;
  - the new campaign's shape (`colonies: []`) and the colony's (`id`, `at`, `heat`);
  - M38d's raid timing test reads the colony's own heat and where the ship is;
  - M38d's survey test: a voyage's world can now be settled;
  - the landing's words, which gain the line under its heading (`where`);
  - the voyage-out test: a second colony's days, and the one left there.

**Browser checks:**
- **`m38e/verify.mjs`:** 35 of 35 at each of the three sizes. It covers:
  - settling on a voyage, its two taps and the landing;
  - the new colony's screen, with a part given;
  - every colony listed on the colony screen and the chart;
  - Fly to the first from the chart, and back from the colony screen;
  - a raid at the colony the ship isn't at: Defend, the fight with whoever is there, and a reload mid-fight;
  - a quit and reopen at v37;
  - offline, every button 48 px or more, and no console errors.
- **Every earlier milestone's browser check** passes at the three sizes unless named, each the latest adapted copy (`m38e/regress-a.sh` and `regress-b.sh`). The one exception is M32b's first copy, whose 2 known failures since M36 its fix copy covers, as in M36 to M38d.
  - **Adapted for M38e:** M38d's fix's, M38c's, M38b's, M35's, M34's, M31's, M30's, M29's, M28's and M27's pinned saves at v36; their copies (`verify38e.mjs` beside each) pin v37.
  - **Run again on their own, and passed:**
    - M33b's at the cover size, which timed out waiting for the colony screen while four runs shared the machine;
    - M23d's at the tab size, which lost its port to the run beside it.
  - `regress-a.sh` stopped at its time limit during M32b's first copy, and `regress-a2.sh` ran the rest of it.

**Found while building, and fixed:**
- **The landing never said which colony it founds:** the line under its heading names it now.
- **A save whose stopped flight's days left didn't match where the ship is** would still load: the save check refuses it now.
- **The test player flew back while a raid was coming at its new colony**, so in the first 100-voyage run one raid there was faced with the ship away. It now meets that raid before it leaves.

**Known issues:**
- **The second colony's raids:** with 2 or 3 there and no guns yet, the test player lost 2 of the 5 it faced there (§9).
- **"Every colony fed" covers the second colony only until the ship lands back at the first.** The test player's run ends there.
- **The test player settles only with food enough to fly home.** In 21 voyages its holds were down to the way home by the second system, so it flew home rather than settle.
- **A flight between colonies meets nothing on the way** (§9).
- **The act line at every colony** says "Act 3 · The colony" (§9).
- **A split crew still loses its boardings** (§9, from M38d).

**What Evan should test on the phone:**
- **Settle a world on a voyage.**
  - Settle here's first tap says it's the crew's second colony, who lands, and who stays at the first.
  - The landing names it, and its screen opens at day 1 with 20 materials.
  - Give it a part, and build.
- **The colony screen** lists the first colony under Voyage, as Colonies. Tap it, pick who goes, and Fly to.
- **The chart** shows a panel for every other colony, with Fly to. The colony you flew from shows the flight home.
- **A raid at a colony you're not at:**
  - the hint names it, and Defend is there on the chart and the colony screen;
  - whoever is there fights it, and with nobody there the guns alone face it.
- **Quit and reopen anywhere:** Continue says where the ship is.

**Next session's first task:** M38f Citizens: study a colony running itself while the ship is away (citizens grown, rescued and left behind; work, food, and raids fought out without the player), measure, ask Evan, settle its Done when.

## M38d fixes: the materials kept, raids that call the ship home, the holds stocked (2026-10-18)

After M38d Evan said "Do recommendations, merge and continue" (2026-10-18). Each call M38d left open had my recommendation or a choice of two; where there were two, I took the one that keeps his M38d picks:
- **The materials stay at Fly out.** M38d lost whatever was past the storehouses' room (86 of 100 test colonies, 1,884 in all). Now none are lost. While the ship is away they keep past the room, but the mines add to them only up to it, as M27's day keeps no more than the stores. I didn't have the holds carry them: the holds are the ship's food, so that would shorten every voyage.
- **A raid's warning calls the ship home.** The other choice, raids that wait for the ship, would drop Evan's pick that those left home face any raid. Now a raid found while the ship is away comes down no sooner than the ship could be home if it turned back at once: raidWarning's 3 days, or the flight home's when more. With 3 days' warning, a ship 3 systems out or nearer could already make it. The 7 raids M38d's test player lost were all ones it could have flown home for. The rule matters past 3 systems.
- **The plan says how far the food goes,** and the test player stocks the holds before it flies. M38d's 13 voyages that crossed no system flew out on near-empty larders.
- **A system's words, not a sector's,** past the colony.

**What shipped:**
- **The rules:**
  - `src/sim/days.js`: while the ship is away, a day keeps the materials past the storehouses' room, and the mines add only up to it;
  - `src/sim/voyage.js`: Fly out keeps every material (the plan's materials are now `{ now, dug, room }`: what the mines dig a day on the colony's own power, and the room they fill to);
  - `src/sim/raids.js` (`flightHome`, which `voyage.js` shares): a raid found while away lands no sooner than the flight home would.
- **The words:**
  - the plan: "Food 50: the holds take 30, enough for 15 jumps; the storehouses keep 20 of 20", and "The mines' 2 a day keeps up to the storehouses' 20 while the ship is away" (with no storehouse, "No storehouse: the mines' 2 a day is lost while the ship is away");
  - Fly out's first tap: "… the holds take 30 food, 15 jumps' worth, and the colony keeps 20 …", with nothing lost but spoiled food;
  - the lander's hint: "… their lander comes down in 2 days. Fly home now (1 day) to meet it, or those at home fight it.", or, too far out, "Flying home takes 4 days, too long to meet it: those at home fight it.";
  - a voyage's way in and jump point say a system's words (`data/worlds.json` `voyage` `text` and the new `exit`, validated), and the transponder swap is "once a system".
- **The test player** (`tools/voyage.js` `voyageOutOf`, `tools/voyagePlan.js`):
  - it stocks the holds before flying: farms for twice what the crew eats (`STOCK_SHARE`, `nextBuild`'s new share), and days at home until the food fills the holds (`stockFor`), at most `STOCK_DAYS` (20), none once the farms can grow no more than the crew eats and no mine digs toward another;
  - it flies home when a raid is coming that the flight home beats (`homeNow`), and meets it at home with everyone;
  - the report gives the days stocking, the call home, the raids met at home and the mines' digging lost while away.
- **No save change:** the rules read what saves already hold, so saves stay at v36.

**Measured** (100 voyages out, seeds 1 to 100, the miner as `tools/voyage.js` plays by default; M38d's in brackets):

| | |
| --- | --- |
| Flown out, and home | 100 of 100, 100 of 100 (the same) |
| Systems crossed | 3 (0 to 3): all 3 in 54 (52), 2 in 17 (14), 1 in 25 (21), none in 4 (13) |
| The 4 that crossed none | 3 called home by a raid in their first system; 1 a colony whose one farm grows only what its crew eats, with 4 materials and no mine to dig more |
| Days stocking before flying out | 0 (0 to 16); the holds full in 99 |
| Days away | 23 (2 to 31) (22) |
| Hungry | none aboard (1 run), none flying home (1), none at home (none) |
| Raids | found in 8 runs (9); 7 called the ship home and 1 was found on its way; none faced while away (7, all lost); 8 met at home with everyone, 7 won |
| Boardings of the ship | 8, fought off 1 (the same) |
| Station jobs | 2 (0 to 9) a run, in 88 runs (80); 184 of 235 done; paid 120 (95) |
| Credits | spent 157 → 189; 49 out, 76 home (61) |
| Signed on | 110 (92) |
| Heat | 4 (0 to 46) out (6), 29 (6 to 67) home (30), 42 → 43 at most |
| Materials | none lost flying out (1,884 in 86 runs); the mines' digging past the storehouses lost while away in 13 runs, 1,350 in all (lost the same way before, uncounted) |

**Act 2's and the colony's numbers are as M38d's:** the voyage out keeps its own tally, and the colony's first 60 days play as before. The 30-voyage report (`tools/voyage.js --runs 30`) matches main's line for line, apart from the voyage-out lines.

**Tests:** `node --test`: 1073 pass (1071 before).
- **New:** `tests/colonyVoyage.test.js`: the materials kept while away (past the room, the mines filling only to it, home's room again after landing), and a raid found while away landing no sooner than the flight home (1 out, 5 out, and found on the way home); a validator case for the voyage's jump-point words.
- **Changed on purpose:**
  - `tests/voyage.test.js`: `VOYAGE_OUT` moved to the fixed player's rates (crossed 96 where 87, fed aboard 100 where 99), since the player now stocks the holds and flies home for raids. It checks the stocking, the call home, no raid faced while away, each raid after flying out met with more than those left home, and the summary's new words;
  - `tests/colonyVoyage.test.js` and `tests/voyageText.test.js`: the plan's materials shape and lines, the food line's jumps, the lander's hint, the way in's and the jump point's words, the swap's.

**Browser checks:**
- `m38dfix/verify.mjs`, M38d's check adapted for the fix: 43 of 43 at each of the three sizes. It adds:
  - the way in's words on a voyage's chart;
  - a lander coming in 2 days, the hint saying Fly home now meets it;
  - a colony with a mine and 45 materials over a storehouse of 20: the plan's mine line, and all 45 kept after flying out.
- **Every earlier milestone's browser check** passes at the three sizes unless named, each the latest adapted copy (`m38d/regress-a.sh` and `regress-b.sh`, unchanged). The one exception is M32b's first copy, whose 2 known failures since M36 its fix copy covers. M20's at the tab size and M18's at the cover size lost their port to the run beside them and passed on their own.

**Known issues:**
- **A split crew still loses its boardings:** 7 of the 8 with 2 aboard, as in M38d. The boarders come as many as with the whole crew aboard (§9).
- **Mines with no storehouse dig for nothing while the ship is away** (13 colonies, 1,350 materials). The plan says so (§9).
- **Heat still doesn't fall at home while the ship is away,** and a raid met at home after the call home sets heat to its after-raid level, as any raid does.
- **Settling a second world** is M38e.

**What Evan should test on the phone:**
- At the colony, Voyage: the food line says how many jumps the holds' food lasts. With a mine, a line says what it digs while you're away and where that stops.
- Fly out with more materials than the storehouses hold: they're all still there when you come home.
- Out there, if the pursuer finds the colony, the hint says whether flying home now beats their lander. Fly home and you land in time to Defend with everyone.
- The way in and the jump point on a voyage's chart say "system".

**Next session's first task:** M38e More colonies: study a second world settled from a voyage (its own grid, buildings, stores, days and raids), measure, ask Evan, settle its Done when.

## M38d The run goes on (2026-10-18)

**Status:** done, and the ROADMAP.md box is ticked. From the colony the ship flies out on voyages with a crew picked, the stores split between the holds and the storehouses, into systems nobody has charted: each a chart like act 2's sectors, with two worlds, and each jump point leading to the next, without end. A day passes at home with each jump. A raid's lander that comes down while the ship is away holds it until those at home face it. Fly home works from anywhere on the run. Saves are at v36.

**How it was picked:** Evan asked (2026-10-18) for act 3 to keep travel going: the systems, the stations and the ship-building, not just the colony's trips. Measured first (the miner, 30 voyages from launch through the colony's 60 days, medians): 31 credits at the landing and nothing to spend them on after it; heat down to 10 by day 60; 9 trips flown, 28 days away; the colony found by the pursuer in 15 runs of 30. His picks:
- new systems in a line, each a chart like act 2's sectors;
- fly home from anywhere;
- a day a jump;
- pick the crew, and split the stores.

ROADMAP.md has the Done when in full, and what was built where it differs.

**What shipped:**
- **The voyage** (`src/sim/voyage.js`, new):
  - Fly out takes the crew picked, as many as the ship's berths and air hold (the flight checks count those aboard), one or more; the rest stay home. Only from the colony, with the ship home, no trip and no lander down.
  - The stores split: the holds take their fill of the food, the storehouses keep the rest up to their room, and what neither holds spoils; materials past the storehouses' room are lost (below); credits, parts on hand and spare weapons go with the ship.
  - Fly home: a day at the colony and a jump's supplies for those aboard for each system out, with one jump's heat. A lander that comes down before the last day stops the flight; Fly on finishes it. Landed, the crew is one again in its order and the stores one store, up to their room.
- **Who is where** (`src/sim/away.js`, new): while the ship is away, the campaign's crew and supplies are those aboard and the holds, and the colony's voyage keeps those at home and its food. For a raid fight at home the two swap places and swap back after it.
- **The systems** (`src/sim/gen/system.js` `beyondSystem`): a sector's chart, from the act 2 generator with its stations, shipyard, nebula, events and hostile ships, plus two worlds rolled as M25's (`data/worlds.json` `voyage`). Each is named from the systems' list, never one of the run's last 60 maps' names until the list runs out. 12 names were added.
- **On the run in act 3:** everything act 2's run does works for those aboard: jumps, long jumps, scans, events, approaches, boardings, regroups, hiding, surveys (settling waits for M38e), stations, yards, refits, racks, recruits, jobs and swaps (`src/sim/acts.js` `outOnRun`, `travel.js`). A recruit or a companion signs on aboard. Heat rises and the hunters roll as in act 2; a day at home while away leaves heat alone.
- **A day a jump** (`src/sim/days.js` `voyageDay`): each jump (the jump out and each one into the next system too), survey, day's rest and day of the flight home passes a day at the colony, run as a trip's: the farms and mines make, those at home eat from the colony's food and rest, the pursuer may find it, and a lander comes down on its day.
- **A raid while away** (`src/sim/raids.js`): its landing holds the ship, as an event does. Those at home face it with the colony's guns; with nobody home the landing's hits are all the colony has. Lost, it takes from the colony's stores, never the ship's.
- **Saves at v36** (`src/core/save.js`): the colony keeps its system's other worlds and its voyage (null with the ship home); a v35 act 3 save opens with the ship home. `campaign.js` checks a voyage's shape: its systems out, the flight home's days left, those at home or aboard, no one twice, someone aboard.
- **The screens:**
  - the colony: Voyage heads the side panel; its plan picks the healthiest that fit aboard first, one left home, and a tap on someone takes them or leaves them. It says who goes and who stays; what the holds take, what the colony keeps and what spoils; the materials that won't keep; the jump; whoever stays with no bed and air; and the flight checks with those aboard. Fly out takes two taps;
  - the chart out there: "System N out" at its head; the colony's panel (its day, its food of the storehouses' room, who is home, the raid's odds or its lander); Fly home in the Here panel with its plan (Fly on once a lander stopped it); and, with a lander down, Defend in the foot and the hint;
  - Continue on the title says where the ship is ("Act 3 · Lamplight, out from Copperhill") and opens there.
- **Validated** (`tools/validate-worlds.js`): the voyage's worlds a system, enough kinds and names for them, and two systems' names at least.
- **Tools:** the test voyage's player flies out once the colony's 60 days are played (`tools/voyage.js`, `--out no` for none; `tools/voyagePlan.js` `voyageCrew`, `homeNow`). It waits at home first while a raid is coming, refits berths and air for all but one, builds a shelter for whoever stays, and plays the systems as act 2's sectors. It flies home at the third system's jump point (`VOYAGE_SYSTEMS`), or sooner once the holds are down to the way home's supplies and two jumps more (`HOME_JUMPS`). Its voyage keeps a tally of its own, so act 2's and the colony's numbers are as they were; the report ends with what it came to. `tools/boarding.js` `fightRaid` arms no one while the ship is away: the spare weapons are aboard it.

**Done when** (ROADMAP.md, M38d), and how each is met:
- **Flying out:** `tests/colonyVoyage.test.js` (11 tests) and `tests/voyageText.test.js` (5); by touch.
- **The stores split:** the same, and by touch.
- **The systems:** `tests/colonyVoyage.test.js`, 7 validator cases in `tests/data.test.js`, and `tests/golden/systems.txt`.
- **On the run in act 3:** `tests/colonyVoyage.test.js` (a station's supplies, a recruit, the last aboard kept, surveys, regroups, the jump point to the next system).
- **A day a jump:** the same, and over 100 test voyages `tests/voyage.test.js` checks the colony's days away come to the jumps, rests and days flying home.
- **A raid while away:** `tests/colonyVoyage.test.js` (the hold, Defend, the swap and back, a raid lost, nobody home); by touch.
- **Fly home:** the same tests, and by touch.
- **Saves:** `tests/colonyVoyage.test.js` (v36, a v35 save migrated, broken voyages refused).
- **The screens:** by touch, and `tests/voyageText.test.js`.
- **The test player:** `tests/voyage.test.js` (a new test over its 100 refitting voyages).
- **Measured over 100 voyages:** below.
- **Every rule tested:** as above.
- **Touch, at the three sizes:** below.

**Measured:** 100 voyages out, seeds 1 to 100, the miner, as `tools/voyage.js` plays by default (refitting, station jobs, managing heat), after the colony's 60 days; medians, then the least and most:

| | |
| --- | --- |
| Flown out, and home | 100 of 100, 100 of 100 |
| Aboard, at home | 2 (2 to 5), 1 (1 to 1) |
| Systems crossed | 3 (0 to 3): all 3 in 52 runs, 2 in 14, 1 in 21, none in 13 |
| Days away | 22 (2 to 31) |
| Jumps | 18 (1 to 21); hungry in 1 run, and flying home hungry in 1 |
| Hostile ships | 0 (0 to 2) a run; they boarded the ship 8 times, fought off once |
| The hunters met | in 1 run, once |
| Heat | 6 (0 to 46) out, 30 (4 to 67) home, 42 (4 to 67) at most |
| Station jobs | 1 (0 to 12) a run, in 80 runs; 164 of 216 done; paid 95 (0 to 1,355) |
| Credits spent on the way | 157 (0 to 935) |
| Parts bought at yards | 0 (0 to 6), in 18 runs; fitted 2 (0 to 11) |
| Signed on | 92, in 58 runs |
| Credits | 49 (0 to 561) out, 61 (0 to 589) home |
| The colony while away | found in 9 runs; 7 raids faced, all 7 lost (in 6 runs), none with nobody home; fed all the while in 100 of 100 |
| Flying out | food spoiled in 2 runs (20 in all); materials lost in 86 (1,884 in all) |

The 13 that crossed no system flew out with 0 to 24 food in the holds: the careful player builds only the farms its crew eats from, so its larder at day 60 is whatever the landing and the trips left. With the holds that low the buffer turns it home before it reaches a station, even with credits to buy.

**The voyage test's rates against main's** (`MAIN` in `tests/voyage.test.js`): unchanged. The voyage out keeps its own tally, and the 12 new names change only the systems' names, not the rolls. So main's 30-voyage report (`tools/voyage.js --runs 30`, run from main) matches this branch's line for line, apart from the new voyage-out line at the end. Every rate is as M38c left it.

**Tests:**
- `node --test`: 1071 tests pass (1054 before M38d). New: `tests/colonyVoyage.test.js` (11), `tests/voyageText.test.js` (5) and the voyage out in `tests/voyage.test.js` (1); and 7 cases in `tests/data.test.js`'s validator test.
- **On purpose:**
  - `tests/golden/systems.txt`: the 12 new names renamed its three systems; nothing else in them moved.
  - **The voyage tests' fitted voyages, the ignoring-heat ones and the other backgrounds' fly no voyage out** (`out: 'no'`), as the fitted ones fly no refits: it changes nothing in their tallies but the time. The refitting voyages fly it, and the new test checks it over their 100.
  - An M25 test read the act's record as the log's last line; with a voyage out it is the second to last.
  - The tests that pinned `SAVE_VERSION` at 35 now pin 36; the v20 colony and settle tests take the colony's worlds and voyage.
- `m38d/verify.mjs` at the three sizes, 37 checks at each, all passing:
  - the colony: Voyage heads the side panel; its plan picks two of three, the healthiest, and says who stays and what the holds take; a tap takes the one at home, another leaves them; Fly out's first tap says what it comes to and flies nowhere, the second flies;
  - the new system's chart: "System 1 out", the colony's panel (day 2, food 19 of 20, Lark at home), Fly home, no Defend; saved at v36 with the stores split;
  - a jump passes a day at home, and the panel says so;
  - a station out there: Buy, Jobs and its board;
  - a lander down at home: the hint, Defend, Fly home held; Defend's two taps open the raid fight with Lark alone; it reloads as it was; won, back on the chart, the ship still out;
  - Fly home's two taps: the colony screen, the crew one again in its order, the stores one again;
  - a quit and reopen out there: Continue says where and opens the chart;
  - every button 48 px or more and reachable, offline after a reload, and no console errors.
- **Every earlier milestone's browser check** passes at the three sizes unless named, each the latest adapted copy (`m38d/regress-a.sh` and `regress-b.sh`). The one exception is M32b's first copy, whose 2 known failures since M36 its fix copy covers, as in M36 to M38c.
  - **Adapted for M38d:** M38c's, M38b's, M35's, M34's, M31's, M30's, M29's, M28's and M27's, which pinned saves at v35 (`verify38d.mjs` beside each). M28's and M27's also took the colony's first list for its places, where Voyage stands now. M32's and M21's read "the" list in the chart's side column, which holds the colony's panel's list too now (hidden with the ship home): they name the Ship panel's. Their first runs stopped at that read, which the chain's summary first hid.
  - **Run again on their own, and passed:** M36's at the open size, M35's at the tab size and M32's new copy at the open size lost their port to the run beside them.

**Found while building, and fixed:**
- **The plan marked lines red by place** (from its fourth on), so a materials line moved the jump into the red; it marks the failing checks it lists, and those alone.
- **The plan didn't say the first jump would go hungry,** or that whoever stays with no bed and air won't rest: it says both now.
- **Fly home sat in the colony's panel,** below the fold on the cover screen: it is in the Here panel.
- **Worlds' labels covered nodes** on the systems' charts: the mark alone shows there, and a tap names it.
- **The test player's voyage left the flight home's heat out of its "at most"** (41, 2 to 65, under a heat at home of up to 67): it counts it now.

**Known issues:**
- **Materials past the storehouses' room are lost at Fly out** (86 of 100 test colonies, 1,884 in all), since most have no storehouse. The plan says so on the first tap, but it may be harsher than it needs to be. Evan's call (§9).
- **A split crew is thin:** with 2 aboard, the ship lost 7 of the 8 boardings it met; with 1 at home, all 7 raids while away were lost (§9).
- **13 of 100 test voyages crossed no system,** their larders near empty (§9).
- **The way in still says "Where the ship came into the sector",** and a voyage's systems are "sectors" in a few words (§9).
- **The flight home's days count as jumps** in the flags; the hunters don't roll on them.
- **Heat doesn't fall at home while the ship is away;** a raid faced while away still sets it to its after-raid level.
- **Settling a second world** waits for M38e: the worlds out there can be surveyed, not settled.

**What Evan should test on the phone:**
- At the colony: Voyage at the top of the side panel. Tap it, see who goes and who stays, and tap someone to swap them. Fly out: the first tap says what the holds take and what the colony keeps.
- On the new chart: "System 1 out" at the top, the colony's panel (day, food, who is home). Jump once and watch the colony's day tick.
- Call at a station out there: buy, take a job, refit.
- Quit and reopen out there: Continue says where the ship is.
- Fly home from anywhere: the first tap says the days and what is eaten; landed, the crew and the stores are together again.
- If the pursuer finds the colony while you're away: the chart warns, the lander holds the ship, and Defend fights it with whoever is home.

**Next session's first task:** M38e More colonies: study a second world settled from a voyage (its own grid, buildings, stores, days and raids), measure, ask Evan, settle its Done when.

## M38c Station jobs (2026-10-18)

**Status:** done, and the ROADMAP.md box is ticked. Every station on the run posts a board of work, fresh at each visit. A job sends a squad to the station's docks or the rocks nearby, pays as act 1's do, and costs heat and wounds. Saves are at v35.

**How it was picked:** Evan asked (2026-10-18) for the jobs from the beginning to be work a crew can get at stations. Measured first (the miner, 30 voyages from launch, medians): launched with 105 credits, 65 from events, 87 spent on supplies and 40 on transponder swaps; heat 35 at launch and 65 at most; the hunters met in 17 of 30. His picks:
- jobs written for the stations, fought at their docks and on the rocks nearby, not act 1's again;
- a fresh board at each visit;
- act 1's pay;
- the cost is heat and wounds, and the station stays safe.

ROADMAP.md has the Done when in full, and what was built where it differs.

**What shipped:**
- **The content** (data only):
  - `data/docks.json` (new): a board of 3; the stations' ten clients, two of each side and two of nobody's; and their four sites, the cargo ring and the fuel dock, the Tumble and a worked-out claim.
  - `data/sites.json`: four maps, 14 × 8, with the ways in, spawns and marks each mission held there needs. The Cargo ring and the Fuel dock name the dock's look, the Asteroid field and the Mined-out claim the rock's.
  - `data/contracts.json`: 15 station jobs using all eight missions, paying 40 to 140 credits, each with drops and a pitch that can name its station.
- **The board** (`src/sim/stationJobs.js`, new): up to 3 of the station's side's clients' jobs, or at one of nobody's the clients of no side. Rolled as act 1's are (`rollOffers`, now shared with act 1's board in the same order), from a seed of the campaign, the sector, the station and the jumps made: fresh at each visit, the same however often it is opened, and the campaign's RNG never moves for it. A job taken stays off it till the ship jumps (`run.jobbed`).
- **Taking one** (`takeStationJob`): while no event or approach holds the ship, a squad of up to 3 goes, the healthiest by default; the rest stay aboard. The fight is set up as act 1's (`beginJob`, shared), with no hunters. At a station of the pursuer's side it is a trade, so they log the ship once a visit.
- **After it** (`endJob`): done, act 1's pay with what the client's side adds, and the part; done or lost, act 1's heat and standing. Wounds stay, as after a boarding; fights count for ranks and gear can be won. The flags count `stationJobsDone` and `stationJobsFailed`, apart from act 1's. Act 1's board, shop and quests are untouched.
- **Saves at v35:** the run keeps the jobs taken at the station this visit; a v34 run takes none (`run.jobbed = []`). `isJob` takes a station job's name.
- **The screens:**
  - the chart's Here panel at a station has Jobs · 3 (one tap opens the board; it spends nothing), or says no work is left this visit;
  - the board in station mode: the station and its side on top, the jobs as act 1's board shows them, Squad with the squad card (as a boarding's), the hint that wounds stay on the run and, at the pursuer's side's, that they log the ship; Take the job (two taps) and Chart back;
  - the fight in the dock's look (grey deck plating) or the rock's (brown stone under the stars), new skins in the palette;
  - Continue at the fight's end goes back to the chart.
- **Validated** (`tools/validate-campaign.js`): the stations' clients and sites are checked as a district's; a job's sites and clients are all one district's or all the stations'; `{station}` only in a station job's pitch; no station job is a quest's, done once, or counted with hunters; each side's stations and nobody's have at least twice a board's jobs.
- **Tools:**
  - `node tools/jobs.js --stations` lists them: whose stations post each, the mission, the sites, the enemies and the pay. With `--odds 200`, how often the start crews win each and the hit points they lose.
  - The test voyage's player takes them (`tools/voyagePlan.js` stationJobPick; `tools/voyage.js`, `--jobs no` for none). Of the board, it takes the job worth most, if any is worth something, with a full squad of those healed to 75%. A job is worth its pay, part and standing at the measured odds (`tools/run.js` jobOdds, beside act 1's), less its wounds at 2 credits a hit point, and less its heat and docking heat priced as an event's. Managing heat, it takes one only where the heat and the next jump's keep the ship under 50. It works before the refit, so a part paid goes on at once.
  - `tools/boarding.js` fightStationJob fights one out as act 1's jobs are played.

**Done when** (ROADMAP.md, M38c), and how each is met:
- **A board at every station:** `tests/stationJobs.test.js` (11 tests).
- **Taking one:** the same tests, and by touch.
- **After it:** the same tests, and by touch.
- **The content, as data:** `tests/data.test.js` (9 new cases for the validator) and `tests/stationJobs.test.js`.
- **The fight's look:** by touch (below), and `tests/golden/sites.txt` holds the four maps.
- **Saves:** `tests/stationJobs.test.js` (v35, and a v34 run migrated).
- **The screens:** by touch.
- **The test player:** `tests/voyagePlan.test.js` (2 new) and `tests/voyage.test.js` (its job steps checked, and a new test). `tools/jobs.js --stations`: `tests/stationJobs.test.js`.
- **Measured over 100 voyages:** below.
- **Every rule tested:** as above.
- **Touch, at the three sizes:** below.

**Measured:**
- **Each station job,** 200 fights from the three starts' crews, heat 0, no twist (`node tools/jobs.js --stations --odds 200`):

  | Job | Mission | Won | Hit points lost (of 26) |
  | --- | --- | --- | --- |
  | Safe passage | escort | 89% | 6 |
  | Hold the berth | hold the line | 89% | 12 |
  | The courier | rescue | 85% | 9 |
  | Repo men | hold the line | 77% | 15 |
  | The family's books | work the terminal | 73% | 16 |
  | Pay by the litre | work the terminal | 64% | 17 |
  | The steward | rescue | 64% | 10 |
  | Claim rights | clear out | 62% | 17 |
  | Undeclared | grab and go | 59% | 18 |
  | Fleet stores | walk it out | 57% | 18 |
  | Back dues | walk it out | 57% | 18 |
  | Cut the rig | sabotage | 56% | 18 |
  | Salvage rights | grab and go | 56% | 18 |
  | Pirates at the pumps | clear out | 48% | 19 |
  | Bad paper | clear out | 46% | 19 |

  Four won 7 to 40% at first and were eased: Pay by the litre (7%: the Pike crew now, two turns at the terminal, and the cargo ring as a second site), Pirates at the pumps (22%: the lighter pirate crew), Cut the rig (40%: one target) and Fleet stores (40%: one crate).
- **100 voyages from launch, with station jobs and without** (seeds 1 to 100, the miner, refitting and managing heat, as `tools/voyage.js` plays by default; medians unless said):

  | | Without | With |
  | --- | --- | --- |
  | Station jobs taken | — | 276 in 75 runs, 231 done; 2 a run |
  | What they paid, heat, hit points | — | 160 credits, +18 heat, 23 hit points a run |
  | Credits at the landing | 22 | 49 |
  | The most credits held | 129 | 229 |
  | Heat at most | 59 | 53 |
  | Heat at the landing | 52 | 46 |
  | Transponder swaps | 1 | 3 |
  | The hunters met crossing the sectors | 35 runs | 22 runs |
  | The hunters met, all told | 96 | 66 |
  | Crew lost | none | none |
  | Hit points at the landing | 19 | 23 |
  | Patched at stations | 0 | 20 hit points for 38 credits |
  | Parts bought at shipyards | 45, in 20 runs | 85, in 41 runs |
  | Runs with a recruit | 1 | 18 |

  No crew is lost either way: no campaign fight kills (bled-out crew come back at 1 hit point).
- **The voyage test's rates against main's** (`MAIN` in `tests/voyage.test.js`, 100 seeds; the test holds each within 15, or 5 for the rare ones):

  | Rate | Main | Without jobs | With jobs |
  | --- | --- | --- | --- |
  | Careful, fed all the way | 82 | 71 | 78 |
  | Fed with a cargo hold | 81 | 84 | 87 |
  | A recruit, with a cargo hold | 44 | 52 | 84 |
  | Fed with a med bay | 79 | 72 | 90 |
  | Fed with surgery | 81 | 74 | 89 |
  | Fed with bunks | 75 | 82 | 86 |
  | Fed with the large hold | 98 | 95 | 99 |
  | Refitting, fed | 73 | 69 | 77 |
  | Runs with a refit | 59 | 64 | 80 |
  | The hunters met crossing, managing heat | 33 | 35 | 22 |
  | The hunters met, ignoring heat | 100 | 100 | 100 |
  | Two worlds or more surveyed | 68 | 59 | 76 |
  | Hungry in the system | 14 | 19 | 12 |
  | A surveyed world settled | 81 | 72 | 81 |
  | Short of air | 0 | 0 | 1 |
  | Everyone housed | 41 | 42 | 62 |
  | Never scanned | 0 | 0 | 0 |
  | The miner: met the hunters, lost a raid | 42, 29 | 44, 20 | 32, 15 |
  | The deserter: fed, met, lost a raid | 80, 45, 20 | 84, 40, 13 | 87, 37, 1 |
  | The smuggler: fed, met, lost a raid | 89, 19, 18 | 91, 24, 11 | 94, 15, 5 |

  Every rate stays inside its margin, and every one moves the player's way with station jobs.

**Tests:**
- `node --test`: 1054 tests pass (1040 before). New: `tests/stationJobs.test.js` (11), 9 validator cases in `tests/data.test.js`, 2 in `tests/voyagePlan.test.js`, 1 in `tests/voyage.test.js`; the voyage's job steps are checked as every other step is.
- **On purpose:**
  - `tests/golden/sites.txt` gains the four new maps; the earlier maps are unchanged.
  - **The voyage tests' fitted voyages fly without station jobs,** as they fly without refits, so each still compares one part's difference; the refitting voyages, the ignoring-heat ones and the other backgrounds' play as `tools/voyage.js` does, jobs and all. With jobs a healer's Law 1 check flipped: its crew, fit more often, works more and patches more (1,147 hit points with a med bay against 958 without on seeds 1 to 30; over `tests/voyageSurgery.test.js`'s 300, 12,475 with surgery against 12,399 with a med bay). Without jobs those voyages fly as main's do.
  - 11 tests that pinned `SAVE_VERSION` at 34 now pin 35.
- `m38c/verify.mjs` at the three sizes, 38 checks at each, all passing:
  - at a station on the chart, Jobs in the Here panel with the board's count; one tap opens the board;
  - the board: the station's name and side, its jobs (the station named in a pitch that names it), Chart back, the squad that would go, and the hint that wounds stay;
  - the squad: four aboard, Squad opens the card, a tap leaves one aboard, Done shuts it, and the hint and the label say who goes;
  - a dock's job taken: the fight on its dock map in steel deck plating, with the squad picked; won with the dev menu's Win the fight, Continue goes back to the chart, paid, heat up, and the board one job shorter;
  - a rock's job: its rock map, bare rock, darker and browner than the docks';
  - at a station of the pursuer's side, the warning that they log the ship, and taking a job does;
  - a station job's fight reloads as it was;
  - every button 48 px or more and reachable, saves at v35, offline after a reload, and no console errors.
- **Every earlier milestone's browser check** passes at the three sizes unless named, each the latest adapted copy (`m38c/regress-a.sh` and `regress-b.sh`). The one exception is M32b's first copy, whose 2 known failures since M36 its fix copy covers, as in M36 to M38b.
  - **Adapted for M38c:** M38b's, M35's, M34's, M31's, M30's, M29's, M28's and M27's, which pinned saves at v34 (`verify38c.mjs` beside each). M34's pinned it twice; the second was found by its first run.
  - **Run again on their own, and passed:** M23f's at the open size and M23d's at the tab size lost their port to the run beside them; M23's and M21's at the open size ran past their time limit beside it.

**Found while building, and fixed:**
- **A job's id clashed with act 1's** ("strikefund"): the stations' is Back dues (`dues`) now.
- **The ring map had office tiles no one could reach:** its terminal moved.
- **The squad card collapsed to 22 px:** the board's list and detail moved into a new grid row with it. They are placed by column and row now.
- **Four jobs won 7 to 40% at first:** eased, as above.

**Known issues:**
- **Station jobs make act 2 easier for the careful player, not harder** (Evan's call): a job's pay buys transponder swaps (40 credits for 30 heat), which shed more than its 8 or 15 heat adds. With them the hunters came in 22 runs of 100 against 35 without, and raids lost at the colony fell (the deserter's from 13 to 1). The wounds cost about 2 credits a hit point to patch. Raising the jobs' heat, or the swap's price, would make the trade bite.
- **The test player's odds and wounds are a full-health start crew's,** with act 1's factor for a twist. It doesn't weigh the squad going: hurt, ranked or better armed, a job weighs the same.
- **A board is rolled from the jumps made,** so a day's rest at the station keeps the visit's board; only a jump brings a fresh one.
- **The ignoring-heat player takes about 5 jobs a run** (509 in 100), heat costing it nothing.
- **Nothing on the chart says how many jobs a station posts** until the ship is there.

**What Evan should test on the phone:**
- At a station on the chart: Jobs · 3 in the Here panel; one tap opens the board, with the station's name and side on top.
- Squad: pick who goes, and see the hint say who stays aboard.
- Take a dock's job (the cargo ring or the fuel dock): grey deck plating. Take a rock's (the Tumble or the claim): brown rock under the stars.
- After the fight, Continue: back at the chart, paid, heat up, the job gone from the board, the wounds still there.
- At a station of your pursuer's side, the board warns they'll log the ship; take a job and see the docking heat.
- Jump away and come back: a fresh board.
- Quit mid-fight and reopen: the fight picks up as it was.

**Next session's first task:** M38d The run goes on: study how the ship leaves the colony and jumps on past the charts, measure, ask Evan, settle its Done when.

## M38b Space fights from outside (2026-10-18)

**Status:** done, and the ROADMAP.md box is ticked. The approach screen shows both ships whole from outside, as the hangar shows a ship, instead of as their boarding maps. Her hull shows what the approach has done to her. A Fire order marks its targets on her hull, and a round given plays out: shots, hits, shields, wrecks, flights and boardings. The inside is for a boarding's fight. Saves stay at v34.

**How it was picked:** Evan asked (2026-10-18) to see the ships whole from outside when fighting in space, with the inside kept for a boarding. With it he asked for station jobs and for act 3 to keep the travel, with more colonies and their citizens. His picks:
- the order: this first, then station jobs (M38c), then act 3's travel and colonies (M38d to M38f);
- act 3: the run goes on past the first colony;
- citizens: grown, the rescued, and crew left behind;
- a colony: it runs itself while the ship is away.

ROADMAP.md has the Done when in full, and what was built where it differs. M38c to M38f are drafts there, each to be settled with Evan when its session starts.

**What shipped:**
- **The two ships** (`src/render/approachView.js`, new): each drawn by `src/render/exterior.js` as the hangar draws a ship, with its paint, trim, styling and makers' fittings and its nozzles lit.
  - The player's ship is on the left, nose right; the other is seen from the far side, so the two face each other. Deep space is behind them.
  - Deep space is painted once a size. Each ship's layer covers only her and a cell round her; her hull is painted once, and her marks are drawn over a copy of it when they change. So a frame copies three pictures and draws the shots over them, and a hit paints only her marks.
- **The marks on a hull** (`src/render/hullMarks.js`, new, pure). They are painted over the finished hull in their own pass (`paintOver`, new in `src/render/painter.js`), so no fitting hides them.
  - A part hit but not wrecked shows black burns ringed with heat.
  - A wrecked part is charred all over, with its hazard on top: flames for fire; a hole as dark as space in torn plating, venting, for vacuum; broken plating under smoke for rubble.
  - Where each burn or shard lies comes from a roll seeded by the part, the same every time.
  - A Fire order's first tap brackets each part it aims at in the target's red over a dark edge, so it shows on any paint. The first it would hit has the thicker brackets and the stronger tint.
- **A round played out** (`src/render/approachPlayback.js`, new, pure). The round's events (`approach.last`) become beats in time; `frameAt` says what shows at any moment of them.
  - Each gun's shot flies from its own barrel, in the order the guns fire. A barrel now carries its gun's uid (`src/render/hull.js`).
  - A hit flies to the part it struck, and a miss goes wide, above or below in turn. A shot her shields stop flies to her nose and shimmers round her.
  - Each landed shot adds its damage to her hull. A part wrecked bursts into its hazard, and a last reactor that blows bursts the ship.
  - A flight that gets away takes the other ship off the screen, so the player's stays in view. A failed flight or closing lurches.
  - A boarding closes the gap between the two noses to 26 px and grapples them, nose to nose. A ship boarded while disabled, with no closing in the round, is closed on last.
- **The screen** (`src/ui/campaign/approach.js`):
  - While a round plays, the head reads "Round n" and the column's lines come one by one as each event ends. How it ended, Carry on, and Board her or Leave her wait for the end.
  - A tap on either ship or on an order skips to the end.
  - With reduced motion, the round shows its end at once.
  - The screen draws only while a round plays or something changes.
  - The ships' halves take taps now (`.apr-ship`): the UI layer lets touches through to the canvas, so before the fix a tap on a ship reached nothing.
- **Sounds:** each shot sounds as it fires and each hit as it lands, a miss for the crew's; a flight that gets away jumps, and a ship blowing up blasts (`roundCues`). They moved from `gameSounds` to the screen. With reduced motion, `roundSounds` (`src/ui/sounds.js`) plays them all at once, as M35 did.
- **Palette:** `breach`, `burn`, `smoke`, `shield` and `enemyTracer`.

**Done when** (ROADMAP.md, M38b, in full there), and how each is met:
- **Both ships from outside, the inside only in a boarding's fight:** by touch, below.
- **Damage on the hull, and a repaired part clean:** `tests/approachScene.test.js`: each mark on its part's own roof, the same every time, and an untouched part showing nothing. By touch, a burn and each hazard change her picture where the part is and nowhere else.
- **The target:** `tests/approachScene.test.js`, and by touch: Engines brackets her three engines, Guns her two guns instead.
- **A round played out:** `tests/approachScene.test.js`:
  - the beats from real rounds, each shot from its gun to the part it struck or wide;
  - the marks landing with their shots, and ending as the approach saved them;
  - the lines as each event ends;
  - the shimmer, the burst, the flight, the closing and grapple, the blow-up, and where the ships rest after;
  - the sounds, each once however the frames fall.

  By touch: shots between the ships, the lines one by one, the round's sounds in order, a skip, and reduced motion.
- **A boarding:** by touch: the two close, the grapple, her half marked, and Board her begins the fight inside her. Leave her and Fight them off: M22's check, below.
- **Frames:** under Measured.
- **Every rule tested:** `tests/approachScene.test.js` (7 tests) and `tests/hull.test.js` (each barrel's gun).
- **Touch, at the three sizes:** `m38b/verify.mjs`, 31 checks at each, all passing:
  - the chart's jump to the cutter, both ships drawn across their halves (the start ship in slate on the left, the cutter in rust on the right), no fight board;
  - Fire marks: a first tap on Engines changes her picture among her engines only, Guns among her guns; nothing given; left alone, it stands down and the marks go;
  - a round played: the order saved at once; "Round 1" while it plays; no outcome yet; the lines one by one; shot-colored light between the ships; then "Round 2 of 3" with every line; its sounds as the round's cues say, in order;
  - a round skipped by a tap on her: ended at once, every line shown, no more of its sounds;
  - reduced motion: the end at once, its sounds all at once;
  - her engine wrecked by fire, vacuum and rubble, and hit but not wrecked: each changes her picture within about a cell of the engine;
  - a boarding: the round played, the space between their noses closed to about 29 px, the grapple drawn, her half marked, Board her (two taps) into the fight;
  - every button 48 px or more and reachable, saves at v34, offline after a reload, and no console errors.

**Measured** (scratchpad `m38b/budget.mjs` and `m38b/fps.mjs`, headless Chromium on this machine, 2.625 device pixels to the CSS pixel):
- **What a frame of the picture costs,** each finished with a one-pixel read so the time is the drawing's (as M34 measured). In ms, means first, 95th percentile in brackets:

  | Size | At rest | A shot in flight | A hit landing (her marks drawn again) |
  | --- | --- | --- | --- |
  | 905 × 370 | 3.8 (4.5) | 3.7 (4.8) | 6.0 (7.9) |
  | 821 × 283 | 2.0 (3.0) | 1.9 (2.1) | 3.2 (5.4) |
  | 960 × 825 | 5.4 (7.0) | 4.9 (6.5) | 6.8 (9.0) |

  The first build drew deep space every frame and laid each ship over her whole half, painting her whole hull again on every hit. It cost 11 to 12 ms a frame at 905 × 370 and about 25 at 960 × 825, and a hit landing 17 and 36 (measured with the regression chain running beside it). Deep space alone was 7 and 16.
- **The frame rate while rounds play,** read off the `?dev=1` overlay every half second as M23d measured, five passes of three rounds:
  - 905 × 370: 60 fps in every window (37 of them), the longest gap 17 ms.
  - 960 × 825: 60 fps in the middle window and 56 in the lowest (34 windows), the longest gap 50 ms. Over 15 rounds, 2 frames while a round played took 36 and 42 ms; every other was under 25 ms.
  - At rest the screen draws nothing: 0.01 ms a frame.

**Tests:**
- `node --test`: 1040 tests pass (1033 before). New: `tests/approachScene.test.js` (7). `tests/hull.test.js` checks each barrel carries its gun's uid. `tests/sound.test.js` checks a round's sounds through `roundSounds`, and that the store's sounds no longer play them.
- `m38b/verify.mjs` at the three sizes, as above; again on the final drawing code, all 31 passing at each.
- **Every earlier milestone's browser check** passes at the three sizes unless named, each the latest adapted copy (`m38b/regress-a.sh` and `regress-b.sh`; `rest-a.sh` and `rest-b.sh` ran what was left after the background time limit stopped the first runs). The one exception is M32b's first copy, whose 2 known failures since M36 its fix copy covers, as in M36 to M38.
  - **Adapted for M38b:** M21's and M24's. They read the column's lines, or waited for Carry on, straight after an order; their taps now wait for a round playing out to end (`m38b/played.mjs`).
  - **M31's at the open size** lost its port to the run beside it, and passed run again.
  - M21's, M22's, M23's and M24's ran before the frame-cost change and passed again after it, at the cover size.

**Found while verifying, and fixed:**
- **A tap on a ship reached nothing,** so it couldn't skip a round: the UI layer lets touches through to the canvas but for its controls. The ships' halves take taps now. Found by the touch check.
- **The first marks were too faint on the phone's scale:** they lay on the roof under each part's fittings, and the targets were red on the cutter's rust. The marks are painted over the hull now, and the targets bracketed over a dark edge.
- **The first boarding pose ran the noses into each other:** each ship came in a fifth of its half. They now close the gap between their drawn noses to 26 px at any size.
- **The first build's frames were over the budget,** as under Measured.

**Known issues:**
- **The frame rates are headless Chromium's,** on this machine's CPU. No phone has measured a played round yet.
- **A patrol's or a trap's opening volley isn't played out:** it lands before the screen opens and shows as scars on the hull and its lines in the column.
- **A flight that gets away moves the other ship, whoever fled.** When the player runs, it is the cutter that leaves the screen.
- **A ship that blows up** is a flash and a ring, and she is gone a third of the way through; there are no pieces.
- **The shimmer is an ellipse round her frame's box,** a little wider than her hull.
- **On a slate hull the burns read as rust-brown patches** more than black scorch. The heat ring is what shows on a dark hull.
- **A skip drops the rest of the round's sounds.**

**What Evan should test on the phone:**
- Meet a ship from the chart: both ships whole, facing each other, each in its own paint.
- Tap Fire at Engines once: her engines bracketed in red, the first brightest. Tap Guns: her guns instead.
- Give the order: the shots leave your gun, the lines come as they land, a hit flashes. Watch a wrecked part burn, vent or smoke.
- Tap a ship while a round plays: it skips to the end.
- Settings, Motion reduced: a round ends at once.
- The round's sounds with the shots, on the phone's speaker.
- A boarding: the two close and grapple, her half outlined. Board her goes inside.
- The frame rate while a round plays (`?dev=1`), folded and open, and a fold or unfold mid-round.

**Next session's first task:** M38c Station jobs: study where jobs could come from at a station, measure, ask Evan, settle its Done when.

## M38 Missions and jobs (2026-10-18)

**Status:** done, and the ROADMAP.md box is ticked.
- **Five new missions,** eight in all: walk it out (extract), escort, hold the line (defend), sabotage and rescue.
- **The person brought out,** an escort's client or a rescue's captive: the player moves them, and they carry no gun.
- **The enemies play to the objective** in every mission but a clear-out. They guard what the job is after, push for the way in, shoot a carrier or the person first, and pull charges.
- **15 new jobs,** one of each new mission in each district: 44 in all. Saves are v34.

**How it was picked:** there were 3 mission types against §5's 8, and 29 jobs against 40 or more. Measured over 200 seeds a job, clear-outs won 46%, grabs 77% and hacks 77%. The enemies ignored the objective, so a grab or a hack was a race.

Evan's picks (2026-10-18): the draft's five missions; the person brought out moved by the player, unarmed; the enemies playing to the objective in every mission, grab and hack too, with act 1 measured and tuned; one new job for each new mission in each district. ROADMAP.md has the Done when in full, and what was built where it differs.

**What shipped:**
- **The content:**
  - `data/contracts.json`: the five missions with their names and briefs (sabotage is loud), and the 15 jobs:
    - the tailings: Strike fund, The back door, Yard watch, The pumps, Late on the rent;
    - the strand: The rum ration, Before the auditors, Dock strike, The press tender, The lodger;
    - the narrows: The ledgers, A patient across the water, Closing time, The still, Collateral.
  - `data/contracts.json` `people`: the client (6 hit points, 5 moves) and the captive (5 and 4), each with a look.
  - `data/sites.json`: each of the four maps gains a far gate (`x`, 2 or 3 tiles, across from the way in) and two captive tiles (`v`, deep in).
  - `data/balance.json`: `blastDamage` 4 and `spareCharges` 1. `data/sounds.json`: `blast`.
- **The rules** (`src/sim/objectives.js`, with `battle.js`):
  - **Walk it out:**
    - Grab picks up a crate (one action), and a crate in hand means one move a turn, no dash.
    - A carrier who goes down keeps it, and anyone of the crew beside them can take it with Grab.
    - A crate is out when its carrier steps onto a way-in tile. The job is done when every crate is out.
  - **Escort:** the client comes in with the crew, and the job is done when they stand on the far gate.
  - **Hold the line:** lost when an enemy steps onto a way-in tile. Won when the last round ends, or when no enemy is standing.
  - **Sabotage:**
    - Plant sets a charge beside a target (one action). It blows as the crew's next turn starts, for `blastDamage` to everyone beside it, on both sides.
    - An enemy beside a charge can pull it (one action).
    - The crew has one charge for each target, and `spareCharges` more. A charge pulled is gone.
    - The job is done when every target has blown.
  - **Rescue:**
    - The captive is held on a captive tile and can't be shot.
    - Free, from beside them (one action), cuts them loose, and they move at once.
    - The job is done when they stand on a way-in tile.
  - **The person brought out** is on the crew's side, with no gun: no shot, no overwatch. Down, they bleed out as crew do and can be stabilized. Bled out, the job is lost. They aren't crew: no wounds after, no fights counted, and the crew still wins or loses by its own.
  - **Twists:** the rush job's deadline comes with every new mission but a defense.
- **The AI** (`src/sim/objectiveAi.js`, `ai.js`):
  - **Guards:** with no shot worth taking, a guard keeps within 3 steps (`GUARD_RANGE`) of what it guards. That is the crates, the terminal, the far gate, the targets or the captive.
  - **The push:** on a defense, every plan counts the steps left to the way in.
  - **Prizes:** a shot at a carrier or at the person brought out counts 1.6 times its harm.
  - **Charges:** an enemy beside a charge pulls it, and every plan keeps clear of one about to blow.
  - Fights with no objective (boardings, raids, clear-outs) play as before, and the golden battle log is unchanged.
- **The test players** (`src/sim/jobAi.js`):
  - Carriers walk out.
  - The client and the captive move cover to cover toward their way. A hit point they might lose weighs as 3 steps (`WARD_FEAR`).
  - Charges are planted, and the planter steps clear.
  - The way in is held from cover.
  - `tools/run.js` weighs each job by the test crew's odds on it (`JOB_ODDS`), measured anew for all 44.
- **The screens:**
  - **The board:** each mission's brief, its numbers filled in.
  - **The fight:**
    - The objective sits under the round: crates out, the client's way, the rounds held, the charges blown and left, the captive held or freed.
    - Tags over the board: CRATE, WAY OUT n/m, FAR GATE, TARGET, CHARGE SET, BLOWN, HOLD r/R.
    - The way out, the far gate and the way in held are outlined on the deck, the way in red.
  - **Orders:** Grab, Free and Plant, shown when in reach.
  - **The person brought out** is in the crew bar with a face: "2 AP · no gun", or "Held". Their card says what they can do.
  - **A carrier:** CARRYING over them, "Crate · …" in the crew bar, and a line on the card.
  - **A blast:** drawn on the board with the damage over each unit hit, with a sound of its own.
  - **The end panel** says why: the line held, they broke through, the client or the captive was lost.
- **Saves:** `SAVE_VERSION` 34. A fight can hold the new objectives, the person brought out, a crate in hand and the charges set. A save from before reads unchanged.
- **The validator:** each mission's numbers (crates 1 to 3, targets 1 to 3, rounds 3 to 10), a rescue's captive's name, the people and their numbers, and every map's far gate and captive tiles. Each can be walked to from the way in.

**Calls I made, each easy to change:**
- **One crate on each extract and one target on each sabotage** (the still has two). Two crates won 29 to 37% of the time, and the strongest encounters 4 to 7%. The sabotages and rescues got lighter encounters than first drafted.
- **Charges run out:** one for each target and one more. With charges to spare, a guard beside a target pulled every one set, and one fight ran 60 rounds with no winner.
- **A freed captive moves at once,** in the turn they are freed.
- **Closing time holds 8 rounds,** the other two defenses 6. At 6 it won 92%, over the 90% top; at 8, 85%.
- **The blast sound sits at 200 Hz,** since the phone's speaker loses the low end: at 90 Hz it measured −35.8 dB, against −14 now.
- **The launch tests' campaign is pinned.** The board's shuffle takes a roll for each job, so 15 more jobs moved every roll after it. `tests/launchKit.js` holds main's RNG after the board (`LAUNCH_RNG`), so the campaign the launch, run and colony tests start from (`readyToLaunch`) rolls the sectors and worlds it did. The voyage tests play act 1 through, so their campaigns move, and their rates are held to `MAIN` (below).
- **Surgery's Law 1 check flies 300 seeds** (`tests/voyageSurgery.test.js`, its own file so it runs alongside the rest). On seeds 1 to 100 the new act 1 left surgery patching 132 hit points against a med bay's 122. Four runs patched 6 to 12 with surgery and none with a med bay. On seeds 101 to 300 it was 139 against 193, and over all 300, 271 against 315 (main: 192 against 328). M33b widened this same check from 30 seeds to 100. **Evan's call:** keep it at 300, or find the four runs another way.

**Measured:**

Each new job from its background's start crew at heat 0 with no twist, 200 seeds each, the test crew against the AI. Every one wins 40% to 90% of the time:

| Start | Job | Mission | Won | By its objective | Rounds | Crew hit points lost (of 26) |
| --- | --- | --- | --- | --- | --- | --- |
| Miner | Strike fund | extract | 57% | 46% | 5.7 | 19.8 |
| | The back door | escort | 69% | 66% | 3.7 | 10.3 |
| | Yard watch | defend | 82% | 45% | 5.6 | 11.8 |
| | The pumps | sabotage | 64% | 49% | 5.0 | 18.8 |
| | Late on the rent | rescue | 46% | 26% | 5.5 | 20.5 |
| Deserter | The rum ration | extract | 66% | 65% | 5.5 | 18.5 |
| | Before the auditors | escort | 82% | 82% | 2.7 | 7.5 |
| | Dock strike | defend | 45% | 41% | 5.3 | 19.7 |
| | The press tender | sabotage | 57% | 33% | 6.5 | 19.9 |
| | The lodger | rescue | 60% | 45% | 6.3 | 18.1 |
| Smuggler | The ledgers | extract | 68% | 61% | 6.5 | 18.4 |
| | A patient across the water | escort | 81% | 79% | 2.8 | 7.2 |
| | Closing time | defend | 85% | 27% | 6.6 | 10.8 |
| | The still | sabotage | 57% | 10% | 8.1 | 20.1 |
| | Collateral | rescue | 74% | 39% | 5.9 | 15.3 |

"By its objective" counts the wins that came from the objective; the rest were won with every enemy down.

By mission, board jobs only, main beside M38:

| Mission | Jobs | Won, main | M38 | Rounds, main | M38 | Hit points lost, main | M38 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Clear out | 10 | 46% | 46% | 7.5 | 7.5 | 21.0 | 21.0 |
| Grab | 11 | 77% | 75% | 5.1 | 4.9 | 13.5 | 13.5 |
| Hack | 5 | 77% | 73% | 5.4 | 5.3 | 16.7 | 17.3 |
| Walk it out | 3 | | 64% | | 5.9 | | 18.9 |
| Escort | 3 | | 77% | | 3.1 | | 8.3 |
| Hold the line | 3 | | 70% | | 5.8 | | 14.1 |
| Sabotage | 3 | | 59% | | 6.5 | | 19.6 |
| Rescue | 3 | | 60% | | 5.9 | | 18.0 |

- **The clear-outs measure exactly as main's** in every column, with the same count of each way their 200 fights ended, as a fight with no objective plays as before.
- **The guards moved single grabs and hacks** by up to 17 points either way: Paper trail 86% to 69%, Seized 86% to 74%, Redistribution 65% to 81%.

Act 1, `tools/run.js --runs 100` from each start, main beside M38. Every median is within 1 job of main's:

| Start | Jobs to launch, main | M38 | Jobs done, main | M38 | Minutes (quick), main | M38 |
| --- | --- | --- | --- | --- | --- | --- |
| Miner | 6 (4 to 10) | 6 (4 to 16) | 79% | 80% | 25 (15 to 42) | 27 (13 to 70) |
| Deserter | 6 (3 to 18) | 6 (3 to 29) | 70% | 73% | 26 (11 to 88) | 23 (9 to 137) |
| Smuggler | 6 (4 to 28) | 7 (3 to 19) | 81% | 78% | 29 (14 to 125) | 31 (10 to 86) |

Credits at launch, summed over the 100 runs from each start: the miner's 14,390 against main's 10,005 (up 44%), the deserter's 22,610 against 24,930 (down 9%), the smuggler's 16,230 against 18,340 (down 12%). At half the new jobs' pay the miner's were still up 29%, and the other two fell 30%. The old jobs' odds, measured again under the guards, move it too, so the pay stays as drafted, for M40.

The voyage tests' rates over 100 voyages from each start, main today beside M38. Every rate is within its margin of `MAIN`:

| Rate, in 100 voyages | `MAIN` | Bar | Main today | M38 |
| --- | --- | --- | --- | --- |
| Miner refitting: fed all the way | 73 | 58 or more | 69 | 69 |
| met the hunters in the sectors | 33 | 48 or fewer | 35 | 35 |
| met the hunters at all | 42 | 57 or fewer | 57 | 44 |
| lost a raid at the colony | 29 | 44 or fewer | 24 | 20 |
| hungry in the system | 14 | 29 or fewer | 12 | 19 |
| two worlds or more surveyed | 68 | 53 or more | 60 | 59 |
| settled a surveyed world | 81 | 66 or more | 73 | 72 |
| everyone housed at the colony | 41 | 26 or more | 33 | 42 |
| short of air at the colony | 0 | 5 or fewer | 1 | 0 |
| a refit on the way | 59 | 44 or more | 50 | 64 |
| Miner ignoring heat: met the hunters | 100 | 85 or more | 100 | 100 |
| Miner, no refits: fed | 82 | 67 or more | 67 | 71 |
| never scanned | 0 | 5 or fewer | 0 | 0 |
| fed with a med bay | 79 | 64 or more | 69 | 72 |
| fed with surgery | 81 | 66 or more | 70 | 74 |
| signed a recruit (cargo hold) | 44 | 29 or more | 39 | 52 |
| fed with a cargo hold | 81 | 66 or more | 83 | 84 |
| fed with bunks | 75 | 60 or more | 78 | 82 |
| fed with the large hold | 98 | 83 or more | 95 | 95 |
| Deserter: fed | 80 | 65 or more | 74 | 84 |
| met the hunters | 45 | 60 or fewer | 41 | 40 |
| lost a raid | 20 | 35 or fewer | 12 | 13 |
| Smuggler: fed | 89 | 74 or more | 89 | 91 |
| met the hunters | 19 | 34 or fewer | 24 | 24 |
| lost a raid | 18 | 33 or fewer | 11 | 11 |

- **The miner's rates moved most,** each within its bar: the hunters met at all 57 to 44, a refit on the way 50 to 64, a recruit signed 39 to 52, everyone housed 33 to 42. Hungry in the system went the other way, 12 to 19. My guess, not measured: the miner's 44% more credits at launch buy the refits and the recruits, and more mouths go hungry in the system.
- **The miner's refitting player bought at a yard in 20 runs** (9 in M37b's measurement), and fitted 0.99 parts a run against main's 0.87.
- **A careful voyage:** 10.1 events against main's 9.7, and 2.7 approaches against 2.9.

- **`node tools/sim.js`** (run because `data/balance.json` gained `blastDamage` and `spareCharges`; no number a boarding uses changed): identical to main's but for the time taken.

**Done when** (ROADMAP.md, M38, in full there), and how each is met:
- **Eight mission types, each with its name and brief:** `data/contracts.json`, and the validator.
- **Each new mission's rules:** `tests/missions.test.js`. That covers the crate carried one move a turn, kept when its carrier goes down and taken from beside, and the client to the far gate. It also covers the line broken or held, the charge blown or pulled, the charges running out, and the captive held, freed and walked out.
- **The person brought out:** on the crew's side with no gun, held and unshootable, bleeding out, not counted as crew. `tests/missions.test.js`.
- **The enemies play to the objective:** `tests/objectiveAi.test.js`, with the guard, the push, the prizes, the pull and the blast kept clear of. The golden battle log is unchanged.
- **The sites:** the far gate and captive tiles in all four maps, each walked to. The golden sites change, on purpose: `tests/golden/sites.txt` rewritten with `node tools/jobs.js --golden`.
- **Twists:** the validator, and `tests/contracts.test.js`.
- **15 new jobs, 44 in all:** `data/contracts.json`. `tests/contracts.test.js` sets each one's fight up from its site.
- **On screen:** `tests/missionText.test.js` (8), and the touch check below.
- **The test players play each mission:** `tests/contracts.test.js` plays 150 jobs to the end, each kind done at least once, and the measurements above.
- **Measured:** above.
- **`SAVE_VERSION` 34:** `tests/missions.test.js`, with a campaign saved at every order of each new mission's fight passing the save's checks.
- **Every rule tested; the validator's checks:** the files above, and 10 new cases in `tests/data.test.js`'s validator test (3 more brought up to date).
- **Touch, at the three sizes:** `m38/verify.mjs`, 58 checks at each, all passing:
  - each new mission's job taken from the board, its brief on the card and its objective under the round;
  - a crate grabbed, carried and walked out;
  - the client moved by touch through the far gate;
  - the rounds held counting up to 6 of 6;
  - a charge planted and its blast on the board;
  - the captive freed and walked out;
  - each job's end panel, and home paid with the crew as it was;
  - offline after a reload, a job taken, and reloaded again mid-rescue with the captive held: the fight back as it was;
  - every button 48 px or more as each fight opens and with Grab, Free or Plant shown; no console errors.

**Tests:**
- `node --test`: 1033 tests pass (1003 before). New: `tests/missions.test.js` (15), `tests/missionText.test.js` (8), `tests/objectiveAi.test.js` (6) and `tests/voyageSurgery.test.js` (1), and 10 cases in `tests/data.test.js`'s validator test. `validate-data`: OK, 44 job templates.
- `tests/contracts.test.js` plays 150 jobs (was 60), so every kind of mission gets done at least once, within 60 rounds as the tools allow (was 30). Lights out, the sight twist, can take 40.
- `tests/run.test.js` no longer pins a thread's tries to one; it reads "in n (least to most) tries".
- `m38/verify.mjs` at the three sizes, as above.
- **Every earlier milestone's browser check,** at the three sizes unless named, each the latest adapted copy. Every one passes but M32b's first copy, whose 2 known failures (its orders' words since M36) its fix copy covers, as in M36 to M37b. The copies adapted for M38:
  - **for saves at v34:** M35's, M34's, M31's, M30's, M29's, M28's and M27's;
  - **for jobs that can be the new missions:** M18's, M16's and M15's, which tap Free and Plant too, and M14's, which plays a job of each of its own three kinds.

  M34's at cover lost its port to the run beside it, and passed when run again. M24's latest copy is M37b's (`m24/verify37b.mjs`); the chain still named an older one, which stops where its first sector has no empty space.
- **Found by the regressions, and fixed:** M18's check at the tab size reloaded mid-fight on a job that brings someone out, and the save wouldn't load: "The campaign's fight doesn't match its crew." The save's checks (`src/sim/campaign.js`) counted every unit on the crew's side against the crew the fight names, the client or the captive among them. They count the crew alone now. The new test in `tests/missions.test.js` fails on the code before the fix, and so does M38's touch check, which now reloads mid-rescue. M18's check passes at the three sizes since.

**Known issues:**
- **The still wins 57%, but only 10% by its objective,** with its two targets; most of its wins come with every enemy down. **Closing time** wins 85%, but only 27% by holding all 8 rounds. Both are in §9 for M40.
- **The lowest new jobs:** Dock strike 45% and Late on the rent 46%.
- **Act 1's money moved:** the miner launches with 44% more credits, the deserter 9% less and the smuggler 12% less. In §9 for M40's balance runs.
- **The longest act 1 runs got longer** for the miner (16 jobs, against 10) and the deserter (29, against 18), and shorter for the smuggler (19, against 28).
- **The tag over a zone** sits on its free tile nearest the middle, so it can move as units step onto the zone.

**What Evan should test on the phone:**
- On the board, pick a job of each new kind and read its brief.
- **Walk it out:** grab the crate and walk it back to where you came in. Note the one move a turn. Let the carrier go down, and take the crate from beside them.
- **Escort:** move the client (two taps) to the far gate, outlined on the deck. They can't shoot.
- **Hold the line:** watch HOLD count up, and keep them off the red tiles.
- **Sabotage:** Plant beside the target, step away, and watch it blow as your next turn starts. Note whether the guards go for the charge.
- **Rescue:** reach the captive (HELD over them), tap Free, and walk them out.
- **The enemies:** whether guarding feels fair or turtly, in a grab and a hack too.
- **The blast's sound** on the phone's speaker.

**Next session's first task:** M39 Parts and hull frames: study the parts and frames, measure, ask Evan, settle its Done when.

## M37b Shipyards (2026-10-17)

**Status:** done, and the ROADMAP.md box is ticked.
- **A shipyard in every sector of the run,** beside its two stations, charted as they are.
- **12 parts a yard,** from every maker, leaning to its side's, at 60% of the dealer's price. The stock is the same on every visit.
- **Trade-ins:** the yard buys any part on hand at half its cost, never above its own price for that part.
- **Refits** at a yard, as at a station. Saves are v33.

**How it was picked:** Evan played the run and found about 2 parts. Measured over 100 voyages from each start:
- **Finds:** a median of 1 to 2 parts a run, all at events; 0.1 to 0.2 salvaged from boardings; about 1 fitted.
- **Money is the real limit:** the median part costs 120 credits, and a player at a station holds a median of 58 to 108.

Evan's picks (2026-10-17): a yard in every sector; 12 parts, every maker; yard prices and trade-ins; no more finds elsewhere. ROADMAP.md has the Done when in full, and what was built where it differs.

**What shipped:**
- **The content:**
  - `data/sectors.json`: the `shipyard` node kind, charted and safe, one a sector in a column of its own, with 12 names of its own. Empty space weighs 1 in a sector's mix (was 2; below).
  - `data/factions.json`: the maker each side's yards lean to (`yard`, weight 3): Con-Reg's to the Yard's own, the Fleet's to Bastion, the Hallorans' to Kestrel, the union's to Scrapline. Nine of the twelve yards belong to a side; three are nobody's.
  - `data/balance.json`: `yardSize` 12 and `yardPercent` 60.
- **The rules** (`src/sim/yards.js`):
  - **The stock:** 12 different parts, rolled from the campaign's seed, the sector and the node, not the campaign's RNG. It is the same on every visit, and a reload never rerolls it. A part of the side's maker weighs 3, every other part 1.
  - **Prices:** 60% of the dealer's price, in fives, at the side's share (M33: 75% trusted to 150% hostile). Nobody's yard charges the plain price.
  - **Trade-ins:** any part on hand, at the dealer's buy-back (half its cost), capped at the yard's own price for that part. At trusted the cap bites, so a part bought and sold straight back never makes money.
  - **One bought is gone** from that yard for good.
  - **Trading docks the ship,** with the docking heat at the pursuer's side's yards (M33's fix).
  - **A refit at a yard,** as at a station, and a failing flight check keeps the ship there.
  - A quest's step never lands on a yard. A day's rest at one is out of the hunters' reach.
- **The screens:**
  - **The chart:** the yard's mark, a crane over a hull on its slipway, in pink, with its side's pip.
  - **The Here panel** at a yard says whose it is and its prices, and the heat of trading at the pursuer's side's. It says what the yard has left for sale and that it buys parts too. The ship's panel is Refit.
  - **Yard,** in the foot, opens the shop screen on the yard: its parts, the parts on hand, and Map back. Buy and Sell take two taps. At the pursuer's side's yard the first tap says the heat.
  - **A jump's plan** says what trading at the pursuer's side's yard adds, and that the hunters keep clear of yards.
- **Saves:** `SAVE_VERSION` 33. A save from before reads with nothing bought at a yard. Its sector has none; the sectors after it do. The save checks know the parts bought (a seen yard's node and slot, once each) and a ship docked at a yard.
- **The validator:** each side's `yard` (makers it knows, weights 1 to 100), the yards' names in `stations`, and `yardSize` and `yardPercent`.
- **The test player** (`tools/voyagePlan.js` `yardBuy`): at a yard it buys the part its refit would fit first, beyond a holdful's price and a transponder swap's, then fits it. `tools/voyage.js` counts the parts bought and what they cost.

**Calls I made, each easy to change:**
- **Empty space weighs 1, not 2.** The yard's column took a mixed node, and events with it: 9.8 a careful voyage on seeds 101 to 300 against main's 10.8. At 1 they came back to 10.6.
- **The yard's mark is pink.** I tried orange first, but the rings round what a jump reaches are orange, and so is the jump point.
- **Regroup at a yard,** safe from the hunters: a yard has no Patch up, and it is safe as a station is. A nebula's day already rests the crew unseen, and sheds heat besides.
- **The refit bar holds main's rate before M37b (59, was 69).** On seeds 1 to 100 the yards' new sectors left 50 runs with a refit, under the old bar of 54. Main's own rate had come down to 59 by M37 (63 before it). On seeds 101 to 300 the branch matched main: 122 of 199 against 119. It follows Evan's call on M37's two bars. **Evan's call:** keep this, or keep the old bar and have me find the runs another way.

**Measured:**

The voyage tests' rates over 100 voyages from each start, main today beside M37b. Every rate is within its margin of `MAIN`:

| Rate, in 100 voyages | `MAIN` | Bar | Main today | M37b |
| --- | --- | --- | --- | --- |
| Miner refitting: fed all the way | 73 | 58 or more | 68 | 69 |
| met the hunters in the sectors | 33 | 48 or fewer | 39 | 35 |
| met the hunters at all | 42 | 57 or fewer | 57 | 57 |
| lost a raid at the colony | 29 | 44 or fewer | 21 | 24 |
| hungry in the system | 14 | 29 or fewer | 12 | 12 |
| two worlds or more surveyed | 68 | 53 or more | 60 | 60 |
| settled a surveyed world | 81 | 66 or more | 71 | 73 |
| everyone housed at the colony | 41 | 26 or more | 35 | 33 |
| short of air at the colony | 0 | 5 or fewer | 2 | 1 |
| a refit on the way | 59 (was 69) | 44 or more | 59 | 50 |
| Miner ignoring heat: met the hunters | 100 | 85 or more | 100 | 100 |
| Miner, no refits: fed | 82 | 67 or more | 72 | 67 |
| never scanned | 0 | 5 or fewer | 2 | 0 |
| fed with a med bay | 79 | 64 or more | 75 | 69 |
| fed with surgery | 81 | 66 or more | 73 | 70 |
| signed a recruit (cargo hold) | 44 | 29 or more | 41 | 39 |
| fed with a cargo hold | 81 | 66 or more | 74 | 83 |
| fed with bunks | 75 | 60 or more | 68 | 78 |
| fed with the large hold | 98 | 83 or more | 91 | 95 |
| Deserter: fed | 80 | 65 or more | 82 | 74 |
| met the hunters | 45 | 60 or fewer | 38 | 41 |
| lost a raid | 20 | 35 or fewer | 17 | 12 |
| Smuggler: fed | 89 | 74 or more | 89 | 89 |
| met the hunters | 19 | 34 or fewer | 29 | 24 |
| lost a raid | 18 | 33 or fewer | 9 | 11 |

- **The bar that moved:** a refit on the way came to 50 on seeds 1 to 100, under its old bar (54). Main's own rate had come down to 59 by M37. On seeds 101 to 300 the branch matched main's: 122 of 199 against 119. Over the 300 seeds that is 57.5% against 59.5%.
- **The careful player without refits** is on its bar: 67 against main's 72. On seeds 101 to 300 it crossed fed in 130 of 199 against main's 138. Over the 300 seeds that is 66% against 70%, about one standard error.

Parts a run, 100 voyages from each start, the refitting player (`tools/voyage.js`, as the voyage tests fly it):

| Start (100 voyages, refitting) | Parts fitted a run, main | M37b | Runs buying at a yard | Parts bought | Credits spent there |
| --- | --- | --- | --- | --- | --- |
| Miner | 0.81 | 0.87 | 9 | 16 | 751 (median 59 a buying run) |
| Deserter | 1.14 | 1.54 | 37 | 99 | 6860 (median 98 a buying run) |
| Smuggler | 0.64 | 1.07 | 17 | 38 | 2953 (median 90 a buying run) |

- **The yards help the deserter and the smuggler most:** they carry more credits on the run (a median of 108 and 100 at a station's trade, against the miner's 58). The deserter fitted 35% more parts a run, the smuggler 67% more.
- **The miner's refitting player reaches a yard in 87 of 100 voyages** (166 visits), but with a median of 30 credits on arriving. A quarter of the time it has 11 or less, and three quarters 59 or less. So it buys in only 9.
- **Events a careful voyage:** 9.69 against main's 9.96 on seeds 1 to 100. On seeds 101 to 300, 10.64 against 10.75, where empty space at 2 left 9.78.
- **`node tools/sim.js`** (run because `data/balance.json` gained `yardSize` and `yardPercent`; no number a fight uses changed): identical to main's but for the time taken.

**Done when** (ROADMAP.md, M37b, in full there), and how each is met:
- **A yard in every sector,** charted and safe, a column of its own, named from its list, a side or none: `tests/yards.test.js` (60 seeds × 5 sectors), and the golden sectors.
- **Its stock, 12 parts, the same on every visit, one bought gone:** `tests/yards.test.js`.
- **Leaning to its side's makers; nobody's even:** `tests/yards.test.js`, over 100 campaigns: the leaned maker's share is 40 to 50%, each other maker 13 to 22%; at nobody's every maker is 21 to 28%.
- **Prices at 60% and the side's share; trade-ins capped:** `tests/yards.test.js`, every part at every level.
- **A refit at a yard; docking heat:** `tests/yards.test.js`.
- **On screen:** `tests/yardText.test.js`, and the touch check below.
- **The test players buy at yards and refit there:** above, and the voyage's step check, which checks every part bought.
- **`SAVE_VERSION` 33:** `tests/yards.test.js` (the migration and the save checks).
- **Measured over 100 voyages from each start:** above.
- **Every rule tested; the validator's checks:** `tests/yards.test.js`, `tests/yardText.test.js`, six new cases in `tests/data.test.js`.
- **The golden sectors change, on purpose:** `tests/golden/sectors.txt` rewritten with `node tools/sectors.js --golden`. Every first sector has its yard, and the mix rolls differently. `tools/sectors.js` marks a yard `y`.
- **Touch, at the three sizes:** `m37b/verify.mjs`, 36 checks at each, all passing:
  - the yard on the chart from the way in: its pink ring and crane, its side's pip;
  - at the yard: its kind, side and prices, the docking heat, what it sells, Refit, Yard in the foot, the hint whole;
  - Yard: the shop screen as the yard, a part bought (the first tap says the heat) and the cargo hold sold, two taps each;
  - a refit there: the part bought goes on in two taps, kept back on the map;
  - offline after a reload; every button 48 px or more; no console errors.

**Tests:**
- `node --test`: 1003 tests pass (989 before). New: `tests/yards.test.js` (11) and `tests/yardText.test.js` (3), and six cases in `tests/data.test.js`'s validator test. `validate-data`: OK, 12 kinds of sector node.
- `m37b/verify.mjs` at the three sizes, as above.
- **Every earlier milestone's browser check,** at the three sizes unless named, each the latest adapted copy. Every one passes but M32b's first copy, whose 2 known failures (its orders' words since M36) its fix copy covers, as in M36 and M37. The copies adapted for M37b:
  - **for saves at v33:** M35's, M34's, M31's, M30's, M29's, M28's and M27's;
  - **for sectors with no empty space:** M24's. Its first sector had none, so the ship now sits on the first mixed node, made empty, as `tests/regroup.test.js` and `tests/huntText.test.js` now do.

  Three checks lost their port to another run beside them (M23g's and M23c's at tab, M17's at cover) and passed when run again.

**Known issues:**
- **Money still limits the yards, the miner's most.** The miner's test player reaches a yard in 87 of 100 voyages, but holds a median of 30 credits there, so it buys in 9. The deserter's buys in 37 and the smuggler's in 17. A player who spends less on supplies will buy more. If the yards still feel thin, `yardPercent` is the lever, or the credits a run earns (M40).
- **The careful player without refits** crossed fed in 197 of 299 voyages against main's 210 (66% against 70%), about one standard error. On seeds 1 to 100 it sits on its bar.
- **The Here panel at a yard** runs four lines and scrolls at the tab size, as a busy station's does.

**What Evan should test on the phone:**
- On the chart, find the pink crane, one a sector. Tap it from afar: the plan names its side, and with the hunters out it says they keep clear of yards.
- At the yard: tap **Yard**. Buy a part (two taps). As the miner at Con-Reg's yard, the first tap says the heat. Sell one you don't need. Then **Map**.
- Tap the ship's panel (**Ship · Refit**) and fit what you bought.
- Visit the yard again later in the sector: the same parts, less what you bought.
- A save from before this update, mid-sector: that sector has no yard, and the next one does.
- **The money:** whether 60% feels cheap enough on a real run.

**Next session's first task:** M38 Missions and jobs: study the mission types and jobs, measure, ask Evan, settle its Done when.

## M37 Weapons and enemies (2026-10-17)

**Status:** done, and the ROADMAP.md box is ticked.
- **15 weapons,** nine of them new, three of each kind: 5 sidearms, 6 long guns and 4 heavy weapons in all.
- **Five rules,** each a weapon's data: bursts, armor piercing, reach, a stun and fire.
- **Loadouts by job:** each crew member carries one weapon, their job's to start, and swaps it for a spare of a kind their job carries. Two taps on the crew card.
- **Four sources:** act 1's shops, won fights, events, and stations' racks.
- **Five new enemy types,** one for each side. Saves are v32.

**How it was picked:** Evan's picks (2026-10-17): loadouts by job; all four rules offered (bursts, armor piercing, a stun at arm's reach, fire); five enemies, one a side; all four sources. ROADMAP.md has the Done when in full, and what was built where it differs.

**What shipped:**
- **The content:**
  - `data/weapons.json`: the nine new weapons, each with its kind, price, numbers, held look and fitting (a drum, prongs, twin barrels, coils, a scope, a nail box, a fuel tank) and its sound. Five sounds are new: a burst's rattle, a rail's crack, a rivet's thunk, a torch's roar, a baton's snap.
  - `data/enemies.json`: the pirates' gunner (an autogun), the scavvers' torcher (a cutting torch), Con-Reg's breacher (a rivet gun), the Provost's proctor (a shock baton) and the Hallorans' cutter (a machine pistol), each with its look. Each joins one party: the cutter's boarders, the hulks' squatters, the repo tug's and the recovery jobs' crew, the frigate's squad, and Old Halloran's crew.
  - What each job carries (`arms` in `data/jobs.json`), each dealer's weapons (`arms` in its shop), each side's rack and the stations' own (`data/factions.json`), and seven event choices that give or sell a weapon.
- **The rules** (`src/sim/weapons.js`, `odds.js`, `battle.js`, `ai.js`):
  - **A burst** is that many shots, each rolled at the odds shown, until the target drops. Overwatch fires one, without the burst's penalty.
  - **Piercing** takes that much armor off the armor that counts.
  - **Reach** stops a shot, overwatch too, past that many tiles.
  - **A stun** puts the target to sleep through its next turn.
  - **Fire** burns the target's tile for that many rounds: 2 a turn to whoever starts one there, then it goes out.
  - **The AI** weighs each rule in its plans. A unit with a reach closes to it, and standing in a weapon's fire counts its burn.
- **Loadouts and sources** (`src/sim/loadout.js`, `gear.js`, `racks.js`, `economy.js`):
  - A crew member's weapon is saved with them, and spares on hand (`campaign.arms`). A recruit or a companion comes with their job's weapon, and someone let go hands theirs in.
  - Sedate needs a dart gun in hand.
  - Dealers stock 2 weapons beside their 4 parts, and buy spares at half price. Racks hold 2 weapons, the same on every visit.
  - A won fight leaves one of the fallen's weapons 30% of the time.
- **The screens:**
  - **The crew card** opens at the hangar and at the colony too. Each row says what that person carries, with a button for each spare they could take. The first tap shows the spare's numbers under the buttons and says what the swap does; the second makes it.
  - **The shop** lists its weapons after its parts, with who could carry each, and spares under On hand to sell.
  - **A station's rack** is a button a weapon in the left panel, under the transponder swap. The first tap shows the weapon's numbers under its button and says the price and where it goes.
  - **In a fight:**
    - The odds card says each shot of a burst, the armor pierced, a stun or a fire.
    - The unit card says the weapon's rules, and when someone is asleep or standing in fire. The tile card says when a tile is burning.
    - Tapping an enemy out of reach says so ("Pirate e1 is out of reach: the shock baton reaches 1 tile. Move Fen Lindqvist closer.").
  - **Every fight's stakes** give the chance of a weapon left (on a job's card, a boarding, a raid), and its end says what was left.
- **Saves:** `SAVE_VERSION` 32. A save from before gives each crew member their job's weapon, with none spare; a fight under way keeps going. The save checks know weapons on hand, what each carries, the racks bought from, and fires and sleep in a battle.
- **The validator:**
  - each weapon's kind and rules, with a clip that holds a whole burst;
  - each job's arms, which must include its own weapon's kind and an order's weapon's;
  - the shop and rack tables.
- **The tools:**
  - `node tools/sim.js --weapons` prints the weapons' table, `--weapon <id>` arms the whole squad with one weapon, and `--sites` plays act 1's job sites.
  - `tools/arms.js` holds the test players' weapons.

**Calls I made, each easy to change:**
- **Two weapons hit harder after the table:** the machine pistol 2–4 in bursts at −10 (was 2–3 at −15), the rivet gun 4–6 (was 3–5). Neither came within 5 points of its kind's best anywhere before (26/54/41 and 45/72/90).
- **The enemies, tuned until each party was within 5 points of before:**
  - the gunner: 7 hit points, aim 50;
  - the torcher: 5 hit points, aim 45, no defense;
  - the breacher: 6 hit points, no armor;
  - the proctor: armor 1;
  - the cutter: 5 hit points.

  The proctor wears an MP's armor, not riot armor's 2: with 2, the crew beat the frigate's squad at home in 16% of 1,000 fights against 31% before. The breacher joined the recovery party, not the raiders, whose raids it moved 8 and 20 points.
- **The test players' weapons** (`tools/arms.js`). They rank weapons by the table's wins, aboard ships or on the ground as the fight ahead is. A crew member whose order needs a weapon keeps it, and those whose jobs carry fewest kinds pick first.
  - **First try:** buying any upgrade beyond the parts still needed (act 1) or a holdful's price (the run), and valuing an event's weapon at 1.5 times its price. That cost the voyages badly: in every set but the large hold's, 10 to 22 fewer voyages of 100 crossed fed than main's. Act 1 launched with about half its credits, and the run spent its purse on weapons and lockers instead of transponder swaps. The hunters came two-thirds more often (206 meetings a hundred careful voyages against 124).
  - **Now:** they buy only a weapon 20 points better than what someone who could carry it has (`GAIN`), beyond a holdful's price and a transponder swap's, and value an event's weapon at a part's worth (a quarter of its price). Over 100 voyages that is as good as buying none: careful-fed 72 either way.
- **Two fixes to the test harness** (`tools/boarding.js`), each found by a stalled voyage:
  - a side moving to get an enemy in sight now looks any distance and walks the way there;
  - once a fight drags past 40 rounds, a move must close in. A crew member with a torch out of reach and the raiders facing them stepped out and back every turn.
- **Spares are listed in the order of `data/weapons.json`,** as the swap buttons are, not the order they came on hand.
- **Three screen fixes, found by the browser checks:**
  - **The rack moved into a station's left panel,** under the transponder swap. In the foot, beside Buy, Fill up, Repair and Patch up, its two buttons pushed the last ones off the tab-size screen and left the hint no room at all (M22's check found it). M24 moved the transponder swap there for the same reason.
  - **A weapon's numbers show beside the button tapped,** not in the hint. At a crowded station the hint is three lines of about 35 letters at the tab size. The rack's numbers and rules ran to 190 and lost "Tap again to buy." The crew card's swaps had the same trouble, so their numbers now show under the swap buttons.
  - **The crew card keeps the button tapped in sight** for the second tap. At the tab size, a first tap's longer words ("Sign on for 30?") pushed it out of the card's 112 px list, so the second tap missed (M23c's check found it).
- **The voyage tests' two bars** (Evan's call, below).

**Measured:**

The weapons' table, the whole squad (marine, engineer, medic) carrying each, 600 fights in each column (`node tools/sim.js --weapons --fights 600`). Aboard ships is against the cutter's boarders, job sites are act 1's, and against armor is the Provost's patrol. ★ marks the best of its kind:

| Weapon | Kind | Aboard ships | Job sites | Against armor |
| --- | --- | --- | --- | --- |
| As issued |  | 46% | 66% | 74% |
| Rifle | long gun | 31% | 65% | 54% |
| Shotgun | heavy | 78% | 80% | 94% |
| Pistol | sidearm | 11% | 53% | 26% |
| Carbine | long gun | 20% | 58% | 46% |
| Long rifle | long gun | 22% | 63% | 45% |
| Dart gun | sidearm | 4% | 38% | 7% |
| Machine pistol (new) | sidearm | 50% ★ | 66% ★ | 74% |
| Shock baton (new) | sidearm | 38% | 61% | 89% ★ |
| Sawn-off (new) | sidearm | 50% | 65% | 81% |
| Autogun (new) | long gun | 57% ★ | 72% | 76% |
| Rail rifle (new) | long gun | 38% | 73% ★ | 78% ★ |
| Marksman's rifle (new) | long gun | 36% | 72% | 56% |
| Rivet gun (new) | heavy | 61% | 78% | 95% |
| Cutting torch (new) | heavy | 69% | 82% | 97% ★ |
| Riot gun (new) | heavy | 87% ★ | 83% ★ | 95% |

- **Each new weapon** is within 5 points of its kind's best in at least one column. The least slack is the rivet gun's: 2.3 under the torch against armor, 4.5 under the riot gun on job sites.
- **None is 5 points better than every other of its kind in all three.** The riot gun leads its kind aboard by 8.5, but on job sites by 1.0 and against armor it trails the torch.
- **The shotgun still leads** where it did, as the Done when leaves for M40 (§9).

Each party a new enemy joined, the crew's wins over 1,000 fights (`tools/boarding.js` rows; the recovery jobs over every such job on the first board, seeds 1 to 3,000). Before is main's party on today's rules:

| Party (new enemy) | Before | After |
| --- | --- | --- |
| Boarded by a pirate cutter (gunner) | 60.4% | 59.0% |
| Boarding a pirate cutter | 54.4% | 50.4% |
| Boarded by a repo tug (breacher) | 56.7% | 55.5% |
| Boarding a repo tug | 54.5% | 53.2% |
| Act 1's recovery jobs (breacher) | 82.1% | 83.4% |
| Boarded by a fleet frigate (proctor) | 30.6% | 32.1% |
| Boarding a fleet frigate | 24.2% | 26.6% |
| Boarded by a Halloran yacht (cutter) | 16.4% | 12.8% |
| Boarding a Halloran yacht | 27.8% | 27.4% |
| Boarding the hulk (torcher) | 69.7% | 66.7% |

The raids are unchanged: the crew wins 57% and 42% of Con-Reg's (at the hangar, at the colony), 64% and 40% of the Provost's, 50% and 42% of the Hallorans', each within M30's 10 points of Con-Reg's (`tools/raids.js`, 300 fights each).

Act 1's test runs, 100 from each start (`node tools/run.js --runs 100`): the median launch is after 6 jobs from each, as on main. Credits at launch, the median: miner 75 (main 85), deserter 195 (205), smuggler 120 (120). The act 1 player bought a weapon in 7 runs of the smuggler's, a heavy weapon for the quartermaster, whose carbine trails each by 20 points or more on the ground. It bought none in the others': no other start's crew carries a weapon 20 points short there.

The voyage tests' rates over 100 voyages from each start, main today beside M37. Every rate is within its margin of `MAIN`:

| Rate, in 100 voyages | `MAIN` | Bar | Main today | M37 |
| --- | --- | --- | --- | --- |
| Miner refitting: fed all the way | 73 | 58 or more | 72 | 68 |
| met the hunters in the sectors | 33 | 48 or fewer | 35 | 39 |
| met the hunters at all | 42 | 57 or fewer | 47 | 57 |
| lost a raid at the colony | 29 | 44 or fewer | 18 | 21 |
| hungry in the system | 14 | 29 or fewer | 8 | 12 |
| two worlds or more surveyed | 68 | 53 or more | 65 | 60 |
| settled a surveyed world | 81 | 66 or more | 79 | 71 |
| everyone housed at the colony | 41 | 26 or more | 39 | 35 |
| short of air at the colony | 0 | 5 or fewer | 2 | 2 |
| a refit on the way | 69 | 54 or more | 63 | 59 |
| Miner ignoring heat: met the hunters | 100 | 85 or more | 99 | 99 |
| Miner, no refits: fed | 82 | 67 or more | 77 | 72 |
| never scanned | 0 | 5 or fewer | 2 | 2 |
| fed with a med bay | 79 | 64 or more | 78 | 75 |
| fed with surgery | 81 | 66 or more | 81 | 73 |
| signed a recruit (cargo hold) | 44 | 29 or more | 44 | 41 |
| fed with a cargo hold | 81 (was 90) | 66 or more | 81 | 74 |
| fed with bunks | 75 (was 90) | 60 or more | 75 | 68 |
| fed with the large hold | 98 | 83 or more | 90 | 91 |
| Deserter: fed | 80 | 65 or more | 83 | 82 |
| met the hunters | 45 | 60 or fewer | 34 | 38 |
| lost a raid | 20 | 35 or fewer | 19 | 17 |
| Smuggler: fed | 89 | 74 or more | 90 | 89 |
| met the hunters | 19 | 34 or fewer | 25 | 29 |
| lost a raid | 18 | 33 or fewer | 7 | 9 |

- **The two bars moved:** fed with a cargo hold and fed with bunks came to 74 and 68 on seeds 1 to 100, under their bars (75, from `MAIN` before M33c). Main's own rates had come down to 81 and 75, bunks exactly on its bar, as M36 warned.
  - On seeds 101 to 200, M37's voyages matched main's: bunks 75 to 73, cargo 78 to 80, careful 72 to 70. Over the 200, M37 costs these sets 2 to 4 points, within chance.
  - Most of it is the breacher in the repo tug's crew, the miner's hunters. Without it the three came to 72, 79 and 77 on seeds 1 to 100.
  - Evan's call: those two bars hold main's rates before M37 (81 and 75).
- **Weapons bought on the run:** the voyage player bought from a rack in 16 careful voyages of 100 (18 weapons), 47 of the deserter's (71) and 12 of the smuggler's (16), and in 2 to 33 of the other sets'. It never took a weapon at an event: valued at a part's worth, the other choices were worth more every time.

**Done when** (ROADMAP.md, M37, in full there), and how each is met:
- **15 weapons, kinds, prices, held looks with fittings, five new sounds:** `validate-data`, `tests/weaponRules.test.js`, the figure and sound tests.
- **The rules, each a weapon's data, on the cards:** `tests/weaponRules.test.js`, the words in `tests/armsText.test.js`.
- **Loadouts, swaps, recruits, companions, Sedate:** `tests/loadout.test.js`.
- **The four sources:** `tests/loadout.test.js`, `tests/shop.test.js`, `tests/events.test.js`, and the voyage's step-by-step check, which now checks each weapon bought and given.
- **Five enemies, their parties within 5 points, the raids within 10:** measured above.
- **The AI and the test players weigh each rule:** `tests/weaponRules.test.js` (the AI's reach) and `tests/arms.test.js` (the test players' picks and buys).
- **Every weapon measured:** above.
- **Save v32:** `tests/loadout.test.js` (the migration) and the save tests.
- **Measured over 100 voyages, act 1's launch median within 1:** above.
- **The golden battle logs don't change:** none did.
- **Touch:** `m37/verify.mjs`, 56 checks at each of the three sizes, all passing:
  - a swap on the crew card, offering only the kinds the job carries, at the hangar and at the colony;
  - a weapon bought at the shop and at a station's rack, at a crowded station too;
  - each first tap's numbers beside the button tapped, both in sight, the hint whole and the foot a button high;
  - a burst's shots, the armor pierced, a baton out of reach, a stun, and a fire on the board;
  - a weapon left by a won fight, on hand after;
  - offline after a reload; every button 48 px or more; no console errors.

**Verified:**
- `node --test`: 989 tests pass (956 before). New: `tests/weaponRules.test.js`, `tests/loadout.test.js`, `tests/armsText.test.js` and `tests/arms.test.js`, and the voyage's step check for weapons. `validate-data`: OK, 15 weapons and 20 enemies.
- `m37/verify.mjs` at the three sizes, as above.
- **Every earlier milestone's browser check,** at the three sizes unless named, each the latest adapted copy. The first pass found the three screen fixes above. Rerun on the final code, every one passes but M32b's first copy, whose 2 known failures (its orders' words since M36) its fix copy covers, as in M36. The copies adapted for M37:
  - **for saves at v32:** M35's, M34's, M31's, M30's, M29's, M28's and M27's;
  - **for M37's words:** M33b's, M30's, M29's and M28's (what a win can leave, and the new enemies in their parties); M23's (the spares on hand in the crew card's words); M22's and M21's (the pirates' gunner among the cutter's crew);
  - **for the rack in the left panel:** M21's and M19's bring a button into sight before trying its middle, as M22's does, since the panel scrolls at the tab size;
  - **for the dealer's weapons:** M16's counts them in the stock beside its parts.

  Two checks, M32b's fix copy at open and M23b's at tab, lost their port to the other half of the rerun running beside them, and passed run again.

**Known issues:**
- **The miner meets the hunters** in 57 voyages of 100, exactly its bar. The next content to move the voyage may tip it.
- **The test players buy few weapons:** act 1's only for the smuggler's quartermaster, and the run's at racks in 12 to 47 voyages of 100 by start. Weapons bought freely cost more voyages than they saved (§9).
- **The AI can step out and back** in some layouts, turn after turn (§9). Seen only in a test raid, where the harness now makes both sides close in.
- **Act 1's test run on seed 115** stops short: a medic and a heavy, both at 2 hit points in full cover, trade 20% and 0% shots for 60 rounds, the heavy with no nearer tile. Seeds 1 to 100, which the tests fly, all launch.
- **The table's wins are the whole squad's,** so what one crew member gains by a weapon is a guess.
- **At the tab size** (the cover screen in Chrome with its tab bar), a station's left panel shows the transponder swap and the rack's first weapon. The second weapon is a scroll down, with the station's words, which were already below the fold there. The TWA's cover size shows the rack whole.

**What Evan should test on the phone:**
- **The crew card** in the hangar: give the marine a spare, and check the medic is offered sidearms only. The first tap shows the spare's numbers under the buttons. Then at a station, and at the colony.
- **The shop:** its two weapons after the parts; buy one, then sell a spare back at half.
- **A station's rack,** in the left panel: buy a weapon; it is gone the next time you call. Try it at a station with something wrecked and someone hurt, on the cover screen in Chrome: the foot's hint should show whole.
- **A fight:**
  - the odds card for a burst (each shot at the odds shown), and for a rail rifle against an armored enemy;
  - tap an enemy past the baton's reach;
  - a stun, then the target's card;
  - the torch's fire on the board, and the tile's card.
- **Win a fight:** its end may say what was left. The weapon is on hand on the crew card.
- **An old save** (v31) opens, each crew member with their job's weapon.

**Next session's first task:** settle M38's Done when with Evan (Missions and jobs, drafted in ROADMAP.md).

## M36 Events (2026-10-17)

**Status:** done, and the ROADMAP.md box is ticked.
- **100 events,** the 29 before among them, unchanged:
  - on the run: derelicts 12, distress calls 12, traders 10, hazards 11, and each background's own 4;
  - at the colony's places: 9 for each kind.
- **A choice can need someone:** an Engineer, say, or someone with the Cool head trait. The card names who would take it, or says who it needs.
- **Traps:** 6 on the run, where a ship comes out firing, and 2 at hulks, where the scavengers were waiting.
- **The ship hurt or mended:** 7 events wreck parts, and 8 repair them.
- **No event comes twice** while its kind has others left. Saves are v31.

**How it was picked:** Gate 6's entry below has Evan's answers. ROADMAP.md has the Done when in full, and what was built where it differs.

**What shipped:**
- **The content** (`data/events.json`): 71 new events, written as the old ones are.
  - Every job is needed by some choice, and 10 traits are.
  - The traps on the run are the cutter's (three times) and one for each background's pursuer: the repo tug, the Provost's cutter, and the Hallorans' runner.
  - Each background's 4 are its pursuer's and its past's: the miner's union and debts, the deserter's old division and amnesty, the smuggler's caches and fences.
- **The rules** (`src/sim/events.js`, `eventPool.js`, `expeditions.js`, `encounter.js`):
  - `needs.job`, `needs.trait` and `needs.wrecks`;
  - `background`;
  - `ambush` (a preset on the run, `true` at a hulk);
  - `wreck`, `repair`;
  - `campaign.eventsMet`.
  - **Who takes a choice:** the first in the crew's order who fits, in the squad at a place. A wound falls on them while they have more than 1 hit point.
  - **A wreck** rolls among the parts a volley could hit, then the crew jury-rigs a reactor and an engine as after an approach. **A repair** takes the dearest wreck first.
- **The words:**
  - The card names who takes a choice: "Quill Petrov · 80% · 20%". Its first tap says "Quill Petrov takes it."
  - The odds say a trap ("a trap: a Pirate cutter, firing first"), "a part aboard wrecked", and which part a repair mends ("the Weapon mount repaired").
  - Results list what was wrecked, what the crew got going again, and what was repaired.
  - A trap's approach reads "A trap · Pirate cutter", with the event's own words over her volley. Afterwards the event's card says what sprang it.
  - At a place, a trap leaves her held: board her, or fly home and leave her be.
- **Saves:** `SAVE_VERSION` 31, with a migration from 30 that starts a save with no events met. The save checks know a trap's approach, a sprung place, and the new changes.
- **The validator:** the new fields; a trap only at a kind of place the scavengers hold, and on the run only a preset with tactics; a repair sold only with wrecks to mend.
- **The test players** (`tools/voyagePlan.js`, `tools/voyage.js`):
  - They make a choice only with whoever it needs aboard (in the squad at a place).
  - They price a trap as a hostile ship that fires first, a wreck at a station's repair, and a repair at what a station would charge.
  - They fight a place's trap then and there. Their report counts the traps and the parts wrecked and mended.

**Calls I made, each easy to change:**
- **Who takes a choice is the first in the crew's order who fits.** The player can't pick who goes. A picker would mean a step between the two taps.
- **A trap at a hulk** keeps M28's rule for held places: the squad can fly home without fighting. The test player never springs one (it weighs the fight at 16, as two parts lost), so hulk traps are covered by the rule tests and by touch, not by the voyages.
- **Tuned after measuring.** The first measurement had the bunks voyages fed in 72 of 100, three under the bar, and the hunters met twice as often as on main. Two causes:
  - **Heat cover:** the old loose rock's "hide" came up more than once a voyage and shed 6 heat each time. Diluted among 11 hazards, it seldom does. Going dark in a solar flare and threading a minefield now shed heat too.
  - **Credits:** the new events paid less (about 30 credits a voyage). So: the chandler sells stores, and five new events pay a little more (the reactor's cabins, the shrine, the gutted cutter's locker, the fever ship, the red flare).
  - **The test player spent its purse at events,** on guns and repairs, then couldn't swap its transponder. It now spends credits at an event only beyond a holdful's price, as it already did at stations, except on supplies or a quest's step.
- **The voyage tests,** adapted under the rule for checks new content breaks:
  - the run's events count over 100 seeds: the tinker's barge never came up on seeds 1 to 30;
  - the step-by-step check also walks the deserter's runs: no miner's run on seeds 1 to 30 repaired at a station since M36 (on main, one of 210 did), and the deserter's do;
  - a new test holds the repeats and the backgrounds' events to the Done when.
- **The golden sectors** (`tests/golden/sectors.txt`) were regenerated on purpose: the same maps and kinds, with events, the hostile ships' seeds and the names drawn anew from the new pools.

**Measured** over 100 voyages from each start (`tools/voyage.js`, as the voyage tests fly them), main today beside M36. Every rate is within its margin of `MAIN`:

| Rate, in 100 voyages | `MAIN` | Bar | Main today | M36 |
| --- | --- | --- | --- | --- |
| Miner refitting: fed all the way | 73 | 58 or more | 68 | 72 |
| met the hunters in the sectors | 33 | 48 or fewer | 26 | 35 |
| met the hunters at all | 42 | 57 or fewer | 42 | 47 |
| lost a raid at the colony | 29 | 44 or fewer | 18 | 18 |
| hungry in the system | 14 | 29 or fewer | 3 | 8 |
| two worlds or more surveyed | 68 | 53 or more | 74 | 65 |
| settled a surveyed world | 81 | 66 or more | 82 | 79 |
| everyone housed at the colony | 41 | 26 or more | 28 | 39 |
| short of air at the colony | 0 | 5 or fewer | 0 | 2 |
| a refit on the way | 69 | 54 or more | 61 | 63 |
| Miner ignoring heat: met the hunters | 100 | 85 or more | 100 | 99 |
| Miner, no refits: fed | 82 | 67 or more | 68 | 77 |
| never scanned | 0 | 5 or fewer | 0 | 2 |
| fed with a med bay | 79 | 64 or more | 67 | 78 |
| fed with surgery | 81 | 66 or more | 69 | 81 |
| signed a recruit (cargo hold) | 44 | 29 or more | 38 | 44 |
| fed with a cargo hold | 90 | 75 or more | 76 | 81 |
| fed with bunks | 90 | 75 or more | 75 | 75 |
| fed with the large hold | 98 | 83 or more | 93 | 90 |
| Deserter: fed | 80 | 65 or more | 82 | 83 |
| met the hunters | 45 | 60 or fewer | 26 | 34 |
| lost a raid | 20 | 35 or fewer | 12 | 19 |
| Smuggler: fed | 89 | 74 or more | 88 | 90 |
| met the hunters | 19 | 34 or fewer | 28 | 25 |
| lost a raid | 18 | 33 or fewer | 7 | 7 |

- **Repeats:** on main, 92 to 99 voyages of 100 met some event twice on the run (2 or 3 a voyage at the median). With M36, none did, in 100 of 100 from each start, and none met a place's event twice at the colony. A voyage meets 10 or 11 events on the run, as before.
- **Traps:** 5 to 14 a hundred voyages on the run, by set; none at the places (the test player declines them). Wrecks from events left 4 to 7 parts wrecked a hundred voyages (more were hit and jury-rigged); events mended 0 to 2, and 11 for the player ignoring heat.
- **The hunters, met more often:** in the miner's refitting voyages, 129 meetings a hundred voyages against main's 87, in 47 voyages against 42. It was 155 at first and 168 after the content tune; the purse rule brought it to 129. What's left is likely the hazards' thinner cover and the traps' own shooting (not measured apart). It is within the bar, but the run is a little hotter than main's.

**Done when** (ROADMAP.md, M36, in full there), and how each is met:
- **100 events,** counted as the Done when counts them: `tests/eventKinds.test.js` (the content test) and `validate-data`.
- **Needs, backgrounds, traps, wrecks and repairs, fewer repeats, v31:** `tests/eventKinds.test.js` (9 tests), the UI's words in `tests/eventKindsText.test.js` (4).
- **The test players and the measurements:** above, and in `tests/voyage.test.js`: every `MAIN` rate within its margin, and the M36 test (no repeats in 9 of 10, each background's own on its runs alone).
- **Touch:** `m36/verify.mjs`, 27 checks at each of the three sizes. All pass. It covers a choice by job naming who takes it and one no one aboard can take; a trap's approach in the event's words, her volley first, and the event's card after; a wreck and a repair in results; and a hulk's trap, from a choice the squad can't take, through the sprung trap, to the squatters' fight. Offline after a reload, every button 48 px or more, no console errors.

**Verified:**
- `node --test`: 956 tests pass (942 before). `validate-data`: OK, 100 events.
- `m36/verify.mjs` at the three sizes, as above.
- **Every earlier milestone's browser check** passes, one after another at the three sizes (`m36/regress.sh`), M35's to M8's. Things to know:
  - **The copies that read a save's version** (M35's, M34's, and M31's to M27's) are adapted for M36: saves are v31.
  - **Four more copies are adapted for M36,** for fixed seeds its events moved or a call one had wrong:
    - **M32b's two:** the first station's first recruit is now a scout at 8 hit points, who sits a boarding out, so two of the crew reach a rank where three did. The copies sign on a recruit tougher than the captain, as main's marine was.
    - **M23's:** that recruit is now a marine, so hurting every marine hurt him too. It hurts only the captain, as `tests/crewText.test.js` now does.
    - **M19's:** it asked `choiceProblem` without the rules, which a choice needing a job reads to say who it needs. It passes them now.
  - **M18's swipe at the tab size** scrolled 29 px against its bar of 30 in the chain, and passed (43 of 43) when run again. M36 doesn't touch the settings.
  - **M32b's first copy** still looks for Suppress · 2 and Sedate · 2, as it has since M33; its fix's copy passes in its place.

**Known issues:**
- **The hunters come more often** on the miner's run than on main, within the bar (above).
- **Fed with bunks is 75 of 100,** exactly the bar, as main's is today. The next content to move the voyage may tip it.
- **Station repairs are rarer:** none in the miner's 600 voyages without refits.
- **The test player never springs a trap at a place,** so no voyage measures one.
- **The two hulk traps** both bring the squatters, the only party a hulk has.

**What Evan should test on the phone:**
- **A voyage's events:** different ones all the way, and the job and trait choices. Each names who would take it, or is greyed out saying who it needs.
- **A trap on the run:** her volley lands before your first order, the screen says "A trap", and the event's card says what sprang it afterwards.
- **A hazard that wrecks a part, then a trader that repairs it:** the card names the part.
- **At the colony:** a derelict with the squatters' camp or the ghost freighter. Spring the trap, then board her, or fly home and leave her.
- **An old save** (v30) opens, with no events met.

**Next session's first task:** settle M37's Done when with Evan (Weapons and enemies, drafted in ROADMAP.md).

## Gate 6 (2026-10-17)

**Passed.** Evan's answer after M35: "Merge and continue". M35 was already merged, so I asked whether "continue" meant the gate had passed. The answer: "Yes: Gate 6 passed".
- ROADMAP.md named no gate for Phase 6. The one passed was drafted at M35's close: "v0.4 plays on the phone: each of the three backgrounds from New game to the colony, with its own pursuer, the sides, quests and companions, the painted scenes, and sound; and Evan wants to keep going." v0.4 is done: Phase 6.
- No phone results came with it, and none have come back for M14 to M35. The gate is Evan's call, so it stands as passed.
- Phase 7 starts with M36 (events). ROADMAP.md held Phase 7's details until v0.4 was done. They are drafted there now: M36's Done when in full, the rest as drafts, and Gate 7 drafted.
- **How M36 was picked** (Evan, 2026-10-17, each the recommended answer but the last, where Evan took all four):
  - **First in Phase 7:** events, the content furthest behind §5's v1.0 column: 22 general events and 7 quest steps against 100 or more.
  - **How many:** to 100 in all.
  - **New kinds:** job or trait choices, each background's own, traps that start a fight, and events that wreck or mend the ship.
- **Measured before settling it** (30 careful voyages from each start, `tools/voyage.js`, the quests' steps included):

  | Start | Events on the run, a voyage | Met for the second time | Different events over 30 voyages | Trips at the colony | Place events met for the second time |
  | --- | --- | --- | --- | --- | --- |
  | Miner | 11 (6 to 16) | 3 (up to 5) | 17 | 9 | 2 (up to 5) |
  | Deserter | 12 (8 to 15) | 2 (up to 6) | 16 | 12 | 4 (up to 7) |
  | Smuggler | 13 (8 to 17) | 3 (up to 5) | 19 | 10 | 3 (up to 6) |

  Medians, ranges in brackets. A sector never repeats an event, but its pool starts over at the next sector; the places draw theirs each time the list is rolled, independently.

## M35 Audio pass with ZzFX (2026-10-17)

**Status:** done, and the ROADMAP.md box is ticked. M35 was Phase 6's last milestone: Gate 6 is drafted in ROADMAP.md and is Evan's call.
- **The game has sound,** made in code with ZzFX from parameters in `data/sounds.json`; there are no sound files.
- **Gritty** for the fights and the campaign's moments; **soft** for the menus and the builder.
- **Settings:** Sound (on or off) and Volume (10 to 100%), on at 70% for a new game and for a save from before.
- **Saves are v30.**

**How it was picked:** an audition page of three styles (soft, arcade and gritty), each with the same 14 moments, loudness-matched as a phone speaker plays them. Then Evan's answers (2026-10-17), each the recommended option:
- **Where:** all four groups: the fights, the builder, the menus, and the campaign's moments (jumps, the raid and hunter alarms, the lift-off, the landing).
- **The style:** "Mix: Gritty + Soft". Gritty for the fights and the campaign, soft for the menus and the builder, which play most often.
- **The default:** on at 70%.
- **The controls:** one volume and a mute.

**What shipped:**
- **ZzFX 1.3.2** (MIT, Frank Force) in `src/platform/zzfx.js`, as published but for its line endings, with its line in `assets/LICENSES.md`.
  - It is loaded with the sounds on the first tap: no AudioContext before it, and none at all while sound is off.
  - It is precached, so sound works offline.
- **The sounds** (`data/sounds.json`, 19 of them): each is ZzFX's parameters by name, what it is for, and how loud it is meant to be.
  - The audition's 14 in the picked styles, and five more in the gritty style: the dart gun's shot, a door, a reload, the lift-off's roar and the landing's.
  - Each weapon names its shot's sound (`data/weapons.json`): the rifles, carbine and pistol `shot`, the shotgun `shotgun`, the dart gun `dart`.
  - The validator checks every parameter's range, that a sound lasts at most 2.5 s, that no slide takes the pitch through zero, that every moment the game plays has its sound, and every weapon's sound.
- **`tools/sounds.js`** renders each sound with the game's own ZzFX and reports its length, its peak at full volume, and its loudness through a phone speaker's low end (a 450 Hz high-pass), against what it is meant to be.
- **The audio** (`src/platform/audio.js`): each sound is built once and played through a gain at the player's volume. 100% is the sound as measured, its peak at most 0.73.
- **Which moment plays which** (`src/ui/sounds.js`, pure):
  - **menus:** a tap on any button; a refusal on a button that is off; a confirm where something is spent or settled (buying, selling, hiring, taking a job, paying, an event's choice, the next day);
  - **builder:** a part placed, moved, turned or taken off; a refusal where it can't go; the look's paint, trim and style confirm;
  - **fights:** each shot as its weapon's sound, then a hit or a miss as it lands, a unit down or dead, an order, a door, a reload, in step with the playback, the enemy's turn as the crew's; a refusal where a tap did nothing;
  - **campaign:** a jump (and a trip out, on or home); the alarm as a raid comes due at the hangar, the hunters are found waiting, or a raid is coming at the colony; the lift-off's and the landing's roars; an approach's round, the ships' guns and whether the crew's volley hit.
  - **One tap, one sound:** what one tap cues plays one after another, its own tap giving way to any other.
- **Settings:** Sound and Volume are the first rows. `SAVE_VERSION` 30, with a migration from 29: sound on at 70%.
- **The dev menu:** a Sounds section plays each sound; the status line says how sound stands and what played last.

Calls I made, each easy to change:
- **The five sounds the audition didn't have** (dart, door, reload, lift-off, landing), designed in the gritty style and loudness-matched. Hear them in the dev menu.
- **The approach's rounds sound** (the ships' guns, then hit or miss) although the list named only the fights' playback: they are ship fights.
- **Volume as five steps** (10, 30, 50, 70, 100%), the settings' way, rather than a slider.
- **The landing's roar starts 2.3 s in,** as the ship starts down, so its 2.5 s die away with the engines. With reduced motion, the lift-off and the landing each still roar once.
- **Act 3's words ahead,** as at M29's close: "All of v0.4 is here, sound included. Still to come in v1.0: balance, a tutorial, and the release on Google Play." That is §6's v1.0, before Phase 7 is drafted.

**For Evan to hear on the phone, as found while measuring:**
- **The gritty shot's and shotgun's tails ring.** A ZzFX echo runs back through the sound's filter, whose peak (Q 2) lets it build: their tails are about 8 dB stronger than without the filter. They are as you auditioned them. If they ring too long on the phone, either can drop its filter or its echo; the five new sounds already use one or the other.
- **I couldn't hear any of this.** Every sound was measured (length, peak, loudness through a phone's low end, spectrograms by eye) and checked in Chromium, but whether they sound good is untested until you play them.

Done when (ROADMAP.md, M35, in full there), and how each is met:
- **ZzFX in the repo:** byte for byte the published file but for its line endings, which the repo keeps as LF; its LICENSES.md line; loaded on the first tap (by touch, below); precached (`sw.js` lists it; offline by touch).
- **Sounds as data:** `data/sounds.json`, `data/weapons.json`'s `sound`; `tools/validate-sounds.js`; eleven new cases in `tests/sound.test.js`.
- **Heard on the phone, never clipping:** `tests/sound.test.js` renders every sound in Node: finite, under 2.5 s, peaking under 0.9, and within 1 dB of the loudness it is meant to have.
- **The menus, the builder, the fights, the campaign:** `tests/sound.test.js` (9 tests): which sound each change makes, the builder's commands against undo and redo, the screens' own dispatches silent, every alarm, an approach's round, and the playback's cues in order with their timing. By touch, below.
- **Settings:** the actions, their problems and the migration in `tests/sound.test.js`; the rows by touch.
- **The dev menu:** by touch.
- **Every rule tested:** `node --test`, 942 tests (933 before).
- **Touch:** `m35/verify.mjs`, 24 checks at each of the three sizes. All pass. A fight is played by touch with its copy in Node, and every order's sounds match what its events say, the enemy's turns included.

**Verified:**
- `node --test`: 942 tests pass. `validate-data`: OK, 19 sounds. No rules or balance changed, and the golden files are unchanged.
- `m35/verify.mjs` at the three sizes, with Chromium kept as quiet as a phone until touched:
  - no AudioContext and no ZzFX before the first tap; then one AudioContext, running;
  - the settings: Sound and Volume first, every choice 48 px or more, a volume saved and the next sound played at it, Off silencing the taps after it, On bringing them back;
  - a save with sound off: taps load nothing;
  - a tap's sound, and the hangar's Pay, off, refusing;
  - the builder: a part placed by two taps, taken off by Delete;
  - a fight by touch: its weapon's sound, then hit or miss, and every order's sounds as its events say (25 sounds, 3 of them enemy shots);
  - the lift-off's roar, the landing's (not before the ship starts down), the alarm as heat brings a raid due, the dev menu's 19 sounds;
  - offline after a reload, ZzFX from the cache; saves at v30; no console errors or warnings.
- **Every earlier milestone's browser check** passes, one after another at the three sizes (`m35/regress.sh`), M34's to M8's. Three things to know:
  - **The copies that read a save's version** (M34's, and M31's to M27's) are adapted for M35: saves are v30.
  - **M18's copy is adapted for M35:** the settings' two new rows make the list scroll unfolded, where it fitted before. Unfolded it is one column, with no space beside it to swipe from, so a swipe from a button is checked there alone: it scrolls the list and changes nothing.
  - **M32b's first copy** still looks for Suppress · 2 and Sedate · 2, as it has since M33; its fix's copy passes in its place.

**Known issues:**
- **The first tap is silent.** It starts the audio, which loads as the tap lands; every sound after it plays.
- **Unfolded, the settings list now scrolls:** with Sound and Volume on top, Show tips again and the save's code sit below the fold at 960 × 825. A swipe brings them up.
- **The credits screen** that lists `assets/LICENSES.md` comes with the release (Phase 8). ZzFX's own notice is at the top of its file.
- **The approach screen's two volleys** sound as one round: the guns, then the crew's hit or miss, not each gun.

**What Evan should test on the phone:**
- **The first minutes:** a tap on the title starts sound. Tap through menus: soft taps; spend credits: a confirm.
- **The builder:** a part placed (two taps), turned, taken off; a part where it can't go.
- **A fight:** shots, hits and misses, a unit down, an order, the enemy's turn. Listen to the shot's and the shotgun's tails (above).
- **The voyage:** a jump; the hunters, if they find you; a lift-off and a landing.
- **Settings:** Off and On, and the volumes, with the phone's speaker and with headphones.
- **The dev menu** (`?dev=1`): every sound by name, to judge the set.

**Next session's first task:** Gate 6 is Evan's call: v0.4 played on the phone (each background from New game to the colony, with sound) and wanting to keep going. Once it passes, draft Phase 7 (content and balance) in ROADMAP.md and settle its first milestone's Done when with Evan.

## M34 Scenes and companions, drawn in code (2026-10-17)

**Status:** done, and the ROADMAP.md box is ticked.
- **Title:** stands over a painted hangar.
- **Lift-off:** the homeworld's ground falls away under the ship, and the grey rock is then seen whole.
- **Landing:** comes down out of the sky onto each kind of world's own ground.
- **Companions:** the four each have a bust of their own, drawn in code. It is big where they offer to come aboard, and cropped to the face on the cards.

Saves are unchanged at v29.

**How it was picked:** Evan's answers at the start (2026-10-17):
- **How:** "Scenes drawn in code". There is no Base44 in M34; painted art waits, store art first.
- **Which:** "Companions and scenes". That is seven scenes (the hangar, the grey rock, and the five kinds of world) and the four companions. The clients wait for Phase 7.
- **Portraits:** "Big on the offer". About 100 px on the event card, the face at 40 px on the cards, and the helmet badge kept in fights.
- **The look:** "Painted, my call". A dark navy ground, with amber and cyan rim light.
- **Asked again**, since the first answers pulled two ways: "Redrawn richer in code".

**What shipped:**
- **Scenes as data and drawings** (`src/render/scenes/`):
  - each scene is a pure function from its id and a seed to plain shapes (rects, ellipses, smooth polygons, clipped groups, gradients, soft edges);
  - a painter draws them;
  - soft shapes are painted on a smaller layer and laid back, because canvas blur cost seconds a scene. A scene now paints in 15 to 130 ms here, once a size.
  - The seven scenes:
    - **the hangar:** the title's, its bay door open on the night with the stars cut through, a half-built hull on the pad, half of it still blueprint;
    - **the homeworld's ground:** the pad by its hangar, the Tailings' roads and pits;
    - **the five kinds' grounds**, each from the colony's land for its kind (M26):
      - an ocean island, beach and reef;
      - desert dunes round a salt flat;
      - ice plates and a lead;
      - a jungle clearing by a river;
      - barren rock's craters;
    - **each world seen whole.**
  - Act 1 names its lift-off's scene (`data/campaign.json`), and each kind of world its landing's (`data/worlds.json`). The validator checks both; a kind not drawn takes barren rock's.
- **The title:** the hangar over the title's sky, its moving stars through the door. The tag line is now in full ink and shadowed. The note New game's first tap shows sits on a ground of its own, like the buttons.
- **The lift-off and the landing** (`src/ui/campaign/backdrop.js`):
  - the ground and the world are painted once a size;
  - each frame draws the ground scaled to the moment and faded into the world seen whole, then the ship;
  - only what shows is drawn: no world under ground that covers the screen, no ground once it has faded;
  - a ground in motion is scaled without smoothing, and is smoothed at rest.
- **The busts** (`src/render/portraits/bust.js`): each companion's face (face.js) bareheaded, a fifth smaller, on broad shoulders.
  - The clothes and gear are named in `data/companions.json` (`bust`), their choices drawings the validator checks:
    - Varga: a coverall and goggles;
    - Brandt: a dock coat and the union's armband;
    - Osei: a survey jacket and headset;
    - Dez: a medic's coat and stethoscope.
  - Their side's color is on a patch or the gear.
  - The rim light is an SVG filter round the whole figure: warm from the left, cool from the right.
  - Where it shows:
    - **event card:** beside the words, out of their scroll;
    - **crew card, squad pickers and colony trip:** the face crop;
    - **fight buttons:** the helmet badge, as before.

Calls I made, each easy to change:
- **The busts' clothes and gear.** I picked them for the companions' jobs and pasts. Each is one word in data, and any drawing goes with any companion.
- **The tag line and the note restyled** rather than the hangar darkened. The floodlights crossing behind the words gave the dim tag line 3.4 to 1, and the note over the lit hull 2.1 to 1.
- **The words:** the tag line is now "Early build: from the hangar to the colony." Act 3's words ahead are now "Three backgrounds are here, each with its own pursuer. Still to come in v0.4: sound."

**Evan's call, before the merge (2026-10-17): the first reading** ("Keep the first reading, merge when green"). The question was how "a scene adds under 2 ms a frame" reads. Timed in Chromium on this machine:
- **Against what main drew behind the ship** (the space color, a full-screen haze and stars, which the scene takes the place of): the backdrop is cheaper at every size, by 2.1 to 8.2 ms a frame. This is the reading kept.
- **Against a bare frame:**
  - **cover screen, both shapes:** a moving frame is under 2 ms at the 95th percentile;
  - **unfolded:** 2.8 to 3.6 ms on average.

This machine draws the canvas on the processor, where one full-screen copy alone costs 0.9 ms unfolded. On the phone Chrome draws it on the graphics chip, where scaling an image costs next to nothing. I expect that, but it is not measured: please still watch for stutter in the lift-off unfolded. If it stutters, ROADMAP §9 has the fix: the backdrop as layers the compositor moves, under a canvas of the ship's own.

**For Evan to watch on the phone:**
- **The unsmoothed ground in motion.** At device pixels it looks the same here. On the ice plates' hard edges, two-pixel steps could show while it zooms.

Done when (ROADMAP.md, M34, in full there), and how each is met:
- **Scenes as data and drawings:**
  - `tests/scenes.test.js` (9 tests): every scene is the same from the same seed and moves with another; it lies in its frame with sound numbers, takes its colors from the palette, and every kind of world has its own; the hangar's door is cut out with clear sky behind the title; the painter draws every scene and restores what it saves; the backdrop falls away at the lift-off and rises at the landing; a frame draws only what shows.
  - Two new cases in `tests/data.test.js`: a scene not drawn.
- **The title,** measured on the canvas in the browser:
  - the title 7.1 to 7.7 to 1;
  - the tag line 8.4 to 9.2;
  - the note on its ground 12.8.

  All but the brightest 1% of the pixels behind the words count; the rest are stars drifting by.
- **The lift-off and the landing:** by touch, below; the backdrop's moments in `tests/scenes.test.js`.
- **Reduced motion:** the still moment, the same frame 0.7 s later, by touch.
- **Frame budget:** above, and the table under Measured.
- **The companions:**
  - `tests/bust.test.js` (5 tests): each companion's bust is well formed at both crops, the same each time, in their trim and their side's color, and more drawn than their badge; every clothes and gear draws its own way, each with each; the patch shows unless the gear carries the side's color; every choice in every layer of a face draws in a bust; ids are the drawing's own; unknown choices fall back.
  - `tests/companionText.test.js` gains one: their face is the bust on the crew card, the squad pickers and the trip's, and anyone else's the helmet.
  - Three new cases in `tests/data.test.js`.
- **Saves:** unchanged at v29. The scenes come from the act and the world's kind, the busts from the companion's id.
- **Offline:** nothing new to fetch; `sw.js` lists the new files. Checked by reloading offline.
- **Touch:** `m34/verify.mjs`, 39 checks at each of the three sizes. All pass.

**Measured** (scratchpad `m34/budget.mjs`): what a scene adds to a frame, in ms. Each frame is finished with a one-pixel read, so the time is the drawing's and not just its recording. Means first, 95th percentile in brackets.

| Size | Title's hangar | Lift-off and landings, over a bare frame | Over main's space | The still frame (once) |
| --- | --- | --- | --- | --- |
| 905 × 370 | 0.56 | 1.6 to 2.4 (1.7 to 1.9) | −3.0 to −3.4 | 3.8 to 4.1 |
| 821 × 283 | 0.44 | 1.3 to 1.9 (1.2 to 1.6) | −2.1 to −2.4 | 2.6 to 3.0 |
| 960 × 825 | 1.44 | 2.8 to 3.6 (3.6 to 5.8) | −7.2 to −8.2 | 8.9 to 9.7 |

Before the backdrop drew only what shows, a moving frame cost 3.8 to 4.4 ms at 905 × 370 and 8 to 11.5 unfolded. The scaled ground's smoothing was nearly all of it.

**Verified:**
- `node --test`: 933 tests pass.
- `m34/verify.mjs` at the three sizes:
  - the title over the hangar, its words' contrast, its buttons;
  - the lift-off: ground under the ship on the pad, the rock seen whole at the end, 60 frames a second;
  - a landing on each of the five kinds, each ground its own;
  - reduced motion, both ways;
  - Teo's offer with his bust beside the words in all three states, every choice in sight;
  - his face crop on the crew card and the colony trip's squad picker, everyone else in helmets, and his fight button the badge;
  - saves at v29, offline, and no console errors.
- **Every earlier milestone's browser check** passes, one after another at the three sizes (`m34/regress.sh`), M33c's to M8's. Three things to know:
  - **M33c's copy is adapted for M34:** the offer's face is now the bust.
  - **M14's copy is adapted too:** a new game's seed is random, so a crew member can reach rank 1 before the third job, and since M32b a ranked unit's button says its rank.
  - **M32b's first copy** still looks for Suppress · 2 and Sedate · 2, as it has since M33; its fix's copy passes in its place.

  The checks that build a save as main made it (M31's to M23g's) ran again once their copies of main's code, missing from the scratchpad, were restored at the commits they stood at.

**Known issues:**
- **A scene paints once a size, taking 15 to 130 ms here.** The lift-off and the landing wait for it before they start. Folding or unfolding during one repaints, with a pause.
- **The bust's rim light is an SVG filter** in an image. Chrome draws it; a browser that skipped it would show the bust without its rim.
- **Only Teo's offer was walked by touch.** The four busts are each drawn and checked in `tests/bust.test.js`, and previewed together (scratchpad `m34/shots/busts.png`).

**What Evan should test on the phone:**
- **The title** on both screens: the hangar, the stars through its door, the words easy to read.
- **A lift-off** (end act 1): the pad close under the ship, the ground falling away as it climbs, the grey rock seen whole. Watch for stutter, unfolded most of all.
- **A landing** on a world: the world seen whole as the ship comes in, then its ground. If you can, try two kinds.
- **A companion's offer:** the bust beside the words. Tap a choice, then sign them on; the bust should stay in sight on the cover screen.
- **The face crops:** the crew card, and the squad picker at the colony.
- **Reduced motion** (Settings): both sequences still.

**Next session's first task:** M35 Audio pass with ZzFX, the last of Phase 6's drafts. Settle its Done when with Evan first: which sounds, a mute and a volume in the settings, and audio starting after the first tap. ZzFX is approved for M35, and needs its line in `assets/LICENSES.md` before it is committed.

## M33c Companions (2026-10-16)

**Status:** done, and the ROADMAP.md box is ticked. Four companions, one for each side, each met at the end of their side's chain on the run and brought aboard in a free berth. Joining opens their loyalty quest: a ship within reach of the colony, held by someone from their past. Won, they are loyal, and their job's order is at a third rank, their talent, in every fight after.

| Companion | Side, job | Chain: started by, then the step | Loyalty place | Talent, over rank 2's |
| --- | --- | --- | --- | --- |
| Ines Varga | the Fleet, engineer | lending the tender a hand; the stolen stores pod | the pirates' cutter | Bosun's weld: a door shut 8 rounds, against 5 |
| Teo Brandt | the union, quartermaster | paying into the strike fund; the hall's food run | the strikebreakers' tug | Steward's kit: +2 armor, against +1 |
| Ama Osei | Con-Reg, scout | towing the survey skiff; the surveyor's lifepod | the survey chief's tug | Surveyor's eye: +30 to hit, against +20 |
| Dez Halloran | the Hallorans, medic | calling the drop in; the family's runner | the family's runner | Family medicine: 8 hit points, against 5 |

**How it was picked:** Evan answered four questions at the start (2026-10-16), each with the recommended answer:
- **Who and where:** one companion for each side, met on the run at that side's event. The union's, Con-Reg's and the Hallorans' chains, in §9 since M33b, come now.
- **When they come aboard:** at the chain's end, given a free berth, as a recruit needs one. Their loyalty quest follows.
- **What loyalty earns:** their talent past rank 2, a third rank of their job's order with numbers of their own.
- **Where the loyalty quest is done:** a place at the colony, a ship held by someone from their past, as a thread's act 3 step.

**Evan's call, after the merge (2026-10-16): keep it** ("Keep stricter rule"). The test players' rule for companions is stricter than the Done when's words. Signing a companion on wherever a berth was free, and starting every chain whose price left the buffer, 100 voyages from each start ended fed in 47, 53 and 81 against M33b's 73, 90 and 98, and met the hunters in 61, 37 and 34 against 37, 21 and 14: all six of those bars broken, by 16 to 37. A fourth mouth empties the miner's and the deserter's 30 supplies in 7 jumps (the smuggler's ship carries 60 or 70), and the chains' steps cost detours. So the test players now:
- sign a companion on only where the holds would feed them for 10 jumps, their lockers counted, the rule they already had for recruits;
- start a side's chain only for that, or (as M33b had it for the Fleet) where it would make friends with a side whose patrols then wave the ship through;
- start one side's chain at a time. With bunks aboard, a berth for each, it chased three at once, and the crew it signed on went hungry.

The game itself is as the Done when has it: anyone can sign a companion on wherever a berth is free.

Calls I made, each easy to change (all data but the test players' rules and the screens):
- **The companions and their words** above, in `data/companions.json`, the chains and loyalty quests in `data/quests.json` and the events in `data/events.json`. Signing on costs what the other choice at the step pays: Varga in place of the 25-credit fee; Teo, the local's 10 credits; Ama, the 20 credits her survey lines would fetch; Dez, three of the Hallorans' four points (the family wants him back).
- **The loyalty places' crews:** the cutter, the pod thieves (two pirates and a brute); the strikebreakers' tug, two hired heavies and a company guard; the survey chief's tug, his guards; the family's runner, the collectors.
- **A loyal companion's job still ranks by fights** for what it does aboard and at the colony (Varga's Running repairs at 8 fights, as anyone's). Only the order is the talent's.
- **The crew card at the colony,** opened from the crew in its panel: the colony had only a list of names, and companions turn loyal there.
- **What the crew eats** on the choice that signs a companion on, as on a recruit's Sign on.

Done when (ROADMAP.md, M33c, in full there):
- **Companions as data,** validated.
- **Each joins through their side's chain:** the chain's start, its step, a choice with them and one without, left and gone cold.
- **The four.**
- **Loyalty:** the loyalty quest, its place, the win, and a companion let go.
- **Shown** (Law 4).
- **Saves:** `SAVE_VERSION` 29, with a migration from 28.
- **Every rule tested.**
- **The test players** start chains, sign companions on and fly to their places.
- **Balance:** the voyage no worse than M33b's by more than 15 on each bar; each companion met, aboard and loyal reported; each talent measured against rank 2; act 1 untouched.
- **Touch** at the three sizes.

How each is met:
- **Companions as data:** `data/companions.json`, checked by `tools/validate-companions.js` (run by `validate-data.js`): a name, a side (one companion a side), a job, two traits, the fights stood, a face `looks.js` draws, a past, a chain of their own side whose step has one choice that signs them on and does the step, a loyalty quest marked for them, and a talent whose numbers are rank 2's or sharper, one of them sharper, each within its order's range. No other event may sign anyone on. 20 new cases in `tests/data.test.js`.
- **The chains, loyalty and the third rank:** `tests/companions.test.js` (7 tests): each chain's start and its step in the next sector; signing on with a berth (their name, job, traits, fights and face, at full health, the loyalty quest open) and without one (refused, the step still done without them, ended or left); the loyalty place, held, lost and won; the talent's order in a fight for each of the four, and Dez's Patch healing 8 where rank 1's heals 5; a companion let go; the migration and the checks.
- **Shown:** `tests/companionText.test.js` (6 tests): the event card's companion and the choice's berth and food; the result; the crew card on the run and at the colony, loyal and not; the Quests panel; the loyalty place and its win; the unit's card in a fight, and the three chevrons. By touch, below.
- **Saves:** v29 reads a v28 save as it is: nobody aboard was a companion yet.
- **The test players:** `tests/voyage.test.js`'s new test: over 100 voyages from each start, each companion signs on in some run, only at their chain's step and never before the launch, one side's chain at a time, and the loyal have won their place. `tools/voyage.js` reports who was met, signed on and loyal.
- **Balance and touch:** under Verified.

Some of this changes what was there before:
- **The sides' events** start chains: the strike fund, the survey skiff's tow and the Halloran drop's call, as the tender's help did in M33b; their steps come in the sectors after.
- **The tender's stores pod** has a choice more: tag it and sign Varga on.
- **The colony's places** list a loyalty place for each companion aboard, beside the thread's.
- **The crew card** opens at the colony; a companion's row has their side, past and loyalty; a loyal one's rank is the third wherever ranks show.
- **`SAVE_VERSION` 29.**
- **The test players** (above), and so the test voyages from launch.
- **Tests changed on purpose:**
  - `expeditions`, `makers`, `orders`, `raids`, `ranks`, `standing`: `SAVE_VERSION` 29;
  - `data`: the validator's counts ("4 companions") and the new cases; `questText`: the tender's step's words; `harness`: `--compare` names `--talent`;
  - `voyage`: three checks moved from 24 fed in 30 to a rate over 100 seeds, held within 15 of main's (fed with a cargo hold, bunks and the large hold: main 90, 90 and 98), as CLAUDE.md asks; the step check takes what the holds carried from the voyage, a companion's lockers counted from the step they sign on; the M33b test no longer holds that the deserter never starts the Fleet's chain: from M33c it may, for Varga.

### Shipped

- **Data:** `companions.json` (new): the four; `quests.json`: the union's, Con-Reg's and the Hallorans' chains, the Fleet's chain's step done by signing Varga on too, and the four loyalty quests with their places; `events.json`: the food run, the lifepod and the runner, and the stores pod's choice that signs Varga on; `encounters.json`: the pod thieves and the strikebreakers.
- **The sim:**
  - `companions.js` (new): who a companion is, who is aboard, the free berths, signing on (with their loyalty quest), loyalty;
  - `talents.js` (new): the third rank, rank 2's order with the talent's numbers over it;
  - `events.js`: the `joins` effect and the `berth` need; `quests.js`: a loyalty quest done makes them loyal; `recruits.js`: letting a companion go ends their loyalty quest;
  - `campaign.js`, `battle.js`, `orders.js`: a loyal companion fights at the third rank with their talent; `campaign.js`, `battleShape.js`, `runShape.js`: the new fields checked.
- **Saves:** `SAVE_VERSION` 29, a migration from 28 that leaves the save as it is.
- **The screens:**
  - `companionText.js` (new): the companion's card, the choice's words, signing on, loyalty;
  - `eventText.js`, `eventCard.js`: the companion offering to come aboard, the berth and the food on the choice, who signed on;
  - `crewText.js`, `crewCard.js`, `crewJobText.js`: side, past and loyalty on the crew card, the shown rank (the third, loyal) and its words; the card's words at the colony;
  - `colony.js`: the crew card at the colony;
  - `questText.js`: the chains' and loyalty quests' lines, and the loyal line at the fight's end and the homecoming;
  - `hints.js`: the talent named on the unit's card, its numbers on the order's line; `icons.js`: three chevrons;
  - `style.css`: the event card's companion, the loyalty line, the colony's grid placed for the card.
- **Tools:** `validate-companions.js` (new); `voyagePlan.js`: the test players' rules for chains and companions; `voyage.js`: companions met, signed on and loyal in the report, what the holds carried each step, the thread's pay-off not a loyalty place's; `sim.js`: `--talent <companion>`.
- **Docs:** ROADMAP.md §4.10 and §4.11 (new), M33c ticked and as built, §9 (the companions and the other sides' chains out; four new lines in); CLAUDE.md's data, sim and tools lists.

### Verified

- **`node --test`:** 918 pass (903 on main). `node tools/validate-data.js`: OK (4 companions, 11 quests). The golden files are unchanged.
- **`node tools/sim.js`** (run because `battle.js` changed; no number in `data/balance.json` did): identical to main's but for the time taken.
- **Act 1 untouched:** each start's launch from seeds 1 to 100 is main's to the byte, 300 of 300.
- **The voyage, 100 seeds** (`node tools/voyage.js --runs 100 --background all`), M33b's in brackets, against the Done when's limit (no worse by more than 15):

  | Background | Fed | Met the hunters | Runs with a raid lost |
  | --- | --- | --- | --- |
  | Debt-bound miner | 68 (73) | 42 (37) | 18 (21) |
  | Navy deserter | 82 (90) | 26 (21) | 12 (13) |
  | Burned smuggler | 88 (98) | 28 (14) | 7 (11) |

  The smuggler meets the hunters in 14 more runs of 100, 1 inside the limit.
- **The companions, the same voyages:** signed on in 21, 19 and 56 voyages (two in one of the smuggler's), loyal by the end in 8, 7 and 29. Each, met at their chain's step · signed on · loyal by the end:

  | Companion | Debt-bound miner | Navy deserter | Burned smuggler |
  | --- | --- | --- | --- |
  | Ines Varga | 27 · 1 · 0 | 2 · 2 · 2 | 14 · 10 · 6 |
  | Teo Brandt | 18 · 17 · 7 | 17 · 16 · 4 | 6 · 4 · 0 |
  | Ama Osei | 1 · 1 · 0 | 0 · 0 · 0 | 28 · 22 · 12 |
  | Dez Halloran | 2 · 2 · 1 | 2 · 1 · 1 | 24 · 21 · 11 |

  The miner starts the Fleet's chain in 30 voyages, and a patrol waves it through in 14 (18 times). It signs Varga on in 1 of the 27 where it meets her: the test player signs a companion on only with a berth free and the holds to feed them for 10 jumps.
- **The talents** (`node tools/sim.js --talent <companion> --compare`, 1,000 fights each on the ten ships, against the same squad with every order at rank 2), the crew's wins:

  | Talent | Rank 2 | With it | Orders a fight |
  | --- | --- | --- | --- |
  | Bosun's weld (Varga) | 51% | 51% | weld 0.2 → 0.2 |
  | Steward's kit (Teo) | 47% | 75% | kit 2.8 → 2.7 |
  | Surveyor's eye (Ama) | 41% | 45% | mark 1.6 → 1.7 |
  | Family medicine (Dez) | 51% | 53% | patch 0.7 → 0.4 |

  Teo's and Ama's squads have their job in place of the engineer (`--squad marine,quartermaster,medic` and `marine,scout,medic`).
- **The voyage tests** pass. Changed on purpose: three checks the companions broke on seeds 1 to 30 (24 or more of 30 fed with a cargo hold, with bunks, with the large hold) are rates over 100 seeds held within 15 of main's 90, 90 and 98: now 76, 75 and 93. Bunks sit on the limit. The step check takes what the holds carried from the voyage; the M33b test's deserter may start the Fleet's chain, for Varga. New: over 100 voyages from each start, each companion signs on in some voyage, only at their chain's step and after the launch, one side's chain at a time, and the loyal have won their place.
- **By touch** (`m33c/verify.mjs`, at 905 × 370, 821 × 283 and 960 × 825): 38 of 38 at each size:
  - the strike fund's first tap starting the hall's food run, its result, the chart's quests; no face on that card;
  - the food run: Teo's face, name, side, job and past, read out whole; the choice taking a berth, 1 free; its first tap with what the crew eats, in sight under his past; signed on, the chain done and his loyalty quest open, his face still on the card; the crew panel and quests after; with no berth free, the choice refused and saying why;
  - his crew card on the run: face, side and job, past, rank 1 and what loyalty would earn; Done shuts it;
  - the colony: his place named for his quest and held; flown to, who holds her; boarded and won, the fight's end saying he is loyal; home, the report and the quests;
  - the colony's crew card: three chevrons, rank 3 by his talent and its numbers; over the panel and the ground, which take no taps under it; Done shuts it;
  - a quit and reopen, Teo still loyal; offline, reloaded;
  - a fight: three chevrons on his button and in its name, Kit out · 3, its preview with +2 armor;
  - every button 48 px or more on the event card, the crew cards and in the fight; no console errors.
- **Every earlier milestone's browser check** passes, run one after another (`m33c/regress.sh`), at the three sizes unless named:
  - M33b's 43, the M33 fix's 38, M32b's fixes 27, M32 22 and its orders 48, M31 28, M30 27, M29 34, M28 32, M27 32, M26 18, M25 21, M24 20, M23h 16, M23g 20, M23f 28, M23e 27, M23d 25, M23c 25, M23 36, M23b 8;
  - M22 35, M21 32, M19 52, M20 32;
  - M18 43, M17 37, M16 29, M15 30;
  - M10 20 (its three sizes in one run), and M8's fights and column;
  - at 905 × 370 only: M14's saves 10, M13 24, M14 40 and M8's extras (the cache holds all 246 files; offline, the fight sandbox and the builder open). M14 plays jobs until it has played each kind, so its count moves with the jobs it takes: 43 in the dev tools' run.

  Five copies were adapted, not the game (`verify33c.mjs`): M31's, M30's, M29's, M28's and M27's expect a save made by main to be saved again as v29, not v28.

  M32b's first copy still looks for Suppress · 2 and Sedate · 2, as in M33's entry; its fix's copy passes in its place.

### Known issues

- **Teo's Steward's kit is strong:** with it the squad wins 75% of the harness's fights against 47% at rank 2. Kit's armor is a whole number, so +2 is the least past rank 2's +1. Varga's Bosun's weld changes nothing the AI notices: it welds 0.2 times a fight. Both in §9, for Phase 7's balance runs.
- **A chain started in act 2's last sector goes cold as the ship leaves:** its step comes from the next sector on. The last jump point's plan says so; the start's first tap doesn't (§9).
- **Companions rarely sign on in the miner's and deserter's test voyages** but Teo, whose lockers carry him: a fourth mouth needs holds for 10 jumps. A player can sign anyone on wherever a berth is free; the holds are theirs to watch (§9).
- **The squad at a loyalty place needn't have the companion in it** (§9).
- **At 821 × 283 a companion's row on the crew card is taller than the list:** with the card's words above it, it reads in two swipes, the name and face, then the past and loyalty.

### Test on the phone

1. On the run, take a side's event that starts a chain (the co-op barge's strike fund, the survey skiff's tow, the Halloran drop's call, or the Fleet tender's help): its first tap says it starts a quest, and the Quests panel shows it.
2. In the next sector, at the chain's marked node, the companion's face, name, side, job and past show on the card. The choice that signs them on says it takes a berth, and its first tap what the crew eats. Sign them on: the crew panel has four.
3. Tap the crew panel: their row has their past and what loyalty earns.
4. Settle; at the colony their place is in the list, named for their quest and held. Fly out with a full squad, board her and win: the fight's end says they are loyal.
5. Tap the crew in the colony's panel: the crew card shows three chevrons on their face and their talent's numbers. In the next fight, their button has three chevrons, and their order's preview uses the talent's number.

### Next session

M34 Image pass: settle its Done when with Evan (its draft names the companions among the portraits to paint), then build it. First, Evan's call on the test players' companion rule above.

## Dev tools: cheats and God mode (2026-10-16)

Evan: "Before the next milestone, add dev tools like adding currency, God mode, etc." A **Cheats** section in the `?dev=1` menu, under Sandboxes. Its top line says where the campaign stands (act, credits, heat, crew, supplies or food and materials, in a fight). Each button plays its cheat on the campaign where it is, and the line under the buttons says what it did ("Credits 0 → 1000.") or why it didn't ("Not in a fight: win it first.").

| Button | What it does |
| --- | --- |
| God mode | The crew takes no damage in fights: a hit does 0, and fire and vacuum leave them be. The ship takes none in approaches: her hits are taken whole. Kept on this device, never in a save; the DEV button reads GOD while it is on |
| +100 / +1,000 credits | Credits |
| Heat −25 / +25 | The pursuer's heat, within 0 and 100 |
| Heal crew | Everyone to full hit points |
| Rank up crew | Everyone on to their job's next rank, by the fights it asks for |
| Parts for checks | The parts the ship's checks still ask for, on hand |
| Fill supplies | The holds on the run; food and materials at the colony, to its stores |
| Standing +5 / −5 | With every side |
| Do quest step | Each quest's step open in this act, done with its effects and pay-off; at the colony, its place comes off the list |
| Win the fight | Two taps: every enemy left dies, the fight opens again won, and Continue pays as for any win |

How it's built:
- **The cheats are sim functions** (`src/sim/dev.js`), played through one action, `dev/cheat` (`src/sim/root.js`). Each keeps the save readable.
- **Heal, Rank up and Do quest step wait for a fight to end.** A fight's crew carries its own hit points until the end, and a quest job's end does a step of its own: done mid-fight, the job's win would do the next step too.
- **God mode is not in the save.** It is a switch the loaded content carries to the simulation as `rules.dev` (`src/platform/content.js`, `src/sim/god.js`). `battle.js` and `approach.js` read it; every test and tool plays without it. With it off nothing changes: golden files, `tools/sim.js` and the 893 tests before it pass as they were.
- **Every roll is still made** with God mode on, so turning it on mid-fight rerolls nothing.
- **Win the fight opens the fight again** (`main.js` reopen): the fight screen reads its battle only as it opens.
- **The menu's DOM pieces** moved to `src/ui/dev/dom.js`, for the menu and `src/ui/dev/cheats.js`.

### Verified

- **`node --test`:** 903 pass (893 on main), 10 of them new in `tests/dev.test.js`:
  - a siege played with God mode and without: the same shots rolled the same, the crew hit for 0, no fire or vacuum damage, the enemy hurt as ever, the same RNG at the end;
  - an approach: her hits taken whole, nothing on the ship damaged or wrecked, the opening volley likewise;
  - each cheat, its bounds and refusals, the save readable after each;
  - Win, and its end paying as for any win;
  - the `dev/cheat` action.
- **By touch** (`devtools/verify.mjs`, at 905 × 370, 821 × 283 and 960 × 825): 40 of 40 at each size. It covers:
  - every cheat at the hangar, the hangar behind showing what changed;
  - God mode on, the DEV button reading GOD, kept on reload and out of the save;
  - a job's fight in God mode: 4 rounds, the enemy hitting the crew 3 times for 0, the crew's hit points as they began;
  - Win the fight from the menu, then Continue, paid;
  - Fill supplies on the run and at the colony;
  - an approach in God mode: her hit taken whole;
  - God mode off;
  - offline, a cheat played with the server stopped;
  - every dev menu button 48 px or more;
  - no console errors.
- **Every earlier milestone's browser check** passes, run one after another (`devtools/regress.sh`), at the three sizes unless named, no copy adapted:
  - M33b's 43, the M33 fix's 38, M32b's fixes 27, M32 22 and its orders 48, M31 28, M30 27 (at 821 × 283 it stopped on a timeout with the machine busy, then passed 27 of 27 run alone), M29 34, M28 32, M27 32, M26 18, M25 21, M24 20, M23h 16, M23g 20, M23f 28, M23e 27, M23d 25, M23c 25, M23 36, M23b 8;
  - M22 35, M21 32, M19 52, M20 32;
  - M18 43, M17 37, M16 29, M15 30;
  - M10 20 (its three sizes in one run), and M8's fights and column;
  - at 905 × 370 only: M14's saves 10, M13 24, M14 43 and M8's extras (the cache holds all 242 files; offline, the fight sandbox and the builder open).

  M32b's first copy still looks for Suppress · 2 and Sedate · 2, as in M33's entry; its fix's copy passes in its place.

### Known issues

- **God mode stops at fights and approaches.** A hungry jump or day and an event's wound still take hit points (never below 1).
- **Construction mode doesn't see parts added while it is open:** it reads the parts on hand as it opens. Leave it and come back.
- **A quest step done by cheat leaves its event on the chart** where it was placed. Played there, the event gives its own effects and does nothing to the quest.

### Test on the phone

1. Open with `?dev=1`, start or continue a campaign, open the DEV menu: **Cheats** sits under Sandboxes. Tap +1,000 credits: the line says Credits n → n+1000, and the hangar shows it.
2. Turn **God mode** on: the DEV button reads GOD. In a fight the enemy's hits land for 0. Turn it off again.
3. In a fight, tap **Win the fight** twice: the menu shuts, the fight shows Job done (or its kind's win), and Continue pays.
4. On the run, **Fill supplies**; at the colony, it fills food and materials.

### Next session

M33c Companions, its Done when settled with Evan (2026-10-16, ROADMAP.md): build it.

## M33b Quests (2026-10-16)

**Status:** done, and the ROADMAP.md box is ticked. Each background has a thread with a step in each act, and the Fleet has a chain that starts at its tender. A thread finished at the colony eases its pursuer off: heat −30, its side raised to cold, and its raids find the colony at half the odds. A step not done in its act ends its quest.

| Quest | Act 1: a job | The run: an event | The colony: a place |
| --- | --- | --- | --- |
| The miner's debt | Rook's, at Depot 4: heat −20 | Con-Reg's courier: heat −15 (a wound one time in four) | Con-Reg's claims tender, Recovery's crew aboard |
| The deserter's pardon | Mother Ilse's, at the Brig: heat −20 | the Resolute: 20 credits, heat −15, the Fleet +4 | the Provost's courier, its patrol aboard |
| The smuggler's cargo | Ferris's, at the customs pound: heat −20 | the lost cargo: heat −15, the Hallorans +4 | the Hallorans' runner, collectors aboard |
| The tender's stores (the Fleet's) | | the stolen stores pod: tagged, 25 credits and the Fleet +4, done; stripped, 8 supplies, 10 credits and the Fleet −2, gone cold | |

**How it was picked:** Evan answered four questions at the start (2026-10-16), each with the recommended answer:
- **Scope:** each background's thread, a step in each act, and the Fleet's chain, started at its tender: the way to the wave M33's fix moved here. The other sides' chains went to §9.
- **A thread's pay-off,** at the colony: the pursuer eases off. Its raids find the colony at half the odds, heat falls 30, and standing with its side rises to cold.
- **A missed step:** the trail goes cold. Launch, and leaving the last sector, say so first.
- **The miner's voyages** (the M33 fix's known issue): on to quests, measured against the fix's numbers.

And two at the end (2026-10-16), each with the recommended answer:
- **The voyage measured over 100 seeds,** not 30. Every number passed the 30-seed limits but the miner's fed (19 against the fix's 26). The quest job changes act 1's jobs and so the campaign's rolls at launch, so each seed is a different voyage from there on: seeds 1 to 30 compare unrelated voyages. Over 100 seeds every start is within 15 of the fix's.
- **M30's voyage check held no worse than main's,** not about the same. The deserter meets the hunters in 21 runs of 100 against main's 45: its thread takes 35 heat off a pursuer who takes no payments.

Calls I made, each easy to change (all data but the test players' rules):
- **The quests' words and numbers** above, in `data/quests.json`, `data/contracts.json` (three jobs marked `quest`) and `data/events.json` (four events marked `quest`, and the tender's help now mentions the stolen pod).
- **A quest's job** is offered above the board while its step is open, rolled from the campaign's seed, the quest and the jobs done and lost so far. The offer holds until a job is done or lost, and the board's own rolls are as before.
- **Where a quest's event goes:** on a node of its own kind in each sector the ship enters while the step is open, else an empty node, else any event's node; never the way in, the jump point, a station, a nebula or a hostile ship. It is seeded from the campaign, the quest and the sector, so the rest of the sector rolls as before.
- **The places' crews:** each pursuer's ship is held by her own boarding crew of three: Recovery's at the claims tender, the collectors at the runner, and the Provost's patrol (two MPs) at the courier. The colony's raiding parties, as first written (three to five fighters), were much harder than a derelict. With the courier's own boarding party (two MPs and a rating) the deserter won 24% of its fights there; with the patrol it wins 58%, against 61% at the hulks the squatters hold.
- **The Resolute's spares** cost 20 credits. At 40 the deserter's run step went cold in 26 voyages of 100, the ship short of the credits when it got there; at 20, in 8.
- **The marks:** a small diamond in the good color at a quest node's upper left, until its event is settled; on the board, the quest's name on its job and an accent edge.
- **The test players** (below).

Done when (ROADMAP.md, M33b, in full there):
- **Quests as data,** validated, each step in its act: a job, an event, a place.
- **The threads** and **the pay-off**, **the Fleet's chain**, **the trail going cold.**
- **Shown** (Law 4).
- **Saves:** `SAVE_VERSION` 28, with a migration from 27.
- **Every rule tested.**
- **The test players** take the steps.
- **Balance:** act 1 within 10 minutes of the fix's; the voyage no worse than the fix's over 100 seeds by more than 15; the quests reported; a patrol's wave in some voyages; the voyage tests passing.
- **Touch** at the three sizes.

How each is met:
- **Quests as data:** `data/quests.json`, checked by `tools/validate-quests.js` (run by `validate-data.js`); 15 new cases in `tests/data.test.js`: one thread a background, a side's chain's start on the run, steps in act order with each act's own keys, a step's job or event marked for its quest and every marked one named, an act 2 event with a choice that leaves it, a place's ship, crew and numbers, a pay-off's standing a level.
- **The threads, the pay-off, the chain and the cold rule:** `tests/quests.test.js` (10 tests): each kind of step done and missed, the cold rule at the launch and as the ship leaves the last sector, the pay-off's heat, standing and odds, the Fleet's start and both its ends, the quest job off the rotation with the board's rolls as before, the event's placing (seeded, on the charts, again in the next sector), the place kept until done, and the migration.
- **Shown:** `tests/questText.test.js` (5 tests) and the screens' text tests; by touch, below.
- **Saves:** `tests/quests.test.js`: a v27 campaign gets its background's thread at its act's step, none gone cold, the Fleet's chain not started; broken quests caught.
- **The test players:** `tests/run.test.js` (every act 1 run launches with its thread's job done, some taken only once the ship is ready) and `tests/voyage.test.js`'s new test (below).
- **Balance and touch:** under Verified.

Some of this changes what was there before:
- **The board** lists the quest's job first while its step is open, above the three.
- **The sectors:** while a run's step is open, one node of each sector entered is the quest's. So the voyages roll differently from launch, and act 1's runs launch differently.
- **The colony's places:** the quest's place is listed after those rolled, within the six.
- **Launch's first tap** and the last jump point's plan name the quests they would end.
- **The colony's raid odds** are halved once the thread is done; heat falls 30 and the pursuer's side rises to cold.
- **`SAVE_VERSION` 28.**
- **The test players** take the steps (below).
- **Tests changed on purpose:**
  - `campaign`, `expeditions`, `makers`, `orders`, `raids`, `ranks` and `standing`: `SAVE_VERSION` 28, and the quests where a whole campaign is compared;
  - `contracts`, `sector`, `voyage`: the quests' own jobs and events left out of the rotation, the pools and the run's events;
  - `system`, `travel`: the leave plan's `cold`;
  - `expeditions`, `raids`: an old save's colony gets its thread at the place, and the place after the rolled ones;
  - `launchText`: Launch's ask warns of the debt;
  - `data`: the validator's counts ("4 quests") and the new cases;
  - `run`, `voyage`: below.

### Shipped

- **Data:** `quests.json` (new): the three threads and the Fleet's chain, each with a name, a line and its steps, and the threads' pay-off; `contracts.json`: Losing the paper, The warrant and Forty crates, each marked for its quest; `events.json`: the courier, the Resolute, the lost cargo and the stores pod, each marked for its quest, and the tender's help pointing at the pod; `balance.json`: `easedOdds` 50.
- **The sim:**
  - `quests.js` (new): the open steps, the quest jobs, a step done (its effects, then the next or the pay-off), going cold, the quest nodes placed on each new sector, an event's choice settling a step, the quest places and who holds them, and the eased odds;
  - `questShape.js` (new): a campaign's quests and a quest's note read and checked;
  - `contracts.js`: `takeQuestJob`; a quest job won does its step;
  - `travel.js`: the quest nodes on the run's sectors, on the charts; the last sector's leave plan names the quests it would end, and leaving ends them;
  - `events.js`: a choice's note on its quest; `launch.js`: act 1's steps go cold; `expeditions.js`: the quest's place beside the rolled ones, held by its crew, its win the pay-off; `raids.js`: the eased odds; `standing.js`: `floorOf`;
  - `campaign.js`, `runShape.js`, `tripShape.js`, `root.js`: the quests in a new campaign, in its checks and in the actions.
- **Saves:** `SAVE_VERSION` 28. The migration from 27 gives a campaign its background's thread at its act's step: act 1's job; the run's event, from the next sector, or the colony's place once the ship is past the charts; none gone cold, and the Fleet's chain not started.
- **The words** (`src/ui/campaign/questText.js`, new): the Quests panel at the hangar, on the chart and at the colony; a quest job's tag and its Quest fact; a step's words at a fight's end; what came of a quest at an event, a fight's end and the homecoming; each choice's first tap at a quest's node or the tender; a quest node's and place's lines; the eased odds; the warnings.
- **The screens:** the panels (`hangar.js`, `sector.js`, `colony.js`); the board's quest job first, tagged (`jobs.js`); the chart's diamond and the node's label (`sector.js`); the fight's end (`fight.js`); the event card (`eventCard.js`); the places and the trip (`tripText.js`); the raid odds in the needs (`raidText.js`) and Next day's first tap (`colonyText.js`).
- **Tools:**
  - `run.js`: the thread's job weighed by its pay and the heat its step takes off at a payment's price (the deserter's at the cheapest any pursuer takes), and taken before launching in any case; the summary says when and in how many tries;
  - `voyagePlan.js`: a choice that does a quest's step is worth 40 credits, one that ends it −40; on the way a quest's node counts at the share of the act's sectors gone; the tender gets a hand where the chain would leave the crew friendly with the Fleet and the holds keep 4 jumps' worth after it; the colony's quest place is flown to first of the held;
  - `voyage.js`: what came of each quest on the way, the colony's daily odds of being found and the pay-off's day, and a quests line per start in `--background all`.
- **Tests:** `quests.test.js` and `questText.test.js` (new), the validator's cases, and the changes above.
- **Docs:** ROADMAP.md §4.10 (new: quests as built), §4.9 (the pay-off's standing and the Fleet's wave), M33b's entry (Evan's two calls at the end, the smuggler's job site put right, as built).

### Verified

- **`node --test`:** 893 pass (877 on main). `node tools/validate-data.js`: OK (4 quests). The golden files are unchanged.
- **`node tools/sim.js`** (run because `data/balance.json` gained `easedOdds`; no number a fight uses changed): identical to main's but for the time taken.
- **Act 1** (`node tools/run.js --runs 50 --background …`): every run launches with its thread's job done, at job 3, 3 and 2 at the median (1 to 7), the first try in nearly all (at most 3); 3, 7 and 6 runs take it only once the ship is ready. Slow medians 41, 42 and 47 minutes against the fix's 42, 40 and 45.
- **The voyage, 100 seeds** (`tools/voyage.js`), the fix's over the same seeds in brackets, against the Done when's limit (no worse by more than 15):

  | Background | Fed | Met the hunters | Runs with a raid lost |
  | --- | --- | --- | --- |
  | Debt-bound miner | 73 (84) | 37 (45) | 21 (25) |
  | Navy deserter | 90 (88) | 21 (36) | 13 (11) |
  | Burned smuggler | 98 (92) | 14 (18) | 11 (14) |

  On seeds 1 to 30 (`--background all`), the fix's in brackets: the miner 19 (26), 14 (15) and 6 (6); the deserter 28 (27), 4 (10) and 3 (1); the smuggler 30 (27), 5 (5) and 1 (5).
- **The quests, 100 voyages from each start:**

  | Background | Run step done | Gone cold | Place won (fights) | The Fleet's chain | Waved through |
  | --- | --- | --- | --- | --- | --- |
  | Debt-bound miner | 99 | 1 | 67 (67 of 104) | started 37, done 28 | 14 runs |
  | Navy deserter | 92 | 8 | 61 (61 of 105) | never | none |
  | Burned smuggler | 100 | 0 | 86 (86 of 106) | started 6, done 6 | none |

  The run's step is done in the first sector in 51, 44 and 76 voyages. After the pay-off the colony's odds of being found fall from 2.2, 1.6 and 1.3% a day to 0.1, 0.2 and 0.0%; raids faced before it 44, 35 and 38, after it 2, 3 and 0 (on far fewer days at home: 128, 96 and 106 against 2,014, 1,848 and 2,588).
- **Where the miner's fed went** (300 seeds each): main 248, M33b 228. Two parts:
  - **the reshuffle:** with the quests in play but no quest worth to the player, it is fed in 239. The different launch and the placed quest nodes change every roll after: 39 seeds go fed to hungry against main and 30 the other way, within chance;
  - **the Fleet's chain:** between that player and the final one, 16 seeds go hungry and 5 the other way, and without the tender rule it is fed in 237. Lending a hand costs 3 supplies, and tagging the pod gives up its 8.

  Guarding the help with more held back (8 jumps' worth) feeds the miner in 237 but leaves no wave on seeds 1 to 30, so the player keeps its buffer, 4.
- **The voyage tests** pass. Changed on purpose: the run's events leave out the quests' own; two checks the quests broke on seeds 1 to 30 (the careful player fed without refits, 19; runs with a refit, 12) are rates over 100 seeds against main's before M33b (82 and 69: now 72 and 61); the refitting player's fed, 19 of 30 against M23h's 24, is held over 100 seeds as main's before M31 within 15 (73: now 73); surgery against the med bay over 100 seeds (seeds 1 to 30 had surgery patching 43 to the med bay's 36); M30's check no worse than main's. New: the careful player takes the quests' steps (every launch with the thread's job done, the run's step in 80 or more of 100 from each start, the place won and the odds falling by more than half, the Fleet's chain the miner's and never the deserter's, a patrol's wave, the report's lines).
- **By touch** (`m33b/verify.mjs`, at 905 × 370, 821 × 283 and 960 × 825): 43 of 43 at each size:
  - the debt's job first on the board, tagged, its Quest fact; taken, the quest's fight; done, the step's words and heat at the end; the hangar's quests after; its job off the board; a quit and reopen;
  - Launch's warning; launched, the debt gone cold on the chart's panel;
  - the courier's node marked and named; its first tap's words; each choice's first tap; the result; the mark gone, step 3 of 3;
  - the tender: Lend a hand's first tap, its result, the chain on the panel; the next sector's pod marked; Tag's first tap and result; the chain done, the Fleet 2 to 6;
  - the colony's place, tagged and held; flown to, who is aboard and what a win does; boarded; won, the pay-off at the fight's end; home, the trip's report, the needs' halved odds, the quests done, Next day's first tap with half the odds; a quit and reopen; offline;
  - every button 48 px or more at the hangar, the board, the chart and the colony; no console errors.
- **Every earlier milestone's browser check** passes, run one after another (`m33b/regress.sh`), at the three sizes unless named:
  - the M33 fix's 38, M32b's fixes 27, M32 22 and its orders 48, M31 28, M30 27, M29 34, M28 32, M27 32, M26 18, M25 21, M24 20, M23h 16, M23g 20, M23f 28, M23e 27, M23d 25, M23c 25, M23 36, M23b 8;
  - M22 35, M21 32, M19 52, M20 32;
  - M18 43, M17 37, M16 29, M15 30;
  - M10 20 (its three sizes in one run), and M8's fights and column;
  - at 905 × 370 only: M14's saves 10, M13 24, M14 40 and M8's extras (the cache holds all 238 files; offline, the fight sandbox and the builder open).

  Eight copies were adapted, not the game (`verify33b.mjs`, and M14's `saves33b.mjs`):
  - M31's, M30's, M29's, M28's and M27's expect a save made by main to be saved again as v28, not v27; M28's also expects the debt's place after the three places rolled;
  - the M33 fix's, M15's and M14's two tap or count the board's own jobs, the debt's job heading the board now;
  - M17's expects Launch's first tap to warn of the debt.

  The M33 fix's first copy fails the three checks its new copy changes (the board's first job), and M32b's first copy still looks for Suppress · 2 and Sedate · 2, as in M33's entry.

### Known issues

- **The miner is fed in 73 voyages of 100,** 11 under the fix's 84 (within the 15 Evan's call allows; 19 of 30 on seeds 1 to 30, against 26). About half is the Fleet's chain's price in supplies, by design: lending a hand costs 3 and tagging the pod gives up its 8. The rest is within chance (above). If the chain should cost less, a tagged pod could hand back some supplies as the Fleet's thanks.
- **The deserter's crew is weaker aboard ships** than the others': it wins 61% of its fights at the hulks the squatters hold, against the miner's 78% and the smuggler's 65%, and 58% at the Provost's courier. Its pay-off comes in 61 voyages of 100, against 67 and 86.
- **The deserter's run step goes cold in 8 voyages of 100:** the Resolute's spares cost 20 credits, and the ship sometimes reaches her short of them in every sector.
- **Few days at home after a pay-off:** the place is won about day 33 of the colony's 60, and most days after are spent on trips, so the odds after it are measured over about a hundred days at home a start.
- **The smuggler's Fleet chain rarely starts** (6 of 100) and never brings a wave: act 1's customs jobs leave it hostile with the Fleet, and lending a hand and tagging the pod wouldn't make it friendly, so the test player raids the stores.
- **Earlier milestones' browser checks that read the board by its rows** were adapted (above): the quest's job heads the board now. A check written later that taps the first job will take the quest's.

### Test on the phone

1. **As the miner, open the job board:** the first job is "Losing the paper", tagged "The miner's debt". Do it: the end panel says your file is gone and heat −20 (less if heat was low); the hangar's Quests panel says step 2 of 3.
2. **Launch without doing it** (a new game, the ship ready): Launch's first tap says launching ends the miner's debt. Launch, and the chart's Quests panel says it has gone cold.
3. **On the chart,** a quest's node wears a small green diamond. Tap it: its line names the quest. Jump there: "Find your file"'s first tap says it does step 2 of 3; choose it, and the diamond goes.
4. **At a Fleet tender,** Lend a hand: its first tap says it starts the tender's stores. In the next sector the stolen stores pod is marked; tag it for the Fleet: the Fleet +4, and with the Fleet friendly a patrol waves you through.
5. **At the colony,** the claims tender is listed as the debt's, held. Fly there and board her; win: the end panel says Con-Reg eased off, heat −30, Con-Reg cold. Home, the raid odds in the needs say halved, and Next day's first tap says half the odds.
6. **Leave the last sector** with a step undone: the jump point's plan warns that the quest ends.
7. **An old save** (from before this update) opens with its background's thread at its act's step.

### Next session

M33c Companions (Phase 6). First task: settle its Done when with Evan (ROADMAP.md has a draft: named crew with a face, a past and a loyalty quest built on M33b's chains).

## M33 fixes: docking heat on the trade, the record put right (2026-10-16)

After M33 Evan took all three of my recommendations ("Go with all recommendations", 2026-10-16):
- **Docking heat on the trade, not the jump.** In M33 the jump to a station of the pursuer's side paid its 10 heat, whatever the ship did there, and 21 of the miner's 26 docks with Con-Reg were on a route with no way round. Now the crew's first trade there since the ship arrived pays it. Passing through costs nothing.
- **The record put right.** M33's known issues and ROADMAP.md §9 said the station names and the 10 heat were both Evan's picks. The 10 heat came with his pick (§4.4's number); which stations are whose was my call. M33's known issues also said the smuggler's standing moved only on the run; in act 1 it can fall, from its customs jobs against the Fleet. Both lines are corrected where they stand, each saying what it first said.
- **The Fleet's wave into M33b's Done when**, out of §9.

Calls I made, each easy to change:
- **What counts as a trade:** the five services a station charges for: supplies, a repair, patching, a recruit signed on and the transponder swap. A refit is free and letting crew go pays no one, so neither logs the ship.
- **Once a visit:** the run keeps whether the crew has traded where the ship is (`run.docked`); a jump clears it, so leaving and coming back is a new visit.
- **The swap docks first:** the 10 heat, then the swap's 30 off.
- **The test player** (`tools/voyagePlan.js` tradeHere and stationChoice): managing heat, at a station of the pursuer's side it trades only to swap the transponder (the swap sheds more than the trade adds), or where filling the holds makes the way on better, the trade counted as a hungry jump and its heat as an event's, as M33 counted a dock. Otherwise it passes by and trades nothing there: no supplies, no patching, no repairs, no recruits. Its choice of way counts the same, so a route through a pursuer's station costs nothing unless it would trade there.

### Shipped

- **The rule** (`src/sim/travel.js`): `tradeHeat` (what a trade where the ship is adds) and `dockShip` (the ship docked, with that heat). `buySupplies`, `repairShip` (`repair.js`), `patchCrew` (`patch.js`), `hireRecruit` (`recruits.js`) and `swapTransponder` (`transponder.js`) dock the ship first, and each plan says its `dock`. The jump plan has no `dock` now, and the hunters' odds there are the jump's own heat's.
- **Saves:** `SAVE_VERSION` 27, `run.docked`. The migration from 26 marks a ship sitting at a station of its pursuer's side as docked, since the jump there paid; anywhere else not. The stations' sides and the pursuers are M33's, by name, in the migration.
- **The words:**
  - at a station of the pursuer's side, the panel's line under the side's ("Con-Reg is after you: trade here and they log the ship, heat +10. Passing through costs nothing.", then "Con-Reg has logged the ship: trading on here adds no more heat."), and the hint;
  - each service's first tap ("3 supplies for 5 credits. Con-Reg logs the ship: heat +10 to 40. Tap again to buy."; the swap's "… Then a clean transponder …");
  - the jump plan ahead ("Con-Reg is after you, and this is their station: trading there adds 10 heat. Passing through costs nothing."), in the plan's own tone now, since the jump costs nothing more.
- **Tools:** `voyagePlan.js` (above); `voyage.js` trades by it, records the docking heat on the trade that paid it, and reports the trades with the pursuer and the stations passed by.
- **Tests:**
  - `standing.test.js`: the first trade of each kind pays it once, a second adds none, letting crew go and the jump there add none, a new visit pays again, other sides' and nobody's stations never; the v26 migration at each pursuer's stations and elsewhere, and a broken `docked` caught;
  - `standingText.test.js`: the station's line before and after, every service's first tap, the hint, the jump plan;
  - `voyagePlan.test.js`: rewritten for the rule (when it trades, when it passes by, the ways it picks);
  - `voyage.test.js`: each trade step's docking heat, none on a jump; a new check over 300 careful runs that only a visit's first trade pays it, and that some runs pass a pursuer's station by;
  - `travel.test.js`, `regroup.test.js`: the plans' shapes; six tests' `SAVE_VERSION` 27.
- **Docs:** ROADMAP.md §4.4 (the rule), §4.9 (what shows, the balance), M33's entry (fixed after it), M33b's draft (the Fleet's wave), §9 (the miner's item rewritten, the Fleet's moved out); PROGRESS.md's M33 entry, two lines put right.

### Verified

- **`node --test`:** 877 pass (874 on main), the voyage tests' 16 and the planner's 5 among them. `node tools/validate-data.js`: OK. The golden files are unchanged.
- **`tools/sim.js`** not run: no balance number changed. **Act 1** (`node tools/run.js --runs 50 --background …`): M33's to the run, slow medians 42, 40 and 45 minutes; nothing in act 1 trades at a station of a side.
- **The voyage** (`node tools/voyage.js --runs 30 --background all`), fed / met the hunters / runs with a raid lost, M33's in brackets, against its Done when's limits (the M32b fixes' within 5 of 30):

  | Background | Fed | Met | Runs lost |
  | --- | --- | --- | --- |
  | Debt-bound miner | 26 (24) | 15 (14) | 6 (8) |
  | Navy deserter | 27 (25) | 10 (9) | 1 (3) |
  | Burned smuggler | 27 (27) | 5 (9) | 5 (7) |

  The miner meets the hunters in 15, one over the limit of 14 (known issues).
- **Over 100 seeds**, M33's and then main's before M33 in brackets:

  | Background | Fed | Met | Runs lost |
  | --- | --- | --- | --- |
  | Debt-bound miner | 84 (83, 79) | 45 (48, 35) | 25 (23, 18) |
  | Navy deserter | 88 (80, 83) | 36 (37, 39) | 11 (13, 20) |
  | Burned smuggler | 92 (91, 96) | 18 (20, 22) | 14 (17, 13) |

- **Trading with the pursuer** over those 100: the miner in 14 runs (M33 docked in 22), the deserter 26 (27), the smuggler 19 (8); each passes one of its pursuer's stations by in 39, 32 and 31 runs. The smuggler trades more: passing through is free now, so its ways run through the Hallorans' stations more often, and it swaps the transponder there.
- **Where the miner's gap is** (per seed, 100 seeds, against M33 and main before M33 on the same seeds): on the 22 where M33 docked with Con-Reg it meets the hunters in 11 (14, 9), so the rule took 3 of the 5 docking added; on the other 78 in 34 (34, 26), and there the runs meeting them past the charts went 14 to 23 in M33 and 27 now, in the sectors 23 to 25. Past the charts it surveys no more than before (2 a run) and enters a little hotter (heat 44 at the median; 46 in M33, 43 before).
- **The voyage tests** pass. Changed on purpose: each trade step's docking heat, none on a jump; the new once-a-visit check.
- **By touch** (`fix33/verify.mjs`, M33's check adapted, at 905 × 370, 821 × 283 and 960 × 825): 38 of 38 at each size: M33's 29, the Depot's offer line one down and the jump plan's new words, and 9 more: the panel's line and the hint before trading, Buy's first tap, the heat after the second, the panel's line after it, a patch after it adding no heat, a quit and reopen keeping it, and the jump there adding only a jump's heat. M33's first copy (`m33/verify.mjs`) fails the two checks the fix changes on purpose: the offer line's place, and the jump plan's words.
- **Every earlier milestone's browser check** passes, run one after another (`fix33/regress.sh`), at the three sizes unless named:
  - the M32b fix's 27, M32 22 and its orders 48, M31 28, M30 27, M29 34, M28 32, M27 32, M26 18, M25 21, M24 20, M23h 16, M23g 20, M23f 28, M23e 27, M23d 25, M23c 25, M23 36, M23b 8;
  - M22 35, M21 32, M19 52, M20 32;
  - M18 43, M17 37, M16 29, M15 30;
  - M10 20 (its three sizes in one run), and M8's fights and column;
  - at 905 × 370 only: M14's saves 10, M13 24, M14 41 (its count goes with the jobs it rolls) and M8's extras (the cache holds all 234 files; offline, the fight sandbox and the builder open).

  Five copies were adapted, not the game (`verify33fix.mjs` in each): M31's, M30's, M29's, M28's and M27's, from their copies for M33, each now expecting a save made by main to be saved again as v27, not v26. M33's first copy fails the two checks above, and M32b's first copy still looks for Suppress · 2 and Sedate · 2, as in M33's entry.

### Known issues

- **The miner on seeds 1 to 30 meets the hunters in 15 runs,** one over M33's limit (14); over 100 seeds it is 45, three better than M33's 48 but still 10 over main's 35 before M33. The fix changed which way each run goes from the first pursuer's station on, so seeds 1 to 30 roll differently: 30 seeds is a coarse measure for a change this size. What docking added is mostly gone (11 against 9 on the seeds it touched). Most of what remains is past the charts, where no station is, and I couldn't pin it down: the test player surveys no more than before and enters about as hot. Your call whether that wants a look before M33b (§9).
- **The smuggler trades with the Hallorans in 19 runs of 100 where it docked in 8:** passing through is free now, so its ways go by their stations more often, and it swaps the transponder there (net −20 heat). Its numbers are better than M33's all the same.
- **No patrol waves a test voyage through** (none in 300), as in M33: now in M33b's Done when.

### Test on the phone

1. **As the miner, jump to a Con-Reg station** (The Depot or Last Chance Supply): the jump plan says trading there adds 10 heat, and the jump itself adds only its 2.
2. **At the station:** the panel says "Con-Reg is after you: trade here and they log the ship, heat +10." Tap Buy once: it says "Con-Reg logs the ship: heat +10 to …". Tap again: heat rises 10, and the panel says they have logged the ship.
3. **Patch up or buy again** there: no more heat. Jump away and back: the next trade adds it again.
4. **Pass through** a Con-Reg station without trading: no heat for it.
5. **An old save sitting at a Con-Reg station** opens as already logged: no second charge.

### Next session

M33b Quests (Phase 6). First task: settle its Done when with Evan (ROADMAP.md has a draft, the Fleet's wave in it), and put the miner's 30-seed result to him (known issues): whether the gap past the charts wants a look first.

## M33 Factions (2026-10-16)

**Status:** done, and the ROADMAP.md box is ticked. The crew has standing with four sides: Con-Reg, the Fleet, the Hallorans and the union. It runs from −10 to 10 in five levels. Act 1's jobs, the run's events and the sides' ships the crew strikes move it. In turn it sets the prices at each side's stations, the pay for a friendly side's jobs in act 1, and how the Fleet's patrols greet the ship. Docking at a station of the pursuer's side adds 10 heat.

| Level | Standing | Prices at its stations | Act 1 pay | The Fleet's patrols |
| --- | --- | --- | --- | --- |
| Hostile | −6 and below | 150% | as written | fire first |
| Cold | −5 to −2 | 125% | as written | as before |
| Neutral | −1 to 1 | 100% | as written | as before |
| Friendly | 2 to 5 | 90% | +10% | wave the ship through |
| Trusted | 6 and up | 75% | +20% | wave the ship through |

**How it was picked:** Evan answered four questions (2026-10-16), each with the recommended answer but the third:
- **Scope:** factions now; quests across the acts in M33b; named companions in M33c.
- **The sides:** the pursuers' three and the union.
- **What standing changes:** "That, plus the Fleet's patrols": prices at the sides' stations, 10 heat for docking with the pursuer's side, more pay for a friendly side's jobs in act 1, and the Fleet's patrols.
- **Before M33:** M32b's talents raised and the Provost's raid evened out, in a PR of their own (the entry below).

Then calls I made, not asked, each easy to change (all data but the test player's rule):
- **The numbers:** the levels' edges, a job ±2, a side's ship struck −3, the five prices and the two pay bonuses (the table above; all in `data/balance.json`).
- **Neutral or cold, a patrol is as before.** Evan's pick named only the friendly and the hostile.
- **The opening volley:** the corvette's guns fire at the first kind of part its tactics aim at that the crew's ship still has working, and the crew isn't evading yet. The log heads it "They opened fire", where it says "Last round".
- **The four new events** (one each side, with their numbers):
  - a Halloran drop (a derelict): take it (20 credits and a salvage roll, 30% of the time a wound of 3 instead of the roll; −2 Hallorans), call it in (+1), or leave it;
  - a Fleet tender in trouble (a distress call): lend a hand (3 supplies, +2 Fleet), raid its stores pod (6 supplies and 10 credits, −2), or fly on;
  - a Con-Reg survey skiff (a distress call): tow it to the lanes (3 supplies for 15 credits, +2 Con-Reg), take its survey cores (35 credits, −2), or fly on;
  - a union co-op barge (a trader): buy 6 supplies for 6 credits, pay 15 into the strike fund (+2 union), or move on.
- **The stalled miner's crew** wear union pins now, so its words say why towing them is +1 union.
- **Which stations are whose:** by name, so the sectors roll as before: the union's are Union Hall Twelve, Dock Seven and Ruth's Canteen; Con-Reg's The Depot and Last Chance Supply; the Fleet's Rest Stop Nine and Station Okay; the Hallorans' Big Rita's and Halfway House. Mac's Pumps, Fuel and Grub and The Truck Stop are nobody's.
- **Where the sides show:** a Sides panel in the hangar's side column and on the chart, a Sides section in the colony's info panel, and a pip in the side's color on its stations on the chart. The hangar's side column already filled the folded screen, so it now scrolls as a whole, each panel at its own height.
- **The test player keeps off the pursuer's stations** (`tools/voyagePlan.js`). It prices a dock there as heat, the way it prices an event's heat, and counts the dock as a shortfall, as bad as going on into the next sector short. So it takes a way that calls at another station whenever that way goes no hungrier. As first written (a dock worth −20 credits), the miner's 30 voyages docked with Con-Reg in about half the runs, met the hunters in 16 and lost a raid in 10, over the Done when's limits (14 and 8).

Done when (ROADMAP.md, M33, in full there):
- **The sides:** four, standing −10 to 10 in five levels, a new campaign hostile with its pursuer's side.
- **What moves it:** jobs done and lost, events' outcomes, a side's ship struck; clamped.
- **What it changes:** prices at the sides' stations, docking heat, act 1's pay, the Fleet's patrols.
- **Shown as it happens** (Law 4).
- **Saves:** `SAVE_VERSION` 26, with a migration from 25.
- **Every rule tested.**
- **Balance:** act 1 and the voyage, within the M32b fixes' numbers; the test player's choice of stations; each side's standing reported.
- **Touch** at the three sizes.

How each is met:
- **The sides:** `data/factions.json`, checked by `tools/validate-factions.js`; `tests/standing.test.js` (the levels and their edges, a new campaign's standing from each start).
- **What moves it:** `tests/standing.test.js`: a job done and lost, for and against; every event's moves (the company wreck, the stalled miner and the four new ones); a side's ship boarded, blown up or left adrift, and any other end costing nothing; the clamp, and a side the content lacks passed by.
- **What it changes:** `tests/standing.test.js`: each level's price at each service (supplies 15, 13, 10, 9 and 8 for ten; an engine's repair 75, 65, 50, 45 and 40; patching 6 hit points 18, 15, 12, 11 and 9; and each recruit's fee), each rounded as its price is; the docking heat and its line in the jump plan; the job's pay; the patrol waving the ship through and opening fire.
- **Shown as it happens:** `tests/standingText.test.js` and the screens' text tests; by touch, below.
- **Saves:** `tests/standing.test.js`: a v25 campaign opens with each side where its background starts a new one, and an approach under way meets no patrol.
- **Every rule tested:** the tests above, and 23 new cases in `tests/data.test.js` for the validator: every side a client, job, pursuer, ship, event or station names must be one in `data/factions.json`, a job is never against its own client's side, and the hunters fly their pursuer's side.
- **Balance and touch:** under Verified.

Some of this changes what was there before:
- **Prices** at a side's station are its level's share. Nobody's stations charge the whole price, as before. The start crew pays half again at its pursuer's stations.
- **Act 1's pay:** a friendly side's job pays 10% more, a trusted side's 20%, in steps of 5 credits.
- **The run's events:** the derelicts', distress calls' and traders' pools have 14 events where they had 10. The generator shuffles each pool, and the longer ones take more of a sector's rolls, so the sectors' names, events and hostile ships' seeds roll differently. Their shapes, kinds and links are as they were. `tests/golden/sectors.txt` was written again, on purpose.
- **The patrol corvette** greets a crew by its standing with the Fleet.
- **The hangar's side column** scrolls as a whole on short screens, where each panel scrolled inside itself.
- **`SAVE_VERSION` 26.**
- **The voyage's test player** keeps off the pursuer's stations (above), weighs a side's standing in its events' choices (2 credits a point), and prefers a friendly side's station (10 credits).
- **Tests changed on purpose:**
  - `campaign`, `encounter`, `expeditions`, `makers`, `orders`, `raids` and `ranks`: `SAVE_VERSION` 26, and standing where a whole campaign is compared;
  - `contracts`: a job's words carry its sides and bonus;
  - `sectorText`: a station's kind says its side ("Station · The union");
  - `travel`: the jump plan's `dock`;
  - `data`: the validator's counts ("22 events, 4 sides") and the new cases;
  - `voyage`: below.

### Shipped

- **Data:**
  - `factions.json` (new): the four sides, each with a name, a line, its color and, for the Fleet, its patrol's words; and the stations' sides by name;
  - `balance.json`: `pursuerStanding` −10; the levels' edges (`coldStanding` −5, `neutralStanding` −1, `friendlyStanding` 2, `trustedStanding` 6); `jobStanding` 2, `lostStanding` 2, `shipStanding` 3; `hostilePrice` 150, `coldPrice` 125, `neutralPrice` 100, `friendlyPrice` 90, `trustedPrice` 75; `friendlyPay` 10, `trustedPay` 20; `dockHeat` 10;
  - `districts.json`: Marta the steward and Gage the dockers' boss the union's, Sully the foreman Con-Reg's;
  - `contracts.json`: `against` on 15 jobs, 6 against Con-Reg, 8 against the Fleet, 1 against the Hallorans;
  - `backgrounds.json`: each pursuer's side;
  - `ships.json`: the side of the patrol corvette (the Fleet's) and of the six hunters (their pursuer's);
  - `events.json`: the company wreck stripped fast −1 Con-Reg, the stalled miner towed or tossed a crate +1 union, and the four new events.
- **The sim:**
  - `standing.js` (new): the levels, the moves and their clamp, a job's sides and pay, a station's side and share, the docking heat, a patrol's welcome, a struck ship's cost, and the shape checks;
  - `campaign.js`: a new campaign's standing, and its check in a save;
  - `contracts.js`: a job's end moves standing and pays the bonus;
  - `events.js`: `standing` in an outcome's effects;
  - `encounter.js` and `approach.js`: the patrol waving the ship through (an approach outcome, `waved`) or opening fire (`openingVolley`), and a side's ship struck;
  - `travel.js`: the docking heat in the jump plan, and supplies at the share; `repair.js`, `patch.js` and `recruits.js`: their prices at the share (`costAt`);
  - `runShape.js`: the approach's patrol, and standing's changes in outcomes and results;
  - `save.js`: v26 and the migration; `defs.js`: the sides.
- **The UI:**
  - `standingText.js` (new): the sides' words: each side's row, a change with the level it leaves, a job's for and against, the bonus, a station's line, a patrol's words;
  - the Sides panels (hangar, chart) and section (colony), and a station's pip on the chart;
  - the job board's Sides fact and its pay with the bonus; the fight's end panel's moves; an event's result's moves; the approach's patrol words, its opening volley and its outcome's moves;
  - a station's line, and its services' prices at the share; the jump plan's docking heat and the patrol ahead;
  - `palette.js`: the sides' four colors.
- **Tools:**
  - `validate-factions.js` (new), and the sides' checks in `validate-data.js`, `validate-campaign.js` and `validate-events.js`;
  - `run.js`: a job's pay with its bonus;
  - `voyagePlan.js`: a station's prices at the share, standing's worth, friendly stations, and the pursuer's stations kept off;
  - `voyage.js`: each side's standing at the launch and the landing, the patrols that waved the ship through or fired first, the docks with the pursuer and the calls at a friendly side's station; each step's price share and docking heat;
  - `approach.js`: the rounds' outcomes (a patrol's wave is none).
- **Tests:** three new files (`standing.test.js`, `standingText.test.js`, `voyagePlan.test.js`) and the changes above. 874 tests in all, 852 on main.
- **Docs:** ROADMAP.md: §4.2 (the patrols), §4.4 (docking heat), §4.6 (prices and pay by standing), §4.9 (new: sides and standing), M33 as built, ticked, and five new in §9 (one narrowed: docking came in). CLAUDE.md: the sides in the content, `standing.js` and `validate-factions.js` in the layout.

### Verified

- **`node --test`:** 874 pass, the voyage tests' 15 and the planner's 4 among them. `node tools/validate-data.js`: OK (22 events, 4 sides). `tests/golden/sectors.txt` was written again on purpose (above); the other golden files are unchanged.
- **`node tools/sim.js`** (run because `data/balance.json` changed; no number a fight uses did): identical to main's but for the time taken:
  ```
  All                1,000  50% (47–53)           37%        13%  7 (5–12)           30
  Shots: 23,338, 23.3 a fight. Hit: crew 57%, boarders 41%.
  A fight: 1.8 crew go down, 0.8 bleed out, 2.7 boarders die.
  Job orders a fight: patch 0.8, suppress 0.4, weld 0.1.
  ```
- **Act 1** (`node tools/run.js --runs 50 --background …`): every run launches, slow medians 42, 40 and 45 minutes (the M32b fixes: 43, 40 and 45):

  | Background | Jobs | Done | Quick | Slow |
  | --- | --- | --- | --- | --- |
  | Debt-bound miner | 6 (3 to 11) | 77% of 307 | 26 (11 to 51) | 42 (19 to 81) |
  | Navy deserter | 6 (3 to 18) | 61% of 348 | 25 (11 to 94) | 40 (19 to 148) |
  | Burned smuggler | 6 (2 to 26) | 76% of 362 | 28 (11 to 116) | 45 (18 to 184) |
- **The run and the colony** (`node tools/voyage.js --runs 30 --background all`), the M32b fixes' in brackets:

  | Background | Fed | Met | Raids | Won | Lost | Runs lost |
  | --- | --- | --- | --- | --- | --- | --- |
  | Debt-bound miner | 24 (25) | 14 (9) | 49 | 38 | 11 | 8 (3) |
  | Navy deserter | 25 (23) | 9 (9) | 24 | 21 | 3 | 3 (5) |
  | Burned smuggler | 27 (29) | 9 (8) | 30 | 22 | 8 | 7 (5) |

  Every run launches. Fed, met and runs lost are each within 5 of the fixes', the miner's met and runs lost exactly 5 more (known issues). Over 100 seeds, main's in brackets: the miner fed 83 (79), met 48 (35), runs lost 23 (18); the deserter 80 (83), 37 (39), 13 (20); the smuggler 91 (96), 20 (22), 17 (13).
- **Standing,** the median at the launch, then at the landing (30 voyages):
  - the miner: Con-Reg −10 → −10, the Fleet 0 → 0, the Hallorans 0 → −2, the union +2 → +3;
  - the deserter: Con-Reg 0 → −2, the Fleet −10 → −10, the Hallorans 0 → −2, the union 0 → 0;
  - the smuggler: Con-Reg 0 → −2, the Fleet −6 → −8, the Hallorans −10 → −10, the union 0 → +1. Act 1's customs jobs, against the Fleet, leave it hostile with the Fleet in most runs.
- **The sides on the run,** over 100 voyages from each start:
  - docked with the pursuer's side: the miner 26 times in 22 runs, the deserter 32 in 27, the smuggler 10 in 8. Of those 68 docks, 51 were where every way on called there, 9 where every other way went hungrier, 5 on a long jump away from where the hunters might wait, and 3 where another way came out as short and worth decided (`tests/voyagePlan.test.js` has the choice);
  - called at a friendly side's station: the miner 168 times in 79 runs (the union, friendly from Marta's jobs), the deserter 10, the smuggler 7;
  - the patrols: the deserter met 27 and every one fired first; the smuggler met 20, 16 firing first; the miner met 27, none either way. None waved the ship through (known issues).
- **The voyage tests** pass. Changed on purpose:
  - each step's money and heat as the rules move them: supplies, patching and recruits at the station's share, a jump's heat with the docking heat after it;
  - the run's 14 events, every one played in 30 runs;
  - two checks the new events tipped on seeds 1 to 30 are rates over 100 seeds against main's before M33 (CLAUDE.md): a recruit signed on with a cargo hold, in 10 or more of 30 when M23 measured it, now 49 of 100 (main's 44, within 15); and a surveyed world settled, 25 or more of 30 when M25 measured it, now 76 of 100 (main's 81);
  - the colony's raid heat: the check said heat ends no higher than 40 or the landing's heat whenever a raid was faced, which held on seeds 1 to 30 by chance. Main misses it on seed 77 (58 at the end, 57 at the landing), as M33's rolls do on seed 27. Trips add heat after the last raid, so the check now allows the trips flown from the last raid's day on, the most the rules let it rise.
- **By touch** (`m33/verify.mjs`, 29 checks at each of 905 × 370, 821 × 283 and 960 × 825, all passing):
  - the hangar's Sides panel, the last row in sight with the column swiped to it; a union job's for and against on the board ("For the union (neutral): +2 done. Against Con-Reg (hostile): −2 done or lost."), its pay 120 credits;
  - the job done: the end panel pays 120 and moves the sides ("The union +2: now friendly, +3." and "Con-Reg −2: still hostile, −10, as low as it goes."), within the screen; Continue, and the panel says the union Friendly +3, 3 to trusted;
  - quit and reopen: the union still friendly; the next union job pays "130 credits (+10%: the union is friendly)", on the board's list too;
  - on the chart: Union Hall Twelve, "Station · The union" with its pip; "The union's station: friendly, prices 90%."; supplies at 90%, Buy's first tap asking the price at 90%, Patch up at 90%;
  - The Depot: "Station · Con-Reg", "Con-Reg's station: hostile, prices 150%.", supplies and patching at 150%; the jump plan there: "Con-Reg is after you, and this is their station: docking adds 10 heat, to N.";
  - a patrol, the crew friendly with the Fleet: "The corvette waves you through." with the Fleet's words; Carry on, back on the chart with the node done;
  - a patrol, the crew hostile with the Fleet: the hint gives the Fleet's words; the log's "They opened fire" and the volley, before any order;
  - every button 48 px or more on each screen; offline, the hangar shows its sides; no console errors.
- **Every earlier milestone's browser check** passes, run one after another, at the three sizes unless named:
  - the M32b fix's 27, M32 22 and its orders 48, M31 28, M30 27, M29 34, M28 32, M27 32, M26 18, M25 21, M24 20, M23h 16, M23g 20, M23f 28, M23e 27, M23d 25, M23c 25, M23 36, M23b 8;
  - M22 35, M21 32, M19 52, M20 32;
  - M18 43, M17 37, M16 29, M15 30;
  - M10 20 (its three sizes in one run), and M8's fights and column;
  - at 905 × 370 only: M14's saves 10, M13 24, M14 40 and M8's extras (the cache holds all 234 files; offline, the fight sandbox and the builder open).

  Seven copies were adapted, not the game, for what M33 changes on purpose (`verify33.mjs` in each):
  - M31's, M30's (from its copy for the M32b fix), M29's, M28's and M27's: a save made by main is saved again as v26.
  - M23c's: the map's crew panel is read from its crew list. The side column holds the Sides panel too, its rows styled as the crew's, so the old copy read the four sides' names after the crew's.
  - M19's: a station's kind line says its side where it has one ("Station · The union" at Dock Seven).

  M32b's own first copy (`m32b/verify.mjs`) still looks for Suppress · 2 and Sedate · 2, from before the M32b fix gave rank 1 its third use; the fix's copy passes in its place, as in the fix's entry.

### Known issues

- **The miner sits on the voyage's limits.** At 30 seeds it meets the hunters in 14 runs (limit 14) and loses a raid in 8 (limit 8); over 100 seeds, 48 and 23 against main's 35 and 18 on the same seeds. The deserter and the smuggler are level with main or better. What I found:
  - **Docking with Con-Reg** (measured): 22 of the 100 runs dock with Con-Reg, 26 times in all: 21 where every way on called there and 3 where every other way went hungrier. Two of the twelve station names are Con-Reg's, and a sector often has no other station on the way. Those 22 runs meet the hunters in 14, against 9 for main on the same seeds.
  - **Past the charts** (measured): the 78 runs that never dock meet the hunters in 34, against 26 for main on the same seeds, most of the difference in the system past the charts (23 runs against 14). Their heat entering it is main's (43 at the median), but they make 217 jumps there against main's 196, arriving with a little more in the holds (20 supplies at the median against 18). More jumps account for part of it; I couldn't tell the rest from chance in 78 runs.
  
  Ways to ease it, if you want to: fewer of Con-Reg's names among the stations, docking heat only when the ship buys there, or a lighter docking heat. The 10 heat came with your pick (§4.4's number); which stations are whose was my call, though this line first said both were yours. Your call (§9): you took docking heat on trade, in the fixes after M33 (the entry above).
- **No patrol waves the test player through** (none in 300 voyages): no act 1 client is the Fleet's, and the only way up with the Fleet on the run is helping the Fleet tender (+2), which the test player passes for its stores. A player can earn it there. A Fleet client in act 1, or a quest in M33b, would make the wave something to work for (§9).
- **The Narrows has no client of a side,** so in act 1 the smuggler's standing can only fall, from its customs jobs against the Fleet, and rises only on the run (§9). This line first said it moved only on the run.
- **Raids and act 3 don't move standing,** as the Done when says (§9).
- **The hangar's side column scrolls** on the folded screen (821 × 283): the crew and the sides under the goal take a swipe.

### Test on the phone

1. **New game as the miner:** the hangar's Sides panel: Con-Reg hostile −10, the rest neutral. A job from Marta says "For the union" on the board, and one against Con-Reg says so.
2. **Two union jobs:** the end panel says what each moved ("The union +2: now friendly"). The next union job pays 10% more.
3. **Launch:** the chart's stations carry a pip in their side's color. At a union station the line says "friendly, prices 90%", and supplies cost 90%.
4. **A Con-Reg station** (The Depot or Last Chance Supply): the jump plan says docking adds 10 heat, and its prices are 150%.
5. **As the deserter, a patrol corvette:** it opens fire before the first round; the log says "They opened fire".
6. **As the miner, help the Fleet tender** when one calls (+2 Fleet): the next patrol waves the ship through.
7. **Quit and reopen:** the standing stays. An old save (v25) opens with its background's standing.

### Next session

M33b Quests (Phase 6). First task: settle its Done when with Evan (ROADMAP.md has a draft), and ask about the miner's voyage at the limits (known issues): whether to ease Con-Reg's stations on its way.

## M32b fixes: talents raised, the Provost's raid evened out (2026-10-16)

At M33's start Evan took both of M32b's known issues on, as small fixes before M33 (2026-10-16):
- **The talents:** "Raise them now, a small fix first": rank 1 adds a use as well as its sharper number, measured against rank 0 again.
- **The Provost's raid:** "Even it out now, a small fix first" (the recommended answer): the deserter's crew within 10 points of the miner's against Con-Reg over 500 fights, at rank 0 and rank 1; M30's test over 300 fights.
- **Kit out,** asked once measured: "3 uses at +1 armor" (the recommended answer). At 2 armor its rank 1 moved the harness's fights from 45% to 65%, where every other order's moves 2 points or less, and the smuggler's raids at rank 1 came out 17 points easier than Con-Reg's (82% to 65% at the hangar). It keeps M32b's rank 1, the one exception to the rule.

Both fixes are one PR: the raid had to be measured at rank 1 with the new talents.

### Shipped

- **Rank 1** (`data/jobs.json`), M32b's in brackets:

  | Job | Rank 1 |
  | --- | --- |
  | Marine | Pinning fire: Suppress ×3 at −40 aim (×2) |
  | Engineer | Hot welds: Weld ×3 for 5 rounds (×2) |
  | Medic | Field surgery: Patch ×3 at 5 hit points (×2) |
  | Pilot | Second wind: Hustle ×2 for two more actions (one) |
  | Scout | Spotter: Mark ×3 at +20 (×2) |
  | Xenobiologist | Steady dart: Sedate ×3 at +10 (×2) |
  | Quartermaster | Deep pockets: Kit out ×3 at 1 armor, as before |

  Hustle's rank 1 was already a use, so it sharpens its number instead. Second wind's words say so: "Always has another move or two in them."
- **A rank's words** say a use and a number at once: "Suppress ×3 a fight, −40 aim" (`crewJobText.js` rankGives), on the fight's end panel and wherever a rank is told.
- **The Provost's raid at the hangar:** an MP and two cadets (`provosthangar`, new in `data/encounters.json`), where it was an MP, a cadet and an MP. The cadet has 7 hit points and aim 70 (6 and 65); it is in no other party. The colony's raid is still an MP, a cadet and an MP (`provostraid`), with the sturdier cadet. The words of the raid at the dry dock's gate are unchanged.
- **Tests:**
  - `ranks.test.js`: every rank 1 adds a use, and every one but Kit out sharpens a number; each order at rank 1 with its uses and number;
  - `crewJobText.test.js`: the words for a use and a number, or one alone;
  - `backgrounds.test.js`: M30's raid test over 300 fights;
  - `data.test.js`: 22 encounters.
- **Docs:** ROADMAP.md §2, §4.4 and §4.5 (the raid parties, which also brings the colony's as M32 left them, and the ranks' rule), M32b's section (what was fixed after it), §9 (the talents' idea narrowed, the Provost's dropped).

### Verified

- **`node --test`:** 852 pass, the voyage tests' 15 among them. `node tools/validate-data.js`: OK. The golden files are unchanged.
- **Each order at rank 1 against rank 0** (`node tools/sim.js --fights 300 --squad <the job's> --orders <the order> --rank 1 --compare`), the crew's wins, M32b's rank 1 in brackets:

  | Order | Rank 0 | Rank 1 |
  | --- | --- | --- |
  | Suppress | 46% | 45% (45%) |
  | Weld | 48% | 48% (49%) |
  | Patch | 48% | 50% (48%) |
  | Hustle | 27% | 27% (27%) |
  | Mark | 35% | 33% (35%) |
  | Sedate | 17% | 18% (17%) |
  | Kit out | 45% | 46% (46%) |

  Every order at once, the default squad: 50% → 51%, as in M32b. The harness's AI gives Suppress, Weld, Patch and Hustle under once a fight and Mark and Sedate under twice, so a use more seldom gets used: the third use is for a player to find.
- **The Provost's hangar party, tried** (`tools/raids.js` over 500 fights, the deserter's start crew; Con-Reg's numbers for the miner's are 57% at the hangar and 42% at the colony at rank 0, 65% and 64% at rank 1):

  | Party at the hangar | Cadet | Rank 0 | Rank 1 |
  | --- | --- | --- | --- |
  | MP, cadet, MP (M32's) | 6 hit points, aim 65 | 42% | 45% |
  | two MPs and a cadet, either other order | 6, 65 | 33–34% | 47–48% |
  | an MP and two cadets, any order | 6, 65 | 72–74% | 78–82% |
  | MP, cadet, cadet | 8, 65 | 56% (colony 34%) | 67% (colony 53%) |
  | MP, cadet, cadet | 6, 75 | 67% | 71% |
  | **MP, cadet, cadet** | **7, 70** | **61% (colony 38%)** | **67% (colony 57%)** |

  Only the cadet's own numbers could land between two MPs and a cadet (15 to 24 behind) and an MP and two cadets (15 to 17 ahead). At 8 hit points the colony's raid at rank 1 fell 11 behind.
- **Raids** (`node tools/raids.js --fights 500`, and `--rank 1`), the crew's wins, M32b's in brackets:

  | Background | Hangar, rank 0 | Colony, rank 0 | Hangar, rank 1 | Colony, rank 1 |
  | --- | --- | --- | --- | --- |
  | Debt-bound miner | 57% of 4 (57%) | 42% of 4 (42%) | 65% (63%) | 64% (52%) |
  | Navy deserter | 61% of 3 (42%) | 38% of 3 (46%) | 67% (46%) | 57% (56%) |
  | Burned smuggler | 51% of 6 (51%) | 43% of 5 (43%) | 67% (62%) | 65% (57%) |

  Each pursuer's raids are within 10 points of Con-Reg's at both ranks, the most 7 (the deserter's colony at rank 1). Over M30's 300 fights: the deserter 64% and 40%, the smuggler 50% and 42%, against 57% and 42%.
- **Act 1** (`node tools/run.js --runs 50 --background …`): every run launches, slow medians 43, 40 and 45 minutes (M32b: 43, 37 and 45).
- **The run and the colony** (`node tools/voyage.js --runs 30 --background all`), M32b's in brackets:

  | Background | Fed | Met | Raids | Won | Lost | Runs lost |
  | --- | --- | --- | --- | --- | --- | --- |
  | Debt-bound miner | 25 (25) | 9 (10) | 27 | 22 | 5 | 3 (3) |
  | Navy deserter | 23 (23) | 9 (10) | 28 | 23 | 5 | 5 (4) |
  | Burned smuggler | 29 (29) | 8 (9) | 18 | 13 | 5 | 5 (5) |

  Every run launches; fed, met and runs lost are each within 2 of M32b's.
- **The voyage tests** pass as they are.
- **By touch,** at 905 × 370, 821 × 283 and 960 × 825:
  - M32b's check, adapted for the fix (`m32b/verify-fix.mjs`: the ranked marine's Suppress · 3 and the xenobiologist's Sedate · 3): 27 of 27 at each.
  - Every earlier milestone's check passes, one after another, at the three sizes unless named: M32 22 and its orders 48, M31 28, M30 27, M29 34, M28 32, M27 32, M26 18, M25 21, M24 20, M23h 16, M23g 20, M23f 28, M23e 27, M23d 25, M23c 25, M23 36, M23b 8; M22 35, M21 32, M19 52, M20 32; M18 43, M17 37, M16 29, M15 30; M10 20 (its three sizes in one run), and M8's fights and column; at 905 × 370 only, M14's saves 10, M13 24, M14 41 (its count goes with the jobs it rolls) and M8's extras.
  - M30's runs as a copy adapted for the fix (`m30/verify-fix.mjs`): the deserter's hangar raid is an MP and two cadets. Kit out's return to M32b's rank 1 landed while the run was under way; no check plays a quartermaster at rank 1.

### Known issues

- **The third use is the harness's to ignore:** with a use more at rank 1, every order still moves its fights 2 points or less, as its AI seldom spends what it has. Whether the ranks now feel right is for the phone (§9).
- **Kit out's rank 1 is the exception** to the rule: a use, no sharper number.

### Test on the phone

1. **A fight with a crew at rank 1** (three jobs into act 1): the order buttons count three uses (Suppress · 3, Weld · 3, Patch · 3), and a pilot's Hustle gives two more actions.
2. **The fight's end** as someone reaches rank 1: "Suppress ×3 a fight, −40 aim".
3. **As the deserter, a raid at the hangar:** an MP and two cadets at the gate.

### Next session

M33 Factions (its Done when settled with Evan's picks, 2026-10-16): first task, write the Done when into ROADMAP.md and open its draft PR.

## M32b Talents, traits and recruits' backgrounds (2026-10-16)

**Status:** done, and the ROADMAP.md box is ticked. Every crew member now counts the fights they stand in, and at 3 and 8 reaches their job's rank 1 and rank 2: rank 1 sharpens the job's order, rank 2 its effect aboard or at the colony. There are 20 traits, and every recruit comes from one of 8 backgrounds that sets their job, traits and fights already stood, and with them their fee.

| Job | Rank 1, 3 fights | Rank 2, 8 fights |
| --- | --- | --- |
| Marine | Pinning fire: Suppress −40 aim (−30) | Gun captain: the guns +15 in the approach (+10) |
| Engineer | Hot welds: Weld for 5 rounds (3) | Running repairs: 2 wrecked parts fixed a jump (1) |
| Medic | Field surgery: Patch 5 hit points, and up with 5 (3) | Ward chief: a med bay 2 more a jump, an infirmary 2 more a day (1) |
| Pilot | Second wind: Hustle twice a fight (once) | Ace: evasion +15 (+10) |
| Scout | Spotter: Mark +20 to hit (+15) | Long eyes: a scan reaches 4 links (3) |
| Xenobiologist | Steady dart: Sedate at the shot's odds +10 (+0) | Green thumb: each farm 2 more food a day (1) |
| Quartermaster | Deep pockets: Kit out 3 times a fight (twice) | Stores master: lockers +20 (+10), stores +40 (+20) |

**How it was picked:** Evan answered four questions (2026-10-16), each the recommended answer:
- **Ranks** at 3 and 8 fights.
- **Rank 1 sharpens the order, rank 2 the effect** aboard or at the colony.
- **The 14 new traits** move the fight numbers, about half trading one for another.
- **Recruits' backgrounds:** "A past that sets the price": a line about it, the jobs and traits it rolls from, fights already stood (so a veteran signs on ranked), and a fee that rises with rank and traits.

Then calls I made, not asked, each easy to change (all data but the marks):
- **The 14 traits**, five that only add and nine that trade, so 10 of the 20 trade:
  - adding: Old hand (aim +3, defense +2), Cool head (aim +2, defense +3), Bar fighter (hit points +1, aim +3), Light sleeper (hit points +1, defense +3), Shift fit (hit points +1, aim +2, defense +1);
  - trading: Bruiser (hit points +4, moves −1), Brawler (hit points +4, aim −5), Crack shot (aim +10, hit points −2), Patient (aim +10, moves −1), Jumpy (defense +10, aim −5), Careful (defense +10, moves −1), Wiry (defense +10, hit points −2), Reckless (moves +2, defense −5), Long legs (moves +2, hit points −2).
- **The 8 backgrounds:** a green hand (any job, no traits, no fights), a station kid, a laid-off miner and a survey hand (one trait, up to 1 or 2 fights), a long-hauler (one trait, 2 to 4) and a Company guard (one trait, 3 to 6), a hired gun (two traits, 4 to 9) and a Fleet veteran (two traits, 8 to 12). Each is as likely as the next, so about half of all recruits come unranked, three in ten at rank 1 and one in six at rank 2.
- **The fee:** 30 credits (`recruitFee`, which was 50), 20 more a trait (`recruitTraitFee`) and 40 more a rank (`recruitRankFee`). A recruit with one trait and no rank still asks M23's 50; a green hand 30, a Company guard 90, a Fleet veteran 150.
- **Ranks as chevrons:** a chevron for each rank over the corner of a portrait (the fight's crew buttons, the squad card, the crew card) and after a name in the crew panels' rows. On the cover screen the squad card cuts "Marine · rank 1" to "Mari…", so words alone would have hidden it.
- **What a rank gives, in numbers,** on the fight's end panel ("Rosa Vint reaches rank 1, Pinning fire: Suppress −40 aim."): the ranks' own words are flavor.
- **The captain's 20 traits** scroll inside their panel, with the last one tapped in words under them.
- **The test player** signs on only a recruit whose fee leaves a holdful's price, as it did with the one fee.

Done when (ROADMAP.md, M32b, in full there):
- **Fights counted**, and saved.
- **Ranks** at 3 and 8, each with a name and words, rank 1 the order, rank 2 the effect.
- **Shown as earned** (Law 4).
- **Traits:** 20, the captain picks 2 in reach at the three sizes, recruits roll theirs from their background.
- **Recruits' backgrounds**, the fee rising with rank and traits.
- **Saves:** `SAVE_VERSION` 25, with a migration from 24.
- **Every talent counts:** a test for each rank's rule and the best-rank rule; each order at rank 1 measured against rank 0.
- **Balance:** act 1, raids at rank 1, the voyage, the voyage tests.
- **Touch** at the three sizes.

How each is met:
- **Fights counted:** `tests/ranks.test.js`: everyone standing in a fight counts it as it ends, won or lost, the one down too; the dead leave; whoever sat it out doesn't. The count is saved and read back.
- **Ranks:** `tests/ranks.test.js`, a test for each rank's rule at work (each order at rank 1 in a fight, each effect at rank 2 through the screens' own sums: the approach's odds, the jump plan's fixes, the med bay and the infirmary, a scan's reach, the lockers and the stores, the farms), and the best-rank rule (the veteran brings it, a second adds nothing, `stationBy` names the higher). The validator checks every rank: its name and words, numbers only for what the job has, within the job's ranges (`tests/data.test.js`, 18 new cases).
- **Shown as earned:** the end panel (`rankUps` in `campaign.js`, by `endFight`'s count), the crew card's rank and fights, the chevrons, and the unit card's rank. An order's button and preview, and every effect shown, count the ranks (`tests/crewJobText.test.js`, `tests/crewText.test.js`). The Steady dart's +10 is a row of its own on the dart's odds card, so the number shown is the number rolled.
- **Traits:** `tests/recruits.test.js` (20, ten trading) and `tests/captainText.test.js`. By touch, below.
- **Backgrounds:** `tests/recruits.test.js`: every recruit from a background in the data, one of its jobs, its count of traits none twice, fights in its range, every background turning up; the fee by traits and rank; a veteran signing on at rank 2 with a sharper order from the first fight; the background kept aboard and in the save.
- **Saves:** `tests/ranks.test.js`: a v24 crew opens at 0 fights each with no background, a fight under way keeps its units at rank 0, and broken counts are caught.
- **Every talent counts:** the tests above; `tools/sim.js --rank 1 --compare` (`tests/harness.test.js` checks each order at rank 1 changes its fights). The measurement is under Verified.
- **Balance:** under Verified.
- **Touch:** under Verified.

Some of this changes what was there before:
- **`recruitFee` is the base**, 30 where it was the whole 50; a one-trait recruit at rank 0 still pays 50.
- **Recruits roll from their background,** so the jobs on offer lean to the backgrounds' lists (each job is in at least two), a green hand comes with no trait, and the recruit rolls behind the name moved: the same station offers others than before.
- **The crew panels' rows** carry the rank for their chevrons; a row's words are as they were.
- **The fight's end panel** lists who reached a rank under its words, and keeps within the screen (it scrolls if it must).
- **`SAVE_VERSION` 25.**
- **Tests changed on purpose:**
  - `crew.test.js`, `crewText.test.js` and `voyage.test.js`: each recruit's fee, by their traits and rank, and their background;
  - `captainText.test.js`: 20 traits;
  - `hubText.test.js`: the crew rows' rank;
  - `data.test.js`: the validator's counts and the new cases;
  - `harness.test.js`: `--rank`;
  - `expeditions.test.js`, `makers.test.js`, `orders.test.js` and `raids.test.js`: `SAVE_VERSION` 25.

### Shipped

- **Data:**
  - `jobs.json`: each job's `ranks`, two each;
  - `traits.json`: 14 traits;
  - `recruits.json`: 8 `backgrounds`;
  - `balance.json`: `rankOneFights` 3, `rankTwoFights` 8, `recruitFee` 30, `recruitTraitFee` 20, `recruitRankFee` 40.
- **The sim:**
  - `ranks.js` (new): a member's rank, the next, a job at a rank, the rank that sharpened a layer;
  - `campaign.js`: `endFight` counts the fights, `rankUps` says who reaches a rank, the crew's fights and background saved;
  - `orders.js`, `battle.js` and `battleShape.js`: a unit's rank and its order at that rank, the dart's steady part;
  - `edges.js`: the best rank of a job counts;
  - `recruits.js`: backgrounds and fees;
  - `save.js`: v25 and the migration.
- **The UI:**
  - the fight's end panel's ranks, the chevrons (`portrait.js` `rankMark`), the unit card's rank and the odds card's rank row;
  - `crewJobText.js`: words at a rank, what each rank gives, a rank's line;
  - the crew card's rank, fights and background; a recruit's background, rank and fee;
  - the captain screen's 20 traits.
- **Tools:**
  - `sim.js` `--rank N`, with `--compare` against rank 0;
  - `raids.js` `--rank N`;
  - `voyagePlan.js`: each recruit's own fee.
- **Tests:** two new files (`ranks.test.js`, `recruits.test.js`), and the changes above. 852 tests in all, 823 on M32.
- **Docs:** ROADMAP.md: §4.5 (ranks, recruits' backgrounds, traits), §5 (traits as built), M32b as built, ticked, and five new in §9.

### Verified

- **`node --test`:** 852 pass, the voyage tests' 15 among them. `node tools/validate-data.js`: OK. The golden files are unchanged.
- **Each order at rank 1 against rank 0** (`node tools/sim.js --fights 300 --squad <the job's> --orders <the order> --rank 1 --compare`), the crew's wins and the order given a fight:

  | Order | Rank 0 | Rank 1 | Given, rank 0 → 1 |
  | --- | --- | --- | --- |
  | Suppress | 46% | 45% | 0.3 → 0.3 |
  | Weld | 48% | 49% | 0.4 → 0.4 |
  | Patch | 48% | 48% | 0.8 → 0.6 |
  | Hustle | 27% | 27% | 0.3 → 0.5 |
  | Mark | 35% | 35% | 1.1 → 1.0 |
  | Sedate | 17% | 17% | 1.2 → 1.3 |
  | Kit out | 45% | 46% | 2.0 → 2.6 |

  Every order at once, the default squad: 50% → 51%. Each changes its fights (`harness.test.js`), but none moves the wins past chance.
- **`node tools/sim.js`** (run because `data/balance.json` changed; the fees aren't used in the harness's fights, and its crew stand at rank 0, short of `rankOneFights`, so the summary is M32's with every order, ship by ship):
  ```
  All                1,000  50% (47–53)           37%        13%  7 (5–12)           30
  Shots: 23,338, 23.3 a fight. Hit: crew 57%, boarders 41%.
  A fight: 1.8 crew go down, 0.8 bleed out, 2.7 boarders die.
  Job orders a fight: patch 0.8, suppress 0.4, weld 0.1.
  ```
- **Act 1** (`node tools/run.js --runs 50 --background …`), every run reaching launch, slow medians 43, 37 and 45 minutes (M32: 44, 39 and 46):

  | Background | Jobs | Done | Quick | Slow |
  | --- | --- | --- | --- | --- |
  | Debt-bound miner | 6 (3 to 11) | 77% of 312 | 26 (11 to 51) | 43 (19 to 81) |
  | Navy deserter | 5 (3 to 18) | 61% of 344 | 22 (11 to 98) | 37 (19 to 155) |
  | Burned smuggler | 6 (2 to 26) | 75% of 363 | 28 (11 to 116) | 45 (18 to 184) |
- **Raids** (`node tools/raids.js --fights 500`, with `--rank 1`), the crew's wins, M32's (rank 0, 150 fights) in brackets:

  | Background | At the hangar, rank 0 | Rank 1 | At the colony, rank 0 | Rank 1 |
  | --- | --- | --- | --- | --- |
  | Debt-bound miner | 57% of 4 (53%) | 63% | 42% of 4 (41%) | 52% |
  | Navy deserter | 42% of 3 (48%) | 46% | 46% of 3 (49%) | 56% |
  | Burned smuggler | 51% of 6 (46%) | 62% | 43% of 5 (41%) | 57% |

  Rank 1 wins 4 to 11 points more at the hangar and 10 to 14 at the colony. Over 150 fights, as M30's test measures, rank 0 is M32's to the fight and the test passes; at rank 1 the Provost's raid at the hangar falls 12 points behind Con-Reg's (49% to 61%). Over 500 fights it is 15 behind at rank 0 and 17 at rank 1 (known issues).
- **The run and the colony** (`node tools/voyage.js --runs 30 --background all`), M32's in brackets:

  | Background | Fed | Met | Raids | Won | Lost | Runs lost |
  | --- | --- | --- | --- | --- | --- | --- |
  | Debt-bound miner | 25 (25) | 10 (12) | 29 | 24 | 5 | 3 (5) |
  | Navy deserter | 23 (23) | 10 (13) | 29 | 25 | 4 | 4 (3) |
  | Burned smuggler | 29 (27) | 9 (7) | 19 | 14 | 5 | 5 (4) |

  Every run launches. Fed, met and runs lost are each within 5 of M32's: the most is the smuggler meeting the hunters in 2 more.
- **The voyage tests** pass as they are, every rate check included.
- **By touch** (`m32b/verify.mjs`, 27 checks at each of 905 × 370, 821 × 283 and 960 × 825, all passing):
  - the captain screen: 20 traits, every button 48 px or more and in reach, the first and the last picked, the last one's words in sight under them; Start makes that captain; offline, the same screen;
  - a fight with crew at 3, 3 and 8 fights: a chevron, a chevron and two on their buttons, and in their names; the marine's Suppress · 2 previewed at −40 (65% → 25%); the xenobiologist's Sedate · 2 with its odds card's Steady dart +10 row, the rows adding up to the 75% shown;
  - a boarding due with four aboard: the squad card's chevrons, in sight;
  - the boarding won: the end panel names the three who reach a rank and what each gives, within the screen; Continue, and the fights are counted; the crew card shows each one's rank and fights, and the crew panel's rows their chevrons, in sight;
  - a Fleet veteran for hire: "Medic · Fleet veteran", the background's line, "Rank 2, Ward chief · 9 fights stood", "Sign on · 150"; two taps sign them on for 150; aboard, the background and rank stay;
  - every button 48 px or more on each screen, and no console errors.
- **Every earlier milestone's browser check** passes, run one after another, at the three sizes unless named:
  - M32 22 and its orders 48, M31 28, M30 27, M29 34, M28 32, M27 32, M26 18, M25 21, M24 20, M23h 16, M23g 20, M23f 28, M23e 27, M23d 25, M23c 25, M23 36, M23b 8;
  - M22 35, M21 32, M19 52, M20 32;
  - M18 43, M17 37, M16 29, M15 30;
  - M10 20 (its three sizes in one run), and M8's fights and column;
  - at 905 × 370 only: M14's saves 10, M13 24, M14 40 (its count goes with the jobs it rolls), and M8's extras.

  Seven copies were adapted, not the game, for what M32b changes on purpose (`verify32b.mjs` in each):
  - M31's, M30's, M29's, M28's and M27's: a save made by main is saved again as v25.
  - M32's: what a recruit's job brings, and the signed-on scout's, is said at their rank, and the scan's first tap reaches as far as the scout's rank gives.
  - M23's: each recruit asks their own fee, and the first one offered is the one signed on.

  Ten checks make a save with the game as it was (M31's to M24's, M23h's and M23g's), each beside a checkout of that build. The first chain (`m32b/regress.sh`) found those checkouts cleared at M32's close, so those ten ran again with them checked out anew (`m32b/regress2.sh` and `regress3.sh`). M30's ran as its plain copy: the first chain named its copy for M32's trial build of the cadet, which is gone as well.

### Known issues

- **The talents are small.** Rank 1 moves no order's wins past chance (above): the third fight changes numbers a player can read on the button and preview, not outcomes. They are data: bigger numbers, or a use and a number together, would make a rank felt (§9). Your call.
- **The Provost's raid at the hangar is harder than M30's test shows.** Over the test's 150 fights the deserter's crew beats it 48% of the time and the miner's crew beats Con-Reg's 53%, within its 10 points. Over 500 fights it is 42% to 57% at rank 0 and 46% to 63% at rank 1, and over 150 at rank 1, 49% to 61%. It was so before M32b: rank 0 is M32's to the fight. Evening it out is a change to the raid's party (`provostraid`), not to the ranks, so I left it (§9). Your call.
- **A recruit's row is tall on the cover screen.** With a background it takes about eight lines in the crew card's half-width list, so the list for hire shows about one at a time (§9).
- **The fee counts traits, not their worth:** Hothead costs what Patched suit does (§9).
- **The test players' captains take no traits,** so the 14 new ones reach the voyages only through recruits (§9).

### Test on the phone

1. **New game:** the captain screen's 20 traits. Scroll them, pick two, and read the last one's words under the list, on the cover screen and unfolded.
2. **Act 1:** play three jobs. At the third one's end the panel names everyone who stood in all three reaching rank 1, and what it gives; back at the hangar the crew panel shows a chevron after each name.
3. **A fight with a ranked crew:** the chevrons on the crew buttons; a long press on one says its rank; an order's preview at its rank's number (Suppress −40, a door welded for 5 rounds, Patch 5).
4. **Act 2, at a station:** the crew card says each one's rank and fights. A recruit says their background, rank and fee; sign a ranked one on and see the credits drop by that fee.
5. **A boarding with four aboard:** the squad card's chevrons.
6. **An old save** (v24): it opens, everyone at 0 fights.

### Next session

M33 Factions, quests and companions (Phase 6). First task: settle its Done when with Evan (ROADMAP.md has a draft), and ask about the two calls in the known issues: whether the talents should be bigger, and whether to even out the Provost's raid at the hangar, measuring M30's test over 500 fights.

## M32 All jobs (2026-10-15)

**Status:** done, and the ROADMAP.md box is ticked. Four jobs join the marine, the engineer and the medic, seven in all. Every job now does three things: an order in a fight, with a few uses; an effect aboard on the run; and an effect at the colony.

| Job | Order | Aboard | At the colony |
| --- | --- | --- | --- |
| Marine | Suppress ×2: an enemy in sight shoots at −30 until its side's turn ends | the guns +10 to hit in the approach | each defense's shot at a lander +10 (60%) |
| Engineer | Weld ×2: the door beside it shut for 3 rounds | a wrecked part fixed after each jump, the cheapest first | each mine +1 material a day |
| Medic | Patch ×2: an ally beside +3 hit points, or up from down | a med bay +1 a jump (M23) | a powered infirmary +1 a day (M26) |
| Pilot | Hustle ×1: one more action this turn | the ship's evasion +10 | in the squad, each leg of a trip a day shorter, never under 1 |
| Scout | Mark ×2: the crew's shots at an enemy +15 until their next turn ends | a scan reaches 3 links (2) | a fourth place within reach |
| Xenobiologist | Sedate ×2: a dart at a shot's odds; a hit sleeps the enemy through its turn | a survey takes no day: no supplies, no heat, no hunters' roll | each farm +1 food a day |
| Quartermaster | Kit out ×2: a full clip and +1 armor, once each | the lockers hold 10 more supplies | the stores keep 20 more food and 20 more materials |

The new jobs' numbers:
- **Pilot:** 8 hit points, aim 65, defense 10, moves 5; a pistol.
- **Scout:** 8, 75, 5, 5; a long rifle, new: better at long range, worse close.
- **Xenobiologist:** 7, 60, 5, 4; a dart gun, new.
- **Quartermaster:** 10, 60, 0, 4, armor 1; a carbine.

Each has its own helmet, so the portrait badges tell all seven apart. The best of a job counts, once: a second of the same job adds nothing. The deserter's crew is now a marine, a pilot and a medic, the smuggler's an engineer, a quartermaster and a medic, and recruits roll from all seven.

**How it was picked:** Evan answered four questions (2026-10-15), each the recommended answer but the first:
- **Scope:** "Jobs now, the rest in M32b". Traits, talents and recruits' backgrounds are M32b.
- **Talents:** "Job ranks", for M32b.
- **In a fight:** "One order each", with a few uses a fight.
- **Where the new jobs come from:** "Two start crews take one", and all seven sign on as recruits.

Then calls I made while measuring, not asked, each easy to change:
- **The raids have parties of their own.** With the orders in use, the deserter's crew beat the Provost's three MPs at the hangar 9% of the time, against the miner's 53%. Cutting the MP's numbers (11 hit points to 9, aim 75 to 70) fixed the raids, but it moved every Provost fight: the start crew won boardings of the frigate 62% of the time at home, against main's 19%. So the MP keeps main's numbers, and the deserter's raids are now an MP, a Provost cadet and an MP (`provostraid`); the frigate keeps its three MPs. The cadet is a new enemy, a junior MP: 6 hit points, aim 65 and armor 1, with a carbine, in a light skinsuit with plates and a mirrored visor (the one look of 180 that the figure test tells apart from every enemy's). M30 asks the Provost's raiders to be fewer than Con-Reg's four and tougher, and its test reads that as every one armored: a fleet rating in the middle has no armor and failed it, two MPs alone were beaten 80% of the time, and an armored rating (8 hit points) 34%. Old Halloran's colony raid has a second enforcer (`halloranraid`), and the yacht keeps its crew. The Hallorans' hangar raid has its enforcer second, not third.
- **The test players' fights end.** Past 40 rounds, act 1's fights now press on as boardings do (`playOn`), and a hopeless shot (under 10%) or overwatch then gives way to a step nearer. Where no step is nearer, the unit moves to a tile with an enemy in sight. While tuning, a deserter's act 1 run stood on overwatch for 60 rounds without it, and never launched.
- **A fight that can't end stops the test player's trips.** It is not a rules change, so it is your call (below and §9).

Done when (ROADMAP.md, M32, in full there):
- **The four jobs** in `data/jobs.json` with their numbers, weapons, looks and helmets.
- **An order each,** with its uses, shown as a button of 48 px or more, previewed and confirmed, and saved with the fight.
- **The test players use the orders;** the scripted player doesn't, so the golden battle holds.
- **A ship effect and a colony effect each.**
- **Shown as used** (Law 4), and said on the crew card, the recruits on offer and the captain screen.
- **Start crews** and recruits.
- **Every job counts:** a test for each order, ship effect and colony effect, and each order measured with and without (`tools/sim.js`).
- **Saves:** `SAVE_VERSION` 24, with a migration from 23.
- **Balance:** act 1 within 10 minutes of M31's slow medians, every run launching; raids measured against M31's and reported; the voyage within 5 runs of 30 of M31's; the voyage tests passing.
- **Touch** at the three sizes.

How each is met:
- **The four jobs:** `tests/data.test.js` and the validator (7 crew jobs, 6 weapons, each look's helmet one its suit has). `tests/portraits.test.js`: every job's helmet draws, and each is its own. The badges by touch, below.
- **The orders:** `tests/orders.test.js`, one test each, and the Fight screen's previews (the odds a Mark or Suppress changes, a Sedate's dart as a shot's odds card), the battle log's lines, and a fight saved with marks, sleep, suppression, welds and uses. By touch, `m32/fight-orders.mjs`: each order previewed and given, then a quit and reopen.
- **The test players:** `tests/orderAi.test.js`, a plain rule for each order, and the crew's AI gives orders first; enemies have none. The golden battle and replays are unchanged (`tests/golden/`).
- **Ship and colony effects:** `tests/edges.test.js`, one test each, through the screens that show them (the approach's odds, a scan's reach, a survey's cost, the jump plan's fix, the day's plan, a trip's days, the places, the lander's odds, the holds).
- **Said where it counts:** `tests/crewJobText.test.js`: every kind the rules know has its words, so a job made of known kinds needs no code. The crew card and the recruits say a line each ("Mark ×2 · scans +1 link · +1 place"), and the captain screen says all three in full.
- **Start crews:** `tests/backgrounds.test.js` and `tests/campaign.test.js`; by touch, `m32/verify.mjs`.
- **Every job counts:** the harness's test (`tests/harness.test.js`) checks every order is used by the crew's AI and that the same fights come out differently without it. The measurement is under Verified.
- **Saves:** `tests/orders.test.js` (a v23 fight under way carries on with every crew member's 2 uses, nothing on anyone, no door welded) and `tests/edges.test.js` (a v23 run's scans each keep the 2 links they reached).
- **Balance:** under Verified. Act 1: every run launches, slow medians 44, 39 and 46 (M31: 42, 41 and 41). Raids: each pursuer's within 10 points of Con-Reg's. The voyage within 5 of M31's. The voyage tests pass.
- **Touch:** under Verified.

Some of this changes what was there before:
- **The quartermaster's stores** count while one is in the crew, home or away (the Done when said home), so a trip never leaves food or materials past what the stores keep.
- **A scan keeps its reach.** The run remembers how far each scan saw, so a scout who leaves hides nothing already seen; saves v24 carry it.
- **The raid parties**, above.
- **The backgrounds' act 1 check** (`tests/run.test.js`, M30's) flies the 50 seeds `tools/run.js` measures, not 10. Over seeds 1 to 10 the deserter's slow median was 50 minutes against the miner's 38, 2 past the limit; over 50 it is 39 against 44.
- **Four voyage checks** new content broke on seeds 1 to 30 fly 100 seeds, against main's 100-seed rates (CLAUDE.md):
  - every careful run scans: 1 of 100 never does, main 0;
  - fed with a med bay: 77 of 100, main 79;
  - fed with surgery: 80, main 81;
  - the large hold going hungry less than the lockers alone: 22 hungry jumps over 100 runs against 94 (main: 5 against 92).

  Over seeds 1 to 30 the first three missed by one run each. Seed 24 launches broke and starves with or without a large hold, which gave the large hold 22 hungry jumps against the lockers' 17 there.
- **The voyage test's step checks** know the new jobs:
  - a boarding leaves everyone with at least a hit point, where it said "wounds stay": a medic's Patch can give back what was lost before the fight;
  - a survey with a xenobiologist aboard moves nothing (the tool's step says it was free);
  - the holds hold 10 more from the step that signs a quartermaster on.
- **The trip test's days** count each leg, since a pilot in the squad can shorten them. The trip report's days are the trip's, out and home.
- **`SAVE_VERSION` 24.**
- **Tests changed on purpose:**
  - `run.test.js`: 50 seeds;
  - `voyage.test.js`: the rates, the boarding check and the trip days;
  - `encounter.test.js`: ten cutters boarded, not six. The marine aboard makes the guns surer, which changes which approaches end in a boarding;
  - `raids.test.js` and `raidText.test.js`: the lander's odds with a marine at home;
  - `days.test.js`, `colonyBuild.test.js` and `colonyText.test.js`: the engineer's mines;
  - `approachText.test.js`: the crew's row;
  - `travel.test.js`, `system.test.js` and `events.test.js`: the scout's reach, the xenobiologist's surveys and the quartermaster's lockers;
  - `backgrounds.test.js` and `campaign.test.js`: the start crews;
  - `contracts.test.js`: an unknown job is now "cook", since "pilot" is a job;
  - `data.test.js`: the validator's counts, 15 enemies and 21 encounters;
  - `makers.test.js`: `SAVE_VERSION` 24;
  - `harness.test.js`: the new options.

### Shipped

- **Data:**
  - `jobs.json`: the four jobs, and every job's `order`, `station` and `colony`;
  - `weapons.json`: the long rifle and the dart gun;
  - `backgrounds.json`: the two start crews, and the deserter's and smuggler's raiders;
  - `enemies.json`: the Provost cadet;
  - `encounters.json`: `provostraid` and `halloranraid`, and the Hallorans' order.
- **The sim:**
  - `orders.js`: the seven orders, their reach, odds and effects;
  - `orderAi.js`: the test players' rule for each;
  - `edges.js`: a crew's ship and colony effects, and who brings them;
  - `battle.js`, `odds.js`, `moves.js`, `sight.js`, `terrain.js`, `battleLog.js` and `battleShape.js`: marks, suppression, sleep, welds, kit and uses;
  - `fight.js`: the order's preview and confirm;
  - `travel.js`, `survey.js`, `approach.js`, `encounter.js`, `medbay.js`, `colony.js`, `colonyBuild.js`, `days.js`, `raids.js` and `expeditions.js`: the effects;
  - `save.js`: v24 and the migration;
  - `runShape.js` and `tripShape.js`.
- **The UI:**
  - the Fight screen's order button, its previews and hints, the green badges on the one ordered, and welded doors' plates;
  - `crewJobText.js`: every job's words from its numbers;
  - the captain screen's three lines, and the crew card's and recruits' line;
  - the approach's crew row, the scan, survey, jump, trip and lander words;
  - seven order icons.
- **Tools:**
  - `sim.js`: `--squad`, `--orders all|none|kinds`, and `--compare` against every order;
  - `boarding.js`: `playOn`, the drag phase's step nearer and `sealedIn`;
  - `run.js`: act 1's fights through `playOn`;
  - `voyage.js` and `voyagePlan.js`: the lockers, free surveys, trip days, and the trips stopping at a sealed fight.
- **Tests:** four new files (`orders.test.js`, `orderAi.test.js`, `edges.test.js`, `crewJobText.test.js`), a sealed fight in `boarding.test.js`, each job's own helmet in `portraits.test.js`, and the changes above. 823 tests in all, 780 on M31.
- **Docs:** ROADMAP.md: §4.5 and §5 (the jobs as built), M32 as built, ticked, §8's stall risk, and five new in §9.

Decisions made along the way, not asked (each easy to change):
- **The test players' rules** (`src/sim/orderAi.js`), "good" being a 40% shot:
  - Suppress when its own best shot isn't good, at the enemy with a good shot at the crew;
  - Weld when it or an ally beside is down to half, an enemy within 6 steps and none in sight;
  - Patch a downed ally first, a hurt one only when no shot is good;
  - Hustle with an enemy in sight and no good shot;
  - Mark the weakest enemy in sight;
  - Sedate the biggest enemy at good odds;
  - Kit out an ally beside, then itself.
- **The words:** each order's, effect's and job's words are made from its numbers (`crewJobText.js`).
- **The order's place:** a button of its own on the Fight screen's column, named for the order with its uses ("Mark · 2"), in the good green.

### Known issues

- **A fight can seal itself in, and then a player is stuck.** No one passes the other side's fallen, so the crew's fallen in the only doorway can leave the last of the crew and the enemies with no tile in sight of each other, for good. A fight can't be left, so a save would be held in it. One of the smuggler's 100 test voyages met it on a trip, and the test player's trips stop there. It's your call (§8, §9). The fix I measured lets anyone pass those who have bled out: hangar raid wins then fell from 53% to 41% (Con-Reg) and from 46% to 27% (the Hallorans), and one smuggler's act 1 run stopped launching. A Withdraw order away from home is the other candidate.
- **Raids are easier than M31's.** The orders help the crew most in raids (hangar / colony, M31's in brackets):
  - Con-Reg: 53% / 41% (28% / 17%);
  - the Provost: 48% / 49% (33% / 15%);
  - the Hallorans: 46% / 41% (35% / 19%).

  The Done when asked only that they be measured; the pursuers stay within 10 points of each other. If raids should stay as hard as M31's, the raid parties are the lever, as data.
- **Boardings are easier too,** most when the crew defends its own ship: 10 to 26 points more at home against six of the eight parties (the Provost's cutter 51% against main's 25%, the frigate 37% against 19%), and up to 14 boarding hers.
- **Suppress and Weld don't help the test players.** Over 300 fights each, the crew's AI gives them 0.3 times a fight, and the crew wins 1 point less with each than without, within chance. Kit out adds 14 points, Patch 6, Sedate 6. Their rules could be better; a player will use them better (§9).
- **A raid's result hangs on its party's order.** Raiders deploy in the party's order, and the Hallorans' enforcer first to sixth gave the smuggler's crew 68%, 46%, 19%, 63%, 41% and 67% at the hangar (§9).
- **Long job names** are cut on the cover screen's run crew panel ("Quarter…"), and the captain screen's three lines need a swipe of its panel there (§9).
- **The holds' hint after a quartermaster leaves** says to "Refit a hold back on", when signing a quartermaster on would also do it.
- **The voyage test player's hiring** counts the holds as they are, not with a quartermaster recruit's lockers, so it signs one on less readily than it could.
- **The act 1 tails:** the deserter's slowest run takes 143 minutes at the slow pace and the smuggler's 178 (M31: 146 and 170).

### What to test on the phone (Galaxy Z Fold 6)

1. **New game → Navy deserter → Next:** the captain may be a marine, a pilot or a medic. Tap each and read its three lines (on the cover screen, swipe the middle panel). Start as the pilot.
2. **A job:** in the fight, pick each crew member, then:
   - tap their order's button (green, with the uses left): Suppress shows the enemy's shot before and after, and Hustle says what it gives;
   - tap the board or the button again to give it;
   - quit to the title mid-fight and Continue: the uses left, a mark, a weld or a suppression are kept.
3. **New game → Burned smuggler:** the quartermaster in the crew. Kit out in a fight; on the run, Supplies says 40, not 30.
4. **At a station:** a recruit of a new job has a line under their name; sign them on in two taps. With a scout aboard, Scan's first tap says 3 jumps and names the scout.
5. **The approach:** with a marine and a pilot aboard, the Crew row (guns +10 · evasion +10).
6. **At the colony:**
   - an engineer's mines and a xenobiologist's farms in the build list;
   - a pilot's trip days in the plan;
   - Defend's lander odds with a marine home (60%).
7. **Tell me:**
   - whether the orders feel worth a tap, and which never get used;
   - whether raids now feel too easy (the numbers above);
   - what to do about a fight that can't end (Known issues).

### Next session

M32b Talents, traits and recruits' backgrounds (Phase 6). First task: settle its Done when with Evan. ROADMAP.md has a draft: job ranks at 3 and 8 fights, traits toward 20, and recruits' backgrounds. Also open: the fix for a fight that can't end.

### Verified here

- `node --test`: 823 pass, in about 4 min 30 s. `node tools/validate-data.js`: OK (7 crew jobs, 6 weapons, 15 enemies, 21 encounters).
- **The golden files are unchanged**, and the fixed-seed battle replays as before: the scripted player gives no orders.
- **The fights** (`node tools/sim.js --orders none --compare`; the balance rule: no number in `data/balance.json` changed). The squad of M11 (a marine, an engineer and a medic) against the boarding party on the ten ships, with every order → with none:

  | Ship | Crew wins | Boarders win | No winner |
  | --- | --- | --- | --- |
  | Example ship | 70% → 65% | 30% → 35% | 0% → 0% |
  | Pirate cutter | 58% → 47% | 27% → 37% | 15% → 16% |
  | Patrol corvette | 53% → 56% | 37% → 35% | 10% → 9% |
  | Derelict hauler | 43% → 41% | 48% → 50% | 9% → 9% |
  | Con-Reg repo tug | 45% → 39% | 39% → 45% | 16% → 16% |
  | Con-Reg gunship | 32% → 31% | 42% → 43% | 26% → 26% |
  | Provost cutter | 56% → 46% | 36% → 45% | 8% → 9% |
  | Fleet frigate | 32% → 30% | 49% → 50% | 19% → 20% |
  | Halloran runner | 56% → 55% | 38% → 36% | 6% → 9% |
  | Halloran yacht | 55% → 44% | 24% → 34% | 21% → 22% |
  | All, 1,000 | 50% → 45% | 37% → 41% | 13% → 14% |

  Shots 23,338 → 22,895; the crew hits 57% → 56%, the boarders 41% either way. The crew gives Patch 0.8 times a fight, Suppress 0.4 and Weld 0.1 (this squad's three).

  With no orders the fights are main's to the shot.
- **Each order measured** (`tools/sim.js --fights 300 --squad <the job>,engineer,medic --orders <every other kind> --compare`; the medic's squad has a marine): the crew's wins with every order, then without the one:

  | Order | With | Without | Given a fight |
  | --- | --- | --- | --- |
  | Suppress | 51% | 52% | 0.3 |
  | Weld | 56% | 57% | 0.3 |
  | Patch | 47% | 41% | 0.8 |
  | Hustle | 35% | 34% | 0.3 |
  | Mark | 40% | 39% | 1.2 |
  | Sedate | 25% | 19% | 1.3 |
  | Kit out | 50% | 36% | 2.0 |
- **Act 1** (`node tools/run.js --runs 50 --background …`), every run reaching launch:

  | Background | Jobs | Done | Quick | Slow |
  | --- | --- | --- | --- | --- |
  | Debt-bound miner | 6 (3 to 12) | 75% of 321 | 27 (11 to 50) | 44 (19 to 81) |
  | Navy deserter | 5 (3 to 18) | 61% of 347 | 24 (11 to 91) | 39 (19 to 143) |
  | Burned smuggler | 6 (2 to 26) | 73% of 378 | 28 (11 to 112) | 46 (18 to 178) |
- **Raids** (`node tools/raids.js`, 150 fights a row), the crew's wins, M31's in brackets:

  | Background | At the hangar | At the colony |
  | --- | --- | --- |
  | Debt-bound miner | 53% of 4 (28%) | 41% of 4 (17%) |
  | Navy deserter | 48% of 3 (33%) | 49% of 3 (15%) |
  | Burned smuggler | 46% of 6 (35%) | 41% of 5 (19%) |
- **The run and the colony** (`node tools/voyage.js --runs 30 --background all`), M31's in brackets:

  | Background | Fed | Met | Raids | Won | Lost | Runs lost |
  | --- | --- | --- | --- | --- | --- | --- |
  | Debt-bound miner | 25 (26) | 12 (12) | 35 | 28 | 7 | 5 (8) |
  | Navy deserter | 23 (25) | 13 (10) | 23 | 20 | 3 | 3 (4) |
  | Burned smuggler | 27 (29) | 7 (3) | 19 | 15 | 4 | 4 (6) |

  Every run launches. Fed, met and runs lost are each within 5 of M31's: the most is the smuggler meeting the hunters in 4 more.
- **Over 100 seeds**, the voyage tests' new rates against main's: careful fed 82 / 82, never scanning 1 / 0; with a med bay fed 77 / 79; with surgery 80 / 81; with a cargo hold 90 / 90; with bunks 90 / 92; with the large hold 98 / 98, and its hungry jumps 22 / 5 against the lockers' 94 / 92.
- **Boardings** (`node tools/sim.js --boardings`, 63 fights a row), the start crew's wins, main's in brackets:

  | Ship | Party | At home | Boarding her |
  | --- | --- | --- | --- |
  | Pirate cutter | three pirates and a brute | 68% (54%) | 57% (48%) |
  | Patrol corvette | two guards and a heavy | 51% (35%) | 43% (44%), 1 stalled |
  | Con-Reg repo tug | two agents and a heavy | 54% (44%) | 51% (44%) |
  | Con-Reg gunship | two agents, a heavy and a guard | 6% (6%), 2 stalled | 17% (14%) |
  | Provost cutter | two MPs and a fleet rating | 51% (25%) | 41% (38%) |
  | Fleet frigate | three MPs | 37% (19%) | 27% (22%) |
  | Halloran runner | two collectors and an enforcer | 67% (49%) | 70% (56%), 1 stalled |
  | Halloran yacht | four collectors and an enforcer | 19% (14%), 1 stalled | 17% (17%), 1 stalled |
- **M32's browser checks by touch,** at 905 × 370, 821 × 283 and 960 × 825:
  - `m32/fight-orders.mjs`: 48 of 48 at each. Each order previewed (the hint, Sedate's odds card) and given; a quit and reopen; every button 48 px or more; no console errors.
  - `m32/verify.mjs`: 22 of 22 at each. The deserter's and smuggler's captains and crews; the crew card's and recruits' lines; a scout signed on; the scan's words; offline; no console errors.
- **Every earlier milestone's browser check** passes, run one after another, at the three sizes unless named:
  - M31 28, M30 27, M29 34, M28 32, M27 32, M26 18, M25 21, M24 20, M23h 16, M23g 20, M23f 28, M23e 27, M23d 25, M23c 25, M23 36, M23b 8;
  - M22 35, M21 32, M19 52, M20 32;
  - M18 43, M17 37, M16 29, M15 30;
  - M10 20 (its three sizes in one run), and M8's fights and column;
  - at 905 × 370 only: M14's saves 10, M13 24, M14 39 (its count goes with the jobs it rolls), and M8's extras.

  Eleven copies were adapted, not the game, for what M32 changes on purpose (`verify32.mjs` in each, M14's saves check `saves32.mjs`):
  - M31's, M30's, M29's, M28's and M27's: a save made by main comes back as v24. M30's also has the new start crews and the Provost's raid (two MPs and a cadet), M29's the marine at home calling the lander's shots at 60%, and M27's the miner's engineer digging 1 more material a mine.
  - M19's: its walk to act 2's last jump point now sees off a hunter waiting where a sector begins. The miner's engineer fixes a wreck after each jump, so in sector 4 the ship outruns a hunt that boarded it on main, keeps its heat, and meets a Con-Reg gunship entering sector 5.
  - M18's, M16's, M15's and both of M14's: the crew's AI now gives its job's order first, and these checks have no button for an order, so their players play with the orders left out and the fights go as main's. M17's, M13's, M10's and M8's play without meeting one.

  M23g's and M23e's run as M31 adapted them (`verify31.mjs`); `m32/regress.sh` first ran their older copies, which fail on M31's makers as they did in M31. A container restart cut the chain in two, and the checks it had not reached ran after it (`m32/regress-rest.sh` and `regress-rest2.sh`).

## M31 Manufacturers (2026-10-15)

**Status:** done, and the ROADMAP.md box is ticked. Two more makers join the Yard and Bastion Arms, four in all, one past §5's target of three:
- **Kestrel Dynamics**, light and dear: a version of 16 parts, every one that weighs 2 or more but the reactor. Each has about a third less mass, half the hit points, and costs about a fifth more. Pearl fittings, coral stripes, violet flames, rose on the plans.
- **Scrapline**, cheap and power-hungry: a version of all 21 parts. Each costs about a third less and has a quarter fewer hit points. A part that draws power draws 1 more, and a reactor makes 1 less. Rust fittings, bare patches, green flames, lime on the plans.

Every act 1 shop carries some of both, five jobs drop them, and act 2's salvage has them. The pirates' cutters and the Hallorans' runner fly Kestrel's parts, and the derelict haulers Scrapline's.

**How it was picked:** Evan answered four questions (2026-10-15), each the recommended answer but the first:
- **Which maker:** "Both": Kestrel Dynamics and Scrapline.
- **Kestrel's trade:** "A real trade". Its ships get away more often, but its parts break sooner when hit, so a ship of them fares worse than the Yard's against some preset.
- **Enemy ships:** "The side that fits it": Kestrel's on the pirates' cutters and the Hallorans' runner, Scrapline's on the derelict haulers.
- **Where they come from:** "Shops and salvage, like Bastion".

Then three calls once measured, each the recommended answer:
- **"Judge it shielded":** at the mockups' fifth fewer hit points, Kestrel's start ship did better than the Yard's against every preset, shielded or not. Without a shield, every preset's first targets (engines and guns) die to one gun hit whoever made them, so fewer hit points don't show. Kestrel went to half the hit points, and its trade is judged with a shield fitted.
- **"No Kestrel reactor":** at half the hit points a Kestrel reactor had 15, so one 15-damage gun hit disabled any ship that flew one. The start ship's score against the pirate cutter went from −11 to +42 (wins less losses in 100 approaches), and in 100 test voyages the careful player won 59 approaches against main's 23. Kestrel's ships keep the Yard's reactor now.
- **"Rates over 100 seeds":** M31's new parts change how every test voyage rolls out, and five checks from M24 to M30 missed on seeds 1 to 30. Over 100 seeds M31's voyages were close to main's (better on most counts, a little worse on colonies short of air, surveys and housing), and main misses several of those limits past seed 30 as well. Those checks now fly 100 seeds, each within 15 in 100 of main's rate before M31.

Done when (ROADMAP.md, M31, in full there):
- **Data:** both makers in `data/manufacturers.json`, their versions on the Yard part's footprint, interior, fittings and icon; none worse than another part in every way.
- **Law 1:** Kestrel's start ship evades more against every preset, and with a shield fitted it fares worse than the Yard's against at least one. Scrapline's, with the reactor it then needs, fares differently, and its power counts in the flight checklist.
- **At a glance:** each maker's line on the plans and in the drawer, and its fittings, mark and flames outside.
- **The drawer:** each part's versions beside it, a maker picked from the sheet, construction mode with every maker's parts, every button 48 px or more.
- **Where they come from:** the shops, some jobs' drops, act 2's salvage; act 1 about as before.
- **Enemy ships:** the cutters and the runner on Kestrel's, the haulers on Scrapline's, rolled and kept only while the ship flies; boarding strips them; the golden ships file updated for the part names.
- **Saves and codes** load as before, neither version number changed.
- **The voyage** within 5 runs of 30 of M30's numbers, and the voyage checks M31's seeds broke as rates over 100 seeds.
- **Budget** and **Touch** at the three sizes.

How each is met:
- **Data:** `tests/data.test.js` checks the order (the 21 parts, then Bastion's 21, Kestrel's 16 and Scrapline's 21) and the validator's counts (79 modules, 4 manufacturers). `tests/makers.test.js` checks each maker's line against its base part:
  - the same shape, tags, interior and icon;
  - Kestrel's mass at most three quarters, hit points at most half, cost up to a quarter more;
  - Scrapline's cost at most 70%, fewer hit points, and power 1 worse wherever it isn't 0.

  `tests/catalog.test.js` (M23e's test) finds no part worse than another in every way among all 79.
- **Law 1** (`tests/approach.test.js`, 120 approaches a row):
  - **Kestrel:** evasion 39 against the Yard's 30, so every preset's guns hit it at lower odds, and fewer of their shots hit over all of them (against the patrol corvette about as many: 29% against 26%). Shielded, its parts break more often for each hit against four presets, and it fares worse than the Yard's shielded ship against four.
  - **Scrapline:** the reactor it needs costs evasion (25 against 30), and approaches end differently: against the Provost cutter it gets away in 64% against 27%.
  - **Its power:** `tests/makers.test.js`. The launched start ship with Scrapline's engines fails "Power −2 (8 made, 10 used)", and the fix asks for a reactor; all Scrapline's, it is 7 short, and one Scrapline reactor makes it fly.
- **At a glance:** `tests/scene.test.js`: each maker's rooms, fittings and nozzles in its own line on the plans (rose `#ff9ad2`, lime `#c8ee6e`), each line at least 60 apart from the others and from the plans' own colors. `tests/exterior.test.js`: each maker's fittings and mark (chevrons, stripes, patches) under the ship's paint, and its flames. By touch, below.
- **The drawer:** `tests/catalog.test.js` (each part with its versions beside it; a maker picked; construction mode counting every maker's parts on hand). The sheet's categories now start on a row of their own under the five maker tiles. By touch, below.
- **Where they come from:** each act 1 shop has Kestrel's and Scrapline's parts (the Tailings 6, the Strand 5, the Narrows 5); the scrap, breaking, insurance, hot cargo and seized jobs drop them; the salvage event has 6 more. Act 1 (`tools/run.js`, 50 runs a background): every run launches, with slow medians of 42, 41 and 41 minutes (M30: 45, 41 and 39).
- **Enemy ships:** `tests/makers.test.js`. Over 40 seeds, Kestrel makes 78% of the cutters' parts that it makes and 76% of the runners', and Scrapline 64% of the haulers'. Layouts are unchanged, mirrored pairs are alike, and every ship passes its flight checklist. `tests/encounter.test.js`: boarded cutters strip Kestrel's parts. The golden ships file differs only in part names.
- **Saves and codes:** `tests/makers.test.js`: `SAVE_VERSION` 23 and blueprint codes version 4; a code made by main opens with the Yard's parts; each maker's parts round-trip in codes, and in a saved campaign fitted and on hand. By touch, a save made by main opens.
- **The voyage:** `node tools/voyage.js --runs 30 --background all`, under Verified: fed, met the hunters and runs with a raid lost each within 5 of M30's. `tests/voyage.test.js` flies the rate checks over 100 seeds (below).
- **Budget:** the frame rates under Verified.
- **Touch:** M31's browser check, under Verified.

Some of this changes what was there before:
- **Kestrel makes no reactor** (Evan's call above), so the Done when's "every part that weighs 2 or more" reads "but the reactor".
- **The voyage tests** fly 100 seeds for seven checks, held within 15 in 100 of main's rates before M31 (5 for what main saw under 10 times):
  - M24's hunters met managing heat and ignoring it, and fed managing it;
  - M25's hunger in the system and its runs that survey two worlds or more;
  - M26's colonies short of air and those that house everyone;
  - M30's fed, met and raids lost from each background's start, each against main's own rate for that start.

  The gaps to the original targets are in §9. CLAUDE.md's Testing section says how a check new content breaks is treated from now on.
- **The trip test player** (`tools/voyagePlan.js` `refitForSquad`) takes a power plant back aboard from the colony when the squad's berths and air leave the ship short of power. Ships with Scrapline's engines from act 1 hit this, and flew no trip in 14 of 300 runs without it.
- **The voyage tests' fitted runs** put a small reactor on first where the ship has no power to spare for the med bay or bunks.
- **The approach harness** (`tools/approach.js`) counts the other ship's shots (a Hit column) and flies each maker's start ship twice: as made to fly (with the reactor it needs, if any), and with its maker's shield added.
- **The drawer's sheet** starts its categories on a row of their own under the makers.
- **The short name** in `data/manufacturers.json` may be 9 letters ("Scrapline"), up from 8.
- **`SAVE_VERSION` stays 23**, and blueprint codes stay version 4.
- **Tests changed on purpose:**
  - `data.test.js`: the order and counts, the short name's 9 letters, and a maker with no skin named `orrery`;
  - `scene.test.js`, `exterior.test.js`, `catalog.test.js` and `makers.test.js`: every maker, not just Bastion. The cutters and haulers fly their makers now, and Scrapline's power in the flight checklist is a new test in `makers.test.js`;
  - `approach.test.js`:
    - Law 1 for Kestrel and Scrapline;
    - the shield array's mass lets the Kestrel runner board the ship more often (4 points of score at 300 approaches before the reactor change, and at 120 since), a trade now named in the test;
    - the gun damage test reads the cutter's own reactor;
    - the round order test finds a cutter that still closes with its last reactor about to go;
  - `encounter.test.js`: boarded cutters strip Kestrel's parts (new);
  - `builderText.test.js`: Kestrel's and Scrapline's cards (new);
  - `voyage.test.js`: the rate checks and the fitted runs, above;
  - `tests/golden/ships.txt`, regenerated: part names only.

### Shipped

- **Data:**
  - `manufacturers.json`: Kestrel Dynamics and Scrapline, each with its short name, card line and mark;
  - `modules.json`: Kestrel's 16 versions and Scrapline's 21;
  - `ships.json`: `makers` on the cutter and the runner (Kestrel, 80 in 100) and the hauler (Scrapline, 80);
  - `districts.json`: both makers in each shop;
  - `contracts.json`: five jobs' drops;
  - `events.json`: the salvage event.
- **The render:**
  - `palette.js`: Kestrel's and Scrapline's skins (fittings, flames, marks and plans lines);
  - `exterior.js`: the stripes and patches marks;
  - `style.css`: the sheet's categories on a row of their own.
- **The sim:** no rule changed. `gen/ship.js`'s note says a version hungry for power stays the base part when it would fail the flight checklist, as a heavy one does.
- **Tools:**
  - `approach.js`: `madeToFly`, the shielded rows, and the shots and hits counted;
  - `voyagePlan.js`: `refitForSquad` for power;
  - `validate-data.js`: a short name of up to 9 letters.
- **Tests:** three new (Kestrel's and Scrapline's cards in `builderText.test.js`, boarded cutters in `encounter.test.js`, Scrapline's power in `makers.test.js`), and the changes above. 780 tests in all, 777 on M30.
- **Docs:**
  - ROADMAP.md: §4 (the makers as built, the drawer, saves), §5 and §6 (four makers), M31 with Evan's three later calls, ticked, and §9 (three new, two resolved, two updated);
  - CLAUDE.md: the Testing section's rule for voyage checks.

Decisions made along the way, not asked (each easy to change):
- **The numbers**, from M23g's mockups and Evan's call:
  - Kestrel: mass × 0.7 and hit points × 0.5, rounded (at least 1), cost × 1.2 to the nearest 5;
  - Scrapline: hit points × 0.75 rounded, power 1 worse where it isn't 0, cost × 0.65 to the nearest 5 (at least 5).
- **The lines on the plans:** Kestrel's rose `#ff9ad2` and Scrapline's lime `#c8ee6e`. The closest pair among the plans' colors is Kestrel's rose and styling's violet, 66 apart in red, green and blue.
- **The marks:** two coral stripes along a Kestrel part's roof; two bare patches on a Scrapline part's, light and dark grey.
- **The shops:**
  - the Tailings: Scrapline's engine, reactor, quarters and cargo hold, and Kestrel's engine and gun;
  - the Strand: Kestrel's engine, gun and shield, and Scrapline's gun and reactor;
  - the Narrows: Kestrel's engine, cargo hold and life support, and Scrapline's engine and shield.

  Each is weight 1 in the shop's draw, as most parts are (the Yard's engine is 9).
- **The drops:**
  - the scrap and breaking jobs: Scrapline's engine and small reactor;
  - insurance: Kestrel's engine and cargo hold;
  - hot cargo: Kestrel's cargo hold;
  - seized: Kestrel's shield.
- **The salvage event:** Kestrel's engine, shield and gun, and Scrapline's engine, reactor and shield, 1 each.
- **The enemy makers' odds:** 80 in 100 a part, as the corvettes' Bastion.

### Known issues

- **The pirates are a little harder than main's.** Over 120 approaches each, the start ship scores −19 against the cutter and −33 against the runner, against main's −10 and −22. The Kestrel runner boards it in 33 against 23. The cutter boards it about as often (21 against 18), but the start ship boards or wrecks the cutter in 2 against 8, and gets away from it in 53 against 30. Every other preset's row is main's.
- **Kestrel's start ship takes about as many hits as the Yard's against the patrol corvette** (29% of its shots against 26%), which aims at guns and the reactor first. Against every other preset fewer land.
- **The shield array against the Kestrel runner:** its mass lets the runner board the ship more often, 4 points of score worse than without it. Law 1 names it as a trade.
- **Act 1's long tails:** the deserter's slowest run takes 146 minutes at the slow pace and the smuggler's 170, against 131 and 121 on M30. The medians hold.
- **Some ships launch with no power to spare:** act 1's test player buys Scrapline's engines (in 7 of the miner's 30 runs), which draw 1 more. A med bay fitted then needs a reactor with it.
- **The voyage tests hold main's rates, not the original targets:** the miner managing heat meets the hunters in about a third of runs (M24's pick: a fifth), 3 to 9 runs in 100 go hungry in the system (5 to 14 on main; M25: none), and the smuggler meets them about half as often as the miner (M30: about as often). §9, for Phase 7.
- **Colonies short of air:** a part fitted on the run can hang off the life support, which then can't go. 7 of the deserter's 100 colonies (3 on main), 1 of the miner's (0). §9.
- **The test suite is slower:** about 4 min 15 s here, the voyage tests 3 min 20 s alone.
- **Kestrel's stripes are thin:** on the folded screen they read as a coral edge (§9).
- **Scrapline's rust on a rust-painted hull** blends in (§9, since M23g).
- **The Enemy ships sandbox on the folded screen** draws a ship a few cells across under its two rows of preset buttons (since M30).

### What to test on the phone (Galaxy Z Fold 6)

1. **The drawer:** All, each part with its versions beside it, in amber, rose and lime. Open the sheet: five makers above the categories. Pick Kestrel, then Engines (2); then Scrapline (3).
2. **Fit** a Kestrel engine and a Scrapline engine. The chip asks for a reactor: Scrapline's engine draws 2. Long-press each for its card ("Next to the Yard's: …").
3. **Hull:** the Kestrel engine in pearl with coral stripes and a violet flame, the Scrapline one in rust with grey patches and a green flame.
4. **The shop:** a Kestrel or Scrapline part in stock; buy one in two taps.
5. **The Enemy ships sandbox** (`?dev=1`): the pirate cutter in Kestrel's parts, the derelict hauler in Scrapline's, on the plans and outside.
6. **On the run:** pirates in Kestrel's parts; board one, and its salvage may be Kestrel's.
7. **Tell me:**
   - whether the four makers read apart at a glance, and whether Kestrel's stripes need to be bolder;
   - whether Kestrel's lightness and Scrapline's price feel like choices worth weighing;
   - whether the pirates feel right: a little tougher than before.

### Next session

M32 All jobs, traits and talents (Phase 6, v0.4). First task: settle its Done when with Evan; ROADMAP.md has a draft (four more crew jobs, traits toward 20, and talents still to define).

### Verified here

- `node --test`: 780 pass, in about 4 min 15 s. `node tools/validate-data.js`: OK (79 modules, 4 manufacturers).
- **`tests/golden/ships.txt`, regenerated on purpose:** 66 lines, the cutters', runners' and haulers' part names; with the makers' prefixes taken off, it is main's.
- **Law 1** (`node tools/approach.js --runs 120`), the start ship's score against each preset (wins less losses in 100):

  | Ship | Cutter | Corvette | Repo tug | Gunship | Provost cutter | Frigate | Runner | Yacht | Evasion |
  | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  | Yard's | −19 | −18 | −22 | −13 | −17 | −12 | −33 | −12 | 30 |
  | Kestrel's | −4 | −4 | −8 | −3 | −11 | −3 | −12 | −3 | 39 |
  | Yard's, shielded | −3 | −10 | −13 | −9 | −2 | −8 | −26 | −8 | 28 |
  | Kestrel's, shielded | 3 | −2 | −6 | −11 | −8 | −11 | −17 | −11 | 30 |
  | Scrapline's | −28 | −12 | −23 | −16 | −16 | −16 | −35 | −17 | 25 |
  | Bastion's | −32 | −17 | −10 | −12 | −7 | −10 | −57 | −12 | 21 |

  The share of the other's shots that hit the Yard's ship is 20% to 38%, and Kestrel's 14% to 29%.
- **Act 1** (`node tools/run.js --runs 50 --background …`), every run reaching launch:

  | Background | Jobs | Done | Quick | Slow |
  | --- | --- | --- | --- | --- |
  | Debt-bound miner | 6 (3 to 16) | 72% of 334 | 26 (11 to 68) | 42 (19 to 108) |
  | Navy deserter | 5 (3 to 18) | 65% of 335 | 25 (12 to 92) | 41 (19 to 146) |
  | Burned smuggler | 6 (2 to 26) | 76% of 374 | 25 (9 to 107) | 41 (16 to 170) |
- **The run and the colony** (`node tools/voyage.js --runs 30 --background all`), with M30's in brackets:

  | Background | Fed | Met | Raids | Won | Lost | Runs lost |
  | --- | --- | --- | --- | --- | --- | --- |
  | Debt-bound miner | 26 (25) | 12 (10) | 34 | 21 | 13 | 8 (5) |
  | Navy deserter | 25 (27) | 10 (12) | 26 | 21 | 5 | 4 (5) |
  | Burned smuggler | 29 (28) | 3 (5) | 32 | 25 | 7 | 6 (8) |
- **Over 100 seeds**, the careful player managing heat and refitting, main before M31 against M31 (in 100 runs; main's smuggler 99, seed 70's boarding stalling):

  | | Miner | Deserter | Smuggler |
  | --- | --- | --- | --- |
  | Met the hunters in the act's sectors | 33 / 31 | 31 / 27 | 9 / 11 |
  | Met them at all | 42 / 44 | 45 / 34 | 19 / 22 |
  | Crossed fed | 73 / 83 | 80 / 82 | 89 / 92 |
  | Hungry in the system | 14 / 9 | 11 / 6 | 5 / 3 |
  | A colony short of air | 0 / 1 | 3 / 7 | 0 / 0 |
  | A raid lost | 29 / 26 | 20 / 10 | 18 / 13 |

  Ignoring heat, the miner met the hunters in all 100 runs, on main and here. Two worlds or more surveyed: 68 on main, 65 here; everyone housed: 41, 36. The trips flown: every run here; on main the deserter flew none in 2.
- **The frame budget** (scratchpad `m31/fps.mjs`): a finger circling 4 s on each view while the page times its frames; frames a second, lowest and middle half-second window:

  | View | 905 × 370 | 821 × 283 | 960 × 825 |
  | --- | --- | --- | --- |
  | Plans, main's Yard ship | 58 / 60 | 60 / 60 | 54 / 60 |
  | Plans, Kestrel's and Scrapline's | 60 / 60 | 60 / 60 | 56 to 58 / 60 |
  | Hull, main's Yard ship | 58 / 60 | 60 / 60 | 52 / 60 |
  | Hull, Kestrel's and Scrapline's | 58 / 60 | 60 / 60 | 52 to 54 / 58 to 60 |
  | Sandbox cutter, main and here | 60 / 60 and 58 / 60 | 60 / 60 | 44 / 46 and 48 / 52 |
  | Sandbox hauler, main and here | 56 / 60 and 60 / 60 | 60 / 60 | 40 / 42 both |
  | Lift-off, main and Kestrel's engines | 56 to 58 / 58 to 60 and 48 to 50 / 58 to 60 | 58 / 60 and 60 / 60 | 32 to 42 / 38 to 42 and 24 to 42 / 38 to 42 |

  At 960 × 825 the lift-off was measured six times each; its lowest windows vary from run to run on both, and the middles match.
- **M31's browser check by touch:** 28 of 28 at each of 905 × 370, 821 × 283 and 960 × 825. It covers:
  - the Parts tab: 79 parts, each with its versions beside it, each maker's icons in its line (21, 16, 21);
  - the sheet's five maker tiles, each 48 px or more and in sight, Scrapline's name in its tile; Kestrel's engines (2) and Scrapline's (3);
  - a Kestrel engine and a Scrapline engine in two taps each, saved by id; the plans drawing rose and lime; their cards;
  - outside, Kestrel's coral and Scrapline's rust;
  - the copied code carrying both, still version 4, and main's code and save opening with the Yard's parts;
  - construction mode with Kestrel's and Scrapline's parts on hand, counted by maker; a Kestrel engine bought in two taps;
  - the Enemy ships sandbox's pirate cutter and derelict hauler, drawn in their makers' lines, and the builder copy keeping them;
  - offline, the drawer's 79 icons; no console errors.

  Its screenshots showed the sheet's categories running on from the makers' row; they now start a row of their own. On the folded screen the sandbox's ship is small and Kestrel's stripes are a few pixels, so those two pixel counts only ask that the color is there.
- **Every earlier milestone's browser check** passes, run one after another, at the three sizes unless named:
  - M30 27, M29 34, M28 32, M27 32, M26 18, M25 21, M24 20, M23h 16, M23g 20, M23f 28, M23e 27, M23d 25, M23c 25, M23 36, M23b 8;
  - M22 35, M21 32, M19 52, M20 32;
  - M18 43, M17 37, M16 29, M15 30;
  - M10 20 (its three sizes in one run), and M8's fights and column;
  - at 905 × 370 only: M14's saves 10, M13 24, M14 41 (its count goes with the jobs it rolls), and M8's extras.

  Two copies were adapted, not the game, for what M31 changes on purpose:
  - M23g's (`m23g/verify31.mjs`): All shows 79 parts, the maker row has five tiles with their counts, construction mode counts Kestrel 0 and Scrapline 0, and offline the drawer draws 79 icons;
  - M23e's (`m23e/verify31.mjs`): the Weapons and Engines lists carry Kestrel's and Scrapline's versions beside each part, read from the data in the drawer's order (11 of each).

## M30 Backgrounds 2 and 3, and their pursuers (2026-10-15)

**Status:** done, and the ROADMAP.md box is ticked. It is Phase 6's first milestone. New game opens a pick of three backgrounds, each with its own start, district and pursuer:
- **The debt-bound miner**, as before: Con-Reg Recovery, in the Tailings.
- **The Navy deserter** walked off a Fleet tender with a crate of its spares.
  - Two marines and a medic, no credits.
  - Its half-built ship has a shield generator and a small reactor fitted beside the gun. An engine, crew quarters and two corridors are on hand.
  - It works the Strand, the spaceport's sailors' quarter.
  - The Fleet Provost is after it, and takes no payments.
- **The burned smuggler** dumped the Hallorans' cargo to outrun customs.
  - Two engineers and a medic, 75 credits.
  - Its ship has a light engine and a cargo hold fitted. Life support and two corridors are on hand.
  - It works the Narrows, the old town's back streets.
  - The Halloran family is after it, and takes a vig of 75 credits for 15 heat.

Each new district has 6 clients, 4 sites (one on each site map), a shop and 8 jobs. Each new pursuer has its own words in all three acts, and:
- **on jobs from heat 50:** a Provost MP (armored, aim 75), or a Halloran collector (quick and lightly armed);
- **raiders at the hangar:** the Provost's three MPs, or six Hallorans;
- **raiders at the colony:** three MPs, or five Hallorans;
- **hunters on the run:** the Provost cutter from heat 50 and the Fleet frigate from 75, in navy and white; or the Halloran runner and the armed yacht, in slate or bone with violet.

Some of this changes what was there before:
- **New game** opens the backgrounds first, the miner picked. Next goes to the captain's screen. The captain's Back now returns to the backgrounds; it went to the title.
- **The captain's screen** offers each of the start crew's jobs once (the deserter has two marines).
- **A pursuer can take no payments** (`payment` may be left out in `data/backgrounds.json`). The hangar then shows no Pay. Its hints say "The Fleet Provost takes no payments: heat only falls once a raid is faced." and, with a raid due, "Defend the ship."
- **Act 3's words** look ahead to the rest of v0.4: "Three backgrounds are here, each with its own pursuer. Still to come in v0.4: a third maker; every job, trait and talent; factions, quests and companions; pictures and sound."
- **`SAVE_VERSION` stays 23.** The campaign has kept its background since v5.
- **Tests changed on purpose:**
  - `data.test.js`:
    - the validator's counts (14 enemies, 19 encounters, 9 ship presets, 3 backgrounds, 3 districts, 26 job templates);
    - the pursuer's shape, with `payment?` and `colony`;
    - a new case, a payment that is no payment;
    - the board-size case now names the Tailings;
  - `contracts.test.js`: a board's jobs are its district's (`contractsIn`). Each district's boards offer all its jobs, clients and sites, and every job belongs to one district;
  - `harness.test.js`: the ships list has the four new presets, and the summary's fights are 4 a ship;
  - `raidText.test.js`: act 3's new words;
  - `tests/golden/ships.txt`, regenerated (below).

No phone results have come back yet for M14 to M29.

**How it was picked:** Evan answered four questions (2026-10-15), each the recommended answer:
- **Which two:** "Burned smuggler, Navy deserter".
- **Act 1:** "A district each". Each plays in a district of its own on the same rock, with its own clients, sites, shop and jobs.
- **The pursuers:** "Fighters, ships, terms". Each has its own fighters, its own two ships on the run, its own payment terms or none, and its own words. Heat's numbers are the same for all three.
- **Difficulty:** "About the same". The three are about equally hard, and the difficulty setting stays the place for harder.

Measured before settling this (`tools/run.js`, seeds 1 to 50 from the miner's start): every run reaches launch after 6 jobs at the median (3 to 13), with no raid in any run, in 45 minutes at the slow pace (21 to 93).

Done when (ROADMAP.md, M30, in full there):
- **Picking a background:** a screen before the captain's with the three, each showing its words and pursuer, its district and what its start gives; a tap picks one and Next goes on; the captain screen follows the pick (tested).
- **The Navy deserter** and **the burned smuggler**, each with its start, its district (6 clients, 4 sites, a shop and 8 jobs) and its pursuer as Evan picked.
- **Everything that reads the background reads the campaign's:** the board and the shop; the heat meter's words, the hunters on jobs, the payment or its absence, and the raid at the hangar; the launch's words and the hunters' ships; the colony's words and raiders. A background is data only (tested).
- **Saves:** `SAVE_VERSION` stays 23; a v23 save opens as the miner's (tested).
- **About as hard as the miner:** act 1 (every run launches, the slow median within 10 minutes), raids (within 10 points, at the hangar and the colony), and the run and the colony (fed, met and raids won within 5 runs of 30), reported side by side.
- **Touch:** every new button 48 px or more at the three sizes; by touch, each background picked through to its hangar, board and shop, a job with its pursuer's fighter, its raid at the hangar, its launch, and a quit and reopen that keeps it.

How each is met:
- **Picking a background:** `tests/backgrounds.test.js` (new):
  - the screen's words: a card for each background with its pursuer, and the one picked in full (After you, with its payment terms; Home; Crew; Credits; On hand; Fitted; To find), and the hint;
  - the captain's screen offers the background's jobs once and names it;
  - `campaign/new` starts from the background picked (the first if none), and refuses one not in the data or a captain whose job its crew hasn't got.

  By touch, below.
- **The deserter and the smuggler:** `tests/backgrounds.test.js`:
  - the three have different districts, pursuers, hunters, raiders and ships;
  - each campaign starts with its crew, credits, parts and ship, its district's board (its 8 or 10 jobs) and its shop.

  `node tools/validate-data.js` checks the new data.
- **Everything reads the campaign's background:** `tests/backgrounds.test.js`, for each of the three:
  - act 1: the heat meter's words at 10, 30 and 55, the hunters on jobs, the raid's party at the hangar and the launch's words;
  - the run and the colony: the meter's words, the hunters' two ships, the colony's words and its raiders;
  - the Provost: no Pay, and the hints. The Hallorans: 75 credits for 15 heat, dearer than Con-Reg's 50.

  `tests/voyage.test.js` (M30's test): from the deserter's and the smuggler's starts, every one of 30 runs launches and settles a world. So each background plays to the colony from data alone.
- **Saves:** `tests/backgrounds.test.js`:
  - each background's campaign comes back from a quit and reopen as it was, its board its district's and its pursuer its own;
  - a v23 save from before M30 opens as the miner's, with no migration.

  By touch: a save made by main opens as the miner's.
- **About as hard:**
  - **Act 1:** `tests/run.test.js` (M30's test, seeds 1 to 10): every run launches from each start, with the slow median within 10 minutes of the miner's. Over 50 seeds (below) the slow medians are 45, 41 and 39 minutes.
  - **Raids:** `tests/backgrounds.test.js` (`tools/raids.js`, 150 fights a row): each pursuer's raiders are beaten within 10 points of Con-Reg's, at the hangar and at the colony.
  - **The run and the colony:** `tests/voyage.test.js` (M30's test, 30 runs each): runs crossed fed, runs that met the hunters and runs with a raid lost are each within 5 of the miner's. `node tools/voyage.js --runs 30 --background all` puts them side by side.
- **Touch:** M30's browser check, below.

### Shipped

- **Data:**
  - `backgrounds.json`: the deserter and the smuggler. Each has its blurb, captains' names, district, start (crew, credits, parts on hand, ship) and launch words. Its pursuer has words for each act, hunters on jobs, raiders, a payment or none, the run's two ships, and the colony's raiders and words;
  - `districts.json`: the Strand and the Narrows, each with 6 clients, 4 sites and a shop (Voss's chandlery; Ferris's back room);
  - `contracts.json`: 16 jobs, 8 a district. Each district has a once-only job that pays an engine (Impounded; Left luggage), like the Tailings' repossession;
  - `enemies.json`: 7 fighters: the Provost MP, customs officer, docker, fleet rating, Halloran collector, Halloran enforcer and Pike soldier, each with a look of its own;
  - `encounters.json`: 9 parties for the jobs, the raids and the boardings;
  - `ships.json`: 4 presets, the Provost cutter, the Fleet frigate, the Halloran runner and the Halloran yacht;
  - `campaign.json`: act 3's `ahead`.
- **Validation:** `validate-campaign.js`: a pursuer's `payment` may be left out.
- **The sim:** `root.js`: `campaign/new` takes the background picked, refusing one not in the data, and checks the captain against its crew.
- **The UI:**
  - `background.js` (new): the backgrounds' screen, a card each down the left and the one picked in full beside them, with Title and Next;
  - `backgroundText.js` (new): its words, read off a new campaign from the background (what is fitted, on hand and still to find);
  - `newGame.js` (new): the pick, carried between the two screens and not saved;
  - `captain.js` and `captainText.js`: the captain for the pick, each job once, and Back to the backgrounds;
  - `title.js` and `screens.js`: New game opens the backgrounds;
  - `hubText.js`: the hints for a pursuer that takes no payments;
  - `style.css`: the backgrounds' screen.
- **Tools:**
  - `run.js --background`, and the measured odds of the new jobs (`JOB_ODDS`);
  - `voyage.js --background`, and `--background all` side by side (`voyagesByBackground`);
  - `raids.js` (new): each pursuer's raids, at the hangar and at the colony.
- **Tests:**
  - new: `tests/backgrounds.test.js` (10);
  - added to: `run.test.js` and `voyage.test.js` (M30's tests);
  - changed, above.

  777 tests in all.
- **Docs:**
  - ROADMAP.md: §2 (backgrounds), §4.2 (the other pursuers' hunters), §4.4 (their fighters, raiders and payments), §4.5, §4.6, §5 (the three as built), M30 ticked, and §9 (five new);
  - CLAUDE.md: its data and tools lists.

Decisions made along the way, not asked (each easy to change):
- **The fighters' numbers:**
  - the MP: 11 hit points, aim 75, defense 5, armor 1, a rifle;
  - the collector: 6 hit points, aim 55, defense 5, mobility 5, a pistol;
  - the enforcer: 11 hit points, aim 60, armor 1, a shotgun.

  They were tuned with `tools/raids.js` until each pursuer's raids landed within 10 points of Con-Reg's. The first MPs were beaten too often (61% at the hangar, 44% at the colony); at 12 hit points the crew of three beat them at the colony only 6% of the time. 11 lands both within 10 points.
- **The parties:**
  - the Provost raids with three MPs at the hangar and at the colony;
  - the Hallorans raid the hangar with six, and the colony with five: with six there, the careful test player lost a raid in too many runs;
  - the Provost cutter's boarders are two MPs and a fleet rating, and the yacht's are five Hallorans. Three MPs and six Hallorans stalled more boardings than the harness allows (2 in 100).
- **The ships** are Con-Reg's two builds with their own looks, makers and parties. The Provost cutter is half Bastion's and the frigate 80%. The yacht is half Bastion's: with yard parts a gun and a cannon did worse against it, which Law 1 forbids.
- **The starts:**
  - The deserter has crew quarters and an engine on hand. Crew quarters were act 1's bottleneck: before they were on hand for the deserter, with more of them in both new shops and in House call's drops, the deserter took 71 minutes at the slow pace with 6 runs of 50 never launching, and 2 of the smuggler's runs stuck.
  - The smuggler has life support on hand and 75 credits. Without the life support it took 55 minutes.
  - The Strand's shop leans to the Fleet's surplus (armories, guns, shields), with quarters and life support. The Narrows' leans to cargo holds, light engines and quarters.
- **The jobs:** each district's 8 cover the three missions. Each district has a once-only engine job, and jobs that drop the parts its start still needs. `tools/run.js` plays the new jobs at odds measured on the first boards of 250 new campaigns (85 to 106 fights a job; `JOB_ODDS`).
- **The background screen:** the miner is picked at first. The pick is kept coming back from the captain's screen, and isn't saved: a quit on either screen reopens at the title, and New game starts from the miner again.

### Known issues

- **The deserter's long tail in act 1:** its slow median is 41 minutes, but its slowest run took 131 (the miner's slowest, 93). It also loses more jobs: 61% done against the miner's 73%. Its hardest job, Dock war (a clear-out against three dockers and a heavy), is done 1 time in 5 by its start crew.
- **The smuggler meets the hunters less, and is raided more at the colony.** It meets the hunters in 5 runs of 30 against the miner's 10, at the edge of "within 5". Its colonies are found in 20 runs of 30 against 13, with 33 raids against 18, most of the difference far from the lanes (12 raids in 16 runs, against 4 in 18). It wins 21 of the 33, and loses a raid in 8 runs against the miner's 5. Why is not known. It doesn't land hotter (heat 48 at the median as it settles, against 50), and it flies about as many trips (10 against 9). (§9)
- **The Fleet frigate's boardings stall at the test's limit:** 2 in 100 when its crew boards the start ship (`tests/boarding.test.js` allows 2 a row), as Con-Reg's gunship's already did.
- **The Provost cutter's party is harder than the repo tug's:** the start crew wins 25% at home and 38% boarding her, against 44% and 44% for the tug.
- **Crew quarters decide act 1's slow runs** for all three: the longest runs wait on quarters from a drop or the shop.
- **The background screen's facts need a swipe on the folded screen** (905 × 370 and 821 × 283): they run past the panel's foot, below Fitted or Home (§9). The panel scrolls, as the hangar's do.
- **Recruits still have no background** (§9; M32's draft).
- **The Enemy ships dev sandbox** (`?dev=1`) lists 9 presets, whose buttons wrap to two rows on the cover screen, so the ship draws smaller there. It is a dev tool, and every ship still draws and reads.

### What to test on the phone (Galaxy Z Fold 6)

1. **New game:** the three backgrounds. Tap each and read its details (on the cover screen, swipe the panel for the rest). Next, then Back: is the pick kept?
2. **The captain's screen** for each: the names, the jobs (the deserter offers Marine and Medic, the smuggler Engineer and Medic) and the background's words.
3. **The deserter:** the Strand's board and Voss's chandlery, and no Pay at the hangar. Take jobs to heat 50, and an MP comes along. At 75 the raid: three MPs.
4. **The smuggler:** the Narrows' board and Ferris's back room, and Pay 75 at the hangar. Six Hallorans raid at 75.
5. **Launch** each: its own words. On the run, the hunters' ships in their colors: a Provost cutter or Fleet frigate, a Halloran runner or yacht.
6. **Quit and reopen** with each: the background, district and pursuer are kept.
7. **Tell me:**
   - whether the three feel different enough, in the starts, the districts and the pursuers;
   - whether the Provost's no payments is a good squeeze or just a wall;
   - whether the new fighters read apart from each other and from Con-Reg's in a fight;
   - whether either new start feels harder or easier than the miner's.

### Next session

M31 Manufacturers (Phase 6, v0.4). First task: settle its Done when with Evan; ROADMAP.md has a draft (a third maker, Kestrel Dynamics or Scrapline from §9, with its version of each part, its numbers and its look).

### Verified here

- `node --test`: 777 pass. `node tools/validate-data.js`: OK.
- **`tests/golden/ships.txt`, regenerated on purpose:** the four new presets added (262 lines), every other ship unchanged.
- **Act 1** (`node tools/run.js --runs 50 --background …`, seeds 1 to 50), every run reaching launch:

  | Background | Jobs | Done | Raids | Quick | Slow |
  | --- | --- | --- | --- | --- | --- |
  | Debt-bound miner | 6 (3 to 13) | 73% of 337 | 0 (0 to 0) | 28 (12 to 58) | 45 (21 to 93) |
  | Navy deserter | 5 (3 to 18) | 61% of 346 | 0 (0 to 3) | 25 (13 to 83) | 41 (22 to 131) |
  | Burned smuggler | 6 (3 to 18) | 76% of 350 | 0 (0 to 1) | 24 (13 to 76) | 39 (22 to 121) |

  The minutes are the median, then the least and most.
- **Raids** (`node tools/raids.js`, 150 fights a row): the crew's wins against each pursuer's raiders, the start crew at the hangar and the crew of three at the colony:

  | Background | At the hangar | At the colony |
  | --- | --- | --- |
  | Debt-bound miner | 28% of 4 | 17% of 4 |
  | Navy deserter | 33% of 3 | 15% of 3 |
  | Burned smuggler | 35% of 6 | 19% of 5 |
- **The run and the colony** (`node tools/voyage.js --runs 30 --background all`, the careful test player):

  | Background | Launched | Fed | Met | Raids | Won | Lost | Runs lost |
  | --- | --- | --- | --- | --- | --- | --- | --- |
  | Debt-bound miner | 30 | 25 | 10 | 18 | 12 | 6 | 5 |
  | Navy deserter | 30 | 27 | 12 | 21 | 16 | 5 | 5 |
  | Burned smuggler | 30 | 28 | 5 | 33 | 21 | 12 | 8 |
- **Boardings** (`node tools/sim.js --boardings`, 63 fights a row): the start crew's wins against each pursuer's ships' parties, at home and boarding her:

  | Ship | Party | At home | Boarding her |
  | --- | --- | --- | --- |
  | Con-Reg repo tug | two agents and a heavy | 44% | 44% |
  | Con-Reg gunship | two agents, a heavy and a guard | 6% (2 stalled) | 14% |
  | Provost cutter | two MPs and a fleet rating | 25% | 38% (1 stalled) |
  | Fleet frigate | three MPs | 19% (2 stalled) | 22% |
  | Halloran runner | two collectors and an enforcer | 49% | 56% |
  | Halloran yacht | four collectors and an enforcer | 14% | 17% |
- **Law 1** (`tests/approach.test.js`): each fighting part added to the start ship does worse against none of the 9 presets, the four new ones among them.
- **The miner's game is main's:**
  - act 1's 100 test runs are main's, seed by seed: the campaign at launch, the jobs and the log, but for the log's first line, which now names the background;
  - the careful test player's 30 voyages are main's in everything they return;
  - the fights (`node tools/sim.js` on M29's six ships; no balance number changed) are main's but for the time taken.
- **M30's browser check by touch:** 27 of 27 at each of 905 × 370, 821 × 283 and 960 × 825. It covers:
  - New game opening the backgrounds, the miner picked, its details in full;
  - a tap picking the deserter, its details (the last fact in sight after a swipe where the panel scrolls) and the hint;
  - Next to the deserter's captain (its names, Marine and Medic, its words), Back keeping the pick, and Start beginning the deserter's campaign at the Strand;
  - the deserter's hangar: the Strand's board and Voss's chandlery, no Pay, and at heat 55 the Provost's words and the hint; a job taken with an MP along;
  - the Provost's raid: Defend, and three MPs in the fight;
  - the smuggler by touch: Engineer and Medic, then the Narrows' board, Pay 75, and a quit and reopen that keeps it;
  - the Hallorans' raid of six, and the smuggler's launch words;
  - a save made by main opening as the miner's;
  - offline, the backgrounds draw; every button 48 px or more; no console errors.

  Its screenshots showed the deserter's details running past the panel's foot at 905 × 370 and 821 × 283. The panel scrolls, and the check now swipes it to the last fact.
- **Every earlier milestone's browser check** passes, run one after another, at the three sizes unless named:
  - M29 34, M28 32, M27 32, M26 18, M25 21, M24 20, M23h 16, M23g 20, M23f 28, M23e 27, M23d 25, M23c 25, M23 36, M23b 8;
  - M22 35, M21 32, M19 52, M20 32;
  - M18 43, M17 37, M16 29, M15 30;
  - M10 20 (its three sizes in one run), and M8's fights and column;
  - at 905 × 370 only: M14's saves 10, M13 24, M14 40 (its count goes with the jobs it rolls), and M8's extras.

  Seven copies were adapted, not the game, for what M30 changes on purpose:
  - M23c's, M18's, M17's, M16's, M14's and M13's tap Next on the new backgrounds screen, the miner picked (`m30/old.mjs`);
  - M10's steps back through more seeds to reach seed 1 in the Enemy ships sandbox, whose seed carries from preset to preset: 4 seeds through each of 9 presets ends at seed 37, past its 20 taps back. With 9 presets the sandbox's buttons wrap to two rows on the cover screen, so its long-press goes where the ship now sits, lower down.

## Gate 5 (2026-10-15)

**Passed.** Evan's answer after M29: "Move the fps banner and start the next phase".
- ROADMAP.md named no gate for Phase 5. The one passed was drafted at M29's close: "act 3 plays on the phone from the landing to a colony that feeds itself, flies trips and has faced a raid, and Evan wants to keep going." v0.3 is done: Phase 5.
- No phone results came with it, and none have come back for M14 to M29. The gate is Evan's call, so it stands as passed.
- Phase 6 starts with M30 (backgrounds 2 and 3, and their pursuers). ROADMAP.md held Phase 6's details until v0.3 was done. They are drafted there now, with M30's Done when in full and the rest marked as drafts.

## The frame rate's readout moved (2026-10-15)

Evan: "Move the fps banner". In dev mode (`?dev=1`) the frame rate's readout sat over the screen: under the builder's Hull button, over the chart and the colony, and in a fight beside the orders.
- **The DEV button shows the rate** under its name ("DEV", then "60 fps"), in the top right corner that every screen keeps clear for it. The button is 58 px wide, 4 px narrower than before, so it covers nothing it didn't already.
- **The full readout heads the dev menu**, under Frames: the frame times, the cap, the screen's rate and size, and on a 3D board how moving frames were drawn and what a full frame costs (`src/ui/dev/fps.js`).
- **Checked** at the three sizes, on the title, the hangar, the builder, the chart, the colony (placing a farm, and with the ship away) and a raid's fight:
  - the button reads its rate and is 48 px or more;
  - the menu's readout updates as the game runs;
  - no console errors;
  - every milestone's browser check passes.
- **What the DEV button sits over is unchanged from main.** It still covers:
  - the corner of the chart's crew card;
  - the top of the line under the colony's Placing at 821 × 283;
  - on the folded screens, the fight column's Title and Log once the column scrolls to the orders. That has been so since M8, and a swipe brings them back out from under it.
- **On the phone:** open with `?dev=1`. The rate should read on the DEV button on every screen, and the menu's Frames section should show the full readout.

## M29 Raids (2026-10-15)

**Status:** done, and the ROADMAP.md box is ticked. It is Phase 5's last milestone, so **Gate 5 is Evan's call** (ROADMAP.md, after M29: act 3 played on the phone from the landing to a colony that feeds itself, flies trips and has faced a raid). The pursuer comes for the colony:
- **Heat at the colony:** it falls a point a day. A trip adds some as it flies out: 6 near the lanes, 4 off them, 2 far from them.
- **Found:** at each day's end the pursuer may find the colony, at odds by heat and the lanes, shown on the colony screen. Found, its lander comes down 3 days later, and the colony screen counts the days.
- **The landing:** Defend, two taps. The colony's powered guns fire at the lander as it comes down (a cannon twice), each hit a raider fewer of four.
- **The fight:** whoever is home fights the rest on the colony's own grid, the buildings as cover. A powered shield gives the defenders armor, and a powered armory aim.
- **Afterwards:** heat falls to 40, won or lost. Lost, the raiders take half the food and materials and the dearest part in the hold.
- **The ship away:** a raid can land while the ship is out on a trip. The leg stops that day, whoever is home fights, and the ship flies on after.

Some of this changes what was there before, not only adds to it:
- **Heat moves in act 3** (it never did in M26 to M28): a point off each day, trips' days included, and some on for each trip.
- **The colony's needs:**
  - the Defense line says what fires at a lander and what the defenders gain ("3 shots at a lander · +1 armor"), in place of the parts' numbers "for raids to come";
  - the needs end with the raid's line: the day's odds of being found, or the lander's days;
  - the head carries the heat meter with the pursuer's words for the colony. On a narrow screen the world's line there is cut short (…) rather than wrapping the head onto two lines.
- **Next day:**
  - its first tap gives the night's odds of the colony being found;
  - its report says when it was, with the roll;
  - while a raid is coming, each day's report counts the lander's days, and the day it lands, the report ends with Defend.
- **The lander down stops Next day, Fly out and Fly on** until the raid is faced. Building, setting down and refits don't wait: the guns set down that day still fire.
- **A trip's leg can stop** (`trip.leg`), and Fly on flies the rest (`flyOn`, with its plan `onPlan`). The plans' look-aheads never stop (`passDays` `stop: false`).
- **The fight view takes an opening line from its source** (`opening`): a raid at the colony opens with the landing's report, until the first tap or 8 seconds.
- **The careful test player:**
  - when warned, it sets down the guns, shields and armories in the hold and stays home until the lander comes;
  - it faces every raid, the AI fighting for those at home;
  - its report has a raids line a run and one over the runs.
- **Act 3's words** look ahead to v0.4: "Act 3 is all here in v0.3. Still to come in v0.4: two more backgrounds, each with its own pursuer; more makers; every job, trait and talent; factions, quests and companions."
- **`SAVE_VERSION` 23.**
- **Tests changed on purpose:**
  - a day's plan gives its odds of being found (`found`), and heat falls a point a day (`days.test.js`);
  - a new, a settled and a migrated v20 colony have no raid coming (`days.test.js`, `system.test.js`), and a trip no leg (`expeditions.test.js`); the save version is 23;
  - the colony's needs end with the raid's line, and the Defense line says the shots at a lander (`colonyText.test.js`);
  - act 3's words (`tripText.test.js`);
  - M27's voyage test counts the buildings set down for raids and the materials raids took. M27's and M28's "the same days" and "the same trips" checks compare the colony and what was played, now that both also return the raids.

No phone results have come back yet for M14 to M28.

**How it was picked:** Evan answered four questions (2026-10-15), each the recommended answer:
- **When raids come:** "Daily odds, warned". Heat falls a little each day; trips add some, less far from the lanes. Each day the pursuer may find the colony at odds shown; found, the lander comes 3 days later.
- **What the defenses do:** "Fight the landing". Each powered gun and flak tower fires at the lander as it comes down at odds shown (a cannon twice); each hit is a raider fewer. Shield domes and the armory help the crew in the fight (armor, aim).
- **What a lost raid costs:** "Stores and a part". Half the food and materials, plus the dearest part in the hold. Won or lost, heat falls to 40.
- **The ship away:** "Yes, whoever's home fights". The leg pauses on the raid's day and those at home fight. With nobody home the colony loses without a fight, unless its guns stop every raider.

Measured before asking (the careful test player's colonies after M28's 60 days, seeds 1 to 30):
- heat is 50 at the median (26 to 75), as it landed;
- 24 colonies have a powered gun emplacement and 1 a flak tower. None had set down a shield dome or an armory, though several hold them as parts;
- 2 colonies lie near the lanes, 10 off them and 18 far.

A prototype raid on each colony's grid, buildings as blocks of cover (the crew played by the AI, the raiders pressing on, 150 fights a row), gave these crew win rates:

| Raiders | Whole crew | Two at home | One at home |
| --- | --- | --- | --- |
| 4: the pursuer's (agent, heavy, agent, guard) | 39% | 10% | 0% |
| 3 | 90% | 53% | 9% |
| 2 | 99% | 86% | 34% |

Done when (ROADMAP.md, M29):
- **Heat at the colony:** "in act 3 heat falls by `colonyHeatFall` at each day's end; a trip adds heat as it flies out, less the further the colony lies from the lanes (`tripHeat`, by lanes); the colony screen shows heat with the pursuer's words for act 3 (`data/backgrounds.json`) (tested)."
- **Found:** "at each day's end, while no raid is coming, the pursuer may find the colony; the odds go by heat's level and the colony's lanes (`raidOdds`, `data/balance.json`), with none below `rumorHeat`, shown on the colony screen as they will be rolled; found, the raid lands `raidWarning` days later, and the colony screen counts them down; a trip's days roll the same way, and the same seed always rolls the same (tested)."
- **The landing:** "on its day the raid is down, and Next day and Fly out wait until it is faced; two taps on Defend. First the landing: each powered gun emplacement and flak tower fires once at the lander as it comes down, a cannon emplacement twice, each at `landingHit`%, shown before the tap. Each hit is a raider fewer; then the fight with the rest (tested)."
- **The fight** on the colony's grid (`src/sim/colonyMap.js`): "open ground, each building a block of cover where it stands (fields half cover, the rest full); the crew at home starts by the landed ship's edge, and the pursuer's raiders (`data/backgrounds.json`) at the far edge, pressing on as at the hangar; a powered shield dome or shield array gives the defenders `raidShieldArmor` armor, and a powered armory `raidArmoryAim` aim (tested)."
- **Afterwards:** "won or lost, heat falls to `heatAfterRaid`; lost, the raiders take half the food, half the materials and the dearest part in the hold; downed crew come home hurt, as from any fight (tested)."
- **While the ship is away:** "a raid that lands during a leg stops it on that day. Those at home face it, and the leg flies on after; the squad doesn't fight; with nobody home, the landing's hits are all the colony has: it holds if they stop every raider, and is lost if not (tested)."
- **The colony screen:** "heat and its words, and the day's odds of being found; a raid coming, and its days; Defend in two taps, the first saying what the guns will fire and at what odds; the landing's report, the fight, and what came of it. Act 3's words say what is still to come."
- **Saves:** "`SAVE_VERSION` 23 for a raid coming and a leg stopped by one. A v22 colony opens with none coming (tested)."
- **The test player:** "over 30 voyages (campaign seeds 1 to 30) the careful test player plays its colony's 60 days with raids: M27's 30 days, then M28's 30 of trips. It stays home while a raid is coming, sets down the guns, shields and armories in the hold, and faces every raid. Its report says each run's raids found, faced, won and lost, the raiders the guns stopped, and what lost raids took (`tools/voyage.js`). The odds are tuned so that a careful colony is found more often near the lanes than far from them. The numbers are measured and reported."
- **Touch:** "every new button is 48 px or more at the three sizes. By touch: the odds and the warning; Defend's two taps, with the landing's report; a raid fought and won, and one lost with what was taken; a raid landing while the ship is away; a quit and reopen with a raid coming."

The Done when names `tripHeat` "by lanes" and `raidOdds`. As built, those are `tripHeat` with `lanesNear` and `lanesFar` (the percent near and far from the lanes), and `raidOddsRumors`, `raidOddsHunters`, `raidOddsTaskForce` and `raidOddsCornered`.

How each is met:
- **Heat at the colony:** `tests/raids.test.js` (new): a day's end takes `colonyHeatFall` off, never below 0, a trip's days too; flying out adds 6, 4 or 2 by the lanes, counted in the flags. `tests/days.test.js`: heat falls a point on Next day. `tests/raidText.test.js` (new): the meter at the colony has the run's levels, each with the pursuer's words for the colony.
- **Found:** `tests/raids.test.js`:
  - the odds at each level, near the lanes (5, 9, 15, 23), off them (3, 6, 10, 15) and far (2, 3, 5, 8);
  - none below 25, and none while a raid is coming;
  - the roll is the campaign's next, under the odds to find. Found at day 1's end, the lander comes down on day 5: in 3, 2, 1, nothing rolled meanwhile, then down;
  - the same seed gives the same day, and a trip's days roll the same way.

  `tests/raidText.test.js`:
  - the needs' line ("9% a day · near the lanes", "Lander in 3 days", "Lander down: defend");
  - Next day's ask ("6% the colony is found tonight");
  - the report when found, with the roll as rolled (by touch: "… Rolled 1, under the 23%: the lander comes down in 3 days."), and the countdown after it;
  - the hint's warning.
- **The landing:** `tests/raids.test.js`:
  - Next day and Fly out are refused while the lander is down;
  - Defend's plan: the gun and the flak tower a shot each and the cannon two, at 50%, and dark defenses don't fire;
  - over 12 seeds the shots are the campaign's rolls, each hit a raider fewer, the last of the party first;
  - every raider stopped: won where it stands, no fight.

  `tests/raidText.test.js`: Defend's first tap ("The gun emplacement and the cannon emplacement (2 shots) fire at the lander as it comes down, 50% a shot, each hit a raider fewer. 3 at home fight whoever lands of 4 (Recovery agent ×2, Hired heavy, Company guard); the shield gives +1 armor. Tap again to defend."), and the landing's report.
- **The fight:** `tests/raids.test.js`:
  - the colony's map: its grid, the farm's fields half cover, the rest machinery, the same map from the same buildings;
  - the starts: the crew in the 3 west columns, the raiders in the 3 east, all on open ground;
  - the fight is a raid on its screen, pressing on (`press`), its save readable;
  - each defender's armor and aim are their job's, their traits' and the dome's and the armory's.

  `tests/raidText.test.js`: the fight's line ("Raid · 3 raiders left · 1 stopped landing") and its opening words ("3 shots at the lander, 1 hit. 3 raiders landed: hold them off.").
- **Afterwards:** `tests/raids.test.js`:
  - won: home, heat 40, nothing taken;
  - lost: half the food (rounded down), half the materials and the dearest part in the hold (a corridor there). Nobody dies, the downed at 1;
  - an empty hold loses no part, and heat under 40 stays.

  `tests/raidText.test.js`: the end panel, won ("Raid beaten: Con-Reg will have to send another lander. That buys some quiet. Heat falls to 40.") and lost (by touch: "Raid lost: They took 13 food, 10 materials and the Corridor. Heat falls to 40."), and "Heat stays at 12" under 40.
- **While the ship is away:** `tests/raids.test.js`:
  - the lander down the day after the ship leaves for a place 3 days out: the leg stops with 2 to fly, nothing at the place yet, and no flying home or on;
  - those at home (2 and 3) fight, and the squad sits out;
  - faced, Fly on's plan (2 days, what they eat) and the squad at the place;
  - the same on the way home, the ship landing when it flies on;
  - nobody home and no guns: lost without a fight.

  `tests/raidText.test.js`: the away panel's leg ("On the way out, 2 days still to fly"), Fly on's ask, each leg's report ("… Con-Reg Recovery's lander is down at the colony: the ship waits, 2 days still to fly, while those at home face it."), and Defend with nobody home.
- **The colony screen:** `tests/raidText.test.js` and `tests/colonyText.test.js` for the words; by touch at the three sizes, below.
- **Saves:** `tests/raids.test.js`:
  - `SAVE_VERSION` 23, and the step from 22 gives a colony no raid and a trip no leg, leaving everything else as it was;
  - a v22 save through the front door opens with none coming;
  - a raid coming, a leg stopped and a raid fight each reload as they were;
  - a raid or a leg a save can't hold is caught, and so is a raid fight with no lander down.

  By touch: a save made by main (v22) opens with no raid coming and saves as v23.
- **The test player:** `tests/voyage.test.js` (M29's test). In all 30 runs:
  - every raid found is faced once it lands (one may still be coming at day 60);
  - its wins and losses are the flags', and a raid of 4 is won only with every raider stopped or beaten;
  - a lost raid takes and a won one doesn't, and nobody dies;
  - heat stays within its bounds, and the report has its raids line.

  Over the runs some colony is raided, and colonies near the lanes are found more often a run than those far from them.
- **Touch:** M29's browser check, below.

### Shipped

- **Data:**
  - `balance.json`: `colonyHeatFall` 1, `tripHeat` 4, `lanesNear` 150, `lanesFar` 50, `raidOddsRumors` 3, `raidOddsHunters` 6, `raidOddsTaskForce` 10, `raidOddsCornered` 15, `raidWarning` 3, `landingHit` 50, `raidShieldArmor` 1, `raidArmoryAim` 10;
  - `backgrounds.json`: the pursuer at the colony (`colony`): its words for each level of heat, its raiders (the hangar raid's four), and its words when it finds the colony, as the lander comes down and when a raid is beaten;
  - `colony.json`: the defenses' shots (gun emplacement 1, cannon emplacement 2, flak tower 1);
  - `campaign.json`: act 3's `ahead`.
- **Validation:**
  - `validate-data.js`: the new numbers' ranges, the odds rising with heat, and the odds near the lanes at most 100;
  - `validate-campaign.js`: the pursuer's colony words and raiders (`checkPursuerColony`);
  - `validate-colony.js`: a building's `shots` (1 to 4).
- **The sim:**
  - `raids.js` (new): heat and the lanes (`lanesPercent`, `tripHeatOf`), the odds and the day's roll (`foundOdds`, `raidDayEnd`), the lander (`raidDown`, `raidIn`), the defenses (`defensesOf`, `defendersOf`), Defend (`landingPlan`, `faceRaid`), and the end (`raidTake`, `settleRaid`, `endColonyRaid`);
  - `colonyMap.js` (new): the colony as a battle map, and the raid's starts;
  - `days.js` (the day's odds and roll, the lander down stopping Next day), `expeditions.js` (trip heat, legs that stop, `onPlan` and `flyOn`), `tripShape.js` (the leg), `campaign.js` (the raid checked), `colony.js`, `root.js` (`campaign/raid/face`, `campaign/trip/on`, a colony raid's end) and `save.js` (v23 and the migration from 22).
- **The colony screen:**
  - `raidText.js` (new): the raid's line, the Defense line, the hint, Defend's ask, the landing's report, the fight's line, opening words and end;
  - `colony.js`: the heat meter, and Defend in Next day's place;
  - `colonyText.js`: the needs, the day's odds and report;
  - `colonyTrip.js` and `tripText.js`: a stopped leg and Fly on;
  - `hubText.js`: the colony's heat words;
  - `style.css`: Defend, and the head in one line.
- **The fight:** `campaign/fight.js` (the colony raid's line, opening words and end panel) and `fight/view.js` (`opening`).
- **Tools:**
  - `voyage.js`: raids in the colony's days and trips, a raids line a run and over the runs;
  - `voyagePlan.js` `raidPrep`: the hold's defenses set down when warned;
  - `boarding.js` `fightRaid`.
- **Tests:**
  - new: `tests/raids.test.js` (7), `tests/raidText.test.js` (5);
  - added to: M29's voyage test.

  765 tests in all.
- **Docs:**
  - ROADMAP.md: §2 (the colony's defenses, and raids), §4.4 (act 3 as built), §4.8 (v23), M29 ticked, Gate 5 drafted, and §9 (two ideas narrowed, six new);
  - CLAUDE.md: raids in its lists.

Decisions made along the way, not asked (each easy to change):
- **The numbers:**
  - heat falls 1 a day, and a trip adds 4 off the lanes;
  - near the lanes is 150% of off and far is 50%, for both a trip's heat and the odds;
  - the odds are 3, 6, 10 and 15% a day off the lanes at the four levels;
  - each shot is 50%, a shield gives 1 armor and an armory 10 aim, neither stacking with a second.

  They were sized against the measurements above so that a careful colony is found now and then and more often near the lanes. With heat falling a point a day, raids thin out as the colony keeps quiet.
- **The raiders** are the hangar raid's four (`raid`: agent, heavy, agent, guard), and a hit at the landing takes the last of the party first (the guard, then an agent).
- **The day is rolled at its end, at its heat, before heat falls.** No roll while a raid is coming, so one raid at a time.
- **On the landing day only Next day and the trips wait.** Building, setting down and refits go on, so the guns set down that morning fire.
- **The fight's map:**
  - a tile a cell, open ground;
  - a farm's fields are half cover, and every other building full cover (machinery), the landed ship's pad off the grid;
  - the crew starts in the 3 west columns and the raiders in the 3 east, middle rows first.
- **A lost raid takes the dearest part by its price,** then by name, never a building or a part off the ship. Heat after a raid is 40, or stays where it is if lower ("Heat stays at 31").
- **The landing's report** opens the fight in place of the first hint until the first tap or 8 seconds. The fight's line counts the raiders stopped landing for the rest of the fight.
- **The Defense line** is shown once the colony has a defense, and with a raid coming even with none ("None: nothing fires at a lander", in red).
- **Fly on** is two taps, the first saying the days still to fly and what they eat, as Fly home's. Defend stays in the foot while the ship is away, in Next day's place.
- **The test player:** when warned, it sets down the hold's parts with shots, most shots first, then a shield or an armory while none is powered, only where the building would stand powered. It stays home while a raid is coming, playing days until the lander comes.

### Known issues

- **Raids thin out as heat falls:** heat ends the 60 days at 14 at the median (0 to 40), and from under 25 only trips raise it: 6 a trip near the lanes, 2 far from them. So a careful colony far from the lanes is rarely found after its first weeks (4 raids in 18 such runs). §9 has a raid that grows with heat, shedding heat and danger.
- **The careful test player never met a raid while the ship was away:** it stays home when warned, so the leg that stops and the fight with whoever is home are tested and checked by touch, not measured over voyages. (§9)
- **Danger, the world's fourth number, still does nothing.** (§9)
- **A building's row says its part's numbers** ("Guns 15", "Shield 10"), not what it does in a raid. The Defense line and Defend's first tap say that. (§9)
- **The colony's fight has small tiles:** its grid is 20 × 12, so on the cover screen a tile opens at about 29 px. Two taps keep it safe, and a pinch zooms. (§9)
- **The guns do nothing once the raiders are down,** and the landing has no scene, only words. (§9)
- **The pursuer's four are hard on a small crew:** in the prototype the whole crew of three beats them 39% of the time, two at home 10%. The guns stopping one or two makes a large difference (90% and 99% against 3 and 2). The careful test player won 12 of its 18, its guns stopping 8 of 72 raiders.

### What to test on the phone (Galaxy Z Fold 6)

The quickest way there: play days at a colony with heat 25 or more, or ask me for a save code with a raid coming.
1. **Heat and the odds:** at the colony, the heat meter in the head and the needs' last line ("Found: 9% a day · near the lanes"). Next day's first tap gives tonight's odds. Do they read clearly?
2. **Found:** the day's report says so, with the roll, and the Raid line counts down the lander's days. Set down any guns, shields and armories in the hold, and watch the Defense line.
3. **The landing day:** Defend in Next day's place. Its first tap says what fires and at what odds; the second fires and opens the fight with the landing's report.
4. **The fight on the colony's grid:** the buildings as cover, your crew by the landed ship. Are the tiles big enough on the cover screen, or do you pinch?
5. **Won or lost:** the end panel, and Continue home with heat down, or the stores halved and a part gone.
6. **A raid while away:** fly out with a raid coming that lands on the way. The leg stops, Defend with whoever is home, then Fly on.
7. **Quit and reopen** with a raid coming, and again in the raid's fight.
8. **Tell me:**
   - whether the odds feel right: found in 13 runs of 30, 3.5 raids a run near the lanes and 1 in 5 runs far from them;
   - whether 3 days' warning is enough;
   - whether the raid is too hard or too soft (the careful test player won 12 of 18);
   - whether raids should thin out as heat falls;
   - and whether **Gate 5** passes (below), with the M14 to M28 questions still open.

### Next session

**Gate 5 is Evan's call.** Phase 5 (act 3, v0.3) is done once it passes: act 3 played on the phone from the landing to a colony that feeds itself, flies trips and has faced a raid, and Evan wants to keep going. If it passes, record it here and start M30 Backgrounds 2 and 3, and their pursuers (Phase 6, v0.4): first task, settle its Done when with Evan. If it doesn't, the first task is what the gate found.

### Verified here

- `node --test`: 765 pass. `node tools/validate-data.js`: OK. No golden file changed.
- **The test player, 30 voyages** (`node tools/voyage.js --runs 30`, managing heat): the colony's lines are M28's, and the raids' summary line is new:
  ```
  Raids over the colony's 60 days: found 0 (0 to 5) a run, in 13 of 30 (by the lanes: near 7 in 2 runs, off 9 in 10 runs, far 4 in 18 runs); faced 18: won 12, lost 6; the guns stopped 8 of 72 raiders; 0 while the ship was away (0 with nobody home); lost raids took 51 food, 24 materials and 4 parts; heat at the end 14 (0 to 40); set down Armory 3, Flak tower 1, Shield dome 1.
  ```
  - Found 20 times and faced 18: two runs end their 60 days with a raid still coming.
  - A raid a run near the lanes: 3.5; off them 0.9; far 0.2.
  - A run near the lanes (seed 15): "Raids over 60 days (near the lanes; heat 49 to 31): found 5, faced 4. Day 10: the guns stopped 0 of 4, 3 at home, lost: they took 5 materials and an Armory. Day 26: the guns stopped 1 of 4, 3 at home, won. Day 38: the guns stopped 1 of 4, 3 at home, won. Day 49: the guns stopped 0 of 4, 3 at home, won. Set down Armory (day 7). A raid still coming at the end."
- **M29's browser check by touch:** 34 of 34 at each of 905 × 370, 821 × 283 and 960 × 825. It covers:
  - heat in the head with the pursuer's words, and the odds in the needs and in Next day's first tap;
  - found by touch (the report with its roll), the countdown in the needs and the report, and a quit and reopen with the raid coming;
  - the landing day: Defend in Next day's place, its hint, and Fly out off;
  - Defend's two taps: the first saying what fires and who fights, the second opening the fight on the colony's grid with the landing's report and the raiders stopped;
  - a raid won (played out by the AI) and Continue home at heat 40, and one lost with what was taken and the stores after;
  - a raid landing while the ship is away: the leg stopped and reported, Defend with the two at home, the fight, then Fly on in two taps to the place;
  - nobody home: lost without a fight, and what was taken;
  - a save made by main (v22) opening with no raid coming and saving as v23;
  - offline, the colony draws; every button 48 px or more in each mode; no console errors.

  The check found two things, fixed before it passed:
  - the day the lander came down, the day's report took the hint's place and didn't say so. It now ends with Defend;
  - with the heat meter, the colony's head wrapped onto two lines on the two smaller screens while the ship was away. The world's line is now cut short instead.
- **Act 1:** 100 test runs identical to main's, seed by seed, the campaign at launch and the log. **Act 2:** all 30 voyages' steps are main's, settling included, and so are the campaign as it landed and as it founded the colony, but for the colony's raid (none coming).
- **The colony's days without raids:** every colony is founded at heat 25 or more (as it landed), so its days roll the odds from the first. From the same 30 founded colonies at heat 0, nothing to roll:
  - M27's 30 days are main's in all 30, but for heat and the raids' flags;
  - M28's 30 days of trips are main's in 28. The other two (seeds 10 and 15) lie near the lanes, where 9 trips added 54 heat: from 25 the odds were rolled (nothing found), and the rolls moved the RNG.
- **The fights** (`node tools/sim.js`; no balance number changed): identical to main's but for the time taken.
- **Every earlier milestone's browser check** passes, run one after another, at the three sizes unless named:
  - M28 32, M27 32, M26 18, M25 21, M24 20, M23h 16, M23g 20, M23f 28, M23e 27, M23d 25, M23c 25, M23 36, M23b 8;
  - M22 35, M21 32, M19 52, M20 32;
  - M18 43, M17 37, M16 29, M15 30;
  - M10 40 (its three sizes in one run), and M8's fights and column;
  - at 905 × 370 only: M14's saves 10, M13 24, M14 41 (its count goes with the jobs it rolls), and M8's extras.

  Three copies were adapted, not the game, for what M29 changes on purpose:
  - M28's: its v21 save comes back as v23;
  - M27's reads food and materials as the needs' 5th and 6th rows, the needs now ending with the raid's line, and its save comes back as v23;
  - M26's Defense line says "1 shot at a lander", and its needs end with the raid's line.

  The copies that make saves the way main did open them from checkouts of the M28 merge (v22, for M29's), the M27 merge (v21, M28's), the M26 merge (v20, M27's), the M25 merge (v19, M26's), the M24 merge (v18, M25's), and the M23h and M23g merges (v17), as before.

## M28 Expeditions from the colony (2026-10-15)

**Status:** done, and the ROADMAP.md box is ticked. The ship flies again:
- **Places within reach:** the colony lists three at a time: derelicts, wreck fields, ore rocks and the system's other worlds, each 1 to 3 days away. Squatters hold half the derelicts.
- **A trip:** pick a place and a squad. The flight checks count the squad aboard, and Fly out takes two taps. The days out pass at the colony with the ship away. At the place the squad decides an event, or boards the squatters' derelict in a fight. Fly home passes the days back, and a new list comes.
- **The colony on its own:** while the ship is away the colony runs without the ship's power, and whoever stays home without a bed and air doesn't rest. Materials now buy a **solar array** (power) and a **shelter** (beds and air for two) for them.
- **Healing day by day:** an infirmary heals only a day at a time. One opening heals nobody.

Some of this changes what was there before, not only adds to it:
- **An infirmary opening no longer heals the crew to full** (Evan's pick). M26's heal on opening (`healIfOpened`) is gone, and so are its words in the reports for giving a part, building and setting one down. A powered infirmary heals a day at a time, as since M27.
- **In act 3 the flight checks count whoever is aboard** (`campaign.js` `crewAboard`): nobody while the ship is home, the squad on a trip.
  - Giving a part still counts nobody aboard, so a colony can give away the life support a trip needs. The trip's plan says so, and a refit puts it back.
  - **Construction mode at the colony counts a full squad aboard** (`fullSquad`: `squadSize`, or the whole crew if fewer), so its flight checks show what a trip needs. In M27 it counted nobody. Its ready line: "Every flight check passes with a full squad aboard: the ship can fly out. Tap Colony."
- **The day's plan works per person** (`days.js`): each crew member's heal (`heals`, by id) in place of one heal for all, and who goes without rest (`rough`). A trip's days pass the same way, one by one.
- **While the ship is away, nothing changes at home but the days.**
  - Next day is off, since a leg's days pass as it flies.
  - Building, moving, taking down, giving and refits are refused: "The ship is away: building waits until it is home."
- **Events can give materials** (`events.js`). At a place an event's wounds fall only on the squad (`applyEffects` `among`). The run's events are as they were.
- **A colony build can give instead of make** (`data/colony.json` `gives`: power, beds and air, in place of `makes`), and the validator checks either.
- **The colony screen:**
  - the places head the right-hand panel;
  - while the ship is away, the panel is where the squad is, and Refit and Next day are off;
  - the crew rows say who is away and who has no bed or air;
  - the ship's pad stands empty in the view.
- **Act 3's words** say only the raids are still to come.
- **`SAVE_VERSION` 22.**
- **The careful test player flies 30 days of trips** after M27's 30 days (`playTrips`).
  - Each run's report has a line for them, and the summary has one over the runs.
  - `voyage()` returns the colony after them as `travelled`; `home` is still the colony after M27's days.
  - The summary's colony line no longer counts the infirmary's heal on opening (0 in all of M27's runs).
- **Tests changed on purpose:**
  - the infirmary: one opening heals nobody, and its first day heals a day's rest and its own heal, the medic adding theirs (`colony.test.js`). Giving and building say nothing of healing (`colonyBuild.test.js`, `colonyText.test.js`);
  - the build list has the solar array and the shelter (`colonyBuild.test.js`, `colonyText.test.js`);
  - the day's plan gives each one's heal and who goes without rest (`days.test.js`);
  - a new colony, a settled one and a migrated v20 one have no places and no trip (`days.test.js`, `system.test.js`);
  - the run's events are the 10 of a kind of node; the places have the other 8 (`sector.test.js`, `voyage.test.js`);
  - the validator's summary line (`data.test.js`).

No phone results have come back yet for M14 to M27.

**How it was picked:** Evan answered four questions (2026-10-15), each the recommended answer:
- **Where trips go:** "Places within reach": a few places at a time, rolled from the seed, each a few days away. Derelicts (some held by scavengers, boarded in a fight), wreck fields, rocks and the system's other worlds, with events like act 2's.
- **What the ship needs to fly a squad:** "Berths and air": the flight checks count the squad aboard, so a trip needs berths and life support for each. The colony runs on its own power while the ship is away.
- **What materials buy:** "Generator and shelter": a power plant, and a home for whoever stays behind.
- **Healing:** "Day by day": a crew home hurt heals at the infirmary over the days, and the heal to full on opening goes.

The snag, measured before asking (the careful test player's colonies after their first 30 days, seeds 1 to 30): no ship could fly a squad of 3, since all 30 had given the colony their life support. All 30 could once the colony's life support and quarters went back aboard. 29 colonies ran on the landed ship's spare power, with no power plant of their own.

Done when (ROADMAP.md, M28):
- **Places within reach** (`data/expeditions.json`): "the colony lists three places at a time, rolled from the campaign's RNG: derelicts, wreck fields, ore-rich rocks and the system's other worlds, each with its name, its kind and how many days away it is (1 to 3). Some derelicts are held by scavengers, and the list says so. A new list comes after each trip. The same seed always gives the same places (tested)."
- **A trip:** "a place and a squad of 1 to `squadSize` picked from the crew. The plan says the days there and back, what the days eat, and the flight checks with the squad aboard (berths and air for each of them). Two taps on Fly out, refused with the reason while a flight check fails. The days out pass at the colony one by one, then the squad is at the place: an event like act 2's (choices with their odds, paying parts, materials or food, or hurting someone in the squad) or the scavengers. Fly home passes the days back, and the ship lands. Each leg's report says what the days at home came to (tested)."
- **Boarding a derelict:** "at a derelict the scavengers hold, Board her starts a fight on her map (a derelict hauler, some rooms wrecked), the squad at her hatches. A win brings her salvage home (her working parts, and materials); a loss brings the squad home hurt with nothing. Fly home leaves her without a fight (tested)."
- **While the ship is away:** "the days pass as Next day passes them, but the colony runs on its own power: the buildings the ship's spare power ran go dark. Whoever stays home without a bed and air doesn't rest, since the ship isn't there to sleep aboard. The squad aboard heals what the ship's med bay heals, as on a jump. Food and materials stay one store, the ship's holds counted (tested)."
- **A generator and a shelter** (`data/colony.json` builds): "built by hand from materials, as farms and mines are. The generator (a solar array) makes power; the shelter beds and breathes for two, and needs power (tested)."
- **Healing day by day:** "an infirmary heals the crew a day at a time, as since M27, and one opening no longer heals everyone to full. A squad home hurt heals over the days (tested)."
- **Refit:** "construction mode at the colony counts a full squad aboard (up to `squadSize`), so its flight checks show what a trip needs."
- **The colony screen:** "the places within reach, each with its kind, its days and what is known of it; a trip's plan with the squad picked and the flight checks; Fly out and Fly home, each in two taps; while the ship is away, the colony without it, where the squad is, the place's event or its scavengers, and each leg's report. Act 3's words say what is still to come."
- **Saves:** "`SAVE_VERSION` 22 for the places and the trip. A v21 colony opens with no trip, and its places are rolled when the colony is first shown (tested)."
- **The test player:** "over 30 voyages (campaign seeds 1 to 30) the careful test player plays 60 days at the colony. It builds as in M27, puts berths and air for its squad back aboard, and flies trips, building a generator and shelters when someone stays home. In every run it flies at least one trip and the ship comes home from every one. Its report says each run's trips, days away, what they brought, the boardings won and lost, and the hungry days (`tools/voyage.js`)."
- **Touch:** "every new button is 48 px or more at the three sizes. By touch: a place and a squad picked; Fly out refused for a failing flight check, and a refit that puts life support aboard; Fly out; an event decided at a place; a boarding fought; Fly home and its report; a generator and a shelter built; and a quit and reopen while the ship is away."

How each is met:
- **Places within reach:** `tests/expeditions.test.js` (new):
  - a settled colony has none until they are rolled, and then has three, of their kinds and days, none named twice. A world is named for one of the system's other worlds, and a held derelict has no event;
  - the same seed gives the same places, and a colony with places keeps them;
  - over 300 seeds every kind comes up, squatters hold some derelicts but not all, and every place's event is met.

  `tests/tripText.test.js` (new): the rows' words ("Ore rock · 2 days away", "Derelict · 1 day away · squatters aboard", a world by its own kind: "Ice world · 3 days away").
- **A trip:** `tests/expeditions.test.js`:
  - the plan: 2 days there and 2 back, 12 food for three (27 → 15), every flight check passing;
  - the refusals: a place not listed, nobody picked, someone not of the crew, the ship away already, and the life support given to the colony: "The ship can't fly with 3 aboard: life support 0 of 3 crew.";
  - flying out uses up the list, and the days out pass at home, the colony on its own power;
  - at the place, the event decided (a sure choice rolls nothing), its wound only ever on the squad, and a find past the stores lost;
  - home: the days back, the ship landed and a new list. Fly home refuses until the event is decided.

  `tests/tripText.test.js`: the plan's lines, Fly out's ask and why not, the squad picker's rows, the event's choices with their odds, Fly home's ask, and each leg's report ("2 days out: everyone ate 6. With no bed and air at the colony, Quill Petrov and Lark Ibarra didn't rest. The squad is at The Anvil."). The reducer test in `tests/expeditions.test.js` takes a trip out, through a choice and home.
- **Boarding a derelict:** `tests/expeditions.test.js`:
  - a held derelict is a generated hauler (her own seed), with the squatters' party, 2 parts and 4 to 8 materials to win. Left alone, the ship flies home with nothing;
  - boarded, the squad is at her hatches and the squatters on her bridge. The same place gives the same fight;
  - won: her 2 parts into the hold and her materials into the stores;
  - lost: home with nothing;
  - played out by the AI it ends one way or the other, everyone alive;
  - the reducer gives the fight its screen and brings it back to the colony.

  `tests/tripText.test.js`: who holds her and what a win brings, Board her's ask, the fight's objective ("Aboard Long Haul", "3 squatters left") and its end ("Long Haul is yours", "Beaten back").
- **While the ship is away:** `tests/expeditions.test.js`:
  - a gun given to the colony goes dark;
  - the two at home with no bed and air don't rest (the same day at home, all three would have);
  - Next day, building, taking down and refits are refused;
  - the squad aboard heals the ship's med bay's heal, a medic aboard adding theirs, and an infirmary given from that med bay heals nobody at home while the ship's power is away.

  `tests/tripText.test.js`: the colony's words while away ("Copperhill · Desert world · Day 3 · the ship away", "1 on the trip, 2 home without a bed", "0 from power plants; the ship is away").
- **A generator and a shelter:** `tests/expeditions.test.js`: built for 15 and 10 materials, the array gives 3 power and the shelter takes 1, beds 2 and air 2. With the ship away, the array runs the gun and the shelter, and the two at home rest. `tests/colonyBuild.test.js` and `tests/colonyText.test.js`: their rows in the build list ("Solar array — 15 materials · Power +3", "Shelter — 10 materials · Beds 2 · air 2 · power −1"). `tests/colonyScene.test.js`: the array's panels and the hut, the hut's window dark without power, and the ship's pad empty while it's away. `tests/data.test.js`: the validator's line ("4 colony builds").
- **Healing day by day:** `tests/colony.test.js`: an infirmary opening heals nobody; its first day heals a day's rest and its own heal, the medic adding theirs. `tests/expeditions.test.js`: the squad heals day by day aboard, and those at home rest in the shelter.
- **Refit:** `tests/expeditions.test.js`: `fullSquad` is 3, or 2 for a crew of two. By touch: the air plant taken down, its life support fitted aboard in construction mode with its checks counting 3, and Colony home.
- **The colony screen:** `tests/tripText.test.js` and `tests/colonyText.test.js` for the words; by touch at the three sizes, below.
- **Saves:** `tests/expeditions.test.js`:
  - the step from 21 gives a colony no places and no trip, and no campaign is left alone;
  - a v21 save through the front door opens with neither, and the colony screen's ask rolls the seed's places;
  - a campaign out on a trip, at a held derelict and in the fight there each reloads as it was;
  - a trip or places a save can't hold is caught.

  By touch: a save made by main (v21) opens with its places rolled and saves as v22.
- **The test player:** `tests/voyage.test.js` (M28's test). In all 30 runs it:
  - plays 30 days of trips after M27's 30, flies at least one, and the ship comes home from every one, every day played;
  - has room aboard for every squad it took (1 to 3), and loses nobody;
  - plays the same trips from the same colony.

  Some trips board a held derelict, and each run's report has its line.
- **Touch:** M28's browser check, below.

### Shipped

- **Data:**
  - `expeditions.json` (new): 3 places at a time, and the 4 kinds: Derelict (weight 3, 1 to 2 days, half held), Wreck field and Ore rock (2, 1 to 3 days), and World (2, 2 to 3 days, the system's others). Each has its words, and all but the worlds have names of their own;
  - `events.json`: 8 events at places, 2 a kind, and the `colony` drop table their parts come from;
  - `encounters.json`: the Squatters (two scavvers and a hired heavy);
  - `colony.json`: the Solar array and the Shelter;
  - `campaign.json`: act 3's `ahead`.
- **Validation:**
  - `tools/validate-expeditions.js` (new): the list's size and words; each kind's id (no sector node's), name, weight, days and words, and its names or the system's worlds (one such kind at most); a held derelict's chance, ship, party, salvage and materials;
  - `validate-campaign.js` wires it in, and asks every kind not always held for events;
  - `validate-colony.js`: a build's `gives`;
  - `validate-events.js`: an event at a place does and needs only what a place can (food, materials, wounds and parts; no credits or heat), and only such an event brings materials;
  - `validate-data.js`: counts the places.
- **The sim:**
  - `expeditions.js` (new): the places (`rollPlaces`, `withPlaces`), the plan and flying out (`tripPlan`, `flyOut`), the place (`tripHere`, `chooseAtPlace`), the boarding (`placeFightDue`, `boardPlace`, `endPlaceFight`), and home (`homePlan`, `flyHome`);
  - `tripShape.js` (new): what a save's places and trip may hold;
  - `days.js`: the days with the ship away (`planDay`, `passDay`), each crew member healing where they are;
  - `colony.js`: the colony on its own power, who is away and who goes without (`colonyStats` `away`, `rough`), the builds that give, and the heal on opening gone;
  - `colonyBuild.js`: nothing built, moved or taken down while away;
  - `campaign.js`: the flight checks with the squad aboard (`crewAboard`, `fullSquad`), no refits while away, and the trip checked;
  - `events.js` (materials, and wounds among the squad), `defs.js`, `root.js` (`campaign/places`, `campaign/trip/out`, `campaign/trip/choose`, `campaign/trip/board`, `campaign/trip/home`; a fight at a place ends back at the colony), `save.js` (v22 and the migration from 21).
- **The colony screen:**
  - `colonyTrip.js` (new): the places, the plan, the squad picker, the panel while away, and the two-tap buttons;
  - `tripText.js` (new): their words;
  - `colony.js`, `colonyText.js` (away), `construction.js` (a full squad), `boardingText.js` (a place's fight), `eventText.js` (food and materials), `style.css`.
- **The scene:**
  - `colonyBuilds.js`: the solar array (panels leaning at the star, the inverter's light) and the shelter (a half-round hut, its door and lit window);
  - `colonyScene.js`: the ship's pad empty while it's away;
  - `palette.js` `buildColors`.
- **Tools:**
  - `voyage.js` plays 30 days of trips (`playTrips`, `TRIP_DAYS`), with a report line a run and a summary line;
  - `voyagePlan.js`: the squad, the refit for it, the home builds, the place and the choice there (`tripSquad`, `refitForSquad`, `homeBuild`, `nextPlace`, `placeChoice`);
  - `boarding.js` `fightPlace`.
- **Tests:**
  - new: `tests/expeditions.test.js` (9), `tests/tripText.test.js` (4);
  - added to: `tests/colonyScene.test.js` (1 more), M28's voyage test.

  752 tests in all.
- **Docs:** ROADMAP.md: §2 (the colony), §4.8 (v22), M28 ticked, and §9 (two of M27's ideas taken in, one narrowed; four new). CLAUDE.md: the places in its lists.

Decisions made along the way, not asked (each easy to change):
- **The places:**
  - three at a time, rolled when the colony has none (on its first showing, and after each trip home);
  - a derelict comes up 3 times in 9, the other kinds 2 each;
  - a world is one of the system's two others, and no name comes twice in a list.
- **A place's event is rolled with the list,** so it stays the same once listed, and a reload doesn't reroll it. The list shows its kind, not the event.
- **The squatters:** two scavvers and a hired heavy. Measured (200 fights each, the scripted squad of three at full health, `m28/parties2.mjs`):

  | Party | Squad wins | Squad hit points after (of 26) |
  | --- | --- | --- |
  | The run's scavengers (three scavvers and a heavy) | 33% | 5.2 |
  | Three scavvers | 100% | 18.1 |
  | Two scavvers and a heavy (taken) | 77% | 10.9 |
  | Three pirates | 99% | 16.3 |
- **A held derelict's prize:** 2 parts by a roll among her working ones, never a corridor, as on the run, and 4 to 8 materials, as far as the stores take them.
- **A place's events** give food, materials and parts (from the `colony` drop table, weighted to life support and bunks), and wound only the squad. Credits buy nothing at the colony, and heat waits for M29.
- **The days of a leg pass as Next day's would,** one by one, and the leg's report sums them. The squad eats from the one store, so a trip's food is the colony's.
- **The squad heals aboard what the ship's med bay heals** (and a medic aboard theirs), not a day's rest: the same as a jump.
- **Nothing is built, moved, given or taken down while the ship is away,** and there is no refit. The legs pass in one go, so the only time to build would be while the squad waits at the place.
- **The plan panel** puts Fly out, Refit and Back above the squad list, so Fly out stays in view on the cover screen.
- **The test player:**
  - takes the healthiest crew healed to three quarters of their most (`FIT_SHARE`), up to 3;
  - before flying, takes down the buildings that give the berths or air its squad lacks aboard and fits their parts back;
  - builds a shelter for whoever stays home, and a solar array to run it, as far as the materials go;
  - flies to a held derelict only with a full squad at full health, and otherwise to the nearest place its food covers;
  - at an event, picks the choice worth most: materials and food a point each as far as the stores take them, a part 8, a hit point lost −2.

### Known issues

- **Nothing calls the ship home yet.** The test player is away 28 of its 30 days, since the colony runs without the ship once a solar array and a shelter stand. M29's raids could make an empty colony a risk. (§9)
- **The derelict's prize can be a part the colony can't use:** a bridge, an engine or an airlock stays aboard and can't be set down. It can only be fitted to the ship. §9 has had picking what to strip since M22.
- **Trips bring little food:** 0 at the median, since the farms keep the food store full. Materials come from trips now (32 at the median), more than from the mines (0 mines at the median).
- **Eight events for the places,** two a kind, so a colony's 9 trips meet them again within 30 days. (§9)
- **Giving a part doesn't warn that a trip will need it:** the colony can take the ship's life support, and the trip's plan is the first to say so. (§9)
- **No lift-off or landing for a trip:** the ship's pad empties and fills again. (§9)
- **Trips add no heat** (M29).

### What to test on the phone (Galaxy Z Fold 6)

The quickest way there: settle a world in a run, or ask me for a save code at a colony.
1. **A trip's plan:** tap a place in the right-hand panel. Tap a crew member to leave them home. Is the plan clear: the days, the food, and the flight checks?
2. **A refused Fly out:** if your colony has the ship's life support, Fly out says why. Take the air plant down (two taps), then Refit, fit the life support aboard, and Colony. Is the way there clear?
3. **Fly out:** two taps. Read the report. Does the colony read right with the ship away: the pad empty, who is away, Refit and Next day off?
4. **At the place:** an event's choice in two taps, the first with its odds. Or a derelict the squatters hold: Board her, and the fight.
5. **Fly home** and its report, and the new list.
6. **A solar array and a shelter:** build both, then fly out with someone home. Do they rest?
7. **Quit and reopen** while the ship is away, and again in the fight at a derelict.
8. **Tell me:**
   - whether trips feel cheap: the test player is away 28 days in 30 (§9);
   - whether the squatters are too hard or too soft;
   - whether building should wait for the ship;
   - and the M14 to M27 questions still open.

### Next session

M29 Raids. First task: settle its Done when with Evan. ROADMAP.md has a draft: heat in act 3 falls slowly, and the pursuer raids the colony by heat and how far it lies from the lanes; guns, shields and armories defend; a raid is fought on the colony's grid. Ask too whether trips should add heat, and whether a raid can come while the ship is away (the test player is away 28 days in 30).

### Verified here

- `node --test`: 752 pass. `node tools/validate-data.js`: OK ("15 colony buildings, 4 colony builds, 4 kinds of place, 18 events"). No golden file changed.
- **The test player, 30 voyages** (`node tools/voyage.js --runs 30`, managing heat), the summary's colony lines:
  ```
  The colony: founded in 30 of 30, 2 (1 to 5) parts given: Air plant 30, Gun emplacement 27, Barracks 13, Infirmary 2, Storehouse 2, Bunkhouse, Flak tower, Generator, Warehouse. Everyone housed in 13 of 30, 3 (0 to 3) sleeping aboard; every building powered in 30, power to spare 1 (0 to 3); the ship flies with nobody aboard in 30.
  The colony's first 30 days: its farms feed the crew within 15 days of the landing in 30 of 30, from day 1 (1 to 9); farms 1 (1 to 3), mines 0 (0 to 2); hungry days 0 (0 to 8), in 4 runs; at the end, food 30 (0 to 58) and materials 10 (0 to 70), stores 30 (30 to 90).
  The colony's 30 days of trips: trips 9 (7 to 12), flown in 30 of 30; days away 28 (26 to 30); brought parts 3 (1 to 7), materials 32 (0 to 61), food 0 (0 to 59); boardings won 21, lost 11; built Solar array 23, Shelter 23; refitted aboard in 30; hungry days 0 (0 to 0).
  ```
  - The first two lines are M27's, but for the infirmary's count.
  - Over the runs:
    - the places flown to were 105 derelicts, 71 rocks, 66 wreck fields and 36 worlds;
    - a squad of fewer than 3 flew in 26 runs;
    - life support went back aboard in all 30 and quarters in 13.
  - A rock world's line (seed 4): "30 days of trips: 12 trips, 28 days away: Old Red (day 31, 2 days, 3 aboard: Rich seam: Skim the face); … Overdue (day 49, 4 days, 3 aboard: boarded her and won); … Quiet Ellen (day 57, 2 days, 3 aboard: boarded her and lost). Brought 4 parts, 7 materials and 44 food; boardings won 1, lost 1, left 0; built Solar array (day 39), Shelter (day 39); refitted Crew quarters, Life support aboard; 0 hungry days."
- **M28's browser check by touch:** 32 of 32 at each of 905 × 370, 821 × 283 and 960 × 825. It covers:
  - the places, rolled as the colony first shows, heading the right-hand panel;
  - a place and a squad picked, a tap leaving someone home. Fly out is refused with why, the colony having the life support;
  - a refit: the air plant taken down, its life support fitted in construction mode (its checks counting a full squad), and Colony home;
  - Fly out in two taps, the days out reported, the pad empty, and Refit and Next day off;
  - an event decided at the place in two taps, the first with its odds;
  - Fly home with its report, and a new list;
  - a quit and reopen while away at the squatters' derelict, Board her in two taps, the fight on her map won (played by the AI), its end panel, and Continue back to the colony with her salvage;
  - a solar array and a shelter built;
  - a save made by main (v21) opening with its places rolled and saving as v22;
  - offline, the colony draws; every button 48 px or more in each mode; no console errors.
- **Act 1:** 100 test runs identical to main's, seed by seed, the campaign at launch and the log. **Act 2:** all 30 voyages' steps are main's, settling included, but for an event's changes now naming its materials (0 on the run).
- **The fights** (`node tools/sim.js`; no balance number changed): identical to M27's output.
- **Every earlier milestone's browser check** passes, run one after another, at the three sizes unless named:
  - M27 32, M26 18, M25 21, M24 20, M23h 16, M23g 20, M23f 28, M23e 27, M23d 25, M23c 25, M23 36, M23b 8;
  - M22 35, M21 32, M19 52, M20 32;
  - M18 43, M17 37, M16 29, M15 30;
  - M10 40 (its three sizes in one run), and M8's fights and column;
  - at 905 × 370 only: M14's saves 10, M13 24, M14 46, and M8's extras.

  M24's failed once on the cover screen, with `node --test` running beside it: two of the approach's Fire buttons (99 × 48) failed its hit test. Run alone it passes 20 of 20, as it did at the other two sizes. M28 doesn't touch the approach screen.

  Two copies were adapted, not the game, for what M28 changes on purpose:
  - M27's reads the places above the build list, the solar array and the shelter in it, and its save coming back as v22;
  - M26's infirmary opens healing nobody, and its first day heals the crew.

  The copies that make saves the way main did open them from checkouts of the M27 merge (v21, for M28's), the M26 merge (v20, M27's), the M25 merge (v19, M26's), the M24 merge (v18, M25's) and the M23h merge (v17), as before.

## M27 Colony builder and production (2026-10-15)

**Status:** done, and the ROADMAP.md box is ticked. The colony grows now:
- **Farms and mines** are built from materials where the player puts them: a ghost on the grid, a tap on the grid to move it, a second tap to build it.
- **Any building** moves, turns and comes down, and spare parts from the hold are set down like the ship's own.
- **Next day** passes a day: the farms grow food and the mines dig materials by the world's numbers, the crew eats and rests or goes hungry, and the stores keep what they can.
- **Refit** opens construction mode on the landed ship.

Some of this changes what was there before, not only adds to it:
- **Giving a ship's part goes through the ghost now.** A tap on its row shows where it would stand; a second tap on it, or Give here, gives it. In M26 it was two taps on the row. It stands where the player puts it, or in the first spot that fits, as before.
- **A ship refitted past flying can still give what breaks nothing more** (`colony.js` `donatePlan`). A part is refused when taking it off would make a passing flight check fail. Before, any failing check refused every part; with no refits at the colony that never came up.
- **The colony screen:**
  - the home line gives the day;
  - the needs go on to food and materials against the stores;
  - the right panel is the build list (Build, From the hold, From the ship);
  - the foot has Refit and Next day.

  Placing a building hides the head and the left panel, so the grid is bigger. It is drawn square to the screen, with its cells.
- **Construction mode at the colony** goes home to it (Colony), and its flight checks count nobody aboard.
- **Act 3's words** say what is left to come: the expeditions and the raids.
- **`SAVE_VERSION` 21.**
- **The careful test player plays the colony's first 30 days** after founding it. Each run's report has a line for them, and the summary has one over the runs. `voyage()` returns the colony after the days as `home`; `campaign` is still the colony as founded, so the earlier voyage tests read the same.
- **Tests changed on purpose:**
  - the system test's settled colony has its day and materials;
  - the colony text tests' home line has the day, and their needs go on to food and materials;
  - the colony scene's mark has a ghost in place of M26's spot.

No phone results have come back yet for M14 to M26.

**How it was picked:** Evan answered four questions (2026-10-14), each the recommended answer, and took in all three of M26's open questions:
- **What to build:** "Farms and mines": two buildings only the colony has, built from materials where you tap on the grid, a ghost first and a second tap to build. Any building can be moved and turned by hand. Neither needs power, since most colonies land with 1 power to spare.
- **Food:** "By the world's numbers":
  - each day a farm grows soil + water food and a mine digs ore materials, each at least 1;
  - food is the run's supplies, and the crew eats 1 each a day;
  - short of food, everyone loses 2 hit points, as on a hungry jump (never below 1);
  - the colony lands with 20 materials, and its stores are the landed ship's holds and the storehouses.
- **Days:** "Next day button": two taps on Next day, and the buildings make, the crew eats and the day count rises, with a short report. Giving, building and moving take no time.
- **M26's open questions, all three:**
  - spare parts set down as buildings;
  - buildings taken down: back into the hold as a part, a farm or mine giving back its materials;
  - a refit of the landed ship, which can free quarters that hold the ship together (17 of 30 test runs).

Done when (ROADMAP.md, M27):
- **Days:** "act 3 counts days from the landing, day 1 first. Two taps on Next day pass one: each farm grows its food and each mine digs its materials; the crew eats a food each; a fed crew rests, healing what a day's regroup heals (`regroupHp`) and a powered infirmary's heal on top; short of food, everyone loses `hungerHp` instead, never below 1, as on a hungry jump. Food is the run's supplies. Food and materials are each kept up to the colony's storage: the landed ship's holds, as on the run, and its storehouses; what is made past that is lost. The day's report says what it came to (tested)."
- **Farms and mines:** "built by hand from materials, 10 each, 2 × 2, needing no power. A farm grows soil + water food a day and a mine digs ore materials a day, each at least 1: the world's numbers (M25) at work. A colony begins with 20 materials, salvaged at the landing (tested)."
- **Building by hand:** "a farm, a mine, a spare part from the hold or one of the ship's parts goes where it is put. The first tap shows it as a ghost in the first spot that fits; a tap on the grid moves the ghost there, or says why it can't go; Turn turns it; a second tap on it builds it. The builder's rules place it (on the grid, nothing in the way) with a cell of path round every building. Any building moves and turns the same way, and comes down in two taps: a part goes back into the hold, a farm or a mine gives back its materials. Spare parts follow M26's rules for what becomes a building. Each refusal says why (tested)."
- **Refit:** "construction mode at the colony with the parts on hand, as at a station: quarters that hold the ship together can be freed, and a part taken down can go back aboard. Wrecked parts stay as they are. A ship refitted past flying shows it in its flight checks, as at a station (M28's expeditions need them to pass), and its power going short darkens the colony's buildings that took it (tested)."
- **The colony screen:** "the day; food and materials against storage, with what a day makes and eats; the build list (a farm and a mine with their cost and what each would make here, the hold's parts, the ship's parts) and each building's Move, Turn and Take down; Next day, whose first tap says what the day will bring; and Refit."
- **Saves:** "`SAVE_VERSION` 21 for the day and the materials. A v20 colony opens on day 1 with 20 materials (tested)."
- **The test player:** "over 30 voyages (campaign seeds 1 to 30) the careful test player founds the colony and plays 30 days, building mines and farms by its own judgment. In every run its farms feed its crew within 15 days of the landing, and its report says each run's farms, mines, food, materials and hungry days (`tools/voyage.js`)."
- **Touch:** "every new button is 48 px or more at the three sizes. By touch: a farm built where the grid was tapped; a building moved, turned and taken down; a spare part set down; Next day with its report, and a hungry one; a refit at the colony; and a quit and reopen on the same day."

How each is met:
- **Days:** `tests/days.test.js` (new):
  - a desert colony (soil 1, water 0, ore 2) with two farms and a mine makes 2 food and 2 materials a day; the crew of three eats 3; the plan and the day after it are as reckoned;
  - thirty days on, the food runs down by one a day and then 4 days go hungry, while the materials fill the stores;
  - a fed crew heals `regroupHp` each. A medic and a powered med bay add 1 and 1. Short of food everyone loses 2, never below 1 (a crew member at 1 loses nothing), and the infirmary still heals the hungry. A farm's harvest feeds the same day it is grown. A dark infirmary heals nothing;
  - the stores keep 30 each (the ship's lockers) and 50 with a storehouse; what is past them is lost and counted, after the crew eats.

  `tests/colonyText.test.js`: the ask and the report, fed, hungry, with nothing made and with the stores full.
- **Farms and mines:** `tests/days.test.js`: each costs 10 and is 2 × 2, a farm makes from soil and water and a mine from ore, at least 1 (5, 3, 1 and 1 for four worlds' numbers); a jungle colony's farm makes 5 and its mine 1; both take no power. `tests/data.test.js`: 14 bad-data cases for the builds and the materials.
- **Building by hand:** `tests/colonyBuild.test.js` (new):
  - a farm's ghost in the first spot that fits, then built where it was put, for 10 materials;
  - a mine refused when the stores have 0;
  - the refusals: past the edge (three ways and half a cell), on the farm, too close to it on two sides, a turn it can't take, a build that doesn't exist, away from the colony, and no room;
  - spare parts set down (a Bastion hold as the same Storehouse), the corridor and engine refused as staying aboard, a part not in the hold, an unknown one;
  - a ship's part given where it was put, and refused where it can't stand;
  - a building moved where only its own cells were, turned about its middle and slid back onto the grid at the edge, keeping its uid and its place in the order;
  - taken down: a part back into the hold, a farm's 10 materials back (4 when the stores are nearly full), and what it would leave dark named.

  Through the reducer, each refusal changes nothing.
- **Refit:** `tests/colonyBuild.test.js`: `canRefit` at the colony; a corridor from the hold fitted aboard; a wrecked part can't come off; a ship refitted without its engines fails its thrust and parts checks; a barracks running on the ship's spare power goes dark when a shield generator is fitted aboard. By touch: the barracks taken down, its quarters back aboard in construction mode, and Colony home again.
- **The colony screen:** `tests/colonyText.test.js`: the day, food and materials against the stores, the stores' line, the build rows (each with its cost and what it would make here, or why not), the hold's rows (a kind a row, the rest a row a reason), a ghost's words for a build, a hold part and a ship's part, take-down's words (parts, materials, what goes dark) and the building looked at. By touch at the three sizes, below.
- **Saves:** `tests/days.test.js`: the step from 20 gives a colony day 1 and 20 materials and leaves act 2 and no campaign alone; a v20 save through the front door opens at the colony with its buildings, and a day passes; a day or materials a save can't hold is caught. By touch: a save made by main (v20) opens on day 1 with 20 materials and saves as v21 once a day passes.
- **The test player:** `tests/voyage.test.js` (M27's test):
  - in all 30 runs it plays 30 days, and its farms feed the crew within 15 days of the landing (from day 9 at the latest) and are still feeding them at the end;
  - its buildings are the parts given and then what it built, each paid for, the materials adding up;
  - nobody is lost, and the same founding plays the same days;
  - where it digs before it farms, a mine comes first;
  - each run's report has its line.
- **Touch:** M27's browser check, below.

### Shipped

- **Data:** `colony.json`: `materials` (20) and `builds`: a Farm (2 × 2, 10 materials, food from soil and water, at least 1) and a Mine (2 × 2, 10, materials from ore, at least 1), each with its words. `campaign.json`: act 3's `ahead`.
- **Validation:** `tools/validate-colony.js` checks the materials and each build: an id no part has, a name no other building has, a size that fits, a cost, what it makes and from which of the world's numbers, the least it makes, and its words. `validate-data.js` counts the builds.
- **The sim:**
  - `colonyBuild.js` (new): building a farm, a mine, a spare part or a ship's part where it is put (`buildPlan`, `build`), moving and turning (`movePlan`, `moveBuilding`, `turnedSpot`), taking down (`takeDownPlan`, `takeDown`) and the build list (`buildList`);
  - `days.js` (new): the day (`dayPlan`, `nextDay`);
  - `colony.js`: the builds (`buildOf`, `siteDef`, `yieldOf`, `buildingName`), what the farms and mines make (`colonyStats` `made`), the stores (`storesOf`), placing by hand (`siteError`, `placeBuilding`), a part given where it is put, the infirmary's heal as it opens shared (`healIfOpened`);
  - `settle.js` (the landing's materials), `campaign.js` (refits at the colony; the colony's day and materials checked), `medbay.js` (`stationHeal`), `defs.js`, `root.js` (`campaign/build`, `campaign/move`, `campaign/takedown`, `campaign/day`), `save.js` (v21 and the migration from 20).
- **The colony screen:** `colony.js` (rewritten), `colonyStand.js` (new: the view in its place, taps, drag, pinch, twist and the wheel), `colonyText.js`; `construction.js`; `icons.js` (Next day's and Move's); `style.css`.
- **The scene:**
  - `colonyScene.js`: farms and mines, the ghost on its plate, the frame round a building looked at, the grid's cells while placing, and each building's box for a tap;
  - `colonyBuilds.js` (new): the farm's fields and the mine's headframe, drawn in code;
  - `palette.js` `buildColors`.
- **Tools:** `voyage.js` plays the colony's first 30 days (`playColony`), with a report line a run and a summary line; `voyagePlan.js` `nextBuild`.
- **Tests:**
  - new: `tests/days.test.js` (6), `tests/colonyBuild.test.js` (7);
  - added to: `tests/colonyText.test.js` (3 more), `tests/colonyScene.test.js` (1 more), M27's voyage test, 14 bad-data cases.

  737 tests in all.
- **Docs:** ROADMAP.md: §2 (the colony), §4.8 (v21), M27 ticked, and §9 (two of M26's ideas taken in; four new). CLAUDE.md: the colony's builds and days in its lists.

Decisions made along the way, not asked (each easy to change):
- **What the crew eats is a jump's supplies** (`jumpSupplies`, 1 each), so the run and the colony stay in step if it changes.
- **A day's order:** the farms and mines make first, so a farm built today feeds today. Then the crew eats, then rests or goes hungry, then the stores drop what they can't keep, after the crew has eaten.
- **Rest and the infirmary:**
  - a fed day heals `regroupHp` and a powered infirmary's heal, a medic adding theirs, as a med bay on the run;
  - a hungry day still has the infirmary's heal after the hunger, as a hungry jump has the med bay's;
  - M26's heal to full as an infirmary opens stays, for setting one down too.
- **The stores:**
  - food and materials are each kept up to the landed ship's supply capacity (30 and its holds) and the powered storehouses' cargo;
  - materials given back by a take-down are kept as far as the stores take them, at once;
  - supplies past the stores (after a refit takes a hold off) are lost at the day's end.
- **Placing:**
  - the ghost starts in the first spot that fits, and a tap on the grid centres it on that cell;
  - a ghost that can't stand there turns its plate red and says why, and Build here goes grey;
  - the second tap can be on the ghost or on Build here (Give here, Set down here, Move here).
- **The view while placing:**
  - the head and the left panel step aside, and the grid is square to the screen with its cells drawn;
  - cells are 22.7 px on the cover screen, 16.4 px in a browser tab and 27.8 px unfolded;
  - a drag pans, a pinch zooms (0.7 to 4 times) and a twist turns, and leaving placing fits the view again.
- **Moving keeps the order built,** so a moved building takes power where it did. Turn on a building starts a move, a quarter turned.
- **Taking down:**
  - any building that came from a part goes back into the hold as that part, whether given from the ship or set down;
  - a farm or a mine gives back its whole cost;
  - its first tap names what would go dark.
- **Farms and mines turn,** and their look goes by what they make, not their id: a new build that grows food is drawn as fields.
- **The flags count** the colony's days, the hungry ones, the food grown and lost, the materials dug, lost and spent, the hit points healed and lost to hunger, and the buildings built, set down and taken down.
- **The test player** builds the farms its crew needs as soon as it can pay. While it can't yet pay for them all, it builds a mine first whenever one would pay for them sooner, its own cost counted. Once fed, it builds nothing more.

### Known issues

- **Food is easy on most worlds.**
  - On 24 of 30 careful colonies, one or two farms feed the crew from day 1 (ocean, ice and jungle).
  - Only rock and desert need mines first, and they go hungry up to 8 days (4 runs).
  - Food at the end is 30 at the median, the stores full. (§9)
- **Materials have nothing to buy after the farms.** They pile up to the stores: 10 at the median after 30 days, 70 at most. (§9)
- **The test player builds farms and mines only.** It doesn't set spare parts down, move or take buildings down, or refit at the colony; those are tested by hand and by touch. So in 17 of 30 runs the quarters still hold the ship together and the crew sleeps aboard, though a refit could free them. (§9)
- **The infirmary's heal as it opens can be had again** by taking it down and setting it down. Nothing but hunger hurts the crew at the colony yet. (§9)
- **A refit that frees the ship's power** lights a dark infirmary without its heal to full; the next day's rest heals as usual.
- **Cells while placing are 16.4 px in a browser tab** (821 × 283); zoom covers the rest. The colony's own view keeps M26's fit, where a building is two or three cells, about 30 px, to tap.
- **Danger and lanes do nothing yet** (M29), nor do defenses.

### What to test on the phone (Galaxy Z Fold 6)

The quickest way there: settle a world in a run, or ask me for a save code at a colony.
1. **A farm:** tap Farm, then the grid where you want it, then the ghost. Can you aim at a cell folded and unfolded? Does a pinch help, and does the view feel right while placing, with the left panel gone?
2. **A refusal:** put a mine right beside the farm. Are the red plate and the reason in the foot clear?
3. **Move, turn and take down:** tap a building, then Move and tap elsewhere and the ghost again; Turn; Take down in two taps.
4. **A spare part:** set one down from the hold.
5. **Next day:** two taps, and read the report. On a rock or desert world, can you feed the crew before they starve? How does the hunger feel?
6. **A refit:** if your quarters hold the ship together, refit the landed ship (corridors from the hold can join the engines or the airlock), then give the quarters.
7. **Quit and reopen:** the same day.
8. **Tell me:**
   - whether food should take more work (§9);
   - what materials should buy next, in M28 or M29 (§9);
   - and the M14 to M26 questions still open.

### Next session

M28 Expeditions from the colony. First task: settle its Done when with Evan. ROADMAP.md has a draft: the ship flies out with a squad (berths and air for whoever is aboard), to nodes for salvage and materials, and back; the colony runs on its own power while it is gone. Ask too what materials should buy (§9), and whether a crew coming home hurt should heal at the infirmary each day only, now that days pass (the heal as it opens can be had again, §9).

### Verified here

- `node --test`: 737 pass. `node tools/validate-data.js`: OK ("15 colony buildings, 2 colony builds"). No golden file changed.
- **The test player, 30 voyages** (`node tools/voyage.js --runs 30`, managing heat), the summary's colony lines:
  ```
  The colony: founded in 30 of 30, 2 (1 to 5) parts given: Air plant 30, Gun emplacement 27, Barracks 13, Infirmary 2, Storehouse 2, Bunkhouse, Flak tower, Generator, Warehouse. Everyone housed in 13 of 30, 3 (0 to 3) sleeping aboard; every building powered in 30, power to spare 1 (0 to 3); the ship flies with nobody aboard in 30; the infirmary healed in 0.
  The colony's first 30 days: its farms feed the crew within 15 days of the landing in 30 of 30, from day 1 (1 to 9); farms 1 (1 to 3), mines 0 (0 to 2); hungry days 0 (0 to 8), in 4 runs; at the end, food 30 (0 to 58) and materials 10 (0 to 70), stores 30 (30 to 90).
  ```
  A rock world's line (seed 4): "30 days at the colony: built Mine 2 (days 1, 1), Farm 3 (days 3, 5, 6); its farms feed the crew from day 6; 0 hungry days; food 14 to 3, materials 20 to 70, of 70 each; 3 farms and 2 mines." The 6 runs not fed on day 1 are the 5 rock worlds and a desert.
- **M27's browser check by touch:** 32 of 32 at each of 905 × 370, 821 × 283 and 960 × 825. It covers:
  - the colony on day 1: "Act 3 · The colony | Copperhill · Desert world · Day 1", food 27 of 30 and materials 20 of 30, and the build list (Farm and Mine with their cost and what each would make here; the hold's crew quarters and corridors; the ship's parts);
  - a farm: a tap on Farm shows its ghost with nothing built. A tap on the grid moves it to the cell tapped, and a second tap on it builds it there for 10 materials;
  - a mine's ghost tapped beside the farm: "Too close to the farm: every building needs a cell of path round it. Tap the grid where it can go.", Build here greyed, and its second tap builds nothing. Tapped clear, Build here builds it, and out of materials the Farm row says so;
  - the farm tapped and looked at: Move, a tap on the grid and a second on the ghost moves it, keeping its place in the order; Turn and Move here turns it; Take down in two taps gives back its 10 materials;
  - the hold's crew quarters set down as the barracks, beds 4 for 3;
  - Next day: its first tap ("Day 1 ends: the mines dig 2 materials; the crew eats 3 and rests. Food 27 → 24, materials 10 → 12. Tap again for day 2."), its second (the report, and "Day 2" in the head);
  - a refit: the barracks taken down, its quarters back aboard in two taps in construction mode (the way out reads Colony, the chip "Ready to fly"), and Colony home on day 2;
  - a quit and reopen on day 2;
  - a hungry day from a colony with 1 food: the food need marked short, the ask, and "Day 2. Nothing grew; short of food, the crew went hungry: 6 hit points lost. Food 0, materials 20.", the crew 10/8/8 to 8/6/6;
  - a save made by main (v20) opens on day 1 with 20 materials and saves as v21 once a day passes;
  - offline, the colony draws; every button 48 px or more while browsing, placing and looking; no console errors.
- **Act 1:** 100 test runs identical to main's, seed by seed, the campaign at launch and the log. **Act 2:** all 30 voyages' steps main's, settling included; the campaign as it landed, and as it founded the colony, main's but for the colony's day and materials.
- **The fights** (`node tools/sim.js`; no balance number changed): identical to M26's output.
- **Every earlier milestone's browser check** passes, run one after another, at the three sizes unless named:
  - M26 18, M25 21, M24 20, M23h 16, M23g 20, M23f 28, M23e 27, M23d 25, M23c 25, M23 36, M23b 8;
  - M22 35, M21 32, M19 52, M20 32;
  - M18 43, M17 37, M16 29, M15 30;
  - M10 40 (its three sizes in one run), and M8's fights and column;
  - at 905 × 370 only: M14's saves 10, M13 24, M14 46, and M8's extras.

  Two copies were adapted, not the game, for what M27 changes on purpose:
  - M26's reads the home line with its day and the needs with food and materials; it gives a part with a tap on its row and Give here; it reads the ship's rows as the build list's last; and its save made by main comes back as v21;
  - M25's reads the home line with its day.

  The copies that make saves the way main did open them from checkouts of the M25 merge (v19, for M26's), the M24 merge (v18, M25's) and the M23h merge (v17), as before. M14 ran 46 checks (39 in M26): its count follows the jobs its run plays.

## M26 Settling and donated modules (2026-10-14)

**Status:** done, and the ROADMAP.md box is ticked. Act 3 has a home now: the colony on the world settled. Two taps on one of the ship's useful parts take it off the ship, and it stands on the colony's grid as the building of its kind, drawn as the part it was. The colony's power, beds and air are set against what the crew needs, and the crew lives there, so the ship's flight checks count nobody aboard.

Some of this changes what was there before, not only adds to it:
- **Act 3's stub is gone.** The colony is act 3's home (`colony` screen, in place of `stub`). The run's record and the world card that the stub showed are in the colony's left panel now.
- **Act 3's words say what is still to come.** `data/campaign.json` act 3 has `ahead` in place of `stub`, and the validator knows `ahead` and no longer `stub`.
- **In act 3 the ship's flight checks count nobody aboard** (`campaign.js` `crewAboard`, used by `shipChecklist` and `partsNeeded`). Acts 1 and 2 still count the whole crew.
- **`SAVE_VERSION` 20.**
- **The careful test player founds the colony after settling.** Each run's report has a line for it, and the summary has a line over the runs. Founding adds no steps: in all 30 voyages every step is main's, settling included, and the campaign as it landed is main's (but for the colony's empty building list).
- **The roof fittings are shared:** `exterior.js` `roofFittings` draws a part's fittings for the ship and for its building. The ship looks the same (the exterior tests pass unchanged).

No phone results have come back yet for M14 to M25.

**How it was picked:** Evan answered five questions (2026-10-14), each the recommended answer:
- **Gate 4:** "Passed: go on to M26" (the entry below).
- **What can be donated:** "Useful parts": reactors, life support, quarters and bunks, holds, med bays and surgery, armories, guns and shields, each becoming the building of its kind. The bridge, engines, corridors and airlocks stay on the ship.
- **The colony site:** "Drawn, laid out for you": the world's ground in 3D, the ship landed on it, each building drawn as its part and set out on the grid by itself. Building by hand comes in M27.
- **What buildings do:** "House and power the crew": power, beds and air against what the crew needs; an infirmary heals. Guns, shields and the armory wait for M29's raids; soil, water and ore for M27's production.
- **The snag** (measured before asking: counting the whole crew aboard, no ship could give a reactor, quarters or life support): "Crew moves off the ship". In act 3 the crew lives at the colony, so the ship's berth and air checks count only who is aboard, nobody until M28; the landed ship's reactor powers the colony too.

Done when (ROADMAP.md, M26):
- **The colony:** "act 3's home is the colony, in place of M25's stub: the world's ground in 3D in its kind's colors, the ship landed at its edge, and each building drawn as the part it was. Buildings are laid out by themselves on the colony's grid (`src/sim/grid.js` and the builder's placement), each in the first spot that fits with a path round it, in the order given; the same buildings in the same order always stand in the same places (tested). Continue on the title comes back to the colony, and a quit and reopen keeps it."
- **Giving a part:** "at the colony, two taps on one of the ship's parts: it comes off the ship and stands in the colony as a building of its kind (`data/colony.json`: each useful part's building, its name and words; what it gives is its part's own numbers). Only useful parts, never a wrecked one, never one the ship can't fly without (every flight check must still pass, counting nobody aboard), and never when the grid has no room. Each refusal says why (tested)."
- **What the colony gives:** "power from its power plants and from the landed ship (what its reactors make beyond what its own parts use). The buildings take it in the order they were given, and any it doesn't reach go dark. Beds and air from its powered quarters, bunks and life support, one each for every crew member; whoever goes without sleeps aboard the landed ship. A powered infirmary (a med bay or surgery) heals the crew to full when it opens, and from M28 and M29 when the crew comes home hurt. Holds are storehouses (for M27's production), and guns, shields and armories are defenses (for M29's raids): the colony says what they hold and guard, and they do nothing else yet (tested)."
- **The colony screen:** "the colony's power, beds and air against what the crew needs; its buildings, the dark ones marked; the crew; and the ship's parts that can be given, each with what it would give, and why the rest can't. Act 3's words say what is still to come."
- **Saves:** "`SAVE_VERSION` 20 for the colony's buildings. A v19 save in act 3 opens at the colony with no buildings yet and every part still aboard (tested)."
- **The test player:** "over 30 voyages (campaign seeds 1 to 30) the careful test player settles and founds the colony, giving every useful part the flight checks let go, beds and air first. In every run the ship still passes every flight check, counting nobody aboard, and every building is powered. Its report says what each run gave, the colony's power, beds and air, and who sleeps aboard (`tools/voyage.js`)."
- **Touch:** "every new button is 48 px or more at the three sizes. By touch: the colony after the landing; a part given in two taps; a refusal and its reason; the infirmary healing the crew; and a quit and reopen at the colony."

How each is met:
- **The colony:** `tests/colonyScene.test.js` (new): the ground cleared for the grid in the world's kind's colors (a ground for each kind), the ship's own faces moved off the grid's west edge and level with it, each building a box on its cells as tall as a hull with its part's fittings on the roof, its lights out while dark, and the same colony always drawn the same. `tests/colony.test.js` (new): by hand, the first buildings at (0, 0), (0, 4), (0, 7), (0, 9) and (4, 0); over 60 orders of every kind of building, each on the grid with a cell of path round it, and the same order laid out again stands in the same places. `tests/system.test.js`: Continue on the title comes back to the colony. By touch: Settle here, the landing, Skip and Continue reach the colony; a quit and reopen comes back to it, its buildings standing.
- **Giving a part:** `tests/colony.test.js`: given, a part leaves the ship and stands as its building with its own numbers (a Bastion part as the same building); refused, each with its reason: parts that stay aboard ("Stays aboard: no use to the colony."), a wrecked part, the one reactor ("The ship couldn't fly without it: power −7 (0 made, 7 used)."), quarters that join the reactor to the bridge ("…1 part not joined to the bridge."), a grid with no room, a part not on the ship, and away from the colony. Through the reducer, a refusal changes nothing. By touch: two taps on Crew quarters; a tap on the reactor and on the parts that stay aboard says why.
- **What the colony gives:** `tests/colony.test.js`: power 5 from a generator and the ship's 1 spare, the barracks and air plant powered, a shield array after them dark, a storehouse and the generator never dark; given first, the shield array takes the air plant's power and all three sleep aboard; bunks house two of three; guns, flak, armories and an infirmary counted only while powered. A med bay given to a hurt crew heals all 17 missing hit points, and nothing more as later parts come. `tests/colonyText.test.js` (new): the needs, buildings (a dark one "Dark: needs 4 power"), who sleeps aboard, and "Guns 15, for raids to come".
- **The colony screen:** `tests/colonyText.test.js`: the head, needs, buildings, crew (each marked if they sleep aboard), the ship's parts (a row a kind for those that can go, with the building and what it gives; a row a reason for the rest, naming each kind it holds back), the world, the run's record, and the act's words. By touch at the three sizes, below.
- **Saves:** `tests/colony.test.js`: the step from 19 gives a settled colony no buildings and leaves act 1, act 2 and no campaign alone; a v19 save through the front door opens at the colony with every part aboard and a part can be given; a colony with buildings reads back the same; a uid twice or past `nextUid`, a turn it can't have, half a cell, no list and no `nextUid` are caught. By touch: a save made by main (v19) in act 3 opens at the colony with all 12 parts aboard, and a part given there saves it as v20.
- **The test player:** `tests/voyage.test.js` (M26's test): in all 30 runs the colony is founded, its buildings are the parts given in order, nothing left aboard can be given, the ship passes every flight check and every building is powered; played again from the landing, it never gave anything else while a part with beds or air could go, and the same landing founds the same colony; air for everyone in every colony, and everyone housed in 10 or more (13 measured). The report and summary are below.
- **Touch:** M26's browser check, below.

### Shipped

- **Data:** `colony.json` (new): the grid (20 × 12, a cell of path round each building), the tags of the parts that stay aboard, the colony's words, and the 15 buildings with their names and words (Power plant, Generator, Air plant, Barracks, Bunkhouse, Storehouse, Warehouse, Infirmary, Clinic, Armory, Gun emplacement, Cannon emplacement, Flak tower, Shield dome, Shield array). `campaign.json`: act 3's `ahead` words.
- **Validation:** `tools/validate-colony.js` (new, from `validate-campaign.js`): the grid's size and path, the aboard tags (each a tag some part has), the words, and each building's part (it exists, is a base part, stays aboard by no tag, fits on the grid, is named once) with its name (once) and words. `validate-data.js` counts the colony's buildings. 13 bad-data cases.
- **The sim:**
  - `colony.js` (new): the buildings and what each gives (`givesOf`), the colony's power, beds, air, who sleeps aboard, stores, defenses and infirmary (`colonyStats`), the first spot that fits (`spotFor`), giving a part (`donatePlan`, `donate`), and the ship's parts as the colony sees them (`shipParts`);
  - `settle.js` (a colony with no buildings), `acts.js` (`atColony`), `campaign.js` (`crewAboard`, the colony's checks), `root.js` (`campaign/donate`, the colony screen), `defs.js` (the colony's content), `save.js` (v20 and the migration from 19).
- **The colony screen** (`colony.js`, `colonyText.js`, new; `style.css`): the head with the world and its kind; the left panel (needs, the power's sources, buildings, crew, the world and the run's record); the scene; the ship's parts as two-tap buttons; the foot's words. **The scene** (`render/colonyScene.js`, `render/colonyView.js`, new; `exterior.js` `roofFittings`; `palette.js` grounds).
- **Gone:** `stub.js` and `stubText`; `runRecord` stays in `launchText.js` for the colony and the voyage report.
- **Tools:** `voyage.js` founds the colony (`foundColony`), with a report line a run and a summary line, and returns the campaign as it landed; `voyagePlan.js` `nextGift`.
- **Tests:** `tests/colony.test.js` (8), `tests/colonyText.test.js` (3), `tests/colonyScene.test.js` (3), `tests/colonyKit.js` (new); M26's voyage test; the system, launch, launch text and data tests brought up to date. 719 tests in all.
- **Docs:** ROADMAP.md: §2 (the colony), §4.7 and §4.8 (v20), M26 ticked, and §9. CLAUDE.md: the colony in its lists of content, sim modules and validators.

Decisions made along the way, not asked (each easy to change):
- **The grid** is 20 × 12 with a cell of path round each building. The ship stands off its west edge, nose toward it, and buildings fill it a column at a time from that edge, top to bottom, each as it is and then turned a quarter. The grid's own edge needs no path: past it is open ground.
- **Power, in the order given:** each building takes what it needs while enough is left; one that can't is dark, and a later one that needs less can still take what is left.
- **Who sleeps aboard:** the last of the crew, in the crew's order, once the beds or the air run out.
- **The infirmary heals as it opens** (given, or reached by power it lacked), not at every gift: nothing at the colony hurts the crew yet.
- **The screen:** the colony's needs, buildings, crew, world and the run's record share the left panel, which scrolls; the ship's parts are on the right, those that can go first. Parts that can't go share a row a reason, so the bridge, corridors, airlock and engines are one row. A part armed glows on the ship, and where it would stand is marked out on the grid.
- **The view** keeps the ship and the grid as far as the buildings reach, 3 columns on (8 at least), so a new colony isn't a speck on an empty field; it widens as the colony grows.
- **Colors:** each kind of world has a ground, dark enough for the panels' words over it (the first tries, a pale ice and sand, washed them out). Buildings wear the ship's paint, their fittings in their maker's colors. The ship's nozzles still glow, as at the landing's end.
- **The refusals' words** read the same for one part or many, so a row can hold several ("Stays aboard: no use to the colony.").
- **The test player** gives a part with beds or air whenever one can go, else the first that can, asking again after each gift, until none can.
- **The flags** count the parts given (`partsGiven`).

### Known issues

- **Quarters that hold the ship together.** In 17 of 30 careful runs the quarters can't go: "The ship couldn't fly without it: N parts not joined to the bridge." (checked run by run). The air plant goes in all 30, so in those 17 the crew has air at the colony but no beds, and all three sleep aboard. M26 has no way to free them (a refit on the landed ship would; §9).
- **Nothing goes dark in play.** Everything given came off a ship that flew, so the power still balances: the colony's power left over is the ship's spare power before anything was given. Dark buildings are tested on colonies made by hand; they can happen once the ship flies off (M28).
- **The infirmary healed nobody in the test runs.** The 2 runs that gave one landed with the crew at full. It is tested by hand and by touch.
- **Parts on hand can't be set down,** only the ship's own (§9). The careful test player lands with a few.
- **A building can't go back to the ship.** Nothing says so before the second tap but "It comes off the ship."
- **The colony's view can't be turned or zoomed,** and a tap on it does nothing (§9).
- **Stores and defenses do nothing yet,** as the Done when says (M27, M29). Nor do the world's numbers (M25's issue).

### What to test on the phone (Galaxy Z Fold 6)

The quickest way there: settle a world in a run, or ask me for a save code at a world past the charts.
1. **The landing, then the colony:** after Continue, the world's ground with the ship landed beside the grid. Can you read the panels' words over your world's ground, folded and unfolded? There are five grounds, one a kind.
2. **A part given:** tap one on the right, then again. Does the first tap read clearly: its words in the foot, the glow on the ship, and the spot marked on the grid? Does the building read as the part it was?
3. **A refusal:** tap the reactor, or the row for the bridge, corridors, airlock and engines. Is the reason in the foot plain?
4. **Your quarters:** can they go on your ship, or do they hold it together? If they can't, the crew sleeps aboard: is "3 sleep on the ship" clear?
5. **Quit and reopen:** Continue should say the world and come back to the colony.
6. **Tell me:**
   - whether a crew sleeping aboard because the quarters hold the ship together should have a way out in M27 (a refit on the landed ship, §9);
   - whether parts on hand should become buildings too (§9);
   - whether a building given should be able to go back to the ship;
   - and the M14 to M25 questions still open.

### Next session

M27 Colony builder and production. First task: settle its Done when with Evan. ROADMAP.md has a draft: building and moving by hand on the colony's grid with the builder's rules; days passing; food and materials made by the day from the world's soil, water and ore, kept in the storehouses. Ask too whether parts on hand and a refit on the landed ship belong in it (§9).

### Verified here

- `node --test`: 719 pass. `node tools/validate-data.js`: OK ("15 colony buildings"). No golden file changed.
- **The test player, 30 voyages** (`node tools/voyage.js --runs 30`, managing heat), the summary's colony line:
  ```
  The colony: founded in 30 of 30, 2 (1 to 5) parts given: Air plant 30, Gun emplacement 27, Barracks 13, Infirmary 2, Storehouse 2, Bunkhouse, Flak tower, Generator, Warehouse. Everyone housed in 13 of 30, 3 (0 to 3) sleeping aboard; every building powered in 30, power to spare 1 (0 to 3); the ship flies with nobody aboard in 30; the infirmary healed in 0.
  ```
  A run's line (seed 5): "Founded the colony: gave Air plant, Barracks, Infirmary, Storehouse; power 3 (0 from its plants, 3 the ship's spare), 3 used, 0 dark; beds 4 and air 4 for a crew of 4: everyone has a bed and air. The ship passes its flight checks with nobody aboard." The 17 runs where someone sleeps aboard are all the quarters holding the ship together.
- **M26's browser check by touch:** 18 of 18 at each of 905 × 370, 821 × 283 and 960 × 825. It covers:
  - at a world past the charts, Settle here in two taps, the landing, Skip, Continue: "Act 3 · The colony | Copperhill · Desert world";
  - its needs (power 0 used of 1; beds 0 for 3, air 0 for 3 and "3 sleep on the ship", each marked short), "None yet: give the colony a part of the ship.", the ship's parts (Weapon mount, Crew quarters and Life support to give, each with its building and numbers; one row for the bridge, corridors, airlock and engines; the reactor with its reason), and the act's words in the foot; every button 48 px or more;
  - Crew quarters: the first tap arms it ("Crew quarters becomes the colony's Barracks: beds 4 · power −1. It comes off the ship. Tap again to give it.") with nothing given; the second gives it ("The barracks stands at the colony: beds 4 · power −1."), the quarters off the ship and the list, beds 4 for 3;
  - the reactor tapped ("Reactor: can't be given. The ship couldn't fly without it: power −6 (0 made, 6 used).") and the parts that stay aboard, nothing changed;
  - the life support and the gun given: power 3 used of 4, beds and air 4 for 3, nobody aboard, "Guns 15, for raids to come", nothing left to give;
  - a quit and reopen: Continue says "Act 3 · Copperhill" and comes back to the colony with its three buildings;
  - a hurt crew and a med bay: given, "The infirmary stands at the colony: heals 1 · power −1. It patched the crew up: 17 hit points.", 3/10 3/8 3/8 to 10/10 8/8 8/8;
  - a save made by main (v19) in act 3 opens at the colony with all 12 parts aboard and 3 to give; a part given saves it as v20;
  - offline, the colony draws; no console errors.
  - Both panels scroll at 905 × 370 and 821 × 283, and both fit at 960 × 825.
- **Act 1:** 100 test runs identical to main's, seed by seed, the campaign at launch and the log. **Act 2:** all 30 voyages' steps main's, settling included, and the campaign as it landed main's but for the colony's empty building list.
- **The fights** (`node tools/sim.js`; no balance number changed): the same as M25's to the line, but for the time taken.

  ```
  1,000 fights on example ship, pirate cutter, patrol corvette, derelict hauler, con-reg repo tug, con-reg gunship. The squad (marine, engineer, medic), played by the AI, against the boarding party (pirate, pirate, brute, pirate), played by the AI. 30 rounds at most, seed "balance".

  Ship              Fights    Crew wins  Boarders win  No winner    Rounds  Crew orders
  Example ship         167  63% (56–70)           37%         0%   7 (5–9)           30
  Pirate cutter        167  47% (40–55)           37%        16%  7 (5–12)           28
  Patrol corvette      167  54% (46–61)           38%         8%  8 (5–17)           30
  Derelict hauler      167  40% (33–48)           49%        11%  7 (5–12)           27
  Con-Reg repo tug     166  41% (34–49)           43%        16%  7 (4–10)           25
  Con-Reg gunship      166  31% (25–39)           41%        28%  7 (5–12)           29
  All                1,000  46% (43–49)           41%        13%  7 (5–12)           28

  Rounds and crew orders count the fights with a winner: the median (10th to 90th percentile). Win rates have a 95% interval.

  Shots: 23,357, 23.4 a fight. Hit: crew 55%, boarders 40%.
  Shown odds  Shots  Shown  Hit
  0–19%       2,020     9%   9%
  20–39%      6,778    26%  27%
  40–59%      4,466    45%  45%
  60–79%      7,619    67%  67%
  80–100%     2,474    83%  84%
  On overwatch: 7% of shots, 27% hit. Crits: 32% of hits. Damage a hit: crew 4.5, boarders 4.5.
  A fight: 1.8 crew go down, 0.9 bleed out, 2.6 boarders die.

  1,000 fights in 38.7 s (39 ms a fight).
  ```
- **Every earlier milestone's browser check** passes, run one after another, at the three sizes unless named:
  - M25 21, M24 20, M23h 16, M23g 20, M23f 28, M23e 27, M23d 25, M23c 25, M23 36, M23b 8;
  - M22 35, M21 32, M19 52, M20 32;
  - M18 43, M17 37, M16 29, M15 30;
  - M10 40 (its three sizes in one run), and M8's fights and column;
  - at 905 × 370 only: M14's saves 10, M13 24, M14 39, and M8's extras.

  Two copies were adapted, not the game, for what M26 changes on purpose:
  - M25's goes on from the landing to the colony, where it went to the stub, and reads the run's record and the world card there; its save made by main comes back as v20 (it pinned v19);
  - M24's takes its v17 save back as v20 (it pinned v19).

  The copies that make saves the way main did open them from checkouts of the M24 merge (v18, for M25's) and the M23h merge (v17), as before. M14 ran 39 checks (40 in M25): its count follows the jobs its run plays.

## Gate 4 (2026-10-14)

**Passed.** Evan's answer at M26's start: "Passed: go on to M26".
- ROADMAP.md named no gate for Phase 4. The one passed was drafted at M25's close: "act 2 plays on the phone from launch to a world settled, and Evan wants to keep going." v0.2 is done: Phase 4.
- No phone results have come back for M14 to M25. The gate is Evan's call, so it stands as passed.
- Phase 5 starts with M26 (settling and donated modules). ROADMAP.md held Phase 5's details until v0.2 shipped. They are drafted there now, with M26's Done when in full and the rest marked as drafts.

## M25 Scouting candidate worlds (2026-10-14)

**Status:** done, and the ROADMAP.md box is ticked. Act 2 ends now. Jump on from the last sector's jump point reaches a system past the charts with three worlds. A survey from orbit shows what a world is worth, and Settle here at one ends the run: the ship lands, and act 3's stub stands in for the colony, the world saved with the campaign. Phase 4 (act 2, v0.2) is complete; Phase 5 waits on Evan's gate (Next session, below).

Some of this changes what was there before, not only adds to it:
- **The last jump point leads on.** "The end of the charts" and act 2's stub words are gone (`data/campaign.json` act 2 has no `stub` now). Act 3 has its own stub words.
- **The stub is act 3's:** the run's record and the world settled, in place of act 1's jobs and raids. Act 2 has had no stub since M19 (the sector map is its home).
- **The title's Continue** says "Act 2 · The system · name" past the charts, and "Act 3 · world" once settled.
- **`SAVE_VERSION` 19.**
- **The careful test player plays on into the system and settles,** so every fleet in `tests/voyage.test.js` ends there now. "Reaches the end of the charts" in those tests now means settles a world. M24's test counts the hunters met crossing the sectors, as it measured them; the system's are reported apart (Known issues).
- **In the last sector the test player counts the jump on,** into the system, and wants 4 jumps' supplies left after it, as for any sector; before, it planned to stop at the jump point. Its steps in sectors 1 to 4 are main's in all 30 runs, and in sector 5 in 20; fed all the way in 25 either way.

No phone results have come back yet for M14 to M24.

**How it was picked:** Evan answered four questions (2026-10-14), each the recommended answer:
- **Where the worlds are:** "System past the charts": three worlds in a system of their own past the last sector's jump point.
- **Scouting:** "Survey from orbit": a day at a world, for supplies and heat, shows its numbers.
- **What a world is:** "Act 3 numbers, shown now": soil, water, ore, danger and how far from the lanes, rolled now and saved with the world settled.
- **The end of the act:** "Landing, then the stub": a short landing, then act 3's stub.

Done when (ROADMAP.md, M25):
- **The system:** "Jump on from the last sector's jump point reaches a system past the charts: its way in and three candidate worlds, each linked to the way in and to the world beside it, rolled from the campaign's RNG as the ship enters (`data/worlds.json`). Each world has a name, a kind (ocean, desert, ice, jungle, barren rock) and act 3's numbers, rolled within its kind's ranges: soil, water, ore and danger, each 0 to 3, and how far it lies from Con-Reg's lanes, 1 to 3. No two worlds in a system are of the same kind. The same seed always gives the same system (golden file) (tested)."
- **Known from afar:** "the worlds are on the charts with their kind; their numbers show once surveyed (tested)."
- **Survey:** "at a world, two taps. A day in orbit eats a jump's supplies and adds 2 heat (`surveyHeat`), and the hunters may find the ship, at a jump's odds, as when regrouping. It shows the world's numbers, once a world. It needs the supplies for the day (tested)."
- **Settle:** "at a world, two taps on Settle here, surveyed or not: act 2 ends. The campaign moves on to act 3, saved at once with the world (its name, kind and numbers, and whether it was surveyed) for M26 to M29 to build on. The ship, crew, credits, parts on hand and heat go with it. Not while an approach holds the ship (tested)."
- **The landing:** "a short landing scene, M17's lift-off in reverse, with Skip, then act 3's stub: the run's record (sectors, jumps, the hunters met and faced, boardings, credits, parts on hand, heat) and the world settled. Continue on the title comes back to the stub (tested)."
- **Saves:** "`SAVE_VERSION` 19 for the system, the surveys and the world settled. An older act 2 save carries on where it was, and one in the last sector jumps on into the system (tested)."
- **The test player:** "over 30 voyages (campaign seeds 1 to 30) the careful test player crosses all five sectors, enters the system, surveys while its supplies allow and settles the world it scores best, in every run. Its report says how many worlds it surveyed, which it settled and what the act's record came to (`tools/voyage.js`)."
- **Touch:** "every new button is 48 px or more at the three sizes. By touch: Jump on into the system, a survey that shows a world's numbers, a jump to the next world, Settle here in two taps, the landing with Skip, act 3's stub, and a quit and reopen there."

How each is met:
- **The system:** `tests/system.test.js`. Over 300 seeds: the way in and 3 worlds, the links exactly 0–1, 0–2, 0–3, 1–2 and 2–3, no jump point, no kind or name twice, every number within its kind's ranges, and over the seeds every number in every range and every distance from the lanes. Jump on from the act's last jump point rolls the system from the campaign's RNG (the same as `generateSystem` at that seed); past it nothing is charted. Golden file `tests/golden/systems.txt` (new; `tools/sectors.js --system`, `--golden`). By touch: two taps on Jump on reach "The system · The Quiet Star", its three worlds named with their kinds.
- **Known from afar:** `tests/system.test.js` (every node known on arrival, a scan shows nothing) and `tests/sectorText.test.js` (each world's kind on the chart, not surveyed; picked, its kind and words, and "Not surveyed: a day in orbit shows what it is worth."; surveyed, its four numbers, each of 3, and the lanes' words). By touch: the marks dashed until surveyed, then solid, and "Soil 1 · Water 0 · Ore 2 · Danger 1, each of 3." with "Far from any lane: hard to reach, and harder to find." in the left panel.
- **Survey:** `tests/system.test.js`: 3 supplies and heat +2, the world added to the run's surveys, once a world; at the most heat the hunters find the ship, the survey made all the same, and the screen changes to the approach; held by them, no survey or settling; refused away from a world, off the run, or short ("A day's survey eats 3 supplies, and the holds have 2."). By touch: two taps, supplies 24 to 21, heat 14 to 16, the numbers and lanes in the left panel.
- **Settle:** `tests/system.test.js`: act 3, the colony's world exactly the node's (name, kind, numbers, surveyed), the ship, crew, captain, credits, parts, heat, supplies, wrecks and run unchanged; surveyed first, the colony says so; refused away from a world, off the run, and while the hunters hold the ship; settled once. By touch: two taps on Settle here, the campaign in act 3 at once.
- **The landing:** `tests/liftOff.test.js` (the landing is the lift-off's moments backwards: out of sight at first, in from the right, down onto the pad, the engines out) and `tests/launchText.test.js` (the world and its kind's landing words; act 3's stub with the run's record and the world, surveyed or not; Continue's words). `tests/system.test.js`: Settle here shows the landing, and Continue on the title the stub. By touch: the landing, Skip to its end, Continue to the stub; a quit and reopen comes back to the stub.
- **Saves:** `tests/system.test.js`: a v18 save at the last jump point opens as it was (`run.surveyed` empty, `colony` null) and jumps on into the system; act 1 and no campaign migrate too; a settled campaign saves and reads back the same; a colony out of step with the act, or unreadable, and a broken system or survey list are caught. By touch: a save made by main (v18) at the last jump point opens, Jump on goes into the system, and it is saved as v19.
- **The test player:** `tests/voyage.test.js` (M25's test): all 30 runs cross 5 sectors, enter the system and settle; each world surveyed at most once; at settling, no survey was left that its supplies covered with the way on to the best world, and the world settled is the best it knew of in reach; 2 worlds or more surveyed in 25 of 30, never hungry in the system, a surveyed world settled in 29. Its report (below) says the surveys, the world settled and the act's record.
- **Touch:** M25's browser check, below: every button 48 px or more at the three sizes on the chart in the system, at a world, on the landing and on the stub, and each step by touch.

### Shipped

- **Data:** `worlds.json` (new): a system's 3 worlds and its words; the lanes' words, nearest first; five kinds of world, each with its ranges for soil, water, ore and danger, its words and its words for the landing; 12 system names and 24 world names. `sectors.json`: the world kind of node, on the charts. `balance.json`: `surveyHeat` 2. `campaign.json`: act 3's stub words; act 2's gone.
- **Validation:** `tools/validate-worlds.js` (new, from `validate-campaign.js`): the system's size and words, the lanes' three lines, each kind's ranges (0 to 3, least first), weights, words and landing words, at least as many kinds and world names as a system has worlds, no name twice, and the world kind of node. `validate-data.js`: `surveyHeat`'s range and the count of kinds of world.
- **The sim:**
  - `gen/system.js` (new): the system, sector-shaped, rolled and saved as a sector is;
  - `travel.js`: Jump on from the act's last jump point leads into the system, and nothing leads on from there; `run.surveyed`;
  - `survey.js` and `settle.js` (new); `root.js` (`campaign/survey`, `campaign/settle`, the landing screen);
  - `campaign.js` (`colony`, `COLONY_ACT`, its checks), `runShape.js` (a system, its worlds and the surveys), `save.js` (v19 and the migration from 18).
- **The chart** (`sector.js`, `sectorText.js`, `style.css`, `icons.js`, `palette.js`): "The system · name"; a world's mark with its name and kind beside it, dashed until surveyed; Survey and Settle here in the foot, two taps each, with what they take and the hunters' odds; the world's kind, words, numbers and lanes in the left panel, picked or there; the system's words at its way in; hints for the system; Jump on's "On to the system past the charts".
- **The landing** (`landing.js`, new; `liftOff.js` `landingAt`): the lift-off backwards, with Skip and Continue, the world's name and kind, and its kind's landing words. **The stub** (`stub.js`, `launchText.js`): act 3's, with the run's record and the world in a card under the ship. **The title's Continue** (`hubText.js`).
- **Tools:** `voyage.js` plays the system and settles, with report lines for the system, each survey, the world settled and the act's record, and a summary line over many voyages; `voyagePlan.js` (`worldScore`, `bestWorld`, `systemMove`: Decisions); `sectors.js --system`.
- **Tests:** `tests/system.test.js` (13, new), M25's voyage test and checks on every survey and settling in the fleets, the landing's in `tests/liftOff.test.js`, the system's words in `tests/sectorText.test.js`, the landing's and act 3's stub's in `tests/launchText.test.js`, 12 bad-data cases; the campaign, hunt, travel and data tests brought up to date. `raidsText` (act 1's raids on the old stub) and its test are gone with it.
- **Docs:** ROADMAP.md: M25's Done when (settled at the start), §2, §4.4 (surveys' heat, the system's hunters), §4.7 (the system), §4.8 (v19), and §9.

Decisions made along the way, not asked (each easy to change):
- **The system is a sector-shaped map,** so the chart, jumps, long jumps, the hunters' rings and the approach all work in it unchanged. A long jump goes from the top world to the bottom one.
- **The worlds aren't safe from the hunters,** and nothing past the charts sheds heat: no station, no nebula, no events, recruits or refits there. The jump into the system rolls at its way in, as into any sector.
- **The stub shows a world's numbers even if it was settled without a survey,** with a line saying so: on the ground they are known. The colony still saves whether it was surveyed.
- **Survey and Settle here are in the foot,** where Scan and Jump on would be: neither shows in the system. Settle here is in the accent color, as Jump on is; its warning is in the bad tone when the world wasn't surveyed.
- **Every world has the same mark,** in a new `world` color, with its name and kind in words beside it; dashed until surveyed, as the chart dashes what isn't made out yet.
- **Numbers are shown as numbers,** "Soil 1 · Water 0 · Ore 2 · Danger 1, each of 3."; the lanes in the data's words ("Far from any lane: hard to reach, and harder to find.").
- **The landing plays against the stars,** as the lift-off does: the ship comes in stern first on a braking burn and sets down. Each kind of world has a line for it (data).
- **The test player's judgment** (`tools/voyagePlan.js`): it scores a world as soil + water + ore + lanes − danger, a world not surveyed by its kind's averages; it surveys the nearest world not yet surveyed while the supplies cover the jumps there, the day and the way on to the best world it knows of, so a survey never strands it; then it settles the best world its supplies reach. Act 3 hasn't said what the numbers do, so the score is a guess (§9).

### Known issues

- **The hunters past the charts.** Each survey and jump there adds 2 heat and nothing sheds it, so the careful test player managing heat meets the hunters there in 9 runs of 30 (11 times), and in 10 of 30 over the whole act, against M24's 6 crossing the sectors. M24's test still holds on the sectors. Whether to cool the system is Evan's call (§9).
- **Supplies past the charts:** no station is there. Managing heat, the careful test player surveys all three worlds in 15 runs of 30, two in 10, one in 4 and none in 1. Ignoring heat, 8 runs arrive with less than a jump's supplies, and each goes hungry once there; 3 of them were fed until then, so its runs fed all the way fall from 23 of 30 to 20 (across the sectors, still 23).
- **The landing is against the stars,** not over the world: the lift-off backwards, as the Done when says (§9).
- **The worlds' numbers do nothing yet:** they are rolled, shown and saved for M26 to M29. The test player's score is a guess until then.
- **On the cover screen the stub's ship is small,** with the world's card under it.

### What to test on the phone (Galaxy Z Fold 6)

The quickest way there: play a run to the fifth sector, or ask me for a save code at the last jump point.
1. **The last sector's jump point:** Jump on says "On to the system past the charts". Does the system read as the end of the run, folded and unfolded? Can you read the worlds' names and kinds beside their marks?
2. **A survey:** tap Survey at a world, then again. Are "Soil 1 · Water 0 · Ore 2 · Danger 1, each of 3." and the lanes line clear? Is a day's supplies and 2 heat a fair price?
3. **Settle here:** two taps. Does the first tap's warning make it plain the run ends?
4. **The landing:** does the ship coming in stern first and setting down read as a landing? Try Skip.
5. **Act 3's stub:** do the run's record and the world's card fit and read well on the cover screen? Quit and reopen: Continue should say the world.
6. **Tell me:**
   - whether the system should be quieter: about 1 run in 3 meets the hunters there;
   - whether a world settled without a survey should hide its numbers until act 3;
   - whether the landing will do until the image pass (M34);
   - the Phase 4 gate (below), and the M14 to M24 questions still open.

### Next session

**Phase 4 is complete with M25: act 2 plays from launch to a world settled.** ROADMAP.md names no gate for it. A phase gate is Evan's call, so Phase 5 (M26 Settling and donated modules) starts only once this file records it. A draft for Evan: "Gate 4: from launch, a run on the phone crosses act 2 and settles a world, and Evan wants to keep going." With it passed, the next session settles M26's Done when first.

### Verified here

- `node --test`: 705 pass, in about 94 s. `node tools/validate-data.js`: OK ("5 kinds of world"). Golden files: `tests/golden/systems.txt` is new; `tests/golden/sectors.txt` was rewritten by the same tool and came out unchanged.
- **The test player, 30 voyages** (`node tools/voyage.js --runs 30`, managing heat):
  - every run crosses 5 sectors, enters the system and settles; fed all the way in 25 of 30;
  - surveys: 3 worlds in 15, 2 in 10, 1 in 4, none in 1; settled a world it surveyed in 29, the system's best (all its numbers known) in 26; by kind: ice 10, jungle 8, ocean 5, barren rock 5, desert 2; never hungry in the system;
  - the hunters: met in the system 11 times in 9 runs; over the act, 10 of 30 runs;
  - a run's report ends with the act's record as the stub says it, for example "Sectors 5 crossed; Jumps 33, 3 long; Hunters None met; Boardings None; Credits 20; …".
  - Ignoring heat (`--heat ignore`): every run settles; surveys 3 in 9, 2 in 6, 1 in 7, none in 8; 8 hungry jumps in the system; the hunters met there 17 times.
- **M25's browser check by touch:** 21 of 21 at each of 905 × 370, 821 × 283 and 960 × 825. It covers:
  - the last sector's jump point: "On to the system past the charts", the hint; Jump on in two taps ("Jump on?") reaches "The system · The Quiet Star" with Copperhill · Desert world, Second Chance · Jungle world and Ironbark · Ice world, dashed; the system's words at its way in; the hint; no Jump on or Scan; every button 48 px or more; the names clear of the chart's edge and each other;
  - Copperhill picked: "Desert world", its jump's lines and "Not surveyed: …"; a second tap jumps there; Survey and Settle here show, 48 px or more;
  - Survey in two taps ("Survey?"): supplies 24 to 21, heat 14 to 16, "Soil 1 · Water 0 · Ore 2 · Danger 1, each of 3. | Far from any lane: …", the mark solid, Survey gone;
  - a jump to Second Chance in two taps; Settle here in two taps ("Settle here?"): act 3 and the colony saved at once; the landing ("Landing · Second Chance · Jungle world"), Skip 48 px; Skip to its end, the jungle's landing words; Continue to act 3's stub: "Sectors: 5 crossed", the hunters, the boardings, and the world's card ending "Settled without a survey: …"; its buttons 48 px or more; the panels fit;
  - a quit and reopen: Continue says "Act 3 · Second Chance" and comes back to the stub;
  - a save made by main (v18) at the last jump point: Jump on goes into the system, saved as v19;
  - with reduced motion, the landing is all there at once;
  - offline, the stub draws; no console errors.
- **Act 1:** 100 test runs identical to main's, seed by seed (the campaign at launch, but for its colony, null).
- **The fights** (`node tools/sim.js`, the balance rule: `surveyHeat` is a new number, and no fight reads it): the same as M24's to the line, but for the time taken.

  ```
  1,000 fights on example ship, pirate cutter, patrol corvette, derelict hauler, con-reg repo tug, con-reg gunship. The squad (marine, engineer, medic), played by the AI, against the boarding party (pirate, pirate, brute, pirate), played by the AI. 30 rounds at most, seed "balance".

  Ship              Fights    Crew wins  Boarders win  No winner    Rounds  Crew orders
  Example ship         167  63% (56–70)           37%         0%   7 (5–9)           30
  Pirate cutter        167  47% (40–55)           37%        16%  7 (5–12)           28
  Patrol corvette      167  54% (46–61)           38%         8%  8 (5–17)           30
  Derelict hauler      167  40% (33–48)           49%        11%  7 (5–12)           27
  Con-Reg repo tug     166  41% (34–49)           43%        16%  7 (4–10)           25
  Con-Reg gunship      166  31% (25–39)           41%        28%  7 (5–12)           29
  All                1,000  46% (43–49)           41%        13%  7 (5–12)           28

  Rounds and crew orders count the fights with a winner: the median (10th to 90th percentile). Win rates have a 95% interval.

  Shots: 23,357, 23.4 a fight. Hit: crew 55%, boarders 40%.
  Shown odds  Shots  Shown  Hit
  0–19%       2,020     9%   9%
  20–39%      6,778    26%  27%
  40–59%      4,466    45%  45%
  60–79%      7,619    67%  67%
  80–100%     2,474    83%  84%
  On overwatch: 7% of shots, 27% hit. Crits: 32% of hits. Damage a hit: crew 4.5, boarders 4.5.
  A fight: 1.8 crew go down, 0.9 bleed out, 2.6 boarders die.

  1,000 fights in 37.7 s (38 ms a fight).
  ```
- **Every earlier milestone's browser check** passes, run one after another, at the three sizes unless named:
  - M24 20, M23h 16, M23g 20, M23f 28, M23e 27, M23d 25, M23c 25, M23 36, M23b 8;
  - M22 35, M21 32, M19 52, M20 32;
  - M18 43, M17 37, M16 29, M15 30;
  - M10 40 (its three sizes in one run), and M8's fights and column;
  - at 905 × 370 only: M14's saves 10, M13 24, M14 40, and M8's extras.

  Two copies were adapted, not the game, for what M25 changes on purpose:
  - M24's takes its v17 save back as v19 (it pinned v18);
  - M19's reads "On to the system past the charts" at the last jump point, where it read the end of the charts, and its walk across the act stops at that jump point, which leads on now. The first pass of the copy walked on into the system and stopped with "no route from 0 to null", a fault of the check, not the game.

  The copies that make saves the way main did in M24 open them from a checkout of the M23h merge (v17), as in M24. M14 ran 40 checks (46 in M24): its count follows the jobs its run plays.

## M24 Heat v2: hunters, regrouping, transponders (2026-10-14)

**Status:** done, and the ROADMAP.md box is ticked. Heat matters on the run now. From heat 50, Con-Reg's hunters may be waiting wherever a jump comes out, at a chance the jump shows first: the repo tug at 10%, the gunship at 35% from 75, and the gunship for certain at 100. Facing them drops heat to 40. Regroup rests a hurt crew for a day, for heat; Hide in a nebula sheds heat; and a station swaps the transponder for credits.

Some of this changes what was there before, not only adds to it:
- **A jump adds 2 heat, not 3** (a call made here, not Evan's: Decisions, below).
- **Every sector has a nebula,** in a column of its own, and empty space is rarer (weight 2, was 3). So the same seed gives a different sector from main's. `tests/golden/sectors.txt` is rewritten on purpose.
- **The heat meter on the run** names act 2's levels: Task force from 75 (where act 1's says Raid), and Cornered at 100, with Con-Reg's words for the run. At the hangar it reads as before.
- **A jump can end in a fight** from heat 50: the approach screen opens instead of the chart. An event at that node waits until the approach is put away.
- **The careful test player manages heat** (`tools/voyage.js`, the default): long jumps from heat 45 (50 before) and in place of any jump where the hunters may wait, transponder swaps, hides, and scans only below 45. Before M24 heat did nothing in act 2, so the fleets behind M19's to M23h's tests flew with no long jumps. They now fly managing heat and still pass their guards, none lowered, but the numbers in those milestones' entries are of the old player.
- **`SAVE_VERSION` 18.**
- **The Enemy ships sandbox's top row wraps** at 821 × 283, its seed buttons below the presets, and the fitted ship keeps clear of the row's real height.

No phone results have come back yet for M14 to M23h.

**How it was picked:** Evan answered four questions (2026-10-14), each the recommended answer, and a fifth once the first numbers were in:
- **Hunters:** "Chance each jump": the chart shows the odds before every jump, rolled as shown.
- **After them:** "Falls if you face them": a boarding fight with them, or their ship disabled, blown up or driven off, drops heat to 40; escaping leaves it.
- **Regroup:** "Rest and patch up": 3 hit points each for a jump's supplies and 5 heat, with the hunters' odds while the ship waits ("Rest and jury-rig" not picked).
- **Shedding heat:** "Transponder swap" and "Hiding in nebulae", both.
- **The trade** (managing heat couldn't keep the hunters to 3 runs of 30 and stay fed in 24): "At most 6 of 30", the hunters at 10% from heat 50 (20% in the first question). The others were "Keep 3 of 30, fed in 22" and "Keep 20%, at most 10 of 30".

Done when (ROADMAP.md, M24):
- **Levels:** "on the run, the heat meter names act 2's levels, each with the pursuer's words (data): calm, rumors from 25, hunters from 50, the task force from 75, and at 100 they are on the ship."
- **Hunters:** "from heat 50, wherever a jump comes out (a long jump, and the jump on into the next sector, too), Con-Reg's hunters may be waiting: 10% from 50 (`huntChance`), the task force 35% from 75 (`taskForceChance`), and certain at 100, by the heat the ship arrives with. Never at a station or in a nebula. The jump says the chance before it is made, and it is rolled as shown (Law 4) (tested)."
  - "They are an approach like a hostile ship's (§4.2), in the pursuer's ships (data: a tug, and the task force's bigger ship), and their boarding fights are against the pursuer's parties (`recovery`, `raid` in `data/encounters.json`)."
  - "A hostile ship where they wait slips away; an event there waits until they are dealt with (tested)."
- **After them:** "a boarding fight with them either way, or their ship disabled, blown up or driven off, drops heat to 40 (`heatAfterRaid`); getting away, or parting after the last round, leaves it. Lost at home, they take what a lost raid takes (Law 3) (tested)."
- **Regroup:** "away from stations, two taps. A day's rest eats a jump's supplies and heals each of the wounded 3 hit points (`regroupHp`), on top of the med bay's day. Heat rises 5 (`regroupHeat`), and the hunters may find the ship at a jump's odds. It needs the supplies for the day (tested)."
- **Nebulae:** "a kind of node, one in every sector and on the charts. The hunters never wait in one, and Regroup there hides the ship: heat falls 10 (`hideHeat`) instead of rising, with no roll (tested)."
- **Transponder swap:** "at a station, once a sector, two taps: heat falls 30 (`swapHeat`) for 40 credits (`swapPrice`) (tested)."
- **Saves:** "`SAVE_VERSION` 18 for the sector's swap and the hunters' approach. An older act 2 save opens where it was, with the swap unused (tested)."
- **The test:** "as M15's: over 30 voyages (campaign seeds 1 to 30), the test player ignoring heat (no swaps, no hiding, no long jumps) meets the hunters in at least 27; managing it (transponder swaps at stations, hiding in nebulae on its way, long jumps from heat 45 and in place of any jump where the hunters may wait), in at most 6. Managing it, the careful test player still crosses all five sectors fed in at least 24 of 30. `tools/voyage.js --heat ignore` and `--heat manage` (the default) report the hunters met and faced, the regroups, hides and swaps, and heat along the way. `tools/approach.js` and `tools/sim.js --boardings` measure the hunters' ships and parties."
- **Touch:** "every new button is 48 px or more at the three sizes. By touch: a jump that shows the hunters' chance, the hunters met and faced with heat falling to 40, a regroup, a hide in a nebula, a transponder swap, and a quit and reopen with the hunters waiting."

How each is met:
- **Levels:** `tests/hunt.test.js` (calm to cornered at 0, 24, 25, 49, 50, 74, 75, 99, 100, each with its words) and `tests/huntText.test.js` (the meter's names and words on the run; act 1's at the hangar). By touch: "Heat 58 · Hunters" and "Heat 100 · Cornered", each with Con-Reg's line in the meter's label.
- **Hunters:**
  - `tests/hunt.test.js`: none below 50, the tug at 10%, the gunship at 35% and certain at 100; none at a station or in a nebula; the way in is no refuge. Over 60 seeds a jump rolls as shown (found exactly when the roll is under the chance). A long jump from just over 50 comes out under it with no roll; Jump on comes out at the next sector's way in, where they wait too.
  - `tests/huntText.test.js`: the jump's plan says "Hunters: 10% the Con-Reg repo tug waits there.", or "The Con-Reg gunship will be waiting there.", "The hunters keep clear of stations." or "The nebula hides the ship: the hunters can't see in."; the chart rings only the nodes in reach. `tests/voyage.test.js` checks every jump in six fleets of 30 voyages managing heat, and in the fleet ignoring it, against the chance for the heat it came out with.
  - Their ships and parties: `data/ships.json` and `data/backgrounds.json`, checked by `tools/validate-campaign.js` (presets with tactics and a party). A new test in `tests/hunt.test.js`: boarded by the gunship, the fight is against its party, the task force.
  - `tests/hunt.test.js`: a cutter where they wait slips away (its node done); an event there waits ("Deal with the Con-Reg gunship first."), and opens once they are got away from and put away.
- **After them:** `tests/hunt.test.js`: faced, heat 40; got away or parted, heat as it was plus 4 if a gun fired; boarded by them and beaten, they take the armory on hand (what a lost raid takes) and heat stays 40; fought off, their gear's credits. `tests/voyage.test.js`: every faced hunt in the fleets drops heat to 40. By touch: the tug blown up, "Heat −20, to 40: Con-Reg will have to send for another crew. That buys some quiet."; the gunship got away from, "Still on your trail: heat 100."
- **Regroup:** `tests/regroup.test.js`: 3 supplies, heat +5, 3 hit points each and the med bay's day on top (with a medic, 3 + 1 + 1); at the most heat the gunship finds the ship, and the screen changes; refused at a station, with no one hurt, short of supplies, or while an event is open. By touch: two taps, 30 supplies to 27, heat 20 to 25, hit points 6/4/4 to 9/7/7.
- **Nebulae:** `tests/sector.test.js`, over 300 seeds: one in every sector, in a column of its own, named from its list, with no event or ship, and known as the ship comes into the sector (on the charts). `tools/validate-sectors.js` refuses a kind that hides and holds events or ships. `tests/regroup.test.js`: Hide sheds 10 with no roll and heals all the same, down to 0 and no further. By touch: Hide in two taps, heat 60 to 50; offline, the chart draws the nebula's mark.
- **Transponder swap:** `tests/regroup.test.js`: heat −30 for 40 credits, once a sector, the next sector's slate clean; refused away from stations, with no heat or short of credits; through the store. `tests/huntText.test.js`: its words, gone once swapped. By touch: two taps on it in the left panel, heat 58 to 28 and credits 120 to 80, the button gone after.
- **Saves:** `tests/hunt.test.js`: a v17 run gets `swapped: false`, a v17 approach under way is a hostile ship's (`hunt: false`), and a v17 save opens at v18. By touch: a save made by main (v17) at a station opens, the swap works, and it is saved as v18.
- **The test:** `tests/voyage.test.js` (M24's test): ignoring heat, the hunters in 30 of 30 runs; managing it, 6 of 30, fed all the way in 25. Both reports are below. `tools/approach.js` and `tools/sim.js --boardings` read every preset, so the hunters' rows came with the data (below).
- **Touch:** M24's browser check, below: every button on the chart, at a station and on the approach screen 48 px or more at the three sizes, and each step by touch.

### Shipped

- **Data:**
  - `balance.json`: `huntChance` 10, `taskForceChance` 35, `regroupHp` 3, `regroupHeat` 5, `hideHeat` −10, `swapHeat` −30, `swapPrice` 40; `jumpHeat` 2;
  - `ships.json`: the repo tug and the gunship, in Con-Reg's graphite and amber;
  - `backgrounds.json`: the pursuer's words for the run's levels, its two ships, and what facing them says;
  - `sectors.json`: the nebula kind and 12 nebula names, one a sector; the kinds' `charted`, `safe` and `hides` flags; empty space's weight 2.
- **Validation:** `validate-data.js` (the new numbers' ranges; `heatAfterRaid` under `huntHeat`, the task force's chance at least the hunters'), `validate-campaign.js` (the pursuer's run words and ships, each with tactics and a party), `validate-sectors.js` (the kinds' flags: a kind that hides holds no events or ships, and none is both safe and hiding), `tools/sectors.js` (the nebula's letter).
- **The sim:**
  - `heat.js` `runLevel`; `approach.js` `FACED`;
  - `hunt.js`: `huntOdds` and `rollHunt`, by the heat the ship comes out with;
  - `encounter.js` `openHunt`, the approach's `hunt`, and its end: heat to 40 when faced, no node settled;
  - `travel.js`: the plans' `hunt`, the roll at jumps, long jumps and Jump on; `run.swapped`; an event waits while an approach is open; the charts from the kinds' flags;
  - `regroup.js` (Regroup and Hide), `transponder.js` (the swap), `root.js` (`campaign/regroup`, `campaign/swap`), `runShape.js` and `save.js` (v18 and the migration from 17).
- **The chart** (`sector.js`, `sectorText.js`, `style.css`, `icons.js`, `palette.js`): the hunters' chance in a jump's plan and in Jump on's, its tone and hint; the nodes they may wait at ringed red; Regroup and Hide in the foot, two taps; the transponder swap in the left panel at stations, two taps; the nebula's mark and color; hints that say how to shed heat where the ship is.
- **The meter** (`hubText.js`): the run's levels and words. **The approach screen** (`approachText.js`): "The hunters · …", the opening hint, and what facing them did to heat.
- **The Enemy ships sandbox** (`ships/screen.js`, `style.css`): its row of presets wraps, with the seed buttons together, and the fit measures it.
- **Tools:** `voyage.js` `--heat manage|ignore` and its report (hunters met and faced, the gunship, regroups, hides, the swaps' credits, heat at its most, jumps where the hunters might wait); `voyagePlan.js`, the managing player (Decisions).
- **Tests:** `tests/hunt.test.js` (9), `tests/regroup.test.js` (5), `tests/huntText.test.js` (6), a sector test for the counted kinds, M24's voyage test and checks on every swap, regroup, hide and hunt in the fleets; the data, events, sector, sector words, travel, harness, ships, makers and refit tests brought up to date.
- **Docs:** ROADMAP.md: M24's Done when (settled at the start), §4.2 (the hunters' ships and their balance), §4.4 (act 2 as built), §4.7 (the nebula), §4.8 (v18), and §9.

Decisions made along the way, not asked (each easy to change):
- **A jump adds 2 heat, down from 3, and empty space's weight is 2, down from 3.** Both were in the setup every option of the trade was measured with, but the question named only the hunters' chance, so neither is Evan's pick. The nebula takes a node a sector, and the lower weight takes it out of empty space rather than the kinds that pay. To undo: `jumpHeat` 3 and the mix's `empty` 3 in the data, then measure again.
- **The way in is no refuge:** Jump on rolls at the next sector's way in. Only stations and nebulae are safe.
- **Heat falls as a boarding with them begins,** won or lost: Evan's pick counts "a boarding fight with them" as facing them. Beaten at home, they still take what a lost raid takes.
- **The hunters settle no node.** A hostile ship where they wait slips away and its node is done; an event waits, and its node stays open.
- **Regroup needs someone hurt, and isn't offered at a station** (Patch up is there). In a nebula, Hide can be taken with no one hurt while there is heat to lose.
- **The repo tug closes to board from round 2.** From round 1, a shield did worse against it than none in the Law 1 test: it was aboard before the shield counted. Its beam is 5 to 7 cells: narrower, 2 seeds in 100 found no layout.
- **Where the hunters may wait is the jump ring in red,** not a new mark; the nebula is a dotted violet ring (`nebula` in the palette).
- **The swap is in the left panel at a station,** under the station's kind, not in the foot. It was in the foot first, with Buy, Fill up, Repair and Patch up, and M22's check caught the hint squeezed to a column of three words at 821 × 283, the two-tap confirmation unreadable. M23h moved Refit onto the ship's panel for the same reason.
- **The test player managing heat** (`tools/voyagePlan.js`): swaps from heat 15 when the credits left would still buy half a holdful; hides from 15 with 8 jumps' supplies left after; long jumps from 45, and in place of any jump where the hunters may wait; scans only below 45; weighs an event's heat at 1.5 a point from 15, and 40 more against crossing 50; counts leaving a sector with under 4 jumps' supplies as going hungry; and never regroups. Ignoring heat, it does none of these, makes no long jumps, and regroups when the crew is down 3 hit points each.

### Known issues

- **Managing heat meets the hunters in exactly 6 of 30 on the test's seeds, Evan's limit,** and in 8 of seeds 31 to 60 (14 of 60, 23%). The Done when holds on its seeds, but the rate is nearer 1 run in 4 than 1 in 5, and a small change to the data or the test player could tip the test.
- **The gunship can only be run from.** Its shield takes 10 off each round's hits, so the start ship's one gun does 5 a hit and can't disable it in three rounds: firing at its engines and at its guns came out the same over 400 approaches. The start crew beats its party 9% of the time at home and 14% aboard her. The careful test player never meets it on seeds 1 to 30, but at heat 100 it waits at every node but stations and nebulae.
- **Ignoring heat costs a lot, but never ends a run** (Law 5): 8 hunters a run at the median, a boarding lost at home in every run, fed in 23 of 30 against 25.
- **The test player managing heat never regroups,** by its rule, so the voyages don't measure what Regroup is worth to a careful player (§9).
- **`node --test` takes about 95 s here, up from 70:** the fleets managing and ignoring heat.
- **The earlier milestones' voyage numbers,** in their entries and in ROADMAP.md §4.6, are of the test player before it managed heat.

### What to test on the phone (Galaxy Z Fold 6)

1. **Heat 50 or more on the run:** are the red rings clear, folded and unfolded? Does the jump's "Hunters: 10% …" line catch your eye before the second tap?
2. **Meeting them:** does the approach screen make it clear who they are and that facing them buys quiet? Face them, by firing or boarding, and check that the end says heat fell to 40.
3. **Regroup** with the crew hurt, away from a station, and **Hide** in the nebula (the dotted violet ring): are the words right? Is 5 heat for 3 hit points each a trade you would take?
4. **A station at heat 50 or more:** "Transponder · 40" is in the left panel, under the station's name. Easy to find there? Is it worth 40?
5. **Heat 75 and 100:** do Task force and Cornered, and the gunship, feel like the end of the line?
6. **Tell me:**
   - whether careful play meeting the hunters in about 1 run in 4 is right, or 10% should come down;
   - whether a jump should go back to +3;
   - whether a refitted ship should be able to beat the gunship;
   - and the M14 to M23h questions still open.

### Next session

**M25 Scouting candidate worlds.** Settle its Done when first. The draft is "a run reaches the last sector, scouts its worlds and picks one, ending act 2 cleanly."

### Verified here

- `node --test`: 688 pass, in about 95 s. `node tools/validate-data.js`: OK. Golden files changed on purpose: `tests/golden/ships.txt` (the repo tug's and the gunship's ships added, nothing else changed) and `tests/golden/sectors.txt` (rewritten: a nebula in every sector, empty space rarer).
- **M24's browser check by touch:** 20 of 20 at each of 905 × 370, 821 × 283 and 960 × 825. It covers:
  - open space at heat 58, the crew hurt: "Heat 58 · Hunters" with Con-Reg's line; the derelict a jump away ringed red, the station a jump away not, nothing out of reach; Regroup; the hint; every button 48 px or more; a jump picked says "Hunters: 10% the Con-Reg repo tug waits there.";
  - Regroup at heat 20 in two taps: supplies 30 to 27, heat 20 to 25, hit points 6/4/4 to 9/7/7;
  - Hide in the nebula at heat 60 in two taps: heat 50, no hunters;
  - the swap, in the left panel at a station at heat 58, in two taps: heat 28, credits 120 to 80, the button gone after; the station's buttons 48 px or more;
  - at heat 98 the jump says "The Con-Reg gunship will be waiting there." in the bad tone; the second tap opens "The hunters · Con-Reg gunship" at "Heat 100 · Cornered", with the opening hint; the approach's buttons 48 px or more;
  - a quit and reopen: the hunters still waiting;
  - fleeing the gunship: got away, "Still on your trail: heat 100.";
  - at heat 58, on dice that bring the tug: the jump said 10%, and firing at its reactor twice blows it apart: "Heat −20, to 40: …"; Carry on, back on the chart at "Heat 40 · Rumors";
  - a save made by main (v17) at a station: the swap works, saved as v18;
  - offline, the chart draws the nebula's mark and Hide; no console errors.
- **Every earlier milestone's browser check** passes, run one after another, at the three sizes unless named:
  - M23h 16, M23g 20, M23f 28, M23e 27, M23d 25, M23c 25, M23 36, M23b 8;
  - M22 35, M21 32, M19 52, M20 32;
  - M18 43, M17 37, M16 29, M15 30;
  - M10 40 (its three sizes in one run), and M8's fights and column;
  - at 905 × 370 only: M14's saves 10, M13 24, M14 46, and M8's extras.

  Five copies were adapted, not the game, for what M24 changes on purpose:
  - M23h's and M23g's open a save made by main from a new checkout of main (M23h's code, v17) and take it back as v17 or later;
  - M23f's takes a v16 save back as v17 or later;
  - M19's reads a jump's heat from the data;
  - M17's reads "Task force" on the run's meter at heat 80.

  The first pass also caught two problems in the game, both fixed:
  - the swap in the station's foot squeezed the hint unreadable at 821 × 283 (Decisions, above);
  - the Enemy ships sandbox's two new presets pushed its next-seed button under DEV at 821 × 283, so M23d's check timed out. The row wraps now.

  After the fixes, every check that opens the chart or the sandbox ran again at the three sizes and passed. M23f's lift-off step failed once at 960 × 825 while voyages ran beside it, and passed alone. M14 ran 46 checks (53 in M23h): its count follows the jobs its run plays.
- **Act 1** (`tools/run.js`, 100 test runs): identical to main's, seed by seed, campaign and log.
- **The fights** (`node tools/sim.js`, the balance rule):

  ```
  1,000 fights on example ship, pirate cutter, patrol corvette, derelict hauler, con-reg repo tug, con-reg gunship. The squad (marine, engineer, medic), played by the AI, against the boarding party (pirate, pirate, brute, pirate), played by the AI. 30 rounds at most, seed "balance".

  Ship              Fights    Crew wins  Boarders win  No winner    Rounds  Crew orders
  Example ship         167  63% (56–70)           37%         0%   7 (5–9)           30
  Pirate cutter        167  47% (40–55)           37%        16%  7 (5–12)           28
  Patrol corvette      167  54% (46–61)           38%         8%  8 (5–17)           30
  Derelict hauler      167  40% (33–48)           49%        11%  7 (5–12)           27
  Con-Reg repo tug     166  41% (34–49)           43%        16%  7 (4–10)           25
  Con-Reg gunship      166  31% (25–39)           41%        28%  7 (5–12)           29
  All                1,000  46% (43–49)           41%        13%  7 (5–12)           28

  Rounds and crew orders count the fights with a winner: the median (10th to 90th percentile). Win rates have a 95% interval.

  Shots: 23,357, 23.4 a fight. Hit: crew 55%, boarders 40%.
  Shown odds  Shots  Shown  Hit
  0–19%       2,020     9%   9%
  20–39%      6,778    26%  27%
  40–59%      4,466    45%  45%
  60–79%      7,619    67%  67%
  80–100%     2,474    83%  84%
  On overwatch: 7% of shots, 27% hit. Crits: 32% of hits. Damage a hit: crew 4.5, boarders 4.5.
  A fight: 1.8 crew go down, 0.9 bleed out, 2.6 boarders die.

  1,000 fights in 40.8 s (41 ms a fight).
  ```

  Each preset is a row of its own, so the hunters' two came with the data, and the 1,000 fights are split six ways.
- **The hunters' ships** (`tools/approach.js`, 300 a row; score is wins less losses in every 100):

  | Ship | Against | Got away | Boarded her | Boarded by her | Blew her up | Parted | Score |
  | --- | --- | --- | --- | --- | --- | --- | --- |
  | start | repo tug | 64% | 0% | 20% | 0% | 16% | −20 |
  | start | gunship | 65% | 0% | 13% | 0% | 22% | −13 |
  | + weapon mount | repo tug | 47% | 19% | 14% | 10% | 9% | +15 |
  | + weapon mount | gunship | 67% | 0% | 9% | 0% | 23% | −9 |
  | + cannon | repo tug | 45% | 30% | 10% | 11% | 5% | +31 |
  | + heavy engine | gunship | 90% | 0% | 1% | 0% | 9% | −1 |

  Boarding fights (`tools/sim.js --boardings`, 125 a row, the start crew at full health): against the tug's party 38% won at home and 46% aboard her; against the gunship's, 9% and 14%. The cutter's, for comparison: 52% and 42%.
- **The voyages** (`tools/voyage.js`, from M16's launches):

  | | Seeds | Hunters met (runs) | Hunters a run | Fed all the way | Heat at most | Swaps a run | Days hidden | Long jumps |
  | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  | Managing heat | 1 to 30 | 6 | 0 (0 to 2) | 25 | 51 (47 to 80) | 1 (0 to 4) | 1 (0 to 7) | 3 (1 to 6) |
  | Managing, no refits | 1 to 30 | 6 | 0 (0 to 2) | 24 | 50 (44 to 80) | 2 (0 to 4) | 0 (0 to 1) | 2 (0 to 5) |
  | Ignoring heat | 1 to 30 | 30 | 8 (3 to 13) | 23 | 100 (84 to 100) | 0 | 0 | 0 |
  | Managing heat | 1 to 60 | 14 | 0 (0 to 5) | 48 | 53 (46 to 100) | 1 (0 to 4) | 1 (0 to 7) | 3 (0 to 6) |
  | Ignoring heat | 1 to 60 | 60 | 7 (3 to 14) | 43 | 100 (84 to 100) | 0 | 0 | 0 |

  Ignoring heat, it regroups 7 times a run (2 to 16), healing 59 hit points, and loses 77 hit points in fights; managing it, 0 in fights at the median (0 to 49).
- **Frame rate:** no new 3D view. The approach screen draws the hunters' ships as it draws any other.

## M23h Refits at stations (2026-10-14)

**Status:** done, and the ROADMAP.md box is ticked. At a station the ship's panel on the sector map is Refit: construction mode on the ship with the parts on hand, found at nodes, stripped in boardings or left from act 1. A refit is free. A part an approach wrecked stays on until the station repairs it, and the ship can't jump from a station while a flight check fails.

Some of this changes what was there before, not only adds to it:
- **The ship's panel on the sector map is a button at stations,** as the crew's is: "Ship · Refit ›".
- **A jump can be refused for the ship's sake:** from a station, while a flight check fails, it reads "Can't leave" in the bad tone, with the check named. Only a refit changes the ship, so a ship that hasn't refitted never sees it.
- **Supplies can stay behind:** after a refit takes a hold off, what the holds no longer take is left at the next jump, which says so before it is made. Nothing is lost at the refit itself, so putting the hold back keeps them.
- **The careful test player refits at stations** (`tools/voyage.js`, `--refit no` to skip). The fleets flown for M19 to M23e's Law 1 tests keep flying as fitted, with no refits, so each still compares one part's difference.
- **A fixture was found flying a ship that fails its flight checklist:** M23e's surgery voyages fitted surgery to the start ship with 1 power spare, leaving it at −1. It flies with a small reactor now, and `voyage()` refuses a fitted ship that fails a check.
- **`tools/run.js` fitPart weighs a spot before building it:** the same choices (act 1's 100 test runs, and 30 careful voyages without refits, come out the same as main's seed by seed, campaign and log), and `node --test` takes about 70 s here, down from 1 min 45 s.

No phone results have come back yet for M14 to M23g.

**How it was picked:** Evan answered three questions (2026-10-14), each the recommended answer:
- **Parts:** "What's found": refit with parts found, stripped or left from act 1. A parts dealer at stations goes to §9 (it needs a save bump for what has been bought).
- **Wrecks:** "Repair first": a wrecked part moves with its damage, but comes off only once repaired.
- **Cost:** "Free".

Done when (ROADMAP.md, M23h):
- **At a station:** "Refit, at a station on the run, opens construction mode on the ship with the parts on hand: found at nodes, stripped in boardings, or left from act 1. Each change is saved at once, as at the hangar, and Look works there too. Map goes back to the chart. Away from a station there is no Refit, and the sim refuses one (tested)."
- **Free:** "a refit costs no credits, supplies or heat, and the ship's parts and the parts on hand add up to the same before and after (tested)."
- **Wrecks:** "a wrecked part is marked on the plans, and its card says so. It moves and turns with its damage, but comes off only once the station has repaired it; the sim refuses a refit that would drop one (tested)."
- **No leaving broken:** "while a flight check fails, the ship can't jump from the station (a jump, a long jump or Jump on), and the chart says which check fails and that Refit fixes it (tested). Supplies past what the holds take after a refit stay behind at the next jump, and the jump says so before it is made (tested)."
- **Hints:** "at a station with parts on hand, the chart says how many and that Refit fits them."
- **The test player:** "the careful test player (`tools/voyage.js`) refits at stations with what it has on hand, keeping each part only while every flight check still passes, and still crosses all five sectors fed in at least 24 of 30. Its report says what it fitted, and how the same seeds go without refits."
- **Saves:** "no version change: a refit changes only the ship and the parts on hand. An act 2 save made by main opens and refits at a station (tested)."
- **The hangar:** "act 1's construction mode works as before."
- **Touch:** "every new button is 48 px or more at the three sizes. By touch: a found part fitted at a station in two taps, a jump refused while a check fails and allowed once it is fixed, a wrecked part kept on, and a quit and reopen that keeps the refit."

How each is met:
- **At a station:** `tests/refit.test.js`: a cargo hold found fitted at a station; refused at the way in, a node a jump away, in a fight, in act 3, and through the reducer without the rules. By touch, below: Refit opens construction mode with the parts on hand, Look paints the hull, Map goes back, and away from the station the panel reads plain "Ship". Jump on can't be reached from a station (the jump point is never one), but `leavePlan` refuses too (tested, with a made-up sector whose exit is a station).
- **Free:** `tests/refit.test.js`: credits, supplies, heat and flags unchanged, and `stockOf` the same before and after; a part taken off goes back on hand. By touch: a cargo hold in two taps, 140 credits, 30 supplies and heat 30 before and after.
- **Wrecks:**
  - `tests/refit.test.js`: the sim refuses a refit that takes a wrecked gun off or swaps it for another type; the builder's Delete leaves it on with "The Weapon mount is wrecked: it comes off once the station repairs it. It can still move."; moved, it keeps its uid, so its fire is on the boarding map where it went.
  - `tests/scene.test.js`: crossed out in the wreck styles, at the top of its walls, labelled "Weapon mount · wrecked" in the bad tone when picked. `tests/builderText.test.js`: its card's line.
  - By touch: picked, Delete refused, and the card.
- **No leaving broken:**
  - `tests/refit.test.js`: the reactor taken off, a jump and a long jump refused with "The ship can't leave until every flight check passes: power −7 (0 made, 7 used). Refit to fix it."; put back, it jumps; away from a station nothing holds it.
  - Supplies: a cargo hold fitted and filled (50), then taken off: the refit keeps 50, the jump leaves 20 behind first (`flags.suppliesLeft`) and eats from the 30.
  - `tests/sectorText.test.js`: the hint, the panel's line, "Can't leave" in the bad tone; the hold row "50 of 30, 20 won't fit", the warning, and the jump's "20 supplies stay behind: the holds take 30."
  - By touch: the reactor off, back on the map the hint and the jump picked say so, Jump is disabled and a second tap on the node stays put; Undo in Refit puts the reactor back and the ship jumps in two taps.
- **Hints:** the station's panel always says "4 parts on hand: Refit fits them, free." (by touch, and `tests/sectorText.test.js`); the foot's hint says it too once nothing more pressing is there (repairs, a medic, supplies to buy, recruits).
- **The test player:** `tests/voyage.test.js`, 30 careful voyages refitting: fed all the way in 26; 25 runs fit something; every refit step takes the parts off the parts on hand and onto the ship for nothing, every flight check passing after. The report, below.
- **Saves:** `SAVE_VERSION` stays 17. `tests/refit.test.js` saves an act 2 campaign and refits it after loading. By touch: a save made by main at a station opens and a med bay goes on in two taps.
- **The hangar:** M13's, M14's, M16's, M17's and M23f's browser checks pass (below); the builder's first-run tips stay act 1's (`tests/tips.test.js`).
- **Touch:** the chart's buttons and construction mode's, 48 px or more at the three sizes (the ship's panel is 183 × 102 at 905 × 370, 165 × 77 at 821 × 283 and 195 × 102 at 960 × 825).

### Shipped

- **The sim:**
  - `acts.js` `atStation`;
  - `campaign.js` `refitShip(campaign, ship, rules)`: at the hangar or a station, every wrecked part kept as the same part; `canRefit`, `wreckedUids`;
  - `session.js`: a session's `wrecked` uids, which Delete leaves on;
  - `travel.js`: `failingCheck` holds a jump from a station; `suppliesOver` and the plans' `left`, left behind before a jump eats; the flags count `suppliesLeft`;
  - `root.js`: `campaign/ship` takes the rules.
- **The chart** (`sector.js`, `sectorText.js`, `style.css`): the ship's panel as Refit at stations, lit, or in the bad tone while a check fails; the station's panel line; "Can't leave"; the supplies left behind, in the hold row, the hint and the jump.
- **Construction mode on the run** (`construction.js`, `view.js`, `hints.js`, `drawer.js`, `card.js`): Map, "Ready to jump", the wrecked parts passed to the session and marked (`shipScene.js` `wreckMark`, the wreck styles in `blueprintStyles.js`), and the card's line. The builder's tips are act 1's (`tipSteps.js`).
- **Tools:** `voyagePlan.js` `refitAt` and `refitPicks`; `voyage.js` `--refit`, the refit step and its report; `run.js` fitPart's weighing.
- **Docs:** ROADMAP.md: M23h's Done when, §4.1 (refits on the run), §4.6 (the measurements), §4.8 (no save bump), four ideas in §9 and the test suite's time.

Decisions made along the way, not asked (each easy to change):
- **Refit is the ship's panel, not a button in the foot.** At a station the foot holds Buy, Repair, Patch up and Scan, and at 821 × 283 a fifth button would leave the hint no room. The crew's panel already opens the crew card this way.
- **Refit opens in one tap:** opening construction mode changes nothing; every change in it is a ghost first and a second tap.
- **Supplies stay behind at the next jump, not at the refit:** each change in construction mode is saved at once, so taking a hold off and putting it back would otherwise lose supplies.
- **Only a station holds the ship:** a failing check stops a jump only at a station, where a refit can fix it. Only refits change the ship, so a check can't fail anywhere else; a data change that made one fail away from a station would strand nobody.
- **The careful test player fits what feeds, heals, houses, guards, arms or drives the ship,** in that order: holds, then crew parts, then shields, guns and engines, the dearest first in each, a reactor on hand only to power one. Never a bridge, corridors, airlocks, armories or a second healer that heals no more.
- **The station's hint names refits last,** after repairs, the medic, supplies and recruits: the station's panel always says it, and spare corridors would otherwise nag at every station.
- **The ship's panel doesn't list the parts on hand.** A first try added a row, and M19's check caught it: at 821 × 283 a third row doesn't fit under the crew. The station's line says how many are on hand, and Refit's drawer what they are.

### Known issues

- **The refitting test player ends a voyage a little more hurt:** median crew at the end 24 hit points over 60 voyages, against 26 without refits. It keeps a holdful's price back before patching, and a bigger hold keeps more back, so it patches 9 at the median against 12. That is the test player's rule, not the game's.
- **Refit opens with nothing on hand,** for moving, turning and the Look; the station's line says "Refit moves and turns the ship's parts, free."
- **A wrecked part's cross is small on a one-cell part** (a gun, a point defense turret): half a cell across. Its label and the notice say it when it is picked.
- **The test suite's voyages ran a ship with −1 power from M23e until now** (surgery, above). Its measurements in M23e's entry are of that ship.

### What to test on the phone (Galaxy Z Fold 6)

1. **A station with parts on hand:** is "Ship · Refit ›" easy to find, folded and unfolded? Does the station's line read clearly?
2. **Refit:** fit a found part in two taps, then tap Map. Does going back and forth feel right?
3. **A wrecked part:** after an approach that wrecks something, refit at a station. Do the cross and the label read? Is "Repair first" right, or would you rather scrap it (§9)?
4. **Breaking the ship:** take the reactor off and tap Map. Is the red "Can't leave" clear about what to do?
5. **A cargo hold off with full holds:** do the warnings make sense before the jump?
6. **Tell me:**
   - whether refits should cost something after all (a fee, or heat);
   - whether a parts dealer at stations should come sooner;
   - and the M14 to M23g questions still open.

### Next session

**M24 Heat v2: hunters, regrouping, transponders.** Settle its Done when first. The draft is "as in M15, ignoring heat brings the hunters, and managing it keeps them off."

### Verified here

- `node --test`: 666 pass, in about 70 s. `node tools/validate-data.js`: OK. No golden file changed.
- **M23h's browser check by touch:** 16 of 16 at each of 905 × 370, 821 × 283 and 960 × 825. It covers:
  - the station: "Ship · Refit", "4 parts on hand: Refit fits them, free.", the ship's rows as before, every button 48 px or more;
  - Refit: the parts on hand (Med bay ×1, Cargo hold ×1, Corridor ×2), Map, "12/40 parts · Ready to jump";
  - a cargo hold in two taps, saved for nothing;
  - the wrecked gun: picked, Delete refused with its notice, its card;
  - Look: rust paint in a tap, no parts taken;
  - the reactor off: the hint, the panel in the bad tone, "Can't leave", Jump disabled, a second tap stays put;
  - Undo in a second visit puts the reactor back, and the ship jumps in two taps; away from the station, no Refit;
  - a quit and reopen keeps the hold and the paint;
  - a save made by main at a station refits;
  - offline, Refit opens and draws; no console errors.
- **Every earlier milestone's browser check** passes, run one after another, at the three sizes unless named:
  - M23g 20, M23f 28, M23e 27, M23d 25, M23c 25, M23 36, M23b 8;
  - M22 35, M21 32, M19 52, M20 32;
  - M18 43, M17 37, M16 29, M15 30;
  - M8's fights and column;
  - at 905 × 370 only: M14's saves 10, M13 24, M14 53, and M8's extras.

  Three copies were adapted, not the game: M23g's, M23e's and M17's built their campaigns with `refitShip`, which takes the rules now, so their refits were refused and the checks went wrong from the start. M19's caught the Parts row (Decisions, above); on the final code it passes, and M20's to M23's ran again at the three sizes and pass. M19's at 905 × 370 timed out once while the test suite ran beside it, and passed 52 of 52 run alone. M14 ran 53 checks (47 in M23g): its count follows the jobs its run plays.
- **Act 1** (`tools/run.js --runs 100`): the same as main's, seed by seed (each run's campaign and log): 100 ready, 6 jobs at the median (3 to 15), 641 in all, 27 quick minutes (12 to 58), 44 slow (21 to 93). The careful voyage without refits is the same as main's too, seed by seed over 30.
- **The careful voyage** (`tools/voyage.js --long never`), the same seeds with and without refits:

  | | Fed, 30 seeds | Fed, 60 seeds | Runs with a refit (60) | Parts fitted (60, median) | Patched (60, median) | Crew at the end (60, median) | Supplies bought (60, median) |
  | --- | --- | --- | --- | --- | --- | --- | --- |
  | No refits | 26 | 46 | 0 | 0 | 12 | 26 | 82 |
  | Refits | 26 | 50 | 52 | 1 (0 to 7) | 9 | 24 | 90 |

  Fitted over the 60: cargo hold 30, large hold 15, med bay 10, engine 7, light engine 7, weapon mount 7, point defense 6, bunks 5, small reactor 3, Bastion weapon mount 2, life support 1, shield generator 1. With long jumps from heat 50 (30 seeds): fed in 24 refitting, 23 without.
- **Frame rate** (fps while a finger circles: lowest / middle of the half-second windows), main against this branch in the same runs:

  | View | 905 × 370 | 960 × 825 | 905 × 370, CPU 4× slower (two runs) |
  | --- | --- | --- | --- |
  | Builder plans, the example ship (main) | 58 / 60 | 36 / 44 | 21 / 24, 23 / 28 |
  | Builder plans, the example ship (here) | 60 / 60 | 45 / 48 | 19 / 21, 22 / 24 |
  | Construction mode at the hangar (main) | 58 / 60 | 46 / 48 | 24 / 26, 22 / 26 |
  | Construction mode at the hangar (here) | 60 / 60 | 44 / 49 | 21 / 25, 23 / 25 |
  | Refit at a station, the gun wrecked (here) | 58 / 60 | 40 / 45 | 18 / 27, 24 / 25 |

  This container runs the same code slower than M23g's did (main's builder plans at 960 × 825 read 36 / 44 here, 60 / 60 in M23g's runs), so only main against this branch in the same run counts: they are level, and the station's plans with a wreck crossed out run as the hangar's do.

## M23g A second manufacturer (2026-10-14)

**Status:** done, and the ROADMAP.md box is ticked. Bastion Arms makes a version of every part: tough and heavy, on the Yard part's footprint, interior and fittings. Its parts are amber on the plans and in the drawer, and outside they wear gunmetal fittings, orange hazard chevrons and orange flames under the ship's own paint. The patrol's corvettes fly them.

Some of this changes what was there before, not only adds to it:
- **The Parts tab has twice the parts.** Each part has its Bastion version beside it, so All lists 42. The category sheet's first row picks a maker: any, Yard or Bastion.
- **Act 1's goal and the shop count either maker's part.** A Bastion engine on hand is an engine to the goal, the shop's "Needed for launch" line and the Ship tab's fix button. The fix arms whichever maker's part is on hand.
- **Saves and codes keep their versions** (17 and 4). A maker's version is a part of its own (`bastion-engine`), and both name parts by id. Every older ship's parts are the Yard's.
- **The patrol's corvettes are tougher and heavier.** Each part rolls Bastion's version four times in five, keeping it only while the ship still passes its flight checklist: 73% of their parts are Bastion's over 100 ships. The golden ships file names them, and the layouts are unchanged. A corvette takes about 4 ms longer to generate (27.5 ms against 23.1 on main, on this machine).
- **Dutch's yard and the drops carry Bastion's parts,** with act 1 and the voyage as before (Verified).

No phone results have come back yet for M14 to M23f.

**How it was picked:** mockups drawn by the game's renderer from a scratch copy:
- three candidate makers outside on the start ship: Kestrel Dynamics (light), Bastion Arms (tough) and Scrapline (cheap);
- four ways to show a maker on the plans: its rooms in its color, its floors tinted, an emblem in each room, its floors hatched;
- the drawer in the real builder at 821 × 283;
- each maker on the paint nearest its colors.

Evan took the recommended answer each time: "Bastion Arms", "Rooms in its color" and, for the enemy ships, "The side that fits it".

Done when (ROADMAP.md, M23g):
- **Data:** "Bastion Arms is in `data/manufacturers.json`, and every part, M23e's included, has a Bastion version in `data/modules.json` on its Yard part's footprint, interior, fittings and icon, with more hit points and more mass. None is worse than another part in every way (M23e's test)."
- **Law 1:** "`tools/approach.js` shows the start ship with Bastion's parts faring differently against the hostile presets than with the Yard's: losing fewer parts to their volleys, and evading less. Its mass counts in thrust for mass, lift-off included."
- **At a glance:** "on the plans and in the drawer, Bastion's rooms and icons are amber; outside, its parts' fittings, marks and flames are its own wherever ships are drawn: the Hull view, the hangar, the lift-off and the Enemy ships sandbox."
- **The drawer:** "each part's Bastion version sits beside it; the category sheet picks a maker; construction mode shows the parts on hand of either maker; every button is 48 px or more at the three sizes."
- **Where they come from:** "the shop sells both makers, and the drop tables carry Bastion's, with act 1 running as before (`tools/run.js`); act 1's goal and the shop's "needed" lines count either maker's part."
- **Enemy ships:** "the patrol's corvettes carry Bastion's parts for most of theirs, rolled from the ship's seed. Their layouts and boarding maps are unchanged (the golden ships file is updated on purpose, for the part names)."
- **Saves and codes:** "old saves and blueprint codes load with the Yard's parts, and neither version number changes (tested)."
- **Voyage:** "the careful test player still crosses all five sectors fed in at least 24 of 30."
- **Budget:** "the hull views keep to the frame budget."

How each is met:
- **Data:** `tests/makers.test.js`:
  - every part has a Bastion version with its base part's shape (size, turns, what faces space, tags, interior, category, glyph and what it does in an approach), more hit points and more mass, the same power, thrust, berths, life support and cargo, and no lower price;
  - a version takes its base's fields and lays its own stats over them.

  `tests/catalog.test.js` runs M23e's "worse in every way" check over all 42 parts. `tests/scene.test.js` gives each version its base's fittings and icon. The validator checks versions and makers.
- **Law 1:** `tools/approach.js` now also flies the launched start ship with every part Bastion's (`start bastion`), with two new columns: the player's parts wrecked per approach and the ship's evasion. Results are in the table under Verified. `tests/approach.test.js` asserts the same over 120 approaches each:
  - Bastion's ship evades less against every preset;
  - it loses half the parts or fewer to some preset;
  - its outcomes differ by a tenth or more against some preset.

  `tests/makers.test.js`: the start ship made by Bastion can't lift off ("Thrust 36 for mass 43: 0.84, needs 1.00 to lift off"), and its fix asks for an engine.
- **At a glance:**
  - `tests/scene.test.js`: a Bastion engine's room, fittings and nozzles are drawn in Bastion's amber styles on the plans, the rest in the blueprint's blue, with each maker's copy drawn right after its own style; every icon is in its maker's line.
  - `tests/exterior.test.js`: a Bastion part's fittings, chevrons and flames are Bastion's, at rest and in the lift-off; the hull keeps the ship's paint.
  - By touch, below: the plans, the Hull view and the Enemy ships sandbox. The hangar and the lift-off draw through the same scene, and the frame-rate runs played the lift-off with Bastion's engines without an error.
- **The drawer:**
  - `tests/catalog.test.js`: the order, a maker's filter and its counts, and construction mode's parts on hand of either maker.
  - By touch at the three sizes, below.
- **Where they come from:**
  - Dutch's yard stocks six of Bastion's parts: its engine (weight 2), reactor, gun, shield, cannon and armory;
  - the picket job drops Bastion's gun and shield;
  - act 2's salvage table has Bastion's armory, shield and gun;
  - boarding a corvette strips its parts, mostly Bastion's.

  Act 1 and the voyage are measured under Verified. `tests/makers.test.js` covers the goal lines, the shop's needed line and offer, and the buy hint.
- **Enemy ships:** `tests/makers.test.js`, over 40 corvettes:
  - the same seed gives the same makers;
  - with the makers taken out, the same parts are in the same places, with the same styling, hull and wrecks;
  - a part and its mirror image are one maker's;
  - between 65% and 95% of the parts are Bastion's;
  - cutters and haulers stay the Yard's.

  The golden ships file is the same once the `bastion-` prefix is dropped: 56 part names changed.
- **Saves and codes:** `tests/makers.test.js`:
  - `SAVE_VERSION` is still 17 and codes still version 4;
  - the example ship's code as main made it opens with the Yard's parts;
  - a ship with Bastion's parts round-trips through a code;
  - a campaign with them fitted and on hand saves and loads.

  By touch: a save and a code made by main open.
- **Voyage:** `tests/voyage.test.js` passes: 26 of 30 careful runs cross fed (main: 25).
- **Budget:** frame rates under Verified.

### Shipped

- **Data:**
  - `data/manufacturers.json`: Bastion Arms (`short`, `blurb`, `mark: chevrons`);
  - `data/modules.json`: 21 versions (`base`, `manufacturer`, `name`, `stats` of mass and hit points, `cost`):

    | Rule | Bastion's |
    | --- | --- |
    | Hit points | half again (engine 15 to 23, reactor 30 to 45) |
    | Mass | a quarter more, at least 1 (engine 3 to 4, reactor 6 to 8, corridor 1 to 2) |
    | Price | a tenth more, to the nearest 5 (engine 200 to 220; corridor 10, unchanged) |

- **The sim:**
  - `defs.js` `withBases` fills each version in from its base part;
  - `src/sim/makers.js` (`baseOf`, `versionsOf`, `countOfAny`, `versionAtHand`, `versionBy`) is how the goal, the shop, the fix buttons, the tips and the test players count either maker's part;
  - `gen/ship.js` `makersOf` rolls a preset's makers on a stream of its own, mirrored pairs alike, keeping each version only while the ship still passes its flight checklist (`makers` in `data/ships.json`: the corvette's `bastion: 80`).
- **Drawing:**
  - `palette.js`: Bastion's skin, with its fittings (`FITTINGS`, `fittingsOf`) and its line on the plans (`planLine`);
  - `exterior.js`: each part's fittings in its maker's kit, the chevrons (`MARKS`), and the nozzles, barrels and collars of a part in its kit, found by the cell they stand on; each exhaust carries its flame's color into the lift-off;
  - `blueprintStyles.js`: a copy of the room styles for each maker with a line of its own, drawn right after the style it copies; `shipScene.js` restyles a maker's rooms and greebles;
  - `parts/blueprint.js`: icons in the maker's line;
  - `props.js` and the roofs look a version's drawing up by its base.
- **The builder:**
  - `catalog.js`: the order and the maker filter;
  - `palette.js` (ui): the maker row and the picker's second line;
  - `card.js`: a version's card adds its maker's line and "Next to the Yard's: …";
  - `view.js`: fixes arm the version on hand.
- **Tools:**
  - `tools/approach.js`: the `start bastion` row, and the Wrecked and Evasion columns;
  - `tools/run.js`: the act 1 test player takes either maker's part;
  - the validator checks versions, makers and presets' `makers`.
- **Docs:**
  - ROADMAP.md §4.1 (versions, Manufacturers, the drawer, the hull's skin), §4.8 (no save bump), M23g's box, five ideas in §9;
  - CLAUDE.md's content and layout lists.

Decisions made along the way, not asked (each easy to change):
- **A maker's version is a part of its own** (`bastion-engine`), not a maker field on each placed part. No save or code bump was needed, and a third maker is data plus a skin.
- **Outside, a maker's colors go on its parts' fittings, marks and flames;** the roof plating keeps the ship's paint, so painting a ship still works.
- **The sheet keeps open after a maker is picked,** so a maker and a category take one trip.
- **Bastion's numbers:** hit points ×1.5, mass ×1.25 (at least +1), price ×1.1. Bastion's corridor costs the same as the Yard's (10).
- **No Bastion engine in act 1's job drops.** A Bastion engine dropped by the scrap job and fitted cost the careful player about one fed voyage in 15 (42 of 60 against 46 without it), from its mass. The shop's Bastion engine (weight 2 against the Yard's 9) costs nothing measurable.

### Known issues

- **The all-Bastion start ship scores lower in the approach** than the Yard's against both presets (−20 against −11 versus the cutter; −18 against −16 versus the corvette). It wrecks far less against the cutter but evades less. The harness's score counts only boardings, not repair bills or a boarding map's wrecked rooms, so it undersells hit points.
- **Against the corvette, Bastion's start ship loses as many parts as the Yard's** (0.96 an approach against 0.93), while evading less (21 against 30). Both face the same corvettes, mostly Bastion's now.
- **Paint can hide Bastion:** on graphite its gunmetal fittings fade; the chevrons and orange flames still show.
- **Inside, on a boarding map,** every part is drawn in the Yard's skin (§9).
- **A placed part's maker can't be swapped in place** (§9).
- **The test suite takes about 1 min 45 s here.**

### What to test on the phone (Galaxy Z Fold 6)

1. **The Parts tab** in the dev Builder: scroll All. Does each Bastion part read at a glance beside the Yard's?
2. **The maker row:** open the category sheet, tap Bastion, then Engines. Is the picker's second line clear enough, folded and unfolded?
3. **Place a Bastion engine and long-press it:** is the "Next to the Yard's" line useful?
4. **Plans and outside:** do the amber rooms read against the blue on the cover screen? Do the chevrons and orange flames read outside, on a few paints?
5. **The Enemy ships sandbox:** step through corvettes. Do they look like the patrol's?
6. **A campaign:** buy or find a Bastion part. Does the goal count it, and does the Ship tab's fix pick it?
7. **Tell me:**
   - whether Bastion's trade (tougher, heavier, dearer) feels worth it;
   - whether the patrol should be tougher still, or less;
   - and the M14 to M23f questions still open.

### Next session

**M23h Refits at stations.** Settle its Done when first. The draft is "at a station, construction mode opens with the parts on hand, so parts found, stripped or bought can be fitted; the ship can't jump while its flight checklist fails."

### Verified here

- `node --test`: 653 pass. `node tools/validate-data.js`: OK (42 modules, 2 manufacturers). The golden maps and battle logs didn't change; the golden ships file did, on purpose: 56 part names on the corvettes, the same layouts.
- **M23g's browser check by touch:** 20 of 20 at each of 905 × 370, 821 × 283 and 960 × 825. It covers:
  - the Parts tab: 42 tiles, each Bastion version beside its part, its icon in amber;
  - the maker row: Any 42, Yard 21, Bastion 21; a maker keeps the sheet open and a category closes it; the picker reads "Engines / Bastion 3";
  - a Bastion engine in two taps, saved as `bastion-engine`, and its card;
  - the plans and outside;
  - the copied code, still version 4; a code and a save made by main open with the Yard's parts;
  - the hangar's goal: "Add 3 × Engine (+12 thrust each): 3 on hand, Bastion engine 220 at Dutch's yard";
  - the shop: "Bastion engine · Needed";
  - construction mode: the makers counted on hand, and the Ship tab's fix arming a Bastion engine, placed in two taps;
  - the corvette in the Enemy ships sandbox (19 of its 27 parts Bastion's), copied to the builder;
  - offline, the drawer's 42 icons; no console errors.
- **Every earlier milestone's browser check** passes, run one after another on the final code, at the three sizes unless named:
  - M23f 28, M23e 27, M23d 25, M23c 25, M23 36, M23b 8;
  - M22 35, M21 32, M19 52, M20 32;
  - M18 43, M17 37, M16 29, M15 30;
  - M8's fights and column;
  - at 905 × 370 only: M14's saves 10, M13 24, M14 47, and M8's extras.

  M23e's copy was adapted, not the game. The maker buttons share the category buttons' look (`bld-cat`), so the check counted them as categories (23 of 27 at each size). And each Bastion version now sits beside its part in the lists it reads. The game keeps the two rows apart by their own buttons. M14 ran 47 checks (48 in M23f): one runs only when a won job drops a part, and the new drop tables changed which jobs do.
- **Act 1** (`tools/run.js --runs 100`, the same seeds):

  | | Ready | Jobs (median, range) | Jobs in all | Quick minutes | Slow minutes |
  | --- | --- | --- | --- | --- | --- |
  | main | 100 | 6 (3 to 15) | 645 | 27 (12 to 58) | 44 (21 to 93) |
  | M23g | 100 | 6 (3 to 15) | 641 | 27 (12 to 58) | 44 (21 to 93) |

  With a Bastion engine in the scrap job's drops as well (before it was taken out), 649 jobs and a slowest run of 76 quick minutes.
- **The careful voyage** (`tools/voyage.js --long never`): fed all the way in 26 of 30 (main 25). Over 60 seeds: 46 (main 44). With a Bastion engine in the scrap job's drops: 42 of 60, and 22 of 30, which failed the Done when; so it isn't there.
- **The approach** (`tools/approach.js`, 300 approaches a preset):

  | Ship | Against | Escaped | Boarded her | Boarded by | Destroyed | Parted | Score | Wrecked | Evasion |
  | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  | start (Yard) | cutter | 29% | 8% | 22% | 2% | 39% | −11 | 0.87 | 30 |
  | start (Yard) | corvette | 73% | 0% | 16% | 0% | 11% | −16 | 0.93 | 30 |
  | start, all Bastion | cutter | 59% | 1% | 21% | 0% | 19% | −20 | 0.21 | 21 |
  | start, all Bastion | corvette | 49% | 0% | 18% | 0% | 33% | −18 | 0.96 | 21 |

- **Generated corvettes,** 100 seeds: 73% of their parts Bastion's (bridge 84%, corridors 82%, reactors 77%, engines 74%, cannons 63%, guns 50%, airlocks 45%: the later a part rolls, the less mass is left for it). 27.5 ms a ship against 23.1 on main; cutters and haulers unchanged.
- **Faces drawn:** the example ship outside, 739 faces all the Yard's and 792 all Bastion's; on the plans, 357 lines either way. Corvette seed 1: 2,090 faces.
- **Frame rate** (fps while a finger circles: lowest / middle of the half-second windows), main against this branch:

  | View | 905 × 370 | 960 × 825 | 905 × 370, CPU 4× slower |
  | --- | --- | --- | --- |
  | Builder plans, Yard (main) | 60 / 60 | 60 / 60 | 37 / 43, 47 / 54 |
  | Builder plans, Yard (here) | 60 / 60 | 60 / 60 | 36 / 40, 42 / 46 |
  | Builder plans, Bastion | 60 / 60 | 60 / 60 | 36 / 40, 45 / 50 |
  | Builder Hull, Yard (main) | 60 / 60 | 60 / 60 | 34 / 39, 33 / 41 |
  | Builder Hull, Bastion | 60 / 60 | 60 / 60 | 33 / 38, 38 / 39 |
  | Corvette 1 (main) | 60 / 60 | 56 / 60 | 25 / 26, 23 / 28 |
  | Corvette 1 (Bastion's) | 60 / 60 | 56 / 60 | 23 / 25, 25 / 30 |
  | Lift-off (main) | 60 / 60 | 54 / 60, 50 / 58 | 16 to 24 / 18 to 25 (5 runs) |
  | Lift-off (Bastion's engines) | 60 / 60 | 35 / 56, 48 / 60 | 12 to 21 / 21 to 22 (5 runs) |

  The 4× column's builder and corvette rows are two runs each. Two lift-off runs here had one slow window (35 at 960 × 825, 12 with the CPU slowed); three more runs of the lift-off alone didn't repeat it (18 to 20, against main's 16 to 21).

## M23f Styling pieces (2026-10-14)

**Status:** done, and the ROADMAP.md box is ticked. A ship can be styled now: wings, fins, antennas, a dish, lights, plates, and wedges and curves that reshape the hull, in one of six paints with one of six trims. None of it changes a stat, a rule or a boarding map. Enemy ships wear their side's look.

Some of this changes what was there before, not only adds to it:
- **The hull's style moved** from the Ship tab to the Look tab, with the paints and trims.
- **The Hull view isn't only to look at any more.** It is the Look: taps and drags there place and pick out styling pieces, and its hint says so. The drawer's first tab reads Parts on the plans and Look outside.
- **Saves are version 17** and **blueprint codes version 4.** Every older ship opens in the yard's colors, slate and sky, with no pieces; codes from version 1 to 3 still open.
- **Enemy ships wear looks,** rolled on a stream of their own: the golden ships file is unchanged, and so are the fights aboard them. A generated ship takes 2 to 4 ms longer to make (on this machine: cutter 14 ms, corvette 21, hauler 11).
- **The frame rate holds main's at 905 × 370 and 821 × 283.** At 960 × 825 a dressed ship turns a few frames a second slower than main's bare one, about as much as two runs of the same thing differ. Details under Verified.

No phone results have come back yet for M14 to M23e.

**How it was picked:** mockups drawn by the game's own renderer: each piece on the start ship, a dressed ship, sculpting, paint pairs, the enemy presets in their sides' looks, and two ways into the builder (A, a Look tab beside Parts; C, Look mode behind the Hull button). Evan took the recommended answer each time: "C · Look mode", "The 12 in the mockup", "Hull + trim swatches" and, for a piece whose room goes, "It comes off".

Done when (ROADMAP.md, M23f):
- **Data:** "the 12 pieces are in `data/styling.json`, each with its own model outside, its drawing on the plans and its icon; so are six paints and six trims."
- **Look mode:** "the Hull button opens Look. The board shows the ship from outside, and the drawer's first tab picks from wings, gear, sculpt, paint, trim and hull style."
- **Placing:** "a piece goes on from outside in two taps, on cells beside the hull and against a room; never ahead of the bow, and never in the cell in front of an exhaust, a barrel or a hatch; at most 24 a ship; it moves, turns (a wing flips sides) and comes off as a part does, undoable; paint and trim take one tap each, undoable."
- **Room changes:** "one that leaves a piece with nothing to hold it takes the piece off in the same step; undo puts it back."
- **Sculpting:** "wedges and curves join the hull, whose skin wraps them in the ship's style; the hull still covers every room and never cuts into one (tested)."
- **Where it shows:** "pieces and paint show wherever ships are drawn: the builder's plans and Hull view, the hangar, the lift-off and the Enemy ships sandbox."
- **Looks only:** "no stat, rule or boarding map changes with them (tested)."
- **Saves and codes:** "saves (`SAVE_VERSION` 17: older ships have no pieces, in slate and sky) and blueprint codes (version 4, which still reads 1 to 3) carry them."
- **Enemy ships:** "wear their side's paint and some pieces, the same for the same seed, their layouts unchanged (golden)."
- **Fit and budget:** "every button is 48 px or more at the three sizes; the builder's default view keeps every cell 22 px or more on the cover screen; the hull views keep to the frame budget."

How each is met:
- **Data:** `tests/styling.test.js` (the 12 pieces in three groups, six paints and six trims, the yard's first) and `tests/stylingDraw.test.js` (every standing piece has a model outside and every piece an icon; wedges and curves are the hull's shape; standing pieces show on the plans in their own lines). `tools/validate-data.js` checks the file: groups, sizes, turns, shapes, a model for each standing piece, a color for each paint and trim.
- **Look mode:** by touch at the three sizes, below.
- **Placing:**
  - the rules in `tests/styling.test.js`: open cells beside the hull, never on a room, in a gap the hull fills or on another piece; never ahead of the bow or in front of an exhaust, a barrel or a hatch; a wedge or a curve with a room all along a leg and its slope to open space; at most the frame's 24;
  - the commands (place, move, turn, remove, paint, trim) and the session (two taps, Turn, undo);
  - by touch at the three sizes, below.
- **Room changes:** `tests/styling.test.js` (the room a piece is against taken off, a room built over it, an engine put with its exhaust onto it: each takes the piece off in the same step, the notice says so, and undo puts it back; paint, trim and style never do). By touch: taking off the life support takes the wing against it.
- **Sculpting:** `tests/hullShape.test.js` runs its hull checks on sculpted ships too (wedges at the stern, long wedges at the steps, curves, a spiked bow): every cell covered at every height, so no room is cut into, and every surface finite and the same each time. `tests/stylingDraw.test.js`: the outline changes, and a roof and a deck go over each shaped piece.
- **Where it shows:** by touch, below: the builder's plans and Hull view, the hangar, the lift-off and the Enemy ships sandbox all draw the pieces and the paint.
- **Looks only:** `tests/styling.test.js` compares the start ship dressed and painted with it bare: the same stats, flight checklist, layout problems, doorways, boarding map and approach numbers, and a refit that only styles takes no parts.
- **Saves and codes:** `tests/styling.test.js` (the v16 to v17 migration on every ship a save holds, the same on every load; version 4 codes carry the looks, and versions 1 to 3 open in the yard's colors). By touch: a save made by main opens, and a code made by main opens.
- **Enemy ships:** `tests/ships.test.js`: 300 ships wear their preset's paint and trim, only the pieces their look names, never more than it allows, each where it fits; a symmetric ship's come in mirrored pairs; with the looks taken out, every ship's parts, style, wrecks and crew are the same; the golden ships file is unchanged.
- **Fit and budget:** every button measured by touch at the three sizes. `tests/orbit.test.js` still holds the default view to 22 px cells. Frame rates under Verified.

### Shipped

- **The pieces** (`data/styling.json`), each a placement `{ uid, type, x, y, rot }` kept in the ship's `styling`, with uids from the ship's one count:

  | Group | Piece | Cells | Turns |
  | --- | --- | --- | --- |
  | Wings | Swept wing | 2 × 2 | flips to either side |
  | Wings | Delta wing | 3 × 2 | flips to either side |
  | Wings | Tail fin | 2 × 1 | flips to either side |
  | Wings | Spoiler | 2 × 1 | flips to either side |
  | Gear | Antenna, Dish, Floodlight | 1 × 1 | turns |
  | Gear | Light strip, Armor plate | 2 × 1 | turns |
  | Sculpt | Wedge | 1 × 1 | turns |
  | Sculpt | Long wedge | 2 × 1 | turns and flips |
  | Sculpt | Curve | 2 × 1 | turns and flips |

  Paints: slate (the yard's), graphite, bone, rust, olive, navy. Trims: sky (the yard's), amber, signal, lime, violet, white. The starter frame takes 24 pieces (`maxStyling` in `data/frames.json`).
- **The rules** (`src/sim/styling.js`): where a piece goes, and `misfits`, the pieces a room change leaves with nothing to hold them, which the build commands take off in the same step (`builder.js`). A turn runs 0 to 7: four quarter turns, plus 4 for mirrored, so a wing sweeps back on either side.
- **Looks only:** nothing that counts stats, checks a layout, makes a boarding map or plays an approach reads `styling`, `paint` or `trim`. Pieces are free and use no parts, in construction mode too.
- **The Look** (`src/ui/builder/lookPanel.js`, `drawer.js`, `view.js`): the Hull button turns the board outside and the drawer's first tab into Look: a picker of wings, gear, sculpt, paint, trim and hull, and how many pieces the ship has of its 24.
  - a piece's tile picks it, a tap beside the hull shows it there as a ghost, green or red, and a second tap puts it down; or drag the tile onto the board;
  - the ghost fits itself to the hull where the finger is, turned the way that fits, and a tap on the roof by the hull's side finds that side;
  - Turn shows it the next way round;
  - a tap picks a placed piece out in the accent: then a tap elsewhere or a drag moves it, Turn turns it and Delete takes it off;
  - a long press shows a piece's card;
  - paint, trim and the hull's style take one tap; all of it undoes.

  The session's layer, rooms or styling, decides which the board shows, and a ship loaded from a slot or a code keeps it.
- **Drawing:**
  - each standing piece has a model outside in the ship's paint and trim (`src/render/pieces.js`): wings with their navigation light, red to port and green to starboard, a fin, a spoiler, an antenna, a dish, a floodlight, a light strip and an armor plate;
  - wedges and curves join the hull: the tracer runs the outline along their slope, and the skin, roof and deck wrap them in the ship's style (`hull.js`, `hullShape.js`, `exterior.js`, `shipScene.js`);
  - on the plans, standing pieces are drawn in violet beside the blue rooms;
  - a ghost and a picked-out piece are drawn over the ship from outside, so they show through it (`lookOverlay.js`);
  - paint recolors the hull, its plates and seams, trim its stripe and the wings' leading edges (`palette.js` `paintSkin`).
- **Enemy looks** (`look` in `data/ships.json`, `src/sim/gen/look.js`):
  - pirate cutters in rust and signal, with one or two swept wings and one or two antennas;
  - patrol corvettes in bone and sky, with a pair of delta wings, up to two tail fins and two to four floodlights;
  - derelict haulers in olive and amber, with two to four armor plates, maybe a pair of dishes and up to two light strips.

  Pieces go on at random where the builder's rules let them, in mirrored pairs on a symmetric ship (`mirroredPiece` flips any piece across a ship's middle). The Enemy ships sandbox names each ship's paint, trim and how many pieces it wears, and Builder copies them with it.
- **Saves and codes:** `SAVE_VERSION` 17, migrating every ship a save holds (the builder's slots, the campaign's ship, the other ship in an approach, a boarding's ship). Codes are version 4: paint and trim after the hull's style, the pieces after the parts. A piece a code names that is unknown or no longer fits is left off, and the rest opens.
- **Tools:** the validator checks the styling file and each preset's look; `tools/gen-ship.js` prints a ship's look (not in the golden file).
- **Docs:** ROADMAP.md §4.1 (styling), §4.8 (saves 15 to 17), M23f's box and three ideas in §9; CLAUDE.md's content and layout lists.

Decisions made along the way, not asked (each easy to change):
- **24 pieces a ship** on the starter frame.
- **Pieces are free:** no price, no parts on hand, in construction mode too.
- **Nothing ahead of the bow:** the nose is drawn there.
- **The curve is 2 × 1,** an S that leaves the hull level and meets it level. A 1 × 1 quarter curve folded the hull's skin where it met the next room.
- **A wedge or a curve tapped at a step takes a turn joined to the hull along both legs** when one is: a slope, not a spike. The 1 × 1 wedge can't join two legs at most steps, so it makes a spike there; the long wedge and the curve make the slope.
- **A tap reaches one cell:** if nothing fits under the finger, the nearest spot within a cell does.
- **Enemy looks have no sculpt** (§9 has it).

### Known issues

- **Pieces on the far (north) side are half hidden** behind the hull at the builder's default view. One being placed or picked out is drawn over the hull; turning the camera shows the rest (§9).
- **Plated curves are faceted:** the curve's skin is drawn in Plated's straight panels.
- **Enemy pieces go anywhere they fit,** so a cutter's wing can sit near the bow (§9).
- **The approach screen draws no looks:** it draws both ships as their boarding maps (§9, from planning). So a player sees an enemy's look only in the Enemy ships sandbox for now.
- **A dressed ship costs frames at 960 × 825:** see Verified. The plans' rough frames for the outside views are the fix if a phone stutters (§9).
- **The test suite takes about 1 min 40 s here.**

### What to test on the phone (Galaxy Z Fold 6)

1. **The Look,** in the dev Builder: tap Hull, pick Wings, and put a swept wing on each side of the ship, two taps each. Then:
   - tap it, Turn it, drag it along the hull, Delete it, and undo each;
   - long-press a piece for its card.
2. **Paint and trim:** try the pairs. Does the hull still read in each, folded and unfolded?
3. **Sculpt:** a long wedge or a curve at a step in the hull, and a wedge at a corner. Do the slopes look like part of the ship?
4. **Construction mode:** style the campaign's ship in Build, then see it at the hangar and on lift-off.
5. **The Enemy ships sandbox:** step through a few seeds of each preset in Hull.
6. **Tell me:**
   - which pieces you'd use and which look wrong;
   - whether the half-hidden far side gets in the way;
   - whether 24 is the right cap, and whether pieces should cost something;
   - and the M14 to M23e questions still open.

### Next session

**M23g A second manufacturer.** Settle its Done when first. The draft is "every part, M23e's included, comes from both makers, told apart at a glance in the builder and outside it; each maker's versions differ in play somewhere (Law 1); the shop sells both; and old saves and blueprint codes load with the first maker's parts."

### Verified here

- `node --test`: 643 pass. `node tools/validate-data.js`: OK (12 styling pieces). The golden maps, battle logs and ships didn't change.
- **Generated ships,** 100 seeds of each preset (`tests/ships.test.js`): every one passes the flight checklist and wears its look; per ship, 3.0 pieces on a cutter, 6.1 on a corvette, 5.9 on a hauler.
- **Faces drawn outside:**

  | Ship | Bare | Dressed |
  | --- | --- | --- |
  | The example ship | 739 faces, 7 glows | 1,067 faces, 14 glows (13 pieces, rust and amber) |
  | Cutter, seed 1 | 1,027, 8 | 1,065, 10 (2 pieces) |
  | Corvette, seed 1 | 1,907, 15 | 1,993, 21 (8 pieces) |
  | Hauler, seed 1 | 1,432, 12 | 1,544, 12 (2 pieces) |

- **M23f's check** (scratchpad `m23f/verify.mjs`), by touch at 905 × 370, 821 × 283 and 960 × 825: 28 of 28 at each size.
  - **Look mode:** Hull opens it, the first tab reads Look and the board is outside. Its picker holds wings 4, gear 5, sculpt 3, paint 6, trim 6 and hull 2; every tile has its drawing or its color, and every drawer, tool and picker button is 48 px or more and in sight.
  - **Two taps:** "Tap beside the hull where the Swept wing goes.", then "Tap the Swept wing again to place it, or Turn it.", then the wing is on and saved; the tally reads 1/24.
  - **A wing flips:** one tapped below the ship turns to face up into it, and Turn shows it the other way.
  - **Move, delete, undo:** a picked-out wing drags along the hull, and undo puts it back. Delete takes it off ("Removed Swept wing."), and undo puts it back.
  - **Never ahead of the bow or in front of an exhaust:** "Nothing goes ahead of the bow: the nose is there." and "Antenna would be in front of the Engine's exhaust.", and nothing goes on.
  - **Paint, trim and style:** rust, amber and Plated, a tap each, pressed in the tab and saved. Undo takes the paint back to slate.
  - **A room change:** taking off the life support says "Removed Life support. The Swept wing came off.", and undo puts both back.
  - **Sculpting:** a long wedge at the step over the engines goes on joined along both legs, and the hull wraps it.
  - **Codes:** a copied code carries the pieces, rust and amber, and opens again; a version 3 code made by main opens Plated, in slate and sky.
  - **A save made by main** (version 16) opens as 17: slate and sky, no pieces, Plated kept, and Slate pressed in its builder.
  - **Construction mode:** Look is there; a wing in two taps and navy paint go on the campaign's ship, saved at once, and no parts are taken. The hangar draws it dressed, and the lift-off plays with it.
  - **The Enemy ships sandbox:** each preset names its look ("Bone and sky, 8 styling pieces"), and Builder copies a ship with its look.
  - **Offline,** the Look tab draws its icons.
  - No console errors or warnings.
- **Frame rate in the app while the views move** (a finger circling four seconds, the dev overlay read every half second; the lowest and middle windows, fps). The dressed example ship has 13 pieces, rust and amber; the lift-off is the start ship in the same 13 pieces here, bare on main:

  | View | 905 × 370 | 821 × 283 | 960 × 825 | 905 × 370, CPU 4× slower |
  | --- | --- | --- | --- | --- |
  | Builder's Hull view, bare, main | 60 / 60 | 56 / 60 | 60 / 60 | 26 / 29 |
  | The same, here | 56 / 60 | 60 / 60 | 56 / 60 | 26 / 28 |
  | Dressed, here | 60 / 60 | 60 / 60 | 54 / 60 | 23 / 24 |
  | Dressed, a ghost on it, here | 60 / 60 | 60 / 60 | 58 / 60 | 21 / 25 |
  | Enemy ships sandbox, corvette 1, main | 58 / 60 | 58 / 60 | 42 / 46 | 17 / 20 |
  | The same, here (8 pieces) | 58 / 60 | 60 / 60 | 40 / 41 | 16 / 20 |
  | Hauler 1, main | 58 / 60 | 60 / 60 | 46 / 48 | 16 / 21 |
  | The same, here (2 pieces) | 60 / 60 | 60 / 60 | 44 / 48 | 17 / 21 |
  | Lift-off, main | 56 / 60 | 60 / 60 | 42 / 44 | 12 / 13 |
  | Lift-off, here | 54 / 60 | 56 / 60 | 36 / 39 | 10 / 11 |

  Two more runs of the corvette at 960 × 825 read 46 and 42 here, 48 and 47 on main: the runs differ by about 4 fps. Taking the pieces' glows out, or their faces, didn't move it beyond that.
- **Regressions,** one after another, after the last change (the Look tab's own classes, below), at 905 × 370, 821 × 283 and 960 × 825 unless named:
  - **M23f's check:** 28 of 28 at each size;
  - **M23e's check** (adapted in M23f, below): 27 of 27 at each size;
  - **M23d's check** (adapted in M23f): 25 of 25 at each size;
  - **M23c's check** (as adapted in M23e): 25 of 25 at each size;
  - **M23's check** (as adapted in M23e): 36 of 36 at each size;
  - **M23b's check:** 8 of 8 at each size;
  - **M22's check** (as adapted in M23e): 35 of 35 at each size;
  - **M21's check** (as adapted in M23e): 32 of 32 at each size;
  - **M19's check** (as adapted in M22): 52 of 52 at each size;
  - **M20's check** (as adapted in M21): 32 of 32 at each size;
  - **M18's check:** 43 of 43 at each size;
  - **M17's check** (as adapted in M19): 37 of 37 at each size;
  - **M16's check:** 29 of 29 at each size;
  - **M15's check:** 30 of 30 at each size;
  - **M14's saves check:** 10 of 10 at 905 × 370;
  - **M13's check** (as adapted in M23e): 24 of 24 at 905 × 370;
  - **M8's fight sandbox checks:** a whole fight played by touch at each size, with no console errors; the orders column at each size, every order and crew button 48 px or more; all 8 extras, offline included, with no console errors;
  - **M14's check:** 48 of 48 at 905 × 370, with a job of each kind played by touch (M23e's run had 41: the count follows how the jobs go).
- **What changed in the old checks:**
  - **M23d's** (scratchpad `m23d/verify23f.mjs`) picks the hull's style in the Look tab, where it moved, and reads the Look's hint where it read the style's name. It expects a version 4 code, and a v15 save to open as v16 or later.
  - **M23e's** (`m23e/verify23f.mjs`) asks that a save made before M23e opens as v16 or later, where it asked for v16.
- **Found by the regressions:** the Look tab borrowed the Parts tab's classes for its look. So M23e's check counted the Look's hidden tiles as parts, at every size (19 of 27), and a first-run tip would have taken a pressed paint swatch for a part picked. It was fixed in the game, not in the check: the Look tab has classes of its own now and shares the look through the stylesheet, as M23's cards do.

## M23e Builder catalog and part variants (2026-10-13)

**Status:** done, and the ROADMAP.md box is ticked. The builder has nine new parts, each with its own numbers and drawings, and the Parts tab is a picker: one category at a time, or all, with a size filter.

Some of this changes what was there before, not only adds to it:
- **The enemy presets changed:**
  - the cutter flies on an engine and one or two light engines, where it had two engines;
  - the corvette carries a pair of cannons half the time;
  - the hauler may carry a large hold.

  The golden ships file is rewritten on purpose. The boarding fights on those maps came out differently in `tools/sim.js`: the crew wins 52% aboard the corvette, up from 41%, and 42% aboard the hauler, down from 48%.
- **The approach tests and M21's to M23c's browser checks meet cutter seed 3.** Seed 1's cutter now has three guns and two reactors, which the start ship can't disable in three rounds. Seed 3's has two guns and one reactor, as seed 1's did.
- **`balance.json`:** `gunDamage` and `shieldPerGen` moved onto the parts (a weapon mount does 15, a shield generator holds 10), and `interceptMax` (20) came in.
- **Dutch's yard** weights engines 9, up from 6, so act 1 runs as it did with nine more parts on the table.
- **The test suite** takes 1 min 45 s here, up from about 66 s: the Law 1 tests fly ten ships through approaches and three more fleets of 30 voyages.

No phone results have come back yet for M14 to M23d.

**How it was picked:** a table of nine proposed parts with their numbers, and three ways to sort the drawer, mocked up inside the real builder at the three sizes:
- A, one list in sections;
- B, a picker: one category at a time, chosen from a sheet;
- C, a strip of categories to swipe.

Evan took the recommended answer each time: "B · Picker", "The 9 in the table", enemy ships using some "Yes, now", and Law 1 "Reworded" for variants. The Done when below is that rewording.

Done when: "the nine parts are in `data/modules.json`, each with its own footprint, interior, model and icon. Each changes the approach, a fight or the voyage, shown by `tools/approach.js`, `tools/sim.js` or `tools/voyage.js` (Law 1), and none is worse than another part in every way (cost, size, mass, power, hit points and what it does). A gun's damage and a shield's strength come from its part, and point defense cuts the other ship's hit chance, every chance shown as rolled (Law 4). The drawer shows one category at a time or all, picked from a 48 px button, with a size filter, and in construction mode only the parts on hand; two taps to place as now, every button 48 px or more at the three sizes. The shop and the drop tables carry the new parts, and the enemy presets use some (the golden ships file updated on purpose). Old saves and blueprint codes still load, and the careful test player still crosses all five sectors fed in at least 24 of 30."

- **Nine parts, each with its own footprint, interior, model and icon:** `tests/catalog.test.js`. Each has a drawer icon, fittings on the plans and a roof outside, all of its own; no two parts are the same room. Drawn and checked by eye, each beside the part it varies, on the plans and from outside.
- **Law 1:**
  - **In an approach** (`tests/approach.test.js`, `tools/approach.js`): each of the six that fight changes how it goes against some preset, by 10 more wins in every 100 or 5 fewer losses. So does the small reactor, a spare against the corvette, which fires at reactors. The guns, shields and engines do worse against no preset. Numbers under Verified.
  - **On the voyage** (`tests/voyage.test.js`, `tools/voyage.js`):
    - surgery heals one more a jump than a med bay, so the crew is patched less;
    - bunks, with a hold to feed them, let more recruits sign on;
    - the large hold carries more than a cargo hold, so the careful player goes hungry less.
  - **In a fight** (`tools/sim.js`): the presets' new rooms change the boarding maps (numbers under Verified).
- **None worse in every way:** `tests/catalog.test.js` checks every pair of the 21 parts on cost, cells, mass, power, hit points, what it gives (thrust, berths, life support, cargo, damage, shield, intercept, heal), what it must face and whether it turns, with the tags it has.
- **A gun's damage and a shield's strength from its part; point defense's cut; every chance as rolled:**
  - `tests/approach.test.js`: each gun fires for its part's damage, and shields add up what each holds. Each turret takes 10 off the other ship's hit chance, 20 at most, and is shot at as a gun.
  - The odds shown are the odds rolled (`tests/approachText.test.js`; by touch, below).
- **The drawer, construction mode, two taps, 48 px:** by touch at the three sizes, below. The filter logic is `tests/catalog.test.js`.
- **The shop and the drop tables:** Dutch's yard and the job drops carry all nine, and act 2's salvage the five cheaper ones (`data/districts.json`, `data/contracts.json`, `data/events.json`, checked by `tools/validate-data.js`).
- **The enemy presets** use the light engine, the cannon and the large hold. The golden ships file is updated on purpose.
- **Old saves and codes:** no save or code format changed. By touch, a save made by main before M23e opens as it was, and a version 2 code still opens.
- **The careful test player:** 25 of 30 cross all five sectors fed (`tests/voyage.test.js`; main: 26).

### Shipped

- **The nine parts** (`data/modules.json`), after the base parts:

  | Part | Size | What it does | Power | Mass | Hit points | Cost |
  | --- | --- | --- | --- | --- | --- | --- |
  | Light engine | 2 × 1 | thrust 6 | −1 | 1 | 8 | 90 |
  | Heavy engine | 3 × 2 | thrust 26 | −2 | 6 | 30 | 420 |
  | Small reactor | 2 × 2 | power 4 | +4 | 2 | 15 | 130 |
  | Point defense | 1 × 1 | their hit chance −10 (−20 at most) | −1 | 1 | 10 | 120 |
  | Cannon | 2 × 1 | 30 damage a hit | −2 | 4 | 20 | 240 |
  | Shield array | 2 × 2 | holds 25 a round | −4 | 4 | 20 | 300 |
  | Bunks | 2 × 2 | 2 berths, 2 life support | −1 | 2 | 12 | 100 |
  | Surgery | 2 × 2 | heals 2 a jump | −2 | 3 | 15 | 220 |
  | Large hold | 4 × 3 | cargo 40 | 0 | 5 | 30 | 140 |

- **Categories** (`data/modules.json` `categories`): command, power, engines, weapons, defense, crew, cargo and utility, a `category` on every part. The validator checks each part's category, and each category has parts.
- **The approach** (`src/sim/approach.js`):
  - a gun's `damage` and a shield's `shield` are its part's: the weapon mount does 15 and the generator holds 10, as `balance.json` had them;
  - a new tag, `pointdefense`: each working turret takes its `intercept` off the other ship's hit chance, up to `interceptMax`, and volleys aimed at the guns hit turrets too;
  - every gun fires in the order fitted, for its own damage.

  The validator holds every gun to a damage, every shield to a strength and every turret to an intercept, and nothing else to any of them.
- **The approach screen** (`approachText.js`): a ship with point defense shows it beside its guns; the orders and the other ship's order give each gun's damage ("30 and 15 damage a hit").
- **The flight checklist's fixes** name the first part in the file that gives what is short, where they named the one giving the most. The base parts come first, so act 1's goal and generated ships still ask for an Engine, not a Heavy engine.
- **Drawings:** for each new part, its drawer icon (`parts/blueprint.js`), fittings on the plans (`props.js`) and a roof outside (`exterior.js`). A gun two cells across has one heavy barrel out of the hull, where a mount has a pair (`hull.js`, `exterior.js`, `shipScene.js`).
- **The Parts tab** (`palette.js`, `catalog.js`, `style.css`, `view.js`):
  - a picker row: the category and how many parts it shows, and a size filter (any, small, medium, large), a tap a step;
  - the sheet of categories, tiles the parts' size, three across, each with its first part's icon and how many it would show;
  - All lists the parts by category, the base part first;
  - three rows of tiles fit under the row at every size, so any one category shows whole; All scrolls.
- **The part card** says what a gun, a shield or point defense does in an approach.
- **Presets** (`data/ships.json`): the cutter has an engine and one or two light engines; the corvette a pair of cannons half the time; the hauler two to four cargo holds and maybe a large hold.
- **The shop and drops:** Dutch's yard stocks all nine at weight 1, engines weighted 9. The jobs drop them where they fit: military parts on the picket, salvaged machinery at the scrapyard, crew fittings on the supplies and rent jobs. Act 2's salvage has the light engine, small reactor, point defense, bunks and large hold.
- **Tools:** `tools/approach.js` flies all nine parts the approach plays with; the test player's damage estimate uses each gun's damage.
- **Docs:** ROADMAP.md §4.1, §4.2, §5, M23e's entry and four ideas in §9; CLAUDE.md's content list.
- **Tests:** 620 in all, up from 611:
  - `tests/catalog.test.js` (new, 5);
  - per-part damage and shields, and point defense (`tests/approach.test.js`, 2);
  - the part card's approach line (`tests/builderText.test.js`);
  - surgery, bunks and the large hold on the voyage (`tests/voyage.test.js`);
  - 11 validator cases.

  Changed:
  - the Law 1 approach test, now with ten ships;
  - the med bay's voyage test compares the crew's hit points over all 30 runs, as both medians now sit at full health;
  - the approach tests' cutter seed;
  - the hull test's heavy barrel.

### Decisions made this session

- **Evan's calls:** the picker (B), the nine parts in the table, enemy ships using some now, Law 1 reworded for variants.
- **Mine:**
  - **The numbers moved from the table in places:**
    - the cannon does 30, not 25, so one hit wrecks an unshielded reactor and its hit still wrecks a gun through a generator;
    - the small reactor weighs 2 and costs 130, so it is lighter than a reactor and a pair costs more than one;
    - the heavy engine costs 420, more than two engines, for being one part;
    - the shield array draws 4 power;
    - point defense is machinery inside, where a mount is a console, so the two rooms differ on a boarding map.
  - **Point defense adds up to 20** (`interceptMax`, new in `balance.json`), so turrets can't make a ship unhittable.
  - **The fix names the first part in the file,** not the one giving the most. With the variants in, "the most thrust" would have made act 1's goal a heavy engine.
  - **No shield arrays or small reactors on enemies yet.** The corvette is mirrored, so it would carry them in pairs, and a pair of arrays holds 50 a round, more than the start ship's gun gets through. Paired small reactors left one corvette in five without a layout. §9 has a gunship for them.
  - **The cutter's engines say what it gets:** its old "two or three engines" only ever laid out two. One engine and one or two light engines lay out on every seed; 84% roll one light engine.
  - **The sheet is three tiles across,** not the mockup's two, so all nine categories fit without scrolling at every size.
  - **Law 1's approach test counts fewer losses too.** Point defense, shields and the spare reactor defend: they cut boardings more than they add wins. "Worse against none" holds for the guns, shields and engines. The small reactor's job is power, and its mass costs a little against the cutter, which never fires at reactors.
  - **Salvage carries only the five cheaper variants.** All nine would have raised a salvaged part's sale price by about 60% on average, in an act where parts can only be sold until M23h.

### Verified here

- `node --test`: 620 pass. `node tools/validate-data.js`: OK (21 modules). The golden ships file is rewritten on purpose; the golden maps and battle logs didn't change.
- **`node tools/sim.js`** (`balance.json` changed: two numbers moved to the parts, one added; no number a fight uses changed). The new presets' layouts moved the boarding fights aboard them:

  ```
  Ship             Fights    Crew wins  Boarders win  No winner    Rounds  Crew orders
  Example ship        250  64% (58–70)           36%         0%   7 (5–9)           29
  Pirate cutter       250  44% (38–50)           40%        16%  7 (5–13)           28
  Patrol corvette     250  52% (45–58)           40%         8%  8 (5–16)           30
  Derelict hauler     250  42% (36–48)           48%        11%  7 (5–12)           28
  All               1,000  50% (47–53)           41%         9%  7 (5–12)           29
  Shots: 24,754, 24.8 a fight. Hit: crew 55%, boarders 39%.
  ```

  M11's, unchanged until now: cutter 44% (38–51), corvette 41% (35–47), hauler 48% (41–54), all 49% (46–52), 23,504 shots.
- **`node tools/approach.js`,** 300 approaches a row. The start ship scores −11 against the cutter and −22 against the corvette (wins less losses in every 100). Each part added by itself:

  | Part | Against the cutter | Against the corvette | Losses, cutter | Losses, corvette |
  | --- | --- | --- | --- | --- |
  | weapon mount | +75 | +2 | 22% → 12% | 22% → 20% |
  | cannon | +84 | +12 | 22% → 7% | 22% → 10% |
  | point defense | +6 | +11 | 22% → 17% | 22% → 11% |
  | shield generator | +12 | +11 | 22% → 14% | 22% → 11% |
  | shield array | +18 | +15 | 22% → 8% | 22% → 7% |
  | engine | +29 | +13 | 22% → 6% | 22% → 9% |
  | light engine | +26 | +11 | 22% → 6% | 22% → 11% |
  | heavy engine | +1 | +18 | 22% → 10% | 22% → 4% |
  | small reactor | −1 | +9 | 22% → 20% | 22% → 13% |

  With a heavy engine the cutter can't close, and 87% of meetings part with nothing won.
- **The careful test player's voyages,** 30 from launch (no long jumps), with a part fitted before launch:

  | Fitted | Fed all the way | Hungry jumps | Hit points patched | Recruits signed |
  | --- | --- | --- | --- | --- |
  | nothing | 25 | 7 | 493 | 0 |
  | med bay | 26 | 10 | 44 | 0 |
  | surgery | 27 | 8 | 37 | 0 |
  | cargo hold | 27 | 5 | 280 | 18 |
  | large hold | 30 | 0 | 224 | 14 |
  | bunks | 26 | 10 | 507 | 0 |
  | cargo hold and bunks | 27 | 4 | 337 | 26 |
  | large hold and bunks | 30 | 0 | 236 | 30 |

  Main, fitted with nothing: 26 fed. It launched with 50 credits at the median, against 80 here, where act 1's jobs drop dearer parts to sell; it lost a boarding at home in 6 runs, against 8 here.
- **`node tools/run.js`,** 30 act 1 runs: all launch, after 7 jobs (4 to 13). The quick pace takes 29 minutes (15 to 58), the slow 47 (26 to 93). Main: 7 jobs (3 to 11), 28 minutes (13 to 50), 45 (22 to 79).
- **M23e's check** (scratchpad `m23e/verify.mjs`), by touch at 905 × 370, 821 × 283 and 960 × 825: 27 of 27 at each size.
  - **The Parts tab:** All with every part and Size Any. The sheet has All and eight categories, their counts adding up. Weapons picks the mount, point defense and the cannon, and the sheet closes. The size filter steps Small, Medium (nothing that size here), Large and Any. Every drawer button and every sheet tile is 48 px or more and in sight.
  - **Two taps:** the Cannon picked, a tap on the grid shows it ("Tap the Cannon again to place it."), a second puts it down, saved in the slot.
  - **A long press on Point defense:** its card says what it does in an approach.
  - **Codes:** a copied code carries the cannon and opens again the same; a version 2 code still opens.
  - **Construction mode:**
    - only the cannon, the bunks and the corridors on hand show, with how many, and the picker and the sheet count only those;
    - the Cannon is placed in two taps and is gone from hand;
    - Weapons then says "Nothing on hand here.".
  - **The approach**, the start ship carrying a cannon and point defense: "Point defense 10" on its side. The cutter's order reads "2 guns, 32% each (12% if you evade)", its odds with the cut, as the rules roll them. Fire reads "your 2 guns, 49% each to hit, 30 and 15 damage a hit". The orders are 48 px or more.
  - **A save made by main before M23e** opens as it was; its builder lists every part.
  - **Offline**, the builder draws the new parts.
  - No console errors or warnings.
- **Frame rate in the app while the views move** (a finger circling three to four seconds, the dev overlay read every half second; lowest and middle):

  | View | 905 × 370 | 821 × 283 | 960 × 825 |
  | --- | --- | --- | --- |
  | Builder's Hull view, the example ship, main | 48 / 60 | 60 / 60 | 56 / 60 |
  | The same, here (no new parts on it) | 60 / 60 | 60 / 60 | 58 / 60 |
  | The start ship with all nine new parts, here | 60 / 60 | 60 / 60 | 54 / 56 |
  | Enemy ships sandbox, corvette seed 1, main | 60 / 60 | 60 / 60 | 38 / 41 |
  | The same, here (it carries cannons now) | 60 / 60 | 58 / 60 | 41 / 45 |

- **Regressions,** one after another, after the last change, at the three sizes unless named:
  - **M23d's check:** 25 of 25 at each size;
  - **M23c's check** (adapted in M23e, below): 25 of 25 at each size;
  - **M23's check** (adapted in M23e): 36 of 36 at each size;
  - **M23b's check:** 8 of 8 at each size;
  - **M22's check** (adapted in M23e): 35 of 35 at each size;
  - **M21's check** (adapted in M23e): 32 of 32 at each size;
  - **M19's check** (as adapted in M22): 52 of 52 at each size;
  - **M20's check** (as adapted in M21): 32 of 32 at each size;
  - **M18's check:** 43 of 43 at each size;
  - **M17's check** (as adapted in M19): 37 of 37 at each size;
  - **M16's check:** 29 of 29 at each size;
  - **M15's check:** 30 of 30 at each size;
  - **M14's saves check:** 10 of 10 at 905 × 370;
  - **M13's check** (adapted in M23e): 24 of 24 at 905 × 370;
  - **M8's fight sandbox checks:** a whole fight played by touch at each size, with no console errors; the orders column at each size, every order and crew button 48 px or more; all 8 extras, offline included, with no console errors;
  - **M14's check:** 41 of 41 at 905 × 370, with a job of each kind played by touch. M23d's run had 48: the count follows how the jobs go, and this run lost one job and was paid two of the new parts.
- **Found by the checks and the measurements:**
  - **A fifth of corvettes had no layout** with a pair of small reactors. The corvette keeps its two reactors.
  - **The voyage's med bay test** compared median crew health, and both medians now sit at full health. It compares the total over the 30 runs now: 755 with a med bay against 692 without.
  - **The checks of M21, M22, M23 and M23c** met cutter seed 1 and played on until one ended in her being boarded. With two reactors none did. Their copies (scratchpad `*/verify23e.mjs`) meet seed 3; nothing else in them changed.
  - **M13's check** listed construction mode's tiles in file order. All lists them by category now: crew quarters and life support before the corridor. Its copy expects that order.
  - **Point defense's barrels** were too short to see from outside. They reach past the hull's side now.

### Known issues

- **Surgery's lead over a med bay is small on the voyage:** 37 hit points patched against 44 over 30 runs. With a medic aboard, a med bay already heals most wounds between fights. More wounds a voyage would show it more.
- **The large hold alone doesn't beat a cargo hold for the careful player:** it never goes hungry (0 hungry jumps against 5), but it ends with fewer hit points (676 against 786). The test player fills every hold before it patches the crew. With bunks aboard it signs on the most recruits of any fit, 30 over the 30 runs.
- **No enemy carries a shield array or a small reactor.**
- **The cutter rolls one light engine 84% of the time:** 18 thrust, against its old 24. Its close chance against the start ship was at the floor either way.
- **Act 2 has no refits yet (M23h):** a new part found on the run can only be sold.
- **All scrolls at every size:** 21 parts are seven rows.
- **The approach's order buttons** read "49% × 2" whatever each gun does; the words on the first tap give each gun's damage.
- **The test suite takes 1 min 45 s here.**

### What to test on the phone (Galaxy Z Fold 6)

1. **The Parts tab** in the dev Builder:
   - tap the picker and pick a category, then step the size filter;
   - place a cannon and a heavy engine, two taps each;
   - long-press a new part for its card;
   - is the picker quick enough, and does every part's icon read?
2. **The Hull view:** look at the new parts from outside, on both screens.
3. **A new game:** watch for the new parts at Dutch's yard and in job drops. Fit one in Build: does construction mode show only what you have?
4. **Act 2:** meet a patrol corvette carrying cannons, and read the odds.
5. **Tell me:**
   - which parts feel worth their price, and which don't;
   - any part you'd change, or one you miss;
   - and the M14 to M23d questions still open.

### Next session

**M23f Styling pieces.** Settle its Done when first. The draft is "a player can place, move, turn and remove styling pieces and paint the hull in the builder, two taps each; they show on the blueprint and the solid hull wherever ships are drawn; no stat, rule or boarding map changes with them (tested); saves (a `SAVE_VERSION` bump) and blueprint codes (a new code version that still reads the old) carry them; and enemy ships wear some."

## M23d Sleek hulls (2026-10-13)

**Status:** done, and the ROADMAP.md box is ticked. Hulls aren't boxes any more: every ship's hull wraps its rooms in one of two styles, Rounded or Plated. The player picks one in the builder; enemy ships roll one.

One exception to flag first: in the Enemy ships sandbox at 960 × 825, the corvette and the hauler move at 2 to 13 fps under main's in headless Chromium (main manages 43 to 52 there). The builder's Hull view with a starter-sized ship, the hangar and the lift-off hold main's frame rate at all three sizes; a player's own ship as big as the corvette would cost in the Hull view what the sandbox's does. Details under Verified.

No phone results have come back yet for M14 to M23c.

**How the styles were picked:** first a shot of today's hulls everywhere one is drawn. Then one round of four mockups, drawn by the game's own renderer on the start ship and the three presets, outside and as the builder's rim, at the cover screen's size:
- A, Rounded: soft corners, a rounded shoulder, a bullet nose;
- B, Faceted: cut corners, one broad bevel, a sharp prow;
- C, Streamlined: one smooth skin, a low sweeping shoulder, a needle nose;
- D, Plated: cut corners, stepped armor, panel seams, a blunt prow.

Evan: "A and D as the options. Enemy ships are randomized on those two. You can build either."

Done when: "both styles are in data (`data/hulls.json`): Rounded, with rounded corners outside and in, a rounded shoulder and a bullet nose; and Plated, with cut corners, a stepped armor shoulder, panel seams on the roof and a blunt prow. In both, no outer corner of the outline is a plain right angle, and the hull covers every cell and never cuts into a room (tested). Nozzles, barrels and collars sit on the new skin, bevelled to match. The player picks the style in the builder, one tap, undoable, saved with the ship (`SAVE_VERSION` 16: older ships are Rounded) and carried by blueprint codes (version 3, which still reads 1 and 2). Every enemy ship gets one of the two at random, the same for the same seed, its layout unchanged (golden). The builder's rim and Hull view, the hangar, the lift-off and the Enemy ships sandbox all draw it. The builder's default view keeps every cell 22 px or more on the cover screen. The boarding maps don't change (golden), and the hull views keep to the frame budget at the three sizes."

- **Both styles in data:** `data/hulls.json`, checked by `tools/validate-data.js` (`tests/data.test.js`, 8 cases).
- **No plain right angle; every cell covered, no room cut into:** `tests/hullShape.test.js`.
  - Covered: in both styles, every corner of every cell is inside the hull at every height of its profile.
  - Corners: no outer corner of the outline turns 90° or more.
  - The ships: the example, the launched start ship, four odd shapes (a lone cell, a forked bow, a ring round a pocket, a diagonal touch) and the three presets at three seeds.
- **Nozzles, barrels and collars on the skin:**
  - Nozzles and collars sit on the hull's side, out past their cells (`tests/hullShape.test.js`), in housings round or eight-sided to match the corners.
  - Barrels ride the turret above the roof and reach past the side, as before.
- **Picked in the builder, one tap, undoable, saved:**
  - `tests/hullStyles.test.js`: the command, undo and redo, the log, the hangar's refit taking no parts.
  - By touch: the Ship tab's Hull buttons, Plated in one tap, the Hull view and the plans drawn Plated, Undo back to the very same Rounded drawing, Redo, a reload.
- **`SAVE_VERSION` 16:** a v15 save's ships (the builder's, the campaign's, an approach's enemy) open Rounded, the same on every load (`tests/hullStyles.test.js`; by touch too).
- **Codes, version 3:** carry the style; version 1 and 2 codes open Rounded; an unknown style opens Rounded (`tests/hullStyles.test.js`; by touch, a copied code and an old one pasted).
- **Enemy ships:** one of the two from their seed, the same every time, both seen over 20 seeds of each preset. The layouts are unchanged: `tests/golden/ships.txt` didn't change.
- **Where it's drawn:** by touch, the builder's plans and Hull view, the hangar, the lift-off and the Enemy ships sandbox, which also names the style.
- **Cells 22 px or more:** `tests/orbit.test.js`. The smallest on the cover screen is 23.2 px, with the camera's room grown for the widest margin and the longest nose.
- **Boarding maps:** the golden maps and replays didn't change.
- **Frame budget:** see Verified.

### Shipped

- **Hull styles as data** (`data/hulls.json`, new): Rounded and Plated. Each has:
  - a margin: how far out from the rooms the side stands (0.5 and 0.45 cells);
  - its corners: round or cut, their size outside (`outer`, and `stern` at the back), how much an inner corner eases (`inner`), and a rounded corner's most `steps`;
  - a `profile` from the roof's edge out and down to the side, as [out, up] pairs;
  - where the livery `stripe` runs on the side, whether its faces are `smooth` or outlined, and its `roof` (tinted plates, or panels with seams);
  - its `nose`: length from a base plus a share of the front's width, up to a most, the tip's height, rings from the hull to the tip, and `blunt` for a flat front.

  `tools/validate-data.js` checks them (`hullStyleProblems` in `src/render/hullShape.js`) and that "rounded", the default, is there.
- **The ship's style** (`src/sim/builder.js`):
  - a ship is `{ frame, hull, modules, nextUid }`, and `newShip` gives the default;
  - the `hull` command, `{ op: 'hull', style }`, restyles it, and is refused for a style there's none of;
  - the session's `build/hull` is one undoable step ("Plated hull.", "Undone: plated hull.");
  - a ship's log (`replay.js`) starts with its style when it isn't the default.
- **`SAVE_VERSION` 16** (`src/core/save.js`): every ship from before is Rounded: the builder's slots, the campaign's ship and an approach's enemy.
- **Blueprint codes, version 3** (`src/core/blueprint.js`): the style after the frame. Version 1 and 2 codes open Rounded, and so does a style this version doesn't have.
- **Enemy ships** (`src/sim/gen/ship.js`): a style picked from the seed on a stream of its own, so every layout is as it was.
- **The hull's shape** (`src/render/hullShape.js`, new), pure geometry:
  - the traced outline as loops of straight runs, moved out in contours, one per point of the profile;
  - outer corners rounded or cut, never into a cell; inner corners eased more the further out;
  - a rounded corner takes the steps its size needs, pieces 0.55 cells or shorter, up to its style's;
  - a nose on each run of the front column, carried forward from the hull's section there in rings, to a tip or a blunt front;
  - for the scenes: the bands of the shoulder and side, the nose's surfaces, and where a ray from a cell leaves the side.
- **Drawing it:**
  - **Outside** (`exterior.js`):
    - the bands in the hull's color, the livery stripe on the side;
    - each module's roof plate, Plated's framed by a seam;
    - the nose, Plated's with a dark flat front, with a window;
    - nozzles in housings, and turrets, round or eight-sided as the corners are;
    - collars and the stern's running lights on the side.

    The lift-off's flames come out of the new nozzles (`liftOff.js`).
  - **The blueprint's rim** (`shipScene.js`): the bands see-through, lines along the roof's edge and the side, the nose's surfaces and rings.
  - **The painter** (`painter.js`): a piece of a curved surface is drawn grown by half a pixel instead of outlined in its own color, which hides the seams for less than a stroke costs. Normals are by Newell's method (`solid.js`), so a band piece that narrows to a point lights right.
  - **The camera's room** (`hull.js` `OVERHANG`) grows for the widest margin and the longest nose a style may have.
- **The builder** (`shipPanel.js`, `drawer.js`, `view.js`, `style.css`):
  - a Hull group in the Ship tab, under Launch, with a 48 px button a style and the ship's own lit;
  - the Hull view's hint names the style and where it's set ("From outside: a Plated hull, set in the Ship tab. Tap Hull for the plans.").
- **The Enemy ships sandbox** names each ship's style in its info line, and Builder copies the ship with its style.
- **The drawer's tabs** are 48 px or more on short screens. Construction mode's Hangar was 45 px at 821 × 283, on main too.
- **Docs:** ROADMAP.md §4.1's auto-hull and M23d's Done when; CLAUDE.md's content and layout lists.
- **Tests:** 611 in all, up from 596:
  - the hull styles (`tests/hullStyles.test.js`, 8);
  - the hull's shape (`tests/hullShape.test.js`, 6);
  - the grown pieces (`tests/exterior.test.js`);
  - the data checks (8 cases in `tests/data.test.js`);
  - the tests that built ships without a style now expect one.

### Decisions made this session

- **Evan's call:** A and D, Rounded and Plated, from four mockups; both buildable, enemy ships rolled between them.
- **Mine:**
  - **Older ships are Rounded,** the default, in saves and codes.
  - **The style changes only the look.** Stats, rules and the boarding map stay the layout's (tested).
  - **The picker sits in the Ship tab, under Launch.** On the cover screen it is below the fold, a swipe away; the Hull view's hint says where it is. Launch and the checklist keep the top.
  - **Barrels kept their place:** they ride the turret above the roof and reach past the new side.
  - **An enemy's style comes from its seed on a stream of its own,** so no layout and no golden file changed.
  - **Frame cost:** the first build cost up to 2.4 times main's per Hull-view frame (Rounded, on the hauler: 17.2 ms against 7.3). Three changes brought it down, look kept:
    - curved pieces grown by half a pixel instead of outlined in their own color;
    - each corner only the steps its size needs;
    - no outlines on Plated's upright side, its shoulder steps keeping theirs.

### Verified here

- `node --test`: 611 pass. `node tools/validate-data.js`: OK. `data/balance.json` didn't change. No golden file changed.
- **M23d's check** (scratchpad `m23d/verify.mjs`), by touch at 905 × 370, 821 × 283 and 960 × 825: 25 of 25 at each size.
  - **The builder:** the Ship tab's Hull buttons, 48 px or more, Rounded pressed. One tap on Plated, and the Hull view and the plans draw it Plated. The hint names it. The slot saves it, the log keeps the step, and the parts stay as they were. Undo gives back the very same Rounded drawing, pixel for pixel; Redo, and a reload, keep Plated.
  - **Codes:** the copied code is `wtb.3.` and carries Plated. Pasted back, it opens Plated; a version 2 code opens Rounded.
  - **Construction mode at the hangar:** Plated in one tap, saved with the campaign's ship at once, no parts taken, undo and redo. The hangar draws it, and the lift-off plays with it.
  - **The Enemy ships sandbox:** for each preset, the style its seed gives is named on its first three seeds, and again when a seed comes round. Builder copies a Plated cutter with its style.
  - **A v15 save** opens as v16, its ships Rounded, the hangar drawn as before.
  - **Offline**, the builder draws the Plated ship.
  - No console errors or warnings.
- **Frame cost**, this branch against main on the same machine. This is headless Chromium drawing canvas in software, so the ratios mean more than the numbers.
  - **Per frame**, the real drawing code timed in the page over a full turn of the camera, median ms on the cover screen:

    | Ship | main | Rounded | Plated |
    | --- | --- | --- | --- |
    | Example (the builder's) | 4.1 | 5.2 | 5.6 |
    | Start ship, launch-ready | 4.5 | 5.2 | 6.1 |
    | Cutter | 4.4 | 5.9 | 7.2 |
    | Corvette | 11.1 | 13.6 | 15.5 |
    | Hauler | 7.5 | 9.7 | 11.7 |

    The lift-off: 5.3 ms on main, 6.4 Rounded, 7.4 Plated. The plans' ship (the example): 7.2, 8.6, 7.8.
  - **Faces:** the example has 479 on main, 739 Rounded and 619 Plated; the corvette 1,363, 2,034 and 1,767.
  - **Frame rate in the app while moving:** a finger circling on the Hull view and on the sandbox's Hull look for three seconds, and the lift-off as it plays. The middle of the half-second windows:
    - **905 × 370 and 821 × 283:** 60 fps everywhere, as on main, with the same odd dropped frame.
    - **960 × 825, two runs:** here headless Chromium misses 60 on main too.
      - Builder's Hull view: main 58 to 60; Rounded 58; Plated 60.
      - Lift-off: main 39 to 42; Rounded 39 to 42; Plated 39 to 40.
      - Sandbox cutter: main 52 to 54; Rounded 50 to 52; Plated 46 to 54.
      - Sandbox corvette: main 43 to 46; Rounded 39 to 41; Plated 41.
      - Sandbox hauler: main 52; Rounded 46; Plated 39 to 45.
  - **The lift-off frame by frame** at 905 × 370, three runs each: main 5 frames late of 844, Rounded 11 of 847, Plated 15 of 849. Main had a 283 ms stall in one run; the machine's noise is of that order.
- **Regressions,** one after another, after the last change, at 905 × 370, 821 × 283 and 960 × 825 unless named:
  - **M23c's check** (adapted in M23d, below): 25 of 25 at each size;
  - **M23's check** (as adapted in M23c): 36 of 36 at each size;
  - **M23b's check:** 8 of 8 at each size, with the new normals;
  - **M22's check** (as adapted in M23): 35 of 35 at each size;
  - **M21's check** (as adapted in M23): 32 of 32 at each size;
  - **M19's check** (as adapted in M22): 52 of 52 at each size;
  - **M20's check** (as adapted in M21): 32 of 32 at each size;
  - **M18's check:** 43 of 43 at each size;
  - **M17's check** (as adapted in M19): 37 of 37 at each size;
  - **M16's check:** 29 of 29 at each size;
  - **M15's check:** 30 of 30 at each size;
  - **M14's saves check:** 10 of 10 at 905 × 370;
  - **M13's check:** 24 of 24 at 905 × 370;
  - **M8's fight sandbox checks:** a whole fight played by touch at each size, with no console errors; the orders column at each size, every order and crew button 48 px or more; all 8 extras, offline included, with no console errors;
  - **M14's check:** 48 of 48 at 905 × 370, with a job of each kind played by touch.
- **Found by the checks and the measurements:**
  - **The first build cost up to 2.4 times main's** per Hull-view frame. Brought down as under Decisions.
  - **The picker is below the fold** on the cover screen: my first scripted tap missed it. It stays there; the check swipes to it as a player would, and the Hull view's hint points to it.
  - **A ship saved without a style** (my test kit's) showed neither button pressed. The picker now lights the style the ship is drawn in.
  - **The Hull view's hint was cut off** at 821 × 283. It's shorter now and fits at every size.
  - **Construction mode's Hangar tab was 45 px wide** at 821 × 283, on main too. Fixed.
  - **M23c's check** asked for exactly save version 15. Its copy (scratchpad `m23c/verify23d.mjs`) asks for 15 or later. Nothing else in it changed.

### Known issues

- **The Enemy ships sandbox at 960 × 825:** the corvette and the hauler move at 2 to 13 fps under main's in headless Chromium (39 to 46, against main's 43 to 52). What a player sees holds main's frame rate at all three sizes. A player's own big ship in the builder's Hull view would cost about what the sandbox's does. If the phone stutters there, the fix is to give the Hull view the plans' rough frames while it moves.
- **The Hull picker is below the fold on the cover screen**, under Launch in the Ship tab: a swipe brings it up.
- **Rounded's curves are facets:** a big corner takes 4 steps, a small one fewer, each lit flat. Up close they show.
- **The tab row on short screens** starts 8 px left of the drawer's content, to fit three tabs at 48 px.
- **The approach screen shows no hull:** it draws both ships as their boarding maps, as since M21. ROADMAP.md §9 has an outside view beside each map.
- **Ships from before are Rounded,** whatever their seed would roll now; that includes an enemy in an approach under way. It doesn't show: the approach draws maps.

### What to test on the phone (Galaxy Z Fold 6)

1. **The builder:** open the Ship tab, swipe down to Hull and tap Plated. Look at the plans' rim and the Hull view, then Undo and Redo. Is the picker easy enough to find?
2. **The hangar:** Build, pick a style in the Ship tab, then tap Hangar: is the hull in the new style?
3. **Launch:** the lift-off with the new hull. Do the flames come out of the nozzles?
4. **The Enemy ships sandbox** (dev): turn the corvette and the hauler in the Hull look, on the unfolded screen above all. Smooth?
5. **Both screens.**
6. **Tell me:**
   - which style you'd fly;
   - anything to change in either: corner size, the shoulder, the nose, the seams;
   - whether the Hull view turns smoothly;
   - and the M14 to M23c questions still open.

### Next session

**M23e Builder catalog and part variants.** Settle its Done when first. The draft is "at least 8 new parts, each doing something in play that no other part does as well, shown by `tools/approach.js`, `tools/sim.js` or the voyage player (Law 1); the drawer sorts parts into categories and filters them, two taps to place as now, every button 48 px or more; the shop sells them and enemy ships use some; and old saves and blueprint codes still load."

## M23c Portraits (2026-10-13)

**Status:** done, and the ROADMAP.md box is ticked. Every crew member has a face now: a helmet badge, drawn in code from a look saved with them.

No phone results have come back yet for M14 to M23b.

**How the style was picked:** one round of five mockups, each a completely different style with the same eight crew, up close, at the game's sizes and in place:
- A, Flat;
- B, Ink (comic book);
- C, Facet (low poly);
- D, Helmet badge;
- E, Holo (a crew manifest).

Evan: "D helmet badge. Go with recommendations on the rest". So:
- the captain's look is picked layer by layer and can be rolled;
- the start crew get names in new games, and old saves keep theirs;
- scars and implants earned in play wait (ROADMAP.md §9).

Done when: "every crew member has a helmet-badge portrait drawn in code from a look saved with them (face, skin, hair, hair color, eyes, beard and a mark), through the helmet their job wears in a fight, the same each time it is drawn; captain creation steps through each layer and rolls; recruits come with theirs, rolled with them, the same on every visit; new games name the start crew from the recruits' names and give them looks from the campaign's seed; saves carry the looks (`SAVE_VERSION` 15: older crews get theirs from their ids, the same on every load, their names kept); two crew aboard always differ in at least two layers; portraits show on the crew card (crew and recruits), the squad card, the fight's crew buttons and captain creation, with every button there 48 px or more at the three sizes; and the golden battle logs don't change."

- **A portrait from a look, the same each time:**
  - `tests/portraits.test.js`: every helmet the two suits have draws a well-formed badge, close up and as a face. The same look draws the same SVG every time, and every choice in every layer draws its own way.
  - By touch, the crew card's, the squad card's and the fight buttons' images are exactly what the game draws from each crew member's saved look. After a quit and reopen they are the same.
- **Through the helmet their job wears:** the marine's skinsuit fin, the engineer's EVA lamps, the medic's EVA bubble, from `data/jobs.json`. By touch, each job picked at captain creation shows a different helmet.
- **Captain creation steps each layer and rolls:** by touch, a tap on each of the 7 layers steps it to its next choice and the portrait follows. Roll rolls a new look. Start saves v15 with the look shown. `tests/looks.test.js` steps every layer round to where it began.
- **Recruits come with theirs:**
  - `tests/looks.test.js`: the look is rolled after the name, job and trait, the same on every visit, apart from the crew and each other, and kept when they sign on.
  - By touch, a recruit signed on kept the look offered.
- **New games name the start crew:**
  - `tests/campaign.test.js`: names from `data/recruits.json`, a look each, the same from the same seed.
  - `tests/looks.test.js`, over 200 seeds: a first name each, and looks apart.
  - By touch, the start crew were named from the list.
- **Saves:** `SAVE_VERSION` 15.
  - `tests/looks.test.js`: a v14 crew gets looks from the campaign's seed and their ids, apart and the same on every load, names kept. A crew member without a look, or with one that can't be drawn, is caught.
  - By touch, a v14 save opened as v15 with "Marine, Engineer, Medic" as they were, the same looks on the next load, and their portraits on the crew card.
- **Two layers apart:** `tests/looks.test.js`. Six crew rolled together over 300 seeds; the start crew of 200 new games; recruits against the crew; and migrated crews.
- **Where portraits show, buttons 48 px or more:** by touch at 905 × 370, 821 × 283 and 960 × 825: captain creation, the crew card, the squad card and the fight's crew buttons, every button 48 px or more and reachable.
- **Golden files:** none changed. `node --test` passes, the battle replays included.

### Shipped

- **Looks** (`src/sim/looks.js`, new): a look is a face (12 shapes) and an id in each of six layers:
  - skin, 9;
  - hair, 10;
  - hair color, 11;
  - eyes, 7;
  - beard, 5;
  - mark, 10: none, scar, freckles, tattoo, ports, a cyber eye, a jaw plate, an earring, an eye patch, or lines.

  The choices are drawings, so they live in code, where the sim rolls them and the save's migration can reach them.
  - `rollLook` rolls one, seeded, with weights: about half have no beard and no mark, and dyed hair is rare.
  - It rolls again, up to 20 times, if the look is less than `LOOKS_APART` (2) layers from anyone's.
  - `crewLook` gives a look from the campaign's seed and an id.
  - `stepLook` steps a layer.
  - `isLook` is the save's shape check.
- **The campaign** (`src/sim/campaign.js`):
  - New games name the start crew from `data/recruits.json`, a first name each and none the captain's. Each gets a look from the seed, the captain's first.
  - The captain brings the look picked.
  - Nothing moves the campaign's RNG.
  - The crew's shape check wants a look.
- **Recruits** (`src/sim/recruits.js`) roll a look last, from their own stream, apart from the crew aboard and the recruits before them. Signing on copies it.
- **`SAVE_VERSION` 15** (`src/core/save.js`): every crew member gets a look from the campaign's seed and their id, apart from those before them. Names stay.
- **Portraits** (`src/render/portraits/`, new), pure SVG text:
  - **`face.js`:** the face model, its 12 shapes set by hand, then the head, eyes, brows, nose and mouth, lit from the upper left.
  - **`hair.js`:** 10 hair styles as a cap and what falls behind or stands up, and 4 beards.
  - **`marks.js`:** the 9 marks.
  - **`badge.js`:** `portraitSvg` puts the face behind the helmet on an ID card in the trim, close up (`bust`) or closer (`face`).
    - EVA suits: a ball of glass on a neck ring (`bubble`, `lamps`, `bar`).
    - Skinsuits: a close shell with the face and hairline behind the visor (`egg`, `fin`, `crest`, `mirror`), its shell in the suit's color as on the figure.
  - **Colors:** `portraitColors` in `src/render/palette.js`.
- **The screens:**
  - **`src/ui/portrait.js`** (new) shows a portrait as an image from a data URL, so the SVG's ids stay its own. Each drawing is kept, up to 120.
  - **Captain creation** (`captain.js`):
    - the background is a line under the title;
    - the Look panel holds the portrait in the picked job's helmet, a button a layer with its choice ("Hair / Side part"), and Roll;
    - on the open screen the portrait stands big over the buttons.
  - **The crew card** (`crewCard.js`): a portrait each, aboard and for hire, the recruits in the trim of the place they would take.
  - **The squad card** (`squadCard.js`): a portrait in each pick, and the name cut short.
  - **The fight's crew buttons** (`panels.js`, `view.js`): the portrait beside the name, cut short, and hit points, with the state under them, in a column as wide as before. Campaign fights give each unit its crew member's look (`lookOf`); the Fight sandbox rolls the same three each time.
  - **The hangar's and map's crew panels** (`hubParts.js`) show the names cut short. On screens under 320 px tall they drop the job line too, so the panels show whole (`style.css`).
  - **Short names** (`src/ui/names.js`, new) for the fight's buttons, the squad card and the crew panels: a first name each. Where two share one, the initial of the rest is added ("Quill P.", "Quill A."); where the initials match too, the whole names show. The crew card, the log and the hints keep whole names.
- **Words** (`captainText.js`): every layer and choice in words, in the game's US spelling ("Hair color", "Gray").
- **Docs:**
  - ROADMAP.md: M23c's Done when, §4.5's portraits as built, and §9's scars earned in play;
  - CLAUDE.md: the portraits folder and the rule.
- **Tests:** 596 in all, up from 582:
  - the looks (`tests/looks.test.js`, 7);
  - the portraits (`tests/portraits.test.js`, 4);
  - the short names (`tests/names.test.js`, 2), over 500 crews drawn from the recruits' names too;
  - the look's words (`tests/captainText.test.js`);
  - the tests that named the start crew by their jobs now read the names.

### Decisions made this session

- **Evan's calls:**
  - the helmet badge, from five mockups;
  - "recommendations on the rest": the captain's look stepped or rolled, the start crew named in new games, scars earned in play later.
- **Mine:**
  - **The fight's crew column kept its width.** I told Evan it would grow about 20 px. Measured, that takes the cover screen's smallest fight tile from 48.3 px to 46.7, under the 48 px rule. The portrait is 28 px instead, beside the name.
  - **The look's choices are code,** in `src/sim/looks.js`. The save's migration runs without the content files and has to roll looks, and every choice is a drawing anyway.
  - **Short names** on the fight's buttons, the squad card and the hangar's and map's crew panels, where whole names were cut off ("Fen …", "Quill P…"). The start crew never share a first name. Recruits can share one with someone aboard, because they avoid only whole names, so those two show an initial. On screens under 320 px tall the panels drop the job line as well; the crew card has it.
  - **The hairline shows through a skinsuit's visor,** so a marine's hair color and fringe read. Under the shell the rest of the hair is hidden.
  - **The Fight sandbox's crew** get the same three rolled looks every time.

### Verified here

- `node --test`: 596 pass. `node tools/validate-data.js`: OK. `data/balance.json` didn't change.
- **M23c's check** (scratchpad `m23c/verify.mjs`), by touch at 905 × 370, 821 × 283 and 960 × 825: 25 of 25 at each size. It covers:
  - what the Done when's bullets above say;
  - two crew sharing a first name, told apart on the map's crew panel, the squad card and the fight's buttons ("Quill P.", "Quill A.");
  - offline: the portraits still draw with the network off;
  - no console errors or warnings.
- **Recruits as they were:** over 25 campaigns, every station of the first sector, 99 of 100 recruits have the same name, job and trait as on main. The other drew a name a start crew member now has, and was rolled again, as M23's rule says.
- **The fight's tiles:** the smallest at the opening view is 48.3 px at 905 × 370, as on main.
- **Regressions,** one after another, after the last change (the short names, below), at 905 × 370, 821 × 283 and 960 × 825 unless named:
  - **M23's check** (as adapted in M23c, below): 36 of 36 at each size;
  - **M23b's check:** 8 of 8 at each size;
  - **M22's check** (as adapted in M23): 35 of 35 at each size;
  - **M21's check** (as adapted in M23): 32 of 32 at each size;
  - **M19's check** (as adapted in M22): 52 of 52 at each size;
  - **M20's check** (as adapted in M21): 32 of 32 at each size;
  - **M18's check:** 43 of 43 at each size;
  - **M17's check** (as adapted in M19): 37 of 37 at each size;
  - **M16's check:** 29 of 29 at each size;
  - **M15's check:** 30 of 30 at each size;
  - **M14's saves check:** 10 of 10 at 905 × 370;
  - **M13's check:** 24 of 24 at 905 × 370;
  - **M8's fight sandbox checks:** a whole fight played by touch at each size, with no console errors; the orders column at each size, every order and crew button 48 px or more; all 8 extras, offline included, with no console errors;
  - **M14's check:** 41 of 41 at 905 × 370, with a job of each kind played by touch. The count depends on the jobs dealt, from a new seed each run (48 in M23b).

  After these, only a comment in `style.css` changed, and with it `sw.js`'s version. M23c's check passed 25 of 25 at 905 × 370 again, offline included.
- **Found by the checks and the screenshots:**
  - **M19's check at 821 × 283:** "the crew and ship panels show whole" failed. The start crew's rows in the hangar's and map's crew panels had become two lines, a name with the job under it, where "Marine" alone had been one, and the crew panel ran off the screen. Under 320 px of height the rows are names alone now. 52 of 52 after.
  - **M23's check** asked for the start crew by their jobs ("Going: Engineer, Medic…") and for a v13 save to open as v14. Its copy (scratchpad `m23/verify23c.mjs`) reads the names from the save and asks for v14 or later. Nothing else in it changed.
  - **The last screenshots:** the squad card cut names off at 905 × 370 ("Fen …", "Quill P…"), with the portrait taking room. Recruits avoid only whole names aboard, so a fight could also show two "Fen" buttons. Fixed with the short names, and M23c's check gained the case. Every check above ran after it.

### Known issues

- **Hair hides under a skinsuit:** a marine shows only the hairline and color, so stepping Hair changes little you can see on one.
- **The 12 face shapes are close at 28 to 40 px.** Skin, hair, beard and marks do the telling apart there; the faces differ most at captain creation's size.
- **Trims can differ between the crew card and a fight.** The card trims by place in the crew; a fight trims by place in the squad, as since M23.
- **Captain creation at 821 × 283:** the Look panel scrolls, as the others do there, with Mark and Roll below the fold.
- **Short screens drop the jobs from the side panels:** at 821 × 283 the hangar's and map's crew panels show names alone. The crew card has the jobs.
- **One recruit in 100 changed** from main's, because the start crew now draw names from the same list.
- **Old saves keep crew named by their jobs.** Only new games name the start crew.

### What to test on the phone (Galaxy Z Fold 6)

1. **New game:** step each layer, Roll, and switch jobs: does the helmet follow? Start.
2. **The hangar:** first names in the crew panel.
3. **Act 2, at a station:** the crew card's portraits, a recruit signed on, and the squad card before a boarding. A recruit sharing a first name with someone aboard shows an initial ("Quill A.").
4. **A fight:** the crew buttons with portraits. Are the faces readable at that size?
5. **Both screens,** captain creation especially.
6. **Tell me:**
   - anything to change in the badge: the card, the glass, the trim;
   - whether faces read in the fight;
   - whether captain creation is clear;
   - and the M14 to M23b questions still open.

### Next session

**M23d Sleek hulls.** Settle its Done when first. The draft is "no outer corner of a hull is a plain right angle; the start ship and the three presets show curved noses and sloped edges outside the builder; the hull still covers every cell and never cuts into a room; the boarding maps don't change (golden); and the hull views keep to the frame budget at the three sizes."

## M23b Character figures (2026-10-13)

**Status:** done, and the ROADMAP.md box is ticked. The units in every fight are people in spacesuits now, in two suits Evan picked from two rounds of mockups.

No phone results have come back yet for M14 to M23.

**How the suits were picked:**
- **Round one,** three styles on one skeleton: trooper, void suit, lean. Evan: "Try again. I want better looking spacesuits. Give me some mockups of the variants I could choose. Make the designs all completely different."
- **Round two,** five designs: classic EVA, assault armor, skinsuit, industrial hardsuit and deep diver. Each was shown up close, at the fight camera's angle, and in the real fight at the cover screen's size. Evan: "Well do both classic Eva and skinsuit. Which should add variety to the game as well."
- **So both sides wear both.** Each job and enemy type is in one suit, with a build, helmet, back and marks of its own.

Done when: "every crew job and every enemy type has a figure of its own in one of the two suits, set in data, and told apart at the cover screen's tile size (each pair on a side differs in at least a fifth of their pixels there, seen from the front, the side and behind); a move walks, a shot aims and a unit that goes down falls; the fight keeps to the frame budget at the three sizes, holding the frame rate main holds in Chromium while the enemy's turn plays out; and the golden battle logs don't change (it is drawing only)."

- **Told apart** (`tests/figures.test.js`): every figure is filled into pixels at the cover screen's size, 48 CSS px a cell at 2 device px each, from the front, behind and the side.
  - The closest crew pair, the engineer and the medic, differ in 44% of their pixels, drawn in the same trim.
  - The closest enemy pair, the scavver and the company guard from behind, differ in 33%.
  - The same measure in Chromium, with the outline and smoothing: 47% and 27%.
- **A move walks, a shot aims, a unit falls:**
  - `tests/playback.test.js`: a stride to every two tiles, the walker only. A unit aims while it shoots and from the moment it goes on overwatch. It falls through a down or dead event, quicker as it goes.
  - `tests/figures.test.js`, for every job and enemy type: the feet stride apart and come back together; aimed, the weapon reaches further ahead; fallen, the figure lies along the way it faced, under 0.45 cells high, its weapon on the deck.
  - By touch in the Fight sandbox at the three sizes (`m23b/verify.mjs`, below): every unit is drawn where it stands. A walk makes new stride drawings, and its frames change as it goes. Overwatch changes the unit's figure.
  - On video: a whole fight played by touch at 905 × 370, sent to Evan in the session. Units walk, aim, go down and lie grey.
- **The frame budget:** Chromium on this machine, unthrottled, while the enemy's turn plays out. Old figures are main's, three runs at 905 × 370 and two at the other sizes; new figures are three runs at each size.

  | Size | Frames a second, old / new | Slowest half second, old / new | Drawing a frame (median), old / new | Full frame (median), old / new |
  | --- | --- | --- | --- | --- |
  | 905 × 370 | 60 / 60 | 54–58 / 56–60 | 2.7–4.8 / 3.4–3.5 ms | 8.7–10.2 / 10.4–11.2 ms |
  | 821 × 283 | 60 / 60 | 58–60 / 58–60 | 3.8–4.4 / 4.0–4.5 ms | 6.8–7.6 / 7.0–9.5 ms |
  | 960 × 825 | 58 / 58–60 | 45–46 / 37–48 | 2.8–3.9 / 3.8–4.8 ms | 10.5–11.2 / 11.6–12.2 ms |

  The worst full frame is a few ms dearer with the new figures, 14.5 to 19.9 ms against 10.3 to 18.8. A new figure drawing costs about 3 ms here and lands in some frames.
- **Golden files:** none changed. `node --test` passes, the battle replays included.

### Shipped

- **Figures** (`src/render/figures/`, new):
  - **`looks.js`:** what can be drawn:
    - two suits, `eva` and `skinsuit`;
    - three builds, light, standard and heavy;
    - each suit's choice of helmet, back and marks;
    - a weapon's held shape: its length, the height of its body, its bore, and one hand or two.

    The validator checks the data against it.
  - **`bones.js`:** a skeleton for each suit and build, in the figure's own frame. Two-bone arms reach the weapon and two-bone legs reach the deck. Poses:
    - at the ready, the weapon across the body;
    - aimed, at the shoulder;
    - a pistol held low at the side, or out in both hands;
    - the walk's stride;
    - the hands letting go as it falls.
  - **`eva.js`:** the classic EVA suit:
    - a puffy suit, ringed at the joints, with a hard chest and its controls;
    - helmets: `bubble` (a dark visor with a glint), `lamps` (and two lamps) or `bar` (a band of light);
    - backs: `life`, `tools` (a mast and a tool rack), `tanks`, `junk` (scrap strapped on), `med` (a slim pack marked with a plus) or `none`;
    - marks: `plain`, or `stripes` round the arms and legs.
  - **`skinsuit.js`:** the skinsuit:
    - slate under plates in the suit's color, with seams of light in the trim;
    - helmets: `egg` (a visor that wraps round), `fin`, `crest` or `mirror` (a dark visor);
    - backs: `spine`, `jump` (a jump pack, its nozzles lit) or `none`;
    - marks: `seams`, or `plates` (shoulder plates in the trim).
  - **`weapon.js`:** the weapon from its held shape: a stock, a body with a magazine and sight, and a barrel; a pistol is a body and a grip.
  - **`figure.js`:**
    - dresses the skeleton in its suit, turns it to face its way and stands it on its tile;
    - falling, it tips over backward about the heels, which slide ahead so it ends lying on its own tile; it rests on its pack, never through the deck, and its weapon drops beside it;
    - `detail` thins out round parts for small figures, but a helmet keeps its rings.
  - **`shapes.js`:** boxes, rods, plates, tubes, rings, turned surfaces, balls and domes.
  - **`sprites.js`:** each figure is drawn once and kept.
    - **Why:** a figure is 400 to 700 faces. Drawn as faces, seven of them cost 20 to 50 ms a frame here, against 0.3 ms for the stand-ins.
    - **What is kept:** a drawing in a canvas of its own for each look, colors, pose step, facing, viewing angle and size. It is reused until any of them changes.
    - **Perspective:** each figure is seen from its own angle along the camera's ray to it. Its drawing is turned to the way up looks where it stands, and scaled to its size there.
    - **Steps:** angles to 5.6° (3.75° above), sizes to 8%, the aim in quarters, the walk in eighths of a stride, the fall in tenths.
    - **The outline** is the figure's drawing copied out a little all round and tinted, under the figure. Stroking its faces cost five times the painting.
    - **The budget:** new drawings stop once 2 ms are spent in a frame. A figure waiting shows its last drawing, and the board draws again soon after.
    - **Memory:** the oldest drawings go past 24 MB.
- **The painter** (`src/render/painter.js`): `paintSolid` takes items, drawn whole in the depth order of the faces, so a wall in front of a figure still hides it. `drawOrder` gives that order.
- **The board** (`src/render/battleView.js`) draws the actors' figures through the cache, at the full frame's pixel ratio even in a rough frame.
- **Units** (`src/render/units.js`):
  - `unitsScene` gives the figures to draw, with each unit's look, held shape, colors and pose. The stand-in boxes and cylinders are gone.
  - `colorsOf` picks the colors:
    - the crew pale, each trimmed in their own color;
    - boarders rust and orange;
    - the out and the dead grey;
    - a unit just hit in the tracer's color.
  - `UNIT_TOP` is 0.8, and the new `LYING_TOP` 0.36 sets the tap area and labels of a unit lying down.
- **Playback** (`src/render/playback.js`): `poseAt(unit, frame)` gives a unit's pose at a frame.
- **The fight** (`src/ui/fight/view.js`):
  - each unit's figure carries its look, its weapon's held shape and its pose, in the steps it is drawn in, so the board draws again only when a step changes;
  - a falling unit turns as it goes to the way it will lie: the crew along the ship, boarders across it.
- **Palette** (`src/render/palette.js`): 10 tokens for the slate under a skinsuit, the boarders' darks, visor glass, lamps, the gun, the outline and the greys of the fallen.
- **Data:**
  - each job and enemy has a `look` (`data/jobs.json`, `data/enemies.json`), and each weapon a `held` shape (`data/weapons.json`);
  - who wears what is in Decisions below;
  - the validator checks both against `looks.js`.
- **Docs:** ROADMAP.md (M23b's Done when and a Figures entry in §4.3) and CLAUDE.md (the figures folder, the looks in data, and the kept drawings beside the no-sprite-sheets rule).
- **Tests:** 582 in all, up from 569:
  - the figures (`tests/figures.test.js`, 12): every job and enemy in every pose is flat faces with unit normals in palette colors, within its tile, never through the deck; the visor looks the way the figure faces; aiming, walking and falling as above; every look its own and drawable, both suits on both sides; the kept drawings' steps, reuse, outline, budget and memory; the painter's items in depth order; told apart at the cover screen's size;
  - the pose at a frame (`tests/playback.test.js`, 1);
  - units as figures, lying and grey, and the hit's flash (`tests/units.test.js`, rewritten);
  - 7 more mistakes the validator names (`tests/data.test.js`).

### Decisions made this session

- **Evan's calls:** two suits, the classic EVA and the skinsuit, for variety; from round two of the mockups, after round one was turned down.
- **Mine:**
  - **Who wears what** (data, quick to change):

    | Who | Suit | Build | Helmet | Back | Marks | Weapon |
    | --- | --- | --- | --- | --- | --- | --- |
    | Marine | skinsuit | standard | fin | spine | plates | rifle |
    | Engineer | EVA | standard | lamps | tools | stripes | shotgun |
    | Medic | EVA | light | bubble | med | stripes | pistol |
    | Pirate | skinsuit | standard | crest | none | plates | carbine |
    | Pirate brute | skinsuit | heavy | egg | spine | plates | shotgun |
    | Scavver | EVA | light | lamps | junk | plain | pistol |
    | Claim jumper | skinsuit | light | fin | jump | seams | carbine |
    | Company guard | EVA | standard | bar | life | stripes | rifle |
    | Hired heavy | EVA | heavy | bar | tanks | plain | shotgun |
    | Recovery agent | EVA | light | bubble | none | stripes | carbine |

    The pirate, the jumper and the agent were the closest pair at first. Shoulder plates for the pirate, a fin for the jumper, and an EVA suit for the agent pulled them apart. The skinsuit's `mirror` helmet is unused for now.
  - **The medic's mark is a plus in the crew's trim,** not a red cross on white, which is a protected emblem.
  - **Enemies keep their side's colors** (ROADMAP's "in their side's colors"), so enemy types are told apart by shape alone.
  - **Overwatch aims at once,** rather than raising the weapon over the event: animating it cost a repaint every frame for no gain.
  - **Out of the five round-two designs,** the three not picked (assault armor, industrial hardsuit, deep diver) are in `src/render/figures.js` in commit 6c98737, the first on PR #37, if any is wanted later.

### Verified here

- `node --test`: 582 pass. `node tools/validate-data.js`: OK. `data/balance.json` didn't change, so `node tools/sim.js` wasn't needed.
- **M23b's check** (scratchpad `m23b/verify.mjs`), by touch in the Fight sandbox at 905 × 370, 821 × 283 and 960 × 825: 8 of 8 at each size.
  - Every unit's figure is drawn where it stands, in its side's colors, and an empty floor tile has none.
  - A still board makes no new drawing in a second and a half.
  - A walk of three or more tiles makes new stride drawings, its frames change as it goes, and the walker stands where it stopped.
  - Overwatch changes the unit's figure: it aims.
  - No console errors or warnings.
- **The frame budget** (scratchpad `m23b/perf2.mjs`): the table above. In the Fight sandbox it ends the crew's turn three times and reads the dev overlay while each enemy turn plays out. Main's side runs from a worktree of `origin/main`.
- **Told apart in Chromium** (scratchpad `m23b/apart.mjs`): the figures drawn by the game at the cover screen's size, outline and smoothing included, and measured as the test does.
- **Regressions,** one after another, after the last change (the `sw.js` file list, below), at 905 × 370, 821 × 283 and 960 × 825 unless named:
  - **M23's check:** 36 of 36 at each size;
  - **M22's check** (as adapted in M23): 35 of 35 at each size;
  - **M21's check** (as adapted in M23): 32 of 32 at each size;
  - **M19's check** (as adapted in M22): 52 of 52 at each size;
  - **M20's check** (as adapted in M21): 32 of 32 at each size;
  - **M18's check:** 43 of 43 at each size;
  - **M17's check** (as adapted in M19): 37 of 37 at each size;
  - **M16's check:** 29 of 29 at each size;
  - **M15's check:** 30 of 30 at each size;
  - **M14's saves check:** 10 of 10;
  - **M13's check:** 24 of 24;
  - **M8's fight sandbox checks:** a whole fight played by touch at each size, with no console errors; the orders column at each size, every order and crew button 48 px or more; all 8 extras, offline included, with no console errors;
  - **M14's check:** 48 of 48 at 905 × 370, with a job of each kind played by touch. The count depends on the jobs dealt (39 in M23).

  None of the old checks needed changing.
- **Found by the checks:** `sw.js` still listed the WIP commit's `src/render/figures.js` and not the new folder until `tools/precache.js` ran, so the service worker didn't install and the older checks failed at their offline steps. The pre-commit hook runs it. I ran it by hand and ran every check again.

### Known issues

- **Phone cost unknown.** A new figure drawing costs about 3 ms in headless Chromium. Each frame draws at most about one. Full frames are about 1 ms dearer at the median than main's, and up to a few ms at the worst.
- **The first frame of a fight** draws every figure at once, about 30 ms here for ten.
- **One long frame, not explained:** in the recorded fight, the dev overlay's worst gap read 233 ms early in the enemy's first turn. The timing runs, which don't record, never saw more than 50 ms. Recording may be the cause, but that isn't shown.
- **While pinching or twisting the camera,** a figure can show a drawing a step off in angle or size for a frame or two.
- **Enemy types share colors,** so they are told apart by shape: suit, build, helmet and pack. From behind, the scavver and the company guard are the closest.
- **Lying figures in EVA suits rest on their packs,** up to about 0.4 cells high where the stand-ins lay at 0.15. Labels and the tap area for lying units moved up to suit.
- **Only the poses above.** A hit is the old flash, and reloading, stabilizing and opening a door have no poses of their own.
- **Kept drawings take up to 24 MB.**

### What to test on the phone (Galaxy Z Fold 6)

1. **Any fight:** the Fight sandbox, a job or a boarding.
2. **The figures:** do they look like spacesuits now? Can you tell the marine, engineer and medic apart, and each kind of enemy?
3. **Walk:** order a move. Do the legs stride, and does it turn at corners?
4. **Aim:** Overwatch raises the weapon at once. A shot aims it at the target.
5. **Fall:** a unit going down tips over backward and lies on its tile; out or dead, it lies grey.
6. **Smoothness:** the enemy's turn, the first frame of a fight, and pinching and twisting the camera. Turn on `?dev=1` for the frame line: "moving N full M rough".
7. **Both screens,** and zoomed in, where the detail shows.
8. **Tell me:**
   - which looks to change (each is one line of data);
   - whether the enemy types are easy enough to tell apart;
   - any stutter;
   - and the M14 to M23 questions still open.

### Next session

**M23c Portraits.** Settle its Done when first. The draft is "every crew member has a portrait, the same each time it is drawn; captain creation picks the captain's look; recruits come with theirs; looks are saved with the crew (a `SAVE_VERSION` bump, older crews given theirs from their ids, the same on every load); and the screens that show them keep their buttons 48 px or more."

## Plan: looks and the catalog before refits (2026-10-13)

**Status:** planned; nothing is built yet. After M23 merged, Evan asked for better characters, sleeker ships and a bigger builder before the milestones already planned. ROADMAP.md §7 now has six milestones before refits, M23b to M23g. Refits at stations moves from M23b to M23h; the M23 entry below still calls it M23b.

**What Evan asked for:**
1. **Characters:** they are stand-ins, not characters yet; better character models.
2. **Ships:** in the builder, the shop and enemy ships they look blocky, with too many straight lines and right angles. More curves and diagonal edges, to look more futuristic.
3. **The builder:** categories and filters, parts that are only for looks, and more variants of today's parts.

**Evan's calls:**
- **Looks-only parts:** "Styling pieces, Law 1 kept". Styling attaches outside the ship's rooms, has no stats, never changes the boarding map, has a cap of its own and is saved with the ship. Law 1 now says styling isn't a module (ROADMAP.md §1).
- **Curves:** "Both". Every hull gets smoother on its own, and shaped styling pieces sculpt it further.
- **Characters:** "3D figures plus portraits".
- **Variants:** "Both". Size and stat variants of the parts, and a second manufacturer.

**What I flagged:**
- **Law 1 as written would cut looks-only parts.** Settled above.
- **The curves are on the outside only.** The rules stay on the square grid (§3) and the ship is the boarding map (Law 2), so rooms and fights keep their square tiles. The approach screen draws both ships as their boarding maps, so it stays square (ROADMAP.md §9).
- **More faces for the painter to sort every frame.** Each milestone keeps the fight and the hull views within the frame budget at the three sizes. In M23's regressions the fight drew in about 4 ms of its 16 at 905 × 370.

**The order, one a session:**
1. M23b Character figures
2. M23c Portraits
3. M23d Sleek hulls
4. M23e Builder catalog and part variants
5. M23f Styling pieces
6. M23g A second manufacturer
7. M23h Refits at stations, then M24 Heat v2

The Done whens in ROADMAP.md §7 are drafts, to settle as each milestone starts.

### What to test on the phone

Nothing new: M23's list below still stands.

### Next session

**M23b Character figures.** Settle its Done when first. The draft is "every crew job and every enemy type has a figure of its own, told apart at the cover screen's tile size; a move walks, a shot aims and a unit that goes down falls; the fight keeps to the frame budget at the three sizes; and the golden battle logs don't change (it is drawing only)."

## M23 Recruits, crew management, med bay healing (2026-10-13)

**Status:** done, and the ROADMAP.md box is ticked. Evan said "Start the next milestone" and answered four questions before I settled the Done when:
- refits get their own milestone after this one (M23b, now in ROADMAP.md §7);
- a squad of 3, which the player picks;
- the med bay heals 1 a jump, 2 with a medic aboard;
- recruits come from stations, for a fee.

No phone results have come back yet for M14 to M22.

Done when: "recruits sign on at stations for a fee, two taps, up to the ship's berths and life support: each station offers 2, rolled from data (a name, a job, a trait), the same on every visit; before a boarding the player picks a squad of up to 3, the three healthiest unless changed, and the rest sit out; the crew card lists everyone's job, traits and hit points and lets anyone but the captain go, two taps; a working med bay heals each wounded crew member 1 hit point a jump, 2 with a medic aboard (a long jump counts 3), and a wrecked one heals nothing; the builder's part card says what quarters, life support and the med bay do on the run; and the careful test player, signing recruits on only while the holds would last 10 jumps with them aboard, still crosses all five sectors fed in at least 24 of 30, and with a med bay fitted patches fewer hit points than without (Law 1)."

The last clause changed during the session. As I first put it to Evan, the test player hired "when its credits allow". That starved it (below), so it now hires only where the holds would last 10 jumps with the recruit aboard.
- **Recruits:**
  - `tests/crew.test.js`: a station offers 2 from the data, whatever the campaign's RNG holds, so the same on every visit. Signing one on takes the fee and a berth and leaves the other as it was.
  - By touch: Sign on took two taps, the first changing nothing. The berths and life support stopped a fifth. After a quit and reopen the station offered the same recruit.
- **The squad:**
  - `tests/crew.test.js`: with four aboard, a boarding takes the picked squad, or else the healthiest three. Whoever sits out keeps their hit points through the fight.
  - By touch: Squad picked who went, three at most and one at least. Board her took the pick, and Fight them off the healthiest.
- **The crew card:** by touch, it lists everyone's job, traits and hit points. Let go took two taps and had no button for the captain. `tests/crewText.test.js` checks the words.
- **The med bay:**
  - `tests/crew.test.js`: 1 a jump, 2 with a medic aboard, 3 times that for a long jump, after hunger. A wrecked bay heals nothing.
  - By touch: the Ship panel showed "Med bay 2 a jump", the jump picked said what it heals, and the jump healed the wounded marine 4 to 6.
- **The part card:** `tests/builderText.test.js`, and by touch in the builder.
- **The careful test player** (`tests/voyage.test.js`):
  - Start ship: fed all the way in 26 of 30, signing no one on.
  - With a cargo hold fitted: fed in 29 of 30, signing on in 15.
  - With a med bay fitted: it patched 0 hit points at the median, against 9 without (Law 1).

### Shipped

- **Recruits** (`src/sim/recruits.js`; ROADMAP.md §4.5):
  - **The offer:** each station offers 2 (`recruitOffer`). Each is a name from the new `data/recruits.json`, any job and one trait, at full health.
  - **Rolled on its own:** the roll uses the campaign's seed, the sector and the station, not the campaign's RNG. A station offers the same recruits on every visit, and no other roll moves. A name already aboard is rolled again.
  - **Signing on:** 50 credits (`recruitFee`), while the crew is under the ship's room. The room is its berths or its life support, the fewer (`src/sim/crew.js` `crewRoom`), which is 4 on the start ship. `run.hired` keeps who has signed on in the sector.
  - **Letting go:** at a station, anyone but the captain, with nothing paid back. Neither can happen while an event or an approach holds the ship.
- **The squad** (`src/sim/crew.js`, `src/sim/encounter.js`): a boarding takes up to 3 (`squadSize`), the crew ids the player picked or else the healthiest. Ties go by crew order. The fight lists who fought. The rest keep their hit points.
- **The med bay** (`src/sim/medbay.js`, `src/sim/travel.js`):
  - **The rate:** a working bay's `heal` (1, `data/modules.json`), plus the best job's `station.heal` aboard (the medic's 1, `data/jobs.json`).
  - **When:** each jump heals each of the wounded that much, after hunger, up to their most. A long jump counts `longJumpFactor` (3), and leaving a sector counts as a jump.
  - **What the plan says:** jump and leave plans carry `heal`, and the flags count `hpHealed`.
- **Data:**
  - `data/recruits.json` (new): 24 first names, 24 last.
  - `data/balance.json`: `recruitFee` 50, `recruitOffer` 2, `squadSize` 3.
  - `data/modules.json`: the med bay's `heal` 1.
  - `data/jobs.json`: the medic's `station: { heal: 1 }`.
  - **The validators** check all of these: name lengths and repeats, the ranges, `heal`, and a `station` on jobs only.
- **The screens:**
  - **The sector map** (`sector.js`):
    - **The crew panel** opens the crew card (`crewCard.js`, words in `crewText.js`). A button lies over the whole panel. With recruits for hire and room, the panel lights and its heading says "Crew · 2 for hire".
    - **The crew card** lies over the chart, as the event card does. It lists everyone aboard, then at a station who is for hire, side by side where they fit. It says the room and what the med bay heals.
    - **Sign on and Let go** each take two taps. The first tap's words go in the foot: "Sign Rhea Oduya on for 50 credits. A crew of 4 eats 4 supplies a jump, and full holds last 7 jumps. Tap again to sign on."
    - **The station's hint** names the recruits when nothing more pressing is there: "2 recruits want a berth here: tap Crew."
    - **The Ship panel** shows "Med bay 2 a jump" while one works. A jump picked says "The med bay heals each of the wounded 2 on the way." when anyone is hurt.
  - **The approach** (`approach.js`): when a boarding is due and more are aboard than a squad takes:
    - Squad · 3 of 4 stands beside Board her, and opens the squad card (`squadCard.js`) over the ships;
    - a tap takes someone or leaves them aboard, a pick spends nothing, and the card says why when a tap changes nothing;
    - the column's last line says who goes and who sits out.
  - **The builder's part card** (`src/ui/builder/card.js`) has a line for what quarters, life support and the med bay do on the run. The shop's two lines are as they were.
- **`SAVE_VERSION` 14:** `run.hired`. From v13 it is empty. The shape checks catch a hire at a node not yet seen, or the same one twice.
- **Tools:**
  - **`node tools/voyage.js`** signs recruits on at stations (`hireWho` in `tools/voyagePlan.js`). It does so only with room aboard, the holds lasting `HIRE_JUMPS` (10) jumps with one more, and the fee leaving a holdful's price.
  - **`--fit cargo,medbay`** fits parts to the launched ship first.
  - **The summary** has a line for the crew signed on and the med bay's healing.
  - **Each launch is worked out once** (`launchedAt`), so the voyage test runs its four sets of 30 in 48 s where it would take 130.
- **Tests:** 569 in all, up from 551:
  - the crew rules (`tests/crew.test.js`, 8): offers, signing on, letting go, the squad and the boarding, the med bay and leaving a sector, the actions and save v14;
  - the words (`tests/crewText.test.js`, 7): the crew card at a station and away, a full ship and short credits, the station's hint, the med bay lines, the squad picker;
  - the part card's run lines (`tests/builderText.test.js`);
  - 7 more mistakes the validator names (`tests/data.test.js`);
  - the voyage test's step checks for hires and healing, and two Done-when tests: recruits with a cargo hold, and the med bay against patching.
- **Golden files:** none changed. The recruit rolls stand apart from the campaign's RNG.

### Decisions made this session

- **Evan's calls:**
  - **Refits:** "Keep M23 tight, refits next". M23b Refits at stations follows in ROADMAP.md §7, and the refits line left §9.
  - **Squad:** "Squad of 3, you pick".
  - **Med bay:** "1 a jump, 2 with a medic aboard".
  - **Recruits:** "Stations, for a fee".
- **Mine,** with no word from Evan:
  - **The offer:** 2 a station, each any job with one trait at full health. The fee is flat: 50, what a crew of 4 eats in 12 jumps.
  - **The room is the berths or the life support, the fewer,** the flight checklist's two crew lines.
  - **Letting go happens at stations only,** with nothing paid back, and never the captain.
  - **The default squad is the most hit points,** crew order breaking ties. Whoever sits out keeps their hit points and heals with the rest. Sitting out doesn't heal any faster.
  - **The pick isn't saved until the fight begins.** Fight them off takes the squad too, though it is one tap. The pick is on the approach screen, so a quit before the fight reopens with the healthiest.
  - **The medic's station effect counts only with a working med bay.** The best bay and the best healer count; a second of either adds nothing. Healing comes after hunger, and a long jump counts 3, as its supplies do.
  - **The test player's hiring rule** (`HIRE_JUMPS` 10), and with it the Done when's last clause:
    - **First tried:** hiring whenever the fee left a holdful's price dropped the careful player from 26 of 30 fed to 19.
    - **Why:** the start ship's 30 lockers last a crew of 4 only 7 jumps, and a station is sometimes further off than that.
    - **The rule:** hire only where the holds last 10 jumps with the recruit aboard, which the lockers alone never do. The cargo set shows hiring, at 29 of 30 fed.
  - **The crew card's way in is the crew panel,** lit while recruits are for hire, with the station's hint pointing there. The first tap's words go in the foot as the map's other two-tap orders do, so the card keeps its room for the lists. Done is the quiet button. Sign on's first tap and Board her are the bright ones.
  - **The part card's run line sits after the stats,** so the shop's two-line summary is unchanged.

### Verified here

- `node --test`: 569 pass. `node tools/validate-data.js`: OK.
- **`node tools/sim.js`** (run because `data/balance.json` changed; `recruitFee`, `recruitOffer` and `squadSize` aren't used in the harness's fights, so the summary is M11's):
  ```
  All               1,000  49% (46–52)           41%        10%  7 (5–11)           28
  Shots: 23,504, 23.5 a fight. Hit: crew 57%, boarders 40%.
  A fight: 1.8 crew go down, 0.9 bleed out, 2.8 boarders die.
  ```
- **`node tools/voyage.js --runs 30 --long never`** (campaign seeds 1 to 30, each launched from its act 1 test run; the Done when's careful player):
  ```
  start ship:
  Sectors crossed: 5 (5 to 5); 30 of 30 reached the end of the charts; fed all the way in 26 of 30.
  At stations: patched 9 (0 to 32) hit points for 18 (0 to 64) credits; 0 (0 to 1) repairs for 0 (0 to 50) credits. Crew at the end: 23 (3 to 26) hit points.
  Crew: signed on 0 (0 to 0) for 0 (0 to 0) credits, 0 of 30 runs; 3 (3 to 3) aboard at the end. The med bay healed 0 (0 to 0) hit points.

  --fit cargo:
  Sectors crossed: 5 (5 to 5); 30 of 30 reached the end of the charts; fed all the way in 29 of 30.
  Hostile ships: [...] Lost a boarding at home: 9 of 30; dragged past 40 rounds: 0.
  Crew: signed on 0 (0 to 1) for 0 (0 to 50) credits, 15 of 30 runs; 3 (3 to 4) aboard at the end. The med bay healed 0 (0 to 0) hit points.

  --fit medbay:
  Sectors crossed: 5 (5 to 5); 30 of 30 reached the end of the charts; fed all the way in 26 of 30.
  At stations: patched 0 (0 to 18) hit points for 0 (0 to 36) credits; 0 (0 to 2) repairs for 0 (0 to 100) credits. Crew at the end: 26 (25 to 26) hit points.
  Crew: signed on 0 (0 to 0) for 0 (0 to 0) credits, 0 of 30 runs; 3 (3 to 3) aboard at the end. The med bay healed 12 (0 to 62) hit points.
  ```
  The start ship's numbers are M22's exactly: the recruits' rolls move nothing, and it signs no one on.
- **M23's check** (scratchpad `m23/verify.mjs`), by touch at 905 × 370, 821 × 283 and 960 × 825: 36 of 36 at each size.
  - **The crew panel:** at a station with the holds full, the panel is lit and says "Crew · 2 for hire". Its button covers the whole panel, so a tap low on the list opens the card. The chart under the card takes no taps.
  - **The recruits:** the card names the station and lists both recruits, each with a job and a trait. The captain's row has no Let go. Every button is 48 px or more and reachable.
  - **Sign on:**
    - The first tap reads "Sign on for 50?", and the foot says "Sign Rhea Oduya on for 50 credits. A crew of 4 eats 4 supplies a jump, and full holds last 7 jumps. Tap again to sign on." Nothing is saved.
    - The second tap signs her on for 50, at full health, and saves the hire.
    - Then the other recruit can't sign on: "No room aboard: the berths and life support carry 4." The panel stops offering.
  - **Quit and reopen:** the same recruit, Hana Varga, is still for hire.
  - **Let go:** the first tap says what it leaves and changes nothing. The second lets her go with nothing paid back, and there is room again. Done puts the card away.
  - **Away from a station:** no Sign on and no Let go, and the card says where crew come and go. A second tap on the panel puts the card away.
  - **The med bay:**
    - The Ship panel shows "Med bay 2 a jump", the jump picked says what it heals, and the jump healed the marine 4 to 6, exactly as the sim's jump does.
    - A wrecked med bay has no row, and the card says it is wrecked.
  - **The squad, four aboard, boarding her:**
    - "Squad · 3 of 4", and "Going: Engineer, Medic and Rhea Oduya. Marine sits this one out: tap Squad to change who."
    - The card has the healthiest three picked, each 48 px. A fourth pick says "A squad is 3 at most.", and leaving no one says "Pick someone to go."; picking saves nothing.
    - Board her, two taps, began the fight with the three picked, and three crew units on the map.
  - **Boarded with four aboard:** Squad is there too, and Fight them off took the healthiest three. With three aboard there is no Squad, and everyone goes.
  - **The builder:** long presses on Crew quarters, Life support and Med bay show their run lines.
  - **Saves and offline:** a v13 save opens as v14 with no one signed on and the recruits offered. Offline, with the server stopped, the crew card opens from the cache. No console errors or warnings.
- **Regressions,** one after another, after the last change (the crew and squad cards' own classes, below):
  - **M23's check again:** 36 of 36 at each size;
  - **M20's check** (as adapted in M21): 32 of 32 at each size;
  - **M22's check** (adapted, below): 35 of 35 at 905 × 370;
  - **M18's check:** 43 of 43 at each size;
  - **M17's check** (as adapted in M19): 37 of 37 at each size;
  - **M16's check:** 29 of 29 at each size;
  - **M15's check:** 30 of 30 at each size;
  - **M14's saves check:** 10 of 10;
  - **M13's check:** 24 of 24;
  - **M8's fight sandbox checks:** the fight with no console errors; the orders column at each size, every order and crew button 48 px or more; all 8 extras, offline included, with no console errors;
  - **M14's check:** 39 of 39 at 905 × 370, with a job of each kind played by touch. The count depends on the jobs dealt (40 in M22).
- **Run before that change,** which touched only the two cards' classes and the styles they share:
  - **M22's check:** 35 of 35 at 821 × 283 and 960 × 825;
  - **M21's check** (adapted, below): 32 of 32 at each size;
  - **M19's check** (as adapted in M22): 52 of 52 at each size.
- **What changed in the old checks:** M22's and M21's (`m22/verify23.mjs`, `m21/verify23.mjs`) now ask that a v12 or v11 save opens as v13 or later, where they asked for v13. The runs are `m23/regress.sh` and `m23/regress2.sh`.
- **Found and fixed by looking in Chromium,** at the three sizes, before the check was written:
  - **The crew card's Done icon shrank** to a sliver beside the card's long words. Done is now a fixed size.
  - **Two bright buttons:** Done was as bright as Sign on's first tap, and the squad card's Done as bright as Board her. Done is the quiet button now.
  - **At 960 × 825 the cards filled the area** around a few rows. They now take the height of what they hold, up to the area, so their lists still scroll on short screens.
  - **The crew panel's opener measured 18 px tall.** Its tap area was a stretched pseudo-element, which a size check can't see. It is now a button over the whole panel.
- **Found by the check:** `sw.js` didn't list M23's new files until `tools/precache.js` ran, so the game didn't load offline. The pre-commit hook runs it; I ran it by hand before the check.
- **Found by the regressions:** two clashes of class names. Each was fixed in the game, not in the check:
  - **The Squad button** borrowed Leave her's class for its look, so M22's check found the hidden Squad button where it looked for Leave her, at every size.
  - **The crew and squad cards** borrowed the event card's class for their frame, so M20's check found two event cards.

  Each now has classes of its own and shares the looks through the stylesheet.

### Known issues

- **Most ships have room for one recruit and no med bay** until refits (M23b). The start ship launches with 4 berths and 4 life support for a crew of 3, and act 1 has no reason to fit a med bay yet.
- **The test player signs no one on with the start ship,** whose lockers hold too little for a fourth mouth by its rule. Recruits show in its voyages only with a cargo hold fitted (§9).
- **A cargo hold's mass gets the ship boarded more:** with one fitted, the careful player lost 9 boardings at home in 30 runs, against 6 without.
- **The crew card scrolls** past three aboard at 905 × 370, and past two at 821 × 283. A row cut off at the bottom shows there is more (§9).
- **At 821 × 283 with four aboard,** the Ship panel shows Supplies and the rest scrolls, since the crew panel always shows everyone.
- **Recruits are a name, a job and a trait,** with no background or portrait yet (§4.5).
- **The squad pick is forgotten on a quit** before the fight begins; it falls back to the healthiest.
- **Heat from approaches and jumps does nothing yet,** as with all act 2 heat until M24.

### What to test on the phone (Galaxy Z Fold 6)

1. **Continue your M22 save.** It opens as v14, as it was.
2. **At a station,** the Crew panel lights up with "Crew · 2 for hire". Tap anywhere on it.
3. **Sign on:** tap Sign on to see what it costs in the foot, then tap again. With 4 aboard, the other recruit can't sign on and the card says why.
4. **Leave the station and come back,** or quit and reopen: the same recruit waits there.
5. **Let go:** two taps, anyone but the captain. There is room again afterwards.
6. **Done,** or tap the panel again: back to the chart.
7. **A boarding with four aboard:** Squad · 3 of 4 sits beside Board her. Pick who goes, then Board her. Does the fight have the three you picked?
8. **The med bay** needs a ship that launched with one. If yours has one, check the Ship panel's "Med bay 2 a jump", the jump's line, and the crew healing as you go.
9. **The builder:** long-press Crew quarters, Life support and Med bay in the parts drawer for the new run line.
10. **Both screens,** the cover screen especially: the crew card with four aboard, and the squad card.
11. **Tell me:**
    - the fee, and whether 2 a station is right;
    - whether the squad picker is quick enough before a boarding;
    - whether a med bay is worth its space and power on your ship;
    - and the M14 to M22 questions still open.

### Next session

**M23b Refits at stations.** Settle its Done when first. The draft is "at a station, construction mode opens with the parts on hand, so parts found, stripped or bought can be fitted; the ship can't jump while its flight checklist fails." Then M24 Heat v2.

## M22 Boarding both ways (2026-10-13)

**Status:** done, and the ROADMAP.md box is ticked. Evan said "Start the next milestone". Before I settled the Done when, Evan answered two questions: salvage is parts and scrap, rolled; and the crew's wounds are patched at stations. I settled the rest from the draft and wrote it into ROADMAP.md §7. No phone results have come back yet for M14 to M21.

Done when: "a boarding, either way, is fought from the approach on the right map (boarded: your own ship's, wrecked rooms and all, Law 2; boarding: her generated ship's, with hers); the player's Board order works against a ship that can still fight, at the odds shown; every boarding fight leaves parts, credits or wounds behind (Law 3), and the stand-ins are gone; stations patch the crew for credits, two taps; played by the AI at full health, the start crew beats a cutter's crew at least 40% of the time either way (`tools/sim.js --boardings`); and the careful test player still crosses all five sectors fed in at least 24 of 30, now fighting its boardings with the AI and patching at stations."
- **Fought from the approach, on the right map:**
  - `tests/encounter.test.js`: an approach that ends in a boarding, either way, leaves its fight due. The fight is on the boarded ship's map with its wrecks, her crew on her bridge or at the player's hatches. Through the game's actions, it begins from the approach, saves as it goes and ends back on the map.
  - By touch: Board her opened the fight on her map, identical to her ship's boarding map with her wrecks. Fight them off opened it on the player's own map with the player's wrecks.
- **The Board order:** `tests/approach.test.js` and `tests/encounter.test.js` close on a ship that can still fight, at the odds shown; with the engines out it can't be given. By touch, Board showed 49%, and two taps grappled onto the cutter with the close rolled against 49.
- **Something left behind (Law 3):** `tests/encounter.test.js` covers each case: her salvage and scrap, her boarders' gear, what a raid takes, or wounds alone. By touch, the end panels said "The cutter is yours: Stripped: a Bridge. Scrap: 13 credits." and "Overrun: They took the Armory.", and Continue paid out or took exactly what the sim's ending does. The stand-ins are gone from the code.
- **Patching:** `tests/patch.test.js`, 4 tests. By touch, Patch up · 12 took two taps.
- **The 40% guard:** `tests/boarding.test.js` passes at 100 fights a row. `node tools/sim.js --boardings` at 250 a row: 52% at home, 51% aboard her.
- **The careful test player:** 26 of 30 runs crossed all five sectors fed (24 needed). It fought 12 boardings with the AI and patched the crew in 28 of 30 runs.

### Shipped

- **Boarding fights** (`src/sim/encounter.js`; ROADMAP.md §4.2 and §4.3 have the rules):
  - **Due:** an approach that ends in a boarding, either way, leaves its fight due (`outcome.boarding`). The approach stays on screen until the fight is over.
  - **Boarding her** (Board her): the fight is on her generated ship's map with her wrecks. Her crew, the preset's party, starts on her bridge and plays the AI. The player's crew comes in at her hatches.
  - **Boarded** (Fight them off): the fight is on the player's own map with its wrecks. The crew starts on the bridge, and her boarders come in at the hatches, pressing on as raiders do.
  - **Who fights:** the whole crew, wounds and all, and it moves first.
  - **Leave her:** a ship the player disabled or grappled can be left, two taps. A ship boarding the player's can't: "They are boarding: fight them off."
  - **What a fight comes to:**
    - **Won aboard her:** her salvage, 1 working part from a cutter or 2 from a corvette, by rolls and never corridors, plus her scrap.
    - **Won at home:** her scrap's worth in credits.
    - **Lost at home:** what a lost raid takes, the dearest part on hand or half the credits.
    - **Lost aboard her:** nothing.

    The crew keeps its wounds either way. What a win pays is rolled when the fight begins, so the end panel can show it and a reload can't change it. The flags count boardings won and lost.
- **The Board order** (`src/sim/approach.js`): M21's `PLAYER_CLOSES` is gone. Board can be given whenever the engines work, at the close chance shown (49% for the start ship against the cutter in the checks, preset seed 1).
- **Patching** (`src/sim/patch.js`): at a station, 2 credits a hit point (`patchPrice`). It heals one hit point at a time, to whoever has fewest left, as far as the credits go.
- **Data:**
  - `data/ships.json`: each hostile preset's `party` and `salvage`. The cutter has the M8 boarders and 1 part; the corvette has a new patrol and 2.
  - `data/encounters.json`: the patrol, two Company guards and a Hired heavy.
  - `data/balance.json`: `patchPrice` 2.
- **The screens:**
  - **The approach** (`approach.js`, words in `approachText.js` and the new `boardingText.js`): an approach that ends in a boarding lists her crew and what winning and losing come to ("Win aboard her: strip 1 part off her, and her scrap, 10 to 25 credits."). The buttons depend on who is boarding:
    - Board her and Leave her, each two taps, the first saying what it means;
    - or Fight them off, one tap, since there is no choice.
  - **The fight:** the line under the round ("Aboard the cutter · 4 of hers left", "Boarders · 4 left"), and an end panel that says what it came to.
  - **The title's Continue** names a boarding: "Act 2 · Aboard the Pirate cutter, round 1".
  - **The sector map:** at a station with the crew hurt, Patch up sits with the supplies and Repair, two taps.
    - **A station with three services or more** drops the icons from its foot's buttons. The hint is held to three lines, so the foot stays one button high.
- **`SAVE_VERSION` 13:**
  - **New fields:** a fight's `boarding` (its direction and what a win pays), and an approach outcome's `boarding`.
  - **From v12:** no fight is a boarding, and an approach that ended was settled by its stand-in, so no fight is due from it.
  - **Shape checks** cover both fields, and a boarding fight with no approach that ended in it is caught.
- **Tools:**
  - **`tools/boarding.js`** (new) plays boarding fights out by the AI. The side aboard the other's ship presses on, and the side at home plays the AI.
    - **`node tools/sim.js --boardings`** prints the start crew at full health against each preset's party, both ways. It works with `--fights` and `--set`.
    - **The test player's fights:** after 40 rounds both sides press on, so a standoff can't hold a voyage up.
  - **`tools/startShip.js`** (new) has the launched start ship, moved out of `tools/approach.js`. Loading it through `approach.js` deadlocked an import cycle.
  - **`node tools/voyage.js`:**
    - fights the boardings it meets with the AI;
    - boards a ship only with at least half the crew's hit points, and leaves it otherwise;
    - patches at stations before repairs, with the credits beyond a holdful's price.
    - The summary has lines for boardings and patching.
  - **The validators** check each preset's party and salvage, that a preset with tactics has a party, and `patchPrice`.
- **Tests:** 551 in all, up from 539:
  - the run (`tests/encounter.test.js`, 12): due fights, maps and deployment, what each outcome comes to, leaving, the Board order, saves v12 and v13, and a boarding fight through the game's actions;
  - patching (`tests/patch.test.js`, 4);
  - the 40% guard (`tests/boarding.test.js`);
  - the screen's words (`tests/approachText.test.js`, 7): the stakes, the line under the round, the end panels, Patch up;
  - the voyage test's step checks for boardings and patching. Its Done when needs boardings at home both won and lost.
- **Golden files:** none changed.

### Decisions made this session

- **Evan's calls:**
  - **Salvage:** "Parts and scrap, rolled". A won boarding strips the preset's count of parts by rolls, and takes the scrap.
  - **Wounds:** "Stations patch the crew". In act 2 the crew patches up at stations for credits until M23's med bay.
- **Mine,** with no word from Evan:
  - **Her crew is data:** each preset's `party`. The cutter has the M8 boarders. For the corvette I first tried the M14 guards, but they made it easier than the cutter (74% and 71% for the crew). The patrol of three, with a heavy, gives 38% and 32%.
  - **Who presses on:** whoever is aboard the other's ship, as raiders do. Her boarders press on in the player's ship. Aboard her, her crew holds its ground with the AI, which suits a crew defending its own ship.
  - **The whole crew fights, and moves first,** as in a raid.
  - **Salvage is rolled when the fight begins,** so the end panel can show it, and quitting and reopening can't reroll it.
  - **Losing aboard her takes nothing.** The crew is beaten back to the player's ship, hurt. Losing at home costs what a lost raid takes.
  - **Leaving:** the player can leave a ship they disabled or grappled. A ship boarding theirs has to be fought off.
  - **The patch price is 2 credits a hit point,** cheaper than a repair (a start crew at 2 hit points each costs 40). Patching heals the most hurt first. It happens at stations only, until M23.
  - **The test player boards only with at least half the crew's hit points,** and patches before it repairs. Its fights use the harness's players, with both sides pressing on after 40 rounds.
  - **A v12 save's settled boardings stay settled.** Its stand-in already paid out or took.
  - **The crowded station foot:** with three services or more, the foot's buttons drop their icons, and the hint is held to three lines. The patch text is shorter too. "Patches up Engineer 2 to 8 for 12 credits." replaces "Patches up the crew: Engineer 2 to 8, 6 hit points for 12 credits." (below).

### Verified here

- `node --test`: 551 pass. `node tools/validate-data.js`: OK, with 9 encounters.
- **`node tools/sim.js`** (run because `data/balance.json` changed; `patchPrice` isn't used in fights, so the summary is M11's):
  ```
  All               1,000  49% (46–52)           41%        10%  7 (5–11)           28
  Shots: 23,504, 23.5 a fight. Hit: crew 57%, boarders 40%.
  A fight: 1.8 crew go down, 0.9 bleed out, 2.8 boarders die.
  ```
- **`node tools/sim.js --boardings`** (250 fights a row; rounds and hit points left are medians, in fights with a winner):
  ```
  Fight                                         Fights  Crew wins  Stalled  Rounds  Crew hp left
  At home, boarded by a pirate cutter's crew       250        52%        0       6             2
  Boarding a pirate cutter                         250        51%        2       7             1
  At home, boarded by a patrol corvette's crew     250        38%        1       5             0
  Boarding a patrol corvette                       250        32%        2       7             0
  ```
- **`node tools/voyage.js --runs 30`** (campaign seeds 1 to 30, each launched from its act 1 test run):
  ```
  --long never (the Done when's careful player):
  Sectors crossed: 5 (5 to 5); 30 of 30 reached the end of the charts; fed all the way in 26 of 30.
  Hostile ships: 2 (0 to 5) met, 0 (0 to 0) disabled or blown up, 0 (0 to 2) boarding us. Boarded her 0 (0 to 0) times (won 0 (0 to 0)), left her 0 (0 to 0); fought off 0 (0 to 2) of 0 (0 to 2) boardings. Salvage: 0 (0 to 0) parts and 0 (0 to 42) credits. Lost: 0 (0 to 1) parts and 0 (0 to 0) credits; 0 (0 to 31) hit points in the fights. Lost a boarding at home: 6 of 30; dragged past 40 rounds: 0.
  At stations: patched 9 (0 to 32) hit points for 18 (0 to 64) credits; 0 (0 to 1) repairs for 0 (0 to 50) credits. Crew at the end: 23 (3 to 26) hit points.
  Heat at the end: 100 (97 to 100).

  long jumps when heat is at 50 or over, scanning (the default):
  Sectors crossed: 5 (5 to 5); 30 of 30 reached the end of the charts; fed all the way in 20 of 30.
  Hostile ships: 0 (0 to 4) met, 0 (0 to 0) disabled or blown up, 0 (0 to 1) boarding us. [...] Lost a boarding at home: 2 of 30; dragged past 40 rounds: 0.
  At stations: patched 6 (0 to 35) hit points for 12 (0 to 70) credits; 0 (0 to 1) repairs for 0 (0 to 50) credits. Crew at the end: 26 (7 to 26) hit points.

  --scan no:
  Sectors crossed: 5 (5 to 5); 30 of 30 reached the end of the charts; fed all the way in 22 of 30.
  ```
  Over the careful player's 30 runs: 47 hostile ships met, 12 boardings by them, 6 fought off (104 credits of scrap in all) and 6 lost, each costing a part; 192 hit points lost in the fights, and 324 patched for 648 credits.
- **M22's check** (scratchpad `m22/verify.mjs`), by touch at 905 × 370, 821 × 283 and 960 × 825: 35 of 35 at each size.
  - **The Board order:**
    - It can be given, at 49%. Of the seven orders, only shields can't be given, since the ship has none.
    - A first tap shows the odds and changes nothing.
    - Two taps grapple on, at the odds shown. The column says "You grapple onto the cutter.", with her crew and the stakes and no stand-in lines, and offers Board her and Leave her but no Carry on.
  - **Two taps each:** Leave her's first tap explains and changes nothing. Board her's first tap takes over the wait, and the wait stands down when left alone. Leave her twice: back on the chart, no fight, the node settled.
  - **Board her, two taps:** the fight is on her map, identical to her ship's boarding map with her wrecks, and saved. The whole crew faces her four, with "Aboard the cutter · 4 of hers left" under the round. Every fight button is 48 px or more and reachable.
  - **Quit and reopen:** Continue says "Act 2 · Aboard the Pirate cutter, round 1", and the fight is as it was.
  - **Fight them off:** the column says "Lose: they take the Armory you have on hand." and has no Leave. One tap opens the fight on the player's own map with its wrecks, with "Boarders · 4 left" under the round.
  - **The end panels:**
    - "The cutter is yours: Stripped: a Bridge. Scrap: 13 credits." Continue goes back to the chart with +13 credits and the bridge on hand. The saved campaign is exactly the sim's `endBoarding`, wounds and all.
    - "Overrun: They took the Armory." Continue takes the armory.
  - **Patch up:** four services at a station, the foot 48 px high and every button 48 px or more and reachable. The first tap says "Patches up Engineer 2 to 8 for 12 credits. Tap again to patch up." and changes nothing. The second patches, and Patch up goes.
  - **Saves and offline:** a v12 save at a boarding its stand-in settled opens as v13, with Carry on and no Board her. Offline, with the server stopped, a boarding fight opens from the cache. No console errors or warnings.
- **Regressions,** one after another:
  - **M21's check** (adapted, below): 32 of 32 at each size;
  - **M19's check** (adapted again, below): 52 of 52 at each size;
  - **M20's check** (as adapted in M21): 32 of 32 at each size;
  - **M18's check:** 43 of 43 at each size;
  - **M17's check** (as adapted in M19): 37 of 37 at each size;
  - **M16's check:** 29 of 29 at each size;
  - **M15's check:** 30 of 30 at each size;
  - **M14's check:** 40 of 40 at 905 × 370, with a job of each kind (clear, hack, grab) played by touch. The count depends on the jobs dealt (39 in M21). The container restarted while it ran in the regression script, and it passed when run again on its own;
  - **M14's saves check:** 10 of 10, v4 saves opened and saved again as v13;
  - **M13's check:** 24 of 24;
  - **M8's fight sandbox checks:**
    - the fight passes with no console errors;
    - the orders column passes at each size: five orders clear of the dev tools, each 48 px or more;
    - the extras pass all 8 of their checks, offline with the server stopped included, with no console errors.
- **What changed in the old checks:**
  - **M21's check** (`m21/verify22.mjs`) finds Board given, at its odds, where it was refused. Its boarding shows the stakes and Board her where the stand-in's lines and Carry on were. A v11 save opens as v13.
  - **M19's check** (`m19/verify22.mjs`) carries on past a boarding that an approach on its way ends in. In its crossing by the sim, the AI fights it. By touch, it leaves a disabled ship, or taps Fight them off and ends turns until the end panel. In these runs its touch crossing met no boarding.
  - **The regression script** (`m22/regress.sh`) runs the adapted copies. M21's script named the older files, though M21's results came from the adapted ones.
- **Found and fixed by looking in Chromium,** at the three sizes, before the check was written: **the station foot at 821 × 283.**
  - **The failure:** with the supplies short, a wreck and the crew hurt, the foot held Title, the hint, Buy 3, Fill up, Repair, Patch up and Scan. The hint was squeezed to one word a line and the foot grew to 165 px. With Patch up armed it reached 255 px, and the chart shrank to 2 px tall.
  - **The fix:** a crowded foot drops its icons, and the hint is held to three lines. Now the foot is 48 px at every size and in every armed state, and the smallest node on the chart is 62 px.
- **Found while running the suite:** the validator's command-line test counted 8 encounters; the patrol makes 9.

### Known issues

- **The test player never boards hers.** It never closes to board, and it disabled no ship in 30 runs. The voyages say nothing about what Board is worth (§9).
- **Hostile ships are still mostly a cost** for the start ship as act 1 leaves it: the careful player lost 6 of the 12 boardings at home, each costing a part.
- **The corvette's crew is hard:** the start crew beats it 38% of the time at home and 32% aboard her, played by the AI.
- **A crew member can start in fire.** Deployment takes the tiles nearest the bridge or the hatches whatever is on them, so one can start in a burning room and burn on the first turn (§9).
- **Salvage can only be sold.** Act 2 has no refits, and the roll can strip any working part but a corridor, a bridge included (§9).
- **The long-jump test player** crosses fed in 20 of 30 (21 in M21). The careful player is the guard.
- **A boarding fight can't be left** until one side wins, like every campaign fight.
- **Heat from approaches does nothing yet,** as with all act 2 heat until M24.

### What to test on the phone (Galaxy Z Fold 6)

1. **Continue your M21 save.** It opens as v13. An approach that was over stays settled: Carry on.
2. **Board:** at a hostile ship, tap Board to see its odds, and tap again. If it grapples on, the column lists her crew and what winning and losing come to.
3. **Board her:** two taps. The fight is on her ship, her wrecked rooms burning, with "Aboard the cutter · 4 of hers left" under the round.
4. **Leave her** instead, two taps: back on the chart.
5. **Boarded:** Fight them off, one tap. The fight is on your own ship, with your wrecks.
6. **Quit mid-boarding and reopen:** Continue names the ship and the round.
7. **The end:** the panel says what it paid or took, and Continue goes back to the chart. Check the Ship panel and the crew's hit points.
8. **Patch up** at a station: two taps. On the cover screen, with Repair and the supplies there too, does the foot read without its icons?
9. **Both screens:** the boarding maps, the fight on her ship, and the end panels.
10. **Tell me:**
    - whether boarding a ship that can still fight is worth the risk;
    - how long and how hard the boarding fights feel;
    - the patch price;
    - whether salvage should be picked rather than rolled;
    - and the M14 to M21 questions still open.

### Next session

**M23 Recruits, crew management, med bay healing.** Settle its Done when first. The draft is "recruits join at stations up to the ship's berths, and a med bay heals the wounded over jumps." M22's patching at stations is the stopgap a med bay replaces or works beside.

## M21 Approach phase (2026-10-13)

**Status:** done, and the ROADMAP.md box is ticked. Evan said "Start the next milestone". Before I settled the Done when, Evan answered two questions: boardings run now, settled by a stand-in until M22; and repairs happen at stations. I settled the rest myself from the draft and wrote it into ROADMAP.md §7. I changed two of its lines during the session, once the numbers were in: the Law 1 test, and which test player the voyage guard uses (Decisions, below). No phone results have come back yet for M14 to M20.

Done when: "hostile ships at nodes fight the approach phase to an outcome (escape, disabled and boarded, or destroyed), every roll at the odds shown; in `tools/approach.js`, a weapon mount, a shield or an engine added to the launched start ship each does better against at least one hostile preset and worse against none (Law 1); damage carries into the boarding map as wrecked rooms and stays until a station repairs it; a stand-in settles boardings until M22; and the careful test player (no long jumps) still crosses all five sectors fed in at least 24 of 30."
- **Hostile ships fight to an outcome:**
  - `tests/approach.test.js` and `tests/encounter.test.js` play approaches to getting away, boarding either way, blowing up, parting, and the other ship running.
  - `tests/voyage.test.js`'s 60 voyages meet at least 30 hostile ships, with escapes and boardings by them among the outcomes.
  - By touch, an approach played to its end and Carry on went back to the chart.
- **Every roll at the odds shown:**
  - Over 1,500 seeds, every shot rolls against the chance shown before the round, hits when the roll is under it, and lands within 4 points of it.
  - Every flight and boarding rolls at the chance shown before the round, the other ship's included: its order shows its chance. A last reactor's blow-up rolls at the 30% that Fire at their reactor shows.
  - The screen's numbers are the rules' (`tests/approachText.test.js`).
  - By touch, Fire showed "49% × 1", and its volley rolled against 49.
- **Law 1** (`tests/approach.test.js`, 120 approaches a row): each of the three parts scores at least 10 points better against one preset, and no more than 3 worse against either. The 300-approach table is below.
- **Damage carries and stays:**
  - After a round that wrecks rooms on both ships, both boarding maps have each wrecked room's hazard on every tile.
  - The player's wrecks stay after the approach and come into the next. A station repairs them (`tests/encounter.test.js`).
  - By touch, the boarded cutter's map was marked, and a station's Repair took two taps.
- **The stand-in:** `tests/encounter.test.js`. By touch, a boarding said "Stripped: an Engine. Scrap: 20 credits."
- **The careful test player:** 25 of 30 runs crossed all five sectors fed (24 needed).

### Shipped

- **Hostile ships at nodes** (`data/sectors.json`): a new kind of node, weight 2 in the mix. Each has a preset by weight and a seed: a pirate cutter 3, and from the third sector a patrol corvette 1. The ship is generated from them (M10) when met.
- **The approach phase** (`src/sim/approach.js`, pure; ROADMAP.md §4.2 has the rules in full):
  - **Rounds:** up to 3. The other ship's order comes first and is shown; then the player fires at their guns, engines, shields or reactor, evades, flees or boards.
  - **Odds:** guns against evasion, which comes from thrust for mass. Fleeing and closing are moved by the difference in thrust for mass. Every chance is kept within 5 to 95.
  - **Hits:** shields soak up hits first. A hit lands on the module of the kind aimed at with the fewest hit points left, and a wrecked module's room burns, opens to vacuum or fills with rubble.
  - **Outcomes:** no working reactor or engine means disabled and boarded. The other ship's last reactor going can blow it up (30%); the player's ship never blows.
  - **Tactics** (`data/ships.json`): what each preset aims at, the round it closes to board from, and the share lost at which it runs.
  - **The player's Board** is shown with its odds, but refused until M22 ("Boarding a ship that can still fight comes with the boarding fights.").
- **In the run** (`src/sim/encounter.js`):
  - **Opening:** arriving at a hostile node opens the approach, which holds jumps, scans and leaving. Each order plays a round with the campaign's RNG, saved.
  - **The end:**
    - Boarding them: one working part, picked by a roll, and the preset's scrap (cutter 10 to 25, corvette 20 to 40). Destroying them: the scrap alone.
    - Boarded: what a lost raid takes (M15's `raidLoss`).
    - Heat +4 if a gun fired.
    - The node is settled, and the flags count the approach, won or lost. They count repairs too.
  - **Wrecks stay** in `campaign.wrecks` and come into the next approach. If none is left working, the crew gets the first reactor and the first engine going again, so a run can't be stranded.
- **Repairs** (`src/sim/repair.js`): at a station, a quarter of the part's cost in steps of 5 credits (a gun or shield 35, an engine or reactor 50). The cheapest are repaired first, as far as the credits go.
- **The approach screen** (`src/ui/campaign/approach.js`, words in `approachText.js`):
  - **The ships:** both drawn as their boarding maps, side by side, the other turned to face yours. A wrecked room shows its hazard as it happens.
  - **The column:** words only, and it may scroll. It shows:
    - their order with its odds ("The cutter fires at your engines: 2 guns, 40% each (20% if you evade).");
    - what the order you tapped would do;
    - the last round, roll by roll ("Your gun at their engines, 49%: 21 hit. Their Engine wrecked, full of rubble.").
  - **The orders:** along the bottom, each 48 px or more with its odds. The first tap spells an order out and stands down after 3 s; the second gives it. One that can't be given says why.
  - **The end:** how it ended and what it came to, the boarded ship's map marked, and Carry on.
- **The sector map:**
  - hostile nodes have their own mark, a raider's hull in the crosshairs;
  - a picked node names its ship ("Hostile ship: Pirate cutter"), and "Hostile ship, gone" once met;
  - the Ship panel lists what is wrecked aboard;
  - at a station with wrecks, Repair sits beside the supplies (two taps).
  - The title's Continue names an approach ("Act 2 · Pirate cutter, round 2").
- **`SAVE_VERSION` 12:**
  - **New fields:** the campaign's wrecks, and the run's approach (the other ship saved whole); a node can carry a hostile ship.
  - **From v11:** a campaign has nothing wrecked and no approach. Its sector keeps its nodes, and the next sector has hostile ships.
  - **Shape checks:** the run's and campaign's cover the new fields.
- **Balance** (`data/balance.json`):
  - `approachRounds` 3, `gunnery` 70, `evasionPerThrust` 25, `evadeBonus` 20;
  - `chanceMin` 5, `chanceMax` 95;
  - `gunDamage` 15, `shieldPerGen` 10;
  - `fleeChance` 35, `fleePerThrust` 50, `closeChance` 30, `closePerThrust` 50;
  - `blowChance` 30, `approachHeat` 4, `repairPercent` 25.
- **Tools:**
  - **`node tools/approach.js`** (new; with `--runs` and `--set`): the launched start ship against each hostile preset, and again with a weapon mount, a shield or an engine added. Its test captain (`tools/approachPlan.js`) looks ahead: it plays each order out 16 times on shared seeds, scoring a win +1 and a loss −1.
  - **`node tools/voyage.js`:**
    - meets hostile ships with that captain;
    - repairs at stations with the credits left beyond a holdful's price;
    - counts a hostile node as −30 credits on its routes;
    - takes a long jump only if the way on from there is fed and worth as much.
    - The summary adds a line for hostile ships.
  - **The validators** check tactics, scrap, and a node kind's ships (presets with tactics, weights, the sector each comes from).
  - **`tools/sectors.js`** marks hostile nodes `h`.
- **Tests:** 539 in all, up from 517:
  - the rules (`tests/approach.test.js`, 10): odds, rolls as shown, shields and targets, the round's order, blowing up, tactics, Board refused, wrecked rooms on the map, Law 1;
  - the run (`tests/encounter.test.js`, 7): opening and holding, orders, the stand-ins, wrecks kept and jury-rigged, repairs, save v12, through the game's actions;
  - the screen's words (`tests/approachText.test.js`, 5), every number on it the one rolled;
  - the voyage test's step checks for approaches and repairs, and the Done when (`tests/voyage.test.js`).
- **Golden files:** `tests/golden/sectors.txt` changed on purpose. The nodes' places and links are as before. Their kinds and names changed with the new mix, and hostile nodes list their preset and seed.

### Decisions made this session

- **Evan's calls:**
  - **Boarding before M22:** "Run, with a stand-in". Hostile ships are at nodes now, and a stand-in settles boardings until the fights come.
  - **Repairs:** "Repair at stations". Wrecks stay until a station repairs them for credits, two taps.
- **Mine,** with no word from Evan:
  - **The Law 1 line changed.** It said each part should improve the start ship against every preset. A weapon mount against the corvette scores only 1 point better at 300 approaches (7 at 120): the start ship can't board a corvette with or without it. It now reads "better against at least one, worse against none". The test allows 3 points of noise in "worse".
  - **The guard uses the careful player.** With long jumps from heat 50, the test player crossed fed in 21 of 30, against M20's 25. Over seeds 1 to 60, with long jumps: 43 with hostile ships, 48 without. With no long jumps: 52 with them, 49 without. So the guard is the careful player's 24 of 30, and the long-jump number is a known issue. My reading of the cause, not measured: hostile ships take mix weight from nodes that pay, and a long jump passes nodes by.
  - **The player can't Board a ship that can still fight.** The stand-in can't tell a crew boarding a stronger ship from one boarding a wreck. In the harness, closing on a cutter at full strength was a free win.
  - **Their order is shown first,** with its odds. The player answers it, and the other ship never reads the player's order.
  - **A round goes flights, volleys, then boardings.** Both volleys use the ships as they stood when the round began, so neither side's shots come first. Boarding comes after the volleys, so a volley that disables a closing ship stops it.
  - **The player's ship never blows up, and is never stranded.** Nothing in act 2 can end a run yet, and a ship with no engine couldn't leave its node. The crew gets one reactor and one engine going after each approach.
  - **Numbers**, tuned with `tools/approach.js`:
    - **Fleeing was made harder.** The first numbers let the start ship get away about 60% of the time each round, 94% by the third, so few approaches came to anything.
    - **A hit does 15,** so a hit that no shield soaks up wrecks an engine, a gun or a shield generator, and a reactor takes two. I measured the other values again at the end, with every other number as it is now, over 100 approaches a row. At 10 or 12 a wreck takes two hits: nothing was boarded or destroyed, and a weapon mount did worse against the cutter than no part (−9 against −7).
  - **The test captain looks ahead.** A captain with fixed rules of thumb won nothing with one or two guns. A gun also made it fight where it should have run, so the gun scored worse than no part. The look-ahead captain plays each order out and takes the best.
  - **A cutter from sector 1, a corvette only from sector 3,** so the stronger ship comes later in the run.
  - **Heat +4 for an approach where a gun fired.** A clean escape adds none.
  - **Every chance is shown before its roll,** the other ship's flight and a last reactor's blow-up included. Both were missing until I wrote this entry (below).

### Verified here

- `node --test`: 539 pass. `node tools/validate-data.js`: OK, with 3 ship presets and 9 kinds of sector node.
- **`node tools/sim.js`:** the approach's numbers aren't used in boarding fights, so the summary is M11's:
  ```
  All               1,000  49% (46–52)           41%        10%  7 (5–11)           28
  Shots: 23,504, 23.5 a fight. Hit: crew 57%, boarders 40%.
  A fight: 1.8 crew go down, 0.9 bleed out, 2.8 boarders die.
  ```
- **`node tools/approach.js`** (300 approaches a row; the score is wins less losses in every 100):
  ```
  Ship      Against              escaped      fled   boarded boardedBy destroyed    adrift    parted   Score
  start     Pirate cutter            56%        0%        3%       18%        0%        0%       23%     -15
  start     Patrol corvette          62%        0%        0%       19%        0%        0%       19%     -19
  +weapon   Pirate cutter             1%        0%       69%       17%        6%        1%        6%      58
  +weapon   Patrol corvette          32%        0%        0%       18%        0%        0%       50%     -18
  +shield   Pirate cutter            56%        0%       13%       12%        0%        0%       19%       1
  +shield   Patrol corvette          44%        0%        0%        3%        0%        0%       53%      -3
  +engine   Pirate cutter            24%        0%       20%        8%        0%        0%       48%      13
  +engine   Patrol corvette          74%        0%        0%        7%        0%        0%       18%      -7
  ```
  At 120 (the test's run), start −16 and −19; +weapon 67 and −12; +shield 11 and −3; +engine 16 and −8.
- **The start ship against them** (preset seeds 1 and 2): it has 1 gun, no shields and evasion 30, so their guns hit it 40% of the time. A cutter has 2 guns and evasion 21: the start ship hits it 49% and flees from it 54%. A corvette has 2 to 4 guns, 20 of shields and evasion 18 to 20.
- **`node tools/voyage.js --runs 30`** (campaign seeds 1 to 30, each launched from its act 1 test run):
  ```
  long jumps when heat is at 50 or over, scanning (the default):
  Sectors crossed: 5 (5 to 5); 30 of 30 reached the end of the charts; fed all the way in 21 of 30.
  Jumps: 31 (29 to 33), long 3 (1 to 5), hungry 0 (0 to 6).
  At the nodes: 12 (7 to 17) events, 150 (60 to 445) credits and 8 (-3 to 40) supplies from them, 4 (0 to 7) parts found, 1 (0 to 3) sold, 6 (0 to 16) hit points lost; 16 (13 to 19) scans.
  Hostile ships: 0 (0 to 4) met, 0 (0 to 0) won, 0 (0 to 1) lost (boarded), 0 (0 to 0) credits from them, 0 (0 to 1) parts lost; 0 (0 to 1) repairs for 0 (0 to 50) credits. Lost one or more: 3 of 30.
  In the first three sectors: restocked at 3 (1 to 5) stations; hungry on 0 (0 to 6) jumps; fed all the way in 24 of 30.
  Heat at launch: 48 (24 to 49); at the end: 100 (87 to 100).

  --long never (the Done when's careful player):
  Sectors crossed: 5 (5 to 5); 30 of 30 reached the end of the charts; fed all the way in 25 of 30.
  Jumps: 34 (34 to 34), long 0 (0 to 0), hungry 0 (0 to 4).
  At the nodes: 12 (8 to 18) events, 122 (32 to 445) credits and 9 (-6 to 43) supplies from them, 4 (1 to 7) parts found, 0 (0 to 3) sold, 6 (3 to 16) hit points lost; 18 (15 to 20) scans.
  Hostile ships: 2 (0 to 4) met, 0 (0 to 0) won, 0 (0 to 2) lost (boarded), 0 (-55 to 0) credits from them, 0 (0 to 2) parts lost; 0 (0 to 2) repairs for 0 (0 to 85) credits. Lost one or more: 11 of 30.
  Heat at the end: 100 (97 to 100).

  --scan no:
  Sectors crossed: 5 (5 to 5); 30 of 30 reached the end of the charts; fed all the way in 24 of 30.
  Hostile ships: 1 (0 to 3) met, 0 (0 to 0) won, 0 (0 to 3) lost (boarded), 0 (-45 to 0) credits from them, 0 (0 to 2) parts lost; 0 (0 to 2) repairs for 0 (0 to 100) credits. Lost one or more: 8 of 30.
  ```
- **M21's check** (scratchpad `m21/verify.mjs`), by touch at 905 × 370, 821 × 283 and 960 × 825: 32 of 32 at each size.
  - **The chart:** the hostile mark; a picked node says "Hostile ship: Pirate cutter"; the jump opens the approach, saved.
  - **The screen:**
    - the head "Hostile ship · Pirate cutter", "Round 1 of 3";
    - their order: "The cutter fires at your engines: 2 guns, 40% each (20% if you evade).";
    - seven orders, with shields and Board not given;
    - every button 48 px or more and reachable at its middle;
    - room for both ships.
  - **Orders:**
    - A first tap spells the order out and changes nothing; left alone, it stands down.
    - Board says why not.
    - Two taps fire at the odds shown, and the log gives the round roll by roll.
  - **Quit and reopen:** Continue says "Act 2 · Pirate cutter, round 2", and the approach is as it was.
  - **Its end:** played out, then Carry on: back on the chart, the node settled and marked done.
  - **A boarding:** Fire at her reactor first gives the blow-up's odds ("If their last reactor is wrecked, the cutter blows apart 30% of the time, leaving only scrap."). Then: "The cutter is dead in space: you board her.", her map marked, the stand-in's lines, her wrecks in her boarding map.
  - **A station:**
    - "Repair · 50", and the Ship panel lists the wreck;
    - a first tap gives the price, and the second repairs, saved, and Repair goes;
    - the map's buttons all 48 px or more.
  - **Saves and offline:** a v11 save opens on the map as v12. Offline, with the server stopped, the approach opens from the cache. No console errors or warnings.
- **Regressions,** one after another:
  - **M20's check** (adapted, below): 32 of 32 at each size;
  - **M19's check** (adapted again, below): 52 of 52 at each size. Its crossing by the sim meets four hostile ships: three escapes and one boarding by them;
  - **M18's check:** 43 of 43 at each size;
  - **M17's check** (as adapted in M19): 37 of 37 at each size;
  - **M16's check:** 29 of 29 at each size. At 821 × 283 it timed out once, while three browser checks ran at once; run again alone, it passed;
  - **M18's column check:** 15 of 15 at each size;
  - **M15's check:** 30 of 30 at each size;
  - **M14's check:** 39 of 39 at 905 × 370, with a job of each kind played by touch. As in M19 and M20, the count depends on the jobs dealt (41 in M20);
  - **M14's saves check:** 10 of 10, v4 saves migrated through to v12;
  - **M13's check:** 24 of 24;
  - **M8's fight sandbox checks:** the fight and the orders column pass with no console errors. The extras pass all 8 of their checks, offline with the server stopped included, also with no console errors. Their wrecked bridge, set on fire on the Battle map, burns the crew in the fight.
- **What changed in the old checks:**
  - **M20's check** (`m20/verify21.mjs`) reads save version "11 or later": a v10 save now opens as v12.
  - **M19's check** (`m19/verify21.mjs`) plays out any approach a jump lands on (Flee, or Evade when it can't), by touch and in its crossing by the sim. At a station it picks the supply buttons, not Repair, and takes either station hint.
- **Found and fixed by looking in Chromium,** at the three sizes, before the check was written:
  - **Orders clipped at 821 × 283.** The orders first sat in the right-hand column, which ran out of height on the short screen. They moved to a full-width bar along the bottom, and the column holds words only.
  - **An armed order's question was cut off** in its button. It now asks in a word ("Engines?").
  - **The outcome's title came out in capitals** from the column's heading style. The title has its own rule now.
- **Found while writing this entry:** two rolls had no odds shown before them. The other ship's flight said only "The cutter is running.", and Fire at their reactor didn't mention the 30% blow-up. Both are shown now. The test named for flights and boardings checked no boarding roll. It now checks the other ship's boarding and flight, and the screen's numbers are tested against the rolls. M21's check reads the reactor's words by touch.

### Known issues

- **Hostile ships are mostly a cost.** The careful test player boards none in 30 runs and loses something to one in 11, at most 55 credits or 2 parts. A gun fitted in act 1 turns the cutter into a win (69% boarded), but nothing in the game says so, and act 2 has no refits (§9).
- **The start ship never boards a corvette,** with or without a part. Running is the answer for now (62% get away). §9 has a toll as another.
- **Board can't be ordered until M22.** It shows its odds and says why.
- **The stand-ins:** a boarding is settled by a roll among the working parts, with no fight. A crew's wounds don't come into it.
- **The long-jump test player** crosses fed in 21 of 30 (25 in M20). The careful player is the guard.
- **Hits are only words and room tints.** The boarding maps are small on the cover screen, so a wreck's hazard is easy to miss. No shots are drawn (§9).
- **The log can scroll** in the column on the 283 px-tall screen, after a round with many shots.
- **Heat from approaches does nothing yet,** as with all act 2 heat until M24. Most runs end act 2 at 100.
- **An M20 save's current sector has no hostile ships.** The next sector has them.

### What to test on the phone (Galaxy Z Fold 6)

1. **Continue your M20 save,** or launch a new one. The sector you were in has no hostile ships; jump on to the next.
2. **A hostile ship:** its node has a hull in crosshairs. Tap it: the left panel names the ship.
3. **The approach:** jump to it. Read their order, then tap an order to see its odds and tap it again to give it. Watch the rooms on both ships as hits land.
4. **Board:** tap it. It shows its odds and says why it can't be given yet.
5. **Quit mid-approach and reopen:** Continue names the ship and the round, and the screen comes back as it was.
6. **The end:** read how it ended and what changed, then Carry on. The node fades.
7. **A wreck:** if a part was wrecked, a station's Repair fixes it in two taps.
8. **Both screens:** do the two ships read, are the orders easy to hit, and does the column fit?
9. **Tell me:**
   - whether the approach is worth playing, or just a toll;
   - whether getting away about 60% of the time is right;
   - whether 3 rounds is right;
   - whether the stand-in reads as a stand-in;
   - repair prices;
   - and the M14 to M20 questions still open.

### Next session

**M22 Boarding both ways.** Settle its Done when first. The draft is "both directions play out from the approach phase, and every boarding leaves parts, salvage or wounds behind (Law 3)". It replaces M21's stand-ins and turns on the player's Board (`PLAYER_CLOSES` in `src/sim/approach.js`). The boarding maps already carry the wrecks (`mapFromShip`).

## M20 Node types, events and scanning (2026-10-12)

**Status:** done, and the ROADMAP.md box is ticked. Evan said "Start the next milestone". M19's notes said to settle M20's Done when with Evan first. I settled it myself at the start of the session, from the draft, and wrote it into ROADMAP.md §7. No phone results have come back yet for M14 to M19.

Done when: "ten events play from `data/events.json`, each choice's odds shown and rolled as shown; scanning shows what a node holds before the ship gets there; and the nodes pay the run's way: over 30 test runs from launch, the test player, picking nodes for what they hold, crosses all five sectors without going hungry in at least 24 (M19, with nothing at the nodes: 8)."
- **Ten events play:** `tests/events.test.js` plays every choice of every event and saves the campaign after each. Across its 30 runs, `tests/voyage.test.js`'s test player meets all ten.
- **Odds shown and rolled as shown:**
  - One roll from 0 to 99 picks the outcome whose share holds it. Over 2,000 seeds, a 70% outcome comes up within 3 points of 70%.
  - The card's odds come from the same numbers.
  - In the voyage test, every event's outcome is the one its roll falls in, and every change is what that outcome's effects say.
- **Scanning:** `tests/events.test.js` and `tests/sectorText.test.js` check what is known: the charted kinds, nodes next to where the ship has been, and nodes within 2 jumps of a scan. By touch, a scan made out every node within two jumps, and a picked node said what it holds ("Derelict: Dead hauler") before the jump.
- **The nodes pay the run's way:** `tests/voyage.test.js` launches campaign seeds 1 to 30 from their act 1 test runs, and 25 of 30 cross all five sectors fed (24 needed).
- **By touch in Chromium** (below): a scan, an event's odds, a choice and its result, a choice that can't be paid, and quit and reopen.

### Shipped

- **Node kinds** (`data/sectors.json`): derelicts, distress calls, traders and hazards, besides M19's way in, jump point, stations and empty space.
  - The nodes between that aren't stations roll their kind by weight (`mix`): empty space 3, derelict 2, distress call 2, trader 1, hazard 2.
  - A node of a kind that holds events gets one of its kind, none twice in a sector while the kind's events last.
  - Every sector has 2 stations (1 or 2 in M19).
- **Events** (`data/events.json`, 10 of them: three derelicts, three distress calls, two traders, two hazards):
  - **Choices:** each event has 2 or 3. A choice can need credits, supplies or a part on hand, and every event has one that needs nothing.
  - **Outcomes:** each has a chance in 100. Its effects can be:
    - credits, supplies or heat;
    - a wound: hit points off one crew member picked by a roll, or off everyone, never the last one;
    - a part, given or from a drop table (`drops.salvage`);
    - selling parts on hand, the dearest first, at the shop's price.
  - **The validator** (`tools/validate-events.js`) checks:
    - chances that add to 100, and known effects;
    - costs covered by their needs, and wounds in range;
    - drop tables that exist;
    - a choice that needs nothing;
    - an event for every kind that holds them.
- **In the run** (`src/sim/events.js`, `src/sim/travel.js`):
  - **An event opens** when the ship reaches its node. It holds jumps, scans and leaving until a choice is made ("Decide first: Dead hauler.").
  - **A choice** rolls once from the campaign's RNG, if it has more than one outcome, and applies the outcome. The run marks the event settled and keeps its result until the next jump.
  - **What is known:**
    - the way in, the jump point and stations are on the charts;
    - any other node is known once the ship has been at it or next to it;
    - a scan, for 2 heat, makes out everything within 2 jumps. It isn't offered when it would show nothing new.
- **The sector map:**
  - **Nodes:** a node not made out yet shows a ?. Known nodes show their kind's mark: a broken hull, a call for help, the shop's tag, a hazard sign. Settled nodes fade.
  - **The picked node** says what it holds: "Derelict: Dead hauler", or "Unknown" and "Too far to make out. Come closer, or scan."
  - **Scan** sits in the footer and takes two taps. The first says what the scan would show, and for how much heat.
  - **The event card** covers the left panel and the chart while an event is open, and nothing under it takes a tap.
    - Each choice shows its odds under its name ("70% · 30%"), or what it needs if it can't be paid.
    - The first tap spells out each outcome: "Strip it: 70%: +10 credits, a salvaged part. 30%: someone hurt (3 hit points), a salvaged part. Tap again to choose." It stands down after 3 s, and the second tap makes the choice.
    - Then the card says what happened, the roll against the odds ("Rolled 21: the 70% came up.") and what changed, until Carry on.
    - The card's words scroll if they must, so the choices under them always show whole.
- **`SAVE_VERSION` 11:** the run gains the events settled, the scans made and the last result, and a sector's nodes may carry an event.
  - A v10 run carries on with nothing settled or scanned. Its sector keeps the nodes it had, and the next sector has events.
  - The run's shape check covers the new fields.
- **Balance** (`data/balance.json`): `baseSupplies` 30 (24 in M19), `scanHeat` 2, `scanRange` 2.
- **Tools:**
  - `node tools/voyage.js` plays events and scans. The test player's judgement is in `tools/voyagePlan.js` (below). `--scan no` turns scans off, and the summary adds what the nodes paid.
  - `node tools/sectors.js` marks the new kinds and names each node's event.
- **Tests:** 517 in all, up from 501:
  - events (`tests/events.test.js`):
    - opening and holding;
    - the odds as rolled;
    - every effect, and needs;
    - every choice of every event;
    - what is known, and scans;
    - the v10 to v11 migration, and the actions;
  - the generator's kinds and events (`tests/sector.test.js`);
  - the voyage test's step checks for events and scans, and the Done when (`tests/voyage.test.js`);
  - the card's words (`tests/eventText.test.js`), and the map's known and unknown nodes (`tests/sectorText.test.js`);
  - the validator's new mistakes.
- **Golden files:** `tests/golden/sectors.txt` changed on purpose. The nodes' places and links are as before. Their kinds, names and events changed, with the mix and with two stations a sector.

### Decisions made this session

Evan didn't weigh in on any of these:
- **The Done when is mine,** settled from the draft. "A run earns its keep from the nodes it picks" became "crosses all five sectors fed in 24 of 30", against M19's 8.
- **Supplies retuned: 30 in the lockers, and 2 stations in every sector.** The nodes paid over 100 credits a run, but money wasn't what starved runs: the holds ran dry between supply stops. The numbers are below.
- **The test player** (`tools/voyagePlan.js`) picks nodes for what they hold.
  - **What it values:** a choice by its outcomes' expected worth, where a supply is worth 2 credits (6 while the holds are under 4 jumps' worth), a hit point 2, a point of heat 0.3 and a part half its price.
  - **Unknown nodes:** it counts one at the mix's average worth.
  - **Routes:** to a station first when supplies are short, otherwise to what pays.
  - **Long jumps and scans:** a long jump only when 4 jumps' worth of supplies is left after it; a scan only when it would show something ahead.
- **An event is settled before anything else.** Every event has a choice that needs nothing, so none can trap the ship.
- **A choice takes two taps,** like jumps and Buy. The first spells out the odds. A choice that can't be paid shows what it needs instead.
- **A sure outcome doesn't roll:** a choice with one outcome uses no RNG, so its result has no roll to show.
- **Any ship can scan:** 2 jumps for 2 heat. A sensor part is in §9.
- **Traders are events,** not shops: a ration barge and a scrap dealer, each with a few fixed deals.

### Verified here

- `node --test`: 517 pass. `node tools/validate-data.js`: OK, with 8 kinds of sector node and 10 events.
- **`node tools/sim.js`:** the balance changes aren't used in fights, so the summary is M11's:
  ```
  All               1,000  49% (46–52)           41%        10%  7 (5–11)           28
  Shots: 23,504, 23.5 a fight. Hit: crew 57%, boarders 40%.
  A fight: 1.8 crew go down, 0.9 bleed out, 2.8 boarders die.
  ```
- **`node tools/voyage.js --runs 30`** (campaign seeds 1 to 30, each launched from its act 1 test run):
  ```
  long jumps when heat is at 50 or over, scanning (the default):
  Sectors crossed: 5 (5 to 5); 30 of 30 reached the end of the charts; fed all the way in 25 of 30.
  Jumps: 27 (25 to 31), long 7 (3 to 9), hungry 0 (0 to 4).
  At the nodes: 11 (5 to 13) events, 130 (24 to 305) credits and 8 (-6 to 40) supplies from them, 3 (1 to 6) parts found, 1 (0 to 3) sold, 6 (0 to 15) hit points lost; 15 (11 to 17) scans.
  In the first three sectors: restocked at 3 (1 to 5) stations; hungry on 0 (0 to 4) jumps; fed all the way in 28 of 30.
  Supplies bought: 100 (54 to 116), for 100 (54 to 116) credits. Launch credits: 50 (0 to 220).
  Heat at launch: 48 (24 to 49); at the end: 79 (45 to 100).

  --long never:
  Sectors crossed: 5 (5 to 5); 30 of 30 reached the end of the charts; fed all the way in 24 of 30.
  Jumps: 34 (34 to 34), long 0 (0 to 0), hungry 0 (0 to 3).
  At the nodes: 15 (9 to 19) events, 190 (77 to 397) credits and 12 (-6 to 39) supplies from them, 4 (2 to 8) parts found, 1 (0 to 3) sold, 9 (0 to 20) hit points lost; 18 (16 to 20) scans.
  Heat at the end: 100 (97 to 100).

  --scan no:
  Sectors crossed: 5 (5 to 5); 30 of 30 reached the end of the charts; fed all the way in 21 of 30.
  At the nodes: 10 (8 to 16) events, 108 (37 to 232) credits and 12 (-5 to 37) supplies from them, 2 (0 to 6) parts found, 0 (0 to 2) sold, 6 (0 to 18) hit points lost; 0 (0 to 0) scans.
  ```
- **Tuning** (the same 30 launches, the scratchpad's `m20/tune.mjs`; runs fed all the way through five sectors):

  | Lockers | Stations a sector | Traders' weight | Long jumps at heat 50 | No long jumps | Credits at the end (median) |
  | --- | --- | --- | --- | --- | --- |
  | 24 | 1 or 2 | 1 | 12 of 30 | 15 of 30 | 107 |
  | 24 | 1 or 2 | 2 | 12 of 30 | 18 of 30 | 107 |
  | 30 | 1 or 2 | 1 | 14 of 30 | 20 of 30 | 98 |
  | 24 | 2 | 1 | 17 of 30 | 24 of 30 | 112 |
  | **30** | **2** | **1** | **25 of 30** | **24 of 30** | **104** |

  The first row is M19's numbers with M20's nodes. Credits at the end are for the default player, with long jumps.
- **M20's check** (scratchpad `m20/verify.mjs`), by touch at 905 × 370, 821 × 283 and 960 × 825: 32 of 32 at each size.
  - The map: known nodes marked as the sim says and the rest ?, with the hint saying so. Every button is 48 px or more and takes a tap at its middle.
  - Scan: the first tap asks and the second scans (heat +2, saved). Everything within two jumps is made out, and Scan steps back.
  - The picked node says what it holds. The jump opens the card: three choices, the odds on the risky one, nothing else moving, and the card whole.
  - A choice's first tap spells out the odds and changes nothing, with the odds and every choice still whole. Left alone, it stands down.
  - Quit and reopen: the event is still open. Two taps choose, saved: the outcome is the one the roll falls in, and the credits and part are as the result says.
  - The result: what happened, "Rolled 21: the 70% came up.", the changes, the card whole. Carry on returns to the chart, the node marked done, and the ship jumps on.
  - A choice that can't be paid says what it needs, and the choice that needs nothing works.
  - A v10 save opens on the map as v11. Offline, with the server stopped, the map opens from the cache. No console errors or warnings.
- **Every card at every size** (scratchpad `m20/measure.mjs`): each of the 10 events as it opens, each choice's first tap, and each choice's result. That is 66 states at each of the three sizes, all whole, with no words to scroll.
- **Regressions,** one after another:
  - **M19's check** (adapted, below): 52 of 52 at each size, run again after the card's fix;
  - **M18's check:** 43 of 43 at each size;
  - **M18's column check:** 15 of 15 at each size;
  - **M17's check** (as adapted in M19): 37 of 37 at each size;
  - **M16's check:** 29 of 29 at each size;
  - **M15's check:** 30 of 30 at each size;
  - **M14's check:** 41 of 41 at 905 × 370, with a job of each kind played by touch. The count depends on the boards dealt: this run met all three kinds in three jobs, and M19's run needed four, hence its 46. It takes over 15 minutes;
  - **M14's saves check:** 10 of 10, v4 saves migrated through to v11;
  - **M13's check:** 24 of 24;
  - **M8's fight sandbox checks:** the fight and the orders column pass with no console errors. The extras pass all 8 of their checks, offline with the server stopped, also with no console errors. M19's notes counted them twice, as 16.
- **What changed in the old checks:** M19's check (`m19/verify20.mjs`) now settles any event it meets on the way, reads save version "10 or later", and settles events in the run it crosses by the sim.
- **Found and fixed by the checks:**
  - **The card let the chart show through** at 95% opacity, and the buttons under it could still take focus. The card is solid now, and the panel and chart under it are inert.
  - **The odds clipped the choices.** On the 283 px-tall screen, a first tap's odds ran to two lines and pushed the choices 3 px under the card's edge. The words now scroll in their own box, which they need at no size checked, and the card is a little tighter on short screens. M20's check now tests the card after the first tap and after the result, not only when it opens.
  - **The hint under a result** said "Tap a ringed node", under a card that covers the chart. It now says "Carry on to the chart."

### Known issues

- **Credits pile up.** The median run ends act 2 with about 100 (180 with no long jumps), and supplies are all there is to buy.
- **Parts found can only be sold.** Construction mode stays in act 1's hangar, so a part from a derelict can't be fitted. A scrap dealer buys it (§9).
- **Wounds stay.** Hit points lost to hunger, hazards and events stay lost until M23's med bay. The test player loses 6 at the median.
- **Heat still does nothing in act 2,** so a scan's 2 heat costs nothing real until M24. The meter still names act 1's levels: "Raid" past 75.
- **Events repeat.** A run meets about 11 events across five sectors, from 10. None repeats within a sector while its kind's events last.
- **An M19 save's current sector has no events.** Its ? nodes are all empty space; the next sector has events.
- **No event starts a fight yet.** Ambushes and boardings are M21 and M22.
- **The derelict mark is small** inside its ring on the cover screen.

### What to test on the phone (Galaxy Z Fold 6)

1. **Continue your M19 save,** or launch a new one: the map opens. The sector you were in has no events; jump on to the next.
2. **? nodes:** tap one, and the left panel says "Unknown". Then Scan in the footer: the first tap says what it would show and for how much heat, and the second makes out every node within two jumps.
3. **An event:** jump to a derelict, distress call, trader or hazard, and the card opens. Tap a choice to see its odds spelled out, then tap it again: the roll, and what changed. Then Carry on.
4. **A choice you can't pay** (a trader's deal with no credits, say): it is greyed out and says what it needs.
5. **Quit with an event open and reopen:** the card is still there.
6. **Both screens:** does the card fit and read, and are the choices easy to hit?
7. **Tell me:**
   - whether events feel worth stopping for;
   - whether scanning for 2 heat is right;
   - whether supplies now feel loose;
   - whether the ? and the marks read at a glance;
   - and the M14 to M19 questions still open.

### Next session

**M21 Approach phase** (§4.2). Settle its Done when first. The draft is "a hostile ship at a node fights the approach phase to one of its outcomes with the odds shown, and its damage carries into the boarding map as wrecked rooms."

## M19 Sector generator, supplies and jumps (2026-10-12)

**Status:** done, and the ROADMAP.md box is ticked. Evan said "Gate 3 passed, start the next milestone". M18's notes planned to detail Phase 4 with Evan before M19; I drafted it instead (ROADMAP.md §7), with M19's Done when stated at the start of the session and M20 to M25 marked as drafts. No phone results have come back yet for M14 to M18.

Done when: "from launch, a run crosses three sectors by jumping and restocking at stations; supplies and heat move as `data/balance.json` says; the same seed always gives the same sectors."
- **`tests/voyage.test.js`:** campaign seeds 1 to 3 each play act 1 to launch (`tools/run.js`). The test player (`tools/voyage.js`) then crosses all five sectors, restocking at stations in at least two of the first three. Every jump and every purchase moves supplies, credits, heat and hit points exactly as `balance.json` says. The same seed gives the same five sectors and the same steps.
- **By touch in Chromium** (below): launch, the map, jumps, a long jump, a station, the next sector, quit and reopen.

### Shipped

- **Sectors** (`src/sim/gen/sector.js`, the content in `data/sectors.json`). A sector is a seeded map in 7 columns:
  - the way in alone in the first column, the jump point alone in the last, and 2 or 3 nodes in each column between;
  - links join each node to the next column by its height, so none cross and every node can be reached. Between any two columns, 35% of the time (`extraLinkChance`), one link more is added where it crosses nothing;
  - 1 or 2 stations, each in a column of its own. Every other node is empty space until M20;
  - names from the data's lists, none twice in a sector, and no sector's name twice in a run.
- **The run** (`src/sim/travel.js`), from the first time act 2's home opens:
  - **A jump** goes to a linked node: it eats a supply for each crew member, and heat goes up 3.
  - **A long jump** goes to a node two links away: three times the supplies, and heat goes down 10.
  - Jumps go back as well as on.
  - **Hunger:** a jump the supplies don't cover still goes. They run out, and each crew member loses 2 hit points, never the last one.
  - **Stations** sell supplies at 1 credit each, up to what the holds take: 24 in the lockers and 20 for each cargo hold.
  - **The jump point** leads into the next sector's way in, for a jump's supplies and heat. Act 2 has 5 sectors. Past the last one the charts end, for now, with the words the stub had.
  - Each sector is rolled from the campaign's RNG as the ship enters it and saved whole.
- **The sector map** (`src/ui/campaign/sector.js`, words in `sectorText.js`) replaces the stub as act 2's home. The stub stays for act 3.
  - **The chart** fills the middle: links, and a button for each node. Marks show the way in, stations and the jump point. The ship sits over its node and glides to the next, or jumps there with reduced motion. A node a jump reaches is ringed: solid for a jump, dashed for a long one.
  - **Picking a jump:** a tap on a node shows on the left what the jump eats, what is left, and heat after it, and draws its way. A second tap, or Jump (Long jump), makes it. A node out of reach says why.
  - **Stations:** Buy 3 (a jump's worth) and Fill up, in the footer, two taps each. The first says the price.
  - **The jump point:** Jump on, two taps, into the next sector.
  - **Around the chart:** the crew, supplies and credits on the right; heat by the act; Title.
  - **Fit:** each node's button is its share of its column, so no two overlap and each stays 48 px or more at every size checked.
- **The title's Continue** says the sector: "Act 2 · Sector 2 · Tollway Nine".
- **`SAVE_VERSION` 10:** the campaign gains its supplies and its run. A v9 campaign gets no supplies and no run; the run begins, holds full, when the map first opens. The run's shape is checked when a save loads (`src/sim/runShape.js`).
- **The hangar's heat meter** moved into `hubParts.js` so the map shares it. The hangar shows the same.
- **Data and tools:**
  - `data/balance.json` gains `baseSupplies` 24, `jumpSupplies` 1, `longJumpFactor` 3, `supplyPrice` 1, `hungerHp` 2, `jumpHeat` 3 and `longJumpHeat` −10;
  - `data/campaign.json` gives act 2 its 5 sectors, and its stub words now speak of the charts' end;
  - the validator checks the sectors' data (`tools/validate-sectors.js`): the layout, the node kinds, names enough for every node and every sector of a run, and the new balance numbers;
  - `node tools/sectors.js` prints a sector (`--seed`, `--golden`);
  - `node tools/voyage.js` runs test voyages from launch (`--runs`, `--long heat|never`, `--set`).
- **Tests:** 501 in all, up from 478:
  - the generator, its golden file and its rules over 300 seeds (`tests/sector.test.js`);
  - the run's rules, the reducer's actions and the v9 to v10 migration (`tests/travel.test.js`);
  - the Done when (`tests/voyage.test.js`);
  - the map's words and Continue's (`tests/sectorText.test.js`);
  - the validator's new mistakes.
- **Golden files:** a new one, `tests/golden/sectors.txt` (the first sector at seeds 1 to 3). None changed.

### Decisions made this session

Evan didn't weigh in on any of these:
- **Phase 4 is my draft.** M19's Done when was stated at the start; M20 to M25 carry "Done when (draft)", to settle as each starts.
- **Supplies: 24 in the lockers, 1 credit each.** I started at 12 and 3: every test voyage starved, because 12 supplies (4 jumps for a crew of 3) don't reach from one station to the next. The numbers are below. M20 brings income and should retune them.
- **Hunger costs hit points and never ends a run.** Nothing in act 2 heals until M23's med bay, so the loss stays.
- **Jumps go any way within reach,** back included, and a long jump is any node two links away.
- **Leaving a sector costs a jump:** its supplies and its 3 heat.
- **The run begins when the map first opens,** holds full, as if the hangar stocked the ship. A v9 save at the stub gets the same.
- **The sector map is a flat chart:** SVG and buttons, like the job board, not a scene through the 3D camera. It doesn't touch the locked graphics decision, which is about ships; a 3D chart is in §9.
- **Buying is a jump's worth or a fill-up,** each two taps; there is no count to type.
- **Heat in act 2 uses act 1's levels and words** until M24.

### Verified here

- `node --test`: 501 pass. `node tools/validate-data.js`: OK, with 4 kinds of sector node.
- **`node tools/sim.js`:** the new balance numbers aren't used in fights, and the summary is M11's:
  ```
  All               1,000  49% (46–52)           41%        10%  7 (5–11)           28
  Shots: 23,504, 23.5 a fight. Hit: crew 57%, boarders 40%.
  A fight: 1.8 crew go down, 0.9 bleed out, 2.8 boarders die.
  ```
- **`node tools/voyage.js --runs 30`** (campaign seeds 1 to 30, each launched from its act 1 test run):
  ```
  long jumps when heat is at 50 or over (the default):
  Sectors crossed: 5 (5 to 5); 30 of 30 reached the end of the charts.
  Jumps: 31 (28 to 34), long 3 (0 to 6), hungry 9 (0 to 27).
  In the first three sectors: restocked at 3 (0 to 3) stations; hungry on 2 (0 to 14) jumps; fed all the way in 9 of 30.
  Supplies bought: 50 (0 to 108), for 50 (0 to 108) credits. Launch credits: 50 (0 to 220).
  Heat at launch: 48 (24 to 49); at the end: 100 (46 to 100).

  --long never:
  Jumps: 34 (34 to 34), long 0 (0 to 0), hungry 5 (0 to 26).
  In the first three sectors: restocked at 3 (0 to 4) stations; hungry on 0 (0 to 13) jumps; fed all the way in 18 of 30.
  Heat at the end: 100 (100 to 100).
  ```
  Long jumps keep heat down and cost supplies, so the runs that make them go hungry more. The runs that go hungry in the first three sectors launched with few credits.
- **Tuning** (the same 30 launches, no long jumps; first three sectors):

  | Lockers | Price | Hungry jumps (median) | Fed all the way |
  | --- | --- | --- | --- |
  | 12 | 3 | 10 | 0 of 30 |
  | 12 | 1 | 7 | 0 of 30 |
  | 24 | 2 | 3 | 10 of 30 |
  | 24 | 1 | 0 | 18 of 30 |
  | 30 | 1 | 0 | 21 of 30 |

  At 12, even free supplies wouldn't help: the holds run dry between stations. 30 left stations mattering less.
- **M19's check** (scratchpad `m19/verify.mjs`), by touch at 905 × 370, 821 × 283 and 960 × 825: 52 of 52 at each size.
  - Launch, the lift-off, Continue: the map, the run begun and saved as v10, holds full.
  - The chart's nodes, links and rings match the sim. Every button is 48 px or more and takes a tap at its middle. No two node buttons overlap, and the side panels show whole.
  - A tap shows a jump and moves nothing; a second makes it, saved. A long jump by the Jump button, its way drawn. A node out of reach does nothing.
  - A station: Buy's first tap asks, stands down after 3 s, and two taps fill the holds.
  - The jump point: Jump on's first tap asks; the second leads into sector 2, a new name and chart.
  - Quit and reopen: Continue names the sector and opens the same map.
  - The last sector's jump point: the end of the charts, the stub's words, no Jump on.
  - A v9 save opens on the map with the run begun, as v10.
  - Hunger: the jump says so, and costs each crew member 2 hit points.
  - Reduced motion stops the ship's glide. Offline, the map opens. No console errors or warnings.
- **Regressions,** one after another with nothing else running:
  - **M18's check:** 43 of 43 at each size, once its three checks pinned to save version 9 read "9 or later";
  - **M18's column check:** 15 of 15 at each size;
  - **M17's check** (adapted, below): 37 of 37 at each size;
  - **M16's check:** 29 of 29 at each size;
  - **M15's check:** 30 of 30 at each size, the hangar's heat meter included;
  - **M14's check:** 46 of 46 at 905 × 370, three jobs played to the end by touch with no drags needed. It takes over 15 minutes;
  - **M14's saves check:** 10 of 10, v4 saves migrated through to v10;
  - **M13's check:** 24 of 24;
  - **M8's fight sandbox checks:** the fight and the orders column pass with no console errors; and the extras, 16 of 16, offline with the server stopped.
- **What changed in the old checks:**
  - M17's check expected the stub after launch; its copy (`m17/verify19.mjs`) expects the map. The stub's own checks (how act 1 went) are gone with it from act 2.
  - M18's three checks pinned to v9 now read "9 or later".
  - **Offline checks:** Playwright's `setOffline` doesn't stop the service worker's own fetches, so a file missing from the cache can still load. M19's check stops the server instead. M8's extras do too, and they caught the new files missing from `sw.js` before `tools/precache.js` ran; the pre-commit hook runs it in any case.
- **Found and fixed by the checks:** on the 283 px-tall screen, the Buy buttons sat below the left panel's edge, so a tap there hit Title. They moved into the footer. The Ship panel lost its last row there too, so "A jump eats" went: each jump's preview says it.

### Known issues

- **A broke launch starves.** With no credits there is nothing to buy, and the crew is down to 1 hit point by the second sector. Nothing in act 2 pays until M20.
- **Heat does nothing in act 2 yet,** and without long jumps it reaches about 100 by the end of the third sector (87 to 100 over 30 test runs). The meter still names act 1's levels: it says "Raid" past 75, and there are no raids in act 2.
- **Hit points lost to hunger stay lost** until M23's med bay.
- **Empty space is empty.** The nodes between stations have nothing at them until M20.
- **Names are only in the left panel,** for the node the ship is at or the one picked (§9).
- **No tips for the run** (§9).
- **The charts end at the fifth jump point** with a note; act 2 has no ending until M25.

### What to test on the phone (Galaxy Z Fold 6)

1. **Launch** (or Continue an act 2 save): the map opens, "Sector 1 of 5", holds full.
2. **Jumps:** tap a ringed node; the left panel says what it eats and what heat does. Tap it again to go. Then a dashed node for a long jump, by the Jump button: heat drops 10.
3. **A station** (the green mark): Buy 3 and Fill up in the footer, two taps each.
4. **The jump point:** Jump on, two taps, into sector 2. Spend supplies down and see hunger.
5. **Quit mid-sector and reopen:** Continue names the sector, and the map is as you left it.
6. **Both screens:** are the nodes easy to hit, and does the map read at a glance?
7. **Tell me:**
   - whether supplies feel tight or loose;
   - whether long jumps are worth it;
   - whether jumping back should stay;
   - whether the flat chart is fine, or should be 3D like the ships;
   - and the M14 to M18 questions still open.

### Next session

**M20 Node types, events and scanning.** Settle its Done when with Evan first: the draft is "ten events play from data, and a run earns its keep from the nodes it picks". Then retune supplies against what nodes pay.

## Gate 3 (2026-10-12)

**Passed.** Evan's words: "Gate 3 passed, start the next milestone".
- That passes M18's Done when, so M18's box is ticked. v0.1 is done: Phases 0 to 3.
- No phone results have come back for M14 to M17 or for the toolbar's move. The gate is Evan's call, so it stands as passed.
- Phase 4 starts with M19 (sector generator, supplies and jumps). ROADMAP.md held Phase 4's details until v0.1 shipped. They are drafted there now, with M19's Done when in full and the rest marked as drafts.

## M18 First run and settings (2026-10-12)

**Status:** done; Gate 3 passed (above), and the ROADMAP.md box is ticked. M18's Done when is Gate 3, which Evan runs. After M17, Evan said "Start the next milestone". After the first M18 merge, Evan said "Move the toolbar into the right-hand column", the fix for the back-row taps the browser checks found (below). No phone results have come back yet for M14 to M17.

Done when: "Gate 3 passes": "a stranger plays from the first screen to launch unaided." Only a person can pass it. What I could check:
- **The first run, by touch, following only the tips:** from an empty browser, through captain creation, the build and the first job's whole fight, at all three screen sizes.
- **The rest of act 1 is reachable at every difficulty:** 50 test runs at each (`tools/run.js`) all reach launch.
- **Not checked:** whether a stranger understands any of it. That is the gate.

### Shipped

- **Captain creation** (`src/ui/campaign/captain.js`). New game opens "Your captain":
  - the background, fixed in v0.1: the miner and who is after them;
  - a name, filled in from the background's list (`captains` in `data/backgrounds.json`) and free to change, up to 24 letters;
  - a job (Marine, Engineer or Medic). The captain takes that job's place in the crew;
  - 2 of 6 traits (`data/traits.json`). Each button shows what the trait does, and a tap adds its line of flavor. A third pick drops the first.

  The captain's numbers show with the traits. Start waits for a name, a job and two traits, and says what is missing. Title goes back with nothing changed.
- **Traits in the rules** (`src/sim/traits.js`): each adds to hit points, aim, defense, mobility or armor. The captain fights with them on jobs, in raids and at home, and full health counts them, so the hangar heals to the new top.
- **Settings** (a new button on the title):
  - **Difficulty:** Easy, Normal (as before) or Hard. On Easy enemies aim 10 worse and have 1 hit point fewer; on Hard, 5 better and 1 more (`data/balance.json`). From the next fight.
  - **Forgiving odds:** off unless turned on. It is §4.3's rule: each miss in a row adds 10 to the crew's next shot, up to 30, and the odds shown include it. From the next fight.
  - **Motion:** As the phone (the default), Reduce or Full. Reduce stills the title's stars and the lift-off, and stops the fades.
  - **Frame rate:** 60 or 30 fps, until now only in the dev menu.
  - **Tips:** on or off, and "Show tips again".
  - **Save:** Export makes a save code, Copy copies it, and Import checks a pasted code. A second tap ("Replace save?") puts it in place of the campaign. The line above them says why: the save lives in the browser.

  Each row says what the choice picked does, with its numbers from the data.
- **Tips** (`src/ui/tips.js`; the steps in `src/ui/tipSteps.js`, the words in `data/tips.json`). There are 11, in the order a new player meets them:
  1. the hangar's goal;
  2. Build;
  3. the part to pick (the one the checklist needs);
  4. where it goes;
  5. back to the hangar;
  6. Jobs;
  7. Take the job;
  8. the crew;
  9. moving;
  10. shooting;
  11. End turn.

  One shows at a time, with its control ringed and the card beside it, never over it. Got it puts it away, and so does using the control. Either way it is saved and never shows again. In a fight a tip waits while the enemy plays or the end panel is up.
- **`SAVE_VERSION` 9:**
  - settings gain difficulty, forgiving odds, motion, tips and the tips put away;
  - crew members gain traits, none for a campaign already under way;
  - a campaign gains its captain: its first crew member, as named.
- **The hangar's crew list** puts the captain's job under their name.
- **The fight's toolbar is in the right-hand column** (Evan's call). Title, Log and Fit head the orders' column, with the orders at the bottom as before; no button sits over the board.
  - **Why:** Chrome takes a tap on a tile beside a button for the button, and three back-row tiles of a job's map sat just under the toolbar on the folded screens.
  - **Where room runs out:** the column scrolls to keep every order in sight, and the tools scroll away above them first. The edge with more past it fades, and a swipe on the column brings them back. Where even the orders alone don't fit (six at once in a browser tab on the cover screen), they show from the top, so Reload is the one cut, as before.
  - `src/ui/fight/panels.js` scrolls the column when the orders shown change or the screen does, never while the player is scrolling it.
- **The settings list scrolls from anywhere on it.** At the folded size its two columns are uneven, and a swipe on the space under the shorter one used to go through to the starfield. The browser check found this.
- **Data and tools:**
  - the validator checks traits (stats, ranges, at least 2), tips (each with a step, and none longer than 200 letters), the captains' names and the difficulty numbers;
  - `tools/run.js --difficulty easy|hard`.
- **Tests:** 478 in all, up from 466:
  - captains, traits in each kind of fight, difficulty, settings into fights, the settings actions, and the v8 to v9 migration (`tests/captain.test.js`);
  - the captain screen's words (`tests/captainText.test.js`);
  - tips and their words (`tests/tips.test.js`);
  - the validator's new mistakes.
- **Golden files:** none changed.

### Decisions made this session

Evan didn't weigh in on any of these:
- **Sound is cut from M18.** There is no audio until M35, so a switch would do nothing; it comes with M35.
- **Difficulty is the enemy's aim and hit points, not permanent death.** Permanent death needs recruits and a game over, which act 1 has neither of (§9).
- **Hard is +5 aim and +1 hit point.** My first try, +10 and +2, left 7 of 50 test runs short of launch; at +5 and +1 all 50 launch. Details below.
- **Traits add straight to the job's numbers.** §4.5's attributes (Grit, Aim, Wits, Nerve) aren't in yet.
- **The captain comes with a name and a job filled in,** so the one choice to make is the two traits. None are picked for you.
- **The defaults keep a new game as it was:** Normal, forgiving odds off, motion as the phone asks.
- **Tips are on for saves from before M18 too.** A returning player sees them once, and can turn them off.
- **The tips stop at the first fight.** The shop, heat, raids and launch have their hangar hints, but no tips (§9).
- **In the right-hand column the orders win the room.** Evan picked the column, and I chose how it fills: Title at the top, the least used in a fight and the first to scroll away, then Log and Fit. The tools are 48 px tall and the column keeps its 80 px width, so the board stays the size it was.

### Verified here

- `node --test`: 478 pass. `node tools/validate-data.js`: OK, with 6 traits.
- **`node tools/sim.js`:** no balance number it uses changed, and the summary is M11's:
  ```
  All               1,000  49% (46–52)           41%        10%  7 (5–11)           28
  Shots: 23,504, 23.5 a fight. Hit: crew 57%, boarders 40%.
  A fight: 1.8 crew go down, 0.9 bleed out, 2.8 boarders die.
  ```
- **Difficulty** (`node tools/run.js --runs 50 --difficulty …`, seeds 1 to 50, test captain without traits):

  | Difficulty | Ready to launch | Jobs (median, range) | Jobs done | Minutes, slow pace |
  | --- | --- | --- | --- | --- |
  | Easy | 50 of 50 | 5 (3 to 11) | 87% | 36 (22 to 74) |
  | Normal | 50 of 50 | 7 (3 to 14) | 70% | 44 (22 to 92) |
  | Hard | 50 of 50 | 8 (3 to 29) | 58% | 53 (25 to 176) |

  Normal is M16's run exactly. Hard's slowest run takes 29 jobs.
- **M18's check** (scratchpad `m18/verify.mjs`), by touch at 905 × 370, 821 × 283 and 960 × 825: 43 of 43 at each size.
  - **An empty browser:** New game and Settings, no Continue.
  - **Captain creation:**
    - a name from the list;
    - Start waits for two traits, and a third drops the first;
    - the numbers with the traits;
    - every button 48 px or more;
    - Start saves v9 with the captain, their job and traits, and 10 hit points with Thick skull.
  - **The tips, followed in order:** each rings its control. Got it is 48 px or more, and using a control puts its tip away. Both parts get fitted by touch, then a job is taken and its fight played to the end by touch, with no tip in the way. All 11 are saved as seen, and none shows again.
  - **Settings:**
    - each choice is saved, every button is 48 px or more, and the lines quote the data;
    - a swipe scrolls the list from a button or from the empty space, and changes nothing;
    - Tips off, then Show tips again;
    - Export gives a v9 code;
    - a damaged code is named;
    - a good code takes a second tap and replaces the save.
  - **Settings reach the fights:** a job's fight has forgiving odds on, and enemies aim 5 better on Hard. The captain fights with the traits' hit points and mobility.
  - **Reduce motion** reaches the page, and the lift-off stands still with Continue at once.
  - **A v8 save** opens as v9: the first crew member leads, and the first tip shows.
  - **Offline,** Settings and the hangar open.
  - **No console errors or warnings.**
- **Regressions,** run one after another with nothing else running. They go through captain creation, with tips turned off in Settings, as a player who knows the game would:
  - **M17's check:** 38 of 38 at each size.
  - **M16's check:** 29 of 29 at each size.
  - **M15's check:** 30 of 30 at each size.
  - **M14's check:** 47 of 47 at 905 × 370. Its total moves with the jobs a run draws. Earlier runs this session often stalled on an order: every stall whose tile I logged (5 of them) was on the back row under the toolbar (known issues).
  - **M14's saves check:** v4 saves migrated through to v9, 10 of 10.
  - **M13's check:** 24 of 24.
  - **M8's fight sandbox checks:** the fight, the orders column and the extras pass, with no console errors.
- **After the toolbar moved,** checked again by touch at the three sizes:
  - **A new check of the column** (scratchpad `m18/column.mjs`), 15 of 15 at each size, on a grab job with the captain beside a crate:
    - Title, Log and Fit, top down, 48 px or more, with none over the board;
    - with four orders every order is in sight, and the edge fades where the column scrolls;
    - with six and seven orders, every order is in sight where they fit, otherwise they show from the top with Reload cut;
    - Fit after a pinch, Log opening and closing the log, and Title, all by touch;
    - the back row takes a tap all along it, the tiles once under the toolbar included;
    - no tile's middle is within 15 px of a button.
  - **The board is the size it was** (697 × 370 at 905 × 370), and the column is still 80 px wide.
  - **Every check above passes again:**
    - M18's 43 at each size, with its first fight by touch;
    - M17, M16 and M15 at each size;
    - M14's 41 of 41, with no drags needed;
    - M14's saves check and M13's check;
    - M8's fight, orders column and extras.
  - **M8's fight check found one thing:** in dev mode, scrolling to a tool parked it under the DEV button. The column now has scroll padding below DEV in dev mode.
- **What changed in the old checks:**
  - M17's two "v8" checks now read "v8 or later".
  - M14's healing check counts traits.
  - The harnesses scroll panels by swiping. A scroll made by script is undone by the next touch in headless Chromium, so the old checks' taps after one landed on the wrong row.
  - **M14's harness plays fights more like a player:**
    - it taps a part of a tile no unit stands in front of;
    - it gives an order up to 5 s to be saved;
    - it drags the board before tapping a tile beside the toolbar (known issues).

### Known issues

- **Gate 3 hasn't been run.** Everything above is a script following the tips; a stranger may stall where a script can't.
- **Fixed: three back-row tiles sat under Log, Fit and Title** on job maps at the folded sizes. On a 14 × 8 map these were tiles 11 to 13 of row 0, at 905 × 370 and 821 × 283.
  - **What went wrong:** Chrome moved a touch that close onto the button. A tap meant for one of those tiles opened the log, refit the camera, or left for the title.
  - **History:** M8's toolbar had sat over M14's maps since M14. M14's browser check hit it 5 times this session.
  - **The fix:** the toolbar moved into the right-hand column (Shipped). Every tile now takes a tap, and no tile's middle is within 15 px of a button.
- **On the cover screen, the column can't hold the tools and four or more orders.** What scrolls away at the top:
  - with four orders, Title fades out;
  - with six, Log goes too, and Fit is cut;
  - in a browser tab on the cover screen, most of Title goes even with three, and half of Log with four.

  A swipe down on the column brings them back.
- **No tips after the first fight.** The shop, heat, payments, raids and launch rely on the hangar's hints.
- **The captain has no portrait,** and a long typed name is cut in the hangar's crew list (the job shows under it).
- **Reduce motion doesn't change a fight's playback.** Units still walk tile to tile in the enemy's turn; Skip jumps to its end.
- **A save code is about 2,100 characters.** Copy uses the clipboard; if the phone blocks that, the note says to select the code and copy it by hand.
- **Sound:** none until M35.

### What to test on the phone (Galaxy Z Fold 6)

1. **Gate 3** (the Done when): hand the phone to someone who hasn't played. Start them on the title with an empty save, then don't help. Note:
   - where they stall, and for how long;
   - whether they read the tips or tap Got it straight away;
   - whether they reach launch, and how long it takes.
2. **Captain creation** on both screens: the name field with the keyboard up, two traits, Start.
3. **Tips:** does each point at the right thing, and does any get in the way?
4. **The right-hand column** in a job's fight, folded:
   - tap tiles at the far right of the back row, where the toolbar was: they should take;
   - with Grab or Open door showing, Title fades out at the top of the column. A swipe down on the column brings it back.
5. **Settings:**
   - Export, Copy and paste the code somewhere safe;
   - Import it again (Replace save?);
   - Hard, and Reduce motion with the lift-off.
6. **Tell me:**
   - whether Gate 3 passes;
   - whether Title scrolling away on the cover screen bothers you;
   - whether the traits read in the tone;
   - whether Hard and Easy feel right;
   - and the M14 to M17 questions still open.

### Next session

**Gate 3 is Evan's call,** and Phase 4 waits for it.
- **If it passes:** record it here and in ROADMAP.md, and tick M18. v0.1 is then done. ROADMAP.md says Phase 4 is detailed after v0.1 ships, so the next session's first task is detailing Phase 4's milestones with Evan before M19.
- **If it doesn't:** the next session fixes where the stranger stalled, inside M18. Likely candidates:
  - more tips (the shop, heat, launch);
  - clearer hangar hints.

## M17 Launch (2026-10-12)

**Status:** done, and the ROADMAP.md box is ticked. After M16, Evan said "Start the next milestone". No phone results have come back yet for M14, M15 or M16.

Done when: "launching saves and moves on cleanly."
- **Launching saves.** Launch is one campaign action, saved the moment it happens like every other change. The lift-off after it is only a screen. Quit during the lift-off and reopen: the title says "Act 2 · Your ship", and Continue opens the stub.
- **It moves on cleanly.** The campaign goes to act 2, at its home, with the ship, crew, credits, parts, heat and RNG as they were. The job board and the shop's stock stay behind (empty). From act 2, the hangar's jobs, raids, payments and shop all refuse, and `campaignProblems` finds nothing wrong with the launched campaign.
- **Tested on real ends of act 1,** not just hand-built ones: `tests/launch.test.js` plays five runs of `tools/run.js` to the checklist, launches each, and saves it through the save format.

### Shipped

- **Launch in the sim** (`src/sim/launch.js`):
  - only from the hangar, only when every flight check passes (lifting off included), and never past the last act;
  - a raid at the door doesn't stop it. `flags.escapedRaid` records it, and heat goes along into act 2.
- **The hangar stays behind** (`src/sim/acts.js`, `atHangar`): the job board, the shop, payments and raids ask whether the campaign is at the hangar, act 1's home. Before, they asked only whether it was at its hub, which an act 2 campaign also is.
- **`SAVE_VERSION` 8:** nothing in a v7 save changes, and the migration passes it through. The bump is there because a campaign can now be past act 1, and a build from before M17 would open one on the hangar.
- **Words as data:**
  - each background's `launch` in `data/backgrounds.json`: `text` as the ship lifts off, and `escaped` for a raid left at the door;
  - an act's `stub` in `data/campaign.json`: what stands in for act 2 until v0.2.

  The validator checks both.
- **Screens:**
  - **The hangar:**
    - Once every check passes, Launch leads the goal panel, and Build steps back from orange.
    - The first tap asks: "Lift off and end act 1? The job board and the shop stay behind. Tap Launch again." The second launches.
    - With a raid at the door and the ship ready, the hint offers the way out: launch, and leave them an empty hangar.
  - **Construction mode:** when the last check passes there, the hint points to the hangar's Launch.
  - **The lift-off** (`src/ui/campaign/launch.js`, drawn by `src/render/liftOff.js`) takes about 5 seconds:
    - the engines light and shake the ship;
    - it climbs toward the camera;
    - it flies off nose first, ever faster, until it is out of sight.

    The background's words come up as it climbs, then the pursuer's if a raid was due. Skip jumps to the end, and Continue goes on to the stub. With reduced motion set on the phone, nothing moves: the ship stands with its engines lit, and the words and Continue show at once.
  - **The stub** (`src/ui/campaign/stub.js`):
    - "Act 2 · The run" and "Your ship", with the ship in the middle;
    - how act 1 went: jobs, raids, credits, parts on hand and heat;
    - the crew, and the stub's words.

    Title is the only way out. The title's Continue says "Act 2 · Your ship" and comes back here.
  - The hangar and the stub share their panels and the standing ship (`src/ui/campaign/hubParts.js`).
- **Tests:** 466 in all, up from 450:
  - the launch rules and act 2 (`tests/launch.test.js`);
  - the words (`tests/launchText.test.js`);
  - the lift-off's timing, camera and flames (`tests/liftOff.test.js`);
  - the validator's new mistakes.
- **Golden files:** none changed.

### Decisions made this session

Evan didn't weigh in on any of these:
- **Launch is only at the hangar,** at the top of the goal panel, and takes two taps like Pay. Construction mode points there, so act 1 ends in one place.
- **Launching with a raid due is allowed.** It's the way out: the pursuer finds an empty hangar, and the words say so. Heat carries into act 2, since §4.4 has heat in all three acts.
- **Skip goes to the end of the lift-off, not past it,** so its words can still be read. Continue then goes on.
- **The stub keeps the campaign whole** for v0.2 to pick up. Nothing is reset. New game (two taps) is the way to play act 1 again.
- **The lift-off is drawn in space,** like the hangar's view of the ship. There's no ground or hangar under it; a glow on the pad stands in for one.

### Verified here

- `node --test`: 466 pass. `node tools/validate-data.js`: OK.
- **`node tools/sim.js`:** no balance number changed, and the summary is M11's: example ship 64% (58–70), all 1,000 fights 49% (46–52), 23,504 shots.
- **M17's check** (scratchpad `m17/verify.mjs`), by touch at 905 × 370, 821 × 283 and 960 × 825: 38 of 38 at each size.
  - **A new game** has no Launch.
  - **The last check passing in construction mode:** the third engine is fitted by touch, the hint points to the hangar, and Launch waits there.
  - **A ship ready to launch:**
    - Launch shows with the hint, every button 48 px or more;
    - the first tap asks and launches nothing, and left alone it stands down;
    - two taps launch and save at once: v8, act 2, an empty board and stock, and everything else unchanged.
  - **The lift-off:**
    - the background's words come up as it climbs;
    - Continue at the end, 48 px or more;
    - the stub with how act 1 went, the crew and the words from the data;
    - Title, and the title's Continue says "Act 2 · Your ship" and comes back. Looking around changes nothing in the save.
  - **Skip** goes to the end at once, every word up.
  - **Quitting during the lift-off** reopens to "Act 2 · Your ship", and Continue opens the stub.
  - **An M16 save (v7)** launches and saves as v8.
  - **A raid at the door:**
    - the hint offers the launch;
    - the pursuer's words show on the lift-off;
    - the flag and the heat are saved;
    - the stub's record says "1 left at the door" and "80 · Raid".
  - **Reduced motion:** every word and Continue at once, and the ship stands still with its engines lit.
  - **Offline,** the stub opens with its words.
  - **No console errors or warnings.**
- **The lift-off frame by frame** on a paused page clock (scratchpad `m17/frames.mjs`), at 905 × 370 and 960 × 825. Before I capped it, the ship at rest filled the unfolded screen and its flames ran off the left edge. It now takes up to 60% of the width, which leaves room for the flames and the climb. `tests/liftOff.test.js` checks both screen shapes: the ship stays in sight through most of its flight and is out of sight once gone, at 4.2 s.
- **Regressions,** after the hangar moved onto the shared pieces:
  - **M16's check:** 29 of 29 at each size. Its two pinned "v7" checks now read "v7 or later".
  - **M15's check:** 30 of 30 at each size.
  - **M14's check:** 39 of 39 at 905 × 370. One of its checks counts only when a job won pays a part, so the total moves with the random seed (40 in M16's run).
  - **M14's saves check:** v4 saves migrated through to v8, 10 of 10.
  - **M13's check:** 24 of 24.
  - **M8's fight sandbox checks:** the fight, the orders column and the extras pass, with no console errors.

### Known issues

- **Past the launch there is only the stub.** A launched campaign waits there for v0.2. New game is the way to play act 1 again, and it ends that campaign after its second tap.
- **The lift-off is drawn over the starfield,** with no hangar or Tailings below to leave. §9 already has the hangar drawn as a hangar.
- **Reduced motion follows the phone's setting.** The game's own setting comes with M18's settings.
- **The act 1 record counts only what the flags count.** Time played isn't kept.
- **On short screens the goal panel scrolls,** now that Launch takes its top 56 px. Its lines are all ticked by then.

### What to test on the phone (Galaxy Z Fold 6)

1. **Launch** (the Done when): play until every flight check passes, or continue a campaign that's there. Launch: the first tap asks, the second lifts off.
   - Does the lift-off read as the ship leaving? Are 5 seconds right, and the shake?
   - Launch again from a fresh run and quit during the lift-off. On reopening, the title should say "Act 2 · Your ship", and Continue should open the stub.
2. **The stub:** does the record match the act you played?
3. **With a raid at the door,** launch instead of defending. The pursuer's line should show.
4. **Reduced motion** (Android: Settings, Accessibility, Remove animations): the lift-off should stand still with every word shown.
5. **Tell me:**
   - whether the launch's words fit the tone;
   - whether act 1 ending in a stub feels like an ending for v0.1;
   - and the M14, M15 and M16 questions still open.

### Next session

**M18 First run and settings.** Done when: Gate 3 passes, "a stranger plays from the first screen to launch unaided."

First task: traits as data (`data/traits.json`, 6 for v0.1, §5) and captain creation in the sim: a captain with a name, 2 traits and a job, the background fixed for v0.1. Bump the save version with a migration that gives a campaign under way its captain. Test it before any screen.

## M16 Shop and economy v1 (2026-10-12)

**Status:** done, and the ROADMAP.md box is ticked. After M15, Evan said "Start the next milestone". He hasn't said whether M14's or M15's phone tests ran.

Done when: "a test run reaches launch in under an hour."
- **What I found first:** launch needed a single engine, and the repossession job always pays one. Act 1 could end after one job, so no one would have seen the hunters or a raid. Most of M16 went into making launch cost something.
- **`node tools/run.js`** plays act 1 from New game until every line of the checklist passes. A test player:
  - fits what it has;
  - sells what the ship doesn't need;
  - buys what it does;
  - pays heat down before the hunters come;
  - takes the job worth most at its crew's odds.

  The crew is played by the job player and the enemy by the AI. Time is estimated from what the run did, at the pace Gate 2 was passed on: 8 to 12 s an order, 6 to 10 s to watch an enemy turn, plus time at the board, the shop and the builder.
- **Fifty runs** (seeds 1 to 50, `tools/run.js --runs 50`):
  - all 50 reach launch;
  - jobs: median 7, 90th percentile 10, most 14;
  - minutes at the slow pace: median 44, 90th percentile 65, most 92;
  - every run is under an hour at the quick pace, and 40 of 50 at the slow pace.

  The test crew won 70% of its jobs (246 of 352); a person who wins more is quicker. `tests/run.test.js` runs seeds 1 to 10: every run launches, every one is under an hour at the quick pace, the median is under an hour at the slow pace, and the median takes at least 5 jobs.
- **Whether that holds for a person is the phone's test:** play from New game to the checklist passing and time it.

### Shipped

- **Lifting off** (`data/campaign.json`, act 1 `liftOff: 1`): leaving Homeworld means lifting off it, so act 1's checklist asks for thrust at least the ship's mass, where the frame asks half. The start ship needs three engines: each brings 3 mass of its own. Only the campaign asks this; the builder sandbox, the generator and the golden ships keep the frame's 0.50.
- **Prices** (`src/sim/economy.js`): a part costs its module's `cost` (`buyPercent` 100 in `data/balance.json`). The shop buys one back for half (`sellPercent` 50), rounded down to 5. The engine now costs 200, up from 150: the dear part.
- **The shop:** Dutch's yard, run by Dutch Abernathy (`shop` in `data/districts.json`).
  - It has 4 different parts at a time, picked by weight from its table. Engines weigh most.
  - The stock is rolled with each job board, from the campaign's RNG, so a price never changes once offered. It turns over after every job, done or lost.
  - It buys any part on hand.
- **Drop tables** (`src/sim/drops.js`): a job's part comes from its own weighted table, `drops: { chance, parts: { type: weight } }` in `data/contracts.json`, in place of M14's list and chance. With every weight at 1 it rolls exactly as M14's did, so no board changed.
- **Once-only jobs:** a job with `once: true` never comes back once done; the campaign keeps it in `spent`. The repossession is one: it is Ma Prewitt's late husband's one engine. Lost, it can come again.
- **`SAVE_VERSION` 7:** the campaign's shop stock (null until rolled) and `spent`. The migration from 6 gives a campaign no stock (the hangar rolls one, as it rolled a board for M13 saves) and no jobs done once.
- **Screens:**
  - **The hangar:**
    - Shop, between Pay and Jobs;
    - the goal's fixes name the shop's price ("Add 3 × Engine (+12 thrust each): none on hand, 200 at Dutch's yard");
    - when the shop has a part the ship needs and the credits are there, the hint says so. The hunters' warning still comes first.
  - **The shop** (`src/ui/campaign/shop.js`, words in `shopText.js`) is laid out like the job board:
    - down the left, the parts for sale, then the parts on hand, what the ship needs first and tagged "Needed";
    - on the right, the part picked: its size and stats, what launch needs of it, and its price.
    - Buy or Sell takes two taps, as Pay does. Selling a part the ship needs warns on the first tap.
    - A part bought stays picked, now on hand, and the hint says to fit it with Build.
  - **Construction mode's checklist** asks for lift-off thrust too ("needs 1.00 to lift off").
- **Tools:**
  - `tools/run.js`: a run step by step (`--seed`), runs summed up (`--runs`), and heat played three ways (`--heat hunters`, the default; `raids`; `never`).
  - The validator checks the lift-off number, drop tables, the shop (its dealer a client, a table that can fill its stock), `once`, and that selling never pays more than buying.
- **Tests:** 450 in all, up from 433:
  - prices, drop tables, the stock, buying, selling, the words and the v6 to v7 migration (`tests/shop.test.js`);
  - what the ship still needs, fitting a part, and the Done when (`tests/run.test.js`);
  - lift-off in the checklist, once-only jobs, and the validator's new mistakes.
- **Golden files:** none changed.

### Decisions made this session

Evan didn't weigh in on any of these:
- **Three engines to lift off.** I put the requirement on act 1 (thrust at least mass, the physics of a vertical launch) instead of the frame. The frame change would have changed every generated ship and `tools/sim.js`'s numbers. Stripping the start ship (the gun, spare corridors) can save one engine at most: even the smallest ship that flies needs two at 1.00.
- **The length: about 7 jobs, against ROADMAP §4.6's 8 to 12.** At Gate 2's 5 to 8 minutes a fight, 12 jobs can't fit in an hour, so the two targets conflict. I tuned for the Done when.
  - Engines at 250 gave a median of 8 jobs, but a third of the test runs went past an hour at the slow pace.
  - Engines at 200 give 7, with 4 in 5 under an hour at the slow pace.

  One number in `data/modules.json` moves it.
- **The repossession happens once.** Repeatable, it handed some runs two or three free engines.
- **A sensible test player.** It weighs each job by its crew's record on it and its twist (measured over 750 jobs), and keeps heat under the hunters. Paying only to dodge raids kept heat in the hunters' band. With engines at 250, one such run took 24 jobs.
- **Selling at half, with no buying back** what was sold. The shop doesn't stock what you sell it.
- **Prices fixed when offered,** like a job's pay, so a content change never moves a price on screen.

### Verified here

- `node --test`: 450 pass. `node tools/validate-data.js`: OK.
- **`node tools/sim.js`:** `balance.json` gained `buyPercent` and `sellPercent`, and no number a fight uses changed. The summary is M11's, unchanged: example ship 64% (58–70), all 1,000 fights 49% (46–52), 23,504 shots.
- **Heat policies** (20 seeds each, `--heat`):
  - keeping the hunters off: 7 jobs (3 to 11), 45 minutes (26 to 79) at the slow pace;
  - dodging raids only: 6 (3 to 10), 43 (26 to 71);
  - never paying: 6 (3 to 15), 43 (26 to 98), and up to 2 raids.

  Keeping the hunters off costs about a job at the median. Never paying has the longest tail.
- **M16's check** (scratchpad `m16/verify.mjs`), by touch at 905 × 370, 821 × 283 and 960 × 825: 29 of 29 at each size.
  - **New game:** saves v7 with a board of 3 and a stock of 4. The goal asks for engines, with the shop's price.
  - **The shop:**
    - Dutch's yard at 0 credits: Buy is off and says why;
    - on hand, what the ship needs first;
    - every button is 48 px or more;
    - a corridor sells in two taps, the first selling nothing;
    - selling the quarters warns first, and Hangar instead sells nothing.
  - **With credits:**
    - the hangar points to the shop;
    - the engine comes first and opens picked;
    - two taps buy it: credits down 200, the engine on hand and gone from the stock, still picked, with what to do next;
    - a cargo hold sells for 30.
  - **Fitting it:** Build, the engine fitted by touch at the stern, and the checklist reads "Thrust 12 for mass 24: 0.50, needs 1.00 to lift off".
  - **A job** played by touch to the end: a new stock after it.
  - **Quit and reopen at the shop:** as it was.
  - **An M15 save (v6)** opens as v7 with a stock.
  - **Offline**, the shop opens.
  - **No console errors or warnings.**
- **Regressions:**
  - **M15's check:** 30 of 30 at each size.
  - **M14's check:** 40 of 40 at 905 × 370.
  - **M14's saves check:** v4 saves migrated through to v7, 10 of 10.
  - **M13's check:** 24 of 24, after one fix. It caught the hangar's hint for spare parts no longer saying where the missing parts come from. It now reads "The parts still missing come from jobs and the shop, where spares sell too."
  - **M8's fight sandbox checks:** the fight, the orders column at all three sizes, and the extras all pass, with no console errors.

### Known issues

- **The time is an estimate, and the test crew is not a person.** Every run in fifty reaches launch. The unluckiest fifth (losing streaks) pass an hour at the slow pace.
- **The picket line is nearly unwinnable for the test crew: 2 of 66** (M14 content: two hired heavies and two company guards, all armoured, on open ground). The other clear-outs run 41 to 56%. It pays well, so a player who picks by pay walks into it. Fix candidates for Evan: swap a heavy for a guard, or make it three enemies.
- **The shop is the only way to buy parts,** and it has 4 at a time. A run waits on the stock now and then: in 352 jobs, 17 visits found the credits for a part the ship needed, but none in stock.
- **Fitting is by hand only.** The test run's fitter (`fitPart` in `tools/run.js`) isn't in the game.
- **On the 283 px browser tab the hangar's bar is full:** Title, the hint (two lines), Pay, Shop, Jobs and Build. It fits, but a longer hint would wrap a third line.
- **The start fix changes its count:** "Add 2 × Engine" until the quarters and life support go in, then "Add 3 × Engine", as each part adds mass. It's correct, but it may read as the goal moving.

### What to test on the phone (Galaxy Z Fold 6)

1. **A whole act** (the Done when): New game, and play until every flight check passes. Time it, and count the jobs.
   - Does it come in under an hour?
   - Does it feel too short or too long? About 7 jobs is the target; the engine's price moves it.
2. **The shop:**
   - Shop at the hangar; the parts the ship needs come first, tagged.
   - Buy an engine with two taps, then fit it with Build. The checklist should ask for lift-off thrust.
   - Sell a part you don't need. Try selling the quarters: it should warn first.
3. **After a job,** Dutch should have new stock.
4. **Tell me:**
   - whether three engines to lift off makes sense on screen;
   - whether the prices and the act's length feel right;
   - whether the picket line is as hard for you;
   - and the M14 and M15 questions still open.

### Next session

**M17 Launch.** Done when: "launching saves and moves on cleanly."

First task: launch as a campaign action in the sim: allowed only when the checklist passes, it ends act 1 and moves the campaign to act 2's stub, with a save version bump if the schema changes. Tested before any screen.

## M15 Heat v1 and the hangar raid (2026-10-12)

**Status:** done, and the ROADMAP.md box is ticked. After M14, Evan said "Start the next milestone now". He didn't say whether M14's phone tests ran.

Done when: "ignoring heat brings a raid, and managing it avoids one."
- **Twenty campaigns played both ways** (`tools/jobs.js`; `tests/heat.test.js` runs seeds 1 to 10 every time). The crew is played by the job player and the enemy by the AI.
  - **Ignoring heat** (the board's first job every time, no payments): a raid comes after job 6 to 9 on every seed, and 1 or 2 raids in ten jobs. On 4 seeds another is at the door after the tenth.
  - **Managing it** (the quietest job, and a payment whenever the next job would bring heat to the hunters): no raid in 12 jobs on any seed, heat never above 49, and 4 or 5 payments.
- **In the browser**, by touch, at all three sizes:
  - a payment keeps a job from bringing a raid (heat 64, paid down to 49, then 57 after the job);
  - a job at heat 70 brings one (85: Defend takes the place of Jobs);
  - the raid is fought on the hangar map to the end.
- **Whether managing heat is a choice or a chore** is for the phone.

### Shipped

- **Heat** (`src/sim/heat.js`; the numbers in `data/balance.json`):
  - A job adds 8 heat, done or lost, and a loud one 15. Loud is data: clear-outs (`loud` on the mission) and the fire twist (`loud` on the twist).
  - Four levels, each with the pursuer's words for it in `data/backgrounds.json`: calm, rumors from 25, hunters from 50, raid from 75.
  - From 50, a Recovery agent goes along on every job (the pursuer's `hunters`). The job board counts it.
  - From 75, a raid is due at the hangar. No job can be taken until it has been faced, or heat paid back under 75.
  - **A payment on the debt** (the pursuer's `payment`): 50 credits for 15 heat off, at the hangar. The flags count payments.
- **The hangar map** (`src/sim/hangarMap.js`) is the ship's own map from `mapFromShip.js` standing on the hangar's deck, with 2 cells of deck around it. In the hangar an airlock's hatch is just a door. The hangar's doors are along the west edge, behind the ship's stern, where the raiders come in.
- **The raid** (`src/sim/raid.js`): the whole crew on the bridge, against the pursuer's raiders at the hangar's doors (`raid` in `data/encounters.json`: two Recovery agents, a hired heavy and a company guard).
  - Afterwards heat falls to 40, won or lost.
  - Lost, the raiders take the dearest part on hand, or with none, half the credits. Never a part off the ship.
- **Raiders press on** (`src/sim/press.js`). With an enemy in sight, a raider plays as the AI does. Otherwise it walks toward the crew and opens the doors in its way, so a raid can't stall at a door. Only a battle with `options.press` uses it, so boarding fights are unchanged. The job test player (`src/sim/jobAi.js`) is now built on it.
- **`SAVE_VERSION` 6:** a fight says whether it is the raid (`raid`). The migration from 5 marks a fight in progress as no raid: it was a job or a fight at home.
- **Screens:**
  - **The hangar:**
    - a heat meter by the act, with the level and marks at 25, 50 and 75;
    - Pay 50: a tap shows the price and what it buys, a second pays;
    - from rumors on, the pursuer's words in the hint.

    With a raid due, Defend takes the place of Jobs, and the hint says so. The holdings lost their Heat row, since the meter shows it.
  - **The job board:** each job's heat ("+15 heat, loud") on its card and in its facts. From 50, Against counts the Recovery agent. While a raid is due, Take the job is off.
  - **A job's end panel** adds the heat.
  - **The raid:**
    - "Raid · 4 raiders left" under the round;
    - the hangar's deck around the ship, with a hazard stripe along its doors;
    - the end panel says what the raid cost and where heat falls to.
  - **The title's Continue:** "The raid, round 2".
  - **The tile card** names a tile outside the rooms by what it is: hangar deck, rock, floor. On M14's sites it said "Space".
- **Tools:**
  - `tools/jobs.js` prints each job's heat, the payments and the raids, and `--manage` plays the managing way.
  - The validator checks:
    - the heat numbers: thresholds rising, and heat after a raid under the raid's;
    - the pursuer's levels, hunters, raiders and payment;
    - `loud` flags.
- **Tests:** 433 in all, up from 414:
  - heat (`tests/heat.test.js`), with the Done when over seeds 1 to 10;
  - the raid (`tests/raid.test.js`): the hangar map, pressing on, the raid's start and end, quitting mid-raid, the v5 to v6 migration, and the words;
  - the validator's new mistakes.
- **Golden files:** none changed.

### Decisions made this session

Evan didn't weigh in on any of these:
- **A payment is act 1's way to shed heat:** 50 credits for 15, any time at the hangar. §4.4's other losses (long jumps, transponders, bribes) belong to act 2. Credits now have a use before the shop, and M16 has to price parts against it.
- **Loud jobs** are the clear-outs and the fire twist.
- **The thresholds are §4.4's:**
  - rumors at 25 change only the words in act 1;
  - hunters at 50 put a Recovery agent on every job;
  - 75 brings the raid.

  100's forced confrontation isn't in act 1: the raid comes first.
- **The raid waits for the player.** At 75 it's due and blocks jobs, and the player picks when to Defend, or pays heat back down. It never starts on its own.
- **Four raiders.** In early runs, three were easy on the start ship and five too many on the example ship. The odds below are for four, as built.
- **A lost raid costs what the raiders can carry:** the dearest part on hand, or half the credits. Never a part off the ship, so a raid can't undo the build.
- **Heat falls to 40 after any raid,** won or lost. Ignored, the next raid comes about 5 jobs later.
- **Raiders press on; boarders don't.** Pressing is for raids only. The boarding AI is untouched: `tools/sim.js` gives M11's numbers exactly.
- **Where everyone starts:** the crew on the bridge, the raiders at the hangar's west doors. The player doesn't choose where the crew stands.

### Verified here

- `node --test`: 433 pass. `node tools/validate-data.js`: OK.
- **`node tools/sim.js`:** `balance.json` gained six heat numbers, and no number a fight uses changed. The summary is M11's, unchanged:

  ```
  Ship             Fights    Crew wins  Boarders win  No winner    Rounds  Crew orders
  Example ship        250  64% (58–70)           36%         0%   7 (5–9)           29
  Pirate cutter       250  44% (38–51)           32%        24%  7 (5–11)           28
  Patrol corvette     250  41% (35–47)           50%         9%  8 (5–13)           28
  Derelict hauler     250  48% (41–54)           47%         5%  7 (4–11)           27
  All               1,000  49% (46–52)           41%        10%  7 (5–11)           28
  Shots: 23,504, 23.5 a fight. Hit: crew 57%, boarders 40%.
  ```
- **M15's check** (scratchpad `m15/verify.mjs`), by touch at 905 × 370, 821 × 283 and 960 × 825: 30 of 30 at each size.
  - **Heat at the hangar:** the meter and the pursuer's line; every button 48 px or more.
  - **Pay:**
    - a first tap shows the price and pays nothing;
    - the second pays: heat 64 to 49, credits 200 to 150;
    - with 30 credits, Pay is off.
  - **Under 50:**
    - each job's heat is on the board;
    - no agent tags along;
    - the end panel says the heat;
    - heat is 57 after the job, with no raid: Jobs, not Defend.
  - **At 70:**
    - the job card counts the agent, and the agent is in the fight;
    - heat is 85 after it, Defend takes the place of Jobs, the hint says why, and the meter reads "Heat 85 · Raid".
  - **The raid:**
    - Defend starts it on the hangar map, with the raiders pressing on;
    - the line under the round counts them;
    - quit mid-raid: Continue says "The raid, round 2", and reopening finds the raid as it was;
    - the raid is held in round 7, and the end panel says so;
    - home, heat is 40, and Jobs is back.
  - **Offline**, the game reopens at the hangar, heat and all.
  - **No console errors or warnings.**
- **Raid odds** (scratchpad `m15/raidodds.mjs`): the crew played by the AI, at full health, against the four raiders pressing on, 60 seeds a ship:

  | Ship | Crew wins | Rounds (median, range) |
  | --- | --- | --- |
  | Start ship with quarters and life support fitted | 22 of 60 | 6 (3–16) |
  | The same with an engine | 39 of 60 | 7 (4–33) |
  | Example ship | 11 of 60 (1 reached 60 rounds) | 7 (3–22) |

  A crew that rushes the raiders instead won 4 to 7 of 60 on each.
- **Regressions:**
  - **M14's check:** 38 of 39, 39 of 40 and 40 of 41 at the three sizes. Each time the one miss was its first check, which asked for a v5 save. With that check taking v5 or later, it passes 40 of 40 at 905 × 370. The count varies with how the played jobs go.
  - **M14's saves check:** 10 of 10 at 905 × 370. These are v4 saves as M13 wrote them, now migrated through v5 to v6.
  - **M13's check:** 24 of 24 at 905 × 370.
  - **M8's fight sandbox checks:** the fight, the orders column at all three sizes, and the extras all pass, with no console errors.
  - **M15's check after the last change** (the holdings' Heat row gone): 30 of 30 at 905 × 370.

### Known issues

- **Raid odds swing with the layout:** 11 to 39 of 60 for the AI crew (above). On a ship laid out like the example ship, the AI crew loses most raids. A person holding the bridge on overwatch should do better than the AI. Check it on the phone. The candidates are in ROADMAP §8.
- **The hangar is a plate on the starfield,** with a hazard stripe where its doors would be. No walls or doors are drawn (parked).
- **Heat never falls on its own in act 1.** Only payments and raids lower it.
- **The price of a payment** (50 credits for 15) is a starting value. M16 has to set it against the shop's prices.
- **Boarders still don't attack a crew that holds the bridge** (M12). The fight at home against boarders has had no button since M14, and the raid replaces it.
- **On the 283 px browser tab, the hangar's holdings scroll,** as they have since M13. Jobs is below the fold there.
- **Labels overlap** for units side by side, as before.

### What to test on the phone (Galaxy Z Fold 6)

1. **Ignore heat** (the Done when): New game, then take jobs without paying.
   - The meter should climb 8 a job, or 15 for a clear-out or a fire.
   - From 50, a Recovery agent should show up on the job cards.
   - From 75, Defend should take the place of Jobs.
2. **Defend:**
   - fight the raid on the hangar map;
   - quit mid-raid and reopen;
   - after it, heat should be 40, and if you lost, the end panel says what they took.
3. **Manage heat:** in another game, pay whenever the meter nears 50. No raid should come, and no agent should tag along.
4. **Pay:** the first tap shows the price, the second pays. With under 50 credits, it's off.
5. **Tell me:**
   - whether managing heat feels like a choice or a chore;
   - whether a raid is too hard or too easy on your ship, and whether four raiders is right;
   - whether 50 credits for 15 heat is the right price;
   - and M14's questions: varied jobs, the tone, clear-outs, the pay.

### Next session

**M16 Shop and economy v1.** Done when: "a test run reaches launch in under an hour."

First task: the shop's stock and prices as data, and buying a part in the sim (credits for a part on hand), tested before any screen. Payments now spend credits too, so price parts with them in mind.

## M14 Background, district and jobs (2026-10-12)

**Status:** done, and the ROADMAP.md box is ticked. Before it, Evan made two calls: the tone is wry and blue-collar, and in act 1 the crew heals fully at the hangar. He didn't say whether M13's phone tests ran.

Done when: "ten jobs in a row feel varied (Evan's call)."
- **That's a call for the phone.** What the tools can show is below.
- **`node tools/jobs.js`** prints ten jobs in a row from a new campaign. Each time it takes the board's first job and plays it out, the crew by a test player that goes for the objective (`src/sim/jobAi.js`) and the enemy by the AI.
- **Sixty jobs** (seeds 1 to 6, ten each):
  - Every run of ten had all three missions, 3 or 4 of the 4 sites, 3 to 5 of the 6 clients, and 5 to 8 of the 10 job templates. About half came with a twist (28 of 60).
  - Fights ran 2 to 13 rounds, median 5.
  - The test crew won 37 and lost 23:
    - clear-outs 8 of 23;
    - grabs 16 of 21;
    - hacks 13 of 16, with one lost to a deadline.
  - Every run of ten paid at least one engine.

### Shipped

- **The background** (`data/backgrounds.json`): the debt-bound miner. It holds the blurb, the pursuer (Con-Reg Recovery), the district (the Tailings) and act 1's start, which moved here from `campaign.json`.
- **The district** (`data/districts.json`): the Tailings, with six clients and four job sites:
  - clients: Marta Okafor (the union steward), Dutch Abernathy (scrap dealer), Foreman Sully, Ma Prewitt (your landlady), Rook (a bookie), Sister Agnes;
  - sites: Pit Nine, the Cable Street yard, Depot 4, the Last Whistle.
- **Ten job templates** (`data/contracts.json`), in three missions:
  - **clear:** put down everyone who isn't crew;
  - **grab:** grab 1 to 3 tagged crates;
  - **hack:** work the terminal for 2 turns.

  Each template has its clients, sites, encounter, pay range and parts, and a pitch with the client and site filled in.
- **Six twists:**
  - Overtime: an enemy more;
  - Hazard pay: fire on site, +50%;
  - Cave-in: rubble;
  - Lights out: sight 6 tiles;
  - Rush job: done by the end of round 6, +30%, grab and hack only;
  - Skeleton crew: an enemy fewer, −20%.
- **New enemies** (`data/enemies.json`, `data/encounters.json`): scavver, claim jumper, company guard, hired heavy and recovery agent, in six new encounters.
- **Planet map generator v1** (`src/sim/gen/site.js`), with four templates in `data/sites.json`: a scrapyard, a warehouse, an open-cut bench and the bar.
  - A map is its template turned by the seed. Its props are rolled, and a hazard twist lays its patches.
  - Rock is a new tile: full cover, blocks sight.
  - The battle map text format moved to `src/sim/mapText.js`, shared by `tools/battle-map.js` and the templates.
- **Mission rules** (`src/sim/battle.js`): a battle can have an objective (grab or hack), a deadline and its own sight range.
  - Grab is one action from beside a crate. Hack ends the unit's turn and counts once a round. Neither reaches through a wall or a closed door.
  - The crew wins once the objective is done. It loses at the end of its turn in the deadline's round.
  - The Fight screen has Grab and Hack buttons.
- **The job board** (`src/sim/contracts.js`): three jobs, each rolled with its client, site, twist, pay, part and the fight's seed when the board is. After a job, done or lost, a new board with none of the old board's jobs.
- **Rewards and healing:**
  - A job done pays its credits (in steps of 5) and its part, if any.
  - The flags count jobs done and lost.
  - In act 1 everyone heals fully once home (`heals` on each act in `campaign.json`).
- **`SAVE_VERSION` 5:**
  - Adds the campaign's background and board, the fight's job, and the battle's objective.
  - The migration from 4 makes every old campaign the miner's (the only start there was), with an empty board. The hangar rolls one.
- **Screens:**
  - **The hangar** has Jobs where Repel boarders was, and its holdings count jobs.
  - **The job board** (`src/ui/campaign/jobs.js`) lists the jobs on the left and the one picked on the right: who, where, the pitch, the job, the twist, who will be there and the pay. Take the job sends the crew.
  - **In a job's fight:**
    - the objective under the round;
    - the crates and terminal tagged on the board;
    - the site in a ground skin, with rock in lumps;
    - the pay, or why there is none, on the end panel.
  - **The title's Continue** names the job and the round.
- **The orders column:**
  - Orders that come and go now stack above Shoot, Overwatch and Reload, so on a short screen Reload scrolls away, not Grab or Hack.
  - The column leaves room for the DEV button only in dev mode.
- **Tools:**
  - `tools/jobs.js`: ten jobs in a row (`--seed`, `--count`), every site map (`--maps`), and the golden file (`--golden`).
  - The data validator checks every new file. The campaign checks moved to `tools/validate-campaign.js`, with shared helpers in `tools/checks.js`.
- **Tests:** 414 in all, up from 386:
  - site maps (`tests/site.test.js`);
  - objectives (`tests/objectives.test.js`);
  - the board, jobs, pay and the test player (`tests/contracts.test.js`);
  - the v4 to v5 migration, and the validator's new mistakes.

  The quit-anywhere test now also quits through a whole job.
- **Golden files:** `tests/golden/sites.txt` is new, on purpose: every site map at seeds 1 to 3, bare, on fire and caved in. No other golden file changed.

### Decisions made this session

- **"Contracts" in code, "jobs" on screen.** `data/jobs.json` already holds the crew's jobs.
- **The board refreshes only when a job ends,** done or lost, since no time passes in act 1 yet. Each new board leaves out the old one's jobs, so no job comes twice in a row. A job can come back after one board.
- **A job's fight takes the whole crew.** Every site has room for five.
- **Grab has no carrying out,** and the AI doesn't guard objectives. Both are parked in ROADMAP §9.
- **A lost job pays nothing,** and the crew still heals. The economy is M16's to tune.
- **Engines:** the repossession job always pays one, and the scrap run can (one of its five parts, at 80%). Nothing else sells engines until the shop.
- **Numbers in the words come from the data:** "Grab 3 tagged crates", "Nobody sees past 6 tiles". The text can't disagree with the rules.
- **The fight at home against boarders stays in the sim** for M15's raid, with no button.
- **Spreading the jobs:** the first runs put 6 of 10 jobs at Depot 4 against the same guards. I moved jobs across the sites, added the Con-Reg Recovery crew, and moved crates past each map's middle so grabs aren't over in two rounds.
- **Test player:** `tools/jobs.js` and the tests play the crew with a player that pushes in. AI against AI stalled at closed doors, as M11's harness found on ships.

### Verified here

- `node --test`: 414 pass. `node tools/validate-data.js`: OK.
- **M14's check** (scratchpad `m14/verify.mjs`), by touch at 905 × 370, 821 × 283 and 960 × 825: 40, 39 and 39 checks, all passing. The extra one at 905 × 370 checks a part paid. It covers:
  - New game saves v5 with a board of three, and the hangar's buttons are 48 px or more.
  - The board shows three jobs and the first picked. A tap picks another and saves nothing. Hangar goes back.
  - A job of each kind is played to the end by touch, with Grab and Hack showing when in reach.
  - Quit mid-job and reopen: Continue names the job and round, and the fight and its objective are as they were.
  - The end panel says the pay. At the hangar, the credits and part have arrived, the crew is healed, and the board is new.
  - Offline, and no console errors.
- **On the shortest screen** (821 × 283), all three jobs fit on the board. Before the orders column changed, Hack was scrolled out of reach there.
- **M13 saves** (v4) in the browser (`m14/saves.mjs`): 10 of 10 at each size. One at the hangar gets a board. One in a fight against boarders plays to the end and goes home to a board.
- **Regressions:**
  - M13's check: 24 of 24 at each size, with the first part placed about 10 s after New game. It now takes a job where it fought boarders.
  - M8's fight sandbox checks pass: the fight at three sizes, the orders column, and the extras.

### Known issues

- **The AI ignores the objective.** It fights as it does on a boarding. A grab with a crate near the way in can be over in two rounds.
- **Clear-outs look hard:** the test crew won 8 of 23. A person should do better, but check it on the phone.
- **Standoffs:** the AI never opens a door the other side is waiting behind. On a job the crew has to push. Carried over from M11 and M12: boarders don't attack a crew that holds the bridge.
- **A site floats on the starfield,** with no ground around it (parked).
- **Labels overlap** for units side by side ("OVERWATCH" twice), as before.
- **Credits buy nothing yet** (M16), and every hack takes 2 turns.

### What to test on the phone (Galaxy Z Fold 6)

1. **Ten jobs in a row** (the Done when). New game, then take jobs one after another. After ten: did they feel varied? Note any that felt the same as another.
2. **The board.** Pick each job and read it; check the words suit the tone. Take one.
3. **A grab job:**
   - the crates should be tagged on the board;
   - Grab should show only beside a crate (not through a fence);
   - the objective line should count up.
4. **A hack job:** Hack should show beside the terminal, and only once a round.
5. **A rush job:** wait it out on purpose; it should end at the end of round 6, unpaid.
6. **Lights out:** no shots past 6 tiles.
7. **Quit mid-job** and reopen: Continue should name the job, and the fight should be as you left it.
8. **Back at the hangar:**
   - the pay should arrive and the crew be healed;
   - fit an engine from a repossession with Build: the thrust check should pass.
9. **Tell me:**
   - varied or not;
   - whether the writing hits the tone;
   - whether clear-outs are too hard;
   - whether the pay feels right.

### Next session

**M15 Heat v1 and the hangar raid.** Done when: "ignoring heat brings a raid, and managing it avoids one."

First task: heat from jobs (ROADMAP §4.4: +8 a job, +15 a loud one) and its thresholds in the campaign, tested before any screen.

## M13 Hangar hub (2026-10-12)

**Status:** done, and the ROADMAP.md box is ticked. After M12, Evan said "Good, move to the next milestone". He didn't say whether the phone tests ran, and he didn't pick the starting hull and parts, so I did; see the decisions below.

Done when: "a new player is building within 60 seconds of starting."
- **Scripted (headless Chromium, by touch):** a player who pauses 1.5 s before every tap has the first part on the ship 9.7 s after tapping New game, in 5 taps: New game, Build, the part, where it goes, and again. Each screen's line says what to do next.
- **The real test is a person.** The script knows where the gap is. A new player has to find it and learn that a part takes two taps. Evan's call, on the phone, ideally with someone who hasn't seen the game.

### Shipped

- **The hangar** replaces M12's placeholder hub:
  - the ship in the middle, seen from outside;
  - on the left, the act's goal: the flight checklist, each failing line with its fix and whether the part is on hand;
  - on the right, the crew with their hit points, and the hangar's holdings: credits, heat, parts on hand and fights;
  - along the bottom, Title, a line saying what to do next, Repel boarders, and Build.
- **Construction mode** is the builder on the campaign's ship, with only the parts the campaign has:
  - The palette shows the parts on hand, each with how many. A part with none left goes, and comes back when one is taken off.
  - A part goes on only while one is on hand. Deleting puts it back, and undo and redo keep the count (`src/sim/session.js` stock).
  - A fix whose part isn't on hand reads "none on hand" instead of picking it. The chip on the board names the first fix the parts on hand can make.
  - Hangar, where the Saves tab would be, goes back. There is no Launch: that is M17.
  - Every change is saved through the campaign at once (`campaign/ship`). The campaign checks the parts add up: what is on the ship plus what is on hand never changes in a refit (`refitShip`).
- **The half-built start** (`data/campaign.json`):
  - The hull has a bridge, reactor, three corridors, an airlock and a gun, with no quarters, life support or engines.
  - On hand are crew quarters, life support and two corridors.
  - The checklist opens with four lines to fix; the parts on hand fix two, where the hull has gaps for them. The engines have to come from jobs.
- **The builder is split** (`src/ui/builder/view.js`), as the Fight screen was in M12. The sandbox keeps its slots, Saves tab, codes and replay; construction mode keeps none of them.
- **Tests:** 386 in all, up from 383. They cover parts on hand in the session, refits at the hub (only parts the campaign has, only at the hub, same frame), and the hangar's text. The quit-anywhere test now also quits in construction mode after a refit.

### Decisions made this session

- **The starting hull and parts are my call.** Evan didn't pick, and they are data, so changing them is an edit to `campaign.json`. I chose a start whose first minute fixes real flight checks, without finishing act 1: launching needs engines, which come from jobs (M14) or the shop (M16).
- **The hangar and construction mode are two screens.** Build is one tap from the hangar, which has room for M14's job board, M16's shop and M17's launch.
- **Construction mode isn't a place in the save.** Reopening goes to the hangar, with every change already saved. One tap on Build goes back.
- **No save version bump.** The campaign keeps no build log for its ship, so construction mode has no timelapse (parked in ROADMAP §9).
- **Old campaigns keep their start.** A campaign begun in M12 has the old hull and nothing on hand, so construction mode can only rearrange it. New game gives the new start. Saves are never reset.

### Verified here

- `node --test`: 386 pass. `node tools/validate-data.js`: OK.
- **M13's check** (scratchpad `m13/verify.mjs`), by touch at 905 × 370, 821 × 283 and 960 × 825: 24 of 24 at each size.
  - A new player's path to the first part (above).
  - Construction mode shows only the parts on hand, with no Saves tab and no Launch.
  - A part used up leaves the palette. Delete puts it back, and Undo fits it again, with the save following each step.
  - The Ship tab's fixes without the part read as words, not buttons.
  - Back in the hangar, the goal shows berths and life support passing, and the line points to jobs.
  - Quit in construction mode and reopen: Continue opens the hangar with the refit kept, and Build opens on it.
  - Repel boarders fights on the refitted ship (its map has the new rooms).
  - Offline, and no console errors.
- **M12's checks, on the hangar:**
  - quit and reopen everywhere, 29 of 29;
  - regressions, 12 of 12.
- **The Builder sandbox, on the split builder:**
  - M5c's tap-to-move check: every check passes.
  - M5b's Saves-tab check (slots, codes between two devices, replay, delete, reload, M3 and M5 saves coming forward, now to version 4): every check passes.
  - No console errors.

### Known issues

- **Act 1 can't be finished yet.** No engine can be got until jobs (M14) or the shop (M16).
- **Carried over from M12:** nothing heals, and boarders don't attack a crew that holds the bridge.
- **The hangar's view of the ship is still,** with no pan, zoom or turn, and the backdrop is space, not a hangar.
- **Construction mode keeps its undo history** while you go to the hangar and back, but not over a reload, as in the sandbox.
- **Carried over:** M11's items (stalls on generated ships, the AI's weights in code) and M10's.

### What to test on the phone (Galaxy Z Fold 6)

1. **The 60 seconds.** Ideally hand the phone to someone who hasn't seen the game. Tap New game, and time from there to the first part on the ship. Watch where they hesitate.
2. **Parts on hand:**
   - Fit the crew quarters and life support. Each one's tile should go once used.
   - Delete one: its tile should come back.
   - Undo, and check the hangar's goal follows.
3. **The fight.** Tap Repel boarders: the fight should be on the ship as you built it.
4. **Quit mid-build.** Swipe the app away during construction and reopen. Continue should open the hangar with your changes, and Build should continue from there.
5. **The Builder sandbox** (dev menu) should work as before, Saves tab and replay included.
6. **Tell me:**
   - whether the 60 seconds passed;
   - whether the start suits you: hull, parts on hand, and which checks they fix;
   - your call on the tone, before M14 (see next session).

### Next session

**M14 Background, district and jobs.** Done when: "ten jobs in a row feel varied (Evan's call)."

ROADMAP says to pick the tone before M14: grim survival, hopeful frontier, or wry and blue-collar. That, and whether act 1 heals between fights, are Evan's calls to settle first.

First task: the job template data (who, where and a twist) and the job board, seeded from the campaign's RNG and tested before any screen.

## M12 Campaign state (2026-10-12)

**Status:** done, and the ROADMAP.md box is ticked. This is Phase 3's first milestone, after Gate 2.

Done when: "quitting anywhere and reopening resumes correctly."
- **Headless:** `tests/campaign.test.js` quits and reopens after every change a player can make, from New game through two whole fights (one won, one lost) and back to the hub. The reopened game equals the one quit, and the rest of the fight plays out the same, roll for roll.
- **In Chromium**, at the Fold's three sizes, 29 checks each: quit at the hub, as a fight begins, mid-turn after a move (the board the same pixel for pixel), during the enemy's turn, at the end panel and back at the hub, and once offline.

### Shipped

- **The campaign** (`src/sim/campaign.js`, pure) holds:
  - the act, and where the player is: the hub, or a fight;
  - credits, parts held, and the crew with their hit points (wounds);
  - heat (0 to 100), flags, and the ship;
  - the fight in progress.

  A new one starts from `data/campaign.json`: the three acts, and the start. The start is no credits, no parts, the three-job crew, and a half-built hull (the example ship without its engines, so the flight checklist names what act 1 is for).
- **Fights in the campaign:**
  - **Who and where:** the whole crew against the boarders, on the campaign's ship.
  - **Seeded by the campaign's RNG,** so a reopened hub begins the same fight.
  - **The wounded start wounded:** `createBattle` takes a unit's hit points.
  - **Afterwards:** everyone keeps the hit points they ended with. The fallen come back with 1, the dead (only where death is permanent) leave, and the flags count fights won and lost.
- **Saves, version 4.**
  - The campaign joins the save, null before one starts, with a migration from version 3.
  - Every field is checked on load, the fight's battle and map included (`src/sim/battleShape.js`). A damaged campaign is named in the error, like a damaged ship.
- **Autosave: every change is saved as it happens.** That covers the hub, a fight's start, every order, and its end (ROADMAP §4.8 now says so).
- **Screens.**
  - **The title** has Continue, saying where the campaign is, and New game. A new game over a campaign takes a second tap.
  - **A placeholder hub** stands in for M13's hangar: the act and home, the crew with their hit points, the ship's failing checklist lines, and credits, heat, parts and fights. Its one order is Repel boarders.
  - **The campaign fight** has Title in its tools, and Continue on its end panel, which goes home.
  - **The board is shared.** The Fight screen's board moved to `src/ui/fight/view.js`, used by both the sandbox and the campaign.
- **Data checks.** `tools/validate-data.js` checks `campaign.json`, with 13 new cases. Among them: the start ship has to build with the builder's rules and break no layout rule.
- **Tests:** 383 in all, up from 366:
  - `tests/campaign.test.js`: 11;
  - `tests/hubText.test.js`: 3;
  - save version 4: 2;
  - a wounded start in `tests/battle.test.js`: 1.

### Decisions made this session

- **Saved after every order, not only at the start of each turn.** §4.8 named the turn start. Saving every order covers that and closes a hole. With turn-start saves alone, a player could shoot, miss, quit and reopen to the same RNG state: the same roll comes back, to spend on a different shot. A save mid-fight is 10 to 15 KB for the campaign, written once an order.
- **A saved fight holds its battle whole, map included** (3 to 8 KB of it), rather than rebuilding the map from the ship. A game update between quitting and reopening can't move a wall under a unit.
- **The game reopens at the title, not inside the campaign.** Continue is one tap away and says where it goes. If a saved fight ever can't be picked up, the player still lands somewhere safe.
- **New campaigns and fights are made by the root reducer.** Their actions carry the content tables (`rules`), and their seeds come from the game's RNG (a new campaign) or the campaign's (a fight). The fight's orders still run in the Fight screen's own store, which saves each result to the game's, as the builder does.
- **The start values are placeholders:** the hull for M13, and credits and parts for M14 and M16. They live in `data/campaign.json`, so changing them is a data edit.
- **Repel boarders stands in** for jobs (M14) and raids (M15). Heat is a number nothing raises yet.
- No balance number changed.

### Verified here

- `node --test`: 383 pass. `node tools/validate-data.js`: OK, now with 3 acts.
- **Quit and reopen in Chromium** with touch, at 905 × 370, 821 × 283 and 960 × 825 (scratchpad `m12/verify.mjs`): 29 of 29 at each size. "Quitting" closes the page and "reopening" opens a new one in the same profile.
  - New game, quit at the hub: Continue says "Act 1 · The hangar", and the hub comes back as it was.
  - The fight is saved as it begins. Quit before an order: the same fight, nothing rerolled.
  - A move mid-turn is saved at once. Quit and reopen: the same save, the same crew bar, and the board pixel for pixel.
  - End turn, then quit while the boarders' turn plays. Continue says round 2, and the save already holds their whole turn.
  - Quit at the end panel: Continue says "A fight just ended", and the panel comes back. Its Continue goes home with the wounds (1, 1, 1 after a loss) and "0 won, 1 lost". Reopened there: the same.
  - The next fight starts with the crew wounded, and the crew bar shows it.
  - Offline: the game reopens and Continue picks the fight up.
  - New game over a campaign: one tap only asks, and it disarms after 3 s. Two taps start a new one from a new seed.
  - No console errors or warnings.
- **Regressions** (`m12/regress.mjs`, 12 of 12):
  - An M5b save (version 3) loads in the browser and is written back as version 4, with its ship and settings.
  - The builder keeps the migrated ship.
  - The dev menu exports and imports a version 4 code.
  - The Fight sandbox saves nothing.
- **The Fight sandbox on the shared board:** M8's whole-fight check (`m8/fight.mjs`, its save setup updated for version 4) plays 18 orders by touch with 0 mismatches against Node. Fight again works, with 0 console errors.

### Known issues

- **Nothing heals.** Wounds carry, and the med bay is M23's, in act 2. After a lost fight the crew is at 1 hit point each, and the next fight is hopeless until New game. Act 1 needs a rule, Evan's call, for M14: rest at the hangar heals fully, say, or a few hit points a job.
- **Boarders don't attack a crew that holds the bridge.** With a crew that only ends its turn, 5 of 5 fights reached 60 rounds, on the example ship and on the start ship. A campaign fight can't be left until one side wins, so the player has to go to them. This is ROADMAP §8's standoff row, and its fix is still Evan's call.
- **Losing costs only wounds.** What a lost fight means for the campaign belongs to M14 and M15.
- **Quitting during the boarders' turn skips its playback.** The reopened board shows where it ended, and the Log card has what happened.
- **Not saved:** the crew member giving orders and the camera. Reopening selects the first who can act and fits the view.
- **The hub is text.** The ship isn't drawn there; that is M13's hangar.
- **Carried over:** M11's items (stalls on generated ships, the AI's weights in code) and M10's (mirrored ships off true, boxy corvettes, doorways onto lockers on player ships).

### What to test on the phone (Galaxy Z Fold 6)

1. **The update itself.** When "Update ready" shows, tap it. The title should offer New game, and the dev menu's Builder should still have your ships: the old save converts to version 4.
2. **New game:** the hub shows Act 1 · Homeworld, the hangar, three crew, and the ship's two missing lines (thrust, engine).
3. **Quit at the hub.** Swipe the app away and reopen. Continue should say "Act 1 · The hangar" and bring the hub back as it was.
4. **Quit mid-turn.** Tap Repel boarders, move one crew member, then swipe the app away. Reopen and tap Continue: the same unit should have moved, with 1 action left.
5. **Quit during the boarders' turn.** End the turn and swipe away while they move. Reopen: it should be round 2, your turn.
6. **Quit at the end.** Finish the fight and swipe away at the end panel. Reopen: the panel again. Its Continue should show the wounds and the fight count at the hub. Swipe away once more: the same.
7. **Unfolded:** the hub and the fight at the big size.
8. **Tell me:** anything that didn't come back as you left it, and whether act 1 should heal between fights (and how).

### Next session

**M13 Hangar hub.** Done when: "a new player is building within 60 seconds of starting."

First task: construction mode on the campaign's ship, with owned parts only (`campaign.parts`), saved through the campaign. The builder's sessions keep a build log, so the ship will likely need one too: a `SAVE_VERSION` 5 with its migration.

Then the hangar screen around the ship, in place of the hub's text panels, with the flight checklist as the act goal and a crew panel.

Decide with Evan first:
- the half-built hull and the parts it starts with (now: the example ship without engines, and no parts);
- whether act 1 heals between fights, which M14 needs.

## Gate 2 (2026-10-12)

**Passed.** Evan's words: "Gate 2 passed, start the next milestone".
- He didn't report the fight times or how the moved part changed the fight. The gate is his call, so it stands as passed.
- M10's Enemy ships sandbox hasn't been reported on from the phone.
- Phase 3 starts with M12 (campaign state).

## M11 Balance harness (2026-10-12)

**Status:** done, and the ROADMAP.md box is ticked. Evan asked for the next milestone; M10 hasn't been reported on from the phone yet. This ends Phase 2: Gate 2 is next, and it's Evan's call.

Done when: "1,000 fights report in under a minute." `node tools/sim.js` plays 1,000 AI-against-AI fights and reports in 22.9 s here, 23 ms a fight. Generated ships are made fresh for each fight inside that time.

### Shipped

- **`tools/sim.js`** (`npm run sim`) plays fights headless with `autoplay`: the squad against the boarding party, the AI playing both sides. It reports:
  - win rates, ship by ship and in all, with a 95% interval;
  - stalls: fights still going at the round limit;
  - rounds and crew orders in the fights that end: the median, and the 10th to 90th percentile;
  - shots: hit rates by side, overwatch, crits and damage;
  - shots grouped by the odds shown, against how often they hit (a check on Law 4).
- **It's seeded:** the same options always give the same report. Each fight's seed (and, on a preset, its ship) comes from the run's seed, the ship and the fight's number, so adding a ship to a run doesn't change the other ships' fights.
- **Options:**
  - `--fights` sets the count.
  - `--ships` takes the example, a preset, a ship script (`.json`, as `tools/build-ship.js` takes) or a blueprint code copied from the builder's Saves tab.
  - `--set name=value` changes a `balance.json` number for one run, checked by the data validator.
  - `--compare` plays the same fights before and after a `--set`.
  - `--crew` and `--boarders` choose `ai` or `scripted`.
  - `--rounds`, `--seed` and `--json` round it out.
- **Tests:** 366 in all, up from 355. The harness has 11, covering:
  - the options and their errors;
  - changed numbers checked and the file left alone;
  - every kind of ship;
  - the same report every time, and each ship keeping its fights;
  - totals adding up;
  - stalls at the limit;
  - the Wilson interval;
  - the report and the compare form;
  - the command line;
  - shots landing as often as shown, within 6 points in every band with 200 or more shots.

### The first run

`node tools/sim.js`, with the balance numbers as they are:

```
1,000 fights on example ship, pirate cutter, patrol corvette, derelict hauler. The squad (marine, engineer, medic), played by the AI, against the boarding party (pirate, pirate, brute, pirate), played by the AI. 30 rounds at most, seed "balance".

Ship             Fights    Crew wins  Boarders win  No winner    Rounds  Crew orders
Example ship        250  64% (58–70)           36%         0%   7 (5–9)           29
Pirate cutter       250  44% (38–51)           32%        24%  7 (5–11)           28
Patrol corvette     250  41% (35–47)           50%         9%  8 (5–13)           28
Derelict hauler     250  48% (41–54)           47%         5%  7 (4–11)           27
All               1,000  49% (46–52)           41%        10%  7 (5–11)           28

Rounds and crew orders count the fights with a winner: the median (10th to 90th percentile). Win rates have a 95% interval.

Shots: 23,504, 23.5 a fight. Hit: crew 57%, boarders 40%.
Shown odds  Shots  Shown  Hit
0–19%       2,150     9%   9%
20–39%      6,355    26%  27%
40–59%      4,690    45%  45%
60–79%      7,725    67%  68%
80–100%     2,584    83%  83%
On overwatch: 8% of shots, 26% hit. Crits: 33% of hits. Damage a hit: crew 4.5, boarders 4.5.
A fight: 1.8 crew go down, 0.9 bleed out, 2.8 boarders die.

1,000 fights in 22.9 s (23 ms a fight).
```

What it says:
- **The odds are honest.** Every band hits within a point of the chance shown.
- **The example ship favours the defenders,** 64% (58–70). M9's 70 of 100 is inside that interval.
- **Generated ships stall:** a quarter of cutters, as M10 found.
- **A decided fight is about 7 rounds and 28 crew orders.**
- **Crits are a third of hits,** with flanking's +30 to crit.
- **Overwatch is weak:** 8% of shots, 26% hit.

Two comparisons, to show what the harness is for:
- **Moving one module changes the fight** (Gate 2's first half). With the example ship's airlock moved from mid-ship to just under the bridge, the crew wins 83% (79–87) against 63% (58–68), over 400 fights each. Boarders who come in beside the defended bridge lose more often.
- **Cover counts for a lot.** `--set halfCover=30 --set fullCover=50 --compare` on the example ship takes the crew from 64% to 79% over 200 fights.

No balance number changed this session.

### Decisions made this session

- **The harness lives in `tools/`,** as CLAUDE.md lays out, and drives the pure `src/sim/` code. It changes nothing in the game.
- **"No winner" is its own column,** not folded into either side. Rounds and crew orders count only fights that end, so stalls don't drag the medians to the limit.
- **The AI's weights are still constants in `src/sim/ai.js`,** so `--set` can't reach them yet. Moving them into data is a small change, and is Evan's call (open since M9).

### Known issues

- **No real time.** Gate 2 asks for 5 to 8 minutes a fight. The harness counts rounds and crew orders, not minutes.

  An estimate, not a measurement: at 8 to 12 s an order with tap to preview and tap to confirm, 28 orders is 4 to 6 minutes. Watching the enemy's 7 turns adds about a minute, less with Skip.
- **AI against AI isn't a player.** The AI crew takes cover and waits; a player who presses on would see shorter fights and fewer stalls.
- **The stalls on generated ships are still there** (ROADMAP §8). The harness measures them; nothing fixes them yet.
- **Carried over:** the M10 items (mirrored ships off true, boxy corvettes, doorways onto lockers on player ships) and the M9 ones.

### What to test on the phone (Galaxy Z Fold 6): Gate 2

Gate 2: "moving modules changes how the fight plays, and a fight takes 5 to 8 minutes." It's Evan's call.

1. **Time a whole fight** on the example ship in the Fight sandbox, from your first order to the end panel.
2. **In the Builder, move one part:** the airlock under the bridge, say, or the weapon mount. Fight again. Does it play differently? The harness says the airlock move takes the AI crew from 63% to 83% wins.
3. **If you get to it,** try M10's Enemy ships sandbox: open one with Builder and fight on it.
4. **Tell me:** how long each fight took, whether the move changed how it played, and whether Gate 2 passes.

### Next session

Phase 3 waits on Gate 2. If it passes, record it here and start **M12 Campaign state**. Its first task: the campaign state shape and `SAVE_VERSION` 4 with the migration from version 3 (ROADMAP §7), tested before any screen. If it doesn't pass, the fight gets fixed first. The likely pieces, Evan's call:
- fight length;
- the standoffs (boarders pressing on);
- moving the AI's weights into data, so the harness can tune them.

## M10 Enemy ship generator (2026-10-12)

**Status:** done, and the ROADMAP.md box is ticked. Evan asked for the next milestone; M9 hasn't been reported on from the phone yet.

Done when: "100 generated ships all pass the flight checklist (tested)."
- `tests/ships.test.js` generates seeds 1 to 100 of each preset, 300 ships in all. Every one has no layout problems and passes the flight checklist for its preset's crew.
- Every one also builds again, part by part, through the builder's `buildShip`. Every step of its build log passes the builder's layout rules, except the airlock rule, which waits for the airlock.

### Shipped

- **`data/ships.json`**: three presets, starting values. A preset lists its parts bow to stern, each a count or `[least, most]`.

  | Preset | Crew | Beam (cells) | Mirrored | Notable parts |
  | --- | --- | --- | --- | --- |
  | Pirate cutter | 4 | 4–5 | no | guns forward |
  | Patrol corvette | 6 | 7 | yes | shields, a med bay, an armory, two airlocks |
  | Derelict hauler | 3 | 7–9 | yes | 3–5 cargo holds; 1–3 rooms come wrecked |

  `tools/validate-data.js` checks presets: 10 new cases.
- **`src/sim/gen/ship.js`** (pure, seeded): `generateShip(defs, preset, seed)` returns `{ ok, ship, preset, crew, wrecked }` or `{ ok: false, error }`.
  - **It plans the parts:** the preset's counts, then each part the flight checklist names as its fix. This uses `partLines` in constraints.js, the checklist lines that only count parts. On a mirrored ship, a part that can't sit in the line along the middle row comes in pairs.
  - **It lays them out** (layout.js), and starts again after a dead end, up to 20 tries.
  - **It centres the ship in its frame.**
  - **It wrecks a derelict's rooms:** fire, vacuum or rubble, never the bridge or an airlock.
- **`src/sim/gen/layout.js`**: grows the ship from the bridge, placing in this order:
  - the bridge at the front, consoles forward;
  - a spine of corridors aft along the middle row;
  - rooms bow to stern;
  - engines at the stern;
  - guns, then airlocks.

  Every part goes in through `placeModule`, and the layout rules have to pass after each one. Each part takes the best of the places that join it to the ship, scored on:
  - staying within the beam and near the middle row;
  - its place bow to stern;
  - sharing more wall and growing the ship less;
  - keeping floor along its free sides, aft above all;
  - a seeded nudge.
- **Rules the generator adds to the builder's:**
  - Nothing stands in an engine's wake or a gun's line of fire.
  - Every airlock keeps a hatch.
  - Every room can be walked to from the bridge.

  The builder puts each doorway in the middle of a shared wall, whatever stands behind it. In this session's first version, doors opened onto lockers and machinery and cut rooms off. On one cutter the boarders had no way to the crew at all and sat on overwatch for 30 rounds.

  The score now keeps floor along a room's free sides, and with the walking checks switched off, none of 300 ships had a room cut off. The checks stay as the guarantee. The builder's own rules are unchanged.
- **`node tools/gen-ship.js`** (`npm run ships`): prints a ship's layout, build order, wrecks and checklist.
  - `--check 100` tries seeds 1 to 100 of every preset.
  - `--golden` writes `tests/golden/ships.txt`, new this session: every preset at seeds 1 to 3.
- **Enemy ships sandbox** (dev menu): preset buttons, seed arrows, Hull, Plans and Map looks, Fit, and Builder.
  - Builder copies the ship into a new builder slot, where its build log replays.
  - The Battle map and Fight sandboxes then use that ship, wrecks and all.
- **Hull fix** (`src/render/hull.js`): the exterior now roofs over empty cells a ship shuts in. The rules already counted them as hull, and the battle map has them as hull. Before, a gap with parts on only two sides showed as a hole through the ship: 38 of 100 generated haulers had one. Any player ship with such a gap is fixed too.
- **Tests:** 355 in all, up from 344: ten for generated ships and one for the hull.

Seed 1 of each preset. The glyphs are B bridge, + corridor, Q quarters, L life support, M med bay, X armory, S shield, C cargo, R reactor, E engine, W gun, A airlock:

```
Pirate cutter   Patrol corvette   Derelict hauler (rooms 15 and 18 on fire)
EE.........     EE.............   EE............
EERRR.QQXW.     EERRR.A..L.QQQW   EERRRCCC......
EERRRLQQXBB     EERRR.A..LXQQQW   EERRRCCC..QQ..
EERRRLQQ+BB     EERRRRRRMMXSSBB   EERRRCCC..QQ..
..AA....WBB     .....RRRMM+++BB   ...AACCCLLQQBB
                EERRRRRRMMXSSBB   .....CCC++++BB
                EERRR.A..LXQQQW   ...AACCCLLQQBB
                EERRR.A..L.QQQW   EERRRCCC..QQ..
                EE.............   EERRRCCC..QQ..
                                  EERRRCCC......
                                  EE............
```

### Decisions made this session

- **The order a preset lists its parts in sets where they go,** bow to stern. Adding a preset needs no engine edit.
- **Mirrored ships pair what can't sit on the middle line:** engines, guns, airlocks, and rooms with a crate or locker at an end of their middle row (quarters, life support, armory, shields). An odd count gets one more, so a mirrored ship can carry more than its preset's top count.
- **Generated ships are held to more than the builder asks** (wakes, hatches, rooms on foot). Player ships aren't; the doorway-onto-a-locker case is parked in ROADMAP §9.
- **No enemy frame yet.** Every preset builds on the starter yard. §5 still counts an enemy frame for v0.1; it's parked in §9.

### Verified here

- **Tests:** all 355 pass in Node in about 9 s, and the data validates.
- **100 seeds of each preset** (`node tools/gen-ship.js --check 100`): all pass.

  | Preset | Length (cells) | Across (cells) | Parts | Different layouts | Mirrored |
  | --- | --- | --- | --- | --- | --- |
  | Pirate cutter | 9–13 | 4–7 | 10–15 | 100 | n/a |
  | Patrol corvette | 8–20 | 9–13 | 23–28 | 95 | 96 |
  | Derelict hauler | 10–17 | 6–13 | 15–22 | 83 | 90 |

  A ship takes 9 to 16 ms in Node.
- **Fights on generated ships:** 100 seeds each, deployed as the Fight sandbox does, 30-round limit.

  | Ship | Crew played by | Crew wins | Boarders win | No winner |
  | --- | --- | --- | --- | --- |
  | Pirate cutter | scripted | 27 | 68 | 5 |
  | Pirate cutter | AI | 48 | 25 | 27 |
  | Patrol corvette | scripted | 22 | 77 | 1 |
  | Patrol corvette | AI | 41 | 49 | 10 |
  | Derelict hauler | scripted | 33 | 65 | 2 |
  | Derelict hauler | AI | 47 | 49 | 4 |

  The boarders are the AI in every row. Fights that end take a median of 5 to 8 rounds.
- **In the browser** (headless Chromium):
  - offline at 905×370, the sandbox shows every preset;
  - the page makes the same ships as Node (9 compared);
  - stepping seeds, each ship shown passes;
  - a tile card opens on a long-press;
  - Builder adds and opens a slot, and the Builder shows the ship "Ready to launch";
  - the Battle map shows the derelict's wrecks;
  - a fight starts on the ship and its turns play;
  - at 821×283 and 960×825 the rows don't overlap and every button is 48 px or more;
  - no console errors at any size.

### Known issues

- **AI standoffs on generated ships.** AI-against-AI fights reach the 30-round limit on 27 of 100 cutters, 10 corvettes and 4 haulers; M9 measured none of 100 on the example ship. Both sides hold on overwatch either side of a chokepoint. Against a crew that never moves, the boarders can also wait it out. A player who closes in won't see it, but it matters for M11's harness and for Gate 2's fight length. It's a new ROADMAP §8 risk row.
- **Not every mirrored ship is mirrored:** 4 corvettes and 10 haulers in 100 have a part off true, where no mirrored place was left.
- **Some ships come out boxy.** Corvettes with four engines stack them in columns, up to 13 cells across.
- **A player's ship can still have a doorway in front of a locker,** cutting a room off on foot (§9).
- **Builder fills a builder slot** (six at most); delete them in the Saves tab.
- **An airlock that sticks out gets a hatch on every side open to space.** A hauler had seven hatches.
- **Generation time on the phone is unmeasured.** The first ship after a page load takes longer than the rest.
- **Carried over from M9:**
  - the defenders win most AI-against-AI fights on the example ship;
  - the AI sees everyone;
  - the fight isn't saved;
  - the camera doesn't follow the action.

### What to test on the phone (Galaxy Z Fold 6)

1. **Update,** then dev menu → Enemy ships.
2. **Look at each preset.** Step through a dozen seeds with the arrows, in Hull and in Map. Do they read as a pirate cutter, a patrol corvette and a derelict hauler?
3. **Look for anything broken:** a hole in the hull, an engine blowing into the ship, a part hanging off.
4. **Try Builder on one you like,** then:
   - the Builder: Saves → Replay plays it being built;
   - the Battle map: a hauler's wrecked rooms;
   - the Fight: board it.
5. **Tell me:**
   - which preset reads least like its name;
   - how fights on generated ships feel next to the example ship;
   - whether the boarders ever sit and wait.
6. **Delete the generated slots** in Saves when done.

### Next session

**M11 Balance harness.** Done when: 1,000 fights report in under a minute. First task: `tools/sim.js` plays AI-against-AI fights headless (`autoplay`) on the example ship and on generated ships. It reports win rates, rounds, hits and misses, and stalls (fights that reach the round limit). Then come the weights M9 left as starting values, and the standoffs above.

## M9 Enemy AI v1 (2026-10-11)

**Status:** done, and the ROADMAP.md box is ticked. Evan played M8 on the Fold ("it works") and asked for the next milestone.

Done when: "in test scenarios the AI takes cover and flanks, and never stands in the open without a reason."
- **Takes cover:** with a marine across an open room, the pirate shoots from beside the one crate, in half cover, not from the open. Offered a crate and a locker, it shoots from the locker's full cover.
- **Flanks:** a marine in half cover behind a crate gets flanked. The pirate goes round to the one spot where the marine has no cover and it has its own, and the shot goes in with no cover and the flanking crit bonus.
- **Never stands in the open without a reason.** The AI may only end up where an enemy sees it with no cover between for one of two reasons:
  - no covered tile is in reach;
  - a shot from there is worth at least 1 hit point and beats every covered tile's shot.

  A test checks every AI decision in 60 whole fights on the example ship, against the scripted crew and against the AI crew. It works the exposure out from the rules, not from the AI's own notes. Every case had its reason.

### Shipped

- **`src/sim/ai.js`** (pure, deterministic, no random numbers). `aiAction(battle, rules)` gives the next action for the side whose turn it is, so it plays either side.
  - **Plans:** for the first unit with an action left, every plan it could make this turn: stay, move or dash, then shoot an enemy in sight, go on overwatch, or nothing after a dash.
  - **Breach plans:** open a closed door beside it, then shoot or watch through it. Opening a door draws no overwatch fire, because nobody moves.
  - **Each plan is scored in expected hit points:**
    - plus the harm its shot should do: the chance to hit times the damage, with a kill worth 4 more;
    - minus the harm every enemy who can see that tile could do to it there, so cover and range count;
    - minus the overwatch fire it would walk through;
    - plus something for overwatch, more when an enemy is close enough to step into sight next turn;
    - minus a little for each step from the enemy, when it won't shoot.
  - **Target choice falls out of the score:** an enemy in the open, or one a hit would kill, is worth more.
  - **Shots go first:** a shot worth taking beats holding back, unless it is reckless (it scores more than 3 hit points worse than the best plan without a shot). Without this, two AI sides sat on overwatch either side of a door forever.
  - **Doors on the way:** each tile is judged with the doors its path would open.
- **The Fight's enemy turns are the AI's.** The M7 scripted player still plays both sides of the golden battle, unchanged.
- **`src/sim/autoplay.js`** plays a battle out with a player for each side. The tests use it, and so will the M11 balance harness.
- **`node tools/battle-log.js --ai`** prints a boarding fight, the scripted crew against the AI's boarders. `--seed` picks another.
- **Tests:** 344 in all, up from 330. The AI has 13:
  - the scenarios above;
  - target choice, and a kill's worth;
  - the overwatch fallback, and pushing on when the enemy is far;
  - breaching through a watched door;
  - reloading;
  - determinism;
  - fights ending, and boarders firing within two rounds;
  - the never-in-the-open check.

  The Fight's tests now play the scripted crew by taps against the AI.

Seed 7, the scripted crew against the AI's boarders (`node tools/battle-log.js --ai --seed 7`), the boarders' second turn:

```
Pirate e2 opens the door on the south side of (5, 3).
Pirate e2 shoots Medic c3: 60%, rolled 25, hit, crit (35%, rolled 15) for 6.
Pirate brute e3 moves (5, 4) to (5, 3) to (4, 3).
Pirate brute e3 shoots Medic c3: 65%, rolled 51, hit, crit (50%, rolled 19) for 8.
Medic c3 is down, bleeding out in 3 turns.
```

### Decisions made this session

- **Shots go first, but not recklessly,** with breaching to open doors. Scores alone kept both sides hidden behind closed doors on overwatch. AI against AI, 38 of 40 fights stalled at the 30-round limit. With these, none of 40 does.
- **No randomness in the AI.** The same battle always gets the same move, so fights replay from their seed and a fight on the phone can be replayed in Node.
- **The AI knows where everyone is,** as there's no fog of war (M8).
- **The weights are starting values,** in `WEIGHTS` in `ai.js`. M11's harness is where they get tuned, with the battle numbers.

### Verified here

- **Tests:** all 344 pass in Node, and the data validates.
- **The example ship, 3 crew against 4 boarders, 100 seeds for each pairing:**

  | Crew played by | Boarders played by | Crew wins | Boarders win | No winner |
  | --- | --- | --- | --- | --- |
  | scripted | scripted | 34 | 64 | 2 |
  | scripted | AI | 41 | 58 | 1 |
  | AI | scripted | 75 | 22 | 3 |
  | AI | AI | 70 | 30 | 0 |

  The AI makes the outnumbered crew win 75 where the scripted player wins 34.
- **Where turns end** (40 seeds, against the scripted crew):
  - The AI's boarders end a turn in the open 22% of the time, against 59% for the scripted ones.
  - Of the AI's decisions, 677 ended in cover and 7 in the open with no cover in reach.
  - 208 ended in the open where the only shots were from open tiles (median expected harm 3.5 hit points).
  - 86 ended in the open for a better shot than any covered tile offered (median 3.8).
- **Speed:** 1,000 AI-against-AI fights in about 6 s in Node; M11 needs them in under a minute.
- **In the browser** (headless Chromium, scripted touch), at 905×370, 821×283 and 960×825:
  - whole fights played by touch against the AI, with the page matching Node after every order (0 differences) and no console errors;
  - both outcomes came up;
  - offline still works, wrecks still carry into a fight, and the cards and Fit still work.

### Known issues

- **The defenders win most AI-against-AI fights** on the example ship: 70 of 100 for 3 crew against 4 boarders. The boarders come in through one airlock and its doors into the crew's overwatch. That's balance, for M11, unless Evan feels it now.
- **Against the plain scripted crew, fights can drag:** one browser check ran to 26 rounds. The scripted crew trades long shots while the boarders hold cover. A player who closes in won't see that.
- **The AI judges threat by where enemies stand now.** It doesn't foresee the crew moving to flank it.
- **The AI sees everyone** (no fog of war). A real scout or surprise needs fog first (ROADMAP §9).
- **The boarders can't choose their way in** beyond the airlock they board by, and can't cut through walls (ROADMAP §8's chokepoint risk).
- **Carried over from M8:**
  - the fight isn't saved;
  - tiles are 38–41 px in the cover screen's browser tab;
  - the camera doesn't follow the action.

### What to test on the phone (Galaxy Z Fold 6)

1. **Update,** then dev menu → Fight. Play two or three fights.
2. **Watch the boarders.** They should:
   - stop beside crates and lockers rather than in the open;
   - go round your cover to flank;
   - open doors and shoot through them, rather than walking into your overwatch;
   - go on overwatch when they can't reach a shot.
3. **Try to bait them:** put someone on overwatch facing a door, then end the turn.
4. **Tell me:**
   - whether they feel smart or cheap;
   - whether fights are too easy, too hard or about right (the numbers above say the crew should win most);
   - how long a fight takes. Gate 2 asks for 5 to 8 minutes.

### Next session

**M10 Enemy ship generator.** First task: in `src/sim/gen/`, build enemy ships with the builder's own rules from presets (pirate cutter, patrol corvette, derelict hauler) and a seed. Then the test: 100 generated ships all pass the flight checklist.

## M8 Tactical UI (2026-10-11)

**Status:** done, and the ROADMAP.md box is ticked. Evan said "Start the next milestone" after M7. After playing it on the Fold he said: "Start the next milestone it works".

Done when: "a full 3-against-4 fight plays on the Fold."
- **On the Fold:** Evan played it: "it works". He gave no word yet on tile size, the square camera or the pace of enemy turns.
- **Whole fights played by touch** at the Fold's three sizes, in headless Chromium with scripted touch. Three crew against four boarders on the example ship, played to the end.
  - The crew's orders were given by tapping tiles, units and buttons.
  - A copy of each fight ran in Node from the page's seed. After every order the page matched it exactly: 0 differences.
  - Both outcomes came up: the crew won most runs, and the boarders took one (table below).

### Shipped

- **Fight sandbox** (dev menu → Fight): the squad against a boarding party on the builder's open ship.
  - **Who fights:** `data/encounters.json` has the squad (marine, engineer, medic) and the boarding party (three pirates and a brute). Both are validated.
  - **Where they start:** the squad on the bridge, the boarders at the airlock's hatch, each on the nearest tiles (`src/sim/deploy.js`). A ship with no airlock on its hull, or too small for seven, says what it needs.
  - **Wrecks carry over:** set the bridge on fire in the Battle map sandbox, then fight, and the crew start burning.
  - **Each fight rolls a new seed.** The Log button shows it, with the last 16 events.
- **Giving orders** (`src/sim/fight.js`, pure and tested). A tap on the board never spends an action:
  - The crew member giving orders has a ring and a marker over them, and their button in the left column is lit. Tap another crew member, or their button, to switch.
  - **Movement ranges:** blue tiles take one action, amber ones a dash (both actions).
  - **A tap on a tile** shows the path, where it stops, and the cover there: a low pane for half cover, a tall one for full. A second tap on the same tile makes the move.
  - **A tap on an enemy, or Shoot,** opens the odds card: the hit chance part by part (aim, weapon at its range, cover, defense), then the crit chance and the damage. Fire, or a second tap on the enemy, takes the shot. Next shows the next target.
  - Every enemy in sight has its hit chance over its head.
  - **Other orders:** Overwatch and Reload, plus Stabilize (an ally down beside you) and Open door (a door beside you), which show only when they apply.
  - **End turn** takes a second tap while anyone can still act.
  - After an order, the same crew member keeps giving orders while they can, then the next in line takes over.
- **Enemy turns** are played by M7's scripted player, moved into `src/sim/scripted.js`. It is still the plain one, not the M9 AI. The rules work out the whole turn at once, then the board plays it out.
- **Playback with Skip** (`src/render/playback.js`, pure and tested):
  - Units walk step by step, and doors slide down as they pass.
  - "ENEMY TURN" and "YOUR TURN" banners.
  - The status line tells each event, rolls included: "Pirate e2 shoots Marine c1: 70%, rolled 22, hit for 2."
  - Skip jumps to the end. The board takes no orders until the turn has played out.
- **Hit and miss feedback:**
  - A tracer that lands on a hit, or flies wide and past on a miss.
  - A flash on the unit hit.
  - Words rising over it: −5, CRIT −7, MISS, DOWN, DEAD, OVERWATCH, STABLE, BURN.
- **Units in 3D** (`src/render/units.js`):
  - Figures in suits: the crew pale, each trimmed in their own colour (the same as their button), and boarders in rust.
  - Standing figures face the nearest enemy. Down crew lie on the deck, and the dead or out lie grey.
  - Pips over each unit show its hit points, with DOWN · turns, STABLE or OVERWATCH.
- **Cards:** long-press a unit or a tile to read it.
- **Changes elsewhere:**
  - Battle maps draw open doors slid into the deck.
  - Airlock floors are a square pad, no longer a ring, since rings now mark units.
  - The Battle map sandbox shares its tile card and its wrecks with the Fight (`tileText.js`, `wrecks.js`).
  - On the Fight screen, the dev overlay sits bottom right on the board.
  - In a fight the battle board redraws its 3D only when something in it changed. While units walk, a phone too slow for full frames gets rough ones, as it does while the camera moves.
- **Tests:** 330 in all, up from 297:
  - fight 12, deploy 5, units 7, playback 5, odds text 3, plus open doors and the encounter data;
  - one plays fights by taps through the reducer and gets exactly the rules' own battle and log;
  - another applies the playback's events one by one over four whole fights and gets the rules' battle after every action.

### Decisions made this session

- **The fight camera is square to the ship,** not the builder's 11° turn. M6 left this to M8. Tiles for the example ship at the opening view:

  | Screen | Square to the ship | Builder's angle |
  | --- | --- | --- |
  | 905×370 (cover, app) | 48–53 px | 39–43 px |
  | 821×283 (cover, browser tab) | 38–41 px | 29–32 px |
  | 960×825 (unfolded) | 52–57 px | 50–55 px |

  A twist still turns it.
- **No fog of war.** Every boarder is always shown: it's the crew's own ship. Only those the selected unit can see get a hit chance. Fog is in ROADMAP §9.
- **Buttons act on one tap,** except End turn with actions left. Moves and shots on the board always take two.
- **The crew starts on the bridge and moves first.**
- **The fight isn't saved:** a reload starts a new one. Battle saves are M12's (autosave at the start of each player turn), so `SAVE_VERSION` stays 3.
- **The seed comes from the browser's random numbers** when a fight starts, outside `src/sim/`, as a new game's does in `main.js`. Everything after it is seeded.

### Verified here (headless Chromium with scripted touch, not a phone)

- **Whole fights by touch,** final runs, each with 0 differences from Node and no console errors:

  | Screen | Orders | Rounds | Winner |
  | --- | --- | --- | --- |
  | 905×370 | 81 | 32 | crew |
  | 821×283 | 32 | 13 | crew |
  | 960×825 | 34 | 14 | crew |
  | 905×370 (earlier run) | 7 | 4 | boarders |

  Each run also checked:
  - reading the seed in the Log;
  - a long press on a boarder;
  - End turn asking again;
  - the odds card's rows matching the chance shown;
  - Skip in some enemy turns;
  - the end panel, and Fight again.
- **Smallest tile at the opening view:** 48.3 px (905×370), 38.0 (821×283), 52.3 (960×825).
- **Offline:** the fight files are cached. With the server stopped, the Fight opens, a move plays, and the Builder still opens the ship.
- **Wrecks:** the bridge set on fire on the Battle map gives a fight that starts with all three crew burning for 2.
- **Cards and view:** a long press on a tile gives its card. A pan then Fit gives back the identical frame.
- **Five orders at once** (Stabilize and Open door both showing) stay clear of the DEV button at every size. On the 283 px browser tab the column scrolls.
- **Frame rate at 4× CPU throttle.** These are floors: headless fills canvas on the CPU, and the Fold uses its GPU.
  - An enemy turn playing out: 15 to 46 fps, about 30 typical. It was 10 to 16 before the board stopped redrawing unchanged 3D.
  - Panning: 37 to 41 fps.
- **Regression:**
  - Battle map: 24 checks at each of the three sizes.
  - Builder: the touch build (14) and tap to move (12).
  - All pass, with no console errors.

### Known issues

- **Not played on the Fold yet.**
- **The boarders are plain:** they rush, shoot whatever they see and never take cover. That is the scripted player, and M9 replaces it. A browser fight between two plain sides once ran to 32 rounds. Gate 2 asks for 5 to 8 minutes, which is M9's and M11's work.
- **Tiles in the cover screen's browser tab are 38–41 px,** under 48. A stray tap only moves the preview; zoom in for bigger tiles.
- **Five orders at once scroll** in that browser tab. Rare: it needs a downed ally and a door both beside you.
- **The dev overlay can cover the lower right of a big ship** on the Fight screen (dev mode only).
- **The camera doesn't follow the action:** on a ship too big for the screen, part of an enemy turn can play out of view (ROADMAP §9).
- **Pirates and the brute look alike** apart from their pips (the brute has 11) and their names on the cards.
- **The painter has no depth buffer:** units and walls are sorted by their middles. Nothing looked wrong in screenshots.
- **Carried over:** doors only open; balance untuned; ROADMAP §4.1 says to revisit cell size after M8, which is Evan's call now that fights play.

### What to test on the phone (Galaxy Z Fold 6)

1. **Update,** then open a ship with an airlock on its hull. Your Gate 1 ship works, as does any ship that passes the flight checklist.
2. **Dev menu → Fight.** Play a whole fight on the cover screen:
   - Tap a crew member, tap a tile, then tap it again.
   - Tap a boarder, read the card, then Fire.
   - Try Overwatch, and Skip during an enemy turn.
3. **Unfold** and play another.
4. **Wrecks:** Battle map → set a room on fire → Fight. Anyone standing in it burns at the start of their turn.
5. **Offline:** with the network off, open the Fight again.
6. **Tell me:**
   - whether the tiles are big enough to tap;
   - the square camera against the builder's angle;
   - whether enemy turns play too slowly;
   - whether the odds card is clear;
   - what the dev overlay's last line says during an enemy turn ("full N/10 ms").

### Next session

**M9 Enemy AI v1.** First task: in `src/sim/ai.js`, score the tiles a boarder can reach (cover against the crew, flanks, distance, threat) as a pure function. Test it on small maps where it should take cover and flank. Then swap it in for the scripted player in the Fight's enemy turns.

## M7 Tactical rules, headless (2026-10-11)

**Status:** done, and the ROADMAP.md box is ticked. Evan said "Good. Move to the next phase" after the zoom fix. I read that as the next milestone, since Phase 2 runs to M11 and Gate 2 comes before Phase 3.

Done when: "hit-chance math is tested and a fixed-seed battle replays identically."
- **Hit-chance math, tested.** Every part has a test: aim, the weapon at each range band, half and full cover, defense, overwatch, forgiving odds, the 0 to 100 limits and the flanking crit bonus. Each shot is rolled at exactly the chance shown, checked against the RNG.
- **A fixed-seed battle replays identically.** The example battle (below) replays from its setup and actions to the same log, word for word (`tests/golden/example-battle.txt`). It does so twice, and through JSON. Battles from 40 more seeds replay to the identical battle and events too.

### Shipped

- **Battle content as data:**
  - `data/weapons.json`: rifle, shotgun, pistol and carbine. Each has damage, accuracy at close, mid and long range, a crit chance and crit damage, and a clip.
  - `data/jobs.json`: marine, engineer and medic.
  - `data/enemies.json`: pirate and pirate brute. Jobs and enemies both give hit points, aim, defense, mobility, armor and a weapon.
  - `data/tiles.json`: what each kind of tile does (stand on it, its cover, whether it blocks sight).
  - `balance.json`: 15 battle numbers.

  The validator checks all of it, with 15 new cases.
- **The rules,** in `src/sim/` and pure:
  - `terrain.js`: tiles and edges, and the doors as they are now.
  - `sight.js`: exact, whole-number line of sight, the same from either end.
  - `cover.js`: directional cover and flanking.
  - `odds.js`: hit and crit chance, part by part, for the target preview.
  - `moves.js`: paths and reach.
  - `battle.js`: units, actions, turns, overwatch, hazards, bleeding out, the winner and the event log.
  - `battleLog.js`: events in words.

  ROADMAP §4.3 now states each rule as built.
- **Actions:** move or dash, shoot, overwatch, reload, stabilize, open a door, and end the turn.
  - **Open a door** wasn't in the plan. The first example battle stalemated: boarders stood on the airlock tiles right behind closed doors, so nobody could walk through, and nobody could see through. Now a unit can open a door beside it for one action.
- **Tools:**
  - `tools/battle-log.js` (`npm run battle`) plays the example battle and prints its log; `--seed` picks another seed and `--golden` rewrites the golden files.
  - The scripted player that plays both sides there is deliberately plain, for tests: it shoots what it sees, else walks closer, else opens a door or overwatches. It isn't the enemy AI (M9).
  - `parseMap` in `tools/battle-map.js` reads the text map format back, so tests can draw small maps.
- **Golden files, new on purpose:** `tests/fixtures/example-battle.json` (setup and actions) and `tests/golden/example-battle.txt` (its log).
- **Tests:** 297 in all, up from 237. Line of sight has 10, including symmetry for every pair of tiles on the example ship. Cover has 7, odds 6, movement 8, the battle 24, and replay 4, plus a parser round trip.

The example battle: three crew on the example ship's bridge, and two pirates and a brute come in through the airlock.

```
Round 1: the crew's turn.
Marine c1 opens the door on the west side of (9, 2).
Marine c1 moves (9, 2) to (8, 2) to (8, 3) to (7, 3) to (6, 3).
Marine c1 opens the door on the south side of (6, 3).
Engineer c2 moves (9, 3) to (9, 2) to (8, 2) to (8, 3) to (7, 3).
Engineer c2 shoots Pirate e1: 45%, rolled 14, hit for 5.
Medic c3 moves (10, 3) to (9, 3) to (9, 2) to (8, 2) to (8, 3).
Medic c3 shoots Pirate e1: 20%, rolled 19, hit for 2.
Pirate e1 is dead.
End of the crew's turn.
Round 1: the enemy's turn.
Pirate e2 shoots Marine c1: 70%, rolled 61, hit for 2.
Pirate brute e3 opens the door on the east side of (4, 4).
Pirate brute e3 moves (4, 4) to (5, 4).
Pirate brute e3 opens the door on the north side of (5, 4).
Pirate brute e3 moves (5, 4) to (5, 3).
Pirate brute e3 opens the door on the east side of (5, 3).
End of the enemy's turn.
Round 2: the crew's turn.
Marine c1 shoots Pirate e2: 70%, rolled 7, hit, crit (40%, rolled 6) for 7.
Pirate e2 is dead.
Engineer c2 shoots Pirate brute e3: 85%, rolled 93, missed.
Medic c3 shoots Pirate brute e3: 75%, rolled 57, hit, crit (40%, rolled 14) for 2.
End of the crew's turn.
Round 2: the enemy's turn.
Pirate brute e3 shoots Marine c1: 75%, rolled 58, hit, crit (50%, rolled 28) for 6.
End of the enemy's turn.
Round 3: the crew's turn.
Marine c1 shoots Pirate brute e3: 70%, rolled 90, missed.
Engineer c2 shoots Pirate brute e3: 85%, rolled 27, hit, crit (50%, rolled 26) for 7.
Medic c3 shoots Pirate brute e3: 75%, rolled 22, hit, crit (40%, rolled 36) for 3.
Pirate brute e3 is dead.
The crew wins.
```

### Decisions made this session

- **Movement is four-way,** square by square. Diagonals across thin walls need corner-cutting rules, and rooms are one to three tiles. Easy to change after M8, if four-way feels stiff.
- **Cover counts against anyone on its side,** at any angle. North cover protects from everyone north of the unit; level with it is flanking. It's simple to show and explain, and corners are strong.
- **Line of sight runs from tile middle to tile middle.** There's no stepping out around corners as in XCOM, so corners are harsher. Units don't block it.
- **Doors:** walking through one opens it, and so does the new action. They can't be closed yet (ROADMAP §9).
- **Crew go down, enemies die.** Downed crew bleed out over 3 of their own turns. Bleeding out leaves them out of the fight unless permanent death is on. They can't be shot while down. Dead bodies don't block.
- **Hazards:** fire hurts at the start of a unit's turn, so walking through fire is free. Suit air never refills during a battle.
- **Units use direct stats** from their job or enemy type. The attributes in §4.5 (Grit, Aim, Wits, Nerve) will feed these when crew are generated (M12 and M23). Abilities come later too (M32).
- **The numbers are starting values.** There is no balance sim until M11, so `tools/sim.js` couldn't be run for them.

### Verified here

- **Tests:** all 297 pass in Node, and the data validates.
- **A bug found re-reading the code:** a unit downed by overwatch while passing through an ally's tile would have stopped there, two to a tile. Overwatch now holds fire until the unit is on a free tile (tested). The 40-seed run never hit it.
- **Browser** (nothing on screen changed in M7, but every screen now loads the four new data files): the battle map checks pass at all three sizes (24 each), the builder's touch build at the cover size (14), and offline (4: the new files are cached, and the battle map and builder open with the server stopped). No console errors.

### Known issues

- **The crew wins most example battles:** 32 of 40 seeds, 6 for the boarders, 2 undecided after 20 rounds. That's with the scripted player, which plays both sides badly and lets the crew move first, so it isn't a balance measure. M11 is.
- **The scripted player can stall:** two units trading long shots forever, which is why 2 of 40 didn't finish.
- **No fog of war:** a unit sees whatever is in line of sight, up to 20 tiles. It's M8's call how much the player is shown.
- **Not yet in the rules:** hunkering down, abilities, objectives other than eliminate, and closing or locking doors.

### What to test on the phone (Galaxy Z Fold 6)

1. **Nothing new on screen:** M7 is rules only. Update, then check the Builder and the Battle map still open, online and with the network off.
2. **Read the example battle above.** Does it read like the fight you want? The rules to push back on are four-way movement, cover on a side counting against anyone on that side, and no stepping out around corners. They're cheap to change now, before M8 puts them on screen.

### Next session

**M8 Tactical UI.** First task: units on the battle map in 3D, from a battle (M7). Tap a unit to select it, and show where it can move (`reachable`), one action and dash, at 48 px targets. Then the target preview with the odds broken down (`shotOdds`).

## Fix after M6: sharp frames while zooming (2026-10-11)

**Status:** done. After it went out Evan said "Good. Move to the next phase", which I read as M7, the next milestone in Phase 2. Phase 3 waits for Gate 2.

Evan, on the Fold: "Zooming and unzooming causes the ship to go blurry. Is that intended? Could we fix it?"
- **It was intended:** a speed trick from M4. While the camera moved, the builder's plans drew at one pixel per CSS pixel without the glow halos, scaled up, and sharpened 150 ms after the camera stopped. M6 copied it into the battle map.
- **The trick was tuned on the wrong machine.** It was measured in headless Chromium, which fills canvas pixels on the CPU, where pixels are what cost. A phone fills them on its GPU. The JS that records a full frame takes 0.7 to 1.4 ms here (3 to 9 ms at 4× CPU), so on the Fold the blur bought little.

### Shipped

- **A frame budget** (`src/render/frameBudget.js`, 10 ms). While the camera moves, frames are drawn in full, as sharp as still ones, as long as a full frame fits the budget.
  - On a phone that can't keep up, moving frames are rough as before, then sharpen when the camera stops.
  - The cost is the middle of the last three full frames, and it counts only from the second. One slow frame (a garbage collection, or a screen's first) doesn't blur a whole gesture.
  - Each full frame is timed with its copy to the screen. On a phone that draws canvas without its GPU, that copy is where the pixels get filled, so the budget sees the real cost there too.
- **Both 3D boards use it:** the builder's plans and the battle map. The Hull view never had rough frames.
- **The battle map keeps its last full frame** and reuses it when nothing has changed, as the builder's plans already did. Both boards draw frames into offscreen canvases through one helper (`src/render/layer.js`).
- **The dev overlay** has a new line on the builder and battle map, such as "moving 28 full 0 rough  full 2.1/10 ms". That's how the frames drawn while the camera moved came out in the last half second, and what a full frame costs against the budget.
- **Tests:** 237 in all, up from 230. Seven cover the budget on a fake clock: still frames are always full, the switch to rough and back, a slow first frame and one slow frame ignored, the counts.

### Verified here (headless Chromium, which fills canvas on the CPU)

- **Cheap frames** (600×260 at 1×; a full frame about 4 ms in the builder, 5 on the battle map): while zooming, the frame on screen is already the final one in both boards, and the overlay reads "moving 10 full 0 rough".
- **Expensive frames** (905×370 at 2× with 4× CPU; a full frame 50 to 130 ms): moving frames are rough and sharpen after the camera stops, as before.
- **Headless at 905×370 and 2×, unthrottled,** fills pixels on the CPU, so a full frame costs 16 to 19 ms and moving frames stay rough there. That's the case the fallback is for.
- **Regression:** at all three sizes, the battle map (24 checks), M5b's touch build (14), M5's saves (34) and M5c's moves (12) all pass, and so does the offline check (4). No console errors.

### Known issues

- **Not measured on the Fold.** The overlay line says which kind of frame it drew. A full frame is expected at a few ms; over 10 ms, the blur comes back while moving.
- **The canvas is drawn at 2× on a 2.625× screen.** CLAUDE.md caps the pixel ratio at 2, so the board is slightly soft even when still. A cap of 3 would be crisper and cost about 1.7 times the pixels. That's Evan's call.

### What to test on the phone (Galaxy Z Fold 6)

1. **Update,** then pinch to zoom in and out in the Builder and on the Battle map. The ship should stay sharp the whole time.
2. **In dev mode,** read the last line of the frame-rate overlay (top right) while pinching. "0 rough" means every frame was full. If it says rough, send the line: it has the cost.

## M6 Ship to battle map (2026-10-11)

**Status:** done, and the ROADMAP.md box is ticked. It's the first Phase 2 milestone, started after Gate 1 passed (below).

Done when: "the same ship always converts to the identical map (tested), and the map renders."
- **Identical map, tested.** The example ship converts to a golden map, and the same ship converts the same twice, from a copy, and with freshly loaded data. Moved to another spot in the yard, it converts the same apart from the origin. In the browser, the page's map matches Node's, byte for byte.
- **The map renders,** in a new Battle map sandbox, at all three screen sizes. Two loads draw it identically, pixel for pixel.

### Shipped

- **`src/sim/mapFromShip.js`** (pure): `mapFromShip(ship, defs, { wrecked })` turns a ship into a battle map of plain data on grid.js grids.
  - **Tiles:** each cell becomes `tilesPerCell` × `tilesPerCell` tiles, from its room's interior template (floor, half cover, full cover, machinery, console, airlock). Around the rooms a tile is space, or hull where the hull closes over a notch (the builder's space test).
  - **Edges:** walls stand between tiles, since a room can be one tile across. An edge is a wall between rooms, the hull, a door where the builder joins two rooms, or a hatch where an airlock meets space. Corridors side by side stay open. An engine's exhaust and a gun's barrel get no door.
  - **The rest:** which room each tile is in; the rooms in build order with their boxes; the hatches (where boarders come in); and one tile of space around the ship.
  - **Wrecked rooms:** `{ uid: 'fire' | 'vacuum' | 'rubble' }` puts that hazard on every tile of the room. An unknown room or wreck is left out. What each hazard does is M7's.
  - An empty ship has no map (`null`). `wallAt(map, x, y, side)` reads any edge; `nextWreck` cycles the wrecks.
- **`tools/battle-map.js`** prints a map as text (`npm run map`, wrecks as `uid=fire`), and `--golden` rewrites the golden file. This is the example ship, with doors as `/` and the hatch as `o`:

  ```
        +=+=+=+=+=+=+
        Ih h ./. . .I
    +=+=+     +     +=+=+
    I# ./. . .|. # ./. cI
    +   +-+/+-+     +   +
    I# ./. . ./. . .|. .I
    +/+-+/+-+/+/+/+=+   +
    I# ./H ./a a/cI%I. cI
    +   +=+=+o+=+=+ +=+=+
    I# .I
    +=+=+
  ```
- **Golden file, new on purpose:** `tests/golden/example-ship.map.txt`, the example ship's map. CLAUDE.md's Testing section now covers golden maps.
- **The map in 3D** (`src/render/battleScene.js`, `battleView.js`): solid faces through the existing painter, cut away so a crew can be seen over the walls.
  - **Rooms:** floors tinted per room with a seam on every tile. Walls stand at 0.55 tiles and the hull at 0.7, with posts only where runs turn or meet a door.
  - **Doors and hatches:** doors are amber with a lit top. Hatches are blue, with a docking collar and its light outside.
  - **Fittings:** crates for half cover, tall lockers for full cover, machinery with a glow, consoles with lit screens, and a hazard ring on airlock floors.
  - **Wrecks:** flames and an orange glow for fire; frost and a cold glow for vacuum; rocks on dusty floor for rubble. The look is fixed per tile, with no random numbers.
  - **Colors:** new palette tokens for interiors (`floors`, `wall`, `door`, `doorLight`, `screen` in the yard skin) and for wrecks (`fire`, `fireCore`, `scorch`, `vacuum`, `frost`, `rubble`, `dust`).
- **Battle map sandbox** (dev menu → Battle map): the builder's open ship as its boarding map.
  - Tap a room to wreck it: fire, vacuum, rubble, then whole again. Clear puts every room right.
  - Long-press a tile for a card: its room, what's on it, its edges and any wreck.
  - Drag to pan, pinch to zoom, twist to turn. Fit returns to the opening view. The view opens on the ship and pans over the whole map.
  - Nothing here is saved. Wrecks last until reload, for the ship they were made on.
- **Speed:** while the camera moves, frames are drawn at one pixel per CSS pixel without outlines, then sharpen once it stops (as the builder's plans do). `paintSolid` gained an `edges` option for this. Space behind the map is painted once per size.
- **Tests:** 230 in all, up from 204. There are 18 for the map: golden, determinism, moving the ship, the margin of space, tiles, notches, rooms, doors, corridors, hatches, exhaust, sealed rooms, doors matching the builder's joins, both sides of every edge, wrecks, the wreck cycle, an empty ship, and two tiles a cell. There are 8 for the scene: face data, determinism, floors, walls and their heights, posts, door lights and collars, wrecks, and the camera boxes.

### Decisions made this session

- **Walls on edges, not tiles.** One tile per cell means many rooms are one or two tiles across; wall tiles would leave them no floor. ROADMAP §4.3 now says so.
- **Doors have no state in the map yet.** Open, closed and locked are battle state, so they're M7's. Every door starts as a door.
- **A wreck covers the whole room,** and the conversion uses no random numbers. Variety, like fire spreading or where rubble piles up, belongs to the approach phase and M7, from the battle's seed.
- **The battle camera uses the builder's angle,** a little nearer. It opens on the ship, with the margin of space left to pan to.
- **The sandbox writes nothing to the save,** so `SAVE_VERSION` stays 3.

### Verified here (headless Chromium with scripted touch, not a phone)

- **At 821×283, 905×370 and 960×825:** 24 checks each, with no console errors or warnings.
  - The page's map is Node's, twice. The info line reads "12 × 7 tiles · 11 rooms · 1 hatch". The map draws over space, and identically on a second load.
  - The bridge cycles fire, vacuum, rubble and whole, and its floor color comes back exactly. Three rooms wrecked at once.
  - A long press reads "Crew quarters · Tile (5, 1): floor · Edges: hull to the north, door to the east · Wrecked: full of rubble". The next touch closes the card.
  - Clear works. Pan, pinch, a rough frame mid-drag and the full one after, and Fit back to the exact opening frame.
  - An empty ship gets a hint, and a tap there does nothing.
- **Offline:** with the server stopped after one visit, the four new files are in the cache. The battle map opens, a tap sets the reactor on fire, and the builder still opens the ship.
- **Regression:** M5b's touch build, M5's saves and codes, and M5c's tap to move all still pass at all three sizes, with no console errors.
- **Frame times** at 4× CPU throttle (headless draws canvas on the CPU, so these are floors; the builder pinches at 32 fps the same way):

  | Ship | Faces | Panning | Pinching and turning |
  | --- | --- | --- | --- |
  | Example, 11 parts | 445 | 39 fps | 34 fps |
  | 26 parts, 16 × 10 tiles | 1,034 | 32 fps | 29 fps |

  The first cut drew 1,877 faces for the 26-part ship at 12 fps. Fewer faces, rough frames while moving and a cached backdrop brought it to the numbers above.
- **Tile size on screen at the opening view:**

  | Screen | Smallest tile | At the middle |
  | --- | --- | --- |
  | 905×370 (cover) | 38.5 px | 46.6 px |
  | 821×283 (browser tab) | 28.7 px | 34.8 px |
  | 960×825 (unfolded) | 63.8 px | 77.2 px |

### Known issues

- **Tiles are under 48 px on the cover screen** (38–47 px for the example ship). It doesn't matter for M6, whose taps only wreck whole rooms, but M8 needs 48 px targets. Turning the camera square to the ship (yaw 0) would give about 50–60 px for the example ship. That's a call for M8, and for Evan's eye.
- **No outside on a battle map:** the cutaway shows rooms, walls and docking collars, but not the nose, nozzles or gun barrels.
- **The painter has no depth buffer.** Faces are small and none looked wrong in screenshots, default or turned and zoomed, but an odd angle could still draw one in the wrong order.
- **Taps pick the deck,** so a tap on top of a tall locker picks the tile behind it.
- **Vacuum stays in its room:** a wrecked corridor is in vacuum alone, even when the corridors beside it are open to it. Whether vacuum spreads is M7's call.
- **Two tiles a cell** is tested in Node only: the data has one, and nothing draws two yet.
- **Carried over:** small builder cells with a real finger, corridors two taps a cell, balance untuned.

### What to test on the phone (Galaxy Z Fold 6)

1. **Update,** then open a ship in the Builder.
2. **Dev menu → Battle map.** Does it look like the inside of your ship: rooms where you built them, a doorway on each shared wall, the hatch on the airlock's outer side?
3. **Wrecks:** tap a room several times (fire, vacuum, rubble, whole), then tap Clear.
4. **Read a tile:** long-press a tile. Its card should name the room, its tiles and its doors.
5. **Move around:** pan, pinch and twist, then Fit, on the cover screen and unfolded. Is it smooth? Try your biggest ship too.
6. **Offline:** turn the network off and open it again.
7. **Tell me:** whether the tiles look big enough to tap units on, and whether the camera angle suits a battle. Both feed M8.

### Next session

**M7 Tactical rules, headless.** First task: units and actions on the M6 map. Decide in data what each tile and edge does: which tiles block movement and sight, what cover they give from each side, and how doors open. Then movement and line of sight, with tests.

## Gate 1 (2026-10-11)

**Passed.** After trying M5c on the Fold, Evan said: "All good. Continue the work".
- I read that as M5c passing and Gate 1 passing. Gate 1 asks whether building on the Fold makes him want to keep going, and he said continue.
- Phase 2 starts with M6 (ship to battle map). If I've misread him, the gate reopens and the builder gets fixed first.

## M5c Tap to move (2026-10-11)

**Status:** done. Evan tried it on the Fold and said "All good", so the ROADMAP.md box is ticked. Evan, after M5b: "add the ability to tap and move pieces that were already placed."
- **Filed in Phase 1, before Gate 1.** It's builder work.

Done when: "on the Fold, a placed part moves and turns by taps alone, the move can be undone, and a stray tap never moves anything."
- **Met here, at all three sizes:** an airlock in the example ship moved and turned with taps alone, and undo put it back.
- **Stray taps:** a tap off the preview only moved the preview. Tapping the selected part let go of it.

### Shipped

- **Tap to move** (`src/sim/session.js`): a placed part now moves the way a new part is placed.
  - Tap it to select it. Tap where it should go, and a ghost of it shows there; its old place is drawn dashed.
  - Tap the ghost to move it. That's one move command in the history and the build log; the part keeps its id and its place in the build order.
  - Turn turns the ghost, so a move can turn the part too.
  - Tapping another part selects that one instead. Tapping the selected part drops the ghost, and a second tap lets go of it.
  - Dragging still works, the ghost included: a turned ghost dragged elsewhere keeps its turn.
- **One rule changed:** a tap on empty grid with a part selected used to clear the selection. Now it shows the part there, ready to move.
- **Undo, redo and delete** drop a move ghost, since the part may have gone. A ghost of a part being placed survives undo, as before.
- **Hint text:** "Airlock: tap where to move it, or Turn or Delete." and "Tap the Airlock again to move it here.", or why it can't go there.
- **Tests:** 204 in all, up from 201. They cover the move by taps, turning the ghost, a blocked move, letting go, a move carrying a turn, and the move hints.

### Verified here (headless Chromium with scripted touch, not a phone)

- **At 821×283, 905×370 and 960×825:** 12 checks each. Select; let go; preview where aimed; a stray tap moves only the preview; Turn turns only the preview; the tap moves and turns the part; part count unchanged; undo; redo; undo selects the part; dragging a turned ghost keeps its turn.
- **Regression:** M5b's touch build and M5's save and code checks still pass at all three sizes, and so does the offline check.
- **Console:** no errors or warnings.

### Known issues

- **A tap right on a cell edge** can show the ghost a cell either side, since snapping rounds there. Tapping the ghost where it shows always works.
- **Carried over from M5b:** small cells with a real finger; corridors take two taps a cell; balance untuned.

### What to test on the phone (Galaxy Z Fold 6)

1. **Move by taps:** tap a placed part, tap somewhere else on the grid, then tap its ghost. It should move.
2. **Move and turn:** do the same, but tap Turn before tapping the ghost.
3. **Undo:** undo after a move puts the part back.
4. **No accidents:** tap around the grid while a part is selected. Nothing should move until you tap the ghost.
5. **Letting go:** tap the selected part twice to let go of it.

### Next session

**Evan's call:** try tap to move on the Fold.
- If it's good, tick M5c in ROADMAP.md.
- Then Gate 1: building on the Fold for 15 minutes, does he want to keep going? If he records that it passed, Phase 2 starts with M6 (ship to battle map).

## M5b Fine grid, smaller parts, build anywhere (2026-10-11)

**Status:** done. Evan built with it on the Fold and said "Good", so the ROADMAP.md box is ticked. He asked for M5b after testing M5: "The modules are a bit too big. The grid shows smaller boxes. I want those to be active." In the same reply he asked for tap to move, which is M5c.

Done when: "on the Fold's cover screen, a ship built from the smaller parts, off the old outline and joined only by shared walls, passes the flight checklist with no part placed by mistake; and ships and codes from M5 still open."
- **Met here, at the cover screen's size and both others:** a 12-part ship built by touch (11 parts tap-tap, one dragged from the drawer), with its cargo hold reaching past M5's outline and joined only by shared walls, passed every flight check.
  - Every placement added exactly one part.
  - A stray tap only moved the preview.
- **M5 saves and codes open, converted,** but the parts come apart (see Known issues).
- **Open on the phone:** whether 24 px cells are easy to hit with a real finger. Headless taps land exactly where they're aimed.

### Evan's calls (asked before building)

- **Part sizes:** smaller, a size per part.
- **Build area:** anywhere; no fixed hull outline.
- **Doors:** automatic, wherever two rooms share a wall.
- **Touch:** the whole ship stays in view, and every placement previews first.

### Shipped

- **The grid:** one builder cell is one battle tile (`tilesPerCell` 1). The half squares under M5's cells are now the cells. ROADMAP §4.1 is rewritten to match.
- **Smaller parts.** Sizes in cells:

  | Part | M5 (in today's cells) | Now |
  | --- | --- | --- |
  | Bridge | 4×2 | 3×2 |
  | Reactor | 4×4 | 3×3 |
  | Engine | 4×2 | 2×2 |
  | Corridor | 2×2 | 1×1 |
  | Airlock | 2×2 | 2×1 |
  | Crew quarters | 4×2 | 3×2 |
  | Life support | 2×2 | 2×1 |
  | Cargo hold | 4×4 | 3×3 |
  | Med bay | 4×2 | 3×2 |
  | Armory | 2×2 | 2×1 |
  | Weapon mount | 2×2 | 1×1 |
  | Shield generator | 2×2 | 2×1 |

  Interiors are redone at the new sizes. Stats are unchanged.
- **Build anywhere:**
  - The starter frame is an open yard of 24 × 14 cells, and the part cap goes from 20 to 40.
  - The hull is traced from whatever is built.
  - The camera fits the ship (at least a 14 × 8 view) and never moves on its own while you build. Fit reframes the ship as it grows.
  - You can pan anywhere in the yard and zoom out to all of it. Its edge is dashed.
- **Automatic doors** (`joins()` in `src/sim/builder.js`):
  - Two rooms that share a wall get one doorway in its middle (the left or upper of two middle cells).
  - Corridors side by side open into each other and count as one room, so a room beside a run of corridor gets one doorway per side.
  - An airlock gets a hatch in the middle of each side that faces space.
  - Door sockets are gone from the data.
- **Facing space** (`facesSpace` in `data/modules.json`): an engine's exhaust and a gun's barrel get no doorway and must face space.
  - Otherwise the layout line fails ("Engine exhaust blocked", "Move Engine at (7, 6) so its exhaust faces space"). The ship still saves.
  - Space is outside the ship, but a one-cell notch with parts on three sides is hull. The checklist and the hull drawing use the same test, so a blocked nozzle is never drawn firing.
- **Touch:** cells are about 24 px with a starter ship in view on the cover screen. CLAUDE.md's 3D rule now reads: nothing lands from one tap, and cells are at least 22 px at the default view (tested).
- **Art at the new scale:**
  - Walls, rim, hover height, nozzles, barrels, collars, hull height and nose are rescaled.
  - All 12 parts' 3D fittings, roofs and drawer icons are redrawn.
  - The grid has a line every cell and a heavier one every 4. Drawer icons are drawn at the size they show.
- **Saves:** `SAVE_VERSION` 3. Every slot's ship and build log move to the fine grid, part for part: twice the coordinates, 5 right and 3 down (`src/sim/regrid.js`). Converted logs still replay.
- **Codes:** `BLUEPRINT_VERSION` 2. Version 1 codes (M5) open through the same conversion.
- **Fixed on the way:**
  - **Fit on the unfolded screen.** The yard clamp centred the yard whenever it fitted the view, so Fit never hid. Now a yard smaller than the view only has to stay on screen.
  - **Fit after the ship grows.** Fit didn't reappear because the off-fit test compared screen offsets. It now compares where the fit's middle lands.
  - **Fit near the yard's edge.** A ship by the edge had a fitted view hanging past it, so Fit could never be reached. The fit is now kept inside the yard too.
  - **Comparing a build log with its ship.** It compared JSON text, so key order mattered. It now compares the parts.
- **Tests:** 201 in all, up from 194. New ones cover:
  - joins, merged corridors and hatches
  - the facing rule and the space test
  - the 2-to-3 save migration, and old logs replaying
  - version 1 codes
  - the ship-fitted camera, the clamp and the 22 px floor

### Decisions made this session

- **Yard size and part cap (24 × 14, 40 parts):** my numbers, not Evan's.
- **Old ships convert part for part, not repacked.** Refilling the gaps with corridors would rejoin most of a ship, but it means rewriting build logs with new part ids. That is risky in a migration that can never change once shipped.
- **A blocked exhaust or barrel is a checklist problem, not a refused placement,** like a part not joined.
- **The view never moves by itself while building.** Fit is one tap away.
- **A corridor can be one tile wide,** so a chokepoint is the player's call (ROADMAP §4.1).

### Verified here (headless Chromium with scripted touch, not a phone)

- **At all three sizes (821×283, 905×370 and 960×825):**
  - The touch build, 14 checks: stray taps, undo and redo, the card's "exhaust must face space", Fit after building, pinch, twist, the Hull view, and a ship in the yard's corner opening fitted.
  - M5's checks on the fine grid, 34: two-device code copy, bad codes, replay through Hull, slots, two-tap delete, reload. Also an M3 save, an M5 save (its replay included) and an M5 code, all coming forward.
- **Offline:** with the server stopped after one visit, an M5 save converts, and copy, new ship, paste, replay and reload all work from the cache.
- **Frame times** at 4× CPU throttle (headless draws canvas on the CPU, so these are floors):
  - Cover screen: dragging a part 60 fps, pinching and turning 32 fps (M4: 33).
  - Unfolded: 51 and 19 fps.
- **Console:** no errors or warnings.
- **Cell size:** 29.8 px at the middle of the view on the cover screen, about 24 at the edges; 22.2 px at the 821×283 browser-tab size.

### Known issues

- **M5 ships come apart when they convert.** Every part keeps its place and build order, but the smaller parts leave gaps, so most are no longer joined: in M5's example ship, 13 of 14. Rebuild them, or delete them.
- **Small cells with a real finger are untested.** A miss never places anything (it moves the preview), but it may take extra taps. The 821×283 browser-tab size is smaller still.
- **A corridor is one cell,** so a long corridor takes two taps a cell. A drag-to-lay-corridor idea is in ROADMAP §9.
- **Balance:** parts kept their stats while shrinking, and the cap doubled, so a ship can carry more of everything. Nothing is tuned; there is no balance sim yet.
- **The nose goes on whatever reaches furthest forward,** so a cargo hold past the bridge gets it.
- **Rooms are smaller in battle maps now** (one tile per cell): to revisit after M8, as ROADMAP §4.1 already says.
- **Carried over:** the Saves tab scrolls on the cover screen, and two open copies of the game share one save.

### What to test on the phone (Galaxy Z Fold 6)

1. **Update:** tap "Update ready, tap to reload". Your M5 ships are in Saves with every part, but mostly flagged red: they came apart. Delete them or rebuild.
2. **Build anywhere:** on the cover screen, build a ship with the smaller parts somewhere new on the grid. Use both ways: tap a part, then tap the grid twice; and drag from the drawer. Check that nothing lands where you didn't mean it to. Note how often a cell takes a second try.
3. **Corridors and doors:** lay a run of corridor beside a room. The corridors should open into each other, and the room should get one doorway on that side.
4. **Facing space:** put a part right behind an engine. The chip should say the exhaust is blocked; move the part away.
5. **Fit:** after the ship grows, Fit appears. Tap it. Pinch out to see the whole yard and its dashed edge.
6. **Unfolded:** repeat steps 2 and 5 on the big screen.
7. **Hull view and replay** on the new ship.

### Next session

**Evan's call:** build on the Fold with M5b.
- If it's good, tick M5b in ROADMAP.md, and Gate 1 is next: does building make him want to keep going?
- If small cells are fiddly, the levers are a closer default view, a part held above the finger while dragging, or laying corridors by dragging (ROADMAP §9).

## M5 Blueprints, saves and replays (2026-10-11)

**Status:** done. Done when is met: a code from one device rebuilds the identical ship on another, and a broken code shows a message. In headless Chromium, two browser profiles with separate storage stood in for two devices:
- A code copied on the first rebuilt the same ship on the second: same parts, places, turns and build order.
- Damaged codes, random text and a save code each got their own message, and added nothing.

The ROADMAP.md box is ticked. Evan asked to keep building after M4.

### Shipped

- **Blueprint codes** (`src/core/blueprint.js`, pure and tested):
  - A code looks like `wtb.1.<payload>.<checksum>`.
  - The payload is base64url bytes: the frame, the part types used, and then each part in build order as three bytes.
  - Decoding rebuilds the ship through the placement rules, so a code can only make a ship the builder could make.
  - Spaces and line breaks from chat apps are ignored.
  - Every way a code can be wrong has its own message:
    - empty, or not a blueprint
    - a save code pasted by mistake
    - incomplete
    - damaged (checksum)
    - from a newer version
    - unreadable
    - an unknown hull, or unknown parts (named)
    - parts that don't fit together (the first reason)
  - A full starter ship is about 174 characters.
- **Build log:**
  - The session keeps every command that built the ship from an empty frame.
  - Undo takes the last command off and redo puts it back. A randomized 400-step test checks that the log always replays to the ship, ids included.
  - `src/sim/replay.js` replays a log step by step, and repairs a log that doesn't match its ship. Logs over 600 commands are shortened when a ship opens.
- **Ship slots** (`src/sim/builds.js`): up to six ships, each with its name and build log, and one open at a time.
- **`SAVE_VERSION` is now 2.** The migration from 1 moves the old ship into slot 1, numbered in build order, with a log that builds it part by part. A save from before M3 gets no slots. M12's bump becomes 3; ROADMAP.md is updated.
- **Saves tab** (the drawer's third tab):
  - **This ship:** its name, part count and readiness, with Copy code and Replay build.
    - Copy puts the code on the clipboard and also shows it, selected, in case the browser refuses.
  - **Saved ships:** tap one to open it. New ship adds an empty one.
  - **From a code:** paste a code and open it as a new ship. Its messages show right under the box.
  - **Delete this ship:** takes two taps.
- **Replay:**
  - The open ship rebuilds itself on the board, one step at a time. Each step takes 0.06 to 0.32 seconds: about 5 seconds for the 14-part starter ship, about 9 for 30 to 150 steps, and up to 36 at the 600-step cap.
  - It works in the plans or the Hull view, and switching between them doesn't stop it.
  - A tap on the board, or Stop replay, ends it.
  - A replay only shows; it changes nothing.
- **Tabs:** the Ship tab's badge moved to the tab's corner so three tabs fit the narrowest drawer.
- **Tests:** 194 in all, 20 new: the codec (with a 2,000-mutation fuzz), the build log and replay, the slots and the v1 to v2 migration.

### Decisions made this session

- **"Save slots" means ships kept in the builder,** not campaign saves. There is no campaign until M12.
- **Codes spell out part ids** ("reactor", not an index or glyph), so a code still reads after content is added or reordered. That's why a code is about 174 characters, not 100.
- **A pasted code opens as a new ship,** so it never overwrites the one being built.
- **Undo history doesn't survive switching slots.** The build log does, and so does the replay.
- **The replay keeps the camera still,** so every step draws sharp; moving frames are drawn at half resolution.
- **Slot names are fixed** ("Ship 1", "Ship 2"...). There's no renaming yet.

### Verified here (headless Chromium with scripted touch, not a phone)

- **At all three sizes** (821×283, 905×370 and 960×825), 30 checks:
  - Copy shows and copies a code.
  - The second "device" rebuilds the identical ship.
  - Bad codes get messages and add nothing.
  - The replay plays, carries on through Hull and back, and stops on a tap.
  - New ship, switching and two-tap delete work.
  - All six slots full: New ship is disabled and pasting is refused.
  - Reload keeps the slots.
  - An M3 save (version 1) migrates in the app.
- **Offline:** with the server stopped after one visit, an M3 save migrates, and copy, new ship, paste, replay and reload all work from the cache.
- **Regression:** the M4 touch build and the 3D board checks still pass.
- **Console:** no errors or warnings.

### Known issues

- **Some old ships can't replay fully.** An M3-era ship with parts in the cut corners stops its replay at the first such part, with a message, because that placement isn't allowed any more.
- **The Saves tab scrolls on the cover screen:** paste and delete sit below the fold.
- **Carried over:** two open copies of the game share one save.

### What to test on the phone (Galaxy Z Fold 6)

1. **Update:** tap "Update ready, tap to reload". Your current ship should be slot 1 in the Saves tab.
2. **Two devices:** in Saves, tap Copy code. Paste it into Space Wrecked on another device (a computer's browser works) with Open the code. Expect the same ship, ready to launch.
3. **Broken code:** paste half a code. Expect a message, and no new ship.
4. **Replay:** tap Replay build, and try it with Hull on too. A tap on the board stops it.
5. **Slots:** make a new ship, switch between ships, and delete one (two taps). Then swipe the app away, reopen it, and check they're all still there.

### Next session

**Gate 1 is next, and it's Evan's call:** build on the Fold for 15 minutes and decide whether to keep going. If yes, record that here and start Phase 2 with M6 (ship to battle map). If not, fix the builder first.

## M4 Parts art and auto-hull, in 3D (2026-10-11)

**Status:** done. Evan ran it on the Fold and reported "It's good", so Done when is met and the ROADMAP.md box is ticked. Done when has two halves:
- **"Any layout looks like a ship from outside":** met here. The Hull view shows any layout as a solid ship, and the builder shows it as a blueprint with a hull rim, nose and engines.
- **"Zooming stays smooth":** met on the Fold, per Evan. Headless Chromium draws canvas on the CPU, so the numbers below are only a floor. Evan reported no FPS numbers.

**Direction change.** Mid-milestone, Evan chose 3D: the 3D blueprint look in the builder, and 3D in general. That changes a locked decision. ROADMAP.md §3 records it ("Graphics" was "2D top-down cutaway"). The design-history doc ("Space tactics RPG: brainstorm plan") isn't in the repo, so Evan should note the change there. The rules stay on the 2D grid, and the ship layout is still the boarding map. Only the drawing went 3D.

### Shipped

- **A 3D renderer of our own on canvas, no library** (`src/render/`):
  - `orbit.js`, the camera: project, unproject a finger onto the deck, fit, zoom, pan, twist to turn, clamp.
    - The default view is gentler than the mockup: yaw −11°, pitch 60°, mild perspective.
    - That keeps every cell at least 48 px at the default view on the cover screen (48.8 px). `tests/orbit.test.js` enforces it.
  - `painter.js`:
    - The blueprint is see-through, so it's batched by style: a few dozen canvas calls a frame, plus additive glows and callout labels.
    - Solid views drop back faces and draw back to front.
  - `pick.js`: a tap picks the front-most room under the finger, since rooms stand up from the deck and their front walls cover the deck behind. It checks for the floating part first and falls back to the deck.
- **The blueprint builder** (`shipScene.js`, `props.js`, `blueprintStyles.js`):
  - **Hull:** a rim and nose.
  - **Rooms:** walls with doorways where doors join. Door markers explain the rest: orange for a socket facing a free cell, red for one facing a wall, grey for one facing space.
  - **3D fittings for all 12 parts:** the reactor core, turbines, bunks, tanks, the turret and so on. Any new module type gets fittings drawn from its interior template, with no engine edit.
  - **Building aids:**
    - Free cells show as dashed slots, and the selection is outlined and named.
    - Loose parts and parts off the frame get red dashes.
    - The part being placed floats above its spot, green or red, with drop lines.
- **Hull tracer** (`hull.js`): it works out the outline:
  - slopes (fairings) across corners
  - filled pockets
  - a nose on each run of cells at the front
  - nozzles, barrels and docking collars wherever engines, guns and airlocks face space
  - running lights
- **Hull view** (the Hull button, top right of the board): the ship as a solid, lit model in the yard skin.
  - **Hull:** roof plates tinted per part, a livery stripe, the nose with a window, glowing nozzles, barrels, collars and red and green running lights.
  - **Roof fittings:** the canopy, the reactor dome glow, engine vents, the turret, cargo doors, the med cross, the armory hatch and the shield emitter.
  - **Behind it:** a starfield.
  - **Look only:** taps change nothing, and picking a part goes back to the plans.
- **Ship-shaped starter frame:**
  - `data/frames.json` gains `shape`: 22 of the 28 cells, with the bow and stern corners cut away.
  - Parts can't go in the cut cells.
  - Doors facing them open onto space, and an airlock facing one counts as on the hull edge.
  - The validator checks shapes: row count, characters, and one connected piece.
- **Old saves:** a ship saved with parts in the cut corners loads whole. Those parts get red dashes, and the checklist says "Weapon mount at (6, 0) sticks out of the Starter hull", fix "Move it inside the hull, or remove it". The save format didn't change, so there's no `SAVE_VERSION` bump.
- **The example ship was relaid on purpose for the shape.** `tests/fixtures/example-ship.json` now builds `.QQRR.. / EE+RR+B / EE++++B / ..LAW..`. Tests that pinned the old layout changed with it.
- **Twist to turn:** the gesture recognizer reports the twist between two fingers. Past 10° of twist, the ship turns with the fingers. Fit resets zoom, pan and turn. On a desktop, Q and E turn the view.
- **Frame cost:**
  - While the camera is still, the board is drawn once and reused, so dragging a part redraws only the part.
  - While the camera moves, frames draw at half resolution without the glow halos.
  - 150 ms after the camera stops, the board sharpens.
- **Drawer icons:** 2D blueprint drawings of each part (`parts/blueprint.js`). The part under a finger off the board uses the same drawing at board scale.
- **Removed:** the 2D camera and the placeholder part colors. The palette gained the blueprint tokens and the yard skin (manufacturers are skins).
- **Docs:** ROADMAP.md §3 (the Graphics row), the Art line, §4.1 (frame shapes, auto-hull, twist), the M4 entry and the §8 canvas risk. CLAUDE.md's art and code rules now describe 3D models drawn by our own painters.
- **Tests:** 174 in all, 37 new: hull geometry, the camera (including the 48 px rule), picking, the blueprint scene, the exterior, frame shapes, and the drawer icons.

### Decisions made this session

- **Our own renderer, not a library.** This follows the no-dependency rule, and see-through blueprint lines suit Canvas 2D. The cost: there's no depth buffer, so solid views use the painter's algorithm. If battles outgrow it, three.js (MIT, one vendored file, no build step) is the fallback, with Evan's approval. ROADMAP §8 has it.
- **A gentle default angle** (yaw −11°, pitch 60°) instead of the mockup's −24° and 52°, to keep 48 px cells. A twist reaches any angle.
- **The Hull view is look-only.** Going there puts down the part in hand.
- **One skin for the whole exterior** (yard). Per-manufacturer skins can come with the second manufacturer.
- **Old saves aren't migrated.** Stray parts are flagged, not moved or deleted.
- **The filled interior (the boarding map) waits for M6.**

### Verified here (headless Chromium with scripted touch, not a phone)

- **At all three sizes** (821×283, 905×370 and 960×825), 19 checks each, all passing:
  - The example ship builds by touch with taps and drags.
  - Preview then confirm; stray taps place nothing; undo and redo.
  - A tap on a room's front wall selects that room.
  - Long press opens the card, and the next tap closes it.
  - Pinch zooms, a twist turns, and Fit resets.
  - The Hull view is look-only, and picking a part goes back to the plans.
  - A drag released on other parts places nothing.
- **Old save:** M3's layout loads whole with four parts flagged, and moving one clears its flag.
- **Offline:** the service worker caches the new files (62). With the server stopped, the saved ship loads on the 3D board and the Hull view draws.
- **Console:** no errors or warnings.
- **Frame times with the CPU slowed 4×, in software rendering:**
  - Dragging a part: 60 fps at every size.
  - Pinching and turning: 34 fps on the cover screen, 35 in a folded tab, 17 unfolded (the biggest board).
  - These are a floor, not a forecast: the phone draws on its GPU.

### Known issues

- **Cramped in a folded Chrome tab:** cells at the default view are about 36 px there, under the 48 px rule, because the tab's board is 283 px tall. Zoom in, or use the installed app (49 px).
- **Pinch and turn smoothness on the Fold is unknown** until Evan runs it. If it stutters, the next steps are lower-resolution rough frames and fewer lines. Past that, three.js, with approval.
- **No depth buffer:** at some angles, overlapping solid shapes could draw in the wrong order. I saw none in the views checked.
- **Only the selected part and the part being placed are named.** Long-press any part for its card.
- **Red door markers on a valid ship:** a socket facing a wall shows red even when the ship passes every check, as the red ticks did in M3.
- **Carried over:** two open copies of the game share one save.

### What to test on the phone (Galaxy Z Fold 6)

1. **Update:** open the installed app and tap "Update ready, tap to reload".
2. **Your saved ship:** DEV → Builder. If it had parts in the cut corners (bow and stern corners), they show red dashes and the Ship tab asks you to move them. Nothing should be missing.
3. **Empty frame:** remove parts or start over. The free cells are 22 dashed slots in a ship shape.
4. **Build, folded and unfolded:** build a full ship by dragging and by tap-tap. Watch for mis-taps, especially on far cells and on cells behind a room's front wall.
5. **Camera:**
   - Pinch to zoom, twist two fingers to turn the ship, and pan; then Fit.
   - Turn DEV's FPS overlay on while pinching and turning, and note the fps and ms.
   - This is the "zooming stays smooth" check.
6. **Hull:** tap Hull and turn the ship around: it should read as a solid ship. Then pick a part in the drawer; you should be back on the plans.
7. **Offline:** turn on airplane mode, relaunch, and open the builder.

### Next session

M5, blueprints, saves and replays. First task: the blueprint codec, a versioned base64url code with a checksum that rebuilds the identical ship, and a message (never a crash) for a broken code.

## M3 Flight checklist and stats (2026-10-11)

**Status:** done. Done when is met:
- **Every failing line names its fix.** A test checks this at every stage of building the example ship, with each part removed, for crews of 1, 4 and 9.
- **A failing ship saves but can't launch.** In headless Chromium, a two-part ship survived a reload and an offline relaunch, and Launch stayed locked.

The ROADMAP.md box is ticked. M3 ran in the same session as M0 to M2 because Evan asked for it.

### Shipped

- **Flight checklist** (`src/sim/constraints.js`, pure and tested): six lines. Each one passes, fails with a fix, or waits on another line.
  1. Power: what parts make against what they use.
  2. Thrust against mass, at least the frame's minimum.
  3. Berths for the crew.
  4. Life support for the crew.
  5. Bridge, reactor, engine and airlock on board.
  6. Every part joined to the bridge, and an airlock on the hull edge.
- **Fixes come from the data**, for example "Add Engine (+12 thrust)" or "Add 2 × Crew quarters (+4 berths each)":
  - The fix suggests the part that gives the most of what's missing, the cheapest on a tie.
  - It says how many are needed.
  - The engine count allows for each engine's own mass.
  - The ROADMAP's example works as written: "Life support 2 of 4 crew", fix "Add Life support (+4 crew)".
- **Ship stats** (`shipStats`): power made, used and net, thrust, mass, berths, life support, cargo and hull points.
- **Ship tab in the builder:** the drawer now has Parts and Ship tabs.
  - The Ship tab lists the checklist, each failing line with its fix, then Launch, then the totals.
  - A fix that adds a part is a button. It switches to Parts with that part already picked.
  - The tab's badge counts open checks, or shows a tick when the ship is ready.
- **Launch:**
  - While any line is open it's locked, and a tap says what to fix: "Can't launch: 3 flight checks to fix. Add Reactor (+8 power)."
  - When every line passes, the first tap arms it ("Tap again to launch") and the second launches.
  - It stays pinned to the bottom of the tab when the list scrolls.
- **Chip on the board:** shows the part count and the first fix, or "Ready to launch". The status line announces the moment a ship first passes.
- **The ship is saved after every change.**
  - `SAVE_VERSION` is now 1, with a migration that gives older saves an empty ship slot.
  - A save's ship must be readable (whole numbers, quarter turns, unique ids), or the save is refused as damaged.
  - Importing a save in the dev menu while building replaces the ship on screen.
- **Data:**
  - `data/balance.json` holds `startingCrew: 4`.
  - The starter frame has `minThrustToMass: 0.5`.
  - The validator checks both, and now requires a part for every checklist tag.
- **`npm run ship`** prints the checklist and fails if the ship can't launch.
- **Dev:** the FPS overlay moved to the top right, beside DEV, so it doesn't cover the drawer's tabs.
- **Tests:** 137 in all, 18 new.

### Decisions made this session

- **Six lines instead of the roadmap's five:** berths and life support are separate, so each failing line has exactly one fix.
- **Unchecked lines:** a line that can't be checked yet is "waiting", not failing. Without a bridge, joins can't be checked; the parts line already says "Add Bridge". A waiting line still blocks launch.
- **Crew:** until the campaign has crew (M12 onward), the builder checks against `startingCrew` (4). There's no `tools/sim.js` yet (M11), so there's no sim summary for this first balance number.
- **Thrust minimum of 0.5:**
  - The example ship has 0.80.
  - Take one engine off it and it drops to 0.44, so the fix asks for a second engine.
  - A minimal one-engine ship (about 21 mass) still flies.

  This is a starting value.
- **Launch has nothing to launch into yet.** That's M17. For now it confirms "cleared for launch", and the point is the gate.
- **The ship lives in the game state** and saves with every change. The builder's undo history stays in memory only. M12's save bump becomes 2; ROADMAP.md is updated.

### Verified here (headless Chromium with scripted touch, not a phone)

- **At all three sizes** (821×283, 905×370 and 960×825):
  - An empty ship shows 5 open checks, a locked Launch, and a refusal that names a fix.
  - The "Add Engine" button picks the engine.
  - A two-part ship survives a reload and is stored in a v1 save.
  - Finishing the example ship announces "Every flight check passes", the badge turns to a tick, and Launch takes two taps.
  - Offline, the saved ship loads.
  - Export codes start with `wt.1.`.
  - Importing a v0 code empties the hull.
- **Regressions:** the M2 touch build and the 27 M0 checks still pass.
- **Console:** no errors or warnings.

### Known issues

- **Two open copies of the game share one save.** That means the app and a Chrome tab, or two tabs. The last one to change anything overwrites the other's ship. Keep one open.
- **One ship only:** save slots are M5.
- **Cramped in a folded Chrome tab:** the drawer is 176 px wide there. The checklist wraps and scrolls, while Launch stays pinned. The installed app has more room.
- **Ships built before this update weren't saved**, so the builder starts empty after it.

### What to test on the phone (Galaxy Z Fold 6)

1. **Update:** open the installed app and tap "Update ready, tap to reload". DEV → Status should show a new cache.
2. **Locked Launch:** DEV → Builder, then the Ship tab. Expect a badge of 5 and a locked Launch. Tap Launch: the status line should name a fix.
3. **Fix buttons:** tap a fix button, for example "Add Engine (+12 thrust)". Expect the Parts tab with that part picked.
4. **Failing ship saves:** build part of a ship, swipe the app away in recents, reopen it, and go back to the builder. The ship should still be there, with Launch still locked.
5. **Full ship:** finish a full ship. Expect "Every flight check passes" and a tick on the badge. Then Launch: one tap shows "Tap again to launch", a second shows "cleared for launch".
6. **Offline:** turn on airplane mode and relaunch. The ship should load.
7. **Export:** DEV → Export. The code should start with `wt.1.`.
8. **Readability:** check the Ship tab folded and unfolded.

### Next session

M4, parts art and auto-hull. First, Evan decides the open question: give the starter frame a ship shape (a cell mask, so a packed hull doesn't trace to a rounded brick)? Then the first task: SVG functions for the 12 parts in one manufacturer style, rasterized once per zoom level and cached.

## M2 Touch builder (2026-10-11)

**Status:** done. Evan ran it on the Fold and reported "All works", so Done when is met: a full starter ship built folded and unfolded, without mis-taps, at 60 fps while dragging. The ROADMAP.md box is ticked. M2 ran in the same session as M0 and M1 because Evan asked for it.

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

### On the phone (Galaxy Z Fold 6, 2026-10-11)

- Evan: "All works." No FPS figures were written down.
- Evan's note: the parts don't look like a ship. That's expected for now: M2 draws placeholder boxes, and M4 draws the parts and traces the hull.

### Known issues

- The parts are boxes, and the starter frame is a plain rectangle. M4's hull tracer follows the placed parts, so a fully packed 7×4 frame would trace to a rounded rectangle. Open question for Evan before M4: give the starter frame a ship shape (a cell mask in `frames.json`)?
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

M3, flight checklist and stats, unless Evan swaps it with M4 (neither depends on the other). M3's first task: `src/sim/constraints.js`, with the five checklist lines from ROADMAP §4.1 and the fix each one names, tested, before any UI. That needs a minimum thrust-to-mass on frames and a crew count (a `data/balance.json` number until there's a crew).

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
