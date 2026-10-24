// M38f: citizens. Every colony keeps a headcount of citizens, not crew:
// each eats a jump's supplies a day, takes a bed and air after the crew
// there, and works a farm or a mine, one to each in the order built, for
// citizenWork more a day. A day fed, with a bed and air free and every
// building lit, counts toward the next; every citizenDays such days one
// more, and a hungry day one leaves. A captive freed on a voyage settles at
// the colony flown from, if it has room. A raid's lander coming down where
// the ship isn't is fought out at once, the AI playing both sides; in a
// raid the player fights, the citizens stand beside the crew as colonists.
// The fallen are gone, the crew wounded at worst, and while the ship is
// away the colony's news says what happened. Saves are at v38.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seedFrom } from '../src/core/rng.js';
import { makeSave, MIGRATIONS, parseSave, SAVE_VERSION } from '../src/core/save.js';
import { wholeCrew } from '../src/sim/away.js';
import { createBattle } from '../src/sim/battle.js';
import { battleProblem } from '../src/sim/battleShape.js';
import { campaignProblems, MAX_CREW } from '../src/sim/campaign.js';
import { MAX_CITIZENS, MAX_NEWS, withNews } from '../src/sim/colonies.js';
import { citizenEats, colonyStats } from '../src/sim/colony.js';
import { colonyMap, raidStarts, START_COLUMNS } from '../src/sim/colonyMap.js';
import { endJob } from '../src/sim/contracts.js';
import { citizensDay, dayPlan, nextDay, planDay } from '../src/sim/days.js';
import { flyHome, flyOut } from '../src/sim/expeditions.js';
import { fightOut, MAX_ROUNDS } from '../src/sim/fightOut.js';
import { launch } from '../src/sim/launch.js';
import { colonistsOf, defensesOf, endColonyRaid, faceRaid, fallenColonists, fightAway, landingPlan, raidTake } from '../src/sim/raids.js';
import { initialState, saveData } from '../src/sim/root.js';
import { stationBoard, takeStationJob } from '../src/sim/stationJobs.js';
import { beginRun } from '../src/sim/travel.js';
import { voyageHome, voyageOut } from '../src/sim/voyage.js';
import { rules } from './battleKit.js';
import { settled } from './colonyKit.js';
import { readyToLaunch } from './launchKit.js';

const { citizenDays, citizenWork, jumpSupplies, raidCitizens } = rules.balance;
const rock = { kind: 'rock', name: 'The Anvil', days: 2, event: 'rich-seam', held: false, seed: 11 };
const ROOMY = [['farm', 4, 0], ['mine', 7, 0], ['farm', 10, 0], ['solar', 13, 0], ['shelter', 4, 4], ['shelter', 7, 4], ['shelter', 10, 4]];

// The colony with these buildings standing: [type, x, y], in that order.
function withBuildings(campaign, list) {
  const buildings = list.map(([type, x, y], i) => ({ uid: i + 1, type, x, y, rot: 0 }));
  return { ...campaign, colony: { ...campaign.colony, buildings, nextUid: buildings.length + 1 } };
}

// The kit's colony (Copperhill, a desert: soil 1, water 0, ore 2) with room
// for three citizens past its crew of three: three shelters, beds and air
// for six, lit by a solar array with the landed ship's spare; two farms and
// a mine between them, built in that order; and a place to fly to.
function roomy(citizens = 0, extra = []) {
  const campaign = withBuildings(settled(), [...ROOMY, ...extra]);
  return { ...campaign, colony: { ...campaign.colony, citizens, places: [rock] } };
}

// The same with three cannons, lit by two more arrays: six shots at a
// lander.
function guarded(citizens = 0) {
  return roomy(citizens, [['cannon', 4, 8], ['cannon', 7, 8], ['cannon', 10, 8], ['solar', 13, 4], ['solar', 13, 8]]);
}

// The ship out on a trip from the colony to the rock with the squad.
function onTrip(campaign, squad) {
  return { ...campaign, colony: { ...campaign.colony, places: [], trip: { place: rock, squad, done: false, result: null, leg: null } } };
}

// The colony on day 2, a raid's lander down that day.
function down(campaign) {
  return { ...campaign, colony: { ...campaign.colony, day: 2, raid: { found: 1, lands: 2 } } };
}

// The ship at node id of its map, as though it had jumped there.
function atNode(campaign, id) {
  return { ...campaign, run: { ...campaign.run, at: id, seen: [...new Set([...campaign.run.seen, id])], docked: false, jobbed: [] } };
}

