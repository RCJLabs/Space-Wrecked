// M32: what each crew job brings besides a fight. A ship effect each, while
// one of the job is aboard on the run, and a colony effect each, while one
// is home (or, as the effect says, in the squad or anywhere in the crew).
// A second of the same job adds nothing. Each test sets a crew member to
// the job, or away from it, and shows the rule at work.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeSave, MIGRATIONS, parseSave } from '../src/core/save.js';
import { choicesFor, hitChance, sideStats } from '../src/sim/approach.js';
import { campaignProblems, maxHp } from '../src/sim/campaign.js';
import { colonyStats, storesOf } from '../src/sim/colony.js';
import { buildPlan } from '../src/sim/colonyBuild.js';
import { dayPlan } from '../src/sim/days.js';
import { colonyBy, colonyEdge, stationBy, stationEdge } from '../src/sim/edges.js';
import { approachIntent, approachState } from '../src/sim/encounter.js';
import { flyOut, homePlan, rollPlaces, tripPlan } from '../src/sim/expeditions.js';
import { launch } from '../src/sim/launch.js';
import { healRate } from '../src/sim/medbay.js';
import { landingPlan } from '../src/sim/raids.js';
import { initialState, saveData } from '../src/sim/root.js';
import { survey, surveyPlan } from '../src/sim/survey.js';
import { beginRun, jump, jumpPlan, knownNodes, leaveSector, linked, scan, scanPlan, suppliesOver, supplyCapacity, within } from '../src/sim/travel.js';
import { rules } from './battleKit.js';
import { settled } from './colonyKit.js';
import { CUTTER_SEED, readyToLaunch } from './launchKit.js';

const { balance } = rules;
const effect = (job, layer, key) => rules.jobs.get(job)[layer][key];

// The campaign with crew member `i` (0 first) in `job`, their hit points
// held to the job's most.
function withJob(campaign, i, job) {
  const crew = campaign.crew.map((member, n) => (n === i ? { ...member, job } : member));
  return { ...campaign, crew: crew.map((member) => ({ ...member, hp: Math.min(member.hp, maxHp(member, rules)) })) };
}

// The campaign with no one in `job`: each of them a medic instead (or for
// the medic, a marine), whose effects are none of the job's.
function without(campaign, job) {
  const instead = job === 'medic' ? 'marine' : 'medic';
  return campaign.crew.reduce((at, member, i) => (member.job === job ? withJob(at, i, instead) : at), campaign);
}

const onRun = (extra = {}) => beginRun(launch(readyToLaunch(extra), rules).campaign, rules).campaign;

// The run with a pirate cutter at the first node on, jumped to: its
// approach open.
function atCutter(campaign) {
  const { sector } = campaign.run;
  const to = linked(sector, sector.start)[0];
  const nodes = sector.nodes.map(({ event, hostile, ...node }) => (node.id === to ? { ...node, type: 'hostile', hostile: { ship: 'cutter', seed: CUTTER_SEED } } : node));
  return jump({ ...campaign, run: { ...campaign.run, sector: { ...sector, nodes } } }, rules, to).campaign;
}

// The run in the system past the charts, at world `id`: from the last
// sector's jump point, as colonyKit.js reaches it.
function atWorld(campaign, id = 1) {
  const { sector } = campaign.run;
  const sectors = rules.acts.get(2).sectors;
  const past = rules.sectors.names.sectors.filter((name) => name !== sector.name).slice(0, sectors - 1);
  const exit = { ...campaign, run: { ...campaign.run, sector: { ...sector, index: sectors }, at: sector.exit, seen: [...campaign.run.seen, sector.exit], past } };
  const left = leaveSector(exit, rules);
  assert.equal(left.ok, true, left.error);
  const system = left.campaign;
  return { ...system, run: { ...system.run, at: id, seen: [...system.run.seen, id] } };
}

