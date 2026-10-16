// The test voyage's player (tools/voyagePlan.js) and the sides (M33's Done
// when, and its fix): it prefers a station of a friendly side; at one of
// the pursuer's side, where the first trade logs the ship, it trades only
// where it must, to stay fed or to swap the transponder, and otherwise
// passes by, which costs nothing; so with another way calling at another
// station it calls there. Each case is a sector of four nodes: the way in,
// two nodes a jump on, and the jump point past both, the miner's crew
// aboard (hostile with Con-Reg, its pursuer).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { launch } from '../src/sim/launch.js';
import { dockHeat, stationSide } from '../src/sim/standing.js';
import { beginRun, supplyCapacity, tradeHeat } from '../src/sim/travel.js';
import { LONG_FROM, nextJump, SWAP_FROM, tradeHere } from '../tools/voyagePlan.js';
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
// The ship at the upper node, arrived there.
const atUpper = (campaign) => ({ ...campaign, run: { ...campaign.run, at: 1, seen: [0, 1], docked: false } });

test("the miner's crew sets out hostile with Con-Reg, its holds full, and below the heat of the long jumps", () => {
  const campaign = fork([{ name: 'The Depot' }, { name: "Mac's Pumps" }]);
  assert.equal(campaign.background, 'miner');
  assert.equal(campaign.standing.conreg, rules.balance.pursuerStanding);
  assert.equal(campaign.supplies, supplyCapacity(campaign.ship, rules, campaign.crew));
  assert.ok(campaign.heat < LONG_FROM);
  assert.deepEqual(campaign.run.sector.nodes.slice(1, 3).map((node) => stationSide(node, rules)), ['conreg', null]);
  assert.equal(dockHeat(campaign, rules, campaign.run.sector.nodes[1]), rules.balance.dockHeat);
});

test("at a station of the pursuer's side the test player trades only where it must: short of supplies, or to swap the transponder", () => {
  const depot = atUpper(fork([{ name: 'The Depot' }, { name: "Mac's Pumps" }], { heat: SWAP_FROM - 5 }));
  assert.equal(tradeHeat(depot, rules), rules.balance.dockHeat);
  assert.equal(tradeHere(depot, rules, 'manage'), false, 'the holds full: it passes by');
  assert.equal(tradeHere({ ...depot, supplies: 3 }, rules, 'manage'), true, 'the way on would go hungry');
  assert.equal(tradeHere({ ...depot, heat: SWAP_FROM }, rules, 'manage'), true, 'a swap sheds more than the trade adds');
  assert.equal(tradeHere(depot, rules, 'ignore'), true, 'ignoring heat, it trades as anywhere');
  assert.equal(tradeHere({ ...depot, run: { ...depot.run, docked: true } }, rules, 'manage'), true, 'logged already: trading on costs nothing more');
  const pumps = atUpper(fork([{ name: "Mac's Pumps" }, { name: 'The Depot' }]));
  assert.equal(tradeHere(pumps, rules, 'manage'), true, "nobody's station");
});

test("the test player calls at another station than the pursuer's side's when another way does", () => {
  assert.equal(pick(fork([{ name: 'The Depot' }, { name: "Mac's Pumps" }])), "Mac's Pumps");
  assert.equal(pick(fork([{ name: "Mac's Pumps" }, { name: 'Last Chance Supply' }])), "Mac's Pumps");
  // Ignoring heat, trading there costs it nothing but the prices, and
  // Con-Reg's are half again: it still calls at the other.
  assert.equal(pick(fork([{ name: 'The Depot' }, { name: "Mac's Pumps" }]), 'ignore'), "Mac's Pumps");
});

test('the test player prefers a station of a friendly side to one of nobody', () => {
  const friendly = { standing: { ...onRun.standing, union: rules.balance.friendlyStanding } };
  assert.equal(pick(fork([{ name: "Mac's Pumps" }, { name: 'Union Hall Twelve' }], friendly)), 'Union Hall Twelve');
  assert.equal(pick(fork([{ name: 'Union Hall Twelve' }, { name: "Mac's Pumps" }], friendly)), 'Union Hall Twelve');
});

test("with no other way to stay fed, the test player trades with the pursuer's side all the same", () => {
  const low = { supplies: 3 };
  assert.equal(pick(fork([{ name: 'Empty space', type: 'empty' }, { name: 'The Depot' }], low)), 'The Depot');
  assert.equal(pick(fork([{ name: 'The Depot' }, { name: 'Empty space', type: 'empty' }], low)), 'The Depot');
  assert.equal(tradeHere(atUpper(fork([{ name: 'The Depot' }, { name: 'Empty space', type: 'empty' }], { supplies: 0 })), rules, 'manage'), true);
});
