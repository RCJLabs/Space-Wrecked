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
// best, in every run, which ends the voyage and the act. And M26's: it
// founds the colony, giving every useful part the flight checks let go,
// beds and air first; the ship still passes every flight check counting
// nobody aboard, and every building is powered, in every run. And M27's: it
// plays the colony's first 30 days, building farms and mines by its own
// judgment, and in every run its farms feed the crew within 15 days of the
// landing. And M28's: it plays 30 days more, flying trips with a squad the
// ship has berths and air for, and in every run it flies at least one and
// the ship comes home from every one. And M29's: over those 60 days the
// pursuer may find the colony and raid it; the careful player stays home
// while a raid is coming, sets down the defenses in its hold, and faces
// every raid that lands, and its report says each run's raids. And M30's:
// from the deserter's and the smuggler's starts, the careful player crosses
// fed, meets the hunters and loses a raid at the colony in about as many
// runs as from the miner's, and its report puts them side by side. And
// M33's: a station charges the crew its side's share of each price, and
// the first trade at one of the pursuer's side since the ship arrived adds
// its docking heat (M33's fix: it was the jump there), which the managing
// player pays only where it must.
// Each voyage launches from a test run of act 1 (tools/run.js) and is
// played by the test player in tools/voyage.js. The voyages before M23h's
// fly as fitted, with no refits, so each compares one part's difference.
// Before M24 the careful player made no long jumps, since heat did nothing
// in act 2; since M24 it manages heat, long jumps and all (the default).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FACED } from '../src/sim/approach.js';
import { HEAT_MAX, maxHp, shipChecklist } from '../src/sim/campaign.js';
import { colonyStats, donate, shipParts } from '../src/sim/colony.js';
import { outcomeFor } from '../src/sim/events.js';
import { shipStats } from '../src/sim/constraints.js';
import { crewRoom } from '../src/sim/crew.js';
import { tripHeatOf } from '../src/sim/raids.js';
import { feeOf } from '../src/sim/recruits.js';
import { costAt } from '../src/sim/standing.js';
import { COLONY_DAYS, FED_WITHIN, foundColony, launchedAt, manyVoyages, playColony, playTrips, TRIP_DAYS, voyage, voyagesByBackground } from '../tools/voyage.js';
import { bestWorld, FIT_ORDER, nextGift, systemMove } from '../tools/voyagePlan.js';
import { rules } from './battleKit.js';

