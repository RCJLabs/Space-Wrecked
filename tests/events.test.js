import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeSave, MIGRATIONS, parseSave } from '../src/core/save.js';
import { seedFrom } from '../src/core/rng.js';
import { campaignProblems } from '../src/sim/campaign.js';
import { sellPriceOf } from '../src/sim/economy.js';
import { applyEffects, chooseEvent, choiceProblem, outcomeFor } from '../src/sim/events.js';
import { launch } from '../src/sim/launch.js';
import { initialState, reduce, saveData } from '../src/sim/root.js';
import { beginRun, jump, jumpPlan, knownNodes, leavePlan, linked, openEvent, scan, scanPlan, within } from '../src/sim/travel.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

const { balance } = rules;
const onRun = (extra = {}) => beginRun(launch(readyToLaunch(extra), rules).campaign, rules).campaign;
// The campaign with the ship moved to node `id` (no jump), its kind and
// event set as given.
function placed(campaign, id, { type, event } = {}) {
  const nodes = campaign.run.sector.nodes.map((node) => (node.id === id && type ? { ...node, type, ...(event ? { event } : {}) } : node));
  const run = { ...campaign.run, sector: { ...campaign.run.sector, nodes }, at: id, seen: [...new Set([...campaign.run.seen, id])] };
  return { ...campaign, run };
}
// A campaign at node `id` with event `eventId` open there.
function atEvent(eventId, extra = {}, id = 1) {
  return placed(onRun(extra), id, { type: rules.events.get(eventId).kind, event: eventId });
}

test('an event opens where the ship gets to, and holds jumps, scans and leaving until it is settled', () => {
  const fresh = onRun();
  const { sector } = fresh.run;
  // The first node on: a hazard, its event the ion storm; no other node
  // holds one.
  const to = linked(sector, sector.start)[0];
  const nodes = sector.nodes.map(({ event, ...node }) => (node.id === to ? { ...node, type: 'hazard', event: 'ion-storm' } : node));
  const campaign = { ...fresh, run: { ...fresh.run, sector: { ...sector, nodes } } };
  assert.equal(openEvent(campaign, rules), null, 'nothing open at the way in');
  const there = jump(campaign, rules, to).campaign;
  const open = openEvent(there, rules);
  assert.ok(open, 'the event is open');
  assert.equal(open.node.id, to);
  const title = open.event.title;
  const next = linked(there.run.sector, to).find((id) => id !== sector.start);
  assert.match(jumpPlan(there, rules, next).error, new RegExp(`Decide first: ${title}`));
  assert.match(scanPlan(there, rules).error ?? '', new RegExp(`Decide first: ${title}`));
  const exit = { ...there, run: { ...there.run, sector: { ...there.run.sector, exit: to } } };
  assert.match(leavePlan(exit, rules).error, /Decide first/);
  const last = open.event.choices.at(-1);
  const settled = chooseEvent(there, rules, last.id);
  assert.ok(settled.ok, settled.error);
  assert.equal(openEvent(settled.campaign, rules), null);
  assert.deepEqual(settled.campaign.run.done, [to]);
  assert.equal(settled.campaign.run.result.node, to);
  assert.equal(settled.campaign.flags.events, 1);
  assert.ok(jumpPlan(settled.campaign, rules, next).ok, 'then the ship can jump on');
  assert.equal(chooseEvent(settled.campaign, rules, last.id).ok, false, 'once');
  assert.deepEqual(campaignProblems(settled.campaign), []);
  const on = jump(settled.campaign, rules, next).campaign;
  assert.equal(on.run.result, null, 'the result goes with the next jump');
  assert.deepEqual(on.run.done, [to], 'the event stays settled');
  const back = jump(on, rules, to);
  assert.ok(back.ok, back.error);
  assert.equal(openEvent(back.campaign, rules), null, 'and coming back, it does not open again');
});

test('the outcome is the one the roll falls in, so the odds shown are the odds rolled', () => {
  const outcomes = [{ chance: 70 }, { chance: 30 }];
  assert.deepEqual([0, 69, 70, 99].map((roll) => outcomeFor(outcomes, roll)), [0, 0, 1, 1]);
  assert.deepEqual([0, 49, 50, 99].map((roll) => outcomeFor([{ chance: 50 }, { chance: 50 }], roll)), [0, 0, 1, 1]);
  const at = atEvent('dead-hauler');
  let first = 0;
  const RUNS = 2000;
  for (let i = 0; i < RUNS; i++) {
    const { result } = chooseEvent({ ...at, rng: seedFrom(i) }, rules, 'strip');
    assert.equal(result.outcome, outcomeFor(rules.events.get('dead-hauler').choices[0].outcomes, result.roll));
    if (result.outcome === 0) first++;
  }
  assert.ok(Math.abs(first / RUNS - 0.7) < 0.03, `70% shown, ${(100 * first) / RUNS}% rolled`);
  const sure = chooseEvent(at, rules, 'loose');
  assert.equal(sure.result.roll, null, 'one outcome: no roll');
  assert.equal(sure.campaign.rng, at.rng, 'and the RNG is not touched');
  assert.deepEqual(chooseEvent(at, rules, 'strip').campaign, chooseEvent(at, rules, 'strip').campaign, 'the same campaign, the same roll');
});

