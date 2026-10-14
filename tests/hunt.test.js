// M24: heat on the run. The pursuer's hunters may wait where a jump comes
// out, by the heat the ship arrives with (hunt.js): never at a station or
// in a nebula, the chance shown before the jump and rolled as shown; a
// hostile ship where they wait slips away, and an event there waits until
// they are dealt with; facing them drops heat to heatAfterRaid. And the
// run's own levels of heat, and the save that carries it all (v18).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeSave, MIGRATIONS, parseSave, SAVE_VERSION } from '../src/core/save.js';
import { seedFrom } from '../src/core/rng.js';
import { FACED } from '../src/sim/approach.js';
import { campaignProblems, HEAT_MAX } from '../src/sim/campaign.js';
import { closeApproach, giveOrder } from '../src/sim/encounter.js';
import { RUN_LEVELS, runLevel } from '../src/sim/heat.js';
import { huntersOf, huntOdds, rollHunt } from '../src/sim/hunt.js';
import { launch } from '../src/sim/launch.js';
import { initialState, reduce, saveData } from '../src/sim/root.js';
import { beginRun, holdOf, jump, jumpPlan, leavePlan, leaveSector, linked, openEvent, reach } from '../src/sim/travel.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

const { balance } = rules;
const onRun = (extra = {}) => beginRun(launch(readyToLaunch(extra), rules).campaign, rules).campaign;
const at = (campaign, node) => ({ ...campaign, run: { ...campaign.run, at: node, seen: [...new Set([...campaign.run.seen, node])] } });
const { hunters, taskForce } = rules.backgrounds.get('miner').pursuer.run;
// A node linked to the way in that the hunters can wait at: not a station
// or a nebula.
const open = (campaign) => linked(campaign.run.sector, campaign.run.at).find((id) => !rules.nodeTypes.get(campaign.run.sector.nodes[id].type).safe && !rules.nodeTypes.get(campaign.run.sector.nodes[id].type).hides);

test("the run's levels of heat, each with the pursuer's words", () => {
  assert.deepEqual(RUN_LEVELS, ['calm', 'rumors', 'hunters', 'taskForce', 'cornered']);
  const level = (heat) => runLevel(heat, rules);
  assert.deepEqual([0, 24, 25, 49, 50, 74, 75, 99, 100].map(level), ['calm', 'calm', 'rumors', 'rumors', 'hunters', 'hunters', 'taskForce', 'taskForce', 'cornered']);
  const run = huntersOf(onRun(), rules);
  for (const key of RUN_LEVELS) assert.ok(run.levels[key].length > 0, key);
});

test('the hunters may wait where a jump comes out: none below huntHeat, then the tug, then the task force, certain at the most heat; never at a station or in a nebula', () => {
  const campaign = onRun();
  const odds = (heat, type = 'empty') => huntOdds(campaign, rules, heat, type);
  assert.deepEqual(odds(balance.huntHeat - 1), { chance: 0, ship: null, why: null });
  assert.deepEqual(odds(balance.huntHeat), { chance: balance.huntChance, ship: hunters, why: null });
  assert.deepEqual(odds(balance.raidHeat), { chance: balance.taskForceChance, ship: taskForce, why: null });
  assert.deepEqual(odds(HEAT_MAX), { chance: 100, ship: taskForce, why: null });
  assert.deepEqual(odds(HEAT_MAX, 'station'), { chance: 0, ship: null, why: 'safe' });
  assert.deepEqual(odds(HEAT_MAX, 'nebula'), { chance: 0, ship: null, why: 'hidden' });
  assert.deepEqual(odds(HEAT_MAX, 'start'), { chance: 100, ship: taskForce, why: null }, 'the way in is no refuge');
  // Their ships are the pursuer's, with tactics and a party to board with.
  for (const id of [hunters, taskForce]) assert.ok(rules.ships.get(id).tactics && rules.encounters.has(rules.ships.get(id).party), id);
});

