// M38d: the run goes on. At the colony, Fly out takes the crew picked
// aboard and leaves the rest at home; the stores split between the ship's
// holds and the colony's storehouses, and what neither holds spoils. The
// ship jumps into a system past the colony's, a chart as act 2's sectors
// are with worlds among its nodes, whose jump point leads to the next.
// Everything of act 2's run works there for those aboard, and each jump,
// survey or day's rest passes a day at the colony. A raid's lander down at
// home holds the ship until those at home face it; lost, it takes the
// colony's stores and nothing aboard. Fly home goes from anywhere, a day
// and a jump's supplies for each system out, with one jump's heat, and a
// lander can stop it on the way. Landed, the crew is one and the stores
// one store. Saves are at v36. From M38f a raid where the ship isn't is
// fought out the day its lander comes down (raids.js fightAway), so no
// lander stops a flight but one stopped in a save from before.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seedFrom } from '../src/core/rng.js';
import { makeSave, MIGRATIONS, parseSave, SAVE_VERSION } from '../src/core/save.js';
import { atColony, atStation } from '../src/sim/acts.js';
import { MAX_OUT, nextCrewId, wholeCrew } from '../src/sim/away.js';
import { campaignProblems, crewAboard, HEAT_MAX } from '../src/sim/campaign.js';
import { colonyStats, storesOf } from '../src/sim/colony.js';
import { crewRoom } from '../src/sim/crew.js';
import { dayPlan, nextDay, voyageDay } from '../src/sim/days.js';
import { otherWorlds } from '../src/sim/expeditions.js';
import { generateSector } from '../src/sim/gen/sector.js';
import { beyondSystem } from '../src/sim/gen/system.js';
import { endColonyRaid, faceRaid, flightHome, landingPlan, raidDown } from '../src/sim/raids.js';
import { dismissPlan, hireRecruit, recruitsAt } from '../src/sim/recruits.js';
import { regroup } from '../src/sim/regroup.js';
import { campaignScreen, initialState, reduce, saveData } from '../src/sim/root.js';
import { isWorld } from '../src/sim/runShape.js';
import { settlePlan } from '../src/sim/settle.js';
import { survey, surveyPlan } from '../src/sim/survey.js';
import { buySupplies, holdOf, jump, jumpPlan, leavePlan, leaveSector, linked, onTheRun, scan, supplyCapacity } from '../src/sim/travel.js';
import { voyageHome, voyageHomePlan, voyageOut, voyagePlan } from '../src/sim/voyage.js';
import { rules } from './battleKit.js';
import { settled } from './colonyKit.js';

const { jumpHeat, heatAfterRaid, raidWarning } = rules.balance;
const { systems } = rules.worlds.names;

// The colony with a storehouse standing: a cargo hold given, which keeps
// 20 and needs no power, so it keeps as much with the ship away.
function withStore(campaign) {
  const { colony } = campaign;
  return { ...campaign, colony: { ...colony, buildings: [...colony.buildings, { uid: colony.nextUid, type: 'cargo', x: 10, y: 4, rot: 0 }], nextUid: colony.nextUid + 1 } };
}

// The colony at the kit's world with a storehouse and the stores full: 30
// in the landed ship's holds and 20 in the storehouse.
const home = withStore({ ...settled(1), supplies: 50 });
const ids = home.crew.map((member) => member.id);
// Out on a voyage with the first two aboard, the third at home.
const away = voyageOut(home, rules, ids.slice(0, 2)).campaign;

// The ship at node id of its map, as though it had jumped there.
function at(campaign, id) {
  return { ...campaign, run: { ...campaign.run, at: id, seen: [...new Set([...campaign.run.seen, id])], docked: false, jobbed: [] } };
}

// The first node of a kind on the ship's map.
function nodeOf(campaign, type) {
  return campaign.run.sector.nodes.find((node) => node.type === type);
}

// The colony with the raid's lander coming down on day `lands`.
function landing(campaign, lands = campaign.colony.day) {
  return { ...campaign, colony: { ...campaign.colony, raid: { found: Math.max(1, lands - raidWarning), lands } } };
}

// The ship with its event at the way in still to settle: a derelict's.
function heldByEvent(campaign) {
  const event = [...rules.events.values()].find((entry) => entry.kind === 'derelict' && !entry.quest);
  const nodes = campaign.run.sector.nodes.map((node) => (node.id === campaign.run.at ? { ...node, type: 'derelict', event: event.id } : node));
  return { ...campaign, run: { ...campaign.run, sector: { ...campaign.run.sector, nodes } } };
}

