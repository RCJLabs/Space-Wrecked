# ROADMAP.md: Space Wrecked

**One-liner:** Build a ship from scrap, run from whoever is hunting you, and find a world to call home. The ship you build is the map you defend: when you are boarded, the fight happens room by room in your own layout, in XCOM-style squad battles.

**Tone:** Wry and blue-collar (Evan's call, 2026-10-12, before M14). Working people doing dirty jobs, with dry humour: the company, the bills and the shift whistle are the background noise, not the villains' monologues.

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
  - **The screen:** both ships are drawn as their boarding maps, side by side and facing each other, so a wrecked room shows its hazard. It shows the other ship's order with its odds, the orders along the bottom with theirs (two taps to give one), and the last round, roll by roll. Every chance is shown before its roll, a last reactor's blow-up included. Since M22, an approach that ends in a boarding shows her crew and what winning and losing come to, with Board her and Leave her, or Fight them off, in the orders' place.
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
- **Down, not dead:** crew at 0 HP go down and bleed out over 3 of their own turns (`balance.bleedOutTurns`) unless an ally beside them stabilizes them. Bleeding out puts them out of the fight, badly hurt, or kills them where permanent death is on (harder settings only). Enemies at 0 HP die.
- **Hazards** (M7): fire burns 2 at the start of each of a unit's turns there. In vacuum, suit air lasts 3 turns, then the unit takes 2 a turn (the oxygen clock).
- **Objectives:** eliminate, extract, hack, rescue, hold, salvage. M7 has eliminate: a side wins when the other has no one standing. M14 adds two for jobs, besides clearing out:
  - **grab:** grab every tagged crate (the site's loot tiles), each from beside it;
  - **hack:** work the terminal for a number of rounds.

  Once the objective is done the crew has won, whoever is still standing. A deadline (a job's twist) ends the battle at the end of the crew's turn in its round: if the crew hasn't won by then, it has lost.
- **Forgiving odds:** an optional setting (M18, in Settings, off unless turned on) adds 10 to the crew's next shot for each miss in a row, up to 30. The bonus is included in the number shown, so Law 4 still holds.
- **Difficulty** (M18, in Settings): Easy, Normal or Hard, from the next fight. Easy enemies aim 10 worse and have 1 hit point fewer; Hard enemies aim 5 better and have 1 more (`data/balance.json`). Normal leaves them as the data has them. Permanent death waits for recruits and a game over (§9).
- **The log:** every action returns the events it caused, and the same setup, seed and actions always give the same events (`src/sim/battle.js`; the example battle in `tests/golden/` is replayed by the tests).
- **Giving orders** (M8, `src/sim/fight.js`): a tap never spends an action. A tap on a tile shows the move (its path, one action or a dash, and the cover where it stops), and a second tap on it makes it. A tap on an enemy, or Shoot, shows the shot with its odds part by part, and Fire or a second tap takes it. Overwatch, Reload, Stabilize and Open door are buttons, and on a job Grab and Hack, shown only when there is a crate or the terminal in reach; End turn takes a second tap while anyone can still act. A job's objective shows under the round, and its crates and terminal are tagged on the board. The board opens square to the ship, where tiles are biggest, and every enemy is shown (no fog of war); those the selected unit can see show the hit chance. No button sits over the board (M18): Title, Log and Fit head the orders' column on the right, since Chrome takes a tap on a tile beside a button for the button.
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
- **Raiders press on** (M15, `src/sim/press.js`): with an enemy in sight a raider plays as the AI does; otherwise it walks toward the crew and opens the doors in its way, so a raid can't stall at a door. A battle with `options.press` (a raid) plays its enemy this way, and the test player that plays the crew on jobs (`src/sim/jobAi.js`) is built on it. Boarders still play the AI alone.

### 4.4 Heat

- A meter from 0 to 100 per run, owned by your background's pursuer.
- **Gains (starting values):**
  - job +8, loud job +15
  - jump +2 (3 until M24), regroup +5, a survey from orbit +2 (M25)
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
  - **The hunters** may wait wherever a jump comes out, a long jump and the jump on into the next sector's way in too, by the heat the ship comes out with: from 50 the repo tug at 10% (`huntChance`), from 75 the gunship at 35% (`taskForceChance`), and at 100 the gunship, certain and not rolled (§4.2 has their ships). They never wait at a station (`safe`) or in a nebula (`hides`, kinds' flags in `data/sectors.json`). The jump's plan shows the chance and the chart rings the nodes they may wait at; the roll is the campaign's, as shown (Law 4).
  - **Met,** they are an approach like a hostile ship's, whatever the node holds. A hostile ship there slips away (its node is done), and an event there waits until they are dealt with: the hunters settle nothing.
  - **Faced,** heat falls to 40 (`heatAfterRaid`), as after act 1's raid: they fled, were blown up or left adrift, or a boarding either way (heat falls as it begins, won or lost). Getting away, or parting after the last round, leaves heat where it was, 4 more if a gun fired. Beaten at home, they take what a lost raid takes.
  - **Regroup** (two taps, on the chart): away from stations, with anyone hurt, a day's rest eats a jump's supplies, heals each of the wounded 3 (`regroupHp`) and the med bay's day, and adds 5 heat (`regroupHeat`). The hunters may find the ship at the odds a jump there would have.
  - **Hide** is Regroup in a nebula: heat falls 10 (`hideHeat`) instead, with no roll, and the wounded heal all the same. It can be taken with no one hurt while there is heat to lose.
  - **The transponder swap** (two taps, in the left panel at a station, where the foot has no room for a fifth service): once a sector (`run.swapped`), 30 heat off (`swapHeat`) for 40 credits (`swapPrice`).
  - **A jump adds 2,** down from 3: every option of the trade below was measured with it, though the question named only the hunters' chance, so it is a call made in M24, not Evan's pick.
  - **Not built:** agents at stations from 25, docking in pursuer space, bribes, and payments on the debt in act 2 (§9). 100's confrontation is the gunship, certain.
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
- **Ranks** (M32b, `src/sim/ranks.js`): every crew member counts the fights they stand in, won or lost (`endFight`), and at 3 and 8 (`rankOneFights`, `rankTwoFights`) reaches their job's rank 1 and rank 2 (`ranks` in `data/jobs.json`), each with a name and words. Rank 1 sharpens the job's order, and since the M32b fix gives it a use more as well (Hustle and Kit out, whose rank 1 was a use, a sharper number instead); rank 2 sharpens its effect aboard or at the colony; each keeps what the one below gave. A crew member's own rank sets their order; an effect takes the best rank of the job among those it counts. The fight's end names who reaches a rank and what it gives, a chevron for each rank sits over a portrait's corner (the fight's crew buttons, the squad card, the crew card) and beside a name in the crew panels, and the crew card says each one's rank and fights.
- **Jobs:** Marine, Engineer and Medic in v0.1; Pilot, Scout, Xenobiologist and Quartermaster since M32. Each job has an order in a fight with a few uses, an effect aboard on the run and an effect at the colony (`order`, `station` and `colony` in `data/jobs.json`; the rules in `src/sim/orders.js` and `src/sim/edges.js`). The first station effect was the medic's (M23): one more hit point a jump from a working med bay. The best of a job counts, once: a second of the same job adds nothing.
- **Wounds** carry between battles and heal in the med bay over time. Since M12 a crew member's hit points carry through a fight, and anyone who went down comes back with 1. In act 1 the crew heals fully back at the hangar (Evan's call, 2026-10-12). In act 2, since M23 (`src/sim/medbay.js`), a working med bay heals each of the wounded 1 hit point a jump (`heal` in `data/modules.json`), 2 with a medic aboard, up to their most. A long jump counts as 3 (`longJumpFactor`), leaving a sector as 1, and a wrecked med bay heals nothing. Hunger comes off before the healing. A station still patches the crew up for credits (M22, §4.6).
- **Portraits:** recruits use layered SVG portraits drawn in code, so scars and implants can appear mid-game. Named characters use hand-edited Base44 portraits. **As built in M23c:** every crew member has a look saved with them (`src/sim/looks.js`): a face shape, skin, hair, hair color, eyes, beard and a mark, two layers apart from everyone else aboard. It is drawn as a helmet badge (`src/render/portraits/`): the face through the helmet their job wears in a fight, on a card in their trim. The captain's look is picked at creation, layer by layer or rolled; a recruit's is rolled with them; the start crew's, and their names, come from the campaign's seed. Marks are layers already, so scars earned in play need only the rule (§9).

