import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeSave, parseSave, SAVE_VERSION } from '../src/core/save.js';
import { beginFight, campaignProblems, newCampaign } from '../src/sim/campaign.js';
import { takeJob, withBoard } from '../src/sim/contracts.js';
import { buyable } from '../src/sim/economy.js';
import { paymentFor, raidDue } from '../src/sim/heat.js';
import { launch, launchProblem } from '../src/sim/launch.js';
import { campaignScreen, initialState, reduce, saveData } from '../src/sim/root.js';
import { runToLaunch } from '../tools/run.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

const ready = readyToLaunch;

test('launch: only from the hangar, with every flight check passing', () => {
  assert.equal(launchProblem(ready(), rules), null);
  assert.equal(launchProblem(withBoard(newCampaign(rules, 5), rules), rules), 'Every flight check has to pass first: 4 to go.');
  assert.deepEqual(launch(newCampaign(rules, 5), rules), { ok: false, error: 'Every flight check has to pass first: 4 to go.' });
  const fighting = beginFight(ready(), rules).campaign;
  assert.equal(launchProblem(fighting, rules), 'Launch from the hangar.');
});

test('launch moves the campaign on to act 2, with the ship, crew, credits, parts and heat', () => {
  const before = ready();
  const { ok, campaign } = launch(before, rules);
  assert.ok(ok);
  assert.deepEqual([campaign.act, campaign.place, campaign.fight], [2, 'hub', null]);
  for (const key of ['ship', 'crew', 'credits', 'parts', 'heat', 'rng', 'spent', 'background']) assert.deepEqual(campaign[key], before[key], key);
  assert.deepEqual([campaign.board, campaign.shop], [[], []], "the district's board and stock stay behind");
  assert.deepEqual(campaign.flags, before.flags, 'no raid was due');
  assert.deepEqual(campaignProblems(campaign), []);
  // It can't launch again: there is no hangar in act 2.
  assert.deepEqual(launch(campaign, rules), { ok: false, error: 'Launch from the hangar.' });
});

test("after launch, the hangar's job board, shop, payments and raids stay behind", () => {
  const { campaign } = launch(ready({ heat: 70 }), rules);
  const hot = { ...campaign, heat: 95, board: ready().board };
  assert.equal(raidDue(hot, rules), false, 'no raid on the hangar any more');
  assert.equal(withBoard(campaign, rules), campaign, 'no board is rolled');
  assert.deepEqual(takeJob(hot, rules, 0), { ok: false, error: 'Jobs are taken from the hangar.' });
  assert.equal(paymentFor({ ...campaign, credits: 500 }, rules).why, 'Payments are made from the hangar.');
  assert.equal(buyable({ ...campaign, credits: 500, shop: [{ part: 'engine', price: 200 }] }, rules, 0).why, 'Buy and sell from the hangar.');
});

test('a raid at the door does not stop the launch: the pursuer finds an empty hangar', () => {
  const due = ready({ heat: 80 });
  assert.equal(raidDue(due, rules), true);
  const { ok, campaign } = launch(due, rules);
  assert.ok(ok);
  assert.equal(campaign.flags.escapedRaid, true);
  assert.equal(campaign.heat, 80, 'heat goes along');
  assert.deepEqual(campaignProblems(campaign), []);
});

test('through the game: Launch plays the launch, and Continue goes to the stub for act 2', () => {
  const state = { ...initialState(1), screen: 'hub', campaign: ready() };
  const launched = reduce(state, { type: 'campaign/launch', rules });
  assert.deepEqual([launched.screen, launched.campaign.act], ['launch', 2]);
  assert.equal(reduce({ ...launched, screen: 'title' }, { type: 'campaign/continue' }).screen, 'stub');
  assert.equal(campaignScreen(state.campaign), 'hub');
  // Not ready: nothing changes.
  const early = { ...state, campaign: withBoard(newCampaign(rules, 5), rules) };
  assert.equal(reduce(early, { type: 'campaign/launch', rules }), early);
  // A save restored at the launch goes back to the title, like any campaign screen.
  assert.equal(reduce(launched, { type: 'save/restore', data: saveData(launched) }).screen, 'title');
});

test('a launched campaign saves as v8 and reads back the same; a v7 save is read unchanged', () => {
  assert.equal(SAVE_VERSION, 8);
  const state = reduce({ ...initialState(1), screen: 'hub', campaign: ready() }, { type: 'campaign/launch', rules });
  const loaded = parseSave(JSON.stringify(makeSave(saveData(state))));
  assert.ok(loaded.ok, loaded.error);
  assert.deepEqual(loaded.save.data.campaign, state.campaign);
  const v7 = { version: 7, data: saveData({ ...initialState(2), campaign: ready() }) };
  const migrated = parseSave(JSON.stringify(v7));
  assert.ok(migrated.ok, migrated.error);
  assert.deepEqual(migrated.save, { version: 8, data: v7.data });
});

// M17's Done when: launching saves and moves on cleanly, from the end of
// real runs of act 1 (tools/run.js).
test('every test run that reaches launch launches into a clean act 2, and saves', () => {
  for (let seed = 1; seed <= 5; seed++) {
    const run = runToLaunch(rules, seed);
    assert.ok(run.launched, `seed ${seed}: ready`);
    const { ok, campaign, error } = launch(run.campaign, rules);
    assert.ok(ok, `seed ${seed}: ${error}`);
    assert.deepEqual(campaignProblems(campaign), [], `seed ${seed}`);
    const state = { ...initialState(seed), campaign };
    const back = parseSave(JSON.stringify(makeSave(saveData(state))));
    assert.ok(back.ok && JSON.stringify(back.save.data.campaign) === JSON.stringify(campaign), `seed ${seed}: saved whole`);
  }
});
