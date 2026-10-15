// Expeditions from the colony (ROADMAP §2, M28): the ship flies out with a
// squad to a place within reach, and comes home. The colony lists a few
// places at a time (data/expeditions.json), rolled from the campaign's RNG
// whenever it has none: derelicts, wreck fields, ore-rich rocks and the
// system's other worlds, each some days away. A trip takes a squad of 1 to
// squadSize, and the ship flies only when its flight checks pass with them
// aboard: berths and air for each (campaign.js shipChecklist). The days
// out pass at the colony one by one with the ship away (days.js), the
// colony on its own power; then the squad is at the place. There, an event
// like the run's (events.js), whose wounds fall only on the squad; or a
// derelict the scavengers hold, boarded in a fight on her map, her parts
// and materials the prize, or left alone. Fly home passes the days back,
// the ship lands, and a new list is rolled. Pure: every roll is the
// campaign's.
//
// A place (colony.places, and the trip's; tripShape.js):
//   kind    its kind's id (data/expeditions.json kinds)
//   name    one of its kind's names, or a world of the system's
//   days    how far away it is, in days each way
//   event   the event there (data/events.json, of the kind's id), or null
//   held    true for a derelict the scavengers hold: a fight, no event
//   seed    what her ship is generated from (gen/ship.js)
// The trip (colony.trip, null while the ship is home):
//   place   the place, as it was listed
//   squad   the crew ids aboard, in the crew's order
//   done    true once the event is decided or the fight is over
//   result  what came of it, once done: the event's ({ event, choice,
//           outcome, roll, changes }) or the fight's ({ won, parts,
//           materials })
// The flags count the trips, the days away and the trips home, the events
// decided and the fights won and lost at places, and what trips brought:
// parts, materials and food.
import { int, pick } from '../core/rng.js';
import { atColony } from './acts.js';
import { createBattle } from './battle.js';
import { crewUnit, endFight, shipChecklist } from './campaign.js';
import { storesOf } from './colony.js';
import { squadMembers, squadProblem } from './crew.js';
import { passDay } from './days.js';
import { deploy } from './deploy.js';
import { pickWeighted } from './drops.js';
import { applyEffects, choiceProblem, outcomeFor } from './events.js';
import { tally } from './flags.js';
import { generateShip } from './gen/ship.js';
import { mapFromShip } from './mapFromShip.js';
import { hasTag } from './modules.js';
import { enemyBonus } from './settings.js';

const MAX_SEED = 0xffffffff;
// What an event at a place can do and need (data/events.json): food (the
// run's supplies), materials, wounds and parts. Credits buy nothing at the
// colony, and heat waits for M29.
export const PLACE_EFFECTS = ['supplies', 'materials', 'wound', 'part', 'drop'];
export const PLACE_NEEDS = ['supplies', 'parts'];

// A place's kind (data/expeditions.json), or null.
export function kindOf(place, rules) {
  return rules.expeditions?.kinds.get(place.kind) ?? null;
}

// The system's other worlds, which a kind of place with worlds names its
// places for: [{ name, world }], each world of the system the run ended in
// but the one settled, top down.
export function otherWorlds(campaign) {
  const sector = campaign.run?.sector;
  if (!sector?.system || !campaign.colony) return [];
  return sector.nodes.filter((node) => node.world && node.name !== campaign.colony.world.name).map((node) => ({ name: node.name, world: node.world }));
}

// The places within reach, rolled from the campaign's RNG: { places, rng }.
// Each in turn: a kind by weight, among those with a name left (a kind of
// worlds names its places for the system's other worlds); a name of its
// kind, none twice in the list; its days within the kind's; whether the
// scavengers hold it, at the kind's chance; its event, one of the kind's,
// unless held; and its ship's seed.
export function rollPlaces(campaign, rules) {
  const spec = rules.expeditions;
  let rng = campaign.rng;
  const roll = (min, max) => {
    const r = int(rng, min, max);
    rng = r.state;
    return r.value;
  };
  const worlds = otherWorlds(campaign).map((world) => world.name);
  const taken = new Set();
  const left = (kind) => (kind.worlds ? worlds : spec.names[kind.id] ?? []).filter((name) => !taken.has(name));
  const places = [];
  for (let n = 0; n < (spec?.places ?? 0); n++) {
    const table = Object.fromEntries([...spec.kinds.values()].filter((kind) => left(kind).length).map((kind) => [kind.id, kind.weight]));
    if (!Object.keys(table).length) break;
    const picked = pickWeighted(rng, table);
    rng = picked.state;
    const kind = spec.kinds.get(picked.value);
    const names = left(kind);
    const name = names[roll(0, names.length - 1)];
    taken.add(name);
    const days = roll(kind.days[0], kind.days[1]);
    const held = kind.held ? roll(0, 99) < kind.held.chance : false;
    const events = held ? [] : [...rules.events.values()].filter((event) => event.kind === kind.id);
    const event = events.length ? events[roll(0, events.length - 1)].id : null;
    places.push({ kind: kind.id, name, days, event, held, seed: roll(0, MAX_SEED) });
  }
  return { places, rng };
}