// The first station on the ship's map whose board posts a rescue, renamed
// through the stations' names till one does: { campaign (the ship there),
// index (the rescue's on the board) }.
function atRescue(campaign) {
  const isRescue = (offer) => rules.contracts.jobs.get(offer.contract)?.mission === 'rescue';
  for (const node of campaign.run.sector.nodes.filter((n) => n.type === 'station')) {
    for (const name of [node.name, ...rules.sectors.names.stations]) {
      const nodes = campaign.run.sector.nodes.map((n) => (n.id === node.id ? { ...n, name } : n));
      const there = atNode({ ...campaign, run: { ...campaign.run, sector: { ...campaign.run.sector, nodes } } }, node.id);
      const index = stationBoard(there, rules).findIndex(isRescue);
      if (index >= 0) return { campaign: there, index };
    }
  }
  return null;
}

// A fight's end with winner: its battle won or lost as it stands.
function ending(campaign, winner, units = campaign.fight.battle.units) {
  return { ...campaign, fight: { ...campaign.fight, battle: { ...campaign.fight.battle, units, winner } } };
}

test("a citizen eats a jump's supplies a day, takes a bed and air after the crew, and works a farm or a mine, one to each in the order built", () => {
  assert.deepEqual([jumpSupplies, citizenWork], [1, 1]);
  const none = colonyStats(roomy(), rules);
  assert.deepEqual(none.citizens, { count: 0, housed: 0, free: 3, working: 0 });
  // The mine digs the world's ore, 2, and 1 more for the engineer at home.
  assert.deepEqual(none.made, { food: 2, materials: 3 });
  // Two: bedded after the crew, a bed and air still free; the first farm
  // and the mine worked, for one more a day each.
  const two = colonyStats(roomy(2), rules);
  assert.deepEqual(two.citizens, { count: 2, housed: 2, free: 1, working: 2 });
  assert.deepEqual(two.buildings.filter((b) => b.makes).map((b) => [b.type, b.worked, b.makes]), [['farm', true, { food: 2 }], ['mine', true, { materials: 4 }], ['farm', false, { food: 1 }]]);
  assert.deepEqual(two.made, { food: 3, materials: 4 });
  // Five: three bedded, and three at work, one to each.
  const five = colonyStats(roomy(5), rules);
  assert.deepEqual(five.citizens, { count: 5, housed: 3, free: 0, working: 3 });
  assert.deepEqual(five.made, { food: 4, materials: 4 });
  // They eat with the crew.
  assert.equal(citizenEats(roomy(2).colony, rules), 2 * jumpSupplies);
  assert.equal(dayPlan(roomy(2), rules).eats, dayPlan(roomy(), rules).eats + 2 * jumpSupplies);
  // The crew are bedded first: six at home take all six beds.
  const base = roomy(2);
  const six = { ...base, crew: [...base.crew, ...base.crew.map((member, i) => ({ ...member, id: 10 + i, name: `Spare ${i}` }))] };
  assert.equal(colonyStats(six, rules).housed, 6);
  assert.deepEqual(colonyStats(six, rules).citizens, { count: 2, housed: 0, free: 0, working: 2 });
});

test("citizens are not crew: a headcount, never aboard, and the crew's 20 don't count them", () => {
  const full = roomy(MAX_CITIZENS);
  assert.deepEqual(campaignProblems(full), []);
  assert.equal(wholeCrew(full).length, 3);
  assert.equal(MAX_CREW, 20);
  // Fly out takes the crew picked; the citizens stay with the colony.
  const flown = voyageOut({ ...roomy(2), supplies: 30 }, rules, [1, 2]);
  assert.ok(flown.ok, flown.error);
  assert.deepEqual(flown.campaign.crew.map((member) => member.id), [1, 2]);
  assert.equal(flown.campaign.colony.citizens, 2);
  for (const citizens of [-1, 1.5, MAX_CITIZENS + 1, undefined]) assert.deepEqual(campaignProblems({ ...full, colony: { ...full.colony, citizens } }), ["The campaign's colony is unreadable."], String(citizens));
});