test('a jump says the chance by the heat the ship comes out with, and rolls it as shown', () => {
  const start = onRun({ heat: balance.huntHeat - balance.jumpHeat });
  const to = open(start);
  const plan = jumpPlan(start, rules, to);
  assert.deepEqual(plan.hunt, { chance: balance.huntChance, ship: hunters, why: null });
  // Rolled with the campaign's dice: found when the roll is under the chance.
  let found = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const { campaign, hunt } = jump({ ...start, rng: seedFrom(seed) }, rules, to);
    assert.equal(hunt.chance, balance.huntChance);
    assert.equal(hunt.found, hunt.roll < hunt.chance, 'rolled as shown');
    assert.equal(Boolean(campaign.run.approach?.hunt), hunt.found);
    if (hunt.found) {
      found += 1;
      assert.equal(campaign.run.approach.enemy.ship, hunters);
      assert.equal(campaign.flags.hunts, 1);
      assert.deepEqual(campaignProblems(campaign), []);
    }
  }
  assert.ok(found > 0 && found < 30, `found in ${found} of 60`);
  // A long jump sheds heat first: from just over huntHeat, back under it,
  // with no chance where it comes out.
  const hot = onRun({ heat: balance.huntHeat + 5 });
  const [far] = [...reach(hot.run.sector, hot.run.at)].find(([, links]) => links === 2);
  const long = jumpPlan(hot, rules, far);
  assert.equal(long.kind, 'long');
  assert.deepEqual(long.hunt, { chance: 0, ship: null, why: null });
  assert.equal(jump(hot, rules, far).hunt.roll, null);
  // Cooler, no chance and no roll: the campaign's dice don't move.
  const cool = onRun({ heat: 10 });
  const done = jump(cool, rules, open(cool));
  assert.deepEqual(done.hunt, { chance: 0, ship: null, why: null, roll: null, found: false });
});

test('at the most heat they are certain, the task force, and not rolled; a station is safe even then', () => {
  const start = onRun({ heat: HEAT_MAX });
  const { campaign, hunt } = jump(start, rules, open(start));
  assert.deepEqual([hunt.chance, hunt.roll, hunt.found, hunt.ship], [100, null, true, taskForce]);
  assert.equal(campaign.run.approach.hunt, true);
  assert.equal(campaign.run.approach.enemy.name, rules.ships.get(taskForce).name);
  const station = campaign.run.sector.nodes.find((node) => node.type === 'station');
  assert.equal(huntOdds(start, rules, HEAT_MAX, station.type).chance, 0);
  // Leaving the sector comes out at the next one's way in, where they wait too.
  const exit = at({ ...start, run: { ...start.run, approach: null } }, start.run.sector.exit);
  assert.deepEqual(leavePlan(exit, rules).hunt, { chance: 100, ship: taskForce, why: null });
  const left = leaveSector(exit, rules);
  assert.ok(left.ok && left.hunt.found && left.campaign.run.approach.hunt);
  assert.equal(left.campaign.run.at, left.campaign.run.sector.start);
  assert.deepEqual(campaignProblems(left.campaign), []);
});

test('a hostile ship where they wait slips away, and an event there waits until they are dealt with', () => {
  const start = onRun({ heat: HEAT_MAX });
  const { sector } = start.run;
  // Put a hostile ship, then an event, on the node the jump goes to.
  const to = open(start);
  const withNode = (node) => ({ ...start, run: { ...start.run, sector: { ...sector, nodes: sector.nodes.map((n) => (n.id === to ? { ...n, ...node } : n)) } } });
  const hostile = jump(withNode({ type: 'hostile', hostile: { ship: 'cutter', seed: 1 } }), rules, to).campaign;
  assert.equal(hostile.run.approach.hunt, true, 'the hunters, not the cutter');
  assert.ok(hostile.run.done.includes(to), 'the cutter slipped away');
  assert.deepEqual(campaignProblems(hostile), []);
  const evented = jump(withNode({ type: 'derelict', event: 'dead-hauler' }), rules, to).campaign;
  assert.equal(evented.run.approach.hunt, true);
  assert.equal(openEvent(evented, rules), null, 'the event waits');
  assert.match(holdOf(evented, rules), /Deal with the Con-Reg gunship first/);
  // Run from, on dice that let the ship get away, and put away: the event is
  // there to decide, the node unsettled by the hunters.
  const away = [...Array(40).keys()].map((seed) => {
    let campaign = { ...evented, rng: seedFrom(seed) };
    for (let i = 0; i < 10 && !campaign.run.approach.outcome; i++) campaign = giveOrder(campaign, rules, { kind: 'flee' }).campaign;
    return campaign;
  }).find((campaign) => campaign.run.approach.outcome.kind === 'escaped');
  assert.ok(away, 'some dice let it get away');
  assert.ok(!away.run.done.includes(to), 'the hunters settle nothing');
  const after = closeApproach(away).campaign;
  assert.equal(openEvent(after, rules)?.event.id, 'dead-hauler');
  assert.deepEqual(campaignProblems(after), []);
});

