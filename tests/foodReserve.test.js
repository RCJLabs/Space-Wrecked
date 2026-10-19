// The test players' food money (M40). The voyage's careful player keeps
// the credits the food to the system past the charts still takes
// (tools/voyagePlan.js foodReserve) from swaps, yard parts, racks, recruits,
// patching and repairs, and weighs credits below it at the supplies they
// buy; act 1's player takes up to three jobs more before launching while
// the credits fall short of act 2's (tools/run.js launchFood). The
// voyages that came into the system hungry had spent that money on the way,
// or left act 1 with 10 to 35 credits.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { launch } from '../src/sim/launch.js';
import { beginRun, jumpSupplies, supplyCapacity, systemNeeds } from '../src/sim/travel.js';
import { launchFood, runToLaunch, SECTOR_JUMPS } from '../tools/run.js';
import { BUFFER_JUMPS, effectsWorth, foodReserve, swapNow, SWAP_FROM, WORTH } from '../tools/voyagePlan.js';
import { rules } from './battleKit.js';
import { settled } from './colonyKit.js';
import { readyToLaunch } from './launchKit.js';

const onRun = beginRun(launch(readyToLaunch(), rules).campaign, rules).campaign;
const { sectors } = rules.acts.get(2);
const inSector = (campaign, index) => ({ ...campaign, run: { ...campaign.run, sector: { ...campaign.run.sector, index } } });
// The ship at a station of nobody's, alone in its sector with the way in.
function atStation(campaign) {
  const nodes = [{ id: 0, col: 0, row: 0, x: 0.1, y: 0.5, type: 'start', name: 'Way in' }, { id: 1, col: 1, row: 0, x: 0.5, y: 0.5, type: 'station', name: "Mac's Pumps" }];
  return { ...campaign, run: { ...campaign.run, sector: { ...campaign.run.sector, nodes, links: [[0, 1]], start: 0, exit: 1 }, at: 1, seen: [0, 1], docked: false, swapped: false } };
}

test("the food to the system: what act 2's jumps left eat, with the buffer, and the system's survey and jump on, less the holds (M40)", () => {
  const each = jumpSupplies(onRun, rules);
  assert.equal(onRun.run.sector.index, 1);
  assert.equal(onRun.supplies, supplyCapacity(onRun.ship, rules, onRun.crew), 'the holds full as act 2 begins');
  const reserve = (index, supplies) => {
    const jumps = SECTOR_JUMPS * (sectors - index) + SECTOR_JUMPS / 2 + BUFFER_JUMPS;
    return Math.max(0, Math.ceil(jumps * each) + systemNeeds(onRun, rules) - supplies) * rules.balance.supplyPrice;
  };
  assert.equal(foodReserve(onRun, rules), reserve(1, onRun.supplies));
  assert.equal(foodReserve(onRun, rules), 83, 'a crew of three, the first sector, the holds full');
  for (let index = 2; index <= sectors; index++) {
    assert.equal(foodReserve(inSector(onRun, index), rules), reserve(index, onRun.supplies));
    assert.ok(foodReserve(inSector(onRun, index), rules) < foodReserve(inSector(onRun, index - 1), rules), `less in sector ${index}`);
  }
  assert.equal(foodReserve({ ...inSector(onRun, sectors), supplies: 0 }, rules), reserve(sectors, 0), 'the last sector, the holds empty');
  assert.equal(foodReserve({ ...onRun, supplies: 999 }, rules), 0, 'never below nothing');
  // Nothing to keep in act 1, past the charts, or at the colony.
  assert.equal(foodReserve(readyToLaunch(), rules), 0);
  assert.equal(foodReserve({ ...onRun, run: { ...onRun.run, sector: { ...onRun.run.sector, system: true } } }, rules), 0);
  assert.equal(foodReserve(settled(), rules), 0);
});

test('the managing player swaps the transponder only with the food to the system left over (M40)', () => {
  const station = { ...atStation(onRun), heat: SWAP_FROM + 20 };
  const reserve = foodReserve(station, rules);
  const price = rules.balance.swapPrice;
  assert.ok(reserve > (supplyCapacity(station.ship, rules, station.crew) * rules.balance.supplyPrice) / 2, 'more than half a holdful');
  assert.equal(swapNow({ ...station, credits: price + reserve }, rules, 'manage'), true);
  assert.equal(swapNow({ ...station, credits: price + reserve - 1 }, rules, 'manage'), false, 'a credit short of the food');
  assert.equal(swapNow({ ...station, heat: SWAP_FROM - 1, credits: 999 }, rules, 'manage'), false, 'too cool to bother');
});

test('credits below the food to the system weigh as the supplies they buy; above it, at their face (M40)', () => {
  const reserve = foodReserve(onRun, rules);
  const dear = WORTH.short / rules.balance.supplyPrice;
  const worth = (credits, change) => effectsWorth({ ...onRun, credits }, rules, { credits: change });
  assert.equal(worth(reserve + 10, -10), -10, 'spent from above it');
  assert.equal(worth(reserve, -10), -10 * dear, 'spent from the food');
  assert.equal(worth(reserve + 5, -10), -5 - 5 * dear, 'half and half');
  assert.equal(worth(reserve - 10, 10), 10 * dear, 'earned back into it');
  assert.equal(worth(reserve, 10), 10, 'earned above it');
  assert.equal(effectsWorth({ ...settled(), credits: 0 }, rules, { credits: -10 }), -10, 'at the colony, no food to keep');
});

test("act 1's player takes up to three jobs more once ready while the credits fall short of act 2's food and first swap (M40)", () => {
  const each = rules.balance.jumpSupplies * readyToLaunch().crew.length;
  const food = Math.ceil((SECTOR_JUMPS * sectors - SECTOR_JUMPS / 2 + BUFFER_JUMPS) * each) + 2 * each - supplyCapacity(readyToLaunch().ship, rules, readyToLaunch().crew);
  assert.equal(launchFood(readyToLaunch(), rules), food * rules.balance.supplyPrice + rules.balance.swapPrice);
  assert.equal(launchFood(readyToLaunch(), rules), 123, 'a crew of three in the start ship');
  const forFood = (run) => run.lines.filter((line) => /, for the voyage's food\)/.test(line)).length;
  for (const seed of [1, 2, 3, 55]) {
    const run = runToLaunch(rules, seed);
    assert.ok(run.launched, `seed ${seed} launches`);
    const jobs = forFood(run);
    assert.ok(jobs <= 3, `seed ${seed}: ${jobs} jobs for the food`);
    assert.ok(run.campaign.credits >= launchFood(run.campaign, rules) || jobs === 3, `seed ${seed}: launches with ${run.campaign.credits} credits after ${jobs} jobs for the food`);
    if (jobs) assert.match(run.lines.at(-1), /^Ready to launch/);
  }
  assert.equal(forFood(runToLaunch(rules, 1)), 0, 'seed 1 is ready with the credits already');
  assert.ok(forFood(runToLaunch(rules, 55)) > 0, 'seed 55 is ready short of them');
});
