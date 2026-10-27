// Save format, versioning and export codes.
//
// A save is { version, data }. Loading always runs parse -> migrate ->
// validate. SAVE_VERSION gates the schema: never change what goes into `data`
// without bumping SAVE_VERSION and adding a migration. Never reset saves.
import { config } from '../config.js';
import { checksum, fromBase64Url, toBase64Url } from './codec.js';
import { isState } from './rng.js';
import { isShipData } from '../sim/builder.js';
import { emptyBuilds, isBuilds } from '../sim/builds.js';
import { campaignProblems } from '../sim/campaign.js';
import { crewLook } from '../sim/looks.js';
import { regridCommand, regridShip } from '../sim/regrid.js';
import { isCommand, logFor, renumbered } from '../sim/replay.js';
import { defaultSettings, settingsProblems } from '../sim/settings.js';

// History:
//   0  settings and RNG state (M0)
//   1  plus the builder's ship, or null before one is started (M3)
//   2  the ship becomes saved slots with build logs (builds.js) (M5)
//   3  the builder's cells split in four: ships and logs move to the fine
//      grid (regrid.js) (M5b)
//   4  plus the campaign (campaign.js), or null before one starts (M12)
//   5  the campaign's background, its job board, and jobs as fights: a
//      fight's job and its battle's objective (M14)
//   6  raids: a fight says whether it is the pursuer's raid (M15)
//   7  the shop: the campaign's stock at the shop, or null until one is
//      rolled, and the jobs done that only come once (M16)
//   8  launch: a campaign can be past act 1 (M17). Nothing in a v7 save
//      changes, but a game from before M17 would show an act 2 campaign
//      the hangar, so it is kept from reading one.
//   9  the first run: settings for difficulty, forgiving odds, motion and
//      tips; the campaign's captain, and every crew member's traits (M18)
//  10  the run: the campaign's supplies, and its run (act 2's sector map
//      and where the ship is on it), null until the run begins (M19)
//  11  events and scans: the run's events settled, its scans and the last
//      event's result; sector nodes may carry an event (M20)
//  12  the approach phase: the campaign's wrecked modules, and the run's
//      approach under way; sector nodes may carry a hostile ship (M21)
//  13  boarding fights: a fight may be a boarding, and an approach that
//      ends in one has its fight due (M22)
//  14  recruits: the run keeps who has signed on at the sector's stations
//      (M23)
//  15  portraits: every crew member's look (looks.js) (M23c)
//  16  hull styles: every ship's hull has a style (data/hulls.json): the
//      builder's ships, the campaign's, and the hostile one in an approach
//      (M23d)
//  17  styling: every ship has a paint, a trim and its styling pieces
//      (data/styling.json): the same ships, and a boarding fight's (M23f)
//  18  heat on the run: the run keeps whether the transponder has been
//      swapped in its sector, and an approach whether it is the pursuer's
//      hunters (M24)
//  19  the worlds past the charts: the run keeps the worlds it has
//      surveyed, and the campaign the colony, once a world is settled
//      (M25)
//  20  the colony's buildings: the ship's parts given to it, each where it
//      stands on the colony's grid (M26)
//  21  the colony's days and materials: act 3 counts days from the
//      landing, and the colony builds farms and mines from its materials
//      (M27)
//  22  expeditions: the colony's places within reach and the trip under
//      way, and a boarding fight's salvage may bring materials (M28)
//  23  raids: the raid coming at the colony, and a trip's leg a raid
//      stopped (M29)
//  24  every job: a battle's units keep their order's uses and what orders
//      left on them, the battle its welded doors, and each of the run's
//      scans how far it reached (M32)
//  25  ranks: every crew member counts the fights they have stood in, and
//      a recruit keeps their background (M32b)
//  26  factions: the campaign's standing with each side, and whether an
//      approach is a side's patrol waving the ship through or opening fire
//      (M33)
//  27  docking on trade: the run keeps whether the crew has traded at the
//      station the ship is at since it arrived (M33's fix)
//  28  quests: the campaign's quests and where each stands; a sector's
//      node may carry a quest's event, a place at the colony may be a
//      quest's, and a job a fight is on, an event's result and a trip's
//      may say what came of a quest (M33b)
//  29  companions: a crew member may be a companion, and loyal; a battle
//      unit a loyal companion's talent; and an event's result may say who
//      signed on (M33c)
//  30  sound: the settings say whether the game plays sound, and how loud
//      (M35)
//  31  events: the campaign keeps the events it has met; a trap's approach
//      says what sprang it; an event's result may say who took its choice
//      and what it did to the ship (M36)
//  32  weapons: a crew member can carry a weapon of their own, and the
//      campaign keeps its spare weapons; the shop sells weapons too; the run
//      keeps what it has bought off the stations' racks; an event's result
//      may say what weapon it found (M37)
//  33  shipyards: the run keeps the parts it has bought at the sectors'
//      shipyards, and the crew can dock at one (M37b)
//  34  missions: a job's fight can hold the new objectives (an extract, an
//      escort, a rescue, a sabotage, a defense), the person the crew
//      brings out, a crate in hand and the charges set (M38)
//  35  station jobs: the run keeps the jobs taken at the station the ship
//      is at, and a job's fight can be a station's, with the station's name
//      (M38c)
//  36  voyages: the colony keeps its system's other worlds and the voyage
//      under way, or none; the run can cross systems past the colony's,
//      with worlds among their nodes (M38d)
//  37  more colonies: the campaign keeps its other colonies, each with
//      whoever is there and its food; every colony its number, where it
//      lies along the line of systems and its own heat; a voyage where the
//      ship is along that line and the colony it flies to (M38e)
//  38  citizens: every colony its citizens, the days toward the next and
//      its news; a raid's fight can hold colonists (M38f)
//  39  the difficulty is the game's: the campaign keeps it, with permanent
//      death and the fallen, and the settings keep none (M41)
//  40  accessibility: the settings keep the colors (standard or
//      colorblind-safe) and the text size (M42)
//  41  doors as tactics: the settings keep fog of war, off (M45); a fight
//      under way can hold locked doors and doors forced, absent until the
//      first, so it reads as it was
//  42  refits on the move: a boarding fight's salvage keeps her working
//      parts to pick from (M46); one under way offers the parts it rolled
//  43  controls and feel: the settings keep the hand, the playback's speed,
//      what confirms and vibration (M47)
//  44  senses: the settings keep captions, off, and how the text is set,
//      standard (M49)
//  45  deployment: a raid's fight can open with the crew being placed
//      (battle.setup, M50, placing.js); one under way has begun already,
//      so it reads as it was
//  48  the reckoning: the campaign keeps when the pursuer's leader is due
//      at the founding colony and its ending once that is won, neither
//      yet (M56)
//  49  who they are and the ship's colors (M58): a crew member can carry a
//      callsign (none yet), every ship a paint pattern, a second color and
//      an engine glow (plain, bone, the maker's), and the ship's identity
//      what the crew's suits are painted (standard)
export const SAVE_VERSION = 49;