test('Fly out plans who goes and who stays, the flight checks for those aboard, and the stores split', () => {
  const plan = voyagePlan(home, rules, [ids[0], ids[1]]);
  assert.ok(plan.ok, plan.error);
  assert.deepEqual(plan.crew, ids.slice(0, 2));
  assert.deepEqual(plan.home, ids.slice(2));
  // The kit's crew sleeps aboard the landed ship: whoever stays has no bed
  // and air without it, and won't rest while it is away (M28's rule).
  assert.deepEqual(plan.rough, ids.slice(2));
  // The ship's holds take their fill, the storehouse the rest, and nothing
  // spoils.
  const holds = supplyCapacity(home.ship, rules, home.crew.slice(0, 2));
  assert.deepEqual(plan.food, { now: 50, ship: holds, colony: 50 - holds, room: 20, spoils: 0 });
  // The materials stay, all of them (M38d's fix): the kit's colony has no
  // mine digging while the ship is away, and its storehouse keeps 20.
  assert.deepEqual(plan.materials, { now: home.colony.materials, dug: 0, room: 20 });
  // The jump into the next system: a jump's supplies for those aboard and a
  // jump's heat.
  assert.equal(plan.jump.kind, 'beyond');
  assert.equal(plan.jump.supplies, 2 * rules.balance.jumpSupplies);
  assert.equal(plan.jump.heat, jumpHeat);

  // Without a storehouse, what the holds can't take spoils, as the first tap
  // says; the materials stay all the same.
  const bare = voyagePlan({ ...settled(1), supplies: 50 }, rules, ids);
  assert.deepEqual(bare.food, { now: 50, ship: holds, colony: 0, room: 0, spoils: 50 - holds });
  assert.deepEqual(bare.materials, { now: home.colony.materials, dug: 0, room: 0 });

  // The flight checks count those aboard: more than the ship beds and
  // breathes for can't go.
  const room = crewRoom(home.ship, rules);
  const extra = Array.from({ length: room + 1 - home.crew.length }, (_, i) => ({ ...home.crew[2], id: 10 + i, name: `Spare ${i}` }));
  const crowd = { ...home, crew: [...home.crew, ...extra] };
  const crowded = voyagePlan(crowd, rules, crowd.crew.map((member) => member.id));
  assert.equal(crowded.ok, false);
  assert.match(crowded.error, new RegExp(`The ship can't fly with ${room + 1} aboard`));
  assert.ok(voyagePlan(crowd, rules, crowd.crew.slice(0, room).map((member) => member.id)).ok);

  // Who goes: one or more of the crew, each once.
  assert.match(voyagePlan(home, rules, []).error, /Pick who goes/);
  assert.match(voyagePlan(home, rules, [99]).error, /from the crew/);
  assert.match(voyagePlan(home, rules, [ids[0], ids[0]]).error, /from the crew/);
  // Only from the colony, with the ship home and no lander down.
  const trip = { place: { kind: 'rock', name: 'The Anvil', days: 2, event: 'rich-seam', held: false, seed: 11 }, squad: [ids[0]], done: false, result: null, leg: null };
  assert.match(voyagePlan({ ...home, colony: { ...home.colony, trip } }, rules, [ids[1]]).error, /away already/);
  assert.match(voyagePlan(landing({ ...home, colony: { ...home.colony, day: 4 } }), rules, ids).error, /lander is down/);
  assert.match(voyagePlan(away, rules, ids).error, /leave from the colony/);
});

test('past the colony only the task force follows too (M40): Fly out, the jumps on and the jumps between them go by the uncharted rule', () => {
  const trail = { chance: 0, ship: null, why: 'trail' };
  const { taskForce } = rules.backgrounds.get(home.background).pursuer.run;
  const warm = { ...home, heat: 60 };
  assert.deepEqual(voyagePlan(warm, rules, ids.slice(0, 2)).jump.hunt, trail);
  assert.deepEqual(voyagePlan({ ...home, heat: 80 }, rules, ids.slice(0, 2)).jump.hunt, { chance: rules.balance.taskForceChance, ship: taskForce, why: null });
  // Out there, between its nodes and on to the next system.
  const out = { ...away, heat: 60 };
  const next = linked(out.run.sector, out.run.at).find((id) => !rules.nodeTypes.get(out.run.sector.nodes[id].type).safe && !rules.nodeTypes.get(out.run.sector.nodes[id].type).hides);
  assert.deepEqual(jumpPlan(out, rules, next).hunt, trail);
  const exit = at(out, out.run.sector.exit);
  assert.deepEqual(leavePlan(exit, rules).hunt, trail);
});

