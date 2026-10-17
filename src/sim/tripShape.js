// What the colony's places and its trip (expeditions.js, M28) must look
// like in a save, for the save's checks (campaign.js campaignProblems).
// Shape only: whether a place's kind and event are the content's is the
// rules' business. Pure.
import { isQuestNote } from './questShape.js';
import { isShipChanges, MAX_PLACE_NAME } from './runShape.js';

// More places than the list holds (data/expeditions.json places, held to
// this by tools/validate-expeditions.js, and a scout's more, capped at it:
// expeditions.js rollPlaces), and more days away than any place is.
export const MAX_PLACES = 6;
export const MAX_AWAY = 9;
// More crew than a squad takes, parts than a boarding strips and materials
// than a trip brings: guards on what a save can hold.
const MAX_SQUAD = 9;
const MAX_SALVAGE = 20;
const MAX_AMOUNT = 9999;
const MAX_SEED = 0xffffffff;
const ID = /^[a-z][a-z0-9-]*$/;

// A place within reach: { kind, name, days, event, held, seed }, and a
// quest's (M33b) its quest. A place the scavengers hold has no event, and a
// quest's is always held.
export function isPlace(place) {
  if (!isRecord(place) || !isId(place.kind) || !isName(place.name) || !isInt(place.days, 1, MAX_AWAY)) return false;
  if (typeof place.held !== 'boolean' || !isInt(place.seed, 0, MAX_SEED)) return false;
  if (place.quest !== undefined && !(isId(place.quest) && place.held)) return false;
  return place.held ? place.event === null : place.event === null || isId(place.event);
}

// Why the colony's trip is unreadable, as words to follow "The campaign's
// trip ", or null if it reads. crew: the campaign's crew, whom the squad is
// drawn from.
export function tripProblem(trip, crew) {
  if (!isRecord(trip) || !isPlace(trip.place) || typeof trip.done !== 'boolean') return 'is unreadable';
  const ids = new Set(crew.map((member) => member?.id));
  const { squad } = trip;
  // A squad lost in a fight where death is permanent leaves none aboard to
  // come home, and the ship comes home on its own.
  if (!Array.isArray(squad) || (!squad.length && !trip.done) || squad.length > MAX_SQUAD || new Set(squad).size !== squad.length || !squad.every((id) => ids.has(id))) {
    return "names a squad that isn't the crew's";
  }
  if (trip.result !== null && !isResult(trip.result)) return 'has an unreadable result';
  // A trap at the place (M36) leaves its event's result while its fight is
  // still to come.
  const sprung = trip.result !== null && !trip.done && trip.place.held && trip.result.changes?.ambush === true;
  if ((trip.result !== null) !== trip.done && !sprung) return "doesn't match what was done";
  if (trip.leg !== null && !isLeg(trip.leg)) return 'has an unreadable leg';
  if (trip.leg?.dir === 'out' && trip.done) return "is done at a place it hasn't reached";
  return null;
}

// A leg a raid stopped (M29, expeditions.js): which way, and the days still
// to fly.
function isLeg(leg) {
  return isRecord(leg) && (leg.dir === 'out' || leg.dir === 'home') && isInt(leg.left, 1, MAX_AWAY);
}

// What came of the place: an event's (events.js: { event, choice, outcome,
// roll, changes }), or a fight's ({ won, parts, materials }, and won at a
// quest's place, quest: what came of the quest, M33b).
function isResult(result) {
  if (!isRecord(result)) return false;
  if (typeof result.won === 'boolean') {
    return Array.isArray(result.parts) && result.parts.length <= MAX_SALVAGE && result.parts.every(isId) && isInt(result.materials, 0, MAX_AMOUNT) && (result.quest === undefined || (result.won && isQuestNote(result.quest)));
  }
  return isId(result.event) && isId(result.choice) && isInt(result.outcome, 0, 9) && (result.roll === null || isInt(result.roll, 0, 99)) && isRecord(result.changes) && isShipChanges(result.changes) && (result.taker === undefined || isInt(result.taker, 0, MAX_AMOUNT));
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isId(value) {
  return typeof value === 'string' && ID.test(value);
}

function isName(value) {
  return typeof value === 'string' && value.trim() !== '' && value.length <= MAX_PLACE_NAME;
}

function isInt(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}
