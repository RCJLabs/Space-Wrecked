// M38e: more colonies. On a voyage, Settle here founds a new colony at a
// world past the colony's: a landing's 20 materials, no buildings, the ship
// landed there with those aboard, and the colony flown from keeping
// whoever was at home and its food. Each colony lies along the line of
// systems, keeps its own grid, stores, days, raid and trail of heat, and
// lives every day that passes. The pursuer finds a colony by its own heat,
// its lander coming no sooner than the ship could reach it, and a lander
// down at any colony holds the ship until it is faced, by whoever is there.
// The ship flies straight to any colony, from a voyage or from the colony
// screen: a day and a jump's supplies a system between, one jump's heat,
// no hunters. Saves are at v37. From M38f a lander coming down where the
// ship isn't is fought out at once (citizens.test.js), so it lands no
// sooner than the day after the ship could, and no flight stops for it: the
// stopped flights here are a save's from before.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seedFrom } from '../src/core/rng.js';
import { makeSave, MIGRATIONS, parseSave, SAVE_VERSION } from '../src/core/save.js';
import { atColony, outOnRun } from '../src/sim/acts.js';
import { aboardOf, wholeCrew } from '../src/sim/away.js';
import { campaignProblems, crewAboard, HEAT_MAX, MAX_CREW } from '../src/sim/campaign.js';
import { allColonies, colonyById, MAX_COLONIES, nextColonyId, reachOf, shipAt, thereAt } from '../src/sim/colonies.js';
import { colonyStats } from '../src/sim/colony.js';
import { freeBerths } from '../src/sim/companions.js';
import { dayPlan, nextDay, voyageDay } from '../src/sim/days.js';
import { downAt, endColonyRaid, faceRaid, foundOdds, landingPlan, raidDown } from '../src/sim/raids.js';
import { hireRecruit, recruitsAt } from '../src/sim/recruits.js';
import { campaignScreen, initialState, reduce, saveData } from '../src/sim/root.js';
import { settle, settlePlan } from '../src/sim/settle.js';
import { holdOf, jumpPlan, linked } from '../src/sim/travel.js';
import { flightFromPlan, flightPlan, flyFrom, flyTo, voyageHome, voyageOut, voyagePlan } from '../src/sim/voyage.js';
import { rules } from './battleKit.js';
import { settled } from './colonyKit.js';

const { jumpHeat, heatAfterRaid, raidWarning, colonyHeatFall } = rules.balance;

// The colony with a storehouse standing: a cargo hold given, which keeps
// 20 and needs no power (as colonyVoyage.test.js has it).
function withStore(campaign) {
  const { colony } = campaign;
  return { ...campaign, colony: { ...colony, buildings: [...colony.buildings, { uid: colony.nextUid, type: 'cargo', x: 10, y: 4, rot: 0 }], nextUid: colony.nextUid + 1 } };
}

// The ship at node id of its map, as though it had jumped there.
function at(campaign, id) {
  return { ...campaign, run: { ...campaign.run, at: id, seen: [...new Set([...campaign.run.seen, id])], docked: false, jobbed: [] } };
}

// The first colony at the kit's world, with a storehouse and the stores
// full; out on a voyage with the first two aboard and the third at home;
// and the voyage's world settled, a second colony one system along.
const home = withStore({ ...settled(1), supplies: 50 });
const ids = home.crew.map((member) => member.id);
const away = voyageOut(home, rules, ids.slice(0, 2)).campaign;
const world = away.run.sector.nodes.find((node) => node.type === 'world');
const atWorld = at(away, world.id);
const two = settle(atWorld, rules).campaign;
const first = (campaign) => colonyById(campaign, 1);

// The other colony numbered id with its raid's lander coming down on day
// `lands` (its day by default: down now).
function landingAt(campaign, id, lands) {
  return {
    ...campaign,
    colonies: campaign.colonies.map((colony) => (colony.id === id ? { ...colony, raid: { found: Math.max(1, (lands ?? colony.day) - raidWarning), lands: lands ?? colony.day } } : colony)),
  };
}

