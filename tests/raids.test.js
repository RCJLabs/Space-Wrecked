// M29: raids on the colony. Heat falls a little each colony day and a
// trip adds some, by how far the colony lies from the lanes. Each day the
// pursuer may find the colony, at odds by heat and the lanes; found, its
// lander comes raidWarning days later. On its day the raid is down: the
// colony's guns fire at the lander, each hit a raider fewer, and whoever is
// home fights the rest on the colony's grid. Won or lost, heat falls;
// lost, the raiders take half the stores and the dearest part in the hold.
// A raid could land while the ship was away: the leg stopped, those at
// home faced it, and the ship flew on. From M38f it is fought out there
// and the leg goes on; a leg one stopped in a save from before still flies
// on once it is faced.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { int, seedFrom } from '../src/core/rng.js';
import { makeSave, MIGRATIONS, parseSave, SAVE_VERSION } from '../src/core/save.js';
import { campaignProblems, maxHp } from '../src/sim/campaign.js';
import { colonyStats, donate } from '../src/sim/colony.js';
import { colonyMap, raidStarts, START_COLUMNS } from '../src/sim/colonyMap.js';
import { dayPlan, nextDay } from '../src/sim/days.js';
import { flyHome, flyOn, flyOut, homePlan, onPlan, tripHere, tripPlan } from '../src/sim/expeditions.js';
import { HEAT_MAX } from '../src/sim/campaign.js';
import { defendersOf, defensesOf, endColonyRaid, faceRaid, foundOdds, landingPlan, raidDown, raidExtra, raidIn, raidTake, settleRaid, tripHeatOf } from '../src/sim/raids.js';
import { campaignScreen, initialState, reduce, saveData } from '../src/sim/root.js';
import { traitBonus } from '../src/sim/traits.js';
import { rules } from './battleKit.js';
import { settled, uidOf } from './colonyKit.js';

const { colonyHeatFall, raidWarning, heatAfterRaid, landingHit, raidShieldArmor, raidArmoryAim } = rules.balance;
const raiders = rules.encounters.get(rules.backgrounds.get('miner').pursuer.colony.raiders).enemies;
const rock = { kind: 'rock', name: 'The Anvil', days: 2, event: 'rich-seam', held: false, seed: 11 };
const far = { kind: 'rock', name: 'Old Red', days: 3, event: 'rich-seam', held: false, seed: 12 };

// The colony with these buildings standing: [type, x, y], in that order.
function withBuildings(campaign, list) {
  const buildings = list.map(([type, x, y], i) => ({ uid: i + 1, type, x, y, rot: 0 }));
  return { ...campaign, colony: { ...campaign.colony, buildings, nextUid: buildings.length + 1 } };
}

// The colony a day on, with the raid's lander down today.
function down(campaign) {
  const day = Math.max(2, campaign.colony.day);
  return { ...campaign, colony: { ...campaign.colony, day, raid: { found: day - 1, lands: day } } };
}

// The colony with these places listed and its world this far from the
// lanes.
function at(campaign, { places = [rock], lanes = campaign.colony.world.lanes } = {}) {
  return { ...campaign, colony: { ...campaign.colony, places, world: { ...campaign.colony.world, lanes } } };
}

// A leg a raid's lander stopped, as a save from before M38f has it (M29):
// the squad a day out of the colony toward place, with the rest of the
// leg still to fly and the lander down that day. Flown as a day's trip to
// the same place, the raid not yet due, then stopped by hand.
function stoppedOut(campaign, place, squad) {
  const { day } = campaign.colony;
  const quick = at({ ...campaign, colony: { ...campaign.colony, raid: { found: day, lands: day + 2 } } }, { places: [{ ...place, days: 1 }] });
  const flown = flyOut(quick, rules, 0, squad).campaign;
  const { trip } = flown.colony;
  return { ...flown, colony: { ...flown.colony, raid: { found: day, lands: day + 1 }, trip: { ...trip, place, leg: { dir: 'out', left: place.days - 1 } } } };
}

