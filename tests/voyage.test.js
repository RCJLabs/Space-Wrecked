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
// And M24's: ignoring heat brings the pursuer's hunters, and managing it
// keeps them off, the careful player still crossing fed in 24 of 30. And
// M25's: past the last sector's jump point it enters the system past the
// charts, surveys while its supplies allow and settles the world it scores
// best, in every run, which ends the voyage and the act.
// Each voyage launches from a test run of act 1 (tools/run.js) and is
// played by the test player in tools/voyage.js. The voyages before M23h's
// fly as fitted, with no refits, so each compares one part's difference.
// Before M24 the careful player made no long jumps, since heat did nothing
// in act 2; since M24 it manages heat, long jumps and all (the default).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FACED } from '../src/sim/approach.js';
import { HEAT_MAX, maxHp } from '../src/sim/campaign.js';
import { outcomeFor } from '../src/sim/events.js';
import { launchedAt, manyVoyages, voyage } from '../tools/voyage.js';
import { bestWorld, FIT_ORDER, systemMove } from '../tools/voyagePlan.js';
import { rules } from './battleKit.js';

const { balance } = rules;
const RUNS = 30;
// Each seed's act 1 test run, once: the voyages below fly from it.
const lifts = Array.from({ length: RUNS }, (_, i) => launchedAt(rules, i + 1));
const fly = (options) => lifts.map((lifted, i) => voyage(rules, i + 1, { refit: 'no', ...options }, lifted));
const trips = fly({});
const careful = trips;
// The careful player with a cargo hold fitted, room to feed a recruit; and
// with a med bay.
const cargo = fly({ fit: ['cargo'] });
const medbay = fly({ fit: ['medbay'] });
// M23e's parts for the voyage: surgery; bunks, with a cargo hold to feed
// whoever they make room for; and the large hold. Surgery takes more power
// than the start ship has spare, so a small reactor goes on with it: a ship
// failing a flight check can't leave a station (M23h).
const surgery = fly({ fit: ['smallreactor', 'surgery'] });
const bunks = fly({ fit: ['cargo', 'bunks'] });
const largehold = fly({ fit: ['largehold'] });
// M23h: the careful player refitting at stations, as tools/voyage.js plays
// by default; and M24: the same, ignoring heat.
const refitting = fly({ refit: 'yes' });
const ignoring = fly({ refit: 'yes', heat: 'ignore' });
const SEEDS = [1, 2, 3];
const LAST = rules.acts.get(2).sectors;
const clamp = (value, max) => Math.max(0, Math.min(max, value));

