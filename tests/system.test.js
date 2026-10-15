// M25: the system past the charts. Jump on from the act's last sector's
// jump point reaches it: its way in and its worlds, each of a kind of its
// own, with act 3's numbers rolled within its kind's ranges. A day's survey
// from orbit shows a world's numbers, for a jump's supplies and surveyHeat,
// with the hunters' roll; Settle here ends act 2, the world saved with the
// campaign for the colony.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { int } from '../src/core/rng.js';
import { makeSave, MIGRATIONS, parseSave, SAVE_VERSION } from '../src/core/save.js';
import { campaignProblems, COLONY_ACT, HEAT_MAX } from '../src/sim/campaign.js';
import { generateSystem, LANES, RATINGS } from '../src/sim/gen/system.js';
import { launch } from '../src/sim/launch.js';
import { campaignScreen, initialState, reduce, saveData } from '../src/sim/root.js';
import { settle, settlePlan } from '../src/sim/settle.js';
import { survey, surveyPlan } from '../src/sim/survey.js';
import { beginRun, jump, jumpPlan, jumpSupplies, knownNodes, leavePlan, leaveSector, scanPlan } from '../src/sim/travel.js';
import { GOLDEN_SYSTEMS, systemsText } from '../tools/sectors.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

const { balance } = rules;
const spec = rules.worlds;
const SECTORS = rules.acts.get(2).sectors;
const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1);
const onRun = (extra = {}) => beginRun(launch(readyToLaunch(extra), rules).campaign, rules).campaign;
// The ship at the act's last sector's jump point, for the tests: no jumps.
function atLastExit(extra = {}) {
  const campaign = onRun(extra);
  const { sector, seen } = campaign.run;
  const past = rules.sectors.names.sectors.filter((name) => name !== sector.name).slice(0, SECTORS - 1);
  return { ...campaign, run: { ...campaign.run, sector: { ...sector, index: SECTORS }, at: sector.exit, seen: [...seen, sector.exit], past } };
}
// The ship in the system, at its way in.
const inSystem = (extra = {}) => leaveSector(atLastExit(extra), rules).campaign;
// The ship moved to node `id`, for the tests: no jump.
const at = (campaign, id) => ({ ...campaign, run: { ...campaign.run, at: id, seen: [...new Set([...campaign.run.seen, id])] } });

test('a system: its way in and its worlds, each of a kind of its own, with numbers in its kind\'s ranges', () => {
  const seen = new Map([...spec.kinds.keys()].map((kind) => [kind, Object.fromEntries([...RATINGS, 'lanes'].map((rating) => [rating, new Set()]))]));
  for (const seed of SEEDS) {
    const system = generateSystem(rules, seed, SECTORS + 1);
    const [way, ...worlds] = system.nodes;
    assert.deepEqual([system.index, system.system, system.start, system.exit], [SECTORS + 1, true, 0, null], `seed ${seed}`);
    assert.ok(spec.names.systems.includes(system.name), `seed ${seed}: ${system.name}`);
    assert.deepEqual([way.type, way.col, way.world], ['start', 0, undefined]);
    assert.equal(worlds.length, spec.system.worlds, `seed ${seed}`);
    assert.equal(new Set(worlds.map((node) => node.world.kind)).size, worlds.length, `seed ${seed}: no kind twice`);
    assert.equal(new Set(worlds.map((node) => node.name)).size, worlds.length, `seed ${seed}: no name twice`);
    worlds.forEach((node, row) => {
      assert.deepEqual([node.type, node.col, node.row], ['world', 1, row]);
      assert.ok(spec.names.worlds.includes(node.name), node.name);
      const kind = spec.kinds.get(node.world.kind);
      assert.deepEqual(Object.keys(node.world), ['kind', ...RATINGS, 'lanes']);
      for (const rating of RATINGS) {
        const value = node.world[rating];
        assert.ok(value >= kind[rating][0] && value <= kind[rating][1], `seed ${seed}: ${node.name}'s ${rating} ${value}`);
        seen.get(kind.id)[rating].add(value);
      }
      assert.ok(node.world.lanes >= 1 && node.world.lanes <= LANES);
      seen.get(kind.id).lanes.add(node.world.lanes);
      assert.ok(node.x > way.x && node.x < 1 && node.y > 0 && node.y < 1);
      if (row) assert.ok(node.y > worlds[row - 1].y, `seed ${seed}: the worlds stand top down`);
    });
    system.nodes.forEach((node, id) => assert.equal(node.id, id));
    // The way in links to every world, and each world to the one beside it.
    assert.deepEqual(system.links, [[0, 1], [0, 2], [0, 3], [1, 2], [2, 3]]);
  }
  // Over the seeds every kind turns up, with every number in its ranges.
  for (const [id, values] of seen) {
    const kind = spec.kinds.get(id);
    for (const rating of RATINGS) assert.equal(values[rating].size, kind[rating][1] - kind[rating][0] + 1, `${id} ${rating}`);
    assert.equal(values.lanes.size, LANES, `${id} lanes`);
  }
});

