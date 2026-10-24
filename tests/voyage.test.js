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
// player pays only where it must. And M33b's: the careful player takes
// the quests' steps, the thread's in each act and the Fleet's chain where
// it befriends the Fleet, and the report says what came of them. And
// M33c's: each side's chain brings a companion, whom the careful player
// signs on at the chain's step, only where they could come aboard and be
// fed, and takes to their loyalty place at the colony; the report says who
// was met, signed on and loyal. And M36's: the run's 45 events and each
// background's own four play from data, a background's only on its runs;
// over 100 voyages from each start, no event comes twice on the run in 9
// of 10, nor at the colony's places; and the rates main's voyages held stay
// within their margins (MAIN). And M38d's: after the colony's 60 days the
// careful player flies out on a voyage with the healthiest who fit aboard,
// leaving one at home, plays the systems past the colony's as act 2's
// sectors, a day passing at home with each jump, and flies home once the
// holds come down to the way home's supplies and a buffer, or at the last
// system's jump point; those at home face any raid meanwhile. The voyage
// keeps a tally of its own, so act 2's rates are as they were; only the
// refitting player's runs fly it, the rest flying no voyage out, as the
// fitted ones fly no refits. And M38f's: back from it, the careful player
// plays the first colony's next AFTER_DAYS days, the second living them
// too; citizens grow at both, and a raid where the ship isn't is fought
// out without it.
// Each voyage launches from a test run of act 1 (tools/run.js) and is
// played by the test player in tools/voyage.js. The voyages before M23h's
// fly as fitted, with no refits, so each compares one part's difference.
// Before M24 the careful player made no long jumps, since heat did nothing
// in act 2; since M24 it manages heat, long jumps and all (the default).
// Since M38c it takes jobs at stations by default too; the fitted voyages
// fly without them, as without refits. With them a healer compares no
// longer: its crew, fit more often, works more and patches more (on seeds
// 1 to 30, 1147 hit points patched with a med bay against 958 without).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FACED } from '../src/sim/approach.js';
import { HEAT_MAX, maxHp, shipChecklist } from '../src/sim/campaign.js';
import { colonyStats, donate, shipParts } from '../src/sim/colony.js';
import { outcomeFor } from '../src/sim/events.js';
import { shipStats } from '../src/sim/constraints.js';
import { crewRoom } from '../src/sim/crew.js';
import { hasTag } from '../src/sim/modules.js';
import { tripHeatOf } from '../src/sim/raids.js';
import { feeOf } from '../src/sim/recruits.js';
import { costAt } from '../src/sim/standing.js';
import { voyagePlan } from '../src/sim/voyage.js';
import { AFTER_DAYS, citizensSummary, COLONY_DAYS, FED_WITHIN, foundColony, launchedAt, manyVoyages, NEW_DAYS, outSummary, playColony, playTrips, secondSummary, SETTLE_SYSTEM, TRIP_DAYS, voyage, VOYAGE_SYSTEMS, voyagesByBackground } from '../tools/voyage.js';
import { bestWorld, FIT_ORDER, FIT_SHARE, hatchesCutOff, HOME_JUMPS, NEVER_FIT, nextGift, STOCK_DAYS, systemMove } from '../tools/voyagePlan.js';
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
// against main's before M33. M33b's quests did it to two more (the careful
// player fed without refits; runs with a refit), against main's before
// M33b (the M33 fix's, carefulFed and refitRuns). M33c's companions did it
// to three more (fed with a cargo hold, with bunks and with the large
// hold), against main's before M33c (cargoFed, bunksFed, largeholdFed).
// M37's weapons and enemies took two of those under their bars on seeds 1
// to 100, fed with a cargo hold (74) and with bunks (68), where main's had
// come down to 81 and 75 by M36; on seeds 101 to 200 its voyages matched
// main's (78 and 75 against 80 and 73). So those two hold main's rates
// before M37 (Evan's call, 2026-10-17). M37b's shipyards took one more
// under its bar on seeds 1 to 100: runs with a refit came to 50, where
// main's had come down to 59 by M37 (63 before it); on seeds 101 to 300 its
// voyages matched main's (122 of 199 against 119). So that one holds main's
// rate before M37b, as M37's two do. The rest fly the first RUNS, as
// before. Since M40 MAIN is M40's own rates over seeds 1 to 100 (its Done
// when), those three with the rest, and M40's bars (BARS) hold the voyage
// from each start.
const RATE_RUNS = 100;
const MARGIN = 15;
const MARGIN_RARE = 5;
// M40's bars (Evan's picks, 2026-10-19), over RATE_RUNS voyages from each
// start: the hunters met in at most `met` (the sectors and the system
// together), fed all the way in `fed` or more, hungry in the system in
// `systemHungry` or fewer: none until M46, when its rerolled boardings left
// the deserter's seed 73 broke from sector 2 and hungry there (main itself
// comes in hungry on seed 300 of 300), so 2 (Evan's call, 2026-10-23).
const BARS = { met: 25, fed: 80, systemHungry: 2 };
const MAIN = {
  miner: { metSectors: 11, ignoringMet: 100, fed: 98, metAny: 11, lost: 13, systemHungry: 0, shortOfAir: 0, surveyed: 96, housed: 55, noScan: 2, medbayFed: 96, surgeryFed: 95, signed: 72, settledSurveyed: 95, carefulFed: 94, refitRuns: 84, cargoFed: 97, bunksFed: 94, largeholdFed: 99, tripsFlown: 100 },
  deserter: { fed: 93, metAny: 21, lost: 11 },
  smuggler: { fed: 97, metAny: 6, lost: 4 },
};
// Each seed's act 1 test run, once: the voyages below fly from it.
const lifts = Array.from({ length: RATE_RUNS }, (_, i) => launchedAt(rules, i + 1));
// What is fitted before a voyage, and a small reactor first where the ship
// has no power to spare for it, as the flight checklist's fix asks: since
// M31 some act 1 runs buy a Scrapline engine, which draws 1 more.
const powered = (lifted, fit = []) => (shipStats(lifted.campaign.ship, rules).power + fit.reduce((sum, type) => sum + rules.modules.get(type).stats.power, 0) >= 0 ? fit : ['smallreactor', ...fit]);
const fly = (options, runs = RUNS) => lifts.slice(0, runs).map((lifted, i) => voyage(rules, i + 1, { refit: 'no', jobs: 'no', out: 'no', ...options, fit: powered(lifted, options.fit) }, lifted));
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
const bunksAll = fly({ fit: ['cargo', 'bunks'] }, RATE_RUNS);
const bunks = bunksAll.slice(0, RUNS);
const largeholdAll = fly({ fit: ['largehold'] }, RATE_RUNS);
const largehold = largeholdAll.slice(0, RUNS);
// M23h: the careful player refitting at stations, as tools/voyage.js plays
// by default, and since M38c taking their jobs, and since M38d flying out
// from the colony; and M24: the same, ignoring heat. Over RATE_RUNS seeds,
// the first RUNS of them as every other set.
const refittingAll = fly({ refit: 'yes', jobs: 'yes', out: 'yes' }, RATE_RUNS);
const ignoringAll = fly({ refit: 'yes', jobs: 'yes', heat: 'ignore' }, RATE_RUNS);
const [refitting, ignoring] = [refittingAll, ignoringAll].map((all) => all.slice(0, RUNS));
// M30: the careful player from the other backgrounds' starts, as it
// plays from the miner's (refitting).
const desertersAll = Array.from({ length: RATE_RUNS }, (_, i) => voyage(rules, i + 1, { background: 'deserter', out: 'no' }));
const smugglersAll = Array.from({ length: RATE_RUNS }, (_, i) => voyage(rules, i + 1, { background: 'smuggler', out: 'no' }));
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
      // A quartermaster signed on holds 10 more in the lockers from then on
      // (M32), and more at rank 2 (M32b): what the holds carried as each step
      // began is the voyage's to say (M33c), and never less than that.
      let lockers = 0;
      for (const step of trip.steps) {
        assert.ok(step.room >= balance.baseSupplies + hold + lockers, `the holds carried ${step.room}`);
        checkStep(step, step.room, kinds);
        // From the step after they sign on, a recruit's or a companion's.
        const joined = step.kind === 'hire' ? step.job : step.kind === 'event' ? rules.companions.get(step.changes.joined)?.job : null;
        if (joined === 'quartermaster') lockers = rules.jobs.get('quartermaster').station.lockers;
      }
    }
  }
  // Station repairs come seldom in the miner's runs (one of the 210 above
  // on main), and since M36's events none on its seeds 1 to 30: the
  // deserter's runs repair now and then, so theirs are walked too, but for
  // their refits (the refit test's).
  for (const trip of deserters) for (const step of trip.steps) if (step.kind !== 'refit') checkStep(step, step.room, kinds);
  // M40: each swap costs swapRise more than the one before it, from
  // swapPrice for the first.
  for (const trip of [...refitting, ...deserters]) {
    const prices = trip.steps.filter((step) => step.kind === 'swap').map((step) => step.price);
    assert.deepEqual(prices, prices.map((_, i) => balance.swapPrice + i * balance.swapRise));
  }
  assert.ok(refitting.some((trip) => trip.steps.filter((step) => step.kind === 'swap').length >= 3), 'a run swaps three times or more');
  // A weapon bought from a station's rack (M37) comes up too, a part
  // bought at a shipyard (M37b) and a station's job (M38c).
  assert.deepEqual([...kinds].sort(), ['approach', 'arms', 'boarding', 'buy', 'event', 'hide', 'hire', 'job', 'jump', 'long', 'patch', 'repair', 'scan', 'sector', 'settle', 'survey', 'swap', 'system', 'yard'], 'every kind of step comes up');
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
    // any docking heat. Since M40 the price rises with each swap made
    // (the run's own, tested below).
    assert.equal(step.credits[0] - step.credits[1], step.price);
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
    // Aboard her, her scrap as much as she has left working (M46).
    assert.ok(salvage.credits >= (step.dir === 'them' ? 0 : preset.scrap[0]) && salvage.credits <= preset.scrap[1], `scrap ${salvage.credits}`);
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
  if (step.kind === 'arms') {
    // M37: a weapon from the station's rack, at its price there, with a
    // holdful's price and a transponder swap's left over; nothing else moved.
    assert.ok(rules.weapons.has(step.weapon), step.weapon);
    assert.equal(step.credits[0] - step.credits[1], step.price);
    assert.ok(step.credits[1] >= step.room * balance.supplyPrice + balance.swapPrice, `${step.credits[1]} credits left`);
    assert.deepEqual([after, step.hp[1], step.parts[1]], [supplies, step.hp[0], step.parts[0]]);
    checkDock(step);
    return;
  }
  if (step.kind === 'yard') {
    // M37b: a part bought at a shipyard, at its price there, with a
    // holdful's price and a transponder swap's left over; one more on hand
    // and nothing else moved.
    assert.ok(rules.modules.has(step.part), step.part);
    assert.equal(step.credits[0] - step.credits[1], step.price);
    assert.ok(step.credits[1] >= step.room * balance.supplyPrice + balance.swapPrice, `${step.credits[1]} credits left`);
    assert.equal(step.parts[1], step.parts[0] + 1);
    assert.deepEqual([after, step.hp[1]], [supplies, step.hp[0]]);
    checkDock(step);
    return;
  }
  if (step.kind === 'job') {
    // M38c: a station's job, its squad going: done, its pay with what its
    // client's side adds, and its part; done or lost, its heat after any
    // docking heat. Wounds fall on the squad alone, each fit as they went,
    // never to the last hit point; nothing else moves.
    assert.ok(step.won ? step.pay > 0 : step.pay === 0, `paid ${step.pay}`);
    assert.equal(step.credits[1] - step.credits[0], step.pay);
    assert.equal(step.parts[1] - step.parts[0], step.won && step.part ? 1 : 0);
    assert.ok([balance.jobHeat, balance.loudJobHeat].includes(step.added), `job heat ${step.added}`);
    checkDock(step, (heat) => clamp(heat + step.added, HEAT_MAX));
    assert.equal(after, supplies);
    assert.ok(step.squad.length >= 1 && step.squad.length <= balance.squadSize, `a squad of ${step.squad.length}`);
    step.ids.forEach((id, i) => {
      if (step.squad.includes(id)) assert.ok(step.hp[0][i] >= FIT_SHARE * step.max[i], `${id} went with ${step.hp[0][i]} of ${step.max[i]}`);
      else assert.equal(step.hp[1][i], step.hp[0][i], `${id} stayed aboard`);
    });
    assert.ok(step.hp[1].every((hp) => hp >= 1), 'never the last hit point');
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
    // A weapon on hand (M37), as written.
    assert.deepEqual(changes.arms ?? [], effects.arms ? [effects.arms] : []);
    // A companion signed on (M33c): one more aboard, at full health, and
    // only by a choice that signs them on.
    const companion = rules.companions.get(changes.joined);
    assert.equal(changes.joined ?? null, effects.joins ?? null);
    if (companion) assert.deepEqual(step.hp[1].slice(step.hp[0].length), [maxHp({ job: companion.job, traits: companion.traits }, rules)]);
    else assert.equal(step.hp[1].length, step.hp[0].length);
    const stayed = step.hp[1].slice(0, step.hp[0].length);
    assert.equal(step.hp[0].reduce((a, b) => a + b, 0) - stayed.reduce((a, b) => a + b, 0), changes.wounds.reduce((sum, w) => sum + w.hp, 0));
    assert.ok(step.hp[1].every((hp) => hp >= 1), 'never the last hit point');
    return;
  }
  const long = step.kind === 'long';
  const cost = balance.jumpSupplies * step.crew * (long ? balance.longJumpFactor : 1);
  // What hydroponics grow on the way (M39) is eaten first, the rest kept
  // up to what the holds take.
  assert.equal(step.hungry, supplies + step.grows < cost);
  assert.equal(after, Math.min(capacity, Math.max(0, supplies - cost + step.grows)));
  // The jump's heat, less what stealth baffles take off it (M39), and
  // since M33's fix nothing for docking where it comes out: that is a
  // trade's.
  assert.equal(step.dock, undefined);
  assert.equal(step.heat[1], clamp(step.heat[0] + (long ? balance.longJumpHeat : balance.jumpHeat) - step.quiet, HEAT_MAX));
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