// The first seed whose day finds the colony numbered id, passing days with
// pass, or null.
function foundWith(campaign, pass, id) {
  for (let n = 1; n <= 500; n++) {
    const passed = pass({ ...campaign, rng: seedFrom(`colony raid ${n}`) });
    const colony = colonyById(passed, id);
    if (colony?.raid && !colonyById(campaign, id).raid) return passed;
  }
  return null;
}

test('Settle here on a voyage founds a colony where the ship is: 20 materials, nothing built, those aboard landed, and the colony flown from keeps those at home', () => {
  const plan = settlePlan(atWorld, rules);
  assert.ok(plan.ok, plan.error);
  assert.deepEqual([plan.id, plan.at], [2, away.colony.voyage.at]);
  assert.equal(away.colony.voyage.at, 1, 'one system along from the first colony, at 0');
  // The new colony: its world and its system's other worlds, day 1, a
  // landing's materials, nothing built, its number, place and the ship's heat.
  const others = atWorld.run.sector.nodes.filter((node) => node.world && node.id !== world.id).map((node) => ({ name: node.name, world: node.world }));
  assert.deepEqual(two.colony, {
    world: { name: world.name, ...world.world, surveyed: false },
    buildings: [],
    nextUid: 1,
    day: 1,
    materials: rules.colony.materials,
    places: [],
    trip: null,
    raid: null,
    worlds: others,
    voyage: null,
    id: 2,
    at: 1,
    heat: atWorld.heat,
    citizens: 0,
    growth: 0,
    news: [],
    lowProfile: false,
    trader: null,
  });
  assert.equal(rules.colony.materials, 20);
  // The act stays; the ship is landed there with those aboard and its holds.
  assert.deepEqual([two.act, two.place, campaignScreen(two)], [3, 'hub', 'colony']);
  assert.ok(atColony(two, rules));
  assert.deepEqual(two.crew.map((member) => member.id), ids.slice(0, 2));
  assert.equal(two.supplies, atWorld.supplies);
  // The first keeps whoever was at home and its food, its own heat, and
  // lies where it did.
  assert.equal(two.colonies.length, 1);
  const kept = first(two);
  assert.deepEqual(kept.keep, atWorld.colony.voyage.home);
  assert.deepEqual(kept.keep.crew.map((member) => member.id), ids.slice(2));
  assert.deepEqual([kept.voyage, kept.at, kept.heat, kept.day, kept.materials], [null, 0, atWorld.colony.heat, atWorld.colony.day, atWorld.colony.materials]);
  assert.deepEqual(kept.buildings, home.colony.buildings);
  assert.deepEqual(allColonies(two).map((colony) => colony.id), [2, 1]);
  assert.equal(nextColonyId(two), 3);
  assert.deepEqual(wholeCrew(two).map((member) => member.id).sort(), [...ids].sort());
  assert.equal(two.flags.settled, 2);
  assert.deepEqual(campaignProblems(two), []);
  // Through the game the landing plays.
  const state = reduce({ ...initialState(1), campaign: atWorld, screen: 'sector' }, { type: 'campaign/settle', rules });
  assert.equal(state.screen, 'landing');
  assert.deepEqual(state.campaign, two);
  // As many colonies as a save keeps, and no more.
  const many = { ...atWorld, colonies: Array.from({ length: MAX_COLONIES - 1 }, (_, i) => ({ ...first(two), id: i + 2 })) };
  assert.match(settlePlan(many, rules).error, new RegExp(`${MAX_COLONIES} colonies`));
  // Landed, the ship settles nothing more until it flies out.
  assert.match(settlePlan(two, rules).error, /from the ship, on the run/);
});