test('grown: a day fed, with a bed and air free and every building lit, counts; every citizenDays such days one more; a hungry day, one leaves', () => {
  assert.equal(citizenDays, 5);
  let now = roomy();
  const days = [];
  for (let n = 0; n < 2 * citizenDays; n++) {
    const day = nextDay(now, rules);
    assert.ok(day.ok, day.error);
    days.push([day.plan.citizens.why, day.campaign.colony.citizens, day.campaign.colony.growth]);
    now = day.campaign;
  }
  assert.deepEqual(days, [[null, 0, 1], [null, 0, 2], [null, 0, 3], [null, 0, 4], [null, 1, 0], [null, 1, 1], [null, 1, 2], [null, 1, 3], [null, 1, 4], [null, 2, 0]]);
  assert.equal(now.flags.citizensGrown, 2);
  assert.deepEqual(now.colony.news, [], 'with the ship there, nothing to report');
  assert.deepEqual(campaignProblems(now), []);
  // Why none comes: no bed and air free, a building dark, nobody there.
  const why = (campaign) => planDay(campaign, rules).citizens.why;
  assert.equal(why(roomy(3)), 'room');
  // Two shelters more: five need power, four lit, the last dark.
  const dark = roomy(0, [['shelter', 4, 8], ['shelter', 7, 8]]);
  assert.ok(colonyStats(dark, rules).citizens.free > 0);
  assert.equal(why(dark), 'dark');
  assert.equal(why(onTrip(roomy(), [1, 2, 3])), 'nobody');
  assert.equal(why(onTrip(roomy(1), [1, 2, 3])), null, 'a citizen there is someone');
  // A hungry day: one leaves, and the days counted stay counted.
  const ready = roomy(2);
  const hungry = { ...ready, supplies: 0, colony: { ...ready.colony, growth: 3 } };
  const plan = dayPlan(hungry, rules);
  assert.equal(plan.fed, false);
  assert.deepEqual(plan.citizens, { now: 2, after: 1, growth: [3, 3], why: 'hungry' });
  const left = nextDay(hungry, rules).campaign;
  assert.deepEqual([left.colony.citizens, left.colony.growth, left.flags.citizensLeft], [1, 3, 1]);
  // With none to lose, none leaves.
  assert.deepEqual(citizensDay({ ...hungry, colony: { ...hungry.colony, citizens: 0 } }, rules, colonyStats(hungry, rules), false), { now: 0, after: 0, growth: [3, 3], why: 'hungry' });
});

test("the colony's news: while the ship is away, who came and who left; read once it has landed, and let go as a day passes there or it leaves again", () => {
  // A day short of the next citizen, out on a trip with one aboard.
  const ready = roomy();
  const near = { ...ready, colony: { ...ready.colony, growth: citizenDays - 1 } };
  const out = flyOut(near, rules, 0, [1]);
  assert.ok(out.ok, out.error);
  assert.equal(out.campaign.colony.citizens, 1);
  assert.deepEqual(out.campaign.colony.news, [{ day: near.colony.day, kind: 'grew', citizens: 1 }]);
  assert.deepEqual(campaignProblems(out.campaign), []);
  // A hungry day out there: one leaves, and the news says so.
  const there = { ...out.campaign, supplies: 0, colony: { ...out.campaign.colony, trip: { ...out.campaign.colony.trip, done: true, result: { event: 'rich-seam', choice: 'leave', outcome: 0, roll: null, changes: { credits: 0, supplies: 0, heat: 0, materials: 0, wounds: [], parts: [], sold: [] } } } } };
  const home = flyHome(there, rules);
  assert.ok(home.ok, home.error);
  const { news } = home.campaign.colony;
  assert.deepEqual(news.map((entry) => [entry.kind, entry.citizens]), [['grew', 1], ['left', 0]]);
  assert.equal(home.campaign.flags.citizensLeft, 1);
  // Landed, it waits to be read; a day there, or the next trip out, lets
  // it go.
  assert.equal(home.campaign.colony.trip, null);
  const fed = { ...home.campaign, supplies: 20 };
  assert.deepEqual(nextDay(fed, rules).campaign.colony.news, []);
  const again = flyOut(fed, rules, 0, [1]);
  assert.ok(again.ok, again.error);
  assert.ok(again.campaign.colony.news.every((entry) => entry.day >= fed.colony.day), 'the old news is gone');
  // At most MAX_NEWS, the oldest let go.
  const many = Array.from({ length: MAX_NEWS + 2 }, (_, i) => ({ day: i + 1, kind: 'grew', citizens: i + 1 }));
  const kept = many.reduce((colony, entry) => withNews(colony, entry), { news: [] }).news;
  assert.deepEqual(kept, many.slice(-MAX_NEWS));
});