test('flying out splits the crew and the stores, takes the credits and parts, and jumps into a system never charted', () => {
  const flown = voyageOut(home, rules, ids.slice(0, 2));
  assert.ok(flown.ok, flown.error);
  const { campaign } = flown;
  const { voyage } = campaign.colony;
  assert.deepEqual(campaign.crew.map((member) => member.id), ids.slice(0, 2), 'campaign.crew is those aboard');
  assert.deepEqual(voyage.home.crew.map((member) => member.id), ids.slice(2), 'those at home wait in the voyage');
  assert.equal(voyage.out, 1);
  assert.equal(voyage.homing, null);
  assert.deepEqual(wholeCrew(campaign).map((member) => member.id).sort(), [...ids].sort());
  // The holds took their fill and the jump ate from them; the storehouse
  // kept the rest, and the day there ate one (the farms make nothing yet).
  const holds = supplyCapacity(home.ship, rules, home.crew.slice(0, 2));
  assert.equal(campaign.supplies, holds - 2 * rules.balance.jumpSupplies);
  assert.equal(voyage.home.food, 50 - holds - rules.balance.jumpSupplies);
  assert.equal(campaign.colony.materials, home.colony.materials, 'the materials stay');
  // Credits, parts on hand and spare weapons go with the ship.
  assert.equal(campaign.credits, home.credits);
  assert.deepEqual(campaign.parts, home.parts);
  assert.deepEqual(campaign.arms, home.arms);
  // A jump's heat; a day at the colony, which leaves heat alone.
  assert.equal(campaign.heat, Math.min(HEAT_MAX, home.heat + jumpHeat));
  assert.equal(campaign.colony.day, home.colony.day + 1);
  assert.ok(flown.day?.ok);
  // A new system past the settled one, its name from the systems' list and
  // none crossed before.
  const { sector } = campaign.run;
  assert.equal(sector.index, home.run.sector.index + 1);
  assert.equal(sector.system, undefined, 'a chart with a jump point, not the system past the charts');
  assert.deepEqual(campaign.run.past, [...home.run.past, home.run.sector.name]);
  assert.ok(systems.includes(sector.name));
  assert.ok(!campaign.run.past.includes(sector.name));
  assert.equal(campaign.run.at, sector.start);
  const count = (type) => sector.nodes.filter((node) => node.type === type).length;
  assert.equal(count('station'), 2);
  assert.equal(count('shipyard'), 1);
  assert.equal(count('nebula'), 1);
  assert.equal(count('world'), rules.worlds.voyage.worlds);
  assert.equal(campaign.flags.voyages, 1);
  assert.equal(campaign.flags.systemsBeyond, 1);
  assert.equal(campaignScreen(campaign), 'sector');
  assert.deepEqual(campaignProblems(campaign), []);
  // Through the reducer, Fly out goes to the chart.
  const state = { ...initialState(1), campaign: home, screen: 'colony' };
  const next = reduce(state, { type: 'campaign/voyage/out', crew: ids.slice(0, 2), rules });
  assert.equal(next.screen, 'sector');
  assert.deepEqual(next.campaign, campaign);
  assert.equal(reduce(state, { type: 'campaign/voyage/out', crew: [], rules }), state, 'turned down: nothing changes');
});

test("the materials keep while the ship is away, past the storehouses' room too, and the mines fill them only up to it (M38d's fix)", () => {
  // A mine, which digs the world's ore a day and needs no power.
  const mined = { ...home, colony: { ...home.colony, buildings: [...home.colony.buildings, { uid: home.colony.nextUid, type: 'mine', x: 4, y: 4, rot: 0 }], nextUid: home.colony.nextUid + 1 } };
  const { dug } = voyagePlan(mined, rules, ids.slice(0, 2)).materials;
  assert.ok(dug > 0);
  assert.equal(dug, colonyStats(voyageOut(mined, rules, ids.slice(0, 2)).campaign, rules).made.materials);
  const lostOf = (campaign) => campaign.flags.materialsLost ?? 0;
  // Past the storehouse's 20: none lost flying out, and the jump's day at
  // home keeps them, the mine's digging lost.
  const heaped = { ...mined, colony: { ...mined.colony, materials: 45 } };
  const out = voyageOut(heaped, rules, ids.slice(0, 2)).campaign;
  assert.equal(out.colony.materials, 45);
  assert.equal(lostOf(out) - lostOf(heaped), dug);
  // Short of the room, the mine fills them up to it, and no further.
  const low = voyageOut({ ...mined, colony: { ...mined.colony, materials: 20 - 1 } }, rules, ids.slice(0, 2)).campaign;
  assert.equal(low.colony.materials, 20);
  // Home, the room the landed ship's holds give is the colony's again, and
  // the mine digs into it (with the whole crew home, what they add too).
  const back = voyageHome(out, rules).campaign;
  assert.equal(back.colony.materials, 45);
  const room = storesOf(back, rules).total;
  const digs = colonyStats(back, rules).made.materials;
  assert.ok(room > 45 + digs);
  assert.equal(nextDay(back, rules).campaign.colony.materials, 45 + digs);
  // At home the stores' room is all they keep, as since M27.
  const crammed = { ...mined, colony: { ...mined.colony, materials: room } };
  assert.equal(nextDay(crammed, rules).campaign.colony.materials, storesOf(crammed, rules).total);
});