// The rolls int(rng, 0, 99) gives from the campaign's state on: n of them.
function rolls(rng, n) {
  const out = [];
  let state = rng;
  for (let i = 0; i < n; i++) {
    const r = int(state, 0, 99);
    out.push(r.value);
    state = r.state;
  }
  return out;
}

test('heat at the colony: it falls a little each day, and a trip adds some, less the further the colony lies from the lanes', () => {
  const landed = settled(1, { heat: 20 });
  const day = nextDay(landed, rules).campaign;
  assert.equal(day.heat, landed.heat - colonyHeatFall);
  assert.equal(colonyHeatFall, 1);
  // A trip's heat by the lanes: near them, off them, far from them.
  assert.deepEqual([1, 2, 3].map((lanes) => tripHeatOf(at(landed, { lanes }), rules)), [6, 4, 2]);
  // Flying out adds it as the ship leaves; each day out then sheds a point.
  const near = at(landed, { lanes: 1 });
  const out = flyOut(near, rules, 0, [1]).campaign;
  assert.equal(out.heat, near.heat + 6 - rock.days * colonyHeatFall);
  assert.equal(out.flags.tripHeat, 6);
  // Heat never falls below 0.
  const cold = { ...landed, heat: 0 };
  assert.equal(nextDay(cold, rules).campaign.heat, 0);
});