test('facing them drops heat to heatAfterRaid; getting away or parting leaves it, shots and all', () => {
  const start = onRun({ heat: 80 });
  const to = open(start);
  const seen = new Set();
  for (let seed = 1; seed <= 300 && seen.size < 3; seed++) {
    let campaign = jump({ ...start, rng: seedFrom(seed) }, rules, to).campaign;
    if (!campaign.run.approach?.hunt) continue;
    const before = campaign.heat;
    const orders = [{ kind: 'flee' }, { kind: 'fire', at: 'engines' }, { kind: 'evade' }][seed % 3];
    for (let i = 0; i < 10 && !campaign.run.approach.outcome; i++) {
      const given = giveOrder(campaign, rules, orders);
      campaign = given.ok ? given.campaign : giveOrder(campaign, rules, { kind: 'evade' }).campaign;
    }
    const { outcome, fired } = campaign.run.approach;
    const faced = FACED.includes(outcome.kind);
    seen.add(faced ? 'faced' : outcome.kind);
    if (faced) assert.equal(campaign.heat, balance.heatAfterRaid, `${outcome.kind}: heat ${campaign.heat}`);
    else assert.equal(campaign.heat, Math.min(HEAT_MAX, before + (fired ? balance.approachHeat : 0)), outcome.kind);
    assert.equal(outcome.changes.heat, campaign.heat - before);
    assert.equal(campaign.flags.huntsFaced ?? 0, faced ? 1 : 0);
    assert.deepEqual(campaignProblems(campaign), []);
  }
  assert.ok(seen.has('faced') && (seen.has('escaped') || seen.has('parted')), `outcomes: ${[...seen]}`);
});

test('the ship regroups or jumps, and the hunters coming changes the screen', () => {
  const start = onRun({ heat: HEAT_MAX });
  const state = { ...initialState(1), campaign: start, screen: 'sector' };
  const jumped = reduce(state, { type: 'campaign/jump', to: open(start), rules });
  assert.equal(jumped.screen, 'approach');
  const exit = { ...state, campaign: at(start, start.run.sector.exit) };
  assert.equal(reduce(exit, { type: 'campaign/sector/leave', rules }).screen, 'approach');
});

test('a v17 save carries on: its run has swapped nothing in its sector, and an approach under way is a hostile ship\'s', () => {
  const run = onRun();
  const { swapped, ...v17run } = run.run;
  const step = MIGRATIONS.find((s) => s.from === 17);
  const up = step.up({ ...saveData(initialState(3)), campaign: { ...run, run: v17run } });
  assert.equal(up.campaign.run.swapped, false);
  assert.equal(up.campaign.run.approach, null);
  // An approach under way in a v17 save: a hostile ship's, met at a node.
  const to = linked(run.run.sector, run.run.at)[0];
  const sector = { ...run.run.sector, nodes: run.run.sector.nodes.map((n) => (n.id === to ? { ...n, type: 'hostile', hostile: { ship: 'cutter', seed: 1 } } : n)) };
  const met = jump({ ...run, heat: 10, run: { ...run.run, sector } }, rules, to).campaign;
  const { hunt, ...oldApproach } = met.run.approach;
  assert.equal(hunt, false);
  const { swapped: _, ...oldRun } = met.run;
  const upped = step.up({ ...saveData(initialState(3)), campaign: { ...met, run: { ...oldRun, approach: oldApproach } } });
  assert.equal(upped.campaign.run.approach.hunt, false);
  assert.deepEqual(campaignProblems(upped.campaign), []);
  // Through the front door: a v17 save opens at v18.
  const text = JSON.stringify({ version: 17, data: { ...saveData(initialState(3)), campaign: { ...run, run: v17run } } });
  const opened = parseSave(text);
  assert.equal(opened.ok, true, opened.error);
  assert.equal(opened.save.version, SAVE_VERSION);
  assert.equal(SAVE_VERSION, 18);
  // A run that can't say whether it swapped is caught.
  assert.match(campaignProblems({ ...run, run: v17run }).join(' '), /transponder/);
  assert.deepEqual(JSON.parse(JSON.stringify(makeSave(saveData({ ...initialState(1), campaign: run })))).data.campaign.run.swapped, false);
});