// The colony with these buildings standing: [type, x, y], in that order.
function withBuildings(campaign, list) {
  const buildings = list.map(([type, x, y], i) => ({ uid: i + 1, type, x, y, rot: 0 }));
  return { ...campaign, colony: { ...campaign.colony, buildings, nextUid: buildings.length + 1 } };
}

const rock = { kind: 'rock', name: 'The Anvil', days: 2, event: 'rich-seam', held: false, seed: 11 };
const near = { kind: 'rock', name: 'Old Red', days: 1, event: 'rich-seam', held: false, seed: 12 };

test('the best of a job counts, once: a second of the same job adds nothing, and the screens name the first who brings it', () => {
  const crew = [{ id: 1, name: 'A', job: 'marine' }, { id: 2, name: 'B', job: 'marine' }, { id: 3, name: 'C', job: 'medic' }];
  assert.equal(stationEdge(crew, rules, 'gunnery'), effect('marine', 'station', 'gunnery'));
  assert.equal(colonyEdge(crew, rules, 'landing'), effect('marine', 'colony', 'landing'));
  assert.equal(stationEdge(crew, rules, 'scan'), 0);
  assert.equal(stationEdge([], rules, 'gunnery'), 0);
  assert.equal(stationEdge([{ id: 1, name: 'X', job: 'cook' }], rules, 'gunnery'), 0, 'a job the data lacks brings nothing');
  assert.equal(stationBy(crew, rules, 'gunnery').id, 1);
  assert.equal(colonyBy(crew, rules, 'heal').id, 3);
  assert.equal(stationBy(crew, rules, 'scan'), null);
});

test('marine and pilot aboard: the ship\'s guns are surer, and the ship harder to hit, in the approach, as shown', () => {
  const campaign = atCutter(onRun());
  assert.equal(campaign.crew[0].job, 'marine');
  const state = approachState(campaign, rules);
  assert.deepEqual(state.you.edge, { gunnery: effect('marine', 'station', 'gunnery'), evasion: 0 });
  const them = sideStats(state.them, rules);
  const you = sideStats(state.you, rules);
  const intent = approachIntent(campaign, rules);
  const fire = choicesFor(state, intent, rules).find((choice) => choice.order.kind === 'fire');
  assert.equal(fire.chance, hitChance(them, intent.kind === 'evade', rules) + 10, 'the marine adds 10');
  // No marine: the guns' own chance.
  const plain = approachState(without(campaign, 'marine'), rules);
  assert.equal(choicesFor(plain, intent, rules).find((choice) => choice.order.kind === 'fire').chance, hitChance(them, intent.kind === 'evade', rules));
  // A pilot: the ship's evasion 10 more, so their guns' chance 10 less.
  const piloted = approachState(withJob(campaign, 1, 'pilot'), rules);
  assert.equal(sideStats(piloted.you, rules).evasion, you.evasion + effect('pilot', 'station', 'evasion'));
  assert.equal(hitChance(sideStats(piloted.you, rules), false, rules), hitChance(you, false, rules) - 10);
  // The edge comes from the crew aboard as it is: nothing of it is saved.
  assert.equal(campaign.run.approach.you.edge, undefined);
});

test('engineer aboard: after each jump the cheapest wrecked part is fixed, on the way, as the plan shows', () => {
  const run = onRun();
  assert.equal(run.crew[1].job, 'engineer');
  const gun = run.ship.modules.find((module) => module.type === 'weapon').uid;
  const quarters = run.ship.modules.find((module) => module.type === 'quarters').uid;
  const wrecked = { ...run, wrecks: { [gun]: 'fire', [quarters]: 'rubble' } };
  const to = linked(run.run.sector, run.run.sector.start)[0];
  const plan = jumpPlan(wrecked, rules, to);
  // The cheaper of the two first, the quarters: one a jump.
  assert.ok(rules.modules.get('quarters').cost < rules.modules.get('weapon').cost);
  assert.deepEqual(plan.fixes.map((fix) => [fix.uid, fix.type]), [[quarters, 'quarters']]);
  const after = jump(wrecked, rules, to).campaign;
  assert.deepEqual(after.wrecks, { [gun]: 'fire' });
  assert.equal(after.flags.jumpFixes, 1);
  assert.deepEqual(campaignProblems(after), []);
  // Without an engineer the wrecks stay.
  const alone = without(wrecked, 'engineer');
  assert.deepEqual(jumpPlan(alone, rules, to).fixes, []);
  assert.deepEqual(jump(alone, rules, to).campaign.wrecks, wrecked.wrecks);
  // Nothing wrecked, nothing to fix.
  assert.deepEqual(jumpPlan(run, rules, to).fixes, []);
});