test("the run's events play from data (M20's ten, M33's four and M36's 31, and the miner's own four), hostile ships are met and boardings fought, and the run pays its way: 24 or more of 30 careful runs cross all five sectors fed, since M33b as main's within 15 of 100", () => {
  assert.ok(careful.every((trip) => trip.launched && trip.ended), 'every run launches and settles a world past the charts');
  // The run's events: those of a kind of node (the colony's places have the
  // rest, M28), but the quests' own, which quests.js places where a quest's
  // step is open and the test player plays since M33b (the quests' tests
  // have them); and since M36 the backgrounds' own, the miner's in these
  // runs (the M36 test has the others'). With M36's 49 the first RUNS
  // seeds missed the tinker's barge: every one comes up over RATE_RUNS.
  const played = new Set(carefulAll.flatMap((trip) => trip.steps.filter((step) => step.kind === 'event' && !rules.events.get(step.event)?.quest).map((step) => step.event)));
  const runEvents = [...rules.events.values()].filter((event) => rules.nodeTypes.get(event.kind)?.events && !event.quest && (!event.background || event.background === 'miner'));
  assert.equal(played.size, runEvents.length, `events played: ${[...played].join(', ')}`);
  assert.equal(runEvents.length, 49);
  const met = careful.flatMap((trip) => trip.steps.filter((step) => step.kind === 'approach'));
  assert.ok(met.length >= RUNS, `hostile ships met: ${met.length}`);
  assert.ok(['escaped', 'boardedBy'].every((kind) => met.some((step) => step.outcome === kind)), `outcomes: ${[...new Set(met.map((step) => step.outcome))]}`);
  // Boardings at home, won and lost. (The test captain never closes to board,
  // and seldom disables a ship: boarding hers is tests/encounter.test.js's.)
  const fought = [...careful, ...ignoring].flatMap((trip) => trip.steps.filter((step) => step.kind === 'boarding'));
  assert.ok(fought.some((step) => step.dir === 'you' && step.won) && fought.some((step) => step.dir === 'you' && !step.won), `fights at home: ${fought.filter((s) => s.dir === 'you').length}`);
  // On seeds 1 to 30 the quests' steps (M33b) left 19 fed: a rate over
  // RATE_RUNS seeds since, as main's within MARGIN.
  const fed = carefulAll.filter((trip) => trip.tally.hungryJumps === 0).length;
  assert.ok(fed >= MAIN.miner.carefulFed - MARGIN, `fed all the way in ${fed} of ${RATE_RUNS}`);
  // What the nodes paid, on balance, in credits and supplies.
  const paid = careful.map((trip) => trip.tally.eventCredits + balance.supplyPrice * trip.tally.eventSupplies).sort((a, b) => a - b);
  assert.ok(paid[Math.floor(RUNS / 2)] > 0, `the median run comes out ahead at the nodes: ${paid}`);
  // Every run scans: since M32 over RATE_RUNS seeds, as main's did.
  const unscanned = carefulAll.filter((trip) => trip.tally.scans === 0).length;
  assert.ok(unscanned <= MAIN.miner.noScan + MARGIN_RARE, `${unscanned} of ${RATE_RUNS} runs never scan`);
});

