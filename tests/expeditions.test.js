// M28: expeditions from the colony. The places within reach are rolled from
// the seed; a trip takes a squad the ship has berths and air for, and its
// days pass at home with the ship away, the colony on its own power; at the
// place, an event whose wounds fall on the squad, or a derelict the
// scavengers hold, boarded in a fight; then the days back, and a new list.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seedFrom } from '../src/core/rng.js';
import { makeSave, MIGRATIONS, parseSave, SAVE_VERSION } from '../src/core/save.js';
import { applyCommand } from '../src/sim/builder.js';
import { campaignProblems, canRefit, crewAboard, fullSquad, maxHp } from '../src/sim/campaign.js';
import { colonyStats, donate } from '../src/sim/colony.js';
import { build, buildPlan, takeDownPlan } from '../src/sim/colonyBuild.js';
import { dayPlan, nextDay } from '../src/sim/days.js';
import { applyEffects } from '../src/sim/events.js';
import { boardPlace, chooseAtPlace, endPlaceFight, flyHome, flyOut, homePlan, otherWorlds, placeFightDue, rollPlaces, tripHere, tripPlan, withPlaces } from '../src/sim/expeditions.js';
import { questPlaces } from '../src/sim/quests.js';
import { campaignScreen, initialState, reduce, saveData } from '../src/sim/root.js';
import { fightPlace } from '../tools/boarding.js';
import { rules } from './battleKit.js';
import { settled, uidOf } from './colonyKit.js';

const { regroupHp } = rules.balance;
const AWAY = 'The ship is away: building waits until it is home.';

// The settled colony with these places listed.
function listing(campaign, places) {
  return { ...campaign, colony: { ...campaign.colony, places } };
}

const rock = { kind: 'rock', name: 'The Anvil', days: 2, event: 'rich-seam', held: false, seed: 11 };
const hulk = { kind: 'hulk', name: 'Long Haul', days: 1, event: null, held: true, seed: 7 };

test('the places within reach: rolled from the seed when the colony has none, three of their kinds, none named twice', () => {
  const landed = settled();
  assert.deepEqual([landed.colony.places, landed.colony.trip], [[], null]);
  const listed = withPlaces(landed, rules);
  assert.notEqual(listed.rng, landed.rng);
  const { places } = listed.colony;
  assert.equal(places.length, rules.expeditions.places);
  assert.equal(places.length, 3);
  const others = otherWorlds(landed).map((world) => world.name);
  assert.equal(others.length, rules.worlds.system.worlds - 1);
  assert.ok(!others.includes(landed.colony.world.name));
  const check = (place) => {
    const kind = rules.expeditions.kinds.get(place.kind);
    assert.ok(kind, place.kind);
    assert.ok(place.days >= kind.days[0] && place.days <= kind.days[1], `${place.name}: ${place.days} days`);
    if (place.held) assert.equal(place.event, null);
    else assert.equal(rules.events.get(place.event).kind, place.kind);
    assert.ok(kind.worlds ? others.includes(place.name) : rules.expeditions.names[kind.id].includes(place.name), place.name);
  };
  places.forEach(check);
  assert.equal(new Set(places.map((place) => place.name)).size, places.length);
  // The same seed, the same places; a colony with places keeps them.
  assert.deepEqual(withPlaces(landed, rules).colony.places, places);
  assert.equal(withPlaces(listed, rules), listed);
  assert.deepEqual(campaignProblems(listed), []);
  // Over many seeds every kind comes up, scavengers hold some derelicts,
  // and every place's event is met.
  const kinds = new Map();
  const events = new Set();
  let held = 0;
  for (let n = 1; n <= 300; n++) {
    const rolled = rollPlaces({ ...landed, rng: seedFrom(n) }, rules).places;
    assert.equal(rolled.length, 3);
    assert.equal(new Set(rolled.map((place) => place.name)).size, 3);
    for (const place of rolled) {
      check(place);
      kinds.set(place.kind, (kinds.get(place.kind) ?? 0) + 1);
      if (place.held) held += 1;
      else events.add(place.event);
    }
  }
  assert.deepEqual([...kinds.keys()].sort(), [...rules.expeditions.kinds.keys()].sort());
  assert.ok(held > 0 && held < kinds.get('hulk'), `held ${held} of ${kinds.get('hulk')} derelicts`);
  const placeEvents = [...rules.events.values()].filter((event) => rules.expeditions.kinds.has(event.kind)).map((event) => event.id);
  assert.deepEqual([...events].sort(), placeEvents.sort());
});

