// Root reducer for the store. Pure: no DOM, window, timers, Date.now() or
// Math.random(). The starting seed comes in from outside, and so do the
// content tables (rules) for the actions that need them.
import { int } from '../core/rng.js';
import { emptyBuilds, reduceBuilds } from './builds.js';
import { beginFight, captainProblem, newCampaign, refitShip, saveFight } from './campaign.js';
import { endJob, takeJob, withBoard } from './contracts.js';
import { buyPart, sellPart } from './economy.js';
import { makePayment } from './heat.js';
import { launch } from './launch.js';
import { beginRaid, endRaid } from './raid.js';
import { defaultSettings, fightSettings, reduceSettings } from './settings.js';
import { beginRun, buySupplies, jump, leaveSector } from './travel.js';

// The screen each place in a campaign is played on in act 1, and every
// screen that shows the campaign: construction mode, the job board and the
// shop are the hangar's; the launch plays between act 1 and act 2's sector
// map; the stub stands in for act 3 until it is built.
export const PLACE_SCREENS = { hub: 'hub', fight: 'campaign-fight' };
export const CAMPAIGN_SCREENS = [...Object.values(PLACE_SCREENS), 'construction', 'jobs', 'shop', 'launch', 'sector', 'stub'];

// The screen a campaign is played on where it is now: its fight, or its
// act's home: the hangar in act 1, the sector map on the run (act 2), and
// the stub for the act after it, until it is built.
export function campaignScreen(campaign) {
  if (campaign.place === 'fight') return PLACE_SCREENS.fight;
  return campaign.act === 1 ? PLACE_SCREENS.hub : campaign.act === 2 ? 'sector' : 'stub';
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
//   campaign/new { rules, captain }   a new campaign, in place of any
//                                  other, led by the captain made for it
//                                  (campaign.js captainProblem; none: the
//                                  first crew member as they are); its seed
//                                  is the game's next roll, and its first
//                                  job board is rolled
//   campaign/continue              back to where the campaign is
//   campaign/board { rules }       a job board and the shop's stock for a
//                                  hub without them (a campaign saved
//                                  before there were jobs or a shop)
//   campaign/ship { ship }         the ship refitted at the hub
//   campaign/pay { rules }         a payment on the debt: credits for heat
//   campaign/buy { index, rules }  the part at index in the shop's stock,
//                                  bought
//   campaign/sell { part, rules }  a part on hand, sold to the shop
//   campaign/job/take { index, rules }   the crew takes the board's job at
//                                  index: its fight begins. Every fight
//                                  takes forgiving odds and the difficulty
//                                  from the settings as it starts
//   campaign/raid/begin { rules }  the crew faces the raid that is due
//   campaign/launch { rules }      the ship lifts off: act 1 ends, and the
//                                  launch plays (launch.js)
//   campaign/run/begin { rules }   the run's first sector, at the act's
//                                  first visit home (travel.js)
//   campaign/jump { to, rules }    a jump, or a long jump, to node `to`
//   campaign/supplies { count, rules }   supplies bought at a station
//   campaign/sector/leave { rules }   on from the jump point into the next
//                                  sector
//   campaign/fight/begin { rules } the crew fights boarders at home (M15's
//                                  raids will)
//   campaign/fight/save { battle, log }   the fight after an order
//   campaign/fight/end { rules }   back to the hub once the fight is won or
//                                  lost: a job's pay and heat, and a new
//                                  board; or what a raid cost
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
      if (captain && captainProblem(captain, action.rules)) return state;
      const { value: seed, state: rng } = int(state.rng, 0, 0xffffffff);
      return { ...state, rng, campaign: withBoard(newCampaign(action.rules, seed, { captain }), action.rules), screen: PLACE_SCREENS.hub };
    }
    case 'campaign/continue':
      return state.campaign ? { ...state, screen: campaignScreen(state.campaign) } : state;
    case 'campaign/board':
      return withCampaign(state, state.campaign && withBoard(state.campaign, action.rules));
    case 'campaign/ship':
      return withCampaign(state, state.campaign && refitShip(state.campaign, action.ship));
    case 'campaign/pay':
    case 'campaign/buy':
    case 'campaign/sell': {
      const trade = { 'campaign/pay': (c) => makePayment(c, action.rules), 'campaign/buy': (c) => buyPart(c, action.rules, action.index), 'campaign/sell': (c) => sellPart(c, action.rules, action.part) }[action.type];
      const done = state.campaign && trade(state.campaign);
      return done?.ok ? { ...state, campaign: done.campaign } : state;
    }
    case 'campaign/job/take':
    case 'campaign/raid/begin':
    case 'campaign/fight/begin': {
      const setup = fightSettings(state.settings);
      const begin = {
        'campaign/job/take': (c) => takeJob(c, action.rules, action.index, setup),
        'campaign/raid/begin': (c) => beginRaid(c, action.rules, setup),
        'campaign/fight/begin': (c) => beginFight(c, action.rules, setup),
      }[action.type];
      const begun = state.campaign && begin(state.campaign);
      return begun?.ok ? { ...state, campaign: begun.campaign, screen: PLACE_SCREENS.fight } : state;
    }
    case 'campaign/fight/save':
      return withCampaign(state, state.campaign && saveFight(state.campaign, action.battle, action.log));
    case 'campaign/fight/end': {
      const end = state.campaign?.fight?.raid ? endRaid : endJob;
      const next = withCampaign(state, state.campaign && end(state.campaign, action.rules));
      return next === state ? state : { ...next, screen: campaignScreen(next.campaign) };
    }
    case 'campaign/launch': {
      const launched = state.campaign && launch(state.campaign, action.rules);
      return launched?.ok ? { ...state, campaign: launched.campaign, screen: 'launch' } : state;
    }
    case 'campaign/run/begin':
    case 'campaign/jump':
    case 'campaign/supplies':
    case 'campaign/sector/leave': {
      const move = {
        'campaign/run/begin': (c) => beginRun(c, action.rules),
        'campaign/jump': (c) => jump(c, action.rules, action.to),
        'campaign/supplies': (c) => buySupplies(c, action.rules, action.count),
        'campaign/sector/leave': (c) => leaveSector(c, action.rules),
      }[action.type];
      const done = state.campaign && move(state.campaign);
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
