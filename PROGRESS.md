# PROGRESS.md

Newest entry first.

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
- **Against the corvette, Bastion's start ship loses as many parts as the Yard's** (0.96 an approach against 0.93): it evades 21 against 30, and the corvette's guns now sit in tougher parts too.
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