const { balance } = rules;
const RUNS = 30;
// Some checks fly RATE_RUNS seeds (Evan's call, 2026-10-15): M31's new
// parts changed how every run rolls, and they missed on seeds 1 to 30,
// though over 100 seeds M31's voyages were no worse than main's. Each holds
// its rate within MARGIN of main's over those seeds before M31 (MAIN, in
// every 100 runs; MARGIN_RARE for what main saw under 10 times). Two sets
// of 100 runs differ by about 7 in 100 by chance alone at these rates, so
// MARGIN is about two of those. M32's jobs and orders did the same to four
// more (every careful run scans; fed with a med bay; fed with surgery; the
// large hold against the lockers), and they fly 100 seeds the same way,
// against main's before M32. M33's sides and their events did it to two
// more (a recruit signed on with a cargo hold; a surveyed world settled),
// against main's before M33. The rest fly the first RUNS, as before.
const RATE_RUNS = 100;
const MARGIN = 15;
const MARGIN_RARE = 5;
const MAIN = {
  miner: { metSectors: 33, ignoringMet: 100, fed: 73, metAny: 42, lost: 29, systemHungry: 14, shortOfAir: 0, surveyed: 68, housed: 41, noScan: 0, medbayFed: 79, surgeryFed: 81, signed: 44, settledSurveyed: 81 },
  deserter: { fed: 80, metAny: 45, lost: 20 },
  smuggler: { fed: 89, metAny: 19, lost: 18 },
};
// Each seed's act 1 test run, once: the voyages below fly from it.
const lifts = Array.from({ length: RATE_RUNS }, (_, i) => launchedAt(rules, i + 1));
// What is fitted before a voyage, and a small reactor first where the ship
// has no power to spare for it, as the flight checklist's fix asks: since
// M31 some act 1 runs buy a Scrapline engine, which draws 1 more.
const powered = (lifted, fit = []) => (shipStats(lifted.campaign.ship, rules).power + fit.reduce((sum, type) => sum + rules.modules.get(type).stats.power, 0) >= 0 ? fit : ['smallreactor', ...fit]);
const fly = (options, runs = RUNS) => lifts.slice(0, runs).map((lifted, i) => voyage(rules, i + 1, { refit: 'no', ...options, fit: powered(lifted, options.fit) }, lifted));
const carefulAll = fly({}, RATE_RUNS);
const trips = carefulAll.slice(0, RUNS);
const careful = trips;
// The careful player with a cargo hold fitted, room to feed a recruit; and
// with a med bay.
const cargoAll = fly({ fit: ['cargo'] }, RATE_RUNS);
const cargo = cargoAll.slice(0, RUNS);
const medbayAll = fly({ fit: ['medbay'] }, RATE_RUNS);
const medbay = medbayAll.slice(0, RUNS);
// M23e's parts for the voyage: surgery; bunks, with a cargo hold to feed
// whoever they make room for; and the large hold. Surgery takes more power
// than the start ship has spare, so a small reactor goes on with it: a ship
// failing a flight check can't leave a station (M23h).
const surgeryAll = fly({ fit: ['smallreactor', 'surgery'] }, RATE_RUNS);
const surgery = surgeryAll.slice(0, RUNS);
const bunks = fly({ fit: ['cargo', 'bunks'] });
const largeholdAll = fly({ fit: ['largehold'] }, RATE_RUNS);
const largehold = largeholdAll.slice(0, RUNS);
// M23h: the careful player refitting at stations, as tools/voyage.js plays
// by default; and M24: the same, ignoring heat. Over RATE_RUNS seeds, the
// first RUNS of them as every other set.
const refittingAll = fly({ refit: 'yes' }, RATE_RUNS);
const ignoringAll = fly({ refit: 'yes', heat: 'ignore' }, RATE_RUNS);
const [refitting, ignoring] = [refittingAll, ignoringAll].map((all) => all.slice(0, RUNS));
// M30: the careful player from the other backgrounds' starts, as it
// plays from the miner's (refitting).
const desertersAll = Array.from({ length: RATE_RUNS }, (_, i) => voyage(rules, i + 1, { background: 'deserter' }));
const smugglersAll = Array.from({ length: RATE_RUNS }, (_, i) => voyage(rules, i + 1, { background: 'smuggler' }));
const [deserters, smugglers] = [desertersAll, smugglersAll].map((all) => all.slice(0, RUNS));
const SEEDS = [1, 2, 3];
const LAST = rules.acts.get(2).sectors;
const clamp = (value, max) => Math.max(0, Math.min(max, value));
// The shares of a price a station charges the crew, by their level with its
// side (M33); a station of nobody's charges the neutral share, all of it.
const SHARES = [balance.hostilePrice, balance.coldPrice, balance.neutralPrice, balance.friendlyPrice, balance.trustedPrice];

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
    for (const trip of voyages) {
      // A quartermaster signed on holds 10 more in the lockers from then on (M32).
      let lockers = 0;
      for (const step of trip.steps) {
        if (step.kind === 'hire' && step.job === 'quartermaster') lockers = rules.jobs.get('quartermaster').station.lockers;
        checkStep(step, balance.baseSupplies + hold + lockers, kinds);
      }
    }
  }
  assert.deepEqual([...kinds].sort(), ['approach', 'boarding', 'buy', 'event', 'hide', 'hire', 'jump', 'long', 'patch', 'repair', 'scan', 'sector', 'settle', 'survey', 'swap', 'system'], 'every kind of step comes up');
});

