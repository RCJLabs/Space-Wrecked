// The test voyage's player (tools/voyagePlan.js) and the sides (M33's Done
// when): it prefers a station of a friendly side, and keeps off one of the
// pursuer's side when another way calls at another without going hungry;
// with no other way to stay fed, it docks there all the same. Each case is a
// sector of four nodes: the way in, two nodes a jump on, and the jump point
// past both, the miner's crew aboard (hostile with Con-Reg, its pursuer).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { launch } from '../src/sim/launch.js';
import { dockHeat, stationSide } from '../src/sim/standing.js';
import { beginRun } from '../src/sim/travel.js';
import { LONG_FROM, nextJump } from '../tools/voyagePlan.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

const onRun = beginRun(launch(readyToLaunch(), rules).campaign, rules).campaign;

// The sector: [upper, lower] are the nodes a jump on, each { name, type }
// (a station unless said).
function fork([upper, lower], extra = {}) {
  const node = (id, col, row, type, name) => ({ id, col, row, x: 0.1 + col * 0.4, y: 0.25 + row * 0.5, type, name });
  const nodes = [node(0, 0, 0, 'start', 'Way in'), node(1, 1, 0, upper.type ?? 'station', upper.name), node(2, 1, 1, lower.type ?? 'station', lower.name), node(3, 2, 0, 'exit', 'Jump point')];
  const sector = { ...onRun.run.sector, nodes, links: [[0, 1], [0, 2], [1, 3], [2, 3]], start: 0, exit: 3 };
  return { ...onRun, ...extra, run: { ...onRun.run, sector, at: 0, seen: [0] } };
}
const pick = (campaign, heat = 'manage') => campaign.run.sector.nodes[nextJump(campaign, rules, 'heat', { heat })].name;

test("the miner's crew sets out hostile with Con-Reg, and below the heat of the long jumps", () => {
  const campaign = fork([{ name: 'The Depot' }, { name: "Mac's Pumps" }]);
  assert.equal(campaign.background, 'miner');
  assert.equal(campaign.standing.conreg, rules.balance.pursuerStanding);
  assert.ok(campaign.heat < LONG_FROM);
  assert.deepEqual(campaign.run.sector.nodes.slice(1, 3).map((node) => stationSide(node, rules)), ['conreg', null]);
  assert.equal(dockHeat(campaign, rules, campaign.run.sector.nodes[1]), rules.balance.dockHeat);
});

test("the test player keeps off a station of the pursuer's side when another way calls at another", () => {
  assert.equal(pick(fork([{ name: 'The Depot' }, { name: "Mac's Pumps" }])), "Mac's Pumps");
  assert.equal(pick(fork([{ name: "Mac's Pumps" }, { name: 'Last Chance Supply' }])), "Mac's Pumps");
  // Ignoring heat, docking costs it nothing but the prices, and Con-Reg's
  // are half again: it still calls at the other.
  assert.equal(pick(fork([{ name: 'The Depot' }, { name: "Mac's Pumps" }]), 'ignore'), "Mac's Pumps");
});

test('the test player prefers a station of a friendly side to one of nobody', () => {
  const friendly = { standing: { ...onRun.standing, union: rules.balance.friendlyStanding } };
  assert.equal(pick(fork([{ name: "Mac's Pumps" }, { name: 'Union Hall Twelve' }], friendly)), 'Union Hall Twelve');
  assert.equal(pick(fork([{ name: 'Union Hall Twelve' }, { name: "Mac's Pumps" }], friendly)), 'Union Hall Twelve');
});

test("with no other way to stay fed, the test player docks with the pursuer's side all the same", () => {
  const low = { supplies: 3 };
  assert.equal(pick(fork([{ name: 'Empty space', type: 'empty' }, { name: 'The Depot' }], low)), 'The Depot');
  assert.equal(pick(fork([{ name: 'The Depot' }, { name: 'Empty space', type: 'empty' }], low)), 'The Depot');
});
