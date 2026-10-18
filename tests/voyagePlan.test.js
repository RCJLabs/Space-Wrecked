// The test voyage's player (tools/voyagePlan.js) and the sides (M33's Done
// when, and its fix): it prefers a station of a friendly side; at one of
// the pursuer's side, where the first trade logs the ship, it trades only
// where it must, to stay fed or to swap the transponder, and otherwise
// passes by, which costs nothing; so with another way calling at another
// station it calls there. And its work at stations (M38c): the job worth
// most, with a full squad of the fit, and managing heat, only where the
// job's heat and the next jump's keep the ship under the hunters'. Each
// case is a sector of four nodes: the way in, two nodes a jump on, and the
// jump point past both, the miner's crew aboard (hostile with Con-Reg, its
// pursuer).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { launch } from '../src/sim/launch.js';
import { dockHeat, stationSide } from '../src/sim/standing.js';
import { jobHeat } from '../src/sim/heat.js';
import { stationBoard } from '../src/sim/stationJobs.js';
import { beginRun, supplyCapacity, tradeHeat } from '../src/sim/travel.js';
import { FIT_SHARE, LONG_FROM, nextJump, stationJobPick, SWAP_FROM, tradeHere, tripSquad } from '../tools/voyagePlan.js';
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

// M38c: the ship at the upper node on its visit after `jumps` jumps, each
// visit's board rolled afresh; and those of the first ten visits on which
// the test player takes a job there at `heat`.
const onVisit = (campaign, jumps) => ({ ...campaign, flags: { ...campaign.flags, jumps } });
const worked = (campaign, policy = 'manage') =>
  [...Array(10).keys()].map((jumps) => onVisit(campaign, jumps)).flatMap((visit) => {
    const pick = stationJobPick(visit, rules, policy);
    return pick ? [{ visit, pick }] : [];
  });

test('at a station the test player takes a job off its board with a full squad of the fit, and none with anyone going short of it, nor anywhere else (M38c)', () => {
  const pumps = atUpper(fork([{ name: "Mac's Pumps" }, { name: 'The Depot' }], { heat: 20 }));
  const taken = worked(pumps);
  assert.ok(taken.length >= 3, `work worth taking on ${taken.length} of 10 visits`);
  for (const { visit, pick } of taken) {
    assert.deepEqual(stationBoard(visit, rules)[pick.index], pick.job, 'a job on the board, by its place there');
    assert.deepEqual(pick.squad, tripSquad(visit, rules));
    assert.equal(pick.squad.length, Math.min(rules.balance.squadSize, visit.crew.length), 'a full squad');
    assert.ok(pick.worth > 0);
  }
  const [{ visit }] = taken;
  const hurt = { ...visit, crew: visit.crew.map((member, i) => (i === 0 ? { ...member, hp: Math.ceil(FIT_SHARE * member.hp) - 1 } : member)) };
  assert.equal(stationJobPick(hurt, rules), null, 'one of three short of FIT_SHARE');
  assert.equal(stationJobPick({ ...visit, run: { ...visit.run, at: 0 } }, rules), null, 'at the way in');
  assert.equal(stationJobPick(onVisit(atUpper(fork([{ name: 'Empty space', type: 'empty' }, { name: 'The Depot' }], { heat: 20 })), visit.flags.jumps), rules), null, 'in empty space');
});

test("managing heat, the test player takes no station job whose heat, its docking heat and the next jump's would bring the hunters; ignoring it, heat costs it nothing (M38c)", () => {
  const { huntHeat, jumpHeat } = rules.balance;
  // At nobody's station: a quiet job at the edge brings the ship to
  // huntHeat with the next jump.
  const edge = huntHeat - jumpHeat - rules.balance.jobHeat;
  const [{ visit }] = worked(atUpper(fork([{ name: "Mac's Pumps" }, { name: 'The Depot' }], { heat: 20 })));
  assert.equal(stationJobPick({ ...visit, heat: edge }, rules), null, `none at heat ${edge}`);
  assert.ok(stationJobPick({ ...visit, heat: edge }, rules, 'ignore'), 'ignoring heat, the same board has work');
  for (const heat of [edge - 1, edge - 5]) {
    const pick = stationJobPick({ ...visit, heat }, rules);
    if (pick) assert.ok(heat + jobHeat(pick.job, rules).heat + jumpHeat < huntHeat, `at ${heat}: ${pick.job.contract}`);
  }
  // At a station of the pursuer's side its docking heat counts, until the
  // ship has traded there this visit.
  const depot = atUpper(fork([{ name: 'The Depot' }, { name: "Mac's Pumps" }], { heat: 20 }));
  assert.equal(tradeHeat(depot, rules), rules.balance.dockHeat);
  const [{ visit: logged }] = worked(depot);
  const heat = huntHeat - jumpHeat - rules.balance.jobHeat - rules.balance.dockHeat;
  assert.equal(stationJobPick({ ...logged, heat }, rules), null, `none at heat ${heat}, not yet docked`);
  const docked = stationJobPick({ ...logged, heat, run: { ...logged.run, docked: true } }, rules);
  assert.ok(docked, 'docked there already, the same board has work at that heat');
  assert.ok(heat + jobHeat(docked.job, rules).heat + jumpHeat < huntHeat);
});