// One step of a voyage, as the rules say it moves things.
function checkStep(step, capacity, kinds) {
  kinds.add(step.kind);
  const [supplies, after] = step.supplies;
  assert.ok(after <= capacity);
  if (step.kind === 'buy') {
    // At the share the station charges the crew for its side (M33).
    assert.equal(after, supplies + step.count);
    assert.ok(SHARES.includes(step.share), `share ${step.share}`);
    assert.equal(step.credits[0] - step.credits[1], costAt(step.count, balance.supplyPrice, step.share));
    checkDock(step);
    return;
  }
  if (step.kind === 'scan') {
    assert.equal(step.heat[1], clamp(step.heat[0] + balance.scanHeat, HEAT_MAX));
    assert.deepEqual([after, step.credits[1]], [supplies, step.credits[0]]);
    return;
  }
  if (step.kind === 'swap') {
    // M24: the transponder swapped, at its price, for its heat, after
    // any docking heat.
    assert.equal(step.credits[0] - step.credits[1], balance.swapPrice);
    checkDock(step, (heat) => clamp(heat + balance.swapHeat, HEAT_MAX));
    assert.deepEqual([after, step.hp[1]], [supplies, step.hp[0]]);
    return;
  }
  if (step.kind === 'survey') {
    // M25: a day in orbit: a jump's supplies and surveyHeat, and the
    // hunters' roll at the heat it leaves. M32: with a xenobiologist
    // aboard, none of them.
    assert.deepEqual([step.credits[1], step.hp[1], step.parts[1]], [step.credits[0], step.hp[0], step.parts[0]]);
    if (step.free) {
      assert.deepEqual([after, step.heat[1], step.hunt], [supplies, step.heat[0], null]);
      return;
    }
    assert.equal(after, supplies - balance.jumpSupplies * step.crew);
    assert.equal(step.heat[1], clamp(step.heat[0] + balance.surveyHeat, HEAT_MAX));
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
    // Never the last hit point. Since M32 a medic's Patch in the fight can
    // give back hit points lost before it, so a wound can close.
    assert.ok(step.hp[1].every((hp) => hp >= 1), 'never the last hit point');
    assert.deepEqual([after, step.heat[1]], [supplies, step.heat[0]]);
    // Law 3: it left parts, credits or wounds behind.
    const hurt = step.hp[1].some((hp, i) => hp < step.hp[0][i]);
    assert.ok(hurt || step.credits[1] !== step.credits[0] || step.parts[1] !== step.parts[0] || step.hp[0].every((hp) => hp === 1), 'a boarding changed nothing');
    return;
  }
  if (step.kind === 'patch') {
    const healed = step.hp[1].reduce((a, b) => a + b, 0) - step.hp[0].reduce((a, b) => a + b, 0);
    assert.ok(SHARES.includes(step.share), `share ${step.share}`);
    assert.deepEqual([healed, step.credits[0] - step.credits[1]], [step.patched, costAt(step.patched, balance.patchPrice, step.share)]);
    assert.ok(step.patched > 0);
    assert.equal(after, supplies);
    checkDock(step);
    return;
  }
  if (step.kind === 'repair') {
    assert.ok(step.repaired > 0 && step.credits[1] < step.credits[0]);
    assert.equal(after, supplies);
    checkDock(step);
    return;
  }
  if (step.kind === 'hire') {
    // Their fee, by their traits and rank, at the station's share (M33),
    // and one more aboard at full health; nothing else moved.
    assert.ok(SHARES.includes(step.share), `share ${step.share}`);
    assert.equal(step.credits[0] - step.credits[1], feeOf({ job: step.job, traits: step.traits, fights: step.fights }, rules, step.share));
    assert.deepEqual(step.hp[1], [...step.hp[0], maxHp({ job: step.job, traits: step.traits }, rules)]);
    assert.equal(after, supplies);
    checkDock(step);
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
  // The jump's heat, and since M33's fix nothing for docking where it
  // comes out: that is a trade's.
  assert.equal(step.dock, undefined);
  assert.equal(step.heat[1], clamp(step.heat[0] + (long ? balance.longJumpHeat : balance.jumpHeat), HEAT_MAX));
  // Hunger first, then the med bay's healing, up to each one's most.
  assert.deepEqual(step.hp[1], step.hp[0].map((hp, i) => Math.min(step.max[i], (step.hungry ? Math.max(1, hp - balance.hungerHp) : hp) + step.heal)));
  assert.equal(step.credits[1], step.credits[0]);
  // The hunters' chance where it came out (M24), by the heat it came out
  // with: none below huntHeat, and none at all where they never wait.
  checkHunt(step);
}

// A trade at a station (M33's fix): its docking heat, if it was the first
// at one of the pursuer's side since the ship arrived, or none; then what
// the trade itself does to heat (`then`), nothing but for the swap.
function checkDock(step, then = (heat) => heat) {
  assert.ok([0, balance.dockHeat].includes(step.dock), `dock ${step.dock}`);
  assert.equal(step.heat[1], then(clamp(step.heat[0] + step.dock, HEAT_MAX)));
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

test("the run's fourteen events play from data (M20's ten and M33's four), hostile ships are met and boardings fought, and the run pays its way: 24 or more of 30 careful runs cross all five sectors fed", () => {
  assert.ok(careful.every((trip) => trip.launched && trip.ended), 'every run launches and settles a world past the charts');
  const played = new Set(trips.flatMap((trip) => trip.steps.filter((step) => step.kind === 'event').map((step) => step.event)));
  // The run's events: those of a kind of node (the colony's places have the
  // rest, M28).
  const runEvents = [...rules.events.values()].filter((event) => rules.nodeTypes.get(event.kind)?.events);
  assert.equal(played.size, runEvents.length, `events played: ${[...played].join(', ')}`);
  assert.equal(runEvents.length, 14);
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
  // Every run scans: since M32 over RATE_RUNS seeds, as main's did.
  const unscanned = carefulAll.filter((trip) => trip.tally.scans === 0).length;
  assert.ok(unscanned <= MAIN.miner.noScan + MARGIN_RARE, `${unscanned} of ${RATE_RUNS} runs never scan`);
});

test('recruits sign on where the holds can feed them, and the run still pays its way: with a cargo hold, 24 or more of 30 careful runs cross fed', () => {
  // On the lockers alone a fourth mouth can't be fed far enough between
  // stations (voyagePlan.js HIRE_JUMPS), so the careful player signs no one on.
  assert.ok(careful.every((trip) => trip.tally.hired === 0), 'no recruit on the lockers alone');
  // With a cargo hold, it signs recruits on where there is room and credits:
  // in 10 or more of 30 when this was measured (M23), and since M33 a rate
  // over 100 seeds, as main's within MARGIN.
  assert.ok(cargo.every((trip) => trip.launched && trip.ended), 'every run settles a world past the charts');
  const signed = cargoAll.filter((trip) => trip.tally.hired > 0).length;
  assert.ok(signed >= MAIN.miner.signed - MARGIN, `runs with a recruit: ${signed} of ${RATE_RUNS}`);
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
  const fed = medbayAll.filter((trip) => trip.tally.hungryJumps === 0).length;
  assert.ok(fed >= MAIN.miner.medbayFed - MARGIN, `fed all the way in ${fed} of ${RATE_RUNS} with a med bay`);
});

test('surgery, bunks and the large hold each change the voyage (Law 1)', () => {
  const sum = (voyages, key) => voyages.reduce((total, trip) => total + trip.tally[key], 0);
  const fed = (voyages) => voyages.filter((trip) => trip.tally.hungryJumps === 0).length;
  for (const voyages of [surgery, bunks, largehold]) assert.ok(voyages.every((trip) => trip.launched && trip.ended), 'every run settles a world past the charts');
  for (const voyages of [bunks, largehold]) assert.ok(fed(voyages) >= 24, `fed all the way in ${fed(voyages)} of ${RUNS}`);
  assert.ok(fed(surgeryAll) >= MAIN.miner.surgeryFed - MARGIN, `fed all the way in ${fed(surgeryAll)} of ${RATE_RUNS} with surgery`);
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
  // lockers alone, over RATE_RUNS seeds since M32 (on seeds 1 to 30 one run
  // that launches broke starves either way).
  const most = (voyages) => Math.max(...voyages.flatMap((trip) => trip.steps.map((step) => step.supplies[1])));
  assert.ok(most(largehold) > balance.baseSupplies + rules.modules.get('cargo').stats.cargo, `carried ${most(largehold)}`);
  assert.ok(sum(largeholdAll, 'hungryJumps') < sum(carefulAll, 'hungryJumps'), `hungry jumps over ${RATE_RUNS} runs: ${sum(largeholdAll, 'hungryJumps')} with a large hold, ${sum(carefulAll, 'hungryJumps')} on the lockers`);
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

// M24 measured 27 or more of 30 meeting the hunters ignoring heat, 6 or
// fewer managing it, and 24 or more of 30 crossing fed managing it (Evan's
// pick: at most 6). Main met those on seeds 1 to 30 alone: over 100, the
// hunters came in 33 managed runs and 73 crossed fed (§9). Since M31 they
// are rates over 100 seeds, within MARGIN of main's.
test("ignoring heat brings the hunters, and managing it keeps them off: over 100 runs, as often as main's before M31 within 15, all meet them ignoring it, about a third managing it, and three in four cross fed managing it (M24)", () => {
  // Met crossing the act's sectors, as M24 measured it: the system past the
  // charts (M25) is the next test's.
  const met = (voyages) => voyages.filter((trip) => trip.steps.some((step) => step.kind === 'approach' && step.hunt && step.sector <= LAST)).length;
  const median = (voyages, key) => voyages.map((trip) => trip.tally[key]).sort((a, b) => a - b)[Math.floor(voyages.length / 2)];
  assert.ok(ignoring.every((trip) => trip.launched && trip.ended), 'heat never ends a run (Law 5)');
  assert.ok(met(ignoringAll) >= MAIN.miner.ignoringMet - MARGIN, `ignoring heat, the hunters came in ${met(ignoringAll)} of ${RATE_RUNS}`);
  assert.ok(met(refittingAll) <= MAIN.miner.metSectors + MARGIN, `managing heat, the hunters came in ${met(refittingAll)} of ${RATE_RUNS}`);
  assert.ok(median(ignoringAll, 'hunts') > median(refittingAll, 'hunts'), 'more hunters a run ignoring heat');
  const fed = refittingAll.filter((trip) => trip.tally.hungryJumps === 0).length;
  assert.ok(fed >= MAIN.miner.fed - MARGIN, `fed all the way in ${fed} of ${RATE_RUNS}, managing heat`);
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
  // more, few go hungry for it, and nearly every run settles a world it
  // surveyed. None of seeds 1 to 30 went hungry in the system when this was
  // measured (M25); over 100 seeds main's runs did in 14 (§9), and since M31
  // that is the rate held, within MARGIN.
  // Two worlds or more surveyed in 20 or more of 30 when this was measured;
  // since M31 a rate over 100 seeds, as main's within MARGIN.
  const surveyed = refittingAll.filter((trip) => trip.tally.surveys >= 2).length;
  assert.ok(surveyed >= MAIN.miner.surveyed - MARGIN, `two worlds or more surveyed in ${surveyed} of ${RATE_RUNS}`);
  const hungry = refittingAll.filter((trip) => trip.tally.systemHungry > 0).length;
  assert.ok(hungry <= MAIN.miner.systemHungry + MARGIN, `hungry in the system in ${hungry} of ${RATE_RUNS}`);
  // A surveyed world settled in 25 or more of 30 when this was measured;
  // since M33 a rate over 100 seeds, as main's within MARGIN.
  const known = refittingAll.filter((trip) => trip.tally.settled.surveyed).length;
  assert.ok(known >= MAIN.miner.settledSurveyed - MARGIN, `settled a surveyed world in ${known} of ${RATE_RUNS}`);
  // The summary says so too.
  const summary = manyVoyages(rules, 2, { refit: 'no' }).lines.join('\n');
  assert.match(summary, /2 of 2 entered the system past the charts, 2 settled a world/);
  assert.match(summary, /The system: surveyed all 3 worlds in \d+ runs, 2 in \d+, 1 in \d+, none in \d+\. Settled a surveyed world in \d+ of 2/);
});

test('the colony: the careful player founds it in every run, giving every useful part the flight checks let go, beds and air first; the ship still flies with nobody aboard, and every building is powered (M26)', () => {
  const housing = (type) => {
    const { stats } = rules.modules.get(type);
    return stats.berths > 0 || stats.lifeSupport > 0;
  };
  for (const [i, trip] of refitting.entries()) {
    const seed = i + 1;
    const { campaign } = trip;
    const { colony } = trip.tally;
    assert.ok(colony && campaign.colony, `seed ${seed} founds the colony`);
    assert.deepEqual(campaign.colony.buildings.map((b) => b.type), colony.given, `seed ${seed}: the buildings are the parts given, in order`);
    // Nothing is left aboard that could be given.
    assert.deepEqual(shipParts(campaign, rules).filter((part) => part.ok), [], `seed ${seed}: every part the checks let go is given`);
    // The ship still flies, counting nobody aboard, and every building is
    // powered.
    assert.ok(shipChecklist(campaign, rules).every((line) => line.ok === true), `seed ${seed}: the ship passes every flight check`);
    const stats = colonyStats(campaign, rules);
    assert.ok(stats.buildings.every((b) => b.powered), `seed ${seed}: every building powered`);
    assert.deepEqual([colony.flies, colony.dark], [true, 0]);
    // Beds and air first: played again from the landing, whenever it gave
    // anything else, nothing that beds or breathes could go. And the same
    // landing founds the same colony.
    let state = trip.landed;
    for (const type of colony.given) {
      const ready = shipParts(state, rules).filter((part) => part.ok);
      if (!housing(type)) assert.equal(ready.some((part) => housing(part.type)), false, `seed ${seed}: ${type} given while beds or air could go`);
      const uid = nextGift(state, rules);
      assert.equal(state.ship.modules.find((m) => m.uid === uid).type, type);
      state = donate(state, rules, uid).campaign;
    }
    assert.equal(nextGift(state, rules), null);
    assert.deepEqual(foundColony(trip.landed, rules), { campaign, colony }, `seed ${seed}: the same colony again`);
    // The report says what it gave, the colony's power, beds and air, and
    // who sleeps aboard.
    assert.ok(trip.lines.some((line) => line.startsWith('   Founded the colony: gave ')), `seed ${seed} says what it gave`);
  }
  // Air for everyone in every colony of seeds 1 to 30 when this was
  // measured (M26), and in all of main's 100 before M31. Since M31 some
  // fall short (a part fitted on the run hangs off the life support, so the
  // ship can't give it): a rate over 100 seeds, within MARGIN_RARE of main's.
  // The colonies that can give their quarters house everyone: 13 of 30 when
  // this was measured, and since M31 a rate over 100 seeds, as main's within
  // MARGIN.
  const short = refittingAll.filter((trip) => trip.tally.colony.air < trip.tally.colony.crew).length;
  assert.ok(short <= MAIN.miner.shortOfAir + MARGIN_RARE, `short of air in ${short} colonies of ${RATE_RUNS}`);
  const housed = refittingAll.filter((trip) => trip.tally.colony.aboard === 0).length;
  assert.ok(housed >= MAIN.miner.housed - MARGIN, `everyone housed in ${housed} of ${RATE_RUNS}`);
  const summary = manyVoyages(rules, 2, { refit: 'no' }).lines.join('\n');
  assert.match(summary, /The colony: founded in 2 of 2, \d+ \(\d+ to \d+\) parts given: /);
});

test("the colony's days: the careful player plays 30, building farms and mines by its own judgment, and in every run its farms feed the crew within 15 days of the landing (M27)", () => {
  assert.deepEqual([COLONY_DAYS, FED_WITHIN], [30, 15]);
  const eats = (campaign) => campaign.crew.length * balance.jumpSupplies;
  for (const [i, trip] of refitting.entries()) {
    const seed = i + 1;
    const { days, colony } = trip.tally;
    const { home } = trip;
    assert.ok(days && home, `seed ${seed} plays the colony's days`);
    assert.equal(home.colony.day, 1 + COLONY_DAYS);
    assert.equal(home.flags.colonyDays, COLONY_DAYS);
    // Its farms feed the crew within 15 days of the landing, and go on
    // feeding them.
    assert.ok(days.fedOn !== null && days.fedOn - 1 <= FED_WITHIN, `seed ${seed}: fed by its farms from day ${days.fedOn}`);
    assert.ok(colonyStats(home, rules).made.food >= eats(home), `seed ${seed}: the farms feed the crew at the end`);
    // What it built stands after what it gave, farms and mines, each paid
    // for, and from M29 the defenses it set down from the hold while a
    // raid was coming, each in the day's order (builds, then defenses).
    const set = trip.tally.raids.set.filter((b) => b.day <= COLONY_DAYS);
    const put = [...days.built.map((b) => [b.day, 0, b.type]), ...set.map((b) => [b.day, 1, b.type])].sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([, , type]) => type);
    assert.deepEqual(home.colony.buildings.map((b) => b.type), [...colony.given, ...put]);
    assert.equal(days.farms + days.mines, days.built.length);
    // The materials it had, dug and spent add up, the stores keeping the
    // rest and lost raids taking theirs (M29).
    const spent = days.built.reduce((sum, b) => sum + rules.colony.builds.get(b.type).cost, 0);
    assert.equal(home.flags.materialsSpent ?? 0, spent);
    assert.equal(days.materials[1], days.materials[0] + (home.flags.materialsDug ?? 0) - spent - (home.flags.materialsLost ?? 0) - (home.flags.raidMaterialsTaken ?? 0), `seed ${seed}: materials add up`);
    assert.ok(days.materials[1] <= days.stores && days.food[1] <= days.stores);
    // Nobody died of hunger: the crew is the one that landed.
    assert.deepEqual(home.crew.map((m) => m.id), trip.campaign.crew.map((m) => m.id));
    // The same founding plays the same days.
    const again = playColony(trip.campaign, rules);
    assert.deepEqual({ campaign: again.campaign, days: again.days }, { campaign: home, days }, `seed ${seed}: the same days again`);
    // The report says the farms, mines, food, materials and hungry days.
    assert.ok(
      trip.lines.some((line) => /^   30 days at the colony: built .+; its farms feed the crew from day \d+; \d+ hungry days?.*; food \d+ to \d+, materials \d+ to \d+, of \d+ each; \d+ farms? and \d+ mines?\.$/.test(line)),
      `seed ${seed} reports its days`,
    );
  }
  // A world without soil needs a mine first: the careful player digs before
  // it farms where the farms it needs cost more than it landed with.
  const dug = refitting.filter((trip) => trip.tally.days.mines > 0);
  assert.ok(dug.length >= 1, 'some colony needs mines');
  for (const trip of dug) assert.equal(trip.tally.days.built[0].type, 'mine');
  const summary = manyVoyages(rules, 2, { refit: 'no' }).lines.join('\n');
  assert.match(summary, /The colony's first 30 days: its farms feed the crew within 15 days of the landing in 2 of 2, from day \d+ /);
});

test("the colony's trips: the careful player flies 30 days more, a squad aboard with berths and air, and in every run it flies at least one trip and the ship comes home from every one (M28)", () => {
  assert.equal(TRIP_DAYS, 30);
  let fought = 0;
  for (const [i, trip] of refitting.entries()) {
    const seed = i + 1;
    const { trips } = trip.tally;
    const { home, travelled } = trip;
    assert.ok(trips && travelled, `seed ${seed} plays the days of trips`);
    assert.ok(trips.flown.length >= 1, `seed ${seed} flies a trip`);
    // Home at the end, every trip flown home, every day played.
    assert.equal(travelled.colony.trip, null);
    assert.equal(travelled.flags.trips, trips.flown.length);
    assert.equal(travelled.flags.tripsHome, trips.flown.length, `seed ${seed}: the ship came home from every trip`);
    assert.equal(travelled.colony.day, home.colony.day + TRIP_DAYS);
    // A trip's days are out and home, each its own since a pilot in the
    // squad can shorten them (M32).
    assert.equal(trips.away, trips.flown.reduce((sum, flown) => sum + flown.days, 0));
    assert.ok(trips.flown.every((flown) => flown.squad >= 1 && flown.squad <= balance.squadSize));
    // Berths and air aboard for the squads it took; nobody lost.
    assert.ok(crewRoom(travelled.ship, rules) >= Math.max(...trips.flown.map((flown) => flown.squad)), `seed ${seed}: room aboard for its squads`);
    assert.deepEqual(travelled.crew.map((m) => m.id), home.crew.map((m) => m.id));
    assert.ok(travelled.crew.every((m) => m.hp >= 1 && m.hp <= maxHp(m, rules)));
    fought += trips.won + trips.lost;
    // The same colony plays the same trips.
    const again = playTrips(home, rules);
    assert.deepEqual({ campaign: again.campaign, trips: again.trips }, { campaign: travelled, trips }, `seed ${seed}: the same trips again`);
    // The report says the trips, the days away, what they brought, the
    // boardings and the hungry days.
    assert.ok(
      trip.lines.some((line) => /^   30 days of trips: \d+ trips?, \d+ days away: .+\. Brought \d+ parts?, \d+ materials and \d+ food; boardings won \d+, lost \d+, left \d+; built .+; refitted .+ aboard; \d+ hungry days?\.$/.test(line)),
      `seed ${seed} reports its trips`,
    );
  }
  assert.ok(fought >= 1, 'some trips board a held derelict');
  const summary = manyVoyages(rules, 2).lines.join('\n');
  assert.match(summary, /The colony's 30 days of trips: trips \d+ \(\d+ to \d+\), flown in 2 of 2; /);
});

test("the colony's raids: over its 60 days the careful player stays home while one is coming, sets down the defenses in its hold, and faces every raid that lands; found more near the lanes than far from them (M29)", () => {
  const rate = { 1: [0, 0], 2: [0, 0], 3: [0, 0] };
  let faced = 0;
  for (const [i, trip] of refitting.entries()) {
    const seed = i + 1;
    const { raids } = trip.tally;
    const { travelled, home, campaign: founded } = trip;
    assert.ok(raids, `seed ${seed} keeps its raids`);
    // Every raid found is faced once it lands; one may still be coming at
    // the end of the days played.
    assert.equal(raids.found, travelled.flags.raidsFound ?? 0);
    assert.equal(raids.faced.length, raids.found - (raids.coming ? 1 : 0), `seed ${seed}: every raid that landed is faced`);
    assert.equal(raids.coming, Boolean(travelled.colony.raid));
    assert.equal(travelled.flags.colonyRaidsWon ?? 0, raids.faced.filter((raid) => raid.won).length);
    assert.equal(travelled.flags.colonyRaidsLost ?? 0, raids.faced.filter((raid) => !raid.won).length);
    for (const raid of raids.faced) {
      assert.ok(raid.landed + raid.stopped === 4 && raid.home >= 0, `seed ${seed}: a raid of 4`);
      // A raid is won only with every raider stopped or beaten; a lost one
      // takes, a won one doesn't.
      assert.equal(raid.taken === null, raid.won);
      if (!raid.fought) assert.ok(raid.landed === 0 || raid.home === 0);
    }
    // Nobody dies in a raid: the crew is the one that landed.
    assert.deepEqual(travelled.crew.map((m) => m.id), founded.crew.map((m) => m.id));
    // Heat over the colony's days: falls a little each day, a trip adds
    // some, and a raid brings it down to heatAfterRaid. So after a raid it
    // ends no higher than that and the heat of the trips flown from the last
    // raid's day on. (Until M33 this said no higher than heatAfterRaid or
    // the heat at the landing, which held on seeds 1 to 30 by chance: main
    // missed it on seed 77, and M33's rolls on seed 27.)
    assert.ok(travelled.heat >= 0 && travelled.heat <= 100);
    if (raids.faced.length) {
      const last = Math.max(...raids.faced.map((raid) => raid.day));
      const after = trip.tally.trips.flown.filter((flown) => flown.day >= last).length;
      assert.ok(travelled.heat <= balance.heatAfterRaid + after * tripHeatOf(home, rules), `seed ${seed}: heat ${travelled.heat} at the end, ${after} trips after the last raid`);
    }
    rate[raids.lanes][0] += raids.found;
    rate[raids.lanes][1] += 1;
    faced += raids.faced.length;
    // The report says the raids.
    assert.ok(
      trip.lines.some((line) => /^   Raids over 60 days \((near|off|far from) the lanes; heat \d+ to \d+\): found \d+, faced \d+\./.test(line)),
      `seed ${seed} reports its raids`,
    );
  }
  assert.ok(faced >= 1, 'some colony is raided');
  // Found more often near the lanes than far from them, a run.
  const per = (lanes) => rate[lanes][0] / Math.max(1, rate[lanes][1]);
  assert.ok(rate[1][1] > 0 && rate[3][1] > 0, 'colonies near and far from the lanes');
  assert.ok(per(1) > per(3), `near ${per(1)} a run, far ${per(3)}`);
  const summary = manyVoyages(rules, 2).lines.join('\n');
  assert.match(summary, /Raids over the colony's 60 days: found \d+ \(\d+ to \d+\) a run, in \d+ of 2 /);
});

// M30 measured each background within 5 runs of 30 of the miner's. Over
// 100 seeds main's smuggler meets the hunters in 19 runs against the miner's
// 42 (§9), so since M31 each background holds main's own rates over 100
// seeds, within MARGIN.
test("from each background's start, the careful player crosses fed, meets the hunters and loses a raid at the colony in as many runs as main's before M31, within 15 of 100 (M30)", () => {
  const count = (fleet) => ({
    fed: fleet.filter((r) => r.tally.hungryJumps === 0).length,
    metAny: fleet.filter((r) => r.tally.hunts > 0).length,
    lost: fleet.filter((r) => (r.tally.raids?.faced ?? []).some((raid) => !raid.won)).length,
  });
  for (const [id, fleet, all] of [['miner', refitting, refittingAll], ['deserter', deserters, desertersAll], ['smuggler', smugglers, smugglersAll]]) {
    assert.ok(fleet.every((r) => r.launched && r.ended), `${id}: every run launches and settles a world`);
    const theirs = count(all);
    for (const key of Object.keys(theirs)) assert.ok(Math.abs(theirs[key] - MAIN[id][key]) <= MARGIN, `${id} ${key}: ${theirs[key]} of ${RATE_RUNS}, main's ${MAIN[id][key]}`);
  }
  const side = voyagesByBackground(rules, 1);
  assert.deepEqual(side.rows.map((row) => row.id), [...rules.backgrounds.keys()]);
  assert.match(side.lines[1], /^Background +Launched +Fed +Met +Raids +Won +Lost +Runs lost$/);
});

test("at a station of the pursuer's side the first trade since the ship arrived pays its docking heat, once a visit, and the managing player passes some by (M33's fix)", () => {
  const trades = ['buy', 'hire', 'swap', 'patch', 'repair'];
  let paid = 0;
  let passed = 0;
  for (const [i, trip] of [...refittingAll, ...desertersAll, ...smugglersAll].entries()) {
    let traded = false;
    for (const step of trip.steps) {
      if (['jump', 'long', 'sector', 'system'].includes(step.kind)) traded = false;
      if (!trades.includes(step.kind)) continue;
      if (step.dock) {
        // Seeds 1 to RATE_RUNS from the miner's start, then the deserter's
        // and the smuggler's.
        assert.equal(traded, false, `run ${i}: only a visit's first trade pays it`);
        paid += 1;
      }
      traded = true;
    }
    passed += trip.tally.passedBy;
  }
  assert.ok(paid > 0, 'some runs trade with their pursuer');
  assert.ok(passed > 0, 'and some pass one of its stations by');
});