test('recruits sign on where the holds can feed them, and the run still pays its way: with a cargo hold, 24 or more of 30 careful runs cross fed, since M33c as main\'s within 15 of 100', () => {
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
  // Fed in 24 or more of 30 until M33c, and since its companions over 100
  // seeds, as main's within MARGIN (main's before M37 from then, and M40's
  // since).
  const fed = cargoAll.filter((trip) => trip.tally.hungryJumps === 0).length;
  assert.ok(fed >= MAIN.miner.cargoFed - MARGIN, `fed all the way in ${fed} of ${RATE_RUNS} with a cargo hold`);
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
  // Fed in 24 or more of 30 with bunks or the large hold until M33c, and
  // since its companions over 100 seeds, as main's within MARGIN (with
  // bunks, main's before M37 from then, and M40's since).
  assert.ok(fed(bunksAll) >= MAIN.miner.bunksFed - MARGIN, `fed all the way in ${fed(bunksAll)} of ${RATE_RUNS} with bunks`);
  assert.ok(fed(largeholdAll) >= MAIN.miner.largeholdFed - MARGIN, `fed all the way in ${fed(largeholdAll)} of ${RATE_RUNS} with the large hold`);
  assert.ok(fed(surgeryAll) >= MAIN.miner.surgeryFed - MARGIN, `fed all the way in ${fed(surgeryAll)} of ${RATE_RUNS} with surgery`);
  // Surgery heals more a jump than a med bay (each with the medic aboard),
  // so the crew needs patching less: since M38 over 300 seeds, in
  // voyageSurgery.test.js (M38's jobs moved seeds 1 to 100, as M33b's
  // quests had moved seeds 1 to 30).
  const heal = (voyages) => Math.max(...voyages.flatMap((trip) => trip.steps.filter((step) => step.kind === 'jump').map((step) => step.heal)));
  assert.equal(heal(surgery) - heal(medbay), rules.modules.get('surgery').heal - rules.modules.get('medbay').heal);
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
  const again = voyage(rules, SEEDS[1], { refit: 'no', jobs: 'no', out: 'no', fit: powered(lifts[1]) });
  assert.deepEqual(again.sectors, trips[1].sectors);
  assert.deepEqual(again.steps, trips[1].steps);
  assert.notDeepEqual(trips[0].sectors, trips[1].sectors);
  for (const trip of trips.slice(0, SEEDS.length)) {
    const names = trip.sectors.map((sector) => sector.name);
    assert.equal(new Set(names).size, names.length, names.join(', '));
    assert.deepEqual(trip.sectors.map((sector) => sector.index), [1, 2, 3, 4, 5]);
  }
});