test('the same seed gives the same system, and fixed seeds give the golden systems', () => {
  assert.deepEqual(generateSystem(rules, 7, 6), generateSystem(rules, 7, 6));
  assert.notDeepEqual(generateSystem(rules, 1, 6), generateSystem(rules, 2, 6));
  // To change them on purpose: node tools/sectors.js --golden, and say so in
  // PROGRESS.md.
  assert.equal(`${systemsText(rules)}\n`, readFileSync(GOLDEN_SYSTEMS, 'utf8'));
});

test("Jump on from the act's last jump point reaches the system, rolled from the campaign's RNG; nothing past it is charted", () => {
  const exit = atLastExit({ heat: 10 });
  assert.deepEqual(campaignProblems(exit), []);
  const plan = leavePlan(exit, rules);
  assert.deepEqual(plan, { ok: true, kind: 'system', supplies: 3, left: 0, heat: balance.jumpHeat, hungry: false, heal: 0, hunt: { chance: 0, ship: null, why: null } });
  const { campaign } = leaveSector(exit, rules);
  const { run } = campaign;
  assert.deepEqual(run.sector, generateSystem(rules, int(exit.rng, 0, 0xffffffff).value, SECTORS + 1));
  assert.equal(run.at, run.sector.start);
  assert.deepEqual(run.seen, [run.sector.start]);
  assert.deepEqual(run.past, [...exit.run.past, exit.run.sector.name]);
  assert.deepEqual(run.surveyed, []);
  assert.equal(campaign.supplies, exit.supplies - 3);
  assert.equal(campaign.heat, 10 + balance.jumpHeat);
  assert.equal(campaign.flags.jumps, (exit.flags.jumps ?? 0) + 1);
  assert.deepEqual(campaignProblems(campaign), []);
  assert.deepEqual(leaveSector(exit, rules).campaign, campaign, 'the same campaign, the same system');
  // There is no jump point in the system: the run ends at one of its worlds.
  const there = leavePlan(campaign, rules);
  assert.deepEqual([there.ok, there.last], [false, true]);
  assert.match(there.error, /Nothing past the system is charted: settle one of its worlds/);
  assert.equal(leaveSector(campaign, rules).ok, false);
  // The hunters may wait at its way in, as at any sector's.
  const hot = { ...exit, heat: HEAT_MAX };
  assert.equal(leavePlan(hot, rules).hunt.chance, 100);
  const met = leaveSector(hot, rules);
  assert.equal(met.hunt.found, true);
  assert.equal(met.campaign.run.sector.system, true);
  assert.equal(met.campaign.run.approach.hunt, true);
  assert.deepEqual(campaignProblems(met.campaign), []);
});

test('the worlds are known from afar, and jumps go between them as on any map', () => {
  const campaign = inSystem();
  const known = knownNodes(campaign.run, rules);
  for (const node of campaign.run.sector.nodes) assert.ok(known.has(node.id), node.name);
  assert.equal(scanPlan(campaign, rules).ok, false, 'nothing for a scan to show');
  for (const id of [1, 2, 3]) assert.equal(jumpPlan(campaign, rules, id).kind, 'jump', `the way in to world ${id}`);
  const top = jump(campaign, rules, 1).campaign;
  assert.equal(top.run.at, 1);
  assert.equal(jumpPlan(top, rules, 2).kind, 'jump');
  assert.equal(jumpPlan(top, rules, 3).kind, 'long');
  assert.deepEqual(campaignProblems(top), []);
});

