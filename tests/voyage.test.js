// M19's Done when: from launch, a run crosses three sectors by jumping and
// restocking at stations; supplies and heat move as data/balance.json says;
// the same seed always gives the same sectors. Each voyage launches from a
// test run of act 1 (tools/run.js) and is played by the test player in
// tools/voyage.js.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HEAT_MAX } from '../src/sim/campaign.js';
import { voyage } from '../tools/voyage.js';
import { rules } from './battleKit.js';

const { balance } = rules;
const SEEDS = [1, 2, 3];
const trips = SEEDS.map((seed) => voyage(rules, seed));

test('from launch, a run crosses three sectors by jumping and restocking at stations', () => {
  trips.forEach((trip, i) => {
    const seed = SEEDS[i];
    assert.ok(trip.launched, `seed ${seed} launches`);
    assert.ok(trip.tally.crossed >= 3, `seed ${seed}: ${trip.tally.crossed} sectors crossed`);
    assert.ok(trip.ended, `seed ${seed} reaches the end of the charts`);
    assert.equal(trip.tally.crossed, rules.acts.get(2).sectors);
    const restocked = new Set(trip.steps.filter((step) => step.kind === 'buy').map((step) => step.sector));
    assert.ok([1, 2, 3].filter((sector) => restocked.has(sector)).length >= 2, `seed ${seed} restocks in the first three sectors: ${[...restocked]}`);
  });
});

test('supplies and heat move as data/balance.json says, jump by jump', () => {
  const kinds = new Set();
  for (const trip of trips) {
    const capacity = balance.baseSupplies; // the test runs fit no cargo hold
    for (const step of trip.steps) {
      kinds.add(step.kind);
      const [supplies, after] = step.supplies;
      assert.ok(after <= capacity);
      if (step.kind === 'buy') {
        assert.equal(after, supplies + step.count);
        assert.equal(step.credits[1], step.credits[0] - step.count * balance.supplyPrice);
        assert.deepEqual(step.heat[1], step.heat[0]);
        continue;
      }
      const long = step.kind === 'long';
      const cost = balance.jumpSupplies * step.crew * (long ? balance.longJumpFactor : 1);
      assert.equal(step.hungry, supplies < cost);
      assert.equal(after, Math.max(0, supplies - cost));
      assert.equal(step.heat[1], Math.max(0, Math.min(HEAT_MAX, step.heat[0] + (long ? balance.longJumpHeat : balance.jumpHeat))));
      assert.deepEqual(step.hp[1], step.hp[0].map((hp) => (step.hungry ? Math.max(1, hp - balance.hungerHp) : hp)));
      assert.equal(step.credits[1], step.credits[0]);
    }
  }
  assert.deepEqual([...kinds].sort(), ['buy', 'jump', 'long', 'sector'], 'every kind of step comes up');
});

test('the same seed always gives the same sectors, none named twice in a run', () => {
  const again = voyage(rules, SEEDS[1]);
  assert.deepEqual(again.sectors, trips[1].sectors);
  assert.deepEqual(again.steps, trips[1].steps);
  assert.notDeepEqual(trips[0].sectors, trips[1].sectors);
  for (const trip of trips) {
    const names = trip.sectors.map((sector) => sector.name);
    assert.equal(new Set(names).size, names.length, names.join(', '));
    assert.deepEqual(trip.sectors.map((sector) => sector.index), [1, 2, 3, 4, 5]);
  }
});
