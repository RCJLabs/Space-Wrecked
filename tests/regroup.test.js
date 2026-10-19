// M24: regrouping, hiding in a nebula and the transponder swap. Away from
// stations a day's rest eats a jump's supplies, heals each of the wounded
// regroupHp and the med bay's day, and costs heat; the hunters may find the
// ship while it sits. In a nebula the day hides it: heat falls, no roll. At
// a station, once a sector, the transponder is swapped for credits, each
// swap dearer than the last (M40).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { campaignProblems, HEAT_MAX, maxHp } from '../src/sim/campaign.js';
import { launch } from '../src/sim/launch.js';
import { regroup, regroupPlan } from '../src/sim/regroup.js';
import { initialState, reduce } from '../src/sim/root.js';
import { swapPlan, swapPriceOf, swapTransponder } from '../src/sim/transponder.js';
import { beginRun, jumpSupplies, leaveSector } from '../src/sim/travel.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

const { balance } = rules;
const onRun = (extra = {}) => beginRun(launch(readyToLaunch(extra), rules).campaign, rules).campaign;
// The ship at a node of kind `type` (the first in its sector), for the tests:
// no jump. A node of a kind the sector lacks is made one, the first of
// the mix's kinds (a sector need hold no empty space, M37b).
function atKind(campaign, type) {
  const { sector } = campaign.run;
  const found = sector.nodes.find((node) => node.type === type) ?? sector.nodes.find((node) => Object.hasOwn(rules.sectors.mix, node.type));
  const nodes = sector.nodes.map((node) => (node.id === found.id ? { ...node, type, event: undefined, hostile: undefined } : node));
  return { ...campaign, run: { ...campaign.run, sector: { ...sector, nodes }, at: found.id, seen: [...new Set([...campaign.run.seen, found.id])] } };
}
// The crew with everyone down `hp` hit points from their most.
const hurt = (campaign, hp) => ({ ...campaign, crew: campaign.crew.map((member) => ({ ...member, hp: Math.max(1, maxHp(member, rules) - hp) })) });

test('a day regrouping: a jump\'s supplies, regroupHp healed each and the med bay\'s day, heat up, and the hunters\' odds', () => {
  const campaign = hurt(atKind(onRun({ heat: 20 }), 'empty'), 5);
  const plan = regroupPlan(campaign, rules);
  assert.deepEqual(plan, { ok: true, kind: 'regroup', supplies: jumpSupplies(campaign, rules), heat: balance.regroupHeat, heal: balance.regroupHp, hunt: { chance: 0, ship: null, why: null } });
  const { campaign: after, hunt } = regroup(campaign, rules);
  assert.equal(after.supplies, campaign.supplies - plan.supplies);
  assert.equal(after.heat, 20 + balance.regroupHeat);
  assert.deepEqual(after.crew.map((m) => m.hp), campaign.crew.map((m) => Math.min(maxHp(m, rules), m.hp + balance.regroupHp)));
  assert.equal(after.flags.regroups, 1);
  assert.equal(after.flags.hpRested, balance.regroupHp * campaign.crew.length);
  assert.deepEqual(hunt, { chance: 0, ship: null, why: null, roll: null, found: false });
  assert.deepEqual(campaignProblems(after), []);
  // With a med bay working, its day heals too.
  const bay = { ...campaign, ship: { ...campaign.ship, modules: [...campaign.ship.modules, { uid: 999, type: 'medbay', x: 0, y: 0, rot: 0 }] } };
  assert.equal(regroupPlan(bay, rules).heal, balance.regroupHp + rules.modules.get('medbay').heal + rules.jobs.get('medic').station.heal);
});

test('regrouping hot: the hunters may find the ship as it sits, and at the most heat they do', () => {
  const campaign = hurt(atKind(onRun({ heat: HEAT_MAX }), 'empty'), 5);
  const plan = regroupPlan(campaign, rules);
  assert.equal(plan.hunt.chance, 100);
  const { campaign: after, hunt } = regroup(campaign, rules);
  assert.equal(hunt.found, true);
  assert.equal(after.run.approach.hunt, true);
  assert.equal(reduce({ ...initialState(1), campaign, screen: 'sector' }, { type: 'campaign/regroup', rules }).screen, 'approach');
  assert.deepEqual(campaignProblems(after), []);
});

