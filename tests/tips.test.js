import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newCampaign } from '../src/sim/campaign.js';
import { CAMPAIGN_SCREENS } from '../src/sim/root.js';
import { TIP_IDS, TIP_STEPS } from '../src/ui/tipSteps.js';
import { rules } from './battleKit.js';

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
