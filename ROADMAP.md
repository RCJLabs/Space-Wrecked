# ROADMAP.md: Space Wrecked

**One-liner:** Build a ship from scrap, run from whoever is hunting you, and find a world to call home. The ship you build is the map you defend: when you are boarded, the fight happens room by room in your own layout, in XCOM-style squad battles.

**Tone:** Wry and blue-collar (Evan's call, 2026-10-12, before M14). Working people doing dirty jobs, with dry humour: the company, the bills and the shift whistle are the background noise, not the villains' monologues.

**Platform:** Browser game on GitHub Pages, installable as a PWA, published as a TWA on Google Play (RCJ Labs convention). Landscape only. Offline-first: no backend and no network calls. Android and web; iPhone is not a target. A Capacitor build comes later, for a possible paid version.

**Art:** Procedural, drawn in code. The game world is 3D, drawn by the game's own small renderer on canvas: a glowing blueprint in the builder, solid ships everywhere else. Menus, panels and icons are SVG. The only image files are WebP portraits, scene illustrations and store art. They are generated in Base44 during development, edited by hand, and logged in `assets/LOG.md`. Since M34 the scenes behind the title, the lift-off and the landing, and the companions' busts, are drawn in code as well (Evan's pick); store art is what Base44 is left for.

**Design history:** the "Space tactics RPG: brainstorm plan" doc. Where the two differ, this file wins.

---

## 1. Pillars and laws

**Pillars, in priority order:**

1. **BUILD.** The ship builder is the selling point. It has to be satisfying on a phone with nothing else around it.
2. **FIGHT.** XCOM-style squad battles, fought mostly inside ship layouts.
3. **FLEE AND SETTLE.** The journey: a pursuer, sectors to cross, a world to choose, a colony to hold.

**Laws (test every feature against these):**

- **Law 1: Every module changes something outside the builder.** That can be the battle map, the approach phase, travel range, crew or the colony. A module that only changes a number on the builder screen gets cut. Styling (M23f) isn't a module: wings, fins, antennas, lights, hull plates, paint and trim change how the ship looks and nothing else, never a stat, a rule or the boarding map, so this law doesn't cut them (Evan's call, 2026-10-13).
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

**Backgrounds** (M30, `data/backgrounds.json`): New game opens a pick of three before the captain's screen. Each has its own start, its own district for act 1 (`data/districts.json`) and its own pursuer, whose fighters, ships, words and payment terms (or none) follow the campaign through all three acts. §5 has the three as built.

**Launch** (M17, `src/sim/launch.js`): once every flight check passes, Launch at the hangar ends act 1. The ship lifts off, and the campaign moves on to act 2 with its ship, crew, credits, parts and heat. The hangar's job board, shop, payments and raids stay behind. A raid at the door doesn't stop it: the pursuer finds an empty hangar. From M19 act 2's home is the sector map (§4.7): the run crosses the act's sectors by jumps, eating supplies (§4.6). Since M20 the nodes along the way hold events: derelicts, distress calls, traders and hazards. Since M21 some hold hostile ships, met in the approach phase (§4.2), and since M22 a boarding either way is fought out (§4.3). Since M25, past the last sector's jump point lies a system past the charts with three worlds (§4.7): a day's survey from orbit shows what one is worth, and Settle here at one ends act 2, surveyed or not. The ship lands, and since M26 act 3's home is the colony on that world.

Act length targets (proposed, to check in play): act 1 under an hour, act 2 the longest, act 3 open-ended.

**Settling:** the ship stays flyable for expeditions. Founding the colony asks you to donate modules, such as a reactor or hydroponics, which become its first buildings.

**The colony** (M26, `src/sim/colony.js`, pure; `data/colony.json`): act 3's home. The crew lives there, so from the landing on the ship's flight checks count only who is aboard: nobody while the ship is home, the squad on a trip (M28).
- **Giving a part:** two taps on one of the ship's parts, and it comes off the ship to stand at the colony as the building of its kind: a reactor a power plant, quarters a barracks, life support an air plant, a hold a storehouse, a med bay an infirmary, a gun an emplacement, and so on (`data/colony.json`). What a building gives is its part's own numbers. The bridge, engines, corridors and airlocks stay aboard. Never a wrecked part, never one the ship can't fly without (every flight check passing, counting nobody aboard), and never with no room on the grid; each refusal says why.
- **The grid:** 20 × 12 cells on the world's ground (`src/sim/grid.js`, placed by the builder's rules), the ship landed off its west edge, a cell of path round every building.
- **Building by hand** (M27, `src/sim/colonyBuild.js`): a farm or a mine built from materials, a spare part from the hold set down, or one of the ship's parts given, each where the player puts it: a ghost first, in the first spot that fits (column by column from the ship's edge), moved by a tap on the grid and turned, then a second tap builds it. Any building moves and turns the same way, keeping its place in the order built, and comes down in two taps: a part goes back into the hold, a farm or a mine gives back its materials. Each refusal says why.
- **Farms and mines** (M27, `data/colony.json` builds): 10 materials each, 2 × 2, no power. A farm grows soil + water food a day and a mine digs ore materials a day, each at least 1: the world's numbers (M25) at work. A colony lands with 20 materials, salvaged from the landing.
- **Days** (M27, `src/sim/days.js`): act 3 counts days from the landing, and Next day passes one in two taps. The farms and mines make; the crew eats a jump's food each (food is the run's supplies); a fed crew rests, healing a day's regroup and a powered infirmary's heal (and a medic's, as on the run), and short of food everyone goes hungry, as on a hungry jump, never below 1. Food and materials are each kept up to the stores, the landed ship's holds and the powered storehouses; the rest is lost. Since M28 the days also pass while the ship is away, one by one as it flies (Trips, below).
- **A solar array and a shelter** (M28, `data/colony.json` builds): built from materials by hand, as farms and mines are, 2 × 2 each. The array (15 materials) makes 3 power; the shelter (10) beds and breathes for two and takes 1 power. A build either makes (food, materials) or gives (power, beds, air).
- **What it gives:** power from its power plants and, while the ship is home, from the landed ship (what its reactors make beyond its own parts' use), taken by the buildings in the order built, each while enough is left; one it doesn't reach is dark. Beds and air from the powered quarters, bunks, life support and shelters, one each a crew member; whoever goes without sleeps aboard the landed ship. A powered infirmary heals a day at a time (since M28, one opening heals nobody at once). Storehouses keep food and materials (M27). Since M29 the defenses fight raids (below): a powered gun emplacement or flak tower fires once at a raid's lander as it comes down, a cannon emplacement twice (`shots`, `data/colony.json`); a powered shield dome or shield array gives the defenders 1 armor, and a powered armory 10 aim.
- **Refits** (M27): construction mode on the landed ship with the parts on hand, as at a station, so quarters that hold the ship together can be freed and a part taken down can go back aboard. A ship refitted past flying shows it in its flight checks, and its power going short darkens the buildings that took it. Since M28 those checks count a full squad aboard (`squadSize`, or the whole crew if fewer): what a trip needs.
- **Trips** (M28, `src/sim/expeditions.js`, pure; `data/expeditions.json`):
  - **The places:** three within reach at a time, rolled from the campaign's RNG: derelicts, wreck fields, ore rocks and the system's other worlds, each 1 to 3 days away. Squatters hold half the derelicts. A new list comes after each trip.
  - **Flying out:** a trip takes a place and a squad of 1 to `squadSize`, and flies only when the flight checks pass with the squad aboard (berths and air for each). Two taps on Fly out.
  - **The days away** pass at the colony one by one. The colony runs on its own power, and whoever is home without a bed and air doesn't rest. The squad aboard heals what the ship's med bay heals, as on a jump. Food is one store, the ship's holds counted.
  - **At the place:** an event like the run's (`data/events.json`, of the place's kind) giving food, materials or parts, its wounds only on the squad. Or the squatters' derelict, boarded in a fight on her map (§4.3) for 2 of her parts and 4 to 8 materials, or left alone.
  - **Fly home** passes the days back, and the ship lands.
  - Nothing is built, moved, given or refitted while the ship is away.
- **Raids** (M29, `src/sim/raids.js` and `colonyMap.js`, pure; the numbers in `data/balance.json`, the pursuer's words and raiders for the colony in `data/backgrounds.json`). §4.4 has heat at the colony.
  - **Found:** at each day's end with no raid coming, the pursuer may find the colony, at odds by heat's level and how far the colony lies from the lanes. Found, its lander comes down 3 days later (`raidWarning`), counted down on the colony screen.
  - **The landing:** on its day the raid is down, and Next day, Fly out and Fly on wait until it is faced. Defend, two taps: the first says what fires at the lander, at what odds, and who fights. Each powered defense fires its shots at 50% (`landingHit`), and each hit is a raider fewer of the pursuer's party, the last first: Con-Reg's four (an agent, a heavy, an agent and a guard), and since M30 the Fleet Provost's three or the Hallorans' five: since M32 an MP, a Provost cadet and an MP, and three collectors and two enforcers.
  - **The fight** on the colony's grid (`colonyMap.js`), a tile a cell: open ground, a farm's fields half cover and every other building full cover. The crew at home starts by the landed ship's edge (the 3 west columns) and the raiders at the far edge, pressing on as at the hangar. A powered shield gives each defender 1 armor (`raidShieldArmor`), a powered armory 10 aim (`raidArmoryAim`).
  - **Afterwards,** won or lost, heat falls to 40 (`heatAfterRaid`), or stays if under it. Lost, the raiders take half the food, half the materials and the dearest part in the hold. Downed crew come home hurt, as from any fight.
  - **The ship away:** a raid landing during a leg stops it that day. Those at home face it, the squad doesn't fight, and Fly on flies the rest. With nobody home, the landing's hits are all the colony has: it holds if they stop every raider, and is lost without a fight if not.

---

## 3. Locked decisions

| Topic | Decision |
| --- | --- |
| Spine | Ship-first sandbox captain; squad battles matter too |
| Structure | Expeditions from a persistent home; the home moves from hangar to ship to colony. From M38d the run goes on past the first colony: the ship flies on through new systems and founds more colonies, each a port that runs itself with its own citizens (Evan's call, 2026-10-18) |
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
- **Hull frames** set the build area and the part cap. The starter frame is an open yard of 24 × 14 cells holding up to 40 parts, nose to the right. The ship can go anywhere in it, and the hull is traced from whatever is built. A typical starter ship is 10 × 5 to 14 × 8 cells, so its battle map fits one phone screen at 48-pixel tiles; bigger ships pan. Since M39 a shipyard sells three more, each with a trait (the courier, the gunship and the freighter), and the ship moves over with its parts; two more, a patrol hull and a small-craft hull, are for enemies.
- **Frame shapes:** a frame can still cut cells out of its rectangle, for a special hull. The starter frame had a ship-shaped outline from M4 to M5b; it is open now.
- **Module definitions** (`data/modules.json`) hold:
  - id, name, manufacturer, size in cells, and whether it rotates
  - for a maker's version of a part (M23g), its base part (`base`): it holds only its own id, maker, name, price and the stats it changes, and takes everything else from its base, so it has the same footprint, interior, fittings and icon
  - the drawer's category it sits in (M23e): command, power, engines, weapons, defense, crew, cargo or utility, in that order (the file's `categories`)
  - the side that must face space, if any: an engine's exhaust, a gun's barrel, a point defense turret
  - stats: power, mass, thrust, crew berths, life support, cargo, hit points
  - tags such as bridge, reactor, engine, airlock or weapon mount
  - what it does in an approach (M23e): a gun's `damage` a hit, a shield's strength (`shield`), a point defense turret's `intercept`; and a med bay's `heal`
  - an interior template at tile resolution: walls, floor, cover props, consoles
  - cost

  The base parts come first in the file: the flight checklist's fixes name the first part that gives what is short, so act 1's goal and generated ships ask for an Engine, not a variant of one. Makers' versions come after them all. Where the game asks for a part (act 1's goal, the shop's "needed" lines, the checklist's fixes), any maker's version of it counts.
- **Manufacturers** (`data/manufacturers.json`, M23g and M31): the Yard's standard parts, and three makers' versions of them:
  - **Bastion Arms** (M23g), tough and heavy: half again the hit points, a quarter more mass (at least 1) and about a tenth more money, every part. Gunmetal fittings, orange chevrons, amber on the plans.
  - **Kestrel Dynamics** (M31), light and dear: about a third less mass, half the hit points and a fifth more money, for every part that weighs 2 or more but the reactor (the four that weigh 1 can't get lighter in whole numbers, and at half the hit points one gun hit disabled any ship with its reactor). Pearl fittings, coral stripes, violet flames, rose on the plans.
  - **Scrapline** (M31), cheap and power-hungry: about a third off the money and a quarter fewer hit points, every part; each part that draws power draws 1 more, and a reactor makes 1 less. Rust fittings, bare patches, green flames, lime on the plans.

  A maker has a name, a short name for the drawer, a line for its parts' cards and a mark on its parts' roofs; its colors are a skin in `palette.js`: the fittings its parts wear outside, under the ship's paint, and its line on the plans and the drawer's icons. Enemy presets roll a maker for each part (`makers` in `data/ships.json`), each kept only while the ship still passes its flight checklist. The patrol's corvettes and the Fleet frigate carry Bastion's for most of their parts, and Con-Reg's gunship, the Provost cutter and the Halloran yacht for about half; the pirates' cutters and the Hallorans' runner carry Kestrel's, and the derelict haulers Scrapline's, for most of the parts their maker makes.
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
- **Auto-hull:** trace the outline of the occupied cells, slope the corners between parts (fairings), and wrap it in the ship's hull style (`data/hulls.json`, M23d): Rounded (rounded corners, a rounded shoulder, a bullet nose) or Plated (cut corners, a stepped armor shoulder, panel seams on the roof, a blunt prow). The hull stands about half a cell out from the rooms, so its curves never cut into one, with a nose on every front. Nozzles, gun barrels and docking collars go where engines, guns and airlocks face space, set on the hull's skin. The player picks a ship's style in the builder; enemy ships roll one with their seed. The builder shows the hull as the blueprint's rim; outside the builder it is raised into a solid hull in the ship's paint, each part's fittings in its maker's skin (M23g).
- **Blueprint codes** are versioned, compact (base64url) and carry a checksum. A bad code fails with a message, never a crash.
- **Build replay:** every placement is a command, and replaying the command list plays back a timelapse.
- **Construction mode** (M13): in a campaign, the builder works on the campaign's ship with the parts the campaign has. A part goes on only while one is on hand, and one taken off goes back, undo and redo included. The palette shows only the parts on hand, with how many. A checklist fix whose part isn't on hand says so instead of picking it. Every change is saved through the campaign at once.
- **Refits on the run** (M23h): at a station, the ship's panel on the sector map is Refit, which opens construction mode with the parts on hand: found at nodes, stripped in boardings or left from act 1. Map goes back to the chart. A refit is free, and only at a station (`campaign.js` refitShip; anywhere else the sim refuses one). A part an approach wrecked stays aboard until the station repairs it: it moves and turns with its damage, the plans cross it out, and Delete leaves it on. The ship can't jump from a station while a flight check fails, and the chart says which. Supplies past what the holds take after a refit stay behind at the next jump, which says so before it is made.
- **The Parts drawer** (M23e): one category at a time or all, picked from a sheet that a 48 px button opens, each category with how many parts it holds; a size filter (any, small, medium, large) a tap a step. All lists the parts by category, the base part first, each maker's version beside it (M23g). The sheet's first tiles pick a maker, any or one of the four, and keep it open; a category, on a row of its own below them, closes it, and the picker names the maker picked. In construction mode only the parts on hand show, and the counts follow.
- **Styling** (M23f, `data/styling.json`): pieces that change how a ship looks and nothing else (§1, Law 1), kept apart from its rooms, with its paint and trim (six of each):
  - wings (swept and delta wings, a tail fin, a spoiler), gear (an antenna, a dish, a floodlight, a light strip, an armor plate) and sculpt (a wedge, a long wedge, a curve);
  - a piece goes on open cells beside the hull, its root all along a room's side, never ahead of the bow or in the cell in front of an exhaust, a barrel or a hatch, and at most the frame's `maxStyling` (24) a ship;
  - a wedge or a curve has a room all along one leg and its slope to open space; the hull's skin wraps it in the ship's style;
  - a room change that leaves a piece nothing to hold it takes the piece off in the same step;
  - the Look tab places them: the Hull button turns the board outside, and the drawer's first tab picks from wings, gear, sculpt, paint, trim and the hull's style. Pieces go on in two taps, or a drag, fitted to the hull where the finger is; paint, trim and style take one tap. Pieces are free, in construction mode too;
  - enemy presets wear their side's look (`look` in `data/ships.json`): paint, trim and pieces put on at random where they fit, in mirrored pairs on a symmetric ship, from a roll of their own.
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
- **As built in M21** (`src/sim/approach.js`, pure; the numbers in `data/balance.json`, each preset's tactics and scrap in `data/ships.json`):
  - **Who goes first:** each round the other ship's order is worked out from its tactics and shown first, and then the player gives one. The player answers it; the other ship never sees the player's order.
  - **The odds,** each kept within 5 to 95 (`chanceMin`, `chanceMax`):
    - a gun hits at 70 (`gunnery`) less the target's evasion and its point defense, and 20 less again (`evadeBonus`) while the target evades. Point defense (M23e) is each working turret's cut, 10, up to 20 in all (`interceptMax`);
    - evasion is 25 (`evasionPerThrust`) times the ship's thrust for its mass, from the engines still working;
    - fleeing works at 35% (`fleeChance`) and closing to board at 30% (`closeChance`), each moved 50 points for every point of thrust for mass the ship has over the other.
  - **A round** goes flights first (the player's first), then both volleys at once, each from the ship as it stood when the round began, then boardings. So a ship disabled by the volleys can't close.
  - **Hits:** every working gun fires once, in the order the guns were fitted. A hit does its gun's damage, less what the target's shields still hold this round (each working shield's strength, added up), to the module of the kind aimed at with the fewest hit points left. Since M23e the damage and the strength are each part's own, in `data/modules.json`: a weapon mount 15 and a cannon 30; a shield generator 10 and a shield array 25. A mount's full hit wrecks an engine, a gun or a shield generator, and a reactor takes two, or one cannon hit. A cannon's hit still wrecks a gun or an engine through a generator. Point defense turrets are shot at with the guns. A roll says whether a wrecked room burns, is open to vacuum or is full of rubble.
  - **Outcomes:** a ship with no working reactor or no working engine is disabled, and the other boards it; both disabled, they drift apart. A ship whose last reactor is wrecked blows up 30 times in 100 (`blowChance`), which leaves only scrap. The player's ship never blows. After 3 rounds (`approachRounds`) the ships part.
  - **Tactics** (data): what a ship fires at, first choice first; the round it closes to board from; and how much of its guns', engines', shields' and reactors' hit points it can lose before it runs. The pirate cutter fires at engines, then guns, closes from round 2 and runs at half lost. The patrol corvette fires at guns, then the reactor, never closes, and runs at 70% lost.
  - **The player's Board** can be given since M22 whenever the ship's engines work, at its odds: 49% for the start ship against the cutter in the checks (preset seed 1). In M21 it was shown but refused, because the stand-in that settled boardings couldn't tell a crew boarding a stronger ship from one boarding a wreck.
  - **Boardings** (M22, `src/sim/encounter.js`): an approach that ends in a boarding, either way, ends in a fight that is due (§4.3). A ship the player disabled or grappled can be boarded (Board her) or left (Leave her), each two taps. A ship boarding the player's has to be fought off. A ship that blew up leaves only its scrap: cutter 10 to 25 credits, corvette 20 to 40. M21's stand-ins are gone: a part stripped by a roll, plus the scrap, for boarding; what a lost raid takes, for being boarded.
  - **Damage stays.** The player's wrecked modules carry into the next approach and into the ship's boarding map (Law 2) until a station repairs them (§4.6). When an approach leaves no reactor or no engine working, the crew gets the first one going again, so the ship can always fly on.
  - **The screen:** since M38b both ships are seen whole from outside, side by side and facing each other, each scarred where she was hit and showing a wrecked part's hazard on her hull (M21 to M38 drew them as their boarding maps). It shows the other ship's order with its odds, the orders along the bottom with theirs (two taps to give one; a Fire order's first tap marks the parts it aims at), and the last round, roll by roll. A round given plays out, its shots flying from the guns and its lines coming as they land. Every chance is shown before its roll, a last reactor's blow-up included. Since M22, an approach that ends in a boarding shows her crew and what winning and losing come to, with Board her and Leave her, or Fight them off, in the orders' place, and the two ships come together, grappled.
  - **Balance** (`tools/approach.js`, a test captain that looks ahead, 300 approaches for each row, M21): the launched start ship gets away about 60% of the time and is boarded about 18%. A weapon mount turns the cutter into a win (69% boarded, 17% boarded by it). A shield cuts the cutter's boardings from 18% to 12% and the corvette's from 19% to 3%. An engine cuts both to 7 or 8%. With or without a part, the start ship never boards a corvette: it is one to run from.
  - **Balance since M23e,** with the presets carrying new parts (the cutter an engine and light engines, the corvette sometimes a pair of cannons): the start ship scores −11 against the cutter and −22 against the corvette (wins less losses in every 100). Each part added by itself, the change against the cutter and against the corvette:
    - gun +75 and +2, cannon +84 and +12;
    - shield +12 and +11, shield array +18 and +15, point defense +6 and +11 (losses 22% to 17%, and to 11%);
    - engine +29 and +13, light engine +26 and +11, heavy engine +1 and +18 (the cutter can no longer close: 87% part);
    - small reactor −1 and +9: no gain against the cutter, which never fires at reactors, and 9 fewer boardings in 100 against the corvette.
  - **The pursuer's hunters** (M24, §4.4) fly two presets of their own, in Con-Reg's graphite and amber, each firing at engines, then guns, and closing from round 2:
    - the **repo tug** (a crew of 3; a gun, an armory, an engine and two light engines) runs at half lost. Blown up it leaves 15 to 30 credits, and boarded, 1 part. Its party is Con-Reg's recovery team: two agents and a heavy;
    - the **gunship** (a crew of 4; two guns and sometimes a cannon, a shield, two engines and two reactors, about half its parts Bastion's) runs at 70% lost: 25 to 45 credits, or 2 parts. Its party is the task force: two agents, a heavy and a guard.
  - **The other pursuers' hunters** (M30, `data/ships.json`) fly the same two builds, with their own looks and parties:
    - the Fleet Provost's **Provost cutter** (the tug's build, half its parts Bastion's; two MPs and a fleet rating) and **Fleet frigate** (the gunship's, 80% Bastion's; three MPs), in navy and white;
    - the Hallorans' **runner** (the tug's; two collectors and an enforcer) and armed **yacht** (the gunship's, half Bastion's; four collectors and an enforcer), in slate or bone with violet.

    Law 1 holds against all four (`tests/approach.test.js`). PROGRESS.md's M30 entry has their boardings (`tools/sim.js --boardings`): the start crew beats the Provost's parties less often than Con-Reg's, and the runner's more often.
  - **The Fleet's patrols** (M33, §4.9): the patrol corvette is the Fleet's. A crew friendly or trusted with the Fleet is waved through: no approach, and the node is done. A crew hostile with it is fired on: the corvette's guns get a volley before the first round (`openingVolley`), at the first kind of part its tactics aim at that the crew's ship has working, the crew not yet evading. Neutral or cold, the approach is as before. The approach screen gives the Fleet's words either way, and the jump plan says beforehand how the patrol ahead will greet the ship.
  - **Balance against them** (`tools/approach.js`, 300 a row, M24): the start ship scores −20 against the tug (gets away 64%, boarded 20%) and −13 against the gunship (65% and 13%). A gun makes the tug +15 and a cannon +31. The gunship can only be run from: its shield takes 10 off each round's hits, leaving the start ship's one gun 5 a hit, too little to disable it in three rounds (firing at its engines and at its guns came out the same over 400 approaches). A heavy engine gets away from it 90% of the time. Boarding fights (`tools/sim.js --boardings`, 125 a row): the start crew beats the tug's party 38% of the time at home and 46% aboard her, and the gunship's 9% and 14%.

### 4.3 Squad battles

- **Maps:** a ship layout converted by `src/sim/mapFromShip.js`, or a planet map built from templates. A ship's map is one tile per builder cell (`tilesPerCell`), with a tile of space around it; the same ship always converts to the identical map (M6, tested against a golden map). A planet map (M14, `src/sim/gen/site.js`) is a job site's template turned over by the seed and furnished, with no space around it; §4.7 has how. The hangar map for a raid (M15, `src/sim/hangarMap.js`) is the ship's own map standing on the hangar's deck, with 2 cells of deck around it; in the hangar an airlock's hatch is a door onto the deck.
- **Tiles** come from each room's interior template: floor, half cover, full cover, machinery, console (objective), airlock floor. Outside the rooms a tile is space, or hull where the hull closes over a notch, or in a raid the hangar's deck.
- **Edges:** walls stand between tiles, not on them, since rooms can be one tile across. An edge is a wall between rooms, the hull, a door (open, closed or locked) where the builder joins two rooms, or a hatch where an airlock opens onto space (entry and exit).
- **Wrecked rooms** from the approach phase put their hazard on every tile of the room: fire, vacuum or rubble.
- **What tiles do** is data (`data/tiles.json`): units stand on floor and airlock floor; crates and consoles are half cover, lockers and machinery full cover; lockers, machinery and the hull block sight. On planet maps, rock is full cover and blocks sight.
- **Squad size:** 3 at the start, up to 5 with drop bay modules later. Enemies number 4 to 8. Since M23 (`src/sim/crew.js`) a boarding takes a squad of up to 3 (`squadSize` in `data/balance.json`): with more aboard, the approach screen's Squad picks who goes before the fight, and the healthiest 3 go unless the player picks. The rest sit it out and keep their hit points. Jobs and raids are act 1's, with the start crew of 3, so everyone goes. Crew fight as their job (`data/jobs.json`: hit points, aim, defense, mobility, armor, a weapon), and enemies by type (`data/enemies.json`). The attributes in §4.5 feed these numbers later. A campaign's crew fights as itself, wounds and all (M12); the sandboxes and `tools/sim.js` fight with the squad in `data/encounters.json`, where each encounter's enemies are listed too.
- **Where they start** (M8): on a boarding, the squad on the bridge and the boarders at the hatches they come in by, each taking the tiles nearest by walking distance (`src/sim/deploy.js`). On a job (M14), the crew at the site's ways in and the enemies on its spawn tiles, both shuffled by the job's seed; from heat 50, the pursuer's hunter starts with the enemies (§4.4). In a raid (M15), the crew on the bridge and the raiders inside the hangar's doors along its west edge, behind the ship's stern. The crew moves first.
- **Boarding fights** (M22, `src/sim/encounter.js`) are on the boarded ship's map, wrecked rooms and all (Law 2).
  - **Boarding her:** her generated ship's map. Her crew starts on her bridge and plays the AI, and the player's crew comes in at her hatches.
  - **Boarded:** the player's own map. The crew starts on the bridge, and her crew comes in at the hatches, pressing on as raiders do (§4.4).
  - **Her crew** is the preset's party (named in `data/ships.json`, listed in `data/encounters.json`): a cutter's four boarders, or a corvette's patrol of three, two guards and a heavy. The whole crew fights as it is, wounds and all, and moves first.
  - **Balance** (`node tools/sim.js --boardings`, 250 fights a row, played by the AI at full health): the start crew beats a cutter's crew 52% of the time at home and 51% aboard her. Against a corvette's crew, 38% and 32%.
- **Turns:** sides take turns; each unit gets 2 actions (`balance.actionPoints`):
  - move: one action within its mobility, both for a dash within twice it
  - shoot, which ends the unit's turn
  - overwatch, which ends it too
  - reload, open a door beside it, or stabilize a downed ally beside it: one action each
  - on a job (M14): grab a crate in reach, one action; or work the terminal in reach, which ends the unit's turn and counts once a round. In reach is next to it, by a side or a corner, with no wall or closed door between.

  A side's turn ends when it says so, or when none of its units has an action left.
- **Movement** (M7): four-way steps between tiles units stand on. Walls, the hull and hatches are in the way; walking through a closed door opens it. Rubble costs 2 a step. A unit passes its own side's units but not the other's, and stops on no one.
- **Line of sight** (M7): a straight line between tile middles. Walls, the hull, hatches and closed doors on the edges it crosses block it, and so do tiles that block sight; through an exact corner it gets by if either way round is clear. Units don't block it. It is the same from either end, and reaches 20 tiles (`balance.sightRange`), or less where a job's twist cuts it (M14).
- **Cover** (M7) is directional. Each side of a unit's tile gives cover from what is there: a wall, the hull, a hatch or a closed door is full cover, otherwise the next tile gives its own. Cover on a side counts against attackers on that side of the unit: the north side's against anyone north of it, at any angle. The best that counts is the unit's cover; with none, it is **flanked**.
- **Hit chance** = shooter aim + weapon accuracy at range band − target cover − target defense − overwatch + forgiving odds, kept within 0 to 100. Range bands are straight-line distances: close up to 3 tiles, mid up to 7, long beyond; each weapon gains or loses accuracy by band (`data/weapons.json`). Starting values: half cover 20, full cover 40, overwatch 15. `src/sim/odds.js` returns every part, for the target preview.
- **Crits:** the weapon's crit chance, plus 30 when flanking (`balance.flankCrit`). A crit adds the weapon's crit damage.
- **Damage:** the weapon's damage range, plus crit damage, minus armor, with a minimum of 1. The hit, crit and damage are rolled in that order from the battle's seeded RNG.
- **Overwatch:** the unit fires once, at the first enemy that steps into its sight during the other side's turn, with the overwatch penalty; not while that enemy is passing through an ally's tile, so two units never share one. It ends at the start of the unit's own next turn.
- **Down, not dead:** crew at 0 HP go down and bleed out over 3 of their own turns (`balance.bleedOutTurns`) unless an ally beside them stabilizes them. Bleeding out puts them out of the fight, badly hurt, or kills them where permanent death is on (picked at New game, M41). Enemies at 0 HP die.
- **Hazards** (M7): fire burns 2 at the start of each of a unit's turns there. In vacuum, suit air lasts 3 turns, then the unit takes 2 a turn (the oxygen clock).
- **Weapons** (M37, `data/weapons.json`, `src/sim/weapons.js`): 15, each a sidearm, a long gun or a heavy weapon. Five rules are a weapon's data, and only the nine new weapons have any:
  - a **burst** (`burst`): that many shots at the target, each rolled at the odds shown, the burst's aim penalty part of them, until it drops; overwatch fires one, without the penalty;
  - **armor piercing** (`pierce`): that much of the target's armor doesn't count;
  - **reach** (`reach`): no shot past that many tiles, by a side or a corner, overwatch too;
  - a **stun** (`stun`): a hit puts the target to sleep through its side's next turn;
  - **fire** (`burn`): a hit sets the target's tile burning for that many rounds, burning as a wrecked room's fire does, then it goes out. Burning tiles show on the board.

  The odds card, the unit card and the tile card say each. **Loadouts** (`src/sim/loadout.js`): each crew member carries one weapon, their job's to start, and swaps it between fights for a spare of a kind their job carries (`arms` in `data/jobs.json`), two taps on the crew card. Spares are on hand (`campaign.arms`).
- **Objectives:** eliminate, extract, hack, rescue, hold, salvage. M7 has eliminate: a side wins when the other has no one standing. M14 adds two for jobs, besides clearing out:
  - **grab:** grab every tagged crate (the site's loot tiles), each from beside it;
  - **hack:** work the terminal for a number of rounds.

  M38 adds five more (`src/sim/objectives.js`):
  - **extract:** carry every tagged crate out the way the crew came in. A crate in hand means one move a turn, no dash; a carrier who goes down keeps it, for anyone beside them to take;
  - **escort:** walk the client to the far gate, the site's way-out tiles;
  - **rescue:** free the captive, held deep in the site, from beside them, then walk them out the way in;
  - **sabotage:** set a charge beside each tagged target. It blows at the start of the crew's next turn, hurting everyone beside it, either side (`blastDamage`), and an enemy beside one pulls it. The crew carries a charge for each target and a spare;
  - **defend:** hold the way in for a number of rounds. An enemy who steps onto it breaks through, and the job is lost.

  The client and the captive are the person brought out: on the crew's side, moved as the crew are, with no gun. If they bleed out, the job is lost; they are not crew, so the crew wins or loses by its own. Since M38 the enemies play to the objective in every mission but a clear-out (`src/sim/objectiveAi.js`): a guard with no shot worth taking keeps by what it guards, a shot at a carrier or the person brought out counts more, and on a defense every plan counts the steps to the way in.

  Once the objective is done the crew has won, whoever is still standing. A deadline (a job's twist) ends the battle at the end of the crew's turn in its round: if the crew hasn't won by then, it has lost.
- **Forgiving odds:** an optional setting (M18, in Settings, off unless turned on) adds 10 to the crew's next shot for each miss in a row, up to 30. The bonus is included in the number shown, so Law 4 still holds.
- **Difficulty** (M18; the game's since M41, picked at New game and changed in Settings from the next fight): Easy, Normal or Hard. Easy enemies aim 10 worse and have 1 hit point fewer, and their ships' guns aim 10 worse; Hard enemies aim 5 better and have 1 more, and their ships' guns 5 better (`data/balance.json`). Normal leaves them as the data has them. It reaches every fight, a raid fought out where the ship isn't among them.
- **Permanent death** (M41, picked at New game, kept for the game): someone who bleeds out dies and leaves the crew; a captain's death passes command to whoever has stood in most fights; with no one left aboard the game is over. Act 1's hangar signs on a free green hand while the crew is short. A fight no one plays kills no one.
- **The log:** every action returns the events it caused, and the same setup, seed and actions always give the same events (`src/sim/battle.js`; the example battle in `tests/golden/` is replayed by the tests).
- **Giving orders** (M8, `src/sim/fight.js`): a tap never spends an action. A tap on a tile shows the move (its path, one action or a dash, and the cover where it stops), and a second tap on it makes it. A tap on an enemy, or Shoot, shows the shot with its odds part by part, and Fire or a second tap takes it. Overwatch, Reload, Stabilize and Open door are buttons, and on a job Grab and Hack, and since M38 Free and Plant, shown only when there is a crate, the terminal, a captive or a target in reach; End turn takes a second tap while anyone can still act. A job's objective shows under the round, and its crates and terminal are tagged on the board; since M38 its targets and charges too, and its ways out and the way in held are outlined on the deck. The board opens square to the ship, where tiles are biggest, and every enemy is shown (no fog of war); those the selected unit can see show the hit chance. No button sits over the board (M18): Title, Log and Fit head the orders' column on the right, since Chrome takes a tap on a tile beside a button for the button.
- **The enemy's turn** is worked out at once by the rules and then played out on the board, event by event: walks, shots that land or fly wide with the damage over the unit hit, doors opening, whose turn it is. Skip goes to the end.
- **Figures** (M23b, `src/render/figures/`): units are people in spacesuits, drawn by our renderer.
  - **Two suits**, Evan's pick from five mockups: the classic EVA (puffy, ringed joints, a pack and a bubble helmet) and the skinsuit (close-fitting, lines of light, plates and an egg of a helmet). Both sides wear both.
  - **Looks are data:** each job and enemy type has a `look` (its suit, build, helmet, back and marks), and each weapon a `held` shape. The validator checks them against what can be drawn (`src/render/figures/looks.js`).
  - **Colors:** the crew are pale, each trimmed in their own color; boarders are rust with orange trim. The out and the dead lie grey.
  - **Poses:** at the ready, aiming (while shooting and on overwatch), walking (a stride to every two tiles), falling as they go down or die, and lying.
  - **Drawn once and kept** (`src/render/figures/sprites.js`): a figure is hundreds of faces, so each is drawn into a small canvas the first time it is seen at an angle, in a pose and at a size, then reused. These are drawings our renderer makes at run time, not image files. Each frame draws at most about one new drawing; a figure waiting for its new pose shows its last one.
- **The enemy AI** (M9, `src/sim/ai.js`, pure and with no random numbers) plays the enemy's turns. It plays a unit at a time and scores every plan the unit could make:
  - stay, move or dash, then shoot, overwatch or nothing;
  - or breach: open a door beside it and shoot or watch through, which draws no overwatch fire.

  A plan's score is in expected hit points. It is the harm its shot should do (kills count 4 more), minus the harm every enemy who can see where it ends up could do to it there, and minus the overwatch fire on the way. Overwatch adds something, more with an enemy close enough to step into sight. When it won't shoot, each step from the enemy costs a little. Doors its path opens count.

  A shot worth taking goes before holding back, unless it is reckless. The AI never ends up in the open (seen by an enemy with no cover between) unless no cover is in reach, or the shot from there beats every covered tile's. The weights are starting values for M11 to tune.

  Since M37 it weighs each weapon rule: a burst's shots and the armor pierced in the harm, a stunned target's lost turn (2.5), and the fire a hit leaves under its target. A unit with a reach closes to it (0.5 for each step past it) and watches only with an enemy that could step within it, and standing in a tile a weapon set burning counts its burn. A wrecked room's fire, which never goes out, it crosses as before.
- **Raiders press on** (M15, `src/sim/press.js`): with an enemy in sight a raider plays as the AI does; otherwise it walks toward the crew and opens the doors in its way, so a raid can't stall at a door. A battle with `options.press` (a raid) plays its enemy this way, and the test player that plays the crew on jobs (`src/sim/jobAi.js`) is built on it. Boarders still play the AI alone.

### 4.4 Heat

- A meter from 0 to 100 per run, owned by your background's pursuer.
- **Gains (starting values):**
  - job +8, loud job +15
  - jump +2 (3 until M24), regroup +5, a survey from orbit +2 (M25)
  - trading at a station of the pursuer's side +10, once a visit (since M33's fix; in M33, the jump there)
- **Losses:**
  - long jump −10
  - transponder swap −30, once per sector, dearer each time (M40)
  - bribes, hiding in nebulae
- **Thresholds:**
  - 25: rumors, and agents at stations
  - 50: hunter encounters at nodes
  - 75: a task force, and raids
  - 100: a forced confrontation event
- **Act 1 as built** (M15, `src/sim/heat.js`; the numbers in `data/balance.json`, the pursuer's part in `data/backgrounds.json`):
  - A job adds 8 heat, done or lost, and a loud one 15: clear-outs and the fire twist are loud (`loud` in `data/contracts.json`).
  - From 25 the pursuer's words change, and that's all in act 1. From 50 a Recovery agent goes along on every job (the pursuer's hunters; since M30 the background's: an MP for the Fleet Provost, a collector for the Hallorans).
  - From 75 a raid is due at the hangar, and no job can be taken until it has been faced. The player picks when: Defend fights it on the hangar map (§4.3) against the pursuer's raiders, who press on: Con-Reg's four, the Provost's three (an MP and two cadets since the M32b fix), the Hallorans' six. Won or lost, heat falls to 40 after it. Lost, the raiders take the dearest part on hand, or with none, half the credits, never a part off the ship.
  - **The one loss in act 1** is a payment on the debt: 50 credits for 15 heat, at the hangar. It can also head off a raid that is due. Since M30 the payment is the pursuer's (`payment`, optional): the Hallorans' vig is 75 credits for 15 heat, and the Fleet Provost takes none, so a deserter's heat only falls once a raid is faced.
  - Heat doesn't fall on its own, and 100's confrontation isn't in act 1: the raid comes first.
  - Heat goes along when the ship launches (M17), raid or no raid, into act 2.
- **Act 2 before M24** (M19, `src/sim/travel.js`): a jump added 3 heat and a long jump takes 10 off (`jumpHeat`, `longJumpHeat`), from 0 to 100. Nothing in act 2 read heat until M24. Leaving a sector is a jump. Without long jumps, heat was at or near 100 by the end of the third sector (87 to 100 over 30 test runs, M19).
  - Since M20 a scan adds 2 heat (`scanHeat`), and some event choices add or take heat: stripping a company wreck with its transponder still pinging (+8), cracking a courier pod open (+10), tossing a stalled miner a crate (−4), running dark in the rocks (−6). M20's test player ends act 2 at heat 79 at the median (45 to 100); with no long jumps, 100 (97 to 100).
  - Since M21 an approach adds 4 heat (`approachHeat`) if a gun fired in it. M21's test player weighs what a long jump passes by, so it takes fewer (3 at the median, against M20's 7), and ends act 2 at heat 100 (87 to 100).
- **Act 2 as built** (M24; `src/sim/hunt.js`, `regroup.js` and `transponder.js`, the numbers in `data/balance.json`, the pursuer's words and ships for the run in `data/backgrounds.json`). Evan's picks (2026-10-14) are in M24's entry (§7).
  - **Levels on the run** (`heat.js` runLevel): calm, rumors from 25, hunters from 50, a task force from 75, and cornered at 100, each with the pursuer's words on the meter.
  - **The hunters** may wait wherever a jump comes out, a long jump and the jump on into the next sector's way in too, by the heat the ship comes out with: from 50 the repo tug at 10% (`huntChance`), from 75 the gunship at 35% (`taskForceChance`), and at 100 the gunship, certain and not rolled (§4.2 has their ships). They never wait at a station (`safe`) or in a nebula (`hides`, kinds' flags in `data/sectors.json`). Since M40, in an uncharted system (act 2's past the charts, and those a voyage out crosses) only the task force follows: under heat 75 (`raidHeat`) the hunters have lost the trail and the odds are 0, and the jump's plan, a survey's and a regroup's say so; a jump into such a system counts as in it. The jump's plan shows the chance and the chart rings the nodes they may wait at; the roll is the campaign's, as shown (Law 4).
  - **Met,** they are an approach like a hostile ship's, whatever the node holds. A hostile ship there slips away (its node is done), and an event there waits until they are dealt with: the hunters settle nothing.
  - **Faced,** heat falls to 40 (`heatAfterRaid`), as after act 1's raid: they fled, were blown up or left adrift, or a boarding either way (heat falls as it begins, won or lost). Getting away, or parting after the last round, leaves heat where it was, 4 more if a gun fired. Beaten at home, they take what a lost raid takes.
  - **Regroup** (two taps, on the chart): away from stations, with anyone hurt, a day's rest eats a jump's supplies, heals each of the wounded 3 (`regroupHp`) and the med bay's day, and adds 5 heat (`regroupHeat`). The hunters may find the ship at the odds a jump there would have.
  - **Hide** is Regroup in a nebula: heat falls 10 (`hideHeat`) instead, with no roll, and the wounded heal all the same. It can be taken with no one hurt while there is heat to lose.
  - **The transponder swap** (two taps, in the left panel at a station, where the foot has no room for a fifth service): once a sector (`run.swapped`), 30 heat off (`swapHeat`) for 40 credits (`swapPrice`), and since M40 20 more (`swapRise`) for each swap the campaign has made (`flags.swaps`). Every price shown is the next swap's own.
  - **A jump adds 2,** down from 3: every option of the trade below was measured with it, though the question named only the hunters' chance, so it is a call made in M24, not Evan's pick.
  - **Not built:** agents at stations from 25, bribes, and payments on the debt in act 2 (§9). 100's confrontation is the gunship, certain. Docking came in M33 (below).
  - **Docking** (M33, and its fix; `src/sim/travel.js` tradeHeat and dockShip): at a station of the pursuer's side, the crew's first trade since the ship arrived (supplies, a repair, patching, a recruit signed on or the transponder swap) adds 10 heat (`dockHeat`): they log the ship. Passing through costs nothing, and neither does a refit or letting crew go; leaving and coming back is a new visit (`run.docked`, saved from v27). In M33 the jump there paid it, whatever the ship did there, so a route with no way round paid for nothing; the fix moved it onto the trade (Evan's call, 2026-10-16). The station's panel says what the first trade adds ("Con-Reg is after you: trade here and they log the ship, heat +10. Passing through costs nothing."), then that it is paid; each service's first tap says it too ("Con-Reg logs the ship: heat +10 to 42."), and the jump plan says so ahead, without adding it. A swap docks first, then sheds its 30. Stations stay safe from the hunters, so the heat tells at the jumps after. The careful test player trades there only to stay fed or to swap the transponder (§4.9).
  - **Past the charts** (M25): a day's survey of a world adds 2 heat (`surveyHeat`), and the hunters may find the ship at a jump's odds, as when regrouping; a jump between the worlds is a jump like any other. The system has no station and no nebula, so nothing sheds heat there. The careful test player managing heat meets the hunters there in 9 runs of 30 (11 times), besides the 6 of 30 that meet them crossing the sectors: 10 of 30 over the whole act. Ignoring heat, 15 of 30 meet them there (§9).
  - **Balance** (M24's test player, `tools/voyage.js`, campaign seeds 1 to 30). Managing heat (`--heat manage`): transponder swaps at stations from heat 15 when the credits leave half a holdful, hiding in a nebula on its way from 15 with 8 jumps' supplies aboard, long jumps from 45 and in place of any jump where the hunters may wait, and scans only below 45. It meets the hunters in 6 of 30 runs (none a run at the median, 0 to 2), the gunship never, and crosses all five sectors fed in 25 of 30 (24 without refits). It swaps once a run at the median (0 to 4), for 40 credits, hides 1 day (0 to 7) and never regroups; heat peaks at 51 (47 to 80). Ignoring heat (`--heat ignore`: none of that and no long jumps): the hunters in 30 of 30 runs, 8 a run (3 to 13), the gunship 5 of them; heat peaks at 100 at the median (84 to 100); a boarding lost at home in every run; crosses fed in 23 of 30. Evan's pick from three trades: the hunters at 10% from heat 50, so a careful player keeps them off most runs, but not all (at most 6 of 30); the others were 3 of 30 with the fed target down to 22, or 20% and at most 10 of 30. Over 60 seeds the careful player meets them in 14 (23%): 8 of seeds 31 to 60.
- **Act 3 as built** (M29; `src/sim/raids.js`, the numbers in `data/balance.json`, the pursuer's words for the colony in `data/backgrounds.json`). Evan's picks (2026-10-15) are in M29's entry (§7).
  - **Levels at the colony** are the run's (`runLevel`), with the pursuer's words for the colony on the meter.
  - **Heat falls** 1 at each of the colony's days' end (`colonyHeatFall`), trips' days included. **A trip adds** 4 as the ship flies out (`tripHeat`), 6 near the lanes and 2 far from them (`lanesNear` 150%, `lanesFar` 50%, of the world's lanes, M25).
  - **Found:** each day's end with no raid coming, at the day's heat: 3% a day from 25 (`raidOddsRumors`), 6% from 50 (`raidOddsHunters`), 10% from 75 (`raidOddsTaskForce`) and 15% at 100 (`raidOddsCornered`), off the lanes; near them half as much again and far from them half, rounded (near 5, 9, 15 and 23; far 2, 3, 5 and 8). None below 25. The roll is the campaign's, as shown (Law 4), and Next day's first tap gives the night's odds.
  - **A raid** (§2, Raids): the guns fire at the lander, whoever is home fights the rest, and heat falls to 40 after it.
  - **Not built:** danger (the worlds' fourth number) does nothing yet, and nothing at the colony sheds heat but the days (§9).
  - **Balance** (M29's careful test player, `tools/voyage.js`, campaign seeds 1 to 30, the colony's 60 days): found in 13 runs of 30, 20 times: near the lanes 7 times in 2 runs, off them 9 in 10, far 4 in 18. Faced 18 (two still coming at day 60): won 12, lost 6. The guns stopped 8 raiders of 72. Heat at the end is 14 at the median (0 to 40): raids taper off as heat falls.

### 4.5 Characters

- **Captain:** background, 2 traits and a starting job. **Crew:** generated recruits with a background, a trait and a job.
- **As built in M18:** New game opens captain creation. The background is fixed in v0.1 (since M30 it is picked on a screen before the captain's, §2). The name comes filled in from the background's list and can be changed. The job is one of the start crew's (each offered once), and the captain takes its place in the crew. Two of the 6 traits in `data/traits.json` are picked (20 since M32b, half of them trading one number for another; the picks scroll in their panel). A trait adds to the job's numbers (hit points, aim, defense, mobility, armor) in every fight; the attributes below aren't in yet.
- **Attributes:** Grit, Aim, Wits, Nerve.
- **Recruits** (M23, `src/sim/recruits.js`): each station offers 2 (`recruitOffer`), each a name from `data/recruits.json`, a job and a trait, at full health. They are rolled from the campaign's seed, the sector and the station, not the campaign's RNG, so a station offers the same recruits on every visit and no other roll moves. Signing one on takes two taps on the crew card, while the ship has room: as many as its berths and its life support both carry, 4 on the start ship. At a station anyone but the captain can be let go, two taps, with nothing paid back. Since M23c each comes with a look, rolled with them. Since M32b each comes from a background (`backgrounds` in `data/recruits.json`): a line about it, the jobs and traits it rolls from, how many traits, and the fights already stood, so a veteran signs on ranked. Eight are in: a green hand (no traits, no fights), a station kid, a laid-off miner and a survey hand (one trait, up to 2 fights), a long-hauler and a Company guard (one trait, 2 to 6 fights), a hired gun and a Fleet veteran (two traits, 4 to 12). The fee is 30 credits (`recruitFee`), 20 more a trait and 40 more a rank, so one trait and no rank asks M23's 50, and a Fleet veteran 150. A recruit keeps their background aboard.
- **Ranks** (M32b, `src/sim/ranks.js`): every crew member counts the fights they stand in, won or lost (`endFight`), and at 3 and 8 (`rankOneFights`, `rankTwoFights`) reaches their job's rank 1 and rank 2 (`ranks` in `data/jobs.json`), each with a name and words. Rank 1 sharpens the job's order, and since the M32b fix gives it a use more as well (Hustle, whose rank 1 was a use, a sharper number instead; Kit out a use only); rank 2 sharpens its effect aboard or at the colony; each keeps what the one below gave. A crew member's own rank sets their order; an effect takes the best rank of the job among those it counts. The fight's end names who reaches a rank and what it gives, a chevron for each rank sits over a portrait's corner (the fight's crew buttons, the squad card, the crew card) and beside a name in the crew panels, and the crew card says each one's rank and fights.
- **Jobs:** Marine, Engineer and Medic in v0.1; Pilot, Scout, Xenobiologist and Quartermaster since M32. Each job has an order in a fight with a few uses, an effect aboard on the run and an effect at the colony (`order`, `station` and `colony` in `data/jobs.json`; the rules in `src/sim/orders.js` and `src/sim/edges.js`). The first station effect was the medic's (M23): one more hit point a jump from a working med bay. The best of a job counts, once: a second of the same job adds nothing.
- **Wounds** carry between battles and heal in the med bay over time. Since M12 a crew member's hit points carry through a fight, and anyone who went down comes back with 1. In act 1 the crew heals fully back at the hangar (Evan's call, 2026-10-12). In act 2, since M23 (`src/sim/medbay.js`), a working med bay heals each of the wounded 1 hit point a jump (`heal` in `data/modules.json`), 2 with a medic aboard, up to their most. A long jump counts as 3 (`longJumpFactor`), leaving a sector as 1, and a wrecked med bay heals nothing. Hunger comes off before the healing. A station still patches the crew up for credits (M22, §4.6).
- **Portraits:** recruits use layered SVG portraits drawn in code, so scars and implants can appear mid-game. Named characters use hand-edited Base44 portraits. **As built in M23c:** every crew member has a look saved with them (`src/sim/looks.js`): a face shape, skin, hair, hair color, eyes, beard and a mark, two layers apart from everyone else aboard. It is drawn as a helmet badge (`src/render/portraits/`): the face through the helmet their job wears in a fight, on a card in their trim. The captain's look is picked at creation, layer by layer or rolled; a recruit's is rolled with them; the start crew's, and their names, come from the campaign's seed. Marks are layers already, so scars earned in play need only the rule (§9). **As built in M34:** each companion has a bust of their own, drawn in code (`src/render/portraits/bust.js`, Evan's pick over Base44): bareheaded, in clothes and gear named in data (`bust` in `data/companions.json`), their side's color on them, on a dark navy ground with amber and cyan rim light. It is big beside the event's words where they offer to come aboard, and cropped to the face on the crew card and the squad pickers; in a fight they wear their job's helmet like anyone.

### 4.6 Economy

- **Credits** buy parts and services. **Parts** are modules held in inventory. **Salvage** is raw material for repairs and, later, crafting.
- **Act 1 starts** (M13; since M14 the background's start in `data/backgrounds.json`) with a half-built hull: bridge, reactor, corridors, airlock and a gun, with no quarters, life support or engines. On hand are crew quarters, life support and two corridors, so a new player's first minute fixes two flight checks. The engines have to come from jobs. Since M30 each background starts its own way (§5): the deserter with a shield generator and small reactor fitted and an engine on hand, the smuggler with a light engine and cargo hold fitted and 75 credits.
- **Jobs pay** (M14) credits, and on some jobs a part from the job's drop table (M16, §4.7): the repossession always pays an engine, once; the scrap run sometimes. Credits also buy heat off: a payment on the debt, 50 credits for 15 (M15, §4.4). A lost raid can take half of them.
- **Prices** (M16, `src/sim/economy.js`): a part costs its module's cost (`buyPercent` 100 in `data/balance.json`), and the shop buys one back for half (`sellPercent` 50), rounded down to 5 credits. The engine, at 200, is the dear part.
- **The shop** (M16): the district's dealer, Dutch's yard (`shop` in `data/districts.json`). It has 4 different parts at a time, picked by weight from its table (engines weigh most) when each job board is rolled, so it turns over after every job. A price is fixed when it is offered. It buys any part on hand.
- **Weapons for sale** (M37): act 1's dealers stock 2 weapons beside their 4 parts (`armsSize`), rolled with the board from a table of their own, and buy a spare back at half price. Each station on the run has a rack of 2 (`rackSize` in `data/balance.json`), from its side's table (`arms` in `data/factions.json`) or the stations' own, the same on every visit, at its side's prices; one bought is gone. A won fight leaves one of the fallen's weapons 30% of the time (`gearChance`), and some events give or sell one (`arms` among an outcome's effects).
- **Lifting off** (M16): act 1 ends by lifting off Homeworld, so its checklist asks for thrust at least the ship's mass (`liftOff` 1 in `data/campaign.json`), where the frame asks half. The start ship needs three engines; stripping it can save one at most. Only the campaign asks this.
- **Supplies** (M19, `src/sim/travel.js`; the numbers in `data/balance.json`): a jump eats one per crew member (`jumpSupplies`), a long jump three times that (`longJumpFactor`). The ship carries 30 in its lockers (`baseSupplies`, 24 in M19) and 20 more for each cargo hold. The run starts with them full. Stations sell them at 1 credit each (`supplyPrice`). A jump the supplies don't cover still goes: they run out, and each crew member loses 2 hit points (`hungerHp`), never the last one. In act 2 the crew heals at stations for credits (M22) and, since M23, in a working med bay over jumps (§4.5). A recruit is one more mouth: the start ship's 30 lockers last a crew of 4 seven jumps.
  - **Tuning** (M19's test player, `tools/voyage.js`, 30 launches from M16's test runs): 12 lockers at 3 credits starved every run, since 12 supplies don't reach from one station to the next. At 24 and 1 credit, a careful player with no long jumps crosses three sectors without going hungry in 18 of 30 runs, and all five in 8. The runs that go hungry launched with few credits: launch money is median 50 (0 to 220), and act 2 pays nothing until M20's nodes. M20 retunes this once nodes pay.
  - **Retuned in M20,** when the nodes began to pay (M20's test player, the same 30 launches, long jumps at heat 50 or over; with no long jumps in brackets): with M19's 24 lockers and 1 or 2 stations a sector, 12 of 30 runs crossed all five sectors fed (15), though the nodes paid the median run over 100 credits. Money wasn't the problem: the holds ran dry between supply stops. Two stations in every sector alone made 17 (24); 30 lockers alone, 14 (20); doubling the traders' weight alone, 12 (18). Both, 30 lockers and 2 stations a sector: 25 of 30 (24), and 21 with no scans.
- **What the nodes pay** (M20, `data/events.json`): credits and supplies from derelicts and distress calls, and parts from derelicts; supplies sold cheap, and parts bought, by traders; and a cost at hazards, in hit points or supplies. Each choice's chances are shown and rolled as shown (§4.7). M20's test player settles 11 events a run at the median (5 to 13): 130 credits and 8 supplies from them, 3 parts found, 6 hit points lost. Act 2 still has nothing else to spend credits on; the median run ends with about 100 (180 with no long jumps).
- **Repairs** (M21, `src/sim/repair.js`): a module wrecked in an approach stays wrecked until a station repairs it, for a quarter of its cost (`repairPercent` 25) in steps of 5 credits: a gun or a shield generator 35, an engine or a reactor 50. Repair, on the sector map at a station, takes two taps and repairs what the credits cover, the cheapest first.
- **Patching** (M22, `src/sim/patch.js`): a station patches the crew up for 2 credits a hit point (`patchPrice`). Patch up takes two taps and heals a hit point at a time, to whoever has fewest left, as far as the credits go. Patching up a start crew at 2 hit points each costs 40.
- **Prices by standing** (M33, §4.9): a station of a side charges the crew its level's share of supplies, repairs, patching and a recruit's fee: trusted 75%, friendly 90%, neutral 100%, cold 125%, hostile 150% (`data/balance.json`). Each total is rounded as its price is: supplies, patching and fees to whole credits, halves up; a repair to steps of 5 credits, at least one. A station of nobody's charges the whole price, and a station's services say its share ("Supplies, 1 credit each, 90% here."). In act 1 a job from a client whose side is friendly pays 10% more, trusted 20%, in steps of 5 credits.
- **What hostile ships pay and take** (M21; fought out since M22, `src/sim/encounter.js`):
  - **Won aboard her:** her salvage and her scrap. The salvage is her working parts, by rolls, never corridors: 1 from a cutter, 2 from a corvette.
  - **Won at home:** her boarders' gear, her scrap's worth in credits.
  - **Lost at home:** what a lost raid takes (§4.4).
  - **Lost aboard her:** nothing taken. The crew falls back hurt.

  Either way the crew keeps its wounds. What a win pays is rolled as the fight begins and shown when it ends. In M21 a stand-in settled boardings without a fight. Its test player, with no long jumps, met 2 hostile ships a run at the median (0 to 4), boarded none, and lost something to one in 11 of 30 runs.
- **M22's test player**, with no long jumps, meets 2 a run at the median (0 to 5), 47 in all over 30 runs. It never closes to board and disabled none, so it boarded none. 12 boarded it: it fought off 6, and each of the other 6 took a part. It patches the crew up in 28 of 30 runs, 9 hit points for 18 credits at the median. It crosses all five sectors fed in 26 of 30 (25 in M21). With long jumps from heat 50 it does so in 20 of 30 (21 in M21).
- **M23's test player** (`tools/voyage.js`) signs a recruit on only where the holds would still last 10 jumps with them aboard (`HIRE_JUMPS`) and the fee leaves a holdful's price. On the start ship's lockers alone that is never: it signs no one on in 30 runs and crosses all five sectors fed in 26. With a cargo hold fitted before launch (`--fit cargo`), it signs one on in 15 of 30 runs, for 50 credits each, and crosses fed in 29. With a med bay fitted (`--fit medbay`) it crosses fed in 26, the med bay heals 12 hit points a run at the median (0 to 62), and it patches 0 (0 to 18) at stations where it patched 9 (0 to 32) without one.
- **Refits** (M23h): free, at stations, with the parts on hand (§4.1). M23h's careful test player fits every part on hand that feeds, heals, houses, guards, arms or drives the ship, each while every flight check passes (`tools/voyagePlan.js` refitAt). Over 60 voyages it refits in 52, a part at the median (0 to 7), cargo holds most. It crosses fed in 50 against 46 without refits, and patches 9 hit points at the median against 12, ending with 24 against 26: a bigger hold keeps more credits back for supplies before it patches. Refits cost nothing, so act 2 still has little to spend credits on (§9).
- **Act 1 target:** launch in under an hour. M16's test player (`tools/run.js`) launches after 7 jobs at the median (3 to 14 over 50 runs), in 26 to 92 minutes at the slow pace, every run under an hour at the quick pace. The target before M16 was 8 to 12 jobs, but 12 jobs can't fit in an hour at Gate 2's 5 to 8 minutes a fight; M16 tuned for the hour. The engine's price moves it. Check in play.

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
- **Planet maps** (M14, `src/sim/gen/site.js`, pure) come from hand-drawn templates in `data/sites.json`, in the battle map text format. A template marks where the crew comes in, where enemies may start, the crates a job can tag, the terminal, prop slots, hazard slots and rock, with fences and gates on the edges.
  - A map is its template turned left to right, top to bottom, both or neither by the seed. Each prop slot rolls a crate, a container or nothing, and a hazard twist lays its patches on the hazard slots, never where anyone starts.
  - Every template is checked with every prop slot a crate, the worst case: every tile to stand on can be walked to from the way in, and every crate and the terminal can be reached. The same template, seed and hazard always give the same map (golden file `tests/golden/sites.txt`).
- **The job board** (M14, `src/sim/contracts.js`, pure) offers 3 jobs. Each is a template (`data/contracts.json`: a mission at its sites for its clients, against an encounter, for credits and maybe a part) crossed with who, where and a twist:
  - the client and the site, from the template's lists;
  - a twist half the time: an enemy more or fewer, fire or a cave-in on site, the lights out (sight cut to 6), a deadline, or the pay changed;
  - the pay, in steps of 5 credits, and the part, if any, from the job's drop table: a chance, and parts by weight (M16, `src/sim/drops.js`).

  All of it is rolled, with the fight's seed, when the board is, from the campaign's RNG, so an offer never changes once it is made. After each job, done or lost, the board is rolled again with none of the jobs it had, so no job comes twice in a row, and the shop's stock with it (M16). A job marked once (the repossession) never comes back once it is done. Clients and sites belong to the background's district (`data/districts.json`), and since M30 so do the jobs, by their sites: each district's board offers only its own 8 to 10.
- **Act 2's sectors** (M19 and M20, `src/sim/gen/sector.js`, pure; `data/sectors.json`) are node maps in 7 columns: the way in alone in the first, the jump point alone in the last, and 2 or 3 nodes in each column between.
  - **Links** join each node to the next column by its height in its column, so none cross and every node can be reached both ways. Between any two columns, 35% of the time (`extraLinkChance`), one link more is added where it crosses nothing.
  - **Stations**, 2 a sector since M20 (1 or 2 in M19), each stand in a column of their own, and so does a **nebula**, 1 a sector since M24: a cloud the hunters can't see into (§4.4), with no event or ship in it. The kinds the data counts (`counts` in `data/sectors.json`) are placed so; a kind's flags say whether it is on the charts (`charted`), safe from the hunters (`safe`) or hides the ship (`hides`).
  - **The other nodes** roll their kind from the data's mix, by weight: empty space 2 (3 until the nebula took a node a sector, M24), derelict 2, distress call 2, trader 1, hazard 2 (M20), hostile ship 2 (M21). A node of a kind that holds events gets one of its kind from `data/events.json`, none twice in a sector while the kind's events last.
  - **A hostile ship** (M21) is a preset by weight and a seed: a pirate cutter 3, and from the third sector a patrol corvette 1. The ship is generated from them (M10) when the ship meets it, and saved whole with the approach.
  - **Names** come from the data's lists, none twice in a sector, and no sector's name twice in a run.
  - **A jump** goes to a linked node, and a long jump to one two links away. Either can go back as well as on. From the jump point, leaving is a jump into the next sector's way in, and from the act's last, into the system past the charts (below). Act 2 has 5 sectors (`sectors` in `data/campaign.json`).
  - **Rolls:** each sector is rolled from the campaign's RNG as the ship enters it, and saved whole. The same seed always gives the same sector (golden file `tests/golden/sectors.txt`).
  - **What is known** (M20): the way in, the jump point, stations and, since M24, nebulae are on the charts. Any other node shows what it holds once the ship has been at it or next to it, or after a scan: a scan shows every node within 2 links (`scanRange`) for 2 heat.
- **The system past the charts** (M25, `src/sim/gen/system.js`, pure; `data/worlds.json`): where act 2's run ends. Evan's picks (2026-10-14) are in M25's entry (§7).
  - **Its map** has a sector's shape, so the run plays on it as on any: the way in on the left, linked to each of its 3 worlds (`system.worlds`), and each world to the one beside it. There is no jump point: nothing past it is charted.
  - **A world** has a name, a kind and act 3's numbers. Its kind is rolled by weight, none twice in a system: ocean, desert, ice, jungle or barren rock. Its numbers are rolled within its kind's ranges: soil, water, ore and danger, each 0 to 3, and how far it lies from Con-Reg's lanes, 1 (near) to 3 (far). A jungle world rolls soil 2 to 3 and danger 2 to 3, a barren rock soil 0 and ore 2 to 3, and so on (`data/worlds.json`). Names come from the data's lists, none twice in a system.
  - **Rolls:** the system is rolled from the campaign's RNG as the ship jumps on into it, and saved whole, as a sector is. The same seed always gives the same system (golden file `tests/golden/systems.txt`, `tools/sectors.js --system`).
  - **Known from afar:** every world is on the charts with its name and kind (`charted`), dashed until surveyed. A scan shows nothing there.
  - **The jump into it** (M40, `travel.js` leavePlan): its plan, and the chart, warn when the holds can't cover a survey's day and a jump on (`systemNeeds`), by how much: no station is past the charts. Only the task force follows the ship there (§4.4).
  - **A survey** (`src/sim/survey.js`, two taps at a world): a day in orbit eats a jump's supplies and adds 2 heat (§4.4), and shows the world's numbers and lanes, once a world. It needs the supplies for the day.
  - **Settle here** (`src/sim/settle.js`, two taps at a world, surveyed or not, not while an approach holds the ship) ends act 2. The campaign moves on to act 3, saved at once, with the world as its colony: its name, kind, numbers and whether it was surveyed, for M26 to M29. The ship, crew, credits, parts on hand and heat go with it, and the run stays as it ended, for the act's record. A short landing plays (M17's lift-off backwards, with Skip), then act 3's home: since M26 the colony (§2), which keeps the run's record (sectors, jumps, the hunters met and faced, boardings, credits, parts on hand, heat) and the world.
  - **The careful test player** (`tools/voyagePlan.js` systemMove, M25) scores a world as soil + water + ore + lanes − danger, a world not surveyed by its kind's averages: its own judgment, until act 3 says what the numbers do. It surveys the nearest world not yet surveyed while its supplies cover the jumps there, the day and the way on to the best world it knows of, then settles the best its supplies reach. Over 30 runs managing heat it surveys 3 worlds in 15, 2 in 10, 1 in 4 and none in 1, settles a world it surveyed in 29 and the system's best (all its numbers known) in 26, and never goes hungry there. It arrives with what the last sector left it: no station is past the charts.
- **Events** (M20, `src/sim/events.js`, pure; `data/events.json`, 10 of them): an event opens when the ship reaches its node and holds every jump and scan until a choice is made.
  - **A choice** can need credits, supplies or parts on hand, and every event has one choice that needs nothing, so the ship is never stuck.
  - **Its outcomes** each have a chance in 100. One roll from 0 to 99 picks the outcome whose share it falls in, so the odds shown are the odds rolled (Law 4).
  - **Effects:** credits; supplies, up to what the holds take; heat; a wound, hit points off one crew member picked by a roll or off everyone, never the last one; a part, given or from a drop table; and selling parts on hand, the dearest first, at the shop's price.
  - **After:** the run keeps the events settled and the last one's result until the next jump. The validator checks every event, so adding one needs no engine edits.
- **Hostile ships** (M21, `src/sim/encounter.js`, pure): arriving at a node with one opens the approach (§4.2), which holds every jump and scan until it is over. Each order plays a round with the campaign's RNG. When it ends, the node is done, and the approach stays on screen with its outcome until Carry on. Since M22, a boarding stays until its fight is over, or until the player leaves the ship they disabled. Since M24 the pursuer's hunters open one the same way where they wait (§4.4), and settle no node: its event waits for them to be dealt with.

### 4.8 Saves

- `SAVE_VERSION` gates all saves, with a migration for every bump. Never reset player saves.
- Every change to the campaign is saved as it happens (M12): at the hub, as a fight begins, after every order in a fight, and as it ends. This list first named the start of each player turn; saving only there would let a player quit after a miss, reopen to the same roll and spend it on another shot.
- A saved fight holds its battle whole, the map and its RNG state included, so a game update between quitting and reopening can't move a wall under a unit.
- The game reopens at the title, and Continue goes back to where the campaign was: the hub, or the fight as it stood. Past act 1 that is the sector map (M19), or an approach as it stood (M21); in act 3 the colony (M26). The lift-off is only a screen: launching saves the campaign in act 2 at once, so quitting during it reopens past it. So is the landing (M25): settling saves the campaign in act 3 at once.
- The RNG state is part of the save.
- Settings can export and import a save as text. A TWA shares Chrome's storage, so clearing Chrome's data wipes saves; the export is the player's backup. Since M18, Settings has Export, Copy and Import; Import checks the code, and a second tap replaces the save.
- The settings themselves (difficulty, forgiving odds, motion, frame rate, tips and the tips put away) are part of the save (v9, M18).
- The run (v10, M19): the supplies, and the sector the ship is in, saved whole with where it is, where it has been and the sectors behind it. A v9 campaign gets no supplies and no run; the run begins when the map first opens, holds full.
- Events and scans (v11, M20): the events settled in the sector, the scans made, and the last event's result; a node's event is saved with its sector. A v10 run carries on with nothing settled or scanned. Its sector keeps its nodes as they were, with no events, and the next sector has them.
- The approach phase (v12, M21): the ship's wrecked modules, and the approach under way, round by round, with the other ship saved whole; a node's hostile ship is saved with its sector. A v11 campaign has nothing wrecked and no approach. Its sector keeps its nodes, with no hostile ships, and the next sector has them.
- Boarding fights (v13, M22): a fight can be a boarding, saved with its direction and what a win pays, and an approach that ended in one has its fight due. A v12 approach was settled by its stand-in, so no fight is due from it.
- Recruits (v14, M23): the recruits signed on in the sector (`run.hired`, by station and slot), so a station's offer stays as it was after a hire. A v13 run has signed no one on. The squad picked for a boarding isn't saved until the fight begins, which lists who fights.
- Portraits (v15, M23c): every crew member's look. A v14 crew gets one from its ids, the same on every load.
- Hull styles (v16, M23d): every ship's style. A v15 ship is Rounded.
- Styling (v17, M23f): every ship's paint, trim and styling pieces: the builder's slots, the campaign's ship, the other ship in an approach and the one a boarding is fought on. A v16 ship is in the yard's colors, slate and sky, with no pieces.
- Makers (M23g, M31) needed no new version: a maker's version of a part is a part of its own (`bastion-engine`, `kestrel-engine`, `scrapline-engine`), and saves and blueprint codes name parts by id. Every older ship's parts are the Yard's, or Bastion's from M23g on.
- Refits on the run (M23h) needed none either: a refit changes only the ship and the parts on hand, which saves already hold, and supplies past the holds are a count the save has. An act 2 save from before M23h refits at its next station.
- Heat on the run (v18, M24): whether the transponder has been swapped in the sector (`run.swapped`), and whether an approach is the hunters' (`approach.hunt`). A v17 run hasn't swapped in its sector, and an approach under way in a v17 save is a hostile ship's. Regroups and hides need nothing saved: they change the crew, supplies and heat, which saves hold.
- The worlds past the charts (v19, M25): the worlds surveyed in the system (`run.surveyed`), and the colony (`campaign.colony`): null until a world is settled, then that world, with its name, kind, numbers and whether it was surveyed. The system itself is saved whole as the run's sector, with `system: true`, no jump point and a world on each world's node. A v18 run has surveyed nothing and no v18 campaign has settled; a v18 save at the last sector's jump point jumps on into the system.
- The colony's buildings (v20, M26): `colony.buildings`, the parts given in the order given, each where it stands on the colony's grid as a ship's modules are saved (`{ uid, type, x, y, rot }`), and `colony.nextUid`. A v19 colony has no buildings yet, every part still aboard.
- The colony's days and materials (v21, M27): `colony.day` (1 at the landing) and `colony.materials`. A building's type is a part's or, for a farm or a mine, its build's id. A v20 colony opens on day 1 with 20 materials, the landing's salvage when M27 came in.
- Trips (v22, M28): `colony.places`, the places within reach, each `{ kind, name, days, event, held, seed }` (a held derelict's ship is generated from her seed); and `colony.trip`, null with the ship home, else `{ place, squad, done, result }`: the place, the squad's ids, whether it is done there, and what came of it. A boarding at a place is saved as a fight, as on the run. A v21 colony has no places and no trip; its places are rolled when the colony is first shown.
- Raids (v23, M29): `colony.raid`, null with none coming, else `{ found, lands }`: the day the pursuer found the colony and the day its lander comes down; and `trip.leg`, null, else `{ dir, left }`: a leg a raid stopped, out or home, and the days still to fly. A raid fight is saved as a fight (`raid: true`), as at the hangar. A v22 colony has no raid coming, and its trip no leg.
- The builder keeps up to six ships in slots, each with the build log its replay plays back. A single ship travels between devices as a blueprint code.

### 4.9 Sides and standing

- **As built in M33** (`src/sim/standing.js`; the sides in `data/factions.json`, the numbers in `data/balance.json`). Evan's picks (2026-10-16) are in M33's entry (§7).
- **Four sides:** Con-Reg (the Company: the miner's pursuer), the Fleet (the Navy, its customs men and its Provost: the deserter's), the Hallorans (old Halloran's family business in the Narrows: the smuggler's) and the union (the miners' locals, the dockers and the union halls on the run). Each has a name, a line about it and its color.
- **Standing** with each runs from −10 to 10, in five levels: hostile (−6 and below), cold (−5 to −2), neutral (−1 to 1), friendly (2 to 5) and trusted (6 and up). A new campaign starts hostile with its pursuer's side, at −10, and neutral with the rest. It is saved with the campaign (v26).
- **What moves it,** each move kept within −10 and 10:
  - a job in act 1 is for its client's side, if the client has one (`side` in `data/districts.json`: Marta the steward and Gage the dockers' boss for the union, Sully the foreman for Con-Reg), and against its enemies' side, if any (`against` in `data/contracts.json`). Done, +2 for and −2 against; lost, −2 against;
  - an event's outcome (`standing` in its effects): the company wreck stripped fast, the stalled miner helped, and M33's four (a Halloran drop, a Fleet tender in trouble, a Con-Reg survey skiff, a union co-op barge), each with a choice for its side and one against;
  - a side's ship boarded, blown up or left adrift by the crew: −3 with its side (`side` in `data/ships.json`: the patrol corvette the Fleet's, the hunters their pursuer's).

  Raids don't move it (§9). Since M33b a thread's pay-off at the colony raises the pursuer's side to cold (§4.10).
- **What it changes:** the prices at its stations and act 1's pay (§4.6), the heat of trading at the pursuer's (§4.4), and the Fleet's patrols (§4.2).
- **Stations** are a side's by name (`stations` in `data/factions.json`): three of the twelve names are the union's, two each Con-Reg's, the Fleet's and the Hallorans', and three nobody's. The sectors roll their stations as before.
- **Shown** (Law 4): a Sides panel at the hangar and on the chart, and a Sides section at the colony, each side's level, number and how far to the next; a pip in the side's color on its stations on the chart, and a station's line with its prices; on the job board, whom a job is for and against, and its pay with the bonus; each change where it happens (the fight's end, an event's result, an approach's end), with the level it leaves or keeps; at a station of the pursuer's side, what the first trade adds, on its panel, in the hint and in each service's first tap, and in the jump plan ahead (since M33's fix); and in the jump plan, how the patrol ahead will greet the ship.
- **Balance** (the careful test player, `tools/voyage.js --background all`): it prefers a friendly side's stations, and since M33's fix trades at the pursuer's only to stay fed or to swap the transponder, passing them by otherwise. Over 100 voyages from each start it trades with the pursuer in 14, 26 and 19 runs (the miner, the deserter, the smuggler) and passes one of its stations by in 39, 32 and 31; in M33, docking on the jump, it docked in 22, 27 and 8. The miner lands friendly with the union (+3 at the median, from Marta's jobs); the smuggler hostile with the Fleet (−8), from act 1's customs jobs, so its patrols fire first. No test voyage was waved through until M33b: since its Fleet's chain the miner is, in 14 voyages of 100 (§4.10). PROGRESS.md's M33 entry and its fixes' have the rest.

### 4.10 Quests

- **As built in M33b** (`src/sim/quests.js`; the quests in `data/quests.json`, their jobs in `data/contracts.json` and events in `data/events.json`, the odds in `data/balance.json`). Evan's picks (2026-10-16) are in M33b's entry (§7).
- **Three kinds.** A background's thread starts with its campaign and has a step in each act. A side's chain starts at an event's choice: the Fleet's, lending its tender a hand (+2 with the Fleet); from M33c the union's, paying into the strike fund; Con-Reg's, towing the survey skiff; and the Hallorans', calling their drop in. Each chain brings its side's companion, and from M33c a companion's loyalty quest starts as they sign on (§4.11).
- **A step is done in its own act:**
  - **act 1, a job:** a contract of the quest's own, on the board above its three jobs while the step is open, never in the rotation. Its client, site, pay and fight's seed come from the campaign's seed and the jobs done and lost so far, so the board's own rolls are as before. Lost, it is offered again;
  - **the run, an event:** an event of the quest's own, put on a node of its kind in each sector the ship enters while the step is open, on the charts, marked with a diamond and named for its quest. A done choice does the step and a cold one ends the quest; any other leaves it for the next sector;
  - **the colony, a place:** within reach beside the others until the step is done, its ship held by the pursuer's men, her own crew: a fight aboard her, as at a derelict the squatters hold. Lost, the crew comes home hurt, and she is still there.
- **The threads:**
  - **the miner's debt:** Rook's job at Depot 4, losing the debt's paper (heat −20); Con-Reg's courier with the paper filed again (heat −15, a wound one time in four); Con-Reg's claims tender, held by Recovery's crew;
  - **the deserter's pardon:** Mother Ilse's job at the Brig, the warrant lost (heat −20); the Resolute short of spares (20 credits: heat −15, the Fleet +4); the Provost's courier, held by its patrol;
  - **the smuggler's cargo:** Ferris's job at the customs pound (heat −20); the lost cargo (heat −15, the Hallorans +4); the Hallorans' runner, held by their collectors.
- **The pay-off,** the colony's place won: heat −30, the pursuer's side raised to cold (−5) if lower, and from then on its raids find the colony at half the odds (`easedOdds` 50, rounded as the odds are).
- **The Fleet's chain:** the tender's stolen stores pod, on the charts in the sectors after: tagged for the Fleet, 25 credits and the Fleet +4, and the chain is done; stripped, 8 supplies and 10 credits, the Fleet −2, and it goes cold.
- **The trail goes cold:** a step not done in its act ends its quest, act 1's at the launch and the run's as the ship leaves the last sector. Launch's first tap and the last jump point's plan name the quests they would end.
- **Shown** (Law 4): a Quests panel at the hangar, on the chart and at the colony, each quest's step and what is next, or done, or gone cold; the quest's job on the board, tagged with its name; the quest's node marked on the chart and named in its label; each choice's first tap saying what it does to a quest; each step's words and what it gave where it is done (the fight's end, the event's result, the homecoming); the colony's place tagged and held; the pay-off at the fight's end and the trip home; the halved odds in the colony's needs and Next day's first tap.
- **Saves:** v28.
- **Balance** (the test players, 100 voyages from each start): act 1's takes the thread's job before every launch; on the run the step is done in 99, 92 and 100 voyages (the miner, the deserter, the smuggler), most of them in the first sector, and the colony's place is won in 67, 61 and 86. After the pay-off the colony's odds of being found fall from 2.2, 1.6 and 1.3% a day to 0.1, 0.2 and 0.0%. The miner lends the tender a hand in 37 voyages and tags the pod in 28, and a patrol waves it through in 14. PROGRESS.md's M33b entry has the rest.

### 4.11 Companions

- **As built in M33c** (`src/sim/companions.js`, `src/sim/talents.js`; the companions in `data/companions.json`, their chains and loyalty quests in `data/quests.json`, the chains' events in `data/events.json`). Evan's picks (2026-10-16) are in M33c's entry (§7).
- **Four, one for each side,** each with two traits, three fights stood (rank 1), a face and a past:
  - **Ines Varga,** the Fleet's: the tender's bosun, an engineer;
  - **Teo Brandt,** the union's: a docker and shop steward on a striking hall's food run, a quartermaster;
  - **Ama Osei,** Con-Reg's: the junior surveyor let go for logging the skiff's tow, a scout;
  - **Dez Halloran,** the Hallorans': Old Halloran's nephew, the family's medic.
- **The chains,** each started at its side's event and its step an event of its own from the next sector on, as the Fleet's stores pod is (§4.10):

  | Side | Started by | The step | Signing on, against doing it without them |
  | --- | --- | --- | --- |
  | The Fleet | lending the tender a hand: 3 supplies, the Fleet +2 | the stolen stores pod | the Fleet +4 and Varga, against 25 credits and the Fleet +4 |
  | The union | paying into the strike fund: 15 credits, the union +2 | the hall's food run | 4 supplies, the union +4 and Teo, against the same and 10 credits |
  | Con-Reg | towing the survey skiff: 3 supplies, 15 credits, Con-Reg +2 | the surveyor's lifepod | Ama, against 2 supplies for 20 credits |
  | The Hallorans | calling the drop in: the Hallorans +1 | the family's runner | 3 supplies, the Hallorans +1 and Dez, against 3 supplies and the Hallorans +4 |

  At each step one choice ends the chain and another leaves it for the next sector. Signing on needs a free berth (`crew.js` crewRoom) and costs no fee.
- **Loyalty:** a companion's loyalty quest opens as they sign on, with one step at the colony: a place within reach held by someone from their past (the pirates' cutter, the strikebreakers' tug, the survey chief's tug, the family's runner), a fight aboard her as at a thread's place, 2 days away. Won, they are loyal. Let go before then, at a station, it goes cold.
- **Their talent,** loyal: their job's order at a third rank, rank 2's with numbers of their own, in every fight after:

  | Companion | Talent | Over rank 2's |
  | --- | --- | --- |
  | Ines Varga | Bosun's weld | Weld ×3, a door shut 8 rounds against 5 |
  | Teo Brandt | Steward's kit | Kit out ×3, +2 armor against +1 |
  | Ama Osei | Surveyor's eye | Mark ×3, +30 to hit against +20 |
  | Dez Halloran | Family medicine | Patch ×3, 8 hit points against 5 |

  Their job's other ranks still come with fights: Varga's Running repairs at 8 fights, as anyone's.
- **Shown** (Law 4): where a companion offers to come aboard, the event card shows their face, name, side, job and past, and with the result once they have; the choice signing them on says so, that it takes a berth and how many are free, and what the crew eats with them aboard; on the crew card, on the chart and (from M33c) at the colony, their side, past and loyalty: what earns it, or their talent and its numbers; the Quests panel with each chain and loyalty quest; their place at the colony, named for their quest and held, with who is aboard her; loyal, three chevrons on the crew card, the squad picker and the fight's buttons, rank 3 by their talent's name on the unit's card, its numbers in the order's preview, and the fight's end saying they are loyal.
- **Saves:** v29.
- **Balance** (the test players, 100 voyages from each start, as M33c's entry has them): companions sign on in 21, 19 and 56 voyages (the miner, the deserter, the smuggler) and are loyal by the end in 8, 7 and 29; in the fight harness (1,000 fights against the same at rank 2) Steward's kit wins 75% against 47%, Surveyor's eye 45% against 41%, Family medicine 53% against 51%, and Bosun's weld 51% against 51%: the AI welds a door 0.2 times a fight. PROGRESS.md's M33c entry has the rest.

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

**M23e's variants** (21 module types in all): light engine, heavy engine, small reactor, point defense, cannon, shield array, bunks, surgery and large hold.

**M39's nineteen** (40 module types in all): five doing a crew job's ship effect (scanner, fire control, ECM suite, workshop, survey lab), five with rules of their own (torpedo bay, grapple, stealth baffles, security turret, hydroponics), and nine versions of parts already there (railgun, flak battery, large reactor, thruster, cockpit, dormitory, air recycler, cargo pod, shield emitter).

**Hull frames as built:** six since M39 (`data/frames.json`): the starter hull, and the courier, gunship and freighter frames sold at shipyards; a patrol hull and a small-craft hull for enemies.

**Traits as built:** 20 since M32b (`data/traits.json`), ten of them trading one fight number for another as Hothead does. The captain picks 2; recruits roll theirs from their background.

**Manufacturers as built:** four, one past the target: the Yard's, Bastion Arms' (M23g, 40 versions since M39), Kestrel Dynamics' (M31, 27) and Scrapline's (M31, 40). 147 parts in all in `data/modules.json`.

**Backgrounds as built** (`data/backgrounds.json`), each with its district in `data/districts.json`: six clients, four job sites (one on each site map), a shop, and its jobs in `data/contracts.json`:
- **Debt-bound miner** (M14). Con-Reg Recovery, the company's repo crews, hunt you by tracking your ship's registration, and take payments on the debt. Act 1's district is the Tailings, with 10 jobs.
- **Navy deserter** (M30). The Fleet Provost, the Navy's police, take no payments. The district is the Strand, the spaceport's sailors' quarter, with 8 jobs. A marine, a pilot and a medic (two marines before M32), no credits.
- **Burned smuggler** (M30). The Halloran family want their cargo's worth, and take a dearer vig. The district is the Narrows, the old town's back streets, with 8 jobs. An engineer, a quartermaster and a medic (two engineers before M32), 75 credits.

**Weapons and enemies as built** (M37): 15 weapons, 5 sidearms, 6 long guns and 4 heavy weapons; 20 enemy types, a new one for each side: the pirates' gunner, the scavvers' torcher, Con-Reg's breacher, the Provost's proctor and the Hallorans' cutter.

**Jobs as built** (M32): all seven of §4.5's, each with an order, an effect aboard and an effect at the colony. Two weapons came with them, the scout's long rifle and the xenobiologist's dart gun, six in all.

---

## 6. Versions

| Version | Phases | What a player gets |
| --- | --- | --- |
| v0.1 | 0 to 3 | Build a ship in your hangar, take jobs, fight off a raid, launch |
| v0.2 | 4 | The run: sectors, the approach phase, boarding both ways, recruits, scouting worlds |
| v0.3 | 5 | The colony: settling, the colony builder, expeditions, raids |
| v0.4 | 6 | Breadth: 3 backgrounds, 4 manufacturers, all jobs, factions, quests, images, audio |
| v1.0 | 7 to 9 | Balanced, with a tutorial, built on and tuned, released on Google Play |

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

Pick the tone before M14. (Picked: wry and blue-collar.)

- [x] **M12 Campaign state.** Acts, hub, credits, parts, crew, heat and flags; autosave points; `SAVE_VERSION` 4 (M3 took 1 for the builder's ship, M5 took 2 for its slots, M5b took 3 for the finer grid).
  **Done when:** quitting anywhere and reopening resumes correctly.
- [x] **M13 Hangar hub.** The half-built starter hull, construction mode (owned parts only), the flight checklist as the act goal, and a crew panel.
  **Done when:** a new player is building within 60 seconds of starting.
- [x] **M14 Background, district and jobs.** One background, a job board, 10 job templates, planet map generator v1, 3 mission types, rewards.
  **Done when:** ten jobs in a row feel varied (Evan's call).
- [x] **M15 Heat v1 and the hangar raid.** Heat from jobs, thresholds, and a raid defended on the hangar map.
  **Done when:** ignoring heat brings a raid, and managing it avoids one.
- [x] **M16 Shop and economy v1.** A parts shop, prices and drop tables.
  **Done when:** a test run reaches launch in under an hour.
- [x] **M17 Launch.** The checklist passes, the launch sequence plays, and a stub stands in for act 2.
  **Done when:** launching saves and moves on cleanly.
- [x] **M18 First run and settings.**
  - captain creation: background fixed for v0.1, 2 traits, a job
  - tutorial prompts for building and for the first battle
  - settings: difficulty, forgiving odds, reduce motion, sound, export and import save. Sound was cut: there is no audio to switch until M35, which brings the switch.

  **Done when:** Gate 3 passes.

**Gate 3:** a stranger plays from the first screen to launch unaided. **Passed 2026-10-12** ("Gate 3 passed"). v0.1 is done.

### Phase 4: Act 2 (v0.2)

Detailed at the start of M19, once v0.1 was done. The Done whens past M19 are drafts, to settle as each milestone starts.

- [x] **M19 Sector generator, supplies and jumps.**
  - sectors as seeded node graphs: a start, an exit to the next sector, and nodes between them, a few of them stations
  - the act 2 hub: the sector map, on the ship, in place of the stub
  - jumps to a linked node (+3 heat), and long jumps two links away (−10 heat, three times the supplies)
  - supplies: one per crew member a jump, carried up to the ship's lockers plus its cargo holds, bought at stations. A jump short of supplies goes hungry, which costs hit points, never a run.

  **Done when:** from launch, a run crosses three sectors by jumping and restocking at stations; supplies and heat move as `data/balance.json` says; the same seed always gives the same sectors.
- [x] **M20 Node types, events and scanning.**
  - node types past stations: derelicts to salvage, distress calls, traders, hazards
  - events as data (`data/events.json`), with choices whose outcomes are credits, parts, supplies, heat or wounds
  - scanning: what a node holds is unknown until the ship is near or scans it

  **Done when:** ten events play from `data/events.json`, each choice's odds shown and rolled as shown; scanning shows what a node holds before the ship gets there; and the nodes pay the run's way: over 30 test runs from launch, the test player, picking nodes for what they hold, crosses all five sectors without going hungry in at least 24 (M19, with nothing at the nodes: 8).
- [x] **M21 Approach phase** (§4.2).
  - hostile ships at nodes, met in the approach phase: up to 3 rounds of fire, evade, flee or board, against the other ship's tactics
  - damage that stays: wrecked modules carry into the boarding map and the next approach until a station repairs them, for credits
  - stand-ins for the boarding fights until M22: boarding strips a part and takes scrap; boarded, you lose what a lost raid takes

  **Done when:** hostile ships at nodes fight the approach phase to an outcome (escape, disabled and boarded, or destroyed), every roll at the odds shown; in `tools/approach.js`, a weapon mount, a shield or an engine added to the launched start ship each does better against at least one hostile preset and worse against none (Law 1); damage carries into the boarding map as wrecked rooms and stays until a station repairs it; a stand-in settles boardings until M22; and the careful test player (no long jumps) still crosses all five sectors fed in at least 24 of 30.
- [x] **M22 Boarding both ways** (§4.2, §4.3). Boarded, the fight is on your own layout (Law 2), wrecked rooms and all; boarding, it is on the enemy's generated ship (M10). It replaces M21's stand-ins, and the player's Board order opens against a ship that can still fight. Salvage after.
  - boarding fights from the approach, either way, on the boarded ship's map with its wrecks; Board her or Leave her, or Fight them off
  - what they come to (Law 3): her parts and scrap, rolled as the fight begins; at home, what a lost raid takes; the crew's wounds either way
  - stations patch the crew up for credits

  **Done when:** a boarding, either way, is fought from the approach on the right map (boarded: your own ship's, wrecked rooms and all, Law 2; boarding: her generated ship's, with hers); the player's Board order works against a ship that can still fight, at the odds shown; every boarding fight leaves parts, credits or wounds behind (Law 3), and the stand-ins are gone; stations patch the crew for credits, two taps; played by the AI at full health, the start crew beats a cutter's crew at least 40% of the time either way (`tools/sim.js --boardings`); and the careful test player still crosses all five sectors fed in at least 24 of 30, now fighting its boardings with the AI and patching at stations.
- [x] **M23 Recruits, crew management, med bay healing** (§4.3, §4.5).
  - recruits at stations for a fee: 2 to a station, rolled from data (a name, a job, a trait), the same on every visit, up to the ship's berths and life support
  - the crew card on the sector map: everyone's job, traits and hit points, and at a station the recruits for hire and letting crew go
  - a squad of up to 3 for a boarding, picked on the approach screen; the healthiest unless picked
  - the med bay: 1 hit point a jump to each of the wounded, 2 with a medic aboard

  **Done when:** recruits sign on at stations for a fee, two taps, up to the ship's berths and life support: each station offers 2, rolled from data (a name, a job, a trait), the same on every visit; before a boarding the player picks a squad of up to 3, the three healthiest unless changed, and the rest sit out; the crew card lists everyone's job, traits and hit points and lets anyone but the captain go, two taps; a working med bay heals each wounded crew member 1 hit point a jump, 2 with a medic aboard (a long jump counts 3), and a wrecked one heals nothing; the builder's part card says what quarters, life support and the med bay do on the run; and the careful test player, signing recruits on only while the holds would last 10 jumps with them aboard, still crosses all five sectors fed in at least 24 of 30, and with a med bay fitted patches fewer hit points than without (Law 1). (As first agreed, it hired "when its credits allow"; on the start ship's lockers that starved it, below.)

**Looks and the catalog, before refits** (Evan's call after M23, 2026-10-13). The characters are still stand-ins, the ships look blocky, and the builder needs more to choose from. Evan asked for these before the milestones already planned. His answers: figures and portraits; hulls that are smoother on their own, plus shaped pieces to sculpt them; styling that isn't a module (Law 1); and part variants in size and stats, plus a second manufacturer. The rules stay on the square grid (§3), so the curves are on the outside: rooms and fights keep their square tiles. Each milestone keeps the fight and the hull views within the frame budget at the three screen sizes.

- [x] **M23b Character figures** (§4.3).
  - figures drawn in code by our renderer: a helmet and visor, a suit, arms holding the weapon, legs
  - two suits, Evan's pick from five mockups (2026-10-13): the classic EVA and the skinsuit, worn by both sides for variety
  - the crew by job (marine, engineer, medic), each in their own trim; enemies by type (`data/enemies.json`), in their side's colors
  - each job's and enemy type's look is data: its suit, build, helmet, back and marks; each weapon's held shape too
  - poses: standing, aiming as they shoot, walking through a move, down, and out or dead

  **Done when:** every crew job and every enemy type has a figure of its own in one of the two suits, set in data, and told apart at the cover screen's tile size (each pair on a side differs in at least a fifth of their pixels there, seen from the front, the side and behind); a move walks, a shot aims and a unit that goes down falls; the fight keeps to the frame budget at the three sizes, holding the frame rate main holds in Chromium while the enemy's turn plays out; and the golden battle logs don't change (it is drawing only).
- [x] **M23c Portraits** (§4.5). Evan's pick from five mockups (2026-10-13): the helmet badge, the face seen through the helmet the crew member's job wears in a fight.
  - portraits drawn in code (SVG) in layers: face, skin, hair and its color, eyes, beard and a mark (a scar, freckles, a tattoo, an implant), through the helmet and suit of their job's figure (M23b), on a card in their trim
  - each crew member's look saved with them: the captain's picked at creation, layer by layer or rolled; a recruit's rolled with them; the start crew's, and their names, from the campaign's seed
  - shown on the crew card (crew and recruits), the squad card, the fight's crew buttons and captain creation (the background shrinks to a line). The fight's crew column keeps its width, with a small portrait beside the name: 20 px wider, as first planned, would have put the cover screen's fight tiles under 48 px

  **Done when:** every crew member has a helmet-badge portrait drawn in code from a look saved with them (face, skin, hair, hair color, eyes, beard and a mark), through the helmet their job wears in a fight, the same each time it is drawn; captain creation steps through each layer and rolls; recruits come with theirs, rolled with them, the same on every visit; new games name the start crew from the recruits' names and give them looks from the campaign's seed; saves carry the looks (`SAVE_VERSION` 15: older crews get theirs from their ids, the same on every load, their names kept); two crew aboard always differ in at least two layers; portraits show on the crew card (crew and recruits), the squad card, the fight's crew buttons and captain creation, with every button there 48 px or more at the three sizes; and the golden battle logs don't change.
- [x] **M23d Sleek hulls** (§4.1, auto-hull). Evan's pick from four mockups (2026-10-13): two styles, "A and D as the options. Enemy ships are randomized on those two. You can build either."
  - two hull styles as data (`data/hulls.json`): **Rounded** (rounded corners outside and in, a rounded shoulder, a bullet nose) and **Plated** (cut corners, a stepped armor shoulder, panel seams, a blunt prow)
  - the hull traced with curves and diagonals around the rooms: about half a cell outside them, so the curves never cut a room; a nose on every front, a tapered stern, on every ship without the player doing anything
  - the parts that show outside on the new skin and bevelled to match: nozzles, turrets and collars
  - the player picks a ship's style in the builder; enemy ships get one of the two at random
  - wherever a hull is drawn: the builder's rim and hull view, the hangar, the lift-off, the enemy ships sandbox

  **Done when:** both styles are in data (`data/hulls.json`): Rounded, with rounded corners outside and in, a rounded shoulder and a bullet nose; and Plated, with cut corners, a stepped armor shoulder, panel seams on the roof and a blunt prow. In both, no outer corner of the outline is a plain right angle, and the hull covers every cell and never cuts into a room (tested). Nozzles, barrels and collars sit on the new skin, bevelled to match. The player picks the style in the builder, one tap, undoable, saved with the ship (`SAVE_VERSION` 16: older ships are Rounded) and carried by blueprint codes (version 3, which still reads 1 and 2). Every enemy ship gets one of the two at random, the same for the same seed, its layout unchanged (golden). The builder's rim and Hull view, the hangar, the lift-off and the Enemy ships sandbox all draw it. The builder's default view keeps every cell 22 px or more on the cover screen. The boarding maps don't change (golden), and the hull views keep to the frame budget at the three sizes.
- [x] **M23e Builder catalog and part variants** (§4.1, §5). Evan's picks (2026-10-13): the drawer as a picker, one category at a time; the nine parts below; enemy ships using some now; and Law 1 for variants as reworded in the Done when.
  - the parts drawer in categories (command, power, engines, weapons, defense, crew, cargo and utility): one category at a time, or all, picked from a 48 px button, with a size filter. The maker filter came with the second maker (M23g)
  - nine new parts, each with its own footprint, interior, model and icon:
    - **light engine** (2 × 1): half an engine's thrust for a third of its mass, cheap, wrecked by one hit. Thrust 6, mass 1, 8 hit points, 90 credits
    - **heavy engine** (3 × 2): about twice an engine's thrust, and two hits to wreck. Thrust 26, mass 6, 30 hit points, 420 credits
    - **point defense** (1 × 1, a turret facing space): fires at incoming shots, cutting the other ship's hit chance by 10, up to 20 with more turrets. Shot at with the guns. 120 credits
    - **cannon** (2 × 1): a heavy gun whose hit goes through a shield and still wrecks a part. 30 damage a hit, one cannon hit wrecks an unshielded reactor. 240 credits
    - **shield array** (2 × 2): holds more of a volley than a generator, 25 a round. Draws 4 power. 300 credits
    - **small reactor** (2 × 2): half a reactor's power; as a spare, one wrecked reactor no longer disables the ship. Power 4, mass 2, 130 credits
    - **bunks** (2 × 2): berths with their own air, so it makes room for crew by itself. 2 berths and 2 life support, 100 credits
    - **surgery** (2 × 2): heals more a jump than a med bay: 2, 3 with a medic. 220 credits
    - **large hold** (4 × 3): twice a cargo hold's supplies, 40. 140 credits
  - guns' damage and shields' strength per part, and point defense's cut to the other ship's odds, shown in the odds (Law 4)
  - the shop, the drop tables and the enemy presets carry them:
    - Dutch's yard stocks all nine, its engines weighted up so act 1 runs as before;
    - act 1's jobs drop them where they fit, and act 2's salvage the five cheaper ones;
    - the cutter flies on an engine and one or two light engines, the corvette carries a pair of cannons half the time, and the hauler may carry a large hold. The corvette is mirrored, so any part that can't sit across its middle comes in pairs: a pair of shield arrays would hold 50 a round, more than the start ship's gun gets through, so it has none

  **Done when:** the nine parts are in `data/modules.json`, each with its own footprint, interior, model and icon. Each changes the approach, a fight or the voyage, shown by `tools/approach.js`, `tools/sim.js` or `tools/voyage.js` (Law 1), and none is worse than another part in every way (cost, size, mass, power, hit points and what it does). A gun's damage and a shield's strength come from its part, and point defense cuts the other ship's hit chance, every chance shown as rolled (Law 4). The drawer shows one category at a time or all, picked from a 48 px button, with a size filter, and in construction mode only the parts on hand; two taps to place as now, every button 48 px or more at the three sizes. The shop and the drop tables carry the new parts, and the enemy presets use some (the golden ships file updated on purpose). Old saves and blueprint codes still load, and the careful test player still crosses all five sectors fed in at least 24 of 30.
- [x] **M23f Styling pieces** (Law 1's styling line). Evan's picks (2026-10-13), from mockups drawn by the game's renderer: Look mode; the 12 pieces in the mockup; paint as hull and trim swatches; a piece left with nothing to hold it comes off.
  - styling as data (`data/styling.json`): 12 pieces in three groups, plus six paints and six trims:
    - wings: swept wing, delta wing, tail fin, spoiler;
    - gear: antenna, dish, floodlight, light strip, armor plate;
    - sculpt: wedge, long wedge, curve.
  - Look mode: the Hull button shows the ship from outside, and the drawer's first tab becomes Look, a picker of wings, gear, sculpt, paint, trim and the hull's style (which moves there from the Ship tab)
  - placed from outside, two taps, on cells beside the hull against a room, never ahead of the bow or in the cell in front of an exhaust, a barrel or a hatch, at most 24 a ship; wedges and curves join the hull, which wraps them in its style
  - a room change that leaves a piece with nothing to hold it takes the piece off in the same step; undo puts it back
  - saved with the ship, carried by blueprint codes, shown everywhere a hull is drawn, and worn by enemy ships in their side's paint

  **Done when:**
  - **Data:** the 12 pieces are in `data/styling.json`, each with its own model outside, its drawing on the plans and its icon; so are six paints and six trims.
  - **Look mode:** the Hull button opens Look. The board shows the ship from outside, and the drawer's first tab picks from wings, gear, sculpt, paint, trim and hull style.
  - **Placing:**
    - a piece goes on from outside in two taps, on cells beside the hull and against a room;
    - never ahead of the bow, and never in the cell in front of an exhaust, a barrel or a hatch;
    - at most 24 a ship;
    - it moves, turns (a wing flips sides) and comes off as a part does, undoable;
    - paint and trim take one tap each, undoable.
  - **Room changes:** one that leaves a piece with nothing to hold it takes the piece off in the same step; undo puts it back.
  - **Sculpting:** wedges and curves join the hull, whose skin wraps them in the ship's style; the hull still covers every room and never cuts into one (tested).
  - **Where it shows:** pieces and paint show wherever ships are drawn: the builder's plans and Hull view, the hangar, the lift-off and the Enemy ships sandbox.
  - **Looks only:** no stat, rule or boarding map changes with them (tested).
  - **Saves and codes:** saves (`SAVE_VERSION` 17: older ships have no pieces, in slate and sky) and blueprint codes (version 4, which still reads 1 to 3) carry them.
  - **Enemy ships** wear their side's paint and some pieces, the same for the same seed, their layouts unchanged (golden).
  - **Fit and budget:**
    - every button is 48 px or more at the three sizes;
    - the builder's default view keeps every cell 22 px or more on the cover screen;
    - the hull views keep to the frame budget.
- [x] **M23g A second manufacturer** (§3: manufacturers are skins over the same part shapes; §5). Evan's picks (2026-10-14), from mockups drawn by the game's renderer: Bastion Arms; a maker's rooms in its own color on the plans; the side that fits it flies it.
  - **Bastion Arms** (`data/manufacturers.json`), tough and heavy: a version of every part on the Yard part's footprint, interior and fittings (`base` in `data/modules.json`), with half again the hit points, a quarter more mass (at least 1) and a slightly higher price
  - told apart at a glance: on the plans its rooms are amber, and so are its icons in the drawer; outside, its fittings are gunmetal with orange hazard chevrons, and its engines burn orange, all under the ship's own paint
  - the drawer puts each part's Bastion version beside it, and the category sheet picks a maker (any, Yard or Bastion)
  - each maker's version is a part of its own (`bastion-engine`), so saves and codes, which name parts by id, keep their versions; act 1's goal and the shop's "needed" lines count either maker's part
  - the shop and the drop tables carry both makers; the patrol's corvettes carry Bastion's parts, so boarding one strips them

  **Done when:**
  - **Data:** Bastion Arms is in `data/manufacturers.json`, and every part, M23e's included, has a Bastion version in `data/modules.json` on its Yard part's footprint, interior, fittings and icon, with more hit points and more mass. None is worse than another part in every way (M23e's test).
  - **Law 1:** `tools/approach.js` shows the start ship with Bastion's parts faring differently against the hostile presets than with the Yard's: losing fewer parts to their volleys, and evading less. Its mass counts in thrust for mass, lift-off included.
  - **At a glance:**
    - on the plans and in the drawer, Bastion's rooms and icons are amber;
    - outside, its parts' fittings, marks and flames are its own wherever ships are drawn: the Hull view, the hangar, the lift-off and the Enemy ships sandbox.
  - **The drawer:**
    - each part's Bastion version sits beside it;
    - the category sheet picks a maker;
    - construction mode shows the parts on hand of either maker;
    - every button is 48 px or more at the three sizes.
  - **Where they come from:**
    - the shop sells both makers, and the drop tables carry Bastion's, with act 1 running as before (`tools/run.js`);
    - act 1's goal and the shop's "needed" lines count either maker's part.
  - **Enemy ships:** the patrol's corvettes carry Bastion's parts for most of theirs, rolled from the ship's seed. Their layouts and boarding maps are unchanged (the golden ships file is updated on purpose, for the part names).
  - **Saves and codes:** old saves and blueprint codes load with the Yard's parts, and neither version number changes (tested).
  - **Voyage:** the careful test player still crosses all five sectors fed in at least 24 of 30.
  - **Budget:** the hull views keep to the frame budget.
- [x] **M23h Refits at stations** (from §9; Evan's call in M23, numbered M23b until the looks came first). Act 2 has no refits yet: a part found at a node or stripped from a boarded ship can only be sold, and most ships launch with room for one recruit and no med bay. Evan's picks (2026-10-14): refit with what the run finds (no parts dealer at stations yet, §9); a wrecked part is repaired before it comes off; refits are free.

  **Done when:**
  - **At a station:** Refit, at a station on the run, opens construction mode on the ship with the parts on hand: found at nodes, stripped in boardings, or left from act 1. Each change is saved at once, as at the hangar, and Look works there too. Map goes back to the chart. Away from a station there is no Refit, and the sim refuses one (tested).
  - **Free:** a refit costs no credits, supplies or heat, and the ship's parts and the parts on hand add up to the same before and after (tested).
  - **Wrecks:** a wrecked part is marked on the plans, and its card says so. It moves and turns with its damage, but comes off only once the station has repaired it; the sim refuses a refit that would drop one (tested).
  - **No leaving broken:** while a flight check fails, the ship can't jump from the station (a jump, a long jump or Jump on), and the chart says which check fails and that Refit fixes it (tested). Supplies past what the holds take after a refit stay behind at the next jump, and the jump says so before it is made (tested).
  - **Hints:** at a station with parts on hand, the chart says how many and that Refit fits them.
  - **The test player:** the careful test player (`tools/voyage.js`) refits at stations with what it has on hand, keeping each part only while every flight check still passes, and still crosses all five sectors fed in at least 24 of 30. Its report says what it fitted, and how the same seeds go without refits.
  - **Saves:** no version change: a refit changes only the ship and the parts on hand. An act 2 save made by main opens and refits at a station (tested).
  - **The hangar:** act 1's construction mode works as before.
  - **Touch:** every new button is 48 px or more at the three sizes. By touch: a found part fitted at a station in two taps, a jump refused while a check fails and allowed once it is fixed, a wrecked part kept on, and a quit and reopen that keeps the refit.
- [x] **M24 Heat v2: hunters, regrouping, transponders** (§4.4's act 2 rules). Nothing in act 2 reads heat yet, and a long jump is the only way to shed it: the careful test player launches at heat 41 (32 to 49), passes 50 by its second jump and reaches 100 by about its sixteenth of 30. Evan's picks (2026-10-14): the hunters by a chance at each jump, shown before it; heat falls once they are faced; Regroup rests and patches the crew up; transponder swaps at stations, and nebulae to hide in. Payments on the debt stay act 1's (§9). Then, once measured, the trade below: managing heat costs supplies and credits, so a careful player can't keep the hunters off every run and stay fed (Evan's pick: at most 6 of 30, the hunters 10% from heat 50; a jump +2, in the setup every option was measured with but not named in the question, is a call made in M24, not Evan's).

  **Done when:**
  - **Levels:** on the run, the heat meter names act 2's levels, each with the pursuer's words (data): calm, rumors from 25, hunters from 50, the task force from 75, and at 100 they are on the ship.
  - **Hunters:** from heat 50, wherever a jump comes out (a long jump, and the jump on into the next sector, too), Con-Reg's hunters may be waiting: 10% from 50 (`huntChance`), the task force 35% from 75 (`taskForceChance`), and certain at 100, by the heat the ship arrives with. Never at a station or in a nebula. The jump says the chance before it is made, and it is rolled as shown (Law 4) (tested).
    - They are an approach like a hostile ship's (§4.2), in the pursuer's ships (data: a tug, and the task force's bigger ship), and their boarding fights are against the pursuer's parties (`recovery`, `raid` in `data/encounters.json`).
    - A hostile ship where they wait slips away; an event there waits until they are dealt with (tested).
  - **After them:** a boarding fight with them either way, or their ship disabled, blown up or driven off, drops heat to 40 (`heatAfterRaid`); getting away, or parting after the last round, leaves it. Lost at home, they take what a lost raid takes (Law 3) (tested).
  - **Regroup:** away from stations, two taps. A day's rest eats a jump's supplies and heals each of the wounded 3 hit points (`regroupHp`), on top of the med bay's day. Heat rises 5 (`regroupHeat`), and the hunters may find the ship at a jump's odds. It needs the supplies for the day (tested).
  - **Nebulae:** a kind of node, one in every sector and on the charts. The hunters never wait in one, and Regroup there hides the ship: heat falls 10 (`hideHeat`) instead of rising, with no roll (tested).
  - **Transponder swap:** at a station, once a sector, two taps: heat falls 30 (`swapHeat`) for 40 credits (`swapPrice`) (tested).
  - **Saves:** `SAVE_VERSION` 18 for the sector's swap and the hunters' approach. An older act 2 save opens where it was, with the swap unused (tested).
  - **The test,** as M15's: over 30 voyages (campaign seeds 1 to 30), the test player ignoring heat (no swaps, no hiding, no long jumps) meets the hunters in at least 27; managing it (transponder swaps at stations, hiding in nebulae on its way, long jumps from heat 45 and in place of any jump where the hunters may wait), in at most 6. Managing it, the careful test player still crosses all five sectors fed in at least 24 of 30. `tools/voyage.js --heat ignore` and `--heat manage` (the default) report the hunters met and faced, the regroups, hides and swaps, and heat along the way. `tools/approach.js` and `tools/sim.js --boardings` measure the hunters' ships and parties.
  - **Touch:** every new button is 48 px or more at the three sizes. By touch: a jump that shows the hunters' chance, the hunters met and faced with heat falling to 40, a regroup, a hide in a nebula, a transponder swap, and a quit and reopen with the hunters waiting.
- [x] **M25 Scouting candidate worlds.** Act 2's charts end at the last sector's jump point, with the stub's words: there is nowhere further to go, and no way to end the act. Evan's picks (2026-10-14): a system past the charts, with the worlds in it; a survey from orbit to scout one; act 3's numbers for each world, shown now and saved with the one settled; and a landing, then act 3's stub.

  **Done when:**
  - **The system:** Jump on from the last sector's jump point reaches a system past the charts: its way in and three candidate worlds, each linked to the way in and to the world beside it, rolled from the campaign's RNG as the ship enters (`data/worlds.json`). Each world has a name, a kind (ocean, desert, ice, jungle, barren rock) and act 3's numbers, rolled within its kind's ranges: soil, water, ore and danger, each 0 to 3, and how far it lies from Con-Reg's lanes, 1 to 3. No two worlds in a system are of the same kind. The same seed always gives the same system (golden file) (tested).
  - **Known from afar:** the worlds are on the charts with their kind; their numbers show once surveyed (tested).
  - **Survey:** at a world, two taps. A day in orbit eats a jump's supplies and adds 2 heat (`surveyHeat`), and the hunters may find the ship, at a jump's odds, as when regrouping. It shows the world's numbers, once a world. It needs the supplies for the day (tested).
  - **Settle:** at a world, two taps on Settle here, surveyed or not: act 2 ends. The campaign moves on to act 3, saved at once with the world (its name, kind and numbers, and whether it was surveyed) for M26 to M29 to build on. The ship, crew, credits, parts on hand and heat go with it. Not while an approach holds the ship (tested).
  - **The landing:** a short landing scene, M17's lift-off in reverse, with Skip, then act 3's stub: the run's record (sectors, jumps, the hunters met and faced, boardings, credits, parts on hand, heat) and the world settled. Continue on the title comes back to the stub (tested).
  - **Saves:** `SAVE_VERSION` 19 for the system, the surveys and the world settled. An older act 2 save carries on where it was, and one in the last sector jumps on into the system (tested).
  - **The test player:** over 30 voyages (campaign seeds 1 to 30) the careful test player crosses all five sectors, enters the system, surveys while its supplies allow and settles the world it scores best, in every run. Its report says how many worlds it surveyed, which it settled and what the act's record came to (`tools/voyage.js`).
  - **Touch:** every new button is 48 px or more at the three sizes. By touch: Jump on into the system, a survey that shows a world's numbers, a jump to the next world, Settle here in two taps, the landing with Skip, act 3's stub, and a quit and reopen there.

**Gate 4:** act 2 plays on the phone from launch to a world settled, and Evan wants to keep going. ROADMAP named no gate for Phase 4; this one was drafted at M25's close. **Passed 2026-10-14** ("Passed: go on to M26"). v0.2 is done.

### Phase 5: Act 3 (v0.3)

Detailed at the start of M26, once v0.2 was done. The Done whens past M26 are drafts, to settle as each milestone starts.

- [x] **M26 Settling and donated modules.** Act 3 opens on a stub (M25): the world settled and saved, the ship and crew with it, and nothing to do there. Evan's picks (2026-10-14): useful parts of the ship become the colony's first buildings (reactors, life support, quarters and bunks, holds, med bays and surgery, armories, guns and shields; the bridge, engines, corridors and airlocks stay aboard), each drawn as its part and laid out for you on the colony's grid, building by hand coming in M27; the buildings house and power the crew; and in act 3 the crew lives at the colony, so the ship's flight checks count only who is aboard (nobody until M28's expeditions) and the landed ship's reactor powers the colony too. Measured before settling this (the careful test player's ships at settling, seeds 1 to 30): counting the whole crew aboard, no ship could give a reactor, quarters or life support; counting nobody aboard, every ship can power its colony, and 13 can give their quarters. In the other 17 the quarters join the engines or the airlock to the bridge.

  **Done when:**
  - **The colony:** act 3's home is the colony, in place of M25's stub: the world's ground in 3D in its kind's colors, the ship landed at its edge, and each building drawn as the part it was. Buildings are laid out by themselves on the colony's grid (`src/sim/grid.js` and the builder's placement), each in the first spot that fits with a path round it, in the order given; the same buildings in the same order always stand in the same places (tested). Continue on the title comes back to the colony, and a quit and reopen keeps it.
  - **Giving a part:** at the colony, two taps on one of the ship's parts: it comes off the ship and stands in the colony as a building of its kind (`data/colony.json`: each useful part's building, its name and words; what it gives is its part's own numbers). Only useful parts, never a wrecked one, never one the ship can't fly without (every flight check must still pass, counting nobody aboard), and never when the grid has no room. Each refusal says why (tested).
  - **What the colony gives:** power from its power plants and from the landed ship (what its reactors make beyond what its own parts use). The buildings take it in the order they were given, and any it doesn't reach go dark. Beds and air from its powered quarters, bunks and life support, one each for every crew member; whoever goes without sleeps aboard the landed ship. A powered infirmary (a med bay or surgery) heals the crew to full when it opens, and from M28 and M29 when the crew comes home hurt. Holds are storehouses (for M27's production), and guns, shields and armories are defenses (for M29's raids): the colony says what they hold and guard, and they do nothing else yet (tested).
  - **The colony screen:** the colony's power, beds and air against what the crew needs; its buildings, the dark ones marked; the crew; and the ship's parts that can be given, each with what it would give, and why the rest can't. Act 3's words say what is still to come.
  - **Saves:** `SAVE_VERSION` 20 for the colony's buildings. A v19 save in act 3 opens at the colony with no buildings yet and every part still aboard (tested).
  - **The test player:** over 30 voyages (campaign seeds 1 to 30) the careful test player settles and founds the colony, giving every useful part the flight checks let go, beds and air first. In every run the ship still passes every flight check, counting nobody aboard, and every building is powered. Its report says what each run gave, the colony's power, beds and air, and who sleeps aboard (`tools/voyage.js`).
  - **Touch:** every new button is 48 px or more at the three sizes. By touch: the colony after the landing; a part given in two taps; a refusal and its reason; the infirmary healing the crew; and a quit and reopen at the colony.
- [x] **M27 Colony builder and production.** The colony stands as M26 left it: buildings laid out by themselves, no days, and nothing made. Evan's picks (2026-10-14): farms and mines, two buildings that exist only at the colony, built by hand from materials (a ghost first, a second tap builds), with every building moved and turned by hand; food and materials made each day by the world's numbers, the crew eating and going hungry as on the run; a day passed with a Next day button; and M26's three open questions taken in: spare parts from the hold set down as buildings, buildings taken down, and a refit of the landed ship. Measured before settling this (the careful test player's colonies at founding, seeds 1 to 30): ice and rock worlds, half of those settled, have no soil; the crew lands with 4 supplies at the median (0 to 50); 3 colonies of 30 have a storehouse; and most have 1 power to spare, so farms and mines need none.

  **Done when:**
  - **Days:** act 3 counts days from the landing, day 1 first. Two taps on Next day pass one: each farm grows its food and each mine digs its materials; the crew eats a food each; a fed crew rests, healing what a day's regroup heals (`regroupHp`) and a powered infirmary's heal on top; short of food, everyone loses `hungerHp` instead, never below 1, as on a hungry jump. Food is the run's supplies. Food and materials are each kept up to the colony's storage: the landed ship's holds, as on the run, and its storehouses; what is made past that is lost. The day's report says what it came to (tested).
  - **Farms and mines** (`data/colony.json`): built by hand from materials, 10 each, 2 × 2, needing no power. A farm grows soil + water food a day and a mine digs ore materials a day, each at least 1: the world's numbers (M25) at work. A colony begins with 20 materials, salvaged at the landing (tested).
  - **Building by hand:** a farm, a mine, a spare part from the hold or one of the ship's parts goes where it is put. The first tap shows it as a ghost in the first spot that fits; a tap on the grid moves the ghost there, or says why it can't go; Turn turns it; a second tap on it builds it. The builder's rules place it (on the grid, nothing in the way) with a cell of path round every building. Any building moves and turns the same way, and comes down in two taps: a part goes back into the hold, a farm or a mine gives back its materials. Spare parts follow M26's rules for what becomes a building. Each refusal says why (tested).
  - **Refit:** construction mode at the colony with the parts on hand, as at a station: quarters that hold the ship together can be freed, and a part taken down can go back aboard. Wrecked parts stay as they are. A ship refitted past flying shows it in its flight checks, as at a station (M28's expeditions need them to pass), and its power going short darkens the colony's buildings that took it (tested).
  - **The colony screen:** the day; food and materials against storage, with what a day makes and eats; the build list (a farm and a mine with their cost and what each would make here, the hold's parts, the ship's parts) and each building's Move, Turn and Take down; Next day, whose first tap says what the day will bring; and Refit.
  - **Saves:** `SAVE_VERSION` 21 for the day and the materials. A v20 colony opens on day 1 with 20 materials (tested).
  - **The test player:** over 30 voyages (campaign seeds 1 to 30) the careful test player founds the colony and plays 30 days, building mines and farms by its own judgment. In every run its farms feed its crew within 15 days of the landing, and its report says each run's farms, mines, food, materials and hungry days (`tools/voyage.js`).
  - **Touch:** every new button is 48 px or more at the three sizes. By touch: a farm built where the grid was tapped; a building moved, turned and taken down; a spare part set down; Next day with its report, and a hungry one; a refit at the colony; and a quit and reopen on the same day.
- [x] **M28 Expeditions from the colony.** The colony stands as M27 left it: the ship landed for good, its flight checks counting nobody aboard, and materials with nothing to buy past the farms and mines. Evan's picks (2026-10-15), each the recommended option: places within reach rolled from the seed, each a few days away, with events like act 2's and derelicts held by scavengers, boarded in a fight; the flight checks counting the squad aboard, so a trip needs berths and air for it, and the colony running on its own power while the ship is away; materials buying a generator and a shelter; and a crew coming home hurt healing day by day, the heal to full as an infirmary opens gone. Measured before settling this (the careful test player's colonies after their first 30 days, seeds 1 to 30): no ship could fly a squad of 3, since all 30 gave the colony their life support, and all 30 could once the colony's life support and quarters went back aboard. 29 colonies run on the landed ship's spare power, with no power plant of their own.

  **Done when:**
  - **Places within reach** (`data/expeditions.json`): the colony lists three places at a time, rolled from the campaign's RNG: derelicts, wreck fields, ore-rich rocks and the system's other worlds, each with its name, its kind and how many days away it is (1 to 3). Some derelicts are held by scavengers, and the list says so. A new list comes after each trip. The same seed always gives the same places (tested).
  - **A trip:** a place and a squad of 1 to `squadSize` picked from the crew. The plan says the days there and back, what the days eat, and the flight checks with the squad aboard (berths and air for each of them). Two taps on Fly out, refused with the reason while a flight check fails. The days out pass at the colony one by one, then the squad is at the place: an event like act 2's (choices with their odds, paying parts, materials or food, or hurting someone in the squad) or the scavengers. Fly home passes the days back, and the ship lands. Each leg's report says what the days at home came to (tested).
  - **Boarding a derelict:** at a derelict the scavengers hold, Board her starts a fight on her map (a derelict hauler, some rooms wrecked), the squad at her hatches. A win brings her salvage home (her working parts, and materials); a loss brings the squad home hurt with nothing. Fly home leaves her without a fight (tested).
  - **While the ship is away:** the days pass as Next day passes them, but the colony runs on its own power: the buildings the ship's spare power ran go dark. Whoever stays home without a bed and air doesn't rest, since the ship isn't there to sleep aboard. The squad aboard heals what the ship's med bay heals, as on a jump. Food and materials stay one store, the ship's holds counted (tested).
  - **A generator and a shelter** (`data/colony.json` builds): built by hand from materials, as farms and mines are. The generator (a solar array) makes power; the shelter beds and breathes for two, and needs power (tested).
  - **Healing day by day:** an infirmary heals the crew a day at a time, as since M27, and one opening no longer heals everyone to full. A squad home hurt heals over the days (tested).
  - **Refit:** construction mode at the colony counts a full squad aboard (up to `squadSize`), so its flight checks show what a trip needs.
  - **The colony screen:** the places within reach, each with its kind, its days and what is known of it; a trip's plan with the squad picked and the flight checks; Fly out and Fly home, each in two taps; while the ship is away, the colony without it, where the squad is, the place's event or its scavengers, and each leg's report. Act 3's words say what is still to come.
  - **Saves:** `SAVE_VERSION` 22 for the places and the trip. A v21 colony opens with no trip, and its places are rolled when the colony is first shown (tested).
  - **The test player:** over 30 voyages (campaign seeds 1 to 30) the careful test player plays 60 days at the colony. It builds as in M27, puts berths and air for its squad back aboard, and flies trips, building a generator and shelters when someone stays home. In every run it flies at least one trip and the ship comes home from every one. Its report says each run's trips, days away, what they brought, the boardings won and lost, and the hungry days (`tools/voyage.js`).
  - **Touch:** every new button is 48 px or more at the three sizes. By touch: a place and a squad picked; Fly out refused for a failing flight check, and a refit that puts life support aboard; Fly out; an event decided at a place; a boarding fought; Fly home and its report; a generator and a shelter built; and a quit and reopen while the ship is away.
- [x] **M29 Raids.** The colony stands as M28 left it. Heat is where the landing left it, and nothing in act 3 moves it. The defenses given from the ship stand there doing nothing: guns, flak towers, shield domes and armories.

  Evan's picks (2026-10-15), each the recommended option:
  - **Found:** heat falls a little each day, and trips add some, less the further the colony lies from the lanes. Each day the pursuer may find the colony, at odds shown on the colony screen. Found, its lander comes 3 days later.
  - **Defenses:** the defenses fight the landing, each hit a raider fewer in the fight. Shield domes and the armory help the crew in the fight itself.
  - **Losing:** a lost raid takes half the food and materials, and the dearest part in the hold.
  - **The ship away:** a raid can land while the ship is away, and whoever is home fights it.

  Measured before settling this (the careful test player's colonies after M28's 60 days, seeds 1 to 30):
  - heat is 50 at the median (26 to 75), as it landed;
  - 24 colonies have a powered gun emplacement and 1 a flak tower. None has set down a shield dome or an armory, though several hold them as parts;
  - the colonies lie near the lanes in 2 runs, off them in 10 and far in 18.

  A prototype raid on each colony's grid, buildings as blocks of cover (the crew played by the AI, the raiders pressing on, 150 fights a row), gave these crew win rates:

  | Raiders | Whole crew | Two at home | One at home |
  | --- | --- | --- | --- |
  | 4: the pursuer's (agent, heavy, agent, guard) | 39% | 10% | 0% |
  | 3 | 90% | 53% | 9% |
  | 2 | 99% | 86% | 34% |

  **Done when:**
  - **Heat at the colony:**
    - in act 3 heat falls by `colonyHeatFall` at each day's end;
    - a trip adds heat as it flies out, less the further the colony lies from the lanes (`tripHeat`, by lanes);
    - the colony screen shows heat with the pursuer's words for act 3 (`data/backgrounds.json`) (tested).
  - **Found:**
    - at each day's end, while no raid is coming, the pursuer may find the colony;
    - the odds go by heat's level and the colony's lanes (`raidOdds`, `data/balance.json`), with none below `rumorHeat`, shown on the colony screen as they will be rolled;
    - found, the raid lands `raidWarning` days later, and the colony screen counts them down;
    - a trip's days roll the same way, and the same seed always rolls the same (tested).
  - **The landing:**
    - on its day the raid is down, and Next day and Fly out wait until it is faced;
    - two taps on Defend. First the landing: each powered gun emplacement and flak tower fires once at the lander as it comes down, a cannon emplacement twice, each at `landingHit`%, shown before the tap. Each hit is a raider fewer;
    - then the fight with the rest (tested).
  - **The fight** on the colony's grid (`src/sim/colonyMap.js`):
    - open ground, each building a block of cover where it stands (fields half cover, the rest full);
    - the crew at home starts by the landed ship's edge, and the pursuer's raiders (`data/backgrounds.json`) at the far edge, pressing on as at the hangar;
    - a powered shield dome or shield array gives the defenders `raidShieldArmor` armor, and a powered armory `raidArmoryAim` aim (tested).
  - **Afterwards:**
    - won or lost, heat falls to `heatAfterRaid`;
    - lost, the raiders take half the food, half the materials and the dearest part in the hold;
    - downed crew come home hurt, as from any fight (tested).
  - **While the ship is away:**
    - a raid that lands during a leg stops it on that day. Those at home face it, and the leg flies on after; the squad doesn't fight;
    - with nobody home, the landing's hits are all the colony has: it holds if they stop every raider, and is lost if not (tested).
  - **The colony screen:**
    - heat and its words, and the day's odds of being found;
    - a raid coming, and its days;
    - Defend in two taps, the first saying what the guns will fire and at what odds;
    - the landing's report, the fight, and what came of it.

    Act 3's words say what is still to come.
  - **Saves:** `SAVE_VERSION` 23 for a raid coming and a leg stopped by one. A v22 colony opens with none coming (tested).
  - **The test player:** over 30 voyages (campaign seeds 1 to 30) the careful test player plays its colony's 60 days with raids: M27's 30 days, then M28's 30 of trips.
    - It stays home while a raid is coming, sets down the guns, shields and armories in the hold, and faces every raid.
    - Its report says each run's raids found, faced, won and lost, the raiders the guns stopped, and what lost raids took (`tools/voyage.js`).
    - The odds are tuned so that a careful colony is found more often near the lanes than far from them. The numbers are measured and reported.
  - **Touch:** every new button is 48 px or more at the three sizes. By touch:
    - the odds and the warning;
    - Defend's two taps, with the landing's report;
    - a raid fought and won, and one lost with what was taken;
    - a raid landing while the ship is away;
    - a quit and reopen with a raid coming.

**Gate 5:** act 3 plays on the phone from the landing to a colony that feeds itself, flies trips and has faced a raid, and Evan wants to keep going. ROADMAP named no gate for Phase 5; this one was drafted at M29's close. **Passed 2026-10-15** ("start the next phase"). v0.3 is done.

### Phase 6: Breadth (v0.4)

Detailed at the start of M30, once v0.3 was done. The Done whens past M30 are drafts, to settle as each milestone starts.

- [x] **M30 Backgrounds 2 and 3, and their pursuers.** One background plays from New game to the colony: the debt-bound miner, hunted by Con-Reg Recovery, in the Tailings. The captain screen names it, and there is nothing to pick.

  Evan's picks (2026-10-15), each the recommended option:
  - **The backgrounds:** the Navy deserter, hunted by the Fleet Provost, and the burned smuggler, hunted by the Halloran family.
  - **Act 1:** each plays in a district of its own on the same rock, with its own clients, sites, shop and jobs.
  - **The pursuers:** each has its own fighters, its own two ships in the run, its own payment terms or none, and its own words in all three acts. Heat's numbers are the same for all three.
  - **Difficulty:** the three are about equally hard. The difficulty setting stays the place for harder.

  Measured before settling this (`tools/run.js`, campaign seeds 1 to 50, from the miner's start): every run reaches launch, after 6 jobs at the median (3 to 13), with no raid in any run. It takes 45 minutes at the slow pace (21 to 93) and 28 at the quick pace (12 to 58).

  **Done when:**
  - **Picking a background:** New game opens a screen before the captain's with the three backgrounds. Each shows:
    - its words and its pursuer;
    - its district;
    - what its start gives: the crew's jobs, credits, parts on hand and what is fitted.

    A tap picks one, and Next goes on to the captain. The captain screen follows the pick: the background's names, its crew's jobs and its words (tested).
  - **The Navy deserter** (`data/backgrounds.json`) walked off a Fleet tender with a crate of its spares.
    - **Its start:** its own half-built ship on the starter frame, with a gun and a shield generator fitted; two marines and a medic; no credits.
    - **Its district** (`data/districts.json`): the Strand, the spaceport's sailors' quarter. It has 6 clients, 4 sites on the four site maps, a shop and 8 jobs (`data/contracts.json`).
    - **Its pursuer, the Fleet Provost:**
      - takes no payments;
      - an MP, armored, tails every job from heat 50;
      - its raiders at the hangar and the colony are fewer than Con-Reg's four, and tougher;
      - in the run a Provost cutter hunts from heat 50 and a Fleet frigate from 75 (`data/ships.json`), in navy and white.
  - **The burned smuggler** dumped the Hallorans' cargo to outrun customs.
    - **Its start:** its own half-built ship with a light engine and a cargo hold fitted; two engineers and a medic; credits to spend.
    - **Its district:** the Narrows, the old town's back streets. It has 6 clients, 4 sites, a shop and 8 jobs.
    - **Its pursuer, the Halloran family:**
      - takes payments, dearer than Con-Reg's;
      - a collector tails every job from heat 50;
      - its raiders come in numbers, lightly armed;
      - in the run a Halloran runner hunts from heat 50 and an armed yacht from 75.
  - **Everything that reads the background reads the campaign's:**
    - the job board and the shop (its district's);
    - the heat meter's words, the hunters on jobs, the payment or its absence, and the raid at the hangar;
    - the launch's words and the hunters' ships on the run;
    - the colony's words and raiders.

    A background is data only: each in `data/backgrounds.json` starts a campaign and plays to the colony (tested).
  - **Saves:** the campaign has kept its background since v5, so `SAVE_VERSION` stays 23. A v23 save opens as the miner's, as before (tested).
  - **About as hard as the miner:**
    - **Act 1** (`tools/run.js --background`, seeds 1 to 50 from each start): every run reaches launch, and the median at the slow pace is within 10 minutes of the miner's.
    - **Raids:** each pursuer's raiders are beaten by the AI crew within 10 points of Con-Reg's: the start crew at the hangar, and the crew of three at the colony.
    - **The run and the colony** (`tools/voyage.js --background`, campaign seeds 1 to 30): the careful test player crosses the sectors fed, meets the hunters and wins the colony's raids about as often as from the miner's start, each within 5 runs of 30. Its report puts each background's numbers side by side.
  - **Touch:** every new button is 48 px or more at the three sizes. By touch:
    - each background picked, its captain made, and its hangar, job board and shop shown;
    - a job with its pursuer's fighter along;
    - its pursuer's raid at the hangar;
    - its launch;
    - a quit and reopen that keeps the background.

  As built (PROGRESS.md has the measurements): the deserter also has a small reactor fitted, and an engine, crew quarters and two corridors on hand. The smuggler's credits are 75, with life support and two corridors on hand. Over 50 runs each, act 1's slow median is 45 minutes for the miner, 41 for the deserter and 39 for the smuggler.
- [x] **M31 Manufacturers.** Two makers so far: the Yard's standard parts and Bastion Arms', tough and heavy (M23g). Bastion's are amber on the plans and in the drawer, every shop and the salvage carry them, and the patrol's corvettes and the pursuers' bigger ships fly them.

  Evan's picks (2026-10-15), from mockups drawn by the game's renderer:
  - **The makers:** both of M23g's other candidates, Kestrel Dynamics and Scrapline. That makes four makers, one past §5's target of three.
  - **Kestrel's trade:** a real one. Its ships get away more often, but its parts break sooner when hit, so a ship of them fares worse than the Yard's against some preset. Judged on a shielded ship: with no shield, its fewer hit points don't show (Law 1, below).
  - **Enemy ships:** each flown by the side that fits it: Kestrel's by the pirates' cutters and the Hallorans' runner, Scrapline's by the derelict haulers.
  - **Where they come from:** shops and salvage, like Bastion's.

  Two more of Evan's calls (2026-10-15), once measured mid-milestone:
  - **No Kestrel reactor:** at half the hit points a Kestrel reactor had 15, so one gun hit disabled any ship that flew one. The pirates' cutters and the Hallorans' runner became easy prey: the start ship's score against the cutter went from −11 to +42. Kestrel's ships keep the Yard's reactor instead.
  - **The voyage tests as rates:** M31's new parts change how every test voyage rolls out, and five checks from M24 to M30 missed on seeds 1 to 30, though over 100 seeds M31's voyages were close to main's, better on most counts and a little worse on a few. Main misses several of those limits past seed 30 as well. Those checks now fly 100 seeds, each within 15 in 100 of main's 100-seed rate before M31 (5 for what main saw under 10 times; two runs of 100 differ by about 7 by chance alone), and the gaps to the original targets are in §9 for Phase 7's balance runs. Two more 30-seed checks the reshuffle broke once Kestrel lost its reactor (M25's surveys, M26's colonies that house everyone) went the same way.

  Measured before settling this (`tools/approach.js`, 200 approaches a row, the launched start ship with every part by the maker, at M23g's mockup numbers):
  - **Kestrel** (about a third less mass, a fifth fewer hit points, a fifth dearer): evasion 43 against the Yard's 30. It is boarded in 1% to 12% of approaches against 12% to 24%, and it scores better against every preset. Its fewer hit points barely show: fewer shots land.
  - **Scrapline** (a third off the price, a fifth fewer hit points, 1 more power drawn): every approach comes out as the Yard's. A gun hit does 15, which wrecks a 12-point part as surely as a 15-point one, and an approach doesn't count power. Its three engines leave the start ship 2 power short (−7 with every part its own), so it needs a second reactor to fly.

  **Done when:**
  - **Data:** Kestrel Dynamics and Scrapline are in `data/manufacturers.json`. Their versions in `data/modules.json` keep the Yard part's footprint, interior, fittings and icon. None is worse than another part in every way (M23e's test).
    - **Kestrel**, light and dear: a version of every part that weighs 2 or more but the reactor (the four that weigh 1 can't get lighter in whole numbers; the reactor is Evan's call above), with about a third less mass, half the hit points and about a fifth more cost.
    - **Scrapline**, cheap and power-hungry: a version of every part, about a third cheaper, with fewer hit points. Each part that draws power draws 1 more, and a reactor makes 1 less.
  - **Law 1** (`tools/approach.js`, tested):
    - the start ship with Kestrel's parts evades more against every preset: a smaller share of their shots hits. With a shield fitted (each maker's own), as the careful test player fits one when it has one, it fares worse than the Yard's against at least one preset. Evan's call (2026-10-15), after the first measurements: unshielded, every preset's first targets (engines and guns) die to one gun hit whoever made them, so fewer hit points don't show, and a lighter ship does better against every preset;
    - with Scrapline's parts, and the reactor it then needs to fly, it fares differently from the Yard's against the presets. Its power counts in the flight checklist: the start ship with Scrapline's engines is short of power, and the fix asks for a reactor.
  - **At a glance:**
    - on the plans and in the drawer, each maker's rooms and icons are in its own line: Kestrel's rose, Scrapline's lime;
    - outside, wherever ships are drawn (the Hull view, the hangar, the lift-off, the colony and the Enemy ships sandbox), its parts wear its own fittings, mark and flames. Kestrel's are pearl fittings, coral stripes and violet flames; Scrapline's are rust fittings, bare patches and green flames.
  - **The drawer:** each part's versions sit beside it. The category sheet picks any maker or one of the four. Construction mode shows the parts on hand of every maker. Every button is 48 px or more at the three sizes.
  - **Where they come from:** each act 1 shop carries a few of each maker's parts, some jobs drop them, and act 2's salvage has them. Act 1 runs about as before: from every background's start every test run reaches launch, with the slow median within 10 minutes of M30's (`tools/run.js`).
  - **Enemy ships:** the pirates' cutters and the Hallorans' runner fly Kestrel's version of most of the parts Kestrel makes, and the derelict haulers Scrapline's of most of theirs. Each part is rolled from the ship's seed and kept only while the ship still passes its flight checklist, and boarding a ship strips them. Layouts and boarding maps are unchanged; the golden ships file is updated on purpose, for the part names.
  - **Saves and codes:** old saves and blueprint codes load as before, and neither version number changes (tested).
  - **The voyage:** from each background's start the careful test player crosses all five sectors fed, meets the hunters and loses a raid at the colony within 5 runs of 30 of M30's numbers (`tools/voyage.js --background all`). The voyage tests' checks that M31's seeds broke pass as rates over 100 seeds (Evan's call above).
  - **Budget:** the hull views keep to the frame budget.
  - **Touch:** at the three sizes:
    - each new maker's parts in the drawer and on the plans;
    - fitted and seen outside in the Hull view;
    - bought in a shop;
    - flown by an enemy ship in the Enemy ships sandbox.
- [x] **M32 All jobs.** Three jobs so far: the Marine, the Engineer and the Medic, each a set of numbers, a weapon and a look. The medic is the only one that does anything else: a working med bay heals 1 more a jump with one aboard (M23), and the infirmary 1 more at the colony (M26). In a fight every job has the same orders.

  Evan's picks (2026-10-15):
  - **Scope:** the draft (four jobs, every job's fight, ship and colony effect, traits toward 20, talents, recruits' backgrounds) was two milestones' worth. M32 is the jobs: the four new ones, and all seven with their three effects. Traits, talents and recruits' backgrounds are M32b, straight after.
  - **Talents:** job ranks (for M32b).
  - **In a fight:** an order each, with a few uses a fight.
  - **Where the new jobs come from:** two start crews take one, and all seven sign on as recruits.

  Measured before settling this (`tools/run.js`, 50 runs each, the new jobs' numbers alone, with no orders yet): the deserter with a pilot for its second marine launched in 49 of 50 runs, did 56% of its jobs (65% before) and took 40 minutes at the slow median (41). The smuggler with a quartermaster for an engineer launched in 49, did 71% (76%) and took 52 minutes (41). Their orders, and tuning, have to win that back.

  **Done when:**
  - **The four jobs** are in `data/jobs.json`, each with its numbers, weapon and look, and its own helmet, so the portrait badges tell all seven apart:
    - **Pilot:** 8 hit points, aim 65, defense 10, mobility 5, no armor; a pistol. A skinsuit with a wrapped visor and a jump pack.
    - **Scout:** 8, aim 75, defense 5, mobility 5; a long rifle (new in `data/weapons.json`: better at long range, worse close). A skinsuit with a mirrored visor.
    - **Xenobiologist:** 7, aim 60, defense 5, mobility 4; a dart gun (new). An EVA suit with a band of light for a visor and twin tanks.
    - **Quartermaster:** 10, aim 60, mobility 4, armor 1; a carbine. A heavy skinsuit with a crest and shoulder plates.

    The numbers are starting values, tuned by measurement (below).
  - **An order each in a fight** (`order` in `data/jobs.json`, the rules in `src/sim/battle.js`), with its uses a fight:
    - **Marine, Suppress** (2): an enemy in sight takes −30 aim until its side's next turn ends. It ends the marine's turn and uses a round.
    - **Engineer, Weld** (2): the door beside it closes and is welded for 3 rounds: no one walks or sees through it.
    - **Medic, Patch** (2): an ally beside gets 3 hit points back, up to their most; one who is down gets up with 3.
    - **Pilot, Hustle** (1): one more action this turn.
    - **Scout, Mark** (2): an enemy in sight is marked until the crew's next turn ends: the crew's shots at it are +15 to hit. One action.
    - **Xenobiologist, Sedate** (2): a dart at an enemy in sight, at the shot's odds, shown as a shot's are: a hit puts it to sleep through its side's next turn. It ends the turn and uses a round.
    - **Quartermaster, Kit out** (2): itself or an ally beside gets a full clip and 1 more armor for the rest of the fight, once each.

    Stabilize stays everyone's. Each order shows as a button of 48 px or more when the crew member selected can use it, naming the order and the uses left. A tap previews it (whom it reaches, the odds for Sedate, the odds a Mark or Suppress changes) and a second confirms it, as a shot does. Marks, sleep, suppression, welds and the uses left are part of the battle, saved with the fight.
  - **The test players use the orders:** the crew's player in raids, boardings and trips (`aiAction`'s crew side) and on jobs (`jobAction`), each by a plain rule, so act 1, raids and the voyage are measured with them. The scripted player doesn't, so the golden battle stays as it is.
  - **A ship effect each** (`station` in `data/jobs.json`), while one of the job is aboard on the run (a second adds nothing):
    - **Marine:** the ship's guns are +10 to hit in the approach.
    - **Engineer:** after each jump, a wrecked part is fixed, the cheapest first.
    - **Medic:** a working med bay heals 1 more a jump (since M23).
    - **Pilot:** the ship's evasion is +10 in the approach.
    - **Scout:** a scan reaches 3 links (2 without).
    - **Xenobiologist:** a survey takes no day: no supplies, no heat.
    - **Quartermaster:** the lockers hold 10 more supplies.
  - **A colony effect each** (`colony` in `data/jobs.json`), while one of the job is home:
    - **Marine:** each defense's shot at a lander hits at 60% (50% without).
    - **Engineer:** each mine digs 1 more material a day.
    - **Medic:** a powered infirmary heals 1 more (since M26).
    - **Pilot:** with a pilot in the squad, a trip is a day shorter each way, never under 1.
    - **Scout:** with a scout in the crew, a fourth place is within reach.
    - **Xenobiologist:** each farm grows 1 more food a day.
    - **Quartermaster:** the stores keep 20 more food and 20 more materials.
  - **Shown as used** (Law 4): the approach's odds, a scan's reach, a survey's cost, a day's plan, a trip's days, the places and the lander's odds all count the crew's effects. The crew card, the recruits on offer and the captain screen say each job's order, ship effect and colony effect.
  - **Start crews:** the deserter's is a marine, a pilot and a medic; the smuggler's an engineer, a quartermaster and a medic; the miner's stays. The captain screen offers each background's three jobs, as before. Recruits are rolled from all seven jobs.
  - **Every job counts:** each order, ship effect and colony effect has a test showing its rule at work. Each order is also measured: fights with the order used against the same fights without (`tools/sim.js`) come out differently.
  - **Saves:** `SAVE_VERSION` 24, with a migration from 23. A fight saved mid-battle loads with every crew member's uses full and nothing marked, asleep, suppressed or welded, and an approach under way gets the crew's ship effects. Old crews keep their jobs (tested).
  - **Balance:**
    - **Act 1** (`tools/run.js`, 50 runs from each start): every run launches, and each slow median is within 10 minutes of M31's (42, 41 and 41).
    - **Raids** (`tools/raids.js`): each pursuer's raiders, at the hangar and the colony, measured against M31's and reported.
    - **The voyage** (`tools/voyage.js --background all`, 30 runs): fed, met the hunters and runs with a raid lost each no worse than M31's by more than 5 runs of 30. The voyage tests pass, a check new content breaks turned into a rate over 100 seeds (CLAUDE.md).
  - **Touch,** at the three sizes:
    - each order, previewed and confirmed;
    - the pilot as the deserter's captain, and the quartermaster in the smuggler's crew;
    - a recruit of a new job signed on, and the crew card's effects;
    - a fight quit and reopened after an order.

  As built (2026-10-15), where it differs from the above:
  - **The quartermaster's stores** count while one is in the crew, home or away, so a trip never leaves food or materials past what the stores keep.
  - **A scan keeps its reach:** the run remembers how far each scan saw, so a scout who leaves hides nothing already seen. Saves v24 carry it; a v23 run's scans each reached 2.
  - **The raids have parties of their own.** With the orders in use, the deserter's crew beat the Provost's three MPs at the hangar 9% of the time. Its raids are now an MP, a Provost cadet and an MP (`provostraid`); the frigate keeps its three MPs. The cadet is a new enemy, a junior MP: armored, as M30 asks of every Provost raider, but light (6 hit points, aim 65, a carbine). Old Halloran's colony raid has a second enforcer (`halloranraid`), while the yacht keeps its crew, and the Hallorans' hangar raid has its enforcer second. Each pursuer's raids land within 10 points of Con-Reg's again (M30's test).
  - **The test players' fights** in act 1 play on as boardings do past 40 rounds, and a hopeless shot or overwatch then gives way to a step nearer (`tools/boarding.js`). A fight no one standing can ever see across is told apart and stops the test player's trips (§9).
  - **The backgrounds' act 1 check** flies the 50 seeds measured above, not 10.
  - **Four voyage checks** new content broke on seeds 1 to 30 fly 100 seeds, against main's rates (CLAUDE.md): every careful run scans, fed with a med bay, fed with surgery, and the large hold going hungry less than the lockers alone.
- [x] **M32b Talents, traits and recruits' backgrounds.** Since M32 every job has an order, an effect aboard and an effect at the colony, but a crew member who has stood in twenty fights does them as well as on the first day: nothing counts their fights. There are 6 traits, the captain picks 2 and a recruit rolls 1. A recruit is a name, a job, a trait and a look, at a fee of 50, with no background (§4.5, §9).

  Evan's picks (2026-10-16):
  - **Ranks:** each job's two, earned at 3 and 8 fights.
  - **What they improve:** rank 1 sharpens the job's order, rank 2 its effect aboard or at the colony.
  - **The 14 new traits:** fight numbers, like the six, about half trading one number for another.
  - **Recruits' backgrounds:** a past that sets the price: where they come from, the jobs and traits it rolls from, and fights already stood, so a veteran signs on ranked. The fee rises with their rank and traits.

  Measured before settling this (a scratch copy of `endFight` counting each crew member's fights, 30 runs from each start, `tools/voyage.js`): the start crew has stood in 6 fights at the median by launch, 6 to 8 as the ship settles, 7 or 8 after the colony's first 30 days and 8 or 9 after 30 more of trips. At 3 and 8 fights, rank 1 comes to 97–100% of them by launch, at about their third job, and rank 2 to 30–37% by launch, 30–53% as the ship settles and 60–77% after the trips. The few recruits the test player signs on stand in 1 at the median.

  **Done when:**
  - **Fights counted:** every crew member who stands in a fight, won or lost, counts it when the fight ends (`endFight`): jobs, raids at the hangar and the colony, boardings and the trips' fights. The count is saved with them.
  - **Ranks** (`ranks` in `data/jobs.json`, the fights for each in `data/balance.json`): at 3 fights a crew member reaches their job's rank 1, at 8 rank 2, each with a name and words of its own. Rank 1 sharpens the order, rank 2 the job's effect aboard or at the colony (M32's numbers in brackets):

    | Job | Rank 1, 3 fights | Rank 2, 8 fights |
    | --- | --- | --- |
    | Marine | Suppress −40 aim (−30) | the ship's guns +15 to hit in the approach (+10) |
    | Engineer | Weld for 5 rounds (3) | 2 wrecked parts fixed after each jump (1) |
    | Medic | Patch 5 hit points, and up with 5 (3) | a med bay heals 2 more a jump, a powered infirmary 2 more a day (1) |
    | Pilot | Hustle 2 uses a fight (1) | evasion +15 in the approach (+10) |
    | Scout | Mark +20 to hit (+15) | a scan reaches 4 links (3) |
    | Xenobiologist | Sedate at the shot's odds +10 (+0) | each farm grows 2 more food a day (1) |
    | Quartermaster | Kit out 3 uses a fight (2) | lockers +20 supplies (+10), stores +40 food and materials (+20) |

    A crew member's own rank sets their order. An effect takes the best rank of the job among those it counts (aboard, home or in the squad, as since M32): a second of the same job still adds nothing. The numbers are data, so a talent is changed without engine edits.
  - **Shown as earned** (Law 4): the fight's end names who reached a rank and what it gives. The crew card, the squad card and the fight's crew buttons show each one's rank, and the crew card their fights. An order's button and preview, and every place that shows an effect (the approach's odds, a scan's reach, the jump plan's fix, the day's plan and the holds), count the ranks.
  - **Traits:** 20 in `data/traits.json`, the six and 14 more. Each moves the fight numbers (hit points, aim, defense, mobility, armor), and about half trade one for another, as Hothead does. The captain picks 2 of the 20, every pick 48 px or more and in reach at the three sizes. Recruits roll theirs from their background.
  - **Recruits' backgrounds** (`backgrounds` in `data/recruits.json`): each recruit has one, rolled with them: a name, a line about where they come from, the jobs and traits it rolls from, and the fights already stood, so a veteran signs on at rank 1 or 2. The fee rises with their rank and traits (the numbers in `data/balance.json`). The crew card shows a recruit's background, rank and fee before they sign on, and their background after.
  - **Saves:** `SAVE_VERSION` 25, with a migration from 24. A v24 crew starts at 0 fights each, since none were counted, with no background (tested).
  - **Every talent counts:** each rank's rule has a test showing it at work, and so does the best-rank rule for effects. Each order at rank 1 is measured against rank 0 (`tools/sim.js`).
  - **Balance:**
    - **Act 1** (`tools/run.js`, 50 runs from each start): every run launches, and each slow median is within 10 minutes of M32's (44, 39 and 46).
    - **Raids** (`tools/raids.js`): each pursuer's, at the hangar and the colony, with the start crew at rank 1, measured against M32's and reported. M30's test still holds: each within 10 points of Con-Reg's.
    - **The voyage** (`tools/voyage.js --background all`, 30 runs): fed, met the hunters and runs with a raid lost each no worse than M32's by more than 5 runs of 30. The voyage tests pass, a check new content breaks turned into a rate over 100 seeds (CLAUDE.md).
  - **Touch,** at the three sizes:
    - a rank reached at a fight's end, and the crew card showing it;
    - an order at rank 1, previewed with its ranked numbers;
    - the captain's 20 traits, two picked;
    - a recruit with a background and a rank, signed on at their fee.

  As built (2026-10-16), where it differs from the above:
  - **Ranks show as chevrons,** one for each rank, over the corner of a portrait (the fight's crew buttons, the squad card, the crew card) and after a name in the crew panels of the hangar, the run and the colony. Words alone didn't fit: on the cover screen the squad card cut "Marine · rank 1" to "Mari…". The crew card says the rank and fights in words as well, and so does a unit's card in a fight.
  - **The fight's end gives a rank in numbers** ("Rosa Vint reaches rank 1, Pinning fire: Suppress −40 aim."): the ranks' own words are flavor. The panel scrolls if its list runs past the screen.
  - **The Steady dart's +10** is a row of its own on the dart's odds card, so the rows add up to the number shown.
  - **The captain's 20 traits** scroll inside their panel, with the words of the last one tapped fixed under them.
  - **Eight backgrounds,** each as likely as the next: a green hand (any job, no traits, no fights), a station kid, a laid-off miner, a survey hand, a long-hauler, a Company guard, a hired gun and a Fleet veteran. About half of all recruits come unranked, three in ten at rank 1 and one in six at rank 2.
  - **The fee** is 30 credits (`recruitFee`, which was the whole 50), 20 more a trait (`recruitTraitFee`) and 40 more a rank (`recruitRankFee`): one trait and no rank still asks 50, a Fleet veteran 150.
  - **The test player** signs on a recruit only when their own fee leaves a holdful's price, as it did with the one fee.
  - **The harnesses take a rank:** `tools/sim.js --rank N` (with `--compare`, against rank 0) and `tools/raids.js --rank N`.
  - **Raids at rank 1:** the start crew wins 4 to 11 points more at the hangar and 10 to 14 at the colony. M30's test holds as it stands (rank 0, 150 fights). At rank 1 the Provost's raid at the hangar falls 12 points behind Con-Reg's over those 150 fights, and over 500 it is 15 behind at rank 0 and 17 at rank 1. Left for Evan (§9).

  Fixed after M32b (2026-10-16, Evan's calls, in a PR of their own before M33):
  - **Talents raised:** rank 1 gives the job's order a use more as well as its sharper number: Suppress, Weld, Patch, Mark and Sedate three times a fight at rank 1's numbers. Hustle, whose rank 1 was already a use, sharpens its number instead: two more actions. Kit out keeps M32b's rank 1, a use more: at 2 armor it moved the harness's fights 20 points and made the smuggler's raids at rank 1 17 points easier than Con-Reg's (Evan's call).
  - **The Provost's raid at the hangar evened out:** an MP and two cadets (`provosthangar`), the cadet sturdier (7 hit points, aim 70, from 6 and 65). The colony keeps an MP, a cadet and an MP. M30's test plays 300 fights a row, not 150.
- [x] **M33 Factions.** Nobody remembers who the crew worked for. A job's client, the side its enemies are on, the company wreck stripped or the stalled miner towed, a patrol corvette boarded: none of it carries past the job or the node. Every station charges the same, and every patrol fights.

  Evan's picks (2026-10-16), each the recommended option but the last:
  - **Scope:** factions now; quests across the acts in M33b; named companions with loyalty quests in M33c, built on M33b's chains.
  - **The sides:** the pursuers' three and the union: Con-Reg, the Fleet (with its Provost and customs), the Hallorans, and the union (the steward's local, the dockers, the union halls on the run). Each background starts hostile with its pursuer's side and neutral with the rest. Landladies, missions and dealers are on nobody's side.
  - **What standing changes:** prices at the sides' stations (friendly cheaper, cold and hostile dearer), 10 heat for docking with the pursuer's side (§4.4's unbuilt rule), more pay for a friendly side's jobs in act 1, and the Fleet's patrols: a crew in good with the Fleet passes, and one it is hostile to is fired on.
  - Before M33, M32b's talents raised and the Provost's hangar raid evened out, in a PR of their own (PROGRESS.md, "M32b fixes").

  Measured before settling this (the test players, campaign seeds 1 to 50 in act 1 and 1 to 30 on the voyage, from each start): act 1 launches after 5 or 6 jobs at the median, from 4 clients, rarely more than 2 for one. A voyage settles 10 or 11 events, buys at 5 or 6 stations and meets 1 or 2 hostile ships that aren't the hunters, nearly all pirate cutters; the patrol's corvettes come 5 to 12 times in 30 voyages. A colony flies 9 to 12 trips in 60 days. Of the 18 events only two have a side in them (the company wreck, the stalled miner), so standing is mostly made in act 1 and spent at the run's stations.

  **Done when:**
  - **The sides** (`data/factions.json`): four, each with a name, a line about it and its color. Standing runs from −10 to 10 in five levels: hostile (−6 and below), cold (−5 to −2), neutral (−1 to 1), friendly (2 to 5) and trusted (6 and up), the edges in `data/balance.json`. A new campaign starts its pursuer's side at −10 and the rest at 0.
  - **What moves it** (the numbers in `data/balance.json`):
    - **A job** in act 1 is for its client's side, if the client has one (`side` in `data/districts.json`: the steward and the dockers' boss for the union, the company foreman for Con-Reg), and against the side its enemies are on, if any (`against` in `data/contracts.json`: Con-Reg's guards, Recovery and strikebreakers, the Fleet's customs and MPs, the Hallorans' collectors). Done: +2 for, −2 against. Lost: −2 against.
    - **An event's outcome** can move it (`standing` in its effects, `data/events.json`): stripping the company wreck fast −1 Con-Reg, the stalled miner towed or tossed a crate +1 union, and four new events where a side meets the ship, one each: a Fleet tender in trouble (a distress call), a union co-op barge (a trader), a Halloran drop (a derelict) and a Con-Reg survey skiff (a distress call).
    - **A side's ship** boarded, blown up or left adrift by the crew: −3 with its side (`side` in `data/ships.json`: the patrol corvette the Fleet's, and the hunters their pursuer's).
    - Standing stays within −10 to 10. Raids and act 3 don't move it (§9).
  - **What it changes:**
    - **Stations:** each belongs to a side or none, by its name (`stations` in `data/factions.json`, so no new roll and the same sectors): of the 12 names, 3 are the union's, 2 each Con-Reg's, the Fleet's and the Hallorans', and 3 nobody's. There, supplies, repairs, patching and recruits cost the side's level's share of the price: trusted 75%, friendly 90%, neutral 100%, cold 125%, hostile 150% (`data/balance.json`), rounded as each price is. Docking at a station of the pursuer's side adds 10 heat (`dockHeat`).
    - **Act 1 jobs** from a client whose side is friendly pay 10% more, trusted 20%, in steps of 5 credits.
    - **The Fleet's patrols:** a crew friendly or trusted with the Fleet is waved through (no approach; the node is done). A hostile one is fired on: the corvette's guns get a volley before the first round. Neutral or cold, the approach is as before (my call: Evan's pick names only the friendly and the hostile).
  - **Shown as it happens** (Law 4): the sides and each one's level on the hangar's, the chart's and the colony's panels, with how far to the next level; each change where it happens (a job's end, an event's result, an approach's end) with the level it leaves; on the job board, whom a job is for and against and its pay with the bonus; on the chart, a station's side, and in its services the prices at its level; in the jump plan, the docking heat; on the approach screen, the patrol's words.
  - **Saves:** `SAVE_VERSION` 26, with a migration from 25: a v25 campaign starts each side where its background starts a new one (tested).
  - **Every rule tested:** each move (jobs done and lost, an event's outcome, a side's ship), the clamp, each level's price at each service, the docking heat, the job's pay, the patrol waving through and opening fire, and the validator's checks on every side named in the data.
  - **Balance:**
    - **Act 1** (`tools/run.js`, 50 runs from each start): every run launches, and each slow median is within 10 minutes of the M32b fixes' (43, 40 and 45).
    - **The voyage** (`tools/voyage.js --background all`, 30 runs): the test player prefers a station of a friendly side and keeps off the pursuer's when another is within reach; fed, met the hunters and runs with a raid lost each no worse than the M32b fixes' (fed 25, 23 and 29; met 9, 9 and 8; lost 3, 5 and 5) by more than 5 runs of 30. Each side's standing at the launch and at the landing is reported. The voyage tests pass, a check new content breaks turned into a rate over 100 seeds (CLAUDE.md).
  - **Touch,** at the three sizes:
    - the sides on the hangar's panel, and a job's for and against on the board;
    - a union job done and its standing at the end, then a union job's pay with its bonus;
    - a station's side on the chart, its prices at a friendly side's and a hostile side's;
    - the docking heat in the jump plan;
    - a patrol waving the ship through, and one opening fire;
    - a quit and reopen that keeps the standing.

  As built (2026-10-16), where it differs from the above (§4.9 has the whole):
  - **The four new events:** a Halloran drop (take it: 20 credits and a salvage roll, or a wound of 3 in its place 30% of the time, −2 Hallorans; call it in, +1), a Fleet tender in trouble (lend a hand: 3 supplies, +2 Fleet; raid its stores pod: 6 supplies and 10 credits, −2), a Con-Reg survey skiff (tow it: 3 supplies for 15 credits, +2 Con-Reg; take its survey cores: 35 credits, −2) and a union co-op barge (6 supplies for 6 credits, or 15 into the strike fund, +2 union). Each also has a way to pass it by. The stalled miner's crew wear union pins.
  - **The opening volley** fires at the first kind of part the corvette's tactics aim at that the crew's ship has working, the crew not evading. The log heads it "They opened fire".
  - **Where the sides show:** a Sides panel in the hangar's side column and on the chart, a section in the colony's info panel, and a pip in the side's color on its stations on the chart. The hangar's side column scrolls as a whole on short screens, each panel at its own height: it was full before.
  - **The test player keeps off the pursuer's stations** by counting a dock there as a shortfall, as bad as going on into the next sector short, and pricing its heat as an event's. As first written (a dock worth −20 credits), the miner's voyages met the hunters in 16 runs of 30 and lost a raid in 10, over the limits. Now 14 and 8, exactly the limits; over 100 seeds 48 and 23 against main's 35 and 18 (PROGRESS.md, known issues; §9).
  - **The voyage tests:** two checks the new events tipped on seeds 1 to 30 (a recruit signed on with a cargo hold; a surveyed world settled) are rates over 100 seeds against main's. The colony's raid-heat check now allows the heat of the trips flown after the last raid: it held on seeds 1 to 30 by chance, and main misses it on seed 77.

  Fixed after M33 (2026-10-16, Evan's call: all three of my recommendations, in a PR of their own):
  - **Docking heat on the trade:** at a station of the pursuer's side the crew's first trade since the ship arrived pays the 10 heat, not the jump there, so a route with no way round costs nothing (§4.4). Saves v27. The careful test player trades there only to stay fed or to swap the transponder. Over 100 seeds the miner meets the hunters in 45 runs (48 in M33, main's 35 before it); on seeds 1 to 30 in 15, one over the limit above (PROGRESS.md, the fixes' known issues).
  - **The record put right:** which stations are whose was my call, not Evan's, though M33's known issues and §9 said the names and the 10 heat were both his picks; and in act 1 the smuggler's standing can fall (its customs jobs are against the Fleet), where M33's known issues said it moved only on the run.
  - **The Fleet's wave** moved from §9 into M33b's draft Done when.
- [x] **M33b Quests.** A background's story ends at the launch: from then on it is its pursuer's ships, words and raiders (§9). The sides remember the crew since M33, but what they give is a price, a job's pay or a patrol's greeting, and no test voyage is waved through: Fleet standing rises only when the crew lends the Fleet's tender a hand, and the careful test player raids her stores instead.

  Evan's picks (2026-10-16), each the recommended option:
  - **Scope:** each background's thread, a step in each act, and one side's chain, the Fleet's, started at its tender: the way to the wave (M33's fix moved it here). The union's, Con-Reg's and the Hallorans' chains go to §9.
  - **A thread's pay-off,** at the colony: the pursuer eases off. From then on its raids find the colony at half the odds, heat falls 30 at once, and standing with its side rises to cold.
  - **A missed step:** the trail goes cold. A step not done in its act ends the quest; Launch, and leaving the last sector, say so first.
  - **The miner's voyages** (the M33 fix's known issue): on to quests. M33b is measured against the fix's numbers, and the gap past the charts stays in §9.

  Measured before settling this (`tools/voyage.js`, 100 voyages from each start): the patrol's corvettes come in 17 to 21 voyages, in sectors 3 to 5; the Fleet tender in 50 to 56, and the careful test player raids her stores every time. Started friendly with the Fleet, the miner's voyages are waved through 27 times, in 23 of them, and the smuggler's 26 times in 22; fed, met the hunters and runs with a raid lost each move 5 runs or fewer.

  **Done when:**
  - **Quests as data** (`data/quests.json`, validated): each has a name, a line, its steps in order and its pay-off. A thread is a background's and starts with its campaign; the Fleet's chain starts at a choice of the Fleet tender's. Each step belongs to an act and is done there:
    - **act 1, a job:** a contract of the quest's own (`quest` in `data/contracts.json`, never in the board's rotation), on the board above its three jobs while the step is open. Its fight's seed comes from the campaign's seed, so the board's own rolls are as before. Done, the step is; lost, it is on the next board again;
    - **the run, an event:** an event of the quest's own (`quest` in `data/events.json`, never in a sector's pool), put on a node of its kind in each sector the ship enters while the step is open, on the charts with the quest's mark. Its choices say which do the step; left, it is in the next sector again;
    - **the colony, a place:** a place of the quest's own, within reach beside the others until the step is done, its ship held by the pursuer's men: a fight aboard her, as at a derelict the scavengers hold. Lost, the crew comes home hurt, and she is still there.
  - **The threads** (each step's numbers in the data):
    - **The miner's debt:** Rook's job, losing the debt's paper at Depot 4 (heat −20); Con-Reg's courier with the paper filed again (heat −15); Con-Reg's claims tender, held by Recovery.
    - **The deserter's pardon:** Mother Ilse's job, a clerk losing the warrant at the brig (heat −20: the Provost's lever, in place of a payment, §9); the Resolute, the deserter's old tender, short of spares (the Fleet +4, heat −15); the Provost's courier, held by its MPs.
    - **The smuggler's cargo:** Ferris's job, eleven of the forty crates out of the customs pound in the Narrows (heat −20); the other twenty-nine, adrift where they were dumped (the Hallorans +4, heat −15); the Hallorans' runner at their drop, held by collectors come for the rest.
  - **The pay-off:** the colony's place won, the pursuer eases off: the odds of it finding the colony are half (`easedOdds`, rounded as they are), heat falls 30, and standing with its side rises to −5 if it is lower.
  - **The Fleet's chain:** lending the tender a hand (+2 with the Fleet) starts it. Its step is the tender's stolen stores pod, in the sectors after: tagged for the Fleet, the Fleet +4 and a finder's fee, and the chain is done; stripped, the stores are the crew's, the Fleet −2, and the chain goes cold.
  - **The trail goes cold:** a step not done in its act ends its quest, act 1's at the launch and the run's as the ship leaves the last sector. Launch's first tap and the last jump point's leave plan name the quests they would end.
  - **Shown** (Law 4): the quests, each with its steps done and the next, or done, or gone cold, at the hangar, on the chart and at the colony; on the board, the quest's job with the quest's name; on the chart, the quest's node marked and named from afar; at the colony, the quest's place marked; each step where it is done (the fight's end, the event's result, the trip home), with what it gave; the pay-off with what changed, and the halved odds in Next day's first tap.
  - **Saves:** `SAVE_VERSION` 28, with a migration from 27: a campaign gets its background's thread at its act's step (act 1's job; the run's event, from the next sector; the colony's place), none gone cold; the Fleet's chain not started.
  - **Every rule tested:** each kind of step done and missed, the cold rule at both edges, the pay-off (the odds, heat and standing), the Fleet's start and both ends, the quest's job off the rotation with the board's rolls as before, the event's placing (seeded, on the charts, again in the next sector), the place kept until done, the migration, and the validator's checks.
  - **The test players:** act 1's takes the thread's job by its worth (the heat at a payment's price) and before launching in any case; the voyage's goes to a quest's node where its way allows, makes the step's choice, lends the tender a hand where the Fleet's chain would leave the crew friendly with the Fleet, and flies to the colony's quest place.
  - **Balance:**
    - **Act 1** (`tools/run.js`, 50 runs from each start): every run launches with its thread's job done, and each slow median is within 10 minutes of the M33 fix's (42, 40 and 45).
    - **The voyage** (`tools/voyage.js`, 100 runs from each start): fed, met the hunters and runs with a raid lost each no worse than the M33 fix's over the same 100 seeds (fed 84, 88 and 92; met 45, 36 and 18; lost 25, 11 and 14) by more than 15. Drafted as 30 runs within 5 of the fix's (fed 26, 27 and 27; met 15, 10 and 5; lost 6, 1 and 5), which the miner's fed missed (19); Evan's call at the end of M33b (2026-10-16): 100 seeds, as the voyage tests since M31, since the quests change act 1's jobs and with them every voyage's rolls, so seeds 1 to 30 compare unrelated voyages. Each thread's steps done in each act, the Fleet's chain, and the raids before and after a pay-off are reported (`--background all`). The careful test player is waved through by a patrol in some voyages. The voyage tests pass, a check new content breaks turned into a rate over 100 seeds (CLAUDE.md), and M30's check of each start against main's held no worse than main's, not about the same (Evan's call, the same day: the deserter's thread takes 35 heat off a pursuer who takes no payments).
  - **Touch,** at the three sizes:
    - a thread's job on the board, done, and the quests after;
    - Launch's warning with it undone;
    - the run's quest node on the chart, and its event done;
    - the tender lent a hand, and the Fleet's chain with the quests;
    - the colony's quest place, flown to and won, and the halved odds after;
    - a quit and reopen that keeps the quests.

  As built (2026-10-16), where it differs from the above (§4.10 has the whole):
  - **The places' crews:** each pursuer's ship holds her own boarding crew of three: Recovery's, the collectors, and at the Provost's courier its patrol of two MPs. The colony's raiding parties, first written (three to five fighters), were harder than a derelict; with the courier's boarding party (two MPs and a rating) the deserter won 24% of its fights there, and with the patrol 58%, against 61% at the hulks the squatters hold.
  - **The Resolute's spares** cost 20 credits. At 40 the run's step went cold in 26 of 100 deserter voyages, the ship short of the credits; at 20, in 8.
  - **The test players:** act 1's prices the step's heat at the pursuer's payment (the deserter's, whose pursuer takes none, at the cheapest any pursuer takes). The voyage's counts a choice that does a step at 40 credits and one that ends it at −40; on the way a quest's node counts at the share of the act's sectors gone, all of it in the last; it lends the tender a hand only while the holds keep 4 jumps' worth after it, its buffer; and it flies to the colony's quest place first of the held.
  - **Measured over 100 seeds,** by Evan's two calls above.
- [x] **M33c Companions.** Everyone aboard is the captain or a hand off a station's board: a recruit is a name, a background's line and numbers, and nobody has a story of their own. The sides have chains waiting in §9, and the Fleet's tender chain ends in a fee.

  Evan's picks (2026-10-16), each the recommended option:
  - **Four companions, one for each side,** met on the run at that side's event: the Fleet tender, the co-op barge, the survey skiff and the Halloran drop. The Fleet's tender chain is the Fleet companion's, and the union's, Con-Reg's and the Hallorans' chains, in §9 since M33b, come now.
  - **They come aboard at the chain's end,** given a free berth, as a recruit needs one. Their loyalty quest follows.
  - **Loyalty earns their talent past rank 2:** a third rank of their job's order, with numbers of their own.
  - **The loyalty quest is a place at the colony:** a ship held by someone from their past, as a thread's act 3 step.

  Measured before settling this (`tools/voyage.js`'s test player, 50 voyages from each start):
  - every test ship launches with exactly one spare berth (30 of 30 from each start);
  - no crew member dies: campaign fights have no permadeath;
  - the voyage meets at least one of the four side events in 45, 46 and 50 voyages of 50, two or three in most;
  - it meets one before the act's last sector in 27, 27 and 30 of 30;
  - the test player signs on a recruit in 3, 4 and 26 voyages of 50;
  - by the colony's last day the crew are mostly at rank 1, a third to two fifths at rank 2.

  **Done when:**
  - **Companions as data** (`data/companions.json`, validated): four, each with a name, a side, a job, two traits, three fights stood (rank 1), a look (their face, drawn as the portraits have been since M23c until M34's pictures), a past of a few lines, and a talent: their job's order at a third rank, with numbers of their own past rank 2's.
  - **Each joins through their side's chain** (`data/quests.json`):
    - **The chain starts** at a choice of the side's event;
    - **its step** is an event of the chain's own in the sectors after, as the Fleet's stores pod is;
    - **a choice there does the step and brings the companion aboard,** as a recruit at no fee. It needs a free berth (`crew.js` crewRoom);
    - **another choice does the step without them.** Left, the step is in the next sector again; not done by the last sector, the chain goes cold, as any run step.
  - **The four** (names, jobs and words my call, all data):
    - **The Fleet's,** on the existing chain: the tender's bosun, an engineer, asks to come once the stolen stores pod is tagged.
    - **The union's,** started by paying into the strike fund: a docker and shop steward, a quartermaster, riding a striking hall's food run.
    - **Con-Reg's,** started by towing the survey skiff: the junior surveyor let go for logging the tow, a scout, adrift in a company lifepod.
    - **The Hallorans',** started by calling the drop in: Old Halloran's nephew, the family's medic, on a runner limping home.
  - **Loyalty:** a companion aboard has a loyalty quest from the day they join, with one step:
    - **the step is a place** of its own within reach of the colony, a ship held by someone from their past: a fight aboard her, as at a thread's place;
    - **won, they are loyal:** their order is at a third rank, past rank 2, in every fight after;
    - **let go before then,** the quest ends.
  - **Shown** (Law 4):
    - a companion's face, name, side, job and past where they offer to come aboard and on their crew card;
    - the chain's choices saying who comes aboard and that it takes a berth;
    - the Quests panel with each chain and loyalty quest;
    - the loyalty place marked at the colony, with who holds her;
    - loyal: the third rank on the crew card and in fights, in the order's numbers, and the fight's end saying so.
  - **Saves:** `SAVE_VERSION` 29, with a migration from 28.
  - **Every rule tested:**
    - each chain's start and its step done with the companion (with a berth and without) and without them;
    - the step left, and gone cold;
    - the loyalty quest's start, its place and the win;
    - the third rank in a fight;
    - a companion let go;
    - the migration and the validator's checks.
  - **The test players:** the voyage's starts a chain where the start's price leaves its buffer, brings a companion aboard where a berth is free, and flies to the loyalty place at the colony as to a quest's.
  - **Balance:**
    - **The voyage** (`tools/voyage.js`, 100 runs from each start): fed, met the hunters and runs with a raid lost each no worse than M33b's over the same seeds (fed 73, 90 and 98; met 37, 21 and 14; lost 21, 13 and 11) by more than 15. Each companion met, aboard and loyal is reported (`--background all`).
    - **A talent's third rank** is measured in the fight harness (`tools/sim.js`) against rank 2, for each of the four.
    - **Act 1** is untouched: no companion comes before the launch.
  - **Touch,** at the three sizes:
    - a side's event starting its chain;
    - the chain's step, the companion offering to come aboard, and aboard;
    - their crew card;
    - the loyalty place at the colony, flown to and won;
    - the third rank in a fight;
    - a quit and reopen.

  As built (2026-10-16), where it differs from the above (§4.11 has the whole):
  - **The test players** start a side's chain and sign its companion on only where the holds would feed them for 10 jumps, as they sign a recruit on, and one side's chain at a time; they still start the Fleet's where it would make the Fleet friendly, for its patrols' wave, as in M33b. Signing on wherever a berth was free, and starting every chain whose price left the buffer, 100 voyages from each start ended fed in 47, 53 and 81, against M33b's 73, 90 and 98: a fourth mouth empties the miner's and the deserter's 30 supplies in 7 jumps (the smuggler's ship carries 60 or 70), and the steps' detours cost more. Evan kept the stricter rule (2026-10-16, "Keep stricter rule").
  - **The crew card opens at the colony too:** the colony had only a list of names, and a companion turns loyal there.
  - **The choice signing a companion on says what the crew eats with them aboard,** as a recruit's sign-on does.
  - **A loyal companion's rank shows as the third** on the crew card, the squad picker and the crew panel's rows, as in fights; their job's next rank by fights is named for what it gives ("Running repairs at 8"), and reaching it says the same, without the order: their talent has it already.
- [x] **M34 Scenes and companions, drawn in code.** The title is stars and words, the lift-off and the landing show the ship over the same starfield whichever world it leaves or reaches, and the four companions wear the same helmet badge as any recruit. The draft named Base44 paintings for these.

  Evan's picks (2026-10-17):
  - **No Base44 in M34:** the scenes are drawn in code by the game's own renderer. Painted art, store art first, waits for later (§3: Base44 at development time only).
  - **Which:** the title's backdrop (the hangar), the lift-off's (the grey rock below) and a landing backdrop for each kind of world (ocean, desert, ice, jungle, barren rock); and the four companions' portraits. The districts' clients wait for Phase 7.
  - **The companions, redrawn richer in code:** a bust of their own, in more detail than a recruit's badge, big where they offer to come aboard (about 100 px on the event card); cropped to the face at 40 px on the crew card and the squad pickers; the fight's buttons keep the helmet badge, as every crew member's figure in a fight is suited.
  - **The look:** painted, my call: a dark navy ground, with amber and cyan rim light from the palette.

  **Done when:**
  - **Scenes as data and drawings** (`src/render/scenes/`): each scene a pure function from its id and a seed to plain shapes (paths, ellipses, gradients and glows), the same seed drawing the same; a painter draws the shapes on the canvas. Colors come from palette tokens. Seven scenes: the hangar, the homeworld's grey rock and the five kinds of world. Act 1 names the lift-off's scene in `data/campaign.json`, and each kind of world its landing's in `data/worlds.json`, checked by the validator; a kind without one takes barren rock's.
  - **The title** stands over the hangar, its words and buttons as readable as over the stars: a contrast of at least 4.5 to 1 between the words and the scene behind them, measured in the browser.
  - **The lift-off:** the ship lifts off the grey rock: the ground close under it on the pad, falling away as it climbs, and the rock seen whole, a world below, as it flies off.
  - **The landing:** the same run backwards over the world settled, by its kind: the world seen whole as the ship comes in, its ground rising to meet it, and the ground under the ship at rest, in the colony's colors for that kind (M26).
  - **Reduced motion** shows the still moment: the ship on the pad over the rock, and at rest on the world's ground.
  - **Frame budget:** a scene is painted once a size into an offscreen canvas; a frame of the lift-off or the landing only draws it, scaled and faded, then the ship. Timed in the browser, a scene adds under 2 ms a frame at the three sizes.
  - **The companions:** each of the four drawn as a bust of their own (`src/render/portraits/`): their face from their look, bareheaded, with clothes and gear of their own named in data (`bust` in `data/companions.json`, its choices drawings in code, checked by the validator), in the painted look. About 100 px beside the event's words where they offer to come aboard and once signed on, the choices still in sight; cropped to the face at 40 px on the crew card and the squad pickers; the fight's buttons keep the helmet badge. Everyone else's portrait is as it was.
  - **Saves:** unchanged at v29: the scenes and the busts come from what a save holds already, the world's kind and the companion's id.
  - **Offline:** nothing new to fetch; only code changes in the cache.
  - **Every rule tested:** each scene drawn the same from the same seed, inside its frame, from palette colors; every kind of world with its scene; the busts the same each time, each companion's own, and their face crop; the validator's new checks.
  - **Touch,** at the three sizes: the title's buttons over the hangar; the lift-off; the landing on each kind of world; the event card's bust beside the words with every choice in sight; the face crops on the crew card and the squad picker; reduced motion; no console errors.
  As built (2026-10-17), where it differs from the above or adds to it:
  - **The scenes** (`src/render/scenes/`): `shapes.js` (the shapes and a seeded roll), `ground.js` (the six grounds from above: the homeworld's pad by its hangar, and each kind of world's, from the colony's land for that kind), `world.js` (each world seen whole, rising from the lower right), `hangar.js` (the title's), `paint.js` (the painter, and the backdrop's moment) and `scenes.js` (the ids, and barren rock's for one not drawn). Soft shapes are painted on a smaller layer and laid back, as canvas blur cost seconds a scene; a scene paints in 15 to 130 ms here, once a size. Palette tokens: `sceneColors`, `bustColors`.
  - **The title:** the hangar's bay door is cut out of its picture, so the title's sky and its moving stars show through. Its tag line is now in full ink and shadowed, and the note New game's first tap shows sits on a ground of its own, as the buttons do: where the floodlights cross and over the lit hull they read at 3.4 and 2.1 to 1. Measured on the canvas, all but the brightest 1% of the pixels behind the words (stars drifting by): 7.1 to 1 or more at the three sizes.
  - **A frame of the lift-off or the landing draws only what shows:** the ground alone while it covers the screen, the world alone once it has gone; while covering ground fades, the ground whole and the world over it at the rest, the same picture for less. A ground in motion is scaled without smoothing, five times cheaper where the browser draws on the processor and hardly told apart on ground this soft; at rest it is smoothed.
  - **The frame budget, timed in Chromium on this machine** (software drawing; each frame finished with a one-pixel read so the time is the drawing's): against main's space behind the ship, which the scene takes the place of, the backdrop costs 2.1 to 8.2 ms a frame less at the three sizes (95th percentile 1.3 to 5.2 less). Against a bare frame, a frame in motion costs 1.3 to 2.4 ms on the cover screen's two shapes (95th percentile 1.2 to 1.9) and 2.8 to 3.6 unfolded (3.6 to 5.8): a full-screen copy alone is 0.9 ms there. The still frame, smoothed and drawn once, is 2.6 to 4.1 ms, and 9 unfolded. The title's hangar adds 0.4 to 1.4 ms. The lift-off keeps 60 frames a second at the three sizes. Evan kept the first reading, against main's frame (2026-10-17, "Keep the first reading, merge when green").
  - **The busts** (`src/render/portraits/bust.js`): the face (face.js) a fifth smaller on broad shoulders, in clothes and gear whose choices are its drawings (`WEARS`: coverall, dockcoat, surveyjacket, medcoat; `GEAR`: goggles, armband, headset, stethoscope), the side's color on a patch or the gear, and the rim light an SVG filter round the whole figure. Varga in a coverall and goggles, Brandt a dock coat and the union's armband, Osei a survey jacket and headset, Dez a medic's coat and stethoscope.
  - **The event card** sets the bust beside its scrolling words, out of their scroll, `clamp(64px, 26vh, 104px)`: 74 px on the cover screen's short shape, 96 at 905 × 370, 104 unfolded. On the short shape a first tap's odds and the result scroll the words, and the bust stays in sight.
  - **The tag line's words:** "Early build: from the hangar to the colony." Act 3's words ahead: "Three backgrounds are here, each with its own pursuer. Still to come in v0.4: sound."
- [x] **M35 Audio pass with ZzFX.** The game is silent, and the settings have no switch for sound (M18 cut it until there was audio). The draft: sounds made in code with ZzFX (approved for M35): shots and hits, the builder's placing, and the menus; a mute and a volume in the settings; audio starts after the first tap.

  Evan's picks (2026-10-17), from an audition page of three styles (soft, arcade and gritty), each with the same 14 moments, loudness-matched as a phone speaker plays them:
  - **Where:** all of the draft, plus the campaign's moments: the fights, the builder and the menus; then the jumps, the raid and hunter alarms, the lift-off and the landing.
  - **The style, a mix:**
    - **gritty** for the fights and the campaign's moments: hiss, crunch and clank, cracks with a slap of echo, a klaxon for raids;
    - **soft** for the menus and the builder, which play most often: rounded tones.
  - **On at 70%,** for a new game and for a save from before.
  - **One volume and a mute** in the settings.

  **Done when:**
  - **ZzFX in the repo:**
    - version 1.3.2 by Frank Force (MIT), as published, in `src/platform/zzfx.js`, with its line in `assets/LICENSES.md`;
    - loaded with the sounds on the first tap and never before: no AudioContext until then, and none while sound is off;
    - precached, so sound works offline.
  - **Sounds as data** (`data/sounds.json`):
    - each sound is its ZzFX parameters by name, checked by the validator;
    - each weapon names its shot's sound in `data/weapons.json`, checked too;
    - a new sound, or a weapon's own, needs no engine edit.
  - **Heard on the phone, never clipping:**
    - each moment is as loud as on the audition page, measured through a phone speaker's low end (`tools/sounds.js` reports each sound's length, peak and loudness);
    - every sound renders in Node: finite, under 2.5 s, and peaking under 0.9 at full volume.
  - **The menus (soft):**
    - a tap on any button;
    - a confirm where something is spent or settled (buying, selling, hiring, taking a job, paying);
    - a refusal on a button that can't be used now, and wherever the game says no;
    - one sound per tap: the one that says most.
  - **The builder (soft):** a part placed, turned, moved or taken off; a refusal where it can't go.
  - **The fights (gritty):** in step with the playback, on the enemy's turn as on the crew's:
    - each shot, as its weapon's sound;
    - a hit or a miss as the shot lands;
    - a unit going down or dying;
    - an order, a door, a reload.
  - **The campaign (gritty):**
    - a jump;
    - the alarm as a raid is due at the hangar, as the hunters are found waiting, and as a raid comes at the colony;
    - the lift-off;
    - the landing.
  - **Settings:**
    - Sound, on or off, and Volume, at 10, 30, 50, 70 or 100%, both saved;
    - the next sound plays at the new volume;
    - `SAVE_VERSION` 30, with a migration from 29: a save from before gets sound on at 70%.
  - **The dev menu** plays each sound, to hear the whole set on the phone.
  - **Every rule tested:**
    - the settings and their migration;
    - the sounds a change of state makes (the builder, the menus, the campaign);
    - the fight's sounds from the playback;
    - the validator's checks;
    - every sound rendered.
  - **Touch,** at the three sizes:
    - no AudioContext before the first tap, and none with sound off;
    - a tap's sound;
    - the settings' rows;
    - a fight's shots and the builder's place;
    - offline after a reload;
    - no console errors or warnings.

  As built (2026-10-17), where it differs from the above or adds to it:
  - **ZzFX** is 1.3.2 as published, its line endings LF as the repo keeps every file (`.gitattributes`). ZzFX scales a sound by its own volume (0.3) as it builds it and again as it plays it, about 0.09 in all: too quiet for a phone. The game builds each sound once with ZzFX and plays it through a gain of its own at the player's volume, so 100% is the sound as `tools/sounds.js` measures it; the loudest peaks at 0.73. Each play strays in pitch by the sound's randomness, as ZzFX's own plays do (`Math.random`, outside `src/sim/`).
  - **19 sounds:** the audition's 14 in the picked styles (soft: tap, confirm, refuse, place, turn, remove; gritty: shot, shotgun, hit, miss, down, order, jump, alarm), and five more in the gritty style that the audition didn't have: the dart gun's shot, a door, a reload, the lift-off's roar and the landing's. Each sound says how loud it is meant to be, and a test holds every one within 1 dB of it.
  - **Heard on the phone, to judge:** a ZzFX echo runs back through the sound's filter, whose peak (Q 2) lets it build. The gritty shot's and shotgun's tails are about 8 dB stronger than they would be without the filter. They are kept as Evan auditioned them; the five new sounds use an echo or a filter, never both.
  - **Which moment plays which** (`src/ui/sounds.js`, pure and tested):
    - the game's store, the builder's session and a fight's session each make the sounds of their changes;
    - a fight's playback says when each of its events sounds (`cuesBetween`, `src/render/playback.js`);
    - `onTap` taps, or refuses on a button that is off.
  - **Beyond the list:**
    - an approach's round sounds the ships' guns, then whether the crew's volley hit, and a flight that got away jumps;
    - the colony's building by hand places, moves and takes down;
    - a trip out, on or home jumps.
  - **One tap, one sound:** what one tap cues plays one sound after another, its own tap giving way to any other. What the screens dispatch themselves is silent: rolling the board as they open, construction following the builder, a fight saving its every order.
  - **The lift-off's roar** starts with its sequence. **The landing's** starts 2.3 s in, as the ship starts down over the ground, to die as the engines do. With reduced motion each still plays once; a skipped landing plays none.
  - **The settings:** Sound and Volume are the first two rows, where a player looks for sound.
  - **The dev menu** plays each sound, and its status line says how sound stands and what played last.
  - **Act 3's words ahead,** as at M29's close: "All of v0.4 is here, sound included. Still to come in v1.0: balance, a tutorial, and the release on Google Play." (§6's v1.0.)

**Gate 6:** v0.4 plays on the phone: each of the three backgrounds from New game to the colony, with its own pursuer, the sides, quests and companions, the painted scenes, and sound; and Evan wants to keep going. ROADMAP named no gate for Phase 6; this one was drafted at M35's close. **Passed 2026-10-17** ("Merge and continue", then "Yes: Gate 6 passed"). v0.4 is done.

### Phase 7: Content and balance

Rosters, balance runs, difficulty settings, accessibility (a colorblind-safe palette, text size), and tutorial polish.

Detailed at the start of M36, once v0.4 was done. The rosters come first, so the balance runs measure the game with its content in. The Done whens past M36 are drafts, to settle as each milestone starts.

- [x] **M36 Events.** The run's nodes and the colony's places hold 29 events, 7 of them the quests' steps. Over 30 careful voyages from each start:
  - a voyage meets 11 to 13 events on the run at the median, 2 to 3 of them for the second time (up to 6);
  - only 16 to 19 different events ever come up on the run;
  - a colony's 30 days of trips meet 2 to 4 of their place events for the second time (up to 7).

  A choice can need credits, supplies, parts or a berth. An outcome moves credits, supplies, heat, materials, standing, wounds and parts.

  Evan's picks (2026-10-17):
  - **First in Phase 7:** events, the content furthest behind §5's v1.0 column (100 or more).
  - **How many:** 100 in all, about 70 new.
  - **New kinds,** all four offered:
    - choices only someone aboard can take, by job or trait;
    - each background's own;
    - traps that start a fight;
    - events that wreck or mend the ship.

  **Done when:**
  - **100 events** in `data/events.json`, the quests' 7 among them:
    - on the run: derelicts 12, distress calls 12, traders 10, hazards 11 (45; 14 before);
    - each background's own, 4 on its runs (12);
    - at the colony's places: hulks, wreckage, rocks and planets, 9 each (36; 8 before);
    - written as today's are: short and dry, each choice saying what it risks.
  - **A choice can need someone** (`needs.job`, `needs.trait`): on the run anyone aboard, at a place the squad there.
    - The choice names who would take it.
    - One no one can take says who it needs.
    - Every job, and at least 8 of the 20 traits, is needed by some choice.
  - **A background's own events** (`background`) come only on its runs.
  - **Traps** (`ambush`): an outcome that starts a fight.
    - On the run, a hostile ship's approach at the node, against the preset the event names, the enemy firing first (the patrol's opening volley, M33).
    - At a hulk, the scavengers were waiting: the place is held, and the squad's fight is a held place's (M28).
    - At least 6 traps on the run and 2 at hulks.
  - **The ship hurt or mended** (`wreck`, `repair`):
    - wrecks by roll among the working parts, as a volley's, with the reactor and the engine jury-rigged as after an approach;
    - repairs the dearest wreck first;
    - at least 4 events that wreck and 4 that repair.
  - **Fewer repeats:**
    - An event settled once doesn't come again in the campaign while its kind has others left: the run's later sectors and the colony's places draw from the rest.
    - The places listed together don't share one.
    - `SAVE_VERSION` 31 keeps the events met; a save from before starts with none met.
  - **The test players** take the new choices where they're worth most: who is aboard, what a trap risks, what a wreck costs to repair.
  - **Measured** over 100 voyages from each start:
    - each of the voyage tests' rates within its margin of main's (`MAIN`, `tests/voyage.test.js`): fed, met the hunters, the colony's raids;
    - no event met twice on the run in 9 voyages of 10, and none twice at the colony in 9 of 10.
  - **Every rule tested:**
    - the needs;
    - a background's draw;
    - a trap on the run and at a hulk;
    - a wreck and a repair;
    - the events met, and their migration;
    - the validator's checks.
  - **Touch,** at the three sizes:
    - a choice by job that names who would take it, and one no one aboard can take;
    - a trap's approach, the enemy's volley first;
    - a wreck and a repair in a result;
    - a hulk's trap and its fight;
    - offline, and no console errors.

  As built (2026-10-17), where it differs from the above or adds to it:
  - **The content:** 71 new events, the 29 before unchanged. Needed by some choice: all seven jobs, and 10 traits (Old hand, Cool head, Hothead, Careful, Steady hands, Patient, Shift fit, Bruiser, Quick feet, Jumpy). Traps: 6 on the run, the three backgrounds' own among them, and 2 at hulks. Wrecks in 7 events, repairs in 8.
  - **Who takes a choice:** the first in the crew's order with the job and the trait (at a place, in the squad). A wound that isn't everyone's falls on them while they have more than 1 hit point, else by a roll as before. The card names them under the choice ("Quill Petrov · 80% · 20%"), and the first tap says "Quill Petrov takes it."
  - **A choice can need wrecks aboard** (`needs.wrecks`), for the repairs that are sold: "Nothing on the ship is wrecked."
  - **A trap on the run** names the preset, rolled from the campaign's RNG as a hunt's is. Its approach says "A trap · Pirate cutter" over the event's own words. The event settles its node, and once the approach is put away, the event's card says "A trap: a Pirate cutter fired first."
  - **A trap at a hulk** leaves the place held, its event spent, and the squad still there: board her, or fly home and leave her, as at any held place.
  - **A wreck** lists each part it hit, and then the one the crew got going again ("Wrecked: the Reactor (open to vacuum). The crew gets the reactor going again."). **A repair** names, in the odds, the dearest wrecks it would mend.
  - **The pools** (`src/sim/eventPool.js`): a sector's nodes and the places listed together draw from the kind's events not yet met, and not already drawn there. Only when every one has been met do they come again. `campaign.eventsMet` keeps up to 500.
  - **Tuned after measuring** (PROGRESS.md has the numbers): the chandler sells stores, going dark in a solar flare and threading a minefield shed heat, and five new events pay a little more. The test player now spends credits at an event only beyond a holdful's price, as it already did at stations, but on supplies or a quest's step.
  - **The voyage tests:**
    - the run's events count over 100 seeds: on seeds 1 to 30 the tinker's barge never came up;
    - the step-by-step check also walks the deserter's runs, where station repairs come up (none on the miner's seeds 1 to 30 since M36; one of 210 on main);
    - a new test holds the repeats and the backgrounds' own events to the Done when.
  - **The golden sectors** (`tests/golden/sectors.txt`) were regenerated on purpose: the same maps and kinds, with the events, the hostile ships' seeds and the names drawn anew from the new pools.
- [x] **M37 Weapons and enemies.** Six weapons against §5's 15, and 15 enemies against 15 to 20.
  - **Who carries what:** a crew member carries their job's weapon, always; an enemy its type's. The new weapons would come only through enemies.
  - **The weapons are plain numbers:** damage, accuracy at each range, crit and clip. They differ a lot. AI against AI, the whole squad carrying one weapon, the crew wins:

    | Weapon | Aboard ships (600 fights) | On job sites (360 jobs) |
    | --- | --- | --- |
    | Shotgun | 78% | 78% |
    | As issued | 51% | 66% |
    | Rifle | 33% | 64% |
    | Long rifle | 24% | 63% |
    | Carbine | 23% | 55% |
    | Pistol | 13% | 54% |
    | Dart gun | 3% | 36% |

  - **Why:** aboard ships 58% of shots are taken close (3 tiles or under) and 3% long; on the job sites 37% close and 22% long. The shotgun is best everywhere, hidden only because the job fixes who carries it (the engineer).
  - **The enemies,** four of a type against the start squad aboard ships: the crew beats collectors and scavvers 91% of the time, pirates, claim jumpers and Pike soldiers 78%, ratings 62%, agents 49%, cadets 43%, guards 35%, customs officers 29%, dockers 21%, brutes and heavies 7%, enforcers 4%, MPs 3%.

  Evan's picks (2026-10-17):
  - **Loadouts by job:** each crew member carries one weapon, their job's to start. Each weapon is a sidearm, a long gun or a heavy weapon, and each job carries some kinds. Spares are kept aboard and swapped between fights.
  - **New rules, all four offered:** bursts, armor piercing, a stun at arm's reach, and fire.
  - **Five new enemy types,** one for each side.
  - **Where weapons come from, all four offered:** act 1's shops, won fights, events, and racks at stations.

  **Done when:**
  - **15 weapons** in `data/weapons.json`, the six before unchanged in their numbers. Each has:
    - its kind (`kind`): sidearm, long gun or heavy;
    - its numbers and its price (`cost`);
    - its held look (`held`): its shape and, on the new ones, a fitting of its own (a drum, a scope, coils, a fuel tank, prongs or a nail box), checked against what can be drawn;
    - its shot's sound, five of them new (a burst's rattle, a rail's crack, a rivet's thunk, a torch's roar, a baton's snap), each at its loudness (`tools/sounds.js`).
  - **The nine new weapons:**
    - sidearms: a machine pistol (bursts), a shock baton (stuns, at arm's reach) and a sawn-off;
    - long guns: an autogun (bursts), a rail rifle (pierces armor) and a marksman's rifle;
    - heavy: a rivet gun (pierces armor), a cutting torch (fire) and a riot gun.
  - **The rules,** each a weapon's data, so a new weapon needs no engine edit:
    - **Bursts** (`burst`): a shot is a burst of that many shots at the target, each rolled on its own at the shown odds with the burst's aim penalty as a part of them, each a round. It stops when the target drops. Overwatch fires one shot without the penalty.
    - **Armor piercing** (`pierce`): that much of the target's armor doesn't count against the damage.
    - **Reach** (`reach`): no shot past that many tiles, by a side or a corner (overwatch too). The baton reaches 1, the torch 2.
    - **Stun** (`stun`): a hit puts the target to sleep through its side's next turn, as Sedate does.
    - **Fire** (`burn`): a hit sets the target's tile burning for that many rounds, burning as a wrecked room's fire does: 2 at the start of each of a unit's turns there. Burning tiles show on the board, and the fire goes out on its own.
    - Each shows on the odds card and the unit's card, in the numbers rolled (Law 4).
  - **Loadouts:**
    - jobs carry kinds (`arms` in `data/jobs.json`): a medic and a xenobiologist sidearms; an engineer sidearms and heavy; a pilot and a scout sidearms and long guns; a marine and a quartermaster all three;
    - a crew member's weapon is saved with them; spares are on hand (`campaign.arms`);
    - swapping takes two taps on the crew card, at any time but in a fight, from the spares of the kinds their job carries;
    - a recruit and a companion come with their job's weapon, and a crew member let go hands theirs in;
    - Sedate needs a dart gun in hand.
  - **Where weapons come from:**
    - **Act 1's shops:** each district's dealer stocks 2 weapons beside its 4 parts, rolled with the board from a table of its own, and buys any spare at half price.
    - **Won fights:** a won job, raid, boarding or hulk can leave one of the fallen enemies' weapons, by a roll (`gearChance` in `data/balance.json`). The odds show where the fight's stakes do, and what it left shows at the fight's end.
    - **Events:** derelicts' lockers and the colony's hulks give weapons, and traders on the run sell them (`arms` among an outcome's effects).
    - **Stations' racks:** each station sells 2 weapons, the same on every visit, at its side's prices. One bought is gone from the rack.
  - **Five new enemy types,** each carrying a new weapon and joining a party or two of its side's:
    - the pirates' gunner (an autogun);
    - the scavvers' torcher (a cutting torch);
    - Con-Reg's breacher (a rivet gun);
    - the Provost's proctor (a shock baton, in riot armor);
    - the Hallorans' cutter (a machine pistol).

    Each has its look. Each party it joins wins within 5 points of its rate before (the harness, `tools/boarding.js` or `tools/raids.js`), and each pursuer's raids stay within M30's 10 points of Con-Reg's.
  - **The AI and the test players** weigh each rule: a burst's shots, the armor pierced, a stunned target's lost turn, a fire's burns. They close to their reach and keep off burning tiles. The test players carry the best weapon of their kinds for the fight ahead, and buy weapons where the purse allows beyond a holdful's price, as at events.
  - **Every weapon measured** aboard ships, on job sites and against armor (the Provost's patrol), the whole squad carrying it (`tools/sim.js`):
    - each new weapon is within 5 points of the best of its kind in at least one of the three;
    - none is 5 points better than every other of its kind in all three;
    - the six before, and the shotgun's lead, are left for M40's balance runs (§9).
  - **`SAVE_VERSION` 32:** a save from before gives each crew member their job's weapon, with none spare. A fight under way keeps going.
  - **Measured over 100 voyages from each start:** each of the voyage tests' rates within its margin of main's (`MAIN`). Act 1's test runs launch in about as many jobs as main's (the median within 1).
  - **The golden battle logs don't change:** the six weapons before keep their numbers, and the new rules are only the new weapons'.
  - **Every rule tested:** bursts, piercing, reach, stun and fire, in the odds and the rolls; loadouts and their swaps; each source; the migration; the validator's checks.
  - **Touch,** at the three sizes:
    - a swap on the crew card, offering only the kinds the job carries;
    - weapons bought at the shop and at a station's rack;
    - a burst's shots, armor pierced on the odds card, a target out of the baton's reach, a stun, and a fire on the board;
    - a weapon left by a won fight;
    - offline, and no console errors.

  As built (2026-10-17), where it differs from the above or adds to it:
  - **Two weapons hit harder after the table** (PROGRESS.md has it): the machine pistol does 2–4 in bursts of 2 at −10 each (2–3 at −15), and the rivet gun 4–6 (3–5). Before, neither came within 5 points of its kind's best anywhere.
  - **The held looks** have a seventh fitting, the sawn-off's twin barrels (`twin`).
  - **The enemies, tuned until each party was within 5 points** of its rate before:
    - the gunner has 7 hit points and aims 50;
    - the torcher 5 and 45, with no defense;
    - the breacher 6 hit points and no armor;
    - the proctor armor 1, as an MP's, where the Done when had riot armor: with 2, the crew beat the frigate's party at home in 16% of 1,000 fights against 31% before;
    - the cutter 5 hit points.
  - **The breacher joined the recovery party** (the repo tug and the recovery jobs), not the raiders: in the raid party, Con-Reg's raids moved 8 and 20 points.
  - **The test players' weapons** (`tools/arms.js`): each weapon's wins in the table, aboard ships and on job sites, rank them for the fight ahead. They buy a weapon only 20 points better (`GAIN`) than what someone who could carry it has, beyond a holdful's price and a transponder swap's, and value one at an event at a part's worth, a quarter of its price. Bought as the Done when first put it, weapons spent the purse that keeps the hunters off: as many as 22 fewer voyages of 100 crossed fed.
  - **The test harness** (`tools/boarding.js`): a side moving to get an enemy in sight now looks any distance and walks the way there (a boarding stalled with both sides on overwatch out of sight). And once a fight drags, a move must close in: in a raid, a crew member with a torch out of reach and the raiders facing them stepped out and back for 20 rounds.
  - **The voyage tests' two bars,** fed with a cargo hold and with bunks, hold main's rates before M37 (81 and 75; Evan's call, 2026-10-17). On seeds 1 to 100 M37's voyages came to 74 and 68, under the old bars; on seeds 101 to 200 they matched main's.
  - **A station's rack sits in its left panel,** under the transponder swap, not in the foot. Beside Buy, Fill up, Repair and Patch up, its buttons left the hint no room and ran off the tab-size screen, as the transponder swap's had before M24 moved it.
  - **A weapon's numbers show beside the button tapped:** under the crew card's swaps, or under the rack's button. The hint says only what the second tap does. With the numbers and rules in it, it ran past its three lines at the tab size and lost "Tap again to buy."
- [x] **M37b Shipyards.** Evan played the run and found few parts, about 2 in all.
  - **Where parts come from today:**
    - **act 1:** the dealer's 4 a job board, and the jobs' drops;
    - **the run:** events (a choice that can give one in 9 of the 18 derelicts, 3 of the 15 traders, 2 of the 20 distress calls and 1 of the 11 hazards) and boarding wins (1 part stripped off her);
    - **the colony:** its places, its trips and the buildings taken down.

    Stations sell none.
  - **Measured, 100 voyages from each start:** a median of 1 to 2 parts found a run, at events; 0.1 to 0.2 salvaged on average; about 1 fitted.
  - **Money is the real limit:** the median part costs 120 credits (85 to 170 between the quartiles; engines and reactors 130 to 505), and a player at a station holds a median of 58 to 108.

  Evan's picks (2026-10-17):
  - **A shipyard in every sector:** a new kind of station, beside the two stations.
  - **12 parts, every maker:** rolled once a yard, leaning to its side's makers, the same on every visit.
  - **Yard prices and trade-ins:** 60% of the dealer's price, and the yard buys parts back at half their cost.
  - **No more finds elsewhere:** events and boarding salvage stay as they are.

  **Done when:**
  - **A shipyard in every sector of the run** (`shipyard` in `data/sectors.json`), charted and safe as stations are, in a column of its own. Each has a name from a list of its own, and a side or none (`stations` in `data/factions.json`).
  - **Its stock:** 12 different parts (`yardSize` in `data/balance.json`) from every maker, rolled once for the yard from the campaign's seed, the sector and the node, the same on every visit. One bought is gone.
    - **A yard leans to its side's makers** (`yard` on each side in `data/factions.json`): the Fleet's to Bastion, the Hallorans' to Kestrel, Con-Reg's to the Yard's own and the union's to Scrapline.
    - **Nobody's yard** rolls evenly.
  - **Yard prices:** 60% of the dealer's (`yardPercent`), at the side's share of it (M33).
  - **Trade-ins:** the yard buys any part on hand at the dealer's price, half its cost, never above what the yard would charge for that part. A part taken off the ship in a refit goes on hand, to sell.
  - **A refit at a yard,** as at a station.
  - **Trading docks the ship,** with the docking heat at the pursuer's side's yards as at its stations.
  - **On screen:**
    - the yard on the chart, with its mark;
    - a Yard button at the yard, opening the shop screen with its 12 parts and the parts on hand, two taps to buy or sell;
    - Refit on the ship's panel.
  - **The test players** buy parts at a yard that their refit would fit, beyond a holdful's price and a transponder swap's, and refit there.
  - **`SAVE_VERSION` 33:** the parts bought at each yard. A save from before reads with none bought; its sectors from the next on have yards.
  - **Measured over 100 voyages from each start:**
    - parts bought and fitted a run;
    - every voyage-test rate within its margin of `MAIN`.
  - **Every rule tested:** the stock, prices with standing, the buy-back's cap, refits at a yard, docking heat, the migration, the validator's checks. The golden sectors change, on purpose.
  - **Touch,** at the three sizes:
    - the yard on the chart;
    - a part bought and one sold;
    - a refit there;
    - offline, every button 48 px or more, no console errors.

  As built (2026-10-17), where it differs from the above or adds to it:
  - **Empty space weighs 1 in a sector's mix, not 2** (`data/sectors.json`). The yard's column took one of the mixed nodes, and with it events: 9.8 a careful voyage on seeds 101 to 300, against main's 10.8. At 1 they came back to 10.6.
  - **A yard's mark is pink** (`shipyard` in `src/render/palette.js`): a crane over a hull on its slipway. Orange was taken by the rings round what a jump reaches, and by the jump point.
  - **The yard is the shop screen** (`shop.js`), in its own words (`yardText.js`), with Map as the way back. At a yard of the pursuer's side, the first tap says the heat the trade adds.
  - **A day's rest at a yard is out of the hunters' reach,** as the yard is safe. A yard has no Patch up, so Regroup stays.
  - **A quest's step never lands on a yard,** as it never lands on a station or a nebula.
  - **The miner's test player seldom affords a yard's part.** It reaches a yard in 87 of 100 voyages, with a median of 30 credits there, and buys in 9 (16 parts). The deserter's buys in 37 (99 parts) and the smuggler's in 17 (38). The refit bar holds main's rate before M37b (59), as M37's two hold main's before M37: on seeds 1 to 100 the yards' new sectors left 50 runs with a refit, and on seeds 101 to 300 they matched main's (122 of 199 against 119).
- [x] **M38 Missions and jobs.** Three mission types (clear out, grab, hack) against §5's 8, and 29 jobs against 40 or more.
  - **Measured,** each job from its background's start crew at heat 0 with no twist, 200 seeds each, the test crew (`src/sim/jobAi.js`) against the AI:

    | Mission | Jobs | Won | Rounds | Crew hit points lost (of 26) |
    | --- | --- | --- | --- | --- |
    | Clear out | 10 | 46% | 7.5 | 21.0 |
    | Grab | 11, and a quest's | 77% | 5.1 | 13.5 |
    | Hack | 5, and two quests' | 77% | 5.4 | 16.7 |

    The worst are clear-outs: the picket line wins 6%, the dock war 13%, pawn tickets 32%. They are left for M40.
  - **The enemies ignore the objective** (§9, raised in M14): a grab or a hack is a race to the crate or the terminal.

  Evan's picks (2026-10-18):
  - **The draft's five mission types:** extract, escort, defend, sabotage and rescue, 8 in all.
  - **The person brought out** (escort's client, rescue's captive) **is moved by the player, unarmed.**
  - **The enemies play to the objective in every mission,** grab and hack too, with act 1 measured and tuned.
  - **One new job for each new mission in each district:** 15, 44 in all.

  **Done when:**
  - **Eight mission types** in `data/contracts.json`, each with its name and brief. The five new ones:
    - **Extract** (`extract`, with `crates`): grab the tagged crates and carry each out the way the crew came in, to a way-in tile.
      - A crate in hand slows its carrier to one move a turn, no dash.
      - A carrier who goes down keeps it, and anyone beside them can take it (one action).
      - Done when every crate is out.
    - **Escort** (`escort`): the client comes in with the crew and has to reach the far gate, the site's new way-out tiles. Done when they stand on one.
    - **Defend** (`defend`, with `rounds`): hold the way in for that many rounds.
      - Lost if an enemy steps onto a way-in tile.
      - Won when the last round ends, or when no enemy is standing.
    - **Sabotage** (`sabotage`, with `targets`; loud):
      - plant a charge beside each tagged target (one action);
      - it blows at the start of the crew's next turn, hurting everyone beside it, on both sides, by `blastDamage` (`data/balance.json`);
      - an enemy beside a charge can pull it (one action);
      - done when every target has blown.
    - **Rescue** (`rescue`, with `captive`): someone is held deep in the site, on the site's new captive tiles.
      - A crew member beside them frees them (one action).
      - Then they have to be walked out the way the crew came in.
      - Done when they stand on a way-in tile.
  - **The person brought out,** escort's client or rescue's captive (`people` in `data/contracts.json`: hit points, defense, mobility, look):
    - a figure on the crew's side, moved with the same two taps, with no gun: no shot, no overwatch;
    - held, the captive can't be shot;
    - down, they bleed out as crew do and can be stabilized; bled out, the job is lost;
    - they aren't crew: no wounds after, no fights counted, and the crew still wins or loses by its own.
  - **The enemies play to the objective** (`src/sim/ai.js`) in every mission but a clear-out:
    - with no shot worth taking, a guard keeps by what it guards: the crates, the terminal, the far gate, the targets, the captive;
    - a shot at a carrier or at the person brought out counts more;
    - defending, they push for the way in: every plan counts the steps left to it;
    - an enemy beside a charge pulls it, and keeps clear of one about to blow.

    Fights with no objective (boardings, raids, clear-outs) play as before: the golden battle log doesn't change.
  - **The sites:** each of the four map templates (`data/sites.json`) gains way-out tiles (`x`, 2 or more, on the far side from the way in) and captive tiles (`v`, 1 or more, deep in). Each is checked as every mark is: it can be walked to from the way in. The golden sites change, on purpose.
  - **Twists:** the rush job's deadline comes with every new mission but defend, and the other twists with any.
  - **15 new jobs** in `data/contracts.json`, one of each new mission in each district. Each has its clients, sites, encounter, sides, pay, drops and pitch, written as today's are. 44 in all.
  - **On screen:**
    - the job board's brief for each mission;
    - in the fight, the objective under the round: crates out, the client's way, the rounds held, the charges blown, the captive held or freed;
    - tags on the board: the crates, the way out, the targets and their charges, the captive, the way in held;
    - Grab, Free and Plant, shown when in reach;
    - the person brought out in the crew bar, with a face, and a carrier's crate on the unit card;
    - a blast on the board;
    - the fight's end says why it ended: they broke through, the client or the captive was lost, the line held.
  - **The test players** play each mission (`src/sim/jobAi.js`):
    - carriers walk out;
    - the client and the captive move from cover to cover toward their way;
    - charges are planted and left;
    - the way in is held from cover.

    `tools/run.js` weighs each job by the test crew's odds on it (`JOB_ODDS`), measured anew for all 44.
  - **Measured,** each job from its background's start crew at heat 0 with no twist, 200 seeds each:
    - each new job wins 40% to 90% of the time;
    - grab and hack, with their guards, are measured and tuned until act 1's test runs launch in about as many jobs as main's from each start (the median within 1, `tools/run.js --runs 100`);
    - every voyage-test rate is within its margin of `MAIN`, over 100 voyages from each start.
  - **`SAVE_VERSION` 34:** a fight can hold the new objectives, the person brought out, a crate in hand and the charges set. A save from before reads unchanged.
  - **Every rule tested:**
    - each objective's actions, and its end, won and lost;
    - the carrier's move;
    - the blast and the pull;
    - the captive held and freed;
    - the person brought out not counting as crew;
    - the AI's guards, its push, its prizes and its pull;
    - the migration;
    - the validator's checks.
  - **Touch,** at the three sizes:
    - each new mission's job taken from the board, with its objective under the round;
    - a crate carried out;
    - the client walked to the far gate;
    - a round held;
    - a charge planted, and its blast;
    - the captive freed and walked out;
    - offline, every button 48 px or more, no console errors.

  As built (2026-10-18), where it differs from the above or adds to it:
  - **Extract jobs carry one crate, and sabotages have one target** (the still has two). Two crates won 29 to 37% of the time, and the strongest encounters 4 to 7%. Sabotage and rescue jobs got lighter encounters than first drafted.
  - **A sabotage's charges run out:** one a target and `spareCharges` (1) more, in `data/balance.json`; a charge pulled is gone. With charges to spare, a guard beside a target pulled every one set, and the fight never ended.
  - **A freed captive moves at once,** in the turn they are freed.
  - **Closing time holds 8 rounds;** the other two defenses hold 6.
  - **The test player steps clear of its own charge,** to the best plan that leaves it clear. The ward weighs a hit point it might lose as 3 steps (`WARD_FEAR`).
  - **On the board:**
    - the way out, the far gate and the way in held are outlined on the deck, the way in red;
    - a zone's tag sits on its free tile nearest the middle;
    - a crate in hand reads CARRYING over its carrier, and "Crate" first in the crew bar;
    - a held captive stands, HELD over them.
  - **The person brought out** has a face in the crew bar rolled from their name, in their kind's suit (`people` in `data/contracts.json`).
  - **The blast has a sound of its own** (`blast` in `data/sounds.json`). Free and Plant sound as an order does.
  - **The launch tests' campaign is pinned:** the board's shuffle takes a roll for each job, so 15 more jobs moved every roll after it. `tests/launchKit.js` holds main's RNG after the board (`LAUNCH_RNG`), so the campaign the launch, run and colony tests start from rolls the sectors and worlds it did. The voyage tests play act 1 through, and their rates are held to `MAIN`.
  - **Surgery's Law 1 check flies 300 seeds** (`tests/voyageSurgery.test.js`). On seeds 1 to 100 the new act 1 left surgery patching 132 hit points against a med bay's 122: four runs patched 6 to 12 with surgery and none with a med bay. On seeds 101 to 300 the numbers were 139 and 193, and over all 300, 271 and 315.
  - **Act 1's money moved,** credits at launch over 100 runs from each start: the miner's up 44% (14,390 against 10,005), the deserter's down 9% and the smuggler's down 12%. At half the new jobs' pay the miner's were still up 29%: the old jobs' odds, measured again under the guards, move it too.
- [x] **M38b Space fights from outside.** The approach screen draws both ships as their boarding maps, from inside, so a wrecked room shows its fire, vacuum or rubble. Evan asked (2026-10-18) to see the ships whole from outside, with the inside kept for a boarding.

  Evan's picks (2026-10-18): new milestones before M39, in this order: M38b space fights from outside, M38c station jobs, then act 3's travel and colonies (M38d to M38f).

  **Done when:**
  - **Both ships from outside** on the approach screen, as the hangar shows a ship (`src/render/exterior.js`): the solid hull in its paint and trim, its styling pieces and each part's maker's fittings, nozzles lit. The player's is on the left, nose right; the other is turned to face it; deep space behind. The inside shows only in a boarding's fight, as now.
  - **Damage on the hull:**
    - a part hit but not wrecked shows scorched plating over its cells;
    - a wrecked part shows its hazard there: flames for fire, a breach venting for vacuum, smoke over broken plating for rubble;
    - a repaired part shows clean.
  - **The target:** a Fire order's first tap marks the parts of its kind on her hull, the one it would hit first brightest (`src/sim/approach.js` targetsOf).
  - **A round played out** once it is given (a pure timeline: the round's events in, frames out):
    - each gun's shot flies from its barrel: a hit to the part it hit, a miss wide of the ship;
    - a shot the shields take stops at a shimmer around the ship;
    - a part wrecked bursts into its hazard, and a last reactor that blows up bursts the ship;
    - a flight that gets away flies off, and a ship closing to board comes in.

    The column's words for the round follow the shots as they land. A tap skips to the end; with reduced motion the round shows its end at once. Each sound plays with its shot (M35).
  - **A boarding:** the boarded ship is marked and the two close; Board her, Leave her and Fight them off work as now.
  - **Frames:** the screen redraws only while a round plays or the view changes, and a played round's frames hold the frame budget M23d measures, at the cover and open sizes in Chromium.
  - **Every rule tested:** the damage marks and the target marks (pure scenes), the timeline's frames for each kind of event, and the barrel each shot leaves from.
  - **Touch, at the three sizes:**
    - an approach met from the chart, both ships drawn whole from outside;
    - a Fire order's marks;
    - a round played, and one skipped;
    - a wrecked part's hazard on the hull;
    - a boarding marked and begun;
    - offline, every button 48 px or more, no console errors;
    - every earlier milestone's browser check still passes.

  As built (2026-10-18), where it differs from the above or adds to it:
  - **The marks are painted over the finished hull** in a pass of their own (`src/render/painter.js` paintOver), not sorted with it, so no fitting on a part's roof hides them. Each keeps to its own part's roof but for smoke, which hangs over it.
  - **A part hit but not wrecked** shows black burns ringed with heat. **A wrecked part is charred all over** under its hazard: flames; a hole as dark as space in torn plating, venting; or broken plating under smoke.
  - **The target is bracketed** at its corners in the target's red over a dark edge, so it shows on any paint, and tinted; the first it would hit has the thicker brackets and the stronger tint.
  - **A tap on either ship or on an order skips** a round playing out, and the rest of its sounds with it.
  - **A flight that gets away, either side's, takes the other ship off the screen,** so the player's ship stays in view.
  - **A boarding closes the gap between the two noses** to 26 px, wherever the ships stand on the screen, and grapples them with a dashed line from nose to nose. The boarded ship's half is outlined, as her map was.
  - **A patrol's or a trap's opening volley isn't played out:** it comes before the screen opens, and shows as scars on the hull and its lines in the column.
  - **The round's sounds moved to the screen** (`roundCues`), each as its shot fires and lands. With reduced motion, `roundSounds` plays them all at once, as M35 did.
  - **Frames:** deep space is painted once a size and copied in; each ship's layer covers only her and a cell round her; her hull is painted once and her marks drawn over a copy of it, so a hit doesn't paint her whole hull again. Drawn whole every frame, deep space alone took longer than all the rest.
- [x] **M38c Station jobs.** Act 1's job board stays in the hangar: on the run, stations repair, refit, sell and hire, but give no work. Evan asked (2026-10-18) for jobs at stations.

  Measured first (the miner, 30 voyages from launch, medians): launched with 105 credits (5 to 255); 65 from events; 87 spent on supplies and 40 on transponder swaps; parts bought at a shipyard in 2 of 30 runs. Heat 35 at launch, 65 at most; the hunters met in 17 of 30. Two stations a sector, and links run both ways, so a station can be called at again.

  Evan's picks (2026-10-18):
  - jobs written for the stations, fought at their docks and on the rocks nearby, not act 1's jobs again;
  - a fresh board at each visit;
  - act 1's pay;
  - the cost is heat and wounds, and the station stays safe.

  **Done when:**
  - **A board at every station** of act 2's sectors (not the shipyards, nor the system past the charts):
    - its jobs come from the clients of the station's side, or at one of nobody's from the clients of no side, each with its client, site, twist, pay, part and seed rolled as act 1's are;
    - it is rolled from a seed of the campaign, the sector, the station and the visit (the jumps made so far), as the recruits and racks are seeded: fresh at each visit, the same however often it is opened during one, and the campaign's RNG never moves for it;
    - a job taken is gone from it until the ship comes back.
  - **Taking one,** while nothing holds the ship (an event or an approach): a squad of up to `squadSize` goes, picked as a boarding's is (the healthiest by default), and the rest stay aboard. The fight is on the job's site, with its mission, twist, difficulty and forgiving odds as act 1's. No hunters join it.
  - **After it,** back to the chart at the station:
    - done, act 1's pay with what the client's side adds (`jobPay`), and its part;
    - done or lost, heat as act 1's (`jobHeat`: 8, or 15 when loud) and the standing act 1's moves (`jobMoves`);
    - the dead are gone and wounds stay, as after a boarding: only the med bay and patching heal on the run;
    - fights counted for ranks, and gear won, as after any fight;
    - at a station of the pursuer's side a job counts as a trade, so they log the ship (`dockHeat`) unless a trade there already has this visit;
    - counted apart from act 1's jobs in the flags. Act 1's board, shop and quests are untouched.
  - **The content, as data:**
    - the stations' clients, two of each side and two of nobody's, and the sites at their docks and on the rocks nearby (`data/docks.json`, new);
    - four new site maps (`data/sites.json`), two of docks and two of rocks, with the ways in, spawns and marks each mission held there needs;
    - 15 station jobs (`data/contracts.json`) using all eight missions, from the encounters there are, paying in act 1's range, with drops and pitches; each side's stations and nobody's draw on at least twice a board's jobs;
    - validated: a job's sites and clients all in one district or all at the stations; no district's board offers a station job.
  - **The fight's look:** a dock's map shows deck plating and a rock's bare rock under the stars, each site map naming its look (new skins in the palette).
  - **Saves:** `SAVE_VERSION` 35, with a migration: the run keeps the jobs taken at the station this visit, none in a run saved before. A station job's fight is saved and picked up as act 1's.
  - **The screens:**
    - at a station, Jobs opens its board: the station and its side, each job as act 1's board shows it, the squad that would go with Squad to change it, Take the job (two taps), and Chart back;
    - the fight's end, Continue, goes back to the chart.
  - **The test player** (`tools/voyage.js`) takes a station's job when the job is worth it at act 1's odds and its heat keeps the ship under the hunters' heat, with a fit squad. `tools/jobs.js` prints the station jobs.
  - **Measured over 100 voyages,** with station jobs and without: credits, heat, hunters met, crew lost, parts bought at shipyards. The voyage's rates stay within the margin of main's (`MAIN`), or go to Evan.
  - **Every rule tested.**
  - **Touch, at the three sizes:**
    - Jobs at a station and its board;
    - a squad picked;
    - a job taken and fought on a dock and on a rock;
    - back at the chart with its pay and heat;
    - offline, every button 48 px or more, no console errors;
    - every earlier milestone's browser check still passes.

  As built (2026-10-18), where it differs from the above or adds to it:
  - **Four jobs were eased** after they won 7 to 40% of the time from the start crews:
    - Pay by the litre: the Pike crew, two turns at the terminal, and the cargo ring as a second site;
    - Pirates at the pumps: the lighter pirate crew;
    - Cut the rig: one target;
    - Fleet stores: one crate.

    All 15 now win 46 to 89% (PROGRESS.md has each).
  - **Back dues** (`dues`) was drafted as `strikefund`, an id act 1's board already has.
  - **Jobs sits in the chart's Here panel at a station,** above the transponder swap, with the count posted this visit. One tap opens the board; opening it spends nothing.
  - **A board is fresh at each jump made,** so a regroup or a day hidden at the station keeps the visit's board.
  - **The test player weighs a job's wounds** by the hit points the start crews lose in it (`tools/jobs.js --stations --odds` prints them), at 2 credits each. Managing heat, its line counts the next jump's heat too. It takes work before the refit, so a part paid goes on at that station.
  - **The voyage tests' fitted voyages fly without station jobs,** as they fly without refits. With jobs, a healer's crew is fit more often, takes more work and patches more: 1,147 hit points with a med bay against 958 without, on seeds 1 to 30.
  - **Station jobs make act 2 easier for the careful player, not harder:** their pay buys transponder swaps, which shed more heat than the jobs add. Over 100 voyages the hunters came in 22 runs against 35 without them. Every rate stays within main's margins (PROGRESS.md). Whether the heat should bite harder is Evan's call (§9).
- [x] **M38d The run goes on.** Since M25 settling the first world ends the travel: act 3's trips reach only places 1 to 3 days away. Evan's pick (2026-10-18): the run goes on.

  Measured first (the miner, 30 voyages from launch through the colony's 60 days, medians):
  - **The landing:** 31 credits (0 to 561), idle from then on with no station in act 3; heat 46.
  - **The 60 days:** heat falls to 10; 9 trips flown, 28 days away; the colony found by the pursuer in 15 runs of 30.
  - **The code:**
    - every move on the run (jumps, trading, refits, jobs, scans, surveys) is act 2's alone;
    - the system settled has no jump point and holds only worlds;
    - food is one store, the ship's holds and the colony's storehouses together;
    - the colony's days pass only on a trip, at most 9 days, and a jump passes none.

  Evan's picks (2026-10-18):
  - **the journey:** new systems in a line, each a chart like act 2's sectors;
  - **the way home:** fly home from anywhere;
  - **time:** a day a jump;
  - **who goes:** pick the crew, and split the stores.

  **Done when:**
  - **Flying out,** at the colony with the ship home, no trip and no lander down:
    - pick who goes, as many as the ship's berths and air hold, at least one; the rest stay home;
    - the flight checks count those aboard;
    - two taps on Fly out: the first shows who goes and who stays, and what the holds take.
  - **The stores split:**
    - while the ship is home, food is one store, as now;
    - flying out, the ship's holds take their fill from it, and the colony keeps the rest, up to its storehouses' room; what neither holds spoils, as the first tap says;
    - credits and the parts on hand go with the ship; the materials stay;
    - flying home, the two are one store again, up to the stores' room.
  - **The systems,** in a line from the colony's:
    - Fly out jumps into the next system, one never charted before: a chart generated as act 2's sectors are, its way in, its jump point to the next, two stations, a shipyard, a nebula, events and hostile ships (corvettes among them, as from act 2's third sector);
    - two worlds among its nodes, rolled as M25's are, to survey from orbit; settling one is M38e's;
    - named from the systems' list (`data/worlds.json`), none twice in a run until the list runs out, with 12 names added;
    - each system's jump point leads to the next, without end.
  - **On the run in act 3,** everything act 2 has, for those aboard:
    - jumps, long jumps, scans, events, approaches, boardings, regroups, hiding, surveys;
    - stations' supplies, repairs, patching, recruits, racks, jobs and transponder swaps; shipyards; refits;
    - hunger, the med bay, events' wounds, boarding and job squads and crews' talents count only those aboard; a recruit signs on aboard;
    - heat rises and the hunters roll as in act 2.
  - **A day a jump:**
    - each jump (a long one too), survey or day's rest passes a day at the colony;
    - the day runs as on a trip: the farms and mines make, those at home eat from the colony's store and rest, the pursuer may find it, and a lander comes down on its day.
  - **A raid while the ship is away:**
    - its landing holds the ship where it is, as an event does, and the chart shows it;
    - those at home face it, as on a trip; with nobody home, the landing's hits are all the colony has;
    - lost, the raiders take what the colony holds, food and materials, and nothing aboard the ship.
  - **Fly home,** from anywhere on the run, while nothing holds the ship: two taps.
    - The first says what it takes: a jump's supplies for those aboard for each system out, and a day at the colony for each, with one jump's heat.
    - The ship lands at the colony, and the stores are one again.
    - Flying out once more, the ship jumps into a new system, the next in the line.
  - **Saves:** `SAVE_VERSION` 36, with a migration: the ship home and nobody away, as every act 3 save is now. A save on the run in act 3 opens on the chart, an approach or a fight as act 2's do.
  - **The screens:**
    - the colony: Fly out, with who goes;
    - the chart in act 3: the colony's day, its food and whether a lander is coming; Fly home with its plan; a lander down, and Defend;
    - Continue on the title comes back to wherever the ship is.
  - **The test player** (`tools/voyage.js`), after the colony's 60 days:
    - flies out with the healthiest who fit aboard, leaving one at home;
    - plays the systems as act 2's, stations and jobs among them;
    - flies home when the holds come down to the way home's supplies and a buffer, or after `VOYAGE_SYSTEMS` systems.
  - **Measured over 100 voyages:**
    - systems crossed, the hunters met, raids found and faced while away and lost;
    - the colony fed while away, credits spent and parts bought on the way;
    - the voyage's rates stay within the margin of main's (`MAIN`), or go to Evan.
  - **Every rule tested.**
  - **Touch, at the three sizes:**
    - Fly out with a crew picked;
    - a new system's chart, a jump passing a colony day, a station there;
    - a raid landing at home while away, and Defend;
    - Fly home, landing at the colony, the stores one again;
    - a quit and reopen on the run in act 3;
    - offline, every button 48 px or more, no console errors;
    - every earlier milestone's browser check still passes.

  As built (2026-10-18), where it differs from the above or adds to it:
  - **Materials past the storehouses' room are lost at Fly out,** as the first tap says: with the ship's holds gone the stores are the storehouses alone, and a colony's day keeps no more than its stores (M27), so they would go on its first day anyway. Most of the test player's colonies have no storehouse: 86 of 100 lost materials flying out, 1,884 in all. Whether the holds should carry them, or they should stay past the room while the ship is away, was Evan's call; the fix below keeps them.
  - **Whoever stays with no bed and air at the colony doesn't rest while the ship is away** (M28's rule for a trip); the infirmary still heals them. The plan says so, and says when the first jump would go hungry.
  - **Heat follows the ship.** A day at the colony while it is away leaves heat alone; the run's jumps raise it as in act 2. A raid faced while away still ends at `heatAfterRaid`.
  - **The flight home's days count as jumps** in the flags, and the hunters don't roll on them. A lander that comes down before the last day stops the flight; Fly on finishes it with no more heat.
  - **Who goes:** the captain may stay home; the last aboard can't be let go at a station. Voyage heads the colony's side panel, above the places within reach; the plan picks the healthiest that fit aboard first, one left home.
  - **On the chart:** "System N out" heads it; Fly home sits in the Here panel (on the cover screen the colony's panel can be below the fold); Defend stands in the foot while a lander is down. Worlds out there are marked but not labelled (their labels covered nodes); a tap names them. The way in said "the sector" until the fix below.
  - **Names:** the 12 new systems' names renamed the systems in `tests/golden/systems.txt`; nothing else in them moved. A run avoids the last 60 maps' names (`MAX_PAST`).
  - **The test player** (`tools/voyage.js`, `--out no` for none) waits at home for a raid that is coming, refits berths and air for all but one (`refitForSquad`), builds a shelter for whoever stays, crosses at most `VOYAGE_SYSTEMS` (3), and flies home once the holds are down to the way home and 2 jumps more (`HOME_JUMPS`). Those at home fight a raid with what they carry: the spare weapons are aboard. The voyage keeps its own tally, so act 2's numbers are as they were (the 30-voyage report is main's to the line).
  - **Measured over 100 voyages** (PROGRESS.md): flown and home in all, 3 systems crossed (0 to 3), 22 days away; those at home fed in all 100; 7 raids faced while away and all 7 lost, one defender against the 3 or 4 who landed; 8 boardings of the ship, 7 lost with 2 aboard. 13 crossed no system: their colonies held 0 to 24 food at day 60 and the buffer turned them home before a station.

  Fixed after it (2026-10-18, Evan: "Do recommendations, merge and continue"):
  - **The materials stay at Fly out,** all of them. While the ship is away they keep past the storehouses' room, though the mines add to them only up to it (`days.js`); the plan says what the mines dig and where it stops.
  - **A raid found while the ship is away comes down no sooner than the ship could be home** if it turned back at once: `raidWarning` days, or the flight home's when more (`raids.js` `flightHome`). The chart's hint says whether flying home now meets it.
  - **The plan says how many jumps the holds' food lasts,** on its line and in Fly out's first tap.
  - **A system's words, not a sector's:** a voyage's way in and jump point say `data/worlds.json` `voyage` `text` and `exit` (validated), and the transponder swap is once a system.
  - **The test player** stocks the holds first (farms for twice what the crew eats, `STOCK_SHARE`, and days at home until the food fills the holds, at most `STOCK_DAYS` 20, none once the farms can grow no more than the crew eats and no mine digs toward another). It flies home when a raid is coming that the flight home beats, and meets it at home.
  - **Measured over 100 voyages** (PROGRESS.md): 96 crossed a system (87 before), all 3 in 54; nobody hungry aboard or at home; no raid faced while away (7 before, all lost), 8 met at home with everyone and 7 won; no materials lost flying out (1,884 before), and the mines' digging past the storehouses lost while away in 13 colonies (1,350 in all). Boardings of the ship are as they were: 8, 7 lost with 2 aboard.
- [x] **M38e More colonies.** Since M25 there is one colony: a voyage's worlds can be surveyed, not settled. Evan's pick (2026-10-18): colonizing multiple worlds, leaving thriving colonies.

  Measured first (the miner, 100 voyages out after the first colony's 60 days, medians):
  - **The voyage:** 2 aboard (2 to 5) and 1 at home; 1 recruit signed on aboard (0 to 5); 6 worlds passed (2 to 6), none surveyed by the test player.
  - **What the ship carries out:** 5 parts in the hold (0 to 12) and 49 credits. The first colony has 6 buildings (3 to 20) and 12 materials (0 to 140) as it leaves.
  - **The code:**
    - the one colony runs through about 40 files;
    - the voyage sits inside it, and home is always that colony;
    - settling refuses once there is a colony;
    - a colony's raid odds use the ship's heat, even while the ship is away.

  Evan's picks (2026-10-18):
  - **who stays:** whoever you leave. Each colony keeps those left there, with its own food;
  - **between colonies:** fly straight there, from any colony or anywhere on a voyage;
  - **what finds a colony:** its own trail of heat;
  - **a new colony:** a landing's salvage.

  **Done when:**
  - **Settling on a voyage,** at a world in a system past a colony's, with nothing holding the ship:
    - Settle here founds a new colony there. It starts with a landing's 20 materials (`data/colony.json`), no buildings yet, and its system's other worlds for its trips; the act stays 3;
    - the ship lands there with those aboard, and the landing scene plays;
    - the colony it flew from keeps whoever was at home and its food.
  - **Each colony** keeps its own grid, buildings, materials, day count, places, raid and heat, and whoever is there with its food. The ship is landed at one colony or away.
    - The colony screen opens the one it is landed at.
    - Giving parts, building, taking down, trips, Fly out and refits work there.
  - **Where each lies,** along the line of systems: the first at 0, and one settled on a voyage as many systems past the colony the ship flew from as the voyage had gone.
  - **Fly to a colony,** two taps:
    - from anywhere on a voyage while nothing holds the ship, to any colony (the one it flew from is Fly home, as now);
    - from the colony screen, with the crew picked as for Fly out;
    - each system between costs a day and a jump's supplies for those aboard, one system at least, plus one jump's heat; no hunters roll;
    - a lander coming down on the way stops the flight, and Fly on finishes it; from the colony screen, the ship waits in the system it has reached;
    - landed, the ship's crew and stores join those there, up to the stores' room.
  - **Every colony lives its days:** each day that passes passes at every colony: Next day, a trip's day, and each jump, survey, rest and day of a flight. Its farms and mines make, those there eat its food and rest, its heat falls, and the pursuer may find it.
  - **Its own trail:**
    - a colony keeps the heat the ship left it with, falling `colonyHeatFall` a day, and the pursuer finds it at that heat's odds by its lanes;
    - landing, the ship's heat is the greater of its own and the colony's;
    - a raid sets that colony's heat to `heatAfterRaid`;
    - the ship's own heat is the hunters', as in act 2.
  - **Raids at every colony:**
    - found while the ship isn't there, its lander comes down no sooner than the ship could reach it;
    - a lander down at any colony holds the ship until it is faced: Defend, from the chart or the colony screen, with whoever is there; with nobody there, the guns alone;
    - lost, it takes from that colony's stores.
  - **The screens:**
    - the chart and the colony screen list every colony (where it lies, its day, food, who is there and its raid), with Fly to each;
    - Continue on the title says where the ship is.
  - **Saves:** `SAVE_VERSION` 37, with a migration: the one colony becomes the first, at 0, with the ship's heat. A v36 save opens as it did.
  - **The test player** (`tools/voyage.js`), on its voyage out (M38d):
    - settles a world in its second system, and plays the new colony's first days: giving parts and building farms and mines;
    - leaves one there when three or more are aboard, else nobody;
    - flies straight back to the first colony.
  - **Measured over 100 voyages:**
    - the colonies founded, the days at each, and the raids found, faced and lost at each;
    - every colony fed, and the flights between them;
    - the voyage's rates stay within the margin of main's (`MAIN`), or go to Evan.
  - **Every rule tested.**
  - **Touch, at the three sizes:**
    - settling on a voyage, and the landing;
    - the new colony's screen, with a part given;
    - every colony listed on the chart and the colony screen;
    - Fly to the first colony from the chart, and back from the colony screen;
    - a raid at a colony the ship isn't at, and Defend;
    - a quit and reopen;
    - offline, every button 48 px or more, no console errors;
    - every earlier milestone's browser check still passes.

  As built (2026-10-18), where it differs from the above or adds to it:
  - **The others wait in `campaign.colonies`** (`src/sim/colonies.js`), each with `keep` (whoever is there and its food); `campaign.colony` is still the one the ship is landed at or flew from, so the colony screen, building, trips, Fly out and refits work there unchanged. Every colony has its number, its place along the line and its heat; a voyage, where the ship is (`at`) and the colony a stopped flight is for (`to`).
  - **Every colony's day** runs as a day with the ship away (`days.js` `othersDay`): its own power, no rest without a bed and air, its materials kept past the storehouses' room as M38d's fix has them. The flags count every colony's days, and the others' apart (`othersDays`, `othersHungryDays`, `othersRaidsFound`).
  - **Its own trail, as built:** the colony the ship flies from keeps the ship's heat as it leaves, and it falls a day there too while the ship is away (M38d left it alone, following the ship). A raid there while away sets that colony's heat, no longer the ship's. Landing, the ship's heat is the greater.
  - **Raids at another colony:** Defend faces whichever lander is down, the colony the ship is at first, and the fight's words (the hint, Defend's first tap, the landing's report, the end panel) name it and take its stores and its heat. A raid lost at a colony the ship isn't at takes nothing from the hold. While its fight is on, the ship's side is parked at that colony (`parked`) and the save checks the fight against it.
  - **The screens:** on the chart the colony flown from keeps its panel, now with the flight home's days, and each other colony has a panel of its own under it (the flight there, its day, food, who is there and its raid) with Fly to, two taps; the colony screen lists them under Voyage as Colonies, a tap planning the flight with the crew picked as for Fly out. A stopped flight from the colony screen waits in a system rolled where it stopped. The landing says which colony it founds ("The crew's second colony"); the act line stays "Act 3 · The colony".
  - **The whole crew is at most 20** (`MAX_CREW`), at every colony and aboard: a recruit or a companion signs on only under it. Past it a save wouldn't read, a limit M38d could already reach with a big ship.
  - **The test player** settles the best world of the second system out (`settleMove`), gives the ship's parts as at the first colony, plays 10 days there (`NEW_DAYS`) building farms and mines, meets a raid coming there before it leaves, and would fly back at once for one coming at the first (none did). It leaves the least fit when three or more landed (`backCrew`). `--settle no` keeps M38d's voyage out, and `--out` and `--settle` now work from the command line (`--out` was documented in M38d but not read).
  - **Measured over 100 voyages** (PROGRESS.md): a second colony founded on 75, the other 25 flown home first by M38d's rules; 10 days there (10 to 12), one left there in 56; all 75 flown straight back in 2 days, none stopped; raids since flying out: at the first found 4, faced 4, none lost; at the second found 6, faced 5, lost 2; every colony fed in 99. The voyage's rates are within main's margins (home 100, fed 99, fed aboard 99).
- [x] **M38f Citizens.** Since M26 a colony's people are the crew: farms and mines make the same with nobody there, and a raid while the ship is away holds it until the player fights it. Evan's picks (2026-10-18): a colony runs itself while the ship is away, and its citizens are grown, the rescued and crew left behind.

  Measured first (the miner, 100 voyages out; the first colony as the ship flies out, its own power only; medians):
  - **Its people and room:** 1 at home of 3 (3 to 6); beds and air for 2 (0 to 8), so room for 1 more (−1 to 5), any room in 90. Landed again with everyone, room for 1 fewer than the crew (−5 to 3).
  - **What it makes:** 6 food a day (3 to 16) against 1 eaten; 2 farms (1 to 8), no mine (0 to 2), 6 buildings (3 to 20); power to spare 1 (0 to 6), any in 61.
  - **The second colony as the ship leaves it:** 1 there (0 to 1), no room, no guns, 4 food a day.
  - **A raid fought out by the AI on both sides** (`tests/colonyKit.js`'s colony with nothing built, so nothing fires at the lander; the miner's raiders): 1 or 2 defending won 0 of 40 each, 3 won 18 of 40. Each fight took 7 to 25 ms (86 at most), and every one ended.
  - **The code:** nobody but crew lives anywhere; a rescue's captive is a unit in the fight and gone at its end; no fight resolves without the player.

  Evan's picks (2026-10-19):
  - **a citizen:** a headcount, not a person: no names, and not crew;
  - **a raid at a colony the ship isn't at:** fought out at once, under the battle rules with the AI on both sides; the ship is never held, and a report waits;
  - **a raid lost:** its stores, as now, and the citizens who fell. Crew are never killed in a campaign fight; with nobody left, the colony stands empty;
  - **in a raid the player fights:** the citizens fight under the player's orders, as colonists.

  **Done when:**
  - **Citizens** (`colony.citizens`, a headcount at every colony):
    - each eats a jump's supplies a day, as a crew member does;
    - each takes a bed and air, after the crew there;
    - each works a farm or a mine, one to a building in the order built, for 1 more a day;
    - not crew: the 20 at every colony and aboard don't count them, and a citizen never comes aboard.
  - **Grown:** each day a colony is fed, has a bed and air free for one more and has every building powered counts toward the next citizen; every `citizenDays` (5, `data/balance.json`) such days, one more. A hungry day there, one leaves.
  - **The rescued:** a captive freed on a voyage settles at the colony the ship flew from, a citizen more if it has room, and the job's end says so; without room, or before act 3, they go their way as now.
  - **A raid at a colony the ship isn't at** (on a voyage, on a trip from it, or at another colony) is fought out on the day its lander comes down:
    - its guns fire at the lander as now, and those who land fight whoever is there and its citizens on its grid, under the battle rules, the AI playing both sides. As the test player's raids, past 40 rounds both press on, and unended at 60 the raiders pull out;
    - the ship is never held by it, and a flight or a trip under way goes on;
    - settled as now: the colony's heat, and lost, half its food and materials;
    - citizens who fell are gone, and crew there come out wounded, never dead;
    - a report waits: the colony's panel on the chart says it, and the hint when the ship next lands there ("While the ship was away, Con-Reg Recovery's raiders were fought off on day 34; 1 colonist fell.").
  - **A raid the player fights** (the ship landed there): its citizens stand on its grid beside the crew as colonists (`data/colony.json` `citizen`: fewer hit points than crew, a pistol), under the player's orders and in the crew bar. Those who fall are lost.
  - **A colony with nobody left** (no crew there, no citizens) stands empty: it grows no one until crew are left there.
  - **The screens:** the colony screen shows its citizens, the beds they take, the days to the next and why none comes; the chart's colony panels show each colony's citizens and its last report.
  - **Saves:** `SAVE_VERSION` 38, with a migration: every colony with no citizens, nothing toward the next and no report. A raid already down at a colony the ship isn't at, or a flight or a trip one stopped, in a save from before, goes on as before (Defend, Fly on).
  - **The test player** (`tools/voyage.js`): back from its voyage out, it plays the first colony's next 20 days, so the second lives them too; it flies home for a raid it can meet, as now.
  - **Measured over 100 voyages:**
    - the citizens grown at each colony;
    - the raids fought out without the player, won and lost, and the citizens lost;
    - the voyage's rates within the margin of main's (`MAIN`), or to Evan.
  - **Every rule tested.**
  - **Touch, at the three sizes:**
    - the colony screen's citizens;
    - a raid fought out while the ship is away, and its report on the chart and on landing;
    - a raid fought with colonists in the crew bar;
    - a quit and reopen;
    - offline, every button 48 px or more, no console errors;
    - every earlier milestone's browser check still passes.

  As built (2026-10-19), where it differs from the above or adds to it:
  - **When a raid where the ship isn't comes down:** no sooner than the day after the ship could be back (`raids.js`: `raidWarning` days, or the flight there and a day more). On its day it is fought out, so to meet it the ship lands the day before, and the hint says whether flying there now does. A flight, a leg or a voyage under way never stops for a raid; the words for a stopped one are gone, and a raid down while away, or a flight or a leg one stopped, is a save's from before, which keeps Defend and Fly on.
  - **Fought out** (`raids.js` `fightAway`, `fightOut.js`): the playing-on M32's test players used (`tools/boarding.js`) moved into the sim. Crew there come out with 1 hit point at least and their fights counted; a colonist stabilized before the end lives. A grid with no room for those there and the raiders counts the raid as lost without a fight (none seen).
  - **The news** (`colony.news`, at most 12): a raid fought out (won or lost, how many landed and fell, and what it took, a part among it), a citizen come, gone or settled, each with its day, added only while the ship is away. It stays once the ship lands until a day passes there or the ship leaves, so the colony screen's hint keeps it; the chart's colony panels give the last of it, and a trip's leg says what it added.
  - **The words carried across:** since M38d each screen switch remounts the screen, so what Fly home, Fly to and Fly out said was lost with the screen that said it. The words now go across to the screen that opens (`src/ui/campaign/carried.js`).
  - **Colonists in a fight** are Colonist 1 to 6, "Col. 1" on their buttons (`src/ui/names.js`); their card says a fallen colonist is lost unless stabilized, Defend's first tap that a colonist who falls is lost, and the end panel how many fell and how many are left. `tools/validate-campaign.js` refuses a colonist id that is a job's, an enemy's or a person's.
  - **The test player** plays the 20 days after (`AFTER_DAYS`) and flies home for a raid only when it lands the day before (`voyagePlan.js` `homeNow`).
  - **Measured over 100 voyages** (PROGRESS.md): citizens at the first colony in 86 (median 1, at most 5), at the second in 42 of 76; since flying out 133 came, 5 left hungry, 7 fell and 1 freed captive settled. One raid was fought out without the player, lost. The voyage's rates are within main's margins (home 100, fed 99, fed aboard 99).
- [x] **M39 Parts and hull frames.** 21 module types against §5's 40 to 60, and one hull frame against 6.

  Measured first (100 voyages, the miner as `tools/voyage.js` plays; every enemy preset at seeds 1 to 50; medians):
  - **No ship comes near the starter frame's 40 parts and 24 × 14 cells.** The test player's ship has 12 parts at launch and 13 at the landing (24 at most), 8 × 9 cells (15 × 10 at most). The biggest preset, the corvette, has 28 parts at most and 20 × 13 cells. What holds a ship back is parts and credits: 2 parts on hand and 50 credits at the landing.
  - **Four of the 21 types never end up on the test player's ship:** the armory, the cannon, the shield array and the heavy engine. Only the cutters and the patrol carry an armory, and aboard a ship it does nothing but its room's cover (the colony's arms raid defenders).
  - **The crew jobs' ship effects** (`edges.js`): scan, gunnery, evasion, repair, a free survey, lockers and healing come only from who is aboard, save the med bay's healing.

  Evan's picks (2026-10-19):
  - **19 new types, 40 in all:** 5 that do a crew job's ship effect, 5 with rules of their own, and 9 bigger or smaller versions of parts already there;
  - **frames that differ in kind:** three more for the player, each with a trait outside the builder, bought at a shipyard, the ship moving over with its parts; two enemy frames;
  - **a part and a job with the same effect add up**, within the effect's cap;
  - **enemy ships fly some of the new parts now.**

  **Done when:**
  - **The 19 parts** are in `data/modules.json`, each with its own footprint, interior, plans, model outside and icon, and each maker's versions as §4.1 has them (Bastion every part, Kestrel those weighing 2 or more but reactors, Scrapline every part). Size, power, mass, hit points and price as below, numbers to be tuned by the tools:
    - **Doing a job's ship effect:**
      - Scanner, 2 × 1, command: a scan reaches 1 link more (the scout's).
      - Fire control, 2 × 1, weapons: +10 to hit in the approach (the marine's).
      - ECM suite, 2 × 1, defense: +10 evasion in the approach (the pilot's).
      - Workshop, 3 × 2, utility: mends a wrecked part a jump (the engineer's).
      - Survey lab, 2 × 2, utility: a survey takes no day (the xenobiologist's).
    - **With rules of their own:**
      - Torpedo bay, 2 × 2, weapons, facing space: 20 a hit that no shield takes off, firing in rounds 1 and 3 of an approach.
      - Grapple, 2 × 1, utility, facing space: +15 to closing to board, and 15 off the other ship's fleeing.
      - Stealth baffles, 2 × 1, defense: each jump adds 1 less heat.
      - Security turret, 2 × 1, defense: in a boarding fight on its ship, a turret on its floor tile fights for that ship's side, with a gun and no moves; it can be shot down.
      - Hydroponics, 3 × 2, crew: grows 2 supplies a jump aboard.
    - **Bigger or smaller versions:** a railgun (3 × 1, 45 a hit), a flak battery (2 × 1, 20 point defense), a large reactor (4 × 3, 14 power), a thruster (1 × 1, 4 thrust), a cockpit (a 2 × 1 bridge), barracks (4 × 2, 8 berths), an air plant (2 × 2, 8 life support), a cargo pod (2 × 1, 6 cargo) and a shield emitter (1 × 1, 5 shield).
  - **Effects add up within their caps** (`edges.js`'s): a working part's, its frame's and the best job's among the crew. A wrecked part gives nothing. A second of the same part adds nothing past the cap.
  - **Law 1:** each new part changes the approach, a fight, the voyage or the colony, shown by `tools/approach.js`, `tools/sim.js` or `tools/voyage.js` (its `fit` and a new `--frame`), and none is worse than another part in every way (`tests/catalog.test.js`, with the new effects among what a part gives).
  - **At the colony** (M26's giving): each new part gives what its numbers give (power, beds, air, storage, guns, shields, point defense), and:
    - the scanner and fire control +10 to hit at a raid's lander;
    - the workshop 1 more material from each mine a day;
    - the survey lab a place more within reach;
    - hydroponics 2 food a day.

    The ECM suite, the grapple, the baffles, the turret, the thruster and the cockpit can't be given, and say why.
  - **Hull frames** (`data/frames.json`), three more for the player and two for enemies; the numbers to be tuned:
    - Starter hull: 24 × 14, 40 parts, thrust for mass 0.5 (as now);
    - Courier: 18 × 10, 24 parts, 0.3, +10 evasion;
    - Gunship: 28 × 14, 48 parts, 0.5, +10 to hit;
    - Freighter: 30 × 16, 56 parts, 0.6, the lockers hold 20 more supplies;
    - for enemies, a patrol hull (30 × 16, 56 parts) for the corvette and the frigate, and a small-craft hull (16 × 9, 20 parts) for the cutters, the repo tug and the runner. These two only give room.
  - **A new frame at a shipyard:**
    - every yard sells the player's frames but the ship's own, at the yard's percent of the frame's price and its side's share, less half what the old frame would fetch there;
    - two taps move the ship over: its parts and styling pieces keep their places, shifted into the new yard if they don't fit where they are;
    - it is refused, saying why, when the parts outnumber the new frame's cap, the ship won't fit its yard, or the styling pieces outnumber its own;
    - the frame's trait and its thrust for mass hold at once, and a ship that then fails a flight check can't jump until it is fixed (M23h's rule).
  - **Enemy ships:** the presets fly some of the new parts (the frigate fire control, the corvette a flak battery, the pirates' cutter and the repo tug a grapple, Con-Reg's gunship a torpedo bay, the runner stealth baffles, the hauler hydroponics and cargo pods, the Provost cutter a security turret, the yacht an ECM suite) and the enemy frames. The golden ships file is rewritten on purpose, and the approach and boarding fights are measured against main's (`tools/approach.js`, `tools/sim.js`).
  - **Where the parts come from:** every yard can sell any part, as now; act 1's shops and the job drops carry the variants and the five job parts, and act 2's salvage the cheaper new parts, with act 1's test run as long as main's within its margin (`tools/run.js`).
  - **The screens:**
    - the builder's drawer, part cards and ship panel: each new part's effect, at the colony too, and the ship's frame and its trait;
    - the shipyard's frames, with what each holds, its trait and its price;
    - the approach: torpedoes and the grapple in the odds and the round's words, a torpedo seen in flight;
    - the jump's plan: what hydroponics grow and the baffles save;
    - the fight: the turret on the board and in the crew bar, its card.
  - **Saves stay at v38:** a frame is the ship's `frame` (as since M3), a turret is a unit of a part's kind, and torpedoes go by the approach's round, so nothing new is saved. A blueprint code carries its frame by name, as now.
  - **The test players** fit the new parts they find and buy where `voyagePlan.js` refits; the voyage's rates stay within main's margins (`MAIN`).
  - **Every rule tested.**
  - **Touch, at the three sizes:**
    - the drawer with the 40 types and their makers;
    - a part placed in two taps on each new frame;
    - a frame bought and moved to at a yard, and one refused;
    - an approach with torpedoes and a grapple;
    - a boarding fight with a turret;
    - a jump's plan with hydroponics and baffles;
    - a quit and reopen;
    - offline, every button 48 px or more, no console errors;
    - every earlier milestone's browser check still passes.

  As built (2026-10-19), where it differs from the above or adds to it:
  - **Two names, two shapes:** barracks and the air plant are the dormitory and the air recycler, as the colony's buildings for crew quarters and life support already carry those names. The stealth baffles are 3 × 1, two panels either side of a walkway, and the shield emitter faces space, a dish on the hull. Every new part's room can be walked through.
  - **The turret stands on its mount:** its room's tile of full cover, with a base plate drawn there (`deploy.js` `mountOf`). On its floor tile it shut the only way through its room.
  - **A side whose people are all down has lost, whatever its turrets** (`battle.js`): the crew's last one down, the boarders have the ship; the boarders down, the crew has won, their turret firing or not. Those pressing on go on past a turret to the people (`press.js`). Before these, a crew down to its turret held a fight up for good, and the crew won 13% of its boardings of the Provost cutter against 50% with her turret taken off.
  - **A long shot gives way past 40 rounds** (`fightOut.js` `LONG_SHOT`): a shot under 25% to hit gives way to a step nearer, where since M32 a shot under 10% did. A medic in cover took 20% shots at a brute who couldn't hit back for 20 rounds, and a voyage's boarding stalled.
  - **Enemy ships:** none flies a grapple or a torpedo bay, and the runner keeps the starter hull. With them, the start ship did worse against those presets with a part added, which Law 1 forbids: an engine or a gun against the pirate cutter's and the repo tug's grapples (10 to 23 points of score), a gun or a shield against the gunship's torpedoes (6), point defense against the runner on the small-craft hull (4); and the cutter's grapple took a second reactor and a third gun. The rest fly as above, and the patrol hull carries the corvette and the frigate, the small-craft hull the two cutters and the repo tug. The generator tries 80 layouts where it tried 20, for the smaller hull. The golden ships file is rewritten on purpose. (§9: an enemy's grapple and torpedoes.)
  - **Act 1's shops:** the Tailings sells the thruster, the cargo pod and the workshop, the Strand the flak battery, fire control and the shield emitter, the Narrows the cargo pod, the cockpit, the scanner and the large reactor; the jobs drop the variants and the job parts.
  - **The test players:** act 1's fits and buys a part the checklist doesn't name where it leaves the checklist asking for fewer parts (`tools/run.js` `helps`: a thruster or a light engine for an engine, a dormitory for quarters). The voyage's also fits the scanner, the workshop, the survey lab and the grapple, never a part whose ship effects are at their caps already, nor a second grapple (`voyagePlan.js`). `tools/sim.js --boardings --fit turret` boards the start ship with parts added, and `tools/approach.js` adds the railgun, the flak battery, the emitter, the thruster, fire control, the ECM suite and the torpedo bay one at a time (`ADDED`), puts a cockpit in the bridge's place, and moves the ship onto the courier's and the gunship's hulls (`FRAMES`; the freighter's lockers play no part in an approach). The grapple's pull shows only with a player who closes to board whenever it can (`approachPlan.js` `boarderOrder`): the test player never closes, and no preset flees.
  - **Law 1's one new trade:** the railgun's mass costs 5 evasion, so the repo gunship and the frigate, which the start ship beats with it or without it in none of 120 approaches, board it a little more often (4 and 5 points of score), where it wins 53 to 101 points more against four other presets. `tests/approach.test.js` lists it beside M31's shield array (`TRADES`).
  - **Counted:** frames bought and supplies grown, in the campaign's flags (`framesBought`, `suppliesGrown`).
  - **Measured** (PROGRESS.md): every new part and the courier's and gunship's hulls change the approach, a fight or the voyage, the grapple only with a player who closes to board; the freighter's lockers show on the voyage (hungry jumps 35 to 22 over 30). Over 100 voyages the rates stay within main's margins (fed all the way 80, main 77), and act 1's runs within 10 minutes of main's (the miner's 39 against 42).
- [x] **M40 Balance runs.** The voyage's rates have been held at main's since M31, short of their first targets (§9), and some fights sit far outside what a careful crew wins.

  Measured first (main after M39):
  - 100 voyages from each start, as `tools/voyage.js` plays;
  - act 1's 50 runs a start;
  - every act 1 board job over 200 seeds, with its start's fresh crew;
  - 1,000 fights a talent;
  - 25 boardings a row.

  What they showed:
  - **The voyage** from the miner's, the deserter's and the smuggler's starts:
    - the hunters met in 35, 26 and 13 runs of 100 (in the sectors 21, 15 and 5; past the charts 20, 16 and 9);
    - fed all the way in 80, 85 and 94;
    - hungry in the system in 8, 7 and 2, each time on the first jump after coming in with empty holds;
    - a boarding lost at home in 28, 13 and 14.
  - **Past the charts** most hunts are the regular hunters at heat 50 to 74: 18 of the miner's 23, 14 of the deserter's 20, 8 of the smuggler's 9.
  - **Swaps:** the miner and the deserter swap the transponder 4 times a run (the median), taking 120 heat off for 160 credits, where their station jobs add 24 to 26.
  - **Act 1:** 39, 40 and 49 minutes at the slow pace (medians). The deserter's longest run is 227 minutes (29 jobs), the smuggler's 189.
  - **Jobs:** 37 of the 41 board jobs are won 35% to 90%; the picket line 6%, the dock war 13%, pawn tickets 32% and Impounded (the tug engine) 97% are not.
  - **Talents**, against the same squad at rank 2: Steward's kit +27 points, Bosun's weld 0, Surveyor's eye +2, Family medicine +1.
  - **Boardings:** every row is 20% to 80% but the yacht's (12% boarding her, 16% at home) and the gunship's at home (8%).
  - **The deserter's crew aboard ships** (§9) needs nothing now: its thread pays off in 85 voyages of 100, against the miner's 82 and the smuggler's 91.
  - **Weapons:** the carbine, the rifle, the long rifle and the pistol miss M37's rule. They weren't picked, so they stay in §9.

  Evan's picks (2026-10-19):
  - **each start meets the hunters in at most 25 voyages of 100**, fed all the way in 80 or more, hungry in the system in none;
  - **past the charts only the task force follows;**
  - **a swap costs more each time, hydroponics grows 1 a jump, and the jump into the system warns** when the holds are short;
  - **every act 1 job won 35% to 90%, each talent worth 5 to 15 points, and every boarding won 20% to 80%.**

  **Done when:**
  - **The voyage from each start** (`tools/voyage.js --runs 100 --background all`, the careful test player managing heat):
    - the hunters met in at most 25 runs of 100, the sectors and the system together;
    - fed all the way in 80 or more;
    - hungry in the system in none.

    `tests/voyage.test.js` holds these three as bars from each start, and its `MAIN` moves to M40's rates.
  - **Past the charts, only the task force follows** (`hunt.js`). In an uncharted system (act 2's past the charts, and those a voyage out crosses):
    - under heat 75 (`raidHeat`) the hunters' odds are 0: they have lost the trail, and the jump's plan, a survey's and a regroup's say so;
    - at 75 and over, the task force's odds are as now, and certain at 100;
    - a jump into such a system counts as in it.
  - **A swap costs more each time** (`transponder.js`): `swapPrice`, and `swapRise` (20) more for each swap the campaign has made. The flags count them already, so saves don't change. Every price shown is the swap's own.
  - **Hydroponics grows 1 supply a jump** (was 2), each maker's version alike. At the colony it stays 2 food a day.
  - **The jump into the system warns** when the holds can't cover a survey's day and a jump on. The test player comes in with that much where its credits allow.
  - **Every act 1 board job** is won 35% to 90% by its start's fresh crew over 200 seeds. The picket line, the dock war, pawn tickets and Impounded come in by their enemies, their numbers or their sites.
  - **Each talent lifts its squad's wins 5 to 15 points** over rank 2 (`node tools/sim.js --talent <companion> --compare`, 1,000 fights): Steward's kit down, the other three up.
  - **Every preset's boarding, both ways,** is won 20% to 80% (`node tools/sim.js --boardings`, 100 fights a row).
  - **Act 1 from each start** stays within `tests/run.test.js`'s 10 minutes of main's. Each pursuer's raids, at the hangar and at the colony (`tools/raids.js`), are measured and reported.
  - **Saves stay at v38:** nothing new is saved.
  - **Every rule tested.** Balance numbers changed with `node tools/sim.js`'s summary in PROGRESS.md.
  - **Touch, at the three sizes:** a swap's price, the system's warning, and "lost the trail" past the charts.

  As built (2026-10-19), where it differs from the above or adds to it:
  - **The voyage** (100 voyages from each start, the voyage tests' own sets; main's in brackets): the hunters met in 11, 21 and 6 runs (35, 26, 13), fed all the way in 98, 93 and 97 (80, 85, 94), hungry in the system in none (8, 7, 2). The rules did part of it; the test player did the rest:
    - **it keeps the food to the system in hand** (`tools/voyagePlan.js` foodReserve): in act 2's charted sectors, credits enough for the supplies the jumps left eat (7 a sector, half a sector into the system, and 4 jumps' buffer) and the system's survey and jump on, less what the holds carry. Swaps, yard parts, racks, recruits, patching and repairs come out of what is above it, and credits below it weigh as the supplies they buy. The voyages that came into the system hungry had spent that money on the way, or left act 1 with 10 to 35 credits;
    - **act 1's test player takes a job more** once ready, while its credits fall short of act 2's food and a first swap (`tools/run.js` launchFood, 123 for a crew of three; FOOD_JOBS 1): 24 runs of the miner's 50, 13 of the deserter's, 14 of the smuggler's. With up to three, the smuggler's act 1 ran 12 minutes past the miner's, over `tests/run.test.js`'s 10; with one the voyages still meet the bars (fed all the way in 98, 93 and 97, against 99, 96 and 98 with three). Act 1 runs 42, 40 and 50 minutes at the slow pace (main 39, 39, 49), and heat at launch is 36, 43 and 40 at the median (31, 39, 38);
    - **it swaps** only with the food to the system and half a holdful left after, **hides** only while fed, and takes no station job with a squad short of hands.
  - **The four act 1 jobs** came in by their enemies: the picket line's strikebreakers are two guards and a breacher (57%, was 6%), the dock war's other gang three dockers (44%, was 13%), the pawn tickets' drinkers a scavver, a jumper and a heavy (64%, was 32%), and Impounded's bonded store three MPs (88%, was 97%). Over 200 seeds all 41 board jobs are won 44% to 90%.
  - **Talents** (`node tools/sim.js --talent <companion> --compare`, 1,000 fights): Steward's kit +12 (armor 1 as rank 2's, and the kit adds 8 aim: the kit's armor is a whole number, and +2 was worth 27); Surveyor's eye +9 (Mark 60, was 30); Family medicine +7 (Patch reaches an ally in sight 3 tiles off, and the crew's AI patches one who has lost 5, where it waited for 8). **Bosun's weld stays at 0:** no weld tried reached 5 (best +4), so it is Evan's call (§9). For these, an order kind may have numbers besides its own (`orders.js` `extras`): Patch a reach (2 to 6), Kit out an aim (1 to 50), validated, and a talent may add them.
  - **Boardings** (`node tools/sim.js --boardings --fights 1600`, 100 a row): every row 21% to 64%. Con-Reg's gunship sends a crew of its own (two agents, a heavy and a breacher; it sent the task force) and the Halloran yacht's party is a collector fewer.
  - **A fight past round 40 with no step nearer takes its best shot from where it stands** (`fightOut.js`): in a deserter's voyage a pilot and a brute, their fallen on the tiles between them, each stepped into the other's sight and back out, turn after turn, to the round limit.
  - **The way on foot from the airlock to the bridge:** the test player gives the colony no part whose going leaves a hatch no one can walk to from the bridge (`voyagePlan.js` hatchesCutOff). A reactor given on smuggler seed 22 joined the airlock's side to the bridge's by weapon mounts alone, and the boarding there never ended. A player can still do it (§9).
  - **Each pursuer's raids** (`tools/raids.js`, 150 a row) are as on main: at the hangar 53%, 63% and 46%, at the colony 41%, 42% and 41%.
- [x] **M41 Difficulty settings.** Easy, Normal and Hard since M18, a few numbers each: the enemy's aim and hit points in a fight. The draft was each setting through all three acts, and permanent death as a harder setting (§9).

  Measured first (main after M40: 100 whole games from each start at each setting, act 1 to the days after the voyage out, every fight at the setting): every setting reaches the colony in all 100 from each start, and the fights part as they should (from the miner's start, Easy to Hard: boardings won 83%, 67% and 31%, raids at the colony 98%, 75% and 58%). Two gaps: an enemy ship's guns, and a raid fought out where the ship isn't, take no difficulty. Permanent death, tried with every bleed-out a death: the test crews bled out 3 to 9 times a game, and the smuggler's captain in nearly every game, because their AI never stabilizes anyone. Stabilizing where death is permanent, the deaths came to 0 or 1 a game at the median (at most 4), and the games that failed stalled in act 1 a crew member short, with no one to sign on (8 to 23 of 100 at Normal and Hard).

  Done when (my recommendations, taken on Evan's standing word to go with them, 2026-10-19):
  - **The difficulty is the game's,** picked at New game (Normal unless changed) and changed in Settings from the next fight, as M18 has it. It moves from the settings into the campaign (save v39: a save's setting becomes its campaign's).
  - **It reaches every enemy:** in every fight as now (Easy aims 10 worse with 1 hit point fewer, Hard 5 better with 1 more), from act 1's jobs to a raid fought out where the ship isn't; and in an approach, an enemy ship's guns aim 10 worse on Easy and 5 better on Hard (`easyEnemyGunnery`, `hardEnemyGunnery`), in the odds shown.
  - **Permanent death,** picked at New game, off unless turned on, and kept for the game:
    - a crew member who bleeds out in a fight dies and leaves the crew; their weapon goes back to the spares, a companion's loyalty quest ends, and the fallen are named on the crew card;
    - if the captain dies, whoever has stood in the most fights takes command;
    - with no one left aboard, the game is over: its end names the fallen and shows the record, and New game starts another. The save keeps the ending until then;
    - in act 1 the hangar has a green hand to sign on (no traits, no fights), one at a time and free, in the first job the crew is short of the start's. (Changed in the build: a fee left a crew of one with no credits and no way to earn any; Hard with permanent death stalled there.)
    - a fight the player doesn't play (a raid fought out where the ship isn't) kills no one;
    - the crew's AI stabilizes an ally who is down where death is permanent, so the test players play it as a careful player would.
  - **Each setting through all three acts,** 100 whole games from each start (`node tools/voyage.js --difficulty`, and `--permadeath on`):
    - without permanent death, every setting reaches the colony in all 100 from each start, and the share of fights won falls from Easy to Normal to Hard from each start;
    - with permanent death at Normal, the game reaches the colony in at least 80 of 100 from each start. The deaths, the captains lost and the games over are reported at each setting;
    - at Normal without permanent death, the voyage tests' rates stay main's and the golden files don't move.
  - **Saves v39,** with the migration tested.
  - **Every rule tested.**
  - **Touch, at the three sizes:** New game's difficulty and permanent death, Settings' difficulty, a death at a fight's end, the hangar's recruit, and the game's end.

  As built (2026-10-19), where it differs from the above or adds to it:
  - **New game has a last screen,** "Your game", after the captain: the two rows side by side, Back to the captain with nothing lost, then Start. The captain's button says Next.
  - **The hangar's recruit is free,** a green hand with no traits and no fights, in the first job the crew is short of (above).
  - **The game's end** names the fallen (job and act) and the record: difficulty, fights, jobs, sectors, colonies and who was lost. Continue from the title comes back to it until New game.
  - **Settings' Difficulty row** shows only with a game under way, and says the change holds from the next fight.
  - **The crew's AI gets a downed ally up** before anything else where death is permanent (`src/sim/rescueAi.js`): stabilize beside them, or walk there with an action to spare, unless its own Patch can reach them.
  - **Each setting through all three acts** (100 games from each start; Easy, Normal, Hard): without permanent death all 900 reach the colony, the fights won 89/78/63% from the miner's start, 84/70/61% from the deserter's, 89/79/69% from the smuggler's. With it at Normal the colony is reached in 100, 100 and 99; across all nine, one game over (Hard, the smuggler's, in act 3), and the smuggler's test player stopped short of launch in 1 at Normal and 3 at Hard.
- [x] **M42 Accessibility.** The draft:
  - a colorblind-safe palette;
  - text size;
  - reduced motion in a fight (§9).

  Measured first (main after M41):
  - **Color:** 25 places carry meaning by color. In 11 of them color is the only cue:
    - move tiles in one action vs a dash;
    - a job zone's way out vs way in;
    - a hit on an enemy vs a hurt to the crew (the same "−2");
    - the builder's and the colony's ghost, fits vs blocked;
    - HP bars healthy vs wounded;
    - a colony's need met or not;
    - the jump's reach ring vs the hunters' ring;
    - a station's side pip;
    - your shots vs theirs on the approach;
    - the five crew trims against each other.

    Simulated for the three kinds of colorblindness (Machado 2009, CIEDE2000), `good`/`bad` are 7.8 apart for deuteranopia, `good`/`dash` 10.2 for protanopia, `accent`/`bad` 9.8 for tritanopia, and four of the five crew trims fall under 20 against another; normal vision has them 26 to 68 apart.
  - **Text:** every size is fixed px, with no rem and no setting. The smallest that renders is 8.6 px (the builder's look tiles at 821×283), and 9.5 px on the fight's canvas labels. With every size at 125% on 821×283, no button leaves the screen outside a scroll area, but the builder's part tiles clip their names and the chart's side lines ellipsise.
  - **Motion in a fight:** the Motion setting changes nothing there. An enemy turn plays for 3.8 to 12.1 s (5.7 s at the median over 7,709 turns), 1.8 s of it two banners, and Skip jumps it.

  Done when (my recommendations, taken on Evan's standing word to go with them, 2026-10-19):
  - **Never color alone:** each of the 11 places above gets a second cue that needs no color:
    - a dash tile is hatched;
    - a way in held is marked by its own glyph;
    - a hurt to the crew rises with a mark of its own beside the number;
    - a blocked ghost is crossed;
    - a wounded HP bar is notched at its fill;
    - an unmet need carries "!";
    - the hunters' ring is dashed;
    - a side pip carries its side's letter;
    - their shots trail dashes;
    - each crew trim's badge carries the member's initial.
  - **Colors, in Settings:** Standard or Colorblind-safe. The colorblind-safe tokens keep every pair that must be told apart at least 20 apart (CIEDE2000) for normal vision and for each of protanopia, deuteranopia and tritanopia, and a test checks it from the palette. Text in either keeps WCAG AA (4.5) on the panels.
  - **Text size, in Settings:** 100%, 115% or 130%, for every screen's text and the fight's canvas labels. Nothing renders under 10 px at 100%. At 130% on all three sizes, every button is 48 px or more and reachable (in a scroll area if need be), and no name or line a choice needs is clipped.
  - **Reduced motion in a fight:** with Motion at Reduce (or the phone asking for less), an enemy turn shows its end at once with each action's words. The board is free within 1 s of the turn's start, the sounds play, and Skip is not needed. Full motion plays as now.
  - **Saves v40:** the two new settings, with the migration tested (Standard, 100%).
  - **Touch, at the three sizes:** the new settings, the fight under each, the chart and the builder at 130%, every earlier milestone's check at 100% and Standard.

  As built (2026-10-19), where it differs from the above or adds to it:
  - **The hunters' ring is doubled,** a second ring outside it, not dashed: a dashed ring already means a long jump.
  - **A wounded HP bar is striped,** not notched: stripes run the bar's length, where a notch marks one point.
  - **The crew trims carry each member's initial** in a box beside their pips on the board, not on a badge.
  - **A hurt to the crew reads "HURT −2"**, the word itself the mark; a blast's hurt to the crew the same.
  - **A way in held is crossed** (an X under the reach marks); a dash tile has three hatch strips.
  - **The colorblind-safe set** changes `good` to blue, `bad` and `target` to magenta, `accent` to gold, and `dash`, the enemy trim and the enemy tracer; the rest are Standard's. Its least pair is 20.8 apart (deuteranopia and tritanopia); Standard's is 6.5.
  - **Reduced motion reaches every fight's playback,** the crew's own actions as well as the enemy's: every event takes no time, and the words of one tile stack rather than overlap.
  - **The colony's crew opener** lies over the whole crew list, taller than its panel at 130% on the short screens; it scrolls into view and takes a tap anywhere on the list.
- [x] **M43 Tutorial polish.** M18's tips cover building, the job board and the first fight. The draft:
  - tips past the first fight, for the run and the colony (§9);
  - a stranger plays from New game to the colony unaided.

  Measured first (main after M42): 11 tips, ringed, one at a time and seen once, all in act 1 up to the first fight's orders. Past them the guidance is each screen's hint line (the hangar, the shop, the chart, a yard, the approach, the crew card, the colony, a trip's and a raid's reports). It names the next tap, but it rings nothing, and nothing says what a thing is the first time it comes: heat and a payment, a raid, launch, the jump plan and supplies, Scan and a long jump, a station, an event's choices, the approach's orders, the hunters' Regroup, Hide and swap, Survey and Settle here, the colony's needs, building, Next day, a trip and Defend. One tip has gone stale: it says a blocked ghost is red, which since M42 is crossed, and magenta under Colorblind-safe.

  Done when (my recommendations, taken on Evan's standing word to go with them, 2026-10-19):
  - **Tips past the first fight,** as M18's are (ringed, one at a time, seen once, their words in `data/tips.json`), each the first time its thing comes:
    - act 1: the heat meter, a payment, a raid's Defend, the shop, Launch;
    - the run: a jump planned and its cost, supplies, Scan, a long jump, a station, an event's choices, the approach's orders, the hunters' Regroup or Hide and the swap;
    - past the charts: Survey and Settle here;
    - the colony: its needs, Build, Next day, a trip, Defend.
  - **A tip never covers its control** at the three sizes, nor shows while a playback runs or over an end panel.
  - **The builder's tip** says a blocked ghost is crossed.
  - **A stranger, as far as a check can stand in:** a walk by touch from New game to the colony, at the three sizes, finds at every stop either a tip ringing a control on screen or a hint naming one. The fights are won from the dev menu, as they are guidance-free past the first. The stranger with the phone is Evan's, at Gate 7.
  - **No save change:** the new tips' ids join `tipsSeen` as M18's do. A save under way sees each new tip once, where its thing next comes.
  - **Every rule tested;** every earlier milestone's check passes.

  As built (2026-10-19), where it differs from the above or adds to it:
  - **21 new tips:**
    - act 1: a raid, heat, a payment, the shop and Launch;
    - the run: the chart, a jump, an event, a station, Scan, Regroup or Hide, and the swap;
    - the approach: its orders, and Board her;
    - Survey and Settle here;
    - the colony: Defend, its needs, Build, Next day and a trip.
  - **A long jump** is in the chart's tip (a dashed link: three times the supplies, and it sheds heat), not a tip of its own: a planned jump's length lives in the screen, not the state.
  - **A tip brings its control into sight** when it first shows, scrolling its panel as a thumb would.
  - **The walk found guidance missing, and it was added:**
    - the colony's hint was the act's stub words ("All of v0.4 is here…"); it now says what's next, the needs not met and then Next day;
    - the colony lists Build first, then the places and the voyage out;
    - a day's report ends "Tap Next day for the next.";
    - the approach's rounds past the first say "Next round: tap an order to see its odds.", where they said nothing;
    - the station's supplies hint names Buy and Fill up.
  - **The walk** is act 1 by touch to the first fight's end, then a sim-made save ready to launch, with the tips seen kept, standing in for act 1's remaining jobs and building. From there it is touch again to the colony's first day. It counts as guidance a tip, a hint naming a button, a hint saying what to tap ("tap one", "Pick 2 traits"), a scene with one way on (the lift-off, the landing), or, once the chart's tip is seen, the ringed nodes in reach.

**Gate 7 (draft):** v1.0's content plays on the phone, balanced from each start, with a tutorial a stranger can follow; and Evan wants to keep going. (Until 2026-10-20 this gate led to the release; Evan put a phase of building and fine-tuning before it.)

### Phase 8: Build and tune

More building and fine-tuning before the launch (Evan's call, 2026-10-20). What it holds is open:
- what Gate 7's play on the phone and its stranger turn up;
- what Evan picks from §9;
- new content or systems he asks for.

Each milestone is added as Evan picks it, with its Done when settled as it starts, the same way as Phase 7's. Evan started the phase on 2026-10-23 ("Do 1 now", picking M44 from the brainstorm). Gate 7's play on the phone and its stranger are still to come, and what they find becomes milestones here.

- [x] **M44 Builder ergonomics.** Evan's pick from the Phase 8 brainstorm (2026-10-23): the builder's everyday chores, from §9.

  Measured first (main after M43), by taps on the cover screen:
  - **A corridor run:** 2 taps a cell; nothing lays more than one part at a time.
  - **A checklist line:** the hangar's goal lines are plain text. Fixing one takes Build, find the part's tile, tap it, then 2 taps on the board, 5 or more in all.
  - **Where a part goes:** the player finds a spot by trying cells. The test players' fitter (`tools/run.js` fitPart) is pure and finds one for any part.
  - **Another maker's version:** delete the part, tap the other version, then 2 taps to place it. That is 4 taps and two undo steps, and the delete gives the part back to the stock first.
  - **Launch:** only at the hangar. With the last part fitted, Back, then Launch twice.

  Done when (my recommendations, taken on Evan's word, 2026-10-23):
  - **Drag a run:** with a corridor armed (any maker's), dragging from its ghost lays a corridor on each cell the finger passes, in straight steps along the grid. It shows as ghosts while dragging, each blocked cell crossed. The run is placed where it lifts, as one undo step, and stops short at the first cell that can't take one or when the corridors on hand run out. A tap on the ghost still places one.
  - **Checklist lines as shortcuts:** at the hangar, a goal line whose part is on hand is a button (48 px or more). A tap opens the builder with that part armed, its ghost at the suggested spot. A line with no part on hand stays text.
  - **Suggest a spot:** with a part armed, a Suggest button in the builder's tools puts its ghost where the fitter finds best (`src/sim/fit.js`, the test players' fitter moved there). A second tap on the ghost places it. With no spot anywhere, the button says so.
  - **Swap a maker in place:** a placed part's card offers each other maker's version on hand of the same part. A tap swaps it, keeping the spot and the turn, as one undo step, and returns the old one to the stock. A wrecked part can't be swapped. The build log keeps it as a remove and a place, so saves and codes don't change.
  - **Launch in the builder:** in act 1, with every flight check passing, the Ship tab's Launch shows in construction mode too (two taps), as at the hangar.
  - **No save change**, every rule tested, every earlier milestone's check passes.
  - **Touch, at the three sizes:** each of the five, in taps, against the counts above.

  As built (2026-10-23), where it differs from the above or adds to it:
  - **Taps on the cover screen, by touch** (`m44/verify.mjs`, the same at all three sizes):
    - a checklist line to the part placed: 2 (was 5 or more);
    - four corridors in a row: 3 gestures, arm, tap, drag (was 9);
    - a maker swap: 2, a long press and Swap (was 4);
    - Launch from the builder: 3, the Ship tab and Launch twice (was Back, then Launch twice).
  - **The fitter moved** from `tools/run.js` to `src/sim/fit.js`, which `tools/run.js` re-exports. Suggest uses the same search, with one rule eased: on a ship still being built a spot only has to add no layout problem of its own, as the fitter wants a whole ship.
  - **A run and a swap** are one undo step each, but several commands in the build log (a place a cell; a remove and a place), so the log, saves and codes are unchanged.
  - **Suggest sits on the board,** under Hull, rather than in the tools column, which is full at the 283 px height. It shows only while a part is armed.
  - **A swap** re-fits the styling pieces the old part held, as a move does. Its buttons sit on the part's card, which stays open for their tap.
  - **Launch in construction mode** dispatches the campaign's own launch once the session clears it, so its refusals are the hangar's.

- [x] **M45 Doors as tactics.** Item 6 of the Phase 8 brainstorm, next in my recommended order, taken on Evan's word (2026-10-23, "Do recommendations"). From §9: closing and locking doors in battle (defenders sealing a breach), and fog of war.

  Measured first (main after M44):
  - **Doors in a fight today:** a door starts closed. Walking through it, or the 1-action Open door, opens it for good. Only the engineer's Weld (M32) closes one, and it gives way after its rounds. A closed door blocks sight and shots; a walk through it opens it at no extra cost.
  - **The harness** (`node tools/sim.js --fights 400`, the squad against the boarding party on the ten ships): the crew wins 49% (44–54), the boarders 38%, and 13% reach 30 rounds with no winner. A fight is 7 rounds (5–12) and 24 shots. Weld is used 0.2 times a fight.
  - **What the enemy can see:** every enemy is always on the board (M8), though a shot already needs the shooter's own line of sight (`src/sim/sight.js` canSee).

  Done when (my recommendations, taken on Evan's word):
  - **Close a door:** a unit beside an open door closes it, 1 action. The door button reads Close door then, and Open door beside a closed one. Walking through a closed door still opens it, as now.
  - **Lock a door:** a crew member beside a door, open or closed, locks it, 1 action (Lock door), closing it if it was open. No one walks or sees through a locked door. The crew opens their own lock with Open door, 1 action.
  - **Forcing a lock:** the other side forces a locked door from beside it with a whole turn (both actions). A forced door is broken: it stays open for the rest of the fight and can't be closed or locked again, so a lock can't be shut in an enemy's face turn after turn. A welded door (M32) still can't be forced until the weld gives way.
  - **The AI forces what's in its way:** the enemy and everyone pressing on (`press.js`) head for a locked door that stands between them and the crew, and force it. They never lock or close doors themselves. No fight stalls at a lock: the harness with a crew that locks the doors beside it (a new `--doors lock` player) reports its no-winner rate against today's 13%, and a rise of more than 5 points is fixed before M45 closes.
  - **Fog of war,** an option in Settings (Fight: Fog of war, off by default): with it on, an enemy no one in the crew can see now is hidden on the board and can't be picked. In the enemy's turn, a hidden enemy's walk isn't shown; one that shoots at the crew shows for its shot. The rules and the AI are the same either way: fog only changes what the screen shows, and the enemy still knows where the crew is. Saves go to v41 with the setting off.
  - **A tip** the first time a crew member stands beside a door in a fight: doors close and lock, and a lock costs the enemy a turn.
  - **Every rule tested;** every earlier milestone's check passes.
  - **Touch, at the three sizes:** close, lock and open a door; watch the enemy force one; fog on hides an enemy out of sight and shows it once seen.

  As built (2026-10-23), where it differs from the above or adds to it:
  - **The door buttons:** Close door has a button of its own beside Open door, not a relabelled one, each with its own icon (a door swung shut, a padlock for Lock door). With doors on more than one side of a tile, each acts on the first, north, east, south, west, as Open door and Weld always have.
  - **Measured:** with `--doors lock` (400 fights, the ten ships), no winner 13% to 17%, inside the 5-point bar. The crew wins 49% to 31% and the boarders 38% to 52%: the test player locks every door beside it, even ones that shut it in, so this is a check that locks can't stall a fight, not a measure of good play. A fight locks 3.9 doors and forces 1.1. With no locks the harness gives today's figures exactly: the AI is unchanged until a door is locked.
  - **A locked door** is drawn red and as tall as the walls, so its shape tells it apart as well as its color (M42).
  - **Fog of war** hides an enemy from the board, its bars and taps, and a tap on its tile shows nothing. While it walks out of sight the status line says "Something moves out of sight." `src/sim/sight.js` sightedBy says who is seen; the screen reads the setting from `<html data-fog>`.
  - **The tip** comes last of the tips, the first time a crew member stands by a door.

- [ ] **M46 Refits on the move.** Item 3 of the Phase 8 brainstorm, next in my recommended order, taken on Evan's word (2026-10-23, "Do recommendations"). From §9: refits away from stations (raised in M23h), scrapping a wrecked part to fit a spare (M23h), picking what to strip (M22) and scrap by what is left (M21).

  Measured first (main after M45, `node tools/voyage.js --runs 100` and the approach harness):
  - **Refits:** only at stations, shipyards, the hangar and the colony. Over 100 voyages the test player refits 142 times and fits 190 parts. Between stations the ship's parts can't even be moved.
  - **Wrecks:** a wrecked part stays aboard until a station repairs it (4 repairs in 100 voyages, 130 credits). It can move, but never comes off, even with a working spare of it on hand.
  - **Stripping:** a won boarding aboard her strips the preset's count of her working parts (1 or 2) by a roll, a bridge or an airlock as likely as a weapon mount. The 100 voyages win 20 boardings aboard her and strip 20 parts, 670 credits of scrap with them. M28's derelicts at the colony strip the same way (113 won in the 100 voyages' trips).
  - **Scrap:** a boarded ship pays the preset's scrap in full, whatever the volleys broke. When she can be boarded, 73% to 93% of her parts still work (median 91%, over 485 boardings: the ten harness ships against every hostile preset, 60 seeds each).

  Done when (my recommendations, taken on Evan's word):
  - **Move and turn between jumps:** anywhere on the run (act 2, and a voyage from the colony) with nothing waiting (no approach, event or fight), the ship's panel opens Rearrange: construction mode where the parts aboard move and turn and the Look can change, but none comes off and none goes on. Delete says why, and the parts on hand aren't offered. Stations and shipyards keep the full Refit.
  - **Joins hold the ship anywhere:** a move that leaves the joins check failing (constraints.js's layout line) keeps the ship from jumping until it's fixed, as a failing check does at a station. Away from stations only that line holds it: it is the only one a move can change.
  - **Scrap a wreck for a spare:** in a full refit, a wrecked part's card offers each version on hand of the same part (any maker's). A tap scraps the wreck and puts the spare in its place, the same spot and turn, as one undo step. The wreck is gone, not on hand, and nothing is paid. The ship is never without that part in between, so no one is stranded by it. A station's Repair stays the other way.
  - **Pick what to strip:** a won boarding aboard her, and a won derelict at a place on a trip from the colony, strip as many parts as now (the preset's salvage, as far as her working parts go), but the player picks them on the end panel, from her working parts (never corridors, never wrecked), with the dearest picked to start with. Continue takes the picks. The test players take the dearest. Saves go to v42: a fight saved mid-boarding offers the parts it had rolled.
  - **Scrap by what is left:** a won boarding aboard her pays her scrap scaled by the share of her parts still working, rounded, and the approach screen's stakes say so. A ship blown up pays as now.
  - **Measured:** 100 voyages against main's: what stripping takes (parts and their worth) and the scrap paid; the voyage tests stay within main's margins (`MAIN`).
  - **Every rule tested;** every earlier milestone's check passes.
  - **Touch, at the three sizes:** a part moved and turned between jumps (Delete refused); a jump refused while the joins fail and allowed once fixed; a wreck scrapped for a spare at a station; a part picked on a won boarding's end panel, every new button 48 px or more.

**Gate 8 (draft):** the game plays on the phone as Evan wants it at launch, and he wants to release.

### Phase 9: Release (v1.0)

TWA build, Play listing, closed test, performance on a low-end phone, offline and lost-save checks, license audit, credits screen, privacy policy.

### Phase 10: Later

A Capacitor build; a paid version with a web demo; optional cloud saves on Base44; a daily seeded sector; online blueprint sharing.

---

## 8. Risks

| Risk | Early sign | Response |
| --- | --- | --- |
| The builder feels fiddly on a phone | Gate 1 fails | Fix it before Phase 2; fall back to bigger modules or a slot hull |
| Two deep systems overrun scope | Phase 2 runs past about 8 sessions | Keep the shared grid; cut base building to slots first |
| Players build chokepoint fortresses | Balance runs show defenders always win. AI against AI on the example ship, the crew of 3 wins 64% (58–70) against 4 boarders (`tools/sim.js`, M11). With the airlock moved under the bridge it wins 83% | Enemies breach walls and choose entry points; corridors stay two tiles wide. Since M9 the AI breaches doors: it opens one and shoots through, which overwatch can't punish |
| Fights stall in standoffs | AI-against-AI fights reach the round limit. The harness's 1,000 fights in M11 stalled on 24% of cutters, 9% of corvettes and 5% of haulers, and none on the example ship. Both sides hold on overwatch either side of a chokepoint. Boarders never attack a crew that holds the bridge: with a crew that only ends its turn, 5 of 5 fights reached 60 rounds on the example ship and on the campaign's start ship (M12). A campaign fight can't be left until one side wins, so there the player has to go to them. On jobs (M14) the AI waits behind a closed door as the crew's AI would: `tools/jobs.js` plays the crew with a player that pushes in and opens doors, and then every job ends. Raiders press on (M15, `src/sim/press.js`): of 360 raids played out on three ships, one went past 60 rounds. In boarding fights (M22) the side aboard the other's ship presses on: of 1,000 played out by the AI, 5 went past 60 rounds. The test player's boardings have both sides press on after 40 rounds (`tools/boarding.js`), and none of its 30-run voyages needed it. In M32 one of the smuggler's 100 test voyages met a fight no one could end, on a trip: the crew's fallen filled the only way through, the scavengers behind them, and the last of the crew could reach no tile with them in sight. A player would be held in it for good (§9) | Candidates, Evan's call: boarders press on as raiders do, cutting through walls, ships with a second way round. `tools/sim.js` reports the stalls ("No winner") |
| A raid's odds swing with the ship's layout | The AI crew against four raiders wins 11 of 60 on the example ship, 22 on the start ship and 39 once it has an engine (M15) | Candidates, Evan's call after the phone: three raiders, or raiders scaled to the ship; cover on the hangar deck; the crew choosing where to stand |
| Hostile ships are only a cost | M21's test player, flying the start ship as act 1 leaves it, boards none in 30 runs and loses something to one in 11. M22's careful test player never closes to board and disabled no ship in 30 runs, so it boarded none; it fought off 6 of the 12 that boarded it, and the other 6 each took a part | A gun fitted before launch turns the cutter into a win (§4.2); refits in act 2 (M23h); since M22, Board (49% against the cutter in the checks), then a fight the AI wins about half the time, for a part and scrap |
| Percentage misses feel unfair | Testers complain about high-odds misses | Clearer cover display, the forgiving-odds setting, the math always shown |
| 3D on canvas runs slowly on mid-range phones | Dropped frames turning or zooming the board (M4), or in battles (M8) | Rough half-resolution frames while the camera moves or units walk, only on a phone too slow for full ones (the frame budget, after M6: they blurred zooming on the Fold); cache the still board, and in a fight redraw it only when something on it changed (M8); fewer lines, cap the pixel ratio. Past that: three.js (MIT, one vendored file, no build step), with Evan's approval |
| Lost saves | Reports after Chrome data is cleared | Persistent storage request, export and import, migrations |
| Act 1 drags | Test runs pass an hour. M16's test player (`tools/run.js`): 10 of 50 runs pass an hour at the slow pace, none at the quick pace; the long ones are losing streaks | The engine's price and the lift-off rule (each one number); fewer jobs to launch; the builder from the first minute |
| Generated images look mismatched | The image pass looks patchy | Palette pass, reference images, fewer images |
| Tone still undecided | M14 arrives | Settled before M14: wry and blue-collar (Evan, 2026-10-12) |

---

## 9. Parking lot

These ideas wait until v0.4 or later:

- roles as licenses: mercenary, surveyor, homesteader, hauler, salvager, smuggler
- nemesis captains and legacy captains
- black box derelicts and zero-g drift
- a daily anomaly and a blueprint gallery
- decals: a name or a number on the hull, and a side's emblem. M23f brought paint and trim (raised before M4; narrowed in M23f)
- vibration on hits
- closing doors in battle, and locked doors: since M7 a unit can open a door beside it, but not shut one (raised in M7: defenders sealing a breach); done in M45 (close, lock, force)
- fog of war: since M8 every enemy is always shown; hiding those no one in the crew can see would make scouting matter (raised in M7, decided against for now in M8); done in M45, as a setting off by default
- the camera following the action in an enemy turn: on a ship too big for the screen, part of a turn can play out of view (raised in M8)
- the lift-off's and the landing's backdrop as layers the compositor moves, under a canvas of the ship's own: no backdrop drawing in a frame at all, if the phone stutters unfolded where this machine's processor-drawn canvas spends 2.8 to 3.6 ms on it (raised in M34)
- dragging to lay a run of corridor in one go: since M5b a corridor is one cell, so a long one takes two taps a cell (raised in M5b; could come sooner if Gate 1 finds it tedious)
- doorways onto lockers: the builder puts a doorway in the middle of a shared wall even with a locker, crates or machinery behind it. That can leave a room out of reach on foot in a fight. Generated ships avoid it; a player's ship still can, with no warning (raised in M10)
- an enemy hull frame: §5 counts one for v0.1, but every preset builds on the starter yard for now. One comes when enemy ships need a bigger yard or a higher cap (raised in M10; M39 brought two, the patrol hull and the small-craft hull)
- the campaign ship's timelapse: the campaign keeps no build log, so construction mode has no replay. A log would need a save version bump (raised in M13)
- the hangar's goal lines as shortcuts: a fix whose part is on hand could open construction mode with that part picked, one tap fewer (raised in M13)
- a job board that remembers further back than the last board, so a job comes back less often (raised in M14)
- a site that looks like the ground around it: a job's map sits on the starfield, like a ship's (raised in M14)
- the hangar drawn as a hangar: walls, and doors that open for the raiders. A raid's deck is a plate on the starfield with a hazard stripe where the doors would be (raised in M15)
- choosing where the crew stands before a raid, instead of all on the bridge (raised in M15)
- more hunters in act 1 as heat climbs past 50, and a bigger raid at 100. Act 2 has them since M24: the gunship from 75, and certain at 100 (raised in M15)
- lying low: ways to shed heat in act 1 besides paying, such as heat that falls while the crew sits out a board (raised in M15)
- fitting a part for the player: the test run's fitter (`tools/run.js` fitPart) could offer where a bought part goes best (raised in M16)
- a shop with more to it: stocking what you sell it, haggling, a second dealer, a price that changes with heat (raised in M16)
- the lift-off seen from the ground: the hangar's roof opening and the Tailings falling away, where M17's lift-off is drawn over the starfield (raised in M17)
- Launch in construction mode, where the last check usually passes: M17 keeps it at the hangar and points there (raised in M17)
- an act's record with time played and fights won and lost, kept per act: the colony shows what the flags count for the run (raised in M17)
- the sector map in 3D: M19's chart is flat, drawn in SVG like the job board. A starfield with the nodes as places, seen through the orbit camera, would match the ships (raised in M19)
- names on the sector map: M19 names a node in the left panel when it is picked. Every name on the chart would crowd it at 7 columns on the cover screen (raised in M19)
- a scanner part: scanning comes from the ship as such since M20. A sensor module that lengthens `scanRange` would tie scanning to the build, as Law 1 asks (raised in M20; M39's scanner reaches a link more)
- more for credits to buy in act 2: M20's runs end with about 100 unspent. Repairs came in M21, patching the crew in M22 (the careful test player spends 18 a run on it at the median), recruits in M23 (50 each; the careful test player signs one on in 15 of 30 runs with a cargo hold, and none on the lockers alone) and the transponder swap in M24 (40 a sector; managing heat, the careful test player swaps once a run at the median, 0 to 4). Bribes (§4.4) are still to come (raised in M20)
- events that start a fight: M20's events settle with a roll. M21 put hostile ships on nodes of their own; a distress call that turns out to be a trap would join the two (raised in M20)
- shots in the approach: M21 shows a hit as the wrecked room's hazard and a line in the log. Tracers, a flash on the module hit and a shudder would make a round read at a glance (raised in M21)
- an answer to the corvette besides running: the start ship never boards one, with or without a part (M21). M22's Board order closes on one, but the start crew beats a patrol's three only 32% of the time aboard her, played by the AI; a toll to pay a patrol off is another. M24's gunship is the same, and worse: its shield leaves the start ship's one gun 5 a hit, and the start crew beats its party 9% of the time at home (raised in M21)
- scrap by what is left: a boarded ship pays its preset's scrap whatever the volleys broke (raised in M21)
- repairs away from stations: an engineer patching a wreck between jumps, or salvage as the stock repairs use (§4.6) (raised in M21)
- a test captain that boards: M22's test player never closes to board and in 30 runs disabled no ship, so its voyages measure only boardings by them. A captain that weighs Board, and a harness row for Board then the fight, would say what boarding is worth (raised in M22)
- picking what to strip: a won boarding strips parts by a roll among her working ones, a bridge included. Choosing, or an engineer's pick, would make it a decision. M28's derelicts at the colony strip the same way, and a bridge, an engine or an airlock is of no use there except as a spare for the ship (raised in M22)
- starting clear of hazards: deployment takes the tiles nearest the bridge or the hatches whatever is on them, so a crew member can start a boarding fight in a burning room and burn on the first turn (raised in M22)
- scars and implants earned in play (§4.5): a crew member who goes down could come back scarred, and a med bay or a trader could fit an implant. M23c draws marks as layers of the look, so this needs only the rule and when it happens (Evan's call in M23c: later)
- the crew card on the cover screen: past three aboard, its lists scroll under the head. A tighter row, or the head's words in the foot, would show four at once (raised in M23)
- a test player that weighs a recruit's mouth: M23's signs one on only with 10 jumps of supplies in the holds for the bigger crew, which the start ship's lockers never hold, so on the start ship it never hires (raised in M23)
- an enemy that fits shield arrays and small reactors: the corvette is mirrored, so it would carry them in pairs, and a pair of arrays holds 50 a round. A gunship preset that isn't mirrored, or one array across a mirrored ship's middle, would bring them in (raised in M23e)
- a checklist fix that offers a variant on hand: "Add Engine" asks for the base part even with a light engine on hand to fit (raised in M23e)
- surgery against a med bay with a medic aboard: on the careful test player's voyages it patches 37 hit points against 44 over 30 runs, since a med bay already heals most wounds between fights. M24's hunters wound mostly the ship that ignores heat (77 hit points a run in fights at the median), and the careful player who manages heat meets them in 6 runs of 30, so its voyages still show it little (raised in M23e)
- a faster test suite: since M23e the Law 1 tests fly ten ships in the approach and seven fleets of 30 voyages, and `node --test` took 1 min 45 s here. M23h's fitter (`tools/run.js` fitPart weighs a spot before building it) brought it to about 70 s with an eighth fleet. M24's fleets, managing heat and ignoring it, put it at about 95 s. Since M31 four fleets fly 100 seeds for the rate checks: the voyage tests take about 3 min 20 s alone, and `node --test` about 4 min 15 s here. By M40 ten fleets fly 100 seeds, and `node --test` took 13 to 15 minutes here, with other runs beside it (raised in M23e)
- the far side in the Look: the builder looks at the ship from the south, so a piece on the north side is half hidden behind the hull. Pieces being placed and picked out are drawn over it; turning the camera to the side being styled would show the piece itself (raised in M23f)
- enemy looks placed with an eye: their pieces go anywhere they fit, so a cutter's wing can sit by the bow. Wings aft and gear on top would read better, and sculpt (slopes at their steps) would sleek them (raised in M23f)
- the plans' rough frames for the outside views while the camera moves: at 960 × 825 a dressed ship turns a few frames a second slower than a bare one, and the lift-off of the start ship in 13 pieces slower than main's (raised in M23f, after M23d)
- Scrapline's rust on a rust-painted hull: its fittings are rust brown, so on a ship painted Rust its parts don't stand out from the hull outside; its lime on the plans and its green flames still tell them apart (raised in M23g)
- makers inside: a boarding map draws every room in the Yard's skin, whoever made the part (raised in M23g)
- swapping a placed part's maker: a part is a maker's from the drawer, and the other maker's version means taking it off and placing that one (raised in M23g)
- the test players and makers: act 1's test player fits whichever maker's part is on hand, and a Bastion engine fitted in act 1 costs the careful player about one fed voyage in 15 in act 2 (its mass, evading less). That is why the scrap job doesn't drop one. Since M31 the scrap job can drop Scrapline's engine, and the test player buys and fits Scrapline's engines too, which draw 1 more power, so some ships launch with none to spare: a med bay or bunks fitted before a voyage then needs a small reactor with it (the voyage tests fit one), and the trip refit at the colony takes a power plant back aboard (raised in M23g)
- parts that hang off the life support: the voyage test player's refits on the run can fit a part joined to the bridge only through the life support or the quarters, which then can't go to the colony without cutting it off. Over 100 seeds, the deserter's colonies fell short of air for it in 3 before M31, 7 after it and 15 by M39 (16 in M40), the miner's in 0 to 1. Refitting at the colony to move the part first, or fitting it where it touches a corridor, would free them (raised in M31)
- Kestrel's mark: two narrow coral stripes along a part's roof read as a coral edge on the folded screen (a few pixels at 821 × 283). Wider stripes, or one down the middle, would read sooner (raised in M31)
- a parts dealer at stations: a few parts for sale, the same on every visit, and spares bought back at half price. Refits use what the run finds until then; the dealer needs a save bump for what has been bought (Evan's call in M23h: later)
- scrapping a wrecked part in a refit, to fit a spare in its place without paying for the repair. Without a dealer to replace it, a ship that scraps its only engine would be stranded at the station (raised in M23h)
- refits away from stations: moving and turning what is aboard between jumps, with fitting and taking off still at stations (raised in M23h)
- the station's foot: Buy, Repair and Patch up crowd it at 821 × 283, which is why Refit is the ship's panel, as the crew's opens the crew card, and M24's transponder swap is in the left panel. A station menu could hold them all (raised in M23h)
- the rest of §4.4's act 2 heat: payments on the debt at stations, as in act 1 (Evan's call in M24: not now), agents at stations from heat 25, and bribes (raised in M24; docking came in M33)
- what Regroup is worth to a careful player: the test player managing heat is written never to regroup (a day's 3 hit points each costs 5 heat and, from 50, a hunters' roll; it patches up at stations instead), so the voyages don't say. The test player ignoring heat regroups 7 times a run at the median. A test player that weighs it would (raised in M24)
- the node a long jump passes: the hunters roll only where it comes out, 10 heat cooler, so a long jump in place of a jump where they may wait skips a roll as well as shedding heat. The careful test player managing heat takes 3 a run at the median (1 to 6). A chance at the node passed would weigh long jumps against nebulae and the swap differently (raised in M24)
- the landing over the world itself: M25's landing is the lift-off backwards against the stars. A world drawn under the ship, by its kind, or a scene in M34's image pass (raised in M25)
- a mark on the chart for each kind of world: M25 gives every world the same mark, its kind in words beside it (raised in M25)
- what danger does in act 3: since M27 soil and water grow a farm's food and ore a mine's materials, and since M29 lanes set how often the pursuer finds the colony and the heat a trip adds. Danger still does nothing: it could raise the raid's odds or its party, or roll a hazard at the places. The test player's score (soil + water + ore + lanes − danger) weighs them all alike (raised in M25, narrowed in M29)
- food at the colony: on 24 of 30 careful colonies one or two farms feed the crew from day 1 (ocean, ice and jungle worlds); only rock and desert need mines first, and go hungry up to 8 days. Fewer crops a farm, a farm that needs power or water, or a crew that eats more would make food a thing to plan (raised in M27)
- the test player at the colony doesn't set spare parts down or move buildings. Since M28 it takes buildings down and refits, but only to put berths and air back aboard for its squad, so the 17 colonies whose quarters hold the ship together still sleep aboard at home. A test player that frees them would measure what that is worth (raised in M27, narrowed in M28)
- time away costs little at home: the careful test player is away 28 of its 30 days of trips. Since M29 a raid can land while the ship is away, and those at home fight it, but the careful test player stays home while one is coming and over 30 runs met none while away. A test player that flies out with a raid coming, or work at home that wants the crew, would measure what a trip risks (raised in M28, narrowed in M29)
- the buildings' raid numbers in their rows: a building's row says its part's own numbers (a gun emplacement's "Guns 15", a shield dome's "Shield 10"), not what it does in a raid. The colony's Defense line and Defend's first tap say that: the shots at a lander, and the defenders' armor and aim (raised in M29)
- shedding heat at the colony: only the days do, 1 a day, and after a raid it falls to 40. A payment as in act 1, or lying low (no trips, the lights out) for faster cooling, would give the player a lever (raised in M29)
- a raid that grows with heat: the party is always the pursuer's four, whatever the heat. A bigger party at a task force or cornered, or a second lander, would make heat at the colony matter more than its odds (raised in M29)
- the guns in the fight: the colony's defenses fire only at the lander as it comes down. A gun emplacement that fires as overwatch over its corner of the grid in the fight, or a shield dome's cover, would keep them in play after the landing (raised in M29)
- the landing seen: M29's landing is a line of words. The lander coming down over the colony, the guns' tracers and its hits, would make it read at a glance, as M21's shots would in the approach (raised in M29)
- the colony's fight at a size: the colony's grid is 20 × 12, so its tiles open at about 29 px on the cover screen, under the 48 px a ship's open at. The two taps keep it safe, and a pinch zooms; opening on the crew's half would make them bigger (raised in M29)
- more events at the places: M28 has 8, two a kind, so a colony's 9 trips in 30 days meet them again (raised in M28)
- a trip's lift-off and landing: the ship's pad empties and fills at once. M17's lift-off and M25's landing could play over the colony (raised in M28)
- a warning on giving a part a trip needs: the colony can take the ship's life support or quarters, and the trip's plan is the first to say it can't fly. Giving could count a full squad, as construction mode at the colony does (raised in M28)
- a tap on the ship in the colony's view: a part is given from the list on the right in M26. Tapping it on the landed ship would do the same, but a cell there is about 13 px on the cover screen, too small to tap (raised in M26)
- a lever for the Fleet Provost in place of a payment: a deserter's heat only falls in act 1 when a raid is faced, so a hot deserter has to fight. A job that buys a pardon's paperwork, or turning in someone else's name, would be its way to shed heat (raised in M30)
- the backgrounds past act 1: from the launch on, a background is its pursuer's ships, words and raiders. Its own events on the run (the deserter's old shipmates at a station, the smuggler's contacts in the nebulae) and its own colony build would carry it further (raised in M30)
- a background's hunters by name in the jump plan: the plan says the pursuer's chance, and the approach screen names the ship. Naming it in the plan too ("a Provost cutter, 10%") would tell a new player what is coming (raised in M30)
- why the smuggler's colony is raided more: from the smuggler's start the careful test player's colonies are found in 20 runs of 30 (33 raids) against the miner's 13 (18 raids), most of the difference far from the lanes, though it settles no hotter and flies about as many trips. Finding out would take the voyage report's days at the colony, heat by heat (raised in M30)
- the background screen's details at a glance: on the cover screen the facts below Fitted need a swipe of the panel. A two-column layout of the facts, or the start's ship drawn small beside them, would show the whole start at once (raised in M30)
- a way out of a fight no one can end: no one passes the other side's fallen (moves.js), so the fallen in a doorway can leave both sides out of each other's sight for good, and a fight can't be left. The test player's trips stop there (`tools/boarding.js` sealedIn; one of the smuggler's 100 test voyages). Letting anyone pass those who have bled out (status out) ends it, but raiders then walk past the fallen: the start crew's hangar raid wins fell from 53% to 41% (Con-Reg) and from 46% to 27% (the Hallorans), and one smuggler's act 1 test run stopped launching. A Withdraw order away from home is the other candidate (raised in M32)
- orders the test players seldom give: over 300 fights each, the crew's AI gives Suppress 0.3 times a fight and Weld 0.3, and neither raises its win rate (−1 point each, within chance), where Kit out adds 14 points, Patch 6 and Sedate 6. Plainer rules give the measurements; a player will use them better (raised in M32)
- long job names in narrow places: the run's crew panel cuts "Quartermaster" to "Quarter…" on the cover screen, and "Xenobiologist" likewise. A short form for the panel, or a second line, would show them whole (raised in M32)
- the job's three lines on the captain screen: on the cover screen they sit below the job buttons and need a swipe of the panel (raised in M32)
- talents the harness feels: since M32b's fix rank 1 adds a use and a sharper number, and in the harness (each order at rank 1 against rank 0, 300 fights each) each order's moves the crew's wins 2 points or less either way (Kit out's at 2 armor moved them 20, and stays at 1, Evan's call). Its AI gives Suppress, Weld and Hustle under once a fight, so a use more changes little there; a player may use them more. Whether rank 1 now feels right is for the phone (raised in M32b, narrowed in its fix)
- a recruit's fee by what their traits give: the fee counts traits, not their worth, so Hothead costs what Patched suit does (raised in M32b)
- the recruit's row on the cover screen: a recruit with a background takes about eight lines in the crew card's half-width list (the background's line, rank and fights, traits, what the job brings), so the list for hire shows about one at a time. Their background's line on the first tap of Sign on, or a wider list for hire, would show two (raised in M32b)
- traits the test players weigh: the test players' captains have no traits, and the voyage's test player picks a recruit by the job the crew has fewest of, then hit points, so the 14 new traits reach its voyages only by chance, through recruits (raised in M32b)
- a raid that hangs on where each one stands: the raiders deploy in their party's order, and the order alone moves the results a long way. The Hallorans' six with the enforcer first to sixth gave the smuggler's crew 68%, 46%, 19%, 63%, 41% and 67% at the hangar; two MPs and a rating, 31% with the rating last and 47% with it between. Parties are tuned by measurement, so a layout change can move them (raised in M32)
- a side in the Narrows: none of its clients has one, so in act 1 a smuggler's standing only moves against the Fleet (the customs jobs) and the Hallorans, never up. A union client there, or one who pays to see the Hallorans hurt, would give a smuggler a side to build (raised in M33)
- standing in act 3: raids and the colony don't move it, and it changes nothing there. The sides could trade with a colony, call at it, or raid it (raised in M33)
- the hangar's side column on the folded screen (821 × 283): with the Sides panel it scrolls as a whole, so the crew and the sides take a swipe. A tab between them, or the sides as a line under the heat meter, would keep both in sight (raised in M33)
- the Fleet's chain's price in supplies: lending the tender a hand costs 3 and tagging the pod gives up its 8, about 11 fed voyages of 300 for the careful miner (M33b). A tagged pod could hand back some supplies as the Fleet's thanks, if the chain should cost less
- a side's chain started in act 2's last sector: its step comes from the next sector on, so it goes cold as the ship leaves, said only by the last jump point's plan. The start's first tap could say so, or the start wait for a sector to follow (raised in M33c)
- Bosun's weld (Varga's talent): in 1,000 fights against the same squad at rank 2 it moves the wins 0 points, where M40 brought the other three talents to 7 to 12. The AI welds 0.2 times a fight. In M40's trials (1,000 fights each) no weld lifted the wins more than 4 points: 20 rounds or 6 uses, none; a weld that also patches the allies beside it 4 to 10 hit points, 2 to 3; that and getting a fallen ally beside it up, 3 to 4; welding as soon as an enemy is in sight cost 9 to 13. Candidates, Evan's call: accept it as it is, the weld that patches and gets the fallen up (+4), or an engineer's talent of another kind (raised in M33c, narrowed in M40)
- the companion at their own loyalty place: the squad that flies there needn't have them in it, and nothing changes if it does (raised in M33c)
- companions on the start ships: a fourth mouth needs 40 supplies for 10 jumps, and the miner's and the deserter's ships carry 30, so their test voyages sign a companion on mostly where it is Teo, whose lockers carry him (raised in M33c)

- more sounds: each order its own (a weld's crackle, a patch's hiss, a mark's ping), a fight won or lost, footsteps, music (raised in M35)
- the weapons' balance: the shotgun is the best weapon both aboard ships and on the ground (the whole squad carrying it wins 78% both ways, against 51% and 66% as issued), and the rifle beats the carbine both ways (33% against 23% aboard, 64% against 55% on the ground). Seven enemy types carry the carbine, so changing it moves every fight they're in. Measured again for M40 and not among Evan's picks (raised in M37)
- the AI's out-and-back steps: in some layouts a unit steps out with one action and back with the next, turn after turn. In a raid on the colony, the raiders and a crew member with a torch out of reach did it for 20 rounds. In play the player moves the crew; the test harness makes both sides close in once a fight drags (raised in M37)
- the worth of a weapon on the run: bought freely, the test players' weapons spent the purse that keeps the hunters off, and as many as 22 fewer voyages of 100 crossed fed. They buy only big steps up now, beyond a holdful's price and a swap's. Weapons may want to be cheaper, or the run's fights to matter more; and the table's wins are the whole squad carrying each, so what one member gains is a guess (raised in M37)
- the new missions' balance: the still (a sabotage of two targets) wins 57% of the time, but only 10% by its objective, the rest as a clear-out; closing time (a defense of 8 rounds) wins 85%, 27% by holding. Act 1's credits at launch moved with the new jobs and the guards: the miner's up 44%, the deserter's down 9% and the smuggler's down 12%. For M40's balance runs (raised in M38)
- the credits screen: ZzFX is the first entry in `assets/LICENSES.md`, and the screen that lists them comes with the release (Phase 9; raised in M35)
- the squad's wounds on the run: a station job costs its squad 6 to 19 hit points of 26 on average, and patching them costs 2 credits each, so work feeds the patching bill. A med bay's crew, fit more often, works more and patches more (raised in M38c)
- a station's work on the chart: nothing says what a station posts until the ship is there. A mark for a station with work, or the count in the jump plan, would let a player plan a route for it (raised in M38c)
- the test player's view of a job: it weighs a station job at the full-health start crews' odds and wounds (with act 1's factor for a twist), never by the squad going, so a hurt, ranked or better-armed squad weighs the same (raised in M38c)
- a split crew's boardings: flying out with 2 of 3, the test player lost 7 of the 8 boardings of the ship (the boarders come as many as with the whole crew aboard). Boarding parties sized to those aboard, or a test player that takes more aboard, would tell more. The raids that caught the one left home are answered: M38d's fix gives time to fly home for them (raised in M38d)
- the mines while the ship is away: with no storehouse what they dig is lost, as at home past the stores (13 of the test player's 100 colonies, 1,350 materials in all). The plan says so; a storehouse keeps it (raised in M38d's fix)
- the second colony's raids: two or three there and no guns yet, so the test player lost 2 of the 5 it faced there (none at the first). Its heat is the ship's as it settled, after a voyage's jumps, so it is found sooner than a new colony would expect. A quieter landing, or guns from the hold set down first, would even it (raised in M38e)
- flights between colonies cross no system: days and supplies only, nothing met on the way. Fine for straight flights; a long one could pass a station or a hostile ship (raised in M38e)
- the act line at every colony says "Act 3 · The colony"; the world's name is on the line under it. A colony's own name, or its number, could head it (raised in M38e)
- survivors settling: since M38f a station job's freed captive settles at the colony flown from. An event's survivors (a derelict's crew, a wreck's) could settle the same way, a citizen more each (raised in M38f)
- the test player builds no room for citizens: its shelters are for the crew who stay home, so a colony grows only into what is free. A careful player would build beds and air, and farms to feed them; a test player that does would measure it (raised in M38f)
- a raid fought out without the player is decided whole at once. Its log could be kept, to replay on landing, or a fallen colonist named in the report (raised in M38f)
- an enemy's grapple and torpedoes: M39's Done when had the pirate cutter and the repo tug fly a grapple, and Con-Reg's gunship a torpedo bay. With them, an engine or a gun added to the start ship scored worse against those ships, which Law 1 forbids as it is measured: by score, where a getaway counts for less than a fight won. A Law 1 that weighs a getaway as the player does would let them fly (raised in M39)
- a turret that matters aboard an enemy ship: boarders go on past a turret to the people, so the Provost cutter's changes the crew's boardings of her little (50% of 40 with it and without it). A turret guarding something, the bridge or a hatch, or one the AI keeps the crew under, would (raised in M39)
- a test player that buys a hull frame: none does, so a frame's worth on a run is measured only by moving the ship onto it (`tools/voyage.js --frame`). One that buys the courier or the freighter when the credits allow would show what a frame does to a run as played (raised in M39)
- a ship whose airlock can't be walked to from the bridge: the builder joins rooms by a shared wall, but a weapon mount's console can't be walked through, so a ship can be built, or left after giving parts to the colony, with its airlock's side joined to the bridge's by mounts alone. Boarders come in by the hatches and the crew starts on the bridge, so a boarding there could never end. The test player gives no part whose going does it (`tools/voyagePlan.js` hatchesCutOff; smuggler seed 22's colony gave such a reactor), but a player can. Candidates, Evan's call: the flight checklist or the colony's card warning, or a fight-level way out (raised in M40)

Ideas that come up during a session go here, not into code.