test("a raid found while the ship is away comes down no sooner than the day after the flight home would land (M38d's fix, M38f's day)", () => {
  // The first seed that finds the colony on the day a jump passes at home.
  const found = (campaign) => {
    for (let n = 1; n <= 500; n++) {
      const passed = voyageDay({ ...campaign, rng: seedFrom(`raid ${n}`) }, rules);
      if (passed.day?.found) return passed;
    }
    return null;
  };
  // The colony's own heat sets its odds (M38e): left hot.
  const hot = { ...away, colony: { ...away.colony, heat: HEAT_MAX } };
  // One system out: the warning's days, as at home.
  const near = found(hot);
  assert.ok(near, 'some seed finds the colony');
  assert.deepEqual(near.campaign.colony.raid, { found: away.colony.day, lands: away.colony.day + 1 + raidWarning, extra: 3 });
  assert.equal(flightHome(near.campaign), 1);
  // Five out: six days, the day after the flight home's five (M38f: a raid
  // where the ship isn't is fought out the day it comes down, so the ship
  // flying home at once is in the day before).
  const out = 5;
  const far = { ...hot, colony: { ...hot.colony, voyage: { ...hot.colony.voyage, out, at: out } } };
  const farFound = found(far);
  assert.ok(farFound);
  assert.deepEqual(farFound.campaign.colony.raid, { found: far.colony.day, lands: far.colony.day + 1 + Math.max(raidWarning, out + 1), extra: 3 });
  // Flying home at once lands the day before it comes down: no lander
  // stops it, and the next day everyone is home to face it.
  const flown = voyageHome(farFound.campaign, rules);
  assert.ok(flown.ok, flown.error);
  assert.equal(flown.landed, true);
  assert.equal(flown.days.length, out);
  assert.equal(raidDown(flown.campaign), false);
  assert.equal(flown.campaign.colony.raid.lands, flown.campaign.colony.day + 1);
  const next = nextDay(flown.campaign, rules);
  assert.ok(next.ok, next.error);
  assert.equal(next.fought, null);
  assert.equal(raidDown(next.campaign), true);
  assert.deepEqual(landingPlan(next.campaign, rules).defenders, ids);
  // Found on the way home, the same: the lander comes once the ship is in.
  const homing = { ...far, colony: { ...far.colony, voyage: { ...far.colony.voyage, homing: 2, at: 2 } } };
  assert.equal(found(homing).campaign.colony.raid.lands, homing.colony.day + 1 + raidWarning);
});

test("a voyage's systems are charts as act 2's sectors are, with worlds among their nodes, named past the run's names", () => {
  const seed = 42;
  const made = beyondSystem(rules, seed, 7);
  assert.deepEqual(beyondSystem(rules, seed, 7), made, 'the same seed gives the same system');
  const plain = generateSector(rules, seed, 7);
  assert.deepEqual(made.links, plain.links);
  assert.equal(made.start, plain.start);
  assert.equal(made.exit, plain.exit);
  const worlds = made.nodes.filter((node) => node.world);
  assert.equal(worlds.length, rules.worlds.voyage.worlds);
  assert.equal(new Set(worlds.map((node) => node.world.kind)).size, worlds.length, 'no kind twice');
  for (const node of made.nodes) {
    const was = plain.nodes[node.id];
    if (!node.world) {
      assert.deepEqual(node, was, 'every other node as the sector has it');
      continue;
    }
    assert.ok(Object.keys(rules.sectors.mix).includes(was.type), 'a world stands where the mix rolled a node');
    assert.equal(node.type, 'world');
    assert.ok(isWorld(node.world));
    assert.ok(rules.worlds.names.worlds.includes(node.name));
    assert.equal(node.event, undefined);
    assert.equal(node.hostile, undefined);
  }
  // Its worlds are named past the names taken.
  const taken = worlds.map((node) => node.name);
  assert.ok(beyondSystem(rules, seed, 7, { taken }).nodes.every((node) => !node.world || !taken.includes(node.name)));
  // Named past the names to avoid; once all have been, any but the last.
  assert.equal(beyondSystem(rules, seed, 7, { avoid: systems.slice(1) }).name, systems[0]);
  for (let s = 1; s <= 20; s++) {
    const name = beyondSystem(rules, s, 7, { avoid: systems }).name;
    assert.ok(systems.includes(name) && name !== systems.at(-1), name);
  }
  // Corvettes come, as from act 2's third sector.
  const ships = new Set();
  for (let s = 1; s <= 40; s++) for (const node of beyondSystem(rules, s, 7).nodes) if (node.hostile) ships.add(node.hostile.ship);
  assert.ok(ships.has('corvette'), [...ships].join());
});