test("a trip's plan: the days there and back, what they eat, the flight checks with the squad aboard; refusals say why", () => {
  const listed = listing(settled(), [rock]);
  const ids = listed.crew.map((member) => member.id);
  const plan = tripPlan(listed, rules, 0, ids);
  assert.equal(plan.ok, true, plan.error);
  assert.deepEqual([plan.place, plan.squad, plan.days], [rock, ids, { out: 2, back: 2 }]);
  // Four days, three crew, nothing growing yet: 12 food of 27.
  assert.deepEqual([plan.eats, plan.food, plan.hungry], [12, [27, 15], 0]);
  assert.ok(plan.checks.every((line) => line.ok === true));
  assert.equal(tripPlan(listed, rules, 1, ids).error, "There's no such place within reach.");
  assert.equal(tripPlan(listed, rules, 0, []).error, 'Pick someone to go.');
  assert.equal(tripPlan(listed, rules, 0, [1, 99]).error, 'Pick the squad from the crew aboard.');
  // The life support given to the colony: no air aboard for the squad.
  const given = donate(listed, rules, uidOf(listed, 'lifesupport')).campaign;
  const refused = tripPlan(given, rules, 0, ids);
  assert.deepEqual([refused.ok, refused.error], [false, "The ship can't fly with 3 aboard: life support 0 of 3 crew."]);
  assert.deepEqual(refused.checks.filter((line) => line.ok !== true).map((line) => line.id), ['lifeSupport']);
  assert.deepEqual(flyOut(given, rules, 0, ids), { ok: false, error: refused.error });
  // A full squad is the most a trip takes: what the refit's checks count.
  assert.equal(fullSquad(listed, rules), 3);
  assert.equal(fullSquad({ ...listed, crew: listed.crew.slice(0, 2) }, rules), 2);
});

test("flying out: the list used up, and the days out pass at home with the ship away, on the colony's own power", () => {
  // A gun given to the colony runs on the landed ship's spare power.
  const landed = listing(settled(), [rock]);
  const armed = donate(landed, rules, uidOf(landed, 'weapon')).campaign;
  assert.deepEqual(colonyStats(armed, rules).buildings.map((b) => [b.name, b.powered]), [['Gun emplacement', true]]);
  const hurt = { ...armed, crew: armed.crew.map((member) => ({ ...member, hp: 3 })) };
  const out = flyOut(hurt, rules, 0, [1]);
  assert.equal(out.ok, true, out.error);
  const away = out.campaign;
  // leg: none stopped by a raid (M29).
  assert.deepEqual(away.colony.trip, { place: rock, squad: [1], done: false, result: null, leg: null });
  assert.deepEqual([away.colony.places, away.colony.day, away.supplies], [[], 3, 27 - 2 * 3]);
  assert.deepEqual([away.flags.trips, away.flags.daysAway, away.flags.colonyDays], [1, 2, 2]);
  assert.equal(out.days.length, 2);
  assert.deepEqual(campaignProblems(away), []);
  assert.equal(campaignScreen(away), 'colony');
  // The colony on its own power: the gun is dark; whoever is home has no
  // bed and air, with no ship to sleep aboard, and doesn't rest.
  const stats = colonyStats(away, rules);
  assert.deepEqual([stats.power.ship, stats.buildings[0].powered, stats.away, stats.rough, stats.aboard], [0, false, [1], [2, 3], []]);
  assert.deepEqual(away.crew.map((member) => member.hp), [3, 3, 3]);
  // At home the same day, everyone would have rested.
  assert.deepEqual(nextDay(hurt, rules).campaign.crew.map((member) => member.hp), [3 + regroupHp, 3 + regroupHp, 3 + regroupHp]);
  // Who is aboard: the squad. Nothing changes at the colony while it's
  // away: no Next day, no building, no refit.
  assert.equal(crewAboard(away), 1);
  assert.equal(dayPlan(away, rules).error, 'The ship is away: the days pass as it flies.');
  assert.equal(buildPlan(away, rules, { build: 'farm' }).error, AWAY);
  assert.equal(takeDownPlan(away, rules, away.colony.buildings[0].uid).error, AWAY);
  assert.equal(canRefit(away, rules), false);
  assert.equal(tripPlan(away, rules, 0, [2]).error, 'The ship is away already.');
  assert.equal(withPlaces(away, rules), away);
});

