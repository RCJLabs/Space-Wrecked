// Root reducer for the store. Pure: no DOM, window, timers, Date.now() or
// Math.random(). The starting seed comes in from outside, and so do the
// content tables (rules) for the actions that need them.
import { int } from '../core/rng.js';
import { emptyBuilds, reduceBuilds } from './builds.js';
import { beginFight, captainProblem, firstBackground, newCampaign, refitShip, saveFight } from './campaign.js';
import { donate } from './colony.js';
import { build, moveBuilding, takeDown } from './colonyBuild.js';
import { nextDay } from './days.js';
import { cheat } from './dev.js';
import { endJob, takeJob, takeQuestJob, withBoard } from './contracts.js';
import { buyPart, sellPart, sellWeapon } from './economy.js';
import { beginBoarding, closeApproach, endBoarding, giveOrder } from './encounter.js';
import { chooseEvent } from './events.js';
import { boardPlace, chooseAtPlace, endPlaceFight, flyHome, flyOn, flyOut, withPlaces } from './expeditions.js';
import { makePayment } from './heat.js';
import { launch } from './launch.js';
import { swapWeapon } from './loadout.js';
import { beginRaid, endRaid } from './raid.js';
import { endColonyRaid, faceRaid } from './raids.js';
import { patchCrew } from './patch.js';
import { buyFromRack } from './racks.js';
import { buyFromYard, sellToYard } from './yards.js';
import { dismissCrew, hireRecruit } from './recruits.js';
import { regroup } from './regroup.js';
import { repairShip } from './repair.js';
import { defaultSettings, fightSettings, reduceSettings } from './settings.js';
import { settle } from './settle.js';
import { survey } from './survey.js';
import { takeStationJob } from './stationJobs.js';
import { swapTransponder } from './transponder.js';
import { beginRun, buySupplies, jump, leaveSector, scan } from './travel.js';
import { voyageHome, voyageOut } from './voyage.js';

// The screen each place in a campaign is played on in act 1, and every
// screen that shows the campaign: construction mode, the job board and the
// shop are the hangar's; the launch plays between act 1 and act 2's sector
// map, and the approach phase on the run is played on its own screen; the
// landing plays between act 2 and act 3 (M25), whose home is the colony
// (M26), and from which the ship flies out on voyages (M38d).
export const PLACE_SCREENS = { hub: 'hub', fight: 'campaign-fight' };
export const CAMPAIGN_SCREENS = [...Object.values(PLACE_SCREENS), 'construction', 'jobs', 'shop', 'launch', 'sector', 'approach', 'landing', 'colony'];
// The moves on the run that can open an approach (a hostile ship, the
// pursuer's hunters, or a trap an event sprang, M36) or put one away, and
// so change the screen; and from M38d a voyage's Fly out and Fly home,
// between the colony and the run.
const SCREEN_CHANGES = ['campaign/jump', 'campaign/sector/leave', 'campaign/regroup', 'campaign/survey', 'campaign/event/choose', 'campaign/approach/close', 'campaign/voyage/out', 'campaign/voyage/home'];

// The screen a campaign is played on where it is now: its fight, or its
// act's home: the hangar in act 1, the sector map on the run (act 2, and a
// voyage from the colony from M38d), or the approach going on there, and
// the colony in act 3.
export function campaignScreen(campaign) {
  if (campaign.place === 'fight') return PLACE_SCREENS.fight;
  if (campaign.act === 2 || campaign.colony?.voyage) return campaign.run?.approach ? 'approach' : 'sector';
  return campaign.act === 1 ? PLACE_SCREENS.hub : 'colony';
}

export function initialState(seed) {
  return {
    screen: 'title',
    settings: defaultSettings(),
    rng: seed >>> 0,
    // The builder's saved ships (builds.js), saved after every change.
    builds: emptyBuilds(),
    // The campaign (campaign.js), or null before one starts. Saved after
    // every change, a fight's every order included.
    campaign: null,
  };
}

