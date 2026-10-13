// M19's Done when: from launch, a run crosses three sectors by jumping and
// restocking at stations; supplies and heat move as data/balance.json says;
// the same seed always gives the same sectors. M20's: ten events play from
// data, each outcome the one its roll falls in. And M21's: hostile ships
// are met and settled as encounter.js says, and the run still pays its way
// with them about: over 30 runs from launch, the careful test player (no
// long jumps: heat does nothing in act 2 until M24) crosses all five
// sectors without going hungry in at least 24. Each voyage launches from a
// test run of act 1 (tools/run.js) and is played by the test player in
// tools/voyage.js.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HEAT_MAX } from '../src/sim/campaign.js';
import { outcomeFor } from '../src/sim/events.js';
import { voyage } from '../tools/voyage.js';
import { rules } from './battleKit.js';

const { balance } = rules;
const RUNS = 30;
const trips = Array.from({ length: RUNS }, (_, i) => voyage(rules, i + 1));
const careful = Array.from({ length: RUNS }, (_, i) => voyage(rules, i + 1, { long: 'never' }));
const SEEDS = [1, 2, 3];
const clamp = (value, max) => Math.max(0, Math.min(max, value));

test('from launch, a run crosses three sectors by jumping and restocking at stations', () => {
  trips.slice(0, SEEDS.length).forEach((trip, i) => {
    const seed = SEEDS[i];
    assert.ok(trip.launched, `seed ${seed} launches`);
    assert.ok(trip.tally.crossed >= 3, `seed ${seed}: ${trip.tally.crossed} sectors crossed`);
    assert.ok(trip.ended, `seed ${seed} reaches the end of the charts`);
    assert.equal(trip.tally.crossed, rules.acts.get(2).sectors);
    const restocked = new Set(trip.steps.filter((step) => step.kind === 'buy').map((step) => step.sector));
    assert.ok([1, 2, 3].filter((sector) => restocked.has(sector)).length >= 2, `seed ${seed} restocks in the first three sectors: ${[...restocked]}`);
  });
});