test("at the place: the event decided, a wound only ever on the squad; then home, the days back and a new list", () => {
  const out = flyOut(listing(settled(), [rock]), rules, 0, [1]).campaign;
  const here = tripHere(out, rules);
  assert.deepEqual([here.place, here.event.id, here.held, here.done], [rock, 'rich-seam', false, false]);
  assert.deepEqual(homePlan(out, rules), { ok: false, error: 'Decide first: Rich seam.' });
  assert.equal(chooseAtPlace(out, rules, 'nope').error, 'There is no such choice.');
  // Skim the face: a sure 5 materials.
  const chose = chooseAtPlace(out, rules, 'skim');
  assert.equal(chose.ok, true, chose.error);
  assert.deepEqual(chose.result, { event: 'rich-seam', choice: 'skim', outcome: 0, roll: null, changes: { credits: 0, supplies: 0, heat: 0, materials: 5, wounds: [], parts: [], sold: [], standing: [] } });
  const done = chose.campaign;
  assert.deepEqual([done.colony.materials, done.colony.trip.done, done.colony.trip.result, done.flags.placeEvents, done.flags.tripMaterials], [25, true, chose.result, 1, 5]);
  assert.equal(done.rng, out.rng, 'a sure thing rolls nothing');
  assert.equal(chooseAtPlace(done, rules, 'deep').error, 'There is nothing to decide here.');
  assert.deepEqual(campaignProblems(done), []);
  // A wound falls on the squad, never on whoever is home.
  for (let n = 1; n <= 20; n++) {
    const one = applyEffects({ ...done, rng: seedFrom(n) }, rules, { wound: { hp: 3 } }, { among: [1] });
    assert.deepEqual(one.changes.wounds.map((wound) => wound.id), [1]);
  }
  assert.deepEqual(applyEffects(done, rules, { wound: { hp: 3, all: true } }, { among: [1, 3] }).changes.wounds.map((wound) => wound.id), [1, 3]);
  // Home: two days back, the ship lands, a new list is rolled.
  const plan = homePlan(done, rules);
  assert.deepEqual(plan, { ok: true, days: 2, eats: 6, food: [21, 15], hungry: 0 });
  const home = flyHome(done, rules);
  assert.equal(home.ok, true, home.error);
  const landed = home.campaign;
  assert.deepEqual([landed.colony.trip, landed.colony.day, landed.supplies, landed.colony.places.length], [null, 5, 15, 3]);
  assert.deepEqual([landed.flags.trips, landed.flags.tripsHome, landed.flags.daysAway], [1, 1, 4]);
  assert.equal(home.days.length, 2);
  assert.equal(crewAboard(landed), 0);
  assert.deepEqual(campaignProblems(landed), []);
  assert.equal(flyHome(landed, rules).error, 'The ship is home.');
  // The materials keep to the stores: past them, an event's find is lost.
  const full = { ...out, colony: { ...out.colony, materials: 28 } };
  assert.equal(chooseAtPlace(full, rules, 'skim').campaign.colony.materials, 30);
});