test('on the run in act 3, everything is for those aboard, and each jump, survey and day of rest passes a day at the colony', () => {
  assert.ok(onTheRun(away, rules));
  assert.equal(atColony(away, rules), false);
  assert.equal(crewAboard(away), 2);
  // A jump: a jump's supplies for those aboard, a day at home eating the
  // colony's food.
  const to = linked(away.run.sector, away.run.at)[0];
  const jumped = jump(away, rules, to);
  assert.ok(jumped.ok, jumped.error);
  assert.equal(jumped.plan.supplies, 2 * rules.balance.jumpSupplies);
  assert.equal(jumped.campaign.supplies, away.supplies - 2 * rules.balance.jumpSupplies);
  assert.equal(jumped.campaign.colony.day, away.colony.day + 1);
  assert.equal(jumped.campaign.colony.voyage.home.food, away.colony.voyage.home.food - rules.balance.jumpSupplies);
  assert.equal(jumped.day.plan.eats, rules.balance.jumpSupplies, 'those at home eat');
  assert.equal(jumped.campaign.flags.voyageDays, 2);
  // A scan takes no day.
  const scanned = scan(away, rules);
  if (scanned.ok) assert.equal(scanned.campaign.colony.day, away.colony.day);
  // A day of rest passes one.
  const hurt = { ...away, crew: away.crew.map((member, i) => (i === 0 ? { ...member, hp: 1 } : member)) };
  const rested = regroup(hurt, rules);
  assert.ok(rested.ok, rested.error);
  assert.equal(rested.campaign.colony.day, away.colony.day + 1);
  assert.ok(rested.day);
  // So does a survey of a world the voyage passes; from M38e it can be
  // settled too (colonies.test.js).
  const world = at(away, nodeOf(away, 'world').id);
  assert.ok(surveyPlan(world, rules).ok);
  const surveyed = survey(world, rules);
  assert.equal(surveyed.campaign.colony.day, world.colony.day + 1);
  assert.ok(surveyed.campaign.run.surveyed.includes(world.run.at));
  assert.ok(settlePlan(world, rules).ok);
  // The colony's day leaves heat alone while the ship is away; at home it
  // falls.
  const hot = { ...away, heat: 40 };
  assert.equal(jump(hot, rules, to).campaign.heat, 40 + jumpHeat);
  const settledHot = { ...home, heat: 40 };
  assert.equal(nextDay(settledHot, rules).campaign.heat, 40 - rules.balance.colonyHeatFall);
  // The colony's Next day and its trips wait for the ship.
  assert.match(dayPlan(away, rules).error, /The ship is away/);
});

test("stations on a voyage serve those aboard: supplies, recruits signing on aboard with ids past everyone's, and someone stays aboard", () => {
  const station = at({ ...away, credits: 500 }, nodeOf(away, 'station').id);
  assert.ok(atStation(station, rules));
  const bought = buySupplies(station, rules, 1);
  assert.ok(bought.ok, bought.error);
  assert.equal(bought.campaign.supplies, station.supplies + 1);
  // A recruit signs on aboard, with an id none at home has.
  const [recruit] = recruitsAt(station, rules, station.run.at);
  const hired = hireRecruit(station, rules, recruit.slot);
  assert.ok(hired.ok, hired.error);
  const member = hired.campaign.crew.at(-1);
  assert.equal(member.id, Math.max(...ids) + 1);
  assert.equal(nextCrewId(station), Math.max(...ids) + 1);
  assert.deepEqual(hired.campaign.colony.voyage.home, station.colony.voyage.home);
  assert.deepEqual(campaignProblems(hired.campaign), []);
  // With the captain at home, the last one aboard can't be let go.
  const captainHome = voyageOut(home, rules, [ids[1]]).campaign;
  assert.equal(captainHome.crew.length, 1);
  assert.deepEqual(campaignProblems(captainHome), [], "the captain may stay home");
  assert.match(dismissPlan(at(captainHome, nodeOf(captainHome, 'station').id), rules, ids[1]).error, /stay aboard/);
});