test("a survey: a jump's supplies and surveyHeat for a world's numbers, once a world", () => {
  const campaign = at(inSystem({ heat: 10 }), 2);
  const plan = surveyPlan(campaign, rules);
  assert.deepEqual(plan, { ok: true, supplies: jumpSupplies(campaign, rules), heat: balance.surveyHeat, hunt: { chance: 0, ship: null, why: null } });
  const { campaign: after, hunt } = survey(campaign, rules);
  assert.equal(after.supplies, campaign.supplies - plan.supplies);
  assert.equal(after.heat, campaign.heat + balance.surveyHeat);
  assert.deepEqual(after.run.surveyed, [2]);
  assert.equal(after.flags.surveys, 1);
  assert.deepEqual(hunt, { chance: 0, ship: null, why: null, roll: null, found: false });
  assert.deepEqual(campaignProblems(after), []);
  assert.match(surveyPlan(after, rules).error, new RegExp(`${campaign.run.sector.nodes[2].name} has been surveyed`));
  // Each world is surveyed on its own.
  assert.deepEqual(survey(at(after, 3), rules).campaign.run.surveyed, [2, 3]);
  // By action, on the map.
  const state = reduce({ ...initialState(1), campaign, screen: 'sector' }, { type: 'campaign/survey', rules });
  assert.equal(state.screen, 'sector');
  assert.deepEqual(state.campaign, after);
});

test('surveying hot: the hunters may find the ship in orbit, and at the most heat they do', () => {
  const campaign = { ...at(inSystem(), 1), heat: HEAT_MAX };
  const plan = surveyPlan(campaign, rules);
  assert.equal(plan.hunt.chance, 100);
  assert.equal(plan.heat, 0, 'heat is at its most already');
  const { campaign: after, hunt } = survey(campaign, rules);
  assert.equal(hunt.found, true);
  assert.equal(after.run.approach.hunt, true);
  assert.deepEqual(after.run.surveyed, [1], 'the survey is made all the same');
  assert.deepEqual(campaignProblems(after), []);
  assert.equal(reduce({ ...initialState(1), campaign, screen: 'sector' }, { type: 'campaign/survey', rules }).screen, 'approach');
  // Held by the hunters: no survey and no settling until they are dealt with.
  assert.match(surveyPlan(after, rules).error, /^Deal with the .+ first\.$/);
  assert.match(settlePlan(after, rules).error, /^Deal with the .+ first\.$/);
});