test('every colony lives each day that passes: its farms and mines, those there eating its food and resting, its heat falling', () => {
  const kept = first(two);
  // Next day at the second colony passes one at the first too, as a day
  // with the ship away.
  const day = nextDay(two, rules);
  assert.ok(day.ok, day.error);
  const after = first(day.campaign);
  assert.equal(after.day, kept.day + 1);
  assert.equal(day.campaign.colony.day, two.colony.day + 1);
  const there = thereAt(two, 1);
  const plan = dayPlan({ ...there, colony: { ...there.colony, voyage: null } }, rules);
  assert.ok(plan.ok);
  assert.equal(after.keep.food, kept.keep.food + colonyStats(there, rules).made.food - kept.keep.crew.length * rules.balance.jumpSupplies);
  assert.equal(after.heat, kept.heat - colonyHeatFall);
  assert.equal(day.campaign.flags.othersDays, 1);
  assert.deepEqual(campaignProblems(day.campaign), []);
  // It runs on its own power: the ship isn't there.
  assert.equal(colonyStats(there, rules).power.ship, 0);
  // A day of a voyage from the second colony passes at both.
  const out = voyageOut(two, rules, [ids[0]]);
  assert.ok(out.ok, out.error);
  assert.equal(first(out.campaign).day, kept.day + 1);
  assert.equal(out.campaign.colony.day, two.colony.day + 1);
  const rested = voyageDay(out.campaign, rules);
  assert.equal(first(rested.campaign).day, kept.day + 2);
  assert.equal(rested.campaign.colony.day, two.colony.day + 2);
  // Those there go hungry with nothing to eat, the farms growing none
  // (the kit's colony has no farm), and with no bed and air they don't
  // rest, the ship being away (M28's rule for a trip).
  assert.equal(colonyStats(there, rules).made.food, 0);
  const starved = { ...two, colonies: [{ ...kept, keep: { crew: kept.keep.crew.map((member) => ({ ...member, hp: 5 })), food: 0 } }] };
  const hungry = nextDay(starved, rules).campaign;
  assert.equal(first(hungry).keep.crew[0].hp, 5 - rules.balance.hungerHp);
  assert.equal(hungry.flags.othersHungryDays, 1);
  assert.deepEqual(colonyStats(thereAt(starved, 1), rules).rough, ids.slice(2));
});

test('each colony keeps its own trail: the heat the ship left it with, falling a day; landing, the ship takes the greater; the hunters go by the ship\'s', () => {
  // Fly out leaves the ship's heat with the colony, and a day falls off it
  // on the way; the ship's rises with the jump.
  const start = { ...home, heat: 30 };
  const out = voyageOut(start, rules, ids.slice(0, 2)).campaign;
  assert.equal(out.colony.heat, 30 - colonyHeatFall);
  assert.equal(out.heat, 30 + jumpHeat);
  // While the ship is away the colony's heat falls and the ship's stays.
  const day = voyageDay(out, rules).campaign;
  assert.deepEqual([day.colony.heat, day.heat], [out.colony.heat - colonyHeatFall, out.heat]);
  // The colony's odds go by its own heat, not the ship's.
  assert.equal(foundOdds({ ...out, heat: HEAT_MAX, colony: { ...out.colony, heat: 0 } }, rules), 0);
  assert.ok(foundOdds({ ...out, heat: 0, colony: { ...out.colony, heat: HEAT_MAX } }, rules) > 0);
  // Landed, the greater: a cold ship home to a hot colony is hot.
  const cold = { ...out, heat: 4, colony: { ...out.colony, heat: 50 } };
  const landed = voyageHome(cold, rules);
  assert.ok(landed.landed, landed.error);
  assert.equal(landed.campaign.heat, 50 - colonyHeatFall);
  const hot = voyageHome({ ...out, heat: 60, colony: { ...out.colony, heat: 5 } }, rules).campaign;
  assert.equal(hot.heat, 60 + jumpHeat);
  // Landed at the second colony, its heat is the campaign's and the
  // first's its own.
  assert.equal(two.heat, atWorld.heat);
  assert.equal(foundOdds(two, rules), foundOdds({ ...two, colony: { ...two.colony, heat: 0 } }, rules), "the landed colony's odds go by the campaign's heat");
});