test('effects: credits, supplies up to the holds, heat within its bounds, wounds that never take the last hit point', () => {
  const base = { ...onRun({ credits: 50, heat: 98 }), supplies: 20 };
  const { campaign: paid, changes } = applyEffects(base, rules, { credits: -60, supplies: 10, heat: 5 });
  assert.deepEqual([paid.credits, paid.supplies, paid.heat], [0, balance.baseSupplies, 100]);
  assert.deepEqual([changes.credits, changes.supplies, changes.heat], [-50, balance.baseSupplies - 20, 2]);
  const crew = base.crew.map((member, i) => ({ ...member, hp: [10, 2, 1][i] }));
  const all = applyEffects({ ...base, crew }, rules, { wound: { hp: 3, all: true } });
  assert.deepEqual(all.campaign.crew.map((m) => m.hp), [7, 1, 1]);
  assert.deepEqual(all.changes.wounds, [{ id: crew[0].id, hp: 3 }, { id: crew[1].id, hp: 1 }], 'the one at 1 is spared');
  const one = applyEffects({ ...base, crew }, rules, { wound: { hp: 3 } });
  assert.equal(one.changes.wounds.length, 1);
  assert.ok(crew.slice(0, 2).some((m) => m.id === one.changes.wounds[0].id), 'one of those with more than 1');
  assert.notEqual(one.campaign.rng, base.rng, 'picked by a roll');
  const nobody = applyEffects({ ...base, crew: crew.map((m) => ({ ...m, hp: 1 })) }, rules, { wound: { hp: 3 } });
  assert.deepEqual(nobody.changes.wounds, [], 'nobody left to hurt');
});

test('effects: parts given, parts from a drop table, and the dearest part on hand sold first', () => {
  const base = { ...onRun(), parts: {} };
  const given = applyEffects(base, rules, { part: 'shield' });
  assert.deepEqual(given.campaign.parts, { shield: 1 });
  const seen = new Set();
  for (let i = 0; i < 400; i++) seen.add(applyEffects({ ...base, rng: seedFrom(i) }, rules, { drop: 'salvage' }).changes.parts[0]);
  assert.deepEqual([...seen].sort(), Object.keys(rules.eventDrops.salvage).sort(), 'every part in the table comes up');
  const held = { ...base, credits: 10, parts: { corridor: 2, engine: 1 } };
  const sold = applyEffects(held, rules, { sell: 2 });
  assert.deepEqual(sold.changes.sold, [{ part: 'engine', credits: sellPriceOf('engine', rules) }, { part: 'corridor', credits: sellPriceOf('corridor', rules) }]);
  assert.deepEqual(sold.campaign.parts, { corridor: 1 });
  assert.equal(sold.campaign.credits, 10 + sellPriceOf('engine', rules) + sellPriceOf('corridor', rules));
  assert.deepEqual(applyEffects({ ...base, parts: {} }, rules, { sell: 1 }).changes.sold, [], 'nothing to sell');
});

test('a choice needing credits, supplies or a part can only be made with them', () => {
  const at = atEvent('stalled-miner');
  const tow = rules.events.get('stalled-miner').choices.find((c) => c.id === 'tow');
  assert.equal(choiceProblem({ ...at, supplies: 2 }, tow), 'Needs 3 supplies.');
  assert.equal(chooseEvent({ ...at, supplies: 2 }, rules, 'tow').error, 'Needs 3 supplies.');
  const dealer = atEvent('scrap-dealer');
  assert.equal(chooseEvent({ ...dealer, parts: {} }, rules, 'sell').error, 'Needs a part on hand.');
  assert.equal(chooseEvent({ ...dealer, credits: 4 }, rules, 'buy').error, 'Needs 5 credits.');
  assert.equal(chooseEvent(dealer, rules, 'nope').error, 'There is no such choice.');
  assert.equal(chooseEvent(onRun(), rules, 'leave').error, 'There is nothing to decide here.');
});