test('the careful player refits at stations with what it has, every flight check passing, and still crosses fed: 24 or more of 30 in M23h, since M33b as main\'s within 15 of 100', () => {
  assert.ok(refitting.every((trip) => trip.launched && trip.ended), 'every run settles a world past the charts');
  // On seeds 1 to 30 the quests' steps (M33b) left 19 fed: a rate over
  // RATE_RUNS seeds since, as main's within MARGIN.
  const fed = refittingAll.filter((trip) => trip.tally.hungryJumps === 0).length;
  assert.ok(fed >= MAIN.miner.fed - MARGIN, `fed all the way in ${fed} of ${RATE_RUNS}, refitting`);
  const refits = refitting.flatMap((trip) => trip.steps.filter((step) => step.kind === 'refit'));
  // 15 or more of 30 in M23h; since M33b a rate over RATE_RUNS seeds, as
  // main's within MARGIN (seeds 1 to 30 had 12).
  const runs = refittingAll.filter((trip) => trip.tally.fitted > 0).length;
  assert.ok(runs >= MAIN.miner.refitRuns - MARGIN, `runs with a refit: ${runs} of ${RATE_RUNS}`);
  for (const step of refits) {
    // The parts come off the parts on hand and onto the ship, for nothing,
    // and every flight check still passes.
    assert.ok(step.fitted.length > 0);
    assert.equal(step.modules[1] - step.modules[0], step.fitted.length);
    assert.equal(step.parts[0] - step.parts[1], step.fitted.length);
    assert.deepEqual([step.credits[1], step.supplies[1], step.heat[1], step.hp[1]], [step.credits[0], step.supplies[0], step.heat[0], step.hp[0]]);
    assert.equal(step.passes, true);
    // Only what feeds, heals, houses, guards, arms or drives the ship, and
    // from M39 its systems, never a second bridge, a corridor, an airlock
    // or an armory; and a reactor with a part the power doesn't stretch to.
    for (const type of step.fitted) {
      const def = rules.modules.get(type);
      assert.ok([...FIT_ORDER, 'power'].includes(def.category) && !NEVER_FIT.some((tag) => hasTag(def, tag)), type);
    }
  }
  // Without refits, the same seeds fly as before.
  const fedHere = refitting.filter((trip) => trip.tally.hungryJumps === 0).length;
  const bare = careful.map((trip) => trip.tally.hungryJumps === 0).filter(Boolean).length;
  assert.ok(fedHere >= bare - 2, `fed in ${fedHere} refitting, ${bare} without`);
});

// M38c: the careful player's work at stations, over the RATE_RUNS
// refitting runs: a job in most of them, each with a full squad of the fit
// and, managing heat, only where its heat and the next jump's keep the ship
// under the hunters'. With --jobs no it takes none, and the summary says
// what the jobs came to.
test("the careful player takes a station's job where it is worth it, with a full squad of the fit, and managing heat stays under the hunters' heat (M38c)", () => {
  const jobs = refittingAll.flatMap((trip) => trip.steps.filter((step) => step.kind === 'job'));
  const runs = refittingAll.filter((trip) => trip.tally.stationJobs > 0).length;
  assert.ok(runs >= RATE_RUNS / 2, `station jobs in ${runs} of ${RATE_RUNS} runs`);
  assert.ok(jobs.some((step) => step.won) && jobs.some((step) => !step.won), 'done and lost');
  for (const step of jobs) {
    checkStep(step, step.room, new Set());
    assert.equal(step.squad.length, Math.min(balance.squadSize, step.crew), 'a full squad');
    assert.ok(step.heat[1] + balance.jumpHeat < balance.huntHeat, `heat ${step.heat[1]} after ${step.contract}`);
    assert.ok(rules.contracts.jobs.get(step.contract).sites.every((site) => rules.docks.sites.includes(site)), `${step.contract} is a station's`);
  }
  // The tallies are the steps'.
  for (const trip of refitting) {
    const own = trip.steps.filter((step) => step.kind === 'job');
    assert.deepEqual([trip.tally.stationJobs, trip.tally.stationJobsWon, trip.tally.jobCredits], [own.length, own.filter((step) => step.won).length, own.reduce((sum, step) => sum + step.pay, 0)]);
  }
  const none = fly({ refit: 'yes', jobs: 'no' }, 3);
  assert.ok(none.every((trip) => trip.ended && trip.tally.stationJobs === 0 && !trip.steps.some((step) => step.kind === 'job')), 'none with --jobs no');
  const summary = manyVoyages(rules, 2).lines.join('\n');
  assert.match(summary, /, taking station jobs\./);
  assert.match(summary, /Station jobs \(M38c\): \d+ \(\d+ to \d+\) taken, in \d+ of 2 runs/);
});