test('no survey away from a world, off the run or short of supplies', () => {
  assert.match(surveyPlan(inSystem(), rules).error, /There is no world here to survey/);
  assert.match(surveyPlan(onRun(), rules).error, /There is no world here to survey/);
  assert.match(surveyPlan(readyToLaunch(), rules).error, /on the run/);
  assert.match(surveyPlan({ ...at(inSystem(), 1), supplies: 2 }, rules).error, /A day's survey eats 3 supplies, and the holds have 2/);
});

test('Settle here: act 2 ends, surveyed or not, and the world goes with the campaign into act 3', () => {
  const campaign = at(inSystem({ heat: 30, credits: 120 }), 2);
  const node = campaign.run.sector.nodes[2];
  const plan = settlePlan(campaign, rules);
  assert.deepEqual(plan, { ok: true, world: { name: node.name, ...node.world, surveyed: false } });
  const { campaign: after } = settle(campaign, rules);
  assert.deepEqual([after.act, after.place], [COLONY_ACT, 'hub']);
  assert.deepEqual(after.colony, { world: plan.world, buildings: [], nextUid: 1, day: 1, materials: rules.colony.materials });
  assert.equal(after.flags.settled, 1);
  // The ship, crew, credits, parts on hand and heat go with it; the run
  // stays as it ended, for the act's record.
  for (const key of ['ship', 'crew', 'captain', 'credits', 'parts', 'heat', 'supplies', 'wrecks', 'run', 'rng', 'background']) assert.deepEqual(after[key], campaign[key], key);
  assert.deepEqual(campaignProblems(after), []);
  assert.equal(campaignScreen(after), 'colony');
  // Surveyed first, the colony says so.
  assert.equal(settle(survey(campaign, rules).campaign, rules).campaign.colony.world.surveyed, true);
  // Settled, the run is over: no more jumps, surveys or settling.
  assert.match(settlePlan(after, rules).error, /on the run/);
  assert.match(surveyPlan(after, rules).error, /on the run/);
  assert.equal(jumpPlan(after, rules, 1).ok, false);
});

test('no settling away from a world or off the run', () => {
  assert.match(settlePlan(inSystem(), rules).error, /There is no world here to settle/);
  assert.match(settlePlan(onRun(), rules).error, /There is no world here to settle/);
  assert.match(settlePlan(readyToLaunch(), rules).error, /on the run/);
});

test('through the game: Settle here plays the landing, and Continue on the title comes back to the colony', () => {
  let state = { ...initialState(1), screen: 'sector', campaign: at(inSystem(), 3) };
  state = reduce(state, { type: 'campaign/settle', rules });
  assert.equal(state.screen, 'landing');
  assert.equal(state.campaign.act, COLONY_ACT);
  assert.equal(reduce(state, { type: 'campaign/settle', rules }), state, 'settled once');
  assert.equal(reduce({ ...state, screen: 'title' }, { type: 'campaign/continue' }).screen, 'colony');
});

test('a v18 save carries on where it was, and one at the last jump point jumps on into the system', () => {
  const exit = atLastExit({ heat: 10 });
  const { surveyed, ...v18run } = exit.run;
  const { colony, ...v18 } = exit;
  assert.deepEqual([surveyed, colony], [[], null]);
  const step = MIGRATIONS.find((s) => s.from === 18);
  const old = (campaign) => ({ ...saveData(initialState(3)), campaign });
  assert.deepEqual(step.up(old({ ...v18, run: v18run })).campaign, exit);
  // In act 1, with no run yet, and with no campaign at all.
  const { colony: _, ...hangar } = readyToLaunch();
  assert.deepEqual(step.up(old(hangar)).campaign, readyToLaunch());
  assert.equal(step.up(old(null)).campaign, null);
  // Through the front door, and on into the system.
  const opened = parseSave(JSON.stringify({ version: 18, data: old({ ...v18, run: v18run }) }));
  assert.equal(opened.ok, true, opened.error);
  assert.equal(opened.save.version, SAVE_VERSION);
  assert.ok(SAVE_VERSION >= 19);
  const on = leaveSector(opened.save.data.campaign, rules).campaign;
  assert.equal(on.run.sector.system, true);
  assert.deepEqual(campaignProblems(on), []);
});

test('a settled campaign saves and reads back the same; a colony out of step or unreadable is caught', () => {
  const settled = settle(at(inSystem(), 2), rules).campaign;
  const loaded = parseSave(JSON.stringify(makeSave(saveData({ ...initialState(3), campaign: settled }))));
  assert.equal(loaded.ok, true, loaded.error);
  assert.deepEqual(loaded.save.data.campaign, settled);
  const world = settled.colony.world;
  const out = ["The campaign's colony doesn't match the act."];
  assert.deepEqual(campaignProblems({ ...settled, colony: null }), out);
  assert.deepEqual(campaignProblems({ ...inSystem(), colony: settled.colony }), out);
  const unreadable = ["The campaign's colony is unreadable."];
  for (const bad of [{ soil: 4 }, { lanes: 0 }, { kind: 'Ocean' }, { name: '' }, { name: 'x'.repeat(25) }, { surveyed: 'yes' }]) {
    assert.deepEqual(campaignProblems({ ...settled, colony: { world: { ...world, ...bad } } }), unreadable, JSON.stringify(bad));
  }
  assert.deepEqual(campaignProblems({ ...settled, colony: {} }), unreadable);
});

test('a broken system or survey list is caught', () => {
  const campaign = at(inSystem(), 1);
  const { run } = campaign;
  const problems = (change) => campaignProblems({ ...campaign, run: { ...run, ...change } });
  const surveys = ["The campaign's run has unreadable surveys."];
  assert.deepEqual(problems({ surveyed: [0] }), surveys, 'the way in is no world');
  assert.deepEqual(problems({ surveyed: [2] }), surveys, 'a world not been to');
  assert.deepEqual(problems({ surveyed: [1, 1] }), surveys);
  assert.deepEqual(problems({ surveyed: null }), surveys);
  assert.deepEqual(problems({ sector: { ...run.sector, exit: 3 } }), ["The campaign's run has no way in or no jump point."]);
  assert.deepEqual(problems({ sector: { ...run.sector, system: false } }), ["The campaign's run has an unreadable sector."]);
  const nodes = (change) => run.sector.nodes.map((node) => (node.id === 1 ? { ...node, world: { ...node.world, ...change } } : node));
  assert.deepEqual(problems({ sector: { ...run.sector, nodes: nodes({ ore: 9 }) } }), ["The campaign's run has an unreadable map."]);
  assert.deepEqual(problems({ sector: { ...run.sector, nodes: nodes({ lanes: 4 }) } }), ["The campaign's run has an unreadable map."]);
  // A world belongs in the system only.
  const sector = onRun();
  const world = run.sector.nodes[1].world;
  const withWorld = sector.run.sector.nodes.map((node) => (node.id === 1 ? { ...node, world } : node));
  assert.deepEqual(campaignProblems({ ...sector, run: { ...sector.run, sector: { ...sector.run.sector, nodes: withWorld } } }), ["The campaign's run has an unreadable map."]);
});
