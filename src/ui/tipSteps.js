// The first-run tips, in the order a new player meets them (tips.js shows
// them; their words are data/tips.json): the screen each shows on, the
// control it points at (at: a selector, or (state, rules) => one), when it
// applies, and what a touch on puts it away (done: a selector; at's own
// control unless given). when(state, rules, find) has the game's state,
// the content, and find(selector): the first such element on screen, or
// null. The builder's tips are act 1's, at the hangar: construction mode at
// a station on the run (M23h) has none. Past the first fight (M43), each
// new thing's tip the first time it comes: act 1's heat, payments, raids,
// the shop and Launch; the run's chart, jumps, supplies, stations, events,
// approaches and hunters; Survey and Settle here past the charts; and the
// colony's needs, building, days, trips and raids.
import { atHangar } from '../sim/acts.js';
import { shipChecklist } from '../sim/campaign.js';
import { countOfAny, versionAtHand } from '../sim/makers.js';
import { hangarText } from './campaign/hubText.js';

const picked = '.bld-part[aria-pressed="true"]';

export const TIP_STEPS = [
  { id: 'hangar-goal', screen: 'hub', at: '.hgr-panel:has(.hgr-goal)', when: () => true },
  { id: 'hangar-build', screen: 'hub', at: '.hgr-build', when: (state, rules) => hangarText(state.campaign, rules).build },
  { id: 'build-parts', screen: 'construction', at: (state, rules) => `.bld-part[data-type="${neededOnHand(state.campaign, rules)}"]`, when: (state, rules, find) => atHangar(state.campaign, rules) && !find(picked) },
  { id: 'build-place', screen: 'construction', at: '.bld-status', done: '.bld-board', when: (state, rules, find) => atHangar(state.campaign, rules) && Boolean(find(picked)) },
  { id: 'build-back', screen: 'construction', at: '.bld-leave', when: (state, rules) => atHangar(state.campaign, rules) && !hangarText(state.campaign, rules).build },
  {
    id: 'hangar-jobs',
    screen: 'hub',
    at: '.hgr-jobs',
    when: (state, rules) => {
      const text = hangarText(state.campaign, rules);
      return !text.build && !text.raid && !text.goal.ready;
    },
  },
  { id: 'jobs-take', screen: 'jobs', at: '.jobs-take', when: () => true },
  { id: 'fight-crew', screen: 'campaign-fight', at: '.fgt-units', when: (state, rules, find) => calm(find) },
  { id: 'fight-move', screen: 'campaign-fight', at: '.fgt-status', done: '.fgt-board', when: (state, rules, find) => calm(find) && Boolean(find('.fgt-unit[aria-pressed="true"]')) },
  { id: 'fight-shoot', screen: 'campaign-fight', at: '.fgt-act[aria-label="Shoot"]', when: (state, rules, find) => calm(find) },
  { id: 'fight-end', screen: 'campaign-fight', at: '.fgt-end', when: (state, rules, find) => calm(find) },
  // Act 1 past the first fight (M43).
  { id: 'hangar-raid', screen: 'hub', at: '.hgr-jobs', when: (state, rules) => Boolean(hangarText(state.campaign, rules).raid) },
  { id: 'hangar-heat', screen: 'hub', at: '.hgr-heat', when: (state) => state.campaign.heat > 0 },
  { id: 'hangar-pay', screen: 'hub', at: '.hgr-pay:not([disabled])', when: () => true },
  { id: 'hangar-shop', screen: 'hub', at: '.hgr-shop', when: (state, rules) => seen(state, 'hangar-jobs') && !hangarText(state.campaign, rules).raid },
  { id: 'hangar-launch', screen: 'hub', at: '.hgr-launch:not([disabled])', when: (state, rules) => hangarText(state.campaign, rules).goal.ready },
  // The run (M43): the chart first, then each thing as it comes.
  { id: 'run-chart', screen: 'sector', at: '.sct-node[data-reach="1"]', when: (state, rules, find) => open(find) },
  { id: 'run-jump', screen: 'sector', at: '.sct-jump:not([disabled])', when: (state, rules, find) => open(find) },
  { id: 'run-event', screen: 'sector', at: '.sct-choice:not(.sct-carry):not([disabled])', when: () => true },
  { id: 'run-station', screen: 'sector', at: '.sct-buys', done: '.sct-buy', when: (state, rules, find) => open(find) },
  { id: 'run-scan', screen: 'sector', at: '.sct-scan:not([disabled])', when: (state, rules, find) => open(find) },
  { id: 'run-rest', screen: 'sector', at: '.sct-rest:not([disabled])', when: (state, rules, find) => open(find) },
  { id: 'run-swap', screen: 'sector', at: '.sct-swap:not([disabled])', when: (state, rules, find) => open(find) },
  { id: 'approach-orders', screen: 'approach', at: '.apr-moves', done: '.apr-order', when: (state, rules, find) => still(find) },
  { id: 'approach-board', screen: 'approach', at: '.apr-board', when: (state, rules, find) => !find('.apr[data-playing="true"]') && Boolean(find('.apr-leave')) },
  // Past the charts (M43).
  { id: 'system-survey', screen: 'sector', at: '.sct-survey:not([disabled])', when: (state, rules, find) => open(find) },
  { id: 'system-settle', screen: 'sector', at: '.sct-settle:not([disabled])', when: (state, rules, find) => open(find) },
  // The colony (M43).
  { id: 'colony-defend', screen: 'colony', at: '.cln-defend:not([disabled])', when: () => true },
  { id: 'colony-needs', screen: 'colony', at: '.cln-needs', when: () => true },
  { id: 'colony-build', screen: 'colony', at: '.cln-builds', done: '.cln-builds .cln-part', when: () => true },
  { id: 'colony-day', screen: 'colony', at: '.cln-day:not([disabled])', when: (state) => seen(state, 'colony-build') },
  { id: 'colony-trip', screen: 'colony', at: '.cln-places', done: '.cln-places .cln-part', when: (state) => seen(state, 'colony-day') },
];

export const TIP_IDS = TIP_STEPS.map((step) => step.id);

// A part on hand that a failing flight check asks for, any maker's, or null.
function neededOnHand(campaign, rules) {
  const count = (type) => campaign.parts[type] ?? 0;
  const type = shipChecklist(campaign, rules).find((line) => line.ok !== true && line.add && countOfAny(rules, line.add, count) > 0)?.add;
  return type ? versionAtHand(rules, type, count) : null;
}

// Whether a tip has been put away.
function seen(state, id) {
  return state.settings.tipsSeen.includes(id);
}

// The chart with no card or crew card over it.
function open(find) {
  return !find('.sct[data-card="true"]') && !find('.sct-crew');
}

// No tip on the approach while a round plays, or once it is over.
function still(find) {
  return !find('.apr[data-playing="true"]') && !find('.apr-out');
}

// No tip while the enemy's turn plays out, or once the fight is over.
function calm(find) {
  return !find('.fgt-skip') && !find('.fgt-over');
}
