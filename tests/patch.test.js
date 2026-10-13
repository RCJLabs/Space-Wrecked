// Patching up the crew at stations (src/sim/patch.js, M22): patchPrice a
// hit point, a hit point at a time to whoever has fewest left, as far as the
// credits go; only at a station, and only with someone hurt.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { campaignProblems, maxHp } from '../src/sim/campaign.js';
import { launch } from '../src/sim/launch.js';
import { patchCrew, patchPlan } from '../src/sim/patch.js';
import { initialState, reduce } from '../src/sim/root.js';
import { beginRun } from '../src/sim/travel.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

const { patchPrice } = rules.balance;
// On the run at a station, the crew down to the hit points given.
function atStation(credits, hps) {
  const campaign = beginRun(launch(readyToLaunch({ credits }), rules).campaign, rules).campaign;
  const station = campaign.run.sector.nodes.find((node) => node.type === 'station').id;
  const crew = campaign.crew.map((member, i) => ({ ...member, hp: hps[i] ?? member.hp }));
  return { ...campaign, crew, run: { ...campaign.run, at: station, seen: [...campaign.run.seen, station] } };
}

test('a station patches up the whole crew for patchPrice a hit point', () => {
  const hurt = atStation(500, [1, 2, 3]);
  const missing = hurt.crew.reduce((sum, m) => sum + maxHp(m, rules) - m.hp, 0);
  const plan = patchPlan(hurt, rules);
  assert.deepEqual([plan.ok, plan.hp, plan.cost, plan.total], [true, missing, missing * patchPrice, missing * patchPrice]);
  assert.deepEqual(plan.heals.map((h) => [h.id, h.from, h.to]), hurt.crew.map((m) => [m.id, m.hp, maxHp(m, rules)]));
  const patched = patchCrew(hurt, rules).campaign;
  assert.deepEqual(patched.crew.map((m) => m.hp), hurt.crew.map((m) => maxHp(m, rules)));
  assert.deepEqual([patched.credits, patched.flags.hpPatched], [500 - missing * patchPrice, missing]);
  assert.deepEqual(campaignProblems(patched), []);
});

test('short of credits, the most hurt first, a hit point at a time', () => {
  const hurt = atStation(5 * patchPrice, [1, 4, 7]);
  const plan = patchPlan(hurt, rules);
  // 5 hit points: the first comes up to 4 (3), then the first two to 5 (2).
  assert.deepEqual(plan.heals.map((h) => [h.from, h.to]), [[1, 5], [4, 5]]);
  assert.deepEqual([plan.hp, plan.cost], [5, 5 * patchPrice]);
  assert.equal(patchCrew(hurt, rules).campaign.credits, 0);
  // Ties go to the lowest id.
  assert.deepEqual(patchPlan(atStation(patchPrice, [3, 3, 3]), rules).heals.map((h) => h.id), [hurt.crew[0].id]);
});

test("not away from a station, not with no one hurt, and not with credits short of a hit point's price", () => {
  const away = atStation(500, [1]);
  assert.deepEqual(patchPlan({ ...away, run: { ...away.run, at: away.run.sector.start } }, rules), { ok: false, error: 'The crew is patched up at stations.' });
  assert.deepEqual(patchPlan(atStation(500, []), rules), { ok: false, error: 'No one is hurt.' });
  const broke = patchPlan(atStation(patchPrice - 1, [1]), rules);
  assert.deepEqual([broke.ok, broke.error], [false, `Patching a hit point costs ${patchPrice} credits.`]);
  assert.deepEqual(patchCrew(atStation(0, [1]), rules).ok, false);
});

test('through the game: the patch action heals the crew where it can, and does nothing where it cannot', () => {
  const state = { ...initialState(1), campaign: atStation(500, [1, 1, 1]), screen: 'sector' };
  const patched = reduce(state, { type: 'campaign/patch', rules });
  assert.ok(patched.campaign.crew.every((m) => m.hp === maxHp(m, rules)));
  assert.equal(patched.screen, 'sector');
  assert.equal(reduce(patched, { type: 'campaign/patch', rules }), patched, 'no one is hurt now');
});