test("the system's jump point leads on to the next system, without end", () => {
  const exit = at(away, away.run.sector.exit);
  const plan = leavePlan(exit, rules);
  assert.ok(plan.ok, plan.error);
  assert.equal(plan.kind, 'beyond');
  assert.deepEqual(plan.cold, []);
  const left = leaveSector(exit, rules);
  assert.ok(left.ok, left.error);
  const { campaign } = left;
  assert.equal(campaign.colony.voyage.out, 2);
  assert.equal(campaign.run.sector.index, exit.run.sector.index + 1);
  assert.deepEqual(campaign.run.past, [...exit.run.past, exit.run.sector.name]);
  assert.ok(!campaign.run.past.includes(campaign.run.sector.name), 'named past the systems crossed');
  assert.equal(campaign.colony.day, exit.colony.day + 1);
  assert.equal(campaign.flags.systemsBeyond, 2);
  assert.match(leavePlan(away, rules).error, /The system is left from its jump point/);
  // Past the farthest a save keeps, no chart reaches.
  const farthest = { ...exit, colony: { ...exit.colony, voyage: { ...exit.colony.voyage, out: MAX_OUT } } };
  assert.match(leavePlan(farthest, rules).error, /No chart/);
});

test("a raid while away holds the ship; those at home face it from the chart, and lost it takes the colony's stores and nothing aboard", () => {
  const down = landing(away);
  assert.match(holdOf(down, rules), new RegExp(`lander is down at ${home.colony.world.name}`));
  assert.match(jumpPlan(down, rules, linked(down.run.sector, down.run.at)[0]).error, /lander is down/);
  assert.match(voyageHomePlan(down, rules).error, /lander is down/);
  const plan = landingPlan(down, rules);
  assert.ok(plan.ok, plan.error);
  assert.deepEqual(plan.defenders, ids.slice(2), 'those at home');
  // Defend: the guns fire, and those at home fight what lands.
  const faced = faceRaid(down, rules);
  assert.ok(faced.ok, faced.error);
  assert.ok(faced.fight, 'the kit colony has no guns: the raiders land');
  const fighting = faced.campaign;
  assert.equal(fighting.place, 'fight');
  assert.deepEqual(fighting.crew.map((member) => member.id), ids.slice(2), 'those at home are in play');
  assert.deepEqual(fighting.colony.voyage.aboard.crew.map((member) => member.id), ids.slice(0, 2));
  assert.equal(fighting.colony.voyage.aboard.supplies, away.supplies);
  assert.equal(fighting.supplies, away.colony.voyage.home.food);
  assert.deepEqual(campaignProblems(fighting), []);
  assert.equal(campaignScreen(fighting), 'campaign-fight');
  // Lost: half the colony's food and materials, no part; heat falls.
  const lost = endColonyRaid({ ...fighting, fight: { ...fighting.fight, battle: { ...fighting.fight.battle, winner: 'enemy' } } }, rules);
  assert.deepEqual(lost.crew.map((member) => member.id), ids.slice(0, 2), 'back aboard');
  assert.equal(lost.supplies, away.supplies);
  assert.equal(lost.colony.voyage.home.food, away.colony.voyage.home.food - Math.floor(away.colony.voyage.home.food / 2));
  assert.equal(lost.colony.materials, away.colony.materials - Math.floor(away.colony.materials / 2));
  assert.deepEqual(lost.parts, away.parts);
  assert.equal(lost.colony.raid, null);
  assert.ok(lost.heat <= heatAfterRaid);
  assert.equal(lost.flags.raidsLostAway, 1);
  assert.equal(holdOf(lost, rules), null);
  assert.equal(campaignScreen(lost), 'sector');
  assert.deepEqual(campaignProblems(lost), []);
  // Through the reducer: Defend from the chart, the fight, and back.
  const state = { ...initialState(1), campaign: down, screen: 'sector' };
  const fought = reduce(state, { type: 'campaign/raid/face', rules });
  assert.equal(fought.screen, 'campaign-fight');
  const over = reduce({ ...fought, campaign: { ...fought.campaign, fight: { ...fought.campaign.fight, battle: { ...fought.campaign.fight.battle, winner: 'crew' } } } }, { type: 'campaign/fight/end', rules });
  assert.equal(over.screen, 'sector');
  assert.equal(over.campaign.flags.raidsWonAway, 1);
  assert.deepEqual(over.campaign.crew.map((member) => member.id), ids.slice(0, 2));

  // With nobody home, the landing's hits are all the colony has.
  const all = landing(voyageOut(home, rules, ids).campaign);
  assert.deepEqual(landingPlan(all, rules).defenders, []);
  const empty = faceRaid(all, rules);
  assert.ok(empty.ok, empty.error);
  assert.equal(empty.fight, false);
  assert.equal(empty.won, false);
  assert.equal(empty.taken.part, null, 'nothing aboard the ship');
  assert.equal(empty.campaign.colony.voyage.home.food, all.colony.voyage.home.food - empty.taken.food);
  assert.deepEqual(empty.campaign.parts, all.parts);
  assert.equal(empty.campaign.place, 'hub');
  assert.deepEqual(campaignProblems(empty.campaign), []);
});

