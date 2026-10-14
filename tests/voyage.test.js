// M19's Done when: from launch, a run crosses three sectors by jumping and
// restocking at stations; supplies and heat move as data/balance.json says;
// the same seed always gives the same sectors. M20's: ten events play from
// data, each outcome the one its roll falls in. M21's: hostile ships are met
// and settled as encounter.js says, and the run still pays its way with
// them about: over 30 runs from launch, the careful test player (no long
// jumps: heat does nothing in act 2 until M24) crosses all five sectors
// without going hungry in at least 24. And M22's: boardings both ways are
// fought, each leaving parts, credits or wounds behind (Law 3), stations
// patch the crew, and the careful player still crosses fed in 24 of 30.
// And M23's: recruits sign on where the holds can feed them, and still the
// careful player crosses fed in 24 of 30; a med bay heals the wounded over
// jumps, so a ship with one patches less (Law 1). And M23e's: surgery,
// bunks and the large hold each change the voyage (Law 1). And M23h's: the
// careful player refits at stations with what it has on hand, each part kept
// only while every flight check passes, and still crosses fed in 24 of 30.
// Each voyage launches from a test run of act 1 (tools/run.js) and is
// played by the test player in tools/voyage.js. The voyages before M23h's
// fly as fitted, with no refits, so each compares one part's difference.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HEAT_MAX, maxHp } from '../src/sim/campaign.js';
import { outcomeFor } from '../src/sim/events.js';
import { launchedAt, voyage } from '../tools/voyage.js';
import { FIT_ORDER } from '../tools/voyagePlan.js';
import { rules } from './battleKit.js';

const { balance } = rules;
const RUNS = 30;
// Each seed's act 1 test run, once: the voyages below fly from it.
const lifts = Array.from({ length: RUNS }, (_, i) => launchedAt(rules, i + 1));
const fly = (options) => lifts.map((lifted, i) => voyage(rules, i + 1, { refit: 'no', ...options }, lifted));
const trips = fly({});
const careful = fly({ long: 'never' });
// The careful player with a cargo hold fitted, room to feed a recruit; and
// with a med bay.
const cargo = fly({ long: 'never', fit: ['cargo'] });
const medbay = fly({ long: 'never', fit: ['medbay'] });
// M23e's parts for the voyage: surgery; bunks, with a cargo hold to feed
// whoever they make room for; and the large hold. Surgery takes more power
// than the start ship has spare, so a small reactor goes on with it: a ship
// failing a flight check can't leave a station (M23h).
const surgery = fly({ long: 'never', fit: ['smallreactor', 'surgery'] });
const bunks = fly({ long: 'never', fit: ['cargo', 'bunks'] });
const largehold = fly({ long: 'never', fit: ['largehold'] });
// M23h: the careful player refitting at stations.
const refitting = fly({ long: 'never', refit: 'yes' });
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
  // The test runs fit no cargo hold but the one fitted for the cargo runs.
  const hold = (type) => rules.modules.get(type).stats.cargo;
  const runs = [[trips, 0], [careful, 0], [cargo, hold('cargo')], [medbay, 0], [surgery, 0], [bunks, hold('cargo')], [largehold, hold('largehold')]];
  for (const [voyages, hold] of runs) {
    for (const trip of voyages) for (const step of trip.steps) checkStep(step, balance.baseSupplies + hold, kinds);
  }
  assert.deepEqual([...kinds].sort(), ['approach', 'boarding', 'buy', 'event', 'hire', 'jump', 'long', 'patch', 'repair', 'scan', 'sector'], 'every kind of step comes up');
});