// The campaign with its places rolled, at the colony with the ship home
// and none listed; else the campaign as it is.
export function withPlaces(campaign, rules) {
  if (!atColony(campaign, rules) || campaign.colony.trip || campaign.colony.places.length || !rules.expeditions) return campaign;
  const { places, rng } = rollPlaces(campaign, rules);
  return places.length ? { ...campaign, rng, colony: { ...campaign.colony, places } } : campaign;
}

// What a trip to the place listed at index would come to with squad (crew
// ids): { ok, error (why the ship can't fly, or null), place, kind, squad
// (their ids, in the crew's order), days ({ out, back }), checks (the
// flight checklist with the squad aboard), eats (what the trip's days eat
// in all, at home and away), food ([now, home again]: as the days would
// leave it, nothing found), hungry (the days that would go hungry) }. With
// nothing to plan (away from the colony, the ship away, no such place, no
// squad): { ok: false, error } alone.
export function tripPlan(campaign, rules, index, squad) {
  if (!atColony(campaign, rules)) return { ok: false, error: 'Trips leave from the colony.' };
  if (campaign.colony.trip) return { ok: false, error: 'The ship is away already.' };
  const place = campaign.colony.places[index];
  const kind = place ? kindOf(place, rules) : null;
  if (!kind) return { ok: false, error: "There's no such place within reach." };
  const why = squadProblem(campaign.crew, squad, rules);
  if (why) return { ok: false, error: why };
  const ids = squadMembers(campaign.crew, squad).map((member) => member.id);
  const checks = shipChecklist(campaign, rules, ids.length);
  const away = passDays({ ...campaign, colony: { ...campaign.colony, trip: newTrip(place, ids) } }, rules, place.days * 2);
  const failing = checks.find((line) => line.ok !== true);
  return {
    ok: !failing,
    error: failing ? `The ship can't fly with ${ids.length} aboard: ${lowerFirst(failing.text)}.` : null,
    place,
    kind,
    squad: ids,
    days: { out: place.days, back: place.days },
    checks,
    eats: away.days.reduce((sum, day) => sum + day.plan.eats, 0),
    food: [campaign.supplies, away.campaign.supplies],
    hungry: away.days.filter((day) => !day.plan.fed).length,
  };
}

// Flies out to the place listed at index with the squad (see tripPlan):
// the ship leaves, the list is used up (a new one comes once it is home),
// and the days out pass at the colony one by one with it away. Then the
// squad is at the place. Returns { ok: true, plan, campaign, days (each
// day's, days.js passDay) } or { ok: false, error }.
export function flyOut(campaign, rules, index, squad) {
  const plan = tripPlan(campaign, rules, index, squad);
  if (!plan.ok) return { ok: false, error: plan.error };
  const leaving = { ...campaign, colony: { ...campaign.colony, places: [], trip: newTrip(plan.place, plan.squad) }, flags: tally(campaign.flags, { trips: 1 }) };
  const out = passDays(leaving, rules, plan.place.days);
  return { ok: true, plan, campaign: out.campaign, days: out.days };
}

// Where the squad is on a trip, for the screens: { place, kind, event (the
// event to decide there, until it is), held (true while the scavengers'
// derelict is still to fight for), done, result }, or null with the ship
// home.
export function tripHere(campaign, rules) {
  const trip = campaign.colony?.trip;
  if (!trip) return null;
  const { place } = trip;
  const event = !trip.done && !place.held && place.event ? rules.events.get(place.event) ?? null : null;
  return { place, kind: kindOf(place, rules), event, held: place.held && !trip.done, done: trip.done, result: trip.result };
}