// Campaign actions:
//   campaign/new { rules, captain, background }
//                                  a new campaign, in place of any other,
//                                  from the background picked (M30; none:
//                                  the first), led by the captain made for
//                                  it (campaign.js captainProblem; none: the
//                                  first crew member as they are); its seed
//                                  is the game's next roll, and its first
//                                  job board is rolled
//   campaign/continue              back to where the campaign is
//   campaign/board { rules }       a job board and the shop's stock for a
//                                  hub without them (a campaign saved
//                                  before there were jobs or a shop)
//   campaign/ship { ship, rules }  the ship refitted at the hangar, or at
//                                  a station on the run (campaign.js
//                                  refitShip)
//   campaign/pay { rules }         a payment on the debt: credits for heat
//   campaign/buy { index, rules }  the part at index in the shop's stock,
//                                  bought
//   campaign/sell { part, rules }  a part on hand, sold to the shop
//   campaign/arms/sell { weapon, rules }   a spare weapon on hand, sold to
//                                  the shop (M37)
//   campaign/arms/swap { id, weapon, rules }   crew member id takes the
//                                  spare weapon, and theirs goes on hand,
//                                  anywhere but in a fight (loadout.js)
//   campaign/arms/rack { slot, rules }   the weapon in the rack's slot at
//                                  the station the ship is at, bought
//                                  (racks.js)
//   campaign/yard/buy { slot, rules }   the part in the slot at the
//                                  shipyard the ship is at, bought (M37b,
//                                  yards.js)
//   campaign/yard/sell { part, rules }   a part on hand, sold to the
//                                  shipyard the ship is at (M37b)
//   campaign/job/take { index, rules }   the crew takes the board's job at
//                                  index: its fight begins. Every fight
//                                  takes forgiving odds and the difficulty
//                                  from the settings as it starts
//   campaign/job/quest { quest, rules }   the crew takes the job a quest's
//                                  step offers at the hangar (M33b)
//   campaign/raid/begin { rules }  the crew faces the raid that is due
//   campaign/launch { rules }      the ship lifts off: act 1 ends, and the
//                                  launch plays (launch.js)
//   campaign/run/begin { rules }   the run's first sector, at the act's
//                                  first visit home (travel.js)
//   campaign/jump { to, rules }    a jump, or a long jump, to node `to`;
//                                  a hostile ship there opens the approach
//                                  and its screen
//   campaign/supplies { count, rules }   supplies bought at a station
//   campaign/sector/leave { rules }   on from the jump point into the next
//                                  sector, where the hunters may wait
//   campaign/event/choose { choice, rules }   a choice made at the event
//                                  open where the ship is (events.js)
//   campaign/scan { rules }        a scan from where the ship is
//   campaign/regroup { rules }     a day's rest where the ship is, or a day
//                                  hidden in a nebula (regroup.js); the
//                                  hunters may find it, which opens their
//                                  approach and its screen
//   campaign/swap { rules }        the transponder swapped at a station
//                                  (transponder.js)
//   campaign/survey { rules }      a day surveying the world the ship is at
//                                  (survey.js, M25); the hunters may find
//                                  it, as when regrouping
//   campaign/settle { rules }      the world the ship is at settled: act 2
//                                  ends, and the landing plays (settle.js)
//   campaign/donate { uid, rules } the ship's part uid given to the colony,
//                                  where it stands as a building (colony.js)
//   campaign/build { what, placement, rules }   a farm or a mine built, a
//                                  spare part set down or a ship's part
//                                  given, where the player put it
//                                  (colonyBuild.js, M27)
//   campaign/move { uid, placement, rules }   a building moved or turned
//   campaign/takedown { uid, rules }   a building taken down
//   campaign/day { rules }         the colony's day passed (days.js)
//   campaign/places { rules }      the places within reach rolled, for a
//                                  colony without them (expeditions.js, M28)
//   campaign/trip/out { index, squad, rules }   the ship flies out to the
//                                  place listed at index with the squad
//                                  (crew ids): the days out pass at home
//   campaign/trip/choose { choice, rules }   a choice made at the event
//                                  where the squad is
//   campaign/trip/board { rules }  the squad boards the derelict the
//                                  scavengers hold where it is: the fight
//                                  begins
//   campaign/trip/home { rules }   the ship flies home: the days back pass,
//                                  it lands, and a new list is rolled
//   campaign/trip/on { rules }     the ship flies on with the leg a raid
//                                  stopped, once it is faced (M29)
//   campaign/voyage/out { crew, rules }   the ship flies out from the colony
//                                  with the crew picked (ids), into the
//                                  next system (voyage.js, M38d)
//   campaign/voyage/home { rules } the ship flies home from the run, or on
//                                  home once a lander that stopped it is
//                                  faced (M38d)
//   campaign/raid/face { rules }   Defend: the colony faces the raid that
//                                  is down, the guns first (raids.js, M29):
//                                  the fight, or what came of it without one;
//                                  from the run too, while the ship is away
//                                  on a voyage (M38d)
//   campaign/approach/order { order, rules }   the player's order for a
//                                  round of the approach (encounter.js)
//   campaign/approach/close        Carry on, once the approach is over, or
//                                  leave a ship the player disabled: back to
//                                  the sector map
//   campaign/boarding/begin { rules, squad }   the boarding fight the
//                                  approach ended in begins (encounter.js),
//                                  with the squad picked (crew ids), or the
//                                  healthiest without one (crew.js)
//   campaign/repair { rules }      the station repairs what the credits
//                                  cover (repair.js)
//   campaign/patch { rules }       the station patches up the crew, as far
//                                  as the credits go (patch.js)
//   campaign/hire { slot, rules }  the station's recruit in slot signs on
//                                  (recruits.js)
//   campaign/dismiss { id, rules }   crew member id is let go at a station
//   campaign/fight/begin { rules } the crew fights boarders at home (M15's
//                                  raids will)
//   campaign/fight/save { battle, log }   the fight after an order
//   campaign/fight/end { rules }   back to the hub (or the run) once the
//                                  fight is won or lost: a job's pay and
//                                  heat, and a new board; what a raid cost;
//                                  or what a boarding came to, on the run
//                                  or at a place on a trip (M28); or what
//                                  a raid on the colony came to (M29)
//   dev/cheat { cheat, rules }     a cheat from the ?dev=1 menu (dev.js),
//                                  where the campaign is; the screen stays
export function reduce(state, action) {
  switch (action.type) {
    case 'save/restore':
      return {
        ...state,
        settings: { ...action.data.settings },
        rng: action.data.rng,
        builds: action.data.builds ?? emptyBuilds(),
        campaign: action.data.campaign ?? null,
        // A campaign screen can't stay open on a campaign that changed
        // under it.
        screen: CAMPAIGN_SCREENS.includes(state.screen) ? 'title' : state.screen,
      };
    case 'screen/show':
      return action.screen === state.screen ? state : { ...state, screen: action.screen };
    case 'campaign/new': {
      const captain = action.captain ?? null;
      const background = action.background ?? firstBackground(action.rules);
      if (!action.rules.backgrounds.has(background)) return state;
      if (captain && captainProblem(captain, action.rules, background)) return state;
      const { value: seed, state: rng } = int(state.rng, 0, 0xffffffff);
      return { ...state, rng, campaign: withBoard(newCampaign(action.rules, seed, { background, captain }), action.rules), screen: PLACE_SCREENS.hub };
    }
    case 'campaign/continue':
      return state.campaign ? { ...state, screen: campaignScreen(state.campaign) } : state;
    case 'campaign/board':
      return withCampaign(state, state.campaign && withBoard(state.campaign, action.rules));
    case 'campaign/places':
      return withCampaign(state, state.campaign && withPlaces(state.campaign, action.rules));
    case 'campaign/ship':
      return withCampaign(state, state.campaign && refitShip(state.campaign, action.ship, action.rules));
    case 'campaign/pay':
    case 'campaign/buy':
    case 'campaign/sell':
    case 'campaign/arms/sell':
    case 'campaign/arms/swap': {
      const trade = {
        'campaign/pay': (c) => makePayment(c, action.rules),
        'campaign/buy': (c) => buyPart(c, action.rules, action.index),
        'campaign/sell': (c) => sellPart(c, action.rules, action.part),
        'campaign/arms/sell': (c) => sellWeapon(c, action.rules, action.weapon),
        'campaign/arms/swap': (c) => swapWeapon(c, action.rules, action.id, action.weapon),
      }[action.type];
      const done = state.campaign && trade(state.campaign);
      return done?.ok ? { ...state, campaign: done.campaign } : state;
    }
    case 'campaign/job/take':
    case 'campaign/job/quest':
    case 'campaign/job/station':
    case 'campaign/raid/begin':
    case 'campaign/boarding/begin':
    case 'campaign/trip/board':
    case 'campaign/fight/begin': {
      const setup = fightSettings(state.settings);
      const begin = {
        'campaign/job/take': (c) => takeJob(c, action.rules, action.index, setup),
        'campaign/job/quest': (c) => takeQuestJob(c, action.rules, action.quest, setup),
        'campaign/job/station': (c) => takeStationJob(c, action.rules, action.index, action.squad ?? null, setup),
        'campaign/raid/begin': (c) => beginRaid(c, action.rules, setup),
        'campaign/boarding/begin': (c) => beginBoarding(c, action.rules, { ...setup, squad: action.squad ?? null }),
        'campaign/trip/board': (c) => boardPlace(c, action.rules, setup),
        'campaign/fight/begin': (c) => beginFight(c, action.rules, setup),
      }[action.type];
      const begun = state.campaign && begin(state.campaign);
      return begun?.ok ? { ...state, campaign: begun.campaign, screen: PLACE_SCREENS.fight } : state;
    }
    case 'campaign/raid/face': {
      const faced = state.campaign && faceRaid(state.campaign, action.rules, fightSettings(state.settings));
      return faced?.ok ? { ...state, campaign: faced.campaign, screen: campaignScreen(faced.campaign) } : state;
    }
    case 'campaign/fight/save':
      return withCampaign(state, state.campaign && saveFight(state.campaign, action.battle, action.log));
    case 'campaign/fight/end': {
      const fight = state.campaign?.fight;
      const end = fight?.raid ? (state.campaign.colony ? endColonyRaid : endRaid) : fight?.boarding ? (state.campaign.colony?.trip ? endPlaceFight : endBoarding) : endJob;
      const next = withCampaign(state, state.campaign && end(state.campaign, action.rules));
      return next === state ? state : { ...next, screen: campaignScreen(next.campaign) };
    }
    case 'campaign/launch': {
      const launched = state.campaign && launch(state.campaign, action.rules);
      return launched?.ok ? { ...state, campaign: launched.campaign, screen: 'launch' } : state;
    }
    case 'campaign/settle': {
      const settled = state.campaign && settle(state.campaign, action.rules);
      return settled?.ok ? { ...state, campaign: settled.campaign, screen: 'landing' } : state;
    }
    case 'campaign/run/begin':
    case 'campaign/jump':
    case 'campaign/supplies':
    case 'campaign/sector/leave':
    case 'campaign/event/choose':
    case 'campaign/scan':
    case 'campaign/regroup':
    case 'campaign/swap':
    case 'campaign/survey':
    case 'campaign/approach/order':
    case 'campaign/approach/close':
    case 'campaign/repair':
    case 'campaign/patch':
    case 'campaign/hire':
    case 'campaign/dismiss':
    case 'campaign/arms/rack':
    case 'campaign/yard/buy':
    case 'campaign/yard/sell':
    case 'campaign/donate':
    case 'campaign/build':
    case 'campaign/move':
    case 'campaign/takedown':
    case 'campaign/day':
    case 'campaign/trip/out':
    case 'campaign/trip/choose':
    case 'campaign/trip/home':
    case 'campaign/trip/on':
    case 'campaign/voyage/out':
    case 'campaign/voyage/home': {
      const move = {
        'campaign/run/begin': (c) => beginRun(c, action.rules),
        'campaign/jump': (c) => jump(c, action.rules, action.to),
        'campaign/supplies': (c) => buySupplies(c, action.rules, action.count),
        'campaign/sector/leave': (c) => leaveSector(c, action.rules),
        'campaign/event/choose': (c) => chooseEvent(c, action.rules, action.choice),
        'campaign/scan': (c) => scan(c, action.rules),
        'campaign/regroup': (c) => regroup(c, action.rules),
        'campaign/swap': (c) => swapTransponder(c, action.rules),
        'campaign/survey': (c) => survey(c, action.rules),
        'campaign/approach/order': (c) => giveOrder(c, action.rules, action.order),
        'campaign/approach/close': (c) => closeApproach(c),
        'campaign/repair': (c) => repairShip(c, action.rules),
        'campaign/patch': (c) => patchCrew(c, action.rules),
        'campaign/hire': (c) => hireRecruit(c, action.rules, action.slot),
        'campaign/dismiss': (c) => dismissCrew(c, action.rules, action.id),
        'campaign/arms/rack': (c) => buyFromRack(c, action.rules, action.slot),
        'campaign/yard/buy': (c) => buyFromYard(c, action.rules, action.slot),
        'campaign/yard/sell': (c) => sellToYard(c, action.rules, action.part),
        'campaign/donate': (c) => donate(c, action.rules, action.uid),
        'campaign/build': (c) => build(c, action.rules, action.what, action.placement ?? null),
        'campaign/move': (c) => moveBuilding(c, action.rules, action.uid, action.placement),
        'campaign/takedown': (c) => takeDown(c, action.rules, action.uid),
        'campaign/day': (c) => nextDay(c, action.rules),
        'campaign/trip/out': (c) => flyOut(c, action.rules, action.index, action.squad),
        'campaign/trip/choose': (c) => chooseAtPlace(c, action.rules, action.choice),
        'campaign/trip/home': (c) => flyHome(c, action.rules),
        'campaign/trip/on': (c) => flyOn(c, action.rules),
        'campaign/voyage/out': (c) => voyageOut(c, action.rules, action.crew),
        'campaign/voyage/home': (c) => voyageHome(c, action.rules),
      }[action.type];
      const done = state.campaign && move(state.campaign);
      if (!done?.ok) return state;
      // Meeting a hostile ship or the hunters, putting the approach away,
      // and flying out on a voyage and home again change screen.
      const screen = SCREEN_CHANGES.includes(action.type) ? campaignScreen(done.campaign) : state.screen;
      return { ...state, campaign: done.campaign, screen };
    }
    case 'dev/cheat': {
      const done = state.campaign && cheat(state.campaign, action.rules, action.cheat);
      return done?.ok ? { ...state, campaign: done.campaign } : state;
    }
    default: {
      if (action.type.startsWith('builds/')) {
        const builds = reduceBuilds(state.builds, action);
        return builds === state.builds ? state : { ...state, builds };
      }
      const settings = reduceSettings(state.settings, action);
      return settings === state.settings ? state : { ...state, settings };
    }
  }
}

// The part of the state that goes into a save. The screen is not saved: a
// game reopens at the title, and Continue goes back to the campaign.
export function saveData(state) {
  return { settings: state.settings, rng: state.rng, builds: state.builds, campaign: state.campaign };
}

function withCampaign(state, campaign) {
  return !campaign || campaign === state.campaign ? state : { ...state, campaign };
}