### 4.6 Economy

- **Credits** buy parts and services. **Parts** are modules held in inventory. **Salvage** is raw material for repairs and, later, crafting.
- **Act 1 starts** (M13; since M14 the background's start in `data/backgrounds.json`) with a half-built hull: bridge, reactor, corridors, airlock and a gun, with no quarters, life support or engines. On hand are crew quarters, life support and two corridors, so a new player's first minute fixes two flight checks. The engines have to come from jobs. Since M30 each background starts its own way (§5): the deserter with a shield generator and small reactor fitted and an engine on hand, the smuggler with a light engine and cargo hold fitted and 75 credits.
- **Jobs pay** (M14) credits, and on some jobs a part from the job's drop table (M16, §4.7): the repossession always pays an engine, once; the scrap run sometimes. Credits also buy heat off: a payment on the debt, 50 credits for 15 (M15, §4.4). A lost raid can take half of them.
- **Prices** (M16, `src/sim/economy.js`): a part costs its module's cost (`buyPercent` 100 in `data/balance.json`), and the shop buys one back for half (`sellPercent` 50), rounded down to 5 credits. The engine, at 200, is the dear part.
- **The shop** (M16): the district's dealer, Dutch's yard (`shop` in `data/districts.json`). It has 4 different parts at a time, picked by weight from its table (engines weigh most) when each job board is rolled, so it turns over after every job. A price is fixed when it is offered. It buys any part on hand.
- **Lifting off** (M16): act 1 ends by lifting off Homeworld, so its checklist asks for thrust at least the ship's mass (`liftOff` 1 in `data/campaign.json`), where the frame asks half. The start ship needs three engines; stripping it can save one at most. Only the campaign asks this.
- **Supplies** (M19, `src/sim/travel.js`; the numbers in `data/balance.json`): a jump eats one per crew member (`jumpSupplies`), a long jump three times that (`longJumpFactor`). The ship carries 30 in its lockers (`baseSupplies`, 24 in M19) and 20 more for each cargo hold. The run starts with them full. Stations sell them at 1 credit each (`supplyPrice`). A jump the supplies don't cover still goes: they run out, and each crew member loses 2 hit points (`hungerHp`), never the last one. In act 2 the crew heals at stations for credits (M22) and, since M23, in a working med bay over jumps (§4.5). A recruit is one more mouth: the start ship's 30 lockers last a crew of 4 seven jumps.
  - **Tuning** (M19's test player, `tools/voyage.js`, 30 launches from M16's test runs): 12 lockers at 3 credits starved every run, since 12 supplies don't reach from one station to the next. At 24 and 1 credit, a careful player with no long jumps crosses three sectors without going hungry in 18 of 30 runs, and all five in 8. The runs that go hungry launched with few credits: launch money is median 50 (0 to 220), and act 2 pays nothing until M20's nodes. M20 retunes this once nodes pay.
  - **Retuned in M20,** when the nodes began to pay (M20's test player, the same 30 launches, long jumps at heat 50 or over; with no long jumps in brackets): with M19's 24 lockers and 1 or 2 stations a sector, 12 of 30 runs crossed all five sectors fed (15), though the nodes paid the median run over 100 credits. Money wasn't the problem: the holds ran dry between supply stops. Two stations in every sector alone made 17 (24); 30 lockers alone, 14 (20); doubling the traders' weight alone, 12 (18). Both, 30 lockers and 2 stations a sector: 25 of 30 (24), and 21 with no scans.
- **What the nodes pay** (M20, `data/events.json`): credits and supplies from derelicts and distress calls, and parts from derelicts; supplies sold cheap, and parts bought, by traders; and a cost at hazards, in hit points or supplies. Each choice's chances are shown and rolled as shown (§4.7). M20's test player settles 11 events a run at the median (5 to 13): 130 credits and 8 supplies from them, 3 parts found, 6 hit points lost. Act 2 still has nothing else to spend credits on; the median run ends with about 100 (180 with no long jumps).
- **Repairs** (M21, `src/sim/repair.js`): a module wrecked in an approach stays wrecked until a station repairs it, for a quarter of its cost (`repairPercent` 25) in steps of 5 credits: a gun or a shield generator 35, an engine or a reactor 50. Repair, on the sector map at a station, takes two taps and repairs what the credits cover, the cheapest first.
- **Patching** (M22, `src/sim/patch.js`): a station patches the crew up for 2 credits a hit point (`patchPrice`). Patch up takes two taps and heals a hit point at a time, to whoever has fewest left, as far as the credits go. Patching up a start crew at 2 hit points each costs 40.
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

**Traits as built:** 20 since M32b (`data/traits.json`), ten of them trading one fight number for another as Hothead does. The captain picks 2; recruits roll theirs from their background.

**Manufacturers as built:** four, one past the target: the Yard's, Bastion Arms' (M23g, 21 versions), Kestrel Dynamics' (M31, 16) and Scrapline's (M31, 21). 79 parts in all in `data/modules.json`.

**Backgrounds as built** (`data/backgrounds.json`), each with its district in `data/districts.json`: six clients, four job sites (one on each site map), a shop, and its jobs in `data/contracts.json`:
- **Debt-bound miner** (M14). Con-Reg Recovery, the company's repo crews, hunt you by tracking your ship's registration, and take payments on the debt. Act 1's district is the Tailings, with 10 jobs.
- **Navy deserter** (M30). The Fleet Provost, the Navy's police, take no payments. The district is the Strand, the spaceport's sailors' quarter, with 8 jobs. A marine, a pilot and a medic (two marines before M32), no credits.
- **Burned smuggler** (M30). The Halloran family want their cargo's worth, and take a dearer vig. The district is the Narrows, the old town's back streets, with 8 jobs. An engineer, a quartermaster and a medic (two engineers before M32), 75 credits.

**Jobs as built** (M32): all seven of §4.5's, each with an order, an effect aboard and an effect at the colony. Two weapons came with them, the scout's long rifle and the xenobiologist's dart gun, six in all.

---

## 6. Versions

| Version | Phases | What a player gets |
| --- | --- | --- |
| v0.1 | 0 to 3 | Build a ship in your hangar, take jobs, fight off a raid, launch |
| v0.2 | 4 | The run: sectors, the approach phase, boarding both ways, recruits, scouting worlds |
| v0.3 | 5 | The colony: settling, the colony builder, expeditions, raids |
| v0.4 | 6 | Breadth: 3 backgrounds, 4 manufacturers, all jobs, factions, quests, images, audio |
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
  - **Talents raised:** rank 1 gives the job's order a use more as well as its sharper number: Suppress, Weld, Patch, Mark and Sedate three times a fight at rank 1's numbers. Hustle and Kit out, whose rank 1 was already a use, sharpen a number instead: two more actions, 2 armor.
  - **The Provost's raid at the hangar evened out:** an MP and two cadets (`provosthangar`), the cadet sturdier (7 hit points, aim 70, from 6 and 65). The colony keeps an MP, a cadet and an MP. M30's test plays 300 fights a row, not 150.
- [ ] M33 Factions, quests and companions. Draft: factions whose standing moves with the jobs and events the crew takes; quests that chain jobs and events across the acts; named companions with loyalty quests (§9).
- [ ] M34 Image pass: Base44 portraits and scenes. Draft: WebP portraits for named characters (companions, the districts' clients) and scenes (the hangar, the lift-off, the landing), each logged in `assets/LOG.md`. Recruits keep their layered portraits, drawn in code since M23c.
- [ ] M35 Audio pass with ZzFX. Draft: sounds made in code with ZzFX (approved for M35): shots and hits, the builder's placing, and the menus; a mute and a volume in the settings; audio starts after the first tap.

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
- named companions with loyalty quests
- decals: a name or a number on the hull, and a side's emblem. M23f brought paint and trim (raised before M4; narrowed in M23f)
- vibration on hits
- closing doors in battle, and locked doors: since M7 a unit can open a door beside it, but not shut one (raised in M7: defenders sealing a breach)
- fog of war: since M8 every enemy is always shown; hiding those no one in the crew can see would make scouting matter (raised in M7, decided against for now in M8)
- the camera following the action in an enemy turn: on a ship too big for the screen, part of a turn can play out of view (raised in M8)
- dragging to lay a run of corridor in one go: since M5b a corridor is one cell, so a long one takes two taps a cell (raised in M5b; could come sooner if Gate 1 finds it tedious)
- doorways onto lockers: the builder puts a doorway in the middle of a shared wall even with a locker, crates or machinery behind it. That can leave a room out of reach on foot in a fight. Generated ships avoid it; a player's ship still can, with no warning (raised in M10)
- an enemy hull frame: §5 counts one for v0.1, but every preset builds on the starter yard for now. One comes when enemy ships need a bigger yard or a higher cap (raised in M10)
- the campaign ship's timelapse: the campaign keeps no build log, so construction mode has no replay. A log would need a save version bump (raised in M13)
- the hangar's goal lines as shortcuts: a fix whose part is on hand could open construction mode with that part picked, one tap fewer (raised in M13)
- enemies that guard the objective: the AI fights as it does on a boarding and pays the crates and terminal no mind (raised in M14)
- carrying crates out: a grab is done once the last crate is grabbed, with no walk back to the way in (raised in M14; it would be the extract objective in §4.3)
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
- permanent death as a harder setting: it needs recruits to replace the dead and a game over, which act 1 has neither of (raised in M18)
- tips past the first fight: the shop, heat and payments, a raid, launch. M18's tips cover building, the job board and the first fight's orders (raised in M18)
- reduced motion in a fight: the enemy's turn still plays step by step, with Skip to jump it (raised in M18)
- the sector map in 3D: M19's chart is flat, drawn in SVG like the job board. A starfield with the nodes as places, seen through the orbit camera, would match the ships (raised in M19)
- names on the sector map: M19 names a node in the left panel when it is picked. Every name on the chart would crowd it at 7 columns on the cover screen (raised in M19)
- tips for the run: what a jump costs, long jumps, stations and hunger, and since M24 the hunters' rings, Regroup, Hide and the transponder swap (raised in M19)
- a scanner part: scanning comes from the ship as such since M20. A sensor module that lengthens `scanRange` would tie scanning to the build, as Law 1 asks (raised in M20)
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
- the approach screen with the ships' hulls: it draws both ships as their boarding maps, so M23d's curves and M23f's styling don't show there. A view of each ship's outside beside its map would (raised in planning, 2026-10-13)
- a test player that weighs a recruit's mouth: M23's signs one on only with 10 jumps of supplies in the holds for the bigger crew, which the start ship's lockers never hold, so on the start ship it never hires (raised in M23)
- an enemy that fits shield arrays and small reactors: the corvette is mirrored, so it would carry them in pairs, and a pair of arrays holds 50 a round. A gunship preset that isn't mirrored, or one array across a mirrored ship's middle, would bring them in (raised in M23e)
- a checklist fix that offers a variant on hand: "Add Engine" asks for the base part even with a light engine on hand to fit (raised in M23e)
- surgery against a med bay with a medic aboard: on the careful test player's voyages it patches 37 hit points against 44 over 30 runs, since a med bay already heals most wounds between fights. M24's hunters wound mostly the ship that ignores heat (77 hit points a run in fights at the median), and the careful player who manages heat meets them in 6 runs of 30, so its voyages still show it little (raised in M23e)
- a faster test suite: since M23e the Law 1 tests fly ten ships in the approach and seven fleets of 30 voyages, and `node --test` took 1 min 45 s here. M23h's fitter (`tools/run.js` fitPart weighs a spot before building it) brought it to about 70 s with an eighth fleet. M24's fleets, managing heat and ignoring it, put it at about 95 s. Since M31 four fleets fly 100 seeds for the rate checks: the voyage tests take about 3 min 20 s alone, and `node --test` about 4 min 15 s here (raised in M23e)
- the far side in the Look: the builder looks at the ship from the south, so a piece on the north side is half hidden behind the hull. Pieces being placed and picked out are drawn over it; turning the camera to the side being styled would show the piece itself (raised in M23f)
- enemy looks placed with an eye: their pieces go anywhere they fit, so a cutter's wing can sit by the bow. Wings aft and gear on top would read better, and sculpt (slopes at their steps) would sleek them (raised in M23f)
- the plans' rough frames for the outside views while the camera moves: at 960 × 825 a dressed ship turns a few frames a second slower than a bare one, and the lift-off of the start ship in 13 pieces slower than main's (raised in M23f, after M23d)
- Scrapline's rust on a rust-painted hull: its fittings are rust brown, so on a ship painted Rust its parts don't stand out from the hull outside; its lime on the plans and its green flames still tell them apart (raised in M23g)
- makers inside: a boarding map draws every room in the Yard's skin, whoever made the part (raised in M23g)
- swapping a placed part's maker: a part is a maker's from the drawer, and the other maker's version means taking it off and placing that one (raised in M23g)
- the test players and makers: act 1's test player fits whichever maker's part is on hand, and a Bastion engine fitted in act 1 costs the careful player about one fed voyage in 15 in act 2 (its mass, evading less). That is why the scrap job doesn't drop one. Since M31 the scrap job can drop Scrapline's engine, and the test player buys and fits Scrapline's engines too, which draw 1 more power, so some ships launch with none to spare: a med bay or bunks fitted before a voyage then needs a small reactor with it (the voyage tests fit one), and the trip refit at the colony takes a power plant back aboard (raised in M23g)
- the voyage's balance past seed 30: over 100 seeds before M31, main's careful player managing heat met the hunters in 33 runs (M24's pick: at most 6 of 30, a fifth of them) and crossed fed in 73 (M24: 24 of 30, four in five); 14 went hungry in the system (M25: none); and the smuggler met the hunters in 19 against the miner's 42 (M30: about as many). The voyage tests hold those rates since M31, Evan's call; reaching the first targets is balance work for Phase 7 (raised in M31)
- parts that hang off the life support: the voyage test player's refits on the run can fit a part joined to the bridge only through the life support or the quarters, which then can't go to the colony without cutting it off. Over 100 seeds, the deserter's colonies fell short of air for it in 3 before M31 and 7 since, the miner's in 0 and 1. Refitting at the colony to move the part first, or fitting it where it touches a corridor, would free them (raised in M31)
- Kestrel's mark: two narrow coral stripes along a part's roof read as a coral edge on the folded screen (a few pixels at 821 × 283). Wider stripes, or one down the middle, would read sooner (raised in M31)
- a parts dealer at stations: a few parts for sale, the same on every visit, and spares bought back at half price. Refits use what the run finds until then; the dealer needs a save bump for what has been bought (Evan's call in M23h: later)
- scrapping a wrecked part in a refit, to fit a spare in its place without paying for the repair. Without a dealer to replace it, a ship that scraps its only engine would be stranded at the station (raised in M23h)
- refits away from stations: moving and turning what is aboard between jumps, with fitting and taking off still at stations (raised in M23h)
- the station's foot: Buy, Repair and Patch up crowd it at 821 × 283, which is why Refit is the ship's panel, as the crew's opens the crew card, and M24's transponder swap is in the left panel. A station menu could hold them all (raised in M23h)
- the rest of §4.4's act 2 heat: payments on the debt at stations, as in act 1 (Evan's call in M24: not now), agents at stations from heat 25, docking at a station in pursuer space for +10, and bribes (raised in M24)
- what Regroup is worth to a careful player: the test player managing heat is written never to regroup (a day's 3 hit points each costs 5 heat and, from 50, a hunters' roll; it patches up at stations instead), so the voyages don't say. The test player ignoring heat regroups 7 times a run at the median. A test player that weighs it would (raised in M24)
- the node a long jump passes: the hunters roll only where it comes out, 10 heat cooler, so a long jump in place of a jump where they may wait skips a roll as well as shedding heat. The careful test player managing heat takes 3 a run at the median (1 to 6). A chance at the node passed would weigh long jumps against nebulae and the swap differently (raised in M24)
- heat past the charts: nothing sheds it in the system (no station, no nebula), and each survey and jump adds 2, so the careful test player managing heat meets the hunters there in 9 runs of 30, which makes 10 of 30 over the whole act against M24's 6. A nebula among the worlds, surveys that add no heat, or the hunters slower to follow past the charts would each cool it (raised in M25)
- the landing over the world itself: M25's landing is the lift-off backwards against the stars. A world drawn under the ship, by its kind, or a scene in M34's image pass (raised in M25)
- a mark on the chart for each kind of world: M25 gives every world the same mark, its kind in words beside it (raised in M25)
- what danger does in act 3: since M27 soil and water grow a farm's food and ore a mine's materials, and since M29 lanes set how often the pursuer finds the colony and the heat a trip adds. Danger still does nothing: it could raise the raid's odds or its party, or roll a hazard at the places. The test player's score (soil + water + ore + lanes − danger) weighs them all alike (raised in M25, narrowed in M29)
- supplies past the charts: no station is there, so a ship arrives with what the last sector left it. The careful test player surveys every world in only 15 runs of 30; ignoring heat, 8 runs arrive with less than a jump's worth (raised in M25)
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
- talents the harness feels: since M32b's fix rank 1 adds a use and a sharper number, and in the harness (each order at rank 1 against rank 0, 300 fights each) Kit out's moves the crew's wins from 45% to 65%, and the others 2 points or less either way. Its AI gives Suppress, Weld and Hustle under once a fight, so a use more changes little there; a player may use them more. Whether rank 1 now feels right is for the phone (raised in M32b, narrowed in its fix)
- a recruit's fee by what their traits give: the fee counts traits, not their worth, so Hothead costs what Patched suit does (raised in M32b)
- the recruit's row on the cover screen: a recruit with a background takes about eight lines in the crew card's half-width list (the background's line, rank and fights, traits, what the job brings), so the list for hire shows about one at a time. Their background's line on the first tap of Sign on, or a wider list for hire, would show two (raised in M32b)
- traits the test players weigh: the test players' captains have no traits, and the voyage's test player picks a recruit by the job the crew has fewest of, then hit points, so the 14 new traits reach its voyages only by chance, through recruits (raised in M32b)
- a raid that hangs on where each one stands: the raiders deploy in their party's order, and the order alone moves the results a long way. The Hallorans' six with the enforcer first to sixth gave the smuggler's crew 68%, 46%, 19%, 63%, 41% and 67% at the hangar; two MPs and a rating, 31% with the rating last and 47% with it between. Parties are tuned by measurement, so a layout change can move them (raised in M32)

Ideas that come up during a session go here, not into code.