test('a captive freed on a voyage settles at the colony flown from, a citizen more while it has room; lost, without room, or before act 3, they go their way', () => {
  const flown = voyageOut({ ...roomy(), supplies: 30 }, rules, [1, 2]).campaign;
  const found = atRescue(flown);
  assert.ok(found, 'a station out there posts a rescue');
  const taken = takeStationJob(found.campaign, rules, found.index);
  assert.ok(taken.ok, taken.error);
  assert.equal(taken.campaign.fight.battle.objective.type, 'rescue');
  const won = endJob(ending(taken.campaign, 'crew'), rules);
  assert.equal(won.colony.citizens, 1);
  assert.deepEqual(won.colony.news, [{ day: won.colony.day, kind: 'settled', citizens: 1 }]);
  assert.equal(won.flags.rescuedSettled, 1);
  assert.deepEqual(campaignProblems(won), []);
  assert.equal(endJob(ending(taken.campaign, 'enemy'), rules).colony.citizens, 0);
  // No bed and air free at home: they go their way.
  const free = colonyStats(taken.campaign, rules).citizens.free;
  assert.ok(free > 0);
  const crowded = { ...taken.campaign, colony: { ...taken.campaign.colony, citizens: free } };
  const turned = endJob(ending(crowded, 'crew'), rules);
  assert.deepEqual([turned.colony.citizens, turned.colony.news, turned.flags.rescuedSettled], [free, [], undefined]);
  // Before act 3 there is no colony to go to.
  const run = beginRun(launch(readyToLaunch(), rules).campaign, rules).campaign;
  const early = atRescue(run);
  assert.ok(early);
  const freed = endJob(ending(takeStationJob(early.campaign, rules, early.index).campaign, 'crew'), rules);
  assert.deepEqual([freed.colony, freed.flags.rescuedSettled, freed.flags.stationJobsDone], [null, undefined, 1]);
});

test("a raid where the ship isn't is fought out at once: the guns first, then whoever is there and its colonists, the AI on both sides; the fallen gone, the crew wounded at worst, and the news told", () => {
  // Out on a trip with one aboard: two crew at home and three citizens.
  const there = down(onTrip(roomy(3), [1]));
  const plan = landingPlan(there, rules);
  assert.deepEqual([plan.defenders, plan.citizens, plan.shots], [[2, 3], 3, 0]);
  const outcomes = { won: 0, lost: 0 };
  for (let n = 1; n <= 12; n++) {
    const before = { ...there, rng: seedFrom(n) };
    const fought = fightAway(before, rules);
    assert.deepEqual(fightAway(before, rules), fought, 'the same rolls, the same fight');
    const { campaign, won, fell, landing } = fought;
    outcomes[won ? 'won' : 'lost'] += 1;
    assert.equal(landing.landed.length, plan.raiders.length, 'no guns, all land');
    assert.ok(fell >= 0 && fell <= 3);
    assert.equal(campaign.colony.citizens, 3 - fell);
    assert.equal(campaign.colony.raid, null);
    const food = Math.floor(before.supplies / 2);
    const materials = Math.floor(before.colony.materials / 2);
    assert.deepEqual(campaign.colony.news, [{ day: 2, kind: 'raid', won, landed: plan.raiders.length, fell, food: won ? 0 : food, materials: won ? 0 : materials, part: won ? null : raidTake(before, rules).part }]);
    assert.equal(campaign.supplies, before.supplies - (won ? 0 : food));
    // The crew there fought: wounded at worst, the fight counted; the squad
    // away sat it out.
    assert.deepEqual(campaign.crew.map((member) => [member.id, member.fights]), [[1, 0], [2, 1], [3, 1]]);
    assert.ok(campaign.crew.every((member) => member.hp >= 1));
    assert.equal(campaign.crew[0].hp, before.crew[0].hp);
    assert.equal(campaign.flags.raidsFoughtOut, 1);
    assert.equal(campaign.flags[won ? 'raidsFoughtOutWon' : 'raidsFoughtOutLost'], 1);
    assert.equal(campaign.flags.citizensFell ?? 0, fell);
    assert.deepEqual(campaignProblems(campaign), []);
  }
  assert.ok(outcomes.won > 0 && outcomes.lost > 0, JSON.stringify(outcomes));
  // Nobody there, crew or citizens: lost without a fight.
  const empty = fightAway(down(onTrip(roomy(), [1, 2, 3])), rules);
  assert.deepEqual([empty.won, empty.fell, empty.campaign.crew.map((member) => member.fights)], [false, 0, [0, 0, 0]]);
  // Citizens alone fight it.
  const alone = fightAway(down(onTrip(roomy(3), [1, 2, 3])), rules);
  assert.ok(alone.fell > 0);
  assert.deepEqual(alone.campaign.crew.map((member) => member.fights), [0, 0, 0]);
  // The guns stop every raider: won with no fight.
  let stopped = null;
  for (let n = 1; n <= 30 && !stopped; n++) {
    const tried = fightAway({ ...down(onTrip(guarded(2), [1])), rng: seedFrom(n) }, rules);
    if (!tried.landing.landed.length) stopped = tried;
  }
  assert.ok(stopped, 'six shots stop all four sometimes');
  assert.equal(defensesOf(onTrip(guarded(), [1]), rules).shots, 6);
  assert.deepEqual([stopped.won, stopped.fell, stopped.campaign.crew.map((member) => member.fights)], [true, 0, [0, 0, 0]]);
  assert.equal(stopped.campaign.colony.news[0].landed, 0);
  // Unended after MAX_ROUNDS, the raiders pull out and the colony holds:
  // here neither side can fell the other.
  const sturdy = { ...rules, colony: { ...rules.colony, citizen: { ...rules.colony.citizen, hp: 50000 } }, enemies: new Map([...rules.enemies].map(([id, enemy]) => [id, { ...enemy, hp: 50000 }])) };
  const held = fightAway(down(onTrip(roomy(2), [1, 2, 3])), sturdy);
  assert.deepEqual([held.won, held.fell], [true, 0]);
});