// One step of a voyage, as the rules say it moves things.
function checkStep(step, capacity, kinds) {
  kinds.add(step.kind);
  const [supplies, after] = step.supplies;
  assert.ok(after <= capacity);
  if (step.kind === 'buy') {
    assert.equal(after, supplies + step.count);
    assert.equal(step.credits[1], step.credits[0] - step.count * balance.supplyPrice);
    assert.deepEqual(step.heat[1], step.heat[0]);
    return;
  }
  if (step.kind === 'scan') {
    assert.equal(step.heat[1], clamp(step.heat[0] + balance.scanHeat, HEAT_MAX));
    assert.deepEqual([after, step.credits[1]], [supplies, step.credits[0]]);
    return;
  }
  if (step.kind === 'approach') {
    // A wreck's scrap and the heat, and a boarding left due; nothing else moved.
    const { changes } = step;
    const preset = rules.ships.get(step.ship);
    assert.deepEqual([after, step.hp[1], step.parts[1]], [supplies, step.hp[0], step.parts[0]]);
    assert.equal(step.credits[1] - step.credits[0], changes.credits);
    assert.equal(step.heat[1] - step.heat[0], changes.heat);
    assert.ok(changes.heat === 0 || changes.heat === clamp(step.heat[0] + balance.approachHeat, HEAT_MAX) - step.heat[0]);
    if (step.outcome === 'destroyed') assert.ok(changes.credits >= preset.scrap[0] && changes.credits <= preset.scrap[1], `scrap ${changes.credits}`);
    else assert.equal(changes.credits, 0);
    assert.deepEqual([changes.parts, changes.lost], [[], null]);
    assert.equal(step.boarding, step.outcome === 'boarded' || step.outcome === 'boardedBy' ? 'due' : null);
    return;
  }
  if (step.kind === 'boarding') {
    // Won: the salvage rolled as it began. Lost at home: what a raid takes. Wounds either way, never the last hit point.
    const preset = rules.ships.get(step.ship);
    const { salvage } = step;
    assert.ok(salvage.credits >= preset.scrap[0] && salvage.credits <= preset.scrap[1]);
    assert.ok(step.dir === 'them' ? salvage.parts.length <= preset.salvage : salvage.parts.length === 0, `salvage ${salvage.parts}`);
    const lostPart = step.lost?.part ? 1 : 0;
    assert.equal(step.credits[1] - step.credits[0], step.won ? salvage.credits : 0 - (step.lost?.credits ?? 0));
    assert.equal(step.parts[1] - step.parts[0], (step.won ? salvage.parts.length : 0) - lostPart);
    if (!step.won && step.dir === 'you') assert.ok(step.lost !== null || step.credits[0] < 10, 'they take a part or half the credits');
    assert.ok(step.hp[1].every((hp, i) => hp >= 1 && hp <= step.hp[0][i]), 'wounds stay, never the last hit point');
    assert.deepEqual([after, step.heat[1]], [supplies, step.heat[0]]);
    // Law 3: it left parts, credits or wounds behind.
    const hurt = step.hp[1].some((hp, i) => hp < step.hp[0][i]);
    assert.ok(hurt || step.credits[1] !== step.credits[0] || step.parts[1] !== step.parts[0] || step.hp[0].every((hp) => hp === 1), 'a boarding changed nothing');
    return;
  }
  if (step.kind === 'patch') {
    const healed = step.hp[1].reduce((a, b) => a + b, 0) - step.hp[0].reduce((a, b) => a + b, 0);
    assert.deepEqual([healed, step.credits[0] - step.credits[1]], [step.patched, step.patched * balance.patchPrice]);
    assert.ok(step.patched > 0);
    assert.deepEqual([after, step.heat[1]], [supplies, step.heat[0]]);
    return;
  }
  if (step.kind === 'repair') {
    assert.ok(step.repaired > 0 && step.credits[1] < step.credits[0]);
    assert.deepEqual([after, step.heat[1]], [supplies, step.heat[0]]);
    return;
  }
  if (step.kind === 'hire') {
    // The fee, and one more aboard at full health; nothing else moved.
    assert.equal(step.credits[0] - step.credits[1], balance.recruitFee);
    assert.deepEqual(step.hp[1], [...step.hp[0], maxHp({ job: step.job, traits: step.traits }, rules)]);
    assert.deepEqual([after, step.heat[1]], [supplies, step.heat[0]]);
    return;
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
    return;
  }
  const long = step.kind === 'long';
  const cost = balance.jumpSupplies * step.crew * (long ? balance.longJumpFactor : 1);
  assert.equal(step.hungry, supplies < cost);
  assert.equal(after, Math.max(0, supplies - cost));
  assert.equal(step.heat[1], Math.max(0, Math.min(HEAT_MAX, step.heat[0] + (long ? balance.longJumpHeat : balance.jumpHeat))));
  // Hunger first, then the med bay's healing, up to each one's most.
  assert.deepEqual(step.hp[1], step.hp[0].map((hp, i) => Math.min(step.max[i], (step.hungry ? Math.max(1, hp - balance.hungerHp) : hp) + step.heal)));
  assert.equal(step.credits[1], step.credits[0]);
}