// M24 measured 27 or more of 30 meeting the hunters ignoring heat, 6 or
// fewer managing it, and 24 or more of 30 crossing fed managing it (Evan's
// pick: at most 6). Main met those on seeds 1 to 30 alone: over 100, the
// hunters came in 33 managed runs and 73 crossed fed (§9). Since M31 they
// are rates over 100 seeds, within MARGIN of main's.
test("ignoring heat brings the hunters, and managing it keeps them off: over 100 runs, as often as main's within 15 (M40's since M40), all meet them ignoring it, few managing it, and nearly all cross fed managing it (M24)", () => {
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
    // Its report: the worlds surveyed, the one settled and the act's record,
    // last but for what the voyage out came to (M38d).
    assert.ok(trip.lines.some((line) => line.startsWith(`   Settled ${node.name} (`)), `seed ${seed} says what it settled`);
    assert.match(trip.lines.at(trip.out ? -2 : -1), /^The act's record: /);
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
  // From M40 the parts whose going leaves a hatch no one can walk to from
  // the bridge stay aboard too (tests/hatches.test.js).
  const givable = (state) => shipParts(state, rules).filter((part) => part.ok && hatchesCutOff(part.ship, rules) <= hatchesCutOff(state.ship, rules));
  for (const [i, trip] of refitting.entries()) {
    const seed = i + 1;
    const { campaign } = trip;
    const { colony } = trip.tally;
    assert.ok(colony && campaign.colony, `seed ${seed} founds the colony`);
    assert.deepEqual(campaign.colony.buildings.map((b) => b.type), colony.given, `seed ${seed}: the buildings are the parts given, in order`);
    // Nothing is left aboard that could be given.
    assert.deepEqual(givable(campaign), [], `seed ${seed}: every part the checks and the walk to the hatches let go is given`);
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
      const ready = givable(state);
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
    // rest, lost raids taking theirs (M29) and a trader buying its lots
    // (M53).
    const spent = days.built.reduce((sum, b) => sum + rules.colony.builds.get(b.type).cost, 0);
    const sold = (home.flags.traderSales ?? 0) * balance.traderLot;
    assert.equal(home.flags.materialsSpent ?? 0, spent);
    assert.equal(days.materials[1], days.materials[0] + (home.flags.materialsDug ?? 0) - spent - sold - (home.flags.materialsLost ?? 0) - (home.flags.raidMaterialsTaken ?? 0), `seed ${seed}: materials add up`);
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

// Every run flew a trip on seeds 1 to 30 until M46, whose picked strips
// and scrap left changed how the voyages roll out: seed 24 settled a world
// that ran out of food, and flew none. So it holds main's rate over 100
// seeds, as CLAUDE.md says (main: 100 of 100).
test("the colony's trips: the careful player flies 30 days more, a squad aboard with berths and air, flies a trip in as many runs as main does, and the ship comes home from every one (M28)", () => {
  assert.equal(TRIP_DAYS, 30);
  const flewAny = refittingAll.filter((r) => r.tally.trips?.flown.length >= 1).length;
  assert.ok(flewAny >= MAIN.miner.tripsFlown - MARGIN_RARE, `a trip flown in ${flewAny} of ${RATE_RUNS}`);
  let fought = 0;
  for (const [i, trip] of refitting.entries()) {
    const seed = i + 1;
    const { trips } = trip.tally;
    const { home, travelled } = trip;
    assert.ok(trips && travelled, `seed ${seed} plays the days of trips`);
    // Home at the end, every trip flown home, every day played.
    assert.equal(travelled.colony.trip, null);
    assert.equal(travelled.flags.trips ?? 0, trips.flown.length);
    assert.equal(travelled.flags.tripsHome ?? 0, trips.flown.length, `seed ${seed}: the ship came home from every trip`);
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
      trip.lines.some((line) => /^   30 days of trips: \d+ trips?, \d+ days away(: .+)?\. Brought \d+ parts?, \d+ materials and \d+ food; boardings won \d+, lost \d+, left \d+; built .+; refitted .+ aboard; \d+ hungry days?\.$/.test(line)),
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
      // Four, the pursuer's party, and from M53 one to three more as heat
      // has it.
      assert.ok(raid.landed + raid.stopped === raid.party && raid.party >= 4 && raid.party <= 7 && raid.home >= 0, `seed ${seed}: a raid of 4 to 7`);
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
// seeds, within MARGIN. Since M33b no worse than them (Evan's call,
// 2026-10-16): the deserter's thread takes 35 heat off a pursuer who takes
// no payments, and it met the hunters in 21 of 100 against main's 45.
test("from each background's start, the careful player crosses fed, meets the hunters and loses a raid at the colony in no more runs than main's by 15 of 100 (M30, M33b; main's M40's since M40)", () => {
  const count = (fleet) => ({
    fed: fleet.filter((r) => r.tally.hungryJumps === 0).length,
    metAny: fleet.filter((r) => r.tally.hunts > 0).length,
    lost: fleet.filter((r) => (r.tally.raids?.faced ?? []).some((raid) => !raid.won)).length,
  });
  for (const [id, fleet, all] of [['miner', refitting, refittingAll], ['deserter', deserters, desertersAll], ['smuggler', smugglers, smugglersAll]]) {
    assert.ok(fleet.every((r) => r.launched && r.ended), `${id}: every run launches and settles a world`);
    const theirs = count(all);
    // Fed no less, met and lost no more.
    const worse = { fed: MAIN[id].fed - theirs.fed, metAny: theirs.metAny - MAIN[id].metAny, lost: theirs.lost - MAIN[id].lost };
    for (const key of Object.keys(theirs)) assert.ok(worse[key] <= MARGIN, `${id} ${key}: ${theirs[key]} of ${RATE_RUNS}, main's ${MAIN[id][key]}`);
  }
  const side = voyagesByBackground(rules, 1);
  assert.deepEqual(side.rows.map((row) => row.id), [...rules.backgrounds.keys()]);
  assert.match(side.lines[1], /^Background +Launched +Fed +Met +Raids +Won +Lost +Runs lost$/);
});

// M40's Done when: from each start, over RATE_RUNS voyages, the careful
// player managing heat meets the hunters in at most BARS.met runs, the
// sectors and the system together (M40 brought them from 35, 26 and 13 of
// 100: only the task force past the charts, swaps dearer each time, and the
// test player keeping the food to the system in hand); is fed all the way in
// BARS.fed or more; and comes into the system hungry in none.
test("from each start, over 100 voyages, the hunters met in 25 runs or fewer, fed all the way in 80 or more, and hungry in the system in 2 or fewer (M40, M46)", () => {
  for (const [id, all] of [['miner', refittingAll], ['deserter', desertersAll], ['smuggler', smugglersAll]]) {
    const met = all.filter((r) => r.tally.hunts > 0).length;
    const fed = all.filter((r) => r.tally.hungryJumps === 0).length;
    const hungry = all.filter((r) => r.tally.systemHungry > 0).length;
    assert.ok(met <= BARS.met, `${id}: the hunters met in ${met} of ${RATE_RUNS}`);
    assert.ok(fed >= BARS.fed, `${id}: fed all the way in ${fed} of ${RATE_RUNS}`);
    assert.ok(hungry <= BARS.systemHungry, `${id}: hungry in the system in ${hungry} of ${RATE_RUNS}`);
  }
});

// M36: the events met. An event met comes again only once its kind has
// no others left (eventPool.js), so over RATE_RUNS voyages from each start
// none comes twice on the run in 9 of 10, nor at the colony's places
// (M36's Done when); and each background's own events come on its runs,
// and no other's.
test("events come again only once their kind has no others left: from each start, over 100 voyages, none twice on the run in 9 of 10, nor at the colony's places; and a background's own events on its runs alone (M36)", () => {
  const twice = (ids) => ids.length !== new Set(ids).size;
  const pooled = (id) => id && !rules.events.get(id)?.quest;
  for (const [id, all] of [['miner', refittingAll], ['deserter', desertersAll], ['smuggler', smugglersAll]]) {
    const onRun = all.filter((r) => twice(r.steps.filter((step) => step.kind === 'event' && pooled(step.event)).map((step) => step.event))).length;
    const atColony = all.filter((r) => twice((r.tally.trips?.flown ?? []).map((flown) => flown.event).filter(pooled))).length;
    assert.ok(onRun <= RATE_RUNS / 10, `${id}: an event met twice on the run in ${onRun} of ${RATE_RUNS}`);
    assert.ok(atColony <= RATE_RUNS / 10, `${id}: an event met twice at the colony in ${atColony} of ${RATE_RUNS}`);
    const met = new Set(all.flatMap((r) => r.steps.filter((step) => step.kind === 'event').map((step) => step.event)));
    const own = [...rules.events.values()].filter((event) => event.background === id).map((event) => event.id);
    const others = [...rules.events.values()].filter((event) => event.background && event.background !== id).map((event) => event.id);
    assert.equal(own.length, 4);
    assert.deepEqual(own.filter((event) => !met.has(event)), [], `${id}: its own events met`);
    assert.deepEqual(others.filter((event) => met.has(event)), [], `${id}: none of another's`);
  }
});

test("the careful player takes the companions' chains (M33c): it signs each on at their chain's step, never before the launch, and takes them to their loyalty place; the report says who", () => {
  const joined = new Set();
  const loyal = new Set();
  for (const [id, all] of [['miner', refittingAll], ['deserter', desertersAll], ['smuggler', smugglersAll]]) {
    for (const r of all) {
      const { met, joined: signed } = r.tally.companions;
      assert.ok(signed.every((who) => met.includes(who)), `${id}: signed on only at their chain's step (${signed} of ${met})`);
      assert.ok([...rules.companions.values()].every((companion) => !r.tally.quests.launch[companion.chain]), `${id}: no chain before the launch`);
      // One side's chain at a time.
      const chains = [...rules.quests.values()].filter((quest) => quest.side).map((quest) => quest.id);
      const notes = r.tally.questNotes.filter((note) => chains.includes(note.quest));
      let open = 0;
      for (const note of notes) {
        open += note.did === 'started' ? 1 : 0;
        assert.ok(open <= 1, `${id}: two side's chains at once`);
        if (note.did !== 'started') open -= 1;
      }
      for (const who of signed) joined.add(who);
      const end = r.travelled ?? r.campaign;
      for (const member of end.crew.filter((m) => m.loyal)) {
        assert.ok(signed.includes(member.companion), `${id}: loyal, ${member.companion} signed on first`);
        assert.equal(end.quests[rules.companions.get(member.companion).loyalty].state, 'done', `${id}: loyal once the place is won`);
        loyal.add(member.companion);
      }
      // Aboard and not loyal: their place is still to win, or lost.
      for (const member of end.crew.filter((m) => m.companion && !m.loyal)) assert.equal(end.quests[rules.companions.get(member.companion).loyalty].state, 'open');
    }
  }
  assert.deepEqual([...joined].sort(), [...rules.companions.keys()].sort(), 'each companion signs on in some run');
  assert.ok(loyal.size >= 3, `loyal in some runs: ${[...loyal]}`);
  const side = voyagesByBackground(rules, 1);
  const at = side.lines.indexOf("The companions (M33c), each met at their chain's step, signed on, and loyal by the end:");
  assert.ok(at > 0, side.lines.join('\n'));
  assert.match(side.lines[at + 1], /^Debt-bound miner +Ines Varga met in [01], signed on in [01], loyal in [01]; Teo Brandt met in [01], signed on in [01], loyal in [01]; Ama Osei met in [01], signed on in [01], loyal in [01]; Dez Halloran met in [01], signed on in [01], loyal in [01]$/);
});

test("at a station of the pursuer's side the first trade since the ship arrived pays its docking heat, once a visit, and the managing player passes some by (M33's fix)", () => {
  const trades = ['buy', 'hire', 'swap', 'patch', 'repair'];
  let paid = 0;
  let passed = 0;
  for (const [i, trip] of [...refittingAll, ...desertersAll, ...smugglersAll].entries()) {
    let traded = false;
    // On the run in act 2, and from M38d on the voyage out from the colony.
    for (const step of [...trip.steps, ...(trip.out?.steps ?? [])]) {
      if (['jump', 'long', 'sector', 'system', 'out', 'beyond'].includes(step.kind)) traded = false;
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

// M33b's: the careful player takes the quests' steps. Act 1's test run does
// the thread's job before every launch (tools/run.js); on the run the
// voyage's player goes by a quest's node where its way allows and does the
// step there, in most runs, the rest gone cold as the ship leaves the
// charts; at the colony it flies to the quest's place, and a win there is
// the pay-off: the colony's odds of being found fall by more than half. It
// lends the Fleet's tender a hand where the chain would leave the crew
// friendly with the Fleet: some of the miner's runs, none of the deserter's,
// whose pursuer's side the Fleet is; a patrol waves the miner through in
// some. The report says each quest's steps, the chain and the odds.
test("the careful player takes the quests' steps: the thread's job before the launch, its event on the run, its place at the colony and its pay-off; the Fleet's chain where it befriends the Fleet, and a patrol's wave (M33b)", () => {
  const mean = (days) => days.reduce((sum, day) => sum + day.found, 0) / days.length;
  for (const [id, all] of [['miner', refittingAll], ['deserter', desertersAll], ['smuggler', smugglersAll]]) {
    const thread = [...rules.quests.values()].find((quest) => quest.background === id);
    assert.ok(all.every((r) => r.launched && r.ended), `${id}: every run settles a world`);
    assert.ok(all.every((r) => JSON.stringify(r.tally.quests.launch[thread.id]) === JSON.stringify({ step: 1, state: 'open' })), `${id}: the thread's job done before every launch`);
    const landing = all.map((r) => r.tally.quests.landing[thread.id]);
    assert.ok(landing.every((at) => (at.step === 2 && at.state === 'open') || (at.step === 1 && at.state === 'cold')), `${id}: the run's step done, or gone cold leaving the charts`);
    const done = landing.filter((at) => at.step === 2).length;
    assert.ok(done >= 80, `${id}: the run's step done in ${done} of ${RATE_RUNS}`);
    for (const r of all) for (const note of r.tally.questNotes) assert.ok(note.sector >= 1 && note.sector <= LAST, `${id}: a quest moved in sector ${note.sector}`);
    const paid = all.filter((r) => r.tally.raids.payoff !== null);
    assert.ok(paid.length > 0 && paid.every((r) => r.tally.quests.end[thread.id].state === 'done'), `${id}: the place won and the thread done in ${paid.length} runs`);
    const days = paid.flatMap((r) => r.tally.raids.odds);
    const [before, after] = [days.filter((day) => !day.eased), days.filter((day) => day.eased)];
    assert.ok(after.length > 0 && mean(after) < mean(before) / 2, `${id}: found ${mean(before).toFixed(1)}% a day before the pay-off, ${mean(after).toFixed(1)}% after`);
  }
  const chains = (all) => all.map((r) => r.campaign.quests.tender).filter(Boolean);
  assert.ok(chains(refittingAll).some((chain) => chain.state === 'done'), `the miner's chain started in ${chains(refittingAll).length} runs`);
  // Never befriending the Fleet, the deserter started it in M33b in no run;
  // from M33c it starts it for Varga too, where she could come aboard.
  assert.ok(refittingAll.some((r) => r.tally.waved > 0), 'a patrol waves the miner through in some runs');
  const side = voyagesByBackground(rules, 1);
  const at = side.lines.indexOf('The quests (M33b):');
  assert.ok(at > 0, side.lines.join('\n'));
  assert.match(side.lines[at + 1], /^Debt-bound miner +The miner's debt: act 1's step done in 1 of 1, the run's in [01] of 1 \([01] gone cold\), its place won in [01] \(\d+ fights? lost there\)\. The Fleet's chain: started in [01], done in [01], gone cold in [01]; waved through in [01] runs? \(\d+ times?\)\. In the [01] runs? with a pay-off, found .+ a day before it \(\d+ days\) and .+ after \(\d+\), raids faced \d+ before and \d+ after\.$/);
});

// M38d's: the voyage out from the colony once its 60 days are played, over
// RATE_RUNS of the refitting player's runs (see the top of the file). Over
// those 100 it flew out in all and came home in all, crossing 3 systems
// (0 to 3), 2 aboard (2 to 5) and 1 at home; nobody went hungry, at home or
// aboard. The rates hold within MARGIN of those (VOYAGE_OUT). M38d's fix
// moved them on purpose: the player stocks the holds before it flies and
// flies home when a raid is coming, so 96 crossed a system where 87 had,
// and those aboard went hungry in none where they had in 1.
const VOYAGE_OUT = { home: 100, crossed: 96, fed: 100, fedAboard: 100 };
test("after the colony's 60 days the careful player stocks the holds and flies out with the healthiest who fit aboard, one left home, plays the systems past the colony's as act 2's sectors, a day passing at home each jump, and flies home at the last system's jump point, once the holds come down to the way home's supplies and a buffer, or when a raid is coming (M38d and its fix)", () => {
  const share = (member) => member.hp / maxHp(member, rules);
  for (const [i, r] of refittingAll.entries()) {
    const seed = i + 1;
    const { out } = r;
    assert.ok(out?.flown, `seed ${seed}: flies out`);
    const { before, crew, home, tally } = out;
    assert.equal(before.colony.day, r.travelled.colony.day + out.waited + out.stocked, `seed ${seed}: once the colony's days are played, any raid coming faced and the holds stocked`);
    // Stocked (M38d's fix): the food fills the holds, or the days to wait
    // for it ran out, or the farms can grow no more than the crew eats with
    // no mine digging toward another.
    const { made } = colonyStats(before, rules);
    const stuck = made.food <= before.crew.length * balance.jumpSupplies && made.materials === 0;
    assert.ok(out.full || out.stocked === STOCK_DAYS || stuck, `seed ${seed}: flew out with ${before.supplies} food after ${out.stocked} days stocking`);
    // Who goes: one or more aboard, the healthiest; one left home with two
    // or more, and more only where the ship could fly no more.
    assert.deepEqual([...crew, ...home].sort((a, b) => a - b), before.crew.map((member) => member.id).sort((a, b) => a - b));
    assert.ok(crew.length >= 1 && home.length >= Math.min(1, before.crew.length - 1), `seed ${seed}: ${crew.length} aboard, ${home.length} at home`);
    const [aboard, stay] = [crew, home].map((ids) => before.crew.filter((member) => ids.includes(member.id)));
    assert.ok(aboard.every((a) => stay.every((h) => share(a) >= share(h))), `seed ${seed}: the healthiest go`);
    const next = [...stay].sort((a, b) => share(b) - share(a) || before.crew.indexOf(a) - before.crew.indexOf(b))[0];
    if (stay.length > 1) assert.equal(voyagePlan(before, rules, [...crew, next.id]).ok, false, `seed ${seed}: no room for one more`);
    // The systems, in a line from the colony's: each with its two worlds,
    // none named twice, nor as the colony's own system.
    assert.ok(tally.crossed <= VOYAGE_SYSTEMS && [tally.crossed, tally.crossed + 1].includes(out.systems.length), `seed ${seed}: ${out.systems.length} systems entered, ${tally.crossed} crossed`);
    const names = out.systems.map((sector) => sector.name);
    assert.equal(new Set(names).size, names.length, `seed ${seed}: ${names}`);
    assert.ok(!names.includes(r.system.name), `seed ${seed}: the colony's system's name again`);
    assert.ok(out.systems.every((sector) => sector.nodes.filter((node) => node.world).length === rules.worlds.voyage.worlds));
    // A day a jump: each jump (out, on into the next system and the long
    // ones too), each day hidden or rested, and each day of the flight home;
    // from M38e each day at a second colony too.
    assert.ok(out.back, `seed ${seed}: comes home`);
    assert.equal(out.colony.days, tally.jumps + tally.regroups + tally.hides + out.back.days + (out.second?.days ?? 0), `seed ${seed}: the colony's days away`);
    // Home at the last system's jump point, once the holds came down to the
    // way home's supplies and the buffer, or with a raid coming that the
    // flight home lands before (M38d's fix); or from M38e straight back
    // from a second colony (its own test, below).
    const step = out.steps.find((s) => s.kind === 'home');
    if (out.second) assert.equal(step, undefined, `seed ${seed}: flown back from the second colony, not home from the run`);
    else {
      // From M38f the flight lands the day before a raid it is for: on its
      // day the raid is fought out without the ship.
      assert.ok((step.atExit && step.out === VOYAGE_SYSTEMS) || step.supplies[0] <= step.eats + HOME_JUMPS * step.each || (step.coming !== null && step.flight < step.coming), `seed ${seed}: home with ${step.supplies[0]} supplies, ${step.out} systems out`);
      assert.equal(out.back.called, step.coming !== null);
    }
    // Landed: the ship home and the crew one again in its order, with whoever
    // signed on aboard, and from M38e without whoever stayed at a second.
    assert.equal(out.campaign.colony.voyage, null);
    assert.equal(out.campaign.colony.id, 1);
    const ids = out.back.landed;
    assert.deepEqual(ids, [...ids].sort((a, b) => a - b));
    assert.equal(ids.length, before.crew.length + tally.hired + tally.companions.joined.length - (out.second?.left.length ?? 0), `seed ${seed}: the crew landed`);
    // A raid found while the ship is away comes down no sooner than the
    // flight home lands (M38d's fix), and the player flies home for it: each
    // is met at home with everyone, none by those left there alone.
    assert.deepEqual(out.raids.faced.filter((raid) => raid.away), [], `seed ${seed}: a raid faced while away`);
    for (const raid of out.raids.faced.slice(out.prior)) assert.ok(raid.home > home.length, `seed ${seed}: ${raid.home} defending`);
  }
  // As act 2's sectors: stations, jobs, yards, refits, events and hostile
  // ships among them.
  const runs = (test) => refittingAll.filter((r) => test(r.out)).length;
  for (const kind of ['buy', 'job', 'yard', 'refit', 'event', 'approach', 'hire']) assert.ok(runs((out) => out.steps.some((step) => step.kind === kind)) > 0, `a ${kind} on some voyage out`);
  const rates = { home: runs((out) => out.back), crossed: runs((out) => out.tally.crossed > 0), fed: runs((out) => out.colony.hungry === 0), fedAboard: runs((out) => out.tally.hungryJumps === 0 && !out.back?.hungry) };
  for (const key of Object.keys(VOYAGE_OUT)) assert.ok(VOYAGE_OUT[key] - rates[key] <= MARGIN, `${key}: ${rates[key]} of ${RATE_RUNS}, ${VOYAGE_OUT[key]} measured`);
  // A tally of its own: act 2's and the colony's as without it.
  const [flown, stayed] = [{}, { out: 'no' }].map((options) => voyage(rules, SEEDS[0], { refit: 'yes', jobs: 'yes', ...options }, lifts[0]));
  assert.deepEqual(flown.tally, stayed.tally);
  assert.deepEqual(flown.steps, stayed.steps);
  assert.equal(stayed.out, null);
  // A raid coming calls the ship home: on 1 or 2 of the miner's 100
  // voyages out, and since M40 on none of seeds 1 to 100, so seed 130's,
  // one of 3 among seeds 101 to 220, shows it.
  const lifted = launchedAt(rules, 130);
  assert.ok(voyage(rules, 130, { refit: 'yes', jobs: 'yes', fit: powered(lifted) }, lifted).out.back.called, "a raid calls the ship home on seed 130's voyage out");
  assert.match(outSummary(refittingAll), /^The voyage out \(M38d\): flown in 100 of 100, home in \d+; .+ systems crossed \d+ \(\d+ to \d+\), all 3 in \d+; days away .+ At home: found in \d+ runs, calling the ship home in \d+; raids faced while away \d+, lost \d+ .+ met at home once back \d+, won \d+; fed all the while in \d+ of 100; the mines' digging past the storehouses lost in \d+ runs \(\d+ in all\)\. Before flying out, \d+ \(\d+ to \d+\) days stocking the holds, full in \d+ runs; flying out, food spoiled in \d+ runs \(\d+ in all\)\.$/);
  assert.match(flown.lines.at(-1), /^The voyage out: [0-3] of 3 systems crossed, home after \d+ days away(, called home by a raid)?; /);
});

// M38e's: on its voyage out the careful player settles the best world of
// its SETTLE_SYSTEM'th system out, gives the new colony the ship's parts
// and plays its first NEW_DAYS days building farms and mines (a raid
// coming there waited for, one coming at the first cutting them short),
// leaves the least fit there when three or more landed, and flies
// straight back to the first colony. Measured over the same 100 voyages.
const SECOND = { founded: 75 };
test("on its voyage out the careful player settles a world in its second system, plays the new colony's first days building farms and mines, leaves one there when three or more landed, and flies straight back to the first colony (M38e)", () => {
  for (const [i, r] of refittingAll.entries()) {
    const seed = i + 1;
    const second = r.out?.second;
    if (!second) {
      // No second colony: the voyage went home from the run first (M38d).
      assert.ok(r.out.steps.some((step) => step.kind === 'home'), `seed ${seed}: neither settled nor home`);
      continue;
    }
    const { settled, founded, before, crew, left, back } = second;
    // Settled in the SETTLE_SYSTEM'th system out, the colony a number and a
    // place of its own, the first kept with those at home.
    assert.equal(settled.colony.id, 2);
    assert.equal(settled.colony.at, SETTLE_SYSTEM);
    assert.ok(r.out.systems.length === SETTLE_SYSTEM, `seed ${seed}: settled in system ${r.out.systems.length}`);
    assert.deepEqual(settled.colonies.map((colony) => colony.id), [1]);
    assert.ok(founded.given.length > 0, `seed ${seed}: gave the ship's parts`);
    // Its first days: NEW_DAYS, or fewer once the first is found, and
    // more waiting for a raid coming there.
    assert.ok(second.called ? second.days < NEW_DAYS : second.days >= NEW_DAYS, `seed ${seed}: ${second.days} days there`);
    // Who stays: the least fit of three or more, else nobody (fewer flying
    // only where the ship can't carry them all).
    const landed = before.crew.map((member) => member.id);
    assert.deepEqual([...crew, ...left].sort((a, b) => a - b), [...landed].sort((a, b) => a - b));
    if (landed.length >= 3) assert.ok(left.length >= 1, `seed ${seed}: ${landed.length} landed, ${left.length} stayed`);
    else assert.deepEqual(left, [], `seed ${seed}: nobody stays of ${landed.length}`);
    // Straight back to the first: a day a system between, no stop but a
    // lander's; the second keeps those who stayed.
    assert.ok(back, `seed ${seed}: flies back`);
    assert.equal(back.flight, SETTLE_SYSTEM);
    assert.ok(back.days === SETTLE_SYSTEM || back.stops > 0, `seed ${seed}: ${back.days} days back`);
    const there = r.out.campaign.colonies.find((colony) => colony.id === 2);
    assert.deepEqual(there.keep.crew.map((member) => member.id), left);
    assert.ok(there.buildings.length > 0, `seed ${seed}: the second colony stands`);
    assert.ok(there.buildings.some((b) => rules.colony.builds.get(b.type)?.makes), `seed ${seed}: a farm or a mine built there`);
  }
  const founded = refittingAll.filter((r) => r.out?.second).length;
  assert.ok(founded >= SECOND.founded - MARGIN, `founded on ${founded} of ${RATE_RUNS} voyages out`);
  assert.match(secondSummary(refittingAll), /^More colonies \(M38e\): founded on \d+ of 100 voyages out, in system 2; days there .+ Raids since flying out: at the first found \d+, faced \d+, lost \d+; at the second found \d+, faced \d+, lost \d+\. Every colony fed all the while in \d+ of 100\.$/);
  // With --settle no, the voyage out is M38d's.
  const stayed = voyage(rules, SEEDS[0], { refit: 'yes', jobs: 'yes', settle: 'no' }, lifts[0]);
  assert.equal(stayed.out.second, undefined);
  assert.ok(stayed.out.steps.some((step) => step.kind === 'home'));
});

// M38f's: back from its voyage out the careful player plays the first
// colony's next AFTER_DAYS days as its first, the second living them too.
// Measured over the same 100 voyages (PROGRESS.md): citizens at the first
// in 86 (1, 0 to 5), at the second in 42 of 76 (1, 0 to 5); since flying
// out 133 came, 5 left short of food and 7 fell in raids, and 1 freed
// captive settled; 1 raid fought out without the ship, lost. CITIZENS holds
// those rates within MARGIN.
const CITIZENS = { first: 86, second: 42 };
test("back from its voyage out the careful player plays the first colony's next 20 days, the second living them too; citizens come at both, and a raid where the ship isn't is fought out without it (M38f)", () => {
  assert.equal(AFTER_DAYS, 20);
  for (const [i, r] of refittingAll.entries()) {
    const seed = i + 1;
    const { out } = r;
    const { after } = out;
    assert.ok(after, `seed ${seed}: the days after the voyage`);
    // Twenty days at the first, every colony living them.
    const dayOf = (campaign, id) => (campaign.colony.id === id ? campaign.colony : campaign.colonies.find((colony) => colony.id === id)).day;
    for (const [id] of after.citizens) assert.equal(dayOf(after.campaign, id), dayOf(out.campaign, id) + AFTER_DAYS, `seed ${seed}: colony ${id}'s days`);
    assert.deepEqual(after.citizens.map(([id]) => id), out.second ? [1, 2] : [1]);
    // The citizens now are those at flying out, with those who came and
    // settled, less those who left and fell.
    const now = after.citizens.reduce((sum, [, n]) => sum + n, 0);
    assert.equal(now, (out.before.colony.citizens ?? 0) + after.grown + after.settled - after.left - after.fell, `seed ${seed}: the headcount`);
    assert.equal(after.won + after.lost, after.foughtOut);
    // None faced while the ship was away: fought out without it.
    assert.deepEqual([...out.raids.faced, ...after.raids.faced].filter((raid) => raid.away), [], `seed ${seed}: a raid faced while away`);
    assert.equal(after.campaign.crew.length + after.campaign.colonies.reduce((sum, colony) => sum + colony.keep.crew.length, 0), out.campaign.crew.length + out.campaign.colonies.reduce((sum, colony) => sum + colony.keep.crew.length, 0), `seed ${seed}: crew are never killed`);
  }
  const runs = (id) => refittingAll.filter((r) => (r.out.after.citizens.find(([colony]) => colony === id)?.[1] ?? 0) > 0).length;
  assert.ok(runs(1) >= CITIZENS.first - MARGIN, `citizens at the first in ${runs(1)} of ${RATE_RUNS}`);
  assert.ok(runs(2) >= CITIZENS.second - MARGIN, `citizens at the second in ${runs(2)}`);
  assert.match(citizensSummary(refittingAll), /^Citizens \(M38f\): back from the voyage out and 20 days more at the first colony, at the first \d+ \(\d+ to \d+\), in \d+ of 100; at the second \d+ \(\d+ to \d+\), in \d+ of \d+\. Since flying out \d+ came, \d+ left short of food, \d+ fell in raids, \d+ freed captives? settled\. Raids fought out without the ship \d+: won \d+, lost \d+\. Hungry days in the 20: \d+, in \d+ runs\.$/);
});