// Ordered list. Each step takes `data` from version `from` to `from + 1` and
// returns the new data. Never edit a shipped step; add a new one instead.
export const MIGRATIONS = [
  // The ship joins the save. Saves from before M3 have none yet.
  { from: 0, up: (data) => (isObject(data) ? { ...data, ship: null } : data) },
  // The one ship becomes slot 1, numbered in build order with a log that
  // builds it part by part. No ship yet: no slots.
  {
    from: 1,
    up: (data) => {
      if (!isObject(data)) return data;
      const { ship, ...rest } = data;
      if (ship === null || ship === undefined) return { ...rest, builds: emptyBuilds() };
      const tidy = isShipData(ship) ? renumbered(ship) : ship;
      return { ...rest, builds: { active: 0, slots: [{ name: 'Ship 1', ship: tidy, log: isShipData(ship) ? logFor(tidy) : [] }] } };
    },
  },
  // Every slot's ship and build log move to the fine grid, part for part.
  // Anything unreadable is left as it is for validate to report.
  {
    from: 2,
    up: (data) => {
      if (!isObject(data) || !isObject(data.builds) || !Array.isArray(data.builds.slots)) return data;
      const slots = data.builds.slots.map((slot) => {
        if (!isObject(slot)) return slot;
        const ship = isShipData(slot.ship) ? regridShip(slot.ship) : slot.ship;
        const log = Array.isArray(slot.log) ? slot.log.map((command) => (isCommand(command) ? regridCommand(command) : command)) : slot.log;
        return { ...slot, ship, log };
      });
      return { ...data, builds: { ...data.builds, slots } };
    },
  },
  // The campaign joins the save. Saves from before M12 have none yet.
  { from: 3, up: (data) => (isObject(data) ? { ...data, campaign: null } : data) },
  // Jobs join the campaign. Every campaign so far began as the debt-bound
  // miner, the only start there was, and has no board yet (the hub rolls
  // one); a fight on is a fight at home, with no job and no objective.
  {
    from: 4,
    up: (data) => {
      if (!isObject(data) || !isObject(data.campaign)) return data;
      const { fight } = data.campaign;
      const job = isObject(fight) ? { ...fight, job: null, battle: isObject(fight.battle) ? { ...fight.battle, objective: null } : fight.battle } : fight;
      return { ...data, campaign: { ...data.campaign, background: 'miner', board: [], fight: job } };
    },
  },
  // Raids join the campaign. A fight on from before was a job or a fight
  // at home, never a raid.
  {
    from: 5,
    up: (data) => {
      if (!isObject(data) || !isObject(data.campaign) || !isObject(data.campaign.fight)) return data;
      return { ...data, campaign: { ...data.campaign, fight: { ...data.campaign.fight, raid: false } } };
    },
  },
  // The shop opens. A campaign from before has no stock yet: the hangar
  // rolls one, as it rolled a board for saves from before jobs. No job
  // was only done once before.
  {
    from: 6,
    up: (data) => (isObject(data) && isObject(data.campaign) ? { ...data, campaign: { ...data.campaign, shop: null, spent: [] } } : data),
  },
  // Launch. Every v7 campaign is in act 1, as before.
  { from: 7, up: (data) => data },
  // The first run. Settings keep the frame cap and take the defaults for
  // the rest, tips included: a player from before has seen none. A
  // campaign under way gets its first crew member as captain, as named,
  // and no one has traits yet.
  {
    from: 8,
    up: (data) => {
      if (!isObject(data)) return data;
      const settings = isObject(data.settings) ? { ...defaultSettings(), ...data.settings } : data.settings;
      const { campaign } = data;
      if (!isObject(campaign) || !Array.isArray(campaign.crew)) return { ...data, settings };
      const crew = campaign.crew.map((member) => (isObject(member) ? { ...member, traits: [] } : member));
      return { ...data, settings, campaign: { ...campaign, crew, captain: isObject(crew[0]) ? crew[0].id : null } };
    },
  },
  // The run. A campaign has no supplies yet, and its run begins at its
  // first visit home in act 2, launched already or not: the holds are
  // filled then (travel.js beginRun).
  {
    from: 9,
    up: (data) => (isObject(data) && isObject(data.campaign) ? { ...data, campaign: { ...data.campaign, supplies: 0, run: null } } : data),
  },
  // Events and scans. A run under way keeps its sector as it was, with
  // nothing settled and nothing scanned; its next sectors have events.
  {
    from: 10,
    up: (data) =>
      isObject(data) && isObject(data.campaign) && isObject(data.campaign.run)
        ? { ...data, campaign: { ...data.campaign, run: { ...data.campaign.run, done: [], scans: [], result: null } } }
        : data,
  },
  // The approach phase. The ship has nothing wrecked yet, and a run under
  // way has no approach going on; its sector has no hostile ships, and the
  // next one has them.
  {
    from: 11,
    up: (data) => {
      if (!isObject(data) || !isObject(data.campaign)) return data;
      const { run } = data.campaign;
      return { ...data, campaign: { ...data.campaign, wrecks: {}, run: isObject(run) ? { ...run, approach: null } : run } };
    },
  },
  // Boarding fights. A fight under way is none, and an approach that ended
  // before them was settled by its stand-in: no boarding fight is due.
  {
    from: 12,
    up: (data) => {
      if (!isObject(data) || !isObject(data.campaign)) return data;
      const { fight, run } = data.campaign;
      const approach = isObject(run) ? run.approach : null;
      const outcome = isObject(approach) && isObject(approach.outcome) ? { ...approach.outcome, boarding: null } : null;
      return {
        ...data,
        campaign: {
          ...data.campaign,
          fight: isObject(fight) ? { ...fight, boarding: null } : fight,
          run: outcome ? { ...run, approach: { ...approach, outcome } } : run,
        },
      };
    },
  },
  // Recruits: no one has signed on in a run from before them.
  {
    from: 13,
    up: (data) => {
      if (!isObject(data) || !isObject(data.campaign)) return data;
      const { run } = data.campaign;
      return isObject(run) ? { ...data, campaign: { ...data.campaign, run: { ...run, hired: [] } } } : data;
    },
  },
  // Portraits: each crew member gets a look from the campaign's seed and
  // their id, apart from those before them, the same on every load. Names
  // stay as they were.
  {
    from: 14,
    up: (data) => {
      if (!isObject(data) || !isObject(data.campaign) || !Array.isArray(data.campaign.crew)) return data;
      const seed = isState(data.campaign.seed) ? data.campaign.seed : 0;
      const looks = [];
      const crew = data.campaign.crew.map((member) => {
        if (!isObject(member)) return member;
        const look = crewLook(seed, member.id, looks);
        looks.push(look);
        return { ...member, look };
      });
      return { ...data, campaign: { ...data.campaign, crew } };
    },
  },
  // Every ship gets a hull style: the ships from before are Rounded, the
  // only style there was a name for.
  {
    from: 15,
    up: (data) => {
      if (!isObject(data)) return data;
      const styled = (ship) => (isObject(ship) && ship.hull === undefined ? { ...ship, hull: 'rounded' } : ship);
      let next = data;
      if (isObject(data.builds) && Array.isArray(data.builds.slots)) {
        const slots = data.builds.slots.map((slot) => (isObject(slot) ? { ...slot, ship: styled(slot.ship) } : slot));
        next = { ...next, builds: { ...data.builds, slots } };
      }
      if (isObject(data.campaign)) {
        let campaign = { ...data.campaign, ship: styled(data.campaign.ship) };
        const approach = isObject(campaign.run) ? campaign.run.approach : null;
        if (isObject(approach) && isObject(approach.them)) {
          campaign = { ...campaign, run: { ...campaign.run, approach: { ...approach, them: { ...approach.them, ship: styled(approach.them.ship) } } } };
        }
        next = { ...next, campaign };
      }
      return next;
    },
  },
  // Every ship gets its looks: the ships from before are in the yard's
  // slate and sky, with no styling pieces.
  {
    from: 16,
    up: (data) =>
      eachShip(data, (ship) => (isObject(ship) ? { ...ship, paint: ship.paint ?? 'slate', trim: ship.trim ?? 'sky', styling: ship.styling ?? [] } : ship)),
  },
  // Heat on the run: a run under way hasn't swapped its transponder in its
  // sector, and an approach going on is a hostile ship's, as every one was.
  {
    from: 17,
    up: (data) => {
      if (!isObject(data) || !isObject(data.campaign) || !isObject(data.campaign.run)) return data;
      const { run } = data.campaign;
      const approach = isObject(run.approach) ? { ...run.approach, hunt: false } : run.approach;
      return { ...data, campaign: { ...data.campaign, run: { ...run, swapped: false, approach } } };
    },
  },
  // The worlds past the charts (M25). No save reached them before: a run
  // has surveyed nothing, and no campaign has settled a world.
  {
    from: 18,
    up: (data) => {
      if (!isObject(data) || !isObject(data.campaign)) return data;
      const { run } = data.campaign;
      return { ...data, campaign: { ...data.campaign, colony: null, run: isObject(run) ? { ...run, surveyed: [] } : run } };
    },
  },
  // The colony's buildings (M26). A colony settled before them has none
  // yet: every part is still aboard.
  {
    from: 19,
    up: (data) => {
      if (!isObject(data) || !isObject(data.campaign) || !isObject(data.campaign.colony)) return data;
      return { ...data, campaign: { ...data.campaign, colony: { ...data.campaign.colony, buildings: [], nextUid: 1 } } };
    },
  },
  // The colony's days and materials (M27). A colony settled before them
  // opens on day 1 with what a landing salvaged when they came in: the 20
  // materials data/colony.json gave then.
  {
    from: 20,
    up: (data) => {
      if (!isObject(data) || !isObject(data.campaign) || !isObject(data.campaign.colony)) return data;
      return { ...data, campaign: { ...data.campaign, colony: { ...data.campaign.colony, day: 1, materials: 20 } } };
    },
  },
  // Expeditions (M28). A colony from before them has no places listed yet,
  // rolled when it is next shown, and its ship is home.
  {
    from: 21,
    up: (data) => {
      if (!isObject(data) || !isObject(data.campaign) || !isObject(data.campaign.colony)) return data;
      return { ...data, campaign: { ...data.campaign, colony: { ...data.campaign.colony, places: [], trip: null } } };
    },
  },
  // Raids (M29). A colony from before them has no raid coming, and a trip
  // under way has flown its legs whole.
  {
    from: 22,
    up: (data) => {
      if (!isObject(data) || !isObject(data.campaign) || !isObject(data.campaign.colony)) return data;
      const { colony } = data.campaign;
      const trip = isObject(colony.trip) ? { ...colony.trip, leg: null } : colony.trip;
      return { ...data, campaign: { ...data.campaign, colony: { ...colony, trip, raid: null } } };
    },
  },
  // Every job (M32). A fight under way carries on with orders: every crew
  // member gets the 2 uses each of the three jobs then had (the Marine's
  // Suppress, the Engineer's Weld and the Medic's Patch), the enemy none,
  // nothing marked, suppressed, asleep or kitted out, and no door welded.
  // The run's scans each keep how far they reached, which a scout now
  // stretches: before, every scan reached balance.scanRange's 2 links.
  {
    from: 23,
    up: (data) => {
      if (!isObject(data) || !isObject(data.campaign)) return data;
      let { campaign } = data;
      const { fight, run } = campaign;
      if (isObject(run) && Array.isArray(run.scans)) campaign = { ...campaign, run: { ...run, scans: run.scans.map((at) => ({ at, reach: 2 })) } };
      if (isObject(fight) && isObject(fight.battle)) {
        const { battle } = fight;
        const units = Array.isArray(battle.units)
          ? battle.units.map((unit) => (isObject(unit) ? { ...unit, uses: unit.side === 'crew' ? 2 : 0, mark: null, suppressed: null, asleep: false, kitted: false } : unit))
          : battle.units;
        campaign = { ...campaign, fight: { ...fight, battle: { ...battle, units, welds: [] } } };
      }
      return { ...data, campaign };
    },
  },
  // Ranks (M32b). Nothing counted fights before, so everyone aboard starts
  // at 0; the start crew and recruits signed on before have no background.
  // A fight under way keeps its units as they are: at rank 0.
  {
    from: 24,
    up: (data) => {
      if (!isObject(data) || !isObject(data.campaign) || !Array.isArray(data.campaign.crew)) return data;
      const crew = data.campaign.crew.map((member) => (isObject(member) ? { ...member, fights: 0 } : member));
      return { ...data, campaign: { ...data.campaign, crew } };
    },
  },
  // Factions (M33). The campaign stands with each of M33's sides where a
  // new one from its background starts: its pursuer's side (Con-Reg for the
  // miner, the Fleet for the deserter, the Hallorans for the smuggler) at
  // -10, hostile, and the rest at 0. An approach under way opened as before
  // M33: no patrol waved the ship through or opened fire first.
  {
    from: 25,
    up: (data) => {
      if (!isObject(data) || !isObject(data.campaign)) return data;
      const pursuer = { miner: 'conreg', deserter: 'fleet', smuggler: 'hallorans' }[data.campaign.background];
      const standing = Object.fromEntries(['conreg', 'fleet', 'hallorans', 'union'].map((side) => [side, side === pursuer ? -10 : 0]));
      let campaign = { ...data.campaign, standing };
      const { run } = campaign;
      if (isObject(run) && isObject(run.approach)) campaign = { ...campaign, run: { ...run, approach: { ...run.approach, patrol: null } } };
      return { ...data, campaign };
    },
  },
  // Docking on trade (M33's fix). Before it, a jump to a station of the
  // pursuer's side paid its docking heat on arrival, so a ship at one has
  // docked there already; anywhere else it hasn't. The stations' sides are
  // M33's, by name (data/factions.json then), as are the pursuers'.
  {
    from: 26,
    up: (data) => {
      if (!isObject(data) || !isObject(data.campaign) || !isObject(data.campaign.run)) return data;
      const { background, run } = data.campaign;
      const stations = { miner: ['The Depot', 'Last Chance Supply'], deserter: ['Rest Stop Nine', 'Station Okay'], smuggler: ["Big Rita's", 'Halfway House'] }[background] ?? [];
      const here = isObject(run.sector) && Array.isArray(run.sector.nodes) ? run.sector.nodes[run.at] : null;
      const docked = isObject(here) && here.type === 'station' && stations.includes(here.name);
      return { ...data, campaign: { ...data.campaign, run: { ...run, docked } } };
    },
  },
  // Quests (M33b). A campaign gets its background's thread (the quests as
  // M33b shipped them, by background) at the step of its act, none gone
  // cold: act 1's job; on the run, its event, placed from the next sector
  // the ship enters; past the charts and at the colony, the colony's place,
  // as the run's step can't be met there. A background with no thread gets
  // none.
  {
    from: 27,
    up: (data) => {
      if (!isObject(data) || !isObject(data.campaign)) return data;
      const { background, act, run } = data.campaign;
      const thread = { miner: 'debt', deserter: 'pardon', smuggler: 'cargo' }[background];
      const past = act !== 2 || (isObject(run) && isObject(run.sector) && run.sector.system === true);
      const step = act === 1 ? 0 : past ? 2 : 1;
      return { ...data, campaign: { ...data.campaign, quests: thread ? { [thread]: { step, state: 'open' } } : {} } };
    },
  },
  // Companions (M33c). A save from before has no one aboard who is a
  // companion, no unit with a talent and no result with someone signed on,
  // and no companion's chain or loyalty quest under way: it reads as it is.
  // A side's chain whose start was chosen before it existed doesn't start.
  {
    from: 28,
    up: (data) => data,
  },
  // Sound (M35). A save from before had none to switch: it gets sound on
  // at 70%, as a new game does (Evan's pick).
  {
    from: 29,
    up: (data) => (isObject(data) && isObject(data.settings) ? { ...data, settings: { ...data.settings, sound: true, volume: 70 } } : data),
  },
  // Events met (M36). A campaign from before kept none: every event is
  // fresh to it again.
  {
    from: 30,
    up: (data) => (isObject(data) && isObject(data.campaign) ? { ...data, campaign: { ...data.campaign, eventsMet: [] } } : data),
  },
  // Weapons join the campaign: everyone carries their job's (no weapon of
  // their own set), none are spare, and a run under way has bought nothing
  // off a rack.
  {
    from: 31,
    up: (data) => {
      if (!isObject(data) || !isObject(data.campaign)) return data;
      const { run } = data.campaign;
      return { ...data, campaign: { ...data.campaign, arms: {}, run: isObject(run) ? { ...run, racked: [] } : run } };
    },
  },
  // Shipyards (M37b) join the run: a run under way has bought nothing at
  // one. Its sector has none; the sectors after it each have one.
  {
    from: 32,
    up: (data) => {
      if (!isObject(data) || !isObject(data.campaign)) return data;
      const { run } = data.campaign;
      return isObject(run) ? { ...data, campaign: { ...data.campaign, run: { ...run, yarded: [] } } } : data;
    },
  },
  // The new missions (M38) join the jobs' fights. A fight from before is a
  // clear-out, a grab or a hack, which read as they did: nothing to change.
  { from: 33, up: (data) => data },
  // Station jobs (M38c): a run from before has taken none at the station
  // it is at.
  {
    from: 34,
    up: (data) => {
      if (!isObject(data) || !isObject(data.campaign)) return data;
      const { run } = data.campaign;
      return isObject(run) ? { ...data, campaign: { ...data.campaign, run: { ...run, jobbed: [] } } } : data;
    },
  },
  // Voyages (M38d): a colony from before has the ship home, nobody away,
  // and the other worlds of the system it was settled in, which the run
  // ended in and still shows.
  {
    from: 35,
    up: (data) => {
      if (!isObject(data) || !isObject(data.campaign) || !isObject(data.campaign.colony)) return data;
      const { colony, run } = data.campaign;
      const sector = isObject(run) && isObject(run.sector) && run.sector.system === true && Array.isArray(run.sector.nodes) ? run.sector : null;
      const name = isObject(colony.world) ? colony.world.name : null;
      const worlds = sector ? sector.nodes.filter((node) => isObject(node) && isObject(node.world) && node.name !== name).map((node) => ({ name: node.name, world: node.world })) : [];
      return { ...data, campaign: { ...data.campaign, colony: { ...colony, worlds, voyage: null } } };
    },
  },
  // More colonies (M38e): a campaign from before has no others. Its one
  // colony becomes the first, at the head of the line of systems, with the
  // ship's heat as its own; a voyage under way is as many systems along
  // the line as a flight home has left, and flies to no other colony.
  {
    from: 36,
    up: (data) => {
      if (!isObject(data) || !isObject(data.campaign)) return data;
      const { colony } = data.campaign;
      if (!isObject(colony)) return { ...data, campaign: { ...data.campaign, colonies: [] } };
      const { voyage } = colony;
      const flying = isObject(voyage) ? { ...voyage, at: voyage.homing ?? voyage.out, to: null } : voyage;
      return { ...data, campaign: { ...data.campaign, colonies: [], colony: { ...colony, id: 1, at: 0, heat: data.campaign.heat, voyage: flying } } };
    },
  },
  // Citizens (M38f): a colony from before has none, nothing toward the
  // next and no news; a fight saved then holds no colonists.
  {
    from: 37,
    up: (data) => {
      if (!isObject(data) || !isObject(data.campaign)) return data;
      const fresh = (colony) => (isObject(colony) ? { ...colony, citizens: 0, growth: 0, news: [] } : colony);
      const { colony, colonies } = data.campaign;
      const campaign = { ...data.campaign };
      if (isObject(colony)) campaign.colony = fresh(colony);
      if (Array.isArray(colonies)) campaign.colonies = colonies.map(fresh);
      return { ...data, campaign };
    },
  },
  // The difficulty becomes the game's (M41): a campaign takes the
  // settings' difficulty as its own, with death not permanent and no one
  // fallen, and the settings keep none.
  {
    from: 38,
    up: (data) => {
      if (!isObject(data)) return data;
      const { difficulty, ...settings } = isObject(data.settings) ? data.settings : {};
      const kept = ['easy', 'normal', 'hard'].includes(difficulty) ? difficulty : 'normal';
      const campaign = isObject(data.campaign) ? { ...data.campaign, difficulty: kept, permadeath: false, fallen: [] } : data.campaign;
      return { ...data, ...(isObject(data.settings) ? { settings } : {}), campaign };
    },
  },
  {
    from: 39,
    up: (data) => (isObject(data) && isObject(data.settings) ? { ...data, settings: { ...data.settings, colors: 'standard', textSize: 100 } } : data),
  },
  {
    from: 40,
    up: (data) => (isObject(data) && isObject(data.settings) ? { ...data, settings: { ...data.settings, fog: false } } : data),
  },
  // Picking what to strip (M46). A boarding fight under way rolled its
  // parts as it began: they are what it offers, and still what it takes.
  {
    from: 41,
    up: (data) => {
      const fight = isObject(data) && isObject(data.campaign) ? data.campaign.fight : null;
      const salvage = isObject(fight) && isObject(fight.boarding) ? fight.boarding.salvage : null;
      if (!isObject(salvage) || !Array.isArray(salvage.parts)) return data;
      return { ...data, campaign: { ...data.campaign, fight: { ...fight, boarding: { ...fight.boarding, salvage: { ...salvage, pool: [...salvage.parts] } } } } };
    },
  },
  {
    from: 42,
    up: (data) => (isObject(data) && isObject(data.settings) ? { ...data, settings: { ...data.settings, hand: 'right', speed: 100, confirm: 'taps', vibration: true } } : data),
  },
  {
    from: 43,
    up: (data) => (isObject(data) && isObject(data.settings) ? { ...data, settings: { ...data.settings, captions: false, reading: 'standard' } } : data),
  },
  {
    from: 44,
    up: (data) => data,
  },
  {
    // 45 to 46 (M52): the ship's name, number and emblem. A campaign from
    // before has none until a screen rolls them (identity.js withIdentity).
    from: 45,
    up: (data) => (isObject(data) && isObject(data.campaign) ? { ...data, campaign: { ...data.campaign, identity: data.campaign.identity ?? null } } : data),
  },
  {
    // 46 to 47 (M53): each colony lies low or not, and has a side's trader
    // there or none; a raid coming keeps the party it was found with, the
    // pursuer's own.
    from: 46,
    up: (data) => {
      if (!isObject(data) || !isObject(data.campaign)) return data;
      const fresh = (colony) => (isObject(colony) ? { ...colony, lowProfile: colony.lowProfile ?? false, trader: colony.trader ?? null, raid: isObject(colony.raid) ? { extra: 0, ...colony.raid } : colony.raid } : colony);
      const { colony, colonies } = data.campaign;
      const campaign = { ...data.campaign };
      if (isObject(colony)) campaign.colony = fresh(colony);
      if (Array.isArray(colonies)) campaign.colonies = colonies.map(fresh);
      return { ...data, campaign };
    },
  },
  {
    // 47 to 48 (M56): the reckoning and the ending, neither yet: the
    // leader is due on the founding colony's day reckoningDay, as for a
    // run whose thread never paid off.
    from: 47,
    up: (data) => (isObject(data) && isObject(data.campaign) ? { ...data, campaign: { ...data.campaign, reckoning: null, ending: null } } : data),
  },
  {
    // 48 to 49 (M58): every ship plain, in bone for a second color, with
    // her engines in her makers' glow; the crew in standard suits. No one
    // has a callsign yet, which is none at all.
    from: 48,
    up: (data) => {
      const looked = eachShip(data, (ship) => (isObject(ship) ? { ...ship, pattern: ship.pattern ?? 'plain', accent: ship.accent ?? 'bone', glow: ship.glow ?? 'maker' } : ship));
      if (!isObject(looked) || !isObject(looked.campaign) || !isObject(looked.campaign.identity)) return looked;
      return { ...looked, campaign: { ...looked.campaign, identity: { ...looked.campaign.identity, suits: looked.campaign.identity.suits ?? 'standard' } } };
    },
  },
];