test('ten events play from data, hostile ships are met and boardings fought, and the run pays its way: 24 or more of 30 careful runs cross all five sectors fed', () => {
  assert.ok([...trips, ...careful].every((trip) => trip.launched && trip.ended), 'every run launches and reaches the end of the charts');
  const played = new Set(trips.flatMap((trip) => trip.steps.filter((step) => step.kind === 'event').map((step) => step.event)));
  assert.equal(played.size, rules.events.size, `events played: ${[...played].join(', ')}`);
  assert.equal(rules.events.size, 10);
  const met = [...trips, ...careful].flatMap((trip) => trip.steps.filter((step) => step.kind === 'approach'));
  assert.ok(met.length >= RUNS, `hostile ships met: ${met.length}`);
  assert.ok(['escaped', 'boardedBy'].every((kind) => met.some((step) => step.outcome === kind)), `outcomes: ${[...new Set(met.map((step) => step.outcome))]}`);
  // Boardings at home, won and lost. (The test captain never closes to board,
  // and seldom disables a ship: boarding hers is tests/encounter.test.js's.)
  const fought = [...trips, ...careful].flatMap((trip) => trip.steps.filter((step) => step.kind === 'boarding'));
  assert.ok(fought.some((step) => step.dir === 'you' && step.won) && fought.some((step) => step.dir === 'you' && !step.won), `fights at home: ${fought.filter((s) => s.dir === 'you').length}`);
  const fed = careful.filter((trip) => trip.tally.hungryJumps === 0).length;
  assert.ok(fed >= 24, `fed all the way in ${fed} of ${RUNS}`);
  // What the nodes paid, on balance, in credits and supplies.
  const paid = careful.map((trip) => trip.tally.eventCredits + balance.supplyPrice * trip.tally.eventSupplies).sort((a, b) => a - b);
  assert.ok(paid[Math.floor(RUNS / 2)] > 0, `the median run comes out ahead at the nodes: ${paid}`);
  assert.ok(trips.every((trip) => trip.tally.scans > 0), 'every run scans');
});

test('recruits sign on where the holds can feed them, and the run still pays its way: with a cargo hold, 24 or more of 30 careful runs cross fed', () => {
  // On the lockers alone a fourth mouth can't be fed far enough between
  // stations (voyagePlan.js HIRE_JUMPS), so the careful player signs no one on.
  assert.ok(careful.every((trip) => trip.tally.hired === 0), 'no recruit on the lockers alone');
  // With a cargo hold, it signs recruits on where there is room and credits.
  assert.ok(cargo.every((trip) => trip.launched && trip.ended), 'every run reaches the end of the charts');
  const signed = cargo.filter((trip) => trip.tally.hired > 0).length;
  assert.ok(signed >= 10, `runs with a recruit: ${signed} of ${RUNS}`);
  assert.ok(cargo.every((trip) => trip.campaign.crew.length <= 4), 'up to the berths and life support: 4');
  const fed = cargo.filter((trip) => trip.tally.hungryJumps === 0).length;
  assert.ok(fed >= 24, `fed all the way in ${fed} of ${RUNS} with a cargo hold`);
});

test('a med bay heals the wounded over jumps: fitted, the careful player patches less and ends act 2 healthier (Law 1)', () => {
  const sum = (voyages, key) => voyages.reduce((total, trip) => total + trip.tally[key], 0);
  // Most careful runs end with the crew whole either way (since M23e's
  // presets), so healthier is the crew's hit points over all 30, not the
  // median run's.
  const hp = (voyages) => voyages.reduce((total, trip) => total + trip.campaign.crew.reduce((sum, member) => sum + member.hp, 0), 0);
  assert.ok(medbay.every((trip) => trip.launched && trip.ended), 'every run reaches the end of the charts');
  assert.ok(sum(medbay, 'healed') > 0 && sum(careful, 'healed') === 0, `healed ${sum(medbay, 'healed')} with a med bay`);
  assert.ok(sum(medbay, 'patchedHp') < sum(careful, 'patchedHp'), `patched ${sum(medbay, 'patchedHp')} with a med bay, ${sum(careful, 'patchedHp')} without`);
  assert.ok(hp(medbay) > hp(careful), `crew at the end, over ${RUNS} runs: ${hp(medbay)} hit points with, ${hp(careful)} without`);
  const fed = medbay.filter((trip) => trip.tally.hungryJumps === 0).length;
  assert.ok(fed >= 24, `fed all the way in ${fed} of ${RUNS} with a med bay`);
});

