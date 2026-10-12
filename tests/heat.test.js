import assert from 'node:assert/strict';
import { test } from 'node:test';
import { beginFight, campaignProblems, newCampaign } from '../src/sim/campaign.js';
import { endJob, takeJob, withBoard } from '../src/sim/contracts.js';
import { heatLevel, huntersFor, jobHeat, makePayment, paymentFor, raidDue, withHeat } from '../src/sim/heat.js';
import { initialState, reduce } from '../src/sim/root.js';
import { jobText } from '../src/ui/campaign/jobText.js';
import { jobsInARow } from '../tools/jobs.js';
import { rules } from './battleKit.js';

const { balance } = rules;
const campaignAt = (heat, extra = {}) => ({ ...withBoard(newCampaign(rules, 5), rules), heat, ...extra });
const offer = (contract, twist = null) => ({ contract, client: 'marta', site: 'pit9', twist, seed: 3, credits: 80, part: null });

test('heat has four levels, from the thresholds in balance.json', () => {
  assert.deepEqual([0, 24, 25, 49, 50, 74, 75, 100].map((heat) => heatLevel(heat, rules)), ['calm', 'calm', 'rumors', 'rumors', 'hunters', 'hunters', 'raid', 'raid']);
  assert.deepEqual([balance.rumorHeat, balance.huntHeat, balance.raidHeat], [25, 50, 75]);
  assert.equal(withHeat(95, 15), 100, 'never past 100');
  assert.equal(withHeat(10, -15), 0, 'never under 0');
});

test('a job adds heat: a clear-out or a fire is loud', () => {
  assert.deepEqual(jobHeat(offer('jumpers'), rules), { heat: balance.loudJobHeat, loud: true });
  assert.deepEqual(jobHeat(offer('payroll'), rules), { heat: balance.jobHeat, loud: false });
  assert.deepEqual(jobHeat(offer('payroll', 'hazard'), rules), { heat: balance.loudJobHeat, loud: true });
  assert.deepEqual(jobHeat(offer('payroll', 'lights'), rules), { heat: balance.jobHeat, loud: false });
});

test('heat goes on when a job is over, done or lost', () => {
  const campaign = campaignAt(20);
  const on = takeJob(campaign, rules, 0).campaign;
  const { heat } = jobHeat(campaign.board[0], rules);
  for (const winner of ['crew', 'enemy']) {
    const after = endJob({ ...on, fight: { ...on.fight, battle: { ...on.fight.battle, winner } } }, rules);
    assert.equal(after.heat, 20 + heat, winner);
    assert.deepEqual(campaignProblems(after), []);
  }
  const hot = takeJob(campaignAt(70), rules, 0).campaign;
  assert.equal(endJob({ ...hot, fight: { ...hot.fight, battle: { ...hot.fight.battle, winner: 'crew' } } }, rules).heat, Math.min(100, 70 + heat));
  // A fight at home adds none.
  const home = beginFight(campaign, rules).campaign;
  assert.equal(endJob({ ...home, fight: { ...home.fight, battle: { ...home.fight.battle, winner: 'crew' } } }, rules).heat, 20);
});

test('from huntHeat, the pursuer sends a hunter along on every job', () => {
  assert.deepEqual(huntersFor(campaignAt(balance.huntHeat - 1), rules), []);
  assert.deepEqual(huntersFor(campaignAt(balance.huntHeat), rules), ['agent']);
  const kinds = (campaign) => takeJob(campaign, rules, 0).campaign.fight.battle.units.filter((u) => u.side === 'enemy').map((u) => u.kind);
  const calm = kinds(campaignAt(10));
  const hunted = kinds(campaignAt(60));
  assert.deepEqual(hunted, [...calm, 'agent']);
  const card = (heat) => jobText(campaignAt(heat).board[0], rules, huntersFor(campaignAt(heat), rules)).against;
  assert.match(card(60), /Recovery agent/);
  assert.equal(card(10).includes('Recovery agent'), calm.includes('agent'), "below huntHeat, only the encounter's own");
});

test('from raidHeat a raid is due at the hangar, and no job can be taken first', () => {
  assert.equal(raidDue(campaignAt(74), rules), false);
  const due = campaignAt(75);
  assert.equal(raidDue(due, rules), true);
  assert.deepEqual(takeJob(due, rules, 0), { ok: false, error: 'Not with a raid at the door.' });
  const state = { ...initialState(1), screen: 'hub', campaign: due };
  assert.equal(reduce(state, { type: 'campaign/job/take', index: 0, rules }), state);
});

test('a payment on the debt buys heat off with credits, from the hangar', () => {
  const { payment } = paymentFor(campaignAt(40), rules);
  assert.deepEqual([payment.credits, payment.heat], [50, 15]);
  const paid = makePayment(campaignAt(40, { credits: 120 }), rules);
  assert.ok(paid.ok, paid.error);
  assert.deepEqual([paid.campaign.credits, paid.campaign.heat, paid.campaign.flags.payments], [70, 25, 1]);
  assert.equal(makePayment(campaignAt(10, { credits: 120 }), rules).campaign.heat, 0, 'never under 0');
  assert.deepEqual(makePayment(campaignAt(40, { credits: 45 }), rules), { ok: false, error: 'A payment is 50 credits.' });
  assert.deepEqual(makePayment(campaignAt(0, { credits: 120 }), rules), { ok: false, error: 'There is no heat to pay off.' });
  const fighting = beginFight(campaignAt(40, { credits: 120 }), rules).campaign;
  assert.deepEqual(makePayment(fighting, rules), { ok: false, error: 'Payments are made from the hangar.' });
  // A payment heads off a raid that is due.
  const due = campaignAt(80, { credits: 100 });
  assert.equal(raidDue(makePayment(due, rules).campaign, rules), false);
  // Through the game's reducer.
  const state = { ...initialState(1), screen: 'hub', campaign: campaignAt(40, { credits: 120 }) };
  assert.equal(reduce(state, { type: 'campaign/pay', rules }).campaign.heat, 25);
  const broke = { ...state, campaign: { ...state.campaign, credits: 0 } };
  assert.equal(reduce(broke, { type: 'campaign/pay', rules }), broke);
});

// M15's Done when: ignoring heat brings a raid, and managing it avoids one.
// Ten campaigns played both ways, the crew by the job player and the enemy
// by the AI (tools/jobs.js). Ignoring heat takes the board's first job
// every time and pays nothing; managing it takes the quietest job and makes
// a payment whenever the next job would bring heat to the hunters.
test('ignoring heat brings a raid within ten jobs; managing it avoids one over twelve', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const ignored = jobsInARow(rules, seed, 10);
    assert.ok(ignored.raids > 0 || ignored.due, `seed ${seed}: ignoring heat, a raid`);
    const managed = jobsInARow(rules, seed, 12, { manage: true });
    assert.equal(managed.raids, 0, `seed ${seed}: managing heat, no raid`);
    assert.equal(managed.due, false, `seed ${seed}: and none at the door`);
    assert.ok(managed.peak < balance.huntHeat, `seed ${seed}: and no hunters (heat at most ${managed.peak})`);
  }
});
