// Root reducer for the store. Pure: no DOM, window, timers, Date.now() or
// Math.random(). The starting seed comes in from outside, and so do the
// content tables (rules) for the actions that need them.
import { int } from '../core/rng.js';
import { emptyBuilds, reduceBuilds } from './builds.js';
import { beginFight, newCampaign, refitShip, saveFight } from './campaign.js';
import { endJob, takeJob, withBoard } from './contracts.js';
import { makePayment } from './heat.js';
import { beginRaid, endRaid } from './raid.js';
import { defaultSettings, reduceSettings } from './settings.js';

// The screen each place in a campaign is played on, and every screen that
// shows the campaign: construction mode and the job board are the hub's.
export const PLACE_SCREENS = { hub: 'hub', fight: 'campaign-fight' };
export const CAMPAIGN_SCREENS = [...Object.values(PLACE_SCREENS), 'construction', 'jobs'];

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
//   campaign/new { rules }         a new campaign, in place of any other;
//                                  its seed is the game's next roll, and its
//                                  first job board is rolled
//   campaign/continue              back to where the campaign is
//   campaign/board { rules }       a job board for a hub without one (a
//                                  campaign saved before there were jobs)
//   campaign/ship { ship }         the ship refitted at the hub
//   campaign/pay { rules }         a payment on the debt: credits for heat
//   campaign/job/take { index, rules }   the crew takes the board's job at
//                                  index: its fight begins
//   campaign/raid/begin { rules }  the crew faces the raid that is due
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
      const { value: seed, state: rng } = int(state.rng, 0, 0xffffffff);
      return { ...state, rng, campaign: withBoard(newCampaign(action.rules, seed), action.rules), screen: PLACE_SCREENS.hub };
    }
    case 'campaign/continue':
      return state.campaign ? { ...state, screen: PLACE_SCREENS[state.campaign.place] } : state;
    case 'campaign/board':
      return withCampaign(state, state.campaign && withBoard(state.campaign, action.rules));
    case 'campaign/ship':
      return withCampaign(state, state.campaign && refitShip(state.campaign, action.ship));
    case 'campaign/pay': {
      const paid = state.campaign && makePayment(state.campaign, action.rules);
      return paid?.ok ? { ...state, campaign: paid.campaign } : state;
    }
    case 'campaign/job/take':
    case 'campaign/raid/begin':
    case 'campaign/fight/begin': {
      const begin = { 'campaign/job/take': (c) => takeJob(c, action.rules, action.index), 'campaign/raid/begin': (c) => beginRaid(c, action.rules), 'campaign/fight/begin': (c) => beginFight(c, action.rules) }[action.type];
      const begun = state.campaign && begin(state.campaign);
      return begun?.ok ? { ...state, campaign: begun.campaign, screen: PLACE_SCREENS.fight } : state;
    }
    case 'campaign/fight/save':
      return withCampaign(state, state.campaign && saveFight(state.campaign, action.battle, action.log));
    case 'campaign/fight/end': {
      const end = state.campaign?.fight?.raid ? endRaid : endJob;
      const next = withCampaign(state, state.campaign && end(state.campaign, action.rules));
      return next === state ? state : { ...next, screen: PLACE_SCREENS[next.campaign.place] };
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