// The save's data with fn applied to every ship in it: the builder's slots,
// the campaign's ship, the hostile one in an approach under way, and the
// one a boarding fight is on.
function eachShip(data, fn) {
  if (!isObject(data)) return data;
  let next = data;
  if (isObject(data.builds) && Array.isArray(data.builds.slots)) {
    next = { ...next, builds: { ...data.builds, slots: data.builds.slots.map((slot) => (isObject(slot) ? { ...slot, ship: fn(slot.ship) } : slot)) } };
  }
  if (isObject(data.campaign)) {
    let campaign = data.campaign.ship === undefined ? { ...data.campaign } : { ...data.campaign, ship: fn(data.campaign.ship) };
    const approach = isObject(campaign.run) ? campaign.run.approach : null;
    if (isObject(approach) && isObject(approach.them)) {
      campaign = { ...campaign, run: { ...campaign.run, approach: { ...approach, them: { ...approach.them, ship: fn(approach.them.ship) } } } };
    }
    const boarding = isObject(campaign.fight) ? campaign.fight.boarding : null;
    if (isObject(boarding) && boarding.ship !== undefined) {
      campaign = { ...campaign, fight: { ...campaign.fight, boarding: { ...boarding, ship: fn(boarding.ship) } } };
    }
    next = { ...next, campaign };
  }
  return next;
}