test('every choice of every event plays, and leaves a campaign that saves', () => {
  for (const event of rules.events.values()) {
    for (const choice of event.choices) {
      for (const seed of [1, 2, 3, 4]) {
        const at = { ...atEvent(event.id, { credits: 60 }), parts: { corridor: 1 }, rng: seedFrom(seed) };
        const made = chooseEvent(at, rules, choice.id);
        assert.ok(made.ok, `${event.id} ${choice.id}: ${made.error}`);
        assert.deepEqual(campaignProblems(made.campaign), [], `${event.id} ${choice.id}`);
        const loaded = parseSave(JSON.stringify(makeSave(saveData({ ...initialState(3), campaign: made.campaign }))));
        assert.ok(loaded.ok, loaded.error);
      }
    }
  }
});

test('what a node holds is known on the charts, next to where the ship has been, or within a scan', () => {
  const campaign = onRun({ heat: 30 });
  const { sector } = campaign.run;
  const known = knownNodes(campaign.run, rules);
  for (const node of sector.nodes) {
    const charted = ['start', 'exit', 'station', 'nebula'].includes(node.type);
    const near = node.id === sector.start || linked(sector, sector.start).includes(node.id);
    assert.equal(known.has(node.id), charted || near, `node ${node.id} (${node.type})`);
  }
  const plan = scanPlan(campaign, rules);
  const reach = within(sector, sector.start, balance.scanRange);
  assert.deepEqual(plan, { ok: true, heat: balance.scanHeat, reach: balance.scanRange, reveals: [...reach.keys()].filter((id) => !known.has(id)) });
  const scanned = scan(campaign, rules).campaign;
  assert.equal(scanned.heat, 30 + balance.scanHeat);
  assert.deepEqual(scanned.run.scans, [{ at: sector.start, reach: balance.scanRange }]);
  assert.equal(scanned.flags.scans, 1);
  for (const id of reach.keys()) assert.ok(knownNodes(scanned.run, rules).has(id));
  assert.match(scanPlan(scanned, rules).error, /Everything a scan would reach is known/);
  assert.deepEqual(campaignProblems(scanned), []);
  assert.equal(scanPlan(launch(readyToLaunch(), rules).campaign, rules).ok, false, 'before the run begins');
});

test('a v10 save keeps its run, with nothing settled, scanned or shown; a broken run is caught', () => {
  const run = onRun();
  const { done, scans, result, ...v10run } = run.run;
  const up = MIGRATIONS.find((step) => step.from === 10).up({ ...saveData(initialState(3)), campaign: { ...run, run: v10run } });
  assert.deepEqual(up.campaign.run, run.run);
  assert.equal(MIGRATIONS.find((step) => step.from === 10).up({ ...saveData(initialState(3)), campaign: { ...run, run: null } }).campaign.run, null);
  const at = atEvent('dead-hauler');
  const made = chooseEvent(at, rules, 'loose').campaign;
  const problem = (change) => campaignProblems({ ...made, run: { ...made.run, ...change } });
  assert.deepEqual(problem({ done: [made.run.sector.start] }), ["The campaign's run has unreadable events done."]);
  assert.deepEqual(problem({ scans: [99] }), ["The campaign's run has unreadable scans."]);
  assert.deepEqual(problem({ result: { ...made.run.result, outcome: 'first' } }), ["The campaign's run has an unreadable last event."]);
  assert.deepEqual(problem({ result: { ...made.run.result, event: 'gutted-tug' } }), ["The campaign's run has an unreadable last event."]);
  const badNode = { ...made.run.sector, nodes: made.run.sector.nodes.map((n, i) => (i === 1 ? { ...n, event: 'Bad Id' } : n)) };
  assert.deepEqual(problem({ sector: badNode }), ["The campaign's run has an unreadable map."]);
});

test('through the game: a choice and a scan by actions', () => {
  let state = { ...initialState(1), screen: 'sector', campaign: atEvent('ration-barge', { credits: 30 }) };
  state = reduce(state, { type: 'campaign/event/choose', choice: 'six', rules });
  assert.equal(state.campaign.credits, 26);
  assert.equal(state.campaign.supplies, balance.baseSupplies, 'the holds were full: the six go spare');
  assert.equal(reduce(state, { type: 'campaign/event/choose', choice: 'six', rules }), state, 'settled: nothing changes');
  const fresh = { ...initialState(1), screen: 'sector', campaign: onRun() };
  assert.equal(reduce(fresh, { type: 'campaign/scan', rules }).campaign.flags.scans, 1, 'a scan from the way in');
});