test('medic aboard: a working med bay heals 1 more a jump (M23)', () => {
  const run = onRun();
  const bay = rules.modules.get('medbay').heal;
  const withBay = { ...run, ship: { ...run.ship, modules: [...run.ship.modules, { uid: 99, type: 'medbay', x: 0, y: 0, rot: 0 }] } };
  assert.equal(healRate(withBay, rules), bay + effect('medic', 'station', 'heal'));
  assert.equal(healRate(without(withBay, 'medic'), rules), bay);
});

test('scout aboard: a scan reaches a link farther; each scan keeps its reach, so the scout leaving hides nothing', () => {
  const run = withJob(onRun(), 1, 'scout');
  const { sector } = run.run;
  const plain = scanPlan(without(run, 'scout'), rules);
  const plan = scanPlan(run, rules);
  assert.equal(plain.reach, balance.scanRange);
  assert.equal(plan.reach, balance.scanRange + effect('scout', 'station', 'scan'));
  assert.equal(plan.reach, 3);
  // The nodes three links out not on the charts: only the scout's scan
  // shows them.
  const charted = knownNodes(run.run, rules);
  const far = [...within(sector, sector.start, plan.reach)].filter(([id, links]) => links === plan.reach && !charted.has(id)).map(([id]) => id);
  assert.ok(far.length > 0, 'a node three links out');
  assert.ok(far.every((id) => plan.reveals.includes(id) && !plain.reveals.includes(id)));
  const scanned = scan(run, rules).campaign;
  assert.deepEqual(scanned.run.scans, [{ at: sector.start, reach: 3 }]);
  for (const id of far) assert.ok(knownNodes(scanned.run, rules).has(id));
  // The scout let go: what the scan showed stays known.
  const gone = without(scanned, 'scout');
  for (const id of far) assert.ok(knownNodes(gone.run, rules).has(id));
  assert.deepEqual(campaignProblems(scanned), []);
  // A scan without the scout first, then with one: the same node again,
  // farther.
  const first = scan(without(run, 'scout'), rules).campaign;
  const again = scan(withJob(first, 1, 'scout'), rules);
  assert.equal(again.ok, true, again.error);
  assert.deepEqual(again.campaign.run.scans, [{ at: sector.start, reach: 2 }, { at: sector.start, reach: 3 }]);
  assert.deepEqual(campaignProblems(again.campaign), []);
  assert.deepEqual(campaignProblems({ ...again.campaign, run: { ...again.campaign.run, scans: [{ at: sector.start, reach: 2 }, { at: sector.start, reach: 2 }] } }), ["The campaign's run has unreadable scans."]);
});

test('xenobiologist aboard: a survey takes no day, eating nothing, adding no heat and giving the hunters no roll', () => {
  const there = atWorld(withJob(onRun({ heat: 80 }), 1, 'xenobiologist'));
  const plan = surveyPlan(there, rules);
  assert.deepEqual(plan, { ok: true, free: true, supplies: 0, heat: 0, hunt: null });
  const done = survey(there, rules);
  assert.equal(done.ok, true, done.error);
  assert.deepEqual([done.campaign.supplies, done.campaign.heat, done.campaign.rng, done.hunt], [there.supplies, there.heat, there.rng, null]);
  assert.deepEqual([done.campaign.flags.surveys, done.campaign.flags.freeSurveys], [1, 1]);
  assert.deepEqual(done.campaign.run.surveyed, [there.run.at]);
  // Even short of supplies.
  assert.equal(surveyPlan({ ...there, supplies: 0 }, rules).ok, true);
  // Without one: a day's supplies and heat, and the hunters' odds.
  const day = surveyPlan(without(there, 'xenobiologist'), rules);
  assert.deepEqual([day.free, day.supplies > 0, day.heat > 0, day.hunt !== null], [false, true, true, true]);
});