test('from launch, a run crosses three sectors by jumping and restocking at stations', () => {
  trips.slice(0, SEEDS.length).forEach((trip, i) => {
    const seed = SEEDS[i];
    assert.ok(trip.launched, `seed ${seed} launches`);
    assert.ok(trip.tally.crossed >= 3, `seed ${seed}: ${trip.tally.crossed} sectors crossed`);
    assert.ok(trip.ended, `seed ${seed} settles a world past the charts`);
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
  assert.deepEqual([...kinds].sort(), ['approach', 'boarding', 'buy', 'event', 'hide', 'hire', 'jump', 'long', 'patch', 'repair', 'scan', 'sector', 'settle', 'survey', 'swap', 'system'], 'every kind of step comes up');
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
  if (step.kind === 'swap') {
    // M24: the transponder swapped, at its price, for its heat.
    assert.equal(step.credits[0] - step.credits[1], balance.swapPrice);
    assert.equal(step.heat[1], clamp(step.heat[0] + balance.swapHeat, HEAT_MAX));
    assert.deepEqual([after, step.hp[1]], [supplies, step.hp[0]]);
    return;
  }
  if (step.kind === 'survey') {
    // M25: a day in orbit: a jump's supplies and surveyHeat, and the
    // hunters' roll at the heat it leaves.
    assert.equal(after, supplies - balance.jumpSupplies * step.crew);
    assert.equal(step.heat[1], clamp(step.heat[0] + balance.surveyHeat, HEAT_MAX));
    assert.deepEqual([step.credits[1], step.hp[1], step.parts[1]], [step.credits[0], step.hp[0], step.parts[0]]);
    checkHunt(step);
    return;
  }
  if (step.kind === 'settle') {
    // M25: settling moves nothing the ship carries: it all goes with it.
    assert.deepEqual([after, step.credits[1], step.heat[1], step.hp[1], step.parts[1]], [supplies, step.credits[0], step.heat[0], step.hp[0], step.parts[0]]);
    return;
  }
  if (step.kind === 'regroup' || step.kind === 'hide') {
    // M24: a day's rest: a jump's supplies, its healing and the med bay's,
    // and its heat; hidden in a nebula, heat falls.
    assert.equal(after, supplies - balance.jumpSupplies * step.crew);
    assert.equal(step.heat[1], clamp(step.heat[0] + (step.kind === 'hide' ? balance.hideHeat : balance.regroupHeat), HEAT_MAX));
    assert.deepEqual(step.hp[1], step.hp[0].map((hp, i) => Math.min(step.max[i], hp + step.heal)));
    assert.equal(step.credits[1], step.credits[0]);
    return;
  }
  if (step.kind === 'approach') {
    // A wreck's scrap and the heat, and a boarding left due; nothing else moved.
    const { changes } = step;
    const preset = rules.ships.get(step.ship);
    assert.deepEqual([after, step.hp[1], step.parts[1]], [supplies, step.hp[0], step.parts[0]]);
    assert.equal(step.credits[1] - step.credits[0], changes.credits);
    assert.equal(step.heat[1] - step.heat[0], changes.heat);
    // The hunters faced (M24): heat falls to heatAfterRaid, whatever the
    // shots added; otherwise the shots' heat, or none.
    if (step.hunt && FACED.includes(step.outcome)) assert.equal(step.heat[1], Math.min(step.heat[0], balance.heatAfterRaid));
    else assert.ok(changes.heat === 0 || changes.heat === clamp(step.heat[0] + balance.approachHeat, HEAT_MAX) - step.heat[0]);
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
  // The hunters' chance where it came out (M24), by the heat it came out
  // with: none below huntHeat, and none at all where they never wait.
  checkHunt(step);
}

// The hunters' chance a jump showed and rolled (hunt.js): its level's, by
// the heat the ship came out with, or none where they never wait.
function checkHunt(step) {
  const heat = step.heat[1];
  const chances = heat >= HEAT_MAX ? [0, 100] : heat >= balance.raidHeat ? [0, balance.taskForceChance] : heat >= balance.huntHeat ? [0, balance.huntChance] : [0];
  assert.ok(chances.includes(step.hunt.chance), `chance ${step.hunt.chance} at heat ${heat}`);
  assert.equal(step.hunt.chance === 0, step.hunt.roll === null && !step.hunt.found || heat < balance.huntHeat || step.hunt.why !== null);
  if (step.hunt.roll !== null) assert.equal(step.hunt.found, step.hunt.roll < step.hunt.chance, 'rolled as shown');
}

test('ten events play from data, hostile ships are met and boardings fought, and the run pays its way: 24 or more of 30 careful runs cross all five sectors fed', () => {
  assert.ok(careful.every((trip) => trip.launched && trip.ended), 'every run launches and settles a world past the charts');
  const played = new Set(trips.flatMap((trip) => trip.steps.filter((step) => step.kind === 'event').map((step) => step.event)));
  assert.equal(played.size, rules.events.size, `events played: ${[...played].join(', ')}`);
  assert.equal(rules.events.size, 10);
  const met = careful.flatMap((trip) => trip.steps.filter((step) => step.kind === 'approach'));
  assert.ok(met.length >= RUNS, `hostile ships met: ${met.length}`);
  assert.ok(['escaped', 'boardedBy'].every((kind) => met.some((step) => step.outcome === kind)), `outcomes: ${[...new Set(met.map((step) => step.outcome))]}`);
  // Boardings at home, won and lost. (The test captain never closes to board,
  // and seldom disables a ship: boarding hers is tests/encounter.test.js's.)
  const fought = [...careful, ...ignoring].flatMap((trip) => trip.steps.filter((step) => step.kind === 'boarding'));
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
  assert.ok(cargo.every((trip) => trip.launched && trip.ended), 'every run settles a world past the charts');
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
  assert.ok(medbay.every((trip) => trip.launched && trip.ended), 'every run settles a world past the charts');
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
  assert.ok(refitting.every((trip) => trip.launched && trip.ended), 'every run settles a world past the charts');
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

test("ignoring heat brings the hunters, and managing it keeps them off: 27 or more of 30 meet them ignoring it, 6 or fewer managing it, and managing it 24 or more of 30 cross fed (M24)", () => {
  // Met crossing the act's sectors, as M24 measured it: the system past the
  // charts (M25) is the next test's.
  const met = (voyages) => voyages.filter((trip) => trip.steps.some((step) => step.kind === 'approach' && step.hunt && step.sector <= LAST)).length;
  const median = (voyages, key) => voyages.map((trip) => trip.tally[key]).sort((a, b) => a - b)[Math.floor(RUNS / 2)];
  assert.ok(ignoring.every((trip) => trip.launched && trip.ended), 'heat never ends a run (Law 5)');
  assert.ok(met(ignoring) >= 27, `ignoring heat, the hunters came in ${met(ignoring)} of ${RUNS}`);
  assert.ok(met(refitting) <= 6, `managing heat, the hunters came in ${met(refitting)} of ${RUNS}`);
  assert.ok(median(ignoring, 'hunts') > median(refitting, 'hunts'), 'more hunters a run ignoring heat');
  const fed = refitting.filter((trip) => trip.tally.hungryJumps === 0).length;
  assert.ok(fed >= 24, `fed all the way in ${fed} of ${RUNS}, managing heat`);
  // Managing heat swaps, hides and long-jumps; ignoring it does none of these.
  const sum = (voyages, key) => voyages.reduce((total, trip) => total + trip.tally[key], 0);
  assert.ok(sum(refitting, 'swaps') > 0 && sum(refitting, 'hides') > 0 && sum(refitting, 'longJumps') > 0);
  assert.deepEqual([sum(ignoring, 'swaps'), sum(ignoring, 'hides'), sum(ignoring, 'longJumps')], [0, 0, 0]);
  // Every hunt is an approach against the pursuer's ships, from its hunters'
  // level (hunt.js), and the task force comes too, ignoring heat.
  const { hunters, taskForce } = rules.backgrounds.get('miner').pursuer.run;
  const hunts = ignoring.flatMap((trip) => trip.steps.filter((step) => step.kind === 'approach' && step.hunt));
  assert.ok(hunts.every((step) => [hunters, taskForce].includes(step.ship) && step.heat[0] >= balance.huntHeat));
  assert.ok(hunts.some((step) => step.ship === hunters) && hunts.some((step) => step.ship === taskForce), 'the tug and the task force');
  assert.ok(hunts.some((step) => FACED.includes(step.outcome) && step.heat[1] === balance.heatAfterRaid), 'faced, heat falls to heatAfterRaid');
  // The days the ignoring player rests check out step by step, and so do
  // its approaches and jumps.
  for (const trip of ignoring) for (const step of trip.steps) if (['regroup', 'approach', 'jump', 'sector'].includes(step.kind)) checkStep(step, Infinity, new Set());
  assert.ok(sum(ignoring, 'regroups') > 0, 'it regroups');
});

test('past the charts: the careful player crosses all five sectors, enters the system, surveys while its supplies allow and settles the world it scores best, in every run (M25)', () => {
  for (const [i, trip] of refitting.entries()) {
    const seed = i + 1;
    assert.equal(trip.tally.crossed, LAST, `seed ${seed} crosses every sector`);
    assert.equal(trip.system?.system, true, `seed ${seed} enters the system`);
    assert.ok(trip.ended && trip.campaign.act === 3, `seed ${seed} settles a world`);
    assert.equal(trip.steps.at(-1).kind, 'settle', 'settling ends the voyage');
    // The colony keeps the world as the system has it.
    const { run, colony } = trip.campaign;
    const node = run.sector.nodes.find((n) => n.name === colony.world.name);
    assert.deepEqual(colony.world, { name: node.name, ...node.world, surveyed: run.surveyed.includes(node.id) });
    assert.equal(new Set(trip.steps.filter((step) => step.kind === 'survey').map((step) => step.world)).size, trip.tally.surveys, 'each world surveyed once');
    // It settled where no survey was left that its supplies covered, with
    // the way on to the best world, and that world is the one it settled:
    // the best it knew of in reach.
    assert.deepEqual(systemMove(trip.campaign, rules), { kind: 'settle' }, `seed ${seed}`);
    assert.equal(bestWorld(trip.campaign, rules), node.id);
    // Its report: the worlds surveyed, the one settled and the act's record.
    assert.ok(trip.lines.some((line) => line.startsWith(`   Settled ${node.name} (`)), `seed ${seed} says what it settled`);
    assert.match(trip.lines.at(-1), /^The act's record: /);
  }
  // Surveying while the supplies allow: most runs survey two worlds or
  // more, none goes hungry for it, and nearly every run settles a world it
  // surveyed.
  const surveyed = refitting.filter((trip) => trip.tally.surveys >= 2).length;
  assert.ok(surveyed >= 20, `two worlds or more surveyed in ${surveyed} of ${RUNS}`);
  assert.equal(refitting.reduce((sum, trip) => sum + trip.tally.systemHungry, 0), 0, 'never hungry in the system');
  const known = refitting.filter((trip) => trip.tally.settled.surveyed).length;
  assert.ok(known >= 25, `settled a surveyed world in ${known} of ${RUNS}`);
  // The summary says so too.
  const summary = manyVoyages(rules, 2, { refit: 'no' }).lines.join('\n');
  assert.match(summary, /2 of 2 entered the system past the charts, 2 settled a world/);
  assert.match(summary, /The system: surveyed 0 worlds in \d+, 1 worlds in \d+, 2 worlds in \d+, 3 worlds in \d+\. Settled a surveyed world in \d+ of 2/);
});
