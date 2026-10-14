import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeSave, MIGRATIONS, parseSave } from '../src/core/save.js';
import { applyCommand } from '../src/sim/builder.js';
import { campaignProblems, refitShip } from '../src/sim/campaign.js';
import { launch } from '../src/sim/launch.js';
import { initialState, reduce, saveData } from '../src/sim/root.js';
import { beginRun, buySupplies, jump, jumpPlan, jumpSupplies, leavePlan, leaveSector, linked, reach, supplyCapacity, supplyOffer } from '../src/sim/travel.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

const { balance } = rules;
// A campaign just launched into act 2, its run not begun.
const launched = (extra = {}) => launch(readyToLaunch(extra), rules).campaign;
// The same, its run begun: the first sector, holds full.
const onRun = (extra = {}) => beginRun(launched(extra), rules).campaign;
// The campaign with the ship moved to node `at` (for the tests: no jump).
const at = (campaign, node) => ({ ...campaign, run: { ...campaign.run, at: node, seen: [...new Set([...campaign.run.seen, node])] } });
const nodeOf = (campaign, type) => campaign.run.sector.nodes.find((node) => node.type === type);

test('the run begins at the first visit home in act 2: its first sector, the ship at its way in, the holds full', () => {
  const before = launched();
  assert.equal(before.run, null);
  assert.equal(beginRun(readyToLaunch(), rules).ok, false, 'not in act 1');
  const { ok, campaign } = beginRun(before, rules);
  assert.ok(ok);
  const { run } = campaign;
  assert.equal(run.sector.index, 1);
  assert.equal(run.at, run.sector.start);
  assert.deepEqual(run.seen, [run.sector.start]);
  assert.deepEqual(run.past, []);
  assert.equal(campaign.supplies, balance.baseSupplies, 'no cargo hold: the lockers only');
  assert.notEqual(campaign.rng, before.rng, 'the sector is rolled from the campaign');
  assert.deepEqual(beginRun(before, rules).campaign, campaign, 'the same campaign, the same sector');
  assert.equal(beginRun(campaign, rules).ok, false, 'once');
  assert.deepEqual(campaignProblems(campaign), []);
});

test('cargo holds carry more: capacity is the lockers and the holds', () => {
  const ready = readyToLaunch();
  const { ship } = applyCommand(ready.ship, rules, { op: 'place', type: 'cargo', x: 12, y: 2, rot: 0 });
  assert.notEqual(ship, ready.ship, 'the hold goes on');
  assert.equal(supplyCapacity(ship, rules), balance.baseSupplies + rules.modules.get('cargo').stats.cargo);
  const campaign = beginRun(launch(refitShip({ ...ready, parts: { ...ready.parts, cargo: 1 } }, ship, rules), rules).campaign, rules).campaign;
  assert.equal(campaign.supplies, balance.baseSupplies + 20);
});

test('a jump to a linked node eats a supply for each crew member and adds heat', () => {
  const campaign = onRun({ heat: 30 });
  const to = linked(campaign.run.sector, campaign.run.at)[0];
  const plan = jumpPlan(campaign, rules, to);
  assert.deepEqual(plan, { ok: true, kind: 'jump', supplies: balance.jumpSupplies * 3, left: 0, heat: balance.jumpHeat, hungry: false, heal: 0 });
  const after = jump(campaign, rules, to).campaign;
  assert.equal(after.run.at, to);
  assert.deepEqual(after.run.seen, [campaign.run.sector.start, to]);
  assert.equal(after.supplies, campaign.supplies - 3);
  assert.equal(after.heat, 33);
  assert.equal(after.flags.jumps, 1);
  assert.deepEqual(after.crew, campaign.crew, 'fed, no one is hurt');
  assert.deepEqual(campaignProblems(after), []);
});

test('a long jump goes two links away for three jumps of supplies, and sheds heat', () => {
  const campaign = onRun({ heat: 30 });
  const { sector, at: here } = campaign.run;
  const far = [...reach(sector, here)].find(([, links]) => links === 2)[0];
  assert.ok(!linked(sector, here).includes(far));
  const plan = jumpPlan(campaign, rules, far);
  assert.deepEqual(plan, { ok: true, kind: 'long', supplies: 3 * balance.longJumpFactor, left: 0, heat: balance.longJumpHeat, hungry: false, heal: 0 });
  const after = jump(campaign, rules, far).campaign;
  assert.equal(after.supplies, campaign.supplies - 9);
  assert.equal(after.heat, 20);
  assert.equal(after.flags.longJumps, 1);
  assert.equal(jump({ ...campaign, heat: 4 }, rules, far).campaign.heat, 0, 'heat stops at 0');
});

test('too far, here already, off the run, or no such place: no jump', () => {
  const campaign = onRun();
  const { sector } = campaign.run;
  assert.match(jumpPlan(campaign, rules, sector.exit).error, /is too far/);
  assert.match(jumpPlan(campaign, rules, sector.start).error, /The ship is at Way in/);
  assert.match(jumpPlan(campaign, rules, 99).error, /no such place/);
  assert.equal(jumpPlan(launched(), rules).ok, false, 'before the run begins');
  assert.equal(jumpPlan({ ...campaign, place: 'fight' }, rules, 1).ok, false, 'not from a fight');
  assert.equal(jump(campaign, rules, sector.exit).ok, false);
});