const PREFIX = config.appId;

export class SaveError extends Error {}

export function makeSave(data) {
  return { version: SAVE_VERSION, data };
}

// Runs every migration step from save.version up to `target`, in version
// order. Throws SaveError if a step is missing or the save is newer than the
// game. The input is not changed.
export function migrate(save, { migrations = MIGRATIONS, target = SAVE_VERSION } = {}) {
  if (!Number.isInteger(save.version) || save.version < 0) {
    throw new SaveError('The save has no valid version number.');
  }
  if (save.version > target) {
    throw new SaveError(
      `This save is from a newer version of the game (save v${save.version}, game v${target}). Update the game and try again.`,
    );
  }
  let version = save.version;
  let data = clone(save.data);
  while (version < target) {
    const step = migrations.find((m) => m.from === version);
    if (!step) throw new SaveError(`No migration from save v${version} to v${version + 1}.`);
    data = step.up(data);
    version += 1;
  }
  return { version, data };
}

// Checks a save against the current schema. Returns a list of problems;
// an empty list means the save is valid.
export function validate(save) {
  if (!isObject(save)) return ['The save is not an object.'];
  const problems = [];
  if (save.version !== SAVE_VERSION) problems.push(`Its version is ${save.version}, expected ${SAVE_VERSION}.`);
  const data = save.data;
  if (!isObject(data)) return [...problems, 'It has no data.'];
  if (!isState(data.rng)) problems.push('The RNG state is missing or invalid.');
  problems.push(...settingsProblems(data.settings));
  if (!isBuilds(data.builds)) problems.push('The saved ships are missing or unreadable.');
  if (data.campaign === undefined) problems.push('The campaign is missing.');
  else if (data.campaign !== null) problems.push(...campaignProblems(data.campaign));
  return problems;
}

