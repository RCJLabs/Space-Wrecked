// The first-run tips, in the order a new player meets them (tips.js shows
// them; their words are data/tips.json): the screen each shows on, the
// control it points at (at: a selector, or (state, rules) => one), when it
// applies, and what a touch on puts it away (done: a selector; at's own
// control unless given). when(state, rules, find) has the game's state,
// the content, and find(selector): the first such element on screen, or
// null. The builder's tips are act 1's, at the hangar: construction mode at
// a station on the run (M23h) has none.
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
];

export const TIP_IDS = TIP_STEPS.map((step) => step.id);

// A part on hand that a failing flight check asks for, any maker's, or null.
function neededOnHand(campaign, rules) {
  const count = (type) => campaign.parts[type] ?? 0;
  const type = shipChecklist(campaign, rules).find((line) => line.ok !== true && line.add && countOfAny(rules, line.add, count) > 0)?.add;
  return type ? versionAtHand(rules, type, count) : null;
}

// No tip while the enemy's turn plays out, or once the fight is over.
function calm(find) {
  return !find('.fgt-skip') && !find('.fgt-over');
}