test('quartermaster aboard: the lockers hold 10 more supplies; the quartermaster gone, what is past them stays behind', () => {
  const ready = launch(readyToLaunch(), rules).campaign;
  const stocked = beginRun(withJob(ready, 1, 'quartermaster'), rules).campaign;
  const plain = beginRun(ready, rules).campaign;
  assert.equal(supplyCapacity(stocked.ship, rules, stocked.crew), supplyCapacity(plain.ship, rules, plain.crew) + effect('quartermaster', 'station', 'lockers'));
  assert.equal(stocked.supplies, plain.supplies + 10, 'the hangar fills the deeper lockers');
  assert.equal(supplyCapacity(stocked.ship, rules), supplyCapacity(stocked.ship, rules, []), 'no crew, no edge');
  assert.equal(suppliesOver(stocked, rules), 0);
  assert.equal(suppliesOver(without(stocked, 'quartermaster'), rules), 10);
  const to = linked(stocked.run.sector, stocked.run.sector.start)[0];
  assert.equal(jumpPlan(without(stocked, 'quartermaster'), rules, to).left, 10);
});

test('marine at home: each defense\'s shot at a lander hits at 60%; with the marine away on a trip, 50%', () => {
  const landed = settled();
  const armed = withBuildings({ ...landed, heat: 70 }, [['reactor', 6, 0], ['weapon', 0, 0]]);
  const down = { ...armed, colony: { ...armed.colony, day: 2, raid: { found: 1, lands: 2 } } };
  assert.equal(landingPlan(down, rules).hit, balance.landingHit + effect('marine', 'colony', 'landing'));
  assert.equal(landingPlan(without(down, 'marine'), rules).hit, balance.landingHit);
  const away = { ...down, colony: { ...down.colony, trip: { place: rock, squad: [1], done: false, result: null, leg: { dir: 'out', left: 1 } } } };
  assert.equal(landingPlan(away, rules).hit, balance.landingHit);
});

test('engineer and xenobiologist at home: each mine digs 1 more and each farm grows 1 more, as the build list shows', () => {
  const landed = withJob(settled(), 2, 'xenobiologist');
  assert.deepEqual(landed.crew.map((member) => member.job), ['marine', 'engineer', 'xenobiologist']);
  const { world } = landed.colony;
  const campaign = withBuildings(landed, [['farm', 4, 0], ['mine', 4, 3]]);
  const made = colonyStats(campaign, rules).made;
  const farm = Math.max(1, world.soil + world.water);
  const mine = Math.max(1, world.ore);
  assert.deepEqual(made, { food: farm + 1, materials: mine + 1 });
  assert.deepEqual(colonyStats(without(without(campaign, 'engineer'), 'xenobiologist'), rules).made, { food: farm, materials: mine });
  assert.deepEqual(buildPlan(landed, rules, { build: 'farm' }).makes, { food: farm + 1 });
  assert.deepEqual(dayPlan(campaign, rules).made, made);
  // Away on a trip, they add nothing.
  const away = { ...campaign, colony: { ...campaign.colony, trip: { place: rock, squad: [2, 3], done: false, result: null, leg: null } } };
  assert.deepEqual(colonyStats(away, rules).made, { food: farm, materials: mine });
});

test('medic at home: a powered infirmary heals 1 more a day (M26)', () => {
  const ward = withBuildings({ ...settled(), crew: settled().crew.map((member) => ({ ...member, hp: 1 })) }, [['medbay', 4, 0]]);
  const own = colonyStats(ward, rules).infirmary;
  assert.deepEqual(Object.values(dayPlan(ward, rules).heals), [1, 1, 1].map(() => balance.regroupHp + own + effect('medic', 'colony', 'heal')));
  assert.deepEqual(Object.values(dayPlan(without(ward, 'medic'), rules).heals), [1, 1, 1].map(() => balance.regroupHp + own));
});