test('a raid found at a colony the ship is not at comes down no sooner than the ship could reach it', () => {
  // The first colony, hot, one system from the ship landed at the second:
  // the warning's days.
  const hot = { ...two, colonies: [{ ...first(two), heat: HEAT_MAX }] };
  assert.equal(reachOf(hot, first(hot)), 1);
  const near = foundWith(hot, (campaign) => nextDay(campaign, rules).campaign, 1);
  assert.ok(near, 'some seed finds it');
  assert.deepEqual(first(near).raid, { found: first(hot).day, lands: first(hot).day + 1 + raidWarning, extra: 3 });
  assert.equal(near.flags.othersRaidsFound, 1);
  // Seven systems from the ship: the flight's seven days and, from M38f,
  // the day after.
  const far = { ...hot, colony: { ...hot.colony, at: 7 } };
  assert.equal(reachOf(far, first(far)), 7);
  const farFound = foundWith(far, (campaign) => nextDay(campaign, rules).campaign, 1);
  assert.deepEqual(first(farFound).raid, { found: first(far).day, lands: first(far).day + 1 + 7 + 1, extra: 3 });
  // Flying there at once lands the day before it comes down: everyone
  // there to face it.
  const flight = flyFrom(farFound, rules, 1, ids.slice(0, 2));
  assert.ok(flight.ok, flight.error);
  assert.equal(flight.landed, true);
  assert.equal(flight.campaign.colony.id, 1);
  assert.equal(raidDown(flight.campaign), false);
  assert.equal(flight.campaign.colony.raid.lands, flight.campaign.colony.day + 1);
  const next = nextDay(flight.campaign, rules).campaign;
  assert.equal(raidDown(next), true);
  assert.deepEqual(landingPlan(next, rules).defenders, ids);
});