// Makes choice id at the event where the squad is: rolls its outcome, if
// it has more than one (0 to 99, as on the run), and has its effects, a
// wound only ever on the squad. Returns { ok: true, campaign, result } or
// { ok: false, error }.
export function chooseAtPlace(campaign, rules, id) {
  const here = atColony(campaign, rules) ? tripHere(campaign, rules) : null;
  if (!here?.event) return { ok: false, error: 'There is nothing to decide here.' };
  const choice = here.event.choices.find((entry) => entry.id === id);
  if (!choice) return { ok: false, error: 'There is no such choice.' };
  const why = choiceProblem(campaign, choice);
  if (why) return { ok: false, error: why };
  let rng = campaign.rng;
  let roll = null;
  if (choice.outcomes.length > 1) {
    const rolled = int(rng, 0, 99);
    roll = rolled.value;
    rng = rolled.state;
  }
  const outcome = roll === null ? 0 : outcomeFor(choice.outcomes, roll);
  const done = applyEffects({ ...campaign, rng }, rules, choice.outcomes[outcome].effects, { among: campaign.colony.trip.squad });
  const result = { event: here.event.id, choice: choice.id, outcome, roll, changes: done.changes };
  const after = done.campaign;
  const flags = tally(after.flags, { placeEvents: 1, tripParts: done.changes.parts.length, tripMaterials: done.changes.materials, tripFood: Math.max(0, done.changes.supplies) });
  return { ok: true, result, campaign: { ...after, flags, colony: { ...after.colony, trip: { ...after.colony.trip, done: true, result } } } };
}

// The fight due where the squad is, as it would begin, for the screens and
// boardPlace: { place, preset (her ship's), party (the scavengers' enemy
// ids), salvage (how many of her parts a win strips), materials ([least,
// most] a win brings) }, or null with none due.
export function placeFightDue(campaign, rules) {
  const trip = campaign.colony?.trip;
  if (!trip?.place.held || trip.done || campaign.fight) return null;
  const held = kindOf(trip.place, rules)?.held;
  const preset = held ? rules.ships.get(held.ship) : null;
  const party = held ? rules.encounters.get(held.party)?.enemies : null;
  if (!preset || !party) return null;
  return { place: trip.place, preset, party, salvage: held.salvage, materials: held.materials };
}

// Boards the derelict the scavengers hold where the squad is: the whole
// squad, at her hatches, against the scavengers on her bridge, on her map
// (gen/ship.js, from the place's seed, her wrecked rooms and all). The
// fight's seed is the campaign's next roll, and so is what a win pays:
// that many of her working parts (never corridors, none twice) and
// materials in the kind's range. setup is what the settings make of the
// fight (settings.js fightSettings). Returns { ok: true, campaign } with
// the fight on, or { ok: false, error }.
export function boardPlace(campaign, rules, { forgiving = false, difficulty = 'normal' } = {}) {
  const due = atColony(campaign, rules) ? placeFightDue(campaign, rules) : null;
  if (!due) return { ok: false, error: 'There is no one here to fight.' };
  const members = squadMembers(campaign.crew, campaign.colony.trip.squad);
  if (!members.length) return { ok: false, error: 'There is no one aboard to fight.' };
  const unknown = members.find((member) => !rules.jobs.has(member.job));
  if (unknown) return { ok: false, error: `${unknown.name}'s job "${unknown.job}" is unknown.` };
  const her = generateShip(rules, due.preset.id, due.place.seed);
  if (!her.ok) return { ok: false, error: her.error };
  const map = mapFromShip(her.ship, rules, { wrecked: her.wrecked });
  if (!map) return { ok: false, error: 'There is no ship to fight on.' };
  const jobs = members.map((member) => member.job);
  // deploy puts its first list on the bridge and its second at the hatches.
  const placed = deploy(map, due.party, jobs, rules);
  if (!placed.ok) return { ok: false, error: `There isn't room aboard her for ${jobs.length} crew and ${due.party.length} of theirs.` };
  const units = [...placed.units.slice(due.party.length), ...placed.units.slice(0, due.party.length)];
  const { value: seed, state: afterSeed } = int(campaign.rng, 0, MAX_SEED);
  let rng = afterSeed;
  let pool = her.ship.modules.filter((module) => !(module.uid in her.wrecked) && rules.modules.has(module.type) && !hasTag(rules.modules.get(module.type), 'corridor'));
  const parts = [];
  for (let n = 0; n < due.salvage && pool.length; n++) {
    const part = pick(rng, pool);
    rng = part.state;
    parts.push(part.value.type);
    pool = pool.filter((module) => module !== part.value);
  }
  const materials = int(rng, due.materials[0], due.materials[1]);
  rng = materials.state;
  const bonus = enemyBonus(difficulty, rules.balance);
  const fighters = units.map((unit, i) => {
    const member = members[i];
    return member ? { ...unit, ...crewUnit(member, rules) } : { ...unit, bonus };
  });
  const { battle, events } = createBattle({ map, units: fighters, seed, options: { forgiving, press: false } }, rules);
  const encounter = kindOf(due.place, rules).held.party;
  const fight = { encounter, seed, crew: members.map((member) => member.id), battle, log: events, job: null, raid: false, boarding: { dir: 'them', salvage: { parts, credits: 0, materials: materials.value } } };
  return { ok: true, campaign: { ...campaign, rng, place: 'fight', fight } };
}