test('fightOut plays a raid on to its end, both sides pressing past 40 rounds, or stops at MAX_ROUNDS', () => {
  assert.equal(MAX_ROUNDS, 60);
  const there = roomy(2);
  const map = colonyMap(there.colony, rules);
  const starts = raidStarts(map, 2, 2, rules);
  const tough = { hp: 50000 };
  const units = [
    ...starts.crew.map(([x, y], i) => ({ kind: 'colonist', name: `Colonist ${i + 1}`, x, y, bonus: tough })),
    ...starts.raiders.map(([x, y]) => ({ kind: 'guard', x, y, bonus: tough })),
  ];
  const { battle } = createBattle({ map, units, seed: 7, options: { press: true } }, rules);
  const played = fightOut(battle, rules);
  assert.equal(played.battle.winner, null);
  assert.equal(played.dragged, true);
  assert.ok(played.battle.round >= MAX_ROUNDS, String(played.battle.round));
  assert.ok(played.battle.units.every((unit) => unit.status === 'active'));
});

test("a raid the player fights: the citizens stand beside the crew as colonists, up to raidCitizens, in the crew's band and the crew's side; those who fall are lost", () => {
  assert.equal(raidCitizens, 6);
  assert.equal(colonistsOf(roomy(10), rules), raidCitizens);
  assert.equal(colonistsOf(roomy(), rules), 0);
  const at = down(roomy(3));
  assert.equal(landingPlan(at, rules).citizens, 3);
  let faced = null;
  for (let n = 1; n <= 50 && !faced; n++) {
    const tried = faceRaid({ ...at, rng: seedFrom(n) }, rules);
    if (tried.fight) faced = tried;
  }
  assert.ok(faced);
  const { fight } = faced.campaign;
  const colonists = fight.battle.units.filter((unit) => unit.citizen);
  const { citizen } = rules.colony;
  assert.deepEqual(citizen.id, 'colonist');
  assert.deepEqual(colonists.map((unit) => [unit.name, unit.kind, unit.side, unit.maxHp, unit.weapon]), [1, 2, 3].map((n) => [`Colonist ${n}`, 'colonist', 'crew', citizen.hp, citizen.weapon]));
  assert.ok(colonists.every((unit) => unit.x < START_COLUMNS && unit.aim === citizen.aim));
  assert.ok(citizen.hp < Math.min(...fight.battle.units.filter((unit) => unit.side === 'crew' && !unit.citizen).map((unit) => unit.maxHp)), 'fewer hit points than crew');
  assert.deepEqual(fight.crew, [1, 2, 3], 'the crew are the crew');
  assert.deepEqual(campaignProblems(faced.campaign), []);
  // A colonist is on the crew's side with a weapon, and no ward.
  assert.equal(battleProblem(fight.battle), null);
  const broken = (change) => battleProblem({ ...fight.battle, units: fight.battle.units.map((unit) => (unit.citizen ? { ...unit, ...change } : unit)) });
  assert.notEqual(broken({ side: 'enemy' }), null);
  assert.notEqual(broken({ citizen: false }), null);
  assert.notEqual(broken({ ward: true, weapon: null }), null);
  // Two fall: gone from the colony once it is over, won or lost. One
  // stabilized as they lay is not lost.
  const units = fight.battle.units.map((unit) => (unit.citizen && unit.name !== 'Colonist 3' ? { ...unit, hp: 0, status: 'down' } : unit));
  assert.equal(fallenColonists({ ...fight.battle, units }), 2);
  assert.equal(fallenColonists({ ...fight.battle, units: units.map((unit) => (unit.name === 'Colonist 2' ? { ...unit, status: 'stable' } : unit)) }), 1);
  for (const winner of ['crew', 'enemy']) {
    const after = endColonyRaid(ending(faced.campaign, winner, units), rules);
    assert.deepEqual([after.colony.citizens, after.flags.citizensFell, after.colony.raid], [1, 2, null]);
    assert.deepEqual(after.colony.news, [], 'the player saw it');
    assert.deepEqual(campaignProblems(after), []);
  }
});