test("found: the day's odds by heat and the lanes, none below rumors or with a raid coming; the roll is the campaign's, and the lander comes raidWarning days later", () => {
  const landed = settled();
  const odds = (heat, lanes) => foundOdds(at({ ...landed, heat }, { lanes }), rules);
  // Calm, rumors, hunters, the task force and cornered; off, near and far
  // from the lanes.
  assert.deepEqual([10, 30, 60, 80, HEAT_MAX].map((heat) => odds(heat, 2)), [0, 3, 6, 10, 15]);
  assert.deepEqual([10, 30, 60, 80, HEAT_MAX].map((heat) => odds(heat, 1)), [0, 5, 9, 15, 23]);
  assert.deepEqual([10, 30, 60, 80, HEAT_MAX].map((heat) => odds(heat, 3)), [0, 2, 3, 5, 8]);
  // A raid coming: no more odds.
  const coming = { ...landed, heat: 80, colony: { ...landed.colony, raid: { found: 1, lands: 4 } } };
  assert.equal(foundOdds(coming, rules), 0);
  // The day's plan says the odds; the day's end rolls them. Over seeds,
  // the first that finds the colony: the roll under the odds, and the
  // lander due raidWarning days after the new day.
  const hot = { ...at(landed, { lanes: 2 }), heat: 60 };
  assert.equal(dayPlan(hot, rules).found, 6);
  let found = null;
  for (let n = 1; n <= 200 && !found; n++) {
    const tried = { ...hot, rng: seedFrom(n) };
    const day = nextDay(tried, rules);
    const [roll] = rolls(tried.rng, 1);
    assert.equal(day.roll, roll);
    if (day.found) found = { tried, day };
    else {
      assert.ok(roll >= 6);
      assert.equal(day.campaign.colony.raid, null);
    }
  }
  assert.ok(found, 'some seed finds the colony');
  const { tried, day } = found;
  assert.ok(day.roll < 6);
  assert.deepEqual(day.campaign.colony.raid, { found: 1, lands: 2 + raidWarning, extra: raidExtra(tried.heat, rules) });
  assert.equal(raidWarning, 3);
  assert.deepEqual([raidIn(day.campaign), raidDown(day.campaign)], [3, false]);
  assert.equal(day.campaign.flags.raidsFound, 1);
  assert.deepEqual(campaignProblems(day.campaign), []);
  // The same seed, the same day.
  assert.deepEqual(nextDay(tried, rules), day);
  // Counting down: in 3, 2, 1, then down, and Next day waits.
  let now = day.campaign;
  const counted = [];
  while (!raidDown(now)) {
    counted.push(raidIn(now));
    const passed = nextDay(now, rules);
    assert.equal(passed.roll, null, 'nothing is rolled while a raid is coming');
    now = passed.campaign;
  }
  assert.deepEqual(counted, [3, 2, 1]);
  assert.deepEqual([now.colony.day, raidIn(now)], [2 + raidWarning, 0]);
  assert.match(dayPlan(now, rules).error, /^Con-Reg Recovery's lander is down: face the raid first\.$/);
  // A trip's days roll the same way.
  const leaving = { ...at(hot, { places: [rock] }) };
  let flown = null;
  for (let n = 1; n <= 200 && !flown; n++) {
    const out = flyOut({ ...leaving, rng: seedFrom(n) }, rules, 0, [1]);
    if (out.days.some((d) => d.found)) flown = out;
  }
  assert.ok(flown, 'some trip finds the colony on the way');
  assert.ok(flown.campaign.colony.raid);
});

test('the landing: on its day Next day and Fly out wait; Defend fires each powered gun at the lander, a cannon twice, each hit a raider fewer', () => {
  // A gun and a flak tower, a cannon, a shield dome and an armory, run by a
  // power plant and the landed ship.
  const base = withBuildings(at(settled(), { places: [rock] }), [
    ['reactor', 6, 0],
    ['weapon', 0, 0],
    ['pointdefense', 2, 0],
    ['cannon', 0, 3],
    ['shield', 0, 6],
    ['armory', 3, 6],
  ]);
  const ready = down(base);
  assert.equal(raidDown(ready), true);
  assert.equal(raidDown(base), false);
  assert.match(dayPlan(ready, rules).error, /lander is down/);
  assert.match(tripPlan(ready, rules, 0, [1]).error, /lander is down/);
  assert.equal(landingPlan(base, rules).error, 'No lander is down at the colony.');
  const plan = landingPlan(ready, rules);
  assert.deepEqual(plan.guns.map((gun) => [gun.name, gun.shots]), [['Gun emplacement', 1], ['Flak tower', 1], ['Cannon emplacement', 2]]);
  // A marine at home calls the shots: each is 10 more likely to hit (M32,
  // tests/edges.test.js).
  const called = landingHit + rules.jobs.get('marine').colony.landing;
  assert.ok(ready.crew.some((member) => member.job === 'marine'));
  assert.deepEqual([plan.shots, plan.hit, plan.armor, plan.aim, plan.raiders, plan.defenders], [4, called, raidShieldArmor, raidArmoryAim, raiders, [1, 2, 3]]);
  assert.deepEqual([landingHit, called, raidShieldArmor, raidArmoryAim], [50, 60, 1, 10]);
  // The defenses are the colony's as they stand, a raid coming or not, for
  // the colony screen.
  assert.deepEqual(defensesOf(base, rules), { guns: plan.guns, shots: plan.shots, armor: plan.armor, aim: plan.aim });
  assert.deepEqual(defensesOf(settled(), rules), { guns: [], shots: 0, armor: 0, aim: 0 });
  // Dark defenses don't fire, and a dark shield and armory give nothing.
  const dark = { ...ready, colony: { ...ready.colony, buildings: ready.colony.buildings.filter((b) => b.type !== 'reactor') } };
  const lit = colonyStats(dark, rules).buildings.filter((b) => b.powered).map((b) => b.name);
  const darkPlan = landingPlan(dark, rules);
  assert.deepEqual(darkPlan.guns.map((gun) => gun.name), lit.filter((name) => ['Gun emplacement', 'Flak tower', 'Cannon emplacement'].includes(name)));
  assert.equal(darkPlan.armor, lit.includes('Shield dome') ? raidShieldArmor : 0);
  // The shots are the campaign's rolls, each under the plan's hit to hit,
  // and each hit a raider fewer, the last of the party first.
  for (let n = 1; n <= 12; n++) {
    const tried = { ...ready, rng: seedFrom(n) };
    const faced = faceRaid(tried, rules);
    assert.equal(faced.ok, true, faced.error);
    const expected = rolls(tried.rng, 4);
    assert.deepEqual(faced.landing.shots.map((shot) => [shot.roll, shot.hit]), expected.map((roll) => [roll, roll < called]));
    const hits = expected.filter((roll) => roll < called).length;
    assert.deepEqual([faced.landing.hits, faced.landing.landed], [hits, raiders.slice(0, raiders.length - hits)]);
    assert.equal(faced.campaign.flags.landingShots, 4);
    assert.equal(faced.campaign.flags.landingHits ?? 0, hits);
    assert.deepEqual(campaignProblems(faced.campaign), []);
  }
  // Every raider stopped: the raid is beaten where it stands, no fight.
  const guns = withBuildings(at(settled(), { places: [rock] }), [
    ['reactor', 8, 0],
    ['weapon', 0, 0],
    ['weapon', 2, 0],
    ['weapon', 4, 0],
    ['weapon', 6, 0],
    ['cannon', 0, 3],
    ['cannon', 3, 3],
  ]);
  let beaten = null;
  for (let n = 1; n <= 400 && !beaten; n++) {
    const faced = faceRaid({ ...down({ ...guns, heat: 70 }), rng: seedFrom(n) }, rules);
    if (faced.ok && !faced.fight) beaten = faced;
  }
  assert.ok(beaten, 'some landing stops them all');
  assert.deepEqual([beaten.won, beaten.taken, beaten.landing.landed, beaten.campaign.place, beaten.campaign.fight], [true, null, [], 'hub', null]);
  assert.deepEqual([beaten.campaign.heat, beaten.campaign.colony.raid, beaten.campaign.flags.colonyRaidsWon], [heatAfterRaid, null, 1]);
  assert.equal(beaten.campaign.flags.raidersStopped, raiders.length);
});

test("the fight on the colony's grid: buildings as cover, the crew by the ship and the raiders at the far edge, pressing on; a shield and an armory help", () => {
  const base = withBuildings(at(settled(), { places: [rock] }), [
    ['farm', 4, 1],
    ['weapon', 0, 0],
    ['shield', 9, 5],
    ['armory', 12, 8],
    ['reactor', 15, 1],
  ]);
  const map = colonyMap(base.colony, rules);
  const { width, height } = rules.colony.site;
  assert.deepEqual([map.width, map.height, map.site, map.margin, map.tilesPerCell], [width, height, 'colony', 0, 1]);
  const tile = (x, y) => map.tiles.cells[y * width + x];
  // The farm's fields are half cover, everything else built full; the rest
  // open ground.
  assert.deepEqual([tile(4, 1), tile(5, 2), tile(0, 0), tile(9, 5), tile(10, 5), tile(12, 8), tile(3, 3)], ['half cover', 'half cover', 'machinery', 'machinery', 'machinery', 'machinery', 'floor']);
  // The same buildings, the same map.
  assert.deepEqual(colonyMap(base.colony, rules), map);
  const starts = raidStarts(map, 3, 4, rules);
  assert.ok(starts.crew.every(([x]) => x < START_COLUMNS) && starts.raiders.every(([x]) => x >= width - START_COLUMNS));
  assert.ok([...starts.crew, ...starts.raiders].every(([x, y]) => tile(x, y) === 'floor'));
  // The landing misses with every shot for this seed's first roll, or not:
  // either way the raiders left land, and the fight is on.
  let faced = null;
  for (let n = 1; n <= 100 && !faced; n++) {
    const tried = faceRaid({ ...down({ ...base, heat: 70 }), rng: seedFrom(n) }, rules);
    if (tried.fight && tried.landing.hits === 0) faced = tried;
  }
  assert.ok(faced, 'some landing misses');
  const fought = faced.campaign;
  const { fight } = fought;
  assert.deepEqual([fought.place, fight.raid, fight.boarding, fight.job, fight.encounter, fight.crew], ['fight', true, null, null, 'raid', [1, 2, 3]]);
  assert.equal(campaignScreen(fought), 'campaign-fight');
  assert.deepEqual(campaignProblems(fought), []);
  // The crew and, from M50, each powered gun fighting from its building.
  const crew = fight.battle.units.filter((unit) => unit.side === 'crew' && !rules.machines.has(unit.kind));
  const guns = fight.battle.units.filter((unit) => rules.machines.has(unit.kind));
  const enemies = fight.battle.units.filter((unit) => unit.side === 'enemy');
  assert.deepEqual(enemies.map((unit) => unit.kind), raiders);
  assert.ok(crew.every((unit) => unit.x < START_COLUMNS) && enemies.every((unit) => unit.x >= width - START_COLUMNS));
  const shooting = landingPlan(down({ ...base, heat: 70 }), rules).guns;
  assert.deepEqual(guns.map((unit) => [unit.side, unit.name, unit.x, unit.y]), shooting.map((gun) => {
    const at = base.colony.buildings.find((b) => b.uid === gun.uid);
    return ['crew', gun.name, at.x, at.y];
  }));
  // The power plant lights the shield dome; the armory needs no power.
  // Each defender fights with their job's armor and aim, their traits', and
  // the dome's and the armory's.
  const plan = landingPlan(down({ ...base, heat: 70 }), rules);
  assert.deepEqual([plan.armor, plan.aim], [raidShieldArmor, raidArmoryAim]);
  for (const [i, unit] of crew.entries()) {
    const member = base.crew[i];
    const job = rules.jobs.get(member.job);
    const traits = traitBonus(member.traits, rules);
    assert.deepEqual([unit.armor, unit.aim], [job.armor + traits.armor + raidShieldArmor, job.aim + traits.aim + raidArmoryAim], member.name);
  }
  // Won: home again, heat down, nothing taken.
  const ended = (winner) => endColonyRaid({ ...fought, fight: { ...fight, battle: { ...fight.battle, winner } } }, rules);
  const won = ended('crew');
  assert.deepEqual([won.place, won.fight, won.colony.raid, won.heat, won.supplies, won.colony.materials, won.parts], ['hub', null, null, heatAfterRaid, fought.supplies, fought.colony.materials, fought.parts]);
  assert.equal(won.flags.colonyRaidsWon, 1);
  assert.deepEqual(campaignProblems(won), []);
  // Lost: half the food, half the materials and the dearest part in the
  // hold; nobody dies, the downed at 1.
  const lost = ended('enemy');
  const take = raidTake(fought, rules);
  assert.deepEqual(take, { food: Math.floor(fought.supplies / 2), materials: Math.floor(fought.colony.materials / 2), part: 'corridor' });
  assert.deepEqual([lost.supplies, lost.colony.materials, lost.parts.corridor ?? 0], [fought.supplies - take.food, fought.colony.materials - take.materials, (fought.parts.corridor ?? 0) - 1]);
  assert.deepEqual([lost.heat, lost.colony.raid, lost.flags.colonyRaidsLost, lost.flags.raidPartsTaken], [heatAfterRaid, null, 1, 1]);
  assert.deepEqual(lost.crew.map((member) => member.id), base.crew.map((member) => member.id));
  assert.ok(lost.crew.every((member) => member.hp >= 1 && member.hp <= maxHp(member, rules)));
  // With an empty hold they take no part.
  assert.equal(raidTake({ ...fought, parts: {} }, rules).part, null);
  // Heat already under heatAfterRaid stays where it is.
  assert.equal(settleRaid({ ...fought, fight: null, place: 'hub', heat: 12 }, rules, true).campaign.heat, 12);
});

test('while the ship is away: a raid is fought out by those at home and the leg goes on (M38f); a leg one stopped in a save from before flies on once it is faced; with nobody home it is lost unless every raider is stopped', () => {
  // From M38e the colony keeps a heat of its own, the ship's as v37 opens
  // it (unused while the ship is landed there).
  const placed = at(settled(), { places: [far] });
  const base = { ...placed, heat: 30, colony: { ...placed.colony, heat: 30 } };
  // The lander comes down the day after the ship leaves for a place 3 days
  // out: fought out there that day, and the squad is at the place on time.
  const coming = { ...base, colony: { ...base.colony, raid: { found: 1, lands: 2 } } };
  const out = flyOut(coming, rules, 0, [1]);
  assert.equal(out.ok, true, out.error);
  assert.deepEqual([out.stopped, out.days.length, out.campaign.colony.day, out.campaign.colony.trip.leg, out.campaign.colony.raid], [false, 3, 4, null, null]);
  assert.equal(tripHere(out.campaign, rules).event.id, 'rich-seam');
  // Those at home fought it, the squad sitting out: wounded at worst, their
  // fights counted, and the report waits.
  const fights = (campaign) => campaign.crew.map((member) => member.fights ?? 0);
  assert.deepEqual(fights(out.campaign), fights(coming).map((n, i) => (i ? n + 1 : n)));
  assert.ok(out.campaign.crew.every((member) => member.hp >= 1));
  assert.deepEqual(out.campaign.colony.news.map((entry) => [entry.kind, entry.day, entry.landed]), [['raid', 2, raiders.length]]);
  assert.equal(out.campaign.flags.raidsFoughtOut, 1);
  assert.deepEqual(campaignProblems(out.campaign), []);
  // On the way home the same: fought out, and the ship lands.
  const there = { ...out.campaign, colony: { ...out.campaign.colony, trip: { ...out.campaign.colony.trip, done: true, result: { event: 'rich-seam', choice: 'leave', outcome: 0, roll: null, changes: { credits: 0, supplies: 0, heat: 0, materials: 0, wounds: [], parts: [], sold: [] } } }, raid: { found: 4, lands: 6 } } };
  const back = flyHome(there, rules);
  assert.deepEqual([back.stopped, back.days.length, back.campaign.colony.trip, back.campaign.colony.raid], [false, 3, null, null]);
  assert.deepEqual([back.campaign.colony.news.length, back.campaign.colony.news.at(-1).day], [2, 6]);
  assert.equal(back.campaign.flags.tripsHome, 1);
  // A leg stopped in a save from before: a day out of three, the lander
  // down at home.
  const away = stoppedOut(base, far, [1]);
  assert.deepEqual([away.colony.day, away.colony.trip.leg], [2, { dir: 'out', left: 2 }]);
  assert.deepEqual(campaignProblems(away), []);
  // On the way: nothing at the place yet, no flying home, no flying on.
  const here = tripHere(away, rules);
  assert.deepEqual([here.event, here.held, here.leg], [null, false, { dir: 'out', left: 2 }]);
  assert.match(homePlan(away, rules).error, /on its way/);
  assert.match(flyOn(away, rules).error, /lander is down/);
  assert.match(onPlan(away, rules).error, /lander is down/);
  assert.equal(onPlan(coming, rules).error, 'The ship is not on its way anywhere.');
  // Those at home face it; the squad sits out.
  assert.deepEqual(defendersOf(away).map((member) => member.id), [2, 3]);
  let faced = null;
  for (let n = 1; n <= 50 && !faced; n++) {
    const tried = faceRaid({ ...away, rng: seedFrom(n) }, rules);
    if (tried.fight) faced = tried;
  }
  assert.ok(faced);
  assert.deepEqual(faced.campaign.fight.crew, [2, 3]);
  assert.deepEqual(campaignProblems(faced.campaign), []);
  const after = endColonyRaid({ ...faced.campaign, fight: { ...faced.campaign.fight, battle: { ...faced.campaign.fight.battle, winner: 'crew' } } }, rules);
  assert.equal(after.colony.trip.leg.left, 2);
  // Flying on: the rest of the leg, and the squad is at the place. Its
  // plan says the days left and what they eat, as they come to.
  const ahead = onPlan(after, rules);
  assert.deepEqual([ahead.ok, ahead.dir, ahead.place, ahead.days, ahead.hungry], [true, 'out', far, 2, 0]);
  const on = flyOn(after, rules);
  assert.equal(on.ok, true, on.error);
  assert.deepEqual(on.plan, ahead);
  assert.deepEqual([ahead.eats, ahead.food], [on.days.reduce((sum, day) => sum + day.plan.eats, 0), [after.supplies, on.campaign.supplies]]);
  assert.deepEqual([on.dir, on.stopped, on.days.length, on.campaign.colony.trip.leg, on.campaign.colony.day], ['out', false, 2, null, 4]);
  assert.equal(tripHere(on.campaign, rules).event.id, 'rich-seam');
  // The same on the way home, stopped a day short: flying on lands the
  // ship.
  const homing = { ...there, colony: { ...there.colony, day: 6, trip: { ...there.colony.trip, leg: { dir: 'home', left: 1 } } } };
  assert.deepEqual(campaignProblems(homing), []);
  assert.match(flyOn(homing, rules).error, /lander is down/);
  const settledHome = settleRaid(homing, rules, true).campaign;
  const landed = flyOn(settledHome, rules);
  assert.deepEqual([landed.dir, landed.campaign.colony.trip, landed.campaign.colony.places.length], ['home', null, 3]);
  assert.equal(landed.campaign.flags.tripsHome, 1);
  // Nobody home and no guns: the raid is lost without a fight, out on the
  // trip (M38f) as in a save from before.
  const everyone = flyOut(coming, rules, 0, [1, 2, 3]);
  assert.deepEqual([everyone.stopped, everyone.campaign.colony.raid], [false, null]);
  const [lost] = everyone.campaign.colony.news;
  assert.deepEqual([lost.won, lost.landed, lost.fell], [false, raiders.length, 0]);
  assert.ok(lost.food > 0 && lost.materials > 0);
  assert.equal(everyone.campaign.flags.raidsFoughtOutLost, 1);
  const stranded = stoppedOut(base, far, [1, 2, 3]);
  assert.deepEqual(defendersOf(stranded), []);
  const empty = faceRaid(stranded, rules);
  assert.deepEqual([empty.ok, empty.fight, empty.won, empty.campaign.place], [true, false, false, 'hub']);
  assert.deepEqual(empty.taken, raidTake(stranded, rules));
  assert.equal(empty.campaign.colony.raid, null);
  assert.deepEqual(campaignProblems(empty.campaign), []);
});

test('saves: v23 for the raid coming and a leg it stopped; a v22 colony opens with none coming; broken ones are caught', () => {
  // 24 since M32's orders in a fight, 27 since M33's fix, 28 since M33b's
  // quests, 29 since M33c's companions.
  assert.equal(SAVE_VERSION, 49);
  // From M38e the colony keeps a heat of its own, the ship's as v37 opens
  // it (unused while the ship is landed there).
  const placed = at(settled(), { places: [far] });
  const base = { ...placed, heat: 30, colony: { ...placed.colony, heat: 30 } };
  const old = (campaign) => ({ ...saveData(initialState(3)), campaign });
  const step = MIGRATIONS.find((s) => s.from === 22);
  // A v22 colony had no raid; a v22 trip no leg.
  const { raid, ...v22colony } = base.colony;
  assert.equal(raid, null);
  assert.deepEqual(step.up(old({ ...base, colony: v22colony })).campaign, base);
  const flying = flyOut(base, rules, 0, [1]).campaign;
  const { leg, ...v22trip } = flying.colony.trip;
  assert.equal(leg, null);
  const { raid: none, ...v22away } = flying.colony;
  assert.equal(none, null);
  assert.deepEqual(step.up(old({ ...flying, colony: { ...v22away, trip: v22trip } })).campaign, flying);
  assert.equal(step.up(old(null)).campaign, null);
  // Through the front door, from v22: a campaign from before quests gets
  // its background's thread at the colony's step (v28, M33b).
  const { quests, ...v22campaign } = base;
  assert.ok(quests);
  const opened = parseSave(JSON.stringify({ version: 22, data: old({ ...v22campaign, colony: v22colony }) }));
  assert.equal(opened.ok, true, opened.error);
  assert.deepEqual(opened.save.data.campaign, { ...base, quests: { debt: { step: 2, state: 'open' } } });
  // A raid coming, a leg stopped and a raid fight each reload as they were.
  const coming = { ...base, colony: { ...base.colony, raid: { found: 1, lands: 2 } } };
  const stopped = stoppedOut(base, far, [1]);
  let fighting = null;
  for (let n = 1; n <= 50 && !fighting; n++) {
    const tried = faceRaid({ ...down(base), rng: seedFrom(n) }, rules);
    if (tried.fight) fighting = tried.campaign;
  }
  for (const campaign of [coming, stopped, fighting]) {
    const saved = parseSave(JSON.stringify(makeSave(old(campaign))));
    assert.equal(saved.ok, true, saved.error);
    assert.deepEqual(saved.save.data.campaign, campaign);
  }
  // Broken ones are caught.
  const broken = (colony) => campaignProblems({ ...base, colony: { ...base.colony, ...colony } });
  assert.deepEqual(broken({ raid: { found: 3, lands: 3 } }), ["The campaign's colony is unreadable."]);
  assert.deepEqual(broken({ raid: { found: 0, lands: 2 } }), ["The campaign's colony is unreadable."]);
  assert.deepEqual(broken({ raid: undefined }), ["The campaign's colony is unreadable."]);
  const badLeg = (leg) => campaignProblems({ ...stopped, colony: { ...stopped.colony, trip: { ...stopped.colony.trip, leg } } });
  assert.deepEqual(badLeg({ dir: 'up', left: 1 }), ["The campaign's trip has an unreadable leg."]);
  assert.deepEqual(badLeg({ dir: 'out', left: 0 }), ["The campaign's trip has an unreadable leg."]);
  assert.deepEqual(badLeg(undefined), ["The campaign's trip has an unreadable leg."]);
  const doneOut = campaignProblems({ ...stopped, colony: { ...stopped.colony, trip: { ...stopped.colony.trip, done: true, result: { won: false, parts: [], materials: 0 } } } });
  assert.deepEqual(doneOut, ["The campaign's trip is done at a place it hasn't reached."]);
  // A raid fight with no lander down.
  assert.deepEqual(campaignProblems({ ...fighting, colony: { ...fighting.colony, raid: null } }), ["The campaign's raid fight has no lander down at the colony."]);
});

test('the reducer: Defend opens the fight on its screen, and its end comes home; Fly on flies the rest of a stopped leg', () => {
  const base = withBuildings(at(settled(), { places: [far] }), [['weapon', 0, 0]]);
  let state = { ...initialState(3), campaign: down({ ...base, heat: 70 }), screen: 'colony' };
  let defended = null;
  for (let n = 1; n <= 50 && !defended; n++) {
    const tried = reduce({ ...state, campaign: { ...state.campaign, rng: seedFrom(n) } }, { type: 'campaign/raid/face', rules });
    if (tried.campaign.fight) defended = tried;
  }
  assert.ok(defended);
  assert.equal(defended.screen, 'campaign-fight');
  const battle = { ...defended.campaign.fight.battle, winner: 'crew' };
  state = reduce(defended, { type: 'campaign/fight/save', battle, log: defended.campaign.fight.log });
  state = reduce(state, { type: 'campaign/fight/end', rules });
  assert.deepEqual([state.screen, state.campaign.colony.raid, state.campaign.heat], ['colony', null, heatAfterRaid]);
  // Out on a trip, a raid is fought out and the leg goes on (M38f).
  const coming = { ...base, heat: 30, colony: { ...base.colony, raid: { found: 1, lands: 2 } } };
  const out = reduce({ ...initialState(3), campaign: coming, screen: 'colony' }, { type: 'campaign/trip/out', index: 0, squad: [1], rules });
  assert.deepEqual([out.screen, out.campaign.colony.trip.leg, out.campaign.colony.raid, out.campaign.colony.day], ['colony', null, null, 4]);
  // A stopped leg, from a save from before, flies on through the reducer
  // once the raid is faced.
  let away = { ...initialState(3), campaign: stoppedOut({ ...base, heat: 30 }, far, [1]), screen: 'colony' };
  assert.equal(away.campaign.colony.trip.leg.left, 2);
  assert.equal(reduce(away, { type: 'campaign/trip/on', rules }), away, 'not while the lander is down');
  away = { ...away, campaign: settleRaid(away.campaign, rules, true).campaign };
  const on = reduce(away, { type: 'campaign/trip/on', rules });
  assert.deepEqual([on.screen, on.campaign.colony.trip.leg, on.campaign.colony.day], ['colony', null, 4]);
  // Defending with no lander down changes nothing.
  assert.equal(reduce(on, { type: 'campaign/raid/face', rules }), on);
});