// After the fight at a place, once it is won or lost (campaign.js
// endFight: wounds kept, the fights counted): a win brings her salvage
// home, her parts into the hold and her materials into the colony's stores
// as far as they go; a loss brings the squad back hurt with nothing. The
// trip is done either way. Any other fight is left as it is.
export function endPlaceFight(campaign, rules) {
  const { fight } = campaign;
  if (!fight?.boarding || !campaign.colony?.trip) return campaign;
  const after = endFight(campaign, rules);
  if (after === campaign) return campaign;
  const won = fight.battle.winner === 'crew';
  const { salvage } = fight.boarding;
  const parts = { ...after.parts };
  let materials = 0;
  if (won) {
    for (const type of salvage.parts) parts[type] = (parts[type] ?? 0) + 1;
    const room = Math.max(0, storesOf(after, rules).total - after.colony.materials);
    materials = Math.min(salvage.materials ?? 0, room);
  }
  const result = { won, parts: won ? [...salvage.parts] : [], materials };
  const ids = new Set(after.crew.map((member) => member.id));
  const trip = { ...after.colony.trip, squad: after.colony.trip.squad.filter((id) => ids.has(id)), done: true, result };
  const flags = tally(after.flags, { [won ? 'placeFightsWon' : 'placeFightsLost']: 1, tripParts: result.parts.length, tripMaterials: materials });
  return { ...after, parts, flags, colony: { ...after.colony, materials: after.colony.materials + materials, trip } };
}

// What flying home would come to: { ok: true, days (back), eats, food
// ([now, home]), hungry }, or { ok: false, error }: with the ship home, or
// at a place whose event is still to decide. A derelict the scavengers
// hold can be left without a fight.
export function homePlan(campaign, rules) {
  const trip = atColony(campaign, rules) ? campaign.colony.trip : null;
  if (!trip) return { ok: false, error: 'The ship is home.' };
  const here = tripHere(campaign, rules);
  if (here.event) return { ok: false, error: `Decide first: ${here.event.title}.` };
  const back = passDays(campaign, rules, trip.place.days);
  return {
    ok: true,
    days: trip.place.days,
    eats: back.days.reduce((sum, day) => sum + day.plan.eats, 0),
    food: [campaign.supplies, back.campaign.supplies],
    hungry: back.days.filter((day) => !day.plan.fed).length,
  };
}

// Flies home (see homePlan): the days back pass at the colony one by one
// with the ship away, then it lands, the squad is home, and a new list of
// places is rolled. Returns { ok: true, plan, campaign, days } or { ok:
// false, error }.
export function flyHome(campaign, rules) {
  const plan = homePlan(campaign, rules);
  if (!plan.ok) return plan;
  const back = passDays(campaign, rules, campaign.colony.trip.place.days);
  const landed = { ...back.campaign, colony: { ...back.campaign.colony, trip: null }, flags: tally(back.campaign.flags, { tripsHome: 1 }) };
  return { ok: true, plan, campaign: withPlaces(landed, rules), days: back.days };
}

// A trip to place with the squad (ids), just under way.
function newTrip(place, squad) {
  return { place, squad, done: false, result: null };
}

// The campaign after n of the colony's days with the ship away, each
// counted as a day away: { campaign, days (each day's passDay result) }.
// Days stop at the most a colony counts (days.js MAX_DAYS).
function passDays(campaign, rules, n) {
  let now = campaign;
  const days = [];
  for (let d = 0; d < n; d++) {
    const day = passDay(now, rules);
    if (!day.ok) break;
    days.push(day);
    now = day.campaign;
  }
  return { campaign: days.length ? { ...now, flags: tally(now.flags, { daysAway: days.length }) } : now, days };
}

function lowerFirst(text) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