test('a jump short of supplies still goes: they run out, and the crew goes hungry', () => {
  const campaign = { ...onRun(), supplies: 2 };
  const to = linked(campaign.run.sector, campaign.run.at)[0];
  assert.equal(jumpPlan(campaign, rules, to).hungry, true);
  const crew = campaign.crew.map((member, i) => ({ ...member, hp: [10, 2, 1][i] }));
  const after = jump({ ...campaign, crew }, rules, to).campaign;
  assert.equal(after.supplies, 0);
  assert.deepEqual(after.crew.map((member) => member.hp), [10 - balance.hungerHp, 1, 1], 'never below 1');
  assert.equal(after.flags.hungryJumps, 1);
});

test('stations sell supplies up to the room in the holds and the credits', () => {
  const price = balance.supplyPrice;
  const run = onRun({ credits: 40 });
  const station = nodeOf(run, 'station');
  assert.match(supplyOffer(run, rules).error, /sold at stations/);
  const docked = { ...at(run, station.id), supplies: 2 };
  const room = balance.baseSupplies - 2;
  assert.deepEqual(supplyOffer(docked, rules), { ok: true, price, room, most: Math.min(room, Math.floor(40 / price)) });
  assert.equal(supplyOffer({ ...docked, credits: 4 * price - 1 }, rules).most, 3, 'as far as the credits go');
  const bought = buySupplies(docked, rules, 5);
  assert.ok(bought.ok);
  assert.equal(bought.campaign.supplies, 7);
  assert.equal(bought.campaign.credits, 40 - 5 * price);
  assert.equal(bought.campaign.flags.suppliesBought, 5);
  assert.equal(buySupplies(bought.campaign, rules, 1).campaign.flags.suppliesBought, 6, 'counted up');
  assert.match(buySupplies({ ...docked, credits: 1000 }, rules, room + 1).error, new RegExp(`The holds take ${room} more`));
  assert.match(buySupplies({ ...docked, supplies: balance.baseSupplies }, rules, 1).error, /The holds are full/);
  assert.match(buySupplies({ ...docked, credits: 2 * price - 1 }, rules, 2).error, new RegExp(`2 cost ${2 * price} credits`));
  assert.match(buySupplies(docked, rules, 0).error, /Buy one or more/);
  assert.equal(buySupplies(docked, rules, 1.5).ok, false, 'whole supplies');
  assert.equal(buySupplies(run, rules, 1).ok, false, 'away from a station');
});

test('the jump point leads on into the next sector, named afresh, up to the act\'s last', () => {
  const run = onRun({ heat: 10 });
  assert.match(leavePlan(run, rules).error, /left from its jump point/);
  const exit = at(run, run.run.sector.exit);
  const { ok, campaign, plan } = leaveSector(exit, rules);
  assert.ok(ok);
  assert.deepEqual(plan, { ok: true, kind: 'sector', supplies: 3, left: 0, heat: balance.jumpHeat, hungry: false, heal: 0 });
  assert.equal(campaign.run.sector.index, 2);
  assert.deepEqual(campaign.run.past, [run.run.sector.name]);
  assert.notEqual(campaign.run.sector.name, run.run.sector.name);
  assert.equal(campaign.run.at, campaign.run.sector.start);
  assert.equal(campaign.supplies, exit.supplies - 3);
  assert.equal(campaign.heat, 13);
  assert.deepEqual(campaignProblems(campaign), []);
  const sectors = rules.acts.get(2).sectors;
  const last = { ...exit, run: { ...exit.run, sector: { ...exit.run.sector, index: sectors } } };
  assert.deepEqual([leavePlan(last, rules).ok, leavePlan(last, rules).last], [false, true]);
});

test('a run saves and reads back the same; a v9 save gets no supplies and no run yet; a broken run is caught', () => {
  const state = { ...initialState(3), campaign: jump(onRun(), rules, 1).campaign };
  const loaded = parseSave(JSON.stringify(makeSave(saveData(state))));
  assert.ok(loaded.ok, loaded.error);
  assert.deepEqual(loaded.save.data.campaign, state.campaign);
  const { supplies, run, ...v9 } = launched();
  const up = MIGRATIONS.find((step) => step.from === 9).up({ ...saveData(initialState(3)), campaign: v9 });
  assert.equal(up.campaign.supplies, 0);
  assert.equal(up.campaign.run, null);
  assert.deepEqual(campaignProblems(up.campaign), []);
  const broken = { ...state.campaign, run: { ...state.campaign.run, at: 99 } };
  assert.deepEqual(campaignProblems(broken), ["The campaign's run is nowhere on its map."]);
  assert.deepEqual(campaignProblems({ ...readyToLaunch(), run: state.campaign.run }), ["The campaign's run has begun before launch."]);
});

test('through the game: the run begins, the ship jumps, buys and leaves the sector by actions', () => {
  let state = { ...initialState(1), screen: 'sector', campaign: launched({ credits: 30 }) };
  state = reduce(state, { type: 'campaign/run/begin', rules });
  assert.ok(state.campaign.run);
  const to = linked(state.campaign.run.sector, state.campaign.run.at)[0];
  state = reduce(state, { type: 'campaign/jump', to, rules });
  assert.equal(state.campaign.run.at, to);
  assert.equal(reduce(state, { type: 'campaign/jump', to: state.campaign.run.sector.exit, rules }), state, 'too far: nothing changes');
  const station = nodeOf(state.campaign, 'station');
  const docked = { ...state, campaign: at(state.campaign, station.id) };
  assert.equal(reduce(docked, { type: 'campaign/supplies', count: 3, rules }).campaign.credits, 30 - 3 * balance.supplyPrice);
  const exit = { ...state, campaign: at(state.campaign, state.campaign.run.sector.exit) };
  assert.equal(reduce(exit, { type: 'campaign/sector/leave', rules }).campaign.run.sector.index, 2);
  assert.equal(jumpSupplies(state.campaign, rules), 3);
});