test('a lander down at any colony holds the ship; Defend, from the colony screen or the chart, with whoever is there, on its grid', () => {
  const down = landingAt(two, 1);
  assert.equal(raidDown(down), true);
  assert.equal(downAt(down).id, 1);
  const where = new RegExp(`lander is down at ${home.colony.world.name}`);
  assert.match(dayPlan(down, rules).error, where);
  assert.match(voyagePlan(down, rules, [ids[0]]).error, where);
  assert.match(flightFromPlan(down, rules, 1, [ids[0]]).error, where);
  // On a voyage from the second colony too.
  const out = voyageOut(two, rules, [ids[0]]).campaign;
  const outDown = landingAt(out, 1);
  assert.match(holdOf(outDown, rules), where);
  assert.match(jumpPlan(outDown, rules, linked(outDown.run.sector, outDown.run.at)[0]).error, where);
  assert.equal(landingPlan(outDown, rules).colony, 1, 'faced from the chart');
  // Defend: those there fight on its grid, in play while it lasts.
  const plan = landingPlan(down, rules);
  assert.ok(plan.ok, plan.error);
  assert.deepEqual([plan.colony, plan.defenders], [1, ids.slice(2)]);
  const faced = faceRaid(down, rules);
  assert.ok(faced.ok, faced.error);
  assert.ok(faced.fight, 'the kit colony has no guns: the raiders land');
  const fighting = faced.campaign;
  assert.deepEqual([fighting.place, fighting.fight.colony, campaignScreen(fighting)], ['fight', 1, 'campaign-fight']);
  assert.deepEqual(fighting.crew.map((member) => member.id), ids.slice(2));
  assert.equal(fighting.supplies, first(two).keep.food);
  assert.deepEqual(first(fighting).parked.crew.map((member) => member.id), ids.slice(0, 2));
  assert.equal(first(fighting).parked.supplies, two.supplies);
  assert.equal(first(fighting).keep, undefined);
  assert.equal(crewAboard(fighting), 0, 'the ship landed at the second, its crew there');
  assert.deepEqual(campaignProblems(fighting), []);
  const loaded = parseSave(JSON.stringify(makeSave(saveData({ ...initialState(7), campaign: fighting }))));
  assert.ok(loaded.ok, loaded.error);
  assert.deepEqual(loaded.save.data.campaign, fighting);
  // Lost: half its food and materials, nothing from the hold; its heat to
  // heatAfterRaid, the ship's as it was.
  const hot = landingAt({ ...two, heat: 70, colonies: [{ ...first(two), heat: 90 }] }, 1);
  const hotFight = faceRaid(hot, rules).campaign;
  const lost = endColonyRaid({ ...hotFight, fight: { ...hotFight.fight, battle: { ...hotFight.fight.battle, winner: 'enemy' } } }, rules);
  assert.deepEqual(lost.crew.map((member) => member.id), ids.slice(0, 2), 'the ship\'s side back in play');
  assert.equal(lost.supplies, two.supplies);
  const was = first(hot);
  const left = first(lost);
  assert.deepEqual(left.keep.crew.map((member) => member.id), ids.slice(2));
  assert.equal(left.parked, undefined);
  assert.equal(left.keep.food, was.keep.food - Math.floor(was.keep.food / 2));
  assert.equal(left.materials, was.materials - Math.floor(was.materials / 2));
  assert.deepEqual(lost.parts, hot.parts);
  assert.deepEqual([left.raid, left.heat, lost.heat], [null, heatAfterRaid, 70]);
  assert.equal(lost.flags.colonyRaidsLost, 1);
  assert.equal(raidDown(lost), false);
  assert.deepEqual(campaignProblems(lost), []);
  // Through the game: Defend, the fight and back to the colony screen.
  const state = reduce({ ...initialState(1), campaign: down, screen: 'colony' }, { type: 'campaign/raid/face', rules });
  assert.equal(state.screen, 'campaign-fight');
  const over = reduce({ ...state, campaign: { ...state.campaign, fight: { ...state.campaign.fight, battle: { ...state.campaign.fight.battle, winner: 'crew' } } } }, { type: 'campaign/fight/end', rules });
  assert.equal(over.screen, 'colony');
  assert.equal(over.campaign.flags.colonyRaidsWon, 1);
  assert.equal(first(over.campaign).raid, null);
  // With nobody there, the guns are all it has.
  const empty = landingAt({ ...two, colonies: [{ ...first(two), keep: { crew: [], food: 9 } }], crew: [...two.crew, ...first(two).keep.crew].sort((a, b) => a.id - b.id) }, 1);
  assert.deepEqual(landingPlan(empty, rules).defenders, []);
  const alone = faceRaid(empty, rules);
  assert.ok(alone.ok, alone.error);
  assert.deepEqual([alone.fight, alone.won], [false, false]);
  assert.deepEqual(alone.taken, { food: 4, materials: Math.floor(first(empty).materials / 2), part: null });
  assert.equal(first(alone.campaign).keep.food, 5);
  assert.deepEqual(alone.campaign.parts, empty.parts);
});