test('a derelict the scavengers hold: boarded in a fight on her map, her salvage home on a win; or left alone', () => {
  const out = flyOut(listing(settled(), [hulk]), rules, 0, [1, 2, 3]).campaign;
  const here = tripHere(out, rules);
  assert.deepEqual([here.event, here.held], [null, true]);
  const due = placeFightDue(out, rules);
  assert.deepEqual([due.preset.id, due.party, due.salvage, due.materials], ['hauler', rules.encounters.get('squatters').enemies, 2, [4, 8]]);
  // She can be left: home with nothing.
  const left = flyHome(out, rules);
  assert.equal(left.ok, true, left.error);
  assert.deepEqual([left.campaign.colony.trip, left.campaign.parts, left.campaign.flags.placeFightsWon ?? 0], [null, out.parts, 0]);
  // Boarded: the squad at her hatches, the scavengers on her bridge.
  const begun = boardPlace(out, rules);
  assert.equal(begun.ok, true, begun.error);
  const { fight } = begun.campaign;
  assert.equal(begun.campaign.place, 'fight');
  assert.deepEqual([fight.encounter, fight.crew, fight.job, fight.raid, fight.boarding.dir], ['squatters', [1, 2, 3], null, false, 'them']);
  assert.equal(fight.battle.units.filter((unit) => unit.side === 'crew').length, 3);
  assert.equal(fight.battle.units.filter((unit) => unit.side === 'enemy').length, due.party.length);
  const { salvage } = fight.boarding;
  assert.equal(salvage.parts.length, 2);
  assert.ok(salvage.parts.every((type) => !rules.modules.get(type).tags.includes('corridor')));
  assert.ok(salvage.materials >= 4 && salvage.materials <= 8);
  assert.equal(salvage.credits, 0);
  assert.deepEqual(campaignProblems(begun.campaign), []);
  assert.equal(campaignScreen(begun.campaign), 'campaign-fight');
  // The same place and roll, the same fight.
  assert.deepEqual(boardPlace(out, rules).campaign.fight, fight);
  assert.equal(boardPlace(begun.campaign, rules).error, 'There is no one here to fight.');
  // Won: her parts into the hold, her materials into the stores.
  const ended = (winner) => endPlaceFight({ ...begun.campaign, fight: { ...fight, battle: { ...fight.battle, winner } } }, rules);
  const won = ended('crew');
  const parts = { ...out.parts };
  for (const type of salvage.parts) parts[type] = (parts[type] ?? 0) + 1;
  assert.deepEqual([won.place, won.fight, won.parts, won.colony.materials], ['hub', null, parts, 20 + salvage.materials]);
  assert.deepEqual(won.colony.trip, { place: hulk, squad: [1, 2, 3], done: true, result: { won: true, parts: salvage.parts, materials: salvage.materials }, leg: null });
  assert.deepEqual([won.flags.placeFightsWon, won.flags.fightsWon, won.flags.tripParts, won.flags.tripMaterials], [1, 1, 2, salvage.materials]);
  assert.deepEqual(campaignProblems(won), []);
  assert.equal(placeFightDue(won, rules), null);
  assert.equal(flyHome(won, rules).ok, true);
  // Lost: home hurt, with nothing.
  const lost = ended('enemy');
  assert.deepEqual([lost.parts, lost.colony.materials, lost.colony.trip.result, lost.flags.placeFightsLost], [out.parts, 20, { won: false, parts: [], materials: 0 }, 1]);
  // Played out by the AI, it ends one way or the other.
  const played = fightPlace(out, rules);
  assert.equal(played.campaign.place, 'hub');
  assert.equal(played.campaign.colony.trip.done, true);
  assert.equal(played.campaign.colony.trip.result.won, played.won);
  assert.ok(played.campaign.crew.every((member) => member.hp >= 1 && member.hp <= maxHp(member, rules)));
});