test('a day hidden in a nebula: heat falls hideHeat, no hunters\' roll, and the crew rests all the same', () => {
  const campaign = hurt(atKind(onRun({ heat: 60 }), 'nebula'), 2);
  const plan = regroupPlan(campaign, rules);
  assert.equal(plan.kind, 'hide');
  assert.equal(plan.heat, balance.hideHeat);
  assert.deepEqual(plan.hunt, { chance: 0, ship: null, why: 'hidden' });
  const { campaign: after, hunt } = regroup(campaign, rules);
  assert.equal(hunt, null);
  assert.equal(after.heat, 60 + balance.hideHeat);
  assert.equal(after.run.approach, null);
  assert.equal(after.flags.hides, 1);
  // No one hurt: hiding still sheds heat; with no heat either, there is nothing to do.
  const whole = atKind(onRun({ heat: 5 }), 'nebula');
  assert.equal(regroupPlan(whole, rules).heat, -5, 'down to nothing, no further');
  assert.match(regroupPlan({ ...whole, heat: 0 }, rules).error, /No one is hurt, and there is no heat to lose/);
});

test('no regroup at a station, with no one hurt, short of supplies, or held by an event or the hunters', () => {
  assert.match(regroupPlan(hurt(atKind(onRun(), 'station'), 3), rules).error, /At a station, Patch up sees to the crew/);
  assert.match(regroupPlan(atKind(onRun(), 'empty'), rules).error, /No one needs the rest/);
  const short = { ...hurt(atKind(onRun(), 'empty'), 3), supplies: 2 };
  assert.match(regroupPlan(short, rules).error, /A day's rest eats 3 supplies, and the holds have 2/);
  const atEvent = hurt(onRun(), 3);
  const node = atEvent.run.sector.nodes.find((n) => n.event);
  const held = { ...atEvent, run: { ...atEvent.run, at: node.id, seen: [...atEvent.run.seen, node.id] } };
  assert.match(regroupPlan(held, rules).error, /Decide first/);
  assert.equal(regroupPlan(launch(readyToLaunch(), rules).campaign, rules).ok, false, 'before the run begins');
});

test('the transponder swap: at a station, once a sector, heat down swapHeat for swapPrice credits', () => {
  const campaign = atKind(onRun({ heat: 50, credits: 100 }), 'station');
  assert.deepEqual(swapPlan(campaign, rules), { ok: true, price: balance.swapPrice, dock: 0, heat: balance.swapHeat });
  const { campaign: after } = swapTransponder(campaign, rules);
  assert.equal(after.credits, 100 - balance.swapPrice);
  assert.equal(after.heat, 50 + balance.swapHeat);
  assert.equal(after.run.swapped, true);
  assert.equal(after.flags.swaps, 1);
  assert.deepEqual(campaignProblems(after), []);
  assert.match(swapPlan(after, rules).error, /swapped in this sector already/);
  // The next sector, a clean slate.
  const exit = { ...after, run: { ...after.run, at: after.run.sector.exit } };
  const next = leaveSector(exit, rules).campaign;
  assert.equal(next.run.swapped, false);
  // Never below nothing; not away from a station, with no heat, or short of credits.
  assert.equal(swapPlan({ ...campaign, heat: 10 }, rules).heat, -10);
  assert.match(swapPlan(atKind(onRun({ heat: 50, credits: 100 }), 'empty'), rules).error, /swapped at stations/);
  assert.match(swapPlan({ ...campaign, heat: 0 }, rules).error, /no heat to lose/);
  assert.match(swapPlan({ ...campaign, credits: balance.swapPrice - 1 }, rules).error, new RegExp(`A swap is ${balance.swapPrice} credits`));
  // Through the store, as the chart's button does it.
  const state = reduce({ ...initialState(1), campaign, screen: 'sector' }, { type: 'campaign/swap', rules });
  assert.equal(state.campaign.run.swapped, true);
  assert.equal(state.screen, 'sector');
});

test('each swap costs swapRise more than the one before it (M40): the campaign counts them, so saves keep the price', () => {
  const campaign = atKind(onRun({ heat: 60, credits: 500 }), 'station');
  assert.equal(swapPriceOf(campaign, rules), balance.swapPrice);
  const first = swapTransponder(campaign, rules).campaign;
  assert.equal(first.credits, 500 - balance.swapPrice);
  // A sector on, at a station again: the second costs swapRise more.
  const exit = { ...first, run: { ...first.run, at: first.run.sector.exit } };
  const next = atKind({ ...leaveSector(exit, rules).campaign, heat: 60 }, 'station');
  assert.equal(next.flags.swaps, 1);
  assert.equal(swapPriceOf(next, rules), balance.swapPrice + balance.swapRise);
  const plan = swapPlan(next, rules);
  assert.equal(plan.price, balance.swapPrice + balance.swapRise);
  const second = swapTransponder(next, rules).campaign;
  assert.equal(second.credits, next.credits - plan.price);
  assert.equal(swapPriceOf(second, rules), balance.swapPrice + 2 * balance.swapRise);
  // Short of the risen price, it says so.
  assert.match(swapPlan({ ...next, credits: plan.price - 1 }, rules).error, new RegExp(`A swap is ${plan.price} credits`));
  assert.deepEqual(campaignProblems(second), []);
});
