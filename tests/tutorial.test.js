// The tips past the first fight (M43): each the first time its thing comes,
// in act 1, on the run, past the charts and at the colony; never over a
// round playing out on the approach, or a card over the chart; and the
// builder's tip says a blocked ghost is crossed.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newCampaign } from '../src/sim/campaign.js';
import { TIP_STEPS } from '../src/ui/tipSteps.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

// What tips.js would show: the first step on this screen, not yet seen,
// whose control is on screen (shown: the selectors find finds) and whose
// rule holds.
function tipFor(screen, campaign, { shown = [], seen = [] } = {}) {
  const state = { screen, campaign, settings: { tips: true, tipsSeen: seen } };
  const find = (selector) => (shown.includes(selector) ? {} : null);
  const at = (step) => (typeof step.at === 'function' ? step.at(state, rules) : step.at);
  return TIP_STEPS.find((step) => step.screen === screen && !seen.includes(step.id) && find(at(step)) && step.when(state, rules, find))?.id ?? null;
}

const ACT1 = ['hangar-goal', 'hangar-build', 'build-parts', 'build-place', 'build-back', 'hangar-jobs', 'jobs-take', 'fight-crew', 'fight-move', 'fight-shoot', 'fight-end'];

test('act 1 past the first fight: heat, a payment, the shop, a raid and Launch, each once', () => {
  const start = newCampaign(rules, 5);
  const seen = [...ACT1];
  assert.equal(tipFor('hub', { ...start, heat: 0 }, { shown: ['.hgr-heat', '.hgr-shop'], seen }), 'hangar-shop', 'no heat yet: the shop');
  assert.equal(tipFor('hub', { ...start, heat: 12 }, { shown: ['.hgr-heat', '.hgr-shop'], seen }), 'hangar-heat', 'heat first');
  assert.equal(tipFor('hub', { ...start, heat: 12 }, { shown: ['.hgr-heat', '.hgr-pay:not([disabled])'], seen: [...seen, 'hangar-heat'] }), 'hangar-pay');
  const raid = { ...start, heat: rules.balance.raidHeat };
  assert.equal(tipFor('hub', raid, { shown: ['.hgr-jobs', '.hgr-heat', '.hgr-shop'], seen }), 'hangar-raid', 'a raid before anything else');
  assert.equal(tipFor('hub', raid, { shown: ['.hgr-shop'], seen: [...seen, 'hangar-raid'] }), null, 'no shop tip with a raid at the door');
  assert.equal(tipFor('hub', readyToLaunch(), { shown: ['.hgr-launch:not([disabled])'], seen: [...seen, 'hangar-heat'] }), 'hangar-launch');
  assert.equal(tipFor('hub', start, { shown: ['.hgr-launch:not([disabled])'], seen }), null, 'no Launch tip until every check passes');
  assert.equal(tipFor('hub', { ...start, heat: 12 }, { shown: ['.hgr-heat'], seen: [...seen, 'hangar-heat'] }), null, 'seen once, never again');
});

test("the run: the chart first, then a jump, an event, a station, a scan, a rest and the swap as they come; none under a card", () => {
  const campaign = newCampaign(rules, 5);
  const chart = ['.sct-node[data-reach="1"]', '.sct-jump:not([disabled])', '.sct-scan:not([disabled])'];
  assert.equal(tipFor('sector', campaign, { shown: chart }), 'run-chart');
  assert.equal(tipFor('sector', campaign, { shown: chart, seen: ['run-chart'] }), 'run-jump');
  assert.equal(tipFor('sector', campaign, { shown: [...chart, '.sct[data-card="true"]'], seen: ['run-chart'] }), null, 'nothing over a card');
  assert.equal(tipFor('sector', campaign, { shown: [...chart, '.sct[data-card="true"]', '.sct-choice:not(.sct-carry):not([disabled])'], seen: ['run-chart', 'run-jump'] }), 'run-event', "an event's choices on its card");
  assert.equal(tipFor('sector', campaign, { shown: ['.sct-buys', '.sct-scan:not([disabled])'], seen: ['run-chart', 'run-jump'] }), 'run-station');
  assert.equal(tipFor('sector', campaign, { shown: ['.sct-scan:not([disabled])', '.sct-crew'], seen: ['run-chart', 'run-jump'] }), null, 'nothing under the crew card');
  assert.equal(tipFor('sector', campaign, { shown: ['.sct-rest:not([disabled])', '.sct-swap:not([disabled])'], seen: ['run-chart'] }), 'run-rest');
  assert.equal(tipFor('sector', campaign, { shown: ['.sct-swap:not([disabled])'], seen: ['run-chart', 'run-rest'] }), 'run-swap');
  assert.equal(tipFor('sector', campaign, { shown: ['.sct-survey:not([disabled])', '.sct-settle:not([disabled])'] }), 'system-survey', 'past the charts: Survey');
  assert.equal(tipFor('sector', campaign, { shown: ['.sct-settle:not([disabled])'], seen: ['system-survey'] }), 'system-settle');
});

test("the approach: its orders while no round plays, Board only when boarding is the crew's choice", () => {
  const campaign = newCampaign(rules, 5);
  assert.equal(tipFor('approach', campaign, { shown: ['.apr-moves'] }), 'approach-orders');
  assert.equal(tipFor('approach', campaign, { shown: ['.apr-moves', '.apr[data-playing="true"]'] }), null, 'not while a round plays');
  assert.equal(tipFor('approach', campaign, { shown: ['.apr-moves', '.apr-out'] }), null, 'not over the end');
  assert.equal(tipFor('approach', campaign, { shown: ['.apr-board'], seen: ['approach-orders'] }), null, "not when they're the ones boarding");
  assert.equal(tipFor('approach', campaign, { shown: ['.apr-board', '.apr-leave'], seen: ['approach-orders'] }), 'approach-board');
});

test("the colony: a raid's Defend first, then its needs, building, the day and a trip, in that order", () => {
  const campaign = newCampaign(rules, 5);
  const all = ['.cln-defend:not([disabled])', '.cln-needs', '.cln-builds', '.cln-day:not([disabled])', '.cln-places'];
  const order = [];
  for (let seen = []; ; ) {
    const id = tipFor('colony', campaign, { shown: all, seen });
    if (!id) break;
    order.push(id);
    seen = [...seen, id];
  }
  assert.deepEqual(order, ['colony-defend', 'colony-needs', 'colony-build', 'colony-day', 'colony-trip']);
  assert.equal(tipFor('colony', campaign, { shown: ['.cln-day:not([disabled])', '.cln-places'], seen: ['colony-needs'] }), null, 'Next day after Build, a trip after the day');
});

test("the builder's tip says a blocked ghost is crossed (M42's cue), not red", () => {
  const words = rules.tips.get('build-place').text;
  assert.match(words, /crossed/);
  assert.doesNotMatch(words, /\bred\b/);
});

test("the colony's hint says what's next: the needs not met, then the day (M43)", async () => {
  const { colonyText } = await import('../src/ui/campaign/colonyText.js');
  const { settled } = await import('./colonyKit.js');
  const text = colonyText(settled(1), rules);
  assert.equal(text.next.text, "Not met yet, marked !: beds, air, aboard. Build for them, or give the ship's parts below. Then tap Next day.");
});