test('surgery, bunks and the large hold each change the voyage (Law 1)', () => {
  const sum = (voyages, key) => voyages.reduce((total, trip) => total + trip.tally[key], 0);
  const fed = (voyages) => voyages.filter((trip) => trip.tally.hungryJumps === 0).length;
  for (const voyages of [surgery, bunks, largehold]) assert.ok(voyages.every((trip) => trip.launched && trip.ended) && fed(voyages) >= 24, `fed all the way in ${fed(voyages)} of ${RUNS}`);
  // Surgery heals more a jump than a med bay (each with the medic aboard),
  // so the crew needs patching less.
  const heal = (voyages) => Math.max(...voyages.flatMap((trip) => trip.steps.filter((step) => step.kind === 'jump').map((step) => step.heal)));
  assert.equal(heal(surgery) - heal(medbay), rules.modules.get('surgery').heal - rules.modules.get('medbay').heal);
  assert.ok(sum(surgery, 'patchedHp') < sum(medbay, 'patchedHp'), `patched ${sum(surgery, 'patchedHp')} with surgery, ${sum(medbay, 'patchedHp')} with a med bay`);
  // Bunks make room for crew: with a hold to feed them, more sign on than
  // with the hold alone, past the start ship's four.
  assert.ok(sum(bunks, 'hired') > sum(cargo, 'hired'), `signed on ${sum(bunks, 'hired')} with bunks, ${sum(cargo, 'hired')} without`);
  assert.ok(bunks.some((trip) => trip.campaign.crew.length > 4) && cargo.every((trip) => trip.campaign.crew.length <= 4));
  // The large hold carries twice a cargo hold's supplies: its holds fill past
  // a cargo hold's, and the careful player goes hungry less than on the
  // lockers alone.
  const most = (voyages) => Math.max(...voyages.flatMap((trip) => trip.steps.map((step) => step.supplies[1])));
  assert.ok(most(largehold) > balance.baseSupplies + rules.modules.get('cargo').stats.cargo, `carried ${most(largehold)}`);
  assert.ok(sum(largehold, 'hungryJumps') < sum(careful, 'hungryJumps'), `hungry jumps: ${sum(largehold, 'hungryJumps')} with a large hold, ${sum(careful, 'hungryJumps')} on the lockers`);
});

test('the same seed always gives the same sectors, none named twice in a run', () => {
  const again = voyage(rules, SEEDS[1], { refit: 'no' });
  assert.deepEqual(again.sectors, trips[1].sectors);
  assert.deepEqual(again.steps, trips[1].steps);
  assert.notDeepEqual(trips[0].sectors, trips[1].sectors);
  for (const trip of trips.slice(0, SEEDS.length)) {
    const names = trip.sectors.map((sector) => sector.name);
    assert.equal(new Set(names).size, names.length, names.join(', '));
    assert.deepEqual(trip.sectors.map((sector) => sector.index), [1, 2, 3, 4, 5]);
  }
});

test('the careful player refits at stations with what it has, every flight check passing, and still crosses fed in 24 or more of 30 (M23h)', () => {
  assert.ok(refitting.every((trip) => trip.launched && trip.ended), 'every run reaches the end of the charts');
  const fed = refitting.filter((trip) => trip.tally.hungryJumps === 0).length;
  assert.ok(fed >= 24, `fed all the way in ${fed} of ${RUNS}, refitting`);
  const refits = refitting.flatMap((trip) => trip.steps.filter((step) => step.kind === 'refit'));
  const runs = refitting.filter((trip) => trip.tally.fitted > 0).length;
  assert.ok(runs >= 15, `runs with a refit: ${runs} of ${RUNS}`);
  for (const step of refits) {
    // The parts come off the parts on hand and onto the ship, for nothing,
    // and every flight check still passes.
    assert.ok(step.fitted.length > 0);
    assert.equal(step.modules[1] - step.modules[0], step.fitted.length);
    assert.equal(step.parts[0] - step.parts[1], step.fitted.length);
    assert.deepEqual([step.credits[1], step.supplies[1], step.heat[1], step.hp[1]], [step.credits[0], step.supplies[0], step.heat[0], step.hp[0]]);
    assert.equal(step.passes, true);
    // Only what feeds, heals, houses, guards, arms or drives the ship, and
    // a reactor with a part the power doesn't stretch to.
    for (const type of step.fitted) assert.ok([...FIT_ORDER, 'power'].includes(rules.modules.get(type).category), type);
  }
  // Without refits, the same seeds fly as before.
  const bare = careful.map((trip) => trip.tally.hungryJumps === 0).filter(Boolean).length;
  assert.ok(fed >= bare - 2, `fed in ${fed} refitting, ${bare} without`);
});