test('Fly to a colony from a voyage: a day and a jump\'s supplies a system between, one jump\'s heat; landed, the crews and the stores join, and the colony flown from keeps its own', () => {
  // Out two systems from the second colony (at 1): at 3, three from the
  // first.
  let out = voyageOut(two, rules, ids.slice(0, 2)).campaign;
  out = { ...out, run: { ...out.run, at: out.run.sector.exit } };
  out = reduce({ ...initialState(1), campaign: out, screen: 'sector' }, { type: 'campaign/sector/leave', rules }).campaign;
  assert.equal(out.colony.voyage.out, 2);
  assert.deepEqual([shipAt(out), first(out).at], [3, 0]);
  out = { ...out, run: { ...out.run, approach: null } };
  const plan = flightPlan(out, rules, 1);
  assert.ok(plan.ok, plan.error);
  assert.deepEqual([plan.to, plan.days, plan.heat, plan.stopped], [1, 3, jumpHeat, false]);
  assert.equal(plan.eats, 3 * 2 * rules.balance.jumpSupplies);
  assert.equal(plan.food.colony[0], first(out).keep.food);
  assert.match(flightPlan(out, rules, 9).error, /no colony there/);
  const flown = flyTo(out, rules, 1);
  assert.ok(flown.ok, flown.error);
  assert.deepEqual([flown.landed, flown.stopped, flown.days.length], [true, false, 3]);
  const there = flown.campaign;
  assert.equal(there.colony.id, 1);
  assert.equal(there.colony.voyage, null);
  assert.equal(there.colony.keep, undefined);
  assert.deepEqual(there.crew.map((member) => member.id), ids, 'everyone at the first, in order');
  // The second keeps whoever was at home there (nobody) and its food.
  const second = colonyById(there, 2);
  assert.deepEqual(second.keep, { crew: [], food: plan.food.colony[1] === undefined ? second.keep.food : second.keep.food });
  assert.equal(second.voyage, null);
  assert.equal(second.day, out.colony.day + 3);
  assert.equal(there.colony.day, first(out).day + 3);
  assert.equal(there.heat, Math.max(out.heat + jumpHeat, first(out).heat - 3 * colonyHeatFall));
  assert.equal(there.flags.flights, 1);
  assert.equal(there.flags.landings, 1);
  assert.deepEqual(campaignProblems(there), []);
  // Through the game: Fly to, and the colony screen.
  const state = reduce({ ...initialState(1), campaign: out, screen: 'sector' }, { type: 'campaign/voyage/to', id: 1, rules });
  assert.equal(state.screen, 'colony');
  assert.deepEqual(state.campaign, there);

  // A lander coming down on the way is fought out there at once (M38f): the
  // flight flies on and lands.
  const coming = landingAt(out, 1, first(out).day + 1);
  const through = flyTo(coming, rules, 1);
  assert.ok(through.ok, through.error);
  assert.deepEqual([through.stopped, through.landed], [false, true]);
  assert.equal(through.campaign.flags.raidsFoughtOut, 1);
  assert.equal(through.campaign.colony.raid, null);
  // A flight a lander stopped, in a save from before M38f: Fly on finishes
  // it, once the raid is faced.
  const { voyage: under } = out.colony;
  const stopped = { campaign: landingAt({ ...out, colony: { ...out.colony, voyage: { ...under, homing: 2, to: 1, at: 2 } } }, 1) };
  const { voyage } = stopped.campaign.colony;
  assert.deepEqual([voyage.homing, voyage.to, voyage.at], [2, 1, 2]);
  assert.equal(outOnRun(stopped.campaign, rules), false);
  assert.deepEqual(campaignProblems(stopped.campaign), []);
  assert.match(flightPlan(stopped.campaign, rules, 2).error, /lander is down/);
  // Faced, it flies on to where it was going, and nowhere else.
  const faced = faceRaid(stopped.campaign, rules);
  const won = endColonyRaid({ ...faced.campaign, fight: { ...faced.campaign.fight, battle: { ...faced.campaign.fight.battle, winner: 'crew' } } }, rules);
  assert.match(flightPlan(won, rules, 2).error, /on its way to/);
  const on = voyageHome(won, rules);
  assert.ok(on.ok, on.error);
  assert.deepEqual([on.plan.days, on.plan.heat, on.landed, on.campaign.colony.id], [2, 0, true, 1]);
});