test('Fly home: a day and a jump\'s supplies a system out, with one jump\'s heat; the ship lands, the crew and the stores one again', () => {
  const twoOut = leaveSector(at(away, away.run.sector.exit), rules).campaign;
  const plan = voyageHomePlan(twoOut, rules);
  assert.ok(plan.ok, plan.error);
  assert.equal(plan.days, 2);
  assert.equal(plan.heat, jumpHeat);
  assert.equal(plan.eats, 2 * 2 * rules.balance.jumpSupplies);
  assert.equal(plan.stopped, false);
  const flown = voyageHome(twoOut, rules);
  assert.ok(flown.ok, flown.error);
  assert.equal(flown.landed, true);
  assert.equal(flown.days.length, 2);
  const { campaign } = flown;
  assert.equal(campaign.colony.voyage, null);
  assert.deepEqual(campaign.crew.map((member) => member.id), ids, 'the crew one again, in its order');
  assert.equal(campaign.colony.day, twoOut.colony.day + 2);
  assert.equal(campaign.heat, Math.min(HEAT_MAX, twoOut.heat + jumpHeat));
  // One store again, up to its room.
  const room = storesOf(campaign, rules).total;
  assert.equal(plan.food.room, room);
  assert.equal(campaign.supplies, Math.min(room, plan.food.ship[1] + plan.food.colony[1]));
  assert.ok(atColony(campaign, rules));
  assert.equal(campaignScreen(campaign), 'colony');
  assert.equal(campaign.flags.voyagesHome, 1);
  assert.deepEqual(campaignProblems(campaign), []);
  // Flying out once more jumps into a new system, the next in the line.
  const again = voyageOut(campaign, rules, ids.slice(0, 2)).campaign;
  assert.equal(again.colony.voyage.out, 1);
  assert.equal(again.run.sector.index, twoOut.run.sector.index + 1);
  assert.ok(!again.run.past.includes(again.run.sector.name));
  // Through the reducer, home to the colony.
  const state = { ...initialState(1), campaign: twoOut, screen: 'sector' };
  assert.equal(reduce(state, { type: 'campaign/voyage/home', rules }).screen, 'colony');
  // Not while something holds the ship.
  assert.match(voyageHomePlan(heldByEvent(away), rules).error, /Decide first/);
  assert.match(voyageHomePlan(home, rules).error, /The ship is home/);
});

test('a lander coming down on the way home is fought out there and the flight goes on (M38f); a flight one stopped in a save from before flies on once it is faced', () => {
  // Three systems out, the lander coming down after the first day home.
  let far = away;
  for (let n = 0; n < 2; n++) far = leaveSector(at(far, far.run.sector.exit), rules).campaign;
  assert.equal(far.colony.voyage.out, 3);
  const coming = landing(far, far.colony.day + 1);
  const flown = voyageHome(coming, rules);
  assert.ok(flown.ok, flown.error);
  assert.equal(flown.stopped, false);
  assert.equal(flown.landed, true);
  assert.equal(flown.days.length, 3);
  // Fought out by those at home the day it came down, and the report waits.
  assert.equal(flown.campaign.colony.raid, null);
  assert.equal(flown.campaign.flags.raidsFoughtOut, 1);
  assert.deepEqual(flown.campaign.colony.news.map((entry) => [entry.kind, entry.day]), [['raid', far.colony.day + 1]]);
  assert.deepEqual(campaignProblems(flown.campaign), []);
  // Stopped two systems out with the lander down, as a save from before
  // has it.
  const campaign = landing({ ...far, colony: { ...far.colony, voyage: { ...far.colony.voyage, homing: 2, at: 2 } } });
  assert.equal(onTheRun(campaign, rules), false, 'on its way home, the ship makes no moves on the run');
  assert.deepEqual(campaignProblems(campaign), []);
  assert.equal(campaignScreen(campaign), 'sector');
  assert.match(voyageHomePlan(campaign, rules).error, /lander is down/);
  // Faced: Fly home flies the two days left, with no more heat.
  const faced = faceRaid(campaign, rules);
  assert.ok(faced.ok, faced.error);
  const over = faced.fight ? endColonyRaid({ ...faced.campaign, fight: { ...faced.campaign.fight, battle: { ...faced.campaign.fight.battle, winner: 'crew' } } }, rules) : faced.campaign;
  const plan = voyageHomePlan(over, rules);
  assert.ok(plan.ok, plan.error);
  assert.equal(plan.days, 2);
  assert.equal(plan.heat, 0);
  assert.equal(plan.stopped, true);
  const landed = voyageHome(over, rules);
  assert.equal(landed.landed, true);
  assert.equal(landed.campaign.colony.voyage, null);
  assert.equal(landed.campaign.heat, over.heat);
  // A lander on the flight's last day is fought out before the ship is in
  // (M38f): it lands to the report, with nothing to face.
  const last = voyageHome(landing(away, away.colony.day + 1), rules);
  assert.equal(last.landed, true);
  assert.equal(raidDown(last.campaign), false);
  assert.equal(last.campaign.colony.raid, null);
  assert.equal(last.campaign.colony.news.at(-1).kind, 'raid');
});