test('supplies and heat move as data/balance.json and data/events.json say, step by step', () => {
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
      if (step.kind === 'scan') {
        assert.equal(step.heat[1], clamp(step.heat[0] + balance.scanHeat, HEAT_MAX));
        assert.deepEqual([after, step.credits[1]], [supplies, step.credits[0]]);
        continue;
      }
      if (step.kind === 'approach') {
        // What the stand-ins settle a boarding with, and nothing else moved.
        const { changes } = step;
        const preset = rules.ships.get(step.ship);
        const lostPart = changes.lost?.part ? 1 : 0;
        assert.deepEqual([after, step.hp[1]], [supplies, step.hp[0]]);
        assert.equal(step.credits[1] - step.credits[0], changes.credits);
        assert.equal(step.parts[1] - step.parts[0], changes.parts.length - lostPart);
        assert.equal(step.heat[1] - step.heat[0], changes.heat);
        assert.ok(changes.heat === 0 || changes.heat === clamp(step.heat[0] + balance.approachHeat, HEAT_MAX) - step.heat[0]);
        if (step.outcome === 'boarded' || step.outcome === 'destroyed') {
          assert.ok(changes.credits >= preset.scrap[0] && changes.credits <= preset.scrap[1], `scrap ${changes.credits}`);
          assert.equal(changes.parts.length, step.outcome === 'boarded' ? 1 : 0);
        } else assert.equal(changes.parts.length, 0);
        if (step.outcome === 'boardedBy') assert.ok(changes.lost !== null || step.credits[0] < 10, 'they take a part or half the credits');
        else assert.equal(changes.lost, null);
        continue;
      }
      if (step.kind === 'repair') {
        assert.ok(step.repaired > 0 && step.credits[1] < step.credits[0]);
        assert.deepEqual([after, step.heat[1]], [supplies, step.heat[0]]);
        continue;
      }
      if (step.kind === 'event') {
        // The outcome the roll falls in, with its effects as written.
        const choice = rules.events.get(step.event).choices.find((c) => c.id === step.choice);
        assert.equal(step.outcome, step.roll === null ? 0 : outcomeFor(choice.outcomes, step.roll));
        const { effects } = choice.outcomes[step.outcome];
        const { changes } = step;
        const sold = changes.sold.reduce((sum, sale) => sum + sale.credits, 0);
        assert.equal(changes.credits, (effects.credits ?? 0) + sold);
        assert.equal(changes.supplies, clamp(supplies + (effects.supplies ?? 0), capacity) - supplies);
        assert.equal(changes.heat, clamp(step.heat[0] + (effects.heat ?? 0), HEAT_MAX) - step.heat[0]);
        assert.deepEqual([step.credits[1] - step.credits[0], after - supplies, step.heat[1] - step.heat[0]], [changes.credits, changes.supplies, changes.heat]);
        assert.equal(step.parts[1] - step.parts[0], changes.parts.length - changes.sold.length);
        assert.equal(changes.parts.length, (effects.part ? 1 : 0) + (effects.drop ? 1 : 0));
        assert.equal(step.hp[0].reduce((a, b) => a + b, 0) - step.hp[1].reduce((a, b) => a + b, 0), changes.wounds.reduce((sum, w) => sum + w.hp, 0));
        assert.ok(step.hp[1].every((hp) => hp >= 1), 'never the last hit point');
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
  assert.deepEqual([...kinds].sort(), ['approach', 'buy', 'event', 'jump', 'long', 'repair', 'scan', 'sector'], 'every kind of step comes up');
});

test('ten events play from data, hostile ships are met, and the run pays its way: 24 or more of 30 careful runs cross all five sectors fed', () => {
  assert.ok([...trips, ...careful].every((trip) => trip.launched && trip.ended), 'every run launches and reaches the end of the charts');
  const played = new Set(trips.flatMap((trip) => trip.steps.filter((step) => step.kind === 'event').map((step) => step.event)));
  assert.equal(played.size, rules.events.size, `events played: ${[...played].join(', ')}`);
  assert.equal(rules.events.size, 10);
  const met = [...trips, ...careful].flatMap((trip) => trip.steps.filter((step) => step.kind === 'approach'));
  assert.ok(met.length >= RUNS, `hostile ships met: ${met.length}`);
  assert.ok(['escaped', 'boardedBy'].every((kind) => met.some((step) => step.outcome === kind)), `outcomes: ${[...new Set(met.map((step) => step.outcome))]}`);
  const fed = careful.filter((trip) => trip.tally.hungryJumps === 0).length;
  assert.ok(fed >= 24, `fed all the way in ${fed} of ${RUNS}`);
  // What the nodes paid, on balance, in credits and supplies.
  const paid = careful.map((trip) => trip.tally.eventCredits + balance.supplyPrice * trip.tally.eventSupplies).sort((a, b) => a - b);
  assert.ok(paid[Math.floor(RUNS / 2)] > 0, `the median run comes out ahead at the nodes: ${paid}`);
  assert.ok(trips.every((trip) => trip.tally.scans > 0), 'every run scans');
});

test('the same seed always gives the same sectors, none named twice in a run', () => {
  const again = voyage(rules, SEEDS[1]);
  assert.deepEqual(again.sectors, trips[1].sectors);
  assert.deepEqual(again.steps, trips[1].steps);
  assert.notDeepEqual(trips[0].sectors, trips[1].sectors);
  for (const trip of trips.slice(0, SEEDS.length)) {
    const names = trip.sectors.map((sector) => sector.name);
    assert.equal(new Set(names).size, names.length, names.join(', '));
    assert.deepEqual(trip.sectors.map((sector) => sector.index), [1, 2, 3, 4, 5]);
  }
});