// Loads a save stored as JSON text. Returns { ok: true, save } or
// { ok: false, error } with a message for the player. Never throws.
export function parseSave(text, options) {
  let save;
  try {
    save = JSON.parse(text);
  } catch {
    return fail('The save is not valid JSON.');
  }
  return checkSave(save, options);
}

export function exportSave(save) {
  const body = `${PREFIX}.${save.version}.${toBase64Url(JSON.stringify(save))}`;
  return `${body}.${checksum(body)}`;
}

// Reads a code made by exportSave. Whitespace and line breaks are ignored, so
// codes survive being pasted through chat apps. Returns { ok: true, save } or
// { ok: false, error }. Never throws.
export function importSave(text, options) {
  const code = String(text ?? '').replace(/\s+/g, '');
  if (!code) return fail('Paste a save code first.');
  const parts = code.split('.');
  if (parts[0] !== PREFIX) {
    return fail(`That isn't a save code for this game. Save codes start with "${PREFIX}.".`);
  }
  if (parts.length !== 4) return fail('The code is incomplete or has extra text. Copy the whole code and try again.');
  const [, versionText, payload, sum] = parts;
  if (!/^\d+$/.test(versionText)) return fail('The code is damaged: its version number is unreadable.');
  if (checksum(`${PREFIX}.${versionText}.${payload}`) !== sum.toLowerCase()) {
    return fail("The code is damaged: its checksum doesn't match. Copy the whole code again.");
  }
  let save;
  try {
    save = JSON.parse(fromBase64Url(payload));
  } catch {
    return fail("The code is damaged and can't be read.");
  }
  if (!isObject(save) || save.version !== Number(versionText)) {
    return fail("The code is damaged: its version doesn't match its contents.");
  }
  return checkSave(save, options);
}

function checkSave(save, { validate: check = validate, ...migrateOptions } = {}) {
  if (!isObject(save)) return fail('The save is not an object.');
  let migrated;
  try {
    migrated = migrate(save, migrateOptions);
  } catch (err) {
    return fail(err instanceof SaveError ? err.message : `Updating the save failed: ${err.message}`);
  }
  const problems = check(migrated);
  if (problems.length) return fail(`The save is damaged. ${problems.join(' ')}`);
  return { ok: true, save: migrated };
}

function fail(error) {
  return { ok: false, error };
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}