test('Fly to from the colony screen, with the crew picked as for Fly out; a lander coming down on the way is fought out there, and the ship flies on (M38f)', () => {
  const plan = flightFromPlan(two, rules, 1, [ids[0]]);
  assert.ok(plan.ok, plan.error);
  assert.deepEqual([plan.to, plan.days, plan.heat], [1, 1, jumpHeat]);
  assert.deepEqual([plan.crew, plan.home], [[ids[0]], [ids[1]]]);
  assert.match(flightFromPlan(two, rules, 2, [ids[0]]).error, /another of the crew's colonies/);
  assert.match(flightFromPlan(two, rules, 1, []).error, /Pick who goes/);
  const flown = flyFrom(two, rules, 1, [ids[0]]);
  assert.ok(flown.ok, flown.error);
  assert.equal(flown.landed, true);
  const there = flown.campaign;
  assert.equal(there.colony.id, 1);
  assert.deepEqual(there.crew.map((member) => member.id), [ids[0], ids[2]]);
  assert.deepEqual(colonyById(there, 2).keep.crew.map((member) => member.id), [ids[1]], 'one left at the second');
  assert.equal(colonyById(there, 2).heat, two.heat - colonyHeatFall, 'the ship left its heat there');
  assert.equal(there.flags.flights, 1);
  assert.deepEqual(campaignProblems(there), []);
  // Through the game.
  const state = reduce({ ...initialState(1), campaign: two, screen: 'colony' }, { type: 'campaign/colony/fly', id: 1, crew: [ids[0]], rules });
  assert.equal(state.screen, 'colony');
  assert.deepEqual(state.campaign, there);

  // Far apart, and a lander coming down at the first on the way: fought out
  // there at once (M38f), the ship never stopped.
  const far = landingAt({ ...two, colony: { ...two.colony, at: 5 } }, 1, first(two).day + 2);
  const through = flyFrom(far, rules, 1, ids.slice(0, 2));
  assert.ok(through.ok, through.error);
  assert.deepEqual([through.stopped, through.landed, through.campaign.colony.id], [false, true, 1]);
  assert.equal(through.campaign.flags.raidsFoughtOut, 1);
  assert.deepEqual(campaignProblems(through.campaign), []);
  assert.equal(aboardOf(through.campaign), null, 'landed');
});

test('the whole crew, at every colony and aboard, is at most MAX_CREW: no recruit or companion signs on past it', () => {
  // A crowd at the first colony while the ship is out from the second.
  let out = voyageOut(two, rules, ids.slice(0, 2)).campaign;
  const crowd = Array.from({ length: MAX_CREW - wholeCrew(out).length }, (_, i) => ({ ...out.crew[0], id: 100 + i, name: `Hand ${i}` }));
  out = { ...out, credits: 900, colonies: [{ ...first(out), keep: { ...first(out).keep, crew: [...first(out).keep.crew, ...crowd] } }] };
  assert.equal(wholeCrew(out).length, MAX_CREW);
  assert.deepEqual(campaignProblems(out), []);
  const station = out.run.sector.nodes.find((node) => node.type === 'station');
  const docked = at(out, station.id);
  const [recruit] = recruitsAt(docked, rules, docked.run.at);
  assert.match(hireRecruit(docked, rules, recruit.slot).error, new RegExp(`${MAX_CREW} strong`));
  assert.equal(freeBerths(docked, rules), 0);
  // One more anywhere doesn't read.
  const over = { ...out, colonies: [{ ...first(out), keep: { ...first(out).keep, crew: [...first(out).keep.crew, { ...crowd[0], id: 999 }] } }] };
  assert.match(campaignProblems(over).join(), /colonies name crew twice/);
});

test('saves: v37 for more colonies; a v36 colony becomes the first, at 0, with the ship\'s heat, and a v36 voyage is as far along as it is out; broken colonies are caught', () => {
  assert.ok(SAVE_VERSION >= 37);
  assert.ok(MIGRATIONS.some((step) => step.from === 36));
  for (const campaign of [two, voyageOut(two, rules, [ids[0]]).campaign, faceRaid(landingAt(two, 1), rules).campaign]) {
    const loaded = parseSave(JSON.stringify(makeSave(saveData({ ...initialState(7), campaign }))));
    assert.ok(loaded.ok, loaded.error);
    assert.deepEqual(loaded.save.data.campaign, campaign);
  }
  // A v36 colony had no number, place or heat, and no others (nor M38f's
  // citizens, which the next step gives it).
  const strip = (campaign) => {
    const { colonies, ...rest } = campaign;
    const { id, at: place, heat, citizens, growth, news, ...colony } = campaign.colony;
    const voyage = colony.voyage && (({ at: where, to, ...was }) => was)(colony.voyage);
    return { ...rest, colony: { ...colony, voyage } };
  };
  const v36 = (campaign) => parseSave(JSON.stringify({ ...makeSave(saveData({ ...initialState(7), campaign: strip(campaign) })), version: 36 }));
  const hot = { ...home, heat: 33 };
  const opened = v36(hot);
  assert.ok(opened.ok, opened.error);
  assert.deepEqual(opened.save.data.campaign.colonies, []);
  assert.deepEqual(opened.save.data.campaign.colony, { ...hot.colony, id: 1, at: 0, heat: 33 });
  // A voyage out, and a flight home a lander stopped: as many systems along
  // as the flight home has left.
  const ahead = { ...away, colony: { ...away.colony, voyage: { ...away.colony.voyage, out: 4, at: 4 } } };
  const voyage = v36(ahead).save.data.campaign.colony.voyage;
  assert.deepEqual([voyage.at, voyage.to], [4, null]);
  const homing = { ...ahead, colony: { ...ahead.colony, voyage: { ...ahead.colony.voyage, homing: 2, at: 2 } } };
  const stopped = v36(homing);
  assert.ok(stopped.ok, stopped.error);
  assert.deepEqual([stopped.save.data.campaign.colony.voyage.at, stopped.save.data.campaign.colony.voyage.homing], [2, 2]);
  // Before act 3, no others.
  const { colony, colonies, ...early } = { ...home, act: 2 };
  const before = parseSave(JSON.stringify({ ...makeSave(saveData({ ...initialState(7), campaign: { ...early, colony: null } })), version: 36 }));
  assert.ok(before.ok, before.error);
  assert.deepEqual(before.save.data.campaign.colonies, []);
  // Colonies that don't read.
  const other = first(two);
  const broken = (change) => campaignProblems({ ...two, ...change }).join();
  assert.match(broken({ colonies: [{ ...other, id: 2 }] }), /numbered twice/);
  assert.match(broken({ colonies: [{ ...other, parked: { crew: [], supplies: 0 } }] }), /colonies are unreadable/);
  const { keep, ...bare } = other;
  assert.match(broken({ colonies: [{ ...bare, parked: { crew: keep.crew, supplies: 0 } }] }), /no raid to fight/);
  assert.match(broken({ colonies: [{ ...other, voyage: { out: 1 } }] }), /colonies are unreadable/);
  assert.match(broken({ colonies: [{ ...other, keep: { ...keep, crew: [...keep.crew, two.crew[0]] } }] }), /name crew twice/);
  assert.match(broken({ colonies: [{ ...other, at: -1 }] }), /colonies are unreadable/);
  assert.match(broken({ colony: { ...two.colony, heat: HEAT_MAX + 1 } }), /colony is unreadable/);
  assert.match(campaignProblems({ ...home, colonies: 'none' }).join(), /colonies are unreadable/);
  const out = voyageOut(two, rules, [ids[0]]).campaign;
  assert.match(campaignProblems({ ...out, colony: { ...out.colony, voyage: { ...out.colony.voyage, to: 7 } } }).join(), /flies to no colony/);
  assert.match(campaignProblems({ ...out, colony: { ...out.colony, voyage: { ...out.colony.voyage, homing: 5 } } }).join(), /voyage is unreadable/);
});