test('saves at v38: a colony from before has no citizens, nothing toward the next and no news, every colony; as saved they reload; unreadable ones are caught', () => {
  assert.equal(SAVE_VERSION, 44);
  const step = MIGRATIONS.find((m) => m.from === 37);
  assert.equal(step, MIGRATIONS.at(-7), 'the last but M41\'s, M42\'s, M45\'s, M46\'s, M47\'s and M49\'s');
  const grown = roomy(2);
  const now = { ...grown, colony: { ...grown.colony, growth: 3, news: [{ day: 1, kind: 'grew', citizens: 2 }] } };
  const strip = ({ citizens, growth, news, ...colony }) => colony;
  const other = { ...strip(now.colony), id: 2, at: 3, keep: { crew: [], food: 4 } };
  const old = (campaign) => ({ ...saveData(initialState(3)), campaign });
  const up = step.up(old({ ...now, colony: strip(now.colony), colonies: [other] })).campaign;
  assert.deepEqual(up.colony, { ...strip(now.colony), citizens: 0, growth: 0, news: [] });
  assert.deepEqual(up.colonies, [{ ...other, citizens: 0, growth: 0, news: [] }]);
  // Before the colony, and with no campaign, nothing changes.
  const run = { ...now, act: 2, colony: null, colonies: [] };
  assert.deepEqual(step.up(old(run)).campaign, run);
  assert.equal(step.up(old(null)).campaign, null);
  // Through the front door, from v37.
  const opened = parseSave(JSON.stringify({ version: 37, data: old({ ...now, colony: strip(now.colony) }) }));
  assert.ok(opened.ok, opened.error);
  assert.deepEqual(opened.save.data.campaign.colony, { ...strip(now.colony), citizens: 0, growth: 0, news: [] });
  // As saved, they reload.
  const loaded = parseSave(JSON.stringify(makeSave(old(now))));
  assert.ok(loaded.ok, loaded.error);
  assert.deepEqual(loaded.save.data.campaign, now);
  // Unreadable.
  const raid = { day: 2, kind: 'raid', won: false, landed: 4, fell: 1, food: 3, materials: 2, part: 'shield' };
  assert.deepEqual(campaignProblems({ ...now, colony: { ...now.colony, news: [raid] } }), []);
  const broken = (change) => campaignProblems({ ...now, colony: { ...now.colony, ...change } });
  for (const change of [
    { growth: -1 },
    { growth: 61 },
    { growth: undefined },
    { news: null },
    { news: Array.from({ length: MAX_NEWS + 1 }, () => raid) },
    { news: [{ ...raid, day: 0 }] },
    { news: [{ ...raid, won: 'no' }] },
    { news: [{ ...raid, fell: -1 }] },
    { news: [{ ...raid, part: undefined }] },
    { news: [{ ...raid, part: 3 }] },
    { news: [{ day: 2, kind: 'moved', citizens: 1 }] },
    { news: [{ day: 2, kind: 'grew' }] },
  ]) {
    assert.deepEqual(broken(change), ["The campaign's colony is unreadable."], JSON.stringify(change));
  }
});