test("the colony keeps its system's other worlds, which its trips reach, as the run moves on past them", () => {
  const names = otherWorlds(home).map((world) => world.name);
  assert.equal(names.length, rules.worlds.system.worlds - 1);
  assert.ok(!names.includes(home.colony.world.name));
  const back = voyageHome(away, rules).campaign;
  assert.notEqual(back.run.sector.name, home.run.sector.name, 'the run is a system past the colony now');
  assert.deepEqual(otherWorlds(back), otherWorlds(home));
  // While away, the colony runs without the ship: its own power, its
  // storehouses alone, those at home its crew.
  const stats = colonyStats(away, rules);
  assert.equal(stats.power.ship, 0);
  assert.equal(storesOf(away, rules).ship, 0);
  assert.equal(storesOf(away, rules).colony, 20);
});

test('saves at v36 keep a voyage, and those at home in play in a raid fight; a v35 colony migrates home with its worlds; voyages that do not read are caught', () => {
  assert.equal(SAVE_VERSION, 52);
  assert.equal(MIGRATIONS.at(-1).from, SAVE_VERSION - 1);
  const fighting = faceRaid(landing(away), rules).campaign;
  for (const campaign of [away, fighting]) {
    const loaded = parseSave(JSON.stringify(makeSave(saveData({ ...initialState(7), campaign }))));
    assert.ok(loaded.ok, loaded.error);
    assert.deepEqual(loaded.save.data.campaign, campaign);
  }
  // Continue comes back to wherever the ship is.
  const opened = reduce({ ...initialState(7), campaign: away, screen: 'title' }, { type: 'campaign/continue' });
  assert.equal(opened.screen, 'sector');
  // A colony saved at v35 has the ship home and keeps the worlds of the
  // system its run ended in.
  // (It has no number, place or heat of its own either, M38e's, nor
  // citizens, growth or news, M38f's.)
  const { worlds, voyage, id: _id, at: _at, heat: _heat, citizens: _citizens, growth: _growth, news: _news, ...colony } = home.colony;
  assert.equal(voyage, null);
  const v35 = { ...makeSave(saveData({ ...initialState(7), campaign: { ...home, colony } })), version: 35 };
  const migrated = parseSave(JSON.stringify(v35));
  assert.ok(migrated.ok, migrated.error);
  assert.deepEqual(migrated.save.data.campaign.colony, home.colony);
  assert.deepEqual(migrated.save.data.campaign.colony.worlds, worlds);
  // Voyages that don't read.
  const broken = (change) => campaignProblems({ ...away, colony: { ...away.colony, voyage: { ...away.colony.voyage, ...change } } });
  const { home: homeSide, ...side } = away.colony.voyage;
  assert.match(broken({ out: 0 }).join(), /voyage is unreadable/);
  assert.match(broken({ homing: 2 }).join(), /voyage is unreadable/);
  assert.match(campaignProblems({ ...away, colony: { ...away.colony, voyage: { ...side, aboard: { crew: away.crew, supplies: 0 }, home: homeSide } } }).join(), /voyage is unreadable/);
  assert.match(broken({ home: { ...homeSide, crew: [...homeSide.crew, away.crew[0]] } }).join(), /names crew twice/);
  assert.match(campaignProblems({ ...away, crew: [] }).join(), /nobody aboard|captain/);
  assert.match(campaignProblems({ ...away, colony: { ...away.colony, voyage: { ...side, aboard: { crew: homeSide.crew, supplies: 0 } } } }).join(), /no raid to fight/);
  assert.match(campaignProblems({ ...away, colony: { ...away.colony, trip: { place: home.colony.places[0] ?? { kind: 'rock', name: 'The Anvil', days: 2, event: 'rich-seam', held: false, seed: 11 }, squad: [ids[0]], done: false, result: null, leg: null } } }).join(), /trip and voyage/);
  assert.match(campaignProblems({ ...home, colony: { ...home.colony, worlds: [{ name: '', world: home.colony.world }] } }).join(), /colony is unreadable/);
});
