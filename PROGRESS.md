# PROGRESS.md

Newest entry first.

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