test('a solar array keeps the lights on and a shelter houses whoever stays home while the ship is away', () => {
  const landed = listing(settled(), [rock]);
  const armed = donate(landed, rules, uidOf(landed, 'weapon')).campaign;
  const rich = { ...armed, colony: { ...armed.colony, materials: 30 } };
  const solar = build(rich, rules, { build: 'solar' });
  assert.equal(solar.ok, true, solar.error);
  const shelter = build(solar.campaign, rules, { build: 'shelter' });
  assert.equal(shelter.ok, true, shelter.error);
  const colony = shelter.campaign;
  assert.equal(colony.colony.materials, 5);
  const home = colonyStats(colony, rules);
  assert.deepEqual(home.buildings.map((b) => [b.name, b.need, b.powered, b.makes]), [['Gun emplacement', 1, true, null], ['Solar array', 0, true, null], ['Shelter', 1, true, null]]);
  assert.deepEqual([home.power.plants, home.beds, home.air], [3, 2, 2]);
  // Away: the array runs the gun and the shelter alone, and the two at home
  // sleep in the shelter and rest.
  const hurt = { ...colony, crew: colony.crew.map((member) => ({ ...member, hp: 3 })) };
  const away = flyOut(hurt, rules, 0, [1]).campaign;
  const stats = colonyStats(away, rules);
  assert.deepEqual([stats.power.ship, stats.power.plants, stats.buildings.every((b) => b.powered), stats.housed, stats.rough], [0, 3, true, 2, []]);
  assert.deepEqual(away.crew.map((member) => member.hp), away.crew.map((member, i) => (i === 0 ? 3 : Math.min(maxHp(member, rules), 3 + 2 * regroupHp))));
  assert.ok(away.crew[1].hp > 3 && away.crew[2].hp > 3);
});

test("the squad aboard heals what the ship's med bay heals, as on a jump; the infirmary heals whoever is home", () => {
  const landed = listing(settled(), [rock]);
  const ship = applyCommand(landed.ship, rules, { op: 'place', type: 'medbay', x: 12, y: 3, rot: 0 }).ship;
  const hurt = { ...landed, ship, crew: landed.crew.map((member) => ({ ...member, hp: 2 })) };
  // The medic aboard adds theirs to the med bay's: 1 + 1 a day.
  const away = flyOut(hurt, rules, 0, [2, 3]).campaign;
  assert.deepEqual(away.crew.map((member) => member.hp), [2, 2 + 2 * 2, 2 + 2 * 2]);
  // The med bay given to the colony: the infirmary heals the one at home,
  // without the medic, who is away.
  const given = donate(hurt, rules, uidOf(hurt, 'medbay')).campaign;
  const ward = flyOut(given, rules, 0, [2, 3]).campaign;
  const lit = colonyStats(ward, rules).buildings.find((b) => b.type === 'medbay').powered;
  assert.deepEqual([lit, ward.crew.map((member) => member.hp)], [false, [2, 2, 2]]);
});

