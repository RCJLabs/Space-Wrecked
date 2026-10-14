import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newCampaign } from '../src/sim/campaign.js';
import { launch } from '../src/sim/launch.js';
import { beginRun } from '../src/sim/travel.js';
import { CAMPAIGN_SCREENS } from '../src/sim/root.js';
import { TIP_IDS, TIP_STEPS } from '../src/ui/tipSteps.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

test('every tip has its words, on a screen the campaign has, and shows in order', () => {
  assert.deepEqual([...rules.tips.keys()], TIP_IDS, 'data/tips.json in the order a new player meets them');
  for (const step of TIP_STEPS) {
    assert.ok(CAMPAIGN_SCREENS.includes(step.screen), `${step.id} on ${step.screen}`);
    assert.ok(rules.tips.get(step.id).text.length <= 200, step.id);
  }
});

test('the first tips of a new game: the goal, then Build, then the part the checklist needs', () => {
  const state = { screen: 'hub', campaign: newCampaign(rules, 5), settings: { tips: true, tipsSeen: [] } };
  const none = () => null;
  const applies = (id, screen = state.screen) => {
    const step = TIP_STEPS.find((s) => s.id === id);
    return step.screen === screen && step.when({ ...state, screen }, rules, none);
  };
  assert.ok(applies('hangar-goal') && applies('hangar-build'));
  assert.equal(applies('hangar-jobs'), false, 'not while there are parts on hand to fit');
  const parts = TIP_STEPS.find((s) => s.id === 'build-parts');
  assert.equal(parts.at(state, rules), '.bld-part[data-type="quarters"]', 'Crew quarters, the first open line with its part on hand');
  assert.ok(applies('build-parts', 'construction'));
  assert.equal(applies('build-back', 'construction'), false);
});

test("the builder's tips are act 1's: construction mode at a station on the run has none (M23h)", () => {
  const run = beginRun(launch(readyToLaunch({ parts: { corridor: 2, medbay: 1 } }), rules).campaign, rules).campaign;
  const station = run.run.sector.nodes.find((n) => n.type === 'station').id;
  const campaign = { ...run, run: { ...run.run, at: station, seen: [...run.run.seen, station] } };
  const state = { screen: 'construction', campaign, settings: { tips: true, tipsSeen: [] } };
  for (const id of ['build-parts', 'build-place', 'build-back']) {
    const step = TIP_STEPS.find((s) => s.id === id);
    assert.equal(step.when(state, rules, () => ({})), false, id);
  }
});