test('pilot in the squad: each leg of a trip is a day shorter, never under 1', () => {
  const landed = withJob(settled(), 1, 'pilot');
  const listed = { ...landed, colony: { ...landed.colony, places: [rock, near] } };
  const flown = tripPlan(listed, rules, 0, [2]);
  assert.equal(flown.ok, true, flown.error);
  assert.deepEqual(flown.days, { out: rock.days - 1, back: rock.days - 1 });
  assert.deepEqual(tripPlan(listed, rules, 0, [1]).days, { out: rock.days, back: rock.days }, 'the pilot at home');
  assert.deepEqual(tripPlan(listed, rules, 1, [2]).days, { out: 1, back: 1 }, 'never under a day');
  // Out and home again: a day each way, the trip's days as planned.
  const out = flyOut(listed, rules, 0, [2]);
  assert.equal(out.ok, true, out.error);
  assert.equal(out.days.length, 1);
  assert.equal(homePlan(out.campaign, rules).ok, false, 'its event first');
});

test('scout in the crew: a fourth place is within reach', () => {
  const landed = settled();
  assert.equal(rollPlaces(landed, rules).places.length, rules.expeditions.places);
  const scouted = withJob(landed, 1, 'scout');
  assert.equal(rollPlaces(scouted, rules).places.length, rules.expeditions.places + effect('scout', 'colony', 'places'));
  assert.equal(rollPlaces(scouted, rules).places.length, 4);
  // Anywhere in the crew: away on a trip too.
  const away = { ...scouted, colony: { ...scouted.colony, trip: { place: rock, squad: [2], done: false, result: null, leg: null } } };
  assert.equal(rollPlaces(away, rules).places.length, 4);
});

test('quartermaster in the crew: the stores keep 20 more food and 20 more materials, even with the quartermaster away', () => {
  const landed = settled();
  const stocked = withJob(landed, 1, 'quartermaster');
  const plain = storesOf(landed, rules);
  assert.deepEqual(storesOf(stocked, rules), { ship: plain.ship, colony: plain.colony + 20, total: plain.total + 20 });
  const away = { ...stocked, colony: { ...stocked.colony, trip: { place: rock, squad: [2], done: false, result: null, leg: null } } };
  assert.equal(storesOf(away, rules).total, plain.total + 20);
  assert.equal(dayPlan({ ...stocked, supplies: plain.total + 15 }, rules).lost.food, 0);
});

test('a v23 save: the run\'s scans each keep the 2 links they reached', () => {
  const scanned = scan(onRun(), rules).campaign;
  const { scans, ...rest } = scanned.run;
  const v23 = { ...saveData(initialState(3)), campaign: { ...scanned, run: { ...rest, scans: scans.map((made) => made.at) } } };
  const up = MIGRATIONS.find((step) => step.from === 23).up(v23);
  assert.deepEqual(up.campaign.run.scans, scans);
  assert.deepEqual(campaignProblems(up.campaign), []);
  const opened = parseSave(JSON.stringify({ version: 23, data: v23 }));
  assert.equal(opened.ok, true, opened.error);
  assert.deepEqual(opened.save.data.campaign.run.scans, scans);
  const again = parseSave(JSON.stringify(makeSave({ ...saveData(initialState(3)), campaign: scanned })));
  assert.equal(again.ok, true, again.error);
  assert.deepEqual(again.save.data.campaign.run.scans, scans);
  // Before the run, and with no campaign, nothing changes.
  assert.deepEqual(MIGRATIONS.find((step) => step.from === 23).up({ ...v23, campaign: { ...scanned, run: null } }).campaign.run, null);
  assert.equal(MIGRATIONS.find((step) => step.from === 23).up({ ...v23, campaign: null }).campaign, null);
});