test('saves: v22 for the places and the trip; a v21 colony opens with no trip, its places rolled when shown; a trip reloads as it was', () => {
  const listed = withPlaces(settled(), rules);
  const { places, trip, ...v21colony } = listed.colony;
  const old = (campaign) => ({ ...saveData(initialState(3)), campaign });
  const step = MIGRATIONS.find((s) => s.from === 21);
  assert.deepEqual(step.up(old({ ...listed, colony: v21colony })).campaign, { ...listed, colony: { ...v21colony, places: [], trip: null } });
  assert.equal(step.up(old(null)).campaign, null);
  const opened = parseSave(JSON.stringify({ version: 21, data: old({ ...listed, colony: v21colony }) }));
  assert.equal(opened.ok, true, opened.error);
  // 24 since M32's orders in a fight, 27 since M33's fix, 28 since M33b's
  // quests, 29 since M33c's companions.
  assert.equal(SAVE_VERSION, 48);
  const reopened = opened.save.data.campaign;
  assert.deepEqual([reopened.colony.places, reopened.colony.trip], [[], null]);
  // The colony screen asks for its places, and they are the seed's, with
  // the thread's place after them: from v28 (M33b) a save from before
  // quests gets its background's thread at its act's step, the colony's.
  const state = reduce({ ...initialState(3), campaign: reopened, screen: 'colony' }, { type: 'campaign/places', rules });
  assert.deepEqual(reopened.quests, { debt: { step: 2, state: 'open' } });
  assert.deepEqual(state.campaign.colony.places, [...rollPlaces(reopened, rules).places, ...questPlaces(reopened, rules)]);
  // Out on a trip, at the place, and in the fight there: each reloads as it was.
  const out = reduce({ ...state }, { type: 'campaign/trip/out', index: 0, squad: [1, 2], rules });
  assert.ok(out.campaign.colony.trip);
  for (const campaign of [out.campaign, flyOut(listing(settled(), [hulk]), rules, 0, [1]).campaign, boardPlace(flyOut(listing(settled(), [hulk]), rules, 0, [1]).campaign, rules).campaign]) {
    const saved = parseSave(JSON.stringify(makeSave(old(campaign))));
    assert.equal(saved.ok, true, saved.error);
    assert.deepEqual(saved.save.data.campaign, campaign);
  }
  // Broken ones are caught.
  const away = out.campaign;
  const broken = (colony) => campaignProblems({ ...away, colony: { ...away.colony, ...colony } });
  assert.deepEqual(broken({ trip: { ...away.colony.trip, squad: [9] } }), ["The campaign's trip names a squad that isn't the crew's."]);
  assert.deepEqual(broken({ trip: { ...away.colony.trip, squad: [] } }), ["The campaign's trip names a squad that isn't the crew's."]);
  assert.deepEqual(broken({ trip: { ...away.colony.trip, done: true } }), ["The campaign's trip doesn't match what was done."]);
  assert.deepEqual(broken({ trip: { ...away.colony.trip, place: { ...rock, days: 0 } } }), ["The campaign's trip is unreadable."]);
  assert.deepEqual(broken({ places: [{ ...rock, held: 'yes' }] }), ["The campaign's colony is unreadable."]);
  assert.deepEqual(broken({ places: undefined }), ["The campaign's colony is unreadable."]);
  // A boarding fight with no held place to have begun it.
  const fightAt = boardPlace(flyOut(listing(settled(), [hulk]), rules, 0, [1]).campaign, rules).campaign;
  const stray = { ...fightAt, colony: { ...fightAt.colony, trip: { ...fightAt.colony.trip, place: rock } } };
  assert.deepEqual(campaignProblems(stray), ["The campaign's boarding fight has no held derelict where the squad is."]);
});

test('the reducer: out, a choice, the fight and home, each a screen of its own', () => {
  let state = { ...initialState(3), campaign: listing(settled(), [hulk, rock]), screen: 'colony' };
  state = reduce(state, { type: 'campaign/trip/out', index: 1, squad: [1], rules });
  assert.equal(state.screen, 'colony');
  assert.equal(state.campaign.colony.trip.place.name, 'The Anvil');
  state = reduce(state, { type: 'campaign/trip/choose', choice: 'skim', rules });
  assert.equal(state.campaign.colony.trip.done, true);
  state = reduce(state, { type: 'campaign/trip/home', rules });
  assert.equal(state.campaign.colony.trip, null);
  assert.equal(state.campaign.colony.places.length, 3);
  // A held derelict's fight has the fight's screen, and back.
  let fight = { ...initialState(3), campaign: listing(settled(), [hulk]), screen: 'colony' };
  fight = reduce(fight, { type: 'campaign/trip/out', index: 0, squad: [1, 2, 3], rules });
  fight = reduce(fight, { type: 'campaign/trip/board', rules });
  assert.equal(fight.screen, 'campaign-fight');
  const battle = { ...fight.campaign.fight.battle, winner: 'crew' };
  fight = reduce(fight, { type: 'campaign/fight/save', battle, log: fight.campaign.fight.log });
  fight = reduce(fight, { type: 'campaign/fight/end', rules });
  assert.equal(fight.screen, 'colony');
  assert.deepEqual([fight.campaign.colony.trip.done, fight.campaign.colony.trip.result.won], [true, true]);
});
